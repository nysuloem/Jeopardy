const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../public/app.js'),'utf8');
const helper=app.slice(app.indexOf('function layoutFinalResponse('),app.indexOf("window.addEventListener('resize'",app.indexOf('function layoutFinalResponse(')));
for(const era of ['trebek','jennings'])for(const [height,width] of [[1080,1300],[360,400]])test(`${era} ${height}px: full response and wager fit below the transformed money`,()=>{
 const offset=40,moneyBottom=offset+height*(era==='jennings'?.832:.695),style={top:'0px',fontSize:''},font=()=>parseFloat(style.fontSize)||90;
 const children=['Who is a very long contestant response that must wrap naturally across multiple lines without hiding any letters or covering the current total on the podium?', '$123,456'].map(text=>({get clientWidth(){return width;},get scrollWidth(){return width;},get clientHeight(){return this.scrollHeight;},get scrollHeight(){return Math.ceil(text.length*font()*.45/width)*font()*1.3;}}));
 const box={style,children,get clientHeight(){return height-parseFloat(style.top);},get scrollHeight(){return children.reduce((sum,c)=>sum+c.scrollHeight,24)+font()*.16;}};
 const root={getBoundingClientRect:()=>({top:offset,height}),querySelector:selector=>selector==='.final-response-overlay'?box:{getBoundingClientRect:()=>({bottom:moneyBottom})}};
 const c={document:{querySelector:()=>root},getComputedStyle:()=>({fontSize:'90px'})};vm.createContext(c);vm.runInContext(helper,c);c.layoutFinalResponse(false);
 assert(offset+parseFloat(style.top)>moneyBottom,'overlay clears the complete score box');assert(box.scrollHeight<=box.clientHeight+1,'both complete lines fit without scrolling');assert(font()<90,'long response reduces typography instead of hiding the total');
});
