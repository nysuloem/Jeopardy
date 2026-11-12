'use strict';

// Saved boards predate archive-inspired-v1. Freeze their original admission
// rules so an editorial/generation update cannot silently confiscate stock.
// Exact played-clue and original fact-key protections still apply at play time.
const modern = require('./game');
const {clueFingerprint,gameClueRecords,gameHasCategoryRepeat,gameHasCategoryOverlap,gameHasResponseRepeat,beforeAfterValid} = modern;
const MAX_CLUE_CHARS=140,MAX_CLUE_WORDS=24;
const GENERIC_RESPONSE_WORDS=new Set(['answer','author','blood','book','capital','cell','century','city','country','diagram','event','film','instrument','island','king','lake','metal','mountain','national','nerve','novel','ocean','opera','park','person','place','planet','president','province','river','song','star','state','term','tower','wall','war','wind','word','year']);

function categoryRuleValid(category){
  const name=String(category?.name||''),match=name.match(/\b(?:starts?|begins?)\s+with\s+(?:the\s+letter\s+)?["'“”]?([a-z0-9])\b/i);
  return category.clues.every(item=>categoryClueRuleValid(category,item,match));
}

function categoryClueRuleValid(category,item,startsMatch=null){
  const name=String(category?.name||''),match=startsMatch||name.match(/\b(?:starts?|begins?)\s+with\s+(?:the\s+letter\s+)?["'“”]?([a-z0-9])\b/i);
  if(match){const required=match[1].toLowerCase();return String(item?.response||'').trim().replace(/^(?:the|a|an)\s+/i,'').replace(/^[^a-z0-9]+/i,'').toLowerCase().startsWith(required);}
  if(/\bbefore\s*(?:&|and)\s*after\b/i.test(name))return beforeAfterValid(item);
  return true;
}

function clueLengthValid(value){
  const text=String(value||'').trim();
  return !!text&&text.length<=MAX_CLUE_CHARS&&text.split(/\s+/).length<=MAX_CLUE_WORDS;
}

function answerWordRoot(value){
  let word=String(value||'').toLowerCase();
  if(word.length>5&&word.endsWith('ies'))word=`${word.slice(0,-3)}y`;
  else if(word.length>=5&&/(?:ches|shes|sses|xes|zes)$/.test(word))word=word.slice(0,-2);
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
  return !!(game?.rounds?.length===2&&game.rounds.every((r,ri)=>r.categories?.length===6&&r.categories.every(c=>c.name&&c.clues?.length===5&&c.clues.every(q=>clueLengthValid(q.clue)&&q.response&&clueDoesNotRevealResponse(q))&&categoryRuleValid(c))&&r.dailyDoubles?.length===(ri?2:1))&&game.final?.category&&clueLengthValid(game.final?.clue)&&game.final?.response&&clueDoesNotRevealResponse(game.final)&&!gameHasCategoryRepeat(game)&&!gameHasCategoryOverlap(game)&&!gameHasResponseRepeat(game));
}

function gameHasDuplicate(game,priorRecords=[]){
  const clues=new Set(priorRecords.map(x=>typeof x==='string'?clueFingerprint(x):x.fingerprint||clueFingerprint(x.clue)));
  const facts=new Set(priorRecords.map(x=>typeof x==='string'?'':x.factFingerprint||`${clueFingerprint(x.category)}|${clueFingerprint(x.response)}`).filter(x=>x&&x!=='|'));
  for(const item of gameClueRecords(game)){if(!item.fingerprint||clues.has(item.fingerprint)||facts.has(item.factFingerprint))return true;clues.add(item.fingerprint);facts.add(item.factFingerprint);}
  return false;
}

function isLegacyStoredGame(game){return !game?.styleVersion;}
function validateStoredGame(game){return isLegacyStoredGame(game)?validateGame(game):modern.validateGame(game);}
function storedGameHasDuplicate(game,priorRecords=[]){return isLegacyStoredGame(game)?gameHasDuplicate(game,priorRecords):modern.gameHasDuplicate(game,priorRecords);}
module.exports={isLegacyStoredGame,validateStoredGame,storedGameHasDuplicate};
