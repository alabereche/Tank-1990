/**
 * Battle City 1990 - High Performance Real-Time Server
 * Express + WebSocket (ws) on Port 3000
 * Low-latency room orchestration, 1v1 PvP & 2P Co-Op state relay
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
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
  lastPing: number;
}

interface Room {
  code: string;
  mode: 'coop' | 'versus';
  mapSize: 'classic' | 'large' | 'giant';
  stage: number;
  customMapGrid?: number[][];
  host: ClientSession | null;
  guest: ClientSession | null;
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
    const isHostAlive = room.host && room.host.ws.readyState === WebSocket.OPEN;
    const isGuestAlive = room.guest && room.guest.ws.readyState === WebSocket.OPEN;
    // Expire if both players disconnected or inactive for > 10 minutes
    if ((!isHostAlive && !isGuestAlive) || now - room.lastActivity > 600000) {
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
        const mode = msg.mode === 'versus' ? 'versus' : 'coop';
        const mapSize = msg.mapSize || 'classic';
        const stage = typeof msg.stage === 'number' ? msg.stage : 1;

        const newRoom: Room = {
          code,
          mode,
          mapSize,
          stage,
          customMapGrid: msg.customMapGrid,
          host: session,
          guest: null,
          status: 'waiting',
          createdAt: Date.now(),
          lastActivity: Date.now(),
        };

        rooms.set(code, newRoom);
        session.roomCode = code;
        session.role = 'host';

        safeSend(ws, {
          type: 'room_created',
          code,
          role: 'host',
          mode,
          mapSize,
          stage,
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

        if (room.guest && room.guest.ws.readyState === WebSocket.OPEN) {
          safeSend(ws, { type: 'error', message: 'ROOM IS ALREADY FULL (2/2)' });
          return;
        }

        room.guest = session;
        room.lastActivity = Date.now();
        session.roomCode = room.code;
        session.role = 'guest';

        // Notify Guest
        safeSend(ws, {
          type: 'room_joined',
          code: room.code,
          role: 'guest',
          mode: room.mode,
          mapSize: room.mapSize,
          stage: room.stage,
          customMapGrid: room.customMapGrid,
        });

        // Notify Host
        if (room.host) {
          safeSend(room.host.ws, {
            type: 'player_joined',
            role: 'guest',
          });
        }
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
          mode: room.mode,
          mapSize: room.mapSize,
          stage: room.stage,
          randomSeed: Math.floor(Math.random() * 100000),
        };
        if (room.host) safeSend(room.host.ws, startPayload);
        if (room.guest) safeSend(room.guest.ws, startPayload);
        return;
      }

      // Relay State from Host to Guest (High frequency broadcast)
      if (msg.type === 'sync_state' && session.role === 'host') {
        if (room.guest && room.guest.ws.readyState === WebSocket.OPEN) {
          // Direct relay for minimum latency
          safeSend(room.guest.ws, msg);
        }
        return;
      }

      // Relay Input from Guest to Host (Real-time tank controls)
      if (msg.type === 'player_input' && session.role === 'guest') {
        if (room.host && room.host.ws.readyState === WebSocket.OPEN) {
          safeSend(room.host.ws, msg);
        }
        return;
      }

      // Relay Discrete Game Events (Bullet fired, Explosion, Brick destruction, Base hit, Taunt)
      if (msg.type === 'game_event') {
        const recipient = session.role === 'host' ? room.guest : room.host;
        if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
          safeSend(recipient.ws, msg);
        }
        return;
      }

      // Taunt message (Retro chat popup like "ATTACK!", "DEFEND!", "GG!")
      if (msg.type === 'taunt') {
        const recipient = session.role === 'host' ? room.guest : room.host;
        if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
          safeSend(recipient.ws, {
            type: 'taunt',
            from: session.role,
            text: String(msg.text || '').slice(0, 16),
          });
        }
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
        if (currentSession.role === 'host') {
          room.host = null;
          if (room.guest) {
            safeSend(room.guest.ws, {
              type: 'peer_disconnected',
              role: 'host',
              message: 'HOST HAS DISCONNECTED',
            });
          }
        } else if (currentSession.role === 'guest') {
          room.guest = null;
          if (room.host) {
            safeSend(room.host.ws, {
              type: 'peer_disconnected',
              role: 'guest',
              message: 'GUEST HAS DISCONNECTED',
            });
          }
        }
      }
    }
    clientSessions.delete(ws);
  });
});

// Vite Middleware & Static Serving setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
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
    console.log(`[Battle City 1990] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
