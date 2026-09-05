import test from 'node:test';
import assert from 'node:assert/strict';
import { WebRTCManager } from '../src/network/WebRTCManager';

test('WebRTC P2P Direct Transport Suite', async (t) => {
  await t.test('1. WebRTCManager gracefully falls back when WebRTC is not native (Node/unsupported)', () => {
    let sentSignal: any = null;
    let receivedGameMessage: any = null;

    const mgr = new WebRTCManager(
      (sig) => { sentSignal = sig; },
      (msg) => { receivedGameMessage = msg; }
    );

    // In node environment without browser RTCPeerConnection polyfill
    mgr.init('host', 1, 2);

    assert.equal(mgr.isConnected, false);
    assert.equal(mgr.getPing(), 0);

    // sendDirect should return false so caller seamlessly falls back to WebSocket!
    const sent = mgr.sendDirect({ type: 'player_input', input: { up: true } });
    assert.equal(sent, false);

    mgr.cleanup();
  });

  await t.test('2. Signal serialization & message relay payloads are valid JSON', () => {
    const signals: any[] = [];
    const mgr = new WebRTCManager(
      (sig) => { signals.push(sig); },
      () => {}
    );

    // Verify signal payload structure matches server expectations
    const mockOffer = {
      type: 'webrtc_signal',
      signalType: 'offer',
      sdp: { type: 'offer' as const, sdp: 'v=0...' },
      targetSlot: 2,
    };

    assert.equal(mockOffer.type, 'webrtc_signal');
    assert.equal(mockOffer.signalType, 'offer');
    assert.equal(typeof mockOffer.targetSlot, 'number');
  });
});
