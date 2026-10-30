/* 发片工艺：后发片从发际线缝出来，刘海从发际线往下贴。
 * 对应春子 2026-10-29 18:04 提的那条；工艺依据见报告「第三批」。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { mountApp, load } = require('./nunu-design-harness.cjs');

const ctx = load();
const D = ctx.NunuDesign, C = ctx.NunuCore, base = ctx.NunuPattern.cookie;
const boxOf = (poly) => {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};
/** 根中点离发际线的垂直距离：这是「缝出来了」还是「凭空浮着」的硬指标 */
const rootGap = (d, o) => {
  const hl = D.hairline(d);
  if (!hl || !o.root) return null;
  const m = [(o.root.a[0] + o.root.b[0]) / 2, (o.root.a[1] + o.root.b[1]) / 2];
  return Math.abs(m[1] - D.hairlineAt(hl, m[0])[1]);
};

test('发际线取的是面皮（脸）的上缘弧，不是整张脸', () => {
  const d = D.initial(base);
  const hl = D.hairline(d), fb = boxOf(d.objects.find(o => o.id === 'face').poly);
  assert.ok(hl && hl.pts.length > 2, '要算出一条弧');
  assert.ok(hl.cut < fb.y + fb.h * 0.5, '发际线在脸的上半部');
  for (const p of hl.pts) assert.ok(p[1] <= hl.cut + 1e-9, '弧上的点都不越过 cut');
  const xs = hl.pts.map(p => p[0]);
  for (let i = 1; i < xs.length; i++) {
    assert.ok(xs[i] >= xs[i - 1] - 1e-9, `弧要按 x 升序才连得顺（第 ${i} 个点 x=${xs[i].toFixed(2)} 退回到了 ${xs[i - 1].toFixed(2)}）`);
  }
  // 中间高、两边低：是头顶那条弧
  assert.ok(D.hairlineAt(hl, 200)[1] < D.hairlineAt(hl, 120)[1], '中间比两边高');
});

test('新建的发片就长在你画的地方，不会被拽到发际线上', () => {
  // 以前一新建就被 snapRoot 拖去贴发际线，翘出脑袋、往外长的发片全被拉回头顶堆成一坨；
  // 现在新片就落在画的地方，要不要回发际线由画的人说了算。
  const d = D.initial(base);
  const poly = [[100, 80], [300, 70], [320, 170], [90, 180]];
  const id = D.add(d, 'hair', poly, '#7d594a');
  const o = d.objects.find(x => x.id === id);
  assert.ok(o.root, '记下了根部（知道哪条边是发根）');
  assert.equal(JSON.stringify(o.poly), JSON.stringify(poly), '形状一点没动：新片长在画的地方');
  const moved = D.snapRoot(d, id);
  assert.ok(moved, '点「贴回发际线」才挪，而且挪得动');
  const gap = rootGap(d, o);
  assert.ok(gap !== null && gap < 0.01, `贴回之后根中点压在发际线上，实测偏差 ${gap}`);
});

test('根部取的是最靠上那条边，不是最靠上那个角', () => {
  // 这个四边形的右上角 y 最小，但真正的「上边」是左上角到右上角那条
  const o = { poly: [[100, 80], [300, 70], [320, 170], [90, 180]] };
  const r = D.rootOf(o);
  assert.equal(r.i, 0, '第 0 条边（100,80 → 300,70）才是最靠上的');
  assert.equal(r.mid[0], 200, '根中点落在上边正中，不是斜跨到某个角');
});

test('缝还是贴：停在头顶的是后发片（缝），盖住额头往下的是刘海（贴）', () => {
  const d = D.initial(base);
  const idBack = D.add(d, 'hair', [[120, 60], [280, 60], [300, 140], [260, 200], [140, 200], [100, 140]], '#7d594a');
  const idBang = D.add(d, 'hair', [[130, 270], [270, 270], [280, 330], [200, 355], [120, 330]], '#7d594a');
  const back = d.objects.find(x => x.id === idBack), bang = d.objects.find(x => x.id === idBang);
  assert.equal(back.attach, 'sewn', '头顶那一圈是后发片 → 缝');
  assert.equal(bang.attach, 'glued', '盖住额头往下的是刘海 → 贴');
});

test('挪过去会跑出画布就不挪，宁可留在原地也不把发片弄丢', () => {
  const d = D.initial(base);
  // 贴着画布顶、还占满整张高的一片：往上吸到发际线，尾巴就掉到画布外面去了
  const idTop = D.add(d, 'hair', [[80, 1], [320, 1], [320, 499], [80, 499]], '#7d594a');
  const o = d.objects.find(x => x.id === idTop);
  const before = JSON.stringify(o.poly);
  assert.equal(D.snapRoot(d, o.id), null, '越界的吸附要被拒绝');
  assert.equal(JSON.stringify(o.poly), before, '被拒绝时形状一点没动');
});

test('挪动、缩放之后根部跟着更新，不会留在旧位置', () => {
  const d = D.initial(base);
  const idR = D.add(d, 'hair', [[120, 60], [280, 60], [300, 140], [260, 200], [140, 200], [100, 140]], '#7d594a');
  const o = d.objects.find(x => x.id === idR);
  const before = JSON.stringify(o.root);
  D.resize(d, o.id, 1.15);
  assert.notEqual(JSON.stringify(o.root), before, '放大之后根部要重算');
  const gap = rootGap(d, o);
  assert.ok(gap !== null, '重算后仍有根部');
});

test('纸样上带根部标记，缝和贴标号不同', () => {
  const d = D.initial(base);
  D.add(d, 'hair', [[120, 60], [280, 60], [300, 140], [260, 200], [140, 200], [100, 140]], '#7d594a');   // 缝
  D.add(d, 'hair', [[130, 270], [270, 270], [280, 330], [200, 355], [120, 330]], '#7d594a');             // 贴
  const t = D.template(base, d);
  const hp = t.pieces.filter(p => p.design && p.design.layer === 'hair');
  assert.equal(hp.length, 2, '两片发片，每片只裁 1 片');
  const labels = new Set(hp.map(p => (p.seamEdges && p.seamEdges[0] ? p.seamEdges[0].label : null)));
  assert.ok(labels.has('发根缝'), '后发片标「发根缝」');
  assert.ok(labels.has('发根贴'), '刘海标「发根贴」');
  for (const p of hp) {
    const e = p.seamEdges && p.seamEdges[0];
    assert.ok(e && e.pts.length === 2, '根部就是一条边，两个端点');
  }
});

test('安装说明按工艺分开：一个说缝、一个说贴', () => {
  const d = D.initial(base);
  D.add(d, 'hair', [[120, 60], [280, 60], [300, 140], [260, 200], [140, 200], [100, 140]], '#7d594a');
  D.add(d, 'hair', [[130, 270], [270, 270], [280, 330], [200, 355], [120, 330]], '#7d594a');
  const t = D.template(base, d);
  const texts = t.attachments.map(a => a.instruction || '').filter(Boolean);
  const sewn = texts.find(s => s.includes('发根缝'));
  const glued = texts.find(s => s.includes('刘海'));
  assert.ok(sewn && /加固缝/.test(sewn), '后发片要说沿发际线加固缝');
  assert.ok(glued && /涂布料胶/.test(glued) && /从发际线往下/.test(glued), '刘海要说涂胶、从发际线往下贴');
});

test('界面：选中发片才出现工艺切换，切到「缝」会把根部吸回发际线', () => {
  const app = mountApp();
  app.click('daction', 'overview');
  app.click('dlayer', 'hair');
  app.click('daction', 'newHair');
  app.drawShape([[130, 270], [270, 270], [280, 330], [200, 355], [120, 330]]);   // 画出来是刘海（贴）
  const hair = () => app.calls.change.objects.filter(o => o.layer === 'hair')[0];
  assert.equal(hair().attach, 'glued', '默认判成刘海');
  assert.equal(app.reg.get('#designHairRow').hidden, false, '选中发片时工艺行要显示出来');
  app.click('dattach', 'sewn');
  assert.equal(hair().attach, 'sewn', '切成缝了');
  const snap = app.calls.change;
  assert.ok(snap && snap.objects, 'change 要带上完整数据');
  const hl = D.hairline(snap);
  const m = [(hair().root.a[0] + hair().root.b[0]) / 2, (hair().root.a[1] + hair().root.b[1]) / 2];
  assert.ok(Math.abs(m[1] - D.hairlineAt(hl, m[0])[1]) < 0.01, '切成缝的瞬间根部就贴回发际线了');
});

test('界面：非发片按「贴回发际线」会被挡住', () => {
  const app = mountApp();
  app.click('daction', 'overview');
  app.click('dlayer', 'clothes');
  app.click('daction', 'newClothes');
  app.drawShape([[120, 300], [280, 300], [285, 380], [115, 380]]);
  const before = JSON.stringify(app.calls.change.objects.filter(o => o.layer === 'clothes'));
  app.click('daction', 'snapRoot');
  assert.equal(JSON.stringify(app.calls.change.objects.filter(o => o.layer === 'clothes')), before, '衣服不该被挪');
  assert.match(app.reg.get('#designStatus').textContent, /发际线/, '要给出说明');
});
