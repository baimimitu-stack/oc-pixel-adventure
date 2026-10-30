/* 颜色图纸 → 自动配对缝合
 * 规则（和你在纸上标的完全一致）：
 *   1. 白底黑线画轮廓，一张图里每一片都要是封闭的；
 *   2. 要缝在一起的两条边，用同一种颜色描粗线 —— 红线对红线、绿线对绿线；
 *   3. 省道（捏起来缝的那个 V 口）用紫色；
 *   4. 算法按「同色 + 边长相近」自动配对，并逐对检查两边长度是否一致。
 * 这里只做「认线」和「配对」，不碰画布，不碰存档。 */
(function (root) {
  'use strict';

  /** 和纸样一致的色标表；颜色沿用 nunu-design.js 里画缝线的那几个色值 */
  const MARK_COLORS = [
    { key: 'red', label: '红线', hex: '#e04a4a', rgb: [224, 74, 74] },
    { key: 'dart', label: '省道', hex: '#a45bd8', rgb: [164, 91, 216] },
    { key: 'green', label: '绿线', hex: '#35a85a', rgb: [53, 168, 90] },
    { key: 'blue', label: '蓝线', hex: '#3f7fce', rgb: [63, 127, 206] },
    { key: 'orange', label: '橙线', hex: '#bf7c31', rgb: [191, 124, 49] },
    { key: 'pink', label: '粉线', hex: '#e06aa0', rgb: [224, 106, 160] },
    { key: 'cyan', label: '青线', hex: '#2fb6bd', rgb: [47, 182, 189] },
    { key: 'yellow', label: '黄线', hex: '#d9b319', rgb: [217, 179, 25] },
  ];
  const hexOf = (k) => (MARK_COLORS.find(c => c.key === k) || MARK_COLORS[0]).hex;
  const labelOf = (k) => (MARK_COLORS.find(c => c.key === k) || MARK_COLORS[0]).label;

  /** 这个像素是不是彩色标记：色差够大、又不能太暗（黑线）或太灰白（纸） */
  function markOf(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 70) return null;
    if (mx - mn < 55) return null;
    let best = null, bd = Infinity;
    for (const c of MARK_COLORS) {
      const d = (r - c.rgb[0]) ** 2 + (g - c.rgb[1]) ** 2 + (b - c.rgb[2]) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    return Math.sqrt(bd) < 110 ? best : null;
  }

  /** 连通域：把图里同色的每一段线找出来，顺带算出它的两个端点（用主轴投影） */
  function scan(img, w, h, minCells = 12) {
    const out = [], data = img.data, done = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (done[i]) continue;
      const m = markOf(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      if (!m) { done[i] = 1; continue; }
      const cells = [], stack = [i], seen = new Set([i]);
      done[i] = 1;
      while (stack.length) {
        const j = stack.pop(), x = j % w, y = (j / w) | 0;
        cells.push([x, y]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = ny * w + nx;
          if (done[k] || seen.has(k)) continue;
          const mk = markOf(data[k * 4], data[k * 4 + 1], data[k * 4 + 2]);
          if (!mk) { done[k] = 1; continue; }
          if (mk.key !== m.key) continue;
          done[k] = 1; seen.add(k); stack.push(k);
        }
      }
      if (cells.length < minCells) continue;
      let cx = 0, cy = 0;
      for (const [x, y] of cells) { cx += x; cy += y; }
      cx /= cells.length; cy /= cells.length;
      let sxx = 0, sxy = 0, syy = 0;
      for (const [x, y] of cells) { const dx = x - cx, dy = y - cy; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
      const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(th), uy = Math.sin(th);
      let lo = Infinity, hi = -Infinity, lp = null, hp = null;
      for (const [x, y] of cells) {
        const t = (x - cx) * ux + (y - cy) * uy;
        if (t < lo) { lo = t; lp = [x, y]; }
        if (t > hi) { hi = t; hp = [x, y]; }
      }
      out.push({ key: m.key, label: labelOf(m.key), hex: hexOf(m.key), cells: cells.length, xy: cells, pts: [lp, hp], len: hi - lo, mid: [cx, cy] });
    }
    return out;
  }

  function distToSeg(p, a, b) {
    const vx = b[0] - a[0], vy = b[1] - a[1], wx = p[0] - a[0], wy = p[1] - a[1];
    const L2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / L2));
    return Math.hypot(wx - vx * t, wy - vy * t);
  }

  /** 把每一段彩线归到某一片的某条边上。
   * 光挑「离得最近」不够：一条长边旁边画一段短省道，距离也近，会被误吞。
   * 所以要同时看「这段线有多长」和「目标边有多长」，差太远就不算它的。
   * 一条边只认一段线：后来那段如果抢不过，说明它其实没有正对着这条边。 */
  function assignToEdges(pieces, marks, tolPx = 14) {
    const taken = new Map();   // pieceId:edge → 这一段的分数
    const out = marks.map((mk) => {
      let best = null;
      for (const p of pieces) {
        const poly = p.poly, n = poly.length;
        for (let i = 0; i < n; i++) {
          const a = poly[i], b = poly[(i + 1) % n];
          const dist = (distToSeg(mk.pts[0], a, b) + distToSeg(mk.pts[1], a, b)) / 2;
          if (dist > tolPx) continue;
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          // 这段线和这条边的长度要一个量级：差的倍数越小越好
          const ratio = Math.max(mk.len, 1) / Math.max(len, 1);
          if (ratio < 0.45 || ratio > 2.2) continue;
          const score = dist + Math.abs(Math.log(ratio)) * 40;
          const key = p.id + ':' + i;
          if (taken.has(key) && taken.get(key) <= score) continue;
          if (!best || score < best.score) best = { piece: p, edge: i, a, b, len, score, key };
        }
      }
      if (!best) return { ...mk, piece: null, edge: -1, edgeLen: mk.len };
      taken.set(best.key, best.score);
      return { ...mk, piece: best.piece, edge: best.edge, pts: [best.a, best.b], edgeLen: best.len, dist: best.score };
    });
    return out;
  }

  /* ---------- 沿轮廓取「一段」 ----------
   * 缝不一定是一条直边：圆头的整圈、身体的弧形侧边，在多边形里是几十个小边连成的。
   * 所以不拿「某一条边」去对，而是量这段彩线贴着轮廓从哪走到哪，取这一段的弧长。 */

  /** 把闭合多边形按 1px 一步铺开：pts[i] 是第 i 步的点，s[i] 是从起点走过的弧长 */
  function densify(poly) {
    const pts = [], sArr = [];
    let acc = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const k = Math.max(1, Math.round(len));
      for (let j = 0; j < k; j++) { pts.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); sArr.push(acc + len * j / k); }
      acc += len;
    }
    return { pts, s: sArr, L: acc, n: pts.length };
  }

  /** 折线抽稀：每 step 个点留一个，再加上终点（够画缝线了，也省存档） */
  function thin(pts, step) {
    const out = [];
    for (let i = 0; i < pts.length; i += step) out.push(pts[i]);
    if (out.length === 0 || out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
    return out;
  }

  /** 把一段彩线归到某一片的轮廓上，返回这一段（折线 + 弧长）。归不上就 piece = null。
   *  opts.tol：彩线离轮廓多远算「在轮廓上」（线有粗细，轮廓取在线的内侧）；opts.minShare：至少多少比例的像素要贴着轮廓。 */
  function assignToChains(pieces, marks, opts = {}) {
    const tol = opts.tol || 18, minShare = opts.minShare || 0.6;
    const dens = new Map();
    const getDens = (p) => { if (!dens.has(p.id)) dens.set(p.id, densify(p.poly)); return dens.get(p.id); };
    return marks.map((mk) => {
      const xy = mk.xy || [];
      if (xy.length < 4) return { ...mk, piece: null, edge: -1, edgeLen: mk.len };
      const step = Math.max(1, Math.ceil(xy.length / 260)), sample = [];
      for (let i = 0; i < xy.length; i += step) sample.push(xy[i]);
      let best = null;
      for (const p of pieces) {
        const bx = p.box || (() => { const xs = p.poly.map(q => q[0]), ys = p.poly.map(q => q[1]); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; })();
        if (mk.mid[0] < bx.x - tol || mk.mid[0] > bx.x + bx.w + tol || mk.mid[1] < bx.y - tol || mk.mid[1] > bx.y + bx.h + tol) continue;
        const dn = getDens(p);
        const hits = [];
        for (const [x, y] of sample) {
          let bd = Infinity, bi = -1;
          for (let i = 0; i < dn.n; i++) { const dd = (dn.pts[i][0] - x) ** 2 + (dn.pts[i][1] - y) ** 2; if (dd < bd) { bd = dd; bi = i; } }
          if (Math.sqrt(bd) <= tol) hits.push(bi);
        }
        const share = hits.length / sample.length;
        if (share >= minShare && (!best || share > best.share)) best = { piece: p, dn, hits, share };
      }
      if (!best) return { ...mk, piece: null, edge: -1, edgeLen: mk.len };
      const { dn, hits } = best, N = dn.n;
      // 哪些步被这条彩线盖住了（左右各放宽 3 步），再把相距不到 10 步的缺口补上
      const cover = new Uint8Array(N);
      for (const i of hits) for (let d = -3; d <= 3; d++) cover[(i + d + N) % N] = 1;
      const runs = [];                                  // 在环上找一段一段连续的 1
      let start = -1;
      const first0 = cover.indexOf(0);
      if (first0 < 0) runs.push({ a: 0, len: N, closed: true });
      else {
        for (let k = 1; k <= N; k++) {
          const i = (first0 + k) % N;
          if (cover[i] && start < 0) start = i;
          if (!cover[i] && start >= 0) { runs.push({ a: start, len: (i - start + N) % N }); start = -1; }
        }
      }
      // 补缺口
      const merged = [];
      for (const r of runs.sort((x, y) => x.a - y.a)) {
        const last = merged[merged.length - 1];
        if (last && !last.closed && r.a - (last.a + last.len) <= 10 && r.a >= last.a) last.len = r.a + r.len - last.a; else merged.push({ ...r });
      }
      if (merged.length > 1) {   // 首尾在环上接起来的情况
        const f = merged[0], l = merged[merged.length - 1];
        if (!f.closed && (f.a + N - (l.a + l.len)) <= 10 && merged.length > 1) { l.len = l.len + (f.a + N - (l.a + l.len)) + f.len; merged.shift(); }
      }
      const run = merged.sort((x, y) => y.len - x.len)[0];
      const chain = [];
      for (let k = 0; k <= run.len; k++) chain.push(dn.pts[(run.a + k) % N]);
      const closed = !!run.closed || run.len >= N - 12;
      const len = closed ? dn.L : (() => { let L2 = 0; for (let i = 1; i < chain.length; i++) L2 += Math.hypot(chain[i][0] - chain[i - 1][0], chain[i][1] - chain[i - 1][1]); return L2; })();
      return { ...mk, xy: undefined, piece: best.piece, edge: run.a, pts: thin(chain, 4), edgeLen: len, closed, share: best.share };
    });
  }

  /** 省道：紫色的 V 是轮廓上凹进去的一个口，两条腿连在一起成了一整段。
   *  在离两端连线最远的那个点（V 的尖）把它劈成两条腿，两条腿才能「配对成一条缝」 */
  function splitDarts(assigned) {
    const out = [];
    for (const m of assigned) {
      if (m.key !== 'dart' || !m.piece || m.closed || !m.pts || m.pts.length < 4) { out.push(m); continue; }
      const a = m.pts[0], b = m.pts[m.pts.length - 1], vx = b[0] - a[0], vy = b[1] - a[1], L = Math.hypot(vx, vy) || 1;
      let bi = -1, bd = 0;
      m.pts.forEach((q, i) => { const d = Math.abs((q[0] - a[0]) * vy - (q[1] - a[1]) * vx) / L; if (d > bd) { bd = d; bi = i; } });
      if (bi < 1 || bi > m.pts.length - 2 || bd < 6) { out.push(m); continue; }
      const len = (pts) => { let t = 0; for (let i = 1; i < pts.length; i++) t += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return t; };
      const l1 = m.pts.slice(0, bi + 1), l2 = m.pts.slice(bi);
      out.push({ ...m, pts: l1, edgeLen: len(l1), split: 1 }, { ...m, pts: l2, edgeLen: len(l2), split: 2, edge: m.edge + 1 });
    }
    return out;
  }

  /** 核心：同色 + 边长相近 → 两两配对成一条缝。同一片自己的两条边不会互配 */
  function pairSeams(assigned, tol = 0.06) {
    const groups = new Map();
    for (const m of assigned) {
      if (!m.piece) continue;
      if (!groups.has(m.key)) groups.set(m.key, []);
      groups.get(m.key).push(m);
    }
    const seams = [], leftovers = [];
    for (const [key, list] of groups) {
      const pool = [...list].sort((a, b) => b.edgeLen - a.edgeLen);
      let n = 1;
      const used = new Set();          // 一条边只能缝一次，否则同一位置会被配出好几个解释
      while (pool.length >= 2) {
        const x = pool.shift();
        const xk = x.piece.id + ':' + x.edge;
        if (used.has(xk)) { leftovers.push(x); continue; }
        let bi = -1, bd = Infinity;
        for (let i = 0; i < pool.length; i++) {
          if (pool[i].piece === x.piece && key !== 'dart') continue;   // 省道的两条腿本来就在同一片上
          const k2 = pool[i].piece.id + ':' + pool[i].edge;
          if (used.has(k2)) continue;
          const diff = Math.abs(pool[i].edgeLen - x.edgeLen) / Math.max(1, x.edgeLen);
          if (diff < bd) { bd = diff; bi = i; }
        }
        if (bi < 0) { leftovers.push(x); continue; }   // 没有别的片可以和它缝
        // 差得多也要配出来：这份的价值恰恰是「把对不上的边指给你看」，ok=假就是报警
        const y = pool.splice(bi, 1)[0];
        used.add(xk); used.add(y.piece.id + ':' + y.edge);
        seams.push({
          id: key.toUpperCase().slice(0, 2) + n, key, label: labelOf(key), hex: hexOf(key),
          a: { piece: x.piece.id, pieceName: x.piece.name, edge: x.edge, len: x.edgeLen, pts: x.pts },
          b: { piece: y.piece.id, pieceName: y.piece.name, edge: y.edge, len: y.edgeLen, pts: y.pts },
          diff: bd, ok: bd <= tol,
        });
        n++;
      }
      leftovers.push(...pool);
    }
    return { seams, leftovers };
  }

  /** 一张图没有颜色标记时，退一步：只按边长相近自动配对 */
  function pairByLength(pieces, tol = 0.06) {
    const edges = [];
    for (const p of pieces) {
      const poly = p.poly, n = poly.length;
      for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len > 40) edges.push({ piece: p, edge: i, a, b, len });
      }
    }
    const pool = edges.sort((a, b) => b.len - a.len), seams = [];
    let n = 1;
    while (pool.length >= 2) {
      const x = pool.shift();
      let bi = -1, bd = Infinity;
      for (let i = 0; i < pool.length; i++) {
        if (pool[i].piece === x.piece) continue;
        const diff = Math.abs(pool[i].len - x.len) / Math.max(1, x.len);
        if (diff < bd) { bd = diff; bi = i; }
      }
      if (bi < 0 || bd > tol) continue;
      const y = pool.splice(bi, 1)[0];
      seams.push({
        id: 'L' + n, key: 'auto', label: '按长度自动配', hex: '#7a8bd8',
        a: { piece: x.piece.id, pieceName: x.piece.name, edge: x.edge, len: x.len, pts: [x.a, x.b] },
        b: { piece: y.piece.id, pieceName: y.piece.name, edge: y.edge, len: y.len, pts: [y.a, y.b] },
        diff: bd, ok: true,
      });
      n++;
    }
    return { seams, leftovers: pool };
  }

  /* ---------- 单色图纸（没有彩线）：只做有把握的几件事 ----------
   * 没有颜色，就没有任何东西能告诉算法「这条边缝哪条边」。能有把握推出来的只有：
   *   ① 形状一模一样的两片，上下叠着摆、或者不在中线两侧对称的 = 前片 + 后片 → 周边缝在一起；
   *   ② 轮廓上又尖又窄的 V 形凹口 = 省道，两条腿配成一条缝；
   * 其余（左右对称的两片缝哪条边、头顶发缝脸的哪一圈……）靠猜会猜错，所以不猜，列在「没配上」里，
   * 要准就给图纸上色（同色 = 缝在一起）。猜出来的缝都带 guess: true，报告里会标「猜的」。 */
  const perimeterOf = (poly) => { let L = 0; for (let i = 0; i < poly.length; i++) { const q = poly[(i + 1) % poly.length]; L += Math.hypot(q[0] - poly[i][0], q[1] - poly[i][1]); } return L; };
  const areaOf = (poly) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const boxOf = (poly) => { const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]), x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };

  /** 轮廓上又尖又窄的 V 形凹口：凹点、夹角小于 70°、两条腿都不太短、长短差不多 */
  function findNotches(poly) {
    const n = poly.length, sgn = poly.reduce((s, p, i) => { const q = poly[(i + 1) % n]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) > 0 ? 1 : -1;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = poly[(i - 1 + n) % n], v = poly[i], b = poly[(i + 1) % n];
      const ux = a[0] - v[0], uy = a[1] - v[1], wx = b[0] - v[0], wy = b[1] - v[1];
      const l1 = Math.hypot(ux, uy), l2 = Math.hypot(wx, wy);
      if (l1 < 10 || l2 < 10 || Math.max(l1, l2) / Math.min(l1, l2) > 1.8) continue;
      const cross = (v[0] - a[0]) * (b[1] - v[1]) - (v[1] - a[1]) * (b[0] - v[0]);
      if (cross * sgn >= 0) continue;                                   // 凸的，不是凹口
      const ang = Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy) / (l1 * l2)))) * 180 / Math.PI;
      if (ang > 70) continue;
      out.push({ i, a, v, b, l1, l2, ang });
    }
    return out;
  }

  function inferSeamsMono(pieces, w) {
    const info = pieces.map((p) => ({ p, A: areaOf(p.poly), P: perimeterOf(p.poly), b: boxOf(p.poly) }));
    const seams = [], leftovers = [], notes = [];
    const axis = (w || 0) / 2, near = (x, y) => Math.abs(x - y) / Math.max(x, y, 1e-6);
    // 前后片不一定一模一样：后片多个省道口，面积 / 周长会差几个百分点，所以放宽一点
    const twin = (a, b) => near(a.A, b.A) < 0.1 && near(a.P, b.P) < 0.12 &&
      ((near(a.b.w, b.b.w) < 0.12 && near(a.b.h, b.b.h) < 0.12) || (near(a.b.w, b.b.h) < 0.12 && near(a.b.h, b.b.w) < 0.12));
    const used = new Set();
    let n = 1;
    // ① 一模一样的两片：优先配离得最近的（四个耳朵里，上下叠着的才是一对）
    const cand = [];
    for (let i = 0; i < info.length; i++) for (let j = i + 1; j < info.length; j++) if (twin(info[i], info[j])) {
      const ci = [info[i].b.x + info[i].b.w / 2, info[i].b.y + info[i].b.h / 2], cj = [info[j].b.x + info[j].b.w / 2, info[j].b.y + info[j].b.h / 2];
      cand.push({ i, j, d: Math.hypot(ci[0] - cj[0], ci[1] - cj[1]), ci, cj });
    }
    cand.sort((a, b) => a.d - b.d);
    for (const c of cand) {
      if (used.has(c.i) || used.has(c.j)) continue;
      used.add(c.i); used.add(c.j);
      const a = info[c.i], b = info[c.j];
      // 左右镜像（同一高度、隔着中线）：缝的是哪几条边没法判断，不猜
      const mirrored = Math.abs(c.ci[1] - c.cj[1]) < 0.15 * Math.max(a.b.h, b.b.h) && (c.ci[0] - axis) * (c.cj[0] - axis) < 0;
      if (mirrored) { notes.push(`${a.p.name} 和 ${b.p.name} 是左右对称的一对，缝哪几条边没法判断（要上色）。`); continue; }
      const thinPts = (p) => { const d = densify(p.poly); return { pts: thin(d.pts, 6), len: d.L }; };
      const ta = thinPts(a.p), tb = thinPts(b.p);
      seams.push({
        id: 'A' + n, key: 'auto', label: '猜：前后片周边', hex: '#7a8bd8', guess: true,
        a: { piece: a.p.id, pieceName: a.p.name, edge: 0, len: ta.len, pts: ta.pts, closed: true },
        b: { piece: b.p.id, pieceName: b.p.name, edge: 0, len: tb.len, pts: tb.pts, closed: true },
        diff: near(ta.len, tb.len), ok: near(ta.len, tb.len) <= 0.06,
      });
      n++;
    }
    // ② 省道：每片里找 V 形凹口，两条腿配成一条缝
    for (const it of info) {
      const notches = findNotches(it.p.poly);
      for (const nt of notches) {
        seams.push({
          id: 'D' + n, key: 'dart', label: '猜：省道', hex: '#a45bd8', guess: true,
          a: { piece: it.p.id, pieceName: it.p.name, edge: nt.i, len: nt.l1, pts: [nt.v, nt.a], closed: false },
          b: { piece: it.p.id, pieceName: it.p.name, edge: nt.i + 1, len: nt.l2, pts: [nt.v, nt.b], closed: false },
          diff: near(nt.l1, nt.l2), ok: near(nt.l1, nt.l2) <= 0.06,
        });
        n++;
      }
    }
    info.forEach((it, i) => { if (!used.has(i)) leftovers.push({ piece: it.p, why: '没有一模一样的另一片，也没有彩线：缝哪里没法判断' }); });
    return { seams, leftovers, notes };
  }

  /* ---------- 按用途缝合（方法二、方法三）----------
   * 每片的用途定下来以后，缝合关系是「规矩」，不用猜：
   *   身体前↔身体后、左耳前↔左耳后、右耳前↔右耳后、左臂前↔左臂后、右臂前↔右臂后、脸（扁平头前片）↔后脑 = 周边缝在一起；
   * 圆头版式（脸 / 后脑左右 / 头顶发 / 下巴）的缝合在 3D 里是固定的映射，不用列。
   * 轮廓上的 V 形凹口照样认作省道（标「猜的」）。 */
  const ROLE_PAIRS = [
    ['bodyFront', 'bodyBack', '身体前后', '#3f7fce'], ['earLF', 'earLB', '左耳前后', '#35a85a'], ['earRF', 'earRB', '右耳前后', '#2fb6bd'],
    ['armLF', 'armLB', '左臂前后', '#bf7c31'], ['armRF', 'armRB', '右臂前后', '#d9b319'], ['faceFlat', 'headBackL', '头前后', '#e04a4a'],
  ];
  function seamsFromRoles(pieces) {
    const byRole = new Map();
    for (const p of pieces) if (p.role && p.role !== 'none' && !byRole.has(p.role)) byRole.set(p.role, p);
    const seams = [], notes = [];
    let n = 1;
    for (const [fr, br, label, hex] of ROLE_PAIRS) {
      const a = byRole.get(fr), b = byRole.get(br);
      if (!a || !b) continue;
      const da = densify(a.poly), db = densify(b.poly);
      seams.push({
        id: 'R' + n, key: 'role', label: '按用途：' + label + '周边', hex, guess: false,
        a: { piece: a.id, pieceName: a.name, edge: 0, len: da.L, pts: thin(da.pts, 6), closed: true },
        b: { piece: b.id, pieceName: b.name, edge: 0, len: db.L, pts: thin(db.pts, 6), closed: true },
        diff: Math.abs(da.L - db.L) / Math.max(da.L, db.L), ok: Math.abs(da.L - db.L) / Math.max(da.L, db.L) <= 0.06,
      });
      n++;
    }
    if (byRole.has('face') && (byRole.has('backL') || byRole.has('backR'))) notes.push('圆头版式：脸、后脑叶子怎么缝在 3D 里是固定的，不用列缝。');
    for (const p of pieces) for (const nt of findNotches(p.poly)) {
      seams.push({
        id: 'D' + n, key: 'dart', label: '猜：省道', hex: '#a45bd8', guess: true,
        a: { piece: p.id, pieceName: p.name, edge: nt.i, len: nt.l1, pts: [nt.v, nt.a], closed: false },
        b: { piece: p.id, pieceName: p.name, edge: nt.i + 1, len: nt.l2, pts: [nt.v, nt.b], closed: false },
        diff: Math.abs(nt.l1 - nt.l2) / Math.max(nt.l1, nt.l2), ok: Math.abs(nt.l1 - nt.l2) / Math.max(nt.l1, nt.l2) <= 0.06,
      });
      n++;
    }
    return { seams, notes };
  }

  /** 把缝线写进每片的 seamEdges（和 nunu-design.js 里的一致格式），3D 和检查都用得上 */
  function writeSeamEdges(pieces, seams) {
    for (const p of pieces) {
      const es = [];
      for (const s of seams) for (const side of ['a', 'b'])
        if (s[side].piece === p.id) es.push({ label: `${s.label}·${s.id}`, pts: s[side].pts, color: s.hex });
      p.seamEdges = es.length ? es : null;
    }
    return pieces;
  }

  root.NunuColorImport = { MARK_COLORS, markOf, scan, assignToEdges, assignToChains, splitDarts, densify, findNotches, inferSeamsMono, seamsFromRoles, ROLE_PAIRS, pairSeams, pairByLength, writeSeamEdges, distToSeg, labelOf, hexOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NunuColorImport;
})(typeof window === 'undefined' ? globalThis : window);
