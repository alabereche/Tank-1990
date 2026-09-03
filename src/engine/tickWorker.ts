/**
 * Battle City 1990 - Simulation Ticker (Host)
 * A tiny dedicated Worker that pulses ~60 times per second. Browsers stop
 * firing requestAnimationFrame in hidden tabs, which previously froze the
 * host simulation - and with it the whole online match. Worker timers keep
 * running in background tabs, so the host now simulates on this pulse and
 * only renders on rAF.
 */

const WORKER_SRC = `
let id = null;
onmessage = (e) => {
  if (e.data === 'start') {
    if (id) clearInterval(id);
    id = setInterval(() => postMessage(0), 16.67);
  } else {
    if (id) clearInterval(id);
    id = null;
  }
};`;

export function createTickWorker(): Worker | null {
  try {
    const blob = new Blob([WORKER_SRC], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
  } catch {
    return null; // Workers unavailable (very old browser) - rAF loop still works
  }
}
