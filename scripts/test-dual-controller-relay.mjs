import WebSocket from 'ws';

const URL = 'ws://localhost:3000/ws';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log('Testing Slot-1 Dual Pad Relay across server...');

  // Create host
  const host = new WebSocket(URL);
  await new Promise((r) => host.on('open', r));

  let code = '';
  host.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.type === 'room_created') code = m.code;
  });
  host.send(JSON.stringify({ type: 'create_room', mode: 'versus', mapSize: 'classic', stage: 1 }));

  while (!code) await wait(50);
  console.log('PASS Room created:', code);

  // Guest joins
  const guest = new WebSocket(URL);
  await new Promise((r) => guest.on('open', r));
  guest.send(JSON.stringify({ type: 'join_room', code }));
  await wait(200);

  // Host records incoming messages
  const hostReceived = [];
  host.on('message', (d) => {
    const m = JSON.parse(d.toString());
    hostReceived.push(m);
  });

  // Guest relays slot 1 via game_event (backward compatible with any running server)
  guest.send(JSON.stringify({ type: 'game_event', event: 'p1_relay_input', input: { up: true, fire: true } }));
  // Guest sends own slot 2 (Pad 1)
  guest.send(JSON.stringify({ type: 'player_input', input: { right: true }, slot: 2 }));
  await wait(300);

  const relayMsg = hostReceived.find((m) => m.type === 'game_event' && m.event === 'p1_relay_input' && m.input && m.input.up && m.input.fire);
  const slot2Msg = hostReceived.find((m) => m.type === 'player_input' && m.slot === 2 && m.input && m.input.right);

  if (!relayMsg) throw new Error('FAIL: Host did not receive p1_relay_input game_event!');
  if (!slot2Msg) throw new Error('FAIL: Host did not receive slot 2 guest input!');

  console.log('PASS Slot-1 relayed from guest received on host via p1_relay_input');
  console.log('PASS Slot-2 received on host with slot: 2');

  host.close();
  guest.close();
  console.log('ALL DUAL CONTROLLER RELAY TESTS PASSED!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
