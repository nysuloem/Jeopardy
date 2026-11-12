const test = require('node:test');
const assert = require('node:assert/strict');
const pilot = require('../content/new-style-pilot.json');
const { validateGame, generatedGameIssues, gameClueRecords, gameHasDuplicate, FALLBACK_GAME } = require('../src/game');
const { createBoardPlan } = require('../src/board-style');

test('pilot is complete, internally fresh, and every explicit mechanic holds', () => {
  assert.equal(validateGame(pilot), true);
  assert.deepEqual(generatedGameIssues(pilot), []);
  assert.equal(gameClueRecords(pilot).length, 61);
  const all = [...pilot.rounds.flatMap(r => r.categories.flatMap(c => c.clues)), pilot.final];
  assert.equal(all.filter(q => q.geographicFocus === 'Canada').length, 10);
  assert.ok(all.filter(q => q.geographicFocus === 'Canada').length > all.filter(q => q.geographicFocus === 'US').length);
  const broken = structuredClone(pilot);
  broken.rounds[0].categories[5].clues[0].response = 'sand';
  assert.equal(validateGame(broken), false);
  assert.ok(generatedGameIssues(broken).some(issue => issue.reason.includes('category mechanic')));
});

test('new facts about an old response are allowed while reworded clues stay blocked', () => {
  const prior = gameClueRecords(FALLBACK_GAME).slice(0, 1);
  const newFact = structuredClone(FALLBACK_GAME);
  newFact.rounds[0].categories[0].clues[0].clue = 'The Blue Jays play their home games in this Ontario city.';
  assert.equal(gameHasDuplicate(newFact, prior), false);
  assert.deepEqual(generatedGameIssues(newFact, prior, ['CANADIAN PLACES']), []);
  newFact.rounds[0].categories[0].clues[0].clue = 'Name the Canadian city containing the CN Tower.';
  assert.equal(gameHasDuplicate(newFact, prior), true);
  assert.ok(generatedGameIssues(newFact, prior).some(issue => issue.reason.includes('near-duplicate')));
});

test('each board plan has twelve slots with subject, connection and mechanic variety', () => {
  const plan = createBoardPlan();
  assert.deepEqual(plan.map(round => round.length), [6, 6]);
  assert.equal(plan.flat().filter(slot => slot.type === 'wordplay').length, 3);
  assert.equal(plan.flat().filter(slot => slot.type === 'connection').length, 1);
});

test('a repair job cannot exceed twenty API requests', async t => {
  const originalFetch=global.fetch,originalKey=process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY='test-key';let calls=0;
  global.fetch=async(_url,options)=>{
    calls++;const request=JSON.parse(options.body),result=request.text.format.name==='jeopardy_category_title_repair'?{name:''}:{...pilot.rounds[0].categories[0],name:''};
    return {ok:true,json:async()=>({output_text:JSON.stringify(result)})};
  };
  t.after(()=>{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;});
  const broken=structuredClone(pilot);broken.rounds.forEach(round=>round.categories.forEach(category=>category.name=''));
  await assert.rejects(require('../src/game').repairGeneratedGame(broken),/20-request limit/);
  assert.equal(calls,20);
});
