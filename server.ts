/**
 * Battle City 1990 - High Performance Real-Time Server
 * Express + WebSocket (ws) on Port 3000
 * Low-latency room orchestration, 1v1 PvP & 2P Co-Op state relay
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';

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
}

interface Room {
  code: string;
  mode: 'coop' | 'versus' | '2v2' | 'ffa';
  mapSize: 'classic' | 'large' | 'giant';
  stage: number;
  customMapGrid?: number[][];
  host: ClientSession | null;
  guest: ClientSession | null; // Kept for backward compatibility
  clients: ClientSession[];
  maxPlayers: number;
  status: 'waiting' | 'starting' | 'playing' | 'ended';
  createdAt: number;
  lastActivity: number;
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

// Clean up dead/abandoned rooms every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    const anyAlive = room.clients.some((c) => c.ws.readyState === WebSocket.OPEN);
    // Expire if no players connected or inactive for > 10 minutes
    if (!anyAlive || now - room.lastActivity > 600000) {
      rooms.delete(code);
    }
  }
}, 30000);

const wss = new WebSocketServer({ server, path: '/ws' });

function safeSend(ws: WebSocket, message: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Ignored
    }
  }
}

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

      // Create Room
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
          guest: null,
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
          // Team assignment: slots 1 & 3 are Team A, slots 2 & 4 are Team B
          assignedTeam = assignedSlot % 2 === 1 ? 'A' : 'B';
        }

        session.roomCode = room.code;
        session.role = 'guest';
        session.slot = assignedSlot;
        session.team = assignedTeam;

        room.clients.push(session);
        if (!room.guest) room.guest = session;
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

      // Start Game Countdown
      if (msg.type === 'request_start' && session.role === 'host') {
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
        room.clients.forEach((c) => safeSend(c.ws, startPayload));
        return;
      }

      // Relay State from Host to all Guests
      if (msg.type === 'sync_state' && session.role === 'host') {
        room.clients.forEach((c) => {
          if (c !== session && c.ws.readyState === WebSocket.OPEN) {
            safeSend(c.ws, msg);
          }
        });
        return;
      }

      // Relay Input from any Guest to Host (Tagged with the guest's slot or relayed slot)
      if (msg.type === 'player_input' && session.role === 'guest') {
        if (room.host && room.host.ws.readyState === WebSocket.OPEN) {
          const targetSlot = typeof msg.slot === 'number' ? msg.slot : (session.slot || 2);
          safeSend(room.host.ws, {
            ...msg,
            slot: targetSlot,
          });
        }
        return;
      }

      // Relay Discrete Game Events (Broadcast to other room members)
      if (msg.type === 'game_event') {
        room.clients.forEach((c) => {
          if (c !== session && c.ws.readyState === WebSocket.OPEN) {
            safeSend(c.ws, msg);
          }
        });
        return;
      }

      // WebRTC P2P Signaling Relay (Exchanges SDP offers, answers, and ICE candidates)
      if (msg.type === 'webrtc_signal') {
        const targetSlot = msg.targetSlot;
        room.clients.forEach((c) => {
          if (c !== session && c.ws.readyState === WebSocket.OPEN) {
            if (typeof targetSlot !== 'number' || c.slot === targetSlot) {
              safeSend(c.ws, {
                ...msg,
                fromSlot: session.slot,
                fromRole: session.role,
              });
            }
          }
        });
        return;
      }

      // Taunt message (Retro chat popup like "ATTACK!", "DEFEND!", "GG!")
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

        if (currentSession.role === 'host') {
          room.host = null;
          room.clients.forEach((c) => {
            safeSend(c.ws, {
              type: 'peer_disconnected',
              role: 'host',
              message: 'HOST HAS DISCONNECTED',
            });
          });
        } else {
          // Guest disconnected
          if (room.guest === currentSession) {
            room.guest = room.clients.find((c) => c.role === 'guest') || null;
          }
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
    clientSessions.delete(ws);
  });
});

// Vite Middleware & Static Serving setup
async function startServer() {
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
    console.log(`[Battle City 1990] Server running on http://0.0.0.0:${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
  });
}

// Graceful shutdown handling for Docker, PM2, and systemd
const gracefulShutdown = (signal: string) => {
  console.log(`[Battle City 1990] Received ${signal}. Closing server gracefully...`);
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
