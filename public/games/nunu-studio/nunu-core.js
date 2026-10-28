/* 努努赛博定制台 · 核心（纯算法，不碰页面）
 * 图样用「公开努努图纸」的真实裁片（pattern-data.js），每一片按它的「用途」贴到 3D 裸娃的某个位置：
 *   图纸像素 (x,y) ⇄ 3D 方向，一一对应，所以图样上画一笔 3D 上就有，反过来也一样。
 * 这里放：用途表、图纸坐标 ⇄ 3D 方向、能画的区域（守卫）、备料单、导出前检查。 */
(function (root) {
'use strict';
const Shape = root.NunuShape;
const TAU = Math.PI * 2, D2R = Math.PI / 180;

/* ============ 用途表：每一片贴在 3D 的哪里 ============ */
/* target：贴在哪个部件上；cap = 以正前方为中心的圆形盖（脸）；box = 把裁片外接框展成经纬度的一块（phi 经度，theta 从头顶数的纬度）
 * 经度 phi：0 是正前，90 度是画面右边，180 度是正后；u 从左到右增加就是 phi 增加（从外面看这片）。off：比底层多凸出去多少，免得和底层打架。 */
const HEAD_OFF = 0.02;
const BOARD_CAP = 76; // 前发画板的圆盘边缘离正前方多少度（脸盖是 64，画板大一圈，前发可以盖到脸盖外面） // 头上的片都贴在同一层，拼起来才是连续的
const ROLES = {
  none: { label: '不上 3D', material: 'skin', target: null },
  face: { label: '脸', material: 'skin', target: 'head', kind: 'cap', alpha: 64, off: HEAD_OFF, face: true },
  // 脸圆片外面一圈：上面的大月牙缝在脸的上半圈（头顶发），带凸起的月牙缝在脸的下半圈（下巴，凸起接身体前片）
  hairTop: { label: '头顶发', material: 'hair', target: 'head', kind: 'band', psi: [190, -10], off: HEAD_OFF },
  chin: { label: '下巴', material: 'skin', target: 'head', kind: 'band', psi: [215, 325], off: HEAD_OFF },
  // 两片大叶子是后脑：黄边互相缝在一起（后脑正中），红边缝头顶发，下边接身体后片
  backL: { label: '后脑·左', material: 'hair', target: 'head', kind: 'leaf', sign: -1, off: HEAD_OFF },
  backR: { label: '后脑·右', material: 'hair', target: 'head', kind: 'leaf', sign: 1, off: HEAD_OFF },
  // 身体、耳朵、手臂：前后两片对折缝合成扁扁的一个袋子，袋子的轮廓就是裁片的轮廓（身体片自带两条腿）
  bodyFront: { label: '身体·前', material: 'skin', target: 'pillow', kind: 'pillow', group: 'body', side: 1 },
  bodyBack: { label: '身体·后', material: 'skin', target: 'pillow', kind: 'pillow', group: 'body', side: -1 },
  earLF: { label: '左耳·前', material: 'skin', target: 'pillow', kind: 'pillow', group: 'earL', side: 1 },
  earLB: { label: '左耳·后', material: 'skin', target: 'pillow', kind: 'pillow', group: 'earL', side: -1 },
  earRF: { label: '右耳·前', material: 'skin', target: 'pillow', kind: 'pillow', group: 'earR', side: 1 },
  earRB: { label: '右耳·后', material: 'skin', target: 'pillow', kind: 'pillow', group: 'earR', side: -1 },
  armLF: { label: '左臂·前', material: 'skin', target: 'pillow', kind: 'pillow', group: 'armL', side: 1 },
  armLB: { label: '左臂·后', material: 'skin', target: 'pillow', kind: 'pillow', group: 'armL', side: -1 },
  armRF: { label: '右臂·前', material: 'skin', target: 'pillow', kind: 'pillow', group: 'armR', side: 1 },
  armRB: { label: '右臂·后', material: 'skin', target: 'pillow', kind: 'pillow', group: 'armR', side: -1 },
};
const ROLE_KEYS = Object.keys(ROLES);

/** 3D 里的部件：椭球 + 位置 + 绕 z 转多少。单位随便，只要比例好看 */
const TARGETS = {
  head: { r: [1.5, 1.4, 1.45], pos: [0, 2.05, 0], rot: 0 },
};
/** 袋子（前后两片缝成的立体）在场景里放哪：anchor 是裁片外接框的哪个点放到 (x,y)；单位和头一致，1 个图纸像素 = UNIT_PER_PX */
const PILLOWS = {
  body: { x: 0, y: 0.78, anchor: 'top', z: 0, mirrorBack: true },
  // 手臂：D 形片带编号的那条直边（图纸上朝外的那条）缝在身体前/后片的侧边上，所以左边那一列的 D 片是画面右边的手
  armL: { attach: 'body', sign: 1, anchor: 'top', z: 0 },
  armR: { attach: 'body', sign: -1, anchor: 'top', z: 0 },
  earL: { x: -1.78, y: 2.1, anchor: 'center', z: 0.25 },
  earR: { x: 1.78, y: 2.1, anchor: 'center', z: 0.25 },
};
const PILLOW_ROUND = 0.35; // 袋子的鼓起程度：圆边半径 = 这个 × 裁片短边
const unitPerPx = (piece) => TARGETS.head.r[0] / (piece.faceWidthPx / 2);

/* ============ 几何小工具 ============ */
function inPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function boxOfPoly(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const areaOfPoly = (poly) => Math.abs(Shape.polygonArea(poly));
const smoothPoly = (poly) => Shape.smoothLoop(poly, 2);

/* ============ 文档：把图纸（模板）变成一份可以画的东西 ============ */
/** 模板 + 用户改过的用途 / 布 → doc。pieces 里每片带外接框、面积、镜像信息 */
function makeDoc(tpl, opts = {}) {
  const roles = opts.roles || {}, materials = opts.materials || {};
  const pieces = tpl.pieces.map((p, i) => {
    const poly = p.smooth === false ? p.poly : smoothPoly(p.poly);
    const role = ROLE_KEYS.includes(roles[p.id]) ? roles[p.id] : p.role || 'none';
    const material = materials[p.id] === 'hair' || materials[p.id] === 'skin' ? materials[p.id] : ROLES[role].material;
    const box = boxOfPoly(poly);
    return { id: p.id, index: i, label: labelOf(i), name: p.name, role, material, poly, box, area: areaOfPoly(poly), partner: (tpl.pairs || {})[p.id] || null, axis: box.x + box.w / 2, pxPerDeg: tpl.faceWidthPx / 2 / ROLES.face.alpha, faceWidthPx: tpl.faceWidthPx, edges: edgesOf(poly, box), rows: rowsOf(poly, box) };
  });
  const head = headModel(pieces);
  for (const p of pieces) p.head = head;
  return { id: tpl.id, name: tpl.name, w: tpl.w, h: tpl.h, axis: tpl.axis, faceWidthPx: tpl.faceWidthPx, scaleLabel: tpl.scaleLabel || '脸片宽度', imported: !!tpl.imported, pieces, head, guides: tpl.guides || null, byId: Object.fromEntries(pieces.map((p) => [p.id, p])) };
}
function labelOf(i) { return i < 20 ? String.fromCharCode(0x2460 + i) : `(${i + 1})`; }


/** 每一行（图纸的每个 y）上，片最左和最右在哪（后脑叶子用：从红边到黄边的位置按这一行的宽度算） */
function rowsOf(poly, box, n = 96) {
  const l = [], r = [];
  for (let i = 0; i <= n; i++) {
    const y = box.y + (box.h * Math.min(i, n - 0.001)) / n, xs = [];
    for (let k = 0; k < poly.length; k++) {
      const [x0, y0] = poly[k], [x1, y1] = poly[(k + 1) % poly.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
    }
    l.push(xs.length ? Math.min(...xs) : box.x); r.push(xs.length ? Math.max(...xs) : box.x + box.w);
  }
  return { l, r };
}

/** 头：脸盖（离正前方 64° 以内）+ 围脸的两圈（头顶发在上半圈、下巴在下半圈，厚度来自各自的图纸）+ 剩下的背面是两片后脑。
 * ringDelta(psi) = 沿脸的边走到 psi 角度（0 在右、90 在上）时，这一圈往外有多厚（度）；
 * phiEdge[θ] = 在纬度 θ 上，从正前方往后转多少度才碰到这一圈的外边（后脑叶子的红边就缝在这条线上） */
function headModel(pieces) {
  const hairTop = pieces.find((p) => p.role === 'hairTop'), chin = pieces.find((p) => p.role === 'chin');
  const depthAt = (p, u) => (p ? (lerpAt(p.edges.bot, u) - lerpAt(p.edges.top, u)) / p.pxPerDeg : 0);
  const ringDelta = (psi) => {
    const a = ((psi % 360) + 360) % 360;
    const up = hairTop && ROLES.hairTop.psi, down = chin && ROLES.chin.psi;
    if (hairTop && (a <= 190 || a >= 350)) return depthAt(hairTop, (190 - (a >= 350 ? a - 360 : a)) / 200);
    if (chin && a >= down[0] && a <= down[1]) return depthAt(chin, (a - down[0]) / (down[1] - down[0]));
    void up;
    return 0;
  };
  const phiEdge = [];
  for (let th = 0; th <= 180; th++) {
    let edge = 180;
    for (let ph = 0; ph <= 180; ph += 0.5) {
      const d = dirOf(ph, th), alpha = (Math.acos(Math.max(-1, Math.min(1, d[2]))) * 180) / Math.PI;
      if (alpha >= ROLES.face.alpha + ringDelta((Math.atan2(d[1], d[0]) * 180) / Math.PI)) { edge = ph; break; }
    }
    phiEdge.push(edge);
  }
  const open = phiEdge.map((e, i) => (e < 179.5 ? i : -1)).filter((i) => i >= 0);
  // 脖子洞：后脑叶子的下边（绿边）加上下巴的凸起，围成一圈接身体；洞的半径（离下极点多少度）由这一圈的周长定
  const leaves = pieces.filter((p) => ROLES[p.role] && ROLES[p.role].kind === 'leaf');
  const bottomW = leaves.reduce((n, p) => n + (p.rows.r[92] - p.rows.l[92]), 0);
  const pxPerDeg = (hairTop || chin || leaves[0] || { pxPerDeg: 2.5 }).pxPerDeg;
  const neck = leaves.length ? (bottomW * 1.45) / (2 * Math.PI) / pxPerDeg : 18;
  const thetaTop = open.length ? open[0] : 15, thetaBottom = Math.min(open.length ? open[open.length - 1] : 165, 180 - neck);
  return { ringDelta, phiEdge, thetaTop, thetaBottom, neck };
}

/** 月牙形的片：每个 x 位置上，片的最上边和最下边在哪（用来量「离缝在脸上的那条边多深」）。n 个采样 */
function edgesOf(poly, box, n = 96) {
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const x = box.x + (box.w * Math.min(i, n - 0.001)) / n, ys = [];
    for (let k = 0; k < poly.length; k++) {
      const [x0, y0] = poly[k], [x1, y1] = poly[(k + 1) % poly.length];
      if ((x0 <= x && x1 > x) || (x1 <= x && x0 > x)) ys.push(y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
    }
    top.push(ys.length ? Math.min(...ys) : box.y); bot.push(ys.length ? Math.max(...ys) : box.y);
  }
  return { top, bot };
}
const lerpAt = (arr, u) => { const f = clamp01(u) * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(f)); return arr[i] + (arr[i + 1] - arr[i]) * (f - i); };

/** 一个点镜像到哪一片的哪里：有对子就去对面（轴取图纸中线），没有就在自己这片里左右翻 */
function mirrorOf(doc, pieceId, x, y) {
  const p = doc.byId[pieceId];
  if (!p) return null;
  if (p.partner && doc.byId[p.partner]) return { pieceId: p.partner, x: 2 * doc.axis - x, y };
  return { pieceId, x: 2 * p.axis - x, y };
}

/* ============ 图纸像素 ⇄ 3D 方向 ============ */
const dirOf = (phiDeg, thetaDeg) => {
  const ph = phiDeg * D2R, th = thetaDeg * D2R;
  return [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
};
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function capOf(piece) { const b = piece.box; return { cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2, ry: b.h / 2 }; }

/** 圆盖：外接框是椭圆，中心朝正前，边缘离正前 alpha 度（方位等距，圆贴上去还是圆） */
function capDir(piece, x, y, alpha) {
  const c = capOf(piece);
  const ex = (x - c.cx) / c.rx, ey = (y - c.cy) / c.ry, len = Math.hypot(ex, ey), r = Math.min(1, len);
  if (len < 1e-9) return [0, 0, 1];
  const a = r * alpha * D2R, s = Math.sin(a);
  return [(s * ex) / len, (-s * ey) / len, Math.cos(a)];
}
/** 后发画板：把后脑展开成一张长方形——左半是左后脑（红边在最左），右半是右后脑（红边在最右），黄边在正中；从上到下是纬度 */
function backDir(piece, x, y) {
  const b = piece.box, u = clamp01((x - b.x) / b.w), v = clamp01((y - b.y) / b.h), h = piece.head;
  const th = h.thetaTop + (h.thetaBottom - h.thetaTop) * v, edge = lerpAt(h.phiEdge, th / 180);
  const phi = u < 0.5 ? -(edge + (180 - edge) * (u / 0.5)) : 180 - (180 - edge) * ((u - 0.5) / 0.5);
  return dirOf(phi, th);
}

/** 裁片上的一点 → 单位方向（在它所属部件的椭球上）；这一片没有用途就返回 null。脸片这种圆盖用「方位等距」，圆贴上去还是圆 */
function pieceDir(piece, x, y) {
  if (piece.role === 'board') {
    if (piece.board === 'front') return capDir(piece, x, y, BOARD_CAP);
    if (piece.board === 'back') return backDir(piece, x, y);
    return null;
  }
  const role = ROLES[piece.role];
  if (!role || !role.target || role.kind === 'pillow') return null;
  if (role.kind === 'cap') return capDir(piece, x, y, role.alpha);
  const b = piece.box;
  const u = clamp01((x - b.x) / b.w), v = clamp01((y - b.y) / b.h);
  if (role.kind === 'leaf') {
    // 后脑的一片：从上到下是纬度，从红边（缝在围脸那一圈的外边上）到黄边（缝另一片后脑，正后方）是经度
    const h = piece.head, th = h.thetaTop + (h.thetaBottom - h.thetaTop) * v;
    const l = lerpAt(piece.rows.l, v), r = lerpAt(piece.rows.r, v), w = Math.max(1e-6, r - l);
    const t = clamp01((x - l) / w), edge = lerpAt(h.phiEdge, th / 180);
    const phi = role.sign < 0 ? -(edge + (180 - edge) * t) : 180 - (180 - edge) * t;
    return dirOf(phi, th);
  }
  if (role.kind === 'band') {
    // 围在脸圆盖外面的一圈：沿脸的边转一圈（psi），离脸的边越远（图纸上离最上边越远）就从正前方转得越远
    const depth = Math.max(0, y - lerpAt(piece.edges.top, u)), a = (ROLES.face.alpha + depth / piece.pxPerDeg) * D2R;
    const psi = (role.psi[0] + (role.psi[1] - role.psi[0]) * u) * D2R;
    return [Math.sin(a) * Math.cos(psi), Math.sin(a) * Math.sin(psi), Math.cos(a)];
  }
  return dirOf(role.phi[0] + (role.phi[1] - role.phi[0]) * u, role.theta[0] + (role.theta[1] - role.theta[0]) * v);
}

/** 方向 → 椭球上的点（再绕 z 转、平移；off 是往外凸多少） */
function targetPoint(targetKey, dir, off = 0) {
  const t = TARGETS[targetKey], k = 1 + off, c = Math.cos(t.rot), s = Math.sin(t.rot);
  const x = t.r[0] * dir[0] * k, y = t.r[1] * dir[1] * k, z = t.r[2] * dir[2] * k;
  return [t.pos[0] + x * c - y * s, t.pos[1] + x * s + y * c, t.pos[2] + z];
}
function targetNormal(targetKey, dir) {
  const t = TARGETS[targetKey], c = Math.cos(t.rot), s = Math.sin(t.rot);
  const x = dir[0] / t.r[0], y = dir[1] / t.r[1], z = dir[2] / t.r[2];
  const nx = x * c - y * s, ny = x * s + y * c, len = Math.hypot(nx, ny, z) || 1;
  return [nx / len, ny / len, z / len];
}


/** 手臂贴在身体侧边：D 形片的直边（编号边）朝身体，所以放在身体前片肩膀那一行的外沿；袋子从那里往外鼓、往下垂 */
function attachedAt(base, piece, doc, k) {
  const body = doc && doc.pieces.find((q) => q.role === 'bodyFront');
  const b = piece.box, bodyBox = body ? body.box : null, top = PILLOWS.body.y;
  let half = 0.9;
  if (body) {
    const y = bodyBox.y + bodyBox.h * 0.22, xs = [];
    for (let i = 0; i < body.poly.length; i++) {
      const [x0, y0] = body.poly[i], [x1, y1] = body.poly[(i + 1) % body.poly.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
    }
    if (xs.length) half = ((Math.max(...xs) - Math.min(...xs)) / 2) * k;
  }
  const drop = body ? bodyBox.h * 0.12 * k : 0.2;
  return { x: base.sign * (half + (b.w / 2) * k * 0.85), y: top - drop, anchor: base.anchor, z: base.z };
}

/** 袋子的网格：把一片裁片「充气」成立体的一面。离边越远鼓得越高（圆边），边上高度 0，所以前片和后片在轮廓上正好缝在一起。
 * 返回 { pos, uv, idx }，pos 是 [x,y,z,…] 场景坐标；uv 是外接框里的位置（正好对上这一片的画布）。后片左右翻过来，从背后看才是正的 */
function pillowMesh(piece, doc) {
  const role = ROLES[piece.role], base = role && PILLOWS[role.group];
  if (!base) return null;
  const b = piece.box, k = unitPerPx(piece), side = role.side, mx = base.mirrorBack ? side : 1;
  const pl = base.attach ? attachedAt(base, piece, doc, k) : base;
  const g = Math.max(2, Math.min(b.w, b.h) / 28), nx = Math.ceil(b.w / g) + 2, ny = Math.ceil(b.h / g) + 2;
  const x0 = b.x - g, y0 = b.y - g;
  const pad = 2, { bm } = Shape.rasterizePolygon(piece.poly, 1, pad);
  const inside = (x, y) => { const ix = Math.floor(x - b.x + pad + 1), iy = Math.floor(y - b.y + pad + 1); return ix >= 0 && iy >= 0 && ix < bm.w && iy < bm.h && bm.data[iy * bm.w + ix] === 1; };
  const out = new Uint8Array(bm.w * bm.h);
  for (let i = 0; i < out.length; i++) out[i] = bm.data[i] ? 0 : 1;
  const dist = Shape.distanceTo(out, bm.w, bm.h);
  const R = PILLOW_ROUND * Math.min(b.w, b.h);
  const heightAt = (x, y) => {
    const ix = Math.round(x - b.x + pad + 1), iy = Math.round(y - b.y + pad + 1);
    if (ix < 0 || iy < 0 || ix >= bm.w || iy >= bm.h || !bm.data[iy * bm.w + ix]) return 0;
    const d = Math.min(R, dist[iy * bm.w + ix]);
    return Math.sqrt(Math.max(0, R * R - (R - d) * (R - d)));
  };
  // 格子里有一点在片里面，这个格子就要
  const active = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let hit = false;
    for (let sy = 0; sy <= 2 && !hit; sy++) for (let sx = 0; sx <= 2 && !hit; sx++) hit = inside(x0 + (i + sx / 2) * g, y0 + (j + sy / 2) * g);
    active[j * nx + i] = hit ? 1 : 0;
  }
  const idxOf = new Int32Array((nx + 1) * (ny + 1)).fill(-1), pos = [], uv = [], idx = [];
  const ax = b.x + b.w / 2, ay = pl.anchor === 'top' ? b.y : b.y + b.h / 2;
  const vert = (i, j) => {
    const key = j * (nx + 1) + i;
    if (idxOf[key] >= 0) return idxOf[key];
    const x = x0 + i * g, y = y0 + j * g;
    pos.push(pl.x + (x - ax) * k * mx, pl.y - (y - ay) * k, pl.z + side * heightAt(x, y) * k);
    uv.push((x - b.x) / b.w, (y - b.y) / b.h);
    return (idxOf[key] = pos.length / 3 - 1);
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!active[j * nx + i]) continue;
    const a = vert(i, j), bb = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
    if (mx === side) idx.push(a, c, bb, bb, c, d); else idx.push(a, bb, c, bb, d, c);
  }
  return { pos, uv, idx };
}

/* ============ 守卫：哪里能画 ============ */
const LAYERS = ['face', 'skin', 'hair'];
const LAYER_NAMES = { face: '脸', skin: '彩绘', hair: '发片' };

/** 这一层能不能画在这一片上（只看层和布，不看位置） */
function layerRule(piece, layer) {
  // 发片画板：不是裁片，是一块自由画布；画在上面的每一块颜色自动变成黏在头顶的发片
  if (piece.role === 'board') return layer === 'hair' ? { ok: true } : { ok: false, reason: '发片画板只能画发片：先切到「发片」层。' };
  if (layer === 'face') {
    if (piece.role !== 'face') return { ok: false, reason: `「脸」只能画在脸片上（${piece.name}不是脸片）。` };
    return { ok: true };
  }
  if (layer === 'skin') {
    if (piece.material === 'hair') return { ok: false, reason: `${piece.name}是发片布，不画「彩绘」。要给发片上色，请切到「发片」层。` };
    return { ok: true };
  }
  // 后发（头顶发、后脑）是缝上去的发片布；前发直接做成贴布贴在脸片的额头上，所以脸片的额头那一块也能画发片
  if (piece.role === 'face') return { ok: false, reason: '前发不直接画在脸片上，它是脑袋上面另起的一层：把「发片画在」选成「前发」，画在前发发片画板上（3D 上也能直接画）。' };
  if (piece.material !== 'hair') return { ok: false, reason: `${piece.name}是肤色布，不是发片。「发片」层的「底布」只能涂在头顶发、后脑这类发片布裁片上；前发、后发、上面的发片请选对应的画板。` };
  return { ok: true };
}

/** 能画的区域（位图，1 格 = 图纸 1 像素）。脸只在脸窗里，彩绘和脸离缝线留 marginPx，发片整片都能涂（布色要涂满） */
function buildZone(doc, piece, layer, marginPx) {
  const src = layer === 'face' && doc.guides ? doc.guides.lens : piece.poly;
  const { bm } = Shape.rasterizePolygon(src, 1, 0);
  const b = boxOfPoly(src);
  const m = layer === 'hair' ? 0 : marginPx;
  const mask = m > 0 ? Shape.erode(bm, m) : bm;
  return { bx: b.x - 1, by: b.y - 1, w: mask.w, h: mask.h, data: mask.data };
}
function zoneAt(zone, x, y) {
  const ix = Math.floor(x - zone.bx), iy = Math.floor(y - zone.by);
  return ix >= 0 && iy >= 0 && ix < zone.w && iy < zone.h && zone.data[iy * zone.w + ix] === 1;
}
/** 区域的轮廓（用来当裁剪路径，画笔永远出不了界） */
function zoneLoops(zone) {
  const loops = Shape.traceContours({ w: zone.w, h: zone.h, data: zone.data });
  return loops.filter((l) => Math.abs(Shape.polygonArea(l)) >= 4).map((l) => Shape.simplifyLoop(l, 0.7).map(([x, y]) => [x + zone.bx, y + zone.by]));
}

/* ============ 把一张黑线白底的图纸图片拆成一片一片 ============ */
/** gray：每像素 0–255 的灰度；线是深色。返回 [{poly, box, area}]（图像像素坐标）。先把线加粗一点封住小缺口，再从四周灌水，剩下的连通块就是一片片的里面 */
function segmentPieces(gray, w, h, opts = {}) {
  const lineThr = opts.lineThr == null ? 190 : opts.lineThr, close = opts.close == null ? 2 : opts.close, minArea = opts.minArea || 900;
  const line = Shape.emptyBitmap(w, h);
  for (let i = 0; i < w * h; i++) line.data[i] = gray[i] < lineThr ? 1 : 0;
  const thick = Shape.dilate(line, close);
  const blocked = thick.data, seen = new Uint8Array(w * h), stack = [];
  const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = y * w + x; if (blocked[i] || seen[i]) return; seen[i] = 1; stack.push(i); };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) { const i = stack.pop(), x = i % w, y = (i / w) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
  const lab = new Int32Array(w * h);
  const out = [];
  let n = 0;
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || blocked[s] || lab[s]) continue;
    n++;
    const comp = [s];
    lab[s] = n;
    for (let k = 0; k < comp.length; k++) {
      const i = comp[k], x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const qx = x + dx, qy = y + dy;
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        const j = qy * w + qx;
        if (!seen[j] && !blocked[j] && !lab[j]) { lab[j] = n; comp.push(j); }
      }
    }
    if (comp.length < minArea) continue;
    const bm = Shape.emptyBitmap(w, h);
    for (const i of comp) bm.data[i] = 1;
    const grown = Shape.dilate(bm, close + 1);
    const loops = Shape.traceContours(grown).filter((l) => Shape.polygonArea(l) > 50);
    if (!loops.length) continue;
    loops.sort((a, b) => Shape.polygonArea(b) - Shape.polygonArea(a));
    const poly = Shape.simplifyLoop(loops[0], opts.eps || 2.2);
    out.push({ poly, box: boxOfPoly(poly), area: areaOfPoly(poly) });
  }
  // 面积大的在前；里面还包着别的块（比如脸里的眼睛框）就不单独算一片
  out.sort((a, b) => b.area - a.area);
  const kept = [];
  for (const c of out) {
    // 大部分点都落在一个更大的片里面，才算「包在里面的小框」（月牙形的中心点会落在邻居里，不能只看中心）
    const inside = (k) => c.poly.filter(([x, y]) => inPoly(k.poly, x, y)).length / c.poly.length > 0.7;
    if (kept.some((k) => k.area > c.area * 1.6 && inside(k))) continue;
    kept.push(c);
  }
  kept.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  return kept;
}

/** 导入的图纸：找出左右镜像的一对（面积差不多、中心关于图纸中线对称、高度差不多） */
function findPairs(pieces, axis, w, h) {
  const pairs = {};
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = pieces[i], b = pieces[j];
    if (pairs[a.id] || pairs[b.id]) continue;
    const ca = a.box.x + a.box.w / 2, cb = b.box.x + b.box.w / 2;
    if (Math.abs(a.area - b.area) / Math.max(a.area, b.area) > 0.08) continue;
    if (Math.abs(ca + cb - 2 * axis) > w * 0.03) continue;
    if (Math.abs(a.box.y + a.box.h / 2 - (b.box.y + b.box.h / 2)) > h * 0.04) continue;
    if (Math.abs(ca - cb) < w * 0.02) continue;
    pairs[a.id] = b.id; pairs[b.id] = a.id;
  }
  return pairs;
}

/** 导入的图片拆出来的片 → 一份模板。用途都先是「不上 3D」，由用户逐片选；比例按最大一片的宽度估 */
function templateFromPieces(id, name, pieces, w, h) {
  const list = pieces.map((p, i) => ({ id: `p${i + 1}`, name: `裁片 ${i + 1}`, role: 'none', poly: p.poly, area: p.area, box: p.box }));
  const axis = w / 2;
  const widest = Math.max(...list.map((p) => p.box.w));
  return { id, name, w, h, axis, faceWidthPx: widest, imported: true, scaleLabel: '最大一片的宽度', pieces: list.map(({ id: pid, name: pn, role, poly }) => ({ id: pid, name: pn, role, poly })), pairs: findPairs(list, axis, w, h), guides: null };
}

/** 三块发片画板（图样右边的空白区）。发片都是脑袋上面另起的一层，不是裁片，所以 role 是 board：
 *  前发：一个圆盘，中心朝正前，比脸盖大一圈（盖到 76°），上面描着脸盖和发际线当参考；贴在 3D 脑袋前面的一层
 *  后发：后脑展开的长方形，左右两半各对一片后脑，黄边在正中；贴在 3D 脑袋后面的一层
 *  上面：一块自由画布，画翘出脑袋的发片，黏在头顶
 * 返回 { boards:[…], strip:{x,y,w}, w, h }：strip 是画出来的发片裁片排版的起点 */
function makeBoards(doc) {
  const k = BOARD_CAP / ROLES.face.alpha, face = doc.pieces.find((p) => p.role === 'face');
  const fc = face ? capOf(face) : { cx: 585, cy: 300, rx: 160.7, ry: 153.9 };
  const rx = fc.rx * k, ry = fc.ry * k, gap = 30, x0 = doc.w + 30, y0 = 24;
  const make = (id, kind, name, x, y, w, h, poly, extra = {}) => ({ id, index: -1, label: '板', name, role: 'board', board: kind, material: 'skin', poly, box: { x, y, w, h }, area: w * h, partner: null, axis: x + w / 2, pxPerDeg: 1, faceWidthPx: doc.faceWidthPx, edges: null, rows: null, head: doc.head, ...extra });
  const ell = (cx, cy, a, b, n = 72) => Array.from({ length: n }, (_, i) => { const t = (i / n) * TAU; return [cx + a * Math.cos(t), cy + b * Math.sin(t)]; });
  const fw = Math.ceil(rx * 2), fh = Math.ceil(ry * 2), cx = x0 + fw / 2, cy = y0 + fh / 2;
  const front = make('board-front', 'front', '前发发片', x0, y0, fw, fh, ell(cx, cy, rx, ry), { faceCenter: [fc.cx, fc.cy], faceR: [fc.rx, fc.ry] });
  const topW = 480, topH = 260, top = make('board-top', 'top', '上面发片', x0, y0 + fh + gap, topW, topH, [[x0, y0 + fh + gap], [x0 + topW, y0 + fh + gap], [x0 + topW, y0 + fh + gap + topH], [x0, y0 + fh + gap + topH]]);
  const bx = x0 + Math.max(fw, topW) + gap, bw = 480, bh = 380, back = make('board-back', 'back', '后发发片', bx, y0, bw, bh, [[bx, y0], [bx + bw, y0], [bx + bw, y0 + bh], [bx, y0 + bh]]);
  const boards = [front, back, top];
  return { boards, strip: { x: bx, y: y0 + bh + gap, w: bw }, w: bx + bw + gap, h: Math.max(top.box.y + topH, y0 + bh) + gap };
}

/** 画布分辨率的位图（1 = 画了）→ 一块块的轮廓（图纸坐标）。box 是这张位图对应的图纸范围 */
function maskToPolys(bm, box, opts = {}) {
  const sx = box.w / bm.w, sy = box.h / bm.h;
  const loops = Shape.outerContours(bm, { minArea: opts.minArea == null ? 60 : opts.minArea, eps: opts.eps == null ? 1.1 : opts.eps, smooth: opts.smooth == null ? 1 : opts.smooth });
  return loops.map((l) => l.map(([x, y]) => [box.x + x * sx, box.y + y * sy]));
}
/** 一个多边形最粗的地方有多宽（里面能放下的最大圆的直径，图纸像素）：太细的发片剪不出来也缝不牢 */
function polyThickness(poly) {
  const { bm } = Shape.rasterizePolygon(poly, 1, 1), out = new Uint8Array(bm.w * bm.h);
  for (let i = 0; i < out.length; i++) out[i] = bm.data[i] ? 0 : 1;
  const d = Shape.distanceTo(out, bm.w, bm.h);
  let m = 0;
  for (let i = 0; i < d.length; i++) if (bm.data[i] && d[i] > m) m = d[i];
  return m * 2;
}
/** 把一堆发片裁片一行一行排到图样右边的空白区（x0 起，宽 width）。items: [{id, box}] → { pos: {id:{dx,dy}}, w, h } */
function packStrip(items, x0, y0, width, gap = 18) {
  const list = items.slice().sort((a, b) => b.box.h - a.box.h), pos = {};
  let x = x0, y = y0, rowH = 0, maxX = x0, maxY = y0;
  for (const it of list) {
    if (x > x0 && x + it.box.w > x0 + width) { x = x0; y += rowH + gap; rowH = 0; }
    pos[it.id] = { dx: x - it.box.x, dy: y - it.box.y };
    x += it.box.w + gap; rowH = Math.max(rowH, it.box.h);
    maxX = Math.max(maxX, x - gap); maxY = Math.max(maxY, y + rowH);
  }
  return { pos, w: maxX, h: maxY };
}

/* ============ 备料单、检查 ============ */
const FABRIC_WIDTH_CM = 110;
const mmPerPx = (doc, faceMm) => faceMm / doc.faceWidthPx;
const px2cm2 = (areaPx, mm) => (areaPx * mm * mm) / 100;
const roundUp5 = (v) => Math.max(10, Math.ceil(v / 5) * 5);

/** stats[id] = { coverage(0..1), colors:[{hex,frac}], faceInk, faceOutside, paintInk, hairInk }；opts.cutAreas[id] = 含缝份的面积（图纸像素²） */
function bom(doc, stats, opts) {
  const mm = mmPerPx(doc, opts.faceMm), skinHex = opts.skin || '#f1dfcd';
  let skinArea = 0, skinN = 0;
  const hairBy = new Map();
  const rows = [];
  for (const p of doc.pieces) {
    const cut = (opts.cutAreas && opts.cutAreas[p.id]) || p.area;
    const cm2 = px2cm2(cut, mm), st = stats[p.id] || {};
    let fabric, hex;
    if (p.material === 'skin') { skinArea += cm2; skinN++; fabric = '肤色布'; hex = skinHex; }
    else {
      // 发片布：整片涂满时，颜色就是主色；涂得不满或没涂，先不算颜色（检查里会提醒）。涂在上面的别的颜色是单独的发片，见下面 derived
      const base = st.coverage >= 0.9 && st.colors && st.colors[0] ? st.colors[0] : { hex: '#ece7dc', none: true };
      const e = hairBy.get(base.hex) || { hex: base.hex, area: 0, pieces: new Set(), none: !!base.none };
      e.area += cm2; e.pieces.add(p.label);
      hairBy.set(base.hex, e);
      fabric = '发片布'; hex = base.hex;
    }
    rows.push({ id: p.id, label: p.label, name: p.name, role: p.role, material: p.material, fabric, hex, w: p.box.w * mm, h: p.box.h * mm, cm2 });
  }
  // 画出来的发片（前发贴布、后发上的一缕一缕）：每一块是一片裁片，按颜色算布
  for (const d of opts.derived || []) {
    const cm2 = px2cm2(d.cutAreaPx, mm);
    const e = hairBy.get(d.hex) || { hex: d.hex, area: 0, pieces: new Set() };
    e.area += cm2; e.pieces.add(d.label);
    hairBy.set(d.hex, e);
    rows.push({ id: d.id, label: d.label, name: d.name, role: 'derived', material: 'hair', fabric: '发片布', hex: d.hex, w: d.cutBox.w * mm, h: d.cutBox.h * mm, cm2, derived: true });
  }
  const fabrics = [];
  if (skinN) fabrics.push({ label: '肤色布', hex: skinHex, pieces: skinN, areaCm2: skinArea, buyCm: roundUp5((skinArea * 1.3) / FABRIC_WIDTH_CM) });
  for (const e of hairBy.values()) if (!e.none) fabrics.push({ label: '发片布', hex: e.hex, pieces: e.pieces.size, areaCm2: e.area, buyCm: roundUp5((e.area * 1.3) / FABRIC_WIDTH_CM) });
  return { fabrics, rows, pieceCount: doc.pieces.length + (opts.derived || []).length, mmPerPx: mm };
}

function colorDist(a, b) {
  const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const x = p(a), y = p(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** 检查：error 挡住导出，warn 要点头，ok 是通过的 */
function checks(doc, stats, ctx = {}) {
  const out = [];
  const add = (level, text) => out.push({ level, text });
  let bad = false;
  for (const p of doc.pieces) {
    const st = stats[p.id] || {};
    if (p.material === 'skin' && p.role !== 'face' && (st.hairInk || 0) > 0) { bad = true; add('error', `备料错误：${p.label} ${p.name}是肤色布，上面却有发片的颜色。把它的布改成「发片布」，或擦掉这些颜色。`); }
    if (p.material === 'hair' && ((st.faceInk || 0) > 0 || (st.paintInk || 0) > 0)) { bad = true; add('error', `备料错误：${p.label} ${p.name}是发片布，上面却有脸或彩绘。发片布不能绣脸。`); }
    if (p.role !== 'face' && p.material !== 'hair' && (st.faceInk || 0) > 0) { bad = true; add('error', `${p.label} ${p.name}不是脸片，却有脸的笔画。`); }
  }
  for (const p of doc.pieces.filter((q) => q.material === 'hair')) {
    const st = stats[p.id] || {}, cov = st.coverage || 0;
    if (cov < 0.05) { add('warn', `${p.label} ${p.name}还没涂底色：它是缝在脑袋上的发片布，备料不知道买什么颜色。去「发片画在 → 底布」把它涂满。`); continue; }
    if (cov < 0.9) add('warn', `${p.label} ${p.name}只涂了 ${Math.round(cov * 100)}%，没涂的地方会露出底布。先用大笔刷把底色涂满，再在上面画别的颜色的发片。`);
    const n = (st.colors || []).length;
    if (n > 2) add('warn', `${p.label} ${p.name}用了 ${n} 种颜色：每一种都要单独裁一小块布再拼，缝起来会很碎。`);
  }
  for (const p of doc.pieces) {
    if (p.material !== 'hair' || !p.partner || p.id > p.partner) continue;
    const q = doc.byId[p.partner];
    if (!q || q.material !== 'hair') continue;
    const a = stats[p.id], b = stats[q.id];
    if (a && b && a.colors && b.colors && a.colors[0] && b.colors[0] && colorDist(a.colors[0].hex, b.colors[0].hex) > 60) add('warn', `${p.name}和${q.name}主色不一样，是故意的吗？`);
  }
  const face = doc.pieces.find((p) => p.role === 'face');
  if (face) {
    const st = stats[face.id] || {};
    if (st.hairAreaPx > 0 && (st.colors || []).length > 2) add('warn', `前发（脸片额头）用了 ${st.colors.length} 种颜色：每种都要单独剪一块贴布，贴起来会很碎。`);
    if (!(st.faceInk > 0)) add('warn', '脸还空着：在脸片的脸窗里画上眼睛和嘴。');
    else if ((st.faceOutside || 0) > 0.5) add('warn', `脸上有 ${Math.round(st.faceOutside * 100)}% 的笔画落在眼睛、嘴的参考框外面。位置偏了的话，缝出来脸会歪。`);
  }
  for (const d of ctx.derived || []) {
    if (d.thicknessMm < 4) add('warn', `${d.label}（${d.name}）最粗的地方只有 ${d.thicknessMm.toFixed(1)} mm，太细了，剪不出来也缝不牢。画粗一点，或者和旁边的合成一片。`);
    else if (d.areaMm2 < 40) add('warn', `${d.label}（${d.name}）只有 ${d.areaMm2.toFixed(0)} mm²，太小了，剪不出来。`);
  }
  const noRole = doc.pieces.filter((p) => p.role === 'none');
  if (noRole.length) add('warn', `${noRole.length} 片没有放到 3D 上（${noRole.slice(0, 4).map((p) => p.name).join('、')}${noRole.length > 4 ? '…' : ''}），在 3D 上看不到它们。去「图纸」页签给它们选个用途。`);
  const seen = new Map();
  for (const p of doc.pieces) if (p.role !== 'none') seen.set(p.role, [...(seen.get(p.role) || []), p.name]);
  for (const [role, names] of seen) if (names.length > 1) add('warn', `「${ROLES[role].label}」这个位置上同时放了 ${names.join('、')}，3D 上会叠在一起。`);
  if (ctx.guardOff > 0) add('warn', `有 ${ctx.guardOff} 笔是在「接缝保护」关掉的时候画的，可能压到缝份。`);
  if (!bad) add('ok', '没有备料错误：每片的布和上面的颜色对得上。');
  add('ok', `按脸片宽 ${ctx.faceMm || '?'} mm 缩放。图纸原图没有标尺，打印后请用 5 cm 校准尺量一下。`);
  return out;
}

const api = {
  TAU, ROLES, ROLE_KEYS, TARGETS, PILLOWS, PILLOW_ROUND, unitPerPx, LAYERS, LAYER_NAMES, FABRIC_WIDTH_CM,
  inPoly, boxOfPoly, areaOfPoly, smoothPoly, makeDoc, labelOf, mirrorOf,
  pieceDir, capOf, dirOf, targetPoint, targetNormal, pillowMesh,
  layerRule, buildZone, zoneAt, zoneLoops, segmentPieces, findPairs, templateFromPieces, maskToPolys, polyThickness, packStrip, makeBoards, capDir, backDir, BOARD_CAP,
  mmPerPx, px2cm2, bom, checks, colorDist,
};
root.NunuCore = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
