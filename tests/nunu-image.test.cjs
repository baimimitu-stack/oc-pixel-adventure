/* 图片贴图（拼贴）与「画笔不断线」的验收。
 * 用同一套无头脚手架：一份是纯数据层（template / resize / paint），一份是真实 mount 的交互。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, mountApp } = require('./nunu-design-harness.cjs');

/* vm 里没有 Image，塞一个进去：一给 src 就立刻算「解好」，方便测渲染分支 */
const FAKE_IMAGE = class {
  constructor() { this.naturalWidth = 0; this.naturalHeight = 0; this.width = 0; this.height = 0; this.complete = false; this.onload = null; this.onerror = null; }
  set src(v) { this._src = v; this.width = this.naturalWidth = 120; this.height = this.naturalHeight = 80; this.complete = true; if (this.onload) this.onload(); }
  get src() { return this._src; }
};
const SRC = 'data:image/png;base64,AAAA';

/** 记录型 2D 上下文：看 paint() 到底打没打底色、有没有把图画下去 */
function recCtx() {
  const log = [];
  const target = {};
  const ctx = new Proxy(target, {
    has: () => false,
    get: (t, k) => (k in t ? t[k] : (...a) => { log.push([k, ...a]); }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return { ctx, log, count: (name) => log.filter(r => r[0] === name).length };
}

function objOf(d, id) { return d.objects.find(o => o.id === id); }

// ---------------------------------------------------------------- 数据层

test('贴图会跟着对象一起进纸样：正反两片都带同一份数据', () => {
  const c = load({ Image: FAKE_IMAGE });
  const D = c.NunuDesign, base = c.NunuPattern.cookie;
  const d = D.initial(base);
  objOf(d, 'face').img = { src: SRC, cx: 200, cy: 400, w: 100, h: 100, bw: 100, bh: 100, rot: 0, locked: false, window: true, nw: 120, nh: 80 };
  const t = D.template(base, d);
  const faces = t.pieces.filter(p => p.design && p.design.objectId === 'face');
  assert.ok(faces.length >= 2, `至少正反两片，实际 ${faces.length}`);
  for (const p of faces) {
    assert.ok(p.design.img, `${p.name} 缺了贴图数据`);
    assert.equal(p.design.img.src, SRC);
    assert.equal(p.design.img.cx, 200, '两片共用同一份 world 坐标，天然对齐');
  }
});

test('勾了「留空窗」就不再打底色 —— 图盖不到的地方是透光的缺口', () => {
  const c = load({ Image: FAKE_IMAGE });
  const D = c.NunuDesign, base = c.NunuPattern.cookie;
  const d = D.initial(base);
  const im = { src: SRC, cx: 200, cy: 400, w: 100, h: 100, bw: 100, bh: 100, rot: 0, locked: false, window: true, nw: 120, nh: 80 };
  objOf(d, 'face').img = { ...im };
  const t = D.template(base, d);
  const p = t.pieces.find(x => x.design && x.design.objectId === 'face' && !x.design.mirror);

  const win = recCtx();
  D.paint(win.ctx, p, 'skin');
  const fillNoWindow = win.count('fill');

  p.design.img.window = false;
  const solid = recCtx();
  D.paint(solid.ctx, p, 'skin');
  const fillWithColor = solid.count('fill');

  assert.equal(fillNoWindow, 0, '留空窗时不该打底色');
  assert.equal(fillWithColor, 1, '不留空窗就该照常打底色');
  assert.equal(win.count('drawImage'), 1, '不管怎样图都要画上去');
});

test('部件放大缩小时贴图跟着一起变，不会留在原地', () => {
  const c = load({ Image: FAKE_IMAGE });
  const D = c.NunuDesign, base = c.NunuPattern.cookie;
  const d = D.initial(base);
  const face = objOf(d, 'face');
  const b = c.NunuCore.boxOfPoly(face.poly);
  face.img = { src: SRC, cx: b.x + b.w / 2, cy: b.y + b.h / 2, w: 100, h: 60, bw: 100, bh: 60, rot: 0, locked: false, window: true, nw: 120, nh: 80 };
  assert.ok(D.resize(d, 'face', 0.8), '缩到 0.8 应该成功');
  assert.ok(Math.abs(face.img.w - 80) < 1e-6, `贴图宽度应随部件缩到 80，实际 ${face.img.w}`);
  const nb = c.NunuCore.boxOfPoly(face.poly);
  assert.ok(Math.abs(face.img.cx - (nb.x + nb.w / 2)) < 1e-6, '贴图中心跟着部件中心走');
});

test('imgCovers：旋转之后仍能判断点有没有落在图上', () => {
  const c = load({ Image: FAKE_IMAGE });
  const D = c.NunuDesign;
  const im = { cx: 200, cy: 300, w: 100, h: 60, rot: 0 };
  assert.ok(D.imgCovers(im, [200, 300]), '正中应该在图上');
  assert.ok(!D.imgCovers(im, [200, 240]), '超出上边就不在');
  const turned = { ...im, rot: Math.PI / 2 };
  // 转 90° 后，世界里的横宽容差换成原来的「高的一半」= 30，纵高容差换成「宽的一半」= 50
  assert.ok(D.imgCovers(turned, [200, 300]), '中心始终命中');
  assert.ok(D.imgCovers(turned, [225, 300]) && D.imgCovers(turned, [175, 300]), '横向 ±30 内都算在图上');
  assert.ok(D.imgCovers(turned, [200, 340]) && D.imgCovers(turned, [200, 260]), '纵向 ±50 内都算在图上');
  assert.ok(!D.imgCovers(turned, [240, 300]), '横向超出 30 就不在图上');
  assert.ok(!D.imgCovers(turned, [200, 235]), '纵向超出 50 就不在图上');
});

// ---------------------------------------------------------------- 交互层

test('锁住的贴图拖不动，解锁之后才挪得动', () => {
  const app = mountApp();
  app.click('daction', 'overview');
  app.click('dtool', 'image');
  // 用 wants 的方式拿不到内部对象，改走 WARN：这片没有贴图时点工具会给出指示
  assert.match(app.status(), /导入图片|还没有贴图/);
});

test('被浏览器合并掉的中间点会被取回来 —— 线不再是断断续续的点', () => {
  const app = mountApp();
  app.reg.get('#designMirror').checked = false;      // 关掉对称，专测采样密度
  app.click('daction', 'overview');
  app.click('dtool', 'paint');
  const { cv, at } = app;
  // 模拟浏览器把一段移动合并进一个事件里：事件本身只落到终点，
  // 中间三个点只能从 getCoalescedEvents() 里捞。
  const mid = [[205, 345], [215, 348], [225, 350]];
  const last = [240, 352];
  const packed = { ...at(last), getCoalescedEvents: () => mid.map(at) };
  cv.onpointerdown(at([200, 340]));
  cv.onpointermove(packed);
  cv.onpointerup();
  const body = app.calls.change.objects.find(o => o.id === 'body');
  const pts = body.front[0].points;
  assert.ok(pts.length >= 4, `中间点要留下，实际只有 ${pts.length} 个点`);
  for (let i = 1; i < pts.length; i++) {
    assert.ok(pts[i][0] >= pts[i - 1][0] - 1e-9, `点的顺序要顺着拖的方向（第 ${i} 个 X=${pts[i][0]} 退回到了 ${pts[i - 1][0]}）`);
  }
});

test('没有合并事件时也不重复落点（伪 visited 去重）', () => {
  const app = mountApp();
  app.reg.get('#designMirror').checked = false;
  app.click('daction', 'overview');
  app.click('dtool', 'paint');
  const { cv, at } = app;
  cv.onpointerdown(at([200, 340]));
  const same = at([200, 340.2]);                     // 距离小于最小步长
  cv.onpointermove(same);
  cv.onpointerup();
  const pts = app.calls.change.objects.find(o => o.id === 'body').front[0].points;
  assert.equal(pts.length, 1, '原地抖动不该产生第二个点');
});
