const crypto = require('node:crypto');

const clue = (answer, response) => ({ clue: answer, response, aliases: [] });
const FALLBACK_GAME = {
  rounds: [
    {
      title: 'JEOPARDY!',
      categories: [
        { name: 'CANADIAN PLACES', clues: [clue('This Ontario city is home to the CN Tower.', 'Toronto'), clue('This province is nicknamed La Belle Province.', 'Quebec'), clue('The Bay of Fundy borders this Atlantic province.', 'New Brunswick'), clue('This capital stands where the Bow and Elbow rivers meet.', 'Calgary'), clue('Canada’s northernmost territorial capital.', 'Iqaluit')] },
        { name: 'BODY LANGUAGE', clues: [clue('This organ pumps blood through the circulatory system.', 'heart'), clue('These tiny air sacs exchange respiratory gases.', 'alveoli'), clue('This is the largest organ of the human body.', 'skin'), clue('The cochlea is found in this organ.', 'ear'), clue('These kidney structures filter blood plasma.', 'glomeruli')] },
        { name: 'BOOK SMARTS', clues: [clue('George Orwell wrote this novel about Big Brother.', '1984'), clue('Sherlock Holmes lives at this London address.', '221B Baker Street'), clue('This author created Anne of Green Gables.', 'Lucy Maud Montgomery'), clue('A 14-line poem is usually called this.', 'sonnet'), clue('This Greek epic follows Odysseus home from Troy.', 'The Odyssey')] },
        { name: 'SCIENCE WORDS', clues: [clue('The process by which plants convert light into chemical energy.', 'photosynthesis'), clue('The basic unit of heredity.', 'gene'), clue('This force keeps planets in orbit.', 'gravity'), clue('A solution with pH below 7 has this property.', 'acidic'), clue('The SI unit of electrical resistance.', 'ohm')] },
        { name: 'AT THE MOVIES', clues: [clue('This 1993 film brought dinosaurs back to a theme park.', 'Jurassic Park'), clue('The kingdom in Frozen is called this.', 'Arendelle'), clue('He directed Jaws and E.T.', 'Steven Spielberg'), clue('This archaeologist carries a whip and fears snakes.', 'Indiana Jones'), clue('The Best Picture Oscar statuette is plated in this metal.', 'gold')] },
        { name: 'BEFORE & AFTER', clues: [clue('A fairy-tale sleeper who is also a biological wonder of the world.', 'Sleeping Beauty and the Beast'), clue('A hot breakfast grain that commits three home invasions.', 'Goldilocks and the Three Bears'), clue('A Beatles road that is also a grand English church.', 'Abbey Road'), clue('A red gemstone that slippers Dorothy home.', 'ruby slippers'), clue('The Bard’s tragic prince meets a breakfast egg dish.', 'Hamlet omelet')] }
      ], dailyDoubles: [[2, 3]]
    },
    {
      title: 'DOUBLE JEOPARDY!',
      categories: [
        { name: 'WORLD HISTORY', clues: [clue('This wall fell in 1989.', 'Berlin Wall'), clue('This civilization built Machu Picchu.', 'Inca'), clue('The Magna Carta was sealed in this century.', '13th century'), clue('This admiral defeated Napoleon at Trafalgar.', 'Horatio Nelson'), clue('The Meiji Restoration transformed this nation.', 'Japan')] },
        { name: 'SHAKESPEARE', clues: [clue('The Scottish play’s title character holds this rank.', 'thane'), clue('These two young lovers belong to feuding Verona families.', 'Romeo and Juliet'), clue('Prospero rules the action of this island play.', 'The Tempest'), clue('The melancholy Dane studies at this university.', 'Wittenberg'), clue('This king divides Britain among three daughters.', 'King Lear')] },
        { name: 'POTENT POTABLES', clues: [clue('Juniper berries flavour this spirit.', 'gin'), clue('This cocktail mixes tequila, lime and orange liqueur.', 'margarita'), clue('Sake is traditionally brewed from this grain.', 'rice'), clue('The French region that gives sparkling wine its protected name.', 'Champagne'), clue('A Moscow Mule is traditionally served in a mug made of this metal.', 'copper')] },
        { name: 'ANIMAL KINGDOM', clues: [clue('The blue whale belongs to this order of mammals.', 'Cetacea'), clue('This egg-laying mammal has a duck-like bill.', 'platypus'), clue('A group of crows is traditionally called this.', 'murder'), clue('This phylum includes octopuses and snails.', 'Mollusca'), clue('The axolotl is this type of vertebrate.', 'amphibian')] },
        { name: 'ART & ARTISTS', clues: [clue('He painted The Starry Night.', 'Vincent van Gogh'), clue('This Mexican artist is known for vivid self-portraits.', 'Frida Kahlo'), clue('Michelangelo carved this biblical giant slayer.', 'David'), clue('This art movement takes its name from a Monet sunrise.', 'Impressionism'), clue('Guernica is a monumental work by this Spanish painter.', 'Pablo Picasso')] },
        { name: 'WORDS IN SCHOOL', clues: [clue('This 8-letter word can mean a written test or a close inspection.', 'examine'), clue('From Latin for “course,” this document lists what a class covers.', 'syllabus'), clue('This mathematical statement is proven from axioms.', 'theorem'), clue('A word formed from initial letters, like NASA.', 'acronym'), clue('This rhetorical device repeats initial consonant sounds.', 'alliteration')] }
      ], dailyDoubles: [[1, 4], [4, 2]]
    }
  ],
  final: { category: 'FAMOUS CANADIANS', clue: 'In 1922, this Ontario-born scientist shared a Nobel Prize for the discovery of insulin.', response: 'Frederick Banting', aliases: ['Banting'] }
};

function normalize(value='') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\b(who|what|where|when|is|are|was|were|a|an|the)\b/g,' ').replace(/\s+/g,' ').trim();
}
function clueFingerprint(value='') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function gameClueRecords(game){
  const records=[];
  for(const round of game?.rounds||[])for(const category of round.categories||[])for(const item of category.clues||[])records.push({clue:item.clue,response:item.response,category:category.name,fingerprint:clueFingerprint(item.clue),factFingerprint:`${clueFingerprint(category.name)}|${clueFingerprint(item.response)}`});
  if(game?.final?.clue)records.push({clue:game.final.clue,response:game.final.response,category:game.final.category,fingerprint:clueFingerprint(game.final.clue),factFingerprint:`${clueFingerprint(game.final.category)}|${clueFingerprint(game.final.response)}`});
  return records;
}
function gameHasDuplicate(game,priorRecords=[]){
  const clues=new Set(priorRecords.map(x=>typeof x==='string'?clueFingerprint(x):x.fingerprint||clueFingerprint(x.clue)));
  const facts=new Set(priorRecords.map(x=>typeof x==='string'?'':x.factFingerprint||`${clueFingerprint(x.category)}|${clueFingerprint(x.response)}`).filter(x=>x&&x!=='|'));
  for(const item of gameClueRecords(game)){if(!item.fingerprint||clues.has(item.fingerprint)||facts.has(item.factFingerprint))return true;clues.add(item.fingerprint);facts.add(item.factFingerprint);}
  return false;
}
function locallyCorrect(given, item) {
  const answer=normalize(given); if(!answer)return false;
  return [item.response,...(item.aliases||[])].some(value=>{const target=normalize(value);return answer===target||answer.includes(target)||target.includes(answer);});
}
function validateGame(game){
  return !!(game?.rounds?.length===2&&game.rounds.every((r,ri)=>r.categories?.length===6&&r.categories.every(c=>c.name&&c.clues?.length===5&&c.clues.every(q=>q.clue&&q.response))&&r.dailyDoubles?.length===(ri?2:1))&&game.final?.category&&game.final?.clue&&game.final?.response);
}

async function generateGame(avoid=[]){
  if(!process.env.OPENAI_API_KEY)throw new Error('No OpenAI key');
  const clueSchema={type:'object',additionalProperties:false,properties:{clue:{type:'string'},response:{type:'string'},aliases:{type:'array',items:{type:'string'},minItems:1,maxItems:5}},required:['clue','response','aliases']};
  const categorySchema={type:'object',additionalProperties:false,properties:{name:{type:'string'},clues:{type:'array',minItems:5,maxItems:5,items:clueSchema}},required:['name','clues']};
  const roundSchema={type:'object',additionalProperties:false,properties:{title:{type:'string'},categories:{type:'array',minItems:6,maxItems:6,items:categorySchema},dailyDoubles:{type:'array',items:{type:'array',prefixItems:[{type:'integer',minimum:0,maximum:5},{type:'integer',minimum:0,maximum:4}],minItems:2,maxItems:2}}},required:['title','categories','dailyDoubles']};
  const schema={
    type:'object',additionalProperties:false,
    properties:{
      rounds:{type:'array',minItems:2,maxItems:2,items:roundSchema},
      final:{type:'object',additionalProperties:false,properties:{category:{type:'string'},clue:{type:'string'},response:{type:'string'},aliases:{type:'array',items:{type:'string'}}},required:['category','clue','response','aliases']}
    },
    required:['rounds','final']
  };
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(120000),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5-mini',instructions:'Create a complete, family-safe Jeopardy-style game. Use six distinct categories and five clues per category in each round, rising sharply in difficulty. Clues are declarative answers; responses are concise. Use broad knowledge across science, history, arts, language, geography and popular culture. Avoid ambiguity, trick wording, politics, current events, advertising and repeated concepts. Round titles must be JEOPARDY! and DOUBLE JEOPARDY!. Round one must have exactly one unique Daily Double coordinate; round two exactly two unique coordinates. Do not repeat or lightly rephrase any supplied prior clue. Return only schema-valid JSON.',input:`Fresh game seed ${crypto.randomUUID()}. Avoid these previous clues:\n${avoid.slice(-1000).join('\n')}`,text:{format:{type:'json_schema',name:'jeopardy_game',strict:true,schema}}})});
  if(!response.ok)throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const data=await response.json(); const output=data.output_text||data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;
  const game=JSON.parse(output); if(!validateGame(game))throw new Error('Generated game failed validation');
  game.rounds[0].dailyDoubles=game.rounds[0].dailyDoubles.slice(0,1);game.rounds[1].dailyDoubles=game.rounds[1].dailyDoubles.slice(0,2);
  return game;
}

async function judge(given,item){
  if(locallyCorrect(given,item))return true;if(!process.env.OPENAI_API_KEY)return false;
  try{const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_JUDGE_MODEL||'gpt-5-mini',instructions:'Judge a Jeopardy response. Ignore missing question phrasing, articles, spelling, harmless speech-to-text errors, and surnames when unambiguous. Accept only the same factual answer. Return JSON.',input:JSON.stringify({clue:item.clue,expected:item.response,aliases:item.aliases||[],given}),text:{format:{type:'json_schema',name:'judgment',strict:true,schema:{type:'object',additionalProperties:false,properties:{correct:{type:'boolean'}},required:['correct']}}}})});if(!response.ok)return false;const data=await response.json();const output=data.output_text||data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;return JSON.parse(output).correct===true;}catch{return false;}
}

module.exports={FALLBACK_GAME,normalize,clueFingerprint,gameClueRecords,gameHasDuplicate,locallyCorrect,validateGame,generateGame,judge};
