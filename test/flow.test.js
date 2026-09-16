const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
process.env.NODE_ENV='test';
const {io:connect}=require('socket.io-client');
const {server,io,rooms,ANSWER_TIME_MS,DAILY_ANSWER_TIME_MS,CLUE_READ_FAILSAFE_MS,GAME_BANK_TARGET,GAME_BANK_VERSION,JUDGING_DIAGNOSTICS,makeRoom,publicRoom,firstName,validWagerAudio,phraseCorrect,finishClue,finishGame,prepareFinalReveal,advanceFinalReveal,advanceReview,dispose}=require('../server');
const {BOARD_GENERATION_TIMEOUT_MS}=require('../src/game');
let url;
test.before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}`;});
test.after(async()=>{for(const room of rooms.values())dispose(room);await new Promise(resolve=>io.close(resolve));});
const client=async()=>{const c=connect(url,{transports:['websocket'],forceNew:true});await new Promise(resolve=>c.once('connect',resolve));return c;};
const pause=ms=>new Promise(r=>setTimeout(r,ms));

test('host, signed contestant, clue, buzz and scoring flow work together',async t=>{
  const room=makeRoom(),host=await client(),player=await client();t.after(()=>{host.disconnect();player.disconnect();dispose(room);});
  await host.emitWithAck('watchRoom',{code:room.code});
  const joined=await player.emitWithAck('joinRoom',{code:room.code,name:'Jason',occupation:'biology professor',location:'London, Ontario',signature:'data:image/png;base64,AAAA',photo:'data:image/jpeg;base64,AAAA'});
  assert.equal(joined.ok,true);assert.equal(room.players[0].photo,'data:image/jpeg;base64,AAAA');
  assert.equal((await player.emitWithAck('startGame',{code:room.code})).ok,true);assert.equal(room.phase,'intro');
  host.emit('introFinished',{code:room.code});await pause(10);assert.equal(room.phase,'categories');
  host.emit('categoriesRead',{code:room.code});await pause(10);assert.equal(room.phase,'board');assert.equal(room.canSelect,false);
  host.emit('selectionPromptRead',{code:room.code});await pause(10);assert.equal(room.canSelect,true);
  player.emit('selectClue',{code:room.code,category:0,row:0});await pause(10);assert.equal(room.phase,'selection');await pause(20);assert.equal(room.phase,'clue');assert.equal(room.clueNeedsReading,true);
  assert.equal(publicRoom(room).game.rounds[0].categories[0].clues[0].response,null);
  host.emit('clueRead',{code:room.code});await pause(10);assert.equal(room.canBuzz,true);assert.equal(room.clueNeedsReading,false);
  player.emit('buzz',{code:room.code});await pause(10);assert.equal(room.buzzedId,player.id);assert.ok(room.answerDeadline-Date.now()<=ANSWER_TIME_MS&&room.answerDeadline-Date.now()>ANSWER_TIME_MS-1000);
  const answer=await player.emitWithAck('submitAnswer',{code:room.code,answer:'What is Toronto?'});
  assert.equal(answer.ok,true);assert.equal(room.players[0].score,200);assert.equal(room.phase,'review');
  assert.equal(publicRoom(room).game.rounds[0].categories[0].clues[0].response,null);
});

test('correct response is exposed only after a clue ends without a correct answer',()=>{
  const room=makeRoom();room.round=0;room.selected={category:0,row:0};room.phase='review';room.lastJudgment={playerId:null,correct:false,revealCorrect:true,timedOut:false};
  assert.equal(publicRoom(room).game.rounds[0].categories[0].clues[0].response,'Toronto');room.lastJudgment.revealCorrect=false;
  assert.equal(publicRoom(room).game.rounds[0].categories[0].clues[0].response,null);dispose(room);
});

test('an incorrect response reopens buzzing without asking the display to reread the clue',()=>{
  const room=makeRoom();room.round=0;room.selected={category:0,row:0};room.phase='review';room.players=[{id:'wrong',name:'Wrong',score:0},{id:'next',name:'Next',score:0}];room.lastJudgment={playerId:'wrong',correct:false,revealCorrect:false,timedOut:false};
  advanceReview(room);assert.equal(room.phase,'clue');assert.equal(room.canBuzz,true);assert.equal(room.clueNeedsReading,false);dispose(room);
});

test('a missed narration completion signal cannot leave phones on WAIT forever',async()=>{
  const room=makeRoom();room.round=0;room.selected={category:0,row:0};room.phase='selection';room.players=[{id:'p',name:'Player',score:0}];
  room.used=[{round:0,category:0,row:0}];require('../server').beginSelectedClue(room);assert.equal(room.clueNeedsReading,true);
  await pause(CLUE_READ_FAILSAFE_MS+30);assert.equal(room.canBuzz,true);assert.equal(room.clueNeedsReading,false);dispose(room);
});

test('the last remaining board clue is selected automatically after the host announcement',async t=>{
  const room=makeRoom(),host=await client();t.after(()=>{host.disconnect();dispose(room);});await host.emitWithAck('watchRoom',{code:room.code});
  room.round=0;room.phase='review';room.selectorId='p';room.players=[{id:'p',name:'Player',score:0}];room.used=[];
  for(let category=0;category<6;category++)for(let row=0;row<5;row++)if(category!==5||row!==4)room.used.push({round:0,category,row});
  finishClue(room);assert.equal(room.phase,'selection');assert.equal(room.automaticFinalClue,true);assert.deepEqual(room.selected,{category:5,row:4});
  host.emit('finalBoardCluePromptRead',{code:room.code});await pause(10);assert.equal(room.phase,'clue');assert.equal(room.clueNeedsReading,true);
});

test('test games reuse old boards without changing champion history',async()=>{
  const before=await (await fetch(`${url}/api/history`)).json(),room=makeRoom({testMode:true});assert.equal(room.testMode,true);assert.equal(room.generated,false);assert.equal(room.generating,false);
  room.players=[{id:'tester',name:'Tester',key:'tester',score:2400}];await finishGame(room);const after=await (await fetch(`${url}/api/history`)).json();
  assert.deepEqual(after,before);assert.match(room.message,/No results were saved/);dispose(room);
});

test('Final-only test skips directly to wagers with realistic scores',async t=>{
  const final={category:'LANDMARKS',clue:'This Paris landmark opened in 1889.',response:'Eiffel Tower',aliases:['the Eiffel Tower']};
  const room=makeRoom({finalOnly:true,finalClue:final}),host=await client(),player=await client();t.after(()=>{host.disconnect();player.disconnect();dispose(room);});
  await host.emitWithAck('watchRoom',{code:room.code});
  room.players=[{id:player.id,name:'Tester',key:'tester',score:0,finalWager:null,finalAnswer:null,finalCorrect:null}];
  assert.equal(room.finalOnly,true);assert.equal(room.testMode,true);assert.deepEqual(room.game.final,final);
  assert.equal((await player.emitWithAck('startGame',{code:room.code})).ok,true);assert.equal(room.phase,'final_wager');assert.equal(room.players[0].score,12400);assert.equal(room.canFinalWager,false);
  assert.equal((await player.emitWithAck('finalWager',{code:room.code,wager:1000})).ok,false);
  host.emit('finalWagerPromptRead',{code:room.code});await pause(10);assert.equal(room.canFinalWager,true);
  assert.equal((await player.emitWithAck('finalWager',{code:room.code,wager:1000})).ok,true);assert.equal(room.phase,'final_clue');
  host.emit('clueRead',{code:room.code});await pause(10);assert.equal(room.phase,'final_answer');const deadline=room.answerDeadline;
  assert.equal((await player.emitWithAck('finalAnswer',{code:room.code,answer:'What is the Eiffel Tower?'})).ok,true);assert.equal(room.phase,'final_answer');assert.equal(room.answerDeadline,deadline);
});

test('responses must use Jeopardy question phrasing',()=>{
  assert.equal(ANSWER_TIME_MS,15000);assert.equal(DAILY_ANSWER_TIME_MS,15000);
  assert.equal(GAME_BANK_TARGET,20);assert.equal(GAME_BANK_VERSION,2);
  assert.equal(phraseCorrect('What is Toronto?'),true);
  assert.equal(phraseCorrect('Who was Marie Curie?'),true);
  assert.equal(phraseCorrect('Toronto'),false);
});

test('game-bank status exposes live ready and target counts',async()=>{
  const response=await fetch(`${url}/api/game-bank`),bank=await response.json();
  assert.equal(response.ok,true);
  assert.equal(typeof bank.ready,'number');
  assert.equal(bank.target,GAME_BANK_TARGET);
  assert.equal(typeof bank.generating,'boolean');
  assert.equal(typeof bank.buildCompleted,'number');
  assert.equal(bank.buildTotal,13);
  assert.equal(typeof bank.playableNow,'boolean');
  assert.equal(BOARD_GENERATION_TIMEOUT_MS,600000);
});

test('landing screen shows and refreshes game-board availability',()=>{
  const client=fs.readFileSync(require.resolve('../public/app.js'),'utf8');
  assert.match(client,/id="bankStatus">Checking available game boards/);
  assert.match(client,/fetch\('\/api\/game-bank',\{cache:'no-store'\}\)/);
  assert.match(client,/setInterval\(refreshBankStatus,10000\)/);
  assert.match(client,/building part \$\{bank\.buildCompleted\+1\} of \$\{bank\.buildTotal\}/);
  assert.match(client,/host\.disabled=!bank\.playableNow/);
  assert.match(client,/id="testJudging">Run Judging Check/);
  assert.match(client,/fetch\('\/api\/judging-diagnostics'/);
  assert.equal(JUDGING_DIAGNOSTICS.length,10);
});

test('Trebek introduction uses the corrected contestant and host cue points',()=>{
  const client=fs.readFileSync(require.resolve('../public/app.js'),'utf8');
  assert.match(client,/alex-introduction-web\.mp3',contestants:11\.7,host:36\.8,end:45\.3/);
});

test('TV presentation includes returning champion chyron, clue category, and final-clue announcement',()=>{
  const client=fs.readFileSync(require.resolve('../public/app.js'),'utf8'),styles=fs.readFileSync(require.resolve('../public/styles.css'),'utf8');
  assert.match(client,/champion-chyron/);assert.match(client,/championStats\.streak/);assert.match(client,/championStats\.earnings/);
  assert.match(client,/class="clue-category"/);assert.match(client,/And now, the final clue\./);assert.match(styles,/\.clue-category/);
});

test('the uploaded timeout buzzer is used for both no-buzz and timed-out reviews',()=>{
  const client=fs.readFileSync(require.resolve('../public/app.js'),'utf8');
  assert.match(client,/playDataAudio\('\/assets\/timeout-buzzer\.mp3'\)/);
  assert.match(client,/else\{await playTimeoutBuzzer\(\);line='No one rang in\.'/);
  assert.ok(fs.statSync(require.resolve('../public/assets/timeout-buzzer.mp3')).size>1000);
});

test('game narration uses first names and accepts mobile Daily Double audio formats',()=>{
  assert.equal(firstName({name:'Jason Brown'}),'Jason');
  assert.equal(validWagerAudio('data:audio/mp4;base64,AAAA'),true);
  assert.equal(validWagerAudio('data:audio/webm;codecs=opus;base64,AAAA'),true);
  assert.equal(validWagerAudio('data:text/plain;base64,AAAA'),false);
});

test('private Final Jeopardy values expose only completion status',()=>{
  const room=makeRoom();room.phase='final_wager';room.players=[{id:'p',name:'Pat',key:'pat',occupation:'teacher',location:'Ottawa',signature:'data:image/png;base64,AAAA',photo:'data:image/jpeg;base64,AAAA',score:1200,preFinalScore:1200,finalWager:800,finalAnswer:'Banting',finalCorrect:null}];
  const visible=publicRoom(room).players[0];assert.equal(visible.finalWager,null);assert.equal(visible.finalAnswer,null);assert.equal(visible.hasFinalWager,true);assert.equal(visible.hasFinalAnswer,true);dispose(room);
});

test('Final Jeopardy reveals low score first and applies wagers only when revealed',()=>{
  const room=makeRoom();room.phase='final_reveal';room.players=[
    {id:'high',name:'High',key:'high',score:5000,preFinalScore:5000,finalWager:2000,finalAnswer:'What is A?',finalCorrect:true},
    {id:'low',name:'Low',key:'low',score:1000,preFinalScore:1000,finalWager:600,finalAnswer:'What is B?',finalCorrect:false},
    {id:'mid',name:'Mid',key:'mid',score:3000,preFinalScore:3000,finalWager:1000,finalAnswer:'What is C?',finalCorrect:true}
  ];room.finalOrder=['low','mid','high'];room.finalRevealIndex=0;room.finalRevealStep='ask_response';
  assert.equal(publicRoom(room).activeFinalId,'low');assert.equal(publicRoom(room).players[1].finalAnswer,null);
  advanceFinalReveal(room);assert.equal(room.finalRevealStep,'show_response');assert.equal(publicRoom(room).players[1].finalAnswer,'What is B?');assert.equal(room.players[1].score,1000);
  advanceFinalReveal(room);assert.equal(room.finalRevealStep,'ask_wager');assert.equal(room.players[1].score,1000);
  advanceFinalReveal(room);assert.equal(room.finalRevealStep,'show_wager');assert.equal(room.players[1].score,400);assert.equal(publicRoom(room).players[1].finalWager,600);
  advanceFinalReveal(room);assert.equal(room.finalRevealIndex,1);assert.equal(publicRoom(room).activeFinalId,'mid');dispose(room);
});

test('an unanswered Final Jeopardy response remains visually blank',async()=>{
  const room=makeRoom();room.phase='final_answer';room.players=[{id:'blank',name:'Blank',key:'blank',score:2000,preFinalScore:2000,finalWager:500,finalAnswer:null,finalCorrect:null}];
  await prepareFinalReveal(room);assert.equal(room.players[0].finalAnswer,'');advanceFinalReveal(room);assert.equal(publicRoom(room).players[0].finalAnswer,'');dispose(room);
});

test('Final Jeopardy reveals the correct response aloud when everyone misses',()=>{
  const room=makeRoom();room.phase='final_reveal';room.players=[{id:'only',name:'Only',key:'only',score:1000,preFinalScore:1000,finalWager:500,finalAnswer:'Wrong',finalCorrect:false}];room.finalOrder=['only'];room.finalRevealIndex=0;room.finalRevealStep='show_wager';
  advanceFinalReveal(room);assert.equal(room.phase,'final_correct_answer');assert.equal(publicRoom(room).game.final.response,room.game.final.response);dispose(room);
});
