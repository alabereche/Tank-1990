/**
 * Battle City 1990 - High Performance Authoritative Dedicated Server
 * Express + WebSocket (ws) on Port 3000
 * Full server-side physics simulation, 60Hz fixed-tick loop,
 * client-side prediction, and authoritative snapshot broadcasting.
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GameEngine } from './src/engine/GameLoop';
import { getStageMapForPresetAndStage } from './src/engine/maps';
import { StageMap } from './src/types';

// Optional direct-UDP transport: players connect straight to this server via
// WebRTC DataChannels (loss-tolerant snapshots, no TCP head-of-line stalls).
// Missing module or unsupported platform silently falls back to WebSocket.
// Loaded lazily via a plain async function (NOT top-level await) so the esbuild
// CJS bundle stays valid.
let wrtc: any = null;
let wrtcLoad: Promise<void> | null = null;
async function ensureWrtc(): Promise<void> {
  if (wrtc || wrtcLoad) return;
  wrtcLoad = (async () => {
    try {
      const m: any = await import('@roamhq/wrtc');
      wrtc = m.default ?? m;
      console.log('[WRTC] native module loaded — P2P DataChannels enabled');
    } catch (e: any) {
      console.warn('[WRTC] native module unavailable (WebSocket relay only):', e?.message ?? e);
    }
  })();
  await wrtcLoad;
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const server = http.createServer(app);

// JSON body parser with safety limit
app.use(express.json({ limit: '50kb' }));

// Health check endpoint for uptime monitoring & Cloud Run / Railway probes
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    game: 'Battle City 1990',
    architecture: 'authoritative_dedicated_server',
    activeRooms: rooms.size,
    timestamp: Date.now(),
  });
});

// --- WebSocket Room Infrastructure ---
interface ClientSession {
  id: string;
  ws: WebSocket;
  roomCode: string | null;
  role: 'host' | 'guest' | null;
  slot: number;
  team: 'A' | 'B' | 'FFA';
  lastPing: number;
  peer?: ServerPeer | null;
}

interface Room {
  code: string;
  mode: 'coop' | 'versus' | '2v2' | 'ffa';
  mapSize: 'classic' | 'large' | 'giant';
  stage: number;
  customMapGrid?: number[][];
  host: ClientSession | null;
  clients: ClientSession[];
  maxPlayers: number;
  status: 'waiting' | 'starting' | 'playing' | 'ended';
  createdAt: number;
  lastActivity: number;
  gameEngine?: GameEngine;
  tickInterval?: NodeJS.Timeout;
  startTimeout?: NodeJS.Timeout;
}

const rooms = new Map<string, Room>();
const clientSessions = new Map<WebSocket, ClientSession>();

// Generate a clean 6-character room code (no confusing characters like 0/O or 1/I)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomCode(): string {
  for (let i = 0; i < 50; i++) {
    let code = '';
    for (let j = 0; j < 6; j++) {
      code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    if (!rooms.has(code)) return code;
  }
  return 'CITY' + Math.floor(10 + Math.random() * 90);
}

function safeSend(ws: WebSocket, message: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Socket write error ignored
    }
  }
}

/**
 * Server-side WebRTC peer: one per connected player. The browser offers
 * (targetSlot 0 = server umpire); this peer answers and exposes the same
 * two channels the clients use ('tank_ctrl' reliable, 'tank_fast'
 * loss-tolerant). Game traffic prefers the DataChannels and falls back to
 * the WebSocket automatically.
 */
class ServerPeer {
  private pc: any = null;
  private ctrl: any = null;
  private fast: any = null;

  constructor(private session: ClientSession, private onGameMessage: (raw: string) => void) {
    this.pc = new wrtc.RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this.pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        safeSend(this.session.ws, {
          type: 'webrtc_signal',
          signalType: 'ice',
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
          fromSlot: 0,
        });
      }
    };
    this.pc.ondatachannel = (event: any) => this.attach(event.channel);
  }

  private attach(dc: any) {
    if (dc.label === 'tank_fast') this.fast = dc;
    else this.ctrl = dc;
    dc.onmessage = (event: any) => {
      const raw = typeof event.data === 'string' ? event.data : event.data.toString();
      let msg: any;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.__p2p_ping !== undefined) {
        this.send('ctrl', { __p2p_pong: msg.__p2p_ping });
        return;
      }
      // Only game-relevant client traffic travels the DataChannel
      if (msg.type === 'player_input' || msg.type === 'ping') {
        this.onGameMessage(raw);
      }
    };
  }

  public send(kind: 'ctrl' | 'fast', payload: Record<string, unknown>): boolean {
    const dc = kind === 'fast' ? this.fast : this.ctrl;
    if (dc && dc.readyState === 'open') {
      try {
        dc.send(JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  public async handleSignal(msg: any): Promise<void> {
    try {
      if (msg.signalType === 'offer' && msg.sdp) {
        await this.pc.setRemoteDescription(msg.sdp);
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        safeSend(this.session.ws, {
          type: 'webrtc_signal',
          signalType: 'answer',
          sdp: answer,
          fromSlot: 0,
        });
      } else if (msg.signalType === 'ice' && msg.candidate) {
        await this.pc.addIceCandidate(msg.candidate);
      }
    } catch (err) {
      console.warn('[ServerPeer] signal error:', err);
    }
  }

  public close() {
    try { this.ctrl?.close(); } catch {}
    try { this.fast?.close(); } catch {}
    try { this.pc?.close(); } catch {}
    this.ctrl = null;
    this.fast = null;
    this.pc = null;
  }
}

/** Sends a game message over the best available transport for a session. */
function sendGame(c: ClientSession, payload: Record<string, unknown>) {
  const fast = payload.type === 'sync_state' || payload.type === 'game_event';
  if (c.peer && c.peer.send(fast ? 'fast' : 'ctrl', payload)) return;
  safeSend(c.ws, payload);
}

// Stop and clean up any running game engine for a room
function stopRoomGame(room: Room) {
  if (room.startTimeout) {
    clearTimeout(room.startTimeout);
    room.startTimeout = undefined;
  }
  if (room.tickInterval) {
    clearInterval(room.tickInterval);
    room.tickInterval = undefined;
  }
  if (room.gameEngine) {
    try {
      room.gameEngine.stopLoop();
    } catch {}
    room.gameEngine = undefined;
  }
}

// Start authoritative headless GameEngine for the room
function startRoomGame(room: Room) {
  stopRoomGame(room);

  let stageMap: StageMap;
  if (room.customMapGrid) {
    stageMap = {
      name: 'Custom Map',
      grid: room.customMapGrid,
    };
  } else {
    stageMap = getStageMapForPresetAndStage(room.stage, room.mapSize, room.mode);
  }

  const engine = new GameEngine(null, stageMap, (gameState, scoreData) => {
    // Notify clients of round / stage transitions (reliable ctrl channel)
    room.clients.forEach((c) => {
      sendGame(c, {
        type: 'game_state_change',
        gameState,
        scoreData,
      });
    });
  });

  engine.setMultiplayerMode(room.mode, 'host');
  engine.localPlayerSlot = 0; // Dedicated Server host umpire (not a player)
  engine.totalFfaPlayers = room.clients.length;

  // Broadcast world snapshots to all connected clients
  engine.onNetworkSync = (snapshot) => {
    const syncMsg = { type: 'sync_state', snapshot };
    room.clients.forEach((c) => sendGame(c, syncMsg));
  };

  // Broadcast discrete game events (explosions, gunfire, powerups) for audio/FX
  engine.onGameEventBroadcast = (event) => {
    const eventMsg = { type: 'game_event', ...event };
    room.clients.forEach((c) => sendGame(c, eventMsg));
  };

  engine.startStage(room.stage, stageMap);
  room.gameEngine = engine;
  room.status = 'playing';

  // 60Hz Fixed-Tick loop (16.66ms per tick)
  room.tickInterval = setInterval(() => {
    try {
      engine.tick();
    } catch (err) {
      console.error(`[Room ${room.code}] Simulation tick error:`, err);
    }
  }, 1000 / 60);
}

// Clean up dead/abandoned rooms every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    const anyAlive = room.clients.some((c) => c.ws.readyState === WebSocket.OPEN);
    if (!anyAlive || now - room.lastActivity > 600000) {
      stopRoomGame(room);
      rooms.delete(code);
    }
  }
}, 30000);

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  const session: ClientSession = {
    id: 'client_' + Math.random().toString(36).substring(2, 9),
    ws,
    roomCode: null,
    role: null,
    slot: 1,
    team: 'A',
    lastPing: Date.now(),
  };
  clientSessions.set(ws, session);

  ws.on('message', (rawData: string | Buffer) => {
    try {
      const msg = JSON.parse(rawData.toString());
      session.lastPing = Date.now();

      // Ping-pong for latency calculation & keeping connection alive
      if (msg.type === 'ping') {
        safeSend(ws, { type: 'pong', timestamp: msg.timestamp, serverTime: Date.now() });
        return;
      }

      // Create Room (Session becomes Slot 1 / party leader)
      if (msg.type === 'create_room') {
        const code = generateRoomCode();
        const mode = msg.mode === 'versus' ? 'versus' : msg.mode === '2v2' ? '2v2' : msg.mode === 'ffa' ? 'ffa' : 'coop';
        const rawMapSize = msg.mapSize || (mode === 'ffa' ? 'large' : mode === '2v2' ? 'large' : 'classic');
        const mapSize = mode === 'ffa' && rawMapSize === 'classic' ? 'large' : rawMapSize;
        const stage = typeof msg.stage === 'number' ? msg.stage : 1;
        const maxPlayers = mode === 'ffa' ? 8 : mode === '2v2' ? 4 : 2;

        session.slot = 1;
        session.team = mode === '2v2' ? 'A' : 'FFA';
        session.role = 'host';
        session.roomCode = code;

        const newRoom: Room = {
          code,
          mode,
          mapSize,
          stage,
          customMapGrid: msg.customMapGrid,
          host: session,
          clients: [session],
          maxPlayers,
          status: 'waiting',
          createdAt: Date.now(),
          lastActivity: Date.now(),
        };

        rooms.set(code, newRoom);

        safeSend(ws, {
          type: 'room_created',
          code,
          role: 'host',
          slot: 1,
          team: session.team,
          mode,
          mapSize,
          stage,
          maxPlayers,
          players: [{ slot: 1, role: 'host', team: session.team, id: session.id }],
        });
        return;
      }

      // Join Room
      if (msg.type === 'join_room') {
        const rawCode = String(msg.code || '').trim().toUpperCase();
        const room = rooms.get(rawCode);

        if (!room) {
          safeSend(ws, { type: 'error', message: 'ROOM NOT FOUND: CHECK CODE' });
          return;
        }

        if (room.clients.length >= room.maxPlayers) {
          safeSend(ws, { type: 'error', message: `ROOM IS ALREADY FULL (${room.clients.length}/${room.maxPlayers})` });
          return;
        }

        // Determine next available slot (1..maxPlayers)
        const occupiedSlots = new Set(room.clients.map((c) => c.slot));
        let assignedSlot = 2;
        for (let s = 1; s <= room.maxPlayers; s++) {
          if (!occupiedSlots.has(s)) {
            assignedSlot = s;
            break;
          }
        }

        let assignedTeam: 'A' | 'B' | 'FFA' = 'FFA';
        if (room.mode === '2v2') {
          assignedTeam = assignedSlot % 2 === 1 ? 'A' : 'B';
        }

        session.roomCode = room.code;
        session.role = 'guest';
        session.slot = assignedSlot;
        session.team = assignedTeam;

        room.clients.push(session);
        room.lastActivity = Date.now();

        const playerList = room.clients.map((c) => ({
          slot: c.slot,
          role: c.role,
          team: c.team,
          id: c.id,
        }));

        // Notify Guest
        safeSend(ws, {
          type: 'room_joined',
          code: room.code,
          role: 'guest',
          slot: session.slot,
          team: session.team,
          mode: room.mode,
          mapSize: room.mapSize,
          stage: room.stage,
          customMapGrid: room.customMapGrid,
          maxPlayers: room.maxPlayers,
          players: playerList,
        });

        // Notify all other clients in the room
        room.clients.forEach((c) => {
          if (c !== session) {
            safeSend(c.ws, {
              type: 'player_joined',
              role: 'guest',
              slot: session.slot,
              team: session.team,
              totalPlayers: room.clients.length,
              maxPlayers: room.maxPlayers,
              players: playerList,
            });
          }
        });
        return;
      }

      // Get Room
      const room = session.roomCode ? rooms.get(session.roomCode) : null;
      if (!room) return;
      room.lastActivity = Date.now();

      // Start Game Countdown & Launch Authoritative Server Simulation
      if (msg.type === 'request_start' && session.slot === 1) {
        room.status = 'starting';
        const startPayload = {
          type: 'game_countdown',
          count: 3,
          code: room.code,
          mode: room.mode,
          mapSize: room.mapSize,
          stage: room.stage,
          customMapGrid: room.customMapGrid,
          randomSeed: Math.floor(Math.random() * 100000),
          totalPlayers: room.clients.length,
          players: room.clients.map((c) => ({ slot: c.slot, role: c.role, team: c.team })),
        };
        room.clients.forEach((c) => sendGame(c, startPayload));

        // Delay starting authoritative server simulation to perfectly align with 3-second lobby countdown
        if (room.startTimeout) {
          clearTimeout(room.startTimeout);
        }
        room.startTimeout = setTimeout(() => {
          room.startTimeout = undefined;
          if (room.status === 'starting' && room.clients.length > 0) {
            startRoomGame(room);
          }
        }, 3000);
        return;
      }

      // Dedicated Server Authoritative Input Channel:
      // Client sends inputs stamped with sequence number -> Server enqueues to room engine
      if (msg.type === 'player_input') {
        const targetSlot = typeof msg.slot === 'number' ? msg.slot : session.slot;
        if (room.gameEngine && msg.input) {
          room.gameEngine.enqueuePlayerInput(targetSlot, msg.input, msg.seq);
        }
        return;
      }

      // Relay WebRTC P2P signaling (SDP offers/answers + ICE candidates)
      // between room members. Addressed by targetSlot, stamped with fromSlot.
      if (msg.type === 'webrtc_signal') {
        // Slot 0 = the server umpire itself: the offering player gets a
        // server-side peer with direct UDP DataChannels.
        if (msg.targetSlot === 0) {
          if (wrtc) {
            try {
              if (!session.peer) session.peer = new ServerPeer(session, (raw) => {
                session.lastPing = Date.now();
                try {
                  const m = JSON.parse(raw);
                  const room = session.roomCode ? rooms.get(session.roomCode) : null;
                  if (m.type === 'player_input' && room?.gameEngine && m.input) {
                    const slot = typeof m.slot === 'number' ? m.slot : session.slot;
                    room.gameEngine.enqueuePlayerInput(slot, m.input, m.seq);
                  }
                } catch {
                  // Ignore malformed payloads
                }
              });
              session.peer.handleSignal(msg).catch((err: unknown) => {
                console.warn('[ServerPeer] offer handling failed:', err);
              });
            } catch (err) {
              console.warn('[ServerPeer] creation failed:', err);
            }
          }
          return;
        }
        const targetSlot = typeof msg.targetSlot === 'number' ? msg.targetSlot : null;
        const target =
          targetSlot !== null
            ? room.clients.find((c) => c.slot === targetSlot)
            : session.role === 'host'
            ? room.clients.find((c) => c !== session) ?? null
            : room.clients.find((c) => c.slot === 1) ?? null;
        if (target && target !== session && target.ws.readyState === WebSocket.OPEN) {
          safeSend(target.ws, { ...msg, fromSlot: session.slot });
        }
        return;
      }

      // Taunt message (Retro chat popup: "ATTACK!", "DEFEND!", "GG!")
      if (msg.type === 'taunt') {
        const senderLabel = `P${session.slot}`;
        room.clients.forEach((c) => {
          if (c !== session && c.ws.readyState === WebSocket.OPEN) {
            safeSend(c.ws, {
              type: 'taunt',
              from: session.role,
              slot: session.slot,
              sender: senderLabel,
              text: String(msg.text || '').slice(0, 16),
            });
          }
        });
        return;
      }
    } catch {
      // Ignore malformed payloads
    }
  });

  ws.on('close', () => {
    const currentSession = clientSessions.get(ws);
    if (currentSession && currentSession.roomCode) {
      const room = rooms.get(currentSession.roomCode);
      if (room) {
        // Remove from room clients list
        room.clients = room.clients.filter((c) => c !== currentSession);

        if (room.clients.length === 0) {
          // Room completely empty -> terminate game engine and delete room
          stopRoomGame(room);
          rooms.delete(room.code);
        } else if (currentSession.slot === 1 && room.status !== 'playing') {
          // Party leader left during waiting phase
          stopRoomGame(room);
          room.clients.forEach((c) => {
            safeSend(c.ws, {
              type: 'peer_disconnected',
              role: 'host',
              message: 'HOST HAS DISCONNECTED',
            });
          });
          rooms.delete(room.code);
        } else {
          // A player left the match
          room.clients.forEach((c) => {
            safeSend(c.ws, {
              type: 'player_left',
              slot: currentSession.slot,
              remaining: room.clients.length,
              message: `PLAYER ${currentSession.slot} HAS DISCONNECTED`,
            });
          });
        }
      }
    }
    if (currentSession.peer) {
      currentSession.peer.close();
      currentSession.peer = null;
    }
    clientSessions.delete(ws);
  });
});

// Vite Middleware & Static Serving setup
async function startServer() {
  await ensureWrtc();
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (typeof __filename !== 'undefined' && __filename.includes('dist'));

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Battle City 1990] Dedicated Server running on http://0.0.0.0:${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
  });
}

// Graceful shutdown handling for Docker, PM2, and systemd
const gracefulShutdown = (signal: string) => {
  console.log(`[Battle City 1990] Received ${signal}. Closing server gracefully...`);
  for (const room of rooms.values()) {
    stopRoomGame(room);
  }
  rooms.clear();
  server.close(() => {
    console.log('[Battle City 1990] HTTP/WS server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[Battle City 1990] Forcing server exit after timeout.');
    process.exit(1);
  }, 5000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
