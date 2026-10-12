'use strict';

const fs = require('node:fs');
const path = require('node:path');

const gamePath = path.join(__dirname, 'game.js');
let gameSource = fs.readFileSync(gamePath, 'utf8');

const oldCategoryValidation = `function categoryValidAgainst(category,priorRecords=[],priorCategories=[]){
  if(!category?.name||category.clues?.length!==5||gameHasCategoryRepeat({rounds:[{categories:[category]}]},priorCategories)||priorCategories.some(name=>categoriesOverlap(name,category.name)))return false;
  if(!category.clues.every(item=>clueLengthValid(item.clue)&&item.response&&clueDoesNotRevealResponse(item))||!categoryRuleValid(category))return false;
  return !gameHasDuplicate({rounds:[{categories:[category]}]},priorRecords);
}`;

const newCategoryValidation = `function categoryValidAgainst(category,priorRecords=[],priorCategories=[]){
  if(!category?.name||category.clues?.length!==5)return false;
  if(gameHasCategoryRepeat({rounds:[{categories:[category]}]},priorCategories))return false;
  const recentCategories=priorCategories.slice(-18);
  if(recentCategories.some(name=>categoriesOverlap(name,category.name)))return false;
  if(!category.clues.every(item=>clueLengthValid(item.clue)&&item.response&&clueDoesNotRevealResponse(item))||!categoryRuleValid(category))return false;
  return !gameHasDuplicate({rounds:[{categories:[category]}]},priorRecords);
}`;
const oldAttemptLoop = 'for(let attempt=1;attempt<=8;attempt++)try{';
const newAttemptLoop = 'for(let attempt=1;attempt<=4;attempt++)try{';
if (gameSource.includes(oldCategoryValidation)) gameSource = gameSource.replace(oldCategoryValidation, newCategoryValidation);
else if (!gameSource.includes(newCategoryValidation)) throw new Error('Jeopardy generation patch failed: category validation block changed.');
if (gameSource.includes(oldAttemptLoop)) gameSource = gameSource.replace(oldAttemptLoop, newAttemptLoop);
else if (!gameSource.includes(newAttemptLoop)) throw new Error('Jeopardy generation patch failed: category retry loop changed.');
fs.writeFileSync(gamePath, gameSource, 'utf8');
console.log('[generation-fix] exact category/clue uniqueness preserved; semantic category overlap limited to recent history; category attempts capped at 4');

const serverPath = path.join(__dirname, '..', 'server.js');
let serverSource = fs.readFileSync(serverPath, 'utf8');
const oldChampionHelpers = `function introLine(room,p){
  const base=\`A \${p.occupation} from \${p.location}, \${p.name}.\`;
  const stats=history.players[p.key];
  return stats?.streak>0&&history.lastWinnerKey===p.key?\`\${base} Whose \${stats.streak}-game win streak has earned them $\${stats.earnings.toLocaleString()}.\`:base;
}
function championStats(p){const stats=history.players[p.key];return stats?.streak>0&&history.lastWinnerKey===p.key?{streak:stats.streak,earnings:stats.earnings}:null;}
function orderPlayersForIntro(players,championKey=history.lastWinnerKey){return [...players.filter(player=>player.key!==championKey),...players.filter(player=>player.key===championKey)];}
function openingSelectorId(players,championKey=history.lastWinnerKey){return players.find(player=>player.key===championKey)?.id||players[0]?.id||null;}`;
const newChampionHelpers = `function introLine(room,p){
  const base=\`A \${p.occupation} from \${p.location}, \${p.name}.\`;
  const stats=history.players[p.key];
  return stats?.streak>0?\`Our current champion, \${base} Their \${stats.streak}-game win streak has earned them $\${stats.earnings.toLocaleString()}.\`:base;
}
function championStats(p){const stats=history.players[p.key];return stats?.streak>0?{streak:stats.streak,earnings:stats.earnings}:null;}
function orderPlayersForIntro(players){return [...players].sort((a,b)=>Number(!!championStats(a))-Number(!!championStats(b)));}
function openingSelectorId(players){const champions=players.filter(player=>championStats(player)).sort((a,b)=>(championStats(b)?.streak||0)-(championStats(a)?.streak||0));return champions[0]?.id||players[0]?.id||null;}`;
const oldWinnerUpdate = `const key=winner.key,prior=history.players[key]||{name:winner.name,wins:0,streak:0,earnings:0};const continuing=history.lastWinnerKey===key;prior.name=winner.name;prior.wins++;prior.streak=continuing?prior.streak+1:1;prior.earnings=(continuing?prior.earnings:0)+Math.max(0,winner.score);history.players[key]=prior;if(history.lastWinnerKey&&history.lastWinnerKey!==key&&history.players[history.lastWinnerKey])history.players[history.lastWinnerKey].streak=0;history.lastWinnerKey=key;`;
const newWinnerUpdate = `const key=winner.key,prior=history.players[key]||{name:winner.name,wins:0,streak:0,earnings:0};const continuing=prior.streak>0;room.championExtended=continuing;prior.name=winner.name;prior.wins++;prior.streak=continuing?prior.streak+1:1;prior.earnings=(continuing?prior.earnings:0)+Math.max(0,winner.score);history.players[key]=prior;room.championStreak=prior.streak;room.championEarnings=prior.earnings;for(const player of room.players){if(player.key===key)continue;const losingStats=history.players[player.key];if(losingStats?.streak>0)losingStats.streak=0;}history.lastWinnerKey=key;`;
const oldWinnerMessage = `room.message=\`\${firstName(winner)}, you are our new Jeopardy champion!\`;emit(room);`;
const newWinnerMessage = `room.message=room.championExtended?\`\${firstName(winner)} has extended their winning streak to \${room.championStreak} games!\`:\`\${firstName(winner)}, you are our new Jeopardy champion!\`;emit(room);`;
for (const [oldNeedle, newNeedle, label] of [[oldChampionHelpers,newChampionHelpers,'champion intro helpers'],[oldWinnerUpdate,newWinnerUpdate,'champion history update'],[oldWinnerMessage,newWinnerMessage,'champion result message']]) {
  if (serverSource.includes(oldNeedle)) serverSource = serverSource.replace(oldNeedle, newNeedle);
  else if (!serverSource.includes(newNeedle)) throw new Error(`Jeopardy champion patch failed: ${label} changed.`);
}
fs.writeFileSync(serverPath, serverSource, 'utf8');

const clientPath = path.join(__dirname, '..', 'public', 'app.js');
let clientSource = fs.readFileSync(clientPath, 'utf8');
const oldIntroSentence = `function introSentence(p){return \`A \${p.occupation} from \${p.location}, \${p.name}.\`;}`;
const newIntroSentence = `function introSentence(p){return p.championStats?\`Our current champion, a \${p.occupation} from \${p.location}, \${p.name}.\`:\`A \${p.occupation} from \${p.location}, \${p.name}.\`;}`;
const oldChampionBanner = `<div class=\"champion-banner\">\${signature(winner)}<span>JEOPARDY! CHAMPION</span></div>`;
const newChampionBanner = `<div class=\"champion-banner\">\${signature(winner)}<span>\${state.championExtended?(state.championStreak+'-GAME WIN STREAK'):'JEOPARDY! CHAMPION'}</span></div>`;
const oldCelebrate = `async function celebrateChampionOnce(winner){const key=\`\${state.code}:champion\`;if(lastSpokenKey===key)return;lastSpokenKey=key;playApplause();await speak(state.testMode?\`\${firstName(winner)}, you are our test-game champion! No results will be saved.\`:\`\${firstName(winner)}, you are our new Jeopardy champion!\`,state.era);playApplause();}`;
const newCelebrate = `async function celebrateChampionOnce(winner){const key=\`\${state.code}:champion\`;if(lastSpokenKey===key)return;lastSpokenKey=key;playApplause();const line=state.testMode?\`\${firstName(winner)}, you are our test-game champion! No results will be saved.\`:state.championExtended?\`\${firstName(winner)}, you've extended your winning streak to \${state.championStreak} games!\`:\`\${firstName(winner)}, you are our new Jeopardy champion!\`;await speak(line,state.era);playApplause();}`;
for (const [oldNeedle,newNeedle,label] of [[oldIntroSentence,newIntroSentence,'client champion introduction'],[oldChampionBanner,newChampionBanner,'champion banner'],[oldCelebrate,newCelebrate,'champion narration']]) {
  if (clientSource.includes(oldNeedle)) clientSource = clientSource.replace(oldNeedle, newNeedle);
  else if (!clientSource.includes(newNeedle)) throw new Error(`Jeopardy champion client patch failed: ${label} changed.`);
}
fs.writeFileSync(clientPath, clientSource, 'utf8');
console.log('[champion-fix] champion streaks persist across absences; returning champions announced; extended streak displayed on wins');

require('./runtime-fixes');
const gameServer = require('../server');
const port = process.env.PORT || 3000;
const intervalMs = Math.max(60_000, Number.parseInt(process.env.GAME_BANK_REFILL_INTERVAL_MS || String(5 * 60 * 1000), 10) || 5 * 60 * 1000);
function triggerBankRefill() {
  if (process.env.GAME_BANK_AUTO_FILL !== 'true' || !process.env.OPENAI_API_KEY) return;
  try { const room = gameServer.makeRoom({ testMode: true }); gameServer.dispose(room); }
  catch (error) { console.warn('[game-bank] refill trigger skipped:', error.message || error); }
}
gameServer.server.listen(port, async () => {
  console.log(`Jeopardy listening on ${port}`);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/game-bank`);
    const bank = await response.json();
    console.log('[game-bank-status]', JSON.stringify(bank));
  } catch (error) {
    console.warn('[game-bank-status] unavailable:', error.message || error);
  }
  triggerBankRefill();
});
setInterval(triggerBankRefill, intervalMs).unref();
