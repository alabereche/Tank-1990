/**
 * Battle City 1990 - WebRTC P2P Star-Topology Transport
 *
 * One peer connection per (host <-> guest) pair. Two channels per peer:
 *  - 'tank_ctrl' (ordered, reliable): inputs, pings — must arrive.
 *  - 'tank_fast' (unordered, maxRetransmits: 0): snapshots & events —
 *    stale packets are dropped by tick, so loss never stalls the stream
 *    (no Head-of-Line blocking on lossy mobile links).
 * WebSocket stays the automatic fallback for everything, plus the
 * signaling channel during the initial handshake.
 */

export interface WebRTCSignalPayload {
  type: 'webrtc_signal';
  signalType: 'offer' | 'answer' | 'ice';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  targetSlot?: number;
  fromSlot?: number;
  fromRole?: string;
}

export type WebRTCMessageHandler = (data: any) => void;

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

interface PeerEntry {
  pc: RTCPeerConnection;
  ctrl: RTCDataChannel | null;
  fast: RTCDataChannel | null;
  pendingCandidates: RTCIceCandidateInit[];
  ping: number;
  pingTimer: number | null;
  offered: boolean;
}

export class WebRTCManager {
  private peers = new Map<number, PeerEntry>();
  private sendSignal: (payload: Record<string, unknown>) => void;
  private messageHandler: WebRTCMessageHandler | null = null;
  private isHost = false;
  private localSlot = 1;

  public onStatusChange?: (status: { active: boolean; ping: number; transport: 'p2p' | 'relay' }) => void;

  constructor(
    sendSignal: (payload: Record<string, unknown>) => void,
    messageHandler: WebRTCMessageHandler
  ) {
    this.sendSignal = sendSignal;
    this.messageHandler = messageHandler;
  }

  /** True when at least one peer's control channel is open. */
  public get isConnected(): boolean {
    for (const p of this.peers.values()) {
      if (p.ctrl?.readyState === 'open') return true;
    }
    return false;
  }

  /** Worst-link RTT across peers (honest number for a broadcasting host). */
  public getPing(): number {
    let worst = 0;
    for (const p of this.peers.values()) {
      if (p.ctrl?.readyState === 'open') worst = Math.max(worst, p.ping);
    }
    return worst;
  }

  /** Creates (or returns) the peer entry for a target slot. Idempotent. */
  public init(role: 'host' | 'guest', localSlot: number = 1, targetSlot: number = 2) {
    this.isHost = role === 'host';
    this.localSlot = localSlot;
    if (typeof RTCPeerConnection === 'undefined') return;
    if (this.peers.has(targetSlot)) return;
    this.createPeer(targetSlot);
  }

  private createPeer(targetSlot: number): PeerEntry | null {
    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      const entry: PeerEntry = {
        pc,
        ctrl: null,
        fast: null,
        pendingCandidates: [],
        ping: 0,
        pingTimer: null,
        offered: false,
      };
      this.peers.set(targetSlot, entry);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal({
            type: 'webrtc_signal',
            signalType: 'ice',
            candidate: event.candidate.toJSON(),
            targetSlot,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          this.teardownPeer(targetSlot);
          this.notifyStatus();
        }
      };

      if (this.isHost) {
        // Host creates both channels per guest (star topology)
        const ctrl = pc.createDataChannel('tank_ctrl', { ordered: true });
        const fast = pc.createDataChannel('tank_fast', {
          ordered: false,
          maxRetransmits: 0,
        });
        this.attachChannel(entry, ctrl);
        this.attachChannel(entry, fast);
      } else {
        // Guest receives the host's channels by label
        pc.ondatachannel = (event) => {
          if (event.channel.label === 'tank_fast') {
            this.attachChannel(entry, event.channel, true);
          } else {
            this.attachChannel(entry, event.channel);
          }
        };
      }
      return entry;
    } catch (err) {
      console.warn('[WebRTC] Peer init failed, staying on relay:', err);
      return null;
    }
  }

  private attachChannel(entry: PeerEntry, dc: RTCDataChannel, isFast = false) {
    if (isFast) entry.fast = dc;
    else entry.ctrl = dc;

    dc.onopen = () => {
      if (!isFast && !entry.pingTimer) {
        entry.pingTimer = window.setInterval(() => {
          this.rawSend(entry, 'ctrl', { __p2p_ping: performance.now() });
        }, 1000);
      }
      this.notifyStatus();
    };
    dc.onclose = () => {
      if (!isFast && entry.pingTimer !== null) {
        clearInterval(entry.pingTimer);
        entry.pingTimer = null;
      }
      this.notifyStatus();
    };
    dc.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.__p2p_ping !== undefined) {
          this.rawSend(entry, 'ctrl', { __p2p_pong: parsed.__p2p_ping });
          return;
        }
        if (parsed.__p2p_pong !== undefined) {
          const rtt = Math.max(1, Math.round(performance.now() - parsed.__p2p_pong));
          entry.ping = entry.ping === 0 ? rtt : Math.round(entry.ping * 0.7 + rtt * 0.3);
          this.notifyStatus();
          return;
        }
        if (this.messageHandler) this.messageHandler(parsed);
      } catch {
        // Ignore malformed payloads
      }
    };
  }

  /** Host side: offer to every connected peer that has none yet. */
  public async startOffer(): Promise<void> {
    if (!this.isHost) return;
    for (const [slot, entry] of this.peers) {
      if (entry.offered) continue;
      entry.offered = true;
      try {
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        this.sendSignal({
          type: 'webrtc_signal',
          signalType: 'offer',
          sdp: offer,
          targetSlot: slot,
        });
      } catch (err) {
        console.warn('[WebRTC] Offer failed for slot', slot, err);
      }
    }
  }

  public async handleSignal(signal: WebRTCSignalPayload): Promise<void> {
    const from = signal.fromSlot ?? 1;
    let entry = this.peers.get(from);
    if (!entry) {
      if (this.isHost) {
        const created = this.createPeer(from);
        if (!created) return;
        entry = created;
        entry.offered = true; // remote initiated; do not re-offer
      } else {
        return;
      }
    }

    try {
      if (signal.signalType === 'offer' && signal.sdp) {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        for (const c of entry.pendingCandidates) await entry.pc.addIceCandidate(new RTCIceCandidate(c));
        entry.pendingCandidates = [];
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        this.sendSignal({
          type: 'webrtc_signal',
          signalType: 'answer',
          sdp: answer,
          targetSlot: from,
        });
      } else if (signal.signalType === 'answer' && signal.sdp) {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        for (const c of entry.pendingCandidates) await entry.pc.addIceCandidate(new RTCIceCandidate(c));
        entry.pendingCandidates = [];
      } else if (signal.signalType === 'ice' && signal.candidate) {
        if (entry.pc.remoteDescription) {
          await entry.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          entry.pendingCandidates.push(signal.candidate);
        }
      }
    } catch (err) {
      console.warn('[WebRTC] Signal handling error:', err);
    }
  }

  private rawSend(entry: PeerEntry, kind: 'ctrl' | 'fast', payload: Record<string, unknown>): boolean {
    const dc = kind === 'fast' ? entry.fast : entry.ctrl;
    if (dc?.readyState === 'open') {
      try {
        dc.send(JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /** Reliable ordered channel (inputs etc.). True if sent to >=1 peer. */
  public sendCtrl(payload: Record<string, unknown>): boolean {
    let sent = false;
    for (const entry of this.peers.values()) {
      if (this.rawSend(entry, 'ctrl', payload)) sent = true;
    }
    return sent;
  }

  /** Loss-tolerant channel (snapshots/events); falls back to ctrl. */
  public sendFast(payload: Record<string, unknown>): boolean {
    let sent = false;
    for (const entry of this.peers.values()) {
      if (this.rawSend(entry, 'fast', payload) || this.rawSend(entry, 'ctrl', payload)) sent = true;
    }
    return sent;
  }

  public sendDirect(payload: Record<string, unknown>): boolean {
    return this.sendCtrl(payload);
  }

  private teardownPeer(slot: number) {
    const entry = this.peers.get(slot);
    if (!entry) return;
    if (entry.pingTimer !== null) clearInterval(entry.pingTimer);
    try { entry.ctrl?.close(); } catch {}
    try { entry.fast?.close(); } catch {}
    try { entry.pc.close(); } catch {}
    this.peers.delete(slot);
  }

  private notifyStatus() {
    if (this.onStatusChange) {
      this.onStatusChange({
        active: this.isConnected,
        ping: this.isConnected ? this.getPing() : 0,
        transport: this.isConnected ? 'p2p' : 'relay',
      });
    }
  }

  public cleanup() {
    for (const slot of Array.from(this.peers.keys())) this.teardownPeer(slot);
    this.notifyStatus();
  }
}
