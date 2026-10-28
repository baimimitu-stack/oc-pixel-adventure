const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
// 游戏页面里的脚本是浏览器脚本，不是模块：放进一个干净的上下文里跑，再从全局上取出来
function load(name, global) {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/games/nunu-studio/' + name), 'utf8'), ctx);
  return ctx[global];
}
const plain = (x) => JSON.parse(JSON.stringify(x));
const S = load('nunu-shape.js', 'NunuShape');

const bm = (w, h, inside) => {
  const b = S.emptyBitmap(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.data[y * w + x] = inside(x + 0.5, y + 0.5) ? 1 : 0;
  return b;
};
const disc = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (±${tol})`);

test('往外扩和往里缩：圆半径多/少 r', () => {
  const c = bm(140, 140, disc(70, 70, 40));
  near(S.areaOf(c), Math.PI * 1600, 80);
  near(S.areaOf(S.dilate(c, 6)), Math.PI * 46 * 46, 120);
  near(S.areaOf(S.erode(c, 10)), Math.PI * 30 * 30, 120);
  assert.equal(S.areaOf(S.erode(c, 0)), S.areaOf(c));
  assert.equal(S.areaOf(S.erode(c, 100)), 0);
});

test('追轮廓：方块一圈外轮廓（面积为正），带洞的圈外轮廓和洞方向相反', () => {
  const rect = bm(20, 12, (x, y) => x > 3 && x < 13 && y > 3 && y < 9);
  const loops = S.traceContours(rect);
  assert.equal(loops.length, 1);
  assert.equal(Math.abs(S.polygonArea(loops[0])), 60);
  const ring = bm(40, 40, (x, y) => x > 4 && x < 34 && y > 4 && y < 34 && !(x > 14 && x < 24 && y > 14 && y < 24));
  const rl = S.traceContours(ring).map(S.polygonArea).sort((a, b) => a - b);
  assert.equal(rl.length, 2);
  assert.ok(rl[0] < 0 && rl[1] > 0, '洞是负、外轮廓是正');
  assert.equal(S.outerContours(ring).length, 1, '只留外轮廓');
});

test('干净轮廓：圆的轮廓面积和圆一样（3% 内），碎块被去掉', () => {
  const R = 50;
  const c = bm(130, 130, (x, y) => disc(65, 65, R)(x, y) || disc(8, 8, 1.2)(x, y));
  const loops = S.outerContours(c, { minArea: 12 });
  assert.equal(loops.length, 1);
  near(Math.abs(S.polygonArea(loops[0])), Math.PI * R * R, Math.PI * R * R * 0.03);
  assert.ok(loops[0].length < 700);
});

test('多边形外放：正方形往外放 d，每边多 d；凹形也稳', () => {
  const sq = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const out = S.offsetPolygon(sq, 5, 4);
  const box = S.loopBox(out);
  near(box.w, 110, 1.5);
  near(box.h, 110, 1.5);
  near(box.x, -5, 1);
  // L 形：外放后面积增加 ≈ 周长 × d + π d²
  const L = [[0, 0], [60, 0], [60, 30], [30, 30], [30, 80], [0, 80]];
  const grown = S.offsetPolygon(L, 4, 4);
  const a0 = Math.abs(S.polygonArea(L)), a1 = Math.abs(S.polygonArea(grown));
  const per = 60 + 30 + 30 + 50 + 30 + 80;
  near(a1 - a0, per * 4 + Math.PI * 16 - 4 * 16 * 0.5, 0.06 * (a1 - a0), '外放面积增加');
  assert.deepEqual(plain(S.offsetPolygon([[0, 0], [1, 0]], 3)), [[0, 0], [1, 0]], '退化的多边形原样返回');
});

test('多边形变位图：面积和多边形的一样', () => {
  const tri = [[0, 0], [40, 0], [0, 30]];
  const { bm: m } = S.rasterizePolygon(tri, 4, 2);
  near(S.areaOf(m) / 16, 600, 25);
});

test('凸多边形外放：圆形外放 d 半径多 d；方块每边多 d、角上有限的尖；方向反过来也一样', () => {
  const R = 50, n = 120;
  const circle = Array.from({ length: n }, (_, i) => [R * Math.cos((i * 2 * Math.PI) / n), R * Math.sin((i * 2 * Math.PI) / n)]);
  for (const poly of [circle, circle.slice().reverse()]) {
    const out = S.offsetConvex(poly, 5);
    near(Math.abs(S.polygonArea(out)) / (Math.PI * 55 * 55), 1, 0.01);
    for (const [x, y] of out) near(Math.hypot(x, y), 55, 0.3, '每个点离圆心 55');
  }
  const sq = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const grown = S.offsetConvex(sq, 5);
  const box = S.loopBox(grown);
  near(box.w, 110 * 1, 0.01, '方块每边多 5');
  near(box.x, -5, 0.01);
  // 很尖的三角：尖角处不会无限伸出去
  const spike = [[0, 0], [100, 0], [100, 4]];
  const g = S.offsetConvex(spike, 5, 2.2);
  const far = Math.max(...g.map(([x, y]) => Math.hypot(x - 100, y)));
  assert.ok(far <= 100 + 5 * 2.2 + 1e-6 + 5, '尖角被限制');
  assert.deepEqual(plain(S.offsetConvex(sq, 0)), plain(sq));
  assert.deepEqual(plain(S.offsetConvex([[0, 0], [1, 1]], 3)), [[0, 0], [1, 1]]);
});
