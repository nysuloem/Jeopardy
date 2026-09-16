const path=require('node:path');
const crypto=require('node:crypto');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const http=require('node:http');
const express=require('express');
const {Server}=require('socket.io');
const QRCode=require('qrcode');
const {FALLBACK_GAME,EMERGENCY_GAME,normalize,clueFingerprint,gameClueRecords,gameHasCategoryRepeat,gameHasDuplicate,validateGame,generateGame,generateFinalClue,judge}=require('./src/game');

const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:2e6});
const ANSWER_TIME_MS=15000;
const DAILY_ANSWER_TIME_MS=15000;
const CLUE_READ_FAILSAFE_MS=process.env.NODE_ENV==='test'?80:30000;
const GAME_BANK_TARGET=20;
const GAME_BANK_VERSION=2;
app.use(express.json({limit:'2mb'}));app.use(express.static(path.join(__dirname,'public')));
app.get(['/host/:code','/join/:code'],(_req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

const rooms=new Map();
const roomTimers=new Map(),speechCache=new Map();
const JUDGING_DIAGNOSTICS=[
  {label:'Exact response',given:'What is a narwhal?',item:{clue:'Its tusk is actually an elongated tooth.',response:'narwhal',aliases:[]},expected:true},
  {label:'Harmless omitted qualifier',given:'What is the Pyramid of Giza?',item:{clue:'The oldest surviving Wonder of the Ancient World was built for Pharaoh Khufu.',response:'Great Pyramid of Giza',aliases:[]},expected:true},
  {label:'Minor spelling error',given:'Who is Shakespear?',item:{clue:'This playwright created Falstaff, Prospero and King Lear.',response:'William Shakespeare',aliases:['Shakespeare']},expected:true},
  {label:'Different animal',given:'What is a rhinoceros?',item:{clue:'Its tusk is actually an elongated tooth.',response:'narwhal',aliases:[]},expected:false},
  {label:'Description instead of term',given:'What is an atmospheric pressure gauge?',item:{clue:'Torricelli is credited with inventing this instrument.',response:'barometer',aliases:[]},expected:false},
  {label:'Same category, wrong animal',given:'What is a blue whale?',item:{clue:'This toothed whale has the largest brain of any animal.',response:'sperm whale',aliases:[]},expected:false},
  {label:'Shared words, wrong title',given:'What is New York?',item:{clue:'Its longtime slogan is “All the News That’s Fit to Print.”',response:'The New York Times',aliases:['New York Times']},expected:false},
  {label:'Related place, wrong landmark',given:'What is Paris?',item:{clue:'Gustave Eiffel’s iron landmark opened for the 1889 World’s Fair.',response:'Eiffel Tower',aliases:['the Eiffel Tower']},expected:false},
  {label:'Singular for plural',given:'What is planet?',item:{clue:'These orbit stars.',response:'planets',aliases:[]},expected:true},
  {label:'Plural for singular',given:'What are cities?',item:{clue:'Toronto is one of these.',response:'city',aliases:[]},expected:true}
];
let judgingDiagnosticCache=null,judgingDiagnosticPromise=null;
const dataDir=process.env.DATA_DIR||(fs.existsSync('/data')?'/data':path.join(__dirname,'data'));
const historyPath=path.join(dataDir,'history.json');
const bankPath=path.join(dataDir,'game-bank.json');
const ledgerPath=path.join(dataDir,'clue-ledger.json');
function emptyHistory(){return {version:1,lastWinnerKey:null,players:{},usedClues:[],games:[]};}
function loadHistory(){try{return {...emptyHistory(),...JSON.parse(fs.readFileSync(historyPath,'utf8'))};}catch{return emptyHistory();}}
let history=loadHistory();
let gameBank=[];try{const saved=JSON.parse(fs.readFileSync(bankPath,'utf8'));if(saved?.version===GAME_BANK_VERSION&&Array.isArray(saved.games))gameBank=saved.games;}catch{}
let clueLedger={version:1,entries:[]};try{const saved=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));if(Array.isArray(saved?.entries))clueLedger={version:1,entries:saved.entries};}catch{}
let bankGenerating=false,bankLastError=null,bankRetryTimer=null,bankBuildCompleted=0,bankBuildTotal=13;
async function saveHistory(){await fsp.mkdir(dataDir,{recursive:true});const temp=`${historyPath}.tmp`;await fsp.writeFile(temp,JSON.stringify(history,null,2));await fsp.rename(temp,historyPath);}
function atomicJsonSync(target,value){fs.mkdirSync(dataDir,{recursive:true});const temp=`${target}.${process.pid}.tmp`;fs.writeFileSync(temp,JSON.stringify(value));fs.renameSync(temp,target);}
function saveBankSync(){atomicJsonSync(bankPath,{version:GAME_BANK_VERSION,games:gameBank});}
function saveLedgerSync(){atomicJsonSync(ledgerPath,clueLedger);}
function allKnownRecords(){return [...clueLedger.entries,...gameBank.flatMap(gameClueRecords)];}
function allKnownCategories(){return [...new Set(allKnownRecords().map(record=>record.category).filter(Boolean))];}
function reserveGame(game){if(!validateGame(game))throw new Error('This game contains an invalid category or incomplete clue.');if(gameHasDuplicate(game,clueLedger.entries))throw new Error('This game overlaps the permanent clue ledger.');clueLedger.entries.push(...gameClueRecords(game).map(x=>({...x,reservedAt:new Date().toISOString()})));saveLedgerSync();}
function finalRecord(item){return {clue:item.clue,response:item.response,category:item.category,fingerprint:clueFingerprint(item.clue),factFingerprint:`${clueFingerprint(item.category)}|${clueFingerprint(item.response)}`};}
function reserveFinal(item){const record=finalRecord(item);if(!record.fingerprint||gameHasDuplicate({rounds:[],final:item},clueLedger.entries)||gameHasCategoryRepeat({rounds:[],final:item},clueLedger.entries.map(x=>x.category)))throw new Error('That Final Jeopardy clue or category overlaps the permanent ledger.');clueLedger.entries.push({...record,reservedAt:new Date().toISOString(),source:'final-test'});saveLedgerSync();}
async function takeFreshFinal(){let lastError;for(let attempt=0;attempt<3;attempt++)try{const known=allKnownRecords(),item=await generateFinalClue(known.map(x=>x.clue),allKnownCategories());if(!gameHasDuplicate({rounds:[],final:item},known)&&!gameHasCategoryRepeat({rounds:[],final:item},allKnownCategories())){reserveFinal(item);return item;}lastError=new Error('OpenAI repeated a prior clue or category.');}catch(error){lastError=error;}throw new Error(`${lastError?.message||'OpenAI could not prepare a clue.'} Please try the Final Jeopardy test again.`);}
function availableBuiltIn(){return [FALLBACK_GAME,EMERGENCY_GAME].find(game=>!gameHasDuplicate(game,clueLedger.entries));}
function takeGame(){if(process.env.NODE_ENV==='test'&&!gameBank.length)return FALLBACK_GAME;if(gameBank.length){const game=gameBank[0];reserveGame(game);gameBank.shift();try{saveBankSync();}catch(error){console.error('The clue ledger was saved, but the game bank could not be updated:',error);gameBank=[];}return game;}const builtIn=availableBuiltIn();if(builtIn){reserveGame(builtIn);return builtIn;}if(process.env.OPENAI_API_KEY)throw new Error('The unique question bank is still being prepared. Please try again shortly.');throw new Error('No unused game is available. Configure OpenAI to generate another board.');}
function sanitizeSavedBank(){const clean=[];for(const game of gameBank){const prior=[...clueLedger.entries,...clean.flatMap(gameClueRecords)];if(validateGame(game)&&!gameHasDuplicate(game,prior)&&!gameHasCategoryRepeat(game,prior.map(x=>x.category)))clean.push(game);}if(clean.length!==gameBank.length){gameBank=clean;saveBankSync();}}
const migratedFingerprints=new Set(clueLedger.entries.map(x=>x.fingerprint));for(const oldClue of history.usedClues||[]){const fingerprint=clueFingerprint(oldClue);if(fingerprint&&!migratedFingerprints.has(fingerprint)){migratedFingerprints.add(fingerprint);clueLedger.entries.push({clue:oldClue,response:'',category:'',fingerprint,factFingerprint:'',reservedAt:'history-migration'});}}
if(!clueLedger.entries.length){clueLedger.entries.push(...gameClueRecords(FALLBACK_GAME).map(x=>({...x,reservedAt:'legacy-first-game-migration'})));}
sanitizeSavedBank();saveLedgerSync();
async function ensureGameBank(target=GAME_BANK_TARGET){if(bankGenerating||!process.env.OPENAI_API_KEY||gameBank.length>=target)return;clearTimeout(bankRetryTimer);bankRetryTimer=null;bankGenerating=true;bankBuildCompleted=0;try{let rejected=0;while(gameBank.length<target){const known=allKnownRecords(),categories=allKnownCategories();let candidate;try{candidate=await generateGame(known,categories,(completed,total)=>{bankBuildCompleted=completed;bankBuildTotal=total;});}catch(error){if(String(error.message||error).includes('failed validation')&&++rejected<8){bankLastError=`Incremental board ${rejected} failed its final check; retrying.`;continue;}throw error;}if(gameHasDuplicate(candidate,known)||gameHasCategoryRepeat(candidate,categories)){if(++rejected>=8)throw new Error('Too many generated games repeated a stored clue or category.');bankLastError=`Rejected repeated board ${rejected}; retrying immediately.`;continue;}rejected=0;gameBank.push(candidate);bankBuildCompleted=0;bankLastError=null;saveBankSync();for(const room of rooms.values())if(room.phase==='lobby'){room.generating=gameBank.length<target;room.bankReady=gameBank.length;room.message=`${gameBank.length} of ${target} games ready.`;emit(room);}}}catch(error){bankLastError=String(error.message||error).slice(0,1000);console.warn('Question bank generation paused:',bankLastError);bankRetryTimer=setTimeout(()=>ensureGameBank(target),60000);bankRetryTimer.unref();}finally{bankGenerating=false;}}
function playerKey(name){return normalize(name);}
function firstName(player){return String(player?.name||'Contestant').trim().split(/\s+/)[0]||'Contestant';}
function validWagerAudio(audio){return typeof audio==='string'&&/^data:audio\/(webm|ogg|mp4|mpeg)(?:;codecs=[^;,]+)?;base64,[A-Za-z0-9+/=]+$/.test(audio)&&audio.length<1800000;}
function code(){let value;do value=Math.random().toString(36).slice(2,7).toUpperCase();while(rooms.has(value));return value;}
function copy(value){return structuredClone(value);}
function getPlayer(room,id){return room.players.find(p=>p.id===id);}
function values(round){return round===0?[200,400,600,800,1000]:[400,800,1200,1600,2000];}
function currentClue(room){return room.game.rounds[room.round].categories[room.selected.category].clues[room.selected.row];}
function dailyDouble(room,c,r){return room.game.rounds[room.round].dailyDoubles.some(([ci,ri])=>ci===c&&ri===r);}
function eligibleFinal(room){return room.players.filter(p=>p.score>0);}

function makeRoom({testMode=false,finalOnly=false,finalClue=null}={}){
  const era=Math.random()<.5?'trebek':'jennings';
  if(finalOnly&&!finalClue)throw new Error('A fresh Final Jeopardy clue is required.');
  const generated=!testMode&&!finalOnly&&gameBank.length>0,game=finalOnly?{...copy(FALLBACK_GAME),final:copy(finalClue)}:testMode?(Math.random()<.5?FALLBACK_GAME:EMERGENCY_GAME):takeGame();
  const room={code:code(),era,logo:Math.floor(Math.random()*4),testMode:testMode||finalOnly,finalOnly,phase:'lobby',displayId:null,players:[],game:copy(game),generated,generating:!testMode&&!finalOnly&&!!process.env.OPENAI_API_KEY&&gameBank.length<GAME_BANK_TARGET,bankReady:gameBank.length,round:0,used:[],selected:null,selectorId:null,canSelect:false,buzzedId:null,canBuzz:false,clueNeedsReading:false,attempted:[],wager:null,wagerAudio:null,lastJudgment:null,answerDeadline:null,advanceAt:null,canFinalWager:false,finalOrder:[],finalRevealIndex:0,finalRevealStep:null,championId:null,message:finalOnly?'Final Jeopardy Test: one fresh clue; results will not be saved.':testMode?'Test Game: old questions; results will not be saved.':'Waiting for contestants',createdAt:Date.now()};
  rooms.set(room.code,room);
  ensureGameBank();
  return room;
}

function introLine(room,p){
  const base=`A ${p.occupation} from ${p.location}, ${p.name}.`;
  const stats=history.players[p.key];
  return stats?.streak>0&&history.lastWinnerKey===p.key?`${base} Whose ${stats.streak}-game win streak has earned them $${stats.earnings.toLocaleString()}.`:base;
}
function championStats(p){const stats=history.players[p.key];return stats?.streak>0&&history.lastWinnerKey===p.key?{streak:stats.streak,earnings:stats.earnings}:null;}
function introText(room){const players=room.players.map(p=>introLine(room,p)).join(' ');const host=room.era==='trebek'?'And now, here is the host of Jeopardy, Alex Trebek!':'And now, here is the host of Jeopardy, Ken Jennings!';return `This is Jeopardy! Here are today's contestants. ${players} ${host}`;}
function safeGame(room){return {rounds:room.game.rounds.map((round,ri)=>({title:round.title,categories:round.categories.map((cat,ci)=>({name:cat.name,clues:cat.clues.map((q,ri2)=>{const selected=room.selected?.category===ci&&room.selected?.row===ri2&&room.round===ri;return {clue:selected?q.clue:null,response:selected&&['review','daily_review'].includes(room.phase)&&room.lastJudgment?.revealCorrect?q.response:null};})}))})),final:{category:room.game.final.category,clue:['final_clue','final_answer','final_judging','final_reveal','final_correct_answer','final_results'].includes(room.phase)?room.game.final.clue:null,response:['final_correct_answer','final_results'].includes(room.phase)?room.game.final.response:null}};}
function publicRoom(room){const activeId=room.finalOrder[room.finalRevealIndex],showAnswer=room.phase==='final_results'||room.phase==='final_reveal'&&room.finalRevealStep!=='ask_response',showWager=room.phase==='final_results'||room.phase==='final_reveal'&&room.finalRevealStep==='show_wager';return {...room,game:safeGame(room),introText:introText(room),players:room.players.map(({finalAnswer,finalWager,reconnectToken,...p})=>({...p,championStats:championStats(p),hasFinalWager:finalWager!==null,hasFinalAnswer:finalAnswer!==null,finalWager:showWager&&(room.phase==='final_results'||p.id===activeId)?finalWager:null,finalAnswer:showAnswer&&(room.phase==='final_results'||p.id===activeId)?finalAnswer:null})),activeFinalId:activeId,generating:room.generating};}
function emit(room){io.to(room.code).emit('state',publicRoom(room));}
function isDisplay(socket,room){return socket.id===room.displayId&&socket.data.display;}
function selectedValue(room){return values(room.round)[room.selected.row];}
function allUsed(room){return room.used.filter(x=>x.round===room.round).length>=30;}
function remainingClues(room){const round=room.game.rounds[room.round],left=[];for(let category=0;category<round.categories.length;category++)for(let row=0;row<round.categories[category].clues.length;row++)if(!room.used.some(x=>x.round===room.round&&x.category===category&&x.row===row))left.push({category,row});return left;}
function clearRoomTimer(room){const timer=roomTimers.get(room.code);if(timer)clearTimeout(timer);roomTimers.delete(room.code);room.advanceAt=null;}
function schedule(room,delay,action){clearRoomTimer(room);room.advanceAt=Date.now()+delay;roomTimers.set(room.code,setTimeout(()=>{roomTimers.delete(room.code);room.advanceAt=null;action();},delay));}
function phraseCorrect(answer){return /^(what|who|where|when|why|how)\s+(is|are|was|were)\b/i.test(String(answer||'').trim());}
function openBuzzing(room,message='Buzz in now!'){room.phase='clue';room.canBuzz=true;room.clueNeedsReading=false;room.answerDeadline=null;room.message=message;emit(room);schedule(room,7000,()=>{if(room.phase!=='clue'||!room.canBuzz)return;room.canBuzz=false;room.lastJudgment={playerId:null,answer:'No response',correct:false,amount:0,revealCorrect:true,timedOut:false};room.phase='review';room.message='No contestant responded.';emit(room);scheduleReview(room);});}
function advanceReview(room){if(!['review','daily_review'].includes(room.phase))return;if(room.phase==='review'&&room.lastJudgment?.playerId&&!room.lastJudgment.correct){room.attempted.push(room.lastJudgment.playerId);room.buzzedId=null;if(room.attempted.length<room.players.length){openBuzzing(room,'Other contestants may buzz in.');return;}}finishClue(room);}
function scheduleReview(room){schedule(room,45000,()=>advanceReview(room));}
function expireAnswer(room,id,daily=false){if(!['answer','daily_answer'].includes(room.phase)||id!==(daily?room.selectorId:room.buzzedId))return;const p=getPlayer(room,id),amount=daily?room.wager:selectedValue(room);p.score-=amount;room.answerDeadline=null;room.lastJudgment={playerId:id,answer:'No response',correct:false,amount,revealCorrect:daily||room.attempted.length+1>=room.players.length,timedOut:true};room.phase=daily?'daily_review':'review';room.message='Time is up.';emit(room);scheduleReview(room);}
function startCategories(room){room.phase='categories';room.canSelect=false;room.message=room.round===0?'Here are the categories for the Jeopardy round.':'Here are the categories for Double Jeopardy.';emit(room);}
function selectBoardClue(room,category,row,automatic=false){room.canSelect=false;room.selected={category,row};room.used.push({round:room.round,category,row});room.buzzedId=null;room.attempted=[];room.canBuzz=false;room.lastJudgment=null;room.automaticFinalClue=automatic;room.phase='selection';room.message=automatic?'The final clue is being selected automatically.':'The selected clue is highlighted.';emit(room);}
function requestSelection(room){const left=remainingClues(room);if(left.length===1){selectBoardClue(room,left[0].category,left[0].row,true);schedule(room,6000,()=>beginSelectedClue(room));return;}room.automaticFinalClue=false;room.phase='board';room.canSelect=false;room.message='The host is asking for a selection.';emit(room);}
function beginSelectedClue(room){if(room.phase!=='selection'||!room.selected)return;room.automaticFinalClue=false;if(dailyDouble(room,room.selected.category,room.selected.row)){room.phase='daily_wager';room.message='Daily Double! Make your wager on your phone.';}else{room.phase='clue';room.clueNeedsReading=true;room.message='Listen to the clue.';}emit(room);if(room.phase==='clue')schedule(room,CLUE_READ_FAILSAFE_MS,()=>{if(room.phase==='clue'&&room.clueNeedsReading)openBuzzing(room,'Buzz in now! The narration completion signal was missed.');});}
function advanceRound(room){if(room.phase!=='round_break')return;if(room.round===0){room.round=1;room.selectorId=[...room.players].sort((a,b)=>a.score-b.score)[0].id;startCategories(room);}else{beginFinal(room);emit(room);}}

app.get('/api/room/:code/qr',async(req,res)=>{const room=rooms.get(req.params.code.toUpperCase());if(!room)return res.sendStatus(404);res.type('png').send(await QRCode.toBuffer(`${req.protocol}://${req.get('host')}/join/${room.code}`,{width:500,margin:1}));});
app.get('/api/history',(req,res)=>res.json({games:history.games.slice(-10).reverse(),champion:history.lastWinnerKey?history.players[history.lastWinnerKey]:null}));
app.get('/api/game-bank',(_req,res)=>res.json({ready:gameBank.length,target:GAME_BANK_TARGET,generating:bankGenerating,buildCompleted:bankBuildCompleted,buildTotal:bankBuildTotal,configured:!!process.env.OPENAI_API_KEY,playableNow:gameBank.length>0||!!availableBuiltIn(),reservedClues:clueLedger.entries.length,deduplication:'persistent-volume-ledger',lastError:bankLastError}));
app.get('/api/judging-diagnostics',async(_req,res)=>{
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'OpenAI judging is not configured.'});
  if(judgingDiagnosticCache&&Date.now()-judgingDiagnosticCache.checkedAt<10*60*1000)return res.json(judgingDiagnosticCache);
  try{
    judgingDiagnosticPromise??=Promise.all(JUDGING_DIAGNOSTICS.map(async test=>{const actual=await judge(test.given,test.item);return {label:test.label,expected:test.expected,actual,passed:actual===test.expected};})).then(results=>judgingDiagnosticCache={checkedAt:Date.now(),passed:results.filter(result=>result.passed).length,total:results.length,allPassed:results.every(result=>result.passed),results}).finally(()=>judgingDiagnosticPromise=null);
    res.json(await judgingDiagnosticPromise);
  }catch(error){res.status(502).json({error:error.message||'The judging diagnostic could not be completed.'});}
});
app.post('/api/speak',async(req,res)=>{
  const text=String(req.body?.text||'').trim().slice(0,600),role=String(req.body?.role||'host');
  if(!text)return res.status(400).json({error:'Text is required.'});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'OpenAI speech is not configured.'});
  const voice={announcer:'onyx',trebek:'cedar',jennings:'marin'}[role]||'marin';
  const key=`${voice}:${text}`,cached=speechCache.get(key);if(cached){res.type('audio/mpeg');return res.send(cached);}
  try{
    const instructions=role==='announcer'?'Speak as an energetic, polished television game-show announcer.':role==='trebek'?'Speak as a measured, warm, authoritative classic television quiz-show host. Read clearly, with restrained wit and unhurried pacing.':'Speak as a bright, conversational modern television quiz-show host. Read clearly, with crisp pacing and friendly energy.';
    const response=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_TTS_MODEL||'gpt-4o-mini-tts',voice,input:text,instructions,response_format:'mp3'})});
    if(!response.ok)throw new Error(`OpenAI speech ${response.status}`);const audio=Buffer.from(await response.arrayBuffer());speechCache.set(key,audio);if(speechCache.size>120)speechCache.delete(speechCache.keys().next().value);res.type('audio/mpeg').send(audio);
  }catch(error){console.warn(error.message);res.status(502).json({error:'Speech is temporarily unavailable.'});}
});

io.on('connection',socket=>{
  socket.on('createRoom',async({testMode=false,finalOnly=false}={},reply)=>{try{const finalClue=finalOnly===true?await takeFreshFinal():null,room=makeRoom({testMode:testMode===true,finalOnly:finalOnly===true,finalClue});room.displayId=socket.id;socket.data={roomCode:room.code,display:true};socket.join(room.code);reply?.({ok:true,code:room.code});emit(room);}catch(error){ensureGameBank();reply?.({ok:false,error:error.message||'A question bank is still being prepared.'});}});
  socket.on('watchRoom',({code:raw},reply)=>{const room=rooms.get(String(raw).toUpperCase());if(!room)return reply?.({ok:false,error:'Game not found.'});room.displayId=socket.id;socket.data={roomCode:room.code,display:true};socket.join(room.code);reply?.({ok:true,room:publicRoom(room)});emit(room);});
  socket.on('joinRoom',({code:raw,name,occupation,location,signature,photo},reply)=>{
    const room=rooms.get(String(raw).toUpperCase());if(!room||room.phase!=='lobby')return reply?.({ok:false,error:'That lobby is unavailable.'});
    if(room.players.length>=3)return reply?.({ok:false,error:'This game already has three contestants.'});
    name=String(name||'').trim().slice(0,28);occupation=String(occupation||'').trim().slice(0,50);location=String(location||'').trim().slice(0,50);
    const drawn=typeof signature==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature)&&signature.length<700000;
    const validPhoto=typeof photo==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)&&photo.length<1200000;
    if(!name||!occupation||!location||!drawn||!validPhoto)return reply?.({ok:false,error:'Name, occupation, location, photo, and handwritten signature are required.'});
    const p={id:socket.id,reconnectToken:crypto.randomUUID(),key:playerKey(name),name,occupation,location,signature,photo,score:0,connected:true,finalWager:null,finalAnswer:null,finalCorrect:null,preFinalScore:null};
    room.players.push(p);socket.data={roomCode:room.code,display:false};socket.join(room.code);reply?.({ok:true,playerId:p.id,reconnectToken:p.reconnectToken});emit(room);
  });
  socket.on('rejoin',({code:raw,playerId,reconnectToken},reply)=>{const room=rooms.get(String(raw).toUpperCase()),p=room&&(reconnectToken?room.players.find(player=>player.reconnectToken===reconnectToken):getPlayer(room,playerId));if(!p)return reply?.({ok:false,error:'Your saved contestant session could not be found.'});p.reconnectToken||=crypto.randomUUID();const old=p.id;p.id=socket.id;p.connected=true;if(room.selectorId===old)room.selectorId=p.id;if(room.buzzedId===old)room.buzzedId=p.id;room.attempted=room.attempted.map(id=>id===old?p.id:id);room.finalOrder=room.finalOrder.map(id=>id===old?p.id:id);if(room.championId===old)room.championId=p.id;socket.data={roomCode:room.code,display:false};socket.join(room.code);reply?.({ok:true,playerId:p.id,reconnectToken:p.reconnectToken});emit(room);});
  socket.on('startGame',({code:raw},reply)=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!getPlayer(room,socket.id)||room.phase!=='lobby')return reply?.({ok:false});if(!room.players.length)return reply?.({ok:false,error:'At least one contestant must join.'});room.selectorId=room.players[0].id;if(room.finalOnly){const totals=[12400,15600,9800];room.players.forEach((p,i)=>p.score=totals[i]||10000);beginFinal(room);}else{room.phase='intro';room.message='Introducing today’s contestants';}reply?.({ok:true});emit(room);});
  socket.on('introFinished',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||room.phase!=='intro')return;startCategories(room);});
  socket.on('categoriesRead',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||room.phase!=='categories')return;requestSelection(room);});
  socket.on('selectionPromptRead',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||room.phase!=='board')return;room.canSelect=true;room.message='Make a selection on the contestant phone.';emit(room);});
  socket.on('finalBoardCluePromptRead',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||room.phase!=='selection'||!room.automaticFinalClue)return;clearRoomTimer(room);beginSelectedClue(room);});
  socket.on('selectClue',({code:raw,category,row})=>{
    const room=rooms.get(String(raw).toUpperCase());category=Number(category);row=Number(row);
    if(!room||socket.id!==room.selectorId||!room.canSelect||!getPlayer(room,socket.id)||room.phase!=='board'||room.used.some(x=>x.round===room.round&&x.category===category&&x.row===row)||!room.game.rounds[room.round]?.categories[category]?.clues[row])return;
    selectBoardClue(room,category,row);schedule(room,process.env.NODE_ENV==='test'?20:2200,()=>beginSelectedClue(room));
  });
  socket.on('submitWager',({code:raw,wager,audio},reply)=>{const room=rooms.get(String(raw).toUpperCase()),p=room&&getPlayer(room,socket.id);const max=room&&p?Math.max(values(room.round).at(-1),p.score):0;wager=String(wager||'').trim().toLowerCase()==='true daily double'?Math.max(5,p?.score||0):Math.floor(Number(wager));if(!room||room.phase!=='daily_wager'||socket.id!==room.selectorId)return reply?.({ok:false});if(!Number.isFinite(wager)||wager<5||wager>max)return reply?.({ok:false,error:`Wager between $5 and $${max.toLocaleString()}.`});room.wager=wager;room.wagerAudio=validWagerAudio(audio)?audio:null;room.phase='daily_clue';room.message=`A $${wager.toLocaleString()} Daily Double wager.`;reply?.({ok:true});emit(room);});
  socket.on('clueRead',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room))return;if(room.phase==='clue')openBuzzing(room);else if(room.phase==='daily_clue'){room.phase='daily_answer';room.answerDeadline=Date.now()+DAILY_ANSWER_TIME_MS;room.message='Respond now. You have 15 seconds.';emit(room);schedule(room,DAILY_ANSWER_TIME_MS,()=>expireAnswer(room,room.selectorId,true));}else if(room.phase==='final_clue'){room.phase='final_answer';room.answerDeadline=Date.now()+30000;room.message='Contestants, you have 30 seconds. Good luck!';emit(room);schedule(room,30000,()=>prepareFinalReveal(room));}});
  socket.on('buzz',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||room.phase!=='clue'||!room.canBuzz||room.buzzedId||room.attempted.includes(socket.id)||!getPlayer(room,socket.id))return;clearRoomTimer(room);room.buzzedId=socket.id;room.canBuzz=false;room.phase='answer';room.answerDeadline=Date.now()+ANSWER_TIME_MS;room.message='A contestant has buzzed in. 15 seconds.';emit(room);schedule(room,ANSWER_TIME_MS,()=>expireAnswer(room,socket.id,false));});
  socket.on('submitAnswer',async({code:raw,answer},reply)=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!['answer','daily_answer'].includes(room.phase))return reply?.({ok:false});const daily=room.phase==='daily_answer',id=daily?room.selectorId:room.buzzedId;if(socket.id!==id)return reply?.({ok:false});answer=String(answer||'').trim().slice(0,100);if(!phraseCorrect(answer))return reply?.({ok:false,error:'Respond in the form of a question, such as “What is Toronto?”'});clearRoomTimer(room);room.answerDeadline=null;room.phase='judging';room.message='Judging the response…';emit(room);const correct=await judge(answer,currentClue(room));const p=getPlayer(room,id),amount=daily?room.wager:selectedValue(room);p.score+=correct?amount:-amount;room.lastJudgment={playerId:id,answer,correct,amount,revealCorrect:!correct&&(daily||room.attempted.length+1>=room.players.length),timedOut:false};room.selectorId=correct?id:room.selectorId;room.phase=daily?'daily_review':'review';room.message=correct?'Correct!':'Sorry, that is incorrect.';reply?.({ok:true});emit(room);scheduleReview(room);});
  socket.on('reviewNarrated',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||!['review','daily_review'].includes(room.phase))return;clearRoomTimer(room);advanceReview(room);});
  socket.on('finalWagerPromptRead',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||room.phase!=='final_wager')return;room.canFinalWager=true;room.message='Make your Final Jeopardy wagers.';emit(room);});
  socket.on('finalWager',({code:raw,wager},reply)=>{const room=rooms.get(String(raw).toUpperCase()),p=room&&getPlayer(room,socket.id);wager=Math.floor(Number(wager));if(!room||room.phase!=='final_wager'||!room.canFinalWager||!p||p.score<=0||p.finalWager!==null)return reply?.({ok:false});if(!Number.isFinite(wager)||wager<0||wager>p.score)return reply?.({ok:false,error:`Wager between $0 and $${p.score.toLocaleString()}.`});p.finalWager=wager;reply?.({ok:true});if(eligibleFinal(room).every(x=>x.finalWager!==null)){room.canFinalWager=false;room.phase='final_clue';room.message=room.game.final.category;}emit(room);});
  socket.on('finalAnswer',({code:raw,answer},reply)=>{const room=rooms.get(String(raw).toUpperCase()),p=room&&getPlayer(room,socket.id);if(!room||room.phase!=='final_answer'||!p||p.score<=0||p.finalAnswer!==null)return reply?.({ok:false});answer=String(answer||'').trim().slice(0,160);if(!answer)return reply?.({ok:false,error:'Enter a response before locking it in.'});p.finalAnswer=answer;reply?.({ok:true});emit(room);});
  socket.on('finalRevealNext',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||room.phase!=='final_reveal')return;advanceFinalReveal(room);});
  socket.on('finalCorrectNarrated',({code:raw})=>{const room=rooms.get(String(raw).toUpperCase());if(!room||!isDisplay(socket,room)||room.phase!=='final_correct_answer')return;finishGame(room);});
  socket.on('disconnect',()=>{const room=rooms.get(socket.data.roomCode),p=room&&getPlayer(room,socket.id);if(p){p.connected=false;emit(room);}});
});

function finishClue(room){clearRoomTimer(room);room.selected=null;room.wager=null;room.wagerAudio=null;room.buzzedId=null;room.canBuzz=false;room.clueNeedsReading=false;room.answerDeadline=null;if(allUsed(room)){room.phase='round_break';room.message=room.round===0?'The Jeopardy round is complete.':'Double Jeopardy is complete.';emit(room);schedule(room,4500,()=>advanceRound(room));}else requestSelection(room);}
function beginFinal(room){const eligible=eligibleFinal(room);if(!eligible.length){room.players.sort((a,b)=>b.score-a.score)[0].score=1;}room.players.forEach(p=>{p.preFinalScore=p.score;p.finalWager=null;p.finalAnswer=null;p.finalCorrect=null;});room.canFinalWager=false;room.phase='final_wager';room.message=`Final Jeopardy category: ${room.game.final.category}. Listen to the host.`;}
async function prepareFinalReveal(room){if(!['final_answer','final_clue'].includes(room.phase))return;clearRoomTimer(room);room.answerDeadline=null;room.phase='final_judging';room.message='The responses are locked.';emit(room);const finalists=eligibleFinal(room);for(const contestant of finalists){contestant.finalAnswer=String(contestant.finalAnswer||'').trim();contestant.finalCorrect=!!contestant.finalAnswer&&await judge(contestant.finalAnswer,room.game.final);}room.finalOrder=[...finalists].sort((a,b)=>a.preFinalScore-b.preFinalScore).map(p=>p.id);room.finalRevealIndex=0;room.finalRevealStep='ask_response';room.phase='final_reveal';room.message='Final Jeopardy responses';emit(room);}
function completeFinalReveal(room){if(!room.finalOrder.some(id=>getPlayer(room,id)?.finalCorrect)){room.phase='final_correct_answer';room.message='The host is revealing the correct response.';emit(room);return;}return finishGame(room);}
function advanceFinalReveal(room){const p=getPlayer(room,room.finalOrder[room.finalRevealIndex]);if(!p)return completeFinalReveal(room);if(room.finalRevealStep==='ask_response')room.finalRevealStep='show_response';else if(room.finalRevealStep==='show_response')room.finalRevealStep='ask_wager';else if(room.finalRevealStep==='ask_wager'){room.finalRevealStep='show_wager';p.score+=p.finalCorrect?p.finalWager:-p.finalWager;}else if(room.finalRevealStep==='show_wager'){room.finalRevealIndex++;if(room.finalRevealIndex>=room.finalOrder.length)return completeFinalReveal(room);room.finalRevealStep='ask_response';}emit(room);}
async function finishGame(room){room.phase='final_results';const winner=[...room.players].sort((a,b)=>b.score-a.score)[0];room.championId=winner.id;if(room.testMode){room.message=`${firstName(winner)}, you are our test-game champion! No results were saved.`;emit(room);return;}const key=winner.key,prior=history.players[key]||{name:winner.name,wins:0,streak:0,earnings:0};const continuing=history.lastWinnerKey===key;prior.name=winner.name;prior.wins++;prior.streak=continuing?prior.streak+1:1;prior.earnings=(continuing?prior.earnings:0)+Math.max(0,winner.score);history.players[key]=prior;if(history.lastWinnerKey&&history.lastWinnerKey!==key&&history.players[history.lastWinnerKey])history.players[history.lastWinnerKey].streak=0;history.lastWinnerKey=key;history.games.push({playedAt:new Date().toISOString(),winner:winner.name,score:winner.score,era:room.era});history.games=history.games.slice(-100);history.usedClues.push(...room.game.rounds.flatMap(r=>r.categories.flatMap(c=>c.clues.map(q=>q.clue))),room.game.final.clue);history.usedClues=history.usedClues.slice(-500);await saveHistory().catch(console.error);room.message=`${firstName(winner)}, you are our new Jeopardy champion!`;emit(room);}

function dispose(room){clearRoomTimer(room);rooms.delete(room.code);}
setInterval(()=>{for(const room of rooms.values())if(Date.now()-room.createdAt>8*60*60*1000)dispose(room);},30*60*1000).unref();
if(require.main===module)server.listen(process.env.PORT||3000,()=>{console.log(`Jeopardy listening on ${process.env.PORT||3000}`);ensureGameBank();});
module.exports={app,server,io,rooms,ANSWER_TIME_MS,DAILY_ANSWER_TIME_MS,CLUE_READ_FAILSAFE_MS,GAME_BANK_TARGET,GAME_BANK_VERSION,JUDGING_DIAGNOSTICS,makeRoom,publicRoom,introLine,firstName,validWagerAudio,values,dailyDouble,remainingClues,finishClue,finishGame,phraseCorrect,beginSelectedClue,advanceReview,expireAnswer,prepareFinalReveal,advanceFinalReveal,finalRecord,reserveFinal,dispose};
