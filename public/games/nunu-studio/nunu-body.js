/* 努努赛博定制台 · 自创体子（扁平 2.5D 球豆体）
 * 拖滑条改头、身体、手臂、耳朵的大小和样子，自动算出一整套裁片（和公开图纸一样的模板格式），
 * 画脸、画发片、备料、导出、3D 全都直接接上。
 * 结构学的是网上的 2.5D 球豆体：头 = 脸片（前片）+ 后脑左右两半（后片）对折缝成扁袋；身体前后两片，自带两条腿；
 * 手臂可以分开做，也可以手身一体；耳朵是前后两片，有猫耳、狗耳、鹿耳、鼠耳、狐耳、狼耳、圆耳。
 * 单位是图纸像素：脸片宽 = headW，真实大小由「脸片宽度（毫米）」决定，和公开图纸一样。 */
(function (root) {
'use strict';
const Shape = root.NunuShape, C = root.NunuCore;

const DEFAULTS = {
  headW: 320, headH: 290, headSquare: 2.7, // headSquare：超椭圆指数，2 是椭圆，越大越方
  bodyW: 170, bodyH: 175, legGap: 40, legDepth: 64,
  arms: 'separate', armLen: 108, armW: 40,
  ear: 'cat', earSize: 110, earTilt: 16, earSpread: 0.58,
  headThick: 150, bodyThick: 96, // 头、身体的厚度 = 围条的宽度（图纸像素）
};
const FLAP_THICK = 18; // 耳朵、手臂是扁片，只有前后两层布加一点棉
const EAR_TYPES = {
  cat: { label: '猫耳', w: 0.9, h: 1.0, mode: 'up', pts: [[-0.5, 0], [-0.47, -0.2], [-0.36, -0.5], [-0.2, -0.78], [0, -1.0], [0.12, -0.95], [0.28, -0.7], [0.42, -0.4], [0.5, -0.12], [0.5, 0], [0.25, 0.05], [0, 0.07], [-0.25, 0.05]] },
  fox: { label: '狐狸耳', w: 0.7, h: 1.25, mode: 'up', pts: [[-0.5, 0], [-0.45, -0.3], [-0.3, -0.65], [-0.1, -0.92], [0.05, -1.0], [0.2, -0.8], [0.38, -0.5], [0.5, -0.15], [0.5, 0], [0.25, 0.05], [0, 0.07], [-0.25, 0.05]] },
  wolf: { label: '狼耳', w: 1.0, h: 1.0, mode: 'up', pts: [[-0.5, 0], [-0.5, -0.25], [-0.35, -0.55], [-0.1, -0.85], [0.1, -1.0], [0.3, -0.75], [0.45, -0.4], [0.5, -0.1], [0.5, 0], [0.25, 0.06], [0, 0.09], [-0.25, 0.06]] },
  mouse: { label: '鼠耳（圆大耳）', w: 1.0, h: 0.95, mode: 'up', pts: Array.from({ length: 36 }, (_, i) => { const t = (i / 36) * Math.PI * 2; return [0.5 * Math.cos(t), Math.min(0.02, -0.5 + 0.5 * Math.sin(t))]; }) },
  deer: { label: '鹿耳', w: 0.9, h: 1.0, mode: 'up', pts: [[-0.3, 0], [-0.45, -0.25], [-0.5, -0.5], [-0.4, -0.8], [-0.15, -0.98], [0.1, -1.0], [0.35, -0.85], [0.5, -0.55], [0.48, -0.25], [0.3, 0], [0, 0.05]] },
  dog: { label: '狗耳（垂耳）', w: 1.0, h: 1.15, mode: 'side', pts: [[-0.35, 0], [0.35, 0], [0.5, 0.3], [0.52, 0.65], [0.4, 0.95], [0.15, 1.1], [-0.1, 1.08], [-0.35, 0.9], [-0.5, 0.55], [-0.48, 0.25]] },
  round: { label: '圆耳（小）', w: 0.9, h: 0.8, mode: 'up', pts: Array.from({ length: 30 }, (_, i) => { const t = Math.PI * (i / 29); return [-0.5 * Math.cos(t), -0.9 * Math.sin(t)]; }) },
};
const earLabel = (k) => (EAR_TYPES[k] || EAR_TYPES.cat).label;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** 超椭圆轮廓：a、b 是半轴，n 是指数 */
function superellipse(cx, cy, a, b, n, count = 120, t0 = 0, t1 = Math.PI * 2) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = t0 + ((t1 - t0) * i) / (count - 1 + (t1 - t0 >= Math.PI * 2 - 1e-9 ? 1 : 0));
    const c = Math.cos(t), s = Math.sin(t);
    out.push([cx + a * Math.sign(c) * Math.abs(c) ** (2 / n), cy + b * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  return out;
}
const shift = (poly, dx, dy) => poly.map(([x, y]) => [x + dx, y + dy]);
const mirrorPoly = (poly, axis) => poly.map(([x, y]) => [2 * axis - x, y]).reverse();
const bounds = (polys) => { const b = polys.map(C.boxOfPoly); const x0 = Math.min(...b.map((q) => q.x)), y0 = Math.min(...b.map((q) => q.y)); return { x0, y0, x1: Math.max(...b.map((q) => q.x + q.w)), y1: Math.max(...b.map((q) => q.y + q.h)) }; };
function densify(poly, step) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}

/** 把几块多边形并成一块（画到一张位图上，再追外轮廓）。身体带手臂就是这样并出来的 */
function unionOutline(polys, eps = 0.9) {
  const b = bounds(polys), pad = 4, w = Math.ceil(b.x1 - b.x0) + pad * 2, h = Math.ceil(b.y1 - b.y0) + pad * 2;
  const bm = Shape.emptyBitmap(w, h);
  for (const poly of polys) {
    const pts = poly.map(([x, y]) => [x - b.x0 + pad, y - b.y0 + pad]);
    for (let y = 0; y < h; y++) {
      const cy = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= cy && y1 > cy) || (y1 <= cy && y0 > cy)) xs.push(x0 + ((cy - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(w, Math.round(xs[k + 1])); x++) bm.data[y * w + x] = 1;
    }
  }
  const loops = Shape.traceContours(bm).filter((l) => Shape.polygonArea(l) > 50).sort((p, q) => Shape.polygonArea(q) - Shape.polygonArea(p));
  return Shape.simplifyLoop(loops[0], eps).map(([x, y]) => [x + b.x0 - pad, y + b.y0 - pad]);
}

/** 身体：躯干 + 两条腿（中间留缝），原点在上边中点；integrated 时两边带手臂 */
function bodyOutline(p, withArms) {
  const H = p.bodyH, top = p.bodyW * 0.42, hip = p.bodyW / 2, gap = p.legGap / 2, depth = p.legDepth;
  const torso = densify([[-top, 0], [top, 0], [hip * 0.98, H * 0.3], [hip, H * 0.62], [hip, H], [gap, H], [gap, H - depth], [0, H - depth - 8], [-gap, H - depth], [-gap, H], [-hip, H], [-hip, H * 0.62], [-hip * 0.98, H * 0.3]], 10);
  const polys = [Shape.smoothLoop(torso, 2)];
  if (withArms) for (const s of [-1, 1]) polys.push(...armShape(p, s, true));
  return polys.length > 1 ? Shape.smoothLoop(unionOutline(polys), 2) : polys[0];
}
/** 手臂（哑铃形）：细杆 + 圆头。s = -1 在左边、1 在右边；integrated 时从肩膀伸出去 */
function armShape(p, s, integrated) {
  const len = p.armLen, w = p.armW, r = w * 0.66, stalk = w * 0.62, x0 = integrated ? s * (p.bodyW * 0.42 - 6) : 0, y0 = integrated ? p.bodyH * 0.1 : 0;
  const rect = [[0, -stalk / 2], [len - r * 0.4, -stalk / 2], [len - r * 0.4, stalk / 2], [0, stalk / 2]].map(([x, y]) => [x0 + s * x, y0 + stalk / 2 + y]);
  const knob = Array.from({ length: 28 }, (_, i) => { const t = (i / 28) * Math.PI * 2; return [x0 + s * (len - r) + r * Math.cos(t), y0 + stalk / 2 + r * Math.sin(t)]; });
  return [rect, knob];
}
function armOutline(p, s) { return unionOutline(armShape(p, s, false)); }

function earOutline(p, side) {
  const t = EAR_TYPES[p.ear] || EAR_TYPES.cat, w = p.earSize * t.w, h = p.earSize * t.h;
  const pts = t.pts.map(([x, y]) => [x * w, y * h]);
  const poly = Shape.smoothLoop(densify(pts, 6), 1);
  return side > 0 ? mirrorPoly(poly, 0) : poly;
}

/** 照着缝的步骤（文字说明） */
function sewingSteps(p) {
  return [
    '头：先把两半后脑沿中线缝在一起（对着中线上的记号），再把头围条 ① ② 首尾缝成一圈。',
    '头围条一边缝脸片外圈（围条中点对脸片上、下记号），另一边缝后脑外圈，留一个返口，翻面填棉。',
    '身体：围条 ① ② 首尾缝成一圈，一边缝身体前片、另一边缝身体后片，围条中点对身体上边中点，翻面填棉。',
    '耳朵：前后两片正面相对缝弧边，底边不缝，翻面后用藏针缝缝到头顶（离中线 ' + Math.round(p.earSpread * 100) + '% 处）。',
    p.arms === 'integrated' ? '手身一体：手臂已经包在身体轮廓里，不用另缝。' : '手臂：前后两片正面相对缝一圈留根部，翻面填一点棉，用藏针缝缝在肩膀侧边。',
  ];
}

/** 按参数生成模板。左右（画面）对称：轴 = 版面中线 */
function generate(params = {}) {
  const p = { ...DEFAULTS, ...params };
  p.headThick = clamp(p.headThick, 40, 300); p.bodyThick = clamp(p.bodyThick, 30, 220);
  p.headW = clamp(p.headW, 200, 460); p.headH = clamp(p.headH, 180, 420); p.bodyW = clamp(p.bodyW, 100, 300); p.bodyH = clamp(p.bodyH, 100, 300);
  const a = p.headW / 2, b = p.headH / 2, cx0 = 0, cy0 = 0;
  const headFull = superellipse(cx0, cy0, a, b, p.headSquare, 120);
  const halfL = superellipse(cx0, cy0, a, b, p.headSquare, 61, Math.PI / 2, (Math.PI * 3) / 2); // 左半：从上边中点绕到下边中点
  const halfR = superellipse(cx0, cy0, a, b, p.headSquare, 61, -Math.PI / 2, Math.PI / 2);
  const earT = EAR_TYPES[p.ear] || EAR_TYPES.cat;
  const k = 3 / p.headW, headCy = 0.78 + (p.headH / 2) * k - 0.06; // 3D 里：身体上边在 0.78，头坐在上面
  const bodyPoly = bodyOutline(p, p.arms === 'integrated');
  const earL = earOutline(p, -1), armL = p.arms === 'separate' ? armOutline(p, 1) : null; // 左边那一列手臂杆在左、圆头在右（贴在画面右边的身体侧边上）
  const m = 40, gap = 56, midGap = 70;
  // ---- 版面：第一排 后脑左半 | 脸片 | 后脑右半；第二排 耳朵（前后各一片）和手臂；第三排 身体前、后 ----
  const rowW = a + gap + p.headW + gap + a, rowH = p.headH;
  const W0 = Math.max(rowW, p.bodyW * 2 + midGap + (p.arms === 'integrated' ? p.armLen * 4 : 0)) + m * 2, axis = W0 / 2;
  const faceCx = axis, faceCy = m + b;
  const bLeftCut = axis - p.headW / 2 - gap; // 左半的切口边（右边缘）贴着脸左边留 gap
  const dxL = bLeftCut - cx0, dyL = faceCy - cy0; // 左半平移：切口边落在 bLeftCut
  const dxR = 2 * axis - 2 * cx0 - dxL, dyR = dyL;
  const face = { id: 'face', name: '脸片（前）', role: 'faceFlat', poly: shift(headFull, faceCx, faceCy), smooth: false, thick: p.headThick, anchorPx: [faceCx, faceCy] };
  const backL = { id: 'backL', name: '后脑·左半', role: 'headBackL', poly: shift(halfL, dxL, dyL), smooth: false, thick: p.headThick, anchorPx: [cx0 + dxL, cy0 + dyL], heightPoly: shift(headFull, dxL, dyL) };
  const backR = { id: 'backR', name: '后脑·右半', role: 'headBackR', poly: shift(halfR, dxR, dyR), smooth: false, thick: p.headThick, anchorPx: [cx0 + dxR, cy0 + dyR], heightPoly: shift(headFull, dxR, dyR) };
  const headPlace = { y: headCy };
  face.place = headPlace; backL.place = headPlace; backR.place = headPlace;
  // ---- 第二排：耳朵（左边两片，右边是它们的镜像） ----
  const earBox = C.boxOfPoly(earL), row2Y = m + p.headH + 60, earGap = 34;
  const ears = [];
  for (const [id, name, i] of [['earLF', '左耳·前', 0], ['earLB', '左耳·后', 1]]) {
    const x = axis - 40 - (i + 1) * earBox.w - i * earGap;
    ears.push({ id, name, role: id, thick: FLAP_THICK, poly: shift(earL, x - earBox.x, row2Y - earBox.y), smooth: false });
  }
  const earMirror = (e, id, name) => ({ id, name, role: id, thick: FLAP_THICK, poly: mirrorPoly(e.poly, axis), smooth: false });
  ears.push(earMirror(ears[0], 'earRF', '右耳·前'), earMirror(ears[1], 'earRB', '右耳·后'));
  // 耳朵怎么贴在头上：上翘的耳朵底边中点贴在头顶两侧，往外歪 earTilt 度；垂耳贴在头的两侧，往下垂
  const sp = clamp(p.earSpread, 0.2, 0.92), nExp = p.headSquare, topAt = (frac) => (p.headH / 2) * k * Math.pow(Math.max(0, 1 - Math.pow(frac, nExp)), 1 / nExp);
  const tilt = (p.earTilt * Math.PI) / 180;
  for (const e of ears) {
    const sgn = e.id.startsWith('earL') ? -1 : 1;
    if (earT.mode === 'side') e.place = { x: sgn * (p.headW / 2) * k * 0.94, y: headCy + (p.headH / 2) * k * 0.2, z: 0, anchor: 'top', rot: sgn * tilt };
    else e.place = { x: sgn * sp * (p.headW / 2) * k, y: headCy + topAt(sp) * 0.97, z: 0, anchor: 'bottom', rot: -sgn * tilt };
  }
  const pieces = [face, backL, backR, ...ears];
  // ---- 第三排：手臂（分开做的时候）：左边那一列的杆在左、圆头在右，贴在画面右边的身体侧边；右边那一列是镜像 ----
  let row3Bottom = row2Y + earBox.h;
  if (armL) {
    const abx = C.boxOfPoly(armL), armY = row2Y + earBox.h + 40, armGap = 24;
    const placed = [['armLF', '左臂·前', 0], ['armLB', '左臂·后', 1]].map(([id, name, i]) => ({ id, name, role: id, thick: FLAP_THICK, place: { anchor: 'center' }, poly: shift(armL, axis + 50 + i * (abx.w + armGap) - abx.x, armY - abx.y), smooth: false }));
    const mirrored = [['armRF', '右臂·前', placed[0]], ['armRB', '右臂·后', placed[1]]].map(([id, name, src]) => ({ id, name, role: id, thick: FLAP_THICK, place: { anchor: 'center' }, poly: mirrorPoly(src.poly, axis), smooth: false }));
    pieces.push(...placed, ...mirrored);
    row3Bottom = armY + abx.h;
  }
  // ---- 最下面一排：身体前、后 ----
  const bb = C.boxOfPoly(bodyPoly), row3Y = row3Bottom + 56;
  const bodyF = { id: 'bodyF', name: '身体·前', role: 'bodyFront', thick: p.bodyThick, smooth: false, poly: shift(bodyPoly, axis - midGap / 2 - bb.w / 2 - bb.x, row3Y - bb.y) };
  const bodyB = { id: 'bodyB', name: '身体·后', role: 'bodyBack', thick: p.bodyThick, smooth: false, poly: shift(bodyPoly, axis + midGap / 2 + bb.w / 2 - bb.x, row3Y - bb.y) };
  pieces.push(bodyF, bodyB);
  // ---- 围条（侧围）：头和身体各一条，长度 = 轮廓周长，宽度 = 厚度；太长，对半剪成两段，每段中点有对位记号 ----
  const perim = (poly) => poly.reduce((n, q, i) => n + Math.hypot(q[0] - poly[(i + 1) % poly.length][0], q[1] - poly[(i + 1) % poly.length][1]), 0);
  const headPer = perim(headFull), bodyPer = perim(bodyPoly), stripY = Math.max(...pieces.map((q) => C.boxOfPoly(q.poly).y + C.boxOfPoly(q.poly).h)) + 56;
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const strips = [], marks = [];
  const mkStrip = (id, name, role, len, w, x, y) => { strips.push({ id, name, role, poly: rect(x, y, len, w), smooth: false }); marks.push({ piece: id, x: x + len / 2, y, dir: -1 }); return len; };
  const hl = headPer / 2, bl = bodyPer / 2, sx0 = m;
  mkStrip('gH1', '头围条 ①（上半圈）', 'gussetHead', hl, p.headThick, sx0, stripY);
  mkStrip('gH2', '头围条 ②（下半圈）', 'gussetHead', hl, p.headThick, sx0, stripY + p.headThick + 30);
  mkStrip('gB1', '身体围条 ①（上半圈）', 'gussetBody', bl, p.bodyThick, sx0 + hl + 60, stripY);
  mkStrip('gB2', '身体围条 ②（下半圈）', 'gussetBody', bl, p.bodyThick, sx0 + hl + 60, stripY + p.bodyThick + 30);
  pieces.push(...strips);
  // 缝合表：每条缝两边的长度（图纸像素），检查时换成毫米比较
  const cutLen = Math.hypot(halfL[0][0] - halfL[halfL.length - 1][0], halfL[0][1] - halfL[halfL.length - 1][1]);
  const arcLen = perim(halfL) - cutLen;
  const seams = [
    { name: '头围条 ↔ 脸片外圈', a: perim(face.poly), b: hl * 2 },
    { name: '头围条 ↔ 后脑两半外圈', a: arcLen * 2, b: hl * 2 },
    { name: '后脑左右两半的中线缝', a: cutLen, b: cutLen },
    { name: '身体围条 ↔ 身体前片', a: perim(bodyF.poly), b: bl * 2 },
    { name: '身体围条 ↔ 身体后片', a: perim(bodyB.poly), b: bl * 2 },
  ];
  const all = bounds(pieces.map((q) => q.poly)), W = Math.max(W0, all.x1 + m), H = all.y1 + m;
  const pairs = { backL: 'backR', backR: 'backL', earLF: 'earRF', earRF: 'earLF', earLB: 'earRB', earRB: 'earLB' };
  if (armL) Object.assign(pairs, { armLF: 'armRF', armRF: 'armLF', armLB: 'armRB', armRB: 'armLB' });
  // 脸窗和眼嘴参考框（学球豆体：眼睛一条宽框，嘴一个小框）
  const fcx = faceCx, fcy = faceCy, lens = shift(superellipse(0, b * 0.22, a * 0.8, b * 0.66, 2.4, 80), fcx, fcy);
  const guides = {
    lens,
    eyeL: [[fcx - a * 0.7, fcy + b * 0.02], [fcx - a * 0.08, fcy + b * 0.02], [fcx - a * 0.08, fcy + b * 0.36], [fcx - a * 0.7, fcy + b * 0.36]],
    eyeR: [[fcx + a * 0.08, fcy + b * 0.02], [fcx + a * 0.7, fcy + b * 0.02], [fcx + a * 0.7, fcy + b * 0.36], [fcx + a * 0.08, fcy + b * 0.36]],
    mouth: [[fcx - a * 0.1, fcy + b * 0.46], [fcx + a * 0.1, fcy + b * 0.46], [fcx + a * 0.1, fcy + b * 0.62], [fcx - a * 0.1, fcy + b * 0.62]],
    notches: [{ piece: 'face', x: fcx, y: fcy - b, dir: -1 }, { piece: 'face', x: fcx, y: fcy + b, dir: 1 }, ...marks],
  };
  return { id: 'custom-body', name: '自创体子（球豆体 · 扁平）', w: Math.ceil(W), h: Math.ceil(H), axis, faceWidthPx: p.headW, flat: true, custom: true, note: '自己调的扁平 2.5D 体子：头和身体都是前片 + 后片 + 一条围条（侧围）缝出厚度，耳朵和手臂是扁片。', params: p, pieces, pairs, guides, seams, sewing: sewingSteps(p) };
}

root.NunuBody = { DEFAULTS, EAR_TYPES, earLabel, generate };
if (typeof module !== 'undefined' && module.exports) module.exports = root.NunuBody;
})(typeof window === 'undefined' ? globalThis : window);
