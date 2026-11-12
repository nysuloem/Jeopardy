const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const modern=require('../src/game');
const {validateStoredGame,storedGameHasDuplicate}=require('../src/stored-bank-policy');

test('existing bank keeps its original mechanics and duplicate policy; new boards keep the revised policy',()=>{
  const legacy=structuredClone(modern.FALLBACK_GAME);legacy.rounds[0].categories[0].name='4-LETTER CITIES';
  assert.equal(modern.validateGame(legacy),false);assert.equal(validateStoredGame(legacy),true);
  assert.equal(validateStoredGame({...legacy,styleVersion:'archive-inspired-v1'}),false);
  const oldRecord={clue:'In Ontario, this city is the location of the CN Tower.',response:'Toronto',category:'OLD LOCATIONS'};
  assert.equal(modern.gameHasDuplicate(modern.FALLBACK_GAME,[oldRecord]),true);
  assert.equal(storedGameHasDuplicate(modern.FALLBACK_GAME,[oldRecord]),false);
  // A truly identical played clue or an original category/response fact key still blocks admission.
  const played=modern.gameClueRecords(modern.FALLBACK_GAME)[0];
  assert.equal(storedGameHasDuplicate(modern.FALLBACK_GAME,[played]),true);
  assert.equal(storedGameHasDuplicate(modern.FALLBACK_GAME,[{...played,clue:'Different wording',fingerprint:'different wording'}]),true);
});

test('restart restores all thirteen legacy fixtures, keeps the actual invalid board queued, and can play a restored board',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jeopardy-bank-recovery-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  // Previously admitted legacy fixtures differ in their exact clue/category keys.
  // The new approximate checker would retrospectively quarantine them.
  const games=Array.from({length:13},(_,i)=>{
    const game=structuredClone(modern.FALLBACK_GAME);
    game.rounds.forEach((round,ri)=>round.categories.forEach((category,ci)=>{
      category.name=`ARCHIVE${i}TOPIC${ri*6+ci}`;
      category.clues.forEach(item=>item.clue=`Game ${i}: ${item.clue}`);
    }));
    game.final.category=`ARCHIVE${i}FINAL`;game.final.clue=`Game ${i}: ${game.final.clue}`;
    assert.equal(validateStoredGame(game),true);return game;
  });
  const bad=structuredClone(games[0]);bad.rounds[0].categories[0].clues.pop();
  const bankPath=path.join(dir,'game-bank.json');
  const original={version:3,games:games.slice(0,5),repairQueue:[...games.slice(5),bad]};
  fs.writeFileSync(bankPath,JSON.stringify(original));fs.writeFileSync(path.join(dir,'clue-ledger.json'),JSON.stringify({version:1,entries:modern.gameClueRecords(modern.FALLBACK_GAME)}));
  function restart(play=false){
    const script=`const fs=require('node:fs');const app=require(${JSON.stringify(require.resolve('../server'))});const before=JSON.parse(fs.readFileSync(${JSON.stringify(bankPath)}));let code=null;if(${play}){const room=app.makeRoom();code=room.code;app.dispose(room);}const after=JSON.parse(fs.readFileSync(${JSON.stringify(bankPath)}));console.log('RESULT '+JSON.stringify({before:before.games.length,after:after.games.length,queued:after.repairQueue.length,played:!!code}));app.io.close();`;
    const result=spawnSync(process.execPath,['-e',script],{env:{...process.env,DATA_DIR:dir,NODE_ENV:'test',GAME_BANK_AUTO_FILL:'false',OPENAI_API_KEY:''},encoding:'utf8',timeout:10000});
    assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout.split('\n').find(line=>line.startsWith('RESULT ')).slice(7));
  }
  assert.deepEqual(restart(),{before:13,after:13,queued:1,played:false});
  assert.deepEqual(JSON.parse(fs.readFileSync(bankPath+'.pre-policy-recovery-20261112')),original);
  assert.deepEqual(restart(),{before:13,after:13,queued:1,played:false});
  assert.deepEqual(restart(true),{before:13,after:12,queued:1,played:true});
  assert.deepEqual(restart(),{before:12,after:12,queued:1,played:false});
});
