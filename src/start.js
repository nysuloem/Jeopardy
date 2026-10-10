'use strict';

// Start the normal Jeopardy server, then periodically trigger the existing
// bank-refill path using a disposable test room. Test rooms use built-in clues,
// so they do not consume a prepared AI board. The runtime-fixes preload applies
// a hard process-wide cap to AI generation/repair jobs, preventing runaway cost.
const gameServer = require('../server');

const port = process.env.PORT || 3000;
const intervalMs = Math.max(60_000, Number.parseInt(process.env.GAME_BANK_REFILL_INTERVAL_MS || String(5 * 60 * 1000), 10) || 5 * 60 * 1000);

function triggerBankRefill() {
  if (process.env.GAME_BANK_AUTO_FILL !== 'true' || !process.env.OPENAI_API_KEY) return;
  try {
    const room = gameServer.makeRoom({ testMode: true });
    gameServer.dispose(room);
  } catch (error) {
    console.warn('[game-bank] refill trigger skipped:', error.message || error);
  }
}

gameServer.server.listen(port, () => {
  console.log(`Jeopardy listening on ${port}`);
  triggerBankRefill();
});

setInterval(triggerBankRefill, intervalMs).unref();
