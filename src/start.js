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
  // Regenerate only when the category itself is unusable. Clue-level problems
  // are deliberately deferred to generatedGameIssues()/repairGeneratedGame(),
  // which can replace just the bad clue instead of throwing away five good ones.
  if(gameHasCategoryRepeat({rounds:[{categories:[category]}]},priorCategories))return false;
  const recentCategories=priorCategories.slice(-18);
  if(recentCategories.some(name=>categoriesOverlap(name,category.name)))return false;
  if(!category.clues.every(item=>clueLengthValid(item.clue)&&item.response))return false;
  return true;
}`;
const oldAttemptLoop = 'for(let attempt=1;attempt<=8;attempt++)try{';
const newAttemptLoop = 'for(let attempt=1;attempt<=2;attempt++)try{';
if (gameSource.includes(oldCategoryValidation)) gameSource = gameSource.replace(oldCategoryValidation, newCategoryValidation);
else if (!gameSource.includes(newCategoryValidation)) throw new Error('Jeopardy generation patch failed: category validation block changed.');
if (gameSource.includes(oldAttemptLoop)) gameSource = gameSource.replace(oldAttemptLoop, newAttemptLoop);
else if (!gameSource.includes(newAttemptLoop)) throw new Error('Jeopardy generation patch failed: category retry loop changed.');

// Broaden the generator's subject space. Real Jeopardy revisits broad domains
// constantly; freshness should apply to the actual clue/fact/response, not to
// entire subjects such as history, science, literature, geography, or film.
const oldCategoryPrompt = 'Do not reuse or substantially overlap the subject or theme of a supplied category, clue, or fact.';
const newCategoryPrompt = 'Broad subject areas may and should recur across games. History, geography, literature, science, nature, language, arts, music, film and TV, sports, food, mythology, religion, technology, everyday life, architecture, transportation, famous people, and wordplay are all reusable domains. Keep the specific category title, clue wording, fact tested, and canonical response fresh; avoid exact or near-duplicate clues and obvious repeats, but do not avoid a broad topic merely because an earlier category used the same field.';
if (gameSource.includes(oldCategoryPrompt)) gameSource = gameSource.replace(oldCategoryPrompt, newCategoryPrompt);
else if (!gameSource.includes(newCategoryPrompt)) throw new Error('Jeopardy generation patch failed: category prompt changed.');

const oldCategoryInput = 'avoidCategories:priorCategories.slice(-500),avoidClues:priorRecords.slice(-700)';
const newCategoryInput = 'avoidCategories:priorCategories.slice(-60),avoidClues:priorRecords.slice(-350)';
if (gameSource.includes(oldCategoryInput)) gameSource = gameSource.replace(oldCategoryInput, newCategoryInput);
else if (!gameSource.includes(newCategoryInput)) throw new Error('Jeopardy generation patch failed: category avoid-list changed.');

const oldRepairPrompt = 'Do not reuse or substantially overlap the subject or theme of any supplied category title, and never reuse a supplied clue.';
const newRepairPrompt = 'Broad subject areas may recur. Choose a fresh category title and fresh clues/facts/responses, but do not reject a useful history, science, geography, literature, arts, entertainment, sports, food, language, nature, or other broad domain merely because that domain appeared before. Never reuse a supplied clue or an obvious near-duplicate.';
if (gameSource.includes(oldRepairPrompt)) gameSource = gameSource.replace(oldRepairPrompt, newRepairPrompt);
else if (!gameSource.includes(newRepairPrompt)) throw new Error('Jeopardy generation patch failed: category repair prompt changed.');

const oldFinalPrompt = 'Avoid current events, politics, advertising, wordplay, prior facts, and supplied prior categories.';
const newFinalPrompt = 'Avoid current events, politics, advertising, and wordplay. Never repeat a prior clue or tested fact, but broad Final Jeopardy subject areas may recur; a category such as history, literature, science, geography, arts, or famous people is acceptable even when that broad domain appeared before.';
if (gameSource.includes(oldFinalPrompt)) gameSource = gameSource.replace(oldFinalPrompt, newFinalPrompt);
else if (!gameSource.includes(newFinalPrompt)) throw new Error('Jeopardy generation patch failed: Final Jeopardy prompt changed.');

const oldFinalInputLabel = 'Never reuse these category titles:';
const newFinalInputLabel = 'Avoid exact reuse of these recent category titles; related broad subjects are allowed:';
if (gameSource.includes(oldFinalInputLabel)) gameSource = gameSource.replace(oldFinalInputLabel, newFinalInputLabel);
else if (!gameSource.includes(newFinalInputLabel)) throw new Error('Jeopardy generation patch failed: Final category guidance changed.');

// Never discard a fully generated board just because targeted repair fails.
// Attach the candidate board to the thrown error so server.js can persist it
// in the durable repair queue and resume from those already-paid-for clues.
const oldRepairLine = `  if(issues.length)game=await repairGeneratedGame(game,avoid,avoidCategories);`;
const newRepairLine = `  if(issues.length)try{game=await repairGeneratedGame(game,avoid,avoidCategories);}catch(error){error.salvageGame=game;throw error;}`;
if (gameSource.includes(oldRepairLine)) gameSource = gameSource.replace(oldRepairLine, newRepairLine);
else if (!gameSource.includes(newRepairLine)) throw new Error('Jeopardy salvage patch failed: repair line changed.');
const oldFinalAssembly = `  if(!valid||duplicate||repeatedCategory||issues.length)throw new Error(\`Final assembly check failed: \${JSON.stringify({valid,duplicate,repeatedCategory,issues:issues.slice(0,8)})}\`);`;
const newFinalAssembly = `  if(!valid||duplicate||repeatedCategory||issues.length){const error=new Error(\`Final assembly check failed: \${JSON.stringify({valid,duplicate,repeatedCategory,issues:issues.slice(0,8)})}\`);error.salvageGame=game;throw error;}`;
if (gameSource.includes(oldFinalAssembly)) gameSource = gameSource.replace(oldFinalAssembly, newFinalAssembly);
else if (!gameSource.includes(newFinalAssembly)) throw new Error('Jeopardy salvage patch failed: final assembly line changed.');
fs.writeFileSync(gamePath, gameSource, 'utf8');
console.log('[generation-fix] broader recurring subject domains enabled; fresh clues/facts/responses enforced; semantic overlap limited to recent history; category retries capped at 2; failed full boards are salvageable');

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

const oldBankCatch = `}catch(error){bankLastError=String(error.message||error).slice(0,1000);console.warn('Question bank generation paused:',bankLastError);/* Stay paused after an error; no automatic retry. */}finally{bankGenerating=false;}}`;
const newBankCatch = `}catch(error){if(error?.salvageGame){try{gameBankRepairQueue.push(error.salvageGame);saveBankSync();console.warn('[game-bank] saved failed full board to durable repair queue; paid-for clues will be reused.');}catch(saveError){console.error('[game-bank] could not persist salvage board:',saveError);}}bankLastError=String(error.message||error).slice(0,1000);console.warn('Question bank generation paused:',bankLastError);/* Stay paused after an error; no automatic retry. */}finally{bankGenerating=false;}}`;
if (serverSource.includes(oldBankCatch)) serverSource = serverSource.replace(oldBankCatch, newBankCatch);
else if (!serverSource.includes(newBankCatch)) throw new Error('Jeopardy salvage patch failed: game-bank catch block changed.');
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
  } catch (error) { console.warn('[game-bank-status] unavailable:', error.message || error); }
  triggerBankRefill();
});
setInterval(triggerBankRefill, intervalMs).unref();
