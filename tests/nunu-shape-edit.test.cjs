/* 「改体型」模式：拖方框非等比拉伸 + 打钩才生效。
 * 针对的反馈是：以前只能「＋放大 / −缩小」整体等比变，而且贴到画布边就整笔作废改不动了；
 * 现在要能单独拉宽、单独拉高，并且拖出来的样子要先预览、打钩才算数。 */
const test = require('node:test');
const assert = require('node:assert');
const { mountApp: rawMount } = require('./nunu-design-harness.cjs');
// ★ requestDraw 走 requestAnimationFrame，默认环境里那一帧永远轮不到；
//   这里换成同步执行，测出来的就是「每拖一下都真的重画了、也真的发了预览」。
const mountApp = () => rawMount({ requestAnimationFrame: (cb) => { cb(); return 1; } });

// ★ 顺序要紧：dlayer 会触发聚焦某一片改变视图，所以 overview 必须放在它后面，
//    这样画布换算才是确定的整块 400×500，测试里拖的坐标才有意义。
const enter = (f, layer = 'body') => { f.click('dlayer', layer); f.click('daction', 'overview'); f.click('dtool', 'outline'); };
const cur = (f) => f.calls.change.objects.find(o => o.layer === (arguments[0] || 'body'));
const box = (f, C, poly) => C.boxOfPoly(poly);
/** 某片的包围盒，取 handshake 里最新的那份数据 */
const boxOf = (f, C, id) => C.boxOfPoly(f.calls.change.objects.find(o => o.id === id).poly);
const confirmVisible = (f) => !f.reg.get('#designConfirm').hidden;

test('拖左右边的手柄只改宽度，高度一动不动', () => {
  const f = mountApp(), C = f.c.NunuCore;
  enter(f);
  const before = boxOf(f, C, 'body');
  // 右边中点手柄往右拖 40
  f.dragFrom([before.x + before.w, before.y + before.h / 2], [before.x + before.w + 40, before.y + before.h / 2]);
  const after = boxOf(f, C, 'body');
  assert.ok(Math.abs(after.w - (before.w + 40)) < 1.5, `宽度应该跟着变宽：${before.w.toFixed(1)} -> ${after.w.toFixed(1)}`);
  assert.ok(Math.abs(after.h - before.h) < 0.01, `高度必须纹丝不动：${before.h.toFixed(2)} -> ${after.h.toFixed(2)}`);
});

test('拖上下边的手柄只改高度，宽度一动不动', () => {
  const f = mountApp(), C = f.c.NunuCore;
  enter(f);
  const before = boxOf(f, C, 'body');
  // 下边中点手柄往下拖 50
  f.dragFrom([before.x + before.w / 2, before.y + before.h], [before.x + before.w / 2, before.y + before.h + 50]);
  const after = boxOf(f, C, 'body');
  assert.ok(Math.abs(after.h - (before.h + 50)) < 1.5, `高度应该跟着变高：${before.h.toFixed(1)} -> ${after.h.toFixed(1)}`);
  assert.ok(Math.abs(after.w - before.w) < 0.01, `宽度必须纹丝不动：${before.w.toFixed(2)} -> ${after.w.toFixed(2)}`);
});

test('拖角可以同时改宽和高 —— 不再是「只能整体放大缩小」', () => {
  const f = mountApp(), C = f.c.NunuCore;
  enter(f);
  const before = boxOf(f, C, 'body');
  f.dragFrom([before.x + before.w, before.y + before.h], [before.x + before.w + 30, before.y + before.h + 60]);
  const after = boxOf(f, C, 'body');
  assert.ok(after.w > before.w + 20 && after.h > before.h + 45, `宽高都应变大：${before.w.toFixed(0)}x${before.h.toFixed(0)} -> ${after.w.toFixed(0)}x${after.h.toFixed(0)}`);
  // 而且不是等比：拉动的比值和拖动的位移一致
  assert.ok(Math.abs((after.w - before.w) / (after.h - before.h) - 30 / 60) < 0.08, '宽高按比例各自增长，不是被等比锁住');
});

test('拖完之后是预览：确认条冒出来，还没打钩就不写进纸样', () => {
  const f = mountApp(), C = f.c.NunuCore;
  enter(f);
  assert.equal(confirmVisible(f), false, '一开始没有待确认的东西');
  const before = boxOf(f, C, 'body');
  const seenDuringDrag = [];
  const dragTo = [f.at([before.x + before.w + 30, before.y + before.h / 2])];
  // 拖动过程就得看得见效果：画布实时变，3D 那边也收到实时预览（ sonst 只有画布在动）
  f.cv.onpointerdown(f.at([before.x + before.w, before.y + before.h / 2]));
  f.cv.onpointermove(dragTo[0]);
  assert.ok(f.calls.live > 0, '拖动时向外部发了实时预览（3D 跟着变）');
  seenDuringDrag.push(boxOf(f, C, 'body').w);
  f.cv.onpointerup();              // 松手会调 requestChange，所以 calls.change 这时才跟上
  assert.equal(confirmVisible(f), true, '松手后出现「✓ 就这样 / ✕ 放弃」');
  assert.ok(boxOf(f, C, 'body').w > before.w + 20, `预览的形状确实变宽了：${before.w.toFixed(1)} -> ${boxOf(f, C, 'body').w.toFixed(1)}`);
  const tplPending = f.c.NunuDesign.template(f.c.NunuPattern.cookie, f.calls.change);
  assert.ok(tplPending.pieces.every(p => p.poly.every(q => Number.isFinite(q[0]) && Number.isFinite(q[1]))), '预览期间纸样几何仍然合法');
});

test('✕ 放弃：形状、笔迹、贴图全部退回改之前', () => {
  const f = mountApp(), C = f.c.NunuCore;
  enter(f);
  const obj = () => f.calls.change.objects.find(o => o.id === 'body');
  const before = JSON.parse(JSON.stringify(obj()));
  const b = boxOf(f, C, 'body');
  f.dragFrom([b.x + b.w, b.y + b.h / 2], [b.x + b.w + 60, b.y + b.h / 2 + 40]);
  assert.notDeepEqual(obj().poly, before.poly, '拖完确实变了');
  f.click('daction', 'shapeCancel');
  const after = obj();
  after.poly.forEach((p, i) => p.forEach((v, j) => assert.ok(Math.abs(v - before.poly[i][j]) < 1e-9, '顶点坐标完全还原')));
  assert.equal(after.poly.length, before.poly.length);
  assert.equal(confirmVisible(f), false, '放弃之后确认条收起来');
});

test('✓ 打钩：改动落定，并且撤销一步就能回到原样', () => {
  const f = mountApp(), C = f.c.NunuCore;
  enter(f);
  const obj = () => f.calls.change.objects.find(o => o.id === 'body');
  const before = JSON.parse(JSON.stringify(obj().poly));
  const b = boxOf(f, C, 'body');
  f.dragFrom([b.x + b.w, b.y + b.h / 2], [b.x + b.w + 50, b.y + b.h / 2]);
  f.click('daction', 'shapeOk');
  assert.notDeepEqual(obj().poly, before, '打钩之后形状真的改了');
  assert.equal(confirmVisible(f), false, '打钩之后确认条收起来');
  f.click('daction', 'undo');
  const undone = obj().poly;
  undone.forEach((p, i) => p.forEach((v, j) => assert.ok(Math.abs(v - before[i][j]) < 1e-9, '撤销一步回到没改之前')));
});

test('笔迹跟着形状一起变形，不会留在原来的位置', () => {
  const f = mountApp(), C = f.c.NunuCore;
  enter(f);
  const obj = () => f.calls.change.objects.find(o => o.id === 'body');
  const b0 = C.boxOfPoly(obj().poly);
  // 先在身体上画一笔
  f.click('dtool', 'paint');
  f.click('daction', 'overview');
  // ★ 包围盒的角落在圆的形状外，落笔要取中间的位置才画得上
  f.drawShape([[b0.x + b0.w / 2 - 20, b0.y + b0.h / 2], [b0.x + b0.w / 2 + 20, b0.y + b0.h / 2 + 5]]);
  assert.ok(obj().front.length >= 1, '笔画上了');
  const strokeBefore = JSON.parse(JSON.stringify(obj().front[0].points));
  f.click('dtool', 'outline');
  const b = C.boxOfPoly(obj().poly);
  f.dragFrom([b.x + b.w, b.y + b.h], [b.x + b.w + 60, b.y + b.h + 40]);
  f.click('daction', 'shapeOk');
  const st = obj().front[0];
  assert.ok(Math.abs(st.points[0][0] - strokeBefore[0][0]) > 1 || Math.abs(st.points[0][1] - strokeBefore[0][1]) > 1, '笔迹跟着动了');
  assert.ok(st.width >= 1, '笔宽跟着缩放且没退化');
});

test('拖到画布外面不是「整笔作废」，而是贴着边停住（画布往四周各扩了 160，发片能摆到头外面）', () => {
  const f = mountApp(), C = f.c.NunuCore;
  enter(f);
  const obj = () => f.calls.change.objects.find(o => o.id === 'body');
  const before = obj().poly.slice();
  const b = boxOf(f, C, 'body');
  // 往右下狠拖，远超画布
  f.dragFrom([b.x + b.w, b.y + b.h], [b.x + b.w + 900, b.y + b.h + 900]);
  const after = boxOf(f, C, 'body');
  assert.notDeepEqual(obj().poly, before, '不再像以前那样一碰到边界就整笔拒绝');
  assert.ok(after.x >= -160.01 && after.y >= -160.01, '不会跑出左上角（扩出去的范围）');
  assert.ok(after.x + after.w <= 560.01, `贴住右边界：右边缘 ${(after.x + after.w).toFixed(2)}`);
  assert.ok(after.y + after.h <= 660.01, `贴住下边界：下边缘 ${(after.y + after.h).toFixed(2)}`);
  const ok = obj().poly.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  assert.ok(ok, '坐标全都是有限值');
});

test('脑袋同理：面部层也能拖手柄改大小，并且正反两片一起变', () => {
  const f = mountApp(), C = f.c.NunuCore;
  enter(f, 'face');
  const obj = () => f.calls.change.objects.find(o => o.id === 'face');
  const before = boxOf(f, C, 'face');
  assert.ok(before.w > 100, '进来的脸片是有宽度的');
  // 拖上边中点：只把脸拉长，宽度不变
  f.dragFrom([before.x + before.w / 2, before.y], [before.x + before.w / 2, before.y - 30]);
  const after = boxOf(f, C, 'face');
  assert.ok(after.h > before.h + 20, `脸能单独拉长：${before.h.toFixed(1)} -> ${after.h.toFixed(1)}`);
  assert.ok(Math.abs(after.w - before.w) < 0.01, '宽度不动');
  f.click('daction', 'shapeOk');
  // 脸只有一片数据，出纸样时正反共用 —— 两边都对得上才说明不是单边改坏了
  const tpl = f.c.NunuDesign.template(f.c.NunuPattern.cookie, f.calls.change);
  const facePieces = tpl.pieces.filter(p => String(p.design && p.design.objectId) === 'face');
  assert.ok(facePieces.length >= 2, '脸出正反两片');
  const b1 = C.boxOfPoly(facePieces[0].poly), b2 = C.boxOfPoly(facePieces[1].poly);
  assert.ok(Math.abs(b1.w - b2.w) < 1e-6 && Math.abs(b1.h - b2.h) < 1e-6, '正反两片尺寸一致（镜像同步）');
});

test('换工具或者换图层会把待确认的改动自动落定，不会白改', () => {
  const f = mountApp(), C = f.c.NunuCore;
  enter(f);
  const obj = () => f.calls.change.objects.find(o => o.id === 'body');
  const before = JSON.parse(JSON.stringify(obj().poly));
  const b = boxOf(f, C, 'body');
  f.dragFrom([b.x + b.w, b.y + b.h / 2], [b.x + b.w + 40, b.y + b.h / 2]);
  assert.equal(confirmVisible(f), true);
  f.click('dtool', 'paint');                     // 不打钩，直接切走
  assert.notDeepEqual(obj().poly, before, '切走的时候改动被采纳了');
  assert.equal(confirmVisible(f), false);
});

test('「＋放大 / −缩小」按钮仍然能连点，到边界也不再卡死', () => {
  const f = mountApp(), C = f.c.NunuCore;
  enter(f);
  const obj = () => f.calls.change.objects.find(o => o.id === 'body');
  const before = boxOf(f, C, 'body');
  let changed = 0;
  for (let i = 0; i < 6; i++) {
    const w = boxOf(f, C, 'body').w;
    f.click('daction', 'grow');
    if (Math.abs(boxOf(f, C, 'body').w - w) > 0.01) changed++;
  }
  assert.ok(changed >= 3, `连点放大应该次次有反应（实际有效 ${changed}/6 次）`);
  const grown = boxOf(f, C, 'body');
  assert.ok(grown.w > before.w, '确实变大了');
  assert.ok(grown.x >= -0.01 && grown.x + grown.w <= 400.01, '放大过程中没有跑出画布');
});
