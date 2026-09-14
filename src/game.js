const crypto = require('node:crypto');

const MAX_CLUE_CHARS = 140;
const MAX_CLUE_WORDS = 24;

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
        { name: 'BEFORE & AFTER', clues: [
          {...clue('The slumbering fairy-tale princess meets the romance set in an enchanted castle.', 'Sleeping Beauty and the Beast'),mechanicProof:'Sleeping Beauty || Beauty and the Beast || Beauty'},
          {...clue('Nursery-rhyme hill climbers meet the First Lady who entered the White House in 2021.', 'Jack and Jill Biden'),mechanicProof:'Jack and Jill || Jill Biden || Jill'},
          {...clue('The Beatles’ final recorded album meets the speedy Looney Tunes bird.', 'Abbey Road Runner'),mechanicProof:'Abbey Road || Road Runner || Road'},
          {...clue('A Rolling Stones song meets the actress from Looking for Mr. Goodbar.', 'Ruby Tuesday Weld'),mechanicProof:'Ruby Tuesday || Tuesday Weld || Tuesday'},
          {...clue('The 1941 Orson Welles film meets the biblical brothers who were sons of Adam and Eve.', 'Citizen Kane and Abel'),mechanicProof:'Citizen Kane || Kane and Abel || Kane'}
        ] }
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
      {name:'O CANADA',clues:[clue('This city is the capital of Manitoba.','Winnipeg'),clue('This island province joined Confederation in 1873.','Prince Edward Island'),clue('This river forms part of the Ontario–Quebec border near Parliament Hill.','Ottawa River'),clue('Canada shares its longest provincial border with these two provinces.','Ontario and Manitoba'),clue('This national park in Alberta is Canada’s oldest.','Banff National Park')]},
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
      {name:'BEFORE & AFTER',clues:[
        {...clue('The Kansas girl who visits Oz meets winds blowing at 39 to 54 miles per hour.','Dorothy Gale-force winds'),mechanicProof:'Dorothy Gale || gale-force winds || Gale'},
        {...clue('Sherwood Forest’s charitable outlaw meets a decorative feature above a car engine.','Robin Hood ornament'),mechanicProof:'Robin Hood || hood ornament || Hood'},
        {...clue('Melville’s great white whale novel meets the actor who played Rob Petrie.','Moby Dick Van Dyke'),mechanicProof:'Moby Dick || Dick Van Dyke || Dick'},
        {...clue('A Dickens miser meets Disney’s billionaire cartoon duck.','Ebenezer Scrooge McDuck'),mechanicProof:'Ebenezer Scrooge || Scrooge McDuck || Scrooge'},
        {...clue('A Tolstoy novel meets the U.S. volunteer program founded in 1961.','War and Peace Corps'),mechanicProof:'War and Peace || Peace Corps || Peace'}
      ]}
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
function responseText(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text;
  for(const item of data?.output||[])for(const part of item?.content||[])if(typeof part?.text==='string'&&part.text.trim())return part.text;
  return null;
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
  if(match){const required=match[1].toLowerCase();return category.clues.every(item=>String(item.response||'').trim().replace(/^(?:the|a|an)\s+/i,'').replace(/^[^a-z0-9]+/i,'').toLowerCase().startsWith(required));}
  if(/\bbefore\s*(?:&|and)\s*after\b/i.test(name))return category.clues.every(beforeAfterValid);
  return true;
}
function beforeAfterValid(item){
  const parts=String(item?.mechanicProof||'').split('||').map(x=>x.trim());if(parts.length!==3||parts.some(x=>!x))return false;
  const [first,second,bridge]=parts.map(clueFingerprint),response=clueFingerprint(item.response),bridgeWords=bridge.split(' '),firstWords=first.split(' '),secondWords=second.split(' ');
  if(firstWords.slice(-bridgeWords.length).join(' ')!==bridge||secondWords.slice(0,bridgeWords.length).join(' ')!==bridge)return false;
  return response===[...firstWords,...secondWords.slice(bridgeWords.length)].join(' ');
}
function clueLengthValid(value){
  const text=String(value||'').trim();
  return !!text&&text.length<=MAX_CLUE_CHARS&&text.split(/\s+/).length<=MAX_CLUE_WORDS;
}
const GENERIC_RESPONSE_WORDS=new Set(['answer','author','blood','book','capital','cell','century','city','country','diagram','event','film','instrument','island','king','lake','metal','mountain','national','nerve','novel','ocean','opera','park','person','place','planet','president','province','river','song','star','state','term','tower','wall','war','wind','word','year']);
function answerWordRoot(value){
  let word=String(value||'').toLowerCase();
  if(word.length>5&&word.endsWith('ies'))word=`${word.slice(0,-3)}y`;
  else if(word.length>5&&word.endsWith('es'))word=word.slice(0,-2);
  else if(word.length>4&&word.endsWith('s'))word=word.slice(0,-1);
  return word;
}
function clueDoesNotRevealResponse(item){
  const clueText=clueFingerprint(item?.clue),responses=[item?.response,...(item?.aliases||[])].map(clueFingerprint).filter(Boolean);
  if(!clueText||!responses.length)return false;
  const clueRoots=new Set(clueText.split(' ').map(answerWordRoot));
  return responses.every(response=>{
    if(` ${clueText} `.includes(` ${response} `))return false;
    const responseWords=response.split(' ').filter(word=>word.length>=4&&!GENERIC_RESPONSE_WORDS.has(answerWordRoot(word)));
    return responseWords.every(word=>!clueRoots.has(answerWordRoot(word)));
  });
}
function validateGame(game){
  return !!(game?.rounds?.length===2&&game.rounds.every((r,ri)=>r.categories?.length===6&&r.categories.every(c=>c.name&&c.clues?.length===5&&c.clues.every(q=>clueLengthValid(q.clue)&&q.response&&clueDoesNotRevealResponse(q))&&categoryRuleValid(c))&&r.dailyDoubles?.length===(ri?2:1))&&game.final?.category&&clueLengthValid(game.final?.clue)&&game.final?.response&&clueDoesNotRevealResponse(game.final));
}

async function generateGame(avoid=[]){
  if(!process.env.OPENAI_API_KEY)throw new Error('No OpenAI key');
  const clueSchema={type:'object',additionalProperties:false,properties:{clue:{type:'string',minLength:1,maxLength:MAX_CLUE_CHARS},response:{type:'string'},aliases:{type:'array',items:{type:'string'},minItems:1,maxItems:5},mechanicProof:{type:'string'}},required:['clue','response','aliases','mechanicProof']};
  const categorySchema={type:'object',additionalProperties:false,properties:{name:{type:'string'},clues:{type:'array',minItems:5,maxItems:5,items:clueSchema}},required:['name','clues']};
  const roundSchema={type:'object',additionalProperties:false,properties:{title:{type:'string'},categories:{type:'array',minItems:6,maxItems:6,items:categorySchema}},required:['title','categories']};
  const schema={
    type:'object',additionalProperties:false,
    properties:{
      rounds:{type:'array',minItems:2,maxItems:2,items:roundSchema},
      final:{type:'object',additionalProperties:false,properties:{category:{type:'string'},clue:{type:'string',minLength:1,maxLength:MAX_CLUE_CHARS},response:{type:'string'},aliases:{type:'array',items:{type:'string'}}},required:['category','clue','response','aliases']}
    },
    required:['rounds','final']
  };
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(180000),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5-mini',max_output_tokens:20000,instructions:`Create a complete, family-safe Jeopardy-style game. Use six distinct categories and five clues per category in each round. Make the $200/$400 clues broadly accessible, then increase difficulty at each value; reserve specialized detail for the highest values. Difficulty should come from knowledge and inference, not needlessly obscure or over-specific wording. Clues are declarative answers; responses are concise. Every clue must be no more than ${MAX_CLUE_WORDS} words and ${MAX_CLUE_CHARS} characters, including punctuation; rewrite it more concisely instead of relying on smaller display text. Use broad knowledge across science, history, arts, language, geography and popular culture. Avoid ambiguity, trick wording, politics, current events, advertising and repeated concepts. Never include the canonical response, an alias, or a distinctive word or word-root from the response in its own clue. For example, a clue whose response is "neutron star" must not contain "neutron" or "neutrons." Generic type words such as city, novel, river, instrument, or star may appear only when they do not reveal the specific response. Every clue and response must genuinely satisfy its category. Classic Jeopardy wordplay categories are welcome, but their mechanics are mandatory. BEFORE & AFTER means two real answers overlap on the exact same bridge word or phrase, which appears only once in the combined response. Each clue must independently clue both halves in order. Example: Jack and Jill + Jill Biden = Jack and Jill Biden; never merely put two unrelated answers next to each other. For every clue, set mechanicProof to "standard" unless it is BEFORE & AFTER; for BEFORE & AFTER use exactly "FIRST ANSWER || SECOND ANSWER || SHARED BRIDGE". Before returning, verify all constraints: Starts With S responses must start with S after an optional article; likewise enforce ends-with, contains, rhyme, letter-count, quotation-mark, and every other stated rule. Do not use a constrained category unless all five responses satisfy it. Round titles must be JEOPARDY! and DOUBLE JEOPARDY!. Do not repeat or lightly rephrase any supplied prior clue. Return only schema-valid JSON.`,input:`Fresh game seed ${crypto.randomUUID()}. Avoid these previous clues:\n${avoid.slice(-1000).join('\n')}`,text:{format:{type:'json_schema',name:'jeopardy_game',strict:true,schema}}})});
  if(!response.ok)throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const data=await response.json(),output=responseText(data);if(!output)throw new Error(`OpenAI returned no game JSON (${data.status||'unknown status'}).`);
  const game=JSON.parse(output);game.rounds[0].dailyDoubles=[[Math.floor(Math.random()*6),1+Math.floor(Math.random()*4)]];const first=[Math.floor(Math.random()*6),1+Math.floor(Math.random()*4)];let second;do second=[Math.floor(Math.random()*6),1+Math.floor(Math.random()*4)];while(second[0]===first[0]&&second[1]===first[1]);game.rounds[1].dailyDoubles=[first,second];if(!validateGame(game))throw new Error('Generated game failed validation');
  return game;
}

async function generateFinalClue(avoid=[]){
  if(!process.env.OPENAI_API_KEY)throw new Error('OpenAI is required to prepare a fresh Final Jeopardy clue.');
  const schema={type:'object',additionalProperties:false,properties:{category:{type:'string'},clue:{type:'string',minLength:1,maxLength:MAX_CLUE_CHARS},response:{type:'string'},aliases:{type:'array',items:{type:'string'},minItems:1,maxItems:5}},required:['category','clue','response','aliases']};
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(90000),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5-mini',max_output_tokens:4000,instructions:`Write one fresh, family-safe Final Jeopardy clue. It must be no more than ${MAX_CLUE_WORDS} words and ${MAX_CLUE_CHARS} characters, including punctuation; make the wording concise instead of relying on smaller display text. It should require reasoning from two useful pieces of information, have one unambiguous canonical response, and feel challenging but gettable rather than needlessly obscure. Never include the canonical response, an alias, or a distinctive word or word-root from the response in the clue itself. Avoid current events, politics, advertising, wordplay categories, and any prior clue or fact supplied. Return only schema-valid JSON.`,input:`Fresh Final Jeopardy test seed ${crypto.randomUUID()}. Never repeat these prior clues:\n${avoid.slice(-1200).join('\n')}`,text:{format:{type:'json_schema',name:'final_jeopardy_clue',strict:true,schema}}})});
  if(!response.ok)throw new Error(`OpenAI could not prepare the clue (${response.status}).`);const data=await response.json(),output=responseText(data);if(!output)throw new Error(`OpenAI returned no Final Jeopardy JSON (${data.status||'unknown status'}).`);const item=JSON.parse(output);
  if(!item.category||!clueLengthValid(item.clue)||!item.response||!clueDoesNotRevealResponse(item))throw new Error('Generated Final Jeopardy clue failed validation.');return item;
}

async function judge(given,item){
  if(locallyCorrect(given,item))return true;if(!process.env.OPENAI_API_KEY)return false;
  try{const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_JUDGE_MODEL||'gpt-5-mini',instructions:'Judge a Jeopardy response for factual equivalence. Ignore question phrasing, articles, minor spelling or speech-to-text errors, and an omitted nonessential qualifier when the intended named answer remains unique; for example, accept “Pyrimid of Giza” for “Great Pyramid of Giza.” Accept surnames when unambiguous. However, the contestant must actually name the requested person, place, object, title, or term using its recognized name or a genuine synonym. Reject a description, definition, function, category, or related concept that merely points toward the answer; for example, “atmospheric pressure gauge” is not an acceptable substitute for “barometer.” Accept only the same factual answer. Return JSON.',input:JSON.stringify({clue:item.clue,expected:item.response,aliases:item.aliases||[],given}),text:{format:{type:'json_schema',name:'judgment',strict:true,schema:{type:'object',additionalProperties:false,properties:{correct:{type:'boolean'}},required:['correct']}}}})});if(!response.ok)return false;const data=await response.json(),output=responseText(data);return !!output&&JSON.parse(output).correct===true;}catch{return false;}
}

module.exports={FALLBACK_GAME,EMERGENCY_GAME,MAX_CLUE_CHARS,MAX_CLUE_WORDS,normalize,clueFingerprint,responseText,gameClueRecords,gameHasDuplicate,locallyCorrect,categoryRuleValid,beforeAfterValid,clueLengthValid,clueDoesNotRevealResponse,validateGame,generateGame,generateFinalClue,judge};
