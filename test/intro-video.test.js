const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../public/app.js'),'utf8');
function setup(play=()=>Promise.resolve()){
 const classes=new Set();let paused=false;
 const button={hidden:true},mediaSource={},video={play,pause(){paused=true;},querySelector(){return mediaSource;}};
 const target={innerHTML:'',querySelector(selector){return selector==='video'?video:button;}};
 const screen={classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}};
 const context={document:{querySelector:selector=>selector==='.intro-screen'?screen:target}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function playKenOpening('),source.indexOf('function playTrackSegment(')),context);
 const controller=new AbortController();const result=context.playKenOpening(controller.signal);
 return {result,video,button,target,controller,classes,isPaused:()=>paused};
}
test('opening waits for the full clip and clears it before contestant introductions',async()=>{
 const h=setup();assert.ok(h.target.innerHTML.includes('ken-opening-web.mp4'));assert.ok(h.classes.has('video-opening'));
 h.video.onended();assert.equal(await h.result,'ended');assert.equal(h.target.innerHTML,'');assert.equal(h.isPaused(),true);assert.equal(h.classes.size,0);
});
test('blocked autoplay offers a play button and resumes from a user gesture',async()=>{
 let attempts=0;const h=setup(()=>++attempts===1?Promise.reject({name:'NotAllowedError'}):Promise.resolve());
 await Promise.resolve();assert.equal(h.button.hidden,false);h.button.onclick();assert.equal(h.button.hidden,true);assert.equal(attempts,2);h.video.onended();assert.equal(await h.result,'ended');
});
test('leaving the intro stops video without continuing the opening',async()=>{
 const h=setup();h.controller.abort();assert.equal(await h.result,'cancelled');assert.equal(h.isPaused(),true);h.video.onended();assert.equal(h.target.innerHTML,'');
});
test('unavailable video permits the existing audio fallback',async()=>{
 const h=setup();h.video.onerror();assert.equal(await h.result,'failed');
});
