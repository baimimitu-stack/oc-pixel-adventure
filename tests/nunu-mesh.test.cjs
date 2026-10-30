const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ctx = { console };
vm.createContext(ctx);
for (const f of ['nunu-shape.js', 'pattern-data.js', 'nunu-core.js', 'nunu-mesh.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/games/nunu-studio/' + f), 'utf8'), ctx);
const C = ctx.NunuCore, M = ctx.NunuMesh;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (±${tol})`);
const bean3 = (() => { let m; return () => (m ||= M.makeBean({ level: 3 })); })();

/** 一个圆柱侧面（开口管子）：半径 r、高 h，沿着一条竖线剪开，才是一个圆盘 */
function cylinderWall(r, h, nu, nv) {
  const pos = [], tri = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const a = (i / nu) * Math.PI; pos.push([r * Math.cos(a), (j / nv) * h, r * Math.sin(a)]); }
  const id = (i, j) => j * (nu + 1) + i;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { tri.push([id(i, j), id(i + 1, j), id(i + 1, j + 1)], [id(i, j), id(i + 1, j + 1), id(i, j + 1)]); }
  return { pos, tri };
}

test('读 OBJ：四边形拆成两个三角形，重复的点合并，面朝外；读不出来的行跳过', () => {
  const cube = `# cube\nv -1 -1 -1\nv 1 -1 -1\nv 1 1 -1\nv -1 1 -1\nv -1 -1 1\nv 1 -1 1\nv 1 1 1\nv -1 1 1\nf 1 4 3 2\nf 5 6 7 8\nf 1 2 6 5\nf 2 3 7 6\nf 3 4 8 7\nf 4 1 5 8\nvt 0 0\nbogus line\n`;
  const m = M.parseOBJ(cube);
  assert.equal(m.pos.length, 8);
  assert.equal(m.tri.length, 12);
  assert.ok(M.isClosed(M.topology(m)), '立方体是封闭的');
  // 面朝外：每个面的法线和（面中心 − 体中心）同方向
  const cents = M.faceCentroids(m);
  m.tri.forEach(([a, b, c], i) => {
    const p = m.pos[a], q = m.pos[b], r = m.pos[c], u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], w = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    assert.ok(n[0] * cents[i][0] + n[1] * cents[i][1] + n[2] * cents[i][2] > 0, `面 ${i} 朝外`);
  });
  // 反过来写的（面朝里）也会被翻正
  const inward = M.parseOBJ(cube.replace(/^f (\d+) (\d+) (\d+) (\d+)$/gm, 'f $1 $4 $3 $2'));
  const c2 = M.faceCentroids(inward);
  inward.tri.forEach(([a, b, c], i) => { const p = inward.pos[a], q = inward.pos[b], r = inward.pos[c]; const n = [(q[1] - p[1]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[1] - p[1]), (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]), (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])]; assert.ok(n[0] * c2[i][0] + n[1] * c2[i][1] + n[2] * c2[i][2] > 0); });
});

test('读 OBJ：支持制表符、行尾注释、负索引和纹理/法线索引', () => {
  const m = M.parseOBJ('v\t0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf\t-4/1/1 -3/2/1 -2/3/1 -1/4/1 # quad');
  assert.equal(m.pos.length, 4);
  assert.equal(m.tri.length, 2);
  assert.ok(M.regionInfo(m, M.topology(m), [1, 1], 1).ok);
});

test('读 OBJ：坏索引整面跳过，坏顶点不改变后续编号，孤立点不影响尺寸', () => {
  const vertices = 'v 0 0 0\nv invalid 0 0\nv 1 0 0\nv 0 1 0\nv 999 999 999\n';
  const m = M.parseOBJ(vertices + 'f 1 3 4\nf 1 2 3\nf 1 3 4 99\nf 0 3 4\nf 1oops 3 4\nf 1.5 3 4\nf -99 3 4\nf 1 3\n');
  assert.equal(m.tri.length, 1);
  assert.equal(m.pos.length, 3);
  assert.deepEqual(Array.from(M.boundsOf(m).size), [1, 1, 0]);
  assert.ok(m.tri.every((t) => t.every((i) => Number.isInteger(i) && m.pos[i])));
  assert.equal(M.parseOBJ(vertices + 'f 1 2 3').tri.length, 0);
  assert.equal(M.parseOBJ('').pos.length, 0);
});

test('球豆素体：封闭的流形、面朝外，有头、身体、两腿、两臂、两耳；耳朵样子可换', () => {
  const m = bean3(), topo = M.topology(m);
  assert.equal(m.pos.length, 642); assert.equal(m.tri.length, 1280);
  assert.ok(M.isClosed(topo));
  const euler = m.pos.length - topo.edges.size + m.tri.length;
  assert.equal(euler, 2, '球面的欧拉数是 2');
  assert.equal(m.parts.map((p) => p.name).sort().join(), 'armL,armR,body,earL,earR,head,legL,legR');
  const bb = M.boundsOf(m);
  assert.ok(bb.size[1] > 3 && bb.size[1] < 5 && bb.size[0] > 2.4, `身高 ${bb.size[1]} 宽 ${bb.size[0]}`);
  assert.equal(M.makeBean({ level: 2, ear: 'none' }).parts.some((p) => /^ear/.test(p.name)), false);
  assert.ok(M.makeBean({ level: 2, ear: 'bunny' }).parts.some((p) => p.name === 'earL'));
  const tall = M.boundsOf(M.makeBean({ level: 2, legLen: 0.95 })).size[1], short = M.boundsOf(M.makeBean({ level: 2, legLen: 0.25 })).size[1];
  assert.ok(tall > short + 0.3, '腿越长身高越高');
});

test('区域检查：封闭的、不连通的、有洞的、边界捏在一起的，都说得出为什么展不开；一整块圆盘才通过', () => {
  const m = bean3(), topo = M.topology(m), n = m.tri.length;
  assert.match(M.regionInfo(m, topo, new Array(n).fill(1), 1).reason, /封闭/);
  assert.match(M.regionInfo(m, topo, new Array(n).fill(0), 1).reason, /没有画/);
  // 半个球：圆盘
  const cents = M.faceCentroids(m), half = cents.map((c) => (c[2] > 0.1 ? 1 : 0));
  const ok = M.regionInfo(m, topo, half, 1);
  assert.ok(ok.ok, ok.reason); assert.equal(ok.euler, 1);
  // 两个不相连的块
  const two = cents.map((c) => (c[1] > 1.6 && c[0] > 0.5 ? 1 : c[1] < -1.2 && c[0] < -0.2 ? 1 : 0));
  assert.match(M.regionInfo(m, topo, two, 1).reason, /不相连/);
  // 一圈带子（中间挖空）：有两圈边界
  const band = cents.map((c) => (Math.abs(c[1] - 0.4) < 0.3 ? 1 : 0));
  assert.match(M.regionInfo(m, topo, band, 1).reason, /2 圈边界|管子/);
});

test('展开：平面不变形；圆柱侧面摊成 πr × h 的长方形，边长误差很小', () => {
  // 平面网格
  const pos = [], tri = [];
  for (let j = 0; j <= 6; j++) for (let i = 0; i <= 8; i++) pos.push([i * 0.5, 0, j * 0.5]);
  const id = (i, j) => j * 9 + i;
  for (let j = 0; j < 6; j++) for (let i = 0; i < 8; i++) tri.push([id(i, j), id(i, j + 1), id(i + 1, j + 1)], [id(i, j), id(i + 1, j + 1), id(i + 1, j)]);
  const plane = M.orientOutward({ pos, tri }), pr = M.regionInfo(plane, M.topology(plane), new Array(plane.tri.length).fill(1), 1);
  assert.ok(pr.ok, pr.reason);
  const sub = M.extractRegion(plane, new Array(plane.tri.length).fill(1), 1), f = M.flatten(sub, pr.loop.map((v) => sub.vmap.get(v)));
  assert.ok(f.stats.meanErr < 0.01 && f.stats.maxErr < 0.03, JSON.stringify(f.stats));
  let diag = 0;
  for (const a of f.uv) for (const b of f.uv) diag = Math.max(diag, Math.hypot(a[0] - b[0], a[1] - b[1]));
  near(diag, 5, 0.1, '4 x 3 的长方形，对角线 5');
  // 圆柱侧面（半个圆周）
  const cyl = M.orientOutward(cylinderWall(1, 2, 24, 10)), cinfo = M.regionInfo(cyl, M.topology(cyl), new Array(cyl.tri.length).fill(1), 1);
  assert.ok(cinfo.ok, cinfo.reason);
  const cs = M.extractRegion(cyl, new Array(cyl.tri.length).fill(1), 1), cf = M.flatten(cs, cinfo.loop.map((v) => cs.vmap.get(v)));
  assert.ok(cf.stats.meanErr < 0.03 && cf.stats.maxErr < 0.1, JSON.stringify(cf.stats));
  const cx = cf.uv.map((p) => p[0]), cy = cf.uv.map((p) => p[1]), cw = Math.max(...cx) - Math.min(...cx), ch = Math.max(...cy) - Math.min(...cy);
  near(cw, Math.PI, 0.15, '宽 = 半个圆周 π'); near(ch, 2, 0.12, '高 2');
  assert.equal(cf.stats.flips, 0);
});

test('展开：球冠摊平会失真（需要省道），但没有翻转的三角形，平均失真在可控范围', () => {
  const m = bean3(), topo = M.topology(m), cents = M.faceCentroids(m), regions = cents.map((c) => (c[2] > 0.1 && c[1] > 1.2 ? 1 : 0));
  const info = M.regionInfo(m, topo, regions, 1);
  assert.ok(info.ok, info.reason);
  const sub = M.extractRegion(m, regions, 1), f = M.flatten(sub, info.loop.map((v) => sub.vmap.get(v)));
  assert.equal(f.stats.flips, 0);
  assert.ok(f.stats.meanErr < 0.12, `平均失真 ${f.stats.meanErr}`);
});

test('展开时上下左右都对：从外面看不镜像（粗模上靠左的点，图样上也靠左），3D 的上在图样的上', () => {
  const m = bean3(), topo = M.topology(m), cents = M.faceCentroids(m);
  const regions = cents.map((c) => (c[2] > 0.15 && c[1] > -0.5 && c[1] < 2.1 ? 1 : 0));
  const info = M.regionInfo(m, topo, regions, 1);
  assert.ok(info.ok, info.reason);
  const sub = M.extractRegion(m, regions, 1), f = M.flatten(sub, info.loop.map((v) => sub.vmap.get(v)));
  const corr = (a, b) => { const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length; let sxy = 0, sxx = 0, syy = 0; a.forEach((v, i) => { sxy += (v - ma) * (b[i] - mb); sxx += (v - ma) ** 2; syy += (b[i] - mb) ** 2; }); return sxy / Math.sqrt(sxx * syy); };
  assert.ok(corr(sub.pos.map((p) => p[0]), f.uv.map((p) => p[0])) > 0.9, '左右不镜像');
  assert.ok(corr(sub.pos.map((p) => p[1]), f.uv.map((p) => -p[1])) > 0.9, '上在图样的上边（图纸坐标 y 向下）');
});

test('球豆素体自动分片：每个部分前后各一片，每一片都是展得开的圆盘', () => {
  const m = M.makeBean({ level: 4 }), topo = M.topology(m), pre = M.presetBean(m, m.parts);
  const ids = Object.keys(pre.names).map(Number);
  assert.ok(ids.length >= 14, `片数 ${ids.length}`);
  assert.equal(pre.regions.filter((r) => !r).length, 0, '每个面都分了片');
  for (const id of ids) { const inf = M.regionInfo(m, topo, pre.regions, id); assert.ok(inf.ok, `${pre.names[id]}：${inf.reason}`); }
  assert.ok(Object.values(pre.names).some((n) => n === '头·前') && Object.values(pre.names).some((n) => n === '头·后'));
  assert.ok(Object.values(pre.names).some((n) => /耳/.test(n)), '有耳朵');
});

test('整套展开：模板能被 makeDoc 读，3D 网格和图样位置一一对应，缝合边配成对，剪口打在两边', () => {
  const m = bean3(), pre = M.presetBean(m, m.parts), res = M.unfold({ mesh: m, regions: pre.regions, names: pre.names });
  assert.ok(res.ok, JSON.stringify(res.errors));
  const t = res.template, d = C.makeDoc(t);
  assert.ok(d.meshBody && t.meshBody);
  assert.equal(d.pieces.length, t.pieces.length);
  assert.ok(d.pieces.length >= 12);
  for (const p of d.pieces) {
    assert.ok(p.area > 1500, `${p.name} 面积 ${p.area}`);
    assert.ok(p.mesh && p.mesh.pos.length === (p.mesh.uv.length / 2) * 3, `${p.name} 点数对得上`);
    assert.ok(p.mesh.idx.every((i) => i >= 0 && i < p.mesh.uv.length / 2));
    // uv（图样坐标）都落在这一片的外接框里
    for (let i = 0; i < p.mesh.uv.length; i += 2) assert.ok(p.mesh.uv[i] >= p.box.x - 2 && p.mesh.uv[i] <= p.box.x + p.box.w + 2 && p.mesh.uv[i + 1] >= p.box.y - 2 && p.mesh.uv[i + 1] <= p.box.y + p.box.h + 2, `${p.name} uv 在框里`);
    assert.ok(p.seamEdges.length >= 1, `${p.name} 有缝合边`);
  }
  assert.equal(d.byId.r1.role, 'meshFace', '头·前 默认是脸片');
  assert.equal(d.byId.r2.role, 'meshHair', '头·后 默认是发片布');
  assert.ok(C.isFace(d.byId.r1));
  assert.equal(C.pieceDir(d.byId.r1, 100, 100), null, '粗模的片不走球面映射');
  // 裁片互不重叠
  for (let i = 0; i < d.pieces.length; i++) for (let j = i + 1; j < d.pieces.length; j++) {
    const a = d.pieces[i], b = d.pieces[j], hit = b.poly.filter((q, k) => k % 3 === 0 && C.inPoly(a.poly, q[0], q[1])).length;
    assert.equal(hit, 0, `${a.name} 和 ${b.name} 重叠`);
  }
  // 缝合：每条缝两边的 3D 长度本来就一样，展开后差得不多的占大多数
  assert.ok(t.seams.length >= 20);
  const good = t.seams.filter((s) => Math.abs(s.a - s.b) / Math.max(s.a, s.b) < 0.1).length;
  assert.ok(good / t.seams.length > 0.7, `差小于 10% 的缝占 ${good}/${t.seams.length}`);
  assert.ok(t.guides.ticks.length >= 20, '有对位剪口');
  const ids = new Set(t.pieces.map((p) => p.id));
  for (const tk of t.guides.ticks) assert.ok(ids.has(tk.piece));
  // 同一条缝的两边颜色一样：每个颜色在两片上各出现一次
  const byColor = new Map();
  for (const p of t.pieces) for (const e of p.seamEdges) byColor.set(e.label, (byColor.get(e.label) || 0) + 1);
  for (const [lab, n] of byColor) assert.equal(n, 2, `缝 ${lab} 两边各一条`);
  // 比例：头最宽的一片 320 像素；检查里缝合长度对不上会警告
  const widest = Math.max(...t.pieces.filter((p) => /^头/.test(p.name)).map((p) => { const xs = p.poly.map((q) => q[0]); return Math.max(...xs) - Math.min(...xs); }));
  near(widest, 320, 25, '头最宽的一片约 320 像素');
  const w = C.checks(d, {}, { faceMm: 100, seams: t.seams });
  assert.ok(w.some((c) => /缝合长度/.test(c.text)) || good === t.seams.length, '差多的缝要警告');
});

test('展开有错的时候，说清楚是哪一片、为什么，不会硬展', () => {
  const m = bean3(), n = m.tri.length;
  assert.equal(M.unfold({ mesh: m, regions: new Array(n).fill(0), names: {} }).ok, false);
  const res = M.unfold({ mesh: m, regions: new Array(n).fill(1), names: { 1: '整个球' } });
  assert.equal(res.ok, false);
  assert.match(res.errors[0].reason, /封闭/);
  assert.equal(res.errors[0].id, 1);
});

test('自动省道接入整套展开：标为 D 的缝在同一片上成对，网格和图样均有限', () => {
  const mesh = bean3(), pre = M.presetBean(mesh, mesh.parts), state = { mesh, ...pre };
  const darts = M.suggestDarts(state, { maxPer: 2 });
  const result = M.unfold({ ...state, darts });
  assert.ok(result.ok, JSON.stringify(result.errors));
  assert.ok(darts.length > 0);
  for (const p of result.template.pieces) {
    assert.ok(p.mesh.uv.every(Number.isFinite));
    for (const e of p.seamEdges.filter((e) => /^D/.test(e.label))) assert.equal(p.seamEdges.filter((s) => s.label === e.label).length, 2);
  }
});

test('球面省道穿过三角面：整条切口共面，切开后仍为圆盘', () => {
  const mesh = M.icosphere(3), regions = M.faceCentroids(mesh).map(p => p[2] > 0.1 ? 1 : 0);
  const base = M.extractRegion(mesh, regions, 1);
  const target = base.pos.reduce((best, p, i) => Math.hypot(p[0] - 0.24, p[1] - 0.31, p[2] - 0.92) < Math.hypot(...base.pos[best].map((v,k) => v - [0.24,0.31,0.92][k])) ? i : best, 0);
  const {sub, darts} = M.extractWithDarts(mesh, regions, 1, [base.vorig[target]]);
  assert.equal(darts.length, 1);
  const points = darts[0].left.map(v => sub.pos[v]);
  const tip = points.at(-1), root = points[0], direction = root.map((v,k) => v-tip[k]);
  const normal = [direction[1]*tip[2]-direction[2]*tip[1], direction[2]*tip[0]-direction[0]*tip[2], direction[0]*tip[1]-direction[1]*tip[0]];
  const residual = Math.max(...points.map(p => Math.abs(p.reduce((s,v,k)=>s+(v-tip[k])*normal[k],0))/Math.hypot(...normal)));
  assert.ok(residual < 0.002, `切口偏离平面 ${residual}`);
  assert.ok(sub.pos.length > base.pos.length + points.length - 1, '切线与面相交生成了新点，不是沿旧网格边绕行');
  assert.ok(M.subLoop(sub), '切开后有一条完整边界');
  const area = m => m.tri.reduce((sum,t)=>{
    const [a,b,c]=t.map(v=>m.pos[v]), u=b.map((v,k)=>v-a[k]), v=c.map((x,k)=>x-a[k]);
    return sum+Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;
  },0);
  near(area(sub),area(base),1e-9,'切面没有遗漏或重复，保持原曲面面积');
  darts[0].left.forEach((v,i)=>assert.deepEqual(sub.pos[v],sub.pos[darts[0].right[i]],'省道两边对应同一条三维切线'));
});

test('指定的省道无法切开时明确报错，不丢掉省道继续出片', () => {
  const mesh=bean3(), state={mesh,...M.presetBean(mesh,mesh.parts),darts:[{r:1,v:mesh.pos.length+1}]};
  const result=M.unfold(state);
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(e=>e.id===1 && /缺省道/.test(e.reason)));
});

test('球面分成两片后的闭合配缝也要平顺，不能因首尾重合跳过', () => {
  const mesh=M.icosphere(3), regions=M.faceCentroids(mesh).map(p=>p[2]>0.17 ? 1:2);
  const state={mesh, regions, names:{1:'球上片',2:'球下片'}};
  const before=M.unfold(state,{fair:false}), after=M.unfold(state);
  assert.ok(before.ok && after.ok);
  const variation = tpl => tpl.pieces.reduce((sum,p)=>sum+p.seamEdges.reduce((total,e)=>{
    const points=e.pts.slice(0,-1);
    for(let i=0;i<points.length;i++) {
      const a=points[(i+points.length-1)%points.length], b=points[i], c=points[(i+1)%points.length];
      total+=Math.abs(Math.atan2((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]),(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1])));
    }
    return total;
  },0),0);
  assert.ok(variation(after.template) < variation(before.template)*0.5, '闭合缝不再逐面折返');
  for(const s of after.template.seams) near(s.a,s.b,1e-5,'闭合配缝等长');
});

test('手缝纸样：默认精度下轮廓折返显著减少，省道腿直且等长，配缝差小于 3%', () => {
  const mesh = M.makeBean({ level: 4 }), state = { mesh, ...M.presetBean(mesh, mesh.parts) };
  state.darts = M.suggestDarts(state, { maxPer: 2 });
  const before = M.unfold(state, { fair: false }), after = M.unfold(state);
  assert.ok(after.ok);
  const turning = (tpl) => tpl.pieces.reduce((total, p) => total + p.seamEdges.filter(e => !/^D/.test(e.label)).reduce((sum, e) => {
    for (let i = 1; i + 1 < e.pts.length; i++) {
      const [a, b, c] = e.pts.slice(i - 1, i + 2), ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
      sum += Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy));
    }
    return sum;
  }, 0), 0);
  assert.ok(turning(after.template) < turning(before.template) * 0.35);
  for (const p of after.template.pieces) {
    assert.equal(p.stats.flips, 0, p.name);
    for (const e of p.seamEdges.filter(e => /^D/.test(e.label))) {
      near(M.polyLen(e.pts), Math.hypot(e.pts[0][0] - e.pts.at(-1)[0], e.pts[0][1] - e.pts.at(-1)[1]), 1e-6, '省道是直线');
    }
  }
  for (const s of after.template.seams) {
    assert.ok(Math.abs(s.a - s.b) / Math.max(s.a, s.b) < 0.03, s.name);
    if (s.dart) near(s.a, s.b, 1e-6, '省道两腿等长');
  }
});
