const test=require('node:test');
const assert=require('node:assert/strict');
process.env.NODE_ENV='test';
const {io:connect}=require('socket.io-client');
const {server,io,rooms,makeRoom,publicRoom,phraseCorrect,finishGame,advanceFinalReveal,dispose}=require('../server');
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
  player.emit('selectClue',{code:room.code,category:0,row:0});await pause(10);assert.equal(room.phase,'selection');await pause(20);assert.equal(room.phase,'clue');
  assert.equal(publicRoom(room).game.rounds[0].categories[0].clues[0].response,null);
  host.emit('clueRead',{code:room.code});await pause(10);assert.equal(room.canBuzz,true);
  player.emit('buzz',{code:room.code});await pause(10);assert.equal(room.buzzedId,player.id);
  const answer=await player.emitWithAck('submitAnswer',{code:room.code,answer:'What is Toronto?'});
  assert.equal(answer.ok,true);assert.equal(room.players[0].score,200);assert.equal(room.phase,'review');
  assert.equal(publicRoom(room).game.rounds[0].categories[0].clues[0].response,null);
});

test('correct response is exposed only after a clue ends without a correct answer',()=>{
  const room=makeRoom();room.round=0;room.selected={category:0,row:0};room.phase='review';room.lastJudgment={playerId:null,correct:false,revealCorrect:true,timedOut:false};
  assert.equal(publicRoom(room).game.rounds[0].categories[0].clues[0].response,'Toronto');room.lastJudgment.revealCorrect=false;
  assert.equal(publicRoom(room).game.rounds[0].categories[0].clues[0].response,null);dispose(room);
});

test('test games reuse old boards without changing champion history',async()=>{
  const before=await (await fetch(`${url}/api/history`)).json(),room=makeRoom({testMode:true});assert.equal(room.testMode,true);assert.equal(room.generated,false);assert.equal(room.generating,false);
  room.players=[{id:'tester',name:'Tester',key:'tester',score:2400}];await finishGame(room);const after=await (await fetch(`${url}/api/history`)).json();
  assert.deepEqual(after,before);assert.match(room.message,/No results were saved/);dispose(room);
});

test('responses must use Jeopardy question phrasing',()=>{
  assert.equal(phraseCorrect('What is Toronto?'),true);
  assert.equal(phraseCorrect('Who was Marie Curie?'),true);
  assert.equal(phraseCorrect('Toronto'),false);
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
