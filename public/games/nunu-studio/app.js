/* 努努赛博定制台 · 页面
 * 每一片裁片有自己的画布。图样和 3D 都从这块画布取图：在哪边画，笔画都落在这块画布上，两边立刻都看得到。
 * 画笔之前先过「守卫」：脸只能画在脸片的脸窗里、发片层只能画在发片布上、离缝线太近的地方不让画、没裁片盖着的地方画不上。
 * 备料单和检查从画布里数出来（发片涂了几成、几种颜色），发片布上画了脸、肤色布上涂了发色，都会被拦下来。 */
(function () {
'use strict';
const C = window.NunuCore, Shape = window.NunuShape, P = window.NunuPattern;
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const clone = (x) => JSON.parse(JSON.stringify(x));
const r1 = (v) => Math.round(v * 10) / 10;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/** 按住画布拖到外面也继续收到事件（有些环境里没有这个指针，别因此中断） */
const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch { /* 没有也行 */ } };
const RES = 2; // 每个图纸像素用几个画布像素

/* ============ 状态 ============ */
const STORE = 'nunu-v4', IMPORTS = 'nunu-v4-imports';
const DEFAULTS = {
  version: 4, name: '我的第一只努努', template: 'nunu-public', faceMm: 100, seamMm: 6, guardMm: 3, skin: '#f1dfcd',
  hairPalette: [], inkPalette: [], tplData: {},
};
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && s.version === 4) return { ...clone(DEFAULTS), ...s, tplData: s.tplData || {} };
  } catch { /* 读不出来就用新的 */ }
  return clone(DEFAULTS);
}
function loadImports() { try { const l = JSON.parse(localStorage.getItem(IMPORTS)); return Array.isArray(l) ? l : []; } catch { return []; } }
let state = loadState();
let imports = loadImports();
const ui = { layer: 'face', tool: 'pen', ink: '#4b3939', hair: '#7d594a', autoFocus: true, hand: false, size: 3, mirror: true, seamGuard: true, zones: false, guides: true, seams: true, paint3d: true, hairTarget: 'front', tab: 'pattern', selected: '', hover: '' };
/** 画脸和彩绘用的色板：深色、棕、肤色/腮红、红橙黄、绿、蓝、紫、灰白，一共 35 种 */
const INK_COLORS = ['#1f1a1a', '#4b3939', '#6b4a3a', '#8a5a44', '#a8734f', '#c99a6b', '#f9d5b8', '#f7b5a0', '#f4c7c3', '#e9a3a0', '#e45d6f', '#c44569',
  '#d9443a', '#f08a4b', '#f2b84b', '#f4e06b', '#b7d37a', '#8aa86a', '#4f8a5b', '#2f6b5b', '#a8d8f0', '#6f8ec8', '#3f6bb5', '#2b3f8f',
  '#1f2a5c', '#c9b3e6', '#9a7bb5', '#6b4a96', '#ffffff', '#fffaf2', '#d9d6cf', '#a8a39a', '#6e6a63', '#3a3733', '#000000'];
/** 发片用的色板：黑灰白、棕、金发、红橙、粉、紫、蓝、绿，一共 36 种 */
const HAIR_COLORS = ['#1b1b1f', '#2f2a2a', '#474040', '#6e6a6a', '#9a9a9f', '#cfd0d4', '#f2f2f2', '#3b2a24', '#5a3b2e', '#7d594a', '#9b6e4f', '#b58a62',
  '#c9a35c', '#d9b99b', '#e7d3a1', '#f2e2b3', '#f6ecd0', '#8c2f2f', '#b5443a', '#d9663a', '#e89a4a', '#e7a8a0', '#f2b6c8', '#e86a9a', '#c43d7a',
  '#9a7bb5', '#6b4a96', '#4a3a7a', '#a8c8e8', '#6f9fd8', '#3f6bb5', '#2a2a4a', '#1f2a5c', '#a8d8b0', '#5fb08a', '#2f7a6a'];
const hairColors = () => [...HAIR_COLORS, ...state.hairPalette.filter((c) => !HAIR_COLORS.includes(c.toLowerCase()))];
const inkColors = () => [...INK_COLORS, ...(state.inkPalette || []).filter((c) => !INK_COLORS.includes(c.toLowerCase()))];
const SKINS = ['#f1dfcd', '#f2d3ce', '#dac4aa', '#d1ddc8', '#d4d9e8'];

const allTemplates = () => [P.public, ...imports];
const tplById = (id) => allTemplates().find((t) => t.id === id) || P.public;
const td = () => (state.tplData[state.template] ||= { roles: {}, materials: {}, strokes: [], cut: {} });

let doc = null, boards = [], boardLayout = null;
const allPieces = () => [...doc.pieces, ...boards];
const rt = {}; // 每片的运行时：图层画布、合成画布、遮罩、区域缓存
const mm = () => C.mmPerPx(doc, state.faceMm);
const guardPx = () => (ui.seamGuard ? state.guardMm / mm() : 0);
const sizePx = () => ui.size / mm();

function buildDoc(keepRuntime) {
  if (state.template !== (doc && doc.id) && !allTemplates().some((t) => t.id === state.template)) state.template = P.public.id;
  const tpl = tplById(state.template), d = td();
  doc = C.makeDoc(tpl, { roles: d.roles, materials: d.materials });
  if (!keepRuntime) for (const k of Object.keys(rt)) delete rt[k];
  for (const p of doc.pieces) {
    const r = rt[p.id];
    if (r && r.sig !== sigOf(p)) delete rt[p.id];
  }
  for (const p of doc.pieces) ensureRt(p);
  // 发片画板：放在图样右边的空白处，不是裁片
  boardLayout = C.makeBoards(doc);
  boards = boardLayout.boards;
  for (const b of boards) {
    if (rt[b.id] && rt[b.id].sig !== sigOf(b)) delete rt[b.id];
    doc.byId[b.id] = b;
    ensureRt(b);
    layerCanvas(b, 'hair');
  }
  cutCache.clear();
}
const sigOf = (p) => `${p.box.x.toFixed(1)},${p.box.y.toFixed(1)},${p.box.w.toFixed(1)},${p.box.h.toFixed(1)},${p.poly.length}`;
function ensureRt(p) {
  if (rt[p.id]) return rt[p.id];
  const cw = Math.max(8, Math.round(p.box.w * RES)), ch = Math.max(8, Math.round(p.box.h * RES));
  const mk = () => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c; };
  const poly2d = new Path2D();
  p.poly.forEach(([x, y], i) => (i ? poly2d.lineTo(x, y) : poly2d.moveTo(x, y)));
  poly2d.closePath();
  return (rt[p.id] = { sig: sigOf(p), cw, ch, layers: {}, comp: mk(), mk, poly2d, zones: {}, overlay: {}, mask: null });
}
const layerCanvas = (p, layer) => { const r = ensureRt(p); return (r.layers[layer] ||= r.mk()); };
/** 画布上用图纸坐标画：把图纸像素换算成这片画布的像素 */
function applyTf(ctx, p) {
  const r = rt[p.id], sx = r.cw / p.box.w, sy = r.ch / p.box.h;
  ctx.setTransform(sx, 0, 0, sy, -p.box.x * sx, -p.box.y * sy);
}
const strokesOf = (id, layer) => td().strokes.filter((s) => s.p === id && (!layer || s.l === layer));

/* ============ 提示 ============ */
let toastTimer = 0;
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('bad', !!bad);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), bad ? 2800 : 2200);
}
let lastBlockToast = 0;
function toastBlocked(reason) {
  const now = performance.now(), hint = $('#layerHint');
  hint.textContent = '✋ ' + reason;
  hint.classList.add('blocked');
  clearTimeout(toastBlocked.t);
  toastBlocked.t = setTimeout(() => { hint.classList.remove('blocked'); updateHint(); }, 3000);
  if (now - lastBlockToast > 1800) { toast(reason, true); lastBlockToast = now; }
}
const HAIR_HINT = {
  front: '前发：脑袋上另起的一层，贴在脸前面。在前发画板（图样右边的圆盘）或者直接在 3D 脸上画前发的形状；蓝色虚线是脸盖和发际线。每一块颜色会变成一片发片裁片，粘上去。',
  back: '后发：脑袋上另起的一层，贴在后脑上。在后发画板（正中是后脑正中的黄边缝线，左右各一片后脑）或者直接在 3D 后脑上画。每一块颜色变成一片发片裁片，缝上去。',
  top: '上面发片：翘出脑袋的发片（刺猬头那种）。在图样右边的「上面发片」画板上自由画，每一块颜色变成发片裁片，黏在头顶，3D 上立在头上。',
  base: '底布：头顶发、后脑这两片是缝在脑袋上的发片布，在这里把它们的底色涂满（涂满的主色就是布色）。',
};
/** 把图样对准一块区域：脸 → 脸片；发片 → 当前选的那块发片画板（底布则是头顶发和后脑）；彩绘 → 整张图纸；全局 → 全部 */
function focusRect(kind) {
  if (!sheet || !doc) return;
  const pad = 36, fit = (b) => sheet.fitRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
  if (kind === 'all') sheet.fit();
  else if (kind === 'pattern') sheet.fitRect(0, 0, doc.w, doc.h);
  else if (kind === 'face') { const f = doc.pieces.find((q) => q.role === 'face'); if (f) fit(f.box); else sheet.fit(); }
  else if (kind === 'hair') {
    const bd = boards.find((q) => q.board === ui.hairTarget);
    if (bd) fit({ x: bd.box.x, y: bd.box.y - 18, w: bd.box.w, h: bd.box.h + 18 });
    else {
      const hp = doc.pieces.filter((q) => q.material === 'hair');
      if (!hp.length) { sheet.fit(); markSheet(); return; }
      const x0 = Math.min(...hp.map((q) => q.box.x)), y0 = Math.min(...hp.map((q) => q.box.y)), x1 = Math.max(...hp.map((q) => q.box.x + q.box.w)), y1 = Math.max(...hp.map((q) => q.box.y + q.box.h));
      fit({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  markSheet();
}
const focusFor = (layer) => (layer === 'face' ? 'face' : layer === 'hair' ? 'hair' : 'pattern');
function setHairTarget(t) {
  ui.hairTarget = t;
  if (ui.autoFocus && ui.layer === 'hair' && sheet) focusRect('hair');
  $$('[data-target]').forEach((x) => x.classList.toggle('on', x.dataset.target === t));
  updateHint();
}
/** 3D 上点哪些东西：发片层选了前发 / 后发，就只认那一层；其他情况只认裁片（发片画板不挡着画脸） */
function pickFilter(piece) {
  const isBoard = piece.role === 'board';
  if (ui.layer === 'hair' && ui.hairTarget !== 'base') return isBoard && piece.board === ui.hairTarget;
  return !isBoard;
}
function updateHint() {
  const h = $('#layerHint');
  if (h.classList.contains('blocked')) return;
  const g = ui.seamGuard ? `，离缝线留 ${state.guardMm} mm` : '（接缝保护已关，压到缝份的笔画会在检查里标出来）';
  const sel = doc && doc.byId[ui.selected];
  const info = sel ? (sel.role === 'board' ? `　选中：${sel.name}画板` : `　选中：${sel.label} ${sel.name}（${sel.material === 'hair' ? '发片布' : '肤色布'}，用途：${C.ROLES[sel.role].label}）`) : '';
  h.textContent = {
    face: `脸：只能画在脸片的脸窗里（蓝色虚线框住的那块）${g}。额头、边上点了也画不上。`,
    skin: `彩绘：腮红、花纹，画在肤色布的裁片上${g}。发片布不画彩绘。`,
    hair: HAIR_HINT[ui.hairTarget],
  }[ui.layer] + info;
}

/* ============ 区域（守卫） ============ */
function zoneOf(p, layer) {
  const r = ensureRt(p), key = `${layer}|${guardPx().toFixed(2)}`;
  if (!r.zones[key]) {
    const zone = C.buildZone(doc, p, layer, guardPx());
    const path = new Path2D();
    for (const loop of C.zoneLoops(zone)) { loop.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y))); path.closePath(); }
    r.zones[key] = { zone, path };
  }
  return r.zones[key];
}
/** 这一点能不能画；不能的话说为什么 */
function pointCheck(p, layer, x, y, erase) {
  const rule = C.layerRule(p, layer);
  if (!rule.ok) return { ok: false, reason: rule.reason };
  if (!C.inPoly(p.poly, x, y)) return { ok: false, reason: '', quiet: true };
  if (erase) return { ok: true };
  if (C.zoneAt(zoneOf(p, layer).zone, x, y)) return { ok: true };
  // 发片布整片都能涂：在多边形里却被区域挡住，只是边缘差一个像素，不用提示
  if (layer === 'hair' && p.material === 'hair') return { ok: false, reason: '', quiet: true };
  if (layer === 'face') return { ok: false, reason: '脸只能画在脸窗里（蓝色虚线框住的那块），额头和边上不行。' };
  if (layer === 'hair' && p.role === 'face') return { ok: false, reason: '前发只能画在额头上（蓝色虚线弧线以上）。弧线以下是脸窗，留给眼睛和嘴。' };
  return { ok: false, reason: `离缝线太近了（要留 ${state.guardMm} mm 缝份），往里一点。` };
}

/* ============ 画笔 ============ */
function paintStroke(p, layer, st, fromIdx) {
  const cv = layerCanvas(p, layer), ctx = cv.getContext('2d'), pts = st.pts;
  ctx.save();
  applyTf(ctx, p);
  ctx.clip(st.e || st.x ? rt[p.id].poly2d : zoneOf(p, layer).path, st.e || st.x ? 'nonzero' : 'evenodd');
  ctx.globalCompositeOperation = st.e ? 'destination-out' : 'source-over';
  ctx.strokeStyle = ctx.fillStyle = st.c;
  ctx.lineWidth = st.w;
  ctx.lineCap = ctx.lineJoin = 'round';
  const start = Math.max(0, fromIdx);
  if (pts.length === 2 && start === 0) {
    ctx.beginPath(); ctx.arc(pts[0], pts[1], st.w / 2, 0, C.TAU); ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[start], pts[start + 1]);
    if (start + 2 >= pts.length) ctx.lineTo(pts[start] + 0.001, pts[start + 1]);
    for (let i = start + 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
  }
  ctx.restore();
}
function replayLayer(p, layer) {
  const r = ensureRt(p);
  const list = strokesOf(p.id, layer);
  if (!list.length && !r.layers[layer]) return;
  const cv = layerCanvas(p, layer);
  cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
  for (const st of list) if (st.pts.length >= 2) paintStroke(p, layer, st, 0);
}
function replayAll() { for (const p of allPieces()) for (const l of C.LAYERS) replayLayer(p, l); }

const history = [], redoStack = [];
let strokeSeq = 0;
/** 每一笔有个编号：撤销记录按编号存进浏览器，刷新页面以后还能撤销（包括橡皮擦） */
function nextStrokeId() {
  if (!strokeSeq) for (const t of Object.values(state.tplData)) for (const st of t.strokes) strokeSeq = Math.max(strokeSeq, st.n || 0);
  return ++strokeSeq;
}
function restoreHistory() {
  const byN = new Map(td().strokes.filter((st) => st.n).map((st) => [st.n, st]));
  for (const ids of state.hist || []) { const g = ids.map((n) => byN.get(n)).filter(Boolean); if (g.length) history.push(g); }
}
let cur = null;

function startStroke(src, layer) {
  const erase = ui.tool === 'eraser';
  cur = {
    src, layer, erase, color: layer === 'hair' ? ui.hair : ui.ink, w: sizePx(), guardOff: !ui.seamGuard,
    tracks: [{ mirror: false, pieceId: '', stroke: null, last: null }], group: [], touched: new Set(),
  };
  if (ui.mirror) cur.tracks.push({ mirror: true, pieceId: '', stroke: null, last: null });
}
/** 把指针现在落在的点 {pieceId,x,y} 喂给画笔：每个点先过守卫，过不了就断笔（下一个能画的点重新起笔） */
function feed(hit) {
  if (!cur) return;
  let blocked = '';
  for (const tr of cur.tracks) {
    let pid = hit.pieceId, x = hit.x, y = hit.y;
    if (tr.mirror) { const m = C.mirrorOf(doc, pid, x, y); if (!m) continue; pid = m.pieceId; x = m.x; y = m.y; }
    const p = doc.byId[pid];
    if (!p) continue;
    const chk = pointCheck(p, cur.layer, x, y, cur.erase);
    if (!chk.ok) {
      tr.stroke = null; tr.last = null;
      if (!tr.mirror && !blocked) blocked = chk.reason;
      continue;
    }
    if (tr.pieceId !== pid) { tr.stroke = null; tr.last = null; tr.pieceId = pid; }
    if (!tr.stroke) {
      tr.stroke = { n: nextStrokeId(), p: pid, l: cur.layer, c: cur.color, w: cur.w, e: cur.erase, x: cur.guardOff ? 1 : 0, pts: [] };
      td().strokes.push(tr.stroke);
      cur.group.push(tr.stroke);
    }
    const from = tr.stroke.pts.length >= 2 ? tr.stroke.pts.length - 2 : 0;
    tr.stroke.pts.push(r1(x), r1(y));
    paintStroke(p, cur.layer, tr.stroke, tr.stroke.pts.length === 2 ? 0 : from);
    cur.touched.add(pid);
    markPiece(pid);
  }
  if (blocked) toastBlocked(blocked);
}
function breakStroke() { if (cur) for (const tr of cur.tracks) { tr.stroke = null; tr.last = null; } }
function endStroke() {
  if (!cur) return;
  const c = cur;
  cur = null;
  if (c.group.length) {
    history.push(c.group);
    if (history.length > 80) history.shift();
    redoStack.length = 0;
    afterChange();
  }
}
function undo() {
  const g = history.pop();
  if (!g) { toast('没有可以撤销的了'); return; }
  const arr = td().strokes;
  for (const st of g) { const i = arr.indexOf(st); if (i >= 0) arr.splice(i, 1); }
  redoStack.push(g);
  refreshStrokes(g);
}
function redo() {
  const g = redoStack.pop();
  if (!g) { toast('没有可以重做的了'); return; }
  td().strokes.push(...g);
  history.push(g);
  refreshStrokes(g);
}
function refreshStrokes(g) {
  const seen = new Set();
  for (const st of g) { const k = st.p + '|' + st.l; if (seen.has(k)) continue; seen.add(k); const p = doc.byId[st.p]; if (p) { replayLayer(p, st.l); markPiece(p.id); } }
  afterChange();
}
function afterChange() { scheduleStats(); scheduleSave(); }

/* ============ 合成：每片一块画布，图样和 3D 都用它 ============ */
function overlayOf(p) {
  const r = ensureRt(p), rule = C.layerRule(p, ui.layer), key = `${ui.layer}|${guardPx().toFixed(2)}|${rule.ok}`;
  if (!r.overlay[key]) {
    const cv = r.mk(), c = cv.getContext('2d');
    applyTf(c, p);
    c.fillStyle = 'rgba(205,70,70,.4)';
    c.fill(r.poly2d);
    if (rule.ok) { c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.fill(zoneOf(p, ui.layer).path, 'evenodd'); }
    r.overlay = { [key]: cv };
  }
  return r.overlay[key];
}
/** 画板上的参考线：前发画板描着脸盖和发际线；后发画板标着正中的黄边缝线、顶和脖子 */
function boardGuides(c, b) {
  c.save();
  c.setLineDash([6, 5]);
  c.lineWidth = 1.7;
  c.strokeStyle = 'rgba(70,120,170,.75)';
  c.fillStyle = 'rgba(70,120,170,.8)';
  c.font = '600 12px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  if (b.board === 'front') {
    const cx = b.box.x + b.box.w / 2, cy = b.box.y + b.box.h / 2, [fx, fy] = b.faceCenter, [rx, ry] = b.faceR;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, C.TAU); c.stroke();
    if (doc.guides) { c.beginPath(); doc.guides.lens.forEach(([x, y], i) => (i ? c.lineTo(cx + x - fx, cy + y - fy) : c.moveTo(cx + x - fx, cy + y - fy))); c.closePath(); c.stroke(); }
    c.setLineDash([]);
    c.textAlign = 'center';
    c.fillText('脸盖', cx, cy + ry - 8);
    c.fillText('发际线', cx, cy - 18);
  } else if (b.board === 'back') {
    const mx = b.box.x + b.box.w / 2;
    c.strokeStyle = 'rgba(190,150,40,.9)';
    c.beginPath(); c.moveTo(mx, b.box.y); c.lineTo(mx, b.box.y + b.box.h); c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(150,115,20,.9)';
    c.textAlign = 'center';
    c.fillText('后脑正中（黄边缝线）', mx, b.box.y + b.box.h - 8);
    c.fillText('头顶', mx, b.box.y + 34);
    c.textAlign = 'left'; c.fillText('左后脑', b.box.x + 8, b.box.y + 34);
    c.textAlign = 'right'; c.fillText('右后脑', b.box.x + b.box.w - 8, b.box.y + 34);
  }
  c.restore();
}
function compose(p) {
  const r = ensureRt(p), cv = r.comp, c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  applyTf(c, p);
  c.save();
  c.clip(r.poly2d);
  c.fillStyle = p.role === 'board' ? '#fbfaf3' : p.material === 'hair' ? '#ece7dc' : state.skin;
  c.fillRect(p.box.x - 2, p.box.y - 2, p.box.w + 4, p.box.h + 4);
  for (const l of ['skin', 'face', 'hair']) if (r.layers[l]) c.drawImage(r.layers[l], p.box.x, p.box.y, p.box.w, p.box.h);
  if (p.role === 'board' && ui.guides) boardGuides(c, p);
  if (ui.guides && p.role === 'face' && doc.guides) {
    c.save();
    c.setLineDash([6, 5]);
    c.lineWidth = 1.7;
    c.strokeStyle = 'rgba(70,120,170,.8)';
    const path = (poly) => { c.beginPath(); poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke(); };
    path(doc.guides.lens); path(doc.guides.eyeL); path(doc.guides.eyeR); path(doc.guides.mouth);
    c.restore();
  }
  if (ui.zones) c.drawImage(overlayOf(p), p.box.x, p.box.y, p.box.w, p.box.h);
  if (p.id === ui.selected) { c.fillStyle = 'rgba(255,208,70,.26)'; c.fill(r.poly2d); }
  c.restore();
  if (ui.seams) {
    c.save();
    c.strokeStyle = 'rgba(70,64,52,.55)';
    c.lineWidth = 2.2;
    c.stroke(r.poly2d);
    c.restore();
  }
}

/* ============ 缝份（裁剪线） ============ */
const cutCache = new Map();
function cutPoly(p) {
  const d = state.seamMm / mm();
  if (d < 0.5) return p.poly;
  const key = `${p.id}|${d.toFixed(2)}`;
  if (!cutCache.has(key)) { for (const k of [...cutCache.keys()]) if (k.startsWith(p.id + '|')) cutCache.delete(k); cutCache.set(key, Shape.offsetPolygon(p.poly, d, 2)); }
  return cutCache.get(key);
}
const cutMap = () => Object.fromEntries(doc.pieces.map((p) => [p.id, cutPoly(p)]));

/* ============ 统计 → 备料 / 检查 ============ */
let stats = {}, report = null, statsTimer = 0;
function polyMask(p) {
  const r = ensureRt(p);
  if (!r.mask) {
    const cv = r.mk(), c = cv.getContext('2d');
    applyTf(c, p);
    c.fillStyle = '#000';
    c.fill(r.poly2d);
    const d = c.getImageData(0, 0, cv.width, cv.height).data, m = new Uint8Array(cv.width * cv.height);
    let n = 0;
    for (let i = 0; i < m.length; i++) if (d[i * 4 + 3] > 128) { m[i] = 1; n++; }
    r.mask = { m, n };
  }
  return r.mask;
}
const hexOf = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const rgbOf = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function scanLayer(p, layer) {
  const r = rt[p.id], cv = r && r.layers[layer];
  if (!cv || !strokesOf(p.id, layer).length) return null;
  const mask = polyMask(p), data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const buckets = new Map();
  let ink = 0, outside = 0;
  const sx = cv.width / p.box.w, sy = cv.height / p.box.h;
  const rects = layer === 'face' && doc.guides ? [doc.guides.eyeL, doc.guides.eyeR, doc.guides.mouth].map((q) => C.boxOfPoly(q)) : null;
  for (let y = 0; y < cv.height; y += 2) for (let x = 0; x < cv.width; x += 2) {
    const i = y * cv.width + x;
    if (!mask.m[i] || data[i * 4 + 3] < 128) continue;
    ink++;
    if (rects) {
      const gx = p.box.x + x / sx, gy = p.box.y + y / sy;
      if (!rects.some((q) => gx >= q.x - 12 && gx <= q.x + q.w + 12 && gy >= q.y - 12 && gy <= q.y + q.h + 12)) outside++;
    }
    if (layer === 'hair') {
      const k = ((data[i * 4] >> 5) << 6) | ((data[i * 4 + 1] >> 5) << 3) | (data[i * 4 + 2] >> 5);
      const b = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
      b.n++; b.r += data[i * 4]; b.g += data[i * 4 + 1]; b.b += data[i * 4 + 2];
      buckets.set(k, b);
    }
  }
  return { ink: ink * 4, outsideFrac: ink ? outside / ink : 0, buckets, sampled: ink, total: mask.n, areaPx: (ink * 4) / (sx * sy), data, cv, mask };
}
function dominantColors(buckets, sampled) {
  const list = [...buckets.values()].map((b) => ({ n: b.n, hex: hexOf(b.r / b.n, b.g / b.n, b.b / b.n) })).sort((a, b) => b.n - a.n);
  const merged = [];
  for (const b of list) {
    if (b.n / sampled < 0.04) continue;
    const hit = merged.find((m) => C.colorDist(m.hex, b.hex) < 48);
    if (hit) hit.n += b.n; else merged.push({ ...b });
  }
  const tot = merged.reduce((s, m) => s + m.n, 0) || 1;
  return merged.map((m) => {
    const pal = hairColors().find((h) => C.colorDist(h, m.hex) < 14);
    return { hex: pal ? pal.toLowerCase() : m.hex, frac: m.n / tot };
  });
}
/** 画在发片层上的颜色 → 一块块发片裁片。整片涂满的发片布，主色就是布色，只有别的颜色才是贴上去 / 缝上去的发片；脸片额头上的前发每种颜色都是一块贴布 */
function deriveHair(p, hair, st) {
  const cols = st.colors || [];
  if (!cols.length) return [];
  const full = p.material === 'hair' && st.coverage >= 0.9;
  if (full && cols.length === 1) return [];
  const want = cols.filter((c, i) => !(full && i === 0));
  if (!want.length) return [];
  const { data, cv, mask } = hair, rgbs = cols.map((c) => rgbOf(c.hex)), masks = new Map(want.map((c) => [c, Shape.emptyBitmap(cv.width, cv.height)]));
  for (let i = 0; i < mask.m.length; i++) {
    if (!mask.m[i] || data[i * 4 + 3] < 128) continue;
    let best = 0, bd = Infinity;
    for (let k = 0; k < rgbs.length; k++) { const dd = (rgbs[k][0] - data[i * 4]) ** 2 + (rgbs[k][1] - data[i * 4 + 1]) ** 2 + (rgbs[k][2] - data[i * 4 + 2]) ** 2; if (dd < bd) { bd = dd; best = k; } }
    const m = masks.get(cols[best]);
    if (m) m.data[i] = 1;
  }
  const out = [];
  for (const c of want) for (const poly of C.maskToPolys(masks.get(c), p.box, { minArea: 80 })) out.push({ from: p.id, hex: c.hex, poly });
  return out;
}
const cutMemo = new Map();
function cutOfPoly(poly, d) {
  if (d < 0.5) return poly;
  const key = `${poly.length}|${poly[0][0].toFixed(1)},${poly[0][1].toFixed(1)}|${C.areaOfPoly(poly).toFixed(0)}|${d.toFixed(2)}`;
  if (!cutMemo.has(key)) { if (cutMemo.size > 200) cutMemo.clear(); cutMemo.set(key, Shape.offsetPolygon(poly, d, 2)); }
  return cutMemo.get(key);
}
let derived = [], ext = { w: 0, h: 0 };
function computeStats() {
  const out = {}, found = [];
  for (const p of doc.pieces) {
    const st = {};
    const face = scanLayer(p, 'face'), skin = scanLayer(p, 'skin'), hair = scanLayer(p, 'hair');
    if (face) { st.faceInk = face.ink; st.faceOutside = face.outsideFrac; }
    if (skin) st.paintInk = skin.ink;
    if (hair) {
      st.hairInk = hair.ink;
      st.hairAreaPx = hair.areaPx;
      st.coverage = Math.min(1, (hair.sampled * 4) / Math.max(1, hair.total));
      st.colors = dominantColors(hair.buckets, hair.sampled);
      for (const d of deriveHair(p, hair, st)) found.push({ ...d, piece: p });
    } else { st.coverage = 0; st.colors = []; }
    out[p.id] = st;
  }
  for (const b of boards) {
    const bh = scanLayer(b, 'hair');
    if (bh) for (const d of deriveHair(b, bh, { coverage: 0, colors: dominantColors(bh.buckets, bh.sampled) })) found.push({ ...d, piece: b });
  }
  stats = out;
  // 画出来的发片：量大小、放缝份、排到图样右边的空白区
  const k = mm(), seamPx = state.seamMm / k, counter = {};
  derived = found.map((d, i) => {
    const n = (counter[d.from] = (counter[d.from] || 0) + 1), cut = cutOfPoly(d.poly, seamPx), area = C.areaOfPoly(d.poly);
    const name = d.piece.role === 'board' ? `${d.piece.name} ${n}` : `${d.piece.name}发片 ${n}`;
    return { id: `${d.from}.hair.${i}`, from: d.from, label: `发${i + 1}`, name, hex: d.hex, poly: d.poly, cut: cut, areaPx: area, areaMm2: area * k * k, thicknessMm: C.polyThickness(d.poly) * k, cutAreaPx: C.areaOfPoly(cut), box: C.boxOfPoly(d.poly), cutBox: C.boxOfPoly(cut), dx: 0, dy: 0, top: d.piece.board === 'top', layer: d.piece.board || '' };
  });
  const st0 = boardLayout.strip, pack = C.packStrip(derived.map((d) => ({ id: d.id, box: d.cutBox })), st0.x, st0.y, st0.w);
  for (const d of derived) Object.assign(d, pack.pos[d.id]);
  const next = { w: Math.max(doc.w, boardLayout.w, derived.length ? pack.w + 30 : 0), h: Math.max(doc.h, boardLayout.h, derived.length ? pack.h + 24 : 0) };
  const changed = next.w !== ext.w || next.h !== ext.h;
  ext = next;
  if (sheet) { sheet.setExtent(ext.w, ext.h); if (changed) sheet.fit(); markSheet(); }
  if (model) { model.setCards(derived.filter((d) => d.top), boards.find((b) => b.board === 'top').box, C.unitPerPx({ faceWidthPx: doc.faceWidthPx })); dirty.scene = true; schedule(); }
  computeReport();
}
function scheduleStats() { clearTimeout(statsTimer); statsTimer = setTimeout(computeStats, 260); }
function guardOffCount() { return td().strokes.filter((s) => s.x && !s.e).length; }
function computeReport() {
  const cutAreas = {};
  for (const p of doc.pieces) cutAreas[p.id] = C.areaOfPoly(cutPoly(p));
  const bom = C.bom(doc, stats, { faceMm: state.faceMm, skin: state.skin, cutAreas, derived });
  const list = C.checks(doc, stats, { faceMm: state.faceMm, guardOff: guardOffCount(), derived });
  report = { bom, checks: list, errors: list.filter((c) => c.level === 'error').length, warns: list.filter((c) => c.level === 'warn').length };
  const b = $('#checkBadge');
  b.textContent = report.errors ? String(report.errors) : report.warns ? String(report.warns) : '';
  b.className = report.errors ? 'bad' : report.warns ? 'warn' : '';
  $('#bomBadge').textContent = String(report.bom.pieceCount);
  updateExportGate();
  if (ui.tab === 'bom' || ui.tab === 'check') renderDock();
}

/* ============ 重画调度 ============ */
const dirty = { pieces: new Set(), sheet: true, scene: true };
let frameReq = 0;
function schedule() { if (!frameReq) frameReq = requestAnimationFrame(frame); }
function markPiece(id) { dirty.pieces.add(id); dirty.sheet = true; dirty.scene = true; schedule(); }
function markAll() { for (const p of allPieces()) dirty.pieces.add(p.id); dirty.sheet = true; dirty.scene = true; schedule(); }
function markSheet() { dirty.sheet = true; schedule(); }
function frame() {
  frameReq = 0;
  for (const id of dirty.pieces) { const p = doc.byId[id]; if (p) { compose(p); if (model) model.refresh(id); } }
  dirty.pieces.clear();
  if (dirty.sheet && sheet) { sheet.draw(sheetEnv()); dirty.sheet = false; }
  if (dirty.scene && model) { model.render(); dirty.scene = false; }
}
function sheetEnv(clean) {
  return { comps: Object.fromEntries(doc.pieces.map((p) => [p.id, { canvas: rt[p.id].comp }])), cutPolys: cutMap(), showCut: true, showSeams: ui.seams, mm: mm(), selectedId: clean ? '' : ui.selected, hoverId: clean ? '' : ui.hover, extra: derived, boards: boards.map((b) => ({ box: b.box, canvas: rt[b.id].comp, name: b.name, hint: b.board === 'front' ? '脑袋上另起的一层，贴在脸前面' : b.board === 'back' ? '脑袋上另起的一层，贴在后脑上' : '翘出脑袋的发片，黏在头顶', selected: b.id === ui.selected })) };
}

/* ============ 图样交互 ============ */
let sheet = null, model = null;
function selectPiece(id) {
  if (ui.selected === id) return;
  const old = ui.selected;
  ui.selected = id;
  if (old && doc.byId[old]) markPiece(old);
  if (id && doc.byId[id]) markPiece(id);
  markSheet();
  updateHint();
  if (ui.tab === 'pattern') highlightRow();
}
function setHand(on) {
  ui.hand = on;
  $('#handTool').classList.toggle('on', on);
  $('#sheet').style.cursor = on ? 'grab' : '';
}
function setupSheet() {
  const cv = $('#sheet');
  sheet = window.NunuSheet.create(cv);
  sheet.resize();
  sheet.setDoc(doc, true);
  const ptrs = new Map();
  let pan = null, pinch = null, spaceDown = false, lockPiece = null;
  window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) spaceDown = true; });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { e.preventDefault(); if (e.shiftKey) sheet.pan(-(e.deltaY || e.deltaX), 0); else sheet.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); markSheet(); }, { passive: false });
  cv.addEventListener('pointerdown', (e) => {
    capture(cv, e);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { endStroke(); pan = null; const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; return; }
    if (e.button === 1 || e.button === 2 || spaceDown || ui.hand) { pan = { x: e.clientX, y: e.clientY }; cv.style.cursor = 'grabbing'; return; }
    if (e.button !== 0) return;
    const sp = sheet.toSheet(e.clientX, e.clientY), onBoard = boards.find((b) => sp.x >= b.box.x && sp.x <= b.box.x + b.box.w && sp.y >= b.box.y && sp.y <= b.box.y + b.box.h && C.inPoly(b.poly, sp.x, sp.y));
    const hit = onBoard ? { piece: onBoard, local: { x: sp.x, y: sp.y }, inSew: true } : sheet.pieceAt(e.clientX, e.clientY, cutMap());
    if (!hit) { selectPiece(''); pan = { x: e.clientX, y: e.clientY }; cv.style.cursor = 'grabbing'; return; }
    if (onBoard) { setHairTarget(onBoard.board); if (ui.layer !== 'hair') { $('[data-layer="hair"]').click(); toast(`${onBoard.name}画板只能画发片，已切到「发片」层`); } }
    selectPiece(hit.piece.id);
    if (!hit.inSew) { toast('这是缝份的位置（裁剪线和缝线之间），不能画。往里一点。', true); return; }
    startStroke('sheet', ui.layer);
    lockPiece = hit.piece;
    feed({ pieceId: hit.piece.id, x: hit.local.x, y: hit.local.y });
  });
  cv.addEventListener('pointermove', (e) => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      sheet.pan(cx - pinch.cx, cy - pinch.cy);
      sheet.zoomAt(d / pinch.d, cx, cy);
      pinch = { d, cx, cy };
      markSheet();
      return;
    }
    if (pan) { sheet.pan(e.clientX - pan.x, e.clientY - pan.y); pan = { x: e.clientX, y: e.clientY }; markSheet(); return; }
    if (cur && cur.src === 'sheet' && lockPiece) {
      const loc = sheet.localOn(lockPiece, e.clientX, e.clientY);
      if (loc.inside) feed({ pieceId: lockPiece.id, x: loc.x, y: loc.y }); else breakStroke();
      return;
    }
    const hit = sheet.pieceAt(e.clientX, e.clientY, null);
    const id = hit ? hit.piece.id : '';
    if (id !== ui.hover) { ui.hover = id; markSheet(); }
  });
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) pan = null; lockPiece = null; cv.style.cursor = ui.hand ? 'grab' : ''; endStroke(); };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  $('#zoomIn').onclick = () => { sheet.zoomAt(1.25); markSheet(); };
  $('#zoomOut').onclick = () => { sheet.zoomAt(1 / 1.25); markSheet(); };
  $('#zoomFit').onclick = () => focusRect('all');
  $('#viewPattern').onclick = () => focusRect('pattern');
  $('#viewFace').onclick = () => focusRect('face');
  $('#viewHair').onclick = () => focusRect('hair');
  $('#handTool').onclick = () => setHand(!ui.hand);
}

/* ============ 3D 交互 ============ */
function buildModel() {
  if (!model) return;
  const shells = boards.filter((b) => b.board !== 'top').map((b) => ({ piece: b, canvas: layerCanvas(b, 'hair'), off: b.board === 'front' ? 0.06 : 0.07 }));
  model.build(doc, Object.fromEntries(doc.pieces.map((p) => [p.id, { canvas: rt[p.id].comp }])), state.skin, shells);
  dirty.scene = true;
  schedule();
}
function setupModel() {
  const cv = $('#model');
  try { model = window.NunuModel.create(cv); } catch (err) { $('#modelError').hidden = false; model = null; return; }
  model.resize();
  let drag = null;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { e.preventDefault(); model.view.zoom = Math.max(0.5, Math.min(3, model.view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); dirty.scene = true; schedule(); }, { passive: false });
  cv.addEventListener('pointerdown', (e) => {
    capture(cv, e);
    const rotate = e.button === 2 || !ui.paint3d || e.altKey || e.button === 1;
    if (!rotate && e.button === 0) {
      if (ui.layer === 'hair' && ui.hairTarget === 'top') { toast('上面发片是翘出脑袋的，请在图样右边的「上面发片」画板上画。', true); return; }
      const hit = model.pick(e.clientX, e.clientY, pickFilter);
      startStroke('model', ui.layer);
      if (hit && hit.pieceId) { selectPiece(hit.pieceId); feed(hit); }
      else if (hit && hit.base) toastBlocked('这里是裸露的娃娃，没有裁片盖着，画不上。画在有图样对应的地方。');
      return;
    }
    drag = { x: e.clientX, y: e.clientY, moved: 0, click: e.button === 0 && !ui.paint3d };
  });
  cv.addEventListener('pointermove', (e) => {
    if (cur && cur.src === 'model') {
      const hit = model.pick(e.clientX, e.clientY, pickFilter);
      if (hit && hit.pieceId) feed(hit); else breakStroke();
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = e.clientX; drag.y = e.clientY;
      model.view.rotY += dx * 0.01;
      model.view.rotX = Math.max(-0.7, Math.min(0.7, model.view.rotX + dy * 0.006));
      dirty.scene = true; schedule();
    }
  });
  const up = (e) => {
    if (drag && drag.click && drag.moved < 6) {
      const hit = model.pick(e.clientX, e.clientY, (q) => q.role !== 'board');
      selectPiece(hit && hit.pieceId ? hit.pieceId : '');
    }
    drag = null;
    endStroke();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  $$('[data-view]').forEach((b) => { b.onclick = () => { model.view.rotY = +b.dataset.view; model.view.rotX = 0.05; dirty.scene = true; schedule(); }; });
  const setMode = (paint) => {
    ui.paint3d = paint;
    $('#modePaint').classList.toggle('on', paint);
    $('#modeRotate').classList.toggle('on', !paint);
    cv.classList.toggle('rotating', !paint);
  };
  $('#modePaint').onclick = () => setMode(true);
  $('#modeRotate').onclick = () => setMode(false);
  buildModel();
}

/* ============ 保存 ============ */
let saveTimer = 0;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => save(false), 700); }
function save(manual) {
  try {
    state.hist = history.slice(-80).map((g) => g.map((st) => st.n).filter(Boolean));
    localStorage.setItem(STORE, JSON.stringify(state));
    localStorage.setItem(IMPORTS, JSON.stringify(imports));
    $('#saveStatus').textContent = '● 已保存在此浏览器';
    if (manual) toast('保存好了 ✿');
  } catch {
    $('#saveStatus').textContent = '存储已满或被禁用，没存上';
    if (manual) toast('没存上：浏览器存储满了或被禁用。可以先导出图样。', true);
  }
}

/* ============ 导出 ============ */
function gate() {
  if (!report) return { ok: false, needAck: false, text: '' };
  if (report.errors) return { ok: false, needAck: false, text: report.checks.filter((c) => c.level === 'error').map((c) => c.text).join('；') };
  return { ok: true, needAck: report.warns > 0, text: report.warns ? `有 ${report.warns} 条警告，看过再导出：` + report.checks.filter((c) => c.level === 'warn').map((c) => c.text).join('；') : '' };
}
function updateExportGate() {
  const g = gate();
  $('#ackWrap').hidden = !g.needAck;
  $('#exportNote').textContent = g.text;
  const allowed = g.ok && (!g.needAck || $('#ack').checked);
  $('#exportSvg').disabled = !allowed;
  $('#exportPng').disabled = !allowed;
}
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
const safeName = () => (state.name || '努努').replace(/[\\/:*?"<>|]/g, '');
const fmtPath = (poly, k) => 'M' + poly.map(([x, y]) => `${(x * k).toFixed(2)} ${(y * k).toFixed(2)}`).join('L') + 'Z';
function exportSvg() {
  const k = mm(), W = (ext.w || doc.w) * k, H = (ext.h || doc.h) * k + 14;
  let body = '';
  for (const p of doc.pieces) {
    const st = stats[p.id] || {}, fill = p.material === 'hair' && st.colors && st.colors[0] ? st.colors[0].hex : 'none';
    body += `<g><title>${esc(p.label + ' ' + p.name)}</title>`;
    body += `<path d="${fmtPath(cutPoly(p), k)}" fill="none" stroke="#9a9588" stroke-width=".35" stroke-dasharray="3 2"/>`;
    body += `<path d="${fmtPath(p.poly, k)}" fill="${fill}" fill-opacity=".28" stroke="#3f3a33" stroke-width=".5"/>`;
    body += `<text x="${((p.box.x + p.box.w / 2) * k).toFixed(2)}" y="${((p.box.y + p.box.h / 2) * k).toFixed(2)}" font-size="4.2" text-anchor="middle" fill="#5a5448" font-family="sans-serif">${esc(p.label + ' ' + p.name)}</text></g>`;
  }
  for (const d of derived) {
    const shift = (poly) => poly.map(([x, y]) => [x + d.dx, y + d.dy]);
    body += `<g><title>${esc(d.label + ' ' + d.name)}</title><path d="${fmtPath(shift(d.cut), k)}" fill="none" stroke="#9a9588" stroke-width=".35" stroke-dasharray="3 2"/><path d="${fmtPath(shift(d.poly), k)}" fill="${d.hex}" fill-opacity=".55" stroke="#3f3a33" stroke-width=".5"/>`;
    body += `<text x="${((d.box.x + d.box.w / 2 + d.dx) * k).toFixed(2)}" y="${((d.box.y + d.box.h / 2 + d.dy) * k).toFixed(2)}" font-size="3.6" text-anchor="middle" fill="#2f2b25" font-family="sans-serif">${esc(d.label)}</text></g>`;
  }
  if (doc.guides) {
    for (const q of [doc.guides.lens, doc.guides.eyeL, doc.guides.eyeR, doc.guides.mouth]) body += `<path d="${fmtPath(q, k)}" fill="none" stroke="#4678aa" stroke-width=".3" stroke-dasharray="2 1.5"/>`;
    for (const n of doc.guides.notches || []) { const s = 3 * (n.dir < 0 ? -1 : 1); body += `<path d="M${((n.x - 1.8 / k) * k).toFixed(2)} ${(n.y * k + s).toFixed(2)}H${((n.x + 1.8 / k) * k).toFixed(2)}L${(n.x * k).toFixed(2)} ${(n.y * k).toFixed(2)}Z" fill="none" stroke="#3f3a33" stroke-width=".35"/>`; }
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(1)}mm" height="${H.toFixed(1)}mm" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}">\n<title>${esc(state.name)} · ${esc(doc.name)} · ${esc(doc.scaleLabel)} ${state.faceMm} mm · 缝份 ${state.seamMm} mm</title>\n<rect width="100%" height="100%" fill="#fff"/>\n${body}\n<g transform="translate(8 ${(H - 6).toFixed(1)})" font-family="sans-serif" font-size="3.2" fill="#6b655a"><path d="M0 0H50M0 -2V2M50 -2V2" stroke="#6b655a" stroke-width=".4" fill="none"/><text x="54" y="1.2">5 cm 校准尺：按 100% 打印，量一下是不是 5 cm。实线是缝线，虚线是裁剪线（含 ${state.seamMm} mm 缝份），蓝虚线是脸窗和眼嘴参考框。</text></g>\n</svg>\n`;
  download(`${safeName()}-纸样.svg`, new Blob([svg], { type: 'image/svg+xml' }));
  toast('纸样 SVG 已导出，按 100% 打印');
}
function withCleanView(fn) {
  const keep = { zones: ui.zones, selected: ui.selected };
  ui.zones = false; ui.selected = '';
  for (const p of allPieces()) compose(p);
  try { return fn(); } finally {
    ui.zones = keep.zones; ui.selected = keep.selected;
    markAll();
  }
}
function exportPng() {
  const s = 3, off = document.createElement('canvas');
  withCleanView(() => {
    const inst = window.NunuSheet.create(off, { fixed: { w: (ext.w || doc.w) * s, h: (ext.h || doc.h) * s } });
    inst.resize();
    inst.setDoc(doc, false);
    inst.setExtent(ext.w || doc.w, ext.h || doc.h);
    inst.view.zoom = s; inst.view.x = 0; inst.view.y = 0;
    inst.draw(sheetEnv(true));
  });
  off.toBlob((b) => { if (b) { download(`${safeName()}-彩色图样.png`, b); toast('彩色图样已导出'); } }, 'image/png');
}
function bomText() {
  const b = report.bom;
  const out = [`努努赛博定制台 · 备料单`, `作品：${state.name}　图纸：${doc.name}　${doc.scaleLabel} ${state.faceMm} mm　缝份 ${state.seamMm} mm　${new Date().toISOString().slice(0, 10)}`, '', '== 面料 =='];
  for (const f of b.fabrics) out.push(`${f.label} ${f.hex}：${f.pieces} 片，面积 ${f.areaCm2.toFixed(0)} cm²，建议买 ${f.buyCm} cm（幅宽 ${C.FABRIC_WIDTH_CM} cm，含 30% 损耗）`);
  out.push('', '== 裁片（按编号裁，裁完打钩）==');
  for (const r of b.rows) out.push(`${td().cut[r.id] ? '[x]' : '[ ]'} ${r.label} ${r.name}　${r.w.toFixed(0)}×${r.h.toFixed(0)} mm　${r.fabric} ${r.hex}　用途：${r.derived ? '画出来的发片（贴 / 缝上去）' : C.ROLES[r.role].label}`);
  out.push('', '== 检查 ==');
  for (const c of report.checks) out.push(`${c.level === 'ok' ? '✓' : c.level === 'warn' ? '⚠' : '✗'} ${c.text}`);
  out.push('', '图纸是网上流传的公开图纸，每一片的用途是按形状猜的；缝出来的布会有形变。先用便宜布试缝一遍，再裁正式布料。');
  return out.join('\n') + '\n';
}

/* ============ 导入图纸图片 ============ */
function importImage(file) {
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    try {
      const k = Math.min(1, 1500 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const c = cv.getContext('2d', { willReadFrequently: true });
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.drawImage(img, 0, 0, w, h);
      const d = c.getImageData(0, 0, w, h).data, gray = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) gray[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
      const found = C.segmentPieces(gray, w, h, { minArea: Math.max(500, Math.round((w * h) / 900)) });
      if (found.length < 2) { toast('没从这张图里认出裁片。要黑线、白底、每片是封闭的轮廓。', true); return; }
      const name = (file.name || '导入图纸').replace(/\.[^.]+$/, '').slice(0, 20);
      const tpl = C.templateFromPieces('import-' + Date.now().toString(36), name, found.map((f) => ({ ...f, poly: f.poly.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]) })), w, h);
      imports.push(tpl);
      if (imports.length > 4) imports.shift();
      switchTemplate(tpl.id);
      toast(`导入了 ${tpl.pieces.length} 片。每一片的用途要你自己选，选了 3D 上才看得到。`);
    } finally { URL.revokeObjectURL(url); }
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('这张图打不开。', true); };
  img.src = url;
}
function switchTemplate(id) {
  endStroke();
  state.template = id;
  history.length = 0; redoStack.length = 0;
  ui.selected = ''; ui.hover = '';
  buildDoc(false);
  replayAll();
  sheet.setDoc(doc, true);
  buildModel();
  markAll();
  computeStats();
  updateHint();
  renderDock();
  scheduleSave();
}
function roleOrMaterialChanged() {
  buildDoc(true);
  for (const p of doc.pieces) { const r = rt[p.id]; r.zones = {}; r.overlay = {}; }
  sheet.setDoc(doc, false);
  buildModel();
  markAll();
  computeStats();
  updateHint();
  scheduleSave();
}

/* ============ 下面的面板 ============ */
function field(k, label, min, max, unit) {
  return `<div class="field"><label for="f-${k}">${label}<output id="o-${k}">${state[k]}${unit}</output></label><input type="range" id="f-${k}" data-k="${k}" data-unit="${unit}" min="${min}" max="${max}" value="${state[k]}"></div>`;
}
function roleOptions(sel) { return C.ROLE_KEYS.map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${C.ROLES[k].label}</option>`).join(''); }
function dockHtml() {
  if (ui.tab === 'pattern') {
    const cards = allTemplates().map((t) => `<button class="tpl ${state.template === t.id ? 'on' : ''}" data-tpl="${t.id}"><b>${esc(t.name)}</b><span class="lvl">${t.imported ? '导入的' : '公开图纸'}</span><p>${t.imported ? '自动从图片里拆出来的，用途要自己选。' : esc(t.note)}</p><p>${t.pieces.length} 片</p></button>`).join('');
    const rows = doc.pieces.map((p) => `<tr class="pick ${p.id === ui.selected ? 'on' : ''}" data-pick="${p.id}"><td><span class="num">${p.label}</span></td><td>${esc(p.name)}</td>
      <td><select data-role="${p.id}" aria-label="${esc(p.name)}的用途">${roleOptions(p.role)}</select></td>
      <td><select data-mat="${p.id}" aria-label="${esc(p.name)}的布"><option value="skin" ${p.material === 'skin' ? 'selected' : ''}>肤色布</option><option value="hair" ${p.material === 'hair' ? 'selected' : ''}>发片布</option></select></td></tr>`).join('');
    return `<div class="two-col"><div><h3>图纸库</h3><div class="tpl-grid" style="margin-top:8px">${cards}</div>
      <div class="row"><button id="importBtn">导入图纸图片…</button><button id="resetRoles">恢复默认用途</button></div>
      <div class="note-box">用的是网上流传的公开努努图纸。脸、头顶发、下巴、后脑是按“同色相缝”标注图定的，耳朵、手臂是我猜的，猜错了就在右边改「用途」。想用别的公开图纸：导入一张黑线白底的图，自动拆成一片一片。图纸的出处和授权要自己确认。</div></div>
      <div><h3>每一片的用途和布</h3><table><tr><th>编号</th><th>名称</th><th>用途（贴在 3D 哪里）</th><th>布</th></tr>${rows}</table></div></div>`;
  }
  if (ui.tab === 'bom') {
    const b = report.bom;
    const fab = b.fabrics.map((f) => `<tr><td><span class="chip" style="background:${f.hex}"></span>${f.label} ${f.hex}</td><td>${f.pieces} 片</td><td>${f.areaCm2.toFixed(0)} cm²</td><td>${f.buyCm} cm</td></tr>`).join('');
    const rows = b.rows.map((r) => `<tr class="pick ${r.id === ui.selected ? 'on' : ''}" data-pick="${r.id}"><td><span class="num">${r.label}</span></td><td>${esc(r.name)}</td><td>${r.w.toFixed(0)}×${r.h.toFixed(0)} mm</td><td><span class="chip" style="background:${r.hex}"></span>${r.fabric}</td><td><label><input type="checkbox" data-cut="${r.id}" ${td().cut[r.id] ? 'checked' : ''}> 已裁</label></td></tr>`).join('');
    const done = b.rows.filter((r) => td().cut[r.id]).length;
    return `<div class="two-col"><div><h3>面料（建议买布，含 30% 损耗，幅宽 ${C.FABRIC_WIDTH_CM} cm）</h3><table><tr><th>布</th><th>片数</th><th>面积</th><th>建议买</th></tr>${fab}</table><p style="margin-top:10px">共 ${b.pieceCount} 片，已裁 ${done}/${b.rows.length}。尺寸按脸片宽 ${state.faceMm} mm 换算。</p>
      <div class="note-box">发片的颜色是从你涂的颜色里数出来的：一种颜色一块布，别混。点一行，这片会在图样和 3D 上亮起来。</div></div>
      <div><h3>裁片清单</h3><table><tr><th>编号</th><th>名称</th><th>尺寸</th><th>布</th><th></th></tr>${rows}</table></div></div>`;
  }
  if (ui.tab === 'check') {
    const items = report.checks.map((c) => `<li class="${c.level}"><span>${c.level === 'ok' ? '✓' : c.level === 'warn' ? '⚠' : '✗'}</span><p>${esc(c.text)}</p></li>`).join('');
    return `<h3>导出前检查</h3><ul class="checks">${items}</ul><div class="note-box">✗ 会挡住导出，⚠ 要你点头才能导出，✓ 是通过的。守卫在你画的时候就在拦：脸只能画在脸窗里、发片只能画在发片布上、离缝线太近不让画、没裁片盖着的地方画不上。</div>`;
  }
  return `<div class="fields">${field('faceMm', `${doc.scaleLabel}（毫米，决定整张图纸多大）`, 30, 160, ' mm')}${field('seamMm', '缝份（裁剪线放出去多少）', 0, 12, ' mm')}${field('guardMm', '接缝保护（离缝线多远不让画）', 0, 8, ' mm')}</div>
    <div class="row"><span style="font-size:12px">肤色布</span>${SKINS.map((c) => `<button class="swatch ${state.skin === c ? 'on' : ''}" data-skin="${c}" style="background:${c}" aria-label="布色 ${c}"></button>`).join('')}<input type="color" id="skinCustom" value="${state.skin}" aria-label="自定义布色"></div>
    <div class="row"><button id="clearAll">清空这份图纸上所有笔迹（撤销不了，慎点）</button></div>
    <div class="note-box">原图没有标尺，真实大小由上面的宽度决定：先量你想要的脸片宽度填进去，打印出来再用 5 cm 校准尺核对一遍。裁出来的布会有形变，先用便宜布试缝，再裁正式布料。</div>`;
}
function renderDock() {
  if (!report) return;
  $('#dockBody').innerHTML = dockHtml();
  wireDock();
}
function highlightRow() { $$('#dockBody tr.pick').forEach((tr) => tr.classList.toggle('on', tr.dataset.pick === ui.selected)); }
function wireDock() {
  $$('#dockBody [data-k]').forEach((el) => {
    el.oninput = () => {
      const k = el.dataset.k;
      state[k] = +el.value;
      $('#o-' + k).textContent = el.value + el.dataset.unit;
      if (k === 'faceMm' || k === 'guardMm') for (const p of doc.pieces) { const r = rt[p.id]; r.zones = {}; r.overlay = {}; }
      if (k !== 'guardMm') cutCache.clear();
      markAll();
      computeReport();
      updateHint();
      scheduleSave();
    };
  });
  $$('#dockBody [data-skin]').forEach((b) => { b.onclick = () => { state.skin = b.dataset.skin; if (model) model.setSkin(state.skin); markAll(); computeReport(); renderDock(); scheduleSave(); }; });
  const sc = $('#skinCustom');
  if (sc) sc.oninput = () => { state.skin = sc.value; if (model) model.setSkin(state.skin); markAll(); scheduleSave(); };
  const clear = $('#clearAll');
  if (clear) clear.onclick = () => {
    if (!confirm('清空这份图纸上所有笔迹？这一步撤销不了。')) return;
    td().strokes = []; history.length = 0; redoStack.length = 0;
    for (const p of allPieces()) { const r = rt[p.id]; r.layers = {}; }
    for (const b of boards) layerCanvas(b, 'hair');
    markAll(); computeStats(); scheduleSave(); renderDock();
  };
  $$('#dockBody [data-tpl]').forEach((b) => { b.onclick = () => { if (state.template !== b.dataset.tpl) switchTemplate(b.dataset.tpl); }; });
  const imp = $('#importBtn');
  if (imp) imp.onclick = () => $('#importFile').click();
  const reset = $('#resetRoles');
  if (reset) reset.onclick = () => { td().roles = {}; td().materials = {}; roleOrMaterialChanged(); renderDock(); toast('用途和布都恢复成默认的了'); };
  $$('#dockBody [data-role]').forEach((s) => {
    s.onchange = () => {
      const id = s.dataset.role;
      td().roles[id] = s.value;
      delete td().materials[id]; // 换用途时，布跟着用途走
      roleOrMaterialChanged();
      renderDock();
    };
  });
  $$('#dockBody [data-mat]').forEach((s) => { s.onchange = () => { td().materials[s.dataset.mat] = s.value; roleOrMaterialChanged(); renderDock(); }; });
  $$('#dockBody [data-pick]').forEach((tr) => { tr.onclick = (e) => { if (e.target.closest('label,input,select,button')) return; selectPiece(tr.dataset.pick); }; });
  $$('#dockBody [data-cut]').forEach((cb) => { cb.onchange = () => { td().cut[cb.dataset.cut] = cb.checked; scheduleSave(); renderDock(); }; });
}

/* ============ 工具条 ============ */
function renderSwatches() {
  const list = ui.layer === 'hair' ? hairColors() : inkColors();
  const now = ui.layer === 'hair' ? ui.hair : ui.ink;
  $('#swatches').innerHTML = list.map((c) => `<button class="swatch ${c.toLowerCase() === now.toLowerCase() ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="颜色 ${c}"></button>`).join('');
  $$('#swatches [data-c]').forEach((b) => { b.onclick = () => setColor(b.dataset.c); });
  $('#customColor').value = now;
}
function setColor(c) {
  if (ui.layer === 'hair') {
    ui.hair = c;
    if (!hairColors().some((p) => p.toLowerCase() === c.toLowerCase())) {
      state.hairPalette.push(c);
      if (state.hairPalette.length > 12) state.hairPalette.shift();
      scheduleSave();
    }
  } else {
    ui.ink = c;
    if (!inkColors().some((p) => p.toLowerCase() === c.toLowerCase())) {
      (state.inkPalette ||= []).push(c);
      if (state.inkPalette.length > 12) state.inkPalette.shift();
      scheduleSave();
    }
  }
  ui.tool = 'pen';
  syncTool();
  renderSwatches();
}
function syncTool() {
  $('#toolPen').classList.toggle('on', ui.tool === 'pen');
  $('#toolEraser').classList.toggle('on', ui.tool === 'eraser');
}
function setupToolbar() {
  $$('[data-layer]').forEach((b) => {
    b.onclick = () => {
      ui.layer = b.dataset.layer;
      $$('[data-layer]').forEach((x) => x.classList.toggle('on', x === b));
      $('#hairTargets').hidden = ui.layer !== 'hair';
      if (ui.autoFocus) focusRect(focusFor(ui.layer));
      renderSwatches(); updateHint(); if (ui.zones) markAll();
    };
  });
  $$('[data-target]').forEach((b) => { b.onclick = () => { setHairTarget(b.dataset.target); if (ui.layer !== 'hair') $('[data-layer="hair"]').click(); }; });
  $('#toolPen').onclick = () => { ui.tool = 'pen'; syncTool(); };
  $('#toolEraser').onclick = () => { ui.tool = 'eraser'; syncTool(); };
  $('#customColor').oninput = (e) => setColor(e.target.value);
  const size = $('#brushSize');
  size.oninput = () => { ui.size = +size.value; $('#brushOut').textContent = `${ui.size} mm`; };
  $('#mirror').onchange = (e) => { ui.mirror = e.target.checked; };
  $('#seamGuard').onchange = (e) => { ui.seamGuard = e.target.checked; updateHint(); if (ui.zones) markAll(); if (!ui.seamGuard) toast('接缝保护关了：靠近缝线的笔画会在检查里标出警告', true); };
  $('#showZones').onchange = (e) => { ui.zones = e.target.checked; markAll(); };
  $('#showGuides').onchange = (e) => { ui.guides = e.target.checked; markAll(); };
  $('#autoFocus').onchange = (e) => { ui.autoFocus = e.target.checked; if (ui.autoFocus) focusRect(focusFor(ui.layer)); };
  $('#showSeams').onchange = (e) => { ui.seams = e.target.checked; markAll(); };
  $('#undo').onclick = undo;
  $('#redo').onclick = redo;
  window.addEventListener('keydown', (e) => {
    const t = document.activeElement;
    if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) && t.type !== 'range' && t.type !== 'checkbox') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (e.key === 'e' || e.key === 'E') { ui.tool = ui.tool === 'eraser' ? 'pen' : 'eraser'; syncTool(); }
    else if (e.key === 'h' || e.key === 'H') setHand(!ui.hand);
  });
  $$('.tabs [data-tab]').forEach((b) => {
    b.onclick = () => { ui.tab = b.dataset.tab; $$('.tabs [data-tab]').forEach((x) => x.classList.toggle('on', x === b)); renderDock(); };
  });
  const pn = $('#projectName');
  pn.value = state.name;
  pn.oninput = () => { state.name = pn.value || '我的努努'; scheduleSave(); };
  $('#btnSave').onclick = () => save(true);
  const menu = $('#exportMenu'), btn = $('#btnExport');
  btn.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); updateExportGate(); };
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.menu-wrap')) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  $('#ack').onchange = updateExportGate;
  $('#exportSvg').onclick = exportSvg;
  $('#exportPng').onclick = exportPng;
  $('#exportBom').onclick = () => { download(`${safeName()}-备料单.txt`, new Blob([bomText()], { type: 'text/plain;charset=utf-8' })); toast('备料单已导出'); };
  $('#importFile').onchange = (e) => { const f = e.target.files && e.target.files[0]; if (f) importImage(f); e.target.value = ''; };
  window.addEventListener('resize', () => { if (sheet) { sheet.resize(); sheet.fit(); } if (model) model.resize(); dirty.scene = true; markSheet(); });
}

/* ============ 启动 ============ */
function init() {
  buildDoc(false);
  restoreHistory();
  replayAll();
  setupToolbar();
  renderSwatches();
  syncTool();
  setupSheet();
  setupModel();
  for (const p of allPieces()) compose(p);
  computeStats();
  updateHint();
  sheet.fit();
  renderDock();
  markAll();
  // 调试 / 测试用
  window.__nunu = {
    state, ui, rt, C, history,
    get doc() { return doc; }, get stats() { return stats; }, get report() { return report; }, sheet, model,
    startStroke, feed, endStroke, undo, redo, computeStats, selectPiece, switchTemplate, importImage, pointCheck, zoneOf, compose, td,
  };
}
init();
})();
