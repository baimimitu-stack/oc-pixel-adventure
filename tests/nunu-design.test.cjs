const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const { load } = require('./nunu-design-harness.cjs');
test('脸和身体可以内缩：轮廓、纸样、模型一起缩小且配缝仍等长',()=>{
 const c=load(),D=c.NunuDesign,base=c.NunuPattern.cookie,d=D.initial(base),box=c.NunuCore.boxOfPoly;
 const before=D.template(base,d),face0=box(before.pieces[0].poly),body0=box(d.objects[0].poly);
 D.resize(d,'face',0.8);D.resize(d,'body',0.8);
 const after=D.template(base,d),face1=box(after.pieces[0].poly);
 assert.ok(Math.abs(face1.w/face0.w-0.8)<1e-6);
 assert.ok(Math.abs(box(d.objects[0].poly).w/body0.w-0.8)<1e-6);
 const extent=p=>{const xs=p.mesh.pos.filter((_,i)=>i%3===0);return Math.max(...xs)-Math.min(...xs);};
 assert.ok(Math.abs(extent(after.pieces[0])/extent(before.pieces[0])-0.8)<1e-6);
 for(const s of after.seams)assert.ok(Math.abs(s.a-s.b)<1e-6,s.name);
});
test('发片和衣服反片实际位于模型背面，不与正片挤在同一面',()=>{
 const c=load(),D=c.NunuDesign,d=D.initial(c.NunuPattern.cookie);
 for(const layer of ['clothes','hair'])D.add(d,layer,[[130,110],[200,110],[200,170],[130,170]],'#554433');
 const t=D.template(c.NunuPattern.cookie,d);
 for(const p of t.pieces.filter(p=>p.accessory)){
  const zs=p.mesh.pos.filter((_,i)=>i%3===2);
  assert.ok(p.id.endsWith('front')?Math.min(...zs)>0:Math.max(...zs)<0,p.id);
 }
});
test('直接改不规则脸型：出片使用新轮廓，后片镜像、省道等长，不回退成圆脸',()=>{
 const c=load(),D=c.NunuDesign,base=c.NunuPattern.cookie,d=D.initial(base);
 const shape=[[130,100],[240,85],[290,130],[280,200],[230,275],[170,250],[100,180]];
 D.reshape(d,'face',shape);
 const t=D.template(base,d),a=t.pieces[0],b=t.pieces[1];
 assert.match(a.name,/自定义/);assert.notEqual(a.poly.length,base.pieces[0].poly.length);
 for(let i=0;i<a.poly.length;i++)assert.ok(Math.abs(a.poly[i][0]-a.design.dx+b.poly[i][0]-b.design.dx-400)<1e-7);
 for(const s of t.seams)assert.ok(Math.abs(s.a-s.b)<1e-6,s.label);
 for(const p of [a,b])assert.ok(p.mesh.pos.every(Number.isFinite));
 D.resize(d,'face',0.8);const small=D.template(base,d);
 assert.ok(c.NunuCore.boxOfPoly(small.pieces[0].poly).w<c.NunuCore.boxOfPoly(a.poly).w);
});
test('四层：新增发片叠放、独立彩绘、保存重开，出片数量与镜像对应',()=>{
 const c=load(),D=c.NunuDesign,base=c.NunuPattern.cookie,d=D.initial(base);
 const a=D.add(d,'hair',[[50,80],[190,70],[170,130],[70,150]],'#49372f');
 const b=D.add(d,'hair',[[190,70],[300,80],[340,150],[230,140]],'#604237');
 const clothing=D.add(d,'clothes',[[160,320],[245,320],[230,360],[160,365]],'#558899');
 d.objects.find(o=>o.id===a).front.push({color:'#ffffff',width:4,points:[[80,100],[130,110]]});
 D.move(d,a,1);assert.equal(D.ordered(d).at(-1).id,a);
 const saved=JSON.parse(JSON.stringify(d)),tpl=D.template(base,saved),doc=c.NunuCore.makeDoc(tpl);
 assert.equal(tpl.pieces.length,8);assert.equal(tpl.pieces.filter(p=>p.bonded).length,4);   // 发片是一整片有厚度的毛料，只裁 1 片；衣服仍是正反两片
 const front=doc.byId[`design-${a}-front`];
 assert.equal(front.design.strokes.length,1);assert.ok(!doc.byId[`design-${a}-back`],'发片没有反片');
 const cf=doc.byId[`design-${clothing}-front`],cb=doc.byId[`design-${clothing}-back`];
 for(let i=0;i<cf.poly.length;i++)assert.ok(Math.abs((cf.poly[i][0]-cf.design.dx)+(cb.poly[i][0]-cb.design.dx)-400)<1e-8);
 assert.equal(cf.partner,cb.id);
 for(const p of tpl.pieces){assert.ok(p.mesh.pos.every(Number.isFinite));assert.ok(p.mesh.idx.every(i=>i>=0 && i<p.mesh.pos.length/3));}
 for(const s of tpl.seams)assert.ok(Math.abs(s.a-s.b)<1e-6,s.name);
 const bom=c.NunuCore.bom(doc,{}, {faceMm:100});assert.ok(bom.rows.some(r=>r.id===`design-${clothing}-front`&&r.hex==='#558899'&&/衣服/.test(r.fabric)));
 assert.equal(D.valid([[0,0],[100,100],[0,100],[100,0]]),false);
 assert.throws(()=>D.add(d,'body',[[0,0],[100,100],[0,100],[100,0]],'#fff'));
 assert.equal(d.objects.find(o=>o.id===b).front.length,0,'一片上的彩绘不串到别的片');
});
const { mountApp } = require('./nunu-design-harness.cjs');

test('「＋ 一对耳朵」真的长出两只耳朵，并且在身体层里', () => {
  const app = mountApp(), saved = () => app.calls.change;
  app.click('daction', 'ears');
  const ears = saved().objects.filter(o => o.kind === 'ear');
  assert.equal(ears.length, 2, '点一次出两只耳朵');
  assert.equal(ears[0].layer, 'body');
  app.click('daction', 'ears');
  assert.equal(saved().objects.filter(o => o.kind === 'ear').length, 2, '再点一次不会叠出第二对');
  app.click('daction', 'undo');
  assert.equal(saved().objects.filter(o => o.kind === 'ear').length, 0, '撤销把这批耳朵收回去');
});

test('改形状之后工具停在「改形状」，不会被踢回彩绘', () => {
  const app = mountApp();
  app.click('daction', 'overview');
  app.click('dlayer', 'hair');
  assert.equal(app.reg.get('#designCanvas').disabled, false);
  app.click('daction', 'addPart');
  const shape = [[100, 80], [300, 70], [320, 170], [90, 180]];
  app.drawShape(shape);
  assert.equal(app.calls.change.objects.filter(o => o.layer === 'hair').length, 1, '画出一枚发片');
  assert.equal(app.groups['[data-dtool]'].find(b => b.dataset.dtool === 'outline').classList.on, true, '工具仍停在「改形状」，没有被踢回彩绘');
  // 关键：再画一圈应该继续覆盖这片发片，而不是又新增一片
  app.drawShape([[110, 90], [290, 85], [295, 165], [100, 170]]);
  assert.equal(app.calls.change.objects.filter(o => o.layer === 'hair').length, 1, '第二次仍在改同一片，没有多冒一层');
});

test('彩绘只写在当前这一面，背面不跟着同步', () => {
  const app = mountApp();
  app.reg.get('#designMirror').checked = false;   // 关掉对称，专测正反面互不影响
  app.click('daction', 'overview');
  app.click('dlayer', 'hair');
  app.click('daction', 'addPart');
  app.drawShape([[100, 80], [300, 70], [320, 170], [90, 180]]);
  app.click('dtool', 'paint');
  const hair = () => app.calls.change.objects.find(o => o.layer === 'hair');
  app.drawStroke([[150, 110], [250, 110]]);
  assert.equal(hair().front.length, 1, '正面留下笔迹');
  assert.equal(hair().back.length, 0, '背面没有被同步画上');
  app.click('dside', 'back');
  app.drawStroke([[150, 110], [250, 110]]);
  assert.equal(hair().front.length, 1, '发片是单面的整片毛料：正面那片在背面视图里是看不见的，背面画的笔迹不会落到它身上');
  assert.equal(hair().back.length, 0, '发片不存「背面笔迹」');
  assert.ok(!hair().onBack, '正面那片没有被挪到背面');
  // 整片涂色也只涂当前面
  app.click('dside', 'front');
  const beforeColor = hair().backColor;
  app.click('daction', 'fill');
  assert.equal(app.calls.change.objects.find(o => o.layer === 'hair').backColor, beforeColor, '整片涂色只涂正面，背面颜色不动');
});

test('左右对称一起画：同一面出现镜像的两笔', () => {
  const app = mountApp();
  app.click('daction', 'overview');
  app.click('dlayer', 'hair');
  app.click('daction', 'addPart');
  app.drawShape([[60, 80], [340, 70], [345, 180], [55, 185]]);
  app.click('dtool', 'paint');
  app.drawStroke([[130, 120], [140, 130]]);
  const hair = app.calls.change.objects.find(o => o.layer === 'hair');
  assert.equal(hair.front.length, 2, '对称打开时一笔变两笔');
  const [a, b] = hair.front;
  assert.ok(Math.abs((a.points.at(-1)[0] + b.points.at(-1)[0]) - 400) < 1e-6, '两笔关于对称轴 200 互为镜像');
  app.reg.get('#designMirror').checked = false;
  app.drawStroke([[300, 120], [310, 130]]);
  assert.equal(app.calls.change.objects.find(o => o.layer === 'hair').front.length, 3, '关掉对称就只画一笔');
});

test('发片可以一层层往上叠，也挡不住再加衣服', () => {
  const app = mountApp();
  app.click('daction', 'overview');
  app.click('dlayer', 'hair');
  app.click('daction', 'addPart');
  app.drawShape([[60, 80], [200, 70], [205, 170], [55, 175]]);
  app.click('daction', 'addPart');
  app.drawShape([[200, 80], [340, 75], [348, 180], [195, 178]]);
  assert.equal(app.calls.change.objects.filter(o => o.layer === 'hair').length, 2, '同一层叠出两片发片');
  app.click('dlayer', 'clothes');
  app.click('daction', 'addPart');
  app.drawShape([[150, 300], [255, 300], [250, 360], [155, 362]]);
  assert.equal(app.calls.change.objects.filter(o => o.layer === 'clothes').length, 1, '切到衣服层照样能新增');
});

test('切到空图层直接等着画，不用再多点一次按钮', () => {
  const app = mountApp();
  app.click('daction', 'overview');
  app.click('dlayer', 'clothes');
  app.drawShape([[150, 300], [255, 300], [250, 360], [155, 362]]);
  assert.equal(app.calls.change.objects.filter(o => o.layer === 'clothes').length, 1, '空层里画一圈直接就是新的一层');
});

test('同一侧画的圈：按画的样子留下，不硬掰成对称，也不顶掉旁边那片', () => {
  // 契约变过一次，写清楚为什么：
  //   以前「勾了对称但整圈画在轴一侧」会被判非法、整圈拒绝 —— 画的人一头雾水（「莫名其妙给我撤回」）。
  //   现在：对称算不出来就按你画的样子留下，另外那片一根汗毛都不动。
  const app = mountApp();
  app.click('daction', 'overview');
  app.click('dlayer', 'hair');
  app.click('daction', 'addPart');
  app.drawShape([[60, 80], [190, 70], [195, 170], [55, 175]]);
  const first = JSON.stringify(app.calls.change.objects.filter(o => o.layer === 'hair')[0]);
  app.drawShape([[60, 200], [190, 195], [192, 260], [58, 262]]);
  const after = app.calls.change.objects.filter(o => o.layer === 'hair');
  assert.equal(JSON.stringify(after[0]), first, '原来那片没被悄悄替换');
  assert.ok(after.length >= 1, '新画的那圈留下来了（要么并进去，要么成新的一片）');
  assert.doesNotMatch(app.status(), /没替换|非法|拒绝/, '不再用驳回的话打发人');
});


test('撤销重做、清空、新建与回到裁片视图', () => {
  const app = mountApp();
  app.click('daction', 'overview');
  app.click('dlayer', 'hair');
  app.click('daction', 'addPart');
  app.drawShape([[60, 80], [200, 70], [205, 170], [55, 175]]);
  app.click('daction', 'undo');
  assert.equal(app.calls.change.objects.filter(o => o.layer === 'hair').length, 0, '撤销删掉刚加的发片');
  app.click('daction', 'redo');
  assert.equal(app.calls.change.objects.filter(o => o.layer === 'hair').length, 1, '重做把它找回来');
  app.click('daction', 'clear');
  assert.equal(app.calls.change.objects.length, 2, '清空回到只有身体和脸');
  app.click('daction', 'undo');
  assert.equal(app.calls.change.objects.filter(o => o.layer === 'hair').length, 1, '清空也能撤销');
  const flushBefore = app.calls.flush;
  app.click('daction', 'paper');
  assert.equal(app.calls.flush, flushBefore + 1, '回到裁片视图会把设计刷进 3D');
});

test('全局撤销重做入口在设计视图转发给设计历史，旧视图仍使用原历史',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/games/nunu-studio/app.js'),'utf8'),calls=[];
 let hidden=false;
 const ctx={window:{__nunu:{designer:{undo:()=>calls.push('design-undo'),redo:()=>calls.push('design-redo')}}},$:()=>({hidden}),ui:{mode:'doll'},history:[],redoStack:[],toast:s=>calls.push(s)};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function undo()'),source.indexOf('function refreshStrokes(')),ctx);
 ctx.undo();ctx.redo();assert.deepEqual(calls,['design-undo','design-redo']);
 hidden=true;ctx.undo();ctx.redo();assert.equal(calls.length,4);assert.match(calls[2],/没有可以撤销/);assert.match(calls[3],/没有可以重做/);
});
test('新建先保存旧作品；存储失败时不替换当前作品',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/games/nunu-studio/app.js'),'utf8');
 const store=new Map(),state={name:'原作品',template:'nunu-25d',tplData:{'nunu-25d':{design:{objects:[{id:'paint'}]},strokes:[]}}},field={value:'原作品'};
 let fail=false;
 // activateProject 会按 template 取当前图纸来造白坯，这里把两个外部依赖补成沙箱里的假货
 const P={cookie:{id:'nunu-25d'}};
 const ctx={state,STORE:'test',clone:x=>JSON.parse(JSON.stringify(x)),designData:()=>state.tplData['nunu-25d'],P,DEFAULTS:{template:'nunu-25d'},tplById:()=>P.cookie,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>{if(fail&&k==='test')throw Error('存储已满');store.set(k,v);}},clearTimeout(){},saveTimer:null,history:[],redoStack:[],$:()=>field,window:{NunuDesign:{initial:()=>({objects:[]})}}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('    const projectStore='),source.indexOf('    designer=window.NunuDesign.mount'))+'\nthis.archive=archiveCurrent;this.activate=activateProject;this.read=readProjects;',ctx);
 ctx.archive({objects:[{id:'paint'}]});assert.equal(ctx.read()[0].state.name,'原作品');
 fail=true;assert.throws(()=>ctx.activate({name:'新作品',tplData:{}}),/存储已满/);assert.equal(state.name,'原作品');assert.equal(field.value,'原作品');
 fail=false;ctx.activate({name:'新作品',tplData:{}});assert.equal(state.name,'新作品');assert.equal(ctx.read()[0].state.tplData['nunu-25d'].design.objects[0].id,'paint');
});
