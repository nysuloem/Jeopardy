'use strict';

// This module is loaded by src/start.js after its generation-source patch has
// been applied. It keeps harmless orthographic answer variants fair and puts a
// rolling cost ceiling on unattended game-bank work.
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

// Rolling budget instead of a lifetime-per-process cap. A lifetime cap made the
// bank stop forever after a handful of failed boards. This still bounds spend,
// but allows the refill worker to make measured progress without a redeploy.
const configuredLimit = Number.parseInt(
  process.env.GAME_BANK_MAX_JOBS_PER_HOUR || process.env.GAME_BANK_MAX_JOBS_PER_PROCESS || '3',
  10
);
const maxJobsPerHour = Number.isFinite(configuredLimit)
  ? Math.max(1, Math.min(configuredLimit, 5))
  : 3;
const JOB_WINDOW_MS = 60 * 60 * 1000;
const generationJobs = [];

function reserveGenerationJob(kind) {
  if (process.env.GAME_BANK_AUTO_FILL !== 'true') return;
  const now = Date.now();
  while (generationJobs.length && generationJobs[0] <= now - JOB_WINDOW_MS) generationJobs.shift();
  if (generationJobs.length >= maxJobsPerHour) {
    const retryInMs = Math.max(1_000, generationJobs[0] + JOB_WINDOW_MS - now);
    const error = new Error(`Game-bank ${kind} paused: hourly safety budget of ${maxJobsPerHour} generation job${maxJobsPerHour === 1 ? '' : 's'} reached; retry in about ${Math.ceil(retryInMs / 60000)} minute(s).`);
    error.code = 'GAME_BANK_HOURLY_CAP';
    throw error;
  }
  generationJobs.push(now);
  console.log(`[game-bank] starting ${kind} job ${generationJobs.length}/${maxJobsPerHour} in rolling hour`);
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

console.log(`[runtime-fixes] orthographic judging enabled; game-bank rolling hourly cap=${maxJobsPerHour}`);
