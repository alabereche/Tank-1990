/**
 * Real-server integration test: a 2v2 room with 4 WebSocket clients.
 * Verifies slot/team allocation, per-slot input relay, snapshot fan-out to
 * every guest, and the room-full guard.
 * Run (server must be up): node scripts/test-server-multiplayer.mjs
 */
import WebSocket from 'ws';

const URL = 'ws://localhost:3000/ws';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const raw = [];
async function run() {
  const host = new WebSocket(URL);
  await new Promise((r) => host.on('open', r));
  host.on('message', (d) => raw.push(JSON.parse(d.toString())));
  host.send(JSON.stringify({ type: 'create_room', mode: '2v2', mapSize: 'large' }));
  await wait(300);
  const created = raw.find((m) => m.type === 'room_created');
  if (!created) throw new Error('FAIL room_created missing');
  const code = created.code;
  console.log('PASS room created (2v2, max ' + created.maxPlayers + ')');

  const guests = [];
  const gboxes = [];
  for (let i = 0; i < 3; i++) {
    const g = new WebSocket(URL);
    await new Promise((r) => g.on('open', r));
    const box = { slot: null, team: null, snaps: 0, slotInputs: [] };
    g.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.type === 'room_joined') { box.slot = m.slot; box.team = m.team; }
      if (m.type === 'sync_state') box.snaps++;
      if (m.type === 'player_input') box.slotInputs.push(m.slot);
    });
    g.send(JSON.stringify({ type: 'join_room', code }));
    guests.push(g);
    gboxes.push(box);
  }
  await wait(400);

  const slots = [created.slot, ...gboxes.map((b) => b.slot)];
  const teams = [created.team, ...gboxes.map((b) => b.team)];
  console.log('PASS 4 unique slots assigned: ' + slots.join(','));
  if (new Set(slots).size !== 4) throw new Error('FAIL slots not unique');
  const teamA = teams.filter((t) => t === 'A').length;
  const teamB = teams.filter((t) => t === 'B').length;
  if (!(teamA === 2 && teamB === 2)) throw new Error('FAIL teams not 2v2: ' + teams.join(','));
  console.log('PASS teams balanced 2A/2B');

  // Countdown reaches everyone
  const countdowns = [];
  const cdHandler = (d) => { const m = JSON.parse(d.toString()); if (m.type === 'game_countdown') countdowns.push(m); };
  host.on('message', cdHandler);
  guests.forEach((g) => g.on('message', cdHandler));
  host.send(JSON.stringify({ type: 'request_start' }));
  await wait(300);
  if (countdowns.length !== 4) throw new Error('FAIL countdown reached ' + countdowns.length + '/4');
  console.log('PASS countdown fanned out to all 4 clients');

  // Host broadcasts snapshots -> ALL guests receive
  host.send(JSON.stringify({ type: 'sync_state', snapshot: { tick: 1, players: [{ slot: 1 }, { slot: 2 }, { slot: 3 }, { slot: 4 }] } }));
  await wait(300);
  if (!gboxes.every((b) => b.snaps >= 1)) throw new Error('FAIL snapshot fan-out missed a guest');
  console.log('PASS host snapshot broadcast to all 3 guests');

  // Per-slot input relay: guest on slot 3 sends input -> host receives it tagged slot 3
  const hostInputs = [];
  host.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.type === 'player_input') hostInputs.push(m); });
  const slot3Guest = guests[gboxes.findIndex((b) => b.slot === 3)];
  slot3Guest.send(JSON.stringify({ type: 'player_input', input: { up: true }, slot: 3 }));
  await wait(300);
  const got = hostInputs.find((m) => m.slot === 3 && m.input && m.input.up === true);
  if (!got) throw new Error('FAIL slot-tagged input not relayed to host');
  console.log('PASS slot-3 input relayed to host with slot tag');

  // Room full guard
  const g5 = new WebSocket(URL);
  await new Promise((r) => g5.on('open', r));
  let fullError = null;
  g5.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.type === 'error') fullError = m.message; });
  g5.send(JSON.stringify({ type: 'join_room', code }));
  await wait(300);
  if (!fullError || !/FULL/i.test(fullError)) throw new Error('FAIL room-full guard: ' + fullError);
  console.log('PASS 5th joiner rejected (room full)');

  console.log('ALL SERVER MULTIPLAYER TESTS PASSED');
  process.exit(0);
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
