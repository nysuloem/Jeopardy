const test=require('node:test');
const assert=require('node:assert/strict');
const {FALLBACK_GAME,validateGame,locallyCorrect,normalize}=require('../src/game');

test('fallback game is a complete two-round Jeopardy game',()=>{
  assert.equal(validateGame(FALLBACK_GAME),true);
  assert.deepEqual(FALLBACK_GAME.rounds.map(r=>r.categories.length),[6,6]);
  assert.deepEqual(FALLBACK_GAME.rounds.map(r=>r.categories.flatMap(c=>c.clues).length),[30,30]);
  assert.deepEqual(FALLBACK_GAME.rounds.map(r=>r.dailyDoubles.length),[1,2]);
});

test('response matching accepts Jeopardy phrasing and rejects unrelated responses',()=>{
  const item={response:'Frederick Banting',aliases:['Banting']};
  assert.equal(locallyCorrect('Who is Banting?',item),true);
  assert.equal(locallyCorrect('What is insulin?',item),false);
  assert.equal(normalize('Who is The Banting?'),'banting');
});
