const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
// 游戏页面里的脚本是浏览器脚本，不是模块：放进同一个干净的上下文里跑，再从全局上取出来
const ctx = { console };
vm.createContext(ctx);
for (const f of ['nunu-shape.js', 'pattern-data.js', 'nunu-core.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/games/nunu-studio/' + f), 'utf8'), ctx);
const C = ctx.NunuCore, S = ctx.NunuShape, P = ctx.NunuPattern;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (±${tol})`);
const doc = () => C.makeDoc(P.public);

test('公开图纸有 15 片，每片都是封闭多边形，用途都在用途表里', () => {
  const d = doc();
  assert.equal(d.pieces.length, 15);
  for (const p of d.pieces) {
    assert.ok(p.poly.length >= 8, p.id);
    assert.ok(p.area > 1000, `${p.id} 面积 ${p.area}`);
    assert.ok(C.ROLES[p.role], p.id);
    assert.ok(p.box.x >= 0 && p.box.y >= 0 && p.box.x + p.box.w <= d.w && p.box.y + p.box.h <= d.h, `${p.id} 在图内`);
  }
  assert.equal(new Set(d.pieces.map((p) => p.id)).size, 15);
});

test('裁片彼此不重叠（图纸本来就是摊开的）', () => {
  const d = doc();
  for (let i = 0; i < d.pieces.length; i++) for (let j = i + 1; j < d.pieces.length; j++) {
    const a = d.pieces[i], b = d.pieces[j];
    // 用 b 的几个点测 a 里面有没有
    const hit = b.poly.filter((q, k) => k % 3 === 0 && C.inPoly(a.poly, q[0], q[1])).length;
    assert.equal(hit, 0, `${a.id} 和 ${b.id} 重叠`);
  }
});

test('左右成对的裁片：互为镜像，轴在图纸中线', () => {
  const d = doc();
  for (const p of d.pieces.filter((q) => q.partner)) {
    const q = d.byId[p.partner];
    assert.equal(q.partner, p.id);
    near(p.box.w, q.box.w, 10, `${p.id} 宽`);
    near(p.box.h, q.box.h, 10, `${p.id} 高`);
    near(p.box.x + p.box.w / 2 + (q.box.x + q.box.w / 2), 2 * d.axis, 8, `${p.id} 对称轴`);
  }
  const m = C.mirrorOf(d, 'leafL', 100, 200);
  assert.equal(m.pieceId, 'leafR');
  near(m.x, 2 * d.axis - 100, 1e-9);
  const self = C.mirrorOf(d, 'face', 500, 300);
  assert.equal(self.pieceId, 'face');
  near(self.x, 2 * d.byId.face.axis - 500, 1e-9);
});

test('脸片：圆盖，中心朝正前，边缘离正前 64°，方向都是单位向量', () => {
  const d = doc(), f = d.byId.face, c = C.capOf(f);
  const mid = C.pieceDir(f, c.cx, c.cy);
  near(mid[2], 1, 1e-9);
  const edge = C.pieceDir(f, c.cx + c.rx, c.cy);
  near(Math.acos(edge[2]) * 180 / Math.PI, 64, 1e-6);
  assert.ok(edge[0] > 0, '图纸右边在 3D 的 +x 一侧');
  const up = C.pieceDir(f, c.cx, c.cy - c.ry * 0.5);
  assert.ok(up[1] > 0, '图纸上方在 3D 上方');
  for (let i = 0; i < 40; i++) {
    const v = C.pieceDir(f, c.cx + Math.cos(i) * c.rx * 1.3, c.cy + Math.sin(i * 2) * c.ry * 1.3);
    near(Math.hypot(...v), 1, 1e-9);
  }
});

test('后脑两片：图纸左 → 右从前往后转，两片都在背面一侧，左片在 -x、右片在 +x', () => {
  const d = doc(), L = d.byId.leafL, R = d.byId.leafR;
  const mid = (p) => C.pieceDir(p, p.box.x + p.box.w / 2, p.box.y + p.box.h / 2);
  assert.ok(mid(L)[0] < -0.4 && mid(L)[2] < 0, '左后脑在画面左边（-x）偏后');
  assert.ok(mid(R)[0] > 0.4 && mid(R)[2] < 0, '右后脑在画面右边（+x）偏后');
  // 黄边（两片中间那条）都落在正后方：左片靠右的边、右片靠左的边
  const yellowL = C.pieceDir(L, L.box.x + L.box.w, L.box.y + L.box.h / 2), yellowR = C.pieceDir(R, R.box.x, R.box.y + R.box.h / 2);
  assert.ok(yellowL[2] < -0.95 && yellowR[2] < -0.95, '黄边在后脑正中');
  const top = C.pieceDir(L, L.box.x + L.box.w / 2, L.box.y), bot = C.pieceDir(L, L.box.x + L.box.w / 2, L.box.y + L.box.h);
  assert.ok(top[1] > bot[1], '上边在高处');
  assert.equal(C.pieceDir({ role: 'none', box: L.box }, 0, 0), null);
});

test('围脸的两圈：头顶发在脸的上半圈外面，下巴在下半圈外面；贴着脸的那条边正好在脸盖的边上', () => {
  const d = doc(), hairTop = d.byId.big, chin = d.byId.top;
  const angle = (v) => (Math.acos(v[2]) * 180) / Math.PI; // 离正前方多少度
  // 头顶发：每个 x 位置最上边（缝在脸上的那条）离正前方 = 脸盖半径 64°
  for (const u of [0.2, 0.5, 0.8]) {
    const x = hairTop.box.x + hairTop.box.w * u, y = hairTop.edges.top[Math.round(u * 96)];
    near(angle(C.pieceDir(hairTop, x, y + 0.01)), 64, 1.5, `头顶发 u=${u}`);
  }
  // 越往外越远：中间厚的地方比边上转得更远（绕过头顶）
  const cx = hairTop.box.x + hairTop.box.w / 2;
  const edge = hairTop.edges.top[48], deep = C.pieceDir(hairTop, cx, hairTop.edges.bot[48] - 1);
  assert.ok(angle(deep) > 90, '头顶发中间的外边绕过了头顶');
  assert.ok(C.pieceDir(hairTop, cx, edge + 5)[1] > 0.8, '头顶发在头的上方');
  assert.ok(C.pieceDir(chin, chin.box.x + chin.box.w / 2, chin.box.y + chin.box.h * 0.6)[1] < -0.5, '下巴在头的下方');
  // 左右：画面左边在 -x，右边在 +x
  const l = C.pieceDir(hairTop, hairTop.box.x + 12, hairTop.edges.top[4] + 3), r = C.pieceDir(hairTop, hairTop.box.x + hairTop.box.w - 12, hairTop.edges.top[92] + 3);
  assert.ok(l[0] < -0.5 && r[0] > 0.5);
  for (const p of [hairTop, chin]) for (let i = 0; i < 30; i++) near(Math.hypot(...C.pieceDir(p, p.box.x + Math.random() * p.box.w, p.box.y + Math.random() * p.box.h)), 1, 1e-9);
});

test('3D 点：方向 → 椭球上的点，往外凸 off 就是更远一点', () => {
  const p0 = C.targetPoint('head', [0, 0, 1], 0), p1 = C.targetPoint('head', [0, 0, 1], 0.1);
  near(p0[2], C.TARGETS.head.r[2], 1e-9);
  near(p1[2], C.TARGETS.head.r[2] * 1.1, 1e-9);
  near(p0[1], C.TARGETS.head.pos[1], 1e-9);
  const n = C.targetNormal('head', C.dirOf(-90, 90));
  near(Math.hypot(...n), 1, 1e-9);
  assert.ok(n[0] < 0, '头左侧法线朝 -x');
});

test('层规则：脸只能画在脸片，发片只能画在发片布，彩绘不进发片布', () => {
  const d = doc();
  assert.equal(C.layerRule(d.byId.face, 'face').ok, true);
  assert.equal(C.layerRule(d.byId.top, 'face').ok, false);
  assert.equal(C.layerRule(d.byId.bodyA, 'face').ok, false);
  assert.equal(C.layerRule(d.byId.big, 'hair').ok, true);
  assert.equal(C.layerRule(d.byId.top, 'hair').ok, false, '下巴是肤色布');
  assert.equal(C.layerRule(d.byId.face, 'hair').ok, false, '前发不直接画在脸片上，是另起一层');
  assert.match(C.layerRule(d.byId.face, 'hair').reason, /前发/);
  assert.equal(C.layerRule(d.byId.bodyA, 'hair').ok, false);
  assert.match(C.layerRule(d.byId.bodyA, 'hair').reason, /肤色布/);
  assert.equal(C.layerRule(d.byId.top, 'hair').ok, false, '下巴不能画发片');
  assert.equal(C.layerRule(d.byId.big, 'skin').ok, false);
  assert.equal(C.layerRule(d.byId.top, 'skin').ok, true);
  assert.equal(C.layerRule(d.byId.bodyA, 'skin').ok, true);
  // 改用途 / 改布以后，规则跟着变
  const d2 = C.makeDoc(P.public, { materials: { bodyA: 'hair' } });
  assert.equal(C.layerRule(d2.byId.bodyA, 'hair').ok, true);
  assert.equal(C.layerRule(d2.byId.bodyA, 'skin').ok, false);
  const d3 = C.makeDoc(P.public, { roles: { top: 'face' } });
  assert.equal(C.layerRule(d3.byId.top, 'face').ok, true);
});

test('能画的区域：脸在脸窗里；彩绘离缝线留边；发片整片能涂', () => {
  const d = doc(), f = d.byId.face, c = C.capOf(f);
  const zFace = C.buildZone(d, f, 'face', 12);
  assert.equal(C.zoneAt(zFace, 585, 400), true, '脸窗里（嘴那一带）能画');
  assert.equal(C.zoneAt(zFace, 585, 180), false, '额头（脸窗外）不能画脸');
  assert.equal(C.zoneAt(zFace, c.cx, c.cy + c.ry - 3), false, '贴着缝线不能画');
  const zSkin = C.buildZone(d, f, 'skin', 12);
  assert.equal(C.zoneAt(zSkin, 585, 180), true, '额头能彩绘');
  assert.equal(C.zoneAt(zSkin, c.cx, c.cy - c.ry + 4), false, '离缝线 4px 不行');
  assert.equal(C.zoneAt(zSkin, c.cx, c.cy - c.ry + 20), true, '离缝线 20px 可以');
  const hair = d.byId.big, zHair = C.buildZone(d, hair, 'hair', 12);
  assert.equal(C.zoneAt(zHair, hair.box.x + hair.box.w / 2, hair.edges.bot[48] - 4), true, '发片靠近边缘也能涂');
  assert.equal(C.zoneAt(zHair, 10, 10), false, '片外不行');
  const loops = C.zoneLoops(zSkin);
  assert.ok(loops.length >= 1);
});

test('备料单：面积随脸片宽度平方变化；发片按颜色分布', () => {
  const d = doc();
  const stats = {};
  for (const p of d.pieces.filter((q) => q.material === 'hair')) stats[p.id] = { coverage: 1, colors: [{ hex: '#7d594a', frac: 1 }] };
  stats.leafL = { coverage: 1, colors: [{ hex: '#d9b99b', frac: 0.6 }, { hex: '#7d594a', frac: 0.4 }] };
  const a = C.bom(d, stats, { faceMm: 70, skin: '#f1dfcd' }), b = C.bom(d, stats, { faceMm: 140, skin: '#f1dfcd' });
  const skin = (x) => x.fabrics.find((f) => f.label === '肤色布');
  near(skin(b).areaCm2 / skin(a).areaCm2, 4, 1e-9, '面积是平方关系');
  assert.equal(skin(a).pieces, 12);
  const brown = a.fabrics.find((f) => f.hex === '#7d594a'), tan = a.fabrics.find((f) => f.hex === '#d9b99b');
  assert.ok(brown && tan);
  assert.equal(a.fabrics.filter((f) => f.label === '发片布').length, 2);
  assert.ok(brown.areaCm2 > tan.areaCm2);
  assert.ok(a.rows.length === 15);
});

test('检查：发片没上色是错误，肤色布上有发片色是「备料错误」，涂不满是警告', () => {
  const d = doc();
  const full = {};
  for (const p of d.pieces.filter((q) => q.material === 'hair')) full[p.id] = { coverage: 1, colors: [{ hex: '#7d594a', frac: 1 }] };
  full.face = { faceInk: 500, faceOutside: 0 };
  const ok = C.checks(d, full, { faceMm: 70 });
  assert.equal(ok.filter((c) => c.level === 'error').length, 0, JSON.stringify(ok));
  assert.ok(ok.some((c) => c.level === 'ok' && /没有备料错误/.test(c.text)));
  const empty = C.checks(d, { ...full, big: { coverage: 0, colors: [] } }, {});
  assert.ok(empty.some((c) => c.level === 'warn' && /头顶发/.test(c.text) && /底色/.test(c.text)));
  const wrong = C.checks(d, { ...full, bodyA: { hairInk: 30 } }, {});
  assert.ok(wrong.some((c) => c.level === 'error' && /备料错误/.test(c.text) && /身体·前/.test(c.text)));
  const part = C.checks(d, { ...full, big: { coverage: 0.5, colors: [{ hex: '#7d594a', frac: 1 }] } }, {});
  assert.ok(part.some((c) => c.level === 'warn' && /头顶发/.test(c.text) && /50%/.test(c.text)));
  const multi = C.checks(d, { ...full, big: { coverage: 1, colors: [{ hex: '#111111', frac: 0.4 }, { hex: '#7d594a', frac: 0.3 }, { hex: '#e7a8a0', frac: 0.3 }] } }, {});
  assert.ok(multi.some((c) => c.level === 'warn' && /3 种颜色/.test(c.text)));
  const noFace = C.checks(d, { ...full, face: {} }, {});
  assert.ok(noFace.some((c) => /脸还空着/.test(c.text)));
  const off = C.checks(d, { ...full, face: { faceInk: 100, faceOutside: 0.8 } }, {});
  assert.ok(off.some((c) => /参考框外面/.test(c.text)));
  const twice = C.checks(C.makeDoc(P.public, { roles: { leafR: 'backL' } }), full, {});
  assert.ok(twice.some((c) => c.level === 'warn' && /同时放了/.test(c.text)));
  const none = C.checks(C.makeDoc(P.public, { roles: { dTL: 'none' } }), full, {});
  assert.ok(none.some((c) => c.level === 'warn' && /没有放到 3D/.test(c.text)));
});

test('自动拆图纸：黑线白底的图，一块一块的封闭区域变成裁片，里面包着的小框不单独算', () => {
  const w = 220, h = 140, g = new Uint8Array(w * h).fill(255);
  const box = (x0, y0, x1, y1) => { for (let x = x0; x <= x1; x++) for (const y of [y0, y0 + 1, y1, y1 - 1]) g[y * w + x] = 0; for (let y = y0; y <= y1; y++) for (const x of [x0, x0 + 1, x1, x1 - 1]) g[y * w + x] = 0; };
  box(10, 10, 90, 120);
  box(30, 30, 50, 50); // 大块里面的小框（像眼睛的参考框）
  box(120, 20, 200, 60);
  box(120, 80, 200, 130);
  for (let y = 85; y < 95; y++) g[y * w + 160] = 0; // 只是一条线头，不是一片
  const pieces = C.segmentPieces(g, w, h, { minArea: 300 });
  assert.equal(pieces.length, 3, JSON.stringify(pieces.map((p) => p.box)));
  near(pieces[0].box.w, 80, 6);
  near(pieces[0].box.h, 110, 6);
  assert.ok(pieces.every((p) => p.area > 1500));
  // 线上有小缺口也能封住
  const g2 = Uint8Array.from(g);
  for (let x = 118; x <= 123; x++) g2[20 * w + x] = 255;
  assert.equal(C.segmentPieces(g2, w, h, { minArea: 300 }).length, 3);
});

test('自动拆图纸：一个圆被一条弧线分成两块，两块都要留下（月牙的中心点落在邻居里也不能被当成小框）', () => {
  const w = 260, h = 220, g = new Uint8Array(w * h).fill(255);
  const set = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) g[(y + dy) * w + (x + dx)] = 0; };
  for (let a = 0; a < 720; a++) { const t = (a / 720) * Math.PI * 2; set(Math.round(130 + 100 * Math.cos(t)), Math.round(110 + 100 * Math.sin(t))); }
  for (let a = 0; a <= 360; a++) { const t = (a / 360) * Math.PI; set(Math.round(130 - 100 * Math.cos(t)), Math.round(110 - 60 * Math.sin(t))); } // 一条从左到右、向上凸的弧
  const pieces = C.segmentPieces(g, w, h, { minArea: 500 });
  assert.equal(pieces.length, 2, JSON.stringify(pieces.map((p) => p.box)));
});

test('图纸的轮廓平滑后面积和原来差不多（别被抹没了）', () => {
  for (const p of P.public.pieces) {
    const raw = Math.abs(S.polygonArea(p.poly)), sm = Math.abs(S.polygonArea(C.smoothPoly(p.poly)));
    near(sm / raw, 1, 0.06, p.id);
  }
});

test('身体袋子：前片后片的轮廓就是裁片，身体片自带两条腿，边上高度为 0，前片鼓向 +z、后片鼓向 -z', () => {
  const d = doc(), front = C.pillowMesh(d.byId.bodyA), back = C.pillowMesh(d.byId.bodyB);
  const zs = (m) => m.pos.filter((_, i) => i % 3 === 2), ys = (m) => m.pos.filter((_, i) => i % 3 === 1), xs = (m) => m.pos.filter((_, i) => i % 3 === 0);
  assert.ok(Math.max(...zs(front)) > 0.2 && Math.min(...zs(front)) >= -1e-9, '前片只鼓向 +z');
  assert.ok(Math.min(...zs(back)) < -0.2 && Math.max(...zs(back)) <= 1e-9, '后片只鼓向 -z');
  // 腿：最低的那一圈顶点，左右分成两堆，中间有空
  const ymin = Math.min(...ys(front)), low = [];
  for (let i = 0; i < front.pos.length; i += 3) if (front.pos[i + 1] < ymin + 0.08) low.push(front.pos[i]);
  low.sort((a, b) => a - b);
  let gap = 0;
  for (let i = 1; i < low.length; i++) gap = Math.max(gap, low[i] - low[i - 1]);
  assert.ok(gap > 0.15, `两条腿之间应该有空，最大间隔 ${gap}`);
  assert.ok(Math.min(...low) < -0.3 && Math.max(...low) > 0.3);
  // 三角形朝外：前片的法线 z > 0，后片 < 0
  const nz = (m) => { let s = 0; for (let i = 0; i < m.idx.length; i += 3) { const [a, b, c] = [m.idx[i], m.idx[i + 1], m.idx[i + 2]].map((k) => m.pos.slice(k * 3, k * 3 + 3)); s += (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); } return s; };
  assert.ok(nz(front) > 0 && nz(back) < 0, '法线朝外');
  // 宽度：1 个图纸像素 = 头半径 / 脸片半宽
  const w = Math.max(...xs(front)) - Math.min(...xs(front)), expect = d.byId.bodyA.box.w * C.unitPerPx(d.byId.bodyA);
  near(w, expect, 0.15, '身体宽度和裁片一致');
  // 左右耳、左右臂各自成对：前后片在同一个位置
  const e1 = C.pillowMesh(d.byId.sqTL), e2 = C.pillowMesh(d.byId.sqBL);
  near(Math.min(...xs(e1)), Math.min(...xs(e2)), 0.2);
  assert.equal(C.pillowMesh({ ...d.byId.face }), null, '脸不是袋子');
});

test('后脑叶子：红边正好缝在围脸那一圈的外边上，黄边在正后方，上尖下宽对应纬度', () => {
  const d = doc(), L = d.byId.leafL, R = d.byId.leafR, h = d.head;
  const alphaPsi = (v) => ({ a: (Math.acos(v[2]) * 180) / Math.PI, psi: (Math.atan2(v[1], v[0]) * 180) / Math.PI });
  for (const [leaf, sign] of [[L, -1], [R, 1]]) {
    for (const f of [0.35, 0.5, 0.65]) {
      const y = leaf.box.y + leaf.box.h * f, row = Math.round(f * 96);
      const red = alphaPsi(C.pieceDir(leaf, sign < 0 ? leaf.rows.l[row] + 0.01 : leaf.rows.r[row] - 0.01, y));
      near(red.a, 64 + h.ringDelta(red.psi), 2.5, `${leaf.id} 红边 f=${f}`);
      const yellow = C.pieceDir(leaf, sign < 0 ? leaf.rows.r[row] - 0.01 : leaf.rows.l[row] + 0.01, y);
      near(Math.abs(Math.atan2(yellow[0], yellow[2]) * 180 / Math.PI), 180, 1.5, `${leaf.id} 黄边在正后方`);
    }
  }
  assert.ok(h.thetaTop > 5 && h.thetaTop < 40 && h.thetaBottom > 140 && h.thetaBottom < 176, `${h.thetaTop} ${h.thetaBottom}`);
  assert.ok(h.neck > 10 && h.neck < 30, `脖子洞半径 ${h.neck}`);
  // 围脸的圈：头顶发比下巴厚度的中心值大致是各自图纸的厚度 / 每度多少像素
  near(h.ringDelta(90), (d.byId.big.edges.bot[48] - d.byId.big.edges.top[48]) / d.byId.big.pxPerDeg, 0.6);
  near(h.ringDelta(270), (d.byId.top.edges.bot[48] - d.byId.top.edges.top[48]) / d.byId.top.pxPerDeg, 0.6);
  assert.equal(h.ringDelta(200), 0, '耳朵那一段没有圈');
});

test('手臂袋子：直边朝身体、贴在身体肩膀的侧边；前后两片对齐；左边那列 D 片在画面右边', () => {
  const d = doc();
  const rangeX = (m) => { const xs = m.pos.filter((_, i) => i % 3 === 0); return [Math.min(...xs), Math.max(...xs)]; };
  const body = rangeX(C.pillowMesh(d.byId.bodyA, d));
  const half = (body[1] - body[0]) / 2;
  const left = rangeX(C.pillowMesh(d.byId.dTL, d)), leftBack = rangeX(C.pillowMesh(d.byId.dBL, d));
  const right = rangeX(C.pillowMesh(d.byId.dTR, d)), rightBack = rangeX(C.pillowMesh(d.byId.dBR, d));
  assert.ok(left[0] > 0 && right[1] < 0, '左边那列 D 片在画面右边，右边那列在画面左边');
  near(left[0], leftBack[0], 0.05, '前后两片对齐（内沿）'); near(left[1], leftBack[1], 0.1);
  near(right[1], rightBack[1], 0.05); near(right[0], rightBack[0], 0.1);
  assert.ok(left[0] < half && left[0] > half * 0.55, `手臂内沿贴在身体侧边：${left[0]} vs ${half}`);
  near(left[0], -right[1], 0.1, '左右对称');
  // 后片三角形朝外（-z），前片朝 +z
  const nz = (mm) => { let s = 0; for (let i = 0; i < mm.idx.length; i += 3) { const [a, b, c] = [mm.idx[i], mm.idx[i + 1], mm.idx[i + 2]].map((k) => mm.pos.slice(k * 3, k * 3 + 3)); s += (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); } return s; };
  assert.ok(nz(C.pillowMesh(d.byId.dTL, d)) > 0 && nz(C.pillowMesh(d.byId.dBL, d)) < 0);
  assert.ok(nz(C.pillowMesh(d.byId.bodyA, d)) > 0 && nz(C.pillowMesh(d.byId.bodyB, d)) < 0);
});

test('画出来的发片：位图 → 一块块轮廓（图纸坐标）；太细的、太小的会被检查标出来；排到图样右边', () => {
  // 一块 40×20 的长条和一块 10×10 的小方块，画布是图纸的 2 倍分辨率
  const bm = { w: 200, h: 100, data: new Uint8Array(200 * 100) };
  const fill = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) bm.data[y * 200 + x] = 1; };
  fill(20, 20, 100, 60); fill(140, 70, 160, 90);
  const box = { x: 500, y: 100, w: 100, h: 50 };
  const polys = C.maskToPolys(bm, box, { minArea: 30 });
  assert.equal(polys.length, 2);
  const big = polys.map((p) => ({ p, a: C.areaOfPoly(p) })).sort((a, b) => b.a - a.a);
  near(big[0].a, 40 * 20, 120, '长条面积（图纸像素²，圆角会让面积略小）');
  near(C.boxOfPoly(big[0].p).x, 510, 2); near(C.boxOfPoly(big[0].p).y, 110, 2);
  assert.ok(C.polyThickness(big[0].p) > 18 && C.polyThickness(big[0].p) < 22, '长条最粗 20');
  assert.ok(C.polyThickness(big[1].p) > 8 && C.polyThickness(big[1].p) < 12);
  // 排版：一行放不下就换行；位置是把外接框左上角放到格子里
  const items = [{ id: 'a', box: { x: 10, y: 10, w: 200, h: 80 } }, { id: 'b', box: { x: 0, y: 0, w: 200, h: 60 } }, { id: 'c', box: { x: 5, y: 5, w: 100, h: 40 } }];
  const pk = C.packStrip(items, 1200, 24, 450, 18);
  assert.equal(pk.pos.a.dx + 10, 1200); assert.equal(pk.pos.a.dy + 10, 24);
  assert.ok(pk.pos.b.dx + 0 >= 1200 + 200, 'b 和 a 同一行'); assert.equal(pk.pos.b.dy + 0, 24);
  assert.ok(pk.pos.c.dy + 5 > 24 + 80, 'c 放不下，换到下一行');
  assert.ok(pk.w > 1400 && pk.h > 24 + 80);
  // 备料：画出来的发片按颜色算布（含缝份的面积）；检查：太细、太小要警告
  const d = doc(), stats = {};
  for (const p of d.pieces.filter((q) => q.material === 'hair')) stats[p.id] = { coverage: 1, colors: [{ hex: '#7d594a', frac: 1 }] };
  stats.face = { faceInk: 300, faceOutside: 0 };
  const derived = [
    { id: 'face.hair.0', label: '发1', name: '前发 1', hex: '#2a2a3a', cutAreaPx: 6000, cutBox: { w: 120, h: 70 } },
    { id: 'big.hair.1', label: '发2', name: '头顶发发片 1', hex: '#c9a35c', cutAreaPx: 3000, cutBox: { w: 80, h: 60 } },
  ];
  const bom = C.bom(d, stats, { faceMm: 100, skin: '#f1dfcd', derived });
  assert.ok(bom.fabrics.find((f) => f.hex === '#2a2a3a').areaCm2 > 5 && bom.fabrics.find((f) => f.hex === '#c9a35c'));
  assert.equal(bom.pieceCount, 17);
  assert.ok(bom.rows.filter((r) => r.derived).length === 2);
  const warn = C.checks(d, stats, { derived: [{ label: '发3', name: '细条', thicknessMm: 2.5, areaMm2: 500 }, { label: '发4', name: '小点', thicknessMm: 6, areaMm2: 20 }, { label: '发5', name: '正常', thicknessMm: 9, areaMm2: 400 }] });
  assert.ok(warn.some((x) => x.level === 'warn' && /发3/.test(x.text) && /太细/.test(x.text)));
  assert.ok(warn.some((x) => x.level === 'warn' && /发4/.test(x.text) && /太小/.test(x.text)));
  assert.ok(!warn.some((x) => /发5/.test(x.text)));
});

test('三块发片画板：前发是比脸盖大一圈的圆盘，后发是后脑展开的长方形，上面是自由画布；位置互不重叠，都在图纸右边', () => {
  const d = doc(), m = C.makeBoards(d), [front, back, top] = m.boards;
  assert.equal(m.boards.map((b) => b.board).join(), 'front,back,top');
  for (const b of m.boards) { assert.equal(b.role, 'board'); assert.ok(b.box.x >= d.w + 20, `${b.id} 在图纸右边`); assert.equal(C.layerRule(b, 'hair').ok, true); assert.equal(C.layerRule(b, 'face').ok, false); assert.equal(C.layerRule(b, 'skin').ok, false); }
  const hit = (a, b) => !(a.box.x + a.box.w <= b.box.x || b.box.x + b.box.w <= a.box.x || a.box.y + a.box.h <= b.box.y || b.box.y + b.box.h <= a.box.y);
  assert.ok(!hit(front, back) && !hit(front, top) && !hit(back, top));
  assert.ok(m.strip.y >= back.box.y + back.box.h && m.strip.x === back.box.x, '发片裁片排在后发画板下面');
  assert.ok(m.w > d.w + 900 && m.h > 600);
  const f = d.byId.face, fc = C.capOf(f), bc = C.capOf(front);
  near(C.pieceDir(front, bc.cx, bc.cy)[2], 1, 1e-9);
  for (const [dx, dy] of [[60, -40], [-100, 30], [20, 120]]) {
    const a = C.pieceDir(f, fc.cx + dx, fc.cy + dy), b = C.pieceDir(front, bc.cx + dx, bc.cy + dy);
    near(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), 0, 0.01, `前发画板和脸盖对齐 ${dx},${dy}`);
  }
  near((Math.acos(C.pieceDir(front, bc.cx + bc.rx, bc.cy)[2]) * 180) / Math.PI, C.BOARD_CAP, 1e-6);
  const bb = back.box, mid = C.pieceDir(back, bb.x + bb.w / 2, bb.y + bb.h / 2);
  assert.ok(mid[2] < -0.95, '正中是正后方');
  assert.ok(C.pieceDir(back, bb.x + bb.w * 0.2, bb.y + bb.h / 2)[0] < -0.3 && C.pieceDir(back, bb.x + bb.w * 0.8, bb.y + bb.h / 2)[0] > 0.3);
  assert.ok(C.pieceDir(back, bb.x + bb.w / 2, bb.y + 2)[1] > C.pieceDir(back, bb.x + bb.w / 2, bb.y + bb.h - 2)[1]);
  assert.equal(C.pieceDir(top, top.box.x + 10, top.box.y + 10), null, '上面发片不贴在球面上');
  const z = C.buildZone(d, back, 'hair', 12);
  assert.equal(C.zoneAt(z, bb.x + 3, bb.y + 3), true); assert.equal(C.zoneAt(z, bb.x - 20, bb.y), false);
  const mi = C.mirrorOf({ byId: { [back.id]: back } }, back.id, bb.x + 100, bb.y + 50);
  assert.equal(mi.pieceId, back.id); near(mi.x, 2 * (bb.x + bb.w / 2) - (bb.x + 100), 1e-9);
});
