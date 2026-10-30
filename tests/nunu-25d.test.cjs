const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={console}; vm.createContext(ctx);
for(const f of ['nunu-shape.js','pattern-data.js','nunu-core.js','nunu-25d.js','nunu-hair.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/games/nunu-studio',f),'utf8'),ctx);
const C=ctx.NunuCore, tpl=ctx.NunuPattern.cookie;
test('饼干体：身体前后同形，只有头部有省道，周边及反口缝长配对',()=>{
 const doc=C.makeDoc(tpl),b=doc.pieces.filter(p=>/^身体/.test(p.name));
 assert.equal(doc.pieces.length,4);
 const local=p=>p.poly.map(q=>q.map((v,k)=>Math.round((v-(k?p.box.y:p.box.x))*1e7)));
 assert.deepEqual(local(b[0]),local(b[1]));
 assert.ok(b.every(p=>!p.seamEdges.some(e=>/^D/.test(e.label))));
 assert.ok(tpl.pieces.every(p=>p.quantity===1 && /裁1片/.test(p.name)));
 for(const s of tpl.seams) assert.ok(Math.abs(s.a-s.b)<1e-7,s.name);
 for(const p of doc.pieces.slice(0,2)) {
   assert.equal(p.material,'skin'); assert.equal(p.seamEdges.filter(e=>/^D/.test(e.label)).length,2);
   assert.ok(p.mesh.pos.every(Number.isFinite)); assert.ok(p.mesh.idx.every(i=>i<p.mesh.pos.length/3));
 }
 const boards=C.makeBoards(doc).boards;
 assert.ok(boards.some(p=>p.board==='front' && p.mesh));
 assert.ok(boards.some(p=>p.board==='back' && p.mesh));
 const front=C.pillowMesh(b[0],doc),back=C.pillowMesh(b[1],doc);
 assert.equal(front.pos.length,back.pos.length);
 assert.ok(front.pos.every(Number.isFinite));
});
test('2.5D 长发、辫子和披肩按薄片粘合，不生成发片返口缝',()=>{
 for(const style of ['long','braids','cape']) {
  const t=ctx.NunuHair.apply(tpl,{style,color:'#553322'}),d=C.makeDoc(t),hp=d.pieces.filter(p=>p.accessory);
  assert.ok(hp.length>0); assert.equal(t.seams.length,tpl.seams.length);
  for(const p of hp) {
   assert.equal(p.bonded,true); assert.equal(p.seamEdges.length,0);
   const q=d.byId[p.partner]; assert.ok(q);
   for(let i=0;i<p.mesh.pos.length;i+=3) {
    assert.ok(Math.abs(p.mesh.pos[i]-q.mesh.pos[i])<1e-9);
    assert.ok(Math.abs(Math.abs(p.mesh.pos[i+2]-q.mesh.pos[i+2])-0.016)<1e-9);
   }
  }
  assert.ok(t.attachments.some(a=>/背对背/.test(a.instruction)));
  const saved=JSON.parse(JSON.stringify({style,color:'#553322',hidden:['back']}));
  assert.ok(!ctx.NunuHair.apply(tpl,saved).pieces.some(p=>p.accessory==='back'));
 }
});
test('2.5D 配缝不等长会拦截，旧作品迁移保留所有笔迹',()=>{
 const doc=C.makeDoc(tpl);
 const checks=C.checks(doc,{}, {faceMm:100,seams:[{name:'故意不等长',a:100,b:101}]});
 assert.ok(checks.some(c=>c.level==='error' && /故意不等长/.test(c.text)));
 const source=fs.readFileSync(path.join(__dirname,'../public/games/nunu-studio/app.js'),'utf8');
 const old={version:4,template:'mesh-body',tplData:{'mesh-body':{strokes:[{p:'r1',pts:[1,2,3,4]}]}}};
 const sandbox={clone:x=>JSON.parse(JSON.stringify(x)),DEFAULTS:{version:4,studioMode:'2.5d',template:'nunu-25d'},STORE:'test',localStorage:{getItem:()=>JSON.stringify(old)}};
 vm.createContext(sandbox);vm.runInContext(source.slice(source.indexOf('function loadState()'),source.indexOf('function loadImports()')),sandbox);
 const state=sandbox.loadState();assert.equal(state.template,'nunu-25d');assert.deepEqual(JSON.parse(JSON.stringify(state.tplData)),old.tplData);
 old.studioMode='2.5d';old.designerVersion=1;assert.equal(sandbox.loadState().template,'mesh-body','迁移后用户仍可主动选择旧模板');
});
