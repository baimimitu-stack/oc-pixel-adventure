/* Shared 3D dimensions and approximate four-gore development. */
(function(root){
function profile(r,h,n=256){const rows=[{theta:0,s:0,w:0}];let s=0;for(let i=1;i<=n;i++){const a=(i-1)*Math.PI/n,b=i*Math.PI/n,m=(a+b)/2;s+=Math.hypot(r*Math.cos(m),h*Math.sin(m))*(b-a);rows.push({theta:b,s,w:Math.PI*r*Math.sin(b)/2})}return{r,h,length:s,width:Math.PI*r/2,rows}}
function at(t,p){const target=Math.max(0,Math.min(1,t))*p.length;let i=1;while(i<p.rows.length-1&&p.rows[i].s<target)i++;const a=p.rows[i-1],b=p.rows[i],f=(target-a.s)/(b.s-a.s);return a.theta+(b.theta-a.theta)*f}
function parts(s){const h=s.head/100,b=s.body/100,a=s.arm/100,l=s.leg/100;const head={r:1.04*h,h:.88*h,y:2.39},body={r:.57*b,h:.68,y:1.22},arm={r:.225,h:.40*a,y:1.30,x:.70*b},leg={r:.275*b,h:.38*l,y:.38*l,x:.30*b};return{head,body,arm,leg,scale:s.height*10/(head.y+head.h)}}
function outline(p){return [...p.rows.map(v=>[v.w/2,v.s]),...p.rows.slice(1,-1).reverse().map(v=>[-v.w/2,v.s])]}
root.NunuGeometry={profile,at,parts,outline};
})(typeof window==='undefined'?globalThis:window);
