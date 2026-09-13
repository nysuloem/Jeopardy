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

const EMERGENCY_GAME = {
  rounds: [
    {title:'JEOPARDY!',categories:[
      {name:'O CANADA',clues:[clue('This city is the capital of Manitoba.','Winnipeg'),clue('This island province joined Confederation in 1873.','Prince Edward Island'),clue('This river runs through Ottawa and forms part of the Ontario–Quebec border.','Ottawa River'),clue('Canada shares its longest provincial border with these two provinces.','Ontario and Manitoba'),clue('This national park in Alberta is Canada’s oldest.','Banff National Park')]},
      {name:'TV TIME',clues:[clue('This animated family lives at 742 Evergreen Terrace.','the Simpsons'),clue('The coffee shop on Friends has this name.','Central Perk'),clue('This science-fiction series features the starship Enterprise.','Star Trek'),clue('Bryan Cranston played chemistry teacher Walter White on this drama.','Breaking Bad'),clue('This Canadian sketch-comedy troupe included Dave Foley and Mark McKinney.','The Kids in the Hall')]},
      {name:'AROUND THE BODY',clues:[clue('This bone protects the brain.','skull'),clue('These blood cells carry oxygen using hemoglobin.','red blood cells'),clue('This muscle separates the chest from the abdominal cavity.','diaphragm'),clue('The islets of Langerhans are found in this organ.','pancreas'),clue('This cranial nerve carries most parasympathetic signals to the thorax and abdomen.','vagus nerve')]},
      {name:'STARTS WITH S',clues:[clue('A person who studies stars and galaxies has this profession.','scientist'),clue('This word means a brief description of a longer work.','summary'),clue('It is the process by which a solid changes directly into a gas.','sublimation'),clue('This political right allows citizens to vote.','suffrage'),clue('In linguistics, this branch studies meaning in language.','semantics')]},
      {name:'WORLD LANDMARKS',clues:[clue('This Paris tower was completed for the 1889 World’s Fair.','Eiffel Tower'),clue('The Taj Mahal stands in this Indian city.','Agra'),clue('This ancient amphitheatre dominates the centre of Rome.','Colosseum'),clue('Angkor Wat is located in this Southeast Asian country.','Cambodia'),clue('This Incan citadel sits high in Peru’s Andes Mountains.','Machu Picchu')]},
      {name:'FOOD & DRINK',clues:[clue('Guacamole is primarily made from this fruit.','avocado'),clue('This Italian rice dish is slowly cooked with broth.','risotto'),clue('Miso is traditionally produced by fermenting these beans.','soybeans'),clue('The French mother sauce made from milk and a white roux.','béchamel'),clue('This spice comes from the dried stigmas of a crocus flower.','saffron')]}
    ],dailyDoubles:[[4,3]]},
    {title:'DOUBLE JEOPARDY!',categories:[
      {name:'GREAT SCIENTISTS',clues:[clue('She won Nobel Prizes in both physics and chemistry.','Marie Curie'),clue('This naturalist published On the Origin of Species in 1859.','Charles Darwin'),clue('His laws describe the motion of planets around the Sun.','Johannes Kepler'),clue('This mathematician formulated the uncertainty principle.','Werner Heisenberg'),clue('This Persian polymath wrote The Canon of Medicine.','Avicenna')]},
      {name:'NOVELS',clues:[clue('Atticus Finch defends Tom Robinson in this novel.','To Kill a Mockingbird'),clue('The Bennet sisters appear in this Jane Austen novel.','Pride and Prejudice'),clue('Captain Ahab pursues a white whale in this novel.','Moby-Dick'),clue('Sethe is haunted by the past in this Toni Morrison novel.','Beloved'),clue('The fictional Buendía family anchors this Gabriel García Márquez novel.','One Hundred Years of Solitude')]},
      {name:'DATES IN HISTORY',clues:[clue('In 1969, humans first walked on this celestial body.','the Moon'),clue('The Battle of Hastings took place in this year.','1066'),clue('This ship struck an iceberg in April 1912.','Titanic'),clue('The Congress of Vienna concluded in this year, just before Waterloo.','1815'),clue('The Defenestration of Prague helped ignite this 17th-century conflict.','Thirty Years’ War')]},
      {name:'CLASSICAL MUSIC',clues:[clue('He composed the Fifth Symphony whose opening is often rendered “da-da-da-dum.”','Ludwig van Beethoven'),clue('This Mozart opera features the Queen of the Night.','The Magic Flute'),clue('The Four Seasons is a set of violin concertos by this composer.','Antonio Vivaldi'),clue('This Russian composer wrote The Rite of Spring.','Igor Stravinsky'),clue('The Enigma Variations were composed by this Englishman.','Edward Elgar')]},
      {name:'SPACE',clues:[clue('This planet is closest to the Sun.','Mercury'),clue('The Great Red Spot is a storm on this planet.','Jupiter'),clue('A star’s colour and luminosity are plotted on this diagram.','Hertzsprung–Russell diagram'),clue('This boundary around a black hole marks the point of no return.','event horizon'),clue('Discovered in 1930, this dwarf planet was named by Venetia Burney.','Pluto')]},
      {name:'BEFORE & AFTER',clues:[clue('The Kansas girl who visits Oz meets winds blowing at 39 to 54 miles per hour.','Dorothy Gale-force winds'),clue('Nursery-rhyme hill climbers meet the first lady who entered the White House in 2021.','Jack and Jill Biden'),clue('Shakespeare’s Danish prince meets the Duke of Sussex.','Hamlet Prince Harry'),clue('A Dickens miser meets Disney’s billionaire cartoon duck.','Ebenezer Scrooge McDuck'),clue('A Tolstoy novel meets the U.S. volunteer program founded in 1961.','War and Peace Corps')]}
    ],dailyDoubles:[[1,3],[5,4]]}
  ],
  final:{category:'U.S. PRESIDENTS',clue:'This president is the only person elected to the office four times.',response:'Franklin D. Roosevelt',aliases:['Franklin Roosevelt','FDR']}
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
function categoryRuleValid(category){
  const name=String(category?.name||''),match=name.match(/\b(?:starts?|begins?)\s+with\s+(?:the\s+letter\s+)?["'“”]?([a-z0-9])\b/i);
  if(!match)return true;
  const required=match[1].toLowerCase();
  return category.clues.every(item=>String(item.response||'').trim().replace(/^(?:the|a|an)\s+/i,'').replace(/^[^a-z0-9]+/i,'').toLowerCase().startsWith(required));
}
function validateGame(game){
  return !!(game?.rounds?.length===2&&game.rounds.every((r,ri)=>r.categories?.length===6&&r.categories.every(c=>c.name&&c.clues?.length===5&&c.clues.every(q=>q.clue&&q.response)&&categoryRuleValid(c))&&r.dailyDoubles?.length===(ri?2:1))&&game.final?.category&&game.final?.clue&&game.final?.response);
}

async function generateGame(avoid=[]){
  if(!process.env.OPENAI_API_KEY)throw new Error('No OpenAI key');
  const clueSchema={type:'object',additionalProperties:false,properties:{clue:{type:'string'},response:{type:'string'},aliases:{type:'array',items:{type:'string'},minItems:1,maxItems:5}},required:['clue','response','aliases']};
  const categorySchema={type:'object',additionalProperties:false,properties:{name:{type:'string'},clues:{type:'array',minItems:5,maxItems:5,items:clueSchema}},required:['name','clues']};
  const roundSchema={type:'object',additionalProperties:false,properties:{title:{type:'string'},categories:{type:'array',minItems:6,maxItems:6,items:categorySchema}},required:['title','categories']};
  const schema={
    type:'object',additionalProperties:false,
    properties:{
      rounds:{type:'array',minItems:2,maxItems:2,items:roundSchema},
      final:{type:'object',additionalProperties:false,properties:{category:{type:'string'},clue:{type:'string'},response:{type:'string'},aliases:{type:'array',items:{type:'string'}}},required:['category','clue','response','aliases']}
    },
    required:['rounds','final']
  };
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(180000),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5-mini',max_output_tokens:20000,instructions:'Create a complete, family-safe Jeopardy-style game. Use six distinct categories and five clues per category in each round, rising sharply in difficulty. Clues are declarative answers; responses are concise. Use broad knowledge across science, history, arts, language, geography and popular culture. Avoid ambiguity, trick wording, politics, current events, advertising and repeated concepts. Every clue and response must genuinely satisfy its category. Before returning, explicitly verify all wordplay constraints internally: for a category such as Starts With S, every canonical response (after an optional article) must start with S; likewise enforce ends-with, contains, rhyme, letter-count, quotation-mark, before-and-after, and other category rules. Do not use a constrained category unless all five responses satisfy it. Round titles must be JEOPARDY! and DOUBLE JEOPARDY!. Do not repeat or lightly rephrase any supplied prior clue. Return only schema-valid JSON.',input:`Fresh game seed ${crypto.randomUUID()}. Avoid these previous clues:\n${avoid.slice(-1000).join('\n')}`,text:{format:{type:'json_schema',name:'jeopardy_game',strict:true,schema}}})});
  if(!response.ok)throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const data=await response.json(); const output=data.output_text||data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;
  const game=JSON.parse(output);game.rounds[0].dailyDoubles=[[Math.floor(Math.random()*6),1+Math.floor(Math.random()*4)]];const first=[Math.floor(Math.random()*6),1+Math.floor(Math.random()*4)];let second;do second=[Math.floor(Math.random()*6),1+Math.floor(Math.random()*4)];while(second[0]===first[0]&&second[1]===first[1]);game.rounds[1].dailyDoubles=[first,second];if(!validateGame(game))throw new Error('Generated game failed validation');
  return game;
}

async function judge(given,item){
  if(locallyCorrect(given,item))return true;if(!process.env.OPENAI_API_KEY)return false;
  try{const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_JUDGE_MODEL||'gpt-5-mini',instructions:'Judge a Jeopardy response. Ignore missing question phrasing, articles, spelling, harmless speech-to-text errors, and surnames when unambiguous. Accept only the same factual answer. Return JSON.',input:JSON.stringify({clue:item.clue,expected:item.response,aliases:item.aliases||[],given}),text:{format:{type:'json_schema',name:'judgment',strict:true,schema:{type:'object',additionalProperties:false,properties:{correct:{type:'boolean'}},required:['correct']}}}})});if(!response.ok)return false;const data=await response.json();const output=data.output_text||data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;return JSON.parse(output).correct===true;}catch{return false;}
}

module.exports={FALLBACK_GAME,EMERGENCY_GAME,normalize,clueFingerprint,gameClueRecords,gameHasDuplicate,locallyCorrect,categoryRuleValid,validateGame,generateGame,judge};
