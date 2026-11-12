'use strict';

// Generation and champion fixes now live in source, rather than rewriting files at startup.
require('./runtime-fixes');
const gameServer = require('../server');
const portFlag = process.argv.indexOf('--port');
const port = process.env.PORT || (portFlag >= 0 ? process.argv[portFlag + 1] : null) || 3000;
const intervalMs = Math.max(60_000, Number.parseInt(process.env.GAME_BANK_REFILL_INTERVAL_MS || String(5 * 60 * 1000), 10) || 5 * 60 * 1000);
function triggerBankRefill() {
  if (process.env.GAME_BANK_AUTO_FILL !== 'true' || !process.env.OPENAI_API_KEY) return;
  try { const room = gameServer.makeRoom({ testMode: true }); gameServer.dispose(room); }
  catch (error) { console.warn('[game-bank] refill trigger skipped:', error.message || error); }
}
gameServer.server.listen(port, async () => {
  console.log(`Jeopardy listening on ${port}`);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/game-bank`);
    const bank = await response.json();
    console.log('[game-bank-status]', JSON.stringify(bank));
  } catch (error) { console.warn('[game-bank-status] unavailable:', error.message || error); }
  triggerBankRefill();
});
setInterval(triggerBankRefill, intervalMs).unref();
