// Jeopardy! signaling: early presses block that contestant for 250 ms.
const EARLY_BUZZ_LOCKOUT_MS=250;
function resetBuzzers(room){room.buzzerLockouts={};}
function tryBuzz(room,playerId,now=Date.now()){
 const player=room.players.find(p=>p.id===playerId);
 if(!player||room.phase!=='clue'||room.buzzedId||room.attempted.includes(playerId))return {ok:false,reason:'unavailable'};
 room.buzzerLockouts??={};
 if(!room.canBuzz){if(!room.clueNeedsReading)return {ok:false,reason:'unavailable'};room.buzzerLockouts[playerId]=now+EARLY_BUZZ_LOCKOUT_MS;return {ok:false,reason:'early',retryAfterMs:EARLY_BUZZ_LOCKOUT_MS};}
 const remaining=(room.buzzerLockouts[playerId]||0)-now;
 if(remaining>0)return {ok:false,reason:'locked',retryAfterMs:remaining};
 room.buzzedId=playerId;room.canBuzz=false;
 return {ok:true};
}
module.exports={EARLY_BUZZ_LOCKOUT_MS,resetBuzzers,tryBuzz};
