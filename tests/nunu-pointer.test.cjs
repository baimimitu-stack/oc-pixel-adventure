const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../public/games/nunu-studio/app.js'),'utf8');
function setup(kind){
 const handlers={},calls=[],piece={id:'face',poly:[]};let hit={piece,local:{x:20,y:20},inSew:true},pick={pieceId:'face',x:20,y:20};
 const cv={style:{},classList:{toggle(){}},addEventListener:(k,v)=>handlers[k]=v};
 const sheet={resize(){},setDoc(){},toSheet:()=>({x:20,y:20}),pieceAt:()=>hit,localOn:()=>({inside:true,x:21,y:21}),pan:()=>calls.push('pan'),zoomAt:()=>calls.push('zoom')};
 const model={view:{zoom:1,rotY:0,rotX:0},resize(){},pick:()=>pick};
 const c={console,window:{addEventListener(){},NunuSheet:{create:()=>sheet},NunuModel:{create:()=>model}},document:{activeElement:{tagName:'CANVAS'}},$:()=>cv,$$:()=>[],ui:{mode:'doll',layer:'face',paint3d:true,hand:false,hairTarget:'base'},cur:null,rg:null,doc:{},boards:[],capture(){},cutMap(){},markSheet(){},selectPiece(){},updateHint(){},pickFilter(){},toast(){},toastBlocked(){},buildModel(){},dirty:{},schedule(){},startStroke(source){c.cur={src:source};calls.push('start');},feed(h){calls.push('feed:'+h.pieceId);},endStroke(){c.cur=null;calls.push('end');},breakStroke(){calls.push('break');}};
 vm.createContext(c);vm.runInContext('let sheet=null,model=null;'+(kind==='sheet'?src.slice(src.indexOf('function setupSheet()'),src.indexOf('/* ============ 3D 交互')):src.slice(src.indexOf('function setupModel()'),src.indexOf('/*',src.indexOf('function setupModel()')))),c);
 if(kind==='sheet')c.setupSheet();else c.setupModel();
 const event=(id=1)=>({pointerId:id,button:0,clientX:30,clientY:30,preventDefault(){}});
 return {handlers,calls,c,event,model,setHit:h=>hit=h,setPick:h=>pick=h};
}
test('旧努努纸样：笔画期间第二触点、滚轮不能移动画布或结束笔画',()=>{const f=setup('sheet'),h=f.handlers;h.pointerdown(f.event());h.pointerdown(f.event(2));h.pointermove(f.event(2));h.pointerup(f.event(2));h.wheel({...f.event(),deltaY:1});assert.deepEqual(f.calls,['start','feed:face']);h.pointermove(f.event());h.pointerup(f.event());assert.deepEqual(f.calls,['start','feed:face','feed:face','end']);});
test('旧努努纸样：彩绘落在空白处不拖动画布',()=>{const f=setup('sheet');f.setHit(null);f.handlers.pointerdown(f.event());f.handlers.pointermove({...f.event(),clientX:100});assert.ok(!f.calls.includes('pan'));});
test('旧努努3D：锁定开始的片和触点，不跨片画长线',()=>{const f=setup('model'),h=f.handlers;h.pointerdown(f.event());h.pointerdown(f.event(2));h.pointermove(f.event(2));h.pointerup(f.event(2));h.wheel({...f.event(),deltaY:-1});assert.equal(f.model.view.zoom,1);f.setPick({pieceId:'back',x:500,y:200});h.pointermove(f.event());assert.ok(f.calls.includes('break'));assert.ok(!f.calls.includes('feed:back'));h.pointerup(f.event());assert.equal(f.calls.at(-1),'end');});
