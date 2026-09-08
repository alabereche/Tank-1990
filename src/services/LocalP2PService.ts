/**
 * Battle City 1990 - Direct Local Wi-Fi & Cross-Platform P2P Service
 * Uses WebRTC RTCDataChannel for real-time (60fps, 1-4ms latency) gameplay packets.
 * Supports cross-play between PC (.exe / web) and Mobile (Android APK / PWA).
 */

import { InputState, GameScore, StageMap } from '../types';

export type P2PRole = 'host' | 'guest';
export type P2PConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface P2PMessage {
  type: 'input' | 'snapshot' | 'taunt' | 'stage_start' | 'pause' | 'ready' | 'ping' | 'pong';
  payload: any;
  timestamp: number;
}

export interface LocalP2PCallbacks {
  onStateChange: (state: P2PConnectionState, message?: string) => void;
  onRemoteInput?: (input: InputState) => void;
  onSnapshot?: (snapshot: any) => void;
  onTaunt?: (text: string) => void;
  onStageStart?: (
    stage: number,
    map?: StageMap,
    mode?: 'coop' | 'versus',
    versusSubMode?: 'classic' | 'payload',
    mapSize?: 'classic' | 'large' | 'giant'
  ) => void;
  onRemotePause?: (paused: boolean) => void;
  onLatencyUpdate?: (ms: number) => void;
}

export class LocalP2PService {
  private static instance: LocalP2PService | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private role: P2PRole = 'host';
  private state: P2PConnectionState = 'disconnected';
  private roomCode: string = '';
  private callbacks: LocalP2PCallbacks | null = null;
  private sseEventSource: EventSource | null = null;
  private answerPollInterval: number | null = null;
  private pingInterval: number | null = null;
  private lastPingSentTime: number = 0;
  private stageStartListeners: Set<(
    stage: number,
    map?: StageMap,
    mode?: 'coop' | 'versus',
    versusSubMode?: 'classic' | 'payload',
    mapSize?: 'classic' | 'large' | 'giant'
  ) => void> = new Set();

  private iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  public static getInstance(): LocalP2PService {
    if (!LocalP2PService.instance) {
      LocalP2PService.instance = new LocalP2PService();
    }
    return LocalP2PService.instance;
  }

  public addStageStartListener(
    listener: (
      stage: number,
      map?: StageMap,
      mode?: 'coop' | 'versus',
      versusSubMode?: 'classic' | 'payload',
      mapSize?: 'classic' | 'large' | 'giant'
    ) => void
  ): () => void {
    this.stageStartListeners.add(listener);
    return () => {
      this.stageStartListeners.delete(listener);
    };
  }

  public setCallbacks(callbacks: LocalP2PCallbacks) {
    this.callbacks = callbacks;
  }

  public getState(): P2PConnectionState {
    return this.state;
  }

  public getRole(): P2PRole {
    return this.role;
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  private updateState(newState: P2PConnectionState, msg?: string) {
    this.state = newState;
    this.callbacks?.onStateChange(newState, msg);
  }

  /**
   * HOST: Creates a new local room and listens for Guest over local network / signaling
   */
  public async createRoom(roomCode?: string): Promise<string> {
    this.disconnect();
    this.role = 'host';
    this.roomCode = roomCode || Math.floor(1000 + Math.random() * 9000).toString();
    this.updateState('connecting', `HOSTING ROOM ${this.roomCode}...`);

    try {
      this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

      // Create low-latency unreliable UDP data channel for 60fps game inputs
      this.dataChannel = this.peerConnection.createDataChannel('tank-battle-data', {
        ordered: false,
        maxRetransmits: 0,
      });

      this.setupDataChannel(this.dataChannel);

      // Collect ICE candidates and create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Wait for local ICE gathering to complete so offer is self-contained
      await this.waitForIceGathering(this.peerConnection);

      const localDesc = this.peerConnection.localDescription;
      if (!localDesc) throw new Error('Failed to generate local SDP offer');

      // Publish offer to fast signaling relay as text/plain
      await fetch(`https://ntfy.sh/bc1990-${this.roomCode}-offer`, {
        method: 'POST',
        body: JSON.stringify(localDesc),
        headers: { 'Content-Type': 'text/plain' },
      });

      // Listen for Guest answer via SSE + periodic poll fallback
      this.listenForAnswer();

      return this.roomCode;
    } catch (err: any) {
      console.error('Failed to create P2P room:', err);
      this.updateState('error', err?.message || 'FAILED TO CREATE ROOM');
      throw err;
    }
  }

  /**
   * GUEST: Joins an existing room by 4-digit code
   */
  public async joinRoom(roomCode: string): Promise<void> {
    this.disconnect();
    this.role = 'guest';
    this.roomCode = roomCode.trim();
    this.updateState('connecting', `SEARCHING ROOM ${this.roomCode}...`);

    try {
      // 1. Fetch Host offer from signaling relay with retry loop (up to 15 attempts, 1s apart)
      let offer: any = null;
      for (let attempt = 1; attempt <= 15; attempt++) {
        try {
          const rawResp = await fetch(
            `https://ntfy.sh/bc1990-${this.roomCode}-offer/raw?poll=1&since=all`,
            { cache: 'no-store' }
          );
          if (rawResp.ok) {
            const rawText = await rawResp.text();
            if (rawText && rawText.includes('sdp')) {
              const lines = rawText.trim().split('\n');
              for (let i = lines.length - 1; i >= 0; i--) {
                try {
                  const candidate = JSON.parse(lines[i]);
                  if (candidate && candidate.sdp) {
                    offer = candidate;
                    break;
                  }
                } catch {}
              }
              if (offer) break;
            }
          }

          const jsonResp = await fetch(
            `https://ntfy.sh/bc1990-${this.roomCode}-offer/json?poll=1&since=all`,
            { cache: 'no-store' }
          );
          if (jsonResp.ok) {
            const jsonText = await jsonResp.text();
            if (jsonText && jsonText.includes('sdp')) {
              const lines = jsonText.trim().split('\n');
              for (let i = lines.length - 1; i >= 0; i--) {
                try {
                  const ev = JSON.parse(lines[i]);
                  if (ev.message) {
                    const candidate = JSON.parse(ev.message);
                    if (candidate && candidate.sdp) {
                      offer = candidate;
                      break;
                    }
                  }
                } catch {}
              }
              if (offer) break;
            }
          }
        } catch {}

        if (offer) break;
        this.updateState('connecting', `LOCATING ROOM ${this.roomCode} (${attempt}/15)...`);
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!offer) {
        throw new Error(`ROOM ${this.roomCode} NOT FOUND. VERIFY HOST IS RUNNING.`);
      }

      this.updateState('connecting', 'EXCHANGING HANDSHAKE...');

      this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

      this.peerConnection.ondatachannel = (e) => {
        this.dataChannel = e.channel;
        this.setupDataChannel(this.dataChannel);
      };

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Wait for ICE candidates
      await this.waitForIceGathering(this.peerConnection);

      const localDesc = this.peerConnection.localDescription;

      // Publish answer to Host as text/plain
      await fetch(`https://ntfy.sh/bc1990-${this.roomCode}-answer`, {
        method: 'POST',
        body: JSON.stringify(localDesc),
        headers: { 'Content-Type': 'text/plain' },
      });

      this.updateState('connecting', 'HANDSHAKE SENT! WAITING FOR PEER...');
    } catch (err: any) {
      console.error('Failed to join P2P room:', err);
      this.updateState('error', err?.message || 'FAILED TO JOIN ROOM');
      throw err;
    }
  }

  /**
   * Manual offline token export for 100% offline environments (no internet at all)
   */
  public async exportOfflineOffer(): Promise<string> {
    this.disconnect();
    this.role = 'host';
    this.roomCode = 'OFFLINE';
    this.peerConnection = new RTCPeerConnection({ iceServers: [] });
    this.dataChannel = this.peerConnection.createDataChannel('tank-battle-data', {
      ordered: false,
      maxRetransmits: 0,
    });
    this.setupDataChannel(this.dataChannel);
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await this.waitForIceGathering(this.peerConnection);
    return btoa(JSON.stringify(this.peerConnection.localDescription));
  }

  public async importOfflineAnswer(base64Answer: string): Promise<void> {
    if (!this.peerConnection) throw new Error('No active connection to answer');
    const answer = JSON.parse(atob(base64Answer));
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  public async createOfflineAnswer(base64Offer: string): Promise<string> {
    this.disconnect();
    this.role = 'guest';
    this.roomCode = 'OFFLINE';
    this.peerConnection = new RTCPeerConnection({ iceServers: [] });
    this.peerConnection.ondatachannel = (e) => {
      this.dataChannel = e.channel;
      this.setupDataChannel(this.dataChannel);
    };
    const offer = JSON.parse(atob(base64Offer));
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    await this.waitForIceGathering(this.peerConnection);
    return btoa(JSON.stringify(this.peerConnection.localDescription));
  }

  private listenForAnswer() {
    if (this.sseEventSource) {
      this.sseEventSource.close();
      this.sseEventSource = null;
    }
    if (this.answerPollInterval !== null) {
      clearInterval(this.answerPollInterval);
      this.answerPollInterval = null;
    }

    const applyAnswer = async (answerObj: any) => {
      if (answerObj?.sdp && this.peerConnection && this.peerConnection.signalingState !== 'stable') {
        try {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerObj));
          if (this.sseEventSource) {
            this.sseEventSource.close();
            this.sseEventSource = null;
          }
          if (this.answerPollInterval !== null) {
            clearInterval(this.answerPollInterval);
            this.answerPollInterval = null;
          }
        } catch (e) {
          console.warn('Error applying remote answer:', e);
        }
      }
    };

    // 1. Listen via SSE
    const sseUrl = `https://ntfy.sh/bc1990-${this.roomCode}-answer/sse`;
    try {
      this.sseEventSource = new EventSource(sseUrl);
      this.sseEventSource.onmessage = async (e) => {
        try {
          const eventData = JSON.parse(e.data);
          if (eventData.message) {
            try {
              const answer = JSON.parse(eventData.message);
              await applyAnswer(answer);
            } catch {}
          }
        } catch {}
      };
      this.sseEventSource.onerror = () => {};
    } catch {}

    // 2. Active Polling fallback every 1000ms with since=all
    this.answerPollInterval = window.setInterval(async () => {
      if (!this.peerConnection || this.peerConnection.signalingState === 'stable' || this.state === 'connected') {
        if (this.answerPollInterval !== null) {
          clearInterval(this.answerPollInterval);
          this.answerPollInterval = null;
        }
        return;
      }

      try {
        const rawResp = await fetch(
          `https://ntfy.sh/bc1990-${this.roomCode}-answer/raw?poll=1&since=all`,
          { cache: 'no-store' }
        );
        if (rawResp.ok) {
          const rawText = await rawResp.text();
          if (rawText && rawText.includes('sdp')) {
            const lines = rawText.trim().split('\n');
            for (let i = lines.length - 1; i >= 0; i--) {
              try {
                const cand = JSON.parse(lines[i]);
                if (cand?.sdp) {
                  await applyAnswer(cand);
                  return;
                }
              } catch {}
            }
          }
        }

        const jsonResp = await fetch(
          `https://ntfy.sh/bc1990-${this.roomCode}-answer/json?poll=1&since=all`,
          { cache: 'no-store' }
        );
        if (jsonResp.ok) {
          const jsonText = await jsonResp.text();
          if (jsonText && jsonText.includes('sdp')) {
            const lines = jsonText.trim().split('\n');
            for (let i = lines.length - 1; i >= 0; i--) {
              try {
                const ev = JSON.parse(lines[i]);
                if (ev?.message) {
                  const parsed = JSON.parse(ev.message);
                  if (parsed?.sdp) {
                    await applyAnswer(parsed);
                    return;
                  }
                }
              } catch {}
            }
          }
        }
      } catch {}
    }, 1000);
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      this.updateState('connected', 'WI-FI PEER CONNECTED!');
      this.startPingLoop();
    };

    channel.onclose = () => {
      this.updateState('disconnected', 'PEER DISCONNECTED');
      this.stopPingLoop();
    };

    channel.onerror = (err) => {
      console.warn('P2P DataChannel error:', err);
    };

    channel.onmessage = (e) => {
      this.handleIncomingData(e.data);
    };
  }

  private handleIncomingData(data: any) {
    try {
      let msg: P2PMessage;
      if (typeof data === 'string') {
        msg = JSON.parse(data);
      } else {
        const text = new TextDecoder().decode(data);
        msg = JSON.parse(text);
      }

      switch (msg.type) {
        case 'input':
          this.callbacks?.onRemoteInput?.(msg.payload);
          break;
        case 'snapshot':
          this.callbacks?.onSnapshot?.(msg.payload);
          break;
        case 'taunt':
          this.callbacks?.onTaunt?.(msg.payload);
          break;
        case 'stage_start':
          this.callbacks?.onStageStart?.(
            msg.payload?.stage,
            msg.payload?.map,
            msg.payload?.mode,
            msg.payload?.versusSubMode,
            msg.payload?.mapSize
          );
          for (const listener of this.stageStartListeners) {
            try {
              listener(
                msg.payload?.stage,
                msg.payload?.map,
                msg.payload?.mode,
                msg.payload?.versusSubMode,
                msg.payload?.mapSize
              );
            } catch {}
          }
          break;
        case 'pause':
          this.callbacks?.onRemotePause?.(msg.payload);
          break;
        case 'ping':
          this.sendMessage('pong', { clientTimestamp: msg.payload?.clientTimestamp });
          break;
        case 'pong':
          if (msg.payload?.clientTimestamp) {
            const rtt = Date.now() - msg.payload.clientTimestamp;
            this.callbacks?.onLatencyUpdate?.(Math.round(rtt / 2));
          }
          break;
      }
    } catch {}
  }

  /**
   * Broadcast message over low-latency DataChannel
   */
  public sendMessage(type: P2PMessage['type'], payload: any) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

    // Backpressure guard: discard redundant snapshots or inputs if outgoing buffer is saturated (> 32KB)
    // Prevents packet queue buildup, Wi-Fi latency waves, and memory bloat on mobile
    if (this.dataChannel.bufferedAmount > 32768 && (type === 'snapshot' || type === 'input')) {
      return;
    }

    try {
      const msg: P2PMessage = {
        type,
        payload,
        timestamp: Date.now(),
      };
      this.dataChannel.send(JSON.stringify(msg));
    } catch {}
  }

  /**
   * Send Guest input state to Host
   */
  public sendInput(input: InputState) {
    this.sendMessage('input', input);
  }

  /**
   * Send Host game state snapshot to Guest
   */
  public sendSnapshot(snapshot: any) {
    this.sendMessage('snapshot', snapshot);
  }

  /**
   * Send quick tactical taunt
   */
  public sendTaunt(text: string) {
    this.sendMessage('taunt', text);
  }

  /**
   * Synchronize Stage deployment
   */
  public sendStageStart(
    stage: number,
    map?: StageMap,
    mode?: 'coop' | 'versus',
    versusSubMode?: 'classic' | 'payload',
    mapSize?: 'classic' | 'large' | 'giant'
  ) {
    this.sendMessage('stage_start', { stage, map, mode, versusSubMode, mapSize });
  }

  /**
   * Synchronize Pause / Resume
   */
  public sendPause(paused: boolean) {
    this.sendMessage('pause', paused);
  }

  private startPingLoop() {
    this.stopPingLoop();
    this.pingInterval = window.setInterval(() => {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.lastPingSentTime = Date.now();
        this.sendMessage('ping', { clientTimestamp: this.lastPingSentTime });
      }
    }, 2000);
  }

  private stopPingLoop() {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        resolve();
      }, 2500);

      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      pc.addEventListener('icegatheringstatechange', checkState);
    });
  }

  public disconnect() {
    this.stopPingLoop();

    if (this.answerPollInterval !== null) {
      clearInterval(this.answerPollInterval);
      this.answerPollInterval = null;
    }

    if (this.sseEventSource) {
      this.sseEventSource.close();
      this.sseEventSource = null;
    }

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }

    this.state = 'disconnected';
  }
}

export const localP2PService = LocalP2PService.getInstance();
