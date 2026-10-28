const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ctx = { console };
vm.createContext(ctx);
for (const f of ['nunu-shape.js', 'pattern-data.js', 'nunu-core.js', 'nunu-body.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/games/nunu-studio/' + f), 'utf8'), ctx);
const C = ctx.NunuCore, B = ctx.NunuBody;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (±${tol})`);
const make = (over) => { const t = B.generate(over); return { t, d: C.makeDoc(t) }; };
const ranges = (m) => { const r = { x: [Infinity, -Infinity], y: [Infinity, -Infinity], z: [Infinity, -Infinity] }; for (let i = 0; i < m.pos.length; i += 3) for (const [j, k] of [[0, 'x'], [1, 'y'], [2, 'z']]) { r[k][0] = Math.min(r[k][0], m.pos[i + j]); r[k][1] = Math.max(r[k][1], m.pos[i + j]); } return r; };

test('默认体子：脸片 + 后脑两半 + 四片耳朵 + 四片手臂 + 身体前后 + 四段围条，一共 17 片，用途都对得上，除围条外都有 3D 袋子', () => {
  const { t, d } = make();
  assert.equal(d.pieces.length, 17);
  assert.ok(d.flat && t.custom);
  const roles = d.pieces.map((p) => p.role).sort().join();
  assert.equal(roles, ['armLB', 'armLF', 'armRB', 'armRF', 'bodyBack', 'bodyFront', 'earLB', 'earLF', 'earRB', 'earRF', 'faceFlat', 'gussetBody', 'gussetBody', 'gussetHead', 'gussetHead', 'headBackL', 'headBackR'].sort().join());
  for (const p of d.pieces) {
    assert.ok(p.area > 300, `${p.id} 面积 ${p.area}`);
    const m = C.pillowMesh(p, d);
    if (p.role.startsWith('gusset')) { assert.equal(m, null, `${p.id} 围条本身不上 3D`); continue; }
    assert.ok(m && m.pos.length > 60 && m.idx.length > 30, `${p.id} 有 3D 网格`);
  }
  assert.ok(C.isFace(d.byId.face) && !C.isFace(d.byId.bodyF));
  assert.equal(d.byId.backL.material, 'hair'); assert.equal(d.byId.face.material, 'skin');
});

test('裁片彼此不重叠，都在版面里', () => {
  const { d } = make();
  for (const p of d.pieces) assert.ok(p.box.x >= 0 && p.box.y >= 0 && p.box.x + p.box.w <= d.w && p.box.y + p.box.h <= d.h, `${p.id} 在版面里`);
  for (let i = 0; i < d.pieces.length; i++) for (let j = i + 1; j < d.pieces.length; j++) {
    const a = d.pieces[i], b = d.pieces[j];
    const hit = b.poly.filter((q, k) => k % 2 === 0 && C.inPoly(a.poly, q[0], q[1])).length;
    assert.equal(hit, 0, `${a.id} 和 ${b.id} 重叠`);
  }
});

test('左右成对的裁片互为镜像（轴在版面中线）：后脑两半、耳朵、手臂', () => {
  const { d } = make();
  for (const p of d.pieces.filter((q) => q.partner)) {
    const q = d.byId[p.partner];
    assert.equal(q.partner, p.id);
    near(p.box.w, q.box.w, 1.5, `${p.id} 宽`); near(p.box.h, q.box.h, 1.5, `${p.id} 高`);
    near(p.box.x + p.box.w / 2 + (q.box.x + q.box.w / 2), 2 * d.axis, 1.5, `${p.id} 对称轴`);
  }
  assert.equal(C.mirrorOf(d, 'backL', 10, 10).pieceId, 'backR');
});

test('参数管用：头高、身体宽、耳朵大小、手臂方式都会改裁片', () => {
  const a = make().d, b = make({ headH: 380 }).d;
  assert.ok(b.byId.face.box.h > a.byId.face.box.h + 60);
  near(b.byId.face.box.w, a.byId.face.box.w, 2, '头宽不变（它是比例尺）');
  assert.ok(make({ bodyW: 240 }).d.byId.bodyF.box.w > a.byId.bodyF.box.w + 50);
  assert.ok(make({ earSize: 160 }).d.byId.earLF.box.h > a.byId.earLF.box.h * 1.3);
  const g = make({ arms: 'integrated' }).d;
  assert.equal(g.pieces.length, 13);
  assert.ok(!g.byId.armLF);
  assert.ok(g.byId.bodyF.box.w > a.byId.bodyF.box.w + 150, '手身一体的身体带着手臂，更宽');
  // 方头比圆头更方：同样的外接框，面积更大
  assert.ok(make({ headSquare: 4.2 }).d.byId.face.area > make({ headSquare: 2 }).d.byId.face.area * 1.05);
});

test('7 种耳朵：都能生成；猫耳尖、狐耳更高更窄、鼠耳更圆大、狗耳是垂的', () => {
  const sizes = {};
  for (const k of Object.keys(B.EAR_TYPES)) {
    const { d } = make({ ear: k });
    const e = d.byId.earLF;
    assert.ok(e.area > 500, k);
    sizes[k] = e.box;
    assert.equal(d.byId.earRF.box.w.toFixed(0), e.box.w.toFixed(0));
  }
  assert.ok(sizes.fox.h / sizes.fox.w > sizes.wolf.h / sizes.wolf.w * 1.4, '狐耳比狼耳细高');
  assert.ok(sizes.mouse.w > sizes.cat.w, '鼠耳比猫耳宽');
  assert.equal(B.earLabel('cat'), '猫耳');
  assert.equal(make({ ear: 'dog' }).d.byId.earLF.place.anchor, 'top');
  assert.equal(make({ ear: 'cat' }).d.byId.earLF.place.anchor, 'bottom');
});

test('扁平头：脸片在前（z>0），后脑两半在后（z<0），缝在一起的中线上不凹下去；耳朵立在头顶两侧', () => {
  const { d } = make();
  const face = ranges(C.pillowMesh(d.byId.face, d)), bl = C.pillowMesh(d.byId.backL, d), br = C.pillowMesh(d.byId.backR, d);
  assert.ok(face.z[0] >= -1e-9 && face.z[1] > 0.3, '脸片鼓向前面');
  const rl = ranges(bl), rr = ranges(br);
  assert.ok(rl.z[1] <= 1e-9 && rl.z[0] < -0.3 && rr.z[1] <= 1e-9 && rr.z[0] < -0.3, '后脑两半鼓向后面');
  // 后脑中线（X≈0）附近、头中部的厚度要接近最厚处（整个轮廓算高度，不是各算各的）
  const headCy = d.byId.face.place.y;
  const seam = [];
  for (const m of [bl, br]) for (let i = 0; i < m.pos.length; i += 3) if (Math.abs(m.pos[i]) < 0.06 && Math.abs(m.pos[i + 1] - headCy) < 0.3) seam.push(-m.pos[i + 2]);
  assert.ok(seam.length > 10 && Math.max(...seam) > 0.8 * (-rl.z[0]), `中线上的厚度 ${Math.max(...seam)} vs ${-rl.z[0]}`);
  // 左右两半在 X 上拼成整个头（一半 X>0，一半 X<0）
  assert.ok((rl.x[0] > -0.1 && rr.x[1] < 0.1) || (rl.x[1] < 0.1 && rr.x[0] > -0.1));
  const headW = Math.max(rl.x[1], rr.x[1]) - Math.min(rl.x[0], rr.x[0]);
  near(headW, 3.0, 0.2, '头宽 = 3 个单位（和圆头一样）');
  // 猫耳：底边贴着头顶，尖在头顶上方；左耳在 -x、右耳在 +x
  const earL = ranges(C.pillowMesh(d.byId.earLF, d)), earR = ranges(C.pillowMesh(d.byId.earRF, d));
  assert.ok(earL.x[1] < 0.2 && earR.x[0] > -0.2, '左耳在左、右耳在右');
  assert.ok(earL.y[1] > face.y[1] - 0.1, '耳朵尖在头顶附近或上方');
  assert.ok(earL.y[0] < face.y[1], '耳朵底边插在头顶里面一点点');
});

test('扁平头的发片层：前发、后发画板和头同形，3D 上是贴在头外面再凸一点点的一层；上面发片是自由画布', () => {
  const { d } = make(), m = C.makeBoards(d), [front, back, top] = m.boards;
  assert.equal(m.boards.map((b) => b.board).join(), 'front,back,top');
  assert.ok(front.flat && back.flat);
  near(front.area, d.byId.face.box.w * d.byId.face.box.h, 1e6, '前发画板有面积');
  for (const b of [front, back]) { assert.ok(b.box.x >= d.w + 20, `${b.id} 在版面右边`); assert.ok(b.shellRole); assert.equal(C.layerRule(b, 'hair').ok, true); }
  const face = ranges(C.pillowMesh(d.byId.face, d)), sh = ranges(C.pillowMesh({ ...front, role: front.shellRole }, d));
  near(sh.x[0], face.x[0], 0.03); near(sh.x[1], face.x[1], 0.03); near(sh.y[0], face.y[0], 0.03); near(sh.y[1], face.y[1], 0.03);
  near(sh.z[1] - face.z[1], 0.03, 0.02, '前发层比脸片再凸 0.03');
  const bl = ranges(C.pillowMesh(d.byId.backL, d)), bs = ranges(C.pillowMesh({ ...back, role: back.shellRole }, d));
  assert.ok(bs.z[0] < bl.z[0] + 0.001 && bs.z[0] > bl.z[0] - 0.08, '后发层比后脑再凸一点点');
  assert.equal(C.pieceDir(front, front.box.x + 10, front.box.y + 10), null, '扁平头的画板不贴球面');
  assert.equal(top.board, 'top');
});

test('手臂（分开做）：左边那一列贴在画面右边的身体侧边，前后两片对齐；手身一体的身体直接带着手臂', () => {
  const { d } = make();
  const body = ranges(C.pillowMesh(d.byId.bodyF, d)), armF = ranges(C.pillowMesh(d.byId.armLF, d)), armB = ranges(C.pillowMesh(d.byId.armLB, d)), armR = ranges(C.pillowMesh(d.byId.armRF, d));
  assert.ok(armF.x[0] > 0 && armR.x[1] < 0, '左边那一列在画面右边');
  near(armF.x[0], armB.x[0], 0.06, '前后两片内沿对齐');
  assert.ok(armF.x[0] < body.x[1] && armF.x[0] > body.x[1] * 0.4, '手臂内沿贴在身体侧边');
  const g = make({ arms: 'integrated' }).d, gb = ranges(C.pillowMesh(g.byId.bodyF, g));
  assert.ok(gb.x[1] - gb.x[0] > body.x[1] - body.x[0] + 0.8, '手身一体的身体更宽');
});


test('围条：头和身体各一条，长度正好等于轮廓周长，宽度就是厚度；缝合表里每条缝两边长度对得上', () => {
  const { t, d } = make();
  const perim = (poly) => poly.reduce((n, q, i) => n + Math.hypot(q[0] - poly[(i + 1) % poly.length][0], q[1] - poly[(i + 1) % poly.length][1]), 0);
  for (const s of t.seams) near(s.a, s.b, Math.max(s.a, s.b) * 0.005, s.name);
  assert.equal(t.seams.length, 5);
  const gh = d.pieces.filter((p) => p.role === 'gussetHead'), gb = d.pieces.filter((p) => p.role === 'gussetBody');
  assert.equal(gh.length, 2); assert.equal(gb.length, 2);
  near(gh[0].box.w + gh[1].box.w, perim(d.byId.face.poly), 2, '头围条两段合起来 = 脸片周长');
  near(gh[0].box.h, t.params.headThick, 0.5, '头围条宽 = 头的厚度');
  near(gb[0].box.w + gb[1].box.w, perim(d.byId.bodyF.poly), 2, '身体围条两段合起来 = 身体前片周长');
  near(perim(d.byId.bodyF.poly), perim(d.byId.bodyB.poly), 1e-6, '身体前后片周长一样');
  near(gb[0].box.h, t.params.bodyThick, 0.5);
  assert.ok(t.guides.notches.filter((n) => /^g/.test(n.piece)).length === 4, '每段围条中点有对位记号');
  assert.ok(Array.isArray(t.sewing) && t.sewing.length >= 4 && /围条/.test(t.sewing.join()));
  // 改厚度：围条变宽，3D 里的厚度同步变
  const thick = make({ headThick: 240 });
  near(thick.d.pieces.find((p) => p.role === 'gussetHead').box.h, 240, 0.5);
  const z = (dd, id) => { const m = C.pillowMesh(dd.byId[id], dd); let hi = 0; for (let i = 2; i < m.pos.length; i += 3) hi = Math.max(hi, Math.abs(m.pos[i])); return hi; };
  near(z(thick.d, 'face') / z(d, 'face'), 240 / 150, 0.1, '头厚度 240 / 150');
  // 厚度 = 前后两片各 thick/2，加起来 = thick（单位和头宽 3 对应）
  near(z(d, 'face') * 2, (150 * 3) / 320, 0.02, '头的厚度 = 150 个图纸像素');
});

test('有厚度的袋子：中间是平的，边上是圆边（不是饼干也不是球）；没有厚度的老袋子还是原来的样子', () => {
  const { d } = make(), m = C.pillowMesh(d.byId.face, d);
  const zs = []; for (let i = 2; i < m.pos.length; i += 3) zs.push(m.pos[i]);
  const hi = Math.max(...zs), plateau = zs.filter((z) => z > hi * 0.98).length / zs.length;
  assert.ok(plateau > 0.25, `脸片中间有一大片平的：${plateau.toFixed(2)}`);
  const edge = zs.filter((z) => z > 0.02 && z < hi * 0.5).length / zs.length;
  assert.ok(edge > 0.01 && edge < 0.2, `边上有圆边：${edge.toFixed(2)}`);
  // 老图纸的身体袋子没有厚度字段，还是椭球样子（最高点在中间、没有大片平台）
  const pub = C.makeDoc(ctx.NunuPattern.public), pm = C.pillowMesh(pub.byId.bodyA, pub);
  const pz = []; for (let i = 2; i < pm.pos.length; i += 3) pz.push(pm.pos[i]);
  const ph = Math.max(...pz);
  assert.ok(pz.filter((z) => z > ph * 0.98).length / pz.length < 0.2);
});

test('检查：缝合边长对不上要警告，对得上不警告；围条这类不上 3D 的用途不会被当成「叠在一起」', () => {
  const { t, d } = make();
  const stats = { face: { faceInk: 100, faceOutside: 0 } };
  for (const p of d.pieces.filter((q) => q.material === 'hair')) stats[p.id] = { coverage: 1, colors: [{ hex: '#7d594a', frac: 1 }] };
  const ok = C.checks(d, stats, { faceMm: 100, seams: t.seams });
  assert.ok(!ok.some((c) => /缝合长度/.test(c.text)), JSON.stringify(ok.map((c) => c.text)));
  assert.ok(!ok.some((c) => /同时放了/.test(c.text)), '两段头围条不是「叠在一起」');
  const bad = C.checks(d, stats, { faceMm: 100, seams: [{ name: '测试缝', a: 1000, b: 800 }] });
  assert.ok(bad.some((c) => c.level === 'warn' && /测试缝/.test(c.text) && /20%/.test(c.text)));
});
