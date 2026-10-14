'use strict';

// This module is loaded by src/start.js after its generation-source patch has
// been applied. It keeps harmless orthographic answer variants fair. The
// game-bank generation/repair throttle is intentionally disabled for now so we
// can validate the protected repair mechanism and refill the bank to 20 games.
const game = require('./game');

function orthographicKey(value = '') {
  return game.normalize(value).replace(/\s+/g, '');
}

function isOrthographicEquivalent(given, item) {
  const answer = orthographicKey(given);
  if (!answer) return false;
  return [item?.response, ...(item?.aliases || [])]
    .filter(Boolean)
    .some(target => orthographicKey(target) === answer);
}

const originalJudgeResponse = game.judgeResponse;
const originalJudge = game.judge;

game.judgeResponse = async function patchedJudgeResponse(given, item, options = {}) {
  if (isOrthographicEquivalent(given, item)) {
    return { decision: 'correct', verdict: 'harmless_orthographic_variant' };
  }
  return originalJudgeResponse(given, item, options);
};

game.judge = async function patchedJudge(given, item) {
  if (isOrthographicEquivalent(given, item)) return true;
  return originalJudge(given, item);
};

console.log('[runtime-fixes] orthographic judging enabled; game-bank generation/repair cap disabled');
