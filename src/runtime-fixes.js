'use strict';

// This module is preloaded before server.js. It patches the exported game helpers
// without changing the core game engine, so harmless orthographic variants are
// accepted before AI judging and unattended board-generation work has a hard cap.
const game = require('./game');

function orthographicKey(value = '') {
  // game.normalize already removes Jeopardy phrasing, articles, punctuation,
  // accents and case. Removing the remaining spaces makes harmless word-break
  // and hyphenation differences equivalent: "yardwork" == "yard work",
  // "ice-cream" == "ice cream", "e mail" == "email".
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

// Cost guard for the background game bank. The server itself already creates at
// most one brand-new board per ensureGameBank() call and pauses after an error.
// This adds a process-wide ceiling across BOTH new-board jobs and saved-board
// repair jobs, preventing repeated room creation from starting an open-ended run.
const configuredLimit = Number.parseInt(process.env.GAME_BANK_MAX_JOBS_PER_PROCESS || '2', 10);
const maxJobs = Number.isFinite(configuredLimit) ? Math.max(1, Math.min(configuredLimit, 5)) : 2;
let generationJobs = 0;

function reserveGenerationJob(kind) {
  if (process.env.GAME_BANK_AUTO_FILL !== 'true') return;
  if (generationJobs >= maxJobs) {
    const error = new Error(`Game-bank ${kind} paused: process safety cap of ${maxJobs} generation job${maxJobs === 1 ? '' : 's'} reached.`);
    error.code = 'GAME_BANK_PROCESS_CAP';
    throw error;
  }
  generationJobs += 1;
  console.log(`[game-bank] starting ${kind} job ${generationJobs}/${maxJobs}`);
}

const originalGenerateGame = game.generateGame;
const originalRepairGeneratedGame = game.repairGeneratedGame;

game.generateGame = async function cappedGenerateGame(...args) {
  reserveGenerationJob('generation');
  return originalGenerateGame(...args);
};

game.repairGeneratedGame = async function cappedRepairGeneratedGame(...args) {
  reserveGenerationJob('repair');
  return originalRepairGeneratedGame(...args);
};

console.log(`[runtime-fixes] orthographic judging enabled; game-bank process cap=${maxJobs}`);
