(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JeopardyResponses=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const lead=/^(what|who|where|when|why|how)\s+(is|are|was|were)\b/i;
 function isQuestion(value){const text=String(value||'').trim(),match=text.match(lead);return !!match&&/[\p{L}\p{N}]/u.test(text.slice(match[0].length));}
 function questionResponse(value,prefix){let answer=String(value||'').trim().replace(/\?+$/,'');const match=answer.match(lead);if(match){answer=answer.slice(match[0].length).trim();prefix=prefix||match[0].toLowerCase();}return `${prefix||'what is'} ${answer}?`;}
 return {isQuestion,questionResponse};
});
