/* 新三件的契约测试：
 *   🖐 抓手 —— 拖动画布挪视图，任何对象都不许动；
 *   笔型 —— 圆笔/方笔写进笔迹，画出来各是各的；
 *   📌 固定 —— 锁住后改体型/放大缩小/删除/拖动全被拒，画画照常。 */
const test = require('node:test');
const assert = require('node:assert');
const { mountApp: rawMount } = require('./nunu-design-harness.cjs');
const mountApp = () => rawMount({ requestAnimationFrame: (cb) => { cb(); return 1; } });

const boxOf = (f, C, id) => C.boxOfPoly(f.calls.change.objects.find(o => o.id === id).poly);

test('抓手拖动画布：对象坐标纹丝不动，也不冒出待确认条', () => {
  const f = mountApp(), C = f.c.NunuCore;
  f.click('dlayer', 'body'); f.click('daction', 'overview'); f.click('dtool', 'hand');
  const before = boxOf(f, C, 'body');
  const beforeChange = f.calls.change;
  f.dragFrom([200, 250], [260, 300]);          // 在画布中间随便拖一把
  const after = boxOf(f, C, 'body');
  assert.deepEqual(after, before, '抓手只挪视图，不许动对象');
  assert.equal(f.calls.change, beforeChange, '抓手不该产生任何数据变更');
  assert.equal(f.reg.get('#designConfirm').hidden, true, '抓手不会触发待确认');
});

test('笔型写进笔迹：方笔是 square，圆笔是 round', () => {
  const f = mountApp(), C = f.c.NunuCore;
  f.click('dlayer', 'body'); f.click('daction', 'overview');
  const b = boxOf(f, C, 'body');
  const mid = [b.x + b.w / 2, b.y + b.h / 2];
  f.click('dbrush', 'square');
  f.drawShape([[mid[0] - 20, mid[1]], [mid[0] + 20, mid[1]]]);
  f.click('dbrush', 'round');
  f.drawShape([[mid[0] - 20, mid[1] + 14], [mid[0] + 20, mid[1] + 14]]);
  const o = f.calls.change.objects.find(x => x.id === 'body');
  assert.equal(o.front.length, 4, '对称开着，画两笔变四条（每条都有自己的镜像）');
  assert.equal(o.front[0].brush, 'square', '第一笔是方笔');
  assert.equal(o.front[1].brush, 'square', '它的镜像也是方笔');
  assert.equal(o.front[2].brush, 'round', '第二笔是圆笔');
  assert.equal(o.front[3].brush, 'round', '它的镜像也是圆笔');
});

test('固定之后：放大缩小、删除、上下层全被拒，解开后恢复', () => {
  const f = mountApp(), C = f.c.NunuCore;
  // 用衣服层新叠一片来做删除测试（身体和脸本来就有「不能删」的老规矩，测不出锁的作用）
  f.click('dlayer', 'clothes');
  f.click('daction', 'overview');
  f.click('daction', 'addPart');
  f.drawShape([[150, 330], [250, 330], [250, 420], [150, 420], [150, 330]]);
  const piece = () => f.calls.change.objects.find(o => o.layer === 'clothes');
  assert.ok(piece(), '叠出一片衣服');
  const id = piece().id;
  const lockBtn = () => f.groups['[data-daction]'].find(b => b.dataset.daction === 'lock');
  f.click('daction', 'lock');
  assert.equal(lockBtn().textContent, '🔓 解开固定', '固定后按钮变成「解开」（锁是内存开关，不走存档快照）');
  const before = C.boxOfPoly(piece().poly);
  f.click('daction', 'grow');
  assert.deepEqual(C.boxOfPoly(piece().poly), before, '固定后放大被拒绝，尺寸不变');
  f.click('daction', 'remove');
  assert.ok(piece(), '固定后删除被拒绝，片还在');
  f.click('daction', 'down');
  assert.equal(f.calls.change.objects.findIndex(o => o.id === id), f.calls.change.objects.length - 1, '固定后层级没动（新片本来就在最上）');
  // 解锁后恢复
  f.click('daction', 'lock');
  f.click('daction', 'grow');
  assert.ok(C.boxOfPoly(piece().poly).w > before.w + 5, '解开后放大恢复生效');
  f.click('daction', 'remove');
  assert.ok(!f.calls.change.objects.some(o => o.id === id), '解开后可以删掉');
});

test('固定之后：拖把手进不了改体型，画画却照常', () => {
  const f = mountApp(), C = f.c.NunuCore;
  f.click('dlayer', 'body');
  f.click('daction', 'lock');
  f.click('daction', 'overview'); f.click('dtool', 'outline');
  const before = boxOf(f, C, 'body');
  f.dragFrom([before.x + before.w, before.y + before.h / 2], [before.x + before.w + 40, before.y + before.h / 2]);
  const after = boxOf(f, C, 'body');
  assert.deepEqual(after, before, '固定后拖把手不改形状');
  assert.equal(f.reg.get('#designConfirm').hidden, true, '固定后不出待确认条');
  // 画画照常
  f.click('dtool', 'paint');
  const mid = [before.x + before.w / 2, before.y + before.h / 2];
  f.drawShape([[mid[0] - 15, mid[1]], [mid[0] + 15, mid[1]]]);
  const o = f.calls.change.objects.find(x => x.id === 'body');
  assert.ok(o.front.length >= 1, '固定的片照样能往上画');
});
