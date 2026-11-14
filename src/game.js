const crypto = require('node:crypto');
const {AsyncLocalStorage} = require('node:async_hooks');
const generationBudget = new AsyncLocalStorage();
function withGenerationBudget(work){return generationBudget.getStore()?work():generationBudget.run({remaining:20},work);}
function consumeGenerationRequest(){const budget=generationBudget.getStore();if(budget&&budget.remaining--<=0)throw new Error('Board generation reached its 20-request limit; automatic retries are paused.');}
const {EDITORIAL_GUIDE, createBoardPlan} = require('./board-style');

const MAX_CLUE_CHARS = 240;
const MAX_CLUE_WORDS = 42;
const BOARD_GENERATION_TIMEOUT_MS = 10 * 60 * 1000;

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
function gameCategories(game){
  return [...(game?.rounds||[]).flatMap(round=>(round.categories||[]).map(category=>category.name)),game?.final?.category].filter(Boolean);
}
function gameHasCategoryRepeat(game,priorCategories=[]){
  // Familiar titles may return in later games. Only exact title collisions
  // inside this game are blocking; shared subject words are editorial advice.
  const seen=new Set();
  for(const category of gameCategories(game)){const key=clueFingerprint(category);if(!key||seen.has(key))return true;seen.add(key);}
  return false;
}
const GENERIC_CATEGORY_WORDS=new Set(['about','after','around','before','category','from','great','hodgepodge','miscellany','potpourri','stuff','things','with','word','world']);
function categoryTopicTokens(value){return [...new Set(clueFingerprint(value).split(' ').map(answerWordRoot).filter(word=>word.length>=4&&!GENERIC_CATEGORY_WORDS.has(word)))];}
function categoriesOverlap(left,right){
  const a=categoryTopicTokens(left),b=categoryTopicTokens(right);if(!a.length||!b.length)return false;
  const shared=a.filter(word=>b.includes(word));
  return shared.length>=2||shared.length===1&&(a.length===1||b.length===1||shared.length/Math.min(a.length,b.length)>=.5);
}
function gameHasCategoryOverlap(game){
  const categories=(game?.rounds||[]).flatMap(round=>(round.categories||[]).map(category=>category.name));
  for(let i=0;i<categories.length;i++)for(let j=i+1;j<categories.length;j++)if(categoriesOverlap(categories[i],categories[j]))return true;
  return false;
}
function gameHasResponseRepeat(game){
  const seen=new Set();for(const record of gameClueRecords(game)){const key=clueFingerprint(record.response);if(!key||seen.has(key))return true;seen.add(key);}return false;
}
const FACT_STOP_WORDS=new Set(['is','are','to','in','on','of','as','an','at','name','home','contains','containing','this','that','these','those','with','from','into','which','whose','their','there','where','when','what','about','called','known','named','also','have','has','had','were','was','the','and','for','its','his','her']);
function factTokens(text){return new Set(clueFingerprint(text).split(' ').map(answerWordRoot).filter(word=>word.length>=2&&!FACT_STOP_WORDS.has(word)));}
function recordsRepeat(left,right){
  const a=left.fingerprint||clueFingerprint(left.clue),b=typeof right==='string'?clueFingerprint(right):right.fingerprint||clueFingerprint(right.clue);
  if(a===b)return true;
  // A category/response pair is not a fact: the same river has many facts.
  // Catch substantial paraphrases, while allowing new facts about a person/place.
  if(typeof right==='string'||!left.response||clueFingerprint(left.response)!==clueFingerprint(right.response))return false;
  const x=factTokens(left.clue),y=factTokens(right.clue),shared=[...x].filter(word=>y.has(word)).length;
  return shared>=3&&shared/(x.size+y.size-shared)>=.6;
}
function gameHasDuplicate(game,priorRecords=[]){
  const seen=[...priorRecords];
  for(const item of gameClueRecords(game)){if(!item.fingerprint||seen.some(prior=>recordsRepeat(item,prior)))return true;seen.push(item);}
  return false;
}
const RESPONSE_STOP_WORDS=new Set(['and','at','for','from','in','of','on','to']);
function responseTokens(value){return normalize(value).split(' ').filter(word=>word&&!RESPONSE_STOP_WORDS.has(word));}
function responseRoot(word){return answerWordRoot(word);}
function editDistance(a,b){
  const row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const held=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=held;}}
  return row[b.length];
}
function tokenEquivalent(a,b){const left=responseRoot(a),right=responseRoot(b),distance=editDistance(left,right),limit=Math.min(left.length,right.length)>=9?2:1;return left===right||(left.length>=5&&right.length>=5&&distance<=limit);}
function closeResponse(given,target){
  const answer=responseTokens(given),expected=responseTokens(target);if(!answer.length||!expected.length)return false;
  return answer.length===expected.length&&answer.every((word,index)=>tokenEquivalent(word,expected[index]));
}
function locallyCorrect(given,item){
  return [item.response,...(item.aliases||[])].some(target=>closeResponse(given,target));
}
function plausibleVariant(given,item){
  const answer=responseTokens(given);if(!answer.length)return false;
  return [item.response,...(item.aliases||[])].some(target=>{const expected=responseTokens(target);return answer.some(word=>expected.some(targetWord=>tokenEquivalent(word,targetWord)));});
}
function locallyNeedsMoreSpecific(given,item){
  const answer=responseTokens(given);if(!answer.length)return false;
  return [item.response,...(item.aliases||[])].some(target=>{const expected=responseTokens(target);return answer.length<expected.length&&answer.every(word=>expected.some(targetWord=>tokenEquivalent(word,targetWord)));});
}
function categoryRuleValid(category){
  const name=String(category?.name||''),match=name.match(/\b(?:starts?|begins?)\s+with\s+(?:the\s+letter\s+)?["'“”]?([a-z0-9])\b/i);
  return category.clues.every(item=>categoryClueRuleValid(category,item,match));
}
function categoryClueRuleValid(category,item){
  const name=String(category?.name||''),response=String(item?.response||'').trim().replace(/^(?:the|a|an)\s+/i,'').replace(/^[^a-z0-9]+/i,'').toLowerCase();
  const starts=name.match(/\b(?:starts?|begins?)\s+with\s+(?:the\s+letters?\s+)?["'“”]?([a-z0-9]+)\b/i);
  if(starts&&!response.startsWith(starts[1].toLowerCase()))return false;
  const ends=name.match(/\bends?\s+with\s+(?:the\s+letters?\s+)?["'“”]?([a-z0-9]+)\b/i);
  if(ends&&!response.endsWith(ends[1].toLowerCase()))return false;
  const count=name.match(/\b(\d+)[ -]letter\b/i);
  if(count&&response.replace(/[^a-z]/g,'').length!==Number(count[1]))return false;
  if(/\bbefore\s*(?:&|and)\s*after\b/i.test(name))return beforeAfterValid(item);
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
const GENERIC_RESPONSE_WORDS=new Set(['bear','bird','doctor','drum','treaty','restoration','revolution','knot','light','surface','brandy','answer','author','blood','book','capital','cell','century','city','country','diagram','event','film','instrument','island','king','lake','metal','mountain','national','nerve','novel','ocean','opera','park','person','place','planet','president','province','river','song','star','state','term','tower','wall','war','wind','word','year']);
function answerWordRoot(value){
  let word=String(value||'').toLowerCase();
  if(word.length>5&&word.endsWith('ies'))word=`${word.slice(0,-3)}y`;
  else if(word.length>=5&&/(?:ches|shes|sses|xes|zes)$/.test(word))word=word.slice(0,-2);
  else if(word.length>4&&word.endsWith('s'))word=word.slice(0,-1);
  return word;
}
function clueDoesNotRevealResponse(item){
  // Shared roots and one word of a multiword answer are useful hints, not leaks.
  // Reject complete canonical answers and substantive aliases only.
  const clueText=clueFingerprint(item?.clue),canonical=clueFingerprint(item?.response);
  if(!clueText||!canonical)return false;
  const answers=[canonical,...(item.aliases||[]).map(clueFingerprint).filter(alias=>alias.length>=4&&!GENERIC_RESPONSE_WORDS.has(alias))];
  const text=` ${clueText.split(' ').map(answerWordRoot).join(' ')} `;
  return answers.every(answer=>!text.includes(` ${answer.split(' ').map(answerWordRoot).join(' ')} `));
}

function validateGame(game){
  return !!(game?.rounds?.length===2&&game.rounds.every((r,ri)=>r.categories?.length===6&&r.categories.every(c=>c.name&&c.clues?.length===5&&c.clues.every(q=>clueLengthValid(q.clue)&&q.response&&clueDoesNotRevealResponse(q))&&categoryRuleValid(c))&&r.dailyDoubles?.length===(ri?2:1))&&game.final?.category&&clueLengthValid(game.final?.clue)&&game.final?.response&&clueDoesNotRevealResponse(game.final)&&!gameHasCategoryRepeat(game)&&!gameHasResponseRepeat(game));
}

function generatedGameIssues(game,priorRecords=[],priorCategories=[]){
  const issues=[],seenClues=new Set(priorRecords.map(item=>clueFingerprint(typeof item==='string'?item:item?.clue)).filter(Boolean)),seenFacts=new Set(priorRecords.map(item=>typeof item==='string'?'':item?.factFingerprint||`${clueFingerprint(item?.category)}|${clueFingerprint(item?.response)}`).filter(value=>value&&value!=='|')),seenCategories=new Set(),boardCategories=[],seenResponses=new Set();
  for(let round=0;round<(game?.rounds||[]).length;round++)for(let category=0;category<(game.rounds[round].categories||[]).length;category++){
    const current=game.rounds[round].categories[category],categoryKey=clueFingerprint(current?.name);
    if(!categoryKey||seenCategories.has(categoryKey)){issues.push({kind:'category',round,category,reason:'repeated or missing category title'});continue;}
    seenCategories.add(categoryKey);
    boardCategories.push(current.name);
    for(let clueIndex=0;clueIndex<(current.clues||[]).length;clueIndex++){
      const item=current.clues[clueIndex],fingerprint=clueFingerprint(item?.clue),responseKey=clueFingerprint(item?.response),fact=`${categoryKey}|${responseKey}`,reasons=[];
      if(!clueLengthValid(item?.clue))reasons.push('clue length');
      if(!item?.response)reasons.push('missing response');
      if(!clueDoesNotRevealResponse(item))reasons.push('clue reveals response');
      if(!categoryClueRuleValid(current,item))reasons.push('category mechanic');
      if(!fingerprint||seenClues.has(fingerprint))reasons.push('repeated clue');
      if(priorRecords.some(prior=>recordsRepeat({clue:item?.clue,response:item?.response},prior)))reasons.push('repeated or near-duplicate clue');
      if(responseKey&&seenResponses.has(responseKey))reasons.push('response repeated elsewhere on board');
      if(reasons.length)issues.push({kind:'clue',round,category,clue:clueIndex,reason:reasons.join(', ')});
      if(fingerprint)seenClues.add(fingerprint);if(fact!=='|')seenFacts.add(fact);if(responseKey)seenResponses.add(responseKey);
    }
  }
  const final=game?.final,finalCategory=clueFingerprint(final?.category),finalFingerprint=clueFingerprint(final?.clue),finalFact=`${finalCategory}|${clueFingerprint(final?.response)}`,finalReasons=[];
  if(!finalCategory||seenCategories.has(finalCategory))finalReasons.push('repeated or missing category title');
  if(!clueLengthValid(final?.clue))finalReasons.push('clue length');
  if(!final?.response)finalReasons.push('missing response');
  if(!clueDoesNotRevealResponse(final))finalReasons.push('clue reveals response');
  if(!finalFingerprint||seenClues.has(finalFingerprint))finalReasons.push('repeated clue');
  if(priorRecords.some(prior=>recordsRepeat({clue:final?.clue,response:final?.response},prior)))finalReasons.push('repeated or near-duplicate clue');
  if(clueFingerprint(final?.response)&&seenResponses.has(clueFingerprint(final.response)))finalReasons.push('response repeated elsewhere on board');
  if(finalReasons.length)issues.push({kind:'final',reason:finalReasons.join(', ')});
  return issues;
}

async function requestStructured(name,schema,instructions,input,maxOutputTokens=5000){
  consumeGenerationRequest();
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(BOARD_GENERATION_TIMEOUT_MS),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5-mini',reasoning:{effort:'low'},max_output_tokens:maxOutputTokens,instructions,input,text:{format:{type:'json_schema',name,strict:true,schema}}})});
  if(!response.ok)throw new Error(`OpenAI ${response.status}: ${await response.text()}`);const data=await response.json(),output=responseText(data);if(!output)throw new Error(`OpenAI returned no ${name} JSON (${data.status||'unknown status'}).`);return JSON.parse(output);
}

const repairClueSchema={type:'object',additionalProperties:false,properties:{id:{type:'string'},clue:{type:'string',minLength:1,maxLength:MAX_CLUE_CHARS},response:{type:'string'},aliases:{type:'array',items:{type:'string'},minItems:1,maxItems:5},mechanicProof:{type:'string'}},required:['id','clue','response','aliases','mechanicProof']};
const repairCategorySchema={type:'object',additionalProperties:false,properties:{name:{type:'string'},clues:{type:'array',minItems:5,maxItems:5,items:{type:'object',additionalProperties:false,properties:{clue:{type:'string',minLength:1,maxLength:MAX_CLUE_CHARS},response:{type:'string'},aliases:{type:'array',items:{type:'string'},minItems:1,maxItems:5},mechanicProof:{type:'string'}},required:['clue','response','aliases','mechanicProof']}}},required:['name','clues']};
const repairFinalSchema={type:'object',additionalProperties:false,properties:{category:{type:'string'},clue:{type:'string',minLength:1,maxLength:MAX_CLUE_CHARS},response:{type:'string'},aliases:{type:'array',items:{type:'string'},minItems:1,maxItems:5}},required:['category','clue','response','aliases']};

async function repairGeneratedGame(...args){return withGenerationBudget(()=>repairGeneratedGameWithinBudget(...args));}

async function repairGeneratedGameWithinBudget(game, priorRecords = [], priorCategories = []) {
  const initialIssues = generatedGameIssues(game, priorRecords, priorCategories);
  if (!initialIssues.length) return game;

  const initiallyBadCategories = new Set(
    initialIssues
      .filter((issue) => issue.kind === 'category')
      .map((issue) => `${issue.round}:${issue.category}`)
  );
  const initiallyBadClues = new Set(
    initialIssues
      .filter((issue) => issue.kind === 'clue')
      .map((issue) => `${issue.round}:${issue.category}:${issue.clue}`)
  );
  const initiallyBadFinal = initialIssues.some((issue) => issue.kind === 'final');

  const canTouch = (issue) => {
    if (issue.kind === 'final') return initiallyBadFinal;
    if (issue.kind === 'category') return initiallyBadCategories.has(`${issue.round}:${issue.category}`);
    if (issue.kind === 'clue') {
      return initiallyBadCategories.has(`${issue.round}:${issue.category}`)
        || initiallyBadClues.has(`${issue.round}:${issue.category}:${issue.clue}`);
    }
    return false;
  };

  const titleSchema = {
    type: 'object',
    additionalProperties: false,
    properties: { name: { type: 'string' } },
    required: ['name']
  };

  for (let pass = 0; pass < 2; pass++) {
    const issues = generatedGameIssues(game, priorRecords, priorCategories);
    if (!issues.length) return game;

    if (issues.some((issue) => !canTouch(issue))) {
      throw new Error('Targeted repair tried to invalidate content that was previously good.');
    }

    const beforeRepair = structuredClone(game);
    const boardRecords = gameClueRecords(game);
    const boardClues = boardRecords.map((item) => item.clue);
    const boardResponses = boardRecords.map((item) => item.response);
    const boardCategories = gameCategories(game);

    const categoryIssues = issues.filter((issue) => issue.kind === 'category');
    for (const issue of categoryIssues) {
      const current = game.rounds[issue.round].categories[issue.category];
      let replacementCategory = null;

      if (/category title|category topic/i.test(issue.reason || '')) {
        const shell = structuredClone(game);
        shell.rounds[issue.round].categories.splice(issue.category, 1);
        const lockedRecords = [...priorRecords, ...gameClueRecords(shell)];
        const lockedCategories = [...priorCategories, ...gameCategories(shell)];

        for (let attempt = 0; attempt < 1 && !replacementCategory; attempt++) {
          const renamed = await requestStructured(
            'jeopardy_category_title_repair',
            titleSchema,
            'Rename this Jeopardy category while preserving all five supplied clues exactly. The new title must accurately describe all five clues, must not exactly duplicate another title on this board, and must not impose a Starts With, Before & After, rhyme, letter-count, quotation, or other mechanic unless the five existing responses already satisfy it. Return only the new category name.',
            JSON.stringify({
              round: issue.round ? 'DOUBLE JEOPARDY!' : 'JEOPARDY!',
              invalidName: current.name,
              clues: current.clues,
              reason: issue.reason,
              avoidCategories: lockedCategories.slice(-500)
            }),
            1000
          );
          const candidate = { ...current, name: renamed.name };
          if (categoryValidAgainst(candidate, lockedRecords, lockedCategories)) replacementCategory = candidate;
        }
      }

      if (!replacementCategory) {
        replacementCategory = await requestStructured(
          'jeopardy_category_repair',
          repairCategorySchema,
          'Replace one invalid Jeopardy category with a different title and five authentic broadcast-style clues. Preserve the requested round difficulty. Broad subject areas may recur. Choose a fresh category title and fresh clues, facts, and responses, but do not reject a useful history, science, geography, literature, arts, entertainment, sports, food, language, nature, or other broad domain merely because that domain appeared before. Never reuse a supplied clue, response, or obvious near-duplicate. Clues must be concise declarative statements, not questions, and must not contain their response or a complete substantive alias. Aliases must be genuine equivalents only. Use mechanicProof "standard" unless this is a valid BEFORE & AFTER category.',
          JSON.stringify({
            round: issue.round ? 'DOUBLE JEOPARDY!' : 'JEOPARDY!',
            invalidCategory: current,
            reason: issue.reason,
            avoidCategories: [...priorCategories, ...boardCategories].slice(-500),
            avoidClues: [...priorRecords.map((item) => typeof item === 'string' ? item : item.clue), ...boardClues].slice(-900),
            avoidResponses: boardResponses.slice(-900)
          }),
          5000
        );
      }

      game.rounds[issue.round].categories[issue.category] = replacementCategory;
    }

    const clueIssues = issues.filter((issue) => issue.kind === 'clue');
    if (clueIssues.length) {
      const schema = {
        type: 'object',
        additionalProperties: false,
        properties: {
          repairs: {
            type: 'array',
            minItems: clueIssues.length,
            maxItems: clueIssues.length,
            items: repairClueSchema
          }
        },
        required: ['repairs']
      };

      const requests = clueIssues.map((issue) => {
        const category = game.rounds[issue.round].categories[issue.category];
        return {
          id: `${issue.round}:${issue.category}:${issue.clue}`,
          round: issue.round ? 'DOUBLE JEOPARDY!' : 'JEOPARDY!',
          value: (issue.round ? [400, 800, 1200, 1600, 2000] : [200, 400, 600, 800, 1000])[issue.clue],
          category: category.name,
          invalid: category.clues[issue.clue],
          reason: issue.reason
        };
      });

      const result = await requestStructured(
        'jeopardy_clue_repairs',
        schema,
        'Repair only the listed invalid Jeopardy clues. Return exactly one replacement per id. Match each category and dollar-value difficulty. Use compact, natural, declarative broadcast wording with a uniquely correct response. Never expose the response or its distinctive root in the clue. Do not reuse any supplied clue or response. Aliases must be genuine equivalents only. Obey Starts With and every other category mechanic; for BEFORE & AFTER, supply an exact FIRST ANSWER || SECOND ANSWER || SHARED BRIDGE proof.',
        JSON.stringify({
          requests,
          avoidClues: [...priorRecords.map((item) => typeof item === 'string' ? item : item.clue), ...boardClues].slice(-900),
          avoidResponses: boardResponses.slice(-900)
        }),
        Math.max(3000, clueIssues.length * 500)
      );

      const byId = new Map(result.repairs.map((item) => [item.id, item]));
      for (const issue of clueIssues) {
        const id = `${issue.round}:${issue.category}:${issue.clue}`;
        const item = byId.get(id);
        if (!item) continue;
        const replacementClue = { ...item };
        delete replacementClue.id;
        game.rounds[issue.round].categories[issue.category].clues[issue.clue] = replacementClue;
      }
    }

    if (issues.some((issue) => issue.kind === 'final')) {
      const finalIssue = issues.find((issue) => issue.kind === 'final');
      game.final = await requestStructured(
        'final_jeopardy_repair',
        repairFinalSchema,
        'Replace one invalid Final Jeopardy item with a fresh category and authentic clue. Use one concise declarative statement, two useful facts, and one uniquely gettable response. Do not reuse supplied clues or responses, and never expose the response or its root in the clue. Broad Final Jeopardy subject areas may recur; use a fresh category title and tested fact rather than avoiding an entire subject domain. Aliases must be genuine equivalents only.',
        JSON.stringify({
          invalid: game.final,
          reason: finalIssue.reason,
          avoidCategories: [...priorCategories, ...boardCategories].slice(-500),
          avoidClues: [...priorRecords.map((item) => typeof item === 'string' ? item : item.clue), ...boardClues].slice(-900),
          avoidResponses: boardResponses.slice(-900)
        }),
        2500
      );
    }

    const afterIssues = generatedGameIssues(game, priorRecords, priorCategories);
    if (afterIssues.some((issue) => !canTouch(issue))) {
      game = beforeRepair;
      continue;
    }
  }

  throw new Error('Generated game failed validation after protected targeted repairs');
}

function categoryValidAgainst(category,priorRecords=[],priorCategories=[]){
  if(!category?.name||category.clues?.length!==5)return false;
  // Regenerate only when the category itself is unusable. Clue-level problems
  // are deliberately deferred to generatedGameIssues()/repairGeneratedGame(),
  // which can replace just the bad clue instead of throwing away five good ones.
  if(gameHasCategoryRepeat({rounds:[{categories:[category]}]},priorCategories))return false;
  if(!category.clues.every(item=>clueLengthValid(item.clue)&&item.response))return false;
  return true;
}

async function generateCategory(round,index,priorRecords,priorCategories,plan=null){
  let lastError;
  for(let attempt=1;attempt<=2;attempt++)try{
    const category=await requestStructured('jeopardy_category',repairCategorySchema,`${EDITORIAL_GUIDE}\nWrite one family-safe category with exactly five authentic Jeopardy clues for the ${round} round. The five clues are ordered from easiest to hardest. Each clue is a compact declarative statement whose missing subject is the response, never a textbook question or an instruction to name something. Use natural broadcast-ready syntax, varied openings, occasional wit, and no more than ${MAX_CLUE_WORDS} words or ${MAX_CLUE_CHARS} characters. Every clue must point uniquely to a concise canonical response, genuinely fit the category, and contain neither its response nor the complete response. Aliases are only genuine equivalents, never related concepts. Broad subject areas may and should recur across games. History, geography, literature, science, nature, language, arts, music, film and TV, sports, food, mythology, religion, technology, everyday life, architecture, transportation, famous people, and wordplay are all reusable domains. Keep clue wording and the fact tested fresh; familiar category titles may recur in later games; avoid exact or near-duplicate clues and obvious repeats, but do not avoid a broad topic merely because an earlier category used the same field. Classic wordplay is welcome only when every clue obeys the mechanic. BEFORE & AFTER must combine two real answers on one exact shared bridge and use mechanicProof "FIRST ANSWER || SECOND ANSWER || SHARED BRIDGE". For all other categories use mechanicProof "standard". Enforce every Starts With, Ends With, rhyme, letter-count, or quotation-mark rule across all five responses. Return only schema-valid JSON after checking all five clues.`,JSON.stringify({seed:crypto.randomUUID(),round,categorySlot:index+1,categoryPlan:plan,avoidCategories:priorCategories.slice(-60),avoidClues:priorRecords.slice(-350).map(item=>typeof item==='string'?item:item.clue)}),3500);
    if(categoryValidAgainst(category,priorRecords,priorCategories))return category;
    lastError=new Error(`Category ${index+1} failed validation`);
  }catch(error){lastError=error;}
  throw new Error(lastError?.message||`Category ${index+1} could not be generated`);
}

async function generateGame(...args){return withGenerationBudget(()=>generateGameWithinBudget(...args));}

async function generateGameWithinBudget(avoid=[],avoidCategories=[],onProgress=()=>{}){
  if(!process.env.OPENAI_API_KEY)throw new Error('No OpenAI key');
  const knownRecords=[...avoid],knownCategories=[...avoidCategories],rounds=[],boardPlan=createBoardPlan();
  for(let roundIndex=0;roundIndex<2;roundIndex++){
    const title=roundIndex?'DOUBLE JEOPARDY!':'JEOPARDY!',categories=[];
    for(let categoryIndex=0;categoryIndex<6;categoryIndex++){
      onProgress(roundIndex*6+categoryIndex,13);
      const category=await generateCategory(title,categoryIndex,knownRecords,knownCategories,boardPlan[roundIndex][categoryIndex]);
      categories.push(category);knownCategories.push(category.name);knownRecords.push(...gameClueRecords({rounds:[{categories:[category]}]}));
    }
    rounds.push({title,categories,dailyDoubles:[]});
  }
  let final,lastError;onProgress(12,13);
  for(let attempt=0;attempt<2;attempt++)try{
    final=await generateFinalClue(knownRecords.map(item=>typeof item==='string'?item:item.clue),knownCategories);
    const shell={rounds:[],final};if(!gameHasCategoryRepeat(shell,knownCategories)&&!gameHasDuplicate(shell,knownRecords))break;
    final=null;lastError=new Error('Final Jeopardy repeated a prior clue, response, or category.');
  }catch(error){lastError=error;}
  if(!final)throw lastError||new Error('Final Jeopardy could not be generated.');
  rounds[0].dailyDoubles=[[Math.floor(Math.random()*6),1+Math.floor(Math.random()*4)]];const first=[Math.floor(Math.random()*6),1+Math.floor(Math.random()*4)];let second;do second=[Math.floor(Math.random()*6),1+Math.floor(Math.random()*4)];while(second[0]===first[0]&&second[1]===first[1]);rounds[1].dailyDoubles=[first,second];
  let game={rounds,final,styleVersion:'archive-breadth-v2'},issues=generatedGameIssues(game,avoid,avoidCategories);
  if(issues.length)try{game=await repairGeneratedGame(game,avoid,avoidCategories);}catch(error){error.salvageGame=game;throw error;}
  issues=generatedGameIssues(game,avoid,avoidCategories);const valid=validateGame(game),duplicate=gameHasDuplicate(game,avoid),repeatedCategory=gameHasCategoryRepeat(game,avoidCategories);
  if(!valid||duplicate||repeatedCategory||issues.length){const error=new Error(`Final assembly check failed: ${JSON.stringify({valid,duplicate,repeatedCategory,issues:issues.slice(0,8)})}`);error.salvageGame=game;throw error;}
  onProgress(13,13);return game;
}

async function generateFinalClue(avoid=[],avoidCategories=[]){
  consumeGenerationRequest();
  if(!process.env.OPENAI_API_KEY)throw new Error('OpenAI is required to prepare a fresh Final Jeopardy clue.');
  const schema={type:'object',additionalProperties:false,properties:{category:{type:'string'},clue:{type:'string',minLength:1,maxLength:MAX_CLUE_CHARS},response:{type:'string'},aliases:{type:'array',items:{type:'string'},minItems:1,maxItems:5}},required:['category','clue','response','aliases']};
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(90000),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5-mini',max_output_tokens:4000,instructions:`${EDITORIAL_GUIDE}\nWrite one fresh, family-safe Final Jeopardy clue in authentic broadcast style: one compact declarative statement, two useful pieces of information, one uniquely gettable canonical response, and no textbook-question phrasing. It must be no more than ${MAX_CLUE_WORDS} words and ${MAX_CLUE_CHARS} characters. Make it challenging through knowledge and inference, not needless obscurity. Aliases must be genuine acceptable equivalents, never related concepts. Never include the response, a complete substantive alias in the clue. Prefer stable facts over current events. History, politics, brands, everyday life, religion, and language are legitimate subjects; do not arbitrarily exclude them. Avoid wordplay that cannot be solved from the clue. Never repeat a prior clue or tested fact, but broad Final Jeopardy subject areas may recur; a category such as history, literature, science, geography, arts, or famous people is acceptable even when that broad domain appeared before. Return only schema-valid JSON.`,input:`Fresh Final Jeopardy test seed ${crypto.randomUUID()}. Never repeat these prior clues:\n${avoid.slice(-350).join('\n')}\n\nRecent category titles for variety only; recurring titles and broad subjects are allowed:\n${avoidCategories.slice(-60).join('\n')}`,text:{format:{type:'json_schema',name:'final_jeopardy_clue',strict:true,schema}}})});
  if(!response.ok)throw new Error(`OpenAI could not prepare the clue (${response.status}).`);const data=await response.json(),output=responseText(data);if(!output)throw new Error(`OpenAI returned no Final Jeopardy JSON (${data.status||'unknown status'}).`);const item=JSON.parse(output);
  if(!item.category||!clueLengthValid(item.clue)||!item.response||!clueDoesNotRevealResponse(item))throw new Error('Generated Final Jeopardy clue failed validation.');return item;
}

async function judgeResponse(given,item,{allowPrompt=true}={}){
  if(locallyCorrect(given,item))return {decision:'correct',verdict:'exact_equivalent'};
  if(!plausibleVariant(given,item))return {decision:'incorrect',verdict:'unrelated'};
  const localPrompt=locallyNeedsMoreSpecific(given,item);
  if(!process.env.OPENAI_API_KEY)return {decision:allowPrompt&&localPrompt?'prompt':'incorrect',verdict:localPrompt?'needs_more_specific':'related_but_different'};
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_JUDGE_MODEL||'gpt-5-mini',instructions:'Act as a strict Jeopardy judge. Correct means the contestant named the same person, place, object, title, species, or term as the canonical response or a genuine alias. Accept harmless articles, singular/plural changes, obvious minor spelling or speech-recognition errors (including “Octoberfest” for “Oktoberfest”), surnames when unambiguous, and omitted nonessential qualifiers when the remaining name still identifies the same unique answer—for example, “Pyrimid of Giza” for “Great Pyramid of Giza.” Use needs_more_specific only when the response is a broader class that could become uniquely correct by adding a missing qualifier—for example, “elephant” for “African elephant.” Reject a different member of the same category, a related concept, a description, or a merely plausible response. Rhinoceros is NOT narwhal. Atmospheric pressure gauge is NOT barometer. Similar subject matter is never enough. The correct boolean is true only for exact_equivalent or harmless_variant.',input:JSON.stringify({clue:item.clue,expected:item.response,aliases:item.aliases||[],given}),text:{format:{type:'json_schema',name:'judgment',strict:true,schema:{type:'object',additionalProperties:false,properties:{verdict:{type:'string',enum:['exact_equivalent','harmless_variant','needs_more_specific','related_but_different','unrelated']},correct:{type:'boolean'}},required:['verdict','correct']}}}})});
    if(!response.ok)throw new Error('Judge request failed');const data=await response.json(),output=responseText(data);if(!output)throw new Error('Judge returned no result');const result=JSON.parse(output);
    if(result.correct===true&&['exact_equivalent','harmless_variant'].includes(result.verdict))return {decision:'correct',verdict:result.verdict};
    if(allowPrompt&&result.verdict==='needs_more_specific')return {decision:'prompt',verdict:result.verdict};
    return {decision:'incorrect',verdict:result.verdict};
  }catch{return {decision:allowPrompt&&localPrompt?'prompt':'incorrect',verdict:localPrompt?'needs_more_specific':'related_but_different'};}
}
async function judge(given,item){return (await judgeResponse(given,item,{allowPrompt:false})).decision==='correct';}

module.exports={recordsRepeat,FALLBACK_GAME,EMERGENCY_GAME,MAX_CLUE_CHARS,MAX_CLUE_WORDS,BOARD_GENERATION_TIMEOUT_MS,normalize,clueFingerprint,responseText,gameClueRecords,gameCategories,gameHasCategoryRepeat,categoryTopicTokens,categoriesOverlap,gameHasCategoryOverlap,gameHasResponseRepeat,gameHasDuplicate,locallyCorrect,plausibleVariant,locallyNeedsMoreSpecific,categoryRuleValid,beforeAfterValid,clueLengthValid,clueDoesNotRevealResponse,generatedGameIssues,repairGeneratedGame,validateGame,generateGame,generateFinalClue,judgeResponse,judge};
