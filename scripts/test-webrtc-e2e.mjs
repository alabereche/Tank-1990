/**
 * E2E: real WebRTC handshake between a Node client (@roamhq/wrtc) and the
 * running game server acting as the P2P umpire peer (slot 0).
 * Verifies: WS signaling round-trip (offer->answer->ice), both DataChannels
 * open, ping/pong over the channel, and snapshot delivery prefers the
 * 'tank_fast' DataChannel over the WebSocket.
 * Run (server must be up): node scripts/test-webrtc-e2e.mjs
 */
import WebSocket from 'ws';
import wrtc from '@roamhq/wrtc';

const WS_URL = 'ws://localhost:3000/ws';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const assert = (name, cond) => {
    if (!cond) throw new Error('FAIL ' + name);
    console.log('PASS ' + name);
  };

  const ws = new WebSocket(WS_URL);
  await new Promise((r) => ws.on('open', r));

  const pc = new wrtc.RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const ctrl = pc.createDataChannel('tank_ctrl', { ordered: true });
  const fast = pc.createDataChannel('tank_fast', { ordered: false, maxRetransmits: 0 });

  const channels = { ctrl: false, fast: false };
  ctrl.onopen = () => (channels.ctrl = true);
  fast.onopen = () => (channels.fast = true);

  let dcPong = false;
  let fastSnapshot = false;
  ctrl.onmessage = (e) => {
    const m = JSON.parse(e.data.toString());
    if (m.__p2p_pong !== undefined) dcPong = true;
  };
  fast.onmessage = (e) => {
    const m = JSON.parse(e.data.toString());
    if (m.type === 'sync_state') fastSnapshot = true;
  };

  // Route server signals (fromSlot 0) into the peer connection
  ws.on('message', async (d) => {
    const m = JSON.parse(d.toString());
    if (m.type === 'webrtc_signal') {
      if (m.signalType === 'answer' && m.sdp) await pc.setRemoteDescription(m.sdp);
      else if (m.signalType === 'ice' && m.candidate) await pc.addIceCandidate(m.candidate).catch(() => {});
    }
  });

  // Create room so the server knows this session
  ws.send(JSON.stringify({ type: 'create_room', mode: 'coop' }));
  await wait(300);

  // Attach the ICE listener BEFORE creating the offer so no early
  // candidates are missed (they fire during setLocalDescription)
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      ws.send(
        JSON.stringify({
          type: 'webrtc_signal',
          signalType: 'ice',
          candidate: {
            candidate: e.candidate.candidate,
            sdpMid: e.candidate.sdpMid,
            sdpMLineIndex: e.candidate.sdpMLineIndex,
          },
          targetSlot: 0,
        })
      );
    }
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type: 'webrtc_signal', signalType: 'offer', sdp: offer, targetSlot: 0 }));

  // Handshake + ICE settle
  for (let i = 0; i < 40 && !(channels.ctrl && channels.fast); i++) await wait(100);
  assert('ctrl DataChannel open', channels.ctrl);
  assert('fast DataChannel open', channels.fast);

  // Direct ping/pong over the channel (server peer replies on ctrl)
  ctrl.send(JSON.stringify({ __p2p_ping: performance.now() }));
  for (let i = 0; i < 20 && !dcPong; i++) await wait(100);
  assert('ping/pong answered over DataChannel', dcPong);

  // Start the authoritative engine -> snapshots must arrive on 'fast'
  ws.send(JSON.stringify({ type: 'request_start' }));
  for (let i = 0; i < 60 && !fastSnapshot; i++) await wait(100);
  assert('authoritative snapshot delivered over tank_fast', fastSnapshot);

  // Inputs travel the ctrl channel without erroring the server
  ctrl.send(JSON.stringify({ type: 'player_input', slot: 1, seq: 1, input: { up: true, fire: false } }));
  await wait(300);
  const health = await fetch('http://localhost:3000/api/health').then((r) => r.json());
  assert('server healthy after DC traffic', health.status === 'ok');

  console.log('ALL WEBRTC E2E TESTS PASSED');
  pc.close();
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
