const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/games/nunu-studio/app.js'),'utf8');
test('清空四层设计后，3D纹理不能重新叠上旧版笔迹和发色',()=>{
 const old={strokes:[{p:'cookie-face',l:'face',pts:[1,2,3,4]},{p:'board-back',l:'hair',pts:[1,2,3,4]}],hairstyle:{style:'long',color:'#123456'},design:{objects:[]}};
 let legacyPaint=0,legacyFill=0,designPaint=0;
 const c={clearRect(){},save(){},restore(){},fill(){legacyFill++;}},r={layers:{},poly2d:{}};
 const ctx={td:()=>old,doc:{id:'nunu-25d',construction:'2.5d'},ensureRt:()=>r,layerCanvas:()=>({width:20,height:20,getContext:()=>c}),applyTf(){},paintStroke(){legacyPaint++;},C:{isFace:p=>p.id==='cookie-face'},window:{NunuDesign:{paint(){designPaint++;}}}};
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('const strokesOf ='),source.indexOf('\n',source.indexOf('const strokesOf =')))+source.slice(source.indexOf('function replayLayer('),source.indexOf('function replayAll(')),ctx);
 ctx.replayLayer({id:'cookie-face',material:'skin',design:{}},'face');
 ctx.replayLayer({id:'board-back',material:'skin'},'hair');
 ctx.replayLayer({id:'design-hair-front',material:'hair',design:{}},'hair');
 assert.equal(legacyPaint,0,'旧版画笔记录不能覆盖已清空的设计');
 assert.equal(legacyFill,0,'旧版发型底色不能覆盖设计');assert.equal(designPaint,2);
 delete old.design;
 vm.runInContext('this.legacyStrokes=strokesOf("cookie-face","face")',ctx);assert.equal(ctx.legacyStrokes.length,1,'原笔迹保留，未删除');
});
