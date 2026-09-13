const test=require('node:test');
const assert=require('node:assert/strict');
const {io:connect}=require('socket.io-client');
const {server,io,rooms,makeRoom,publicRoom,phraseCorrect,dispose}=require('../server');
let url;
test.before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}`;});
test.after(async()=>{for(const room of rooms.values())dispose(room);await new Promise(resolve=>io.close(resolve));});
const client=async()=>{const c=connect(url,{transports:['websocket'],forceNew:true});await new Promise(resolve=>c.once('connect',resolve));return c;};
const pause=ms=>new Promise(r=>setTimeout(r,ms));

test('host, signed contestant, clue, buzz and scoring flow work together',async t=>{
  const room=makeRoom(),host=await client(),player=await client();t.after(()=>{host.disconnect();player.disconnect();dispose(room);});
  await host.emitWithAck('watchRoom',{code:room.code});
  const joined=await player.emitWithAck('joinRoom',{code:room.code,name:'Jason',occupation:'biology professor',location:'London, Ontario',signature:'data:image/png;base64,AAAA'});
  assert.equal(joined.ok,true);assert.equal(room.players[0].signature,'data:image/png;base64,AAAA');
  assert.equal((await player.emitWithAck('startGame',{code:room.code})).ok,true);assert.equal(room.phase,'intro');
  host.emit('introFinished',{code:room.code});await pause(10);assert.equal(room.phase,'board');
  player.emit('selectClue',{code:room.code,category:0,row:0});await pause(10);assert.equal(room.phase,'clue');
  assert.equal(publicRoom(room).game.rounds[0].categories[0].clues[0].response,null);
  host.emit('clueRead',{code:room.code});await pause(10);assert.equal(room.canBuzz,true);
  player.emit('buzz',{code:room.code});await pause(10);assert.equal(room.buzzedId,player.id);
  const answer=await player.emitWithAck('submitAnswer',{code:room.code,answer:'What is Toronto?'});
  assert.equal(answer.ok,true);assert.equal(room.players[0].score,200);assert.equal(room.phase,'review');
  assert.equal(publicRoom(room).game.rounds[0].categories[0].clues[0].response,'Toronto');
});

test('responses must use Jeopardy question phrasing',()=>{
  assert.equal(phraseCorrect('What is Toronto?'),true);
  assert.equal(phraseCorrect('Who was Marie Curie?'),true);
  assert.equal(phraseCorrect('Toronto'),false);
});

test('private Final Jeopardy values expose only completion status',()=>{
  const room=makeRoom();room.phase='final_wager';room.players=[{id:'p',name:'Pat',key:'pat',occupation:'teacher',location:'Ottawa',score:1200,finalWager:800,finalAnswer:'Banting',finalCorrect:null}];
  const visible=publicRoom(room).players[0];assert.equal(visible.finalWager,null);assert.equal(visible.finalAnswer,null);assert.equal(visible.hasFinalWager,true);assert.equal(visible.hasFinalAnswer,true);dispose(room);
});
