'use strict';

// Harmless orthographic variants are accepted before normal answer judging.
// Board generation budgets and opt-in refill are enforced separately.
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

console.log('[runtime-fixes] orthographic judging enabled; generation budgets enforced in game.js');
