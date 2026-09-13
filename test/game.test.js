const test=require('node:test');
const assert=require('node:assert/strict');
const {FALLBACK_GAME,EMERGENCY_GAME,MAX_CLUE_CHARS,validateGame,locallyCorrect,normalize,responseText,gameClueRecords,gameHasDuplicate,beforeAfterValid}=require('../src/game');

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

test('duplicate protection catches repeated clues and repeated facts',()=>{
  const records=gameClueRecords(FALLBACK_GAME);assert.equal(records.length,61);assert.equal(gameHasDuplicate(FALLBACK_GAME,[]),false);
  assert.equal(gameHasDuplicate(FALLBACK_GAME,[records[0]]),true);
  const changed=structuredClone(FALLBACK_GAME);changed.rounds[0].categories[0].clues[0].clue='Name the Canadian city containing the CN Tower.';
  assert.equal(gameHasDuplicate(changed,[records[0]]),true);
});

test('emergency game is complete and does not overlap the original board',()=>{
  assert.equal(validateGame(EMERGENCY_GAME),true);assert.equal(gameClueRecords(EMERGENCY_GAME).length,61);
  assert.equal(gameHasDuplicate(EMERGENCY_GAME,gameClueRecords(FALLBACK_GAME)),false);
});

test('letter-constrained categories reject responses that break the category rule',()=>{
  const invalid=structuredClone(FALLBACK_GAME);invalid.rounds[0].categories[0].name='STARTS WITH S';
  assert.equal(validateGame(invalid),false);
  invalid.rounds[0].categories[0].clues.forEach((item,index)=>{item.response=['Saturn','Spain','Shakespeare','Sodium','Sydney'][index];});
  assert.equal(validateGame(invalid),true);
});

test('Before & After requires two answers with one exact shared bridge',()=>{
  assert.equal(beforeAfterValid({response:'Jack and Jill Biden',mechanicProof:'Jack and Jill || Jill Biden || Jill'}),true);
  assert.equal(beforeAfterValid({response:'Goldilocks and the Three Bears',mechanicProof:'Goldilocks || Three Bears || and'}),false);
  const invalid=structuredClone(FALLBACK_GAME);delete invalid.rounds[0].categories[5].clues[0].mechanicProof;
  assert.equal(validateGame(invalid),false);
});

test('oversized clues are rejected instead of being squeezed onto the TV',()=>{
  const longRound=structuredClone(FALLBACK_GAME);longRound.rounds[0].categories[0].clues[0].clue='x'.repeat(MAX_CLUE_CHARS+1);assert.equal(validateGame(longRound),false);
  const longFinal=structuredClone(FALLBACK_GAME);longFinal.final.clue=Array.from({length:25},()=> 'short').join(' ');assert.equal(validateGame(longFinal),false);
});

test('Responses API text extraction never passes undefined to JSON parsing',()=>{
  assert.equal(responseText({output_text:'{"ok":true}'}),'{"ok":true}');
  assert.equal(responseText({output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:'{"ok":true}'}]}]}),'{"ok":true}');
  assert.equal(responseText({status:'incomplete',output:[{type:'reasoning'}]}),null);
});
