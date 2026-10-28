/* 努努赛博定制台 · 轮廓几何（纯算法，不碰画布和页面）
 * 把一张黑白位图（1 = 里面）变成：往外扩 / 往里缩 / 追出一圈圈轮廓 / 简化 / 抹平。
 * 发片的「裁片轮廓」和「缝份线」都从这里来。位图用 {w,h,data:Uint8Array}，点坐标是像素。 */
(function (root) {
'use strict';

const emptyBitmap = (w, h) => ({ w, h, data: new Uint8Array(w * h) });
const INF = 1e12;

function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** 每个像素到最近的「target 为 1 的像素」的距离（像素）。图外面当作没有 target */
function distanceTo(target, w, h) {
  const g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = target[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = g[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) g[y * w + x] = d[x];
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = g[i] >= INF / 2 ? Infinity : Math.sqrt(g[i]);
  return out;
}

/** 往外扩 r 像素 */
function dilate(bm, r) {
  if (r <= 0) return { w: bm.w, h: bm.h, data: bm.data.slice() };
  const dist = distanceTo(bm.data, bm.w, bm.h);
  const out = emptyBitmap(bm.w, bm.h);
  for (let i = 0; i < bm.w * bm.h; i++) out.data[i] = bm.data[i] === 1 || dist[i] <= r ? 1 : 0;
  return out;
}

/** 往里缩 r 像素（图边以外算外面） */
function erode(bm, r) {
  if (r <= 0) return { w: bm.w, h: bm.h, data: bm.data.slice() };
  const pw = bm.w + 2, ph = bm.h + 2;
  const outside = new Uint8Array(pw * ph);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const inside = x > 0 && y > 0 && x <= bm.w && y <= bm.h && bm.data[(y - 1) * bm.w + (x - 1)] === 1;
    outside[y * pw + x] = inside ? 0 : 1;
  }
  const dist = distanceTo(outside, pw, ph);
  const out = emptyBitmap(bm.w, bm.h);
  for (let y = 0; y < bm.h; y++) for (let x = 0; x < bm.w; x++) {
    out.data[y * bm.w + x] = bm.data[y * bm.w + x] === 1 && dist[(y + 1) * pw + (x + 1)] > r ? 1 : 0;
  }
  return out;
}

const areaOf = (bm) => bm.data.reduce((n, v) => n + v, 0);

/** 追出所有边界。点是像素的角，图在轮廓的右手边；每个连通块一圈外轮廓，里面的洞反方向一圈 */
function traceContours(bm) {
  const { w, h, data } = bm;
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] === 1;
  const edges = [];
  const starts = new Map();
  const key = (x, y) => y * (w + 1) + x;
  const add = (x0, y0, x1, y1) => {
    const i = edges.length;
    edges.push({ x0, y0, x1, y1, used: false });
    const k = key(x0, y0);
    const list = starts.get(k);
    if (list) list.push(i); else starts.set(k, [i]);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!data[y * w + x]) continue;
    if (!at(x, y - 1)) add(x, y, x + 1, y);
    if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!at(x - 1, y)) add(x, y + 1, x, y);
  }
  const cross = (dx, dy, e) => dx * (e.y1 - e.y0) - dy * (e.x1 - e.x0);
  const loops = [];
  for (let s = 0; s < edges.length; s++) {
    if (edges[s].used) continue;
    const loop = [];
    let e = s;
    for (;;) {
      const cur = edges[e];
      cur.used = true;
      loop.push([cur.x0, cur.y0]);
      const cand = (starts.get(key(cur.x1, cur.y1)) || []).filter((i) => !edges[i].used);
      if (!cand.length) break;
      if (cand.length === 1) { e = cand[0]; continue; }
      const dx = cur.x1 - cur.x0, dy = cur.y1 - cur.y0;
      cand.sort((a, b) => cross(dx, dy, edges[b]) - cross(dx, dy, edges[a]));
      e = cand[0];
    }
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
}

function polygonArea(loop) {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x0, y0] = loop[i], [x1, y1] = loop[(i + 1) % loop.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function dp(pts, eps) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1e-9;
  let idx = -1, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / len;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  return [...dp(pts.slice(0, idx + 1), eps).slice(0, -1), ...dp(pts.slice(idx), eps)];
}

function simplifyLoop(loop, eps) {
  if (loop.length < 8) return loop;
  let far = 0, best = -1;
  for (let i = 1; i < loop.length; i++) {
    const d = (loop[i][0] - loop[0][0]) ** 2 + (loop[i][1] - loop[0][1]) ** 2;
    if (d > best) { best = d; far = i; }
  }
  const a = dp(loop.slice(0, far + 1), eps);
  const b = dp([...loop.slice(far), loop[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

function smoothLoop(loop, iterations = 2) {
  let pts = loop;
  for (let it = 0; it < iterations; it++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    pts = out;
  }
  return pts;
}

/** 位图 → 干净的轮廓（去掉太小的碎块、简化、抹平）。只留外轮廓（面积为负的是洞，丢掉） */
function outerContours(bm, opts = {}) {
  const minArea = opts.minArea == null ? 6 : opts.minArea;
  const out = [];
  for (const l of traceContours(bm)) {
    const a = polygonArea(l);
    if (a <= 0 || a < minArea) continue; // 外轮廓面积为正，洞为负
    out.push(smoothLoop(simplifyLoop(l, opts.eps == null ? 0.8 : opts.eps), opts.smooth == null ? 2 : opts.smooth));
  }
  return out;
}

function loopBox(loop) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of loop) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** 多边形（任意形状，点序随意）→ 位图：scale 像素/单位，pad 四周留白（像素）；返回位图和偏移，用来做缝份外扩 */
function rasterizePolygon(poly, scale, pad) {
  const b = loopBox(poly);
  const w = Math.ceil(b.w * scale) + pad * 2 + 2, h = Math.ceil(b.h * scale) + pad * 2 + 2;
  const bm = emptyBitmap(w, h);
  const px = (p) => [(p[0] - b.x) * scale + pad + 1, (p[1] - b.y) * scale + pad + 1];
  const pts = poly.map(px);
  for (let y = 0; y < h; y++) {
    const cy = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= cy && y1 > cy) || (y1 <= cy && y0 > cy)) xs.push(x0 + ((cy - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, c) => a - c);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(w, Math.round(xs[k + 1])); x++) bm.data[y * w + x] = 1;
    }
  }
  return { bm, toWorld: ([x, y]) => [(x - pad - 1) / scale + b.x, (y - pad - 1) / scale + b.y] };
}

/** 一个多边形往外放 d（单位同多边形）：做缝份线。用位图外扩再追轮廓，凹的地方也稳 */
function offsetPolygon(poly, d, scale = 4) {
  const { bm, toWorld } = rasterizePolygon(poly, scale, Math.ceil(d * scale) + 2);
  const grown = dilate(bm, d * scale);
  const loops = outerContours(grown, { minArea: 20, eps: 0.9, smooth: 2 });
  if (!loops.length) return poly.slice();
  loops.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
  return loops[0].map(toWorld);
}

/** 凸多边形往外放 d：每个点沿两条边外法线的角平分线挪（尖角处最多放 miterLimit×d，免得尖头窜出去）。裁片都是凸的，用它比位图快得多 */
function offsetConvex(poly, d, miterLimit = 2.2) {
  const n = poly.length;
  if (n < 3 || d === 0) return poly.slice();
  let area = 0;
  for (let i = 0; i < n; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % n]; area += x0 * y1 - x1 * y0; }
  const sign = area > 0 ? 1 : -1;
  const normal = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    return sign > 0 ? [dy / len, -dx / len] : [-dy / len, dx / len];
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n], p = poly[i], next = poly[(i + 1) % n];
    const n1 = normal(prev, p), n2 = normal(p, next);
    const k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    let mx = (n1[0] + n2[0]) / Math.max(k, 1e-6), my = (n1[1] + n2[1]) / Math.max(k, 1e-6);
    const m = Math.hypot(mx, my);
    if (m > miterLimit) { mx *= miterLimit / m; my *= miterLimit / m; }
    out.push([p[0] + mx * d, p[1] + my * d]);
  }
  return out;
}

const api = { emptyBitmap, distanceTo, dilate, erode, areaOf, traceContours, polygonArea, simplifyLoop, smoothLoop, outerContours, loopBox, rasterizePolygon, offsetPolygon, offsetConvex };
root.NunuShape = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
