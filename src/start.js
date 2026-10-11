'use strict';

// Patch the deployed generator before anything requires src/game.js. The original
// duplicate ledger remains permanent: exact category names, clues and facts still
// cannot repeat. The change below only relaxes the much broader semantic category
// overlap test, which had become so restrictive after many boards that perfectly
// new categories were being rejected over and over.
const fs = require('node:fs');
const path = require('node:path');

const gamePath = path.join(__dirname, 'game.js');
let gameSource = fs.readFileSync(gamePath, 'utf8');

const oldCategoryValidation = `function categoryValidAgainst(category,priorRecords=[],priorCategories=[]){
  if(!category?.name||category.clues?.length!==5||gameHasCategoryRepeat({rounds:[{categories:[category]}]},priorCategories)||priorCategories.some(name=>categoriesOverlap(name,category.name)))return false;
  if(!category.clues.every(item=>clueLengthValid(item.clue)&&item.response&&clueDoesNotRevealResponse(item))||!categoryRuleValid(category))return false;
  return !gameHasDuplicate({rounds:[{categories:[category]}]},priorRecords);
}`;

const newCategoryValidation = `function categoryValidAgainst(category,priorRecords=[],priorCategories=[]){
  if(!category?.name||category.clues?.length!==5)return false;
  // Exact category names are permanently unique across the ledger and queued boards.
  if(gameHasCategoryRepeat({rounds:[{categories:[category]}]},priorCategories))return false;
  // Semantic/theme overlap is useful within a board and against very recent boards,
  // but applying it to the entire historical category ledger eventually makes new
  // boards mathematically hard to generate. Keep this guard to the recent window.
  const recentCategories=priorCategories.slice(-18);
  if(recentCategories.some(name=>categoriesOverlap(name,category.name)))return false;
  if(!category.clues.every(item=>clueLengthValid(item.clue)&&item.response&&clueDoesNotRevealResponse(item))||!categoryRuleValid(category))return false;
  // Clue text and category+response facts remain permanently unique.
  return !gameHasDuplicate({rounds:[{categories:[category]}]},priorRecords);
}`;

const oldAttemptLoop = 'for(let attempt=1;attempt<=8;attempt++)try{';
const newAttemptLoop = 'for(let attempt=1;attempt<=4;attempt++)try{';

if (!gameSource.includes(oldCategoryValidation)) {
  throw new Error('Jeopardy generation patch failed: category validation block changed.');
}
if (!gameSource.includes(oldAttemptLoop)) {
  throw new Error('Jeopardy generation patch failed: category retry loop changed.');
}

gameSource = gameSource
  .replace(oldCategoryValidation, newCategoryValidation)
  .replace(oldAttemptLoop, newAttemptLoop);
fs.writeFileSync(gamePath, gameSource, 'utf8');
console.log('[generation-fix] exact category/clue uniqueness preserved; semantic category overlap limited to recent history; category attempts capped at 4');

// Load judging + rolling generation-budget patches only after game.js is patched.
require('./runtime-fixes');

// Start the normal Jeopardy server, then periodically trigger the existing
// bank-refill path using a disposable test room. Test rooms use built-in clues,
// so they do not consume a prepared AI board.
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
