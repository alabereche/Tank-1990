/**
 * Battle City 1990 - High Precision Multiplayer Client
 * Handles WebSocket connection, heartbeat ping/pong, room joining,
 * and high-frequency input & state synchronization.
 */

import { InputState, MultiplayerMode, MultiplayerRole } from '../types';
import { WebRTCManager } from './WebRTCManager';

export type NetworkEventHandler = (payload: any) => void;

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private webrtc: WebRTCManager;
  private handlers: Map<string, Set<NetworkEventHandler>> = new Map();
  private pingInterval: number | null = null;
  private currentPing: number = 0;
  private roomCode: string | null = null;
  private role: MultiplayerRole | null = null;
  private mode: MultiplayerMode = 'coop';
  private slot: number = 1;
  private team: 'A' | 'B' | 'FFA' = 'FFA';
  private isConnecting: boolean = false;
  private shouldReconnect: boolean = true;
  private reconnectAttempts: number = 0;

  constructor() {
    this.webrtc = new WebRTCManager(
      (sig) => this.send(sig),
      (msg) => this.handleIncomingMessage(msg)
    );

    this.webrtc.onStatusChange = (status) => {
      this.emit('transport_status', status);
      if (status.active) {
        this.currentPing = status.ping;
        this.emit('ping_updated', { ping: status.ping, transport: 'p2p' });
      }
    };
  }

  public connect(): Promise<boolean> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve(true);
    }

    this.shouldReconnect = true;
    this.isConnecting = true;

    return new Promise((resolve) => {
      try {
        let wsUrl: string;
        const envWsUrl = (import.meta as any).env?.VITE_WS_URL;
        if (envWsUrl) {
          wsUrl = envWsUrl;
        } else if (
          typeof window !== 'undefined' &&
          (window.location.host === 'tank.nosfir.online' ||
            window.location.host === 'tank1990.pages.dev' ||
            window.location.host.endsWith('.tank1990.pages.dev'))
        ) {
          wsUrl = 'wss://api-tank.nosfir.online/ws';
        } else if (typeof window !== 'undefined' && (window.location.protocol === 'file:' || !window.location.host)) {
          wsUrl = 'ws://127.0.0.1:3000/ws';
        } else {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const host = window.location.host;
          wsUrl = `${protocol}//${host}/ws`;
        }

        const socket = new WebSocket(wsUrl);
        this.ws = socket;

        socket.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected', { success: true });
          resolve(true);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'pong') {
              const rtt = Math.round(performance.now() - data.timestamp);
              this.currentPing = Math.max(1, rtt);
              this.emit('ping_updated', { ping: this.currentPing, transport: this.getTransport() });
              return;
            }

            if (data.type === 'webrtc_signal') {
              this.webrtc.handleSignal(data);
              return;
            }

            if (data.type === 'room_created') {
              this.roomCode = data.code;
              this.role = 'host';
              this.mode = data.mode;
              this.slot = data.slot || 1;
              this.team = data.team || (data.mode === '2v2' ? 'A' : 'FFA');
              this.webrtc.init('host', 1, 2);
            } else if (data.type === 'player_joined') {
              if (this.role === 'host') {
                const guestSlot = data.slot || 2;
                this.webrtc.init('host', 1, guestSlot);
                this.webrtc.startOffer();
              }
            } else if (data.type === 'room_joined') {
              this.roomCode = data.code;
              this.role = 'guest';
              this.mode = data.mode;
              this.slot = data.slot || 2;
              this.team = data.team || 'FFA';
              this.webrtc.init('guest', this.slot, 1);
            }

            this.emit(data.type, data);
          } catch {
            // Ignore non-JSON messages
          }
        };

        socket.onclose = () => {
          this.isConnecting = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code: this.roomCode });

          // Auto-reconnect if not closed manually
          if (this.shouldReconnect && this.reconnectAttempts < 5) {
            this.reconnectAttempts++;
            const backoff = Math.min(3000, 500 * Math.pow(1.5, this.reconnectAttempts));
            setTimeout(() => {
              if (this.shouldReconnect) {
                this.connect();
              }
            }, backoff);
          }
        };

        socket.onerror = (err) => {
          this.isConnecting = false;
          this.emit('error', { message: 'Connection Error', error: err });
          resolve(false);
        };
      } catch (err) {
        this.isConnecting = false;
        resolve(false);
      }
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          timestamp: performance.now(),
        });
      }
    }, 2500);
  }

  private stopHeartbeat() {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public send(payload: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch {
        // Send buffer full or connection reset
      }
    }
  }

  // --- Actions ---
  public createRoom(
    mode: MultiplayerMode = 'coop',
    mapSize: string = 'classic',
    stage: number = 1,
    customMapGrid?: number[][]
  ) {
    this.send({
      type: 'create_room',
      mode,
      mapSize,
      stage,
      customMapGrid,
    });
  }

  public joinRoom(code: string) {
    this.send({
      type: 'join_room',
      code: code.trim().toUpperCase(),
    });
  }

  public requestStartGame() {
    this.send({
      type: 'request_start',
    });
  }

  public sendSyncState(state: Record<string, unknown>) {
    // Wrapped under `snapshot` - the guest handler reads data.snapshot
    const payload = {
      type: 'sync_state',
      snapshot: state,
    };
    if (!this.webrtc.sendDirect(payload)) {
      this.send(payload);
    }
  }

  public sendInput(input: InputState, slot?: number, seq?: number) {
    const payload = {
      type: 'player_input',
      input,
      slot: slot ?? this.slot,
      seq,
    };
    if (!this.webrtc.sendDirect(payload)) {
      this.send(payload);
    }
  }

  public sendGameEvent(event: Record<string, unknown>) {
    const payload = {
      type: 'game_event',
      ...event,
    };
    if (!this.webrtc.sendDirect(payload)) {
      this.send(payload);
    }
  }

  public sendTaunt(text: string, sender?: 'P1' | 'P2' | string) {
    this.send({
      type: 'taunt',
      text,
      sender,
    });
  }

  // --- Subscriptions ---
  public on(event: string, handler: NetworkEventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  private emit(event: string, payload: any) {
    const list = this.handlers.get(event);
    if (list) {
      list.forEach((handler) => {
        try {
          handler(payload);
        } catch (e) {
          console.error(`Error in network handler for event "${event}":`, e);
        }
      });
    }
  }

  private handleIncomingMessage(data: any) {
    if (!data || !data.type) return;
    this.emit(data.type, data);
  }

  public getPing(): number {
    return this.currentPing;
  }

  public isP2P(): boolean {
    return this.webrtc.isConnected;
  }

  public getTransport(): 'p2p' | 'relay' {
    return this.webrtc.isConnected ? 'p2p' : 'relay';
  }

  public getRoomCode(): string | null {
    return this.roomCode;
  }

  public getRole(): MultiplayerRole | null {
    return this.role;
  }

  public getMode(): MultiplayerMode {
    return this.mode;
  }

  public getSlot(): number {
    return this.slot;
  }

  public getTeam(): 'A' | 'B' | 'FFA' {
    return this.team;
  }

  public isConnected(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  public disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    this.webrtc.cleanup();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.roomCode = null;
    this.role = null;
  }
}

// Global Singleton for easy access across the game engine
export const multiplayerClient = new MultiplayerClient();
