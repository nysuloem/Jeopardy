const keyFor=item=>`${item.clue}\n${item.response}`;
const allowed=new Set(['who is','who are','what is','what are']);
function fallbackPrefix(item,category=''){
 if(allowed.has(item.responsePrefix))return item.responsePrefix;
 const response=String(item.response||''),framed=response.match(/^(who|what)\s+(is|are|was|were)\b/i);if(framed)return framed[0].toLowerCase();
 const text=String(item.clue||'');
 const person=/\b(this|that)\s+(?:[\w'-]+\s+){0,3}(man|woman|person|scientist|physicist|chemist|biologist|mathematician|astronomer|naturalist|polymath|inventor|president|prime minister|monarch|king|queen|emperor|author|novelist|poet|playwright|painter|artist|composer|actor|actress|singer|rapper|athlete|explorer|philosopher|leader|saint|god|goddess|biblical figure|giant slayer|character)\b/i;
 const group=/\b(these|those)\s+(?:[\w'-]+\s+){0,2}(men|women|people|scientists|authors|brothers|sisters|gods|goddesses|presidents|actors|artists)\b/i;
 if(group.test(text))return 'who are';
 if(/^(he|she|his|her)\b/i.test(text)||person.test(text))return 'who is';
 if(/^(?:great scientists|famous (?:people|canadians)|u\.?s\.? presidents|authors|composers)$/i.test(category))return 'who is';
 return /\bthese\b/i.test(text)?'what are':'what is';
}
function recordsFor(game){return [...game.rounds.flatMap(round=>round.categories.flatMap(category=>category.clues.map(item=>({item,category:category.name})))),{item:game.final,category:game.final.category}];}
async function prepareResponsePrefixes(room,{apiKey=process.env.OPENAI_API_KEY,fetcher=fetch,useAI=process.env.NODE_ENV!=='test'}={}){
 const records=recordsFor(room.game);room.responsePrefixes=Object.fromEntries(records.map(({item,category})=>[keyFor(item),fallbackPrefix(item,category)]));
 if(!apiKey||!useAI)return;
 try{
  const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_JUDGE_MODEL||'gpt-5-mini',reasoning:{effort:'low'},max_output_tokens:6000,instructions:'Classify the canonical RESPONSE to each Jeopardy clue. Use who is for an individual real/fictional/mythological person or deity; who are for a group of people. Use what is/what are for everything else, including places, titles of works, organizations, objects, animals and concepts. Classify what the answer itself names, not a person mentioned in the clue. A book or song named after a person remains what is. Return exactly one id and prefix per input; do not change the answers.',input:JSON.stringify(records.map(({item,category},id)=>({id,category,clue:item.clue,response:item.response}))),text:{format:{type:'json_schema',name:'response_prefixes',strict:true,schema:{type:'object',additionalProperties:false,properties:{responses:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:{type:'integer'},prefix:{type:'string',enum:[...allowed]}},required:['id','prefix']}}},required:['responses']}}}})});
  if(!response.ok)throw Error('Classification unavailable');const result=await response.json(),text=result.output_text||result.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
  for(const row of JSON.parse(text).responses||[])if(Number.isInteger(row.id)&&records[row.id]&&allowed.has(row.prefix))room.responsePrefixes[keyFor(records[row.id].item)]=row.prefix;
 }catch(error){console.warn('Response wording uses the local fallback:',error.message);}
}
const prefixFor=(room,item)=>room.responsePrefixes?.[keyFor(item)]||fallbackPrefix(item);
module.exports={prepareResponsePrefixes,prefixFor,fallbackPrefix,keyFor};
