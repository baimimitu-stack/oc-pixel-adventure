/* 四层饼干体设计：平面轮廓是源数据，预览与纸样均由它生成。 */
(function(root){
'use strict';
const C=root.NunuCore, S=root.NunuShape, W=400,H=500,K=C.unitPerPx({faceWidthPx:320});
const copy=x=>JSON.parse(JSON.stringify(x));
const names={body:'身体层',clothes:'衣服层',face:'面部层',hair:'发片层'};
/* 白坯（刚新建时的样子）。
 * 2.5D 饼干体的白坯是当初手摆好的：椭圆脸 + 挪过来的身体片，位置和形状都调过，
 * 已经有作品画在上面了，一个像素都不能动，所以原样保留。
 * 别的体型（自创体子、公开图纸、导入的图纸）没有手摆的白坯，就用它自己的图纸：
 * 把图纸上的脸片和身体片摆进这块 400×500 的画布——缩放到「脸片宽 = 面 320」，
 * 脸水平居中放在上边，身体贴着脸的底边往下（脖子处压进去一点，缝的时候才连得上）。 */
const FACE_TOP=41.3, FACE_TOP_W=320, NECK_OVERLAP=0.03;
function initial(tpl){
 const W_=W,H_=H;
 const body=tpl.pieces.find(p=>p.role==='bodyFront');
 const facePiece=tpl.pieces.find(p=>C.isFace(p));
 if(tpl.id==='nunu-25d'||!facePiece||!body||facePiece===body){
  // 老路子：手摆的椭圆脸 + 平移的身体片
  const bodyPoly=body?body.poly.map(([x,y])=>[x-10,y-420+(400-0.8/K)]):Array.from({length:64},(_,i)=>{const a=i*Math.PI*2/64;return [200+90*Math.cos(a),400-0.8/K+110+110*Math.sin(a)];});
  return {version:1,next:1,objects:[{id:'body',layer:'body',name:'基础身体',poly:bodyPoly,color:'#f1dfcd',backColor:'#f1dfcd',front:[],back:[],img:null},
  {id:'face',layer:'face',name:'面部',poly:Array.from({length:96},(_,i)=>{const a=i*Math.PI*2/96;return [200+160*Math.cos(a),400-2.05/K+140*Math.sin(a)];}),color:'#f1dfcd',backColor:'#f1dfcd',front:[],back:[],img:null}]};
 }
 /* 通用路子：把图纸上的脸片和身体片一起摆进这块画布。
  * 缩放三步：脸片宽先按「脸宽 = 320」的基准算；再看看整体（脸 + 身体，脖子处压进 3%）宽高会不会超出画布，
  * 超了就再缩小——长身体的体型缩得更多，这样任何比例都装得下，不会有一半在画布外面。 */
 const PAD=12, availW=W_-2*PAD, availH=H_-2*PAD;
 const fb=C.boxOfPoly(facePiece.poly), bb=C.boxOfPoly(body.poly);
 const maxW=Math.max(fb.w,bb.w), totalH=fb.h+bb.h-fb.h*NECK_OVERLAP;
 const s=Math.min(FACE_TOP_W/Math.max(1,fb.w), availW/Math.max(1,maxW), availH/Math.max(1,totalH));
 const top=(H_-totalH*s)/2;
 const fit=(poly,bx,by,ox,oy)=>poly.map(([x,y])=>[(x-bx)*s+ox,(y-by)*s+oy]);
 const facePoly=fit(facePiece.poly,fb.x+fb.w/2,fb.y,W_/2,top);
 const bodyPoly=fit(body.poly,bb.x+bb.w/2,bb.y,W_/2,top+fb.h*s*(1-NECK_OVERLAP));
 return {version:1,next:1,objects:[
  {id:'body',layer:'body',name:'基础身体',poly:bodyPoly,color:'#f1dfcd',backColor:'#f1dfcd',front:[],back:[],img:null},
  {id:'face',layer:'face',name:'面部',poly:facePoly,color:'#f1dfcd',backColor:'#f1dfcd',front:[],back:[],img:null},
  ...backHeadObjects(tpl)]};
}
/* 整张图纸体型（努努体、公开图纸）的「面部·背面」页：后脑左右两片并排摆在一张平面上。
 * 脸的正面就是脸片本身；背面不是正面的镜像，是真正的后脑两片，所以画在它们自己身上。 */
const BASE_IDS=['face','body','headL','headR'];   // 图纸原片：只能画，不能改外形
function backHeadObjects(tpl){
 const defs=[['headR',/^(backR|headBackR)$/,'后脑·右'],['headL',/^(backL|headBackL)$/,'后脑·左']];   // 从背后看：娃的右边在看图人的左手边
 const ps=defs.map(([id,re,name])=>({id,name,pc:tpl.pieces.find(p=>re.test(p.role))})).filter(x=>x.pc);
 if(!ps.length)return [];                       // 一片后脑也没有：背面页就用脸片镜像（老办法）
 if(ps.length===1)ps[0].name='后脑';
 const boxes=ps.map(x=>C.boxOfPoly(x.pc.poly)),GAP=10,PAD=12;
 const totW=boxes.reduce((n,b)=>n+b.w,0)+GAP*(ps.length-1),maxH=Math.max(...boxes.map(b=>b.h));
 const s=Math.min((W-2*PAD)/totW,(H-2*PAD)/maxH),y0=(H-maxH*s)/2;
 let cx=(W-totW*s)/2;
 return ps.map((x,i)=>{
  const b=boxes[i],ox=cx;cx+=(b.w+GAP)*s;
  const mat=C.ROLES[x.pc.role]&&C.ROLES[x.pc.role].material,base=mat==='hair'?'#ece7dc':'#f1dfcd';
  return {id:x.id,layer:'face',name:x.name,piece:x.pc.id,poly:x.pc.poly.map(([px,py])=>[(px-b.x)*s+ox,(py-b.y)*s+y0]),color:base,backColor:base,base,front:[],back:[],img:null};
 });
}
/** 老存档里没有后脑两片：补上，别让「背面」页空着 */
function withBackHead(d,tpl){
 if(!d||!tpl||!d.objects||d.objects.some(o=>o.id==='headL'))return d;
 const add=backHeadObjects(tpl);
 if(add.length)d.objects.push(...add);
 return d;
}
function ordered(d){return ['body','clothes','face','hair'].flatMap(layer=>d.objects.filter(o=>o.layer===layer));}
function addEars(d){
 const face=d.objects.find(o=>o.id==='face'),b=C.boxOfPoly(face.poly),cy=b.y+b.h*0.55,rx=Math.min(22,b.w*0.075),ry=rx*1.25;
 const ids=[];
 for(const side of [-1,1]){const cx=side<0?b.x+rx*0.25:b.x+b.w-rx*0.25,id='ear-'+d.next++;
  const poly=Array.from({length:40},(_,i)=>{const a=i*Math.PI*2/40;return [cx+rx*Math.cos(a),cy+ry*Math.sin(a)];});
  d.objects.push({id,kind:'ear',layer:'body',name:side<0?'左耳':'右耳',poly,color:face.color,backColor:face.backColor,front:[],back:[],img:null});ids.push(id);
 }return ids;
}
/* 把一个闭合轮廓变成关于 axis 左右对称的形状。
 * 做法：先用半平面裁剪取出主半侧（Sutherland–Hodgman），再把这份半侧镜像拼回去。
 * 老版本直接按边逐段取舍，遇到多数点挤在同一侧的轮廓会产出带重复顶点的退化多边形，
 * 被 valid() 判成自交后整笔被丢掉 —— 这就是「自己画头时形状乱飞」的来源。 */
function symmetricOutline(poly,axis){
 if(poly.length<3)return poly;
 const clean=[];
 for(const p of poly){const q=clean[clean.length-1];if(!q||Math.hypot(p[0]-q[0],p[1]-q[1])>1e-6)clean.push([p[0],p[1]]);}
 if(clean.length>1&&Math.hypot(clean[0][0]-clean.at(-1)[0],clean[0][1]-clean.at(-1)[1])<1e-6)clean.pop();
 if(clean.length<3)return poly;
 // 留点多的那一侧，避免把主体切没了
 const right=clean.filter(p=>p[0]>=axis).length;
 const sign=right*2>=clean.length?1:-1;
 const inside=p=>sign*(p[0]-axis)>=0;
 const half=[];
 for(let i=0;i<clean.length;i++){
  const a=clean[i],b=clean[(i+1)%clean.length],ia=inside(a),ib=inside(b);
  if(ia)half.push([a[0],a[1]]);
  if(ia!==ib&&Math.abs(b[0]-a[0])>1e-9){const t=(axis-a[0])/(b[0]-a[0]);half.push([axis,a[1]+t*(b[1]-a[1])]);}
 }
 // 去掉相邻重复点，这些点会让镜像后的轮廓自交
 const dedup=[];
 for(const p of half){const q=dedup[dedup.length-1];if(!q||Math.hypot(p[0]-q[0],p[1]-q[1])>1e-6)dedup.push(p);}
 if(dedup.length>1&&Math.hypot(dedup[0][0]-dedup.at(-1)[0],dedup[0][1]-dedup.at(-1)[1])<1e-6)dedup.pop();
 if(dedup.length<3)return poly;
 const joined=dedup.concat(dedup.slice().reverse().map(p=>[2*axis-p[0],p[1]]));
 if(!valid(joined))return poly;
 return joined;
}
function paperView(tpl,id,side){
 const p=id&&tpl.pieces.find(p=>p.design.objectId===id&&p.design.mirror===(side==='back'));
 const b=p?C.boxOfPoly(p.poly):{x:0,y:0,w:tpl.w,h:tpl.h},pad=p?35:8,scale=Math.min((W-pad*2)/b.w,(H-pad*2)/b.h);
 return {scale,x:(W-b.w*scale)/2-b.x*scale,y:(H-b.h*scale)/2-b.y*scale};
}
function valid(poly){
 if(poly.length<3 || poly.some(p=>!p.every(Number.isFinite)) || Math.abs(S.polygonArea(poly))<30)return false;
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(let i=0;i<poly.length;i++)for(let j=i+2;j<poly.length;j++){
  if(i===0 && j===poly.length-1)continue;
  const a=poly[i],b=poly[(i+1)%poly.length],c=poly[j],e=poly[(j+1)%poly.length];
  if(cross(a,b,c)*cross(a,b,e)<-1e-8 && cross(c,e,a)*cross(c,e,b)<-1e-8)return false;
 }return true;
}
/* ---------- 发际线与发片根部 ----------
 * 发片不是凭空浮在脑袋上的：后发片从发际线缝出来，刘海从发际线往下贴上去。
 *   · 发际线 = 面皮（脸）轮廓的上缘弧线
 *   · 根部   = 发片轮廓上离发际线最近的那一段：缝的那条边，或者涂胶的那条边
 * 这里只负责「根部落在哪」，不改动发片自己的形状。
 */
function hairline(d,frac){
 const face=d.objects.find(o=>o.id==='face');if(!face)return null;
 const b=C.boxOfPoly(face.poly),cut=b.y+b.h*(frac==null?0.34:frac);
 const band=face.poly.filter(p=>p[1]<=cut);
 if(band.length<2)return null;
 return {pts:band.slice().sort((p,q)=>p[0]-q[0]),cut,box:b};
}
/** 多边形的面积质心；退化时返回 null */
function centroid(poly){
 let a=0,cx=0,cy=0;
 for(let i=0;i<poly.length;i++){
  const q=poly[i],r=poly[(i+1)%poly.length],f=q[0]*r[1]-r[0]*q[1];
  a+=f;cx+=(q[0]+r[0])*f;cy+=(q[1]+r[1])*f;
 }
 if(Math.abs(a)<1e-9)return null;
 a*=0.5;return [cx/(6*a),cy/(6*a)];
}
/** 发际线上与某个 x 对应的点（折线插值，超出范围取端点） */
function hairlineAt(hl,x){
 const p=hl.pts;if(x<=p[0][0])return p[0].slice();if(x>=p[p.length-1][0])return p[p.length-1].slice();
 for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i];
  if(x<=b[0]){const t=(x-a[0])/Math.max(1e-9,b[0]-a[0]);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}}
 return p[p.length-1].slice();
}
/** 发片的根部：轮廓最靠上的那一条边（不是最靠上的那个点 ——
 *  取单点会挑到某个角，对四边形的发片会算出一条斜跨整个顶部的边） */
function rootOf(o){
 const poly=o.poly,n=poly.length;if(n<3)return null;
 let bi=0,best=Infinity;
 for(let i=0;i<n;i++){const q=poly[i],r=poly[(i+1)%n],m=(q[1]+r[1])/2;if(m<best){best=m;bi=i;}}
 const a=poly[bi],b=poly[(bi+1)%n];
 return {i:bi,a:a.slice(),b:b.slice(),mid:[(a[0]+b[0])/2,(a[1]+b[1])/2]};
}
/** 平移一片：形状、笔迹、贴图、根部一起走 */
function shiftPart(d,id,dx,dy){
 const o=d.objects.find(x=>x.id===id);if(!o)return null;
 o.poly=o.poly.map(([x,y])=>[x+dx,y+dy]);
 if(o.img){o.img.cx+=dx;o.img.cy+=dy;}
 for(const side of ['front','back'])for(const st of o[side])st.points=st.points.map(([x,y])=>[x+dx,y+dy]);
 if(o.root){o.root.a=[o.root.a[0]+dx,o.root.a[1]+dy];o.root.b=[o.root.b[0]+dx,o.root.b[1]+dy];}
 return {dx,dy};
}
/** 把整片挪到根部落回发际线上；已经在上面、或挪过去会跑出画布就返回 null */
function snapRoot(d,id){
 const o=d.objects.find(x=>x.id===id);if(!o)return null;
 const hl=hairline(d);if(!hl)return null;
 const r=rootOf(o);if(!r)return null;
 const t=hairlineAt(hl,r.mid[0]),dx=t[0]-r.mid[0],dy=t[1]-r.mid[1];
 if(Math.hypot(dx,dy)<0.5)return null;
 // 宁可让这片留在原地，也不把它挪出画布弄丢
 if(o.poly.some(([x,y])=>x+dx<0||x+dx>W||y+dy<0||y+dy>H))return null;
 return shiftPart(d,id,dx,dy);
}
/** 记下根部两端的位置，画图、纸样、缝份都读它 */
function markRoot(d,id){
 const o=d.objects.find(x=>x.id===id);if(!o)return null;
 const r=rootOf(o);if(!r)return null;
 o.root={a:r.a,b:r.b};return o.root;
}
/** 这片是缝的还是贴的。
 *  装配画布是正视图，前后发片都落在脸的范围内，光看位置分不出前后 —— 这是弱判据，只用来给个默认值，
 *  真正的工艺由用户在界面上定（缝在发际线 / 贴上去）。
 *  依据：主体垂到脸部中线以下、盖住额头的是刘海（从发际线往下贴）；
 *        停在头顶那一圈的是后发片（从发际线缝出来）。
 */
function attachKind(d,o){
 if(o.attach==='sewn'||o.attach==='glued')return o.attach;
 const face=d.objects.find(x=>x.id==='face');if(!face||o.layer!=='hair')return 'sewn';
 const fb=C.boxOfPoly(face.poly),c=centroid(o.poly);
 return c&&c[1]>fb.y+fb.h*0.55?'glued':'sewn';
}
function add(d,layer,poly,color){
 if(!valid(poly))throw Error('轮廓需要围成一块，不能交叉；这一笔没有替换原来的形状。');
 if(layer==='body'||layer==='face'){reshape(d,layer,poly);return layer;}
 const id='part-'+d.next++,name=(layer==='hair'?'发片':'衣服 / 饰品')+' '+id.slice(5);
 const o={id,layer,name,poly:copy(poly),color,backColor:color,front:[],back:[],img:null};
 d.objects.push(o);
 // ★ 新片就长在你画的地方，不再自动往发际线上拽。
 //   以前一新建就被 snapRoot 拖去贴发际线，翘出脑袋、往外长的发片全被拉回头顶，堆成一坨圆脑袋；
 //   想让它回到发际线上，点「↥ 贴回发际线」或切成「🧵 缝在发际线」——那时候才挪。
 if(layer==='hair'){o.attach=attachKind(d,o);o.fabric=defaultFabric;o.onBack=defaultOnBack;markRoot(d,id);}
 return id;
}
function reshape(d,id,poly){if(!valid(poly))throw Error('轮廓不能交叉或太小。');const o=d.objects.find(x=>x.id===id);if(!o)throw Error('请先选中要修改的片。');o.poly=copy(poly);if(o.layer==='face')o.custom=true;if(o.layer==='hair')markRoot(d,id);}
function dartOutline(poly){
 const b=C.boxOfPoly(poly),i=poly.reduce((best,p,k)=>p[1]<poly[best][1]?k:best,0),tip0=poly[i],prev=poly[(i+poly.length-1)%poly.length],next=poly[(i+1)%poly.length];
 const toward=p=>{const len=Math.hypot(p[0]-tip0[0],p[1]-tip0[1]),t=Math.min(0.45,Math.min(b.w,b.h)*0.035/len);return tip0.map((v,k)=>v+(p[k]-v)*t);};
 const a=toward(prev),z=toward(next),mid=a.map((v,k)=>(v+z[k])/2),len=Math.hypot(z[0]-a[0],z[1]-a[1]),u=[(z[0]-a[0])/len,(z[1]-a[1])/len];
 let normal=[-u[1],u[0]];if(normal[1]<0)normal=normal.map(v=>-v);
 let depth=Math.min(b.w,b.h)*0.16,tip;
 for(let k=0;k<8;k++){tip=mid.map((v,j)=>v+normal[j]*depth);if(C.inPoly(poly,...tip))break;depth*=0.5;}
 if(!tip||!C.inPoly(poly,...tip)||depth<1)throw Error('这个头部轮廓顶部没有足够空间放省道，请调整顶部轮廓。');
 const outer=[z];for(let k=1;k<poly.length;k++)outer.push(poly[(i+k)%poly.length]);outer.push(a);
 const cut=[a,tip,...outer];if(!valid(cut))throw Error('顶部省道与轮廓相交，请调整顶部轮廓。');
 return {poly:cut,outer,a,z,tip,mid,u,normal,depth,gap:len/2};
}
function freeHead(face){
 const dt=dartOutline(face.poly),b=C.boxOfPoly(face.poly),pieces=[],seams=[];
 const line=ps=>ps.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-ps[i][0],p[1]-ps[i][1]),0);
 for(const side of [1,-1]){
  const dx=(side>0?210:610)-200,dy=60-b.y, map=q=>[(side<0?400-q[0]:q[0])+dx,q[1]+dy];
  const stub=C.makeDoc({pieces:[{id:'h',name:'头',role:side>0?'bodyFront':'bodyBack',poly:dt.poly,heightPoly:face.poly,smooth:false,thick:60*Math.min(b.w/320,b.h/280),anchorPx:[200,400],place:{x:0,y:0,z:0}}],faceWidthPx:320}).pieces[0],m=C.pillowMesh(stub,null),sb=stub.box;
  const uv=[];
  for(let k=0;k<m.pos.length;k+=3){
   let x=200+(side<0?-m.pos[k]:m.pos[k])/K,y=400-m.pos[k+1]/K;
   const q=[x-dt.mid[0],y-dt.mid[1]],v=q[0]*dt.normal[0]+q[1]*dt.normal[1],u=q[0]*dt.u[0]+q[1]*dt.u[1];
   const eat=dt.gap*Math.max(0,Math.min(1,1-v/dt.depth)),shift=Math.sign(u)*Math.min(Math.abs(u),eat);
   x-=dt.u[0]*shift;y-=dt.u[1]*shift;m.pos[k]=(x-200)*K;m.pos[k+1]=(400-y)*K;
   const j=k/3*2,p=map([sb.x+m.uv[j]*sb.w,sb.y+m.uv[j+1]*sb.h]);uv.push(...p);
  }
  if(side<0)for(let k=0;k<m.idx.length;k+=3)[m.idx[k+1],m.idx[k+2]]=[m.idx[k+2],m.idx[k+1]];
  const D=side>0?'D1':'D2',outer=dt.outer.map(map),cut=Math.max(1,Math.floor(outer.length/2)-1),edgeA=outer.slice(0,cut+1),opening=outer.slice(cut,cut+3),edgeB=outer.slice(cut+2);
  const left=[dt.a,dt.tip].map(map),right=[dt.z,dt.tip].map(map);
  const seamEdges=[{label:D,pts:left,color:'#a45bd8'},{label:D,pts:right,color:'#a45bd8'},{label:'H1',pts:edgeA,color:'#e04a4a'},{label:'H2',pts:edgeB,color:'#e04a4a'},{label:'返H',pts:opening,color:'#bf7c31'}];
  pieces.push({id:side>0?'cookie-face':'cookie-back',name:`自定义头部·${side>0?'脸片':'后片'} · 裁1片`,role:side>0?'meshFace':'meshHair',material:'skin',smooth:false,poly:dt.poly.map(map),mesh:{pos:m.pos,idx:m.idx,uv},seamEdges,design:{objectId:'face',layer:'face',color:side>0?face.color:face.backColor,strokes:copy(side>0?face.front:face.back),dx,dy,mirror:side<0,img:copy(face.img)||null}});
  seams.push({label:D,name:'头部顶部省道',a:line(left),b:line(right),dart:true});
 }
 for(const label of ['H1','H2','返H']){const es=pieces.map(p=>p.seamEdges.find(e=>e.label===label));seams.push({label,name:label==='返H'?'头部反口':'头部周边',a:line(es[0].pts),b:line(es[1].pts)});}
 return {pieces,seams};
}
function move(d,id,step){const o=d.objects.find(x=>x.id===id),group=d.objects.filter(x=>x.layer===o.layer),i=group.indexOf(o),q=group[i+step];if(q){const a=d.objects.indexOf(o),b=d.objects.indexOf(q);[d.objects[a],d.objects[b]]=[d.objects[b],d.objects[a]];}}
function resize(d,id,factor){
 const o=d.objects.find(x=>x.id===id);if(!o || !Number.isFinite(factor) || factor<=0)return false;
 const from=C.boxOfPoly(o.poly),cx=from.x+from.w/2,cy=o.layer==='face'?from.y+from.h:o.layer==='body'?from.y:from.y+from.h/2;
 // 按这个锚点等比算出目标框，再夹进画布：贴边就停在边上，不再因为出界整笔作废
 let to={x:cx+(from.x-cx)*factor,y:cy+(from.y-cy)*factor,w:from.w*factor,h:from.h*factor};
 if(to.w<MIN_SHAPE||to.h<MIN_SHAPE)return false;
 to=clampBox(to);
 if(to.w<MIN_SHAPE||to.h<MIN_SHAPE)return false;
 const keep={poly:copy(o.poly),front:copy(o.front),back:copy(o.back),img:copy(o.img),scale:o.scale||1};
 o.poly=rebox(o.poly,from,to);syncArt(o,from,to);
 if(!valid(o.poly)){o.poly=keep.poly;o.front=keep.front;o.back=keep.back;o.img=keep.img;o.scale=keep.scale;return false;}
 o.scale=keep.scale*Math.min(to.w/from.w,to.h/from.h);
 if(o.layer==='hair')markRoot(d,id);
 return true;
}
const perimeter=p=>p.reduce((s,q,i)=>s+Math.hypot(q[0]-p[(i+1)%p.length][0],q[1]-p[(i+1)%p.length][1]),0);
/* ---------- 改体型：拖方框做拉宽 / 拉高 / 挪位 ----------
 * 以前只有一个「＋放大 / −缩小」，每按一次整片等比变 10%，而且只要有一个点碰到画布边就整笔作废，
 * 所以贴着边就再也改不动，也只能整体变大变小，没法单独拉宽或者拉高。
 * 现在改成拖方框上的八个小方块：四个角拉动相邻两边，四条边的中点只推那一条边，
 * 图形永不出界——碰边就贴住，不再报错。拖出来的样子是预览，打了钩才算数。
 */
const PADX = 160, PADY = 160;          // 画布往四周扩出去的范围：发片可以翘出头外、摆到旁边
const MIN_SHAPE = 16;                 // 再小就捏不住了
// [名字, 横向位置, 纵向位置]：0=左/上，1=右/下，0.5=正中
const HANDLES=[['nw',0,0],['n',.5,0],['ne',1,0],['e',1,.5],['se',1,1],['s',.5,1],['sw',0,1],['w',0,.5]];
const handlePoint=(box,h)=>[box.x+box.w*h[1],box.y+box.h*h[2]];
/** 把多边形从 from 框重映射到 to 框。宽高各算各的，所以能只拉宽不拉高。 */
function rebox(poly,from,to){
 const sx=from.w?to.w/from.w:1, sy=from.h?to.h/from.h:1;
 return poly.map(([x,y])=>[to.x+(x-from.x)*sx,to.y+(y-from.y)*sy]);
}
const boxMapPt=(p,from,to)=>rebox([p],from,to)[0];
/** 夹紧进画布：旧做法是「出界就拒绝整笔」，所以贴边就卡死 */
function clampBox(b){
 const w=Math.min(b.w,W+2*PADX),h=Math.min(b.h,H+2*PADY);
 return {x:Math.max(-PADX,Math.min(b.x,W+PADX-w)),y:Math.max(-PADY,Math.min(b.y,H+PADY-h)),w,h};
}
/** 笔迹和贴图跟着形状一起变形，不然形状变了、画在上面的花纹会跑偏 */
function syncArt(o,from,to){
 const sx=from.w?to.w/from.w:1, sy=from.h?to.h/from.h:1, s=(sx+sy)/2;
 for(const key of ['front','back'])for(const st of (o[key]||[])){
  st.points=st.points.map(q=>boxMapPt(q,from,to));
  st.width=Math.max(.5,(st.width||1)*s);
 }
 const im=o.img;
 if(im){
  const c=boxMapPt([im.cx,im.cy],from,to);
  im.cx=c[0];im.cy=c[1];
  im.w=Math.max(2,im.w*sx);im.h=Math.max(2,im.h*sy);
  if(im.bw)im.bw=Math.max(2,im.bw*sx);
  if(im.bh)im.bh=Math.max(2,im.bh*sy);
 }
}
/* ---------- 图片贴图 ----------
 * 一张图存在部件上，坐标就是装配画布 world 坐标，所以正 / 反两片天然对齐；
 * 界面和纸样都是从这一个缓存里取同一份数据，同一张图只解一次。
 */
const imageCache=new Map();
let imageHook=null;
function getImg(src){
 if(typeof Image==='undefined')return null;
 if(!src)return null;
 if(imageCache.has(src))return imageCache.get(src);
 const im=new Image();
 im.onload=()=>{if(typeof imageHook==='function'){try{imageHook(im);}catch(_){}}};
 im.src=src;imageCache.set(src,im);return im;
}
const imgBmp=src=>imageCache.get(src)||null;
const imgReady=src=>{const im=imageCache.get(src);return !!im&&!!im.complete&&!!(im.naturalWidth||im.width);};
/** 在已经建好裁剪路径、坐标系已是 world 的上下文里把贴图铺上去 */
function drawImgAt(c,cfg){
 const bmp=imgBmp(cfg.src);
 if(!bmp||!(bmp.naturalWidth||bmp.width)||!bmp.complete)return false;
 c.save();c.translate(cfg.cx,cfg.cy);if(cfg.rot)c.rotate(cfg.rot);
 if('imageSmoothingQuality'in c)c.imageSmoothingQuality='high';
 c.drawImage(bmp,-cfg.w/2,-cfg.h/2,cfg.w,cfg.h);c.restore();return true;
}
/** 图片是否盖住这一点（考虑旋转） */
function imgCovers(cfg,p){
 let q=[p[0]-cfg.cx,p[1]-cfg.cy];
 if(cfg.rot){const s=Math.sin(-cfg.rot),k=Math.cos(-cfg.rot);q=[q[0]*k-q[1]*s,q[0]*s+q[1]*k];}
 return Math.abs(q[0])<=cfg.w/2 && Math.abs(q[1])<=cfg.h/2;
}
/* ---------- 透明底发片：直接拿一张现成的 PNG，不用手描 ----------
 * 手描一片发片要一口气围成闭合的一圈，谁也做不到；于是另一条路：
 * 把现成的透明底发片图（网上素材、自己抠好的 PNG）传进来，按透明通道把「有颜色的地方」认成发片。
 *   · 一张图里有几坨不连着的颜色，就是几片 —— 一次能铺好几片
 *   · 形状就是那坨颜色的外轮廓，不用描也不用猜
 *   · 透明的地方留成空窗（不填底色），所以发片是一层压一层透出来的，不是一块死板的方块
 * 不是透明底也能救：整张都不透明时，改把接近纯白的像素当背景再抠一次。
 */
const ALPHA_THR=120;
function maskFromRGBA(px,w,h,whiteAsBg){
 const bm={w,h,data:new Uint8Array(w*h)};let clear=0;
 for(let i=0;i<w*h;i++){
  const a=px[i*4+3];
  if(a<=ALPHA_THR){clear++;continue;}                    // 透明 = 背景
  const r=px[i*4],g=px[i*4+1],b=px[i*4+2];
  if(whiteAsBg&&r>235&&g>235&&b>235){clear++;continue;}  // 按白底抠时，白的也是背景
  bm.data[i]=1;
 }
 return {bm,clearRatio:clear/Math.max(1,w*h)};
}
/** 一张图 → 若干片发片的轮廓（图片的像素坐标系）。 */
function hairPiecesFromImage(px,w,h,opts){
 const o=opts||{};
 const minArea=o.minArea==null?Math.max(60,Math.round(w*h*0.004)):o.minArea;
 let m=maskFromRGBA(px,w,h,false),mode='alpha';
 if(m.clearRatio<0.01){m=maskFromRGBA(px,w,h,true);mode=m.clearRatio<0.01?'opaque':'white';}
 const loops=S.outerContours(m.bm,{minArea,eps:o.eps==null?1.1:o.eps,smooth:o.smooth==null?2:o.smooth});
 const pieces=loops.map(l=>({poly:l,box:C.boxOfPoly(l)})).sort((a,b)=>b.box.w*b.box.h-a.box.w*a.box.h);
 return {pieces,mode};
}
/** 整张图纸体型：把设计台对象（脸、身体前后、后脑两片）的笔迹 / 贴图换算成图纸原片上的 design。
 *  template() 用它出纸样；app 的实时预览（按住画的时候）也用它，不然实时笔迹会按设计台坐标画到图纸片上，
 *  已经画好的东西就会在按下去的那一刻「清空」，放手重算才回来。 */
function mapPatternDesigns(t,d){
 const facePc=t.pieces.find(p=>C.isFace(p)),bodyF=t.pieces.find(p=>p.role==='bodyFront');
 if(!facePc||!bodyF)return false;
  const mapOnto=(o,pc,back,ref)=>{
   const ob=C.boxOfPoly(o.poly),rb=C.boxOfPoly(ref.poly),pb=C.boxOfPoly(pc.poly);
   const s=ob.w/Math.max(1e-6,rb.w);
   const fx=x=>(x-ob.x-ob.w/2)/s+rb.x+rb.w/2,fy=y=>(y-ob.y)/s+rb.y;
   const X=back?(x=>pb.x+rb.x+rb.w-fx(x)):fx,strokes=back?o.back:o.front;
   pc.design={objectId:o.id,color:back?o.backColor:o.color,
    strokes:(strokes||[]).map(st=>{const c2=copy(st);c2.points=st.points.map(([x,y])=>[X(x),fy(y)]);return c2;}),
    dx:0,dy:0,mirror:false,layer:o.layer,
    img:o.img?{...copy(o.img),cx:X(o.img.cx),cy:fy(o.img.cy),w:o.img.w/s,h:o.img.h/s}:null};
  };
  const fo=d.objects.find(o=>o.id==='face'),bo=d.objects.find(o=>o.id==='body');
  if(fo)mapOnto(fo,facePc,false,facePc);
  // 身体正面也要映射 —— 以前只映了背面，在身体上画的一笔 3D 里根本不出现，撤销自然也「右边不动」。
  // 没画过（没笔迹、没贴图、底色没动）就不往身体·前塞 design，让它保持图纸原样。
  if(bo&&((bo.front&&bo.front.length)||bo.img||(bo.color&&bo.color!=='#f1dfcd')))mapOnto(bo,bodyF,false,bodyF);
  const bodyB=t.pieces.find(p=>p.role==='bodyBack');
  if(bo&&bodyB)mapOnto(bo,bodyB,true,bodyF);
  // 面部·背面页：后脑左右两片各画各的，笔迹直接落回对应的图纸片（等比缩放，没有镜像）
  // 没画过（没笔迹、没贴图、底色没动）就不往后脑上塞 design，免得把头发底色盖掉
  for(const id of ['headL','headR']){
   const ho=d.objects.find(o=>o.id===id),hp=ho&&t.pieces.find(p=>p.id===ho.piece);
   if(ho&&hp&&((ho.front&&ho.front.length)||ho.img||(ho.color&&ho.color!==ho.base)))mapOnto(ho,hp,false,hp);
  }
 return true;
}
/** 实时预览用：不出整套纸样，只回 {图纸片 id: design}；不是整张图纸体型就回 null */
function patternDesigns(base,d){
 if(!base||!d||base.pieces.some(p=>p.mesh&&/^头部/.test(p.name)&&base.pieces.filter(q=>q.mesh&&/^头部/.test(q.name)).length===2))return null;
 const t={pieces:base.pieces.map(p=>({...p}))};
 if(!mapPatternDesigns(t,d))return null;
 const out={};for(const p of t.pieces)if(p.design)out[p.id]=p.design;
 return out;
}
/** 圆头体型（公开图纸）：发片不能是一张平放在头里面的卡片 —— 那样整片埋进球里，只剩翘出去的一截（穿模）。
 *  设计台里的圆 = 脸片 ≈ 头的正面轮廓，所以：圆里面的点贴到头前面的椭球面上、沿法线抬一点厚度；
 *  圆外面的点（翘出头外的发片）从轮廓边上顺着往外长。
 *  mesh：pillowMesh 出来的网格；uvs / box：stub 里每个顶点在设计台里的位置（0..1 + 外接框）；
 *  zBase：平放时离头中心面的距离（place.z 的绝对值）；side：+1 前片、-1 后片；fb：脸（圆）的外接框。 */
function conformToHead(mesh,uvs,box,side,zBase,fb,back){
 const GAP=0.03,R=C.TARGETS.head.r,P=C.TARGETS.head.pos,EDGE=0.97;
 /** 第 i 个顶点，离头表面 hv（沿法线）的位置 */
 const place=(i,hv)=>{
  const px=box.x+uvs[i*2]*box.w,py=box.y+uvs[i*2+1]*box.h;
  const a=(px-fb.x-fb.w/2)/(fb.w/2),b=(fb.y+fb.h/2-py)/(fb.h/2),r=Math.hypot(a,b);
  const k=r>EDGE?EDGE/r:1,a2=a*k,b2=b*k,c=Math.sqrt(Math.max(0,1-a2*a2-b2*b2));
  const sg=back?-1:1,sx=R[0]*a2,sy=P[1]+R[1]*b2,sz=P[2]+sg*R[2]*c;      // 后脑 = 同一个投影位置，落在球的背面
  let nx=sx/(R[0]*R[0]),ny=(sy-P[1])/(R[1]*R[1]),nz=(sz-P[2])/(R[2]*R[2]);
  const nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;
  const out=r>EDGE?(r-EDGE):0;                          // 轮廓以外的部分顺着往外长
  return [sx+nx*hv+(r>0?a/r*out*R[0]:0),sy+ny*hv+(r>0?b/r*out*R[1]:0),sz+nz*hv];
 };
 for(let i=0;i<mesh.pos.length/3;i++){
  const hv=mesh.pos[i*3+2]-side*(zBase-GAP);            // 离布面的有向厚度：叠层、鼓起都在里面
  const q=place(i,hv);mesh.pos[i*3]=q[0];mesh.pos[i*3+1]=q[1];mesh.pos[i*3+2]=q[2];
 }
 return place;
}
/** 身体·前的表面：衣服要贴在它上面，不能埋进鼓起来的身体里。
 *  用身体·前自己的鼓包网格（和 3D 里的一模一样）做查表：设计台里的一点 → 反解回图纸坐标 → 找最近的网格点，取它的 3D 位置。 */
const bodyMeshCache=new Map();   // 鼓包网格算一次要几百毫秒，图纸不变就不用重算
function bodySurfaceOf(t,d){
 const bodyF=t.pieces.find(p=>p.role==='bodyFront'),bo=d.objects.find(o=>o.id==='body');
 if(!bodyF||!bo)return null;
 const key=(t.id||'')+'|'+t.faceWidthPx+'|'+bodyF.poly.length+'|'+bodyF.poly[0]+'|'+bodyF.poly[bodyF.poly.length>>1];
 let hit=bodyMeshCache.get(key);
 if(!hit){
  let piece,m;
  try{piece=C.makeDoc({id:'tmp',pieces:[copy(bodyF)],faceWidthPx:t.faceWidthPx,pairs:{}}).pieces[0];m=C.pillowMesh(piece,null);}catch(_){return null;}
  if(!m||!m.pos.length)return null;
  const bx=piece.box,n=m.pos.length/3,qx=new Float32Array(n),qy=new Float32Array(n);
  for(let i=0;i<n;i++){qx[i]=bx.x+m.uv[i*2]*bx.w;qy[i]=bx.y+m.uv[i*2+1]*bx.h;}
  // 空间格子：找最近点不用每次扫全部网格点
  const CELL=8,grid=new Map(),cellOf=(x,y)=>Math.floor(x/CELL)+','+Math.floor(y/CELL);
  for(let i=0;i<n;i++){const key2=cellOf(qx[i],qy[i]);let a=grid.get(key2);if(!a)grid.set(key2,a=[]);a.push(i);}
  hit={m,qx,qy,n,k:C.unitPerPx(piece),grid,CELL};
  if(bodyMeshCache.size>8)bodyMeshCache.clear();
  bodyMeshCache.set(key,hit);
 }
 const {m,qx,qy,n,k,grid,CELL}=hit;
 const rb=C.boxOfPoly(bodyF.poly),ob=C.boxOfPoly(bo.poly),s=ob.w/Math.max(1e-6,rb.w);
 return {at(px,py){
  const x=(px-ob.x-ob.w/2)/s+rb.x+rb.w/2,y=(py-ob.y)/s+rb.y;
  // 取最近的 4 个网格点，高度按距离加权平均（只取最近一个的话，衣服表面会一条一条台阶）
  const nb=[[1e18,0],[1e18,0],[1e18,0],[1e18,0]],cx0=Math.floor(x/CELL),cy0=Math.floor(y/CELL);
  const consider=i=>{const dd=(qx[i]-x)*(qx[i]-x)+(qy[i]-y)*(qy[i]-y);if(dd>=nb[3][0])return;nb[3]=[dd,i];nb.sort((a,b)=>a[0]-b[0]);};
  for(let ring=1;ring<=40;ring++){   // 一圈一圈往外找，找到 4 个、再多看一圈就够了
   for(let gx=cx0-ring;gx<=cx0+ring;gx++)for(let gy=cy0-ring;gy<=cy0+ring;gy++){
    if(Math.max(Math.abs(gx-cx0),Math.abs(gy-cy0))!==ring&&ring>1)continue;
    const a=grid.get(gx+','+gy);if(a)for(const i of a)consider(i);
   }
   if(nb[3][0]<1e17&&Math.sqrt(nb[3][0])<=ring*CELL)break;
  }
  if(nb[3][0]>=1e17)for(let i=0;i<n;i++)consider(i);
  let w=0,z=0;for(const [dd,i] of nb){const wt=1/(Math.sqrt(dd)+0.5);w+=wt;z+=wt*m.pos[i*3+2];}
  const best=nb[0][1];
  // 位置用自己的（边缘才不会跟着身体网格一格一格地抖），伸出身体以外就沿用边上的高度
  return [m.pos[best*3]+(x-qx[best])*k,m.pos[best*3+1]-(y-qy[best])*k,z/w];
 }};
}
function conformToBody(mesh,uvs,box,side,zBase,surf){
 const GAP=0.05;
 for(let i=0;i<mesh.pos.length/3;i++){
  const px=box.x+uvs[i*2]*box.w,py=box.y+uvs[i*2+1]*box.h;
  const hv=mesh.pos[i*3+2]-side*(zBase-GAP);
  const q=surf.at(px,py);
  mesh.pos[i*3]=q[0];mesh.pos[i*3+1]=q[1];mesh.pos[i*3+2]=q[2]+hv;
 }
}
/* ---------- 发型模板：直接长出发片对象（自己的 id、能挪能改色能删），不再走旧的「发型与缝合」页 ---------- */
function rrect(x,y,w,h,r,n=6){
 const pts=[],corner=(cx,cy,a0)=>{for(let i=0;i<=n;i++){const a=(a0+90*i/n)*Math.PI/180;pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}};
 r=Math.min(r,w/2,h/2);corner(x+w-r,y+r,-90);corner(x+w-r,y+h-r,0);corner(x+r,y+h-r,90);corner(x+r,y+r,180);return pts;
}
/** 围着头的一段弧形带：从 a0 度到 a1 度（0=正右，-90=正上），内圈贴着头、外圈厚 thick */
function arcBand(cx,cy,rx,ry,thick,a0,a1,n=28){
 const outer=[],inner=[];
 for(let i=0;i<=n;i++){const a=(a0+(a1-a0)*i/n)*Math.PI/180;outer.push([cx+(rx+thick)*Math.cos(a),cy+(ry+thick*0.9)*Math.sin(a)]);inner.push([cx+rx*0.98*Math.cos(a),cy+ry*0.98*Math.sin(a)]);}
 return outer.concat(inner.reverse());
}
const HAIR_PRESETS={bangs:'刘海',long:'长直发',braids:'双辫子',cape:'披肩'};
function hairPreset(d,key,color){
 const face=d.objects.find(o=>o.id==='face');if(!face)throw Error('没有脸，没法按头的位置排发片。');
 const fb=C.boxOfPoly(face.poly),cx=fb.x+fb.w/2,cy=fb.y+fb.h/2,rx=fb.w/2,ry=fb.h/2,made=[];
 const put=(name,poly,attach)=>{const id=add(d,'hair',poly,color),o=d.objects.find(x=>x.id===id);o.name=name;o.attach=attach;o.preset=key;markRoot(d,id);made.push(id);};
 // 刘海：三片并排贴在额头（贴 = 从发际线往下压着贴）
 const bangW=fb.w*0.36;
 [['前发·左',cx-fb.w*0.40],['前发·中',cx-bangW/2],['前发·右',cx+fb.w*0.04]].forEach(([n,x],i)=>put(n,rrect(x,fb.y-fb.h*0.02,bangW,fb.h*(i===1?0.26:0.32),bangW*0.2),'glued'));
 if(key==='long'){
  put('左侧长发',rrect(fb.x-fb.w*0.16,fb.y+fb.h*0.2,fb.w*0.26,fb.h*1.1,fb.w*0.08),'sewn');
  put('右侧长发',rrect(fb.x+fb.w*0.90,fb.y+fb.h*0.2,fb.w*0.26,fb.h*1.1,fb.w*0.08),'sewn');
 }else if(key==='braids'){
  put('左辫子',rrect(fb.x-fb.w*0.2,fb.y+fb.h*0.45,fb.w*0.2,fb.h*1.0,fb.w*0.1),'sewn');
  put('右辫子',rrect(fb.x+fb.w*1.0,fb.y+fb.h*0.45,fb.w*0.2,fb.h*1.0,fb.w*0.1),'sewn');
 }else if(key==='cape'){
  put('披肩发片',arcBand(cx,cy,rx,ry,fb.w*0.2,160,380),'sewn');
 }
 return made;
}
/* ---------- 发片布料：发片是一整片有厚度的毛料（不是正反两层），厚度 = 绒长 ----------
 * 绒长是常见参考值，不同厂家、不同批次不一样，以你买的布为准。 */
const FABRICS={
 plain:{name:'平布（无绒）',pile:1,note:'没有绒，最服帖，厚度可以忽略。'},
 plush:{name:'普毛',pile:3,note:'很短的绒面，像天鹅绒 / 短毛毯：平、细、密，表面有一块一块深浅不同的毛倒向痕；几乎没有厚度，最服帖，最便宜。'},
 short5:{name:'5mm 兔毛',pile:5,note:'短、密、软，毛面像一层雾，几乎看不出毛的走向；贴头型最服帖，刘海和发片底布最稳。'},
 brush:{name:'刷花',pile:12,note:'中短绒，表面被刷出一道一道顺着一个方向的纹路（像梳过），毛面平整有层次；比 5mm 蓬一点，仍然好贴。'},
 longbrush:{name:'长刷花兔毛（新兔毛）',pile:35,note:'长绒，毛一根根顺着一个方向垂下来，有光泽、毛尖会聚成尖；发片会明显变厚，要顺着毛流裁，缝的时候毛往里压。'},
 wash:{name:'洗水兔毛',pile:40,note:'长绒，水洗过：毛又长又乱、带卷曲、不顺着一个方向，蓬松有野性；最厚，边缘要修，不适合贴额头。'},
};
const FABRIC_ALIAS={rabbit:'longbrush'};   // 旧存档里叫「兔毛」的，按长刷花兔毛算
let defaultFabric='plush';
let defaultOnBack=false;      // 现在看的是背面：新长的发片画在脑袋后面
const fabricOf=o=>FABRICS[o&&(FABRIC_ALIAS[o.fabric]||o.fabric)]||FABRICS.plain;
const FUR_UNIT=0.03*0.6,FUR_MAX=0.5;           // 1mm 绒长 ≈ 0.03 个 3D 单位，毛压一压只算 6 成
function hexRgb(h){const m=/^#?([0-9a-f]{6})$/i.exec(h||'');const n=m?parseInt(m[1],16):0x7d594a;return [n>>16&255,n>>8&255,n&255];}
const mixHex=(h,to,t)=>{const a=hexRgb(h),b=hexRgb(to);return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`;};
function rng(seed){let h=1779033703^String(seed).length;for(let i=0;i<String(seed).length;i++){h=Math.imul(h^String(seed).charCodeAt(i),3432918353);h=h<<13|h>>>19;}let a=h>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
/** 在发片上画一层毛面纹理（程序画的，只为了看得出是哪种布；种子固定，每次画出来一样） */
function drawFur(ctx,d,poly){
 const kind=FABRIC_ALIAS[d.fabric]||d.fabric;if(!kind||kind==='plain')return;
 const pts=poly.map(([x,y])=>[d.mirror?400-(x-d.dx):x-d.dx,y-d.dy]);
 const xs=pts.map(q=>q[0]),ys=pts.map(q=>q[1]),x0=Math.min(...xs),y0=Math.min(...ys),w=Math.max(...xs)-x0,h=Math.max(...ys)-y0;
 const R=rng(d.seed||'x'),base=d.color||'#7d594a',area=w*h;
 const light=mixHex(base,'#ffffff',0.4),dark=mixHex(base,'#000000',0.3),tip=mixHex(base,'#fff4e2',0.55);
 const N={plush:area/20,short5:area/10,brush:area/16,longbrush:area/55,wash:area/48}[kind]||area/20;
 const n=Math.max(120,Math.min(3600,Math.round(N)));
 ctx.save();ctx.lineCap='round';
 if(kind==='wash'){ctx.fillStyle='rgba(120,110,100,0.14)';ctx.fillRect(x0,y0,w,h);}
 if(kind==='plush'){                                      // 普毛：平、细，靠一块一块深浅不同的倒毛痕看出是绒面
  for(let i=0;i<Math.max(6,Math.round(area/900));i++){const cx=x0+R()*w,cy=y0+R()*h,r=18+R()*34;ctx.fillStyle=R()<0.5?light:dark;ctx.globalAlpha=0.07+R()*0.06;ctx.beginPath();ctx.ellipse(cx,cy,r*1.5,r*0.8,R()*3.14,0,6.283);ctx.fill();}
  ctx.globalAlpha=1;
 }
 if(kind==='short5'){ctx.fillStyle=mixHex(base,'#ffffff',0.12);ctx.globalAlpha=0.35;ctx.fillRect(x0,y0,w,h);ctx.globalAlpha=1;}
 for(let i=0;i<n;i++){
  const x=x0+R()*w,y=y0+R()*h,flip=R()<0.5;
  ctx.beginPath();
  if(kind==='plush'){const a=Math.PI/2+(R()-0.5)*1.2;ctx.strokeStyle=flip?light:dark;ctx.globalAlpha=0.16;ctx.lineWidth=0.8;ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*1.8,y+Math.sin(a)*1.8);}
  else if(kind==='short5'){                                   // 短密软：杂乱的细小绒点，没有方向
   const a=R()*6.283;ctx.strokeStyle=flip?light:dark;ctx.globalAlpha=0.2;ctx.lineWidth=0.9;ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*2.2,y+Math.sin(a)*2.2);
  }else if(kind==='brush'){                              // 刷花：顺着一个方向的短纹，一道一道成带
   const band=0.5+0.5*Math.sin(y*0.35+Math.sin(x*0.05)*2),a=Math.PI/2+(R()-0.5)*0.35,l=5+R()*5;
   ctx.strokeStyle=band>0.5?light:dark;ctx.globalAlpha=0.16+band*0.2;ctx.lineWidth=1.2;ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);
  }else if(kind==='longbrush'){                          // 长刷花：长而直的毛，顺着毛流垂下，毛尖发亮
   const a=Math.PI/2+(R()-0.5)*0.22+Math.sin(x*0.03)*0.08,l=14+R()*12;
   ctx.strokeStyle=flip?light:dark;ctx.globalAlpha=0.34;ctx.lineWidth=1.2;ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);
   ctx.stroke();ctx.beginPath();ctx.strokeStyle=tip;ctx.globalAlpha=0.45;ctx.lineWidth=1.1;ctx.moveTo(x+Math.cos(a)*l*0.62,y+Math.sin(a)*l*0.62);ctx.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);
  }else{                                                 // 洗水：长、卷、乱，哪个方向都有
   const a=R()*6.283,l=12+R()*10,c=(R()-0.5)*l*1.4;
   ctx.strokeStyle=flip?mixHex(base,'#cfc6ba',0.45):dark;ctx.globalAlpha=0.32;ctx.lineWidth=1.1;ctx.moveTo(x,y);
   ctx.quadraticCurveTo(x+Math.cos(a)*l*0.5-Math.sin(a)*c,y+Math.sin(a)*l*0.5+Math.cos(a)*c,x+Math.cos(a)*l,y+Math.sin(a)*l);
  }
  ctx.stroke();
 }
 ctx.restore();
}
/** 发片的侧面：把正面边缘的每一条边，沿厚度方向连到底面，3D 里才是一整块有厚度的毛料，不是两层皮 */
function addWalls(mesh,m,b,side,dx,dy,baseAt){
 const idx=mesh.idx,cnt=new Map();
 for(let i=0;i<idx.length;i+=3)for(let k=0;k<3;k++){const a=idx[i+k],c=idx[i+(k+1)%3],key=a<c?a+','+c:c+','+a;cnt.set(key,(cnt.get(key)||0)+1);}
 for(const [key,n] of cnt){
  if(n!==1)continue;
  const [a,c]=key.split(',').map(Number),vi=mesh.pos.length/3;
  for(const i of [a,c])mesh.pos.push(mesh.pos[i*3],mesh.pos[i*3+1],mesh.pos[i*3+2]);
  for(const i of [a,c]){const q=baseAt(i);mesh.pos.push(q[0],q[1],q[2]);}
  for(const i of [a,c,a,c]){const u=m.uv[i*2],v=m.uv[i*2+1],x=b.x+(u+(0.5-u)*0.1)*b.w,y=b.y+(v+(0.5-v)*0.1)*b.h;mesh.uv.push((side<0?400-x:x)+dx,y+dy);}
  idx.push(vi,vi+1,vi+2,vi+1,vi+3,vi+2);
 }
}
function template(base,d){
 if(!d)return base;
 const t=copy(base);
 const face=d.objects.find(o=>o.id==='face');
 // 2.5D 饼干体自带两张「带 3D 网格的头脸」，设计台的脸直接映射到那两张上。
 // 别的体型（自创体子、公开图纸、导入图纸）的图纸里没有这套网格，所以它的片一概不用，
 // 整套裁片都由设计台的对象现长——脸也和其它层一样是前后两片。
 const mapped=t.pieces.filter(p=>p.mesh&&/^头部/.test(p.name)).length===2;
 let pattern=false;   // 「整张图纸」体型（努努体/公开图纸）：图纸保持完整，设计台只往上映射、往里追加
 let y=0;
 if(mapped){
  t.pieces=t.pieces.filter(p=>!/^身体/.test(p.name));t.seams=t.seams.filter(s=>!['B1','返B'].includes(s.label));t.attachments=t.attachments.slice(0,1);t.pairs={};
  const fb=C.boxOfPoly(face.poly),sx=fb.w/320,sy=fb.h/280,fcx=fb.x+fb.w/2,fcy=fb.y+fb.h/2;
  t.pieces.forEach((p,i)=>{
   const ox=i?610:210, map=q=>[ox+(q[0]-ox)*sx,210+(q[1]-210)*sy];
   p.poly=p.poly.map(map);p.seamEdges.forEach(e=>e.pts=e.pts.map(map));
   for(let j=0;j<p.mesh.uv.length;j+=2){const q=map(p.mesh.uv.slice(j,j+2));p.mesh.uv[j]=q[0];p.mesh.uv[j+1]=q[1];}
   for(let j=0;j<p.mesh.pos.length;j+=3){p.mesh.pos[j]=p.mesh.pos[j]*sx+(fcx-200)*K;p.mesh.pos[j+1]=(p.mesh.pos[j+1]-2.05)*sy+(400-fcy)*K;p.mesh.pos[j+2]*=Math.min(sx,sy);}
   p.design={objectId:'face',color:i?face.backColor:face.color,strokes:copy(i?face.back:face.front),dx:ox-(i?400-fcx:fcx),dy:210-fcy,mirror:!!i,layer:'face',img:copy(face.img)||null};
  });
  const lineLength=ps=>ps.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-ps[i][0],p[1]-ps[i][1]),0);
  for(const sm of t.seams){const edges=t.pieces.flatMap(p=>p.seamEdges.filter(e=>e.label===sm.label));if(edges.length===2){sm.a=lineLength(edges[0].pts);sm.b=lineLength(edges[1].pts);}}
  if(face.custom){const head=freeHead(face);t.pieces=head.pieces;t.seams=head.seams;}
  y=Math.max(420,...t.pieces.map(p=>{const b=C.boxOfPoly(p.poly);return b.y+b.h+60;}));
 }else{
  const facePc=t.pieces.find(p=>C.isFace(p)),bodyF=t.pieces.find(p=>p.role==='bodyFront');
  if(facePc&&bodyF){
   /* 努努体、公开图纸这类「整张图纸」体型：后脑、耳朵、手臂、围条按缝合表连成一体，
    * 设计台只做两件事 —— ① 脸/身上的彩绘和贴图按仿射映射回图纸对应片；
    * ② 新加的发片、衣服追加到图纸后面。绝不清空图纸：
    *   以前这里 t.pieces=[] 一刀切，涂一笔 17 片就只剩 4 片（2026-10-30 春子抓到的）。
    * 映射关系：设计台白坯就是图纸片的等比缩放平移（initial() 的 fit），所以
    * 横向按中心对中心、纵向按顶对顶反解回去；背片是正片在自己盒子里的左右镜像。 */
   pattern=true;
   t.pairs=t.pairs||{};t.seams=t.seams||[];t.attachments=t.attachments||[];   // 努努体的 generate 不带 attachments，追加时要用
   mapPatternDesigns(t,d);
   y=Math.max(0,...t.pieces.map(p=>{const b=C.boxOfPoly(p.poly);return b.y+b.h+60;}));
  }else{
   t.pieces=[];t.seams=[];t.pairs={};t.attachments=[];
   delete t.guides;delete t.construction;delete t.meshBody;
   y=0;
  }
 }
 const facePcAll=t.pieces.find(p=>C.isFace(p));
 const sphereHead=pattern&&!!facePcAll&&!!(C.ROLES[facePcAll.role]&&C.ROLES[facePcAll.role].kind==='cap')&&!!face;
 const faceBox=sphereHead?C.boxOfPoly(face.poly):null;
 let bodySurf;   // 衣服用，第一件衣服时才算
 let layoutRight=0;   // 正反两列实际用到的右边界，最后撑开纸样宽度
 const queue=ordered(d).filter(o=>mapped?o.layer!=='face':pattern?!BASE_IDS.includes(o.id):true);
 for(const o of queue){
  const isFace=o.layer==='face';
  const solid=isFace||o.layer==='body';   // 有厚度的（要塞棉、要缝一圈留返口）
  const box=C.boxOfPoly(o.poly), ids=[],edgeLabel=o.kind==='ear'?'E'+o.id.slice(4):isFace?'F1':'B1',openingLabel=o.kind==='ear'?'返E'+o.id.slice(4):isFace?'返F':'返B';
  const oneSheet=o.layer==='hair'&&!solid;          // 发片是一整片有厚度的毛料，只裁 1 片
  for(const [index,side] of (oneSheet?[[0,1]]:[[0,1],[1,-1]])){
   // 正片摆在左列、反片摆在右列，列的位置按这一片自己的宽度算：
   // 以前固定放在 210 / 610，发片一旦宽过 400（画布扩大以后常有），正反两片就叠在一起黏住了。
   // 反片是正片左右镜像（关于设计台 x=200），所以反片先镜像、再平移到正片右边隔 60。
   const gap=60,bw=box.w,dx=index?(20+bw+gap)-(400-(box.x+bw)):20-box.x,dy=y-box.y;
   layoutRight=Math.max(layoutRight,20+2*bw+gap+20);
   const poly=o.poly.map(([x,v])=>[(side<0?400-x:x)+dx,v+dy]);
   const id=`design-${o.id}-${side>0?'front':'back'}`;ids.push(id);
   // 面的反面是后脑，后脑上长的是头发（和 2.5D 饼干体一个规矩），所以用发片布
   const backIsHair=isFace&&side<0;
   const role=o.layer==='hair'||backIsHair?'meshHair':isFace?'meshFace':'meshSkin';
   const material=o.layer==='hair'||backIsHair?'hair':'skin';
   const p={id,name:oneSheet?`${o.name} · 裁1片`:`${o.name}·${side>0?'前':'后'} · 裁1片`,quantity:1,poly,smooth:false,role,material,bonded:!solid,seamEdges:[],design:{objectId:o.id,color:side>0?o.color:o.backColor,strokes:copy(side>0?o.front:o.back),dx,dy,mirror:side<0,layer:o.layer,img:copy(o.img)||null,fabric:oneSheet?(o.fabric||'plain'):undefined,seed:o.id}};
   const stack=d.objects.filter(x=>x.layer===o.layer).indexOf(o);   // 同一层里排第几 = 往上叠了第几层
   const stub=C.makeDoc({id:'tmp',pieces:[{id:'p',name:'p',role:side>0?'bodyFront':'bodyBack',poly:o.poly,smooth:false,
    // ★ 发片是有厚度的：一片布对折压合是 9，衣服 3，不能跟纸一样薄（2）
    thick:solid?40*(o.scale||1):(o.layer==='hair'?9:3),
    anchorPx:[200,400],
    // ★ 一片压一片往上叠，每层实打实错开 0.024，看得出来是一片压着一片，不是粘成一坨
    place:{x:0,y:0,z:solid?0:side*((o.layer==='hair'?(attachKind(d,o)==='sewn'?0.28:0.34):0.23)+stack*0.024)}}],faceWidthPx:320}).pieces[0];
   // 反片的纸样镜像；装配坐标仍与正片对应。
   const m=C.pillowMesh(stub,null),b=stub.box;
   p.mesh={pos:m.pos,idx:m.idx,uv:[]};
   for(let i=0;i<m.uv.length;i+=2){const x=b.x+m.uv[i]*b.w,v=b.y+m.uv[i+1]*b.h;p.mesh.uv.push((side<0?400-x:x)+dx,v+dy);}
   if(side<0){for(let i=0;i<p.mesh.pos.length;i+=3)p.mesh.pos[i]*=-1;for(let i=0;i<p.mesh.idx.length;i+=3)[p.mesh.idx[i+1],p.mesh.idx[i+2]]=[p.mesh.idx[i+2],p.mesh.idx[i+1]];}
   if(oneSheet){
    const tk=Math.min(FUR_MAX,Math.max(0.02,fabricOf(o).pile*FUR_UNIT)),zb=attachKind(d,o)==='sewn'?0.28:0.34;
    let baseAt;
    if(sphereHead){
     const place=conformToHead(p.mesh,m.uv,b,side,zb-tk,faceBox,!!o.onBack);       // 正面 = 贴着头 + 绒长
     baseAt=i=>place(i,0.03+stack*0.012);                                // 底面 = 贴着头（或压在下一层上）
    }else{
     const z0=p.mesh.pos.filter((_,i)=>i%3===2);
     for(let i=2;i<p.mesh.pos.length;i+=3)p.mesh.pos[i]+=side*tk;        // 平的头（2.5D / 自创体）：正面往外抬 绒长
     baseAt=i=>[p.mesh.pos[i*3],p.mesh.pos[i*3+1],z0[i]];
    }
    p.mesh._wall={baseAt,m,b,side,dx,dy,flipZ:!sphereHead&&!!o.onBack};   // 等 uv 建好以后再长侧面
   }
   if(p.mesh._wall){const w=p.mesh._wall;delete p.mesh._wall;addWalls(p.mesh,w.m,w.b,w.side,w.dx,w.dy,w.baseAt);if(w.flipZ)for(let i=2;i<p.mesh.pos.length;i+=3)p.mesh.pos[i]*=-1;}
   if(sphereHead&&o.layer==='clothes'&&!solid){if(bodySurf===undefined)bodySurf=bodySurfaceOf(t,d);if(bodySurf)conformToBody(p.mesh,m.uv,b,side,0.23,bodySurf);}
   if(solid){
    const n=poly.length,opening=Math.max(1,Math.min(n-2,Math.round(n*0.06)));
    p.seamEdges=[{label:edgeLabel,color:'#35a85a',pts:poly.slice(opening).concat([poly[0]])},{label:openingLabel,color:'#bf7c31',pts:poly.slice(0,opening+1)}];
   }else{
    p.accessory=o.layer;
    if(o.layer==='hair'&&o.root){
     const kind=attachKind(d,o);
     p.seamEdges=[{label:kind==='sewn'?'发根缝':'发根贴',color:kind==='sewn'?'#8a5ca8':'#c98f2e',
      pts:[o.root.a,o.root.b].map(q=>[(side<0?400-q[0]:q[0])+dx,q[1]+dy])}];
    }
   }
   t.pieces.push(p);
  }
  if(ids[1]){t.pairs[ids[0]]=ids[1];t.pairs[ids[1]]=ids[0];}
  if(solid)for(const label of [edgeLabel,openingLabel]){const es=ids.map(id=>t.pieces.find(p=>p.id===id).seamEdges.find(e=>e.label===label));const len=ps=>ps.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-ps[i][0],p[1]-ps[i][1]),0);t.seams.push({label,name:o.name+(label===edgeLabel?'周边':'反口（翻面后封口）'),a:len(es[0].pts),b:len(es[1].pts),pieceA:ids[0],pieceB:ids[1]});}
  if(o.layer==='hair'){
   // 后发片从发际线缝出来（根部加固缝）；刘海是从发际线往下贴上去的
   const kind=attachKind(d,o);
   t.attachments.push({instruction:kind==='sewn'
    ? `${o.name}：用「${fabricOf(o).name}」裁1片（绒长约 ${fabricOf(o).pile}mm，参考值，以你买的布为准），毛流向下。根部（紫色「发根缝」那道边）对准头部发际线，沿发际线加固缝一圈；发梢自然垂下，不加缝份、不塞棉。`
    : `${o.name}：用「${fabricOf(o).name}」裁1片（绒长约 ${fabricOf(o).pile}mm，参考值，以你买的布为准），毛流向下。这是刘海，不缝——在发际线位置涂布料胶，从发际线往下压着贴；想厚就一层压一层往上叠（像铺瓦），每层都从发际线起。`});
  }else t.attachments.push({instruction:o.kind==='ear'?`${o.name}前后各裁1片，正面相对缝合，留橙色反口；翻面少量塞棉后封口，对准头部对应侧边固定。`:solid?`${o.name}两片正面相对，沿 ${edgeLabel} 缝合，橙色${openingLabel}留开，翻面少量塞棉后封口。`:`${o.name}正反两片背对背粘合，不塞棉、不加缝份；按设计预览定位固定。`});
  y+=box.h+75;
 }
 if(!mapped&&!pattern){
  // 这些零星字段是 2.5D 模板自己的，新长出来的这套用不上
  t.scaleLabel='基准脸宽（缩放前）';t.w=830;t.guides={ticks:[],notches:[]};
 }else if(mapped) t.scaleLabel='基准脸宽（缩放前）';
 if(pattern){t.w=Math.max(t.w,1020,layoutRight);t.h=Math.max(t.h,y+25);}else{t.w=Math.max(t.w,layoutRight);t.h=y+25;}
 t.name=mapped?'四层饼干体 · 白坯草稿':pattern?t.name:`${base.name} · 设计草稿`;
 return t;
}
function paint(ctx,p,layer){
 const d=p.design;if(!d)return;
 const cfg=d.img;
 // 这里必须自己取一次：作品刚从存档读回来时图还没解码进缓存，
 // 不主动登记的话第一帧会判成「图没就绪」，底色照打、空窗消失。
 const bmp=cfg&&cfg.src?getImg(cfg.src):null;
 const win=!!(bmp&&imgReady(cfg.src)&&cfg.window!==false);
 ctx.beginPath();p.poly.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));ctx.closePath();
 // 贴了图又勾了「留空窗」时就不打底色：图片盖不到的地方就是透光的缺口
 if(layer!=='face'&&!win){ctx.fillStyle=d.color;ctx.fill();}
 ctx.save();ctx.clip();ctx.translate(d.dx,d.dy);if(d.mirror){ctx.translate(400,0);ctx.scale(-1,1);}
 if(layer==='hair'&&d.fabric)drawFur(ctx,d,p.poly);
 if(cfg&&cfg.src)drawImgAt(ctx,cfg);
 for(const st of (C.isFace(p)&&layer==='skin'?[]:d.strokes))paintStroke(ctx,st);
 ctx.restore();
}
/* 一笔画出来：圆笔用中点贝塞尔把折线抹顺（手抖看不出），方笔保留硬棱角（像素感） */
function paintStroke(ctx,st){
 const br=BRUSHES[st.brush]||BRUSHES.round,ps=st.points;
 ctx.strokeStyle=st.color;ctx.lineWidth=st.width;ctx.lineCap=br.cap;ctx.lineJoin=br.join;
 ctx.beginPath();
 if(ps.length===1){ctx.moveTo(ps[0][0],ps[0][1]);ctx.lineTo(ps[0][0]+0.01,ps[0][1]);}
 else if(st.brush==='square'||ps.length<3){ps.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));}
 else{ctx.moveTo(ps[0][0],ps[0][1]);
  for(let i=1;i<ps.length-1;i++)ctx.quadraticCurveTo(ps[i][0],ps[i][1],(ps[i][0]+ps[i+1][0])/2,(ps[i][1]+ps[i+1][1])/2);
  ctx.lineTo(ps[ps.length-1][0],ps[ps.length-1][1]);}
 ctx.stroke();
}
/* ========== 界面与交互 ==========
 * 坐标约定：装配画布坐标（world）是唯一的正本。
 *   · 纸样上画的每一笔都会先还原回 world 坐标，所以两个视图画出来完全一样。
 *   · outline（轮廓）改动是正片 / 反片的公共源几何，天然镜像同步；
 *     彩绘（笔迹、底色）按面存，正面和背面各画各的。
 */
const LAYER_META = [
  { key: 'body', name: '身体层', icon: '🧸' },
  { key: 'clothes', name: '衣服层', icon: '👗' },
  { key: 'face', name: '面部层', icon: '🌸' },
  { key: 'hair', name: '发片层', icon: '💇' },
];
/* 调色板：第一行肤色/发色，第二行五官和鲜艳色。纯黑、灰色、金发这些画努努少不了 */
const PALETTE = ['#f4e6d6','#f0d7bd','#e8c4a0','#d99771','#b07050','#7d5340','#5b4632','#4b3939','#2e2220','#8a6b4f','#c9a06b','#e8d44b',
  '#ffffff','#c9c9c9','#8c8c8c','#2b2b2b','#f3d7dc','#e8879b','#d95f7c','#b03a5b','#8a5a8f','#6b7ec4','#7fa8c9','#4b7ec9','#5fa08a','#a8bf72','#e8b04b','#c96b3f'];
/* 笔型：圆笔顺滑（贝塞尔抹平抖动），方笔硬边（像素感） */
const BRUSHES = { round: { name: '圆笔', cap: 'round', join: 'round' }, square: { name: '方笔', cap: 'square', join: 'miter' } };
const HINTS = {
  body: '身体是前后两片布口袋。选中它可以放大缩小，也能重新描一圈改成别的形状。',
  clothes: '衣服、饰品一层层往上叠。点「＋ 再加一层」，围着目标画一圈就多出一片。',
  face: '五官只画在这一面，不会窜到后脑；改形状会两边一起变，缝合才对得上。',
  hair: '发片一片片往上叠，每片都是有厚度的一层布。「＋ 加发片」可以分几段慢慢描（画一段松一次手），画够了一点「✓ 合上成一片」；也可以直接传一张透明底发片 PNG。在同一片上涂色画的还是这一片，另起一片画在上面才是两片。',
};

function mount(host, api) {
  // 白坯按「当前用的那套图纸」来。老的接口不传 base，就还是 2.5D 饼干体。
  const baseTpl=()=>(api.base&&api.base())||root.NunuPattern.cookie;
  // 整张图纸体型（努努体/公开图纸）：脸/身体是图纸原片，不许改体型（app.js 会按当前图纸判断）
  const shapeLocked=()=>{try{return !!(api.shapeLocked&&api.shapeLocked());}catch(_){return false;}};
  const SHAPE_LOCK_MSG='这套体型是整张图纸：后脑、耳朵、手臂、围条按缝合表连成一体，跟 2.5D 白坯不是一回事，拉扯外形会把图纸拆散。这片只能彩绘、贴图；想加东西用「＋ 加发片 / 加衣服」，在空白处涂就是新的一片。';
  let d = api.get() || initial(baseTpl());
  if (shapeLocked()) withBackHead(d, baseTpl());
  let layer = 'body';
  let selected = d.objects.find(o => o.layer === 'body')?.id || 'body';
  let tool = 'paint';           // paint | outline
  let adding = false;           // 下一笔围出来的圈是「新的一层」还是「改现有形状」
  let side = 'front';           // front | back
  let color = '#7d5340', width = 6, brush = 'round';
  let showGuides = true;        // 定位线（整张图纸体型的脸窗 / 眼睛 / 嘴 / 眼线）
  let history = [], redo = [];
  let paper = false, paperTpl = null;
  let vue = { x: 0, y: 0, scale: 1 };
  let VW = W, VH = H;                    // 画布在屏幕上的逻辑大小（跟着舞台走）；世界坐标还是 400×500 往外扩 PAD   // 装配视图的平移缩放
  let rect = null;                       // ★ 一笔之内锁住的画布矩形，防止 DOM 重排让笔跑偏
  let drag = null, frame = 0, lastLive = 0;      // lastLive：3D 实时刷新节流用，别让重活占满每一帧
  let notice = '';                              // ★ 需要盖掉默认文案的话（报错、完成提示），优先级高于 sync 的默认说明
  let handDrag = null;
  // 「改体型」的待确认状态：拖方框时形状已经在画上实时变了，但没打钩就不算数，
  // 打钩才进撤销栈、才写进纸样；按 ✕ 就整片退回进去之前的样子。
  let pending = null;               // { id, poly, front, back, img, scale }
  // 「慢慢描」：一片发片不用一口气围成闭合的一圈 —— 画一段、松手、接着画下一段，最后点「✓ 合上」。
  // 段和段之间自动接上，合上时首尾也自动连起来，所以画一条弧线（哪怕没闭合）也是一片发片。
  let draft = null;                 // { kind:'add'|'reshape', id, layer, segs: [[pt,...], ...] }
  const CLOSE_GAP = 26;             // world 单位：收笔离起笔这么近，就算这一圈自己拢上了

  const oldMain = document.querySelector('.workspace');
  const oldToolbar = document.querySelector('.toolbar');
  const oldDock = document.querySelector('.dock');
  const raf = (cb) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(cb);
    else if (typeof setTimeout === 'function') setTimeout(cb, 16);
    else cb();
  };

  host.innerHTML = `<div class="ds">
   <div class="dsBodyBar">
    <span class="dsRowLab">🧍 体型</span>
    <div class="dsGroup dsSegs" id="dsBodies" role="group" aria-label="选体型"></div>
    <button type="button" data-daction="importPattern" class="primary" title="上传你自己的图纸图片：彩线 / 单色线稿 / 透明底抠图都行">＋ 上传我的图纸</button>
    <button type="button" data-daction="rolesWizard" id="rolesBtn" title="重新核对每一片是什么（导入的图纸才有）" style="display:none">🧩 校对每片用途</button>
    <button type="button" data-daction="patternHelp" title="图纸怎么画、怎么认、有什么范例">📖 图纸说明书</button>
    <span class="dsNote" id="dsBodyNote"></span>
   </div>
   <nav class="dsLayers" role="tablist" aria-label="图层">
    ${LAYER_META.map(l => `<button type="button" class="dsLayer" data-dlayer="${l.key}" role="tab"><i>${l.icon}</i><b>${l.name}</b><em data-count="${l.key}">0</em></button>`).join('')}
   </nav>

   <div class="dsTools">
    <span class="dsRowLab">🖌 画笔</span>
    <div class="dsGroup dsSegs" role="group" aria-label="工具">
     <button type="button" data-dtool="paint" title="在这一面涂颜色、画花纹">🎨 彩绘</button>
     <button type="button" data-dtool="outline" title="进「改体型」：拖方框上的小方块可以只拉宽或只拉高，也能围着画一圈，满意了打钩">✏️ 改体型</button>
     <button type="button" data-dtool="image" title="拖动导入的图片，摆好位置">🖼 挪贴图</button>
    </div>
    <div class="dsGroup">
     <span class="dsLab">颜色</span>
     <input type="color" id="designColor" aria-label="颜色" value="${color}">
     <div class="dsPalette" id="designPalette" role="group" aria-label="常用颜色">${PALETTE.map(c => `<button type="button" class="dsChip" data-color="${c}" style="background:${c}" title="${c}" aria-label="${c}"></button>`).join('')}</div>
    </div>
    <div class="dsGroup">
     <span class="dsLab">笔型</span>
     <div class="dsGroup dsSegs" role="group" aria-label="笔型">
      <button type="button" data-dbrush="round" title="圆头笔，线条顺滑">🖊 圆笔</button>
      <button type="button" data-dbrush="square" title="方头笔，硬边像素感">▪ 方笔</button>
     </div>
     <span class="dsLab">笔宽</span>
     <input type="range" id="designWidth" min="1" max="40" value="6" aria-label="笔宽">
     <output id="designWidthOut">6</output>
    </div>
   </div>

   <div class="dsTools dsTools2">
    <span class="dsRowLab">👁 视角</span>
    <div class="dsGroup dsSegs" role="group" aria-label="看哪一面">
     <button type="button" data-dside="front">正面</button>
     <button type="button" data-dside="back">背面</button>
    </div>
    <button type="button" data-dtool="hand" title="抓手：按住拖动画布挪位置，画画不怕够不着">🖐 抓手</button>
    <button type="button" data-daction="guides" id="guidesBtn" title="显示 / 隐藏定位线：脸窗、眼睛、嘴、眼线（整张图纸体型才有）">📏 定位线</button>
    <label class="dsCheck"><input type="checkbox" id="designMirror" checked> 左右对称一起画</label>
    <span class="dsGroup"><span class="dsLab">对称轴</span><input type="number" id="designAxis" value="200" min="0" max="400" step="1" aria-label="对称轴位置"></span>
    <div class="dsGroup">
     <button type="button" data-daction="undo" title="撤销">↶ 撤销</button>
     <button type="button" data-daction="redo" title="重做">↷ 重做</button>
    </div>
   </div>

   <div class="dsTools dsTools3">
    <span class="dsRowLab">🖼 贴图</span>
    <div class="dsGroup">
     <input type="file" id="designImagePick" accept="image/*" hidden>
     <button type="button" data-daction="imgPick" class="primary">🖼 导入图片贴到这片</button>
     <button type="button" data-daction="imgLock">🔒 固定位置</button>
     <button type="button" data-daction="imgClear">✕ 去掉贴图</button>
    </div>
    <div class="dsGroup" id="designImageAdjust">
     <span class="dsLab">大小</span>
     <input type="range" id="designImageSize" min="10" max="400" step="1" value="100" aria-label="贴图大小">
     <span class="dsLab">转</span>
     <input type="range" id="designImageRot" min="-180" max="180" step="1" value="0" aria-label="贴图旋转">
    </div>
    <label class="dsCheck"><input type="checkbox" id="designImageWindow" checked> 盖不到的地方留空窗（不填底色）</label>
   </div>

   <div class="dsTools dsTools6" id="designFabricRow" hidden>
    <span class="dsRowLab">🧶 发片布料</span>
    <div class="dsGroup dsSegs" id="designFabrics" role="group" aria-label="发片布料">
     ${Object.entries(FABRICS).map(([k, f]) => `<button type="button" data-fabric="${k}" title="${f.note}">${f.name}</button>`).join('')}
    </div>
    <span class="dsNote" id="designFabricNote"></span>
   </div>

   <div class="dsTools dsTools5" id="designHairPresets" hidden>
    <span class="dsRowLab">💇 发型模板</span>
    <div class="dsGroup dsSegs" role="group" aria-label="发型模板">
     <button type="button" data-hpreset="bangs" title="刘海：三片贴在额头上（贴）">刘海</button>
     <button type="button" data-hpreset="long" title="刘海 + 左右两条长发片（缝）">长直发</button>
     <button type="button" data-hpreset="braids" title="刘海 + 左右两条辫子（缝）">双辫子</button>
     <button type="button" data-hpreset="cape" title="刘海 + 绕着头的一圈披肩发片（缝）">披肩</button>
     <button type="button" data-hpreset="clear" title="把用模板生成的发片都删掉（自己画的不动）">清掉模板发片</button>
    </div>
    <span class="dsNote">用当前颜色生成，生成以后每一片都能单独挪、改色、删。</span>
   </div>

   <div class="dsTools dsTools4" id="designHairRow" hidden>
    <span class="dsRowLab">🧵 工艺</span>
    <div class="dsGroup dsSegs" role="group" aria-label="这片怎么装上">
     <button type="button" data-dattach="sewn" title="后发片：根部对准发际线，沿发际线加固缝一圈">🧵 缝在发际线</button>
     <button type="button" data-dattach="glued" title="刘海：在发际线涂布料胶，从发际线往下压着贴">🩹 贴上去</button>
    </div>
    <button type="button" data-daction="snapRoot" title="把这片挪回去，让根部重新落在发际线上">↥ 贴回发际线</button>
    <span class="dsNote" id="designHairNote"></span>
   </div>

   <div class="dsBody">
    <section class="dsCard dsCanvasCard">
     <header>
      <h2>01 画的样子</h2>
      <div class="dsMini">
       <button type="button" data-daction="bigCanvas" id="bigBtn" title="把两边的面板收起来，画布占满整屏（再点一次退出）">⛶ 大画布</button>
       <button type="button" data-daction="layout" id="layoutBtn">📐 看纸样</button>
       <button type="button" data-daction="overview">🔍 看全部</button>
      </div>
     </header>
     <div class="dsStageWrap"><canvas id="designCanvas" width="800" height="1000" aria-label="画布"></canvas></div>
     <div class="dsConfirm" id="designConfirm" hidden>
      <span id="designConfirmTxt"></span>
      <button type="button" data-daction="shapeOk" class="dsOk">✓ 就这样</button>
      <button type="button" data-daction="shapeCancel" class="dsNo">✕ 放弃</button>
     </div>
     <div class="dsConfirm" id="designDraft" hidden>
      <span id="designDraftTxt"></span>
      <button type="button" data-daction="draftOk" class="dsOk">✓ 合上成一片</button>
      <button type="button" data-daction="draftUndo">↶ 撤一段</button>
      <button type="button" data-daction="draftClear" class="dsNo">✕ 全部重画</button>
     </div>
     <p class="dsHint" id="designHint"></p>
    </section>

    <aside class="dsCard dsSide">
     <header><h2>这层的部件</h2></header>
     <ul class="dsList" id="designObjects" aria-label="部件列表"></ul>
     <p class="dsOpsLab">— 加新的 —</p>
     <input type="file" id="designHairPick" accept="image/png,image/*" hidden>
     <div class="dsOps">
      <button type="button" data-daction="newHair" class="primary" title="分几段慢慢画：画一段松一次手，画够了一点「✓ 合上成一片」">＋ 加发片</button>
      <button type="button" data-daction="hairPng" title="传一张透明底发片（白底也行），按透明/白的地方自动抠成一片或多片发片，不用手描">🖼 透明底发片</button>
     </div>
     <div class="dsOps">
      <button type="button" data-daction="newClothes" class="primary">＋ 加衣服</button>
      <button type="button" data-daction="addPart">＋ 在当前层再叠一片</button>
     </div>
     <div class="dsOps">
      <button type="button" data-daction="ears">＋ 一对耳朵</button>
     </div>
     <p class="dsOpsLab">— 调这片 —</p>
     <div class="dsOps">
      <button type="button" data-daction="lock" title="固定之后这片就不会被挪动、改形或误删，画画的时候它老老实实不动">📌 固定这片</button>
      <button type="button" data-daction="fill">整片涂色</button>
     </div>
     <div class="dsOps">
      <button type="button" data-daction="up">↑ 上层</button>
      <button type="button" data-daction="down">↓ 下层</button>
      <button type="button" data-daction="grow">＋ 放大</button>
      <button type="button" data-daction="shrink">− 缩小</button>
     </div>
     <div class="dsOps">
      <button type="button" data-daction="remove">删掉这片</button>
     </div>
     <div class="dsFoot">
      <select id="designProjects" aria-label="打开已保存作品"></select>
      <button type="button" data-daction="newProject">新建作品</button>
      <button type="button" data-daction="clear">清空</button>
      <button type="button" data-daction="paper">→ 裁片与备料</button>
     </div>
    </aside>

    <section class="dsCard dsPreviewCard">
     <header>
      <h2>02 立起来的样子</h2>
      <div class="dsMini">
       <button type="button" data-dview="front">正视</button>
       <button type="button" data-dview="side">侧视</button>
       <button type="button" data-dview="back">背视</button>
       <button type="button" data-dview="all">全局</button>
      </div>
     </header>
     <div class="ds3d" id="design3d"></div>
     <canvas id="designPreview" width="800" height="1000" hidden aria-label="没有 3D 时的平面预览"></canvas>
    </section>
   </div>

   <p class="dsStatus" id="designStatus" role="status"></p>
  </div>`;

  const $ = (s) => host.querySelector(s);
  const canvas = $('#designCanvas'), preview = $('#designPreview'), list = $('#designObjects');
  const status = $('#designStatus'), hint = $('#designHint'), projects = $('#designProjects');
  const mirrorBox = $('#designMirror'), axisBox = $('#designAxis'), widthBox = $('#designWidth');
  const hairRow = $('#designHairRow'), hairNote = $('#designHairNote');
  const confirmBar = $('#designConfirm'), confirmTxt = $('#designConfirmTxt');

  /* ---------- 改体型：进去 -> 拖着看 -> 打钩才算数 ---------- */
  /** 命中方框上的小方块了吗。半径按视图缩放换算，放大了也好点中。 */
  function hitHandle(p, poly) {
    const box = C.boxOfPoly(poly), r = Math.max(5, 10 / vue.scale);
    for (const h of HANDLES) {
      const q = handlePoint(box, h);
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) <= r) return h;
    }
    return null;
  }
  /** 开始一次体型预览：先把没改之前的样子记下来，顺便压进撤销栈 */
  function beginShape() {
    const o = cur(); if (!o) return false;
    if (o.locked) { say(`「${o.name}」被固定住了，先在右边点「🔓 解开固定」再改形状。`); return false; }
    if (!pending) {
      snapshot();                    // ★ 压的是「改之前」，所以 ✓ 之后撤销一步就能回到原样
      pending = { id: o.id, poly: copy(o.poly), front: copy(o.front), back: copy(o.back), img: copy(o.img), scale: o.scale || 1 };
    }
    return true;
  }
  /** 挪位置的把手单独放在方框正上方，不占框里的地方 —— 框里面留给「画一圈」 */
const movePoint = (box) => [box.x + box.w / 2, box.y - 13 / vue.scale];
function hitMoveHandle(p, poly) {
  const q = movePoint(C.boxOfPoly(poly));
  return Math.hypot(p[0] - q[0], p[1] - q[1]) <= Math.max(5, 10 / vue.scale);
}
function acceptShape() {
    if (!pending) return;
    const o = objAt(pending.id);
    if (o) {
      const from = C.boxOfPoly(pending.poly), to = C.boxOfPoly(o.poly);
      if (to.w >= 1 && to.h >= 1) {
        syncArt(o, from, to);
        o.scale = pending.scale * Math.min(to.w / Math.max(1, from.w), to.h / Math.max(1, from.h));
      }
      if (o.layer === 'hair') markRoot(d, o.id);
    }
    pending = null;
    commit();
    say('体型改好了，打钩生效。还想接着改就继续拖，回上色点「🎨 彩绘」。');
  }
  function cancelShape() {
    if (!pending) return;
    const o = objAt(pending.id);
    if (o) {
      o.poly = copy(pending.poly); o.front = copy(pending.front); o.back = copy(pending.back);
      o.img = copy(pending.img); o.scale = pending.scale;
    }
    if (history.length) history.pop();   // 那一条「改之前」的快照没用了，别占着撤销位
    pending = null;
    rebuild(); api.change(copy(d)); sync();
    say('放弃了，形状回到改之前。');
  }
  /* ---------- 慢慢描：一片发片分几段画，不用一气呵成 ----------
   * 以前要「围着形状画一圈闭合的线」，谁也画不准 —— 手一抖线就自己交叉，整笔作废。
   * 现在：画一段松一次手，段和段自动接上；点「✓ 合上成一片」时首尾也会自动连起来，
   * 所以哪怕只是画了一条弧线、一个钩，合上后也是一片发片。
   */
  /** 把画布滚到眼前：工具行占了 300 多 px，画布下半截常被底栏压着 —— 开画之前先滚上去 */
  function revealCanvas() {
    if (typeof window === 'undefined' || !window.scrollTo) return;
    const top = canvas.getBoundingClientRect().top;
    if (top > 130) window.scrollTo({ top: window.scrollY + top - 96, behavior: 'smooth' });
  }
  /** 开一次「慢慢做一片」。
   *  mode='smear'：拿笔涂，涂到哪儿算哪儿，不用围成圈、不用一气呵成（默认）；
   *  mode='line'：描轮廓线，分几段画，段和段自动接上。 */
  function startDraft(kind, id, mode) {
    if (pending) acceptShape();
    draft = { kind: kind || 'add', id: id || '', layer, segs: [], mode: mode || 'smear', mask: null, strokes: [], w: smearWidth() };
    if (draft.mode === 'smear') {
      draft.mask = newMask();
      // 拿不到 2D 画布（比如没有 canvas 的环境）就退回描线，别让人涂了半天没反应
      if (!draft.mask || typeof draft.mask.getContext !== 'function' || !draft.mask.getContext('2d')) { draft.mask = null; draft.mode = 'line'; }
    }
    adding = true; tool = 'outline'; paper = false;
    if (draft.kind !== 'reshape') selected = '';   // 给某一片重做形状时，别把选中弄丢
    sync(); revealCanvas();
  }
  /* ---------- 涂形状：像涂色一样把一片「抠」出来 ----------
   * 谁也没法一笔勾出体型。所以改成涂：笔刷过的地方都算数，一点一点涂厚、涂宽，
   * 松手就攒起来，涂够了点「✓ 就这一片」—— 程序把涂过的那块地方描成一片。
   * 涂歪了点「↶ 撤一笔」，全错了「✕ 全部重涂」。 */
  /** 这张画布真能画、也真能读回像素吗？（jsdom 之类会给一个空壳 context，画了读不出来） */
  function canvasWorks(cv) {
    try {
      const g = cv.getContext('2d'); if (!g || typeof g.getImageData !== 'function') return false;
      g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1);
      const px = g.getImageData(0, 0, 1, 1);
      return !!(px && px.data && px.data.length >= 4 && px.data[3] > 0);
    } catch (_) { return false; }
  }
  const MW = W + 2 * PADX, MH = H + 2 * PADY;
  function newMask() {
    if (typeof document === 'undefined' || !document.createElement) return null;
    try {
      const cv = document.createElement('canvas'); cv.width = MW; cv.height = MH;
      return canvasWorks(cv) ? cv : null;
    } catch (_) { return null; }
  }
  const maskCtx = () => (draft && draft.mask ? draft.mask.getContext('2d') : null);
  /** 涂形状的笔要比画细节粗，抠形状才痛快 */
  function smearWidth() { return Math.max(16, (width || 6) * 2.5); }
  /** 把一小段轨迹画进累积画布（白笔画在透明底上） */
  function smearInto(pts, w) {
    const g = maskCtx(); if (!g || !pts || !pts.length) return;
    g.save(); g.translate(PADX, PADY); g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#fff'; g.lineWidth = w;
    g.beginPath();
    pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
    if (pts.length === 1) g.lineTo(pts[0][0] + 0.01, pts[0][1] + 0.01);
    g.stroke(); g.restore();
    if (draft) draft.maskVer = (draft.maskVer || 0) + 1;
  }
  /** 撤掉一笔之后按剩下的笔重画一遍 */
  function rebuildMask() {
    const g = maskCtx(); if (!g || !draft) return;
    g.clearRect(0, 0, MW, MH); draft.maskVer = (draft.maskVer || 0) + 1;
    for (const stroke of draft.strokes) for (const seg of stroke) smearInto(seg, draft.w);
  }
  /** 涂过的区域描成一片：取连起来的最大那一块 */
  function polyFromMask() {
    const g = maskCtx(); if (!g) return null;
    const px = g.getImageData(0, 0, MW, MH).data;
    const data = new Uint8Array(MW * MH);
    let n = 0;
    for (let i = 0; i < MW * MH; i++) if (px[i * 4 + 3] > 30) { data[i] = 1; n++; }
    if (n < 60) return null;
    const loops = S.outerContours({ w: MW, h: MH, data }, { minArea: Math.max(200, n * 0.2), eps: 1.2, smooth: 2 });
    if (!loops || !loops.length) return null;
    let best = null, bestA = 0;
    for (const l of loops) { const a = Math.abs(S.polygonArea(l)); if (a > bestA) { bestA = a; best = l; } }
    // 累积画布比世界大一圈，轮廓坐标要减回去
    return best && best.length >= 3 ? best.map(q => [q[0] - PADX, q[1] - PADY]) : null;
  }
  /** 连起来可能自己交叉（手抖、段序乱）：按越来越粗的粒度再简化一次，救得回来就用救回来的 */
  function cleanLoop(pts) {
    for (const eps of [1.6, 3, 5, 8]) {
      const p = S.simplifyLoop(pts, eps);
      if (p && p.length >= 3 && valid(p)) return p;
    }
    return null;
  }
  function looksClosed(pts) {
    if (!pts || pts.length < 3) return false;
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const a = pts[0], b = pts[pts.length - 1];
    const gap = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (gap < CLOSE_GAP) return true;
    if (gap >= len * 0.35) return false;      // 口开得太大，只是一条弧 / 几条边，还没围起来
    return valid(pts);                          // 首尾连起来不自交、面积也够 —— 当成围成的一圈
  }
  /** 松手：这一笔并进草稿。已经围成一圈就直接成片，省得再点一次。 */
  function pushDraft(pts) {
    // 画回起点时最后一点会和第一点重合，dp 遇上首尾同点会整条退化成两个点，先把它去掉
    let raw = pts;
    if (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1) raw = pts.slice(0, -1);
    // ★ 单段是开链，只能用 dp 简化：simplifyLoop 会把首尾接起来算，末点正好在这条连线上的时候会被它当成废点删掉
    const seg = S.dp(raw, 1.6);
    if (!seg || seg.length < 2) { say('这一笔太短了，画长一点再松手。'); sync(); return; }
    draft.segs.push(seg);
    if (looksClosed(seg) || (draft.segs.length > 1 && looksClosed(draft.segs.flat()))) { closeDraft(); return; }
    say(`第 ${draft.segs.length} 段好了，接着画下一段（段和段会自动接上）。画够了点「✓ 合上成一片」。`);
    sync();
  }
  function closeDraft() {
    if (!draft) return;
    if (draft.mode === 'smear') { closeSmear(); return; }
    const pts = draft.segs.flat();
    if (pts.length < 3) { say('还没画够 —— 至少画出一条弧线，合上时首尾会自动连起来。'); sync(); return; }
    const target = draft.kind === 'reshape' ? objAt(draft.id) : null;
    const poly0 = cleanLoop(pts);
    if (!poly0) { say('这几段连起来自己交叉了：点「↶ 撤一段」去掉最后那段，或者「✕ 全部重画」。草稿还留着。'); sync(); return; }
    const warn = guardPoly(draft.kind === 'reshape' && target ? target.poly : null, poly0);
    if (warn) { say(warn + '草稿还留着，改一下再合。'); sync(); return; }
    const poly = maybeSymmetric(poly0);
    const before = copy(d);
    let id = '';
    try {
      if (draft.kind === 'reshape' && target) { reshape(d, target.id, poly); id = target.id; }
      else id = add(d, draft.layer, poly, color);
    } catch (err) { d = before; rebuild(); api.change(copy(d)); say(err.message); sync(); return; }
    selected = id; draft = null; adding = false;
    history.push(before); if (history.length > 40) history.shift(); redo = [];
    commit();
    const nm = objAt(id) ? objAt(id).name : '新的一片';
    say(symNote + `「${nm}」成了，它就长在你画的地方。想再往上压一层，再点「＋ 加发片」。`);
  }
  /** 涂过的那块地方成一片 */
  function closeSmear() {
    const poly0 = polyFromMask();
    if (!poly0) { say('还没涂出一块地方 —— 在画布上按住涂几笔，涂够了再点「✓ 就这一片」。'); sync(); return; }
    const target = draft.kind === 'reshape' ? objAt(draft.id) : null;
    const polyS = S.simplifyLoop(poly0, 1.6) || poly0;
    // 涂多大就是多大：这里**不比**面积 —— 涂出来的形状本来就是你要的形状，
    // 拿它跟原来那片比「有没有差三倍」只会把人卡死（改小改大都被拒，就是「合上成一片」点了没反应的老毛病）
    const warn = guardPoly(null, polyS);
    if (warn) { say(warn + '接着涂，或者「✕ 全部重涂」。'); sync(); return; }
    if (!valid(polyS)) { say('涂的这块太碎、自己绕进去了 —— 再涂厚一点，连成一整块。'); sync(); return; }
    const poly = maybeSymmetric(polyS, true);
    const before = copy(d);
    let id = '';
    try {
      if (draft.kind === 'reshape' && target) { reshape(d, target.id, poly); id = target.id; }
      else id = add(d, draft.layer, poly, color);
    } catch (err) { d = before; rebuild(); api.change(copy(d)); say(err.message); sync(); return; }
    selected = id; draft = null; adding = false;
    history.push(before); if (history.length > 40) history.shift(); redo = [];
    commit();
    const nm = objAt(id) ? objAt(id).name : '新的一片';
    say(symNote + `「${nm}」成了，形状就是你涂出来的那块。想再往上压一层，再点「＋ 加发片」。`);
  }
  /** 一笔就围成一整圈（画得快的人、或者就画个圆）：松手立刻成片，不用再点一下。
   *  画不准也没关系 —— 没围成圈的那些会留在草稿里接着涂，不会作废。 */
  function commitClosed(pts, kind, id, lay) {
    const before = copy(d);
    try {
      let poly = cleanLoop(pts) || S.simplifyLoop(pts, 1.6);
      const target = kind === 'reshape' ? objAt(id) : null;
      const warn = guardPoly(target ? target.poly : null, poly);
      if (warn) throw Error(warn);
      if (!valid(poly)) throw Error('这一圈太小或者自己交叉了。要一点点涂的话，接着在画布上涂就行，不用围成圈。');
      poly = maybeSymmetric(poly);
      if (target) { reshape(d, target.id, poly); selected = target.id; }
      else { selected = add(d, lay || layer, poly, color); }
      if (!objAt(selected)) throw Error('这一层里找不到目标，已保留原样。');
      draft = null; adding = false;   // 成了才收草稿；没成（下面 catch）草稿留着接着涂
      history.push(before); if (history.length > 40) history.shift(); redo = [];
      commit();
      const nm = objAt(selected) ? objAt(selected).name : '这一片';
      say(symNote + `「${nm}」成了。想再叠一层，点「＋ 加发片」或者直接在空白处接着涂。`);
    } catch (err) {
      d = before; rebuild(); api.change(copy(d));
      say(err.message);
    }
    sync();
  }
  function popDraft() {
    if (!draft) return;
    if (draft.mode === 'smear') {
      if (!draft.strokes.length) { say('还没涂过，没有能撤的笔。'); sync(); return; }
      draft.strokes.pop(); rebuildMask();
      say(draft.strokes.length ? `撤掉了最后一笔，还剩 ${draft.strokes.length} 笔，接着涂。` : '都撤完了，从头再涂吧。');
      sync(); return;
    }
    if (!draft.segs.length) { say('还没有可以撤的段。'); sync(); return; }
    draft.segs.pop();
    say(draft.segs.length ? `撤掉了最后一段，还剩 ${draft.segs.length} 段，接着画。` : '都撤完了，从头再画吧。');
    sync();
  }
  function clearDraft() { draft = null; adding = false; say('草稿清掉了，重新画。'); sync(); }
  /** 涂形状松手：笔迹已经在涂的时候攒进去了，这里只报个数 */
  function pushSmear() {
    if (!draft) return;
    if (draft.strokes.length && !draft.strokes[draft.strokes.length - 1].length) draft.strokes.pop();   // 空笔丢掉
    const n = draft.strokes.length;
    say(n ? `涂了 ${n} 笔，接着涂。涂够了点「✓ 就这一片」。` : '这一笔太短了，按住多涂一点再松手。');
    sync();
  }
  /** 涂的时候把已经涂到的地方显示出来 */
  function drawSmear(c) {
    if (!draft || draft.mode !== 'smear' || !draft.mask) return;
    // 累积画布里是白笔，直接盖上去在浅色底上几乎看不见 —— 染成深橙色再画
    if (!draft.tint || draft.tintVer !== draft.maskVer) {
      if (!draft.tint) { try { draft.tint = document.createElement('canvas'); draft.tint.width = MW; draft.tint.height = MH; } catch (_) { draft.tint = null; } }
      const t = draft.tint && draft.tint.getContext && draft.tint.getContext('2d');
      if (t) {
        t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, MW, MH);
        t.drawImage(draft.mask, 0, 0);
        t.globalCompositeOperation = 'source-in'; t.fillStyle = '#e2561c'; t.fillRect(0, 0, MW, MH);
        t.globalCompositeOperation = 'source-over';
        draft.tintVer = draft.maskVer;
      }
    }
    c.save(); c.globalAlpha = 0.8; c.drawImage(draft.tint || draft.mask, -PADX, -PADY); c.restore();
  }
  /** 涂形状时底下那条提示条 */
  function syncDraft() {
    const bar = $('#designDraft'); if (!bar) return;
    bar.hidden = !draft;
    if (!draft) return;
    const txt = $('#designDraftTxt'); if (!txt) return;
    const ok = $('[data-daction="draftOk"]');
    const und = $('[data-daction="draftUndo"]');
    if (draft.mode === 'smear') {
      const n = draft.strokes.length;
      txt.innerHTML = n
        ? `<b>已涂 ${n} 笔</b><span class="dsDelta">接着涂，涂够了一点「✓ 就这一片」</span>`
        : `<b>涂形状</b><span class="dsDelta">按住随便涂 —— 涂到哪儿算哪儿，不用围成圈，也不用一口气画完</span>`;
      if (ok) ok.textContent = '✓ 就这一片';
      if (und) und.textContent = '↶ 撤一笔';
      return;
    }
    const n = draft.segs.length;
    if (ok) ok.textContent = '✓ 合上成一片';
    if (und) und.textContent = '↶ 撤一段';
    txt.innerHTML = n
      ? `<b>已画 ${n} 段</b><span class="dsDelta">接着画下一段，够了一点「✓ 合上成一片」</span>`
      : `<b>慢慢描</b><span class="dsDelta">画一段松一次手，段和段自动接上 —— 不用一口气围成一圈</span>`;
  }
  /** 发片才显示工艺切换：缝在发际线 / 贴上去 */
  function syncHairUI() {
    if (!hairRow) return;
    const o = cur(), on = !!o && o.layer === 'hair';
    hairRow.hidden = !on;
    if (!on) return;
    const kind = attachKind(d, o);
    host.querySelectorAll('[data-dattach]').forEach(b => b.classList.toggle('on', b.dataset.dattach === kind));
    if (hairNote) hairNote.textContent = kind === 'sewn'
      ? '缝：根部对准发际线，沿发际线加固缝一圈，发梢自然垂下。'
      : '贴：不缝 —— 在发际线涂布料胶，从发际线往下压着贴；要厚就一层压一层往上叠。';
  }
  const sizeBox = $('#designImageSize'), rotBox = $('#designImageRot'), winBox = $('#designImageWindow');
  const imgLockBtn = $('[data-daction="imgLock"]'), imgClearBtn = $('[data-daction="imgClear"]');
  const objAt = (id) => d.objects.find(o => o.id === id);
  const cur = () => objAt(selected);
  /* ---------- 整张图纸体型的「分页」 ----------
   * 面部、身体各是单独一张平面，各分正面 / 背面；发片、衣服另起一页，下面垫着整只娃好对位置。
   *   面部·正面 = 脸片；面部·背面 = 后脑左右两片并排；身体·正面 / 背面 = 身体·前 / 身体·后。
   * 不是整张图纸的体型（2.5D 白坯）不分页，还是原来那样。 */
  const pageMode = () => shapeLocked();
  const visibleIn = (o) => {
    if (o.layer === 'hair') return !!o.onBack === (side === 'back');   // 发片：正面看正面的，背面看背面的，不再混在一起
    if (!pageMode()) return true;
    if (o.piece && !(layer === 'face' && side === 'back')) return false;   // 后脑两片只在「面部·背面」页出现
    if (layer === 'face') return o.layer === 'face' && (side === 'back' ? !!o.piece : !o.piece);
    if (layer === 'body') return o.layer === 'body';
    return true;                      // 发片 / 衣服页：整只娃都在，发片压在上面
  };
  const visObjs = () => d.objects.filter(o => o.layer === layer && visibleIn(o));
  /** 后脑那两片是单面的图纸原片，笔迹存在 front 里；别的对象照旧按当前这一面存 */
  const skey = (o) => (o.piece ? 'front' : side);
  /** 背面要左右翻着画（从背后看），后脑两片已经是「背后看」的摆法，不翻 */
  const flipped = () => side === 'back' && !(pageMode() && layer === 'face');
  const mir = () => mirrorBox ? mirrorBox.checked : false;
  const axis = () => Math.max(0, Math.min(W, Number(axisBox && axisBox.value) || 200));

  /* ---------- 视图换算 ---------- */
  function fitBox(b, pad) {
    const s = Math.min((VW - pad * 2) / Math.max(b.w, 1), (VH - pad * 2) / Math.max(b.h, 1));
    vue.scale = Math.max(0.4, Math.min(5, s));
    vue.x = (VW - b.w * vue.scale) / 2 - b.x * vue.scale;
    vue.y = (VH - b.h * vue.scale) / 2 - b.y * vue.scale;
  }
  /** 画布吃满舞台：舞台多大，画布的逻辑像素就多大（一份逻辑像素 = 2×2 个真像素，和以前一样清晰） */
  function resizeView() {
    if (!canvas || !canvas.getBoundingClientRect) return false;
    const b = canvas.getBoundingClientRect();
    if (!b || !(b.width > 60) || !(b.height > 60)) return false;
    const w = Math.round(b.width), h = Math.round(b.height);
    if (w === VW && h === VH) return false;
    VW = w; VH = h; canvas.width = w * 2; canvas.height = h * 2;
    return true;
  }
  function overview() { fitBox({ x: 0, y: 0, w: W, h: H }, 6); draw(); }
  function focusLayer() {
    const os = pageMode() ? visObjs() : d.objects.filter(o => o.layer === layer);
    const t = os.find(o => o.id === selected) || os[0];
    if (!t) { overview(); return; }
    // 面部·背面页：后脑两片一起框进来；发片 / 衣服页框整只娃的头 + 身体，发片能翘出头外
    if (pageMode() && layer === 'face' && side === 'back') {
      const bs = os.map(o => C.boxOfPoly(o.poly)), x0 = Math.min(...bs.map(b => b.x)), y0 = Math.min(...bs.map(b => b.y));
      fitBox({ x: x0, y: y0, w: Math.max(...bs.map(b => b.x + b.w)) - x0, h: Math.max(...bs.map(b => b.y + b.h)) - y0 }, 30); draw(); return;
    }
    if (pageMode() && (layer === 'hair' || layer === 'clothes')) { overview(); return; }
    fitBox(C.boxOfPoly(t.poly), 42); draw();
  }
  function paperFit() {
    const p = paperTpl.pieces.find(x => x.design.objectId === selected && x.design.mirror === (side === 'back'))
      || paperTpl.pieces.find(x => x.design.objectId === selected);
    const b = p ? C.boxOfPoly(p.poly) : { x: 0, y: 0, w: paperTpl.w, h: paperTpl.h };
    const pad = p ? 34 : 8;
    paperScale = Math.min((VW - pad * 2) / Math.max(b.w, 1), (VH - pad * 2) / Math.max(b.h, 1));
    paperX = (VW - b.w * paperScale) / 2 - b.x * paperScale;
    paperY = (VH - b.h * paperScale) / 2 - b.y * paperScale;
  }

  let paperScale = 1, paperX = 8, paperY = 8;

  const rawPoint = (e) => {
    const b = rect || canvas.getBoundingClientRect();
    return [(e.clientX - b.left) * VW / b.width, (e.clientY - b.top) * VH / b.height];
  };
  // 屏幕 → world（含背面镜像与当前视图变换）
  const worldPoint = (e) => {
    const q = rawPoint(e);
    return [(flipped() ? VW - vue.x - q[0] : q[0] - vue.x) / vue.scale, (q[1] - vue.y) / vue.scale];
  };
  const sheetPoint = (e) => {
    const p = rawPoint(e);
    return [(p[0] - paperX) / paperScale, (p[1] - paperY) / paperScale];
  };
  // 纸样坐标 → world（唯一正本）
  const toWorld = (q, map) => [map.mirror ? 400 - (q[0] - map.dx) : q[0] - map.dx, q[1] - map.dy];
  const pointOf = (e, map) => (paper ? toWorld(sheetPoint(e), map) : worldPoint(e));

  const say = (msg) => { notice = msg; if (status) status.textContent = msg; };

  /** 贴图 / 3D 的轻量同步：只改数据不出几何，让 app 那边去重排一次纸样 */
  function requestChange() {
    if (paper) rebuild();
    api.change(copy(d));
  }
  /** 贴图控件跟当前选中部件对齐 */
  function syncImgUI() {
    const o = cur(), im = o && o.img;
    if (sizeBox) {
      sizeBox.disabled = !im;
      if (im && im.bw) sizeBox.value = String(Math.max(10, Math.min(400, Math.round(im.w / im.bw * 100))));
    }
    if (rotBox) {
      rotBox.disabled = !im;
      rotBox.value = im ? String(Math.round((im.rot || 0) * 180 / Math.PI)) : '0';
    }
    if (winBox) { winBox.disabled = !im; if (im) winBox.checked = im.window !== false; }
    if (imgLockBtn) { imgLockBtn.disabled = !im; imgLockBtn.textContent = im && im.locked ? '🔓 解锁重摆' : '🔒 固定位置'; }
    if (imgClearBtn) imgClearBtn.disabled = !im;
  }

  /* ---------- 历史 ---------- */
  const snapshot = () => { history.push(copy(d)); if (history.length > 40) history.shift(); redo = []; };
  const rebuild = () => { paperTpl = template(root.NunuPattern.cookie, d); };
  const commit = () => { rebuild(); if (paper) paperFit(); api.change(copy(d)); sync(); };
  function travel(a) {
    if (drag) return;
    const from = a === 'undo' ? history : redo, to = a === 'undo' ? redo : history;
    if (!from.length) { say(a === 'undo' ? '没有可以撤销的操作了。' : '没有可以重做的了。'); sync(); return; }
    to.push(copy(d)); d = from.pop(); rebuild(); api.change(copy(d)); sync();
  }

  /* ---------- 绘制 ---------- */
  const path = (c, ps) => { c.beginPath(); ps.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p))); c.closePath(); };
  function drawStroke(c, st) { paintStroke(c, st); }
  /** 发际线与发片根部：让人看见发片是从这条线缝/贴出来的，不是浮在脑袋上 */
  function drawHairRoots(c) {
    const hl = hairline(d);
    if (hl && layer === 'hair' && hl.pts.length > 1) {
      c.save();
      c.setLineDash([5 / vue.scale, 4 / vue.scale]);
      c.lineWidth = 1.2 / vue.scale; c.strokeStyle = '#7fa8d8';
      c.beginPath(); hl.pts.forEach((q, i) => (i ? c.lineTo(...q) : c.moveTo(...q))); c.stroke();
      c.setLineDash([]);
      const tip = hl.pts[Math.floor(hl.pts.length / 2)];
      c.fillStyle = '#5b86b8'; c.textAlign = 'center'; c.font = `${11 / vue.scale}px system-ui, "PingFang SC", sans-serif`;
      c.fillText('发际线', tip[0], tip[1] - 6 / vue.scale);
      c.restore();
    }
    for (const o of d.objects) {
      if (o.layer !== 'hair' || !o.root) continue;
      const kind = attachKind(d, o), on = o.id === selected;
      c.save();
      // 缝：紫色针脚虚线；贴：橙色胶点，一眼能分出这片是缝的还是粘的
      c.lineWidth = (on ? 2.8 : 1.7) / vue.scale;
      c.strokeStyle = kind === 'sewn' ? '#8a5ca8' : '#c98f2e';
      c.setLineDash(kind === 'sewn' ? [3.5 / vue.scale, 2.5 / vue.scale] : [1.6 / vue.scale, 2.2 / vue.scale]);
      c.beginPath(); c.moveTo(...o.root.a); c.lineTo(...o.root.b); c.stroke();
      c.restore();
    }
  }
  /** 整张图纸体型的定位线：图纸自带的脸窗、眼睛、嘴，从图纸坐标换算到画布上。
   *  换算和 template() 的 mapOnto 是同一套（横向中心对中心、纵向顶对顶、等比），所以线在哪儿，画上去的东西就落在图纸那儿。 */
  function boardGuides() {
    if (!shapeLocked()) return null;
    const tpl = baseTpl(), g = tpl && tpl.guides;
    if (!g || !g.lens) return null;
    const fp = tpl.pieces.find(p => C.isFace(p)), fo = d.objects.find(o => o.id === 'face');
    if (!fp || !fo) return null;
    const rb = C.boxOfPoly(fp.poly), ob = C.boxOfPoly(fo.poly), s = ob.w / Math.max(1e-6, rb.w);
    const map = q => [(q[0] - rb.x - rb.w / 2) * s + ob.x + ob.w / 2, (q[1] - rb.y) * s + ob.y];
    const out = { face: ob };
    for (const k of ['lens', 'eyeL', 'eyeR', 'mouth']) if (g[k] && g[k].length) out[k] = g[k].map(map);
    const body = d.objects.find(o => o.id === 'body');
    if (body) out.body = C.boxOfPoly(body.poly);
    return out;
  }
  function drawGuides(c) {
    if (!showGuides || side !== 'front' || layer !== 'face' || paper) return;
    const gd = boardGuides(); if (!gd) return;
    const u = 1 / vue.scale;
    const trace = (pts, close) => { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); if (close) c.closePath(); c.stroke(); };
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.font = `${11 * u}px system-ui, "PingFang SC", sans-serif`; c.textAlign = 'center';
    const BLUE = '#3f78b5';
    c.strokeStyle = BLUE; c.fillStyle = BLUE; c.lineWidth = 1.6 * u; c.setLineDash([5 * u, 4 * u]);
    if (gd.lens) trace(gd.lens, true);
    c.setLineDash([]); c.lineWidth = 1.8 * u;
    for (const k of ['eyeL', 'eyeR', 'mouth']) if (gd[k]) trace(gd[k], true);
    // 眼线：穿过两只眼睛的横线，两边的眼睛画在一条水平线上
    const ys = [...(gd.eyeL || []), ...(gd.eyeR || [])].map(q => q[1]);
    const f = gd.face;
    if (ys.length) {
      const ey = (Math.min(...ys) + Math.max(...ys)) / 2;
      c.setLineDash([2 * u, 4 * u]); c.lineWidth = 1.2 * u;
      c.beginPath(); c.moveTo(f.x, ey); c.lineTo(f.x + f.w, ey); c.stroke();
      c.setLineDash([]); c.fillText('眼线', f.x + 16 * u, ey - 4 * u);
    }
    if (gd.mouth) { const my = Math.min(...gd.mouth.map(q => q[1])); c.fillText('嘴', gd.mouth.reduce((a, q) => a + q[0], 0) / gd.mouth.length, my - 4 * u); }
    if (gd.eyeL) c.fillText('眼', gd.eyeL.reduce((a, q) => a + q[0], 0) / gd.eyeL.length, Math.min(...gd.eyeL.map(q => q[1])) - 4 * u);
    if (gd.eyeR) c.fillText('眼', gd.eyeR.reduce((a, q) => a + q[0], 0) / gd.eyeR.length, Math.min(...gd.eyeR.map(q => q[1])) - 4 * u);
    // 脸、身体各一条竖中线（打开「左右对称」时对称轴那条粉线已经在了，就不重复）
    if (!mir()) {
      c.setLineDash([6 * u, 4 * u]); c.lineWidth = 1.1 * u;
      const mid = f.x + f.w / 2;
      c.beginPath(); c.moveTo(mid, f.y); c.lineTo(mid, f.y + f.h); c.stroke();
      if (gd.body) { const bm = gd.body.x + gd.body.w / 2; c.beginPath(); c.moveTo(bm, gd.body.y); c.lineTo(bm, gd.body.y + gd.body.h); c.stroke(); }
    }
    c.restore();
  }
  function draw() {
    drawOne(canvas, false);
    if (!preview.hidden) drawOne(preview, true);
  }
  /** 「改体型」模式下的方框 + 八个小方块。待确认时画成橙色虚线，一眼看出还没打钩。 */
  function drawHandles(c, o) {
    if (!o || o.locked) return;               // 固定住的片不出把手，从源头杜绝误拖
    const box = C.boxOfPoly(o.poly), r = 4.5 / vue.scale, lw = 1.4 / vue.scale;
    c.save();
    if (pending) c.setLineDash([6 / vue.scale, 4 / vue.scale]);
    c.strokeStyle = pending ? '#e0862e' : '#4f8f74'; c.lineWidth = lw;
    c.strokeRect(box.x, box.y, box.w, box.h);
    c.setLineDash([]);
    for (const h of HANDLES) {
      const q = handlePoint(box, h);
      c.beginPath(); c.rect(q[0] - r, q[1] - r, r * 2, r * 2);
      c.fillStyle = '#fffefb'; c.fill();
      c.strokeStyle = '#e0862e'; c.lineWidth = lw; c.stroke();
    }
    // 挪位置的把手画在方框上方：四个箭头 + 横杠，看上去就是「能拖着走」
    const m = movePoint(box), t = 4 / vue.scale;
    c.strokeStyle = '#e0862e'; c.lineWidth = lw;
    c.beginPath(); c.rect(m[0] - t, m[1] - t * .55, t * 2, t * 1.1);
    c.fillStyle = '#fffefb'; c.fill(); c.stroke();
    c.beginPath();
    c.moveTo(m[0] - t, m[1] - t * 1.6); c.lineTo(m[0] - t * 2.4, m[1] - t * 1.6);
    c.moveTo(m[0] - t * 1.6, m[1] - t * 2.2); c.lineTo(m[0] - t * 1.6, m[1] - t * .8);
    c.moveTo(m[0] + t, m[1] - t * 1.6); c.lineTo(m[0] + t * 2.4, m[1] - t * 1.6);
    c.moveTo(m[0] + t * 1.6, m[1] - t * 2.2); c.lineTo(m[0] + t * 1.6, m[1] - t * .8);
    c.stroke();
    c.restore();
  }
  function drawOne(cv, isPreview) {
    const c = cv.getContext('2d');
    const vw = isPreview ? W : VW, vh = isPreview ? H : VH;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, vw, vh);
    c.fillStyle = isPreview ? '#f4f1e9' : '#fffefb'; c.fillRect(0, 0, vw, vh);
    if (paper && !isPreview) return drawPaper(c);
    c.save();
    if (flipped()) { c.translate(vw, 0); c.scale(-1, 1); }
    c.translate(vue.x, vue.y); c.scale(vue.scale, vue.scale);
    for (const o of ordered(d).filter(visibleIn)) {
      const im = o.img;
      const bmp = im && im.src ? getImg(im.src) : null;   // 顺手登记，图异步解好后会回调重画
      const win = !!(bmp && imgReady(im.src) && im.window !== false);
      if (isPreview) { c.save(); c.translate(3, 4); path(c, o.poly); c.fillStyle = '#cec3b4'; c.shadowColor = '#a4978544'; c.shadowBlur = 8; c.fill(); c.restore(); }
      // ★ 发片是「往上叠了一层」的布，不是纸一样的贴纸：垫一道厚度 + 影子，一眼看出这片压在那片上面
      if (o.layer === 'hair') {
        c.save();
        c.translate(2.4 / vue.scale, 3.2 / vue.scale);
        path(c, o.poly);
        c.fillStyle = 'rgba(94,72,54,0.34)'; c.fill();
        c.lineWidth = 1.8 / vue.scale; c.strokeStyle = 'rgba(94,72,54,0.5)'; c.stroke();
        c.restore();
      }
      path(c, o.poly);
      // 勾了「留空窗」就不打底色：图没盖住的地方就是透光的缺口
      if (!win) { c.fillStyle = skey(o) === 'front' ? o.color : o.backColor; c.fill(); }
      c.save(); c.clip();
      if (im) imageDraw(c, im);
      for (const st of o[skey(o)]) drawStroke(c, st);
      c.restore();
      path(c, o.poly);
      c.strokeStyle = !isPreview && o.id === selected ? '#4f8f74' : '#cbbcab';
      c.lineWidth = (!isPreview && o.id === selected ? 2.2 : 0.8) / vue.scale;
      c.stroke();
    }
    if (!isPreview) { drawGuides(c); drawHairRoots(c); }
    // 挪贴图模式下给那片子画个虚线框，看得见才抓得住
    const held = !isPreview && tool === 'image' && cur() ? cur().img : null;
    if (held) {
      c.save(); c.translate(held.cx, held.cy); if (held.rot) c.rotate(held.rot);
      c.setLineDash([5 / vue.scale, 4 / vue.scale]);
      c.strokeStyle = held.locked ? '#a9a294' : '#4f8f74'; c.lineWidth = 1.6 / vue.scale;
      c.strokeRect(-held.w / 2, -held.h / 2, held.w, held.h);
      c.restore();
    }
    if (!isPreview && mir()) {
      c.save(); c.setLineDash([6 / vue.scale, 4 / vue.scale]); c.beginPath();
      c.moveTo(axis(), -PADY * 4); c.lineTo(axis(), H + PADY * 4); c.strokeStyle = '#e0a0b4'; c.lineWidth = 1 / vue.scale; c.stroke(); c.restore();
    }
    // 涂形状：已经涂到的地方整块显示出来
    if (!isPreview) drawSmear(c);
    // 慢慢描的草稿：已经画好的段连成一条，末尾到开头那条「合上时会连的边」画成虚线
    if (draft && draft.segs.length && !isPreview) {
      const all = draft.segs.flat();
      c.save();
      c.strokeStyle = color; c.lineWidth = 2.4 / vue.scale; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); all.forEach((q, i) => (i ? c.lineTo(...q) : c.moveTo(...q))); c.stroke();
      if (all.length > 2) {
        c.setLineDash([4 / vue.scale, 3 / vue.scale]);
        c.strokeStyle = '#c98f2e'; c.lineWidth = 1.6 / vue.scale;
        c.beginPath(); c.moveTo(...all[all.length - 1]); c.lineTo(...all[0]); c.stroke();
        c.setLineDash([]);
      }
      for (const q of draft.segs.map(s => s[0])) {
        c.beginPath(); c.arc(q[0], q[1], 2.6 / vue.scale, 0, Math.PI * 2);
        c.fillStyle = '#fffefb'; c.fill(); c.strokeStyle = '#c98f2e'; c.lineWidth = 1.2 / vue.scale; c.stroke();
      }
      c.restore();
    }
    if (drag && drag.mode === 'outline' && !isPreview) {
      c.beginPath(); drag.points.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
      c.strokeStyle = color; c.lineWidth = 2 / vue.scale; c.stroke();
    }
    if (!isPreview && !paper && tool === 'outline') drawHandles(c, adding ? null : cur());
    c.restore();
  }
  function drawPaper(c) {
    c.save(); c.translate(paperX, paperY); c.scale(paperScale, paperScale);
    for (const p of paperTpl.pieces) {
      const o = objAt(p.design.objectId); if (!o) continue;
      paint(c, { ...p, design: { ...p.design, color: p.design.mirror ? o.backColor : o.color, strokes: p.design.mirror ? o.back : o.front } }, 'preview');
      path(c, p.poly);
      c.strokeStyle = p.design.objectId === selected ? '#4f8f74' : '#cbbcab';
      c.lineWidth = 1.6 / paperScale; c.stroke();
      for (const e of p.seamEdges) {
        c.beginPath(); e.pts.forEach((q, i) => (i ? c.lineTo(...q) : c.moveTo(...q)));
        c.strokeStyle = e.color; c.lineWidth = 1 / paperScale; c.stroke();
      }
      const b = C.boxOfPoly(p.poly);
      c.font = `${9 / paperScale}px sans-serif`; c.fillStyle = '#8a8272';
      c.fillText(p.name, b.x, b.y + b.h + 13 / paperScale);
    }
    if (drag && drag.mode === 'outline' && drag.screen) {
      c.beginPath(); drag.screen.forEach((q, i) => (i ? c.lineTo(...q) : c.moveTo(...q)));
      c.strokeStyle = color; c.lineWidth = 2 / paperScale; c.stroke();
    }
    c.restore();
  }

  /* ---------- 面板状态 ---------- */
  function setCursor() {
    canvas.style.cursor = tool === 'hand' ? 'grab' : tool === 'image' ? 'move' : 'crosshair';
    // 抓手也管到 3D 那边：选着抓手时，在 3D 上按住拖就是转它、滚轮就是远近（app.js 认这个 class）
    if (typeof document !== 'undefined' && document.body) document.body.classList.toggle('ds-hand', tool === 'hand');
  }
  function sync() {
    if (!objAt(selected) || objAt(selected).layer !== layer || !visibleIn(objAt(selected))) selected = (pageMode() ? visObjs()[0] : d.objects.find(o => o.layer === layer))?.id || '';
    host.querySelectorAll('[data-dlayer]').forEach(b => {
      b.classList.toggle('on', b.dataset.dlayer === layer);
      const c = b.querySelector('em'); if (c) c.textContent = d.objects.filter(o => o.layer === b.dataset.dlayer && !o.piece).length;
    });
    syncHairUI();
    // 整张图纸体型（努努体、公开图纸）不能改体型：入口直接收起来，只留彩绘 / 贴图 / 抓手
    const locked = shapeLocked();
    const outlineBtn = host.querySelector('[data-dtool="outline"]');
    // 发片 / 衣服可以自己挪位置、改大小（所以留着这个工具，改叫「挪发片」）；脸和身体是图纸原片，不给入口
    const movable = locked && (layer === 'hair' || layer === 'clothes');
    if (outlineBtn) {
      outlineBtn.style.display = !locked || movable ? '' : 'none';
      if (locked) {
        outlineBtn.textContent = layer === 'clothes' ? '✥ 挪衣服' : '✥ 挪发片';
        outlineBtn.title = '拖里面 = 挪位置，拖方框上的小方块 = 改大小，在空白处涂 = 长出新的一片';
      }
    }
    // 体型条：现在用哪套、能换哪套；每套能改什么写在旁边
    const bodiesBox = host.querySelector('#dsBodies');
    if (bodiesBox && api.bodyTypes) {
      const list = api.bodyTypes() || [];
      bodiesBox.innerHTML = list.map(b => `<button type="button" data-body="${b.id}" class="${b.on ? 'on' : ''}" title="${b.name}">${b.name}</button>`).join('');
      bodiesBox.querySelectorAll('[data-body]').forEach(btn => { btn.onclick = () => { if (!btn.classList.contains('on') && api.pickBody) api.pickBody(btn.dataset.body); }; });
    }
    const bodyNote = host.querySelector('#dsBodyNote');
    if (bodyNote) bodyNote.textContent = locked ? '这套是整张图纸：外形固定，只画脸 / 身体、加发片 / 衣服。' : '这套可以改体型（拖方框 / 涂形状）。';
    const fabRow = host.querySelector('#designFabricRow');
    if (fabRow) {
      fabRow.hidden = layer !== 'hair';
      const co = cur(), now = (co && co.layer === 'hair' && co.fabric) || defaultFabric;
      host.querySelectorAll('[data-fabric]').forEach(b => b.classList.toggle('on', b.dataset.fabric === now));
      const fn = host.querySelector('#designFabricNote');
      if (fn) fn.textContent = `${FABRICS[now].note}（绒长约 ${FABRICS[now].pile}mm，参考值，以你买的布为准；发片是一整片有厚度的毛料，只裁 1 片。）`;
    }
    const presetRow = host.querySelector('#designHairPresets');
    if (presetRow) presetRow.hidden = layer !== 'hair';
    const rolesBtn = host.querySelector('#rolesBtn');
    if (rolesBtn) rolesBtn.style.display = (api.isImported && api.isImported()) ? '' : 'none';
    const guideBtn = host.querySelector('#guidesBtn');
    if (guideBtn) { guideBtn.style.display = locked && layer === 'face' && side === 'front' ? '' : 'none'; guideBtn.classList.toggle('on', showGuides); }
    if (locked && tool === 'outline' && !movable && !draft && !pending) tool = 'paint';
    // 标题写清楚现在在哪一页
    const pageTitle = host.querySelector('.dsCanvasCard h2');
    if (pageTitle && locked) {
      pageTitle.textContent = layer === 'face' ? (side === 'back' ? '面部 · 背面（后脑左右两片）' : '面部 · 正面（脸片）')
        : layer === 'body' ? (side === 'back' ? '身体 · 背面（身体·后）' : '身体 · 正面（身体·前）')
        : layer === 'hair' ? '发片页 · 发片可以拖着挪位置' : '衣服页';
    } else if (pageTitle) pageTitle.textContent = '01 画的样子';
    host.querySelectorAll('[data-dtool]').forEach(b => b.classList.toggle('on', b.dataset.dtool === tool));
    host.querySelectorAll('[data-dbrush]').forEach(b => b.classList.toggle('on', b.dataset.dbrush === brush));
    host.querySelectorAll('[data-dside]').forEach(b => b.classList.toggle('on', b.dataset.dside === side));
    setCursor();
    host.querySelector('[data-daction="undo"]').disabled = !history.length;
    host.querySelector('[data-daction="redo"]').disabled = !redo.length;
    host.querySelector('[data-daction="ears"]').disabled = layer === 'body' && d.objects.some(o => o.kind === 'ear');
    $('#layoutBtn').textContent = paper ? '🖍 回到整只娃' : '📐 看纸样';
    hint.textContent = (HINTS[layer] || '') + (locked ? ' 这套是整张图纸体型，外形不能改，只能画脸、画身体、加发片 / 衣服。' : '');

    list.replaceChildren();
    for (const o of d.objects.filter(x => x.layer === layer && visibleIn(x))) {
      const li = document.createElement('li');
      li.className = 'dsItem' + (o.id === selected ? ' on' : '');
      li.dataset.obj = o.id;
      const sw = skey(o) === 'front' ? o.color : o.backColor;
      li.innerHTML = `<i class="dsDot" style="background:${sw}"></i><span>${o.name}${o.locked ? ' 🔒' : ''}</span>`;
      li.onclick = () => { selected = o.id; adding = false; sync(); focusLayer(); };
      list.append(li);
    }
    const o = cur();
    const dead = ['body', 'face'].includes(selected);
    host.querySelector('[data-daction="remove"]').disabled = !o || dead;
    const lockBtn = host.querySelector('[data-daction="lock"]');
    if (lockBtn) { lockBtn.disabled = !o; lockBtn.textContent = o && o.locked ? '🔓 解开固定' : '📌 固定这片'; }
    for (const a of ['up', 'down', 'grow', 'shrink', 'fill']) {
      const btn = host.querySelector(`[data-daction="${a}"]`); if (btn) btn.disabled = !o;
    }
    const tip = pending ? `这一片是预览，还没定下来 —— 打钩才算改，点「✕ 放弃」就退回原来的样子。`
      : draft ? `慢慢描：画一段松一次手，段和段会自动接上，画够了点「✓ 合上成一片」。不用一口气围成一圈。`
      : adding ? `围着想要的形状画一圈，松手就往「${LAYER_META.find(l => l.key === layer)?.name}」里加一层；没画闭合也会自动把口封上。`
      : tool === 'hand' ? '按住画布拖动就能挪位置（Shift+拖、鼠标中键也行）。挪完了点回「🎨 彩绘」接着画。'
      : tool === 'outline' ? (o ? (o.locked ? `「${o.name}」被固定着，把手藏起来了。想改形状先点右边「🔓 解开固定」。` : `拖「${o.name}」四周的小方块：拖角改大小、拖上下/左右只拉一边；拖里面挪位置。也可以围着它画一圈重描形状。`) : `先在右边列表里选一片（身体、脑袋、发片都行），再拖它四周的小方块。`)
      : tool === 'image' ? (o && o.img ? `拖着「${o.name}」上的图片挪位置，滚轮放大缩小，摆好后点「🔒 固定位置」。` : `这片还没有贴图，先点「🖼 导入图片贴到这片」。`)
      : (o ? `在「${o.name}」上涂色画花纹。正面和背面各画各的，互不影响。` : '');
    syncImgUI();
    syncConfirm();
    syncDraft();
    status.textContent = notice || tip; notice = '';
    draw();
  }
  /** 待确认条：只在「改体型」拖完之后冒出来 */
  function syncConfirm() {
    if (!confirmBar) return;
    const on = !!pending;
    confirmBar.hidden = !on;
    if (!on || !confirmTxt) return;
    const o = objAt(pending.id); if (!o) return;
    const from = C.boxOfPoly(pending.poly), to = C.boxOfPoly(o.poly);
    const dW = to.w - from.w, dH = to.h - from.h;
    const size = [dW ? `宽 ${dW > 0 ? '+' : ''}${Math.round(dW)}` : '', dH ? `高 ${dH > 0 ? '+' : ''}${Math.round(dH)}` : ''].filter(Boolean).join('，');
    const moved = Math.abs(to.x - from.x) > .5 || Math.abs(to.y - from.y) > .5;
    confirmTxt.innerHTML = `<b>「${o.name}」</b>改好了吗？` +
      (size ? `<span class="dsDelta">${size}</span>` : moved ? '<span class="dsDelta">挪了位置</span>' : '<span class="dsDelta">还没动</span>');
  }
  function setLayer(k) {
    if (pending) acceptShape();          // 换层就把刚才的改动落定，不落下也不丢
    draft = null;
    layer = k; adding = false;
    const first = d.objects.find(o => o.layer === layer);
    selected = first?.id || '';
    // 空图层直接准备好「画一圈新增」，省得还要多点一次
    if (!first) { tool = 'outline'; adding = true; if (paper) { paper = false; } }
    sync(); focusLayer();
  }
  function projectOptions() {
    if (!projects) return;
    projects.replaceChildren();
    const ph = document.createElement('option'); ph.value = ''; ph.textContent = '打开存档…'; projects.append(ph);
    for (const p of (api.projects && api.projects()) || []) {
      const op = document.createElement('option'); op.value = p.id; op.textContent = p.name; projects.append(op);
    }
  }
  function replaceProject(value) {
    d = copy(value); history = []; redo = []; drag = null; adding = false; pending = null; draft = null;
    layer = 'body'; selected = d.objects.find(o => o.layer === 'body')?.id || ''; tool = 'paint'; side = 'front';
    rebuild(); if (paper) paperFit(); api.change(copy(d)); sync(); projectOptions(); focusLayer();
  }

  /* ---------- 形状守卫 ---------- */
  function guardPoly(oldPoly, poly) {
    if (poly && poly.length > 2) {
      // 越界检查放在点数检查之前：画出画布是更明确也更该先说的错误
      const b = C.boxOfPoly(poly);
      if (b.x < -PADX - 2 || b.y < -PADY - 2 || b.x + b.w > W + PADX + 2 || b.y + b.h > H + PADY + 2) return '这一圈超出画布了（笔尖跑到画布外面去了），原来的形状没受影响。';
    }
    if (!poly || poly.length < 3) return '这一圈还没围成一个形状，原来的保留了。';
    // ★ 以前这里还有一条「新面积跟原来差三倍就拒绝」的守卫。它把人卡死了：
    //   改体型本来就是把这片改大改小，差三倍是常事 —— 拒一次，画的就白画了（「莫名其妙给我撤回」）。
    //   画歪了有撤销兜着，不需要这条拦路的规矩。oldPoly 保留在签名里，是为了别处调用不用改。
    return null;
  }
  // 对称做不出来时宁可保留用户画的形状，也不把这一笔丢掉，并把实情写进提示
  let symNote = '';
  function maybeSymmetric(poly, quiet) {
    symNote = '';
    if (!mir()) return poly;
    const xs = poly.map(p => p[0]);
    const lo = Math.min(...xs), hi = Math.max(...xs);
    if (!(lo < axis() - 3 && hi > axis() + 3)) {
      // 涂出来的一块常常只在一侧，这时候不是「画歪了」，别拿一段话去烦人（quiet）
      if (!quiet) symNote = '这张图画没有横跨对称轴，这次没做对称，按你画的样子留下了。想要对称可以把的一边画过对称轴，或者挪一下对称轴位置。';
      return poly;
    }
    const out = symmetricOutline(poly, axis());
    if (!out || out.length < 3 || out === poly) { symNote = '对称算不出来，按你画的样子留下了。'; return poly; }
    return out;
  }

  /* ---------- 图片贴图（拼贴） ---------- */
  const FILE_MAX_PX = 560;                    // 存进作品前先缩到这个尺寸以内，避免塞爆浏览器存档
  function readFile(file, cb) {
    if (!file) return;
    if (typeof FileReader === 'undefined') { say('这个环境读不了本地图片文件。'); return; }
    const fr = new FileReader();
    fr.onload = () => cb(String(fr.result));
    fr.onerror = () => say('这张图读不出来，换一张试试。');
    fr.readAsDataURL(file);
  }
  /** 把 dataURL 压到不会塞爆存档的尺寸，再交给部件 */
  function shrinkThen(src, cb) {
    const im = getImg(src);
    if (!im) { cb(null); return; }
    const go = () => {
      const nw = im.naturalWidth || im.width || 0, nh = im.naturalHeight || im.height || 0;
      if (!nw || !nh) { say('这张图打不开，换一张试试。'); cb(null); return; }
      const k = Math.min(1, FILE_MAX_PX / Math.max(nw, nh));
      if (k >= 0.999) { cb(src); return; }
      try {
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(nw * k)); cv.height = Math.max(1, Math.round(nh * k));
        const c = cv.getContext('2d');
        if ('imageSmoothingQuality' in c) c.imageSmoothingQuality = 'high';
        c.drawImage(im, 0, 0, cv.width, cv.height);
        let out = src;
        try { const png = cv.toDataURL('image/png'); out = png.length > 520000 ? cv.toDataURL('image/jpeg', 0.88) : png; } catch (_) { }
        cb(out);
      } catch (err) { cb(src); }
    };
    if (im.complete && (im.naturalWidth || im.width)) go();
    else { im.onload = go; im.onerror = () => { say('这张图打不开，换一张试试。'); cb(null); }; }
  }
  /** 把一张图铺到某个部件上：等比塞进它的外框，居中 */
  function fitImage(o, src) {
    const im = getImg(src);
    const b = C.boxOfPoly(o.poly);
    const nw = (im && (im.naturalWidth || im.width)) || 1, nh = (im && (im.naturalHeight || im.height)) || 1;
    const k = Math.min(b.w / Math.max(nw, 1), b.h / Math.max(nh, 1));
    const w = Math.max(6, nw * k), h = Math.max(6, nh * k);
    return { src, cx: b.x + b.w / 2, cy: b.y + b.h / 2, w, h, bw: w, bh: h, rot: 0, locked: false, window: true, nw, nh };
  }
  function pickImage(o) {
    if (!o) { say('先在右边列表里选一片，再导入图片。'); return; }
    const input = $('#designImagePick');
    if (!input) return;
    input.value = '';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      readFile(file, (dataUrl) => {
        if (!dataUrl) return;
        shrinkThen(dataUrl, (small) => {
          if (!small) return;
          const before = copy(d);
          o.img = fitImage(o, small);
          o.img.window = !!(winBox && winBox.checked);
          history.push(before); if (history.length > 40) history.shift(); redo = [];
          tool = 'image'; adding = false;
          commit(); focusLayer();
          say(`图已经铺在「${o.name}」上了。用「🖼 挪贴图」拖着摆位置，滚轮调大小，摆好了点「🔒 固定」。`);
        });
      });
    };
    if (typeof input.click === 'function') input.click();
  }
  function imageDraw(c, im) { return im && im.src ? drawImgAt(c, im) : false; }

  /* ---------- 透明底发片：一张 PNG 直接变成发片 ----------
   * 描一片发片太难，另一条路是拿现成的素材：透明底（或白底）的发片 PNG 传进来，
   * 按透明/白的地方把「有颜色的部分」抠成一片或多片，图铺回自己那片上、透明处留空窗。
   * 这几片是各自独立的一片，可以分别选中、彩绘、挪位置、再往上压一层。
   */
  /** 把抠出来的几片摆到头上：整张图等比缩放，宽度对齐脸宽，垂直落在发际线那一带 */
  function placeHairPieces(res, src, nw, nh) {
    let ux = Infinity, uy = Infinity, ux2 = -Infinity, uy2 = -Infinity;
    for (const p of res.pieces) { const b = p.box; if (b.x < ux) ux = b.x; if (b.y < uy) uy = b.y; if (b.x + b.w > ux2) ux2 = b.x + b.w; if (b.y + b.h > uy2) uy2 = b.y + b.h; }
    const uw = Math.max(1, ux2 - ux), uh = Math.max(1, uy2 - uy);
    const face = d.objects.find(o => o.id === 'face');
    const fb = face ? C.boxOfPoly(face.poly) : { x: 100, y: 120, w: 200, h: 240 };
    // 发片要比脑袋略宽才盖得住；太高就整体缩一点，别顶出画布
    let s = (fb.w * 1.08) / uw;
    if (uh * s > H * 0.5) s = (H * 0.5) / uh;
    if (uw * s > W - 16) s = (W - 16) / uw;
    const cx = fb.x + fb.w / 2, cy = fb.y + fb.h * 0.32;        // 落在发际线那一带：往上是后发，往下是刘海
    let ox = cx - uw * s / 2, oy = cy - uh * s / 2;
    ox = Math.max(2, Math.min(ox, W - uw * s - 2));
    oy = Math.max(2, Math.min(oy, H - uh * s - 2));
    // 整张图左上角在画布上的位置：每片共用同一张图，位置才对得齐
    const imgCx = (0 - ux) * s + ox + nw * s / 2, imgCy = (0 - uy) * s + oy + nh * s / 2, imgW = nw * s, imgH = nh * s;
    let made = 0;
    for (const p of res.pieces) {
      const poly = p.poly.map(([x, y]) => [(x - ux) * s + ox, (y - uy) * s + oy]);
      if (!valid(poly)) continue;
      const id = 'part-' + d.next++;
      const o = {
        id, layer: 'hair', name: '发片 ' + id.slice(5), poly, color, backColor: color, front: [], back: [],
        img: { src, cx: imgCx, cy: imgCy, w: imgW, h: imgH, bw: imgW, bh: imgH, rot: 0, locked: false, window: true, nw, nh },
      };
      d.objects.push(o);
      o.attach = attachKind(d, o);
      markRoot(d, id);
      made++;
    }
    return made;
  }
  function pickHairPng() {
    const input = $('#designHairPick');
    if (!input) return;
    input.value = '';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      readFile(file, (dataUrl) => {
        if (!dataUrl) return;
        shrinkThen(dataUrl, (small) => {
          if (!small) return;
          const im = getImg(small);
          const go = () => {
            const nw = im && (im.naturalWidth || im.width), nh = im && (im.naturalHeight || im.height);
            if (!nw || !nh) { say('这张图打不开，换一张试试。'); return; }
            let px = null;
            try {
              const cv = document.createElement('canvas');
              cv.width = nw; cv.height = nh;
              const cx2 = cv.getContext('2d', { willReadFrequently: true });
              cx2.drawImage(im, 0, 0);
              px = cx2.getImageData(0, 0, nw, nh).data;
            } catch (err) { say('这张图读不出像素（可能是跨域图或者格式不对），换一张试试。'); return; }
            const res = hairPiecesFromImage(px, nw, nh, {});
            if (!res.pieces.length) { say('这张图里没抠出形状。传透明底 PNG（发片以外是透明的），或者白底的图也行。'); return; }
            const before = copy(d);
            const made = placeHairPieces(res, small, nw, nh);
            if (!made) { d = before; rebuild(); say('抠出来的形状放不进画布，换张小一点的图试试。'); return; }
            history.push(before); if (history.length > 40) history.shift(); redo = [];
            layer = 'hair'; selected = d.objects[d.objects.length - 1].id; tool = 'paint'; adding = false; draft = null;
            commit(); focusLayer();
            const how = res.mode === 'alpha' ? '按透明的地方'
              : res.mode === 'white' ? '这张不是透明底，按接近白底的地方' : '这张图没有透明也没有白底，按整张图';
            say(`${how}抠出 ${made} 片发片，图铺回各自那片上、透明处留空窗（透光不填底色）。` +
              `在它上面彩绘还是同一片；想再压一层就再点「＋ 加发片」。`);
          };
          if (im && im.complete && (im.naturalWidth || im.width)) go();
          else { im.onload = go; im.onerror = () => say('这张图打不开，换一张试试。'); }
        });
      });
    };
    if (typeof input.click === 'function') input.click();
  }

  /* ---------- 画布事件 ----------
   * 「拖出来的线断成一个个点」的处理办法：
   *   ① 帧里要刷新 3D，帧一慢浏览器就把一串 pointermove 合并成一个，程序只拿到零星几个点，
   *      笔迹自然就稀稀拉拉甚至只剩一个点。用 getCoalescedEvents() 把合并掉的中间点全取回来。
   *   ② 指针跑出画布、canvas 被别的元素盖住、或者 setPointerCapture 没拿到手，后面的 move 就收不到了。
   *      按下之后 move / up 同时挂在 window 捕获阶段 —— 收得到就丢不掉。
   *   ③ 浏览器偶尔会在拖拽中途发 pointercancel 把指针抢走。取消时保留已经画好的部分，不再整笔抹掉。
   */
  const MIN_STEP = 0.8;                       // world 坐标下的最小采样间距，越小线越顺
  function capturePointer(e) {
    try { if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); } catch (_) { /* 拿不到捕获也没关系，window 已经兜住了 */ }
  }
  canvas.onpointerdown = (e) => {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && (e.shiftKey || tool === 'hand'))) {
      handDrag = { x: e.clientX, y: e.clientY, paperX, paperY, vueX: vue.x, vueY: vue.y };
      rect = canvas.getBoundingClientRect();
      canvas.style.cursor = 'grabbing';
      capturePointer(e); e.preventDefault(); return;
    }
    if (e.button !== 0) return;
    e.preventDefault();                       // 掐掉原生拖拽和选区，别让浏览器把指针抢走
    rect = canvas.getBoundingClientRect();    // ★ 锁住这一笔的换算基准
    let map = null;
    if (paper) {
      const q = sheetPoint(e);
      const hit = [...paperTpl.pieces].reverse().find(p => C.inPoly(p.poly, ...q))
        || paperTpl.pieces.find(p => p.design.objectId === selected && p.design.mirror === (side === 'back'));
      if (!hit) return;
      map = hit.design;
      selected = map.objectId; layer = map.layer || layer; side = map.mirror ? 'back' : 'front';
      adding = false;
    } else if (!adding) {
      // 正准备新增时就别再去抢选已有的部件了，否则这一笔会被判成「改那一片」
      const w = worldPoint(e);
      const top = [...ordered(d).filter(visibleIn)].reverse().find(o => C.inPoly(o.poly, ...w));
      if (top) {
        // 改体型时**不跟着换层**：在发片层上画，起笔正好压在脸上，也不该把人踢到脸层去
        // （以前就是这么被踢走的，涂出来的东西落到了别的层上，看起来像「画丢了」）
        if (tool !== 'outline') layer = top.layer;
        if (top.layer === layer) selected = top.id;
      }
    }
    const p = pointOf(e, map);
    const o = cur();
    if (tool === 'image' && o && o.img && !o.img.locked) {
      if (!C.inPoly(o.poly, ...p) && !imgCovers(o.img, p)) { say('点在这个部件上、或者点在图上，才能挪动它。'); return; }
      snapshot();
      drag = { mode: 'image', id: o.id, grab: p, cx: o.img.cx, cy: o.img.cy };
    } else if (tool === 'outline') {
      // 「改体型」模式：拖方框上的方块 = 拉宽 / 拉高；拖里面 = 挪位置；点在空白勾一圈 = 重画形状
      const target = adding ? null : o;
      const sm0 = !!(draft && draft.mode === 'smear');
      // 涂形状的时候不抢手柄：不然手一按在现有的片上就变成拖动，涂不成了
      if (target && !paper && !sm0) {
        const h = hitHandle(p, target.poly);
        if (h) {
          if (shapeLocked() && BASE_IDS.includes(target.id)) { say(SHAPE_LOCK_MSG); return; }
          if (!beginShape()) return;
          drag = { mode: 'handle', handle: h, from: C.boxOfPoly(pending.poly), src: copy(target.poly), grab: p };
          capturePointer(e); sync(); return;
        }
        // 整张图纸体型的发片 / 衣服：按住片子里面直接拖 = 挪位置（不用去找那个小把手）
        if (pageMode() && (layer === 'hair' || layer === 'clothes') && !BASE_IDS.includes(target.id) && !target.locked && !draft && C.inPoly(target.poly, ...p)) {
          if (!beginShape()) return;
          drag = { mode: 'movePoly', src: copy(target.poly), grab: p };
          capturePointer(e); sync(); return;
        }
        if (hitMoveHandle(p, target.poly)) {      // 拖动把手挂在方框上方，所以框里面照样能「往里画一圈」缩小
          if (shapeLocked() && BASE_IDS.includes(target.id)) { say(SHAPE_LOCK_MSG); return; }
          if (!beginShape()) return;
          drag = { mode: 'movePoly', src: copy(target.poly), grab: p };
          capturePointer(e); sync(); return;
        }
      }
      // 手上没有开着的草稿就自动开一个。判据是「起笔落在哪儿」，不是「选了谁」：
      //   起笔在那片身上 = 给这片重做外形；起笔落在空白处 = 长出新的一片（谁也不想随手涂两下
      //   就把旁边选中的那片改成自己涂的样子）。
      // 以前没开草稿就直接画，走的是「必须围成闭合一圈」的老路子，线没拢上就整笔作废 —— 就是这个毛病。
      if (!draft) {
        const own = !!(target && C.inPoly(target.poly, ...p));
        if (own && shapeLocked() && BASE_IDS.includes(target.id)) { say(SHAPE_LOCK_MSG); return; }
        startDraft(own ? 'reshape' : 'add', own ? target.id : '', 'smear');
      }
      const sm = !!(draft && draft.mode === 'smear');
      if (sm) { draft.strokes.push([]); draft.w = smearWidth(); }   // 开新的一笔
      drag = { mode: sm ? 'smear' : 'outline', points: [p], screen: paper ? [sheetPoint(e)] : null, map };
    } else {
      if (!o || !C.inPoly(o.poly, ...p)) { say('画笔要落在选中的部件里才画得上。要换外框请用「✏️ 改体型」。'); return; }
      snapshot();
      const st = { color, width, brush, points: [p] };
      o[skey(o)].push(st);
      let other = null;
      if (mir()) {
        other = { color, width, brush, points: [[2 * axis() - p[0], p[1]]] };
        const twin = o.piece ? objAt(o.id === 'headL' ? 'headR' : 'headL') : o;   // 后脑是左右一对：镜像落到另一片上
        (twin || o)[skey(twin || o)].push(other);
      }
      drag = { mode: 'stroke', stroke: st, other, axis: axis(), map, objectId: o.id };
    }
    capturePointer(e);
    sync();
  };
  /** 把一个采样点喂给手上正在拖的东西 */
  function addSample(e) {
    if (!drag) return;
    const p = pointOf(e, drag.map);
    if (drag.mode === 'image') {
      const o = objAt(drag.id);
      if (!o || !o.img || o.img.locked) { drag = null; return; }
      o.img.cx = drag.cx + (p[0] - drag.grab[0]);
      o.img.cy = drag.cy + (p[1] - drag.grab[1]);
      requestDraw(); return;
    }
    if (drag.mode === 'handle') {
      const o = objAt(selected); if (!o) { drag = null; return; }
      const b = drag.from, [tag, hx, hy] = drag.handle;
      const dx = p[0] - drag.grab[0], dy = p[1] - drag.grab[1];
      const to = { x: b.x, y: b.y, w: b.w, h: b.h };
      if (hx === 0) { to.x = b.x + dx; to.w = b.w - dx; }     // 拖左边那条框
      else if (hx === 1) { to.w = b.w + dx; }                  // 拖右边那条框
      if (hy === 0) { to.y = b.y + dy; to.h = b.h - dy; }      // 拖上边
      else if (hy === 1) { to.h = b.h + dy; }                  // 拖下边
      // 拖过头会翻面（宽高变负），按最小尺寸兜住
      if (to.w < MIN_SHAPE) { if (hx === 0) to.x = b.x + b.w - MIN_SHAPE; to.w = MIN_SHAPE; }
      if (to.h < MIN_SHAPE) { if (hy === 0) to.y = b.y + b.h - MIN_SHAPE; to.h = MIN_SHAPE; }
      o.poly = rebox(drag.src, b, clampBox(to));               // 每帧都从按下那刻的原形重算，不会累积误差
      requestDraw(); return;
    }
    if (drag.mode === 'movePoly') {
      const o = objAt(selected); if (!o) { drag = null; return; }
      const box = C.boxOfPoly(drag.src);
      let nx = box.x + (p[0] - drag.grab[0]), ny = box.y + (p[1] - drag.grab[1]);
      // 挪到边上就贴住，整个形状跟着框一起走，所以绝不会拖出画布
      nx = Math.max(-PADX, Math.min(nx, W + PADX - box.w)); ny = Math.max(-PADY, Math.min(ny, H + PADY - box.h));
      o.poly = rebox(drag.src, box, { x: nx, y: ny, w: box.w, h: box.h });
      requestDraw(); return;
    }
    const isSmear = drag.mode === 'smear';
    const ps = (drag.mode === 'outline' || isSmear) ? drag.points : drag.stroke.points;
    const last = ps[ps.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < MIN_STEP) return;
    ps.push(p);
    // 涂形状：这一小段当场并进累积画布，涂到哪儿一眼就看得见
    if (isSmear && draft && draft.strokes.length) {
      const seg = [last, p];
      draft.strokes[draft.strokes.length - 1].push(seg);
      smearInto(seg, draft.w);
    }
    if (drag.other) drag.other.points.push([2 * drag.axis - p[0], p[1]]);
    if (drag.screen) drag.screen.push(sheetPoint(e));
    requestDraw();
  }
  function feedMove(e) {
    if (!e || e.__nunuSeen) return;           // 同一个事件别处理两遍（window 捕获 + canvas 自身）
    e.__nunuSeen = 1;
    if (handDrag) {
      const dx = e.clientX - handDrag.x, dy = e.clientY - handDrag.y;
      const b = rect || canvas.getBoundingClientRect();
      const sx = dx * VW / b.width, sy = dy * VH / b.height;
      if (paper) { paperX = handDrag.paperX + sx; paperY = handDrag.paperY + sy; }
      else { vue.x = handDrag.vueX + (flipped() ? -sx : sx); vue.y = handDrag.vueY + sy; }
      draw(); return;
    }
    if (!drag) return;
    let merged = null;
    try { merged = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null; } catch (_) { merged = null; }
    if (merged && merged.length) for (const s of merged) addSample(s);
    addSample(e);
  }
  canvas.onpointermove = feedMove;
  function requestDraw() {
    if (frame) return;
    frame = 1;
    raf(() => {
      frame = 0; draw();
      if (!drag) return;
      // 画彩绘、拖体型，两边都让 3D 跟着动 —— 不然只有画布在变，立起来的那只还是老的
      if (drag.mode !== 'stroke' && drag.mode !== 'handle' && drag.mode !== 'movePoly') return;
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (now - lastLive < 70) return;
      lastLive = now;
      const id = drag.mode === 'stroke' ? drag.objectId : selected;
      try { api.live && api.live(copy(d), id); } catch (_) { }
    });
  }
  function endDrag() {
    rect = null; handDrag = null; setCursor();
    if (!drag) return;
    const dg = drag; drag = null;
    if (dg.mode === 'stroke') { commit(); return; }
    if (dg.mode === 'image') {
      commit(); syncImgUI();
      say('图片位置放好了。可以接着挪，或者点「🔒 固定」把它锁住。');
      return;
    }
    if (dg.mode === 'handle' || dg.mode === 'movePoly') {
      // 拖完了不急着算数 —— 停在预览上，等下面「✓ 就这样 / ✕ 放弃」发话
      requestChange(); sync();
      if (notice) say(notice);
      return;
    }
    // 描线描到画布外面去了：这一笔不要（不是「画歪了不许改」，是笔尖根本不在纸上）
    if (dg.mode === 'outline' && dg.points.some(q => q[0] < -PADX - 2 || q[1] < -PADY - 2 || q[0] > W + PADX + 2 || q[1] > H + PADY + 2)) {
      say('这一笔超出画布了（笔尖跑到画布外面去了），这一笔没算。画布就那么大，往回画一点。');
      sync(); return;
    }
    // 「涂形状」开着的时候，这一笔并进草稿。只有「一笔就围成一整圈」的才当场成片 ——
    // 其余一律留着，不判失败、不作废（谁也没法一笔勾出体型）
    if (dg.mode === 'smear' && draft) {
      const onlyOne = draft.strokes.length <= 1;
      const seg = onlyOne ? S.dp(dg.points, 1.6) : null;
      if (seg && looksClosed(seg)) {
        // 一笔围成一圈就当场成片。成不了（越界、自交）也不丢草稿 —— 留着接着涂
        commitClosed(dg.points, draft.kind, draft.id, draft.layer); return;
      }
      pushSmear(); return;
    }
    if (dg.mode === 'outline' && draft) { pushDraft(dg.points); return; }
    const before = copy(d);
    try {
      let poly = cleanLoop(dg.points) || S.simplifyLoop(dg.points, 1.6);
      const target = adding ? null : (objAt(selected) || null);
      const warn = guardPoly(adding || !target ? null : target.poly, poly);
      if (warn) throw Error(warn);
      if (!valid(poly)) throw Error('这一圈太小或者自己交叉了，形状没改。要慢慢描的话点右边「＋ 加发片」，可以分几段画。');
      poly = maybeSymmetric(poly);
      if (adding || !target) { selected = add(d, layer, poly, color); adding = false; }
      else reshape(d, target.id, poly);
      if (!objAt(selected)) throw Error('这一层里找不到目标，已保留原样。');
      history.push(before); if (history.length > 40) history.shift(); redo = [];
      commit();                                       // ★ 工具保持不动，不再被踢回彩绘
      say(symNote + (tool === 'outline' ? '形状改好了，还在「改形状」模式，可以接着改别的。' : '好了。'));
    } catch (err) {
      d = before; rebuild(); api.change(copy(d));
      say(err.message);
    }
    sync();
  }
  canvas.onpointerup = endDrag;
  /** 系统抢走指针时不再整笔抹掉：已经落下的部分就是画者的成果，保留它 */
  function cancelDrag() {
    rect = null; handDrag = null; setCursor();
    if (!drag) return;
    const dg = drag; drag = null;
    if (dg.mode === 'stroke') { commit(); say('这一笔被系统打断了，已经画好的部分保留了。'); return; }
    if (dg.mode === 'image') { commit(); syncImgUI(); return; }
    if (dg.mode === 'handle' || dg.mode === 'movePoly') { requestChange(); sync(); return; }  // 预览原样留着，等打钩
    rebuild(); api.change(copy(d)); sync();
  }
  canvas.onpointercancel = cancelDrag;
  canvas.onlostpointercapture = () => { };            // 丢掉捕获不等于抬笔：由 window 上的 pointerup 收尾
  try {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && !host.__nunuWin) {
      host.__nunuWin = 1;
      window.addEventListener('pointermove', feedMove, true);
      window.addEventListener('pointerup', endDrag, true);
      window.addEventListener('pointercancel', cancelDrag, true);
    }
  } catch (_) { }
  canvas.onwheel = (e) => {
    e.preventDefault();
    const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const o = cur();
    if (tool === 'image' && o && o.img && !o.img.locked) {
      o.img.w = Math.max(4, o.img.w * k); o.img.h = Math.max(4, o.img.h * k);
      draw(); syncImgUI();
      requestChange();
      return;
    }
    const q = rawPoint(e);
    if (paper) {
      const t = { x: paperX, y: paperY, s: paperScale };
      paperScale = Math.max(0.05, Math.min(60, paperScale * k));
      paperX = q[0] - (q[0] - t.x) * (paperScale / t.s);
      paperY = q[1] - (q[1] - t.y) * (paperScale / t.s);
    } else {
      const t = vue.scale;
      vue.scale = Math.max(0.3, Math.min(8, vue.scale * k));
      vue.x = q[0] - (q[0] - vue.x) * (vue.scale / t);
      vue.y = q[1] - (q[1] - vue.y) * (vue.scale / t);
    }
    draw();
  };
  canvas.oncontextmenu = (e) => e.preventDefault();


  /* ---------- 控件 ---------- */
  if ($('#designColor')) $('#designColor').oninput = (e) => { color = e.target.value; };
  host.querySelectorAll('[data-color]').forEach(b => b.onclick = () => {
    color = b.dataset.color; const ic = $('#designColor'); if (ic) ic.value = color;
    const o = cur(); if (o) say(`颜色已换，接下来画的都用这个颜色。`); else say('颜色已换。');
  });
  if (widthBox) widthBox.oninput = (e) => { width = +e.target.value; const o = $('#designWidthOut'); if (o) o.textContent = width; };
  if (sizeBox) sizeBox.oninput = () => {
    const im = cur() && cur().img; if (!im || im.locked || !im.bw) return;
    const v = Math.max(10, +sizeBox.value || 100) / 100;
    im.w = Math.max(4, im.bw * v); im.h = Math.max(4, im.bh * v);
    draw(); requestChange();
  };
  if (rotBox) rotBox.oninput = () => {
    const im = cur() && cur().img; if (!im || im.locked) return;
    im.rot = (+rotBox.value || 0) * Math.PI / 180;
    draw(); requestChange();
  };
  if (winBox) winBox.onchange = () => {
    const im = cur() && cur().img; if (!im) return;
    im.window = winBox.checked; commit();
    say(winBox.checked ? '图片盖不到的地方留成空窗，不填底色了。' : '盖不到的地方会填上这片自己的底色。');
  };
  if (axisBox && !axisBox.value) axisBox.value = 200;
  host.querySelectorAll('[data-fabric]').forEach(b => b.onclick = () => {
    const k = b.dataset.fabric; defaultFabric = k;                         // 之后新长的发片都用它
    const o = cur();
    if (o && o.layer === 'hair' && o.fabric !== k) { snapshot(); o.fabric = k; commit(); say(`「${o.name}」换成了${FABRICS[k].name}。`); }
    else say(`之后新加的发片用${FABRICS[k].name}。`);
    sync();
  });
  host.querySelectorAll('[data-hpreset]').forEach(b => b.onclick = () => {
    if (pending) acceptShape();
    const key = b.dataset.hpreset, before = copy(d);
    d.objects = d.objects.filter(o => !(o.layer === 'hair' && o.preset));       // 换模板 = 先清掉上一次模板长出来的，自己画的不动
    try { if (key !== 'clear') hairPreset(d, key, color); }
    catch (err) { d = before; say(err.message); sync(); return; }
    history.push(before); if (history.length > 40) history.shift(); redo = [];
    layer = 'hair'; selected = (d.objects.find(o => o.layer === 'hair') || {}).id || '';
    commit(); focusLayer();
    say(key === 'clear' ? '模板发片清掉了。' : `「${HAIR_PRESETS[key]}」长出来了，每一片都能单独挪（✥ 挪发片）、改色、删。`);
  });
  host.querySelectorAll('[data-dlayer]').forEach(b => b.onclick = () => setLayer(b.dataset.dlayer));
  host.querySelectorAll('[data-dtool]').forEach(b => b.onclick = () => {
    if (b.dataset.dtool === 'outline' && shapeLocked()) { say(SHAPE_LOCK_MSG); return; }
    if (pending && b.dataset.dtool !== 'outline') acceptShape();   // 离开「改体型」= 采纳改完的样子，改动不会白做
    tool = b.dataset.dtool; adding = false;
    if (draft && tool !== 'outline') { draft = null; say('切走「改体型」了，描到一半的草稿先收起来。'); }
    sync();
    if (tool === 'outline') {
      const nm = cur() ? cur().name : '这一片';
      say(`「${nm}」四周多了八个小方块：拖角改大小，拖上下/左右只拉一边，拖里面挪位置。改完记得打钩。`);
      revealCanvas();      // 工具行把画布下半截压住了，开画之前先滚到眼前
    }
    if (tool === 'image') {
      const im = cur() && cur().img;
      say(im ? (im.locked ? '这张图已经固定了；点「🔓 解锁重摆」才能再挪。' : '拖着图片挪位置，滚轮放大缩小，摆好后点「🔒 固定位置」。')
             : '这片还没贴图，点「🖼 导入图片贴到这片」选一张图。');
    }
    if (tool === 'hand') say('抓手模式：按住画布随便拖，挪完点回「🎨 彩绘」。');
  });
  host.querySelectorAll('[data-dbrush]').forEach(b => b.onclick = () => {
    brush = b.dataset.dbrush; sync();
    say(brush === 'square' ? '方笔：硬边，画出来是一块一块的像素感。' : '圆笔：顺滑，手抖也会被抹平。');
  });
  host.querySelectorAll('[data-dattach]').forEach(b => b.onclick = () => {
    const o = cur();
    if (!o || o.layer !== 'hair') { say('先选一片发片。'); return; }
    const k = b.dataset.dattach;
    if (attachKind(d, o) === k) return;
    snapshot();
    o.attach = k;
    if (k === 'sewn') snapRoot(d, o.id);      // 改成缝就让根部回到发际线上
    else markRoot(d, o.id);
    commit();
    say(k === 'sewn' ? '改成缝了，根部已贴回发际线，沿发际线加固缝一圈。' : '改成贴了 —— 在发际线涂胶，从发际线往下压着贴。');
  });
  host.querySelectorAll('[data-dside]').forEach(b => b.onclick = () => {
    side = b.dataset.dside; defaultOnBack = side === 'back'; sync(); if (pageMode()) focusLayer(); if (api.view) api.view(side === 'back' ? 'back' : 'front');
  });
  host.querySelectorAll('[data-dview]').forEach(b => b.onclick = () => api.view && api.view(b.dataset.dview));
  host.querySelectorAll('[data-daction]').forEach(b => b.onclick = () => {
    const a = b.dataset.daction, o = cur();
    if (a === 'shapeOk') { acceptShape(); return; }
    if (a === 'shapeCancel') { cancelShape(); return; }
    if (a === 'draftOk') { closeDraft(); return; }
    if (a === 'draftUndo') { popDraft(); return; }
    if (a === 'draftClear') { clearDraft(); return; }
    if (a === 'hairPng') { pickHairPng(); return; }
    if (a === 'undo' || a === 'redo') { travel(a); return; }
    if (a === 'guides') { showGuides = !showGuides; say(showGuides ? '定位线打开了：蓝色虚线是脸窗，眼睛、嘴、眼线都按图纸摆好，照着画就不会画偏。' : '定位线收起来了。'); sync(); draw(); return; }
    if (a === 'bigCanvas') { toggleBig(); return; }
    if (a === 'layout') { paper = !paper; if (paper) paperFit(); else focusLayer(); sync(); return; }
    if (a === 'overview') { paper = false; overview(); say('已把整只娃完整显示出来。'); return; }
    if (a === 'newHair' || a === 'newClothes') {
      layer = a === 'newHair' ? 'hair' : 'clothes';
      startDraft('add');
      say(`慢慢描：画一段松一次手，段和段自动接上，画够了一点「✓ 合上成一片」就往「${LAYER_META.find(l => l.key === layer)?.name}」里加一片。` +
        `画在已有发片上面，就是往上再压一层（两片）；画完之后在同一片上涂色，还是这一片。`);
      return;
    }
    if (a === 'addPart') {
      if (layer === 'face' || layer === 'body') { say('身体和脸是独一份的，不能在上面再叠一层。要叠请切到衣服层或发片层。'); return; }
      startDraft('add');
      say(`慢慢描：分几段画都行，画够了一点「✓ 合上成一片」，就往「${LAYER_META.find(l => l.key === layer)?.name}」里加一片。`);
      return;
    }
    if (a === 'ears') {
      if (d.objects.some(x => x.kind === 'ear')) { say('已经有一对耳朵了，不能再加。'); return; }
      const before = copy(d);
      const ids = addEars(d);
      if (!ids.length) { say('加不上耳朵，试着先选中面部层。'); d = before; return; }
      layer = 'body'; selected = ids[0]; history.push(before); redo = []; commit(); focusLayer();
      say('一对耳朵加上了，在「身体层」里。选中它可以放大缩小，或者用「改形状」重新描一圈。');
      return;
    }
    if (a === 'paper') { adding = false; api.flush(); show(false); return; }
    if (a === 'importPattern') { if (api.importPattern) api.importPattern(); else say('这个页面还不能上传图纸。'); return; }
    if (a === 'patternHelp') { if (api.patternHelp) api.patternHelp(); return; }
    if (a === 'rolesWizard') { if (api.rolesWizard) api.rolesWizard(); return; }
    if (a === 'project' || a === 'newProject') {   // 按钮的 data-daction 是 newProject；以前这里只认 project，点了没反应
      try { const v = api.newProject && api.newProject(copy(d)); if (v) { replaceProject(v); say('新作品开好了，上一个在「打开存档」里。'); } }
      catch (err) { say(err.message); }
      return;
    }
    if (a === 'clear') {
      drag = null; pending = null; draft = null; snapshot();
      d = initial(baseTpl()); layer = 'body'; selected = 'body'; side = 'front'; adding = false; tool = 'paint';
      rebuild(); api.change(copy(d)); api.flush(); sync(); focusLayer();
      say('已清空回到空白素体；刚才的东西可以用撤销找回来。');
      return;
    }
    if (!o) { say('先在右边列表里选一片。'); return; }
    if (a === 'imgPick') { pickImage(o); return; }
    if (a === 'imgLock') { if (!o.img) { say('这片还没有贴图，先点「🖼 导入图片贴到这片」。'); return; } }
    if (a === 'imgClear') { if (!o.img) { say('这片本来就没有贴图。'); return; } }
    if (a === 'lock') {                       // 固定不进撤销栈：它是个开关，不是一笔改动
      o.locked = !o.locked;
      say(o.locked ? `「${o.name}」固定住了：改体型、放大缩小、删除都对它无效，照常画画。` : `「${o.name}」解开了，可以随便改。`);
      sync(); return;
    }
    if (o.locked && ['up', 'down', 'grow', 'shrink', 'remove'].includes(a)) {
      say(`「${o.name}」被固定住了，先点「🔓 解开固定」。`); sync(); return;
    }
    if (shapeLocked() && BASE_IDS.includes(o.id) && ['grow', 'shrink', 'up', 'down', 'remove'].includes(a)) { say(SHAPE_LOCK_MSG); return; }
    const before = copy(d);
    if (a === 'imgLock') o.img.locked = !o.img.locked;
    if (a === 'imgClear') o.img = null;
    if (a === 'snapRoot') {
      if (o.layer !== 'hair') { say('只有发片才谈得上发际线。'); return; }
      if (!snapRoot(d, o.id)) { say('这片根部已经在发际线上了。'); sync(); return; }
    }
    if (a === 'fill') { o[skey(o) === 'front' ? 'color' : 'backColor'] = color; }         // ★ 只涂当前这一面
    if (a === 'grow' || a === 'shrink') { if (!resize(d, o.id, a === 'grow' ? 1.1 : 0.9)) { say('已经到画布边缘或最小尺寸了。'); sync(); return; } }
    if (a === 'up' || a === 'down') move(d, o.id, a === 'up' ? 1 : -1);
    if (a === 'remove') {
      if (BASE_IDS.includes(o.id)) { say('主体和脸不能删。'); return; }
      d.objects = d.objects.filter(x => x.id !== o.id); selected = d.objects.find(x => x.layer === layer)?.id || '';
    }
    if (JSON.stringify(before) !== JSON.stringify(d)) {
      history.push(before); if (history.length > 40) history.shift(); redo = [];
      commit(); focusLayer();
      if (a === 'fill') say(`「${o.name}」的${side === 'front' ? '正' : '背'}面整片涂好了，背面没动。`);
      else if (a === 'imgLock') say(o.img && o.img.locked ? '贴图锁住了，之后拖动画布不会再挪它。' : '解锁了，可以继续摆位置。');
      else if (a === 'imgClear') say('贴图去掉了，这片回到一整块底色。');
    } else sync();
  });
  if (projects) projects.onchange = () => {
    if (!projects.value) return;
    try { const v = api.openProject && api.openProject(projects.value, copy(d)); if (v) replaceProject(v); }
    catch (err) { say(err.message); }
  };

  /* ---------- 进出 ---------- */
  const back = document.createElement('button');
  back.textContent = '← 回到四层设计台'; back.className = 'design-return';
  back.onclick = () => show(true);
  // 放在纸样页（.workspace 所在容器）的最上面；结构不明时就退回放在设计台后面
  try {
    if (oldMain && oldMain.parentElement) oldMain.parentElement.insertBefore(back, oldMain);
    else host.after(back);
  } catch (_) { host.after(back); }
  function show(on) {
    host.hidden = !on; back.hidden = on;
    oldMain.hidden = oldDock.hidden = on; oldToolbar.hidden = true;
    try { host.dispatchEvent(new CustomEvent('nunu:viewchange', { detail: { paper: !on }, bubbles: true })); } catch (_) { }
    if (!on) { api.preview3d && api.preview3d(null); api.paper(); return; }
    api.activate && api.activate();
    const ok = api.preview3d && api.preview3d(host.querySelector('#design3d'));
    preview.hidden = !!ok;
    host.querySelector('#design3d').hidden = !ok;
    if (!ok) say('这个浏览器没开 WebGL，右边先用平面的样子顶着，其它功能照常。');
    sync(); focusLayer();
  }

  /* ---------- 大画布：两边的面板全收起来，画布吃满整屏 ---------- */
  let bigMode = false;
  function toggleBig(on) {
    bigMode = typeof on === 'boolean' ? on : !bigMode;
    const rootEl = host.querySelector('.ds'); if (!rootEl) return;
    rootEl.classList.toggle('dsBig', bigMode);
    if (typeof document !== 'undefined' && document.body) document.body.classList.toggle('ds-big', bigMode);
    // 顺手请求浏览器真全屏（藏掉地址栏和标签栏）；不给就算了，页面里的全屏照样有
    try {
      if (typeof document !== 'undefined' && document.documentElement) {
        if (bigMode && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
        else if (!bigMode && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      }
    } catch (_) { }
    const b = host.querySelector('#bigBtn');
    if (b) b.textContent = bigMode ? '⛶ 退出大画布' : '⛶ 大画布';
    // 面板一收，画布尺寸变了，等浏览器排好版再让视图重新贴满
    raf(() => { paper = false; overview(); revealCanvas(); });
    say(bigMode ? '大画布：两边收起来了，画布吃满整屏。再点「⛶ 退出大画布」或者按 Esc 就回去。' : '回到平常的样子。');
    sync();
  }

  // 画布吃满舞台：先量一次，之后舞台大小变了（缩放窗口、收起面板、大画布）就跟着重量、重新框好
  resizeView();
  if (typeof ResizeObserver !== 'undefined' && canvas) {
    try { new ResizeObserver(() => { if (resizeView()) { if (paper) paperFit(); else focusLayer(); draw(); } }).observe(canvas); } catch (_) { }
  }
  rebuild(); projectOptions(); sync(); api.change(copy(d)); show(true);
  // 图是异步解码的：解好之后要回头把画布和纸样再画一遍，否则第一帧是空的
  try { imageHook = () => { try { draw(); requestChange(); } catch (_) { } }; } catch (_) { }
  // 回车 = 打钩，Esc = 放弃：鼠标还在画布上就不用跑去点按钮
  if (typeof document !== 'undefined' && document.addEventListener) {
    // 用户按 Esc 退出了浏览器全屏：页面里的大画布也跟着退，不然会卡在一个没有出口的状态
    document.addEventListener('fullscreenchange', () => { if (bigMode && !document.fullscreenElement) toggleBig(false); });
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && bigMode && !pending && !draft) { e.preventDefault(); toggleBig(false); return; }
      if (!pending) return;
      if (e.key === 'Enter') { e.preventDefault(); acceptShape(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelShape(); }
    });
  }
  return {
    show, undo: () => travel('undo'), redo: () => travel('redo'),
    refresh(value) { d = copy(value || initial(baseTpl())); if (shapeLocked()) withBackHead(d, baseTpl()); pending = null; rebuild(); sync(); focusLayer(); },
  };
}

root.NunuDesign = { setDefaultSide:b=>{defaultOnBack=!!b;}, FABRICS, setDefaultFabric:k=>{if(FABRICS[k])defaultFabric=k;}, hairPreset, patternDesigns, initial, ordered, valid, add, move, resize, reshape, template, paint, paperView, symmetricOutline, dartOutline, addEars, mount, getImg, imgReady, imgCovers, hairline, hairlineAt, centroid, rootOf, snapRoot, markRoot, shiftPart, attachKind, maskFromRGBA, hairPiecesFromImage, onImageReady: fn => { imageHook = fn; } };
})(typeof window === 'undefined' ? globalThis : window);
