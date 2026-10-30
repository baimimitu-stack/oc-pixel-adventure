/* 发片不用一气呵成 —— 分几段慢慢描 / 透明底 PNG 直接抠 / 一片压一片有厚度。
 * 对应春子 2026-10-29 21:45 提的那条。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { mountApp, load } = require('./nunu-design-harness.cjs');

const ctx = load();
const D = ctx.NunuDesign, base = ctx.NunuPattern.cookie;

/** 造一块 RGBA 像素：fn(x,y) 返回 [r,g,b,a] */
const rgba = (w, h, fn) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, v = fn(x, y);
    d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = v[3];
  }
  return d;
};
const hairCount = (app) => ((app.calls.change && app.calls.change.objects) || []).filter(o => o.layer === 'hair').length;

test('透明底 PNG：一坨颜色一片，两坨就是两片', () => {
  // 两块互不相连的发色，其余全透明 —— 一张图里能一次铺两片
  const px = rgba(40, 40, (x, y) => {
    const a = x >= 5 && x < 16 && y >= 5 && y < 16, b = x >= 24 && x < 36 && y >= 5 && y < 20;
    return (a || b) ? [90, 60, 45, 255] : [0, 0, 0, 0];
  });
  const res = D.hairPiecesFromImage(px, 40, 40, {});
  assert.equal(res.mode, 'alpha', '认出是透明底');
  assert.equal(res.pieces.length, 2, '两块颜色抠成两片');
  for (const p of res.pieces) {
    assert.ok(p.poly.length >= 3, '每片都得是个能缝的轮廓');
    assert.ok(p.box.w > 4 && p.box.h > 4, '轮廓不能缩成一个点');
  }
  // 大的那片排在前面
  assert.ok(res.pieces[0].box.w * res.pieces[0].box.h >= res.pieces[1].box.w * res.pieces[1].box.h, '按大小排好序');
});

test('不是透明底也能救：按白底抠，抠不动就照实说', () => {
  const white = rgba(40, 40, (x, y) => (x >= 8 && x < 30 && y >= 8 && y < 30) ? [90, 60, 45, 255] : [255, 255, 255, 255]);
  const r1 = D.hairPiecesFromImage(white, 40, 40, {});
  assert.equal(r1.mode, 'white', '整张都不透明时改按白底抠');
  assert.equal(r1.pieces.length, 1, '白底上那块发色抠成一片');

  const solid = rgba(20, 20, () => [10, 10, 10, 255]);       // 没透明也没白底
  const r2 = D.hairPiecesFromImage(solid, 20, 20, {});
  assert.equal(r2.mode, 'opaque', '实在抠不出来就如实说是整张');
  assert.equal(r2.pieces.length, 1, '整张当成一片，不装作抠出了形状');
});

test('慢慢描：分几段画，画够了一点「✓ 合上」才成一片', () => {
  const app = mountApp();
  app.reg.get('#designMirror').checked = false;      // 关掉对称，专测分段的形状
  app.click('daction', 'overview');
  app.click('daction', 'newHair');
  app.drawShape([[110, 110], [200, 95], [300, 120]]);          // 第一段：一条弧，首尾没碰上
  assert.equal(hairCount(app), 0, '第一段松手还不成片');
  app.drawShape([[300, 120], [310, 200], [210, 235]]);         // 第二段接着画
  assert.equal(hairCount(app), 0, '两段也没自己合成片 —— 等画的人发话');
  assert.match(app.status(), /第 2 段/, '要告诉画的人已经记了几段');
  app.click('daction', 'draftOk');
  const hs = (app.calls.change.objects || []).filter(o => o.layer === 'hair');
  assert.equal(hs.length, 1, '点「✓ 合上成一片」就成了一片');
  const xs = hs[0].poly.map(p => p[0]), ys = hs[0].poly.map(p => p[1]);
  assert.ok(Math.min(...xs) < 120 && Math.max(...xs) > 290, '合上后的片覆盖两段的范围，不是只留最后那段');
  assert.ok(Math.min(...ys) < 115 && Math.max(...ys) > 215, '纵向也一样');
});

test('撤一段 / 全部重画：画歪了可以退回来，不用从头开', () => {
  const app = mountApp();
  app.reg.get('#designMirror').checked = false;
  app.click('daction', 'overview');
  app.click('daction', 'newHair');
  app.drawShape([[110, 110], [200, 95], [300, 120]]);
  app.drawShape([[300, 120], [310, 200], [210, 235]]);
  app.click('daction', 'draftUndo');
  assert.match(app.status(), /还剩 1 段/, '撤掉了最后一段');
  app.click('daction', 'draftOk');
  assert.equal(hairCount(app), 1, '只剩一段也能合上成片');

  app.click('daction', 'newHair');
  app.drawShape([[120, 300], [260, 295], [255, 360]]);
  app.click('daction', 'draftClear');
  assert.match(app.status(), /草稿清掉/, '全部重画要说一声');
  assert.equal(hairCount(app), 1, '清草稿不会动已经画好的片');
});

test('画成圈的话松手就成片，不用再多点一次', () => {
  const app = mountApp();
  app.reg.get('#designMirror').checked = false;
  app.click('daction', 'overview');
  app.click('daction', 'newHair');
  app.drawShape([[100, 80], [300, 70], [320, 170], [90, 180]]);   // 首尾差得远，但明显绕了一圈
  assert.equal(hairCount(app), 1, '绕成一圈的，松手就成片');
});

test('新发片就长在画的地方，不会被拽成一坨圆脑袋', () => {
  // 翘出脑袋往右上长的发片：以前会被 snapRoot 拖回发际线贴住头顶
  const d = D.initial(base);
  const poly = [[300, 20], [395, 15], [390, 90], [305, 95]];
  const id = D.add(d, 'hair', poly, '#7d594a');
  const o = d.objects.find(x => x.id === id);
  assert.equal(JSON.stringify(o.poly), JSON.stringify(poly), '一点没挪：就长在画的地方');
});

test('发片一片压一片：3D 上层层错开，不是粘成一坨', () => {
  const d = D.initial(base);
  const mk = (x0, y0, w, h) => [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]];
  D.add(d, 'hair', mk(90, 60, 220, 60), '#7d594a');
  D.add(d, 'hair', mk(100, 80, 200, 70), '#7d594a');
  D.add(d, 'hair', mk(110, 100, 180, 80), '#aabbcc');
  const t = D.template(base, d);
  const front = t.pieces.filter(p => p.design && p.design.layer === 'hair' && !p.design.mirror);
  assert.equal(front.length, 3, '三片正片');
  const zOf = (p) => { let s = 0, n = 0; for (let i = 2; i < p.mesh.pos.length; i += 3) { s += p.mesh.pos[i]; n++; } return s / n; };
  const zs = front.map(zOf);
  assert.ok(zs[1] - zs[0] > 0.012, `第二片要压在第一片上面（实测错开 ${(zs[1] - zs[0]).toFixed(3)}）`);
  assert.ok(zs[2] - zs[1] > 0.012, `第三片再往上压一层（实测错开 ${(zs[2] - zs[1]).toFixed(3)}）`);
});
