/* 颜色图纸解析器的验收：合成一张「白底黑线 + 红线 + 紫省道」的图纸，
 * 看能不能自动读出「红线对红线、省道对省道」，并且两边长度对得上。
 * 跑法：NODE_PATH=<node workspace>/node_modules node tests/nunu-colorimport.test.cjs */
const fs = require('fs'), vm = require('node:vm'), path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const SRC = path.join(__dirname, '../public/games/nunu-studio');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(SRC, 'nunu-colorimport.js'), 'utf8'), ctx);
const CI = ctx.NunuColorImport;

const mkImg = (w, h) => {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = 255;
  return { data, width: w, height: h };
};
const px = (img, x, y, rgb, thick = 1) => {
  const { width: w, data } = img;
  for (let dy = -thick + 1; dy < thick; dy++) for (let dx = -thick + 1; dx < thick; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= img.width || ny >= img.height) continue;
    const i = (ny * w + nx) * 4;
    data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2];
  }
};
const line = (img, x0, y0, x1, y1, rgb, thick = 2) => {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let k = 0; k <= n; k++) px(img, Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), rgb, thick);
};

test('色彩标记识别：红线是红线，紫线是省道，黑线白纸都认不出来', () => {
  const img = mkImg(120, 60);
  line(img, 10, 10, 60, 10, [224, 74, 74], 2);      // 红线
  line(img, 10, 30, 60, 30, [164, 91, 216], 2);     // 省道紫
  line(img, 10, 50, 60, 50, [0, 0, 0], 2);          // 黑线：不该被认成标记
  const marks = CI.scan(img, 120, 60);
  assert.equal(marks.length, 2, '应该只认出红、紫两段');
  const keys = marks.map(m => m.key).sort().join(',');
  assert.equal(keys, 'dart,red');
  const red = marks.find(m => m.key === 'red');
  assert.ok(Math.abs(red.len - 50) <= 3, `红线长度应约 50，实际 ${red.len}`);
});

test('倾斜 + 偏色的 Marks 也能认：手绘扫描不会是标准色', () => {
  const img = mkImg(200, 80);
  line(img, 20, 70, 180, 10, [206, 61, 66], 3);   // 偏暗一点的红
  const marks = CI.scan(img, 200, 80);
  assert.equal(marks.length, 1, '偏色红线要还认得出来');
  assert.equal(marks[0].key, 'red');
  const dx = Math.abs(marks[0].pts[0][0] - marks[0].pts[1][0]);
  assert.ok(dx > 140, `端点应横跨整条斜线，实际 ${dx}`);
});

test('端到端：两片矩形的贴合边标红、顶边标紫省道 → 自动配出两对缝合', () => {
  const W = 400, H = 320, img = mkImg(W, H);
  // 两片闭合矩形（黑线轮廓），中间留一段距离，代表图纸上的两片裁片
  const A = [[40, 60], [160, 60], [160, 240], [40, 240]];
  const B = [[200, 60], [320, 60], [320, 240], [200, 240]];
  const black = [0, 0, 0];
  for (const poly of [A, B]) for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    line(img, a[0], a[1], b[0], b[1], black, 2);
  }
  line(img, 160, 60, 160, 240, [224, 74, 74], 3);   // A 的右边 · 红
  line(img, 200, 60, 200, 240, [224, 74, 74], 3);   // B 的左边 · 红
  line(img, 40, 60, 100, 60, [164, 91, 216], 3);    // A 顶边一半 · 省道
  line(img, 200, 60, 260, 60, [164, 91, 216], 3);   // B 顶边一半 · 省道

  const pieces = [
    { id: 'p1', name: '裁片 1', poly: A },
    { id: 'p2', name: '裁片 2', poly: B },
  ];
  const marks = CI.scan(img, W, H);
  assert.equal(marks.length, 4, `应认出 4 段彩线，实际 ${marks.length}`);
  const assigned = CI.assignToEdges(pieces, marks, 14);
  assert.ok(assigned.every(a => a.piece), '每段彩线都要归到某条边上');
  const { seams, leftovers } = CI.pairSeams(assigned, 0.06);
  assert.equal(leftovers.length, 0, '不该有落单的边');
  assert.equal(seams.length, 2, `应配出 2 对缝合，实际 ${seams.length}`);
  for (const s of seams) {
    assert.notEqual(s.a.piece, s.b.piece, '同一片自己的两条边不能互相缝');
    assert.ok(s.ok, `${s.label} 两边长度应对得上（差 ${(s.diff * 100).toFixed(1)}%）`);
    assert.ok(s.diff < 0.01, `长度应当几乎相等，实际差 ${(s.diff * 100).toFixed(2)}%`);
  }
  const keys = seams.map(s => s.key).sort().join(',');
  assert.equal(keys, 'dart,red', '红线配红线、省道配省道');
});

test('长度对不上时会标出来：一边大一边的配不成', () => {
  const img = mkImg(300, 200);
  line(img, 20, 20, 20, 160, [224, 74, 74], 3);    // 长 140
  line(img, 120, 20, 120, 60, [224, 74, 74], 3);   // 长 40，明显不等
  const pieces = [
    { id: 'p1', name: '片1', poly: [[20, 20], [40, 20], [40, 160], [20, 160]] },
    { id: 'p2', name: '片2', poly: [[120, 20], [140, 20], [140, 60], [120, 60]] },
  ];
  const { seams, leftovers } = CI.pairSeams(CI.assignToEdges(pieces, CI.scan(img, 300, 200), 14), 0.06);
  assert.equal(seams.length, 1);
  assert.equal(seams[0].ok, false, '差太多应该判成不合格');
  assert.ok(seams[0].diff > 0.5, `差异应该很明显，实际 ${seams[0].diff}`);
  assert.equal(leftovers.length, 0);
});

test('同一片自己的两条红线不会被配成一对', () => {
  const img = mkImg(300, 200);
  line(img, 20, 20, 20, 160, [224, 74, 74], 3);
  line(img, 80, 20, 80, 160, [224, 74, 74], 3);
  const pieces = [{ id: 'only', name: '独一片', poly: [[20, 20], [80, 20], [80, 160], [20, 160]] }];
  const { seams, leftovers } = CI.pairSeams(CI.assignToEdges(pieces, CI.scan(img, 300, 200), 14), 0.06);
  assert.equal(seams.length, 0, '只有一片时不该配出缝');
  assert.equal(leftovers.length, 2, '两条线都该进落单列表');
});

test('没有颜色时退一步：按边长相近也能自动配', () => {
  const pieces = [
    { id: 'a', name: '前', poly: [[0, 0], [100, 0], [100, 200], [0, 200]] },
    { id: 'b', name: '后', poly: [[200, 0], [300, 0], [300, 200], [200, 200]] },
  ];
  const { seams } = CI.pairByLength(pieces, 0.06);
  assert.ok(seams.length >= 1, '应该至少配上一对');
  for (const s of seams) {
    assert.notEqual(s.a.piece, s.b.piece);
    assert.ok(s.diff <= 0.06);
  }
});

test('writeSeamEdges 写出来的格式和 nunu-design.js 一致（label + pts + color）', () => {
  const pieces = [{ id: 'a', name: '前', poly: [[0, 0], [10, 0], [10, 10], [0, 10]] }];
  const seams = [{
    id: 'R1', key: 'red', label: '红线', hex: '#e04a4a',
    a: { piece: 'a', pieceName: '前', edge: 0, len: 10, pts: [[0, 0], [10, 0]] }, b: { piece: 'zz', pieceName: '别片', edge: 0, len: 10, pts: [[0, 0], [10, 0]] },
    diff: 0, ok: true,
  }];
  CI.writeSeamEdges(pieces, seams);
  assert.equal(pieces[0].seamEdges.length, 1);
  assert.equal(pieces[0].seamEdges[0].color, '#e04a4a');
  assert.ok(pieces[0].seamEdges[0].label.startsWith('红线'));
  assert.deepEqual(pieces[0].seamEdges[0].pts, [[0, 0], [10, 0]]);
});

/* ---------- 沿轮廓取「一段」+ 单色图纸推断（v60–61） ---------- */
const circle = (cx, cy, r, n = 96) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);
const paintArc = (img, cx, cy, r, t0, t1, rgb) => { for (let t = t0; t <= t1; t += 0.4) px(img, Math.round(cx + r * Math.cos(t * Math.PI / 180)), Math.round(cy + r * Math.sin(t * Math.PI / 180)), rgb, 3); };

test('彩线沿着轮廓走一段：圆的大半圈也能量出弧长，两片同色的配成一条缝', () => {
  const img = mkImg(500, 260), RED = [224, 74, 74];
  paintArc(img, 120, 130, 90, 30, 330, RED);          // 留 60° 的黑线缺口
  paintArc(img, 340, 130, 90, 30, 330, RED);
  const pieces = [{ id: 'a', name: 'A', poly: circle(120, 130, 87) }, { id: 'b', name: 'B', poly: circle(340, 130, 87) }];
  const marks = CI.scan(img, 500, 260);
  assert.equal(marks.length, 2);
  const assigned = CI.assignToChains(pieces, marks, { tol: 18 });
  assert.ok(assigned.every(m => m.piece), '两段都贴在了某一片的轮廓上');
  const want = 2 * Math.PI * 87 * 300 / 360;
  for (const m of assigned) assert.ok(Math.abs(m.edgeLen - want) / want < 0.04, `弧长 ${m.edgeLen.toFixed(1)} ≈ ${want.toFixed(1)}`);
  const { seams } = CI.pairSeams(assigned, 0.06);
  assert.equal(seams.length, 1);
  assert.ok(seams[0].ok, '两边一样长');
});

test('整圈彩线（没有缺口）当作闭合的一圈，弧长 = 整个周长', () => {
  const img = mkImg(300, 260), BLUE = [63, 127, 206];
  paintArc(img, 120, 130, 90, 0, 360, BLUE);
  const [m] = CI.assignToChains([{ id: 'a', name: 'A', poly: circle(120, 130, 87) }], CI.scan(img, 300, 260));
  assert.ok(m.closed);
  assert.ok(Math.abs(m.edgeLen - 2 * Math.PI * 87) / (2 * Math.PI * 87) < 0.03);
});

test('省道：轮廓上凹进去的 V 口涂紫色，劈成两条腿配成一条缝（两条腿在同一片上）', () => {
  const img = mkImg(300, 260), PUR = [164, 91, 216];
  const poly = [[40, 40], [120, 40], [140, 100], [160, 40], [240, 40], [240, 200], [40, 200]];   // 顶边中间一个 V 口，尖在 (140,100)
  for (const [a, b] of [[[120, 40], [140, 100]], [[140, 100], [160, 40]]])
    for (let t = 0; t <= 1; t += 0.01) px(img, Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), PUR, 3);
  const marks = CI.scan(img, 300, 260);
  const split = CI.splitDarts(CI.assignToChains([{ id: 'p', name: 'P', poly }], marks, { tol: 18 }));
  assert.equal(split.length, 2, 'V 在尖上劈成两条腿');
  const { seams } = CI.pairSeams(split, 0.06);
  assert.equal(seams.length, 1);
  assert.equal(seams[0].a.piece, seams[0].b.piece, '两条腿在同一片上');
  assert.ok(seams[0].ok, '两条腿一样长');
});

test('单色图纸：上下叠着的一模一样的两片 = 前后片，周边配成一条缝；左右镜像的一对不猜', () => {
  const body = (x, y) => [[x, y], [x + 100, y], [x + 100, y + 150], [x, y + 150]];
  const pieces = [
    { id: 'f', name: '前', poly: body(400, 100) }, { id: 'b', name: '后', poly: body(400, 300) },
    { id: 'l', name: '左叶', poly: body(100, 100) }, { id: 'r', name: '右叶', poly: body(880, 100) },
  ];
  const res = CI.inferSeamsMono(pieces, 1080);
  const auto = res.seams.filter(s => s.key === 'auto');
  assert.equal(auto.length, 1, '只配出前后片这一对');
  assert.ok(auto[0].guess, '带「猜的」标记');
  assert.equal(JSON.stringify([auto[0].a.piece, auto[0].b.piece].sort()), '["b","f"]');
  assert.ok(res.notes.some(t => /左右对称/.test(t)), '左右镜像的一对只提示、不猜缝哪几条边');
});

test('单色图纸：轮廓上又尖又窄的 V 形凹口认作省道，圆角 / 平滑的不算', () => {
  const notched = [[40, 40], [120, 40], [140, 100], [160, 40], [240, 40], [240, 200], [40, 200]];
  assert.equal(CI.findNotches(notched).length, 1);
  assert.equal(CI.findNotches(circle(100, 100, 80)).length, 0, '圆没有凹口');
  assert.equal(CI.findNotches([[0, 0], [100, 0], [100, 100], [0, 100]]).length, 0, '方块没有凹口');
});
