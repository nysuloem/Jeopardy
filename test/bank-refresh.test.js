const test = require('node:test');
const assert = require('node:assert/strict');
const {BANK_RELEASE,buildReplacement} = require('../src/bank-refresh');

test('a failed replacement resumes completed paid games and stops at three', async () => {
  let saved, calls = 0;
  const options = {
    load: () => saved,
    save: batch => {saved = structuredClone(batch);},
    records: games => games.map(game => game.id),
    categories: () => [],
    generate: async records => {
      calls++;
      if(calls === 2) throw new Error('temporary API failure');
      return {rounds: [], priorCount: records.length};
    }
  };
  await assert.rejects(buildReplacement(options), /temporary API failure/);
  assert.equal(saved.games.length, 1);
  const first = structuredClone(saved.games[0]);
  const games = await buildReplacement(options);
  assert.equal(games.length, 3); assert.equal(calls, 4);
  assert.deepEqual(games[0], first);
  assert.equal(games[2].source, 'openai-api');
  assert.equal(games[2].id, `${BANK_RELEASE}-3`);
  assert.deepEqual(games.map(game => game.priorCount), [0,1,2]);
  await buildReplacement(options);
  assert.equal(calls, 4);
});
