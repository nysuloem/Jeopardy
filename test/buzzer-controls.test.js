const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../public/app.js'),'utf8');
test('reading permits early presses, pointer hold and key repeat do not signal repeatedly',()=>{
 const handlers={},messages=[],classes=new Set(),label={},button={isConnected:true,disabled:false,classList:{toggle:(k,v)=>v?classes.add(k):classes.delete(k)},addEventListener:(k,fn)=>handlers[k]=fn};
 let now=1000,timer;const state={code:'ABCDE',phase:'clue',round:0,selected:{category:0,row:0},attempted:[],canBuzz:false};
 const c={state,myId:'a',Date:{now:()=>now},document:{querySelector:s=>s==='#buzz'?button:label},clearTimeout(){},setTimeout(fn){timer=fn;},socket:{emit:(type,payload,reply)=>{messages.push({type,payload});reply({ok:false,reason:'early',retryAfterMs:250});}}};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('let buzzerLockedUntil='),source.indexOf('function wirePhone()')),c);c.wireBuzzer();
 assert.equal(button.disabled,false);assert.equal(button.textContent,'WAIT');
 handlers.pointerdown({button:0,preventDefault(){}});assert.equal(messages.length,1);assert.equal(messages[0].payload.clueKey,'0:0:0');assert.equal(button.textContent,'LOCKED · ¼ SEC');
 state.canBuzz=true;now=1251;timer();assert.equal(button.textContent,'BUZZ!');
 handlers.keydown({key:' ',repeat:true,preventDefault(){}});assert.equal(messages.length,1);
 handlers.click({detail:1});assert.equal(messages.length,1);handlers.keydown({key:'Enter',repeat:false,preventDefault(){}});assert.equal(messages.length,2);
});
