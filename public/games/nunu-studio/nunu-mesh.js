/* 努努赛博定制台 · 粗模分裁片（学 CLO 的做法：建一个粗模 → 用 3D 笔分裁片 → 展开 → 对着缝合边长调整）
 * 纯算法，不碰页面：
 *   parseOBJ / makeBean   —— 粗模从哪来：导入 Blender 导出的 OBJ，或者用内置的「球豆素体」
 *   区域                  —— 每个三角面属于哪一片裁片（0 = 还没分）
 *   展开                  —— 每片裁片用 ARAP（尽量保持长度不变）摊平成 2D，真实大小就是粗模上的大小
 *   缝合                  —— 相邻两片的共用边就是要缝的边：两边长度对不对、每隔一段打一个对位剪口
 * 展开后的裁片就是一份模板，画脸、画发片、备料、导出都直接能接上。 */
(function (root) {
'use strict';
const Shape = root.NunuShape;
const TAU = Math.PI * 2;

/* ============ 粗模：读 OBJ ============ */
function weld(mesh, eps = 1e-5) {
  const key = (p) => `${Math.round(p[0] / eps)},${Math.round(p[1] / eps)},${Math.round(p[2] / eps)}`;
  const map = new Map(), pos = [], remap = [];
  mesh.pos.forEach((p, i) => { const k = key(p); if (!map.has(k)) { map.set(k, pos.length); pos.push(p); } remap[i] = map.get(k); });
  const tri = [];
  for (const t of mesh.tri) { const a = remap[t[0]], b = remap[t[1]], c = remap[t[2]]; if (a !== b && b !== c && a !== c) tri.push([a, b, c]); }
  return { pos, tri };
}
/** 法线朝外：算有符号体积，是负的就把所有面翻过来 */
function orientOutward(mesh) {
  let vol = 0;
  for (const [a, b, c] of mesh.tri) {
    const p = mesh.pos[a], q = mesh.pos[b], r = mesh.pos[c];
    vol += p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0]);
  }
  return vol < 0 ? { pos: mesh.pos, tri: mesh.tri.map(([a, b, c]) => [a, c, b]) } : mesh;
}
function parseOBJ(text) {
  const pos = [], tri = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const [kind, ...fields] = raw.split('#')[0].trim().split(/\s+/);
    if (kind === 'v') {
      const p = fields.slice(0, 3).map(Number);
      // 无效顶点也占一个编号，避免后面的面悄悄引用到别的点。
      pos.push(p.length === 3 && p.every(Number.isFinite) ? p : null);
    } else if (kind === 'f') {
      const idx = fields.map((t) => {
        const token = t.split('/')[0];
        if (!/^[+-]?\d+$/.test(token)) return -1;
        const k = Number(token);
        return Number.isSafeInteger(k) && k !== 0 ? (k < 0 ? pos.length + k : k - 1) : -1;
      });
      // 整个面无效就跳过，不留下只解析了一半的面。
      if (idx.length < 3 || idx.some((i) => i < 0 || i >= pos.length || !pos[i])) continue;
      for (let i = 1; i + 1 < idx.length; i++) tri.push([idx[0], idx[i], idx[i + 1]]);
    }
  }
  const used = new Map(), compact = [];
  const faces = tri.map((t) => t.map((i) => {
    if (!used.has(i)) { used.set(i, compact.length); compact.push(pos[i]); }
    return used.get(i);
  }));
  return orientOutward(weld({ pos: compact, tri: faces }));
}

/* ============ 拓扑 ============ */
function topology(mesh) {
  const N = mesh.pos.length, edges = new Map(), key = (a, b) => (a < b ? a * N + b : b * N + a);
  mesh.tri.forEach((t, fi) => {
    for (let k = 0; k < 3; k++) {
      const a = t[k], b = t[(k + 1) % 3], kk = key(a, b);
      let e = edges.get(kk);
      if (!e) { e = { a: Math.min(a, b), b: Math.max(a, b), faces: [] }; edges.set(kk, e); }
      e.faces.push(fi);
    }
  });
  const nb = mesh.tri.map(() => []);
  for (const e of edges.values()) if (e.faces.length === 2) { nb[e.faces[0]].push(e.faces[1]); nb[e.faces[1]].push(e.faces[0]); }
  return { N, edges, key, nb };
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const dist3 = (a, b) => len3(sub3(a, b));
function faceCentroids(mesh) { return mesh.tri.map(([a, b, c]) => { const p = mesh.pos[a], q = mesh.pos[b], r = mesh.pos[c]; return [(p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3, (p[2] + q[2] + r[2]) / 3]; }); }
function boundsOf(mesh) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of mesh.pos) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  return { lo, hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}
const isClosed = (topo) => { for (const e of topo.edges.values()) if (e.faces.length !== 2) return false; return true; };

/* ============ 内置素体：球豆 ============ */
function icosphere(level) {
  const t = (1 + Math.sqrt(5)) / 2, norm = (p) => { const l = len3(p); return [p[0] / l, p[1] / l, p[2] / l]; };
  let pos = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  let tri = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let l = 0; l < level; l++) {
    const cache = new Map(), next = [];
    const mid = (a, b) => { const k = a < b ? a * 100000 + b : b * 100000 + a; if (!cache.has(k)) { cache.set(k, pos.length); pos.push(norm([(pos[a][0] + pos[b][0]) / 2, (pos[a][1] + pos[b][1]) / 2, (pos[a][2] + pos[b][2]) / 2])); } return cache.get(k); };
    for (const [a, b, c] of tri) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    tri = next;
  }
  return { pos, tri };
}
/** 素体的骨架：每个部分是一个椭球或者「圆锥胶囊」，名字用来自动分片 */
function beanParts(p) {
  const hr = p.headR, parts = [
    { name: 'head', kind: 'ell', c: [0, 1.35 * hr, 0], r: [hr, hr * p.headH, hr * 0.92] },
    { name: 'body', kind: 'ell', c: [0, -0.1, 0], r: [0.85 * p.bodyW, 0.9, 0.7 * p.bodyW] },
  ];
  for (const s of [-1, 1]) {
    const nm = s < 0 ? 'L' : 'R';
    parts.push({ name: 'leg' + nm, kind: 'cone', a: [s * 0.4, -0.7, 0.05], b: [s * 0.46, -0.7 - p.legLen, 0.3], ra: 0.36, rb: 0.3, sz: 1 });
    parts.push({ name: 'arm' + nm, kind: 'cone', a: [s * 0.78 * p.bodyW, 0.15, 0], b: [s * (0.78 * p.bodyW + p.armLen), -0.02, 0.1], ra: 0.26, rb: 0.2, sz: 1 });
    if (p.ear === 'cat') parts.push({ name: 'ear' + nm, kind: 'cone', a: [s * 0.55 * hr, 2.0 * hr, 0], b: [s * 0.82 * hr, 2.62 * hr, 0], ra: 0.38 * hr, rb: 0.05, sz: 2.4 });
    else if (p.ear === 'bear') parts.push({ name: 'ear' + nm, kind: 'ell', c: [s * 0.78 * hr, 2.15 * hr, 0], r: [0.36 * hr, 0.36 * hr, 0.18 * hr] });
    else if (p.ear === 'bunny') parts.push({ name: 'ear' + nm, kind: 'cone', a: [s * 0.4 * hr, 2.1 * hr, 0], b: [s * 0.5 * hr, 3.1 * hr, 0], ra: 0.26 * hr, rb: 0.2 * hr, sz: 2.2 });
  }
  return parts;
}
function partSdf(part, q) {
  if (part.kind === 'ell') {
    const x = (q[0] - part.c[0]) / part.r[0], y = (q[1] - part.c[1]) / part.r[1], z = (q[2] - part.c[2]) / part.r[2];
    return (Math.hypot(x, y, z) - 1) * Math.min(part.r[0], part.r[1], part.r[2]);
  }
  const a = part.a, b = part.b, qz = a[2] + (q[2] - a[2]) * part.sz, pa = [q[0] - a[0], q[1] - a[1], qz - a[2]], ba = [b[0] - a[0], b[1] - a[1], 0];
  const t = Math.max(0, Math.min(1, dot3(pa, ba) / Math.max(1e-9, dot3(ba, ba))));
  return Math.hypot(pa[0] - ba[0] * t, pa[1] - ba[1] * t, pa[2]) - (part.ra + (part.rb - part.ra) * t);
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
/** 球豆素体：头、身体、两腿、两臂、两耳，用隐式曲面从身体中心向外一圈圈找表面，得到一个封闭的三角网格 */
function makeBean(params = {}) {
  const p = { headR: 1, headH: 0.95, bodyW: 1, legLen: 0.55, armLen: 0.55, ear: 'cat', level: 3, ...params };
  const parts = beanParts(p), center = [0, 0.4, 0];
  const field = (q) => parts.reduce((m, pt) => smin(m, partSdf(pt, q), 0.16), 1e9);
  const dirs = icosphere(p.level), pos = [];
  for (const d of dirs.pos) {
    let lo = 0.02, hi = 0.02, step = 0.04, found = false;
    for (let r = 0.04; r < 5; r += step) { if (field([center[0] + d[0] * r, center[1] + d[1] * r, center[2] + d[2] * r]) > 0) { hi = r; lo = r - step; found = true; break; } }
    if (!found) hi = 5;
    for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (field([center[0] + d[0] * m, center[1] + d[1] * m, center[2] + d[2] * m]) > 0) hi = m; else lo = m; }
    const r = (lo + hi) / 2;
    pos.push([center[0] + d[0] * r, center[1] + d[1] * r, center[2] + d[2] * r]);
  }
  const mesh = orientOutward({ pos, tri: dirs.tri });
  return { ...mesh, parts, params: p };
}

/* ============ 区域：3D 笔 ============ */
/** 笔刷：中心点 center、半径 radius 内的三角形（按三角形中心算） */
function brushFaces(mesh, cents, center, radius) {
  const out = [], r2 = radius * radius;
  for (let i = 0; i < cents.length; i++) { const c = cents[i], dx = c[0] - center[0], dy = c[1] - center[1], dz = c[2] - center[2]; if (dx * dx + dy * dy + dz * dz <= r2) out.push(i); }
  return out;
}
/** 这个区域能不能展开：必须是一整块（连通）、没有洞、只有一圈边界（就是圆盘）。边界点要一进一出，不能有「捏在一起」的点 */
function regionInfo(mesh, topo, regions, id) {
  const faces = [];
  regions.forEach((r, fi) => { if (r === id) faces.push(fi); });
  if (!faces.length) return { id, faces, ok: false, reason: '这一片还没有画任何面' };
  // 连通：数有几块
  const inReg = new Uint8Array(mesh.tri.length), seen = new Uint8Array(mesh.tri.length);
  for (const f of faces) inReg[f] = 1;
  let comps = 0;
  for (const f0 of faces) {
    if (seen[f0]) continue;
    comps++;
    const stack = [f0];
    seen[f0] = 1;
    while (stack.length) { const f = stack.pop(); for (const g of topo.nb[f]) if (inReg[g] && !seen[g]) { seen[g] = 1; stack.push(g); } }
  }
  if (comps > 1) return { id, faces, ok: false, reason: `这一片被分成了 ${comps} 块不相连的面，要连成一整块` };
  // 边界：有方向的边（沿着三角形绕向）且另一侧不在本区域
  const next = new Map(), outDeg = new Map(), vset = new Set();
  let boundaryEdges = 0;
  for (const f of faces) {
    const t = mesh.tri[f];
    for (let k = 0; k < 3; k++) {
      const a = t[k], b = t[(k + 1) % 3], e = topo.edges.get(topo.key(a, b));
      vset.add(a);
      const other = e.faces.find((g) => g !== f);
      if (other === undefined || !inReg[other]) { boundaryEdges++; outDeg.set(a, (outDeg.get(a) || 0) + 1); if (!next.has(a)) next.set(a, b); }
    }
  }
  if (!boundaryEdges) return { id, faces, ok: false, reason: '这一片是封闭的（像一个球），要沿着某条线剪开才能展开' };
  for (const [v, d] of outDeg) if (d !== 1) return { id, faces, ok: false, reason: `边界上有一个点被「捏」在一起（点 ${v}），边界要是一整圈不交叉的线`, pinch: v };
  const loops = [], used = new Set();
  for (const s of next.keys()) {
    if (used.has(s)) continue;
    const loop = [];
    let v = s;
    while (!used.has(v)) { used.add(v); loop.push(v); v = next.get(v); if (v === undefined) break; }
    loops.push(loop);
  }
  const edgeSet = new Set();
  for (const f of faces) { const t = mesh.tri[f]; for (let k = 0; k < 3; k++) edgeSet.add(topo.key(t[k], t[(k + 1) % 3])); }
  const euler = vset.size - edgeSet.size + faces.length;
  if (loops.length !== 1 || euler !== 1) return { id, faces, ok: false, reason: loops.length > 1 ? `这一片有 ${loops.length} 圈边界（中间有洞，或者是一个管子），要再剪开一条缝` : '这一片不是一张平铺得开的圆盘', loops };
  return { id, faces, ok: true, loop: loops[0], euler };
}
/** 取出一个区域做成独立的小网格（点重新编号） */
function extractRegion(mesh, regions, id) {
  const faces = [], vmap = new Map(), vorig = [], pos = [], tri = [];
  regions.forEach((r, fi) => { if (r === id) faces.push(fi); });
  const idx = (v) => { if (!vmap.has(v)) { vmap.set(v, pos.length); vorig.push(v); pos.push(mesh.pos[v]); } return vmap.get(v); };
  for (const f of faces) tri.push(mesh.tri[f].map(idx));
  return { faces, vmap, vorig, pos, tri };
}

const PART_NAMES = { head: '头', body: '身体', legL: '左腿', legR: '右腿', armL: '左臂', armR: '右臂', earL: '左耳', earR: '右耳' };
/** 每个面只留最大的一块连通区域，零碎的并给周围票数最多的片；反复到稳定 */
function repairRegions(mesh, topo, regions) {
  for (let round = 0; round < 6; round++) {
    let changed = 0;
    const ids = [...new Set(regions)].filter((r) => r > 0);
    for (const id of ids) {
      const comps = [], seen = new Set();
      regions.forEach((r, f0) => {
        if (r !== id || seen.has(f0)) return;
        const comp = [], stack = [f0];
        seen.add(f0);
        while (stack.length) { const f = stack.pop(); comp.push(f); for (const g of topo.nb[f]) if (regions[g] === id && !seen.has(g)) { seen.add(g); stack.push(g); } }
        comps.push(comp);
      });
      if (comps.length <= 1) continue;
      comps.sort((p, q) => q.length - p.length);
      for (const comp of comps.slice(1)) for (const f of comp) {
        const cnt = new Map();
        for (const g of topo.nb[f]) if (regions[g] !== id) cnt.set(regions[g], (cnt.get(regions[g]) || 0) + 1);
        let best = 0, bc = 0;
        for (const [k, c] of cnt) if (c > bc) { bc = c; best = k; }
        regions[f] = best; changed++;
      }
    }
    if (!changed) break;
  }
  return regions;
}
/** 球豆素体的自动分片：每个部分（头、身体、两腿、两臂、两耳）各分前后两片 —— 每片都是一张圆盘，管子要沿着长度剪开才摊得平 */
function presetBean(mesh, parts) {
  const topo = topology(mesh), cents = faceCentroids(mesh);
  const part = cents.map((c) => { let best = 0, bd = Infinity; parts.forEach((pt, i) => { const d = partSdf(pt, c); if (d < bd) { bd = d; best = i; } }); return best; });
  for (let it = 0; it < 3; it++) {
    const nxt = part.slice();
    part.forEach((p, fi) => {
      const cnt = new Map();
      for (const g of topo.nb[fi]) cnt.set(part[g], (cnt.get(part[g]) || 0) + 1);
      let top = p, tc = cnt.get(p) || 0;
      for (const [k, c] of cnt) if (c > tc) { top = k; tc = c; }
      nxt[fi] = top;
    });
    for (let i = 0; i < part.length; i++) part[i] = nxt[i];
  }
  const zMean = parts.map((_, i) => { let s = 0, n = 0; part.forEach((p, f) => { if (p === i) { s += cents[f][2]; n++; } }); return n ? s / n : 0; });
  const regions = new Int32Array(mesh.tri.length), names = {};
  parts.forEach((pt, i) => { names[2 * i + 1] = `${PART_NAMES[pt.name] || pt.name}·前`; names[2 * i + 2] = `${PART_NAMES[pt.name] || pt.name}·后`; });
  part.forEach((p, f) => { regions[f] = 2 * p + (cents[f][2] >= zMean[p] ? 1 : 2); });
  repairRegions(mesh, topo, regions);
  // 去掉沿三角网格突出的单面尖角。只接受缩短接缝且不破坏两片圆盘拓扑的移动。
  const faceEdges = mesh.tri.map(() => []);
  for (const e of topo.edges.values()) if (e.faces.length === 2) {
    const length = dist3(mesh.pos[e.a], mesh.pos[e.b]);
    faceEdges[e.faces[0]].push([e.faces[1], length]);
    faceEdges[e.faces[1]].push([e.faces[0], length]);
  }
  for (let pass = 0; pass < 3; pass++) {
    let changed = 0;
    for (let f = 0; f < regions.length; f++) {
      const old = regions[f], edges = faceEdges[f];
      const candidates = [...new Set(edges.map(([g]) => regions[g]))].filter((r) => r !== old && r > 0);
      for (const next of candidates) {
        if (edges.filter(([g]) => regions[g] === next).length < 2) continue;
        const cost = (id) => edges.reduce((s, [g, len]) => s + (regions[g] === id ? 0 : len), 0);
        if (cost(next) >= cost(old) - 1e-8) continue;
        regions[f] = next;
        if (regionInfo(mesh, topo, regions, old).ok && regionInfo(mesh, topo, regions, next).ok) { changed++; break; }
        regions[f] = old;
      }
    }
    if (!changed) break;
  }
  const used = new Set(regions), outNames = {};
  for (const k of Object.keys(names)) if (used.has(+k)) outNames[k] = names[k];
  return { regions: Array.from(regions), names: outNames };
}

/* ============ 展开：ARAP（尽量保持长度不变） ============ */
function triGeometry(sub) {
  // 每个三角形的等距 2D 坐标，和三条边的半余切权
  return sub.tri.map(([a, b, c]) => {
    const A = sub.pos[a], B = sub.pos[b], C = sub.pos[c], ab = sub2(B, A), ac = sub2(C, A), l01 = len3(ab);
    const x2 = dot3(ac, ab) / (l01 || 1e-12), y2 = Math.sqrt(Math.max(0, dot3(ac, ac) - x2 * x2));
    const q = [[0, 0], [l01, 0], [x2, y2]];
    const cotAt = (P, Q, R) => { const u = sub2(Q, P), w = sub2(R, P), cr = len3(cross3(u, w)); return Math.max(1e-3, dot3(u, w) / (cr || 1e-12)); };
    // 边 (a,b) 对着 c；边 (b,c) 对着 a；边 (c,a) 对着 b
    return { q, w: [0.5 * cotAt(C, A, B), 0.5 * cotAt(A, B, C), 0.5 * cotAt(B, C, A)] };
  });
}
const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** 展开一个圆盘区域。返回 uv（和 sub.pos 一一对应，单位同粗模）和失真统计 */
function flatten(sub, loop, opts = {}) {
  const n = sub.pos.length, tg = triGeometry(sub), iters = opts.iterations || 40;
  // ---- 邻接和拉普拉斯 ----
  const adj = Array.from({ length: n }, () => new Map()), diag = new Float64Array(n);
  sub.tri.forEach((t, ti) => {
    for (let e = 0; e < 3; e++) {
      const a = t[e], b = t[(e + 1) % 3], w = tg[ti].w[e];
      adj[a].set(b, (adj[a].get(b) || 0) + w); adj[b].set(a, (adj[b].get(a) || 0) + w);
      diag[a] += w; diag[b] += w;
    }
  });
  const nbr = adj.map((m) => [...m.entries()]);
  // ---- 初值：边界放在圆上（按三维边长分布），里面用均匀权重调和 ----
  const u = Array.from({ length: n }, () => [0, 0]), onB = new Uint8Array(n);
  const perim = loop.reduce((s, v, i) => s + dist3(sub.pos[v], sub.pos[loop[(i + 1) % loop.length]]), 0), R0 = perim / TAU;
  let acc = 0;
  loop.forEach((v, i) => { const ang = (acc / perim) * TAU; u[v] = [R0 * Math.cos(ang), R0 * Math.sin(ang)]; onB[v] = 1; acc += dist3(sub.pos[v], sub.pos[loop[(i + 1) % loop.length]]); });
  for (let it = 0; it < 400; it++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      if (onB[i]) continue;
      let sx = 0, sy = 0;
      const ns = nbr[i];
      for (const [j] of ns) { sx += u[j][0]; sy += u[j][1]; }
      const nx = sx / ns.length, ny = sy / ns.length;
      moved = Math.max(moved, Math.abs(nx - u[i][0]) + Math.abs(ny - u[i][1]));
      u[i][0] = nx; u[i][1] = ny;
    }
    if (moved < R0 * 1e-6) break;
  }
  // ---- ARAP 迭代：局部 = 每个三角形找最贴合的旋转，整体 = 解拉普拉斯方程 ----
  const meanDiag = diag.reduce((s, v) => s + v, 0) / n, lam = meanDiag * 1e-6;
  const bx = new Float64Array(n), by = new Float64Array(n), rot = new Array(sub.tri.length);
  const matvec = (x, out) => { for (let i = 0; i < n; i++) { let s = (diag[i] + lam) * x[i]; for (const [j, w] of nbr[i]) s -= w * x[j]; out[i] = s; } };
  const cg = (b, x0) => {
    const x = Float64Array.from(x0), r = new Float64Array(n), p = new Float64Array(n), Ap = new Float64Array(n);
    matvec(x, Ap);
    for (let i = 0; i < n; i++) { r[i] = b[i] - Ap[i]; p[i] = r[i]; }
    let rs = 0;
    for (let i = 0; i < n; i++) rs += r[i] * r[i];
    const stop = 1e-10 * (1 + b.reduce((s, v) => s + v * v, 0));
    for (let k = 0; k < 150 && rs > stop; k++) {
      matvec(p, Ap);
      let pAp = 0;
      for (let i = 0; i < n; i++) pAp += p[i] * Ap[i];
      const alpha = rs / (pAp || 1e-30);
      let rn = 0;
      for (let i = 0; i < n; i++) { x[i] += alpha * p[i]; r[i] -= alpha * Ap[i]; rn += r[i] * r[i]; }
      const beta = rn / (rs || 1e-30);
      for (let i = 0; i < n; i++) p[i] = r[i] + beta * p[i];
      rs = rn;
    }
    return x;
  };
  for (let it = 0; it < iters; it++) {
    bx.fill(0); by.fill(0);
    sub.tri.forEach((t, ti) => {
      const { q, w } = tg[ti];
      let m00 = 0, m01 = 0, m10 = 0, m11 = 0;
      for (let e = 0; e < 3; e++) {
        const a = e, b = (e + 1) % 3, du = [u[t[a]][0] - u[t[b]][0], u[t[a]][1] - u[t[b]][1]], dq = [q[a][0] - q[b][0], q[a][1] - q[b][1]];
        m00 += w[e] * du[0] * dq[0]; m01 += w[e] * du[0] * dq[1]; m10 += w[e] * du[1] * dq[0]; m11 += w[e] * du[1] * dq[1];
      }
      const th = Math.atan2(m10 - m01, m00 + m11), c = Math.cos(th), s = Math.sin(th);
      rot[ti] = [c, s];
      for (let e = 0; e < 3; e++) {
        const a = e, b = (e + 1) % 3, dq = [q[a][0] - q[b][0], q[a][1] - q[b][1]], rx = c * dq[0] - s * dq[1], ry = s * dq[0] + c * dq[1];
        bx[t[a]] += w[e] * rx; by[t[a]] += w[e] * ry; bx[t[b]] -= w[e] * rx; by[t[b]] -= w[e] * ry;
      }
    });
    for (let i = 0; i < n; i++) { bx[i] += lam * u[i][0]; by[i] += lam * u[i][1]; }
    const ux = cg(bx, u.map((p) => p[0])), uy = cg(by, u.map((p) => p[1]));
    for (let i = 0; i < n; i++) { u[i][0] = ux[i]; u[i][1] = uy[i]; }
  }
  // ---- 朝向：从外面看这片，和粗模一样是不镜像的（图纸坐标 y 向下）；整体转正，让 3D 的「上」朝图纸上方 ----
  let sgn = 0;
  sub.tri.forEach((t, ti) => { const a = u[t[0]], b = u[t[1]], c = u[t[2]]; sgn += (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); });
  // 从外面看三角形逆时针（y 向上的坐标系），到了 y 向下的图纸上就是顺时针（叉积为负）
  if (sgn > 0) for (const p of u) p[0] = -p[0];
  // 更直接的办法：用整个区域的点——取 3D 世界 +y 方向上最高点的平均 2D 位置减最低点的平均 2D 位置，当作「上」
  // 世界高度 y 随 uv 怎么变：y 和 uv 两个坐标的协方差，就是「往上」在 uv 里指向哪边（不受点的分布、并列影响）
  let my = 0, mux = 0, muy = 0;
  for (let i = 0; i < n; i++) { my += sub.pos[i][1]; mux += u[i][0]; muy += u[i][1]; }
  my /= n; mux /= n; muy /= n;
  let dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { dx += (sub.pos[i][1] - my) * (u[i][0] - mux); dy += (sub.pos[i][1] - my) * (u[i][1] - muy); }
  if (Math.hypot(dx, dy) < 1e-9) { dx = 0; dy = -1; }
  // 世界 +y 对应 uv 的方向 (dx,dy)；转到图纸「上」= (0,-1)
  const ang = Math.atan2(-1, 0) - Math.atan2(dy, dx), ca = Math.cos(ang), sa = Math.sin(ang);
  for (const p of u) { const x = p[0], y = p[1]; p[0] = x * ca - y * sa; p[1] = x * sa + y * ca; }
  // ---- 失真：每条边展开后的长度 / 三维长度 ----
  let sum = 0, cnt = 0, worst = 0, flips = 0;
  const vsum = new Float64Array(n), vcnt = new Float64Array(n);
  const seenE = new Set();
  sub.tri.forEach((t) => {
    for (let e = 0; e < 3; e++) {
      const a = t[e], b = t[(e + 1) % 3], k2 = a < b ? a * n + b : b * n + a;
      if (seenE.has(k2)) continue;
      seenE.add(k2);
      const l3 = dist3(sub.pos[a], sub.pos[b]), l2 = Math.hypot(u[a][0] - u[b][0], u[a][1] - u[b][1]), r = l2 / (l3 || 1e-12);
      const er = Math.abs(r - 1);
      sum += er; cnt++; worst = Math.max(worst, er);
      vsum[a] += er; vsum[b] += er; vcnt[a]++; vcnt[b]++;
    }
  });
  sub.tri.forEach((t) => { const a = u[t[0]], b = u[t[1]], c = u[t[2]]; if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0) flips++; });
  // 每个点的失真：它周围的边展开前后长度比偏离 1 多少（用来找该在哪里剪省道）
  const vertexErr = Array.from(vsum, (v, i) => (vcnt[i] ? v / vcnt[i] : 0));
  return { uv: u, stats: { meanErr: sum / Math.max(1, cnt), maxErr: worst, flips, triangles: sub.tri.length, vertexErr } };
}

/* ============ 省道：从片的边剪一道缝到里面的一个点，展开以后缝就张成 V 形缺口，两边缝在一起 ============ */
function subBoundary(sub) {
  const n = sub.pos.length, dir = new Set(), next = new Map();
  for (const t of sub.tri) for (let k = 0; k < 3; k++) dir.add(t[k] * n + t[(k + 1) % 3]);
  for (const t of sub.tri) for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3]; if (!dir.has(b * n + a)) { if (next.has(a)) return { ok: false }; next.set(a, b); } }
  return { ok: true, next };
}
function subLoop(sub) {
  const b = subBoundary(sub);
  if (!b.ok || !b.next.size) return null;
  const starts = [...b.next.keys()], loop = [], seen = new Set();
  let v = starts[0];
  while (!seen.has(v)) { seen.add(v); loop.push(v); v = b.next.get(v); if (v === undefined) return null; }
  return seen.size === b.next.size ? loop : null;
}
/** 从 target 出发，沿着网格的边找到最近的边界点（按三维长度），返回从边界点到 target 的点序列 */
function pathToBoundary(sub, target) {
  const n = sub.pos.length, bnd = subBoundary(sub);
  if (!bnd.ok) return null;
  const onB = new Set(bnd.next.keys()), adj = Array.from({ length: n }, () => new Set());
  for (const t of sub.tri) for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3]; adj[a].add(b); adj[b].add(a); }
  if (onB.has(target)) return null;
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  dist[target] = 0;
  for (let it = 0; it < n; it++) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = 1;
    if (onB.has(u)) { const path = [u]; while (prev[path[path.length - 1]] >= 0) path.push(prev[path[path.length - 1]]); return path; }
    for (const w of adj[u]) { const d = dist[u] + dist3(sub.pos[u], sub.pos[w]); if (d < dist[w]) { dist[w] = d; prev[w] = u; } }
  }
  return null;
}
const sharedAt = (f, g, v) => { const o = f.filter((x) => x !== v); for (const x of g) if (x !== v && o.includes(x)) return x; return -1; };
/** 用经过尖点与边界根点的平面切三角面；不把切口吸附到旧网格边。 */
function planarDartPath(sub, target) {
  const boundary = subBoundary(sub);
  if (!boundary.ok || boundary.next.has(target)) return null;
  const tip = sub.pos[target], surfaceNormal = [0, 0, 0];
  for (const t of sub.tri) if (t.includes(target)) {
    const n = cross3(sub3(sub.pos[t[1]], sub.pos[t[0]]), sub3(sub.pos[t[2]], sub.pos[t[0]]));
    n.forEach((v, k) => surfaceNormal[k] += v);
  }
  const roots = [...boundary.next.keys()].sort((a,b) => dist3(sub.pos[a], tip) - dist3(sub.pos[b], tip));
  for (const root of roots) {
    const normal = cross3(sub3(sub.pos[root], tip), surfaceNormal), length = len3(normal);
    if (length < 1e-12) continue;
    const distances = sub.pos.map(p => dot3(sub3(p, tip), normal) / length);
    distances[target] = distances[root] = 0;
    const pos = sub.pos.slice(), intersections = new Map(), graph = new Map(), segments = [];
    const edgeKey = (a,b) => a < b ? `${a}:${b}` : `${b}:${a}`;
    const intersection = (a,b) => {
      if (Math.abs(distances[a]) < 1e-9) return a;
      if (Math.abs(distances[b]) < 1e-9) return b;
      const key = edgeKey(a,b);
      if (!intersections.has(key)) {
        const t = distances[a] / (distances[a] - distances[b]);
        intersections.set(key, pos.length);
        pos.push(sub.pos[a].map((v,k) => v + t * (sub.pos[b][k] - v)));
      }
      return intersections.get(key);
    };
    sub.tri.forEach((tri, fi) => {
      const hits = new Set();
      for (let k=0;k<3;k++) {
        const a=tri[k], b=tri[(k+1)%3];
        if (Math.abs(distances[a]) < 1e-9) hits.add(a);
        if (distances[a]*distances[b] < -1e-18) hits.add(intersection(a,b));
      }
      if (hits.size !== 2) return;
      const [a,b] = [...hits]; segments.push({a,b,fi});
      for (const [v,w] of [[a,b],[b,a]]) { if (!graph.has(v)) graph.set(v,[]); graph.get(v).push(w); }
    });
    const queue = [target], previous = new Map([[target, null]]);
    for (let i=0;i<queue.length && !previous.has(root);i++) {
      const v=queue[i];
      if (v !== target && boundary.next.has(v)) continue;
      for (const w of graph.get(v) || []) if (!previous.has(w)) { previous.set(w,v); queue.push(w); }
    }
    if (!previous.has(root)) continue;
    const path = [root]; while (path.at(-1) !== target) path.push(previous.get(path.at(-1)));
    const pathEdges = new Set(path.slice(1).map((v,i)=>edgeKey(path[i],v)));
    const touched = new Set(segments.filter(s=>pathEdges.has(edgeKey(s.a,s.b))).map(s=>s.fi));
    const added = new Map(), newPos = sub.pos.slice(), newOrig = sub.vorig.slice();
    const index = v => {
      if (v < sub.pos.length) return v;
      if (!added.has(v)) { added.set(v,newPos.length); newPos.push(pos[v]); newOrig.push(-newPos.length); }
      return added.get(v);
    };
    const triangles = [];
    sub.tri.forEach((tri,fi) => {
      if (!touched.has(fi)) { triangles.push(tri); return; }
      // 保留原面的绕向，切口两侧分别三角化，共用交点。
      for (const sign of [-1,1]) {
        const polygon = [];
        for (let k=0;k<3;k++) {
          const a=tri[k], b=tri[(k+1)%3];
          if (sign*distances[a] >= -1e-9) polygon.push(a);
          if (distances[a]*distances[b] < -1e-18) polygon.push(intersection(a,b));
        }
        for (let k=1;k+1<polygon.length;k++) {
          const t=[polygon[0],polygon[k],polygon[k+1]].map(index);
          if (len3(cross3(sub3(newPos[t[1]],newPos[t[0]]),sub3(newPos[t[2]],newPos[t[0]]))) > 1e-12) triangles.push(t);
        }
      }
    });
    const result = path.map(index);
    sub.pos = newPos; sub.vorig = newOrig; sub.tri = triangles;
    return result;
  }
  return null;
}
/** 沿着 path（边界点 → 尖）把网格剪开：除了尖以外，路径上的点各复制一个，路径左边的面用复制的点。返回 { left, right }：缝的两条边（点序号，都是边界点 → 尖） */
function cutPath(sub, path) {
  if (path.length < 2) return null;
  const n = sub.pos.length, inc = Array.from({ length: n }, () => []);
  sub.tri.forEach((t, fi) => t.forEach((v) => inc[v].push(fi)));
  const pathEdge = new Set();
  for (let i = 0; i + 1 < path.length; i++) { pathEdge.add(path[i] * n + path[i + 1]); pathEdge.add(path[i + 1] * n + path[i]); }
  const isPE = (a, b) => a < n && b < n && pathEdge.has(a * n + b);
  const leftFace = (a, b) => { for (const fi of inc[a]) { const t = sub.tri[fi]; for (let k = 0; k < 3; k++) if (t[k] === a && t[(k + 1) % 3] === b) return fi; } return -1; };
  const copies = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const v = path[i], L = leftFace(v, path[i + 1]);
    if (L < 0) return null;
    const grp = new Set([L]), stack = [L];
    while (stack.length) {
      const f = stack.pop();
      for (const g of inc[v]) {
        if (grp.has(g)) continue;
        const w = sharedAt(sub.tri[f], sub.tri[g], v);
        if (w >= 0 && !isPE(v, w)) { grp.add(g); stack.push(g); }
      }
    }
    const nv = sub.pos.length;
    sub.pos.push(sub.pos[v]);
    if (sub.vorig) sub.vorig.push(sub.vorig[v]);
    for (const f of grp) sub.tri[f] = sub.tri[f].map((x) => (x === v ? nv : x));
    copies.push(nv);
  }
  return { left: [...copies, path[path.length - 1]], right: path.slice() };
}
/** 区域取出来以后按省道（尖点的粗模点编号）剪开 */
function extractWithDarts(mesh, regions, id, tips) {
  const sub = extractRegion(mesh, regions, id), darts = [];
  for (const tv of tips) {
    const ti = sub.vmap.get(tv);
    if (ti === undefined) continue;
    const path = planarDartPath(sub, ti);
    if (!path) continue;
    const cut = cutPath(sub, path);
    if (cut) darts.push({ tip: tv, ...cut });
  }
  return { sub, darts };
}
/** 离所有边界点最远的内部点（沿网格的边按三维长度算）。省道剪开以后，剪口也是边界，所以第二道省道会避开第一道 */
function farthestInterior(sub) {
  const n = sub.pos.length, bnd = subBoundary(sub);
  if (!bnd.ok) return -1;
  const adj = Array.from({ length: n }, () => new Set());
  for (const t of sub.tri) for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3]; adj[a].add(b); adj[b].add(a); }
  const dist = new Float64Array(n).fill(Infinity), done = new Uint8Array(n);
  for (const v of bnd.next.keys()) dist[v] = 0;
  for (let it = 0; it < n; it++) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = 1;
    for (const w of adj[u]) { const d = dist[u] + dist3(sub.pos[u], sub.pos[w]); if (d < dist[w]) dist[w] = d; }
  }
  let bv = -1, bd = 0.25;
  for (let i = 0; i < n; i++) if (Number.isFinite(dist[i]) && dist[i] > bd) { bd = dist[i]; bv = i; }
  return bv;
}
/** 自动加省道：每片展开后失真平均超过 target 的，在失真最大的内部点剪一道，最多 maxPer 道，剪了没改善就停 */
function suggestDarts(state, opts = {}) {
  const mesh = state.mesh, topo = topology(mesh), regions = state.regions, target = opts.target == null ? 0.045 : opts.target, maxPer = opts.maxPer || 3;
  const ids = [...new Set(regions)].filter((r) => r > 0), out = [];
  for (const id of ids) {
    const inf = regionInfo(mesh, topo, regions, id);
    if (!inf.ok) continue;
    const tips = [];
    const evalWith = (ts) => {
      const { sub, darts } = extractWithDarts(mesh, regions, id, ts), loop = subLoop(sub);
      if (!loop || darts.length !== ts.length) return null;
      return { sub, loop, darts, res: flatten(sub, loop, { iterations: 24 }) };
    };
    let cur = evalWith(tips);
    for (let k = 0; k < maxPer && cur && cur.res.stats.meanErr > target; k++) {
      // 尖选在「离边界和已有省道最远」的内部点：圆顶的中心。省道一直剪到那里，圆顶才摊得开
      const bestV = farthestInterior(cur.sub);
      if (bestV < 0) break;
      const tv = cur.sub.vorig[bestV], next = evalWith([...tips, tv]);
      if (!next || next.res.stats.meanErr > cur.res.stats.meanErr * 0.92) break;
      tips.push(tv); cur = next;
    }
    for (const tv of tips) out.push({ r: id, v: tv });
  }
  return out;
}

/** 纸样整形：平顺整段边界，保留省道口与尖；内部 UV 同步移动。 */
function fairPattern(sub, loop, uv, cuts = [], targets = new Map()) {
  const original = uv.map((p) => p.slice()), next = uv.map((p) => p.slice());
  const boundary = new Set(loop), pinned = new Set();
  for (const cut of cuts) for (const side of [cut.left, cut.right]) for (const v of side) pinned.add(v);
  const adj = Array.from({ length: uv.length }, () => new Set());
  for (const t of sub.tri) for (let k = 0; k < 3; k++) { adj[t[k]].add(t[(k + 1) % 3]); adj[t[(k + 1) % 3]].add(t[k]); }
  for (const [v, p] of targets) if (!pinned.has(v)) next[v] = p.slice();
  // 省道腿拉成等长直线，不保留网格路径上的折弯。
  for (const cut of cuts) {
    const tip = next[cut.left.at(-1)], a = next[cut.left[0]], b = next[cut.right[0]];
    const length = (Math.hypot(a[0] - tip[0], a[1] - tip[1]) + Math.hypot(b[0] - tip[0], b[1] - tip[1])) / 2;
    for (const side of [cut.left, cut.right]) {
      const start = next[side[0]], len = Math.hypot(start[0] - tip[0], start[1] - tip[1]);
      const root = tip.map((x, k) => x + (start[k] - x) * length / Math.max(len, 1e-12));
      const distances = [0];
      for (let i = 1; i < side.length; i++) distances.push(distances.at(-1) + dist3(sub.pos[side[i - 1]], sub.pos[side[i]]));
      side.forEach((v, i) => { const t = distances[i] / Math.max(distances.at(-1), 1e-12); next[v] = root.map((x, k) => x * (1 - t) + tip[k] * t); });
    }
  }
  const delta = next.map((p, i) => p.map((x, k) => x - original[i][k]));
  for (let pass = 0; pass < 300; pass++) {
    let moved = 0;
    for (let v = 0; v < uv.length; v++) {
      if (boundary.has(v) || !adj[v].size) continue;
      for (let k = 0; k < 2; k++) {
        let sum = 0; for (const w of adj[v]) sum += delta[w][k];
        const value = sum / adj[v].size;
        moved = Math.max(moved, Math.abs(value - delta[v][k])); delta[v][k] = value;
      }
    }
    if (moved < 1e-8) break;
  }
  for (let v = 0; v < uv.length; v++) if (!boundary.has(v)) next[v] = original[v].map((x, k) => x + delta[v][k]);
  // 边界固定后消除局部翻面，避免预览纹理折叠到纸样外侧。
  for (let pass = 0; pass < 600; pass++) {
    let bad = 0;
    for (const t of sub.tri) {
      const [a, b, c] = t.map(v => next[v]);
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (area < -1e-9) continue;
      bad++;
      const gradients = [[b[1] - c[1], c[0] - b[0]], [c[1] - a[1], a[0] - c[0]], [a[1] - b[1], b[0] - a[0]]];
      let norm = 0;
      t.forEach((v, i) => { if (!boundary.has(v)) norm += gradients[i][0] ** 2 + gradients[i][1] ** 2; });
      if (!norm) continue;
      const step = (area + 1e-7) / norm;
      t.forEach((v, i) => { if (!boundary.has(v)) for (let k = 0; k < 2; k++) next[v][k] -= gradients[i][k] * step; });
    }
    if (!bad) break;
  }
  // 边界转弯改变后，旧网格可能仍用原来的对角线切一个凹四边形。
  // 只交换内部对角线；外轮廓、缝线及所有 UV 点均不变。
  const signed = t => { const [a, b, c] = t.map(v => next[v]); return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); };
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    const edges = new Map();
    sub.tri.forEach((t, fi) => { for (let k = 0; k < 3; k++) edges.set(`${t[k]}:${t[(k + 1) % 3]}`, fi); });
    for (let fi = 0; fi < sub.tri.length && !changed; fi++) {
      const t = sub.tri[fi]; if (signed(t) < -1e-9) continue;
      for (let k = 0; k < 3; k++) {
        const a = t[k], b = t[(k + 1) % 3], c = t[(k + 2) % 3], gi = edges.get(`${b}:${a}`);
        if (gi === undefined) continue;
        const d = sub.tri[gi].find(v => v !== a && v !== b);
        if (edges.has(`${c}:${d}`) || edges.has(`${d}:${c}`)) continue;
        const left = [c, d, b], right = [d, c, a];
        if (signed(left) < -1e-9 && signed(right) < -1e-9) { sub.tri[fi] = left; sub.tri[gi] = right; changed = true; break; }
      }
    }
    if (!changed) break;
  }
  return next;
}
function patternStats(sub, uv) {
  let sum = 0, worst = 0, flips = 0, count = 0;
  const seen = new Set(), n = uv.length, total = new Float64Array(n), counts = new Uint32Array(n);
  for (const [a, b, c] of sub.tri) {
    const p = uv[a], q = uv[b], r = uv[c];
    if ((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]) >= -1e-12) flips++;
    for (const [v, w] of [[a, b], [b, c], [c, a]]) {
      const key = Math.min(v, w) * n + Math.max(v, w); if (seen.has(key)) continue; seen.add(key);
      const error = Math.abs(Math.hypot(uv[v][0] - uv[w][0], uv[v][1] - uv[w][1]) / Math.max(dist3(sub.pos[v], sub.pos[w]), 1e-12) - 1);
      sum += error; count++; worst = Math.max(worst, error); total[v] += error; total[w] += error; counts[v]++; counts[w]++;
    }
  }
  return { meanErr: sum / Math.max(count, 1), maxErr: worst, flips, triangles: sub.tri.length, vertexErr: Array.from(total, (v, i) => v / Math.max(counts[i], 1)) };
}

/** 平顺一整段缝，保留整体走向；固定端点，弧长由配对两边共同决定。 */
function seamCurve(points, target, center) {
  if (points.length < 3) return points.map(p => p.slice());
  const a = points[0], b = points.at(-1);
  // 这是已经切成独立圆盘的外缝闭环，不是未经切开的封闭曲面。
  // 周期平顺使接头两侧也连续，随后整圈等比缩放到配对缝长。
  if (Math.hypot(b[0]-a[0],b[1]-a[1]) < 1e-8) {
    let ring=points.slice(0,-1).map(p=>p.slice());
    const middle=[0,1].map(k=>ring.reduce((s,p)=>s+p[k],0)/ring.length);
    for(let pass=0;pass<32;pass++) {
      const old=ring, n=old.length;
      ring=old.map((p,i)=>p.map((v,k)=>0.5*v+0.25*(old[(i+n-1)%n][k]+old[(i+1)%n][k])));
    }
    const length=polyLen([...ring,ring[0]]), scale=target/Math.max(length,1e-12);
    ring=ring.map(p=>p.map((v,k)=>middle[k]+(v-middle[k])*scale));
    return [...ring,ring[0].slice()];
  }
  let smooth = points.map(p => p.slice());
  for (let pass = 0; pass < 16; pass++) {
    const old = smooth;
    smooth = old.map((p, i) => i === 0 || i === old.length - 1 ? p : p.map((v, k) => 0.5 * v + 0.25 * (old[i - 1][k] + old[i + 1][k])));
  }
  const line = smooth.map((_, i) => { const t = i / (smooth.length - 1); return a.map((v, k) => v * (1 - t) + b[k] * t); });
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (polyLen(smooth) - chord < chord * 0.01 && target > chord + 1e-7) {
    const nx = -(b[1] - a[1]) / chord, ny = (b[0] - a[0]) / chord;
    const outward = center ? ((a[0] + b[0]) / 2 - center[0]) * nx + ((a[1] + b[1]) / 2 - center[1]) * ny : 1;
    const sign = outward < 0 ? -1 : 1;
    smooth = line.map((p, i) => { const h = Math.sin(Math.PI * i / (line.length - 1)) * chord * 0.1 * sign; return [p[0] + nx * h, p[1] + ny * h]; });
  }
  const curve = scale => smooth.map((p, i) => p.map((v, k) => line[i][k] + (v - line[i][k]) * scale));
  let lo = 0, hi = 1;
  while (polyLen(curve(hi)) < target && hi < 1048576) hi *= 2;
  for (let i = 0; i < 42; i++) { const mid = (lo + hi) / 2; if (polyLen(curve(mid)) < target) lo = mid; else hi = mid; }
  return curve((lo + hi) / 2);
}

/* ============ 一整套：分片 → 展开 → 缝合边 → 版面 ============ */
const SEAM_COLORS = ['#e04a4a', '#3a8fd8', '#35a85a', '#e0a02f', '#a45bd8', '#e0589a', '#2fb8b8', '#8a6a3a', '#5b6bd8', '#c0c030', '#d8742f', '#7a9a2f'];
const polyLen = (pl) => pl.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - pl[i - 1][0], q[1] - pl[i - 1][1]) : 0), 0);
/** 沿折线按长度比例取点和朝外的法线 */
function pointAlong(pl, frac) {
  const total = polyLen(pl), target = frac * total;
  let acc = 0;
  for (let i = 1; i < pl.length; i++) {
    const seg = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
    if (acc + seg >= target || i === pl.length - 1) {
      const t = seg ? (target - acc) / seg : 0, x = pl[i - 1][0] + (pl[i][0] - pl[i - 1][0]) * t, y = pl[i - 1][1] + (pl[i][1] - pl[i - 1][1]) * t;
      const tx = (pl[i][0] - pl[i - 1][0]) / (seg || 1), ty = (pl[i][1] - pl[i - 1][1]) / (seg || 1);
      return { x, y, tx, ty };
    }
    acc += seg;
  }
  return { x: pl[0][0], y: pl[0][1], tx: 1, ty: 0 };
}

/** 缝合边：相邻两片共用的边连成一条条链。返回 [{ a, b（两片的编号）, verts（粗模点编号，沿着链）, len3d }] */
function seamChains(mesh, topo, regions) {
  const groups = new Map();
  for (const e of topo.edges.values()) {
    if (e.faces.length !== 2) continue;
    const ra = regions[e.faces[0]], rb = regions[e.faces[1]];
    if (!ra || !rb || ra === rb) continue;
    const key = ra < rb ? `${ra}_${rb}` : `${rb}_${ra}`;
    if (!groups.has(key)) groups.set(key, { a: Math.min(ra, rb), b: Math.max(ra, rb), edges: [] });
    groups.get(key).edges.push([e.a, e.b]);
  }
  const out = [];
  for (const g of groups.values()) {
    const adj = new Map();
    for (const [a, b] of g.edges) { if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []); adj.get(a).push(b); adj.get(b).push(a); }
    const used = new Set();
    const edgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
    // 先从端点（度 ≠ 2）开始走，剩下的是闭合的环
    const starts = [...adj.keys()].filter((v) => adj.get(v).length !== 2).concat([...adj.keys()]);
    for (const s of starts) {
      if (adj.get(s).every((w) => used.has(edgeKey(s, w)))) continue;
      const chain = [s];
      let v = s, prev = -1;
      for (;;) {
        const nx = adj.get(v).find((w) => !used.has(edgeKey(v, w)) && w !== prev) ?? adj.get(v).find((w) => !used.has(edgeKey(v, w)));
        if (nx === undefined) break;
        used.add(edgeKey(v, nx));
        chain.push(nx); prev = v; v = nx;
        if (v === s || adj.get(v).length !== 2) break;
      }
      if (chain.length >= 2) out.push({ a: g.a, b: g.b, verts: chain, len3d: chain.reduce((sum, w, i) => (i ? sum + dist3(mesh.pos[chain[i - 1]], mesh.pos[w]) : 0), 0) });
    }
  }
  return out;
}

/** 整套流程。state = { mesh, regions（每个面的片号，0 = 没分）, names（片号 → 名字）, roles（片号 → 用途，可空）}
 *  成功返回 { ok:true, template, report }；有哪一片展不开返回 { ok:false, errors:[{id,reason}] } */
function unfold(state, opts = {}) {
  if (!state.regions || state.regions.length !== state.mesh.tri.length || Array.from(state.regions).some((r) => !Number.isInteger(r) || r < 0)) {
    return { ok: false, errors: [{ id: 0, reason: '分区数据与粗模的面不一致，请重新分片' }] };
  }
  const mesh = state.mesh, topo = topology(mesh), regions = state.regions, ids = [...new Set(regions)].filter((r) => r > 0).sort((p, q) => p - q);
  if (!ids.length) return { ok: false, errors: [{ id: 0, reason: '还没有分片：用 3D 笔在粗模上画出每一片裁片' }] };
  const unassigned = regions.filter((r) => !r).length;
  if (unassigned) return { ok: false, errors: [{ id: 0, reason: `还有 ${unassigned} 个面没有分片，补齐分区后才能生成完整缝合纸样` }] };
  const errors = [];
  const infos = new Map();
  for (const id of ids) { const inf = regionInfo(mesh, topo, regions, id); infos.set(id, inf); if (!inf.ok) errors.push({ id, reason: inf.reason }); }
  if (errors.length) return { ok: false, errors };
  const sizes = boundsOf(mesh).size;
  // ---- 展开每一片 ----
  const flat = new Map(), darts = state.darts || [];
  for (const id of ids) {
    const tips = darts.filter((d) => d.r === id).map((d) => d.v);
    const { sub, darts: cuts } = extractWithDarts(mesh, regions, id, tips), loop = subLoop(sub);
    if (cuts.length !== tips.length) { errors.push({ id, reason: '缺省道：指定的切线无法从边界连续切到尖点，请调整切线或分片' }); continue; }
    if (!loop) { errors.push({ id, reason: '剪省道以后这一片的边界不是一整圈了：省道不要互相穿过，也不要剪到片的另一边' }); continue; }
    const res = flatten(sub, loop, opts);
    flat.set(id, { sub, loop, uv: res.uv, stats: res.stats, cuts });
  }
  if (errors.length) return { ok: false, errors };
  // 省道口把一条外缝分成两段；不能跨过打开的 V 口量长。
  const dartRoots = new Set();
  for (const f of flat.values()) for (const cut of f.cuts) dartRoots.add(f.sub.vorig[cut.left[0]]);
  const chains = [];
  for (const ch of seamChains(mesh, topo, regions)) {
    let start = 0;
    for (let i = 1; i < ch.verts.length; i++) if (dartRoots.has(ch.verts[i]) || i === ch.verts.length - 1) {
      const verts = ch.verts.slice(start, i + 1);
      chains.push({ ...ch, verts, len3d: verts.reduce((sum, v, k) => k ? sum + dist3(mesh.pos[verts[k - 1]], mesh.pos[v]) : sum, 0) });
      start = i;
    }
  }
  const localChain = (ch, id) => {
    const f = flat.get(id), edges = subBoundary(f.sub).next, out = [];
    for (let i = 0; i + 1 < ch.verts.length; i++) {
      const a = ch.verts[i], b = ch.verts[i + 1];
      let found = null;
      for (const [v, w] of edges) {
        const x = f.sub.vorig[v], y = f.sub.vorig[w];
        if (x === a && y === b) { found = [v, w]; break; }
        if (x === b && y === a) { found = [w, v]; break; }
      }
      if (!found || (out.length && out.at(-1) !== found[0])) return null;
      if (!out.length) out.push(found[0]); out.push(found[1]);
    }
    return out;
  };
  if (opts.fair !== false) {
    const targets = new Map(ids.map((id) => [id, new Map()]));
    for (const ch of chains) {
      const locals = [ch.a, ch.b].map(id => localChain(ch, id));
      if (locals.some(v => !v)) continue;
      const sides = [ch.a, ch.b].map((id, k) => locals[k].map(v => flat.get(id).uv[v]));
      if (sides.some((p) => p.length < 3 || !p.every(Boolean))) continue;
      const chord = (p) => Math.hypot(p.at(-1)[0] - p[0][0], p.at(-1)[1] - p[0][1]);
      const target = Math.max(chord(sides[0]), chord(sides[1]), (polyLen(sides[0]) + polyLen(sides[1])) / 2);
      [ch.a, ch.b].forEach((id, side) => {
        const f = flat.get(id), center = [0, 1].map(k => f.uv.reduce((sum, p) => sum + p[k], 0) / f.uv.length), curve = seamCurve(sides[side], target, center);
        locals[side].forEach((v, i) => targets.get(id).set(v, curve[i]));
      });
    }
    for (const id of ids) {
      const f = flat.get(id);
      f.uv = fairPattern(f.sub, f.loop, f.uv, f.cuts, targets.get(id));
      f.stats = patternStats(f.sub, f.uv);
    }
  }
  // ---- 比例：头那几片的宽度当作「脸片宽」（找不到就用最宽的一片） ----
  const widthOf = (id) => { const f = flat.get(id), xs = f.uv.map((p) => p[0]); return Math.max(...xs) - Math.min(...xs); };
  const headIds = ids.filter((id) => /^头|head/i.test((state.names && state.names[id]) || ''));
  const refUnits = headIds.length ? Math.max(...headIds.map(widthOf)) : Math.max(...ids.map(widthOf));
  const pxPerUnit = 320 / refUnits;
  // ---- 缝合边 ----
  const sideInfo = (chain, rid) => {
    const f = flat.get(rid), local = localChain(chain, rid);
    return local ? local.map(v => f.uv[v]) : null;
  };
  // ---- 版面：按外接框一行行排 ----
  const items = ids.map((id) => {
    const f = flat.get(id), xs = f.uv.map((p) => p[0]), ys = f.uv.map((p) => p[1]);
    return { id, x0: Math.min(...xs), y0: Math.min(...ys), w: (Math.max(...xs) - Math.min(...xs)) * pxPerUnit, h: (Math.max(...ys) - Math.min(...ys)) * pxPerUnit };
  });
  const gap = 56, margin = 40, targetW = Math.max(900, Math.sqrt(items.reduce((s, it) => s + (it.w + gap) * (it.h + gap), 0)) * 1.35);
  let x = margin, y = margin, rowH = 0, W = 0;
  const place = new Map();
  for (const it of items.slice().sort((p, q) => q.h - p.h)) {
    if (x > margin && x + it.w > targetW) { x = margin; y += rowH + gap; rowH = 0; }
    place.set(it.id, { ox: x - it.x0 * pxPerUnit, oy: y - it.y0 * pxPerUnit });
    x += it.w + gap; rowH = Math.max(rowH, it.h); W = Math.max(W, x);
  }
  const H = y + rowH + margin;
  const toSheet = (rid, p) => { const pl = place.get(rid); return [p[0] * pxPerUnit + pl.ox, p[1] * pxPerUnit + pl.oy]; };
  // ---- 3D：粗模缩放到场景大小（头宽 = 3 个单位），脚踩在 y = 0 ----
  const headW3 = (() => { const ws = headIds.map((id) => { const ps = flat.get(id).sub.pos, xs = ps.map((p) => p[0]); return Math.max(...xs) - Math.min(...xs); }); return ws.length ? Math.max(...ws) : sizes[0]; })();
  const bb = boundsOf(mesh), sc = 3 / headW3, cx = (bb.lo[0] + bb.hi[0]) / 2, cz = (bb.lo[2] + bb.hi[2]) / 2;
  const scene = (p) => [(p[0] - cx) * sc, (p[1] - bb.lo[1]) * sc, (p[2] - cz) * sc];
  // ---- 每片 ----
  const pieces = [], ticks = [], seams = [], names = state.names || {};
  const colorOf = new Map();
  chains.forEach((ch, i) => colorOf.set(ch, SEAM_COLORS[i % SEAM_COLORS.length]));
  const edgesByRegion = new Map(ids.map((id) => [id, []]));
  chains.forEach((ch, i) => {
    const pa = sideInfo(ch, ch.a), pb = sideInfo(ch, ch.b);
    if (!pa || !pb) return;
    const sa = pa.map((p) => toSheet(ch.a, p)), sb = pb.map((p) => toSheet(ch.b, p)), la = polyLen(sa), lb = polyLen(sb), col = colorOf.get(ch), label = String(i + 1);
    edgesByRegion.get(ch.a).push({ pts: sa, color: col, label }); edgesByRegion.get(ch.b).push({ pts: sb, color: col, label });
    const fr = ch.len3d * pxPerUnit > 260 ? [0.25, 0.5, 0.75] : ch.len3d * pxPerUnit > 70 ? [0.5] : [];
    for (const f of fr) for (const [rid, pts] of [[ch.a, sa], [ch.b, sb]]) { const pt = pointAlong(pts, f); ticks.push({ piece: 'r' + rid, x: pt.x, y: pt.y, dx: pt.ty, dy: -pt.tx, color: col }); }
    seams.push({ name: `${names[ch.a] || '片' + ch.a} ↔ ${names[ch.b] || '片' + ch.b}（${label}）`, a: la, b: lb, len3d: ch.len3d * pxPerUnit, color: col, tol: 0.06, label });
  });
  // 省道：缝的两条边（剪开后的左右两边）缝在一起
  let dartNo = 0;
  for (const id of ids) {
    const f = flat.get(id);
    for (const cut of f.cuts) {
      dartNo++;
      const sa = cut.left.map((i) => toSheet(id, f.uv[i])), sb = cut.right.map((i) => toSheet(id, f.uv[i])), col = SEAM_COLORS[(chains.length + dartNo) % SEAM_COLORS.length], label = 'D' + dartNo;
      edgesByRegion.get(id).push({ pts: sa, color: col, label }, { pts: sb, color: col, label });
      for (const [pts] of [[sa], [sb]]) { const pt = pointAlong(pts, 0.5); ticks.push({ piece: 'r' + id, x: pt.x, y: pt.y, dx: pt.ty, dy: -pt.tx, color: col }); }
      seams.push({ name: `${names[id] || '片' + id} 省道（${label}）`, a: polyLen(sa), b: polyLen(sb), len3d: 0, color: col, tol: 0.1, label, dart: true });
    }
  }
  for (const id of ids) {
    const f = flat.get(id), pl = place.get(id);
    const outline = f.loop.map((i) => toSheet(id, f.uv[i]));
    const posS = f.sub.pos.map(scene), uvS = f.uv.map((p) => toSheet(id, p));
    pieces.push({
      id: 'r' + id, darts: f.cuts.length, name: names[id] || `片 ${id}`, role: (state.roles && state.roles[id]) || (/^(头·前|脸)/.test(names[id] || '') ? 'meshFace' : /^头·后/.test(names[id] || '') ? 'meshHair' : 'meshSkin'),
      poly: outline, smooth: false,
      mesh: { pos: posS.flat(), uv: uvS.flat(), idx: f.sub.tri.flat() },
      seamEdges: edgesByRegion.get(id), stats: f.stats, regionId: id,
    });
    void pl;
  }
  // 周长、失真汇总
  const report = {
    pieces: pieces.map((p) => ({ id: p.id, name: p.name, meanErr: p.stats.meanErr, maxErr: p.stats.maxErr, flips: p.stats.flips })),
    unassigned, seams: seams.map((s) => ({ name: s.name, a: s.a, b: s.b, diff: Math.abs(s.a - s.b) / Math.max(s.a, s.b) })),
    pxPerUnit, sceneScale: sc,
  };
  const template = {
    id: 'mesh-body', paperVersion: 3, name: '平顺缝线与省道体子', w: Math.ceil(W + margin), h: Math.ceil(H), axis: (W + margin) / 2, faceWidthPx: 320, meshBody: true, custom: true,
    note: '从粗模分片展开出来的体子：每片的大小就是粗模上的大小，缝合边已经配好对位剪口。', pieces, pairs: {}, seams,
    guides: { ticks, notches: [] },
  };
  return { ok: true, template, report };
}

root.NunuMesh = { suggestDarts, extractWithDarts, cutPath, pathToBoundary, subLoop, subBoundary, presetBean, repairRegions, PART_NAMES, parseOBJ, weld, orientOutward, topology, faceCentroids, boundsOf, isClosed, icosphere, makeBean, beanParts, partSdf, brushFaces, regionInfo, extractRegion, flatten, seamChains, unfold, pointAlong, polyLen, SEAM_COLORS };
if (typeof module !== 'undefined' && module.exports) module.exports = root.NunuMesh;
})(typeof window === 'undefined' ? globalThis : window);
