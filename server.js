const path=require('node:path');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const http=require('node:http');
const express=require('express');
const {Server}=require('socket.io');
const QRCode=require('qrcode');
const {FALLBACK_GAME,normalize,generateGame,judge}=require('./src/game');

const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:2e6});
app.use(express.json({limit:'2mb'}));app.use(express.static(path.join(__dirname,'public')));
app.get(['/host/:code','/join/:code'],(_req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

const rooms=new Map();
const dataDir=process.env.DATA_DIR||path.join(__dirname,'data');
const historyPath=path.join(dataDir,'history.json');
function emptyHistory(){return {version:1,lastWinnerKey:null,players:{},usedClues:[],games:[]};}
function loadHistory(){try{return {...emptyHistory(),...JSON.parse(fs.readFileSync(historyPath,'utf8'))};}catch{return emptyHistory();}}
let history=loadHistory();
async function saveHistory(){await fsp.mkdir(dataDir,{recursive:true});const temp=`${historyPath}.tmp`;await fsp.writeFile(temp,JSON.stringify(history,null,2));await fsp.rename(temp,historyPath);}
function playerKey(name){return normalize(name);}
function code(){let value;do value=Math.random().toString(36).slice(2,7).toUpperCase();while(rooms.has(value));return value;}
function copy(value){return structuredClone(value);}
function getPlayer(room,id){return room.players.find(p=>p.id===id);}
function values(round){return round===0?[200,400,600,800,1000]:[400,800,1200,1600,2000];}
function currentClue(room){return room.game.rounds[room.round].categories[room.selected.category].clues[room.selected.row];}
function dailyDouble(room,c,r){return room.game.rounds[room.round].dailyDoubles.some(([ci,ri])=>ci===c&&ri===r);}
function eligibleFinal(room){return room.players.filter(p=>p.score>0);}

function makeRoom(){
  const era=Math.random()<.5?'trebek':'jennings';
  const room={code:code(),era,logo:Math.floor(Math.random()*4),phase:'lobby',displayId:null,players:[],game:copy(FALLBACK_GAME),generated:false,generating:!!process.env.OPENAI_API_KEY,round:0,used:[],selected:null,selectorId:null,buzzedId:null,canBuzz:false,attempted:[],wager:null,lastJudgment:null,message:'Waiting for contestants',createdAt:Date.now()};
  rooms.set(room.code,room);
  if(process.env.OPENAI_API_KEY)generateGame(history.usedClues).then(game=>{if(room.phase==='lobby'){room.game=game;room.generated=true;room.generating=false;room.message='A fresh AI-generated board is ready.';emit(room);}}).catch(error=>{console.warn('Generated board unavailable:',error.message);room.generating=false;room.message='The built-in tournament board is ready.';emit(room);});
  return room;
}

function introLine(room,p){
  const base=`A ${p.occupation} from ${p.location}, ${p.name}.`;
  const stats=history.players[p.key];
  return stats?.streak>0&&history.lastWinnerKey===p.key?`${base} Whose ${stats.streak}-game win streak has earned them $${stats.earnings.toLocaleString()}.`:base;
}
function introText(room){const players=room.players.map(p=>introLine(room,p)).join(' ');const host=room.era==='trebek'?'And now, here is the host of Jeopardy, Alex Trebek!':'And now, here is the host of Jeopardy, Ken Jennings!';return `This is Jeopardy! Here are today's contestants. ${players} ${host}`;}
function safeGame(room){return {rounds:room.game.rounds.map((round,ri)=>({title:round.title,categories:round.categories.map((cat,ci)=>({name:cat.name,clues:cat.clues.map((q,ri2)=>({clue:room.selected?.category===ci&&room.selected?.row===ri2&&room.round===ri?q.clue:null,response:room.selected?.category===ci&&room.selected?.row===ri2&&room.round===ri&&['review','daily_review'].includes(room.phase)?q.response:null}))}))})),final:{category:room.game.final.category,clue:['final_clue','final_answer','final_results'].includes(room.phase)?room.game.final.clue:null,response:room.phase==='final_results'?room.game.final.response:null}};}
function publicRoom(room){return {...room,game:safeGame(room),introText:introText(room),players:room.players.map(({finalAnswer,finalWager,...p})=>({...p,hasFinalWager:finalWager!==null,hasFinalAnswer:finalAnswer!==null,finalWager:room.phase==='final_results'?finalWager:null,finalAnswer:room.phase==='final_results'?finalAnswer:null})),generating:room.generating};}
function emit(room){io.to(room.code).emit('state',publicRoom(room));}
function isDisplay(socket,room){return socket.id===room.displayId&&socket.data.display;}
function selectedValue(room){return values(room.round)[room.selected.row];}
function allUsed(room){return room.used.filter(x=>x.round===room.round).length>=30;}

app.get('/api/room/:code/qr',async(req,res)=>{const room=rooms.get(req.params.code.toUpperCase());if(!room)return res.sendStatus(404);res.type('png').send(await QRCode.toBuffer(`${req.protocol}://${req.get('host')}/join/${room.code}`,{width:500,margin:1}));});
app.get('/api/history',(req,res)=>res.json({games:history.games.slice(-10).reverse(),champion:history.lastWinnerKey?history.players[history.lastWinnerKey]:null}));

io.on('connection',socket=>{
  socket.on('createRoom',(_,reply)=>{const room=makeRoom();room.displayId=socket.id;socket.data={roomCode:room.code,display:true};socket.join(room.code);reply?.({ok:true,code:room.code});emit(room);});
  socket.on('watchRoom',({code:raw},reply)=>{const room=rooms.get(String(raw).toUpperCase());if(!room)return reply?.({ok:false,error:'Game not found.'});room.displayId=socket.id;socket.data={roomCode:room.code,display:true};socket.join(room.code);reply?.({ok:true,room:publicRoom(room)});emit(room);});
  socket.on('joinRoom',({code:raw,name,occupation,location,signature,typedSignature},reply)=>{
    const room=rooms.get(String(raw).toUpperCase());if(!room||room.phase!=='lobby')return reply?.({ok:false,error:'That lobby is unavailable.'});
    if(room.players.length>=3)return reply?.({ok:false,error:'This game already has three contestants.'});
    name=String(name||'').trim().slice(0,28);occupation=String(occupation||'').trim().slice(0,50);location=String(location||'').trim().slice(0,50);
    const drawn=typeof signature==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature)&&signature.length<700000;
    typedSignature=String(typedSignature||'').trim().slice(0,28);
    if(!name||!occupation||!location||(!drawn&&!typedSignature))return reply?.({ok:false,error:'Name, occupation, location, and a signature are required.'});
    const p={id:socket.id,key:playerKey(name),name,occupation,location,signature:drawn?signature:null,typedSignature:drawn?'':typedSignature,score:0,connected:true,finalWager:null,finalAnswer:null,finalCorrect:null};
    room.players.push(p);socket.data={roomCode:room.code,display:false};socket.join(room.code);reply?.({ok:true,playerId:p.id});emit(room);
  });
  socket.on('rejoin',({code:raw,playerId},reply)=>{const room=rooms.get(String(raw).toUpperCase()),p=room&&getPlayer(room,playerId);if(!p)return reply?.({ok:false});const old=p.id;p.id=socket.id;p.connected=true;if(room.selectorId===old)room.selectorId=p.id;if(room.buzzedId===old)room.buzzedId=p.id;room.attempted=room.attempted.map(id=>id===old?p.id:id);socket.data={roomCode:room.code,display:false};socket.join(room.code);reply?.({ok:true,playerId:p.id});emit(room);});
  socket.on('startGame',({code:raw},reply)=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||room.phase!=='lobby')return reply?.({ok:false});if(!room.players.length)return reply?.({ok:false,error:'At least one contestant must join.'});room.phase='intro';room.message='Introducing today’s contestants';room.selectorId=room.players[0].id;reply?.({ok:true});emit(room);});
  socket.on('introFinished',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||room.phase!=='intro')return;room.phase='board';room.message=`${getPlayer(room,room.selectorId).name}, select a clue.`;emit(room);});
  socket.on('selectClue',({code:raw,category,row})=>{
    const room=rooms.get(String(raw).toUpperCase());category=Number(category);row=Number(row);
    if(!room||!isDisplay(socket,room)||room.phase!=='board'||room.used.some(x=>x.round===room.round&&x.category===category&&x.row===row)||!room.game.rounds[room.round]?.categories[category]?.clues[row])return;
    room.selected={category,row};room.used.push({round:room.round,category,row});room.buzzedId=null;room.attempted=[];room.canBuzz=false;room.lastJudgment=null;
    if(dailyDouble(room,category,row)){room.phase='daily_wager';room.message=`Daily Double! ${getPlayer(room,room.selectorId).name}, make your wager.`;}else{room.phase='clue';room.message='Listen to the clue.';}
    emit(room);
  });
  socket.on('submitWager',({code:raw,wager},reply)=>{const room=rooms.get(String(raw).toUpperCase()),p=room&&getPlayer(room,socket.id);wager=Math.floor(Number(wager));if(!room||room.phase!=='daily_wager'||socket.id!==room.selectorId)return reply?.({ok:false});const max=Math.max(values(room.round).at(-1),p.score);if(!Number.isFinite(wager)||wager<5||wager>max)return reply?.({ok:false,error:`Wager between $5 and $${max.toLocaleString()}.`});room.wager=wager;room.phase='daily_clue';room.message=`${p.name} wagered $${wager.toLocaleString()}.`;reply?.({ok:true});emit(room);});
  socket.on('clueRead',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room))return;if(room.phase==='clue'){room.canBuzz=true;room.message='Buzz in now!';emit(room);}else if(room.phase==='daily_clue'){room.phase='daily_answer';room.message=`${getPlayer(room,room.selectorId).name}, enter your response.`;emit(room);}else if(room.phase==='final_clue'){room.phase='final_answer';room.message='Enter your Final Jeopardy response.';emit(room);}});
  socket.on('buzz',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||room.phase!=='clue'||!room.canBuzz||room.buzzedId||room.attempted.includes(socket.id)||!getPlayer(room,socket.id))return;room.buzzedId=socket.id;room.canBuzz=false;room.phase='answer';room.message=`${getPlayer(room,socket.id).name}, respond.`;emit(room);});
  socket.on('submitAnswer',async({code:raw,answer},reply)=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!['answer','daily_answer'].includes(room.phase))return reply?.({ok:false});const id=room.phase==='daily_answer'?room.selectorId:room.buzzedId;if(socket.id!==id)return reply?.({ok:false});answer=String(answer||'').trim().slice(0,100);if(!answer)return reply?.({ok:false});room.message='Judging the response…';emit(room);const correct=await judge(answer,currentClue(room));const p=getPlayer(room,id),amount=room.phase==='daily_answer'?room.wager:selectedValue(room);p.score+=correct?amount:-amount;room.lastJudgment={playerId:id,answer,correct,amount};room.selectorId=correct?id:room.selectorId;room.phase=room.phase==='daily_answer'?'daily_review':'review';room.message=correct?'Correct!':'Sorry, that is incorrect.';reply?.({ok:true});emit(room);});
  socket.on('continueClue',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||!['review','daily_review'].includes(room.phase))return;if(room.phase==='review'&&!room.lastJudgment.correct){room.attempted.push(room.lastJudgment.playerId);room.buzzedId=null;if(room.attempted.length<room.players.length){room.phase='clue';room.canBuzz=true;room.message='Other contestants may buzz in.';emit(room);return;}}finishClue(room);});
  socket.on('closeClue',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||!['clue','answer'].includes(room.phase))return;room.phase='review';room.canBuzz=false;room.lastJudgment={playerId:null,answer:'No response',correct:false,amount:0};room.message='No correct response.';emit(room);});
  socket.on('overrideJudgment',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||!['review','daily_review'].includes(room.phase)||!room.lastJudgment?.playerId)return;const p=getPlayer(room,room.lastJudgment.playerId),delta=room.lastJudgment.correct?-2*room.lastJudgment.amount:2*room.lastJudgment.amount;p.score+=delta;room.lastJudgment.correct=!room.lastJudgment.correct;if(room.lastJudgment.correct)room.selectorId=p.id;room.message=room.lastJudgment.correct?'Ruling changed: correct.':'Ruling changed: incorrect.';emit(room);});
  socket.on('nextRound',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||room.phase!=='round_break')return;if(room.round===0){room.round=1;room.phase='board';room.selectorId=[...room.players].sort((a,b)=>a.score-b.score)[0].id;room.message='Double Jeopardy! The contestant in third place selects first.';}else beginFinal(room);emit(room);});
  socket.on('finalWager',({code:raw,wager},reply)=>{const room=rooms.get(String(raw).toUpperCase()),p=room&&getPlayer(room,socket.id);wager=Math.floor(Number(wager));if(!room||room.phase!=='final_wager'||!p||p.score<=0||p.finalWager!==null)return reply?.({ok:false});if(!Number.isFinite(wager)||wager<0||wager>p.score)return reply?.({ok:false,error:`Wager between $0 and $${p.score.toLocaleString()}.`});p.finalWager=wager;reply?.({ok:true});if(eligibleFinal(room).every(x=>x.finalWager!==null)){room.phase='final_clue';room.message=room.game.final.category;}emit(room);});
  socket.on('finalAnswer',async({code:raw,answer},reply)=>{const room=rooms.get(String(raw).toUpperCase()),p=room&&getPlayer(room,socket.id);if(!room||room.phase!=='final_answer'||!p||p.score<=0||p.finalAnswer!==null)return reply?.({ok:false});p.finalAnswer=String(answer||'').trim().slice(0,100);reply?.({ok:true});if(eligibleFinal(room).every(x=>x.finalAnswer!==null)){room.message='Judging Final Jeopardy…';emit(room);for(const contestant of eligibleFinal(room)){contestant.finalCorrect=await judge(contestant.finalAnswer,room.game.final);contestant.score+=contestant.finalCorrect?contestant.finalWager:-contestant.finalWager;}await finishGame(room);}else emit(room);});
  socket.on('disconnect',()=>{const room=rooms.get(socket.data.roomCode),p=room&&getPlayer(room,socket.id);if(p){p.connected=false;emit(room);}});
});

function finishClue(room){room.selected=null;room.wager=null;room.buzzedId=null;room.canBuzz=false;if(allUsed(room)){room.phase='round_break';room.message=room.round===0?'The Jeopardy round is complete.':'Double Jeopardy is complete.';}else{room.phase='board';room.message=`${getPlayer(room,room.selectorId)?.name||room.players[0].name}, select a clue.`;}emit(room);}
function beginFinal(room){const eligible=eligibleFinal(room);if(!eligible.length){room.players.sort((a,b)=>b.score-a.score)[0].score=1;}room.players.forEach(p=>{p.finalWager=null;p.finalAnswer=null;p.finalCorrect=null;});room.phase='final_wager';room.message=`Final Jeopardy category: ${room.game.final.category}. Make your wagers.`;}
async function finishGame(room){room.phase='final_results';const winner=[...room.players].sort((a,b)=>b.score-a.score)[0];const key=winner.key,prior=history.players[key]||{name:winner.name,wins:0,streak:0,earnings:0};const continuing=history.lastWinnerKey===key;prior.name=winner.name;prior.wins++;prior.streak=continuing?prior.streak+1:1;prior.earnings=(continuing?prior.earnings:0)+Math.max(0,winner.score);history.players[key]=prior;if(history.lastWinnerKey&&history.lastWinnerKey!==key&&history.players[history.lastWinnerKey])history.players[history.lastWinnerKey].streak=0;history.lastWinnerKey=key;history.games.push({playedAt:new Date().toISOString(),winner:winner.name,score:winner.score,era:room.era});history.games=history.games.slice(-100);history.usedClues.push(...room.game.rounds.flatMap(r=>r.categories.flatMap(c=>c.clues.map(q=>q.clue))),room.game.final.clue);history.usedClues=history.usedClues.slice(-500);await saveHistory().catch(console.error);room.message=`${winner.name} wins with $${winner.score.toLocaleString()}!`;emit(room);}

function dispose(room){rooms.delete(room.code);}
setInterval(()=>{for(const room of rooms.values())if(Date.now()-room.createdAt>8*60*60*1000)dispose(room);},30*60*1000).unref();
if(require.main===module)server.listen(process.env.PORT||3000,()=>console.log(`Jeopardy listening on ${process.env.PORT||3000}`));
module.exports={app,server,io,rooms,makeRoom,publicRoom,introLine,values,dailyDouble,finishClue,dispose};
