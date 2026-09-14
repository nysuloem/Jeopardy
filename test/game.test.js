const test=require('node:test');
const assert=require('node:assert/strict');
const {FALLBACK_GAME,EMERGENCY_GAME,MAX_CLUE_CHARS,validateGame,locallyCorrect,plausibleVariant,normalize,responseText,gameClueRecords,gameCategories,gameHasCategoryRepeat,gameHasDuplicate,beforeAfterValid,clueDoesNotRevealResponse,generatedGameIssues,generateGame,judge}=require('../src/game');

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
  assert.equal(locallyCorrect('What are the Pyramids of Giza?',{response:'Great Pyramid of Giza',aliases:[]}),true);
  assert.equal(locallyCorrect('What is a rhinoceros?',{response:'narwhal',aliases:[]}),false);
  assert.equal(plausibleVariant('What is a rhinoceros?',{response:'narwhal',aliases:[]}),false);
  assert.equal(normalize('Who is The Banting?'),'banting');
});

test('duplicate protection catches repeated clues and repeated facts',()=>{
  const records=gameClueRecords(FALLBACK_GAME);assert.equal(records.length,61);assert.equal(gameHasDuplicate(FALLBACK_GAME,[]),false);
  assert.equal(gameHasDuplicate(FALLBACK_GAME,[records[0]]),true);
  const changed=structuredClone(FALLBACK_GAME);changed.rounds[0].categories[0].clues[0].clue='Name the Canadian city containing the CN Tower.';
  assert.equal(gameHasDuplicate(changed,[records[0]]),true);
});

test('category protection rejects repeated titles within and across generated games',()=>{
  assert.equal(gameCategories(FALLBACK_GAME).length,13);
  assert.equal(gameHasCategoryRepeat(FALLBACK_GAME,[]),false);
  assert.equal(gameHasCategoryRepeat(FALLBACK_GAME,['CANADIAN PLACES']),true);
  const repeated=structuredClone(FALLBACK_GAME);repeated.rounds[1].categories[0].name=repeated.rounds[0].categories[0].name;
  assert.equal(validateGame(repeated),false);
});

test('validation identifies individual bad clues without condemning valid board slots',()=>{
  const game=structuredClone(FALLBACK_GAME);game.rounds[0].categories[0].clues[0]={clue:'Toronto is the response to this clue.',response:'Toronto',aliases:['the city of Toronto'],mechanicProof:'standard'};
  const issues=generatedGameIssues(game,[],[]);
  assert.deepEqual(issues,[{kind:'clue',round:0,category:0,clue:0,reason:'clue reveals response'}]);
});

test('generation retries only a failed category and retains accepted categories',async t=>{
  const originalKey=process.env.OPENAI_API_KEY,originalFetch=global.fetch,categories=FALLBACK_GAME.rounds.flatMap(round=>round.categories).map(category=>structuredClone(category)),progress=[];process.env.OPENAI_API_KEY='test-key';let calls=0,categoryCalls=0;
  global.fetch=async(_url,options)=>{calls++;const request=JSON.parse(options.body),name=request.text.format.name;if(name==='final_jeopardy_clue')return {ok:true,json:async()=>({output_text:JSON.stringify(FALLBACK_GAME.final)})};assert.equal(name,'jeopardy_category');const index=Math.max(0,categoryCalls-1),category=structuredClone(categories[index]);if(categoryCalls++===0)category.clues[0]={clue:'Toronto is the response to this clue.',response:'Toronto',aliases:['Toronto'],mechanicProof:'standard'};return {ok:true,json:async()=>({output_text:JSON.stringify(category)})};};
  t.after(()=>{if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;global.fetch=originalFetch;});
  const game=await generateGame([],[],(completed,total)=>progress.push([completed,total]));assert.equal(calls,14);assert.equal(categoryCalls,13);assert.deepEqual(game.rounds[0].categories[0],categories[0]);assert.deepEqual(game.rounds[1].categories[5],categories[11]);assert.equal(validateGame(game),true);assert.deepEqual(progress.at(-1),[13,13]);
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

test('clues cannot reveal their own response or a distinctive response root',()=>{
  assert.equal(clueDoesNotRevealResponse({clue:'This compact object consists primarily of densely packed neutrons.',response:'neutron star'}),false);
  assert.equal(clueDoesNotRevealResponse({clue:'This particle is produced in beta decay.',response:'neutrino',aliases:['neutrinos']}),true);
  assert.equal(clueDoesNotRevealResponse({clue:'This Paris tower opened in 1889.',response:'Eiffel Tower'}),true);
  assert.equal(clueDoesNotRevealResponse({clue:'This scientist developed the theory of relativity.',response:'Albert Einstein'}),true);
  const invalid=structuredClone(FALLBACK_GAME);invalid.rounds[0].categories[0].clues[0]={clue:'This Toronto landmark dominates the skyline.',response:'Toronto',aliases:[]};
  assert.equal(validateGame(invalid),false);
});

test('Responses API text extraction never passes undefined to JSON parsing',()=>{
  assert.equal(responseText({output_text:'{"ok":true}'}),'{"ok":true}');
  assert.equal(responseText({output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:'{"ok":true}'}]}]}),'{"ok":true}');
  assert.equal(responseText({status:'incomplete',output:[{type:'reasoning'}]}),null);
});

test('AI judging accepts a harmless omitted qualifier but rejects a descriptive substitute',async t=>{
  const originalKey=process.env.OPENAI_API_KEY,originalFetch=global.fetch,calls=[];process.env.OPENAI_API_KEY='test-key';
  global.fetch=async(_url,options)=>{const request=JSON.parse(options.body);calls.push(request);const given=JSON.parse(request.input).given,correct=/pyrimid/i.test(given);return {ok:true,json:async()=>({output_text:JSON.stringify({correct,verdict:correct?'harmless_variant':'related_but_different'})})};};
  t.after(()=>{if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;global.fetch=originalFetch;});
  assert.equal(await judge('What is Pyrimid of Giza?',{clue:'This is the oldest Wonder of the Ancient World.',response:'Great Pyramid of Giza',aliases:[]}),true);
  assert.equal(await judge('What is the Pyramid at Saqqara?',{clue:'This is the oldest Wonder of the Ancient World.',response:'Great Pyramid of Giza',aliases:[]}),false);
  assert.equal(await judge('What is an atmospheric pressure gauge?',{clue:'Torricelli is credited with inventing this instrument.',response:'barometer',aliases:[]}),false);
  assert.equal(await judge('What is a rhinoceros?',{clue:'Its tusk is actually an elongated tooth.',response:'narwhal',aliases:[]}),false);
  assert.equal(calls.length,1);
  assert.match(calls[0].instructions,/Rhinoceros is NOT narwhal/);assert.match(calls[0].instructions,/Pyrimid of Giza/);
});
