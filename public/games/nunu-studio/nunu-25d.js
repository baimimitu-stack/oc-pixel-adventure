/* 饼干体白坯草稿：前后合片，未经过实物试缝。
 * 2.5D：从平面纸样装配薄袋子，不从球形粗模反推身体裁片。 */
(function(root) {
'use strict';
const C=root.NunuCore, unit=C.unitPerPx({faceWidthPx:320});
const length=ps=>ps.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-ps[i][0],p[1]-ps[i][1]),0);
const pieces=[], seams=[], ticks=[];
function seam(piece,label,pts,color) { piece.seamEdges.push({label,pts,color}); }
function pair(label,name,a,b,color,dart=false) { seams.push({label,name,a:length(a),b:length(b),color,dart,tol:0.01}); }
// 两张相同的头部纸样，额头顶部各一个明确的 V 省道。
// 网格将省道两腿合拢；薄袋预览只用于装配，不是布料仿真。
for(const side of [1,-1]) {
  const ox=side===1?210:610, oy=210, tip=[0,-65], n=80, rings=16, gap=0.22;
  const outline=Array.from({length:n+1},(_,i)=>{
    const a=-Math.PI/2+gap/2+(Math.PI*2-gap)*i/n;
    return [160*Math.cos(a),140*Math.sin(a)];
  });
  const poly=[[ox+tip[0],oy+tip[1]],...outline.map(p=>[ox+p[0],oy+p[1]])];
  const pos=[0,2.05-tip[1]*unit,side*0.29], uv=[ox+tip[0],oy+tip[1]], idx=[];
  const vertex=(r,i)=>1+(r-1)*(n+1)+i;
  for(let r=1;r<=rings;r++) for(let i=0;i<=n;i++) {
    const t=r/rings, a=-Math.PI/2+Math.PI*2*i/n;
    const x=160*Math.cos(a), y=140*Math.sin(a);
    pos.push((tip[0]*(1-t)+x*t)*unit,2.05-(tip[1]*(1-t)+y*t)*unit,side*0.29*Math.sqrt(1-t*t));
    uv.push(ox+tip[0]*(1-t)+outline[i][0]*t,oy+tip[1]*(1-t)+outline[i][1]*t);
    if(i<n) {
      if(r===1) idx.push(0,vertex(r,i+1),vertex(r,i));
      else { const a0=vertex(r-1,i),b=vertex(r,i); idx.push(a0,a0+1,b,b,a0+1,b+1); }
    }
  }
  if(side<0) for(let i=0;i<idx.length;i+=3) [idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
  const p={id:side>0?'cookie-face':'cookie-back',name:side>0?'头部·脸片':'头部·后片',role:side>0?'meshFace':'meshHair',material:'skin',smooth:false,poly,mesh:{pos,uv,idx},seamEdges:[]};
  const label=side>0?'D1':'D2', left=[poly[1],poly[0]],right=[poly.at(-1),poly[0]];
  seam(p,label,left,'#a45bd8'); seam(p,label,right,'#a45bd8'); pair(label,p.name+'·顶部省道',left,right,'#a45bd8',true);
  // 下巴中央留反口；省道先缝合，再将两张头片正面相对缝周边。
  const a=outline.slice(0,38).map(q=>[ox+q[0],oy+q[1]]), b=outline.slice(43).map(q=>[ox+q[0],oy+q[1]]), opening=outline.slice(37,44).map(q=>[ox+q[0],oy+q[1]]);
  seam(p,'H1',a,'#e04a4a'); seam(p,'H2',b,'#e04a4a'); seam(p,'返H',opening,'#bf7c31');
  pieces.push(p);
}
for(const label of ['H1','H2','返H']) {
  const edges=pieces.map(p=>p.seamEdges.find(e=>e.label===label));
  pair(label,label==='返H'?'头部反口（塞棉后藏针封口）':'头部周边',edges[0].pts,edges[1].pts,edges[0].color);
}
// 身体连着小手和双腿，左右对称；前后完全复用同一个轮廓。
const knots=[[-45,0],[45,0],[65,15],[88,36],[82,51],[61,48],[53,92],[39,112],[23,108],[12,83],[-12,83],[-23,108],[-39,112],[-53,92],[-61,48],[-82,51],[-88,36],[-65,15]];
const body=[];
for(let i=0;i<knots.length;i++) for(let j=0;j<8;j++) {
  const t=j/8, p0=knots[(i+knots.length-1)%knots.length],p1=knots[i],p2=knots[(i+1)%knots.length],p3=knots[(i+2)%knots.length];
  body.push([0,1].map(k=>0.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t)));
}
for(const side of [1,-1]) {
  const ox=side>0?210:610,oy=420, poly=body.map(p=>[ox+p[0],oy+p[1]]);
  const p={id:side>0?'cookie-body-front':'cookie-body-back',name:side>0?'身体·前':'身体·后',role:side>0?'bodyFront':'bodyBack',smooth:false,poly,thick:60,anchorPx:[ox,oy],place:{x:0,y:0.80,z:0,anchor:'top'},seamEdges:[]};
  seam(p,'B1',poly.slice(8).concat([poly[0]]),'#35a85a'); seam(p,'返B',poly.slice(0,9),'#bf7c31'); pieces.push(p);
}
for(const label of ['B1','返B']) {
  const edges=pieces.slice(2).map(p=>p.seamEdges.find(e=>e.label===label));
  pair(label,label==='返B'?'身体颈部反口（塞棉后封口）':'身体周边',edges[0].pts,edges[1].pts,edges[0].color);
}
pieces.forEach(p=>{ p.quantity=1; p.name+=' · 裁1片'; });
root.NunuPattern.cookie={id:'nunu-25d',name:'2.5D 饼干体 · 白坯草稿',flat:true,meshBody:true,construction:'2.5d',w:830,h:590,axis:410,faceWidthPx:320,
  note:'身体前后同形，无省道；头部两片各缝一个顶部省道。发片背对背粘合，不塞棉。',pieces,seams,pairs:{},guides:{ticks,notches:[]},
  attachments:[{instruction:'先缝头部 D1、D2 省道，再对齐 H1、H2 缝周边，留返H；翻面塞棉后藏针封口。'},
    {instruction:'身体前后各裁一片，默认留 5 mm 缝份；正面相对缝 B1，留返B。腋下、裆部的缝份剪口不要剪断缝线。翻面塞棉后封口。'},
    {instruction:'头部底部对准身体颈部中心，用藏针固定或布料胶粘合。身体可比头部稍饱满；预览厚度仅作装配示意。'}]};
})(typeof window==='undefined'?globalThis:window);
