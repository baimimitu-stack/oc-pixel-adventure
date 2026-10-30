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
  version: 4, studioMode: '2.5d', designerVersion: 1, name: '我的第一只努努', template: 'nunu-25d', faceMm: 100, seamMm: 5, guardMm: 3, skin: '#f1dfcd',
  hairPalette: [], inkPalette: [], mesh: null, beanParams: null, tplData: {},
};
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && s.version === 4) return { ...clone(DEFAULTS), ...s, ...(s.studioMode !== '2.5d' || s.designerVersion !== 1 ? {studioMode:'2.5d',designerVersion:1,template:'nunu-25d'} : {}), tplData: s.tplData || {} };
  } catch { /* 读不出来就用新的 */ }
  return clone(DEFAULTS);
}
function loadImports() { try { const l = JSON.parse(localStorage.getItem(IMPORTS)); return Array.isArray(l) ? l : []; } catch { return []; } }
let state = loadState();
if(new URLSearchParams(location.search).get('view')==='layers')state.template='nunu-25d';
let imports = loadImports();
const ui = { layer: 'face', tool: 'pen', ink: '#4b3939', hair: '#7d594a', autoFocus: true, hand: false, size: 3, mirror: true, seamGuard: true, zones: false, guides: true, seams: true, paint3d: true, mode: 'doll', hairTarget: 'front', tab: 'pattern', selected: '', hover: '' };
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

/** 粗模分片体子：粗模和分片存在 state.mesh；展开的结果缓存着（rev 变了才重算） */
let meshCache = null;
const MeshM = () => window.NunuMesh;
function meshObj() {
  const m = state.mesh;
  const pos = [], tri = [];
  for (let i = 0; i < m.pos.length; i += 3) pos.push([m.pos[i], m.pos[i + 1], m.pos[i + 2]]);
  for (let i = 0; i < m.tri.length; i += 3) tri.push([m.tri[i], m.tri[i + 1], m.tri[i + 2]]);
  return { pos, tri };
}
function meshUnfold() {
  if (state.mesh && state.mesh.template && (state.mesh.template.paperVersion === 3 || !state.mesh.unfolded)) return { ok: true, template: state.mesh.template, report: state.mesh.report };
  if (!state.mesh || !state.mesh.unfolded) return null;
  if (!meshCache || meshCache.rev !== state.mesh.rev) {
    const draft = { mesh: meshObj(), regions: state.mesh.regions, names: state.mesh.names };
    const darts = state.mesh.darts || MeshM().suggestDarts(draft, { maxPer: 2 });
    const res = MeshM().unfold({ ...draft, darts });
    meshCache = { rev: state.mesh.rev, res };
    if (res.ok) { state.mesh.template = res.template; state.mesh.report = res.report; state.mesh.darts = darts; }
  }
  return meshCache.res;
}
let customCache = null;
/** 自创体子：参数存在 state.custom，改一下参数就重新算一套裁片（结果缓存着，参数没变就不重算） */
function customTemplate() {
  const key = JSON.stringify(state.custom || {});
  if (!customCache || customCache.key !== key) customCache = { key, tpl: window.NunuBody.generate(state.custom || {}) };
  return customCache.tpl;
}
const allTemplates = () => { const u = state.template === 'mesh-body' ? meshUnfold() : state.mesh?.template ? {ok:true,template:state.mesh.template} : null; return [P.cookie, customTemplate(), P.public, ...(u && u.ok ? [u.template] : []), ...imports]; };
const tplById = (id) => allTemplates().find((t) => t.id === id) || P.cookie;
const td = () => (state.tplData[state.template] ||= { roles: {}, materials: {}, strokes: [], cut: {} });

let doc = null, boards = [], boardLayout = null;
const allPieces = () => [...doc.pieces, ...boards];
const rt = {}; // 每片的运行时：图层画布、合成画布、遮罩、区域缓存
const mm = () => C.mmPerPx(doc, state.faceMm);
const guardPx = () => (ui.seamGuard ? state.guardMm / mm() : 0);
const sizePx = () => ui.size / mm();

/** 这份 design 是不是「没动过手的白坯」：只有脸和身体两个对象，一片笔迹都没有。
 *  以前开页面时白坯会被存下来，刷新就拿它生成 4 片纸样，把自创体子的 17 片盖掉 ——
 *  所以认出白坯就别用它，让纸样回到图纸本来的样子。真画过东西的一律算数，不会丢。 */
const isBlankDesign = (v) => !!v && !v.edited
  && (v.objects || []).length <= 4
  && !(v.objects || []).some((o) => (o.front && o.front.length) || (o.back && o.back.length));
function buildDoc(keepRuntime) {
  if (state.template !== (doc && doc.id) && !allTemplates().some((t) => t.id === state.template)) state.template = P.public.id;
  const tpl = tplById(state.template), d = td();
  const designed = d.design && !isBlankDesign(d.design);   // 这套图纸在设计台里做过（存着自己的 design 数据），纸样就由设计台长出来
  doc = C.makeDoc(designed ? window.NunuDesign.template(tpl,d.design) : window.NunuHair.apply(tpl, d.hairstyle), { roles: d.roles, materials: d.materials });
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
const strokesOf = (id, layer) => td().design ? [] : td().strokes.filter((s) => s.p === id && (!layer || s.l === layer));

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
  accessory: '外挂发片：长发、大发片和辫子都有独立正反裁片。可以在图样或 3D 上上色；「发型与缝合」里可选模板、长度和分区，同号 H 缝线配对，同号「装」标记用于安装。',
};
/** 把图样对准一块区域：脸 → 脸片；发片 → 当前选的那块发片画板（底布则是头顶发和后脑）；彩绘 → 整张图纸；全局 → 全部 */
function focusRect(kind) {
  if (!sheet || !doc || (cur && cur.src === 'sheet')) return;
  const pad = 36, fit = (b) => sheet.fitRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
  if (kind === 'all') sheet.fit();
  else if (kind === 'pattern') sheet.fitRect(0, 0, doc.w, doc.h);
  else if (kind === 'face') { const f = doc.pieces.find((q) => C.isFace(q)); if (f) fit(f.box); else sheet.fit(); }
  else if (kind === 'hair') {
    const bd = boards.find((q) => q.board === ui.hairTarget);
    if (bd) fit({ x: bd.box.x, y: bd.box.y - 18, w: bd.box.w, h: bd.box.h + 18 });
    else {
      const hp = doc.pieces.filter((q) => ui.hairTarget === 'accessory' ? q.accessory : q.material === 'hair');
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
  if (ui.layer === 'hair' && ui.hairTarget === 'accessory') return !!piece.accessory;
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
  if (layer === 'hair' && C.isFace(p)) return { ok: false, reason: '前发只能画在额头上（蓝色虚线弧线以上）。弧线以下是脸窗，留给眼睛和嘴。' };
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
  const start = Math.max(0, fromIdx), ox = st.rel ? p.box.x : 0, oy = st.rel ? p.box.y : 0;
  if (pts.length === 2 && start === 0) {
    ctx.beginPath(); ctx.arc(pts[0] + ox, pts[1] + oy, st.w / 2, 0, C.TAU); ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[start] + ox, pts[start + 1] + oy);
    if (start + 2 >= pts.length) ctx.lineTo(pts[start] + ox + 0.001, pts[start + 1] + oy);
    for (let i = start + 2; i < pts.length; i += 2) ctx.lineTo(pts[i] + ox, pts[i + 1] + oy);
    ctx.stroke();
  }
  ctx.restore();
}
function replayLayer(p, layer) {
  const r = ensureRt(p);
  const list = strokesOf(p.id, layer);
  const style = td().design ? null : td().hairstyle;
  const base = layer === 'hair' && p.material === 'hair' && style && style.style !== 'none' ? style.color || '#7d594a' : null;
  const designed=p.design && (layer===(p.material==='hair'?'hair':'skin') || C.isFace(p)&&layer==='face');
  if (!list.length && !r.layers[layer] && !base && !designed) return;
  const cv = layerCanvas(p, layer);
  cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
  if(designed){const c=cv.getContext('2d');c.save();applyTf(c,p);window.NunuDesign.paint(c,p,layer);c.restore();}
  if (base) {
    const c = cv.getContext('2d'); c.save(); applyTf(c, p); c.fillStyle = base; c.fill(r.poly2d); c.restore();
  }
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
      tr.stroke = { n: nextStrokeId(), p: pid, l: cur.layer, c: cur.color, w: cur.w, e: cur.erase, x: cur.guardOff ? 1 : 0, rel: p.role === 'board' || p.accessory ? 1 : 0, pts: [] };
      td().strokes.push(tr.stroke);
      cur.group.push(tr.stroke);
    }
    const from = tr.stroke.pts.length >= 2 ? tr.stroke.pts.length - 2 : 0;
    tr.stroke.pts.push(r1(x - (tr.stroke.rel ? p.box.x : 0)), r1(y - (tr.stroke.rel ? p.box.y : 0)));
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
  if(window.__nunu?.designer && !$('#layerDesigner').hidden)return window.__nunu.designer.undo();
  if (ui.mode === 'regions' && rg) { regionUndo(false); return; }
  const g = history.pop();
  if (!g) { toast('没有可以撤销的了'); return; }
  const arr = td().strokes;
  for (const st of g) { const i = arr.indexOf(st); if (i >= 0) arr.splice(i, 1); }
  redoStack.push(g);
  refreshStrokes(g);
}
function redo() {
  if(window.__nunu?.designer && !$('#layerDesigner').hidden)return window.__nunu.designer.redo();
  if (ui.mode === 'regions' && rg) { regionUndo(true); return; }
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
  if (b.meshBoard) return;
  c.save();
  c.setLineDash([6, 5]);
  c.lineWidth = 1.7;
  c.strokeStyle = 'rgba(70,120,170,.75)';
  c.fillStyle = 'rgba(70,120,170,.8)';
  c.font = '600 12px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  if (b.flat && b.board === 'front') {
    c.beginPath(); b.poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
    if (doc.guides && doc.guides.lens) { const [dx, dy] = b.shiftBy; c.beginPath(); doc.guides.lens.forEach(([x, y], i) => (i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy))); c.closePath(); c.stroke(); }
    c.setLineDash([]);
    c.textAlign = 'center';
    c.fillText('脸片轮廓', b.anchorPx[0], b.box.y + b.box.h - 8);
  } else if (b.flat && b.board === 'back') {
    const mx = b.anchorPx[0];
    c.beginPath(); b.poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
    c.strokeStyle = 'rgba(190,150,40,.9)';
    c.beginPath(); c.moveTo(mx, b.box.y); c.lineTo(mx, b.box.y + b.box.h); c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(150,115,20,.9)';
    c.textAlign = 'center';
    c.fillText('后脑正中（两半缝在一起）', mx, b.box.y + b.box.h - 8);
  } else if (b.board === 'front') {
    const cx = b.box.x + b.box.w / 2, cy = b.box.y + b.box.h / 2, [fx, fy] = b.faceCenter, [rx, ry] = b.faceR;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, C.TAU); c.stroke();
    if (doc.guides && doc.guides.lens) { c.beginPath(); doc.guides.lens.forEach(([x, y], i) => (i ? c.lineTo(cx + x - fx, cy + y - fy) : c.moveTo(cx + x - fx, cy + y - fy))); c.closePath(); c.stroke(); }
    c.setLineDash([]);
    c.textAlign = 'center';
    c.fillText('脸盖', cx, cy + ry - 8);
    c.fillText('发际线', cx, cy - 18);
  } else if (b.board === 'back' && !b.flat) {
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
  if (ui.guides && C.isFace(p) && doc.guides && doc.guides.lens) {
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
  if (p.bonded) return p.poly;
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
  const hasBase = !td().design && layer === 'hair' && p.material === 'hair' && td().hairstyle && td().hairstyle.style !== 'none';
  if (!cv || (!p.design && !hasBase && !strokesOf(p.id, layer).length)) return null;
  const mask = polyMask(p), data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const buckets = new Map();
  let ink = 0, outside = 0;
  const sx = cv.width / p.box.w, sy = cv.height / p.box.h;
  const rects = layer === 'face' && doc.guides && doc.guides.eyeL ? [doc.guides.eyeL, doc.guides.eyeR, doc.guides.mouth].map((q) => C.boxOfPoly(q)) : null;
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
  if(p.design)return [];
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
  const k = mm(), seamPx = doc.construction === '2.5d' ? 0 : state.seamMm / k, counter = {};
  if (doc.construction === '2.5d') {
    const originals=found.slice();
    for(const d of originals) found.push({...d, backing:true});
  }
  derived = found.map((d, i) => {
    const n = (counter[d.from] = (counter[d.from] || 0) + 1), cut = cutOfPoly(d.poly, seamPx), area = C.areaOfPoly(d.poly);
    const name = (d.piece.role === 'board' ? `${d.piece.name} ${n}` : `${d.piece.name}发片 ${n}`) + (doc.construction === '2.5d' ? (d.backing ? '·背片（翻转纸样裁）' : '·正片') : '');
    return { id: `${d.from}.hair.${i}`, from: d.from, label: `发${i + 1}` + (doc.construction === '2.5d' ? ' · 裁1片 · 毛流↓' : ''), name, hex: d.hex, poly: d.poly, cut: cut, areaPx: area, areaMm2: area * k * k, thicknessMm: C.polyThickness(d.poly) * k, cutAreaPx: C.areaOfPoly(cut), box: C.boxOfPoly(d.poly), cutBox: C.boxOfPoly(cut), dx: 0, dy: 0, top: d.piece.board === 'top' && !d.backing, layer: d.piece.board || '' };
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
  const list = C.checks(doc, stats, { faceMm: state.faceMm, guardOff: guardOffCount(), derived, seams: doc.seams });
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
  let pan = null, pinch = null, spaceDown = false, lockPiece = null, drawPointer = null;
  window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) spaceDown = true; });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { e.preventDefault(); if(drawPointer!==null)return; if (e.shiftKey) sheet.pan(-(e.deltaY || e.deltaX), 0); else sheet.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); markSheet(); }, { passive: false });
  cv.addEventListener('pointerdown', (e) => {
    if(drawPointer!==null)return;
    capture(cv, e);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ui.mode === 'regions') return;
    if (ptrs.size === 2) { endStroke(); pan = null; const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; return; }
    if (e.button === 1 || e.button === 2 || spaceDown || ui.hand) { pan = { x: e.clientX, y: e.clientY }; cv.style.cursor = 'grabbing'; return; }
    if (e.button !== 0) return;
    const sp = sheet.toSheet(e.clientX, e.clientY), onBoard = boards.find((b) => sp.x >= b.box.x && sp.x <= b.box.x + b.box.w && sp.y >= b.box.y && sp.y <= b.box.y + b.box.h && C.inPoly(b.poly, sp.x, sp.y));
    const hit = onBoard ? { piece: onBoard, local: { x: sp.x, y: sp.y }, inSew: true } : sheet.pieceAt(e.clientX, e.clientY, cutMap());
    if (!hit) return;
    // 先锁定笔画，选发片/切层时的自动聚焦不得改变本笔的坐标系。
    drawPointer=e.pointerId;startStroke('sheet', onBoard?'hair':ui.layer);
    if (onBoard) { setHairTarget(onBoard.board); if (ui.layer !== 'hair') { $('[data-layer="hair"]').click(); toast(`${onBoard.name}画板只能画发片，已切到「发片」层`); } }
    selectPiece(hit.piece.id);
    if (!hit.inSew) { drawPointer=null;endStroke();toast('这是缝份的位置（裁剪线和缝线之间），不能画。往里一点。', true); return; }
    lockPiece = hit.piece;
    feed({ pieceId: hit.piece.id, x: hit.local.x, y: hit.local.y });
  });
  cv.addEventListener('pointermove', (e) => {
    if(drawPointer!==null&&e.pointerId!==drawPointer)return;
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
  const up = (e) => { if(drawPointer!==null&&e.pointerId!==drawPointer)return;drawPointer=null;ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) pan = null; lockPiece = null; cv.style.cursor = ui.hand ? 'grab' : ''; endStroke(); };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('lostpointercapture', up);
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
  const shells = boards.filter((b) => b.board !== 'top').map((b) => ({ piece: b, canvas: layerCanvas(b, 'hair'), off: b.board === 'front' ? 0.06 : 0.07, shellPiece: b.flat ? { ...b, role: b.shellRole } : null }));
  model.build(doc, Object.fromEntries(doc.pieces.map((p) => [p.id, { canvas: rt[p.id].comp }])), state.skin, shells);
  dirty.scene = true;
  schedule();
}
function setupModel() {
  const cv = $('#model');
  try { model = window.NunuModel.create(cv); } catch (err) { $('#modelError').hidden = false; model = null; return; }
  model.resize();
  let drag = null, activePointer = null, paintPiece = null;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { e.preventDefault(); if(activePointer!==null)return;model.view.zoom = Math.max(0.5, Math.min(3, model.view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); dirty.scene = true; schedule(); }, { passive: false });
  cv.addEventListener('pointerdown', (e) => {
    if(activePointer!==null)return;activePointer=e.pointerId;paintPiece=null;
    capture(cv, e);
    if (ui.mode === 'regions' && rg && e.button === 0 && !e.altKey) {
      rg.stroke = [];
      const hit = model.pickRegion(e.clientX, e.clientY);
      if (hit) paintRegion(model.brushRegion(hit.point, rg.brush));
      return;
    }
    // 设计台里选了抓手（body.ds-hand）时，3D 上按住左键也是转它 —— 抓手不光抓 2D 画布
    const handMode = !!(document.body && document.body.classList && document.body.classList.contains('ds-hand'));
    const rotate = e.button === 2 || !ui.paint3d || e.altKey || e.button === 1 || ui.mode === 'regions' || handMode;
    if (!rotate && e.button === 0) {
      if (ui.layer === 'hair' && ui.hairTarget === 'top') { toast('上面发片是翘出脑袋的，请在图样右边的「上面发片」画板上画。', true); return; }
      const hit = model.pick(e.clientX, e.clientY, pickFilter);
      startStroke('model', ui.layer);
      if (hit && hit.pieceId) { paintPiece=hit.pieceId;selectPiece(hit.pieceId); feed(hit); }
      else if (hit && hit.base) toastBlocked('这里是裸露的娃娃，没有裁片盖着，画不上。画在有图样对应的地方。');
      return;
    }
    drag = { x: e.clientX, y: e.clientY, moved: 0, click: e.button === 0 && !ui.paint3d };
  });
  cv.addEventListener('pointermove', (e) => {
    if(e.pointerId!==activePointer)return;
    if (ui.mode === 'regions' && rg && rg.stroke) {
      const hit = model.pickRegion(e.clientX, e.clientY);
      if (hit) paintRegion(model.brushRegion(hit.point, rg.brush));
      return;
    }
    if (cur && cur.src === 'model') {
      const hit = model.pick(e.clientX, e.clientY, pickFilter);
      if (hit && hit.pieceId===paintPiece) feed(hit); else breakStroke();
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
    if(e.pointerId!==activePointer)return;activePointer=null;paintPiece=null;
    if (rg && rg.stroke) {
      if (rg.stroke.length) { rg.hist.push(rg.stroke); if (rg.hist.length > 60) rg.hist.shift(); rg.redo.length = 0; saveRegions(); clearTimeout(up.t); up.t = setTimeout(() => { if (ui.tab === 'mesh') renderDock(); }, 120); }
      rg.stroke = null;
    }
    if (drag && drag.click && drag.moved < 6) {
      const hit = model.pick(e.clientX, e.clientY, (q) => q.role !== 'board');
      selectPiece(hit && hit.pieceId ? hit.pieceId : '');
    }
    drag = null;
    endStroke();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('lostpointercapture', up);
  $$('[data-view]').forEach((b) => { b.onclick = () => { model.view.rotY = +b.dataset.view; model.view.rotX = 0.05; dirty.scene = true; schedule(); }; });
  const setMode = (paint) => {
    ui.paint3d = paint;
    $('#modePaint').classList.toggle('on', paint);
    $('#modeRotate').classList.toggle('on', !paint);
    cv.classList.toggle('rotating', !paint);
  };
  $('#modePaint').onclick = () => { closeRegions(); setMode(true); renderDock(); };
  $('#returnDoll').onclick = () => { closeRegions(); setMode(true); renderDock(); };
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
  if(doc.construction === '2.5d') body += '<text x="8" y="6" font-size="3" fill="#6b655a">白坯草稿 · 每张裁1片 · 粘合发片沿实线剪、不加缝份 · 缝份默认5mm为实践建议</text>';
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
  for (const p of doc.pieces) for (const e of p.seamEdges || []) body += `<path d="M${e.pts.map(([x, y]) => `${(x * k).toFixed(2)} ${(y * k).toFixed(2)}`).join('L')}" fill="none" stroke="${e.color}" stroke-width=".7"/>`;
  for (const tk of (doc.guides && doc.guides.ticks) || []) body += `<path d="M${((tk.x - tk.dx * 7) * k).toFixed(2)} ${((tk.y - tk.dy * 7) * k).toFixed(2)}L${((tk.x + tk.dx * 7) * k).toFixed(2)} ${((tk.y + tk.dy * 7) * k).toFixed(2)}" stroke="${tk.color || '#3f3a33'}" stroke-width=".6"/>`;
  for (const p of doc.pieces) {
    for (const e of p.seamEdges || []) {
      const m = e.pts[Math.floor(e.pts.length / 2)];
      body += `<text x="${m[0] * k}" y="${m[1] * k - 1}" font-size="3" fill="${e.color}">${esc(e.label)}</text>`;
    }
    for (const m of p.mounts || []) body += `<circle cx="${m.x * k}" cy="${m.y * k}" r="1.5" fill="none" stroke="#227e88" stroke-width=".4"/><text x="${m.x * k + 2}" y="${m.y * k - 2}" font-size="3" fill="#227e88">${esc(m.label)}</text>`;
  }
  if (doc.guides && doc.guides.lens) {
    // 脸部参考线随纸样一起导出。
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
  out.push('', '== 缝合对照 ==');
  for (const s of doc.seams || []) out.push(`${s.label || ''} ${s.name}：${(s.a * mm()).toFixed(1)} / ${(s.b * mm()).toFixed(1)} mm`);
  out.push('', '== 发片安装 ==');
  for (const a of doc.attachments) out.push(a.instruction);
  out.push('', '== 检查 ==');
  for (const c of report.checks) out.push(`${c.level === 'ok' ? '✓' : c.level === 'warn' ? '⚠' : '✗'} ${c.text}`);
  out.push('', doc.construction === '2.5d' ? '白坯草稿，未经过实物试缝。缝份默认 5 mm 是可调整的实践建议；粘合发片不加缝份。每行裁 1 片，正反片分别列出，毛流向下。' : '旧版图纸未经过实物试缝，需核对用途和缝合关系。');
  return out.join('\n') + '\n';
}

/* ============ 导入图纸图片 ============ */
/* ---- 导入的颜色图纸：认出缝线颜色，自动配对，并顺手判一下每片大概是哪个部位 ---- */
const polyArea = (poly) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + (p[0] * q[1] - q[0] * p[1]); }, 0)) / 2;
const polyBox = (poly) => { const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]), x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };

/** 猜每片的用途（规则写在《图纸上传说明书》里，猜错了在右边「用途」里改）：
 *  ① 分组：缝在一起、面积相差不到 25% 的片是一对（前片 + 后片）；
 *  ② 最大的两组是头和身体：更圆的是头（球豆体的头常常比身体还大，不能只看谁大）；
 *  ③ 其余的小组：细长的是手臂，粗短的是耳朵，按在图纸左边还是右边分左右；
 *  ④ 一组里面积大的是前片，另一片是后片（头后面有两片的，当左右两半）。 */
function guessRoles(tpl, seams) {
  if (!tpl.pieces.length) return;
  const byId = new Map(tpl.pieces.map(p => [p.id, p]));
  const info = (p) => {
    const b = polyBox(p.poly), A = polyArea(p.poly);
    let P = 0; for (let i = 0; i < p.poly.length; i++) { const q = p.poly[(i + 1) % p.poly.length]; P += Math.hypot(q[0] - p.poly[i][0], q[1] - p.poly[i][1]); }
    // 质心偏离外接框中线多少（左右不对称的片：叶子、月牙；对称的片：圆、身体、耳朵 ≈ 0）
    let a2 = 0, mx = 0;
    for (let i = 0; i < p.poly.length; i++) { const q = p.poly[(i + 1) % p.poly.length], c = p.poly[i][0] * q[1] - q[0] * p.poly[i][1]; a2 += c; mx += (p.poly[i][0] + q[0]) * c; }
    const asym = a2 ? Math.abs(mx / (3 * a2) - (b.x + b.w / 2)) / Math.max(1, b.w) : 0;
    return { b, A, circ: (4 * Math.PI * A) / Math.max(1, P * P), slim: Math.min(b.w, b.h) / Math.max(1, Math.max(b.w, b.h)), cx: b.x + b.w / 2, asym };
  };
  const inf = new Map(tpl.pieces.map(p => [p.id, info(p)]));
  // ① 并查集分组
  const up = new Map(tpl.pieces.map(p => [p.id, p.id]));
  const find = (x) => { while (up.get(x) !== x) { up.set(x, up.get(up.get(x))); x = up.get(x); } return x; };
  for (const sm of seams) {
    const x = sm.a.piece, y = sm.b.piece;
    if (x === y || !byId.has(x) || !byId.has(y)) continue;
    const ax = inf.get(x).A, ay = inf.get(y).A;
    if (Math.abs(ax - ay) / Math.max(ax, ay) > 0.25) continue;
    up.set(find(x), find(y));
  }
  const bag = new Map();
  for (const p of tpl.pieces) { const k = find(p.id); if (!bag.has(k)) bag.set(k, []); bag.get(k).push(p.id); }
  const groups = [...bag.values()].map(ids => ids.sort((m, n) => inf.get(n).A - inf.get(m).A));
  groups.sort((m, n) => inf.get(n[0]).A - inf.get(m[0]).A);
  const set = (id, role) => { const p = byId.get(id); if (p && p.role === 'none') p.role = role; };
  const taken = new Set();
  const give = (g, front, back, back2) => {
    if (front) { set(g[0], front); taken.add(front); }
    if (g[1] && back) { set(g[1], back); taken.add(back); }
    if (g[2] && back2) { set(g[2], back2); taken.add(back2); }
  };
  if (!groups.length) return;
  const axis = tpl.w / 2;
  // 脸里面画着眼睛 / 嘴的框：包着框最多的那一片一定是脸，比看圆不圆可靠
  const faced = tpl.pieces.filter(p => (p.inner || 0) >= 2).sort((m, n) => (n.inner || 0) - (m.inner || 0))[0];
  // 圆头版式（脸 + 左右两片大叶子当后脑）：脸片是球冠，叶子是后脑，和公开努努图纸同一种做法
  let leaves = null, headPiece = faced || null;
  {
    // 左右镜像、又不圆的两片大叶子 = 后脑（图纸上对称摆在中线两边）。脸里画了眼睛框就以它为脸；
    // 没画（透明底抠图常这样）就取除了叶子以外最大的一片当脸
    const cands = tpl.pieces.filter(p => p !== faced);
    let bestA = 0;
    for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) {
      const a = inf.get(cands[i].id), b = inf.get(cands[j].id);
      if (Math.abs(a.A - b.A) / Math.max(a.A, b.A) > 0.08) continue;
      if (Math.abs((a.b.y + a.b.h / 2) - (b.b.y + b.b.h / 2)) > 0.15 * Math.max(a.b.h, b.b.h)) continue;
      if ((a.cx - axis) * (b.cx - axis) >= 0) continue;
      if (a.asym < 0.012 || b.asym < 0.012) continue;                // 自己左右对称的一对（圆、身体）更像前后片，不是叶子
      if (a.A > bestA) { bestA = a.A; leaves = a.cx < b.cx ? [cands[i], cands[j]] : [cands[j], cands[i]]; }
    }
    if (leaves) {
      if (!headPiece) {
        const rest = tpl.pieces.filter(p => !leaves.includes(p)).sort((m, n) => inf.get(n.id).A - inf.get(m.id).A)[0];
        if (rest && inf.get(rest.id).A >= 0.9 * bestA) headPiece = rest; else leaves = null;   // 剩下最大的比叶子还小，不像「脸 + 两片后脑」
      } else if (bestA < 0.5 * inf.get(headPiece.id).A) leaves = null;
    }
  }
  const sphere = !!(headPiece && leaves);
  let head = groups[0], body = groups[1];
  if (sphere) {
    set(headPiece.id, 'face'); taken.add('face');
    set(leaves[0].id, 'backL'); set(leaves[1].id, 'backR'); taken.add('backL'); taken.add('backR');
    const skip = new Set([headPiece.id, leaves[0].id, leaves[1].id]);
    const left = groups.map(g => g.filter(id => !skip.has(id))).filter(g => g.length);
    head = [headPiece.id]; body = left[0];
    if (body) give(body, 'bodyFront', 'bodyBack');
    groups.length = 0; groups.push(...left);
  } else {
    if (body && inf.get(body[0]).circ > inf.get(head[0]).circ + 0.03) { head = groups[1]; body = groups[0]; }
    if (faced) { const g = groups.find(x => x.includes(faced.id)); if (g) { if (g !== head) { if (body === g) body = head; head = g; } g.sort((m, n) => (byId.get(n).inner || 0) - (byId.get(m).inner || 0) || inf.get(n).A - inf.get(m).A); } }
    give(head, 'faceFlat', 'headBackL', 'headBackR');
    if (body) give(body, 'bodyFront', 'bodyBack');
  }
  const rest = groups.filter(g => g !== head && g !== body).sort((m, n) => inf.get(m[0]).cx - inf.get(n[0]).cx);
  for (const g of rest) {
    const f = inf.get(g[0]), arm = f.slim < 0.5;
    // 面积和身体差不多大的，是另一种做法的身体（比如带手臂的身体 / 不带手臂的），不是耳朵手臂：留给用户选
    if (body && f.A >= 0.35 * inf.get(body[0]).A) continue;
    const kind = arm ? 'arm' : 'ear';
    let side = f.cx < axis ? 'L' : 'R';
    if (taken.has(kind + side + 'F')) side = side === 'L' ? 'R' : 'L';
    if (taken.has(kind + side + 'F')) continue;       // 左右都占了：多出来的留给用户自己选
    give(g, kind + side + 'F', kind + side + 'B');
  }
  // 缩放以脸片为准：3D 里头的大小就是这一片的宽度，和图纸上画多大没关系
  const face = tpl.pieces.find(p => p.role === 'faceFlat' || p.role === 'face');
  if (face) { tpl.faceWidthPx = polyBox(face.poly).w; tpl.scaleLabel = '脸片的宽度'; }
}

function pairImportSeams(tpl, colorImg, w, h, lineMode = true) {
  const CI = window.NunuColorImport;
  if (!CI || !tpl.pieces.length) return null;
  let marks = [], byColor = true;
  try { marks = lineMode ? (CI.scan(colorImg, w, h) || []) : []; } catch (_) { marks = []; }
  let res;
  let unassigned = [];
  // 整张图的线都是同一种颜色（比如全是红线 / 粉线描的轮廓）：那颜色只是线的颜色，不是配对记号，按单色图纸处理
  const share = (() => { const by = {}; let tot = 0; for (const m of marks) { by[m.key] = (by[m.key] || 0) + m.cells; tot += m.cells; } const top = Math.max(0, ...Object.values(by)); return tot ? top / tot : 1; })();
  const coded = marks.length >= 2 && share < 0.85;
  if (coded) {
    // 缝 = 贴着轮廓的一段（直边、弧边、整圈都行）；省道的 V 在尖上劈成两条腿
    const assigned = CI.splitDarts(CI.assignToChains(tpl.pieces, marks, { tol: 18 }));
    unassigned = assigned.filter(m => !m.piece);
    res = CI.pairSeams(assigned, 0.06);
  } else { res = CI.inferSeamsMono(tpl.pieces, tpl.w); byColor = false; unassigned = (res.leftovers || []).map(l => ({ piece: l.piece })); }
  try {
    CI.writeSeamEdges(tpl.pieces, res.seams);
    guessRoles(tpl, res.seams);
    if (res.seams.length) tpl.seams = res.seams.map(s => ({ label: s.id, name: s.label, a: s.a.len, b: s.b.len, color: s.hex, tol: 0.06, dart: s.key === 'dart' }));
  } catch (_) { /* 定用途失败也不影响画图 */ }
  return { ...res, marks, byColor, unassigned };
}

/** 把配出来的缝一条条摆出来：哪两片、哪条边、两边长度差多少 */
function showSeamReport(res, tpl) {
  const host = $('#dockBody');
  if (!host) return;
  const old = $('#seamReport'); if (old) old.remove();
  if (!res || !res.seams.length) {
    if (res) host.insertAdjacentHTML('afterbegin', `<div id="seamReport" class="note-box">
      <b>这张图没认出可以配对的边。</b>
      按头文件里的约定再画一次试试：白底黑线画封闭轮廓，要缝在一起的两条边用同一种颜色描粗线（红线配红线），省道用紫色。
      认到的彩线：${res.marks.length} 段。用途要在下面自己给每片选。</div>`);
    return;
  }
  const rows = res.seams.map(s => `<tr class="pick" data-pair="${s.id}">
      <td><span class="chip" style="background:${s.hex}"></span>${esc(s.label)} · ${esc(s.id)}</td>
      <td>${esc(s.a.pieceName)}${s.a.piece === s.b.piece ? '（一条腿）' : ''}${s.guess ? ' <i style="color:var(--ink-soft)">猜的</i>' : ''}</td>
      <td>${esc(s.b.pieceName)}${s.a.piece === s.b.piece ? '（另一条腿）' : ''}</td>
      <td>${r1(s.a.len)} ↔ ${r1(s.b.len)} px</td>
      <td>${s.ok ? '<span style="color:var(--green-d)">对得上</span>' : `<span style="color:var(--red)">差 ${(s.diff * 100).toFixed(1)}%</span>`}</td>
    </tr>`).join('');
  const bad = res.seams.filter(s => !s.ok).length;
  host.insertAdjacentHTML('afterbegin', `<div id="seamReport">
    <h3>这次配出来的缝合（${res.byColor ? '按颜色：同色成对' : '这张图没有彩线：只做有把握的推断（前后片周边、省道口），其余没法猜'}）</h3>
    ${res.byColor ? '' : `<p class="seam-tip" style="color:var(--red)">单色图纸没法知道哪条边缝哪条边。${(res.notes || []).map(esc).join(' ')} 要把每一条缝都配准：给图纸上色，同色 = 缝在一起（点上面「📖 图纸说明书」看怎么画）。</p>`}
    <table><thead><tr><th>缝哪条</th><th>一边</th><th>另一边</th><th>边长</th><th>是否对应</th></tr></thead><tbody>${rows}</tbody></table>
    ${(res.unassigned && res.unassigned.length) || (res.leftovers && res.leftovers.length) ? `<p class="seam-tip" style="color:var(--red)">还有 ${((res.unassigned || []).length) + ((res.leftovers || []).length)} 段彩线没配上：要么没贴在轮廓上（离轮廓太远），要么这个颜色只出现了一次。每种颜色要成对出现。</p>` : ''}
    <p class="seam-tip">${bad ? `有 ${bad} 条两边长度对不上，缝的时候会皱或拉不拢，建议改图纸让它们一样长。` : '每一条缝的两边长度都对得上。'}点一行可以在图纸上把那条边高亮出来。</p>
  </div>`);
  host.querySelectorAll('#seamReport tr.pick').forEach(tr => tr.onclick = () => {
    const s = res.seams.find(x => x.id === tr.dataset.pair); if (!s) return;
    selectPiece(s.a.piece);
    try { focusRect('selected'); } catch (_) { /* 聚焦失败也无所谓，选中本身已经高亮 */ }
    toast(`${s.label}：${s.a.pieceName} ↔ ${s.b.pieceName}（${r1(s.a.len)} ↔ ${r1(s.b.len)} px）`);
  });
}

/* ============ 导入向导：核对每一片是什么 ============
 * 三种方式最后都走到这里：
 *   方法一 彩线配对（同色 = 缝在一起，直接缝合）；
 *   方法二 透明底 / 填色图（按透明度扣出每一块 → 你定义每块的用途 → 按用途缝合）；
 *   方法三 自动猜用途和缝合（猜得不对就在这里逐片改）。
 * 用途一确定，缝合是规矩（前后片周边缝在一起……），所以改完用途会重新算缝合。 */
const ROLE_TINT = (role) => /^face|^head|^back|^hair|^chin/.test(role) ? '#f6b8c8' : /^body/.test(role) ? '#a9d0f5' : /^ear/.test(role) ? '#b9e5a5' : /^arm/.test(role) ? '#f6d28d' : '#dddddd';
function openImportWizard(tpl, seamRes, opts = {}) {
  let dlg = $('#importWizard');
  if (dlg) dlg.remove();
  dlg = document.createElement('dialog');
  dlg.id = 'importWizard';
  const roles = {};   // 向导里的当前选择（点完成才写回图纸）
  tpl.pieces.forEach((p) => { roles[p.id] = p.role || 'none'; });
  const modeText = { lines: seamRes && seamRes.byColor ? '方法一 · 彩线配对（同色 = 缝在一起）' : '方法三 · 单色线稿自动猜（猜的可能不对）', alpha: '方法二 · 透明底抠图 → 你定义每块的用途', fill: '方法二 · 填色图扣出色块 → 你定义每块的用途' }[opts.mode || 'lines'];
  dlg.innerHTML = `<div class="iwBox">
    <header><h2>🧩 核对每一片是什么</h2><button type="button" class="phClose iwX" aria-label="关闭">✕</button></header>
    <p class="iwLead">认出了 <b>${tpl.pieces.length}</b> 片。${esc(modeText)}。<br>左边点一片、右边改它的用途（猜错很正常）。用途定了，缝合按规矩算：前后片周边缝在一起、耳朵手臂各缝各的。</p>
    <div class="iwMain"><canvas id="iwCanvas" width="520" height="520"></canvas><div class="iwList" id="iwList"></div></div>
    <p class="iwWarn" id="iwWarn"></p>
    <div class="phRow"><button type="button" class="phBtn iwOk">✓ 完成，开始画</button><button type="button" class="phBtn iwAuto">↺ 用自动猜的</button><button type="button" class="phBtn iwCancel">取消这次导入</button></div>
  </div>`;
  document.body.appendChild(dlg);
  const cv = dlg.querySelector('#iwCanvas'), g = cv.getContext('2d');
  let sel = tpl.pieces[0] ? tpl.pieces[0].id : '';
  const allBox = (() => { const bs = tpl.pieces.map((p) => polyBox(p.poly)); const x0 = Math.min(...bs.map(b => b.x)), y0 = Math.min(...bs.map(b => b.y)); return { x: x0, y: y0, w: Math.max(...bs.map(b => b.x + b.w)) - x0, h: Math.max(...bs.map(b => b.y + b.h)) - y0 }; })();
  const sc = Math.min(500 / allBox.w, 500 / allBox.h), ox = (520 - allBox.w * sc) / 2 - allBox.x * sc, oy = (520 - allBox.h * sc) / 2 - allBox.y * sc;
  const paint = () => {
    g.clearRect(0, 0, 520, 520); g.fillStyle = '#fffefb'; g.fillRect(0, 0, 520, 520);
    tpl.pieces.forEach((p, i) => {
      g.beginPath(); p.poly.forEach(([x, y], k) => (k ? g.lineTo(x * sc + ox, y * sc + oy) : g.moveTo(x * sc + ox, y * sc + oy))); g.closePath();
      g.fillStyle = ROLE_TINT(roles[p.id]); g.fill();
      g.lineWidth = p.id === sel ? 3.5 : 1.5; g.strokeStyle = p.id === sel ? '#e0562c' : '#7a6a58'; g.stroke();
      const b = polyBox(p.poly);
      g.fillStyle = '#3f2b1a'; g.font = '700 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(i + 1), (b.x + b.w / 2) * sc + ox, (b.y + b.h / 2) * sc + oy);
    });
  };
  const rowsHtml = () => tpl.pieces.map((p, i) => `<label class="iwRow ${p.id === sel ? 'on' : ''}" data-id="${p.id}"><b>${i + 1}</b><span>${Math.round(polyBox(p.poly).w)}×${Math.round(polyBox(p.poly).h)}</span><select data-id="${p.id}">${C.ROLE_KEYS.map((k) => `<option value="${k}" ${k === roles[p.id] ? 'selected' : ''}>${C.ROLES[k].label}</option>`).join('')}</select></label>`).join('');
  const warn = () => {
    const cnt = {}; Object.values(roles).forEach((r) => { if (r !== 'none') cnt[r] = (cnt[r] || 0) + 1; });
    const dup = Object.keys(cnt).filter((r) => cnt[r] > 1).map((r) => C.ROLES[r].label);
    const hasFace = Object.values(roles).some((r) => C.ROLES[r] && C.ROLES[r].face);
    dlg.querySelector('#iwWarn').innerHTML = [dup.length ? `「${dup.join('、')}」选了不止一片，3D 上会叠在一起。` : '', hasFace ? '' : '还没有哪一片是「脸」：没有脸片就不能画脸、也没有定位线。'].filter(Boolean).map(esc).join('<br>');
  };
  const redraw = () => {
    dlg.querySelector('#iwList').innerHTML = rowsHtml();
    dlg.querySelectorAll('#iwList select').forEach((s) => { s.onchange = () => { roles[s.dataset.id] = s.value; sel = s.dataset.id; paint(); warn(); dlg.querySelectorAll('.iwRow').forEach(r => r.classList.toggle('on', r.dataset.id === sel)); }; });
    dlg.querySelectorAll('.iwRow').forEach((r) => { r.onclick = (e) => { if (e.target.tagName === 'SELECT') return; sel = r.dataset.id; paint(); dlg.querySelectorAll('.iwRow').forEach(x => x.classList.toggle('on', x.dataset.id === sel)); }; });
    paint(); warn();
  };
  cv.onclick = (e) => {
    const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) * 520 / r.width - ox) / sc, y = ((e.clientY - r.top) * 520 / r.height - oy) / sc;
    const hit = [...tpl.pieces].reverse().find((p) => C.inPoly(p.poly, x, y));
    if (hit) { sel = hit.id; redraw(); const row = dlg.querySelector(`.iwRow[data-id="${hit.id}"]`); if (row) row.scrollIntoView({ block: 'nearest' }); }
  };
  const initial = { ...roles };
  dlg.querySelector('.iwAuto').onclick = () => { Object.assign(roles, initial); redraw(); };
  dlg.querySelector('.iwOk').onclick = () => { dlg.close(); applyImportRoles(tpl, roles, seamRes); };
  dlg.querySelector('.iwX').onclick = () => dlg.close();
  dlg.querySelector('.iwCancel').onclick = () => {
    dlg.close();
    if (opts.cancelRemoves) { const k = imports.indexOf(tpl); if (k >= 0) imports.splice(k, 1); switchTemplate(opts.previous && allTemplates().some(t => t.id === opts.previous) ? opts.previous : P.public.id); toast('这次导入取消了。'); }
  };
  redraw();
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}

/** 向导点「完成」：把用途写回图纸，按用途重新算缝合（有彩线配对的话保留彩线的），重建 3D 和设计台 */
function applyImportRoles(tpl, roles, seamRes) {
  const CI = window.NunuColorImport;
  tpl.pieces.forEach((p) => { p.role = roles[p.id] || 'none'; });
  const face = tpl.pieces.find((p) => C.isFace(p));
  if (face) { tpl.faceWidthPx = polyBox(face.poly).w; tpl.scaleLabel = '脸片的宽度'; }
  let res;
  if (seamRes && seamRes.byColor) res = seamRes;                       // 彩线配出来的缝是你亲手标的，不动
  else { const r = CI.seamsFromRoles(tpl.pieces); res = { seams: r.seams, leftovers: [], notes: r.notes, marks: [], byColor: false, unassigned: [] }; }
  try {
    CI.writeSeamEdges(tpl.pieces, res.seams);
    tpl.seams = res.seams.map((s) => ({ label: s.id, name: s.label, a: s.a.len, b: s.b.len, color: s.hex, tol: 0.06, dart: s.key === 'dart' }));
  } catch (_) { /* 缝线写不进去也不影响画图 */ }
  // 用途变了，设计台里按旧用途长出来的白坯就作废了
  const d0 = state.tplData[tpl.id];
  if (d0) { d0.roles = {}; d0.materials = {}; delete d0.design; }
  switchTemplate(tpl.id);
  renderDock();
  showSeamReport(res, tpl);
  save(false);
  const bad = res.seams.filter((s) => !s.ok).length;
  toast(`用途定好了：${tpl.pieces.filter((p) => p.role !== 'none').length} 片上 3D，缝合 ${res.seams.length} 条${bad ? `，其中 ${bad} 条两边长度对不上` : ''}。`);
}

/* ---- 《图纸上传说明书》弹窗：规则和 docs/图纸上传说明书.md 是同一份，改一边记得改另一边 ---- */
function openPatternHelp() {
  let dlg = $('#patternHelp');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'patternHelp';
    dlg.innerHTML = `<div class="phBox">
      <header><h2>📖 图纸上传说明书</h2><button type="button" class="phClose" aria-label="关闭">✕</button></header>
      <p class="phLead">三种方法，看你手上的图纸选。上传后都会弹出「🧩 核对每一片是什么」：猜错的用途在那里改，改完点「完成」。</p>
      <table class="phTable"><tr><th></th><th>你的图纸</th><th>缝合怎么来</th></tr>
        <tr><td><b>方法一</b></td><td>白底黑线轮廓，<b>要缝的边涂成同一种颜色</b></td><td>同色 = 缝在一起，直接缝合，最准</td></tr>
        <tr><td><b>方法二</b></td><td><b>透明底</b>的填色图（抠好的，一块一片）</td><td>扣出每一块 → <b>你定义每块是什么</b> → 按用途缝合</td></tr>
        <tr><td><b>方法三</b></td><td>所有线同一种颜色，没有标记</td><td>先自动猜用途和缝合 → <b>你逐片改</b></td></tr></table>
      <h3>方法一：彩线</h3>
      <img src="sample-pattern.png?v=2" alt="彩线范例" class="phImg">
      <ol>
        <li><b>裁片</b>：白底，黑线封闭轮廓，线粗 2 像素以上；断口会让这一片认不出来。片和片之间留空 10 像素以上，别碰；片里面别画别的线。</li>
        <li><b>缝合</b>：同一种颜色出现两次 = 一条缝。<b>彩线就是轮廓本身</b>——把那一段轮廓描粗涂色（6–10 像素），不是旁边另画一条；直线、弧线、整圈都行。轮廓上留黑线的一段 = 不缝（返口、接头）。</li>
        <li><b>省道</b>：轮廓上凹进去的一个 V 形口，两条边涂<b>紫色</b>。</li>
        <li><b>前后片</b>：对折缝成袋子的，前后各画一份；周边用同一种颜色。</li>
      </ol>
      <p class="phColors">${(window.NunuColorImport ? window.NunuColorImport.MARK_COLORS : []).map(c => `<span><i style="background:${c.hex}"></i>${c.label}${c.key === 'dart' ? '（省道）' : ''}</span>`).join('')}</p>
      <h3>方法二：透明底填色图</h3>
      <div class="phTwo"><figure><img src="sample-transparent.png?v=2" alt="透明底范例" style="background:repeating-conic-gradient(#e8e8e8 0 25%,#fff 0 50%) 0 0/16px 16px"><figcaption>透明底，一块一片（要分开，别连在一起）</figcaption></figure><div><p>算法按「不透明的地方」扣出每一块，但<b>不知道每一块是什么</b>。所以你在「核对每一片是什么」里把用途改对，点完成，缝合就按用途的规矩算：前后片周边缝在一起、耳朵手臂各缝各的、轮廓上的 V 形口认作省道。</p></div></div>
      <h3>方法三：单色线稿，自动猜</h3>
      <div class="phTwo"><figure><img src="sample-mono.png?v=2" alt="单色范例"><figcaption>所有线都是同一种颜色</figcaption></figure><div><p>没有颜色，就没有任何东西告诉算法哪条边缝哪条边。它只做有把握的：认出每一片、认出脸（里面有眼睛框）、一模一样的两片当前后片、V 形口当省道。<b>左右对称的两片缝哪几条边、小片是耳朵还是手臂，它不猜</b>，你在核对里自己选；想一步到位就用方法一上色。</p></div></div>
      <div class="phRow"><a href="sample-pattern.png" download="彩线范例.png" class="phBtn">⬇ 彩线范例</a><a href="sample-transparent.png" download="透明底范例.png" class="phBtn">⬇ 透明底范例</a><a href="sample-mono.png" download="单色范例.png" class="phBtn">⬇ 单色范例</a><button type="button" class="phBtn phUp">📥 上传我的图纸</button></div>
      <h3>导入以后看什么</h3>
      <p>下方有「缝合报告」：每条缝两边各多长，<b style="color:var(--red)">红字 = 差超过 6%</b>，缝起来会皱，改图让它们一样长。「猜的」= 不是你标的。「没配上的彩线」= 没贴在轮廓上，或这个颜色只出现了一次。</p>
      <p class="phFoot">完整说明在项目里的 <code>docs/图纸上传说明书.md</code>。</p>
    </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.phClose').onclick = () => dlg.close();
    dlg.querySelector('.phUp').onclick = () => { dlg.close(); $('#importFile').click(); };
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}

function importImage(file) {
  const prevTemplate = state.template;
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    try {
      const k = Math.min(1, 1500 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const c = cv.getContext('2d', { willReadFrequently: true });
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.drawImage(img, 0, 0, w, h);
      const colorImg = c.getImageData(0, 0, w, h);   // 灰度之前先把颜色留住：缝线的红/紫是认色的关键
      const d = colorImg.data, gray = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) gray[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
      const minArea = Math.max(350, Math.round((w * h) / 3000));
      // 来源判断：① 透明底的填色图（抠好图的）→ 按透明度扣出每一块；② 白底黑线 / 彩线轮廓 → 按封闭轮廓；
      // ③ 轮廓认不出来时，退一步按「不是白色」的色块扣
      const alphaCv = document.createElement('canvas'); alphaCv.width = w; alphaCv.height = h;
      const ac = alphaCv.getContext('2d', { willReadFrequently: true }); ac.drawImage(img, 0, 0, w, h);
      const ad = ac.getImageData(0, 0, w, h).data;
      let clear = 0; for (let i = 3; i < ad.length; i += 4) if (ad[i] < 200) clear++;
      const hasAlpha = clear / (w * h) > 0.02;
      const blobs = (maskAt) => {
        const bm = { w, h, data: new Uint8Array(w * h) };
        for (let i = 0; i < w * h; i++) bm.data[i] = maskAt(i) ? 1 : 0;
        const loops = window.NunuShape.outerContours(bm, { minArea, eps: 1.6, smooth: 2 });
        const list = loops.map((poly) => ({ poly, box: polyBox(poly), area: polyArea(poly), inner: 0 }));
        list.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
        return list;
      };
      let found = [], mode = 'lines';
      if (hasAlpha) { found = blobs((i) => ad[i * 4 + 3] > 40); mode = 'alpha'; }
      if (found.length < 2) { found = C.segmentPieces(gray, w, h, { minArea }); mode = 'lines'; }
      if (found.length < 2) { found = blobs((i) => gray[i] < 238); mode = 'fill'; }
      if (found.length < 2) { toast('没从这张图里认出裁片。要么是透明底的填色图，要么是白底、每片是封闭轮廓的线稿。看「📖 图纸说明书」。', true); return; }
      const name = (file.name || '导入图纸').replace(/\.[^.]+$/, '').slice(0, 20);
      const tpl = C.templateFromPieces('import-' + Date.now().toString(36), name, found.map((f) => ({ ...f, poly: f.poly.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]) })), w, h);
      tpl.pieces.forEach((p, i) => { p.inner = found[i].inner || 0; });   // 里面包着几个小框（认脸用）
      const seamRes = pairImportSeams(tpl, colorImg, w, h, mode === 'lines');
      imports.push(tpl);
      if (imports.length > 4) imports.shift();
      switchTemplate(tpl.id);
      renderDock();
      showSeamReport(seamRes, tpl);
      // 不管哪种方式，都先让你核对每一片是什么：猜的用途很可能不对，改完再开始画
      openImportWizard(tpl, seamRes, { mode, previous: prevTemplate, cancelRemoves: true });
    } finally { URL.revokeObjectURL(url); }
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('这张图打不开。', true); };
  img.src = url;
}
// ★ 必须是顶层变量：switchTemplate（顶层函数）也会读它。
//   以前它是 init() 里的局部变量，switchTemplate 一引用就抛 ReferenceError，初始化当场断在这儿 ——
//   表现就是「换了体型，刷新后又变回 2.5D」。
let designer = null;
// 开页面这一瞬间设计台还没动过手：这期间它吐出来的白坯一律不落库。
// 否则白坯（只有脸 + 身体两片）会被当成「这套图纸做过」，拿 4 片纸样盖掉自创体子的 17 片。
let booting = true;
function switchTemplate(id) {
  endStroke();
  closeRegions();
  state.template = id;
  history.length = 0; redoStack.length = 0;
  setTimeout(() => setHairTarget(id === 'mesh-body' ? 'base' : 'front'), 0);
  ui.selected = ''; ui.hover = '';
  buildDoc(false);
  replayAll();
  sheet.setDoc(doc, true);
  buildModel();
  markAll();
  computeStats();
  updateHint();
  renderDock();
  // 设计台换成这套图纸的作品：这套图纸没做过就用它的白坯，做过就读回原来那份
  if (designer && designer.refresh) {
    const own = state.tplData[id] && state.tplData[id].design;
    const fresh = tplById(id) && window.NunuDesign.initial(tplById(id));
    designer.refresh(isBlankDesign(own) ? fresh : (own || fresh));   // 旧存档里的白坯一律作废，重开新坯
  }
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
function hairHtml() {
  if(doc.construction==='2.5d' && td().design)return '<h3>发片在四层设计里编辑</h3><p>返回四层设计，选择发片层即可新增、叠放和逐片彩绘。这里的裁片与备料由设计自动生成。</p>';
  const cfg = td().hairstyle || { style: 'none', length: 1, color: '#7d594a' }, H = window.NunuHair;
  const styles = Object.entries(H.STYLES).map(([id, name]) => `<button class="tpl ${cfg.style === id ? 'on' : ''}" data-hair-style="${id}"><b>${name}</b></button>`).join('');
  const groups = Object.entries(H.GROUPS).map(([id, name]) => `<label><input type="checkbox" data-hair-group="${id}" ${(cfg.hidden || []).includes(id) ? '' : 'checked'}> ${name}</label>`).join(' ');
  const rows = (doc.seams || []).map((s) => `<tr><td>${esc(s.label || '')}</td><td>${esc(s.name)}</td><td>${(s.a * mm()).toFixed(1)} / ${(s.b * mm()).toFixed(1)} mm</td><td>${pct(Math.abs(s.a - s.b) / Math.max(s.a, s.b, 1e-9))}</td></tr>`).join('');
  return `<div class="two-col"><div><h3>发型模板</h3><div class="tpl-grid">${styles}</div>
    <div class="row"><label>发片底色 <input type="color" id="hairBaseColor" value="${esc(cfg.color || '#7d594a')}"></label><label>长发长度 <input type="range" id="hairLength" min="0.6" max="1.5" step="0.1" value="${cfg.length || 1}"> <output>${Math.round((cfg.length || 1) * 100)}%</output></label></div>
    <h3>分区开关</h3><div class="row">${groups}</div><div class="row"><button id="editHairParts">编辑外挂裁片</button></div>
    <p>长直发分成三片前发、三片后发和左右侧发；双辫子是带波浪边的布制辫子；披肩款使用更宽的后发片。每个部件都有正反两片，可分别涂色。</p>
    <p>${doc.construction === '2.5d' ? '发片两层背对背粘合，毛流向下，干透后沿轮廓裁剪；不加缝份、不塞棉。头部与发根同号「装」对应安装位置。身体前后同形；头部先缝省道。' : '紫色 H…a 先对缝，橙色 H…b 留作返口，翻面后封口。头部和发根的同号「装」标记对应安装位置。'} 预览仅示意装配和厚度，模板尚未经实物试缝。</p>
    ${doc.attachments.length ? '' : '<p>没有安装标记时，需要图纸中有已指定用途的头部裁片。</p>'}</div>
    <div><h3>安装顺序</h3><ol>${doc.attachments.map((a) => `<li>${esc(a.instruction)}</li>`).join('')}</ol>
    <h3>完整缝合对照 · ${(doc.seams || []).length} 条</h3><table><tr><th>缝号</th><th>配对</th><th>两边长度</th><th>差值</th></tr>${rows}</table></div></div>`;
}
function changeHair(change) {
  endStroke();
  const prev = td().hairstyle || { style: 'none', length: 1, color: '#7d594a', hidden: [] };
  td().hairstyle = { ...prev, ...change };
  if (ui.mode === 'regions') closeRegions();
  buildDoc(false); replayAll(); sheet.setDoc(doc, false); buildModel(); markAll(); computeStats();
  ui.selected = ''; history.length = 0; redoStack.length = 0;
  setHairTarget('accessory'); updateHint(); renderDock(); scheduleSave();
}
function wireHair() {
  $$('[data-hair-style]').forEach((b) => { b.onclick = () => changeHair({ style: b.dataset.hairStyle }); });
  $$('[data-hair-group]').forEach((b) => { b.onchange = () => {
    const hidden = new Set(td().hairstyle?.hidden || []);
    if (b.checked) hidden.delete(b.dataset.hairGroup); else hidden.add(b.dataset.hairGroup);
    changeHair({ hidden: [...hidden] });
  }; });
  const color = $('#hairBaseColor'), len = $('#hairLength'), edit = $('#editHairParts');
  if (color) color.onchange = () => changeHair({ color: color.value });
  if (len) len.onchange = () => changeHair({ length: +len.value });
  if (edit) edit.onclick = () => { setHairTarget('accessory'); $('[data-layer="hair"]').click(); focusRect('hair'); };
}
/** 自创体子页签：拖滑条，裁片跟着变（和 2.5D 饼干体平级的另一套体型） */
const BODY_FIELDS = [
  ['headW', '脸片宽度（整张图纸的基准）', 200, 460, 1, (v) => Math.round(v) + ' px'],
  ['headH', '头的高度（脸片宽的 %）', 200, 400, 1, (v) => Math.round((v / 320) * 100) + '%'],
  ['headSquare', '头：圆 ↔ 方', 2, 4.5, 0.1, (v) => v.toFixed(1)],
  ['bodyW', '身体宽（脸片宽的 %）', 110, 260, 1, (v) => Math.round((v / 320) * 100) + '%'],
  ['bodyH', '身体高（脸片宽的 %）', 110, 260, 1, (v) => Math.round((v / 320) * 100) + '%'],
  ['legGap', '两腿之间的缝', 20, 90, 1, (v) => Math.round((v / 320) * 100) + '%'],
  ['legDepth', '腿缝有多深', 30, 110, 1, (v) => Math.round((v / 320) * 100) + '%'],
  ['armLen', '手臂长度', 60, 180, 1, (v) => Math.round((v / 320) * 100) + '%'],
  ['armW', '手臂粗细', 26, 70, 1, (v) => Math.round((v / 320) * 100) + '%'],
  ['headThick', '头的厚度（= 头围条的宽）', 60, 260, 1, (v) => Math.round((v / 320) * 100) + '%'],
  ['bodyThick', '身体的厚度（= 身体围条的宽）', 40, 200, 1, (v) => Math.round((v / 320) * 100) + '%'],
  ['earSize', '耳朵大小', 70, 170, 1, (v) => Math.round((v / 320) * 100) + '%'],
  ['earTilt', '耳朵往外歪几度', 0, 40, 1, (v) => v + '°'],
  ['earSpread', '耳朵离头顶中线多远', 0.25, 0.9, 0.01, (v) => Math.round(v * 100) + '%'],
];
function bodyHtml() {
  const on = state.template === 'custom-body';
  const cu = { ...window.NunuBody.DEFAULTS, ...(state.custom || {}) };
  const fields = BODY_FIELDS.map(([k, label, min, max, step, fmt]) => `<div class="field"><label for="b-${k}">${label}<output id="bo-${k}">${fmt(cu[k])}</output></label><input type="range" id="b-${k}" data-bk="${k}" min="${min}" max="${max}" step="${step}" value="${cu[k]}"></div>`).join('');
  const ears = Object.entries(window.NunuBody.EAR_TYPES).map(([k, t]) => `<option value="${k}" ${cu.ear === k ? 'selected' : ''}>${t.label}</option>`).join('');
  return `<div class="two-col"><div>
    <h3>自创体子（球豆体 · 扁平）</h3>
    <p>这是和「2.5D 饼干体」平级的另一套体型：头是脸片（前片）+ 后脑左右两半（后片）对折缝成的扁头，头和身体各有一条围条（侧围）缝出厚度，耳朵手臂是扁片。<b>一共 ${window.NunuBody.generate(state.custom || {}).pieces.length} 片</b>，画脸、画发片、备料、导出全部直接能用。</p>
    ${on ? '<div class="row"><b style="color:var(--ok)">✓ 正在用这套体型</b></div>' : '<div class="row"><button class="primary" id="useCustom">切换到自创体子</button><span style="font-size:12px;color:var(--muted)">现在用的是别的图纸，你画的东西各自分开存。</span></div>'}
    <div class="row"><label style="font-size:12px">耳朵 <select id="b-ear">${ears}</select></label>
      <label style="font-size:12px;margin-left:10px">手臂 <select id="b-arms"><option value="separate" ${cu.arms === 'separate' ? 'selected' : ''}>手臂分开做</option><option value="integrated" ${cu.arms === 'integrated' ? 'selected' : ''}>手身一体</option></select></label>
      <button id="bodyReset" style="margin-left:10px">恢复默认体型</button></div>
    <div class="fields" style="margin-top:8px">${fields}</div>
    </div><div>
    <h3>这套图纸的特点</h3>
    <ul class="steps" style="margin:0;padding-left:18px">
      <li><b>五官框</b>：脸片上自带一片「脸窗」，眼睛两条宽框、嘴一个小框，只能画在框里——这是典型努努脸的排布。</li>
      <li><b>发片</b>：和后脑共用同一套发际线规则，发片根部对着脸窗上沿缝或贴。</li>
      <li><b>缝份</b>：每条缝两边的长度自动对齐（头围条 = 脸片周长的一半），错位会在下面的缝合表里标红。</li>
      <li><b>对位记号</b>：每段围条的中点、脸片的上下都有记号，缝的时候点对点。</li>
    </ul>
    <div class="note-box">改体型以后，已经画上去的笔画留在原来的位置，超出新轮廓的地方会被裁掉；想重来可以在「设置」里清空。耳朵样子参考的是常见的猫耳、狗耳、鹿耳、鼠耳、狐狸耳、狼耳纸样，缝制前先用便宜布试缝。</div>
    </div></div>
    ${on ? sewingHtml() : ''}`;
}
/** 缝合表：每条缝两边的长度（毫米），对不上会标红；下面是照着缝的步骤 */
function sewingHtml() {
  const tpl = tplById(state.template);
  if (!tpl.seams) return '';
  const k = C.mmPerPx(doc, state.faceMm);
  const rows = tpl.seams.map((sm) => {
    const a = sm.a * k, b = sm.b * k, off = Math.abs(a - b) / Math.max(a, b) > 0.03;
    return `<tr><td>${esc(sm.name)}</td><td>${a.toFixed(0)} mm</td><td>${b.toFixed(0)} mm</td><td>${off ? '<b style="color:var(--bad)">对不上</b>' : '✓'}</td></tr>`;
  }).join('');
  const steps = (tpl.sewing || []).map((t, i) => `<li>${i + 1}. ${esc(t)}</li>`).join('');
  return `<div class="two-col" style="margin-top:14px"><div><h3>缝合表（每条缝两边要一样长）</h3><table><tr><th>缝哪两边</th><th>一边</th><th>另一边</th><th></th></tr>${rows}</table></div>
    <div><h3>照着这样缝</h3><ol class="steps" style="margin:0;padding:0;list-style:none">${steps}</ol></div></div>`;
}
let bodyTimer = 0;
function customChanged() {
  clearTimeout(bodyTimer);
  bodyTimer = setTimeout(() => {
    if (state.template !== 'custom-body') { markAll(); renderDock(); scheduleSave(); return; }
    buildDoc(true);
    replayAll();
    sheet.setDoc(doc, true);
    buildModel();
    markAll();
    computeStats();
    updateHint();
    renderDock();
    scheduleSave();
  }, 140);
}
function dockHtml() {
  if (ui.tab === 'hair') return hairHtml();
  if (ui.tab === 'body') return bodyHtml();
  if (ui.tab === 'pattern') {
    const lvlOf = (t) => t.custom ? '自创体型 · 可调滑条' : t.construction === '2.5d' ? '2.5D · 前后合片' : t.imported ? '导入的' : t.meshBody ? '粗模分片' : '公开图纸';
    const descOf = (t) => t.custom ? '脸片 + 后脑两半 + 围条缝出厚度，五官框和围条都是典型努努做法。' : t.imported ? '自动从图片里拆出来的，用途要自己选。' : esc(t.note || '');
    const cards = allTemplates().map((t) => `<button class="tpl ${state.template === t.id ? 'on' : ''}" data-tpl="${t.id}"><b>${esc(t.name)}</b><span class="lvl">${lvlOf(t)}</span><p>${descOf(t)}</p><p>${t.pieces.length} 片</p></button>`).join('');
    const rows = doc.pieces.map((p) => `<tr class="pick ${p.id === ui.selected ? 'on' : ''}" data-pick="${p.id}"><td><span class="num">${p.label}</span></td><td>${esc(p.name)}</td>
      <td><select data-role="${p.id}" aria-label="${esc(p.name)}的用途">${roleOptions(p.role)}</select></td>
      <td><select data-mat="${p.id}" aria-label="${esc(p.name)}的布"><option value="skin" ${p.material === 'skin' ? 'selected' : ''}>肤色布</option><option value="hair" ${p.material === 'hair' ? 'selected' : ''}>发片布</option></select></td></tr>`).join('');
    return `<div class="two-col"><div><h3>图纸库</h3><div class="tpl-grid" style="margin-top:8px">${cards}</div>
      <div class="row"><button id="resetRoles">恢复默认用途</button></div>
      <div class="note-box">想换体型、上传自己的图纸：回到「制作娃娃」页，最上面一行「🧍 体型」里选，或点「＋ 上传我的图纸」。</div>
      <div class="note-box">${doc.construction === '2.5d' ? '2.5D 身体前后同形，头部顶部各一个省道。先缝省道，再正面相对缝周边，留橙色反口；翻面塞棉后封口。发片在「发型与缝合」中选择，背对背粘合，不加缝份。当前是待试缝的基础模板。' : '旧版图纸保留原来的用途和绘画数据。导入图纸后，需要核对每片用途和缝合关系。'}</div></div>
      <div><h3>每一片的用途和布</h3><table><tr><th>编号</th><th>名称</th><th>用途（贴在 3D 哪里）</th><th>布</th></tr>${rows}</table></div></div>`;
  }
  if (ui.tab === 'mesh') return meshHtml();
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
/* ============ 粗模分片（学 CLO）：粗模 → 3D 笔分裁片 → 展开 → 对着缝合边长调整 ============ */
let rg = null; // 分片编辑的运行时：{ mesh, topo, regions, names, active, brush, tool, hist, redo, errors }
const BEAN_DEFAULTS = { ear: 'cat', headH: 0.95, bodyW: 1, legLen: 0.55, armLen: 0.55 };
function packMesh(mesh, regions, names, extra = {}) {
  const r4 = (v) => Math.round(v * 10000) / 10000;
  state.mesh = { ...(state.mesh || {}), pos: mesh.pos.flat().map(r4), tri: mesh.tri.flat(), regions: Array.from(regions), names, unfolded: false, rev: (state.mesh && state.mesh.rev || 0) + 1, ...extra };
}
function openRegions() {
  if (!state.mesh) return;
  endStroke();
  const mesh = meshObj();
  rg = { mesh, topo: MeshM().topology(mesh), regions: Int32Array.from(state.mesh.regions), names: { ...state.mesh.names }, active: 1, brush: 0.2, tool: 'paint', hist: [], redo: [], errors: [], stroke: null };
  const ids = Object.keys(rg.names).map(Number);
  rg.active = ids.length ? ids[0] : 1;
  ui.mode = 'regions';
  if (model) openRegions.view = { ...model.view };
  if (model) model.setRegionView(mesh, rg.regions);
  setCaption();
  renderDock();
}
function closeRegions() {
  if (ui.mode !== 'regions') return;
  if (rg && rg.stroke && rg.stroke.length) { rg.hist.push(rg.stroke); rg.stroke = null; saveRegions(); }
  ui.mode = 'doll';
  if (model) { model.clearRegionView(); if (openRegions.view) Object.assign(model.view, openRegions.view); }
  setCaption();
  dirty.scene = true; schedule();
}
function setCaption() {
  const el = $('#modelPanel .caption');
  if (!el) return;
  $('#returnDoll').hidden = ui.mode !== 'regions';
  if (!setCaption.orig) setCaption.orig = el.textContent;
  el.textContent = ui.mode === 'regions' ? '分片模式：左键涂色（涂的是右边选中的那一片），右键拖动旋转，滚轮缩放。同色的面会成为一片裁片，色块之间的黑线就是缝合线。' : setCaption.orig;
}
function saveRegions() { if (state.mesh && rg) { state.mesh.regions = Array.from(rg.regions); state.mesh.names = rg.names; state.mesh.unfolded = false; scheduleSave(); } }
function regionCounts() { const c = {}; rg.regions.forEach((r) => { c[r] = (c[r] || 0) + 1; }); return c; }
function paintRegion(faces) {
  const id = rg.tool === 'erase' ? 0 : rg.active, changed = [];
  for (const f of faces) if (rg.regions[f] !== id) { rg.stroke.push([f, rg.regions[f]]); rg.regions[f] = id; changed.push(f); }
  if (changed.length) model.updateRegions(rg.regions, changed);
}
function regionUndo(redo) {
  const from = redo ? rg.redo : rg.hist, to = redo ? rg.hist : rg.redo, g = from.pop();
  if (!g) { toast(redo ? '没有可以重做的了' : '没有可以撤销的了'); return; }
  const inv = [];
  for (let i = g.length - 1; i >= 0; i--) { const [f, prev] = g[i]; inv.push([f, rg.regions[f]]); rg.regions[f] = prev; }
  to.push(inv.reverse());
  model.updateRegions(rg.regions);
  saveRegions(); renderDock();
}
function startBean() {
  const p = { ...BEAN_DEFAULTS, ...(state.beanParams || {}) };
  const mesh = MeshM().makeBean({ ...p, level: 4 }), pre = MeshM().presetBean(mesh, mesh.parts);
  state.beanParams = p;
  packMesh({ pos: mesh.pos, tri: mesh.tri }, pre.regions, pre.names, { source: 'bean' });
  toast('生成了球豆素体，并按头、身体、手臂、腿、耳朵自动分了片（每个部分前后各一片）');
  openRegions();
  scheduleSave();
}
function importObj(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const mesh = MeshM().parseOBJ(String(reader.result));
    if (!mesh.tri.length) { toast('这个 OBJ 里没有读到有效的面。要三角形或四边形的网格。', true); return; }
    if (mesh.tri.length > 20000) { toast(`面太多了（${mesh.tri.length}），先在 Blender 里减到 2 万个面以内。`, true); return; }
    packMesh(mesh, new Array(mesh.tri.length).fill(0), {}, { source: 'obj' });
    toast(`导入了 ${mesh.pos.length} 个点、${mesh.tri.length} 个面。用 3D 笔分出每一片裁片，再点「展开成裁片」。`);
    openRegions();
    scheduleSave();
  };
  reader.onerror = () => toast('OBJ 文件没能读取成功，可以再试一次。', true);
  reader.readAsText(file);
}
function newPiece() {
  const ids = Object.keys(rg.names).map(Number), id = (ids.length ? Math.max(...ids) : 0) + 1;
  rg.names[id] = `片 ${id}`; rg.active = id; rg.tool = 'paint';
  saveRegions(); renderDock();
}
function deletePiece(id) {
  const faces = [];
  rg.regions.forEach((r, f) => { if (r === id) faces.push(f); });
  const g = faces.map((f) => [f, id]);
  for (const f of faces) rg.regions[f] = 0;
  delete rg.names[id];
  if (g.length) { rg.hist.push(g); rg.redo.length = 0; }
  model.updateRegions(rg.regions);
  saveRegions(); renderDock();
}
function doUnfold() {
  if (!rg) return;
  const t0 = performance.now(), draft = { mesh: rg.mesh, regions: Array.from(rg.regions), names: rg.names };
  const darts = MeshM().suggestDarts(draft, { maxPer: 2 });
  const res = MeshM().unfold({ ...draft, darts });
  if (!res.ok) { rg.errors = res.errors; renderDock(); toast(`有 ${res.errors.length} 片展不开，看右边的提示`, true); return; }
  rg.errors = [];
  packMesh(rg.mesh, rg.regions, rg.names, { source: state.mesh.source, unfolded: true, darts, template: res.template, report: res.report });
  meshCache = { rev: state.mesh.rev, res };
  closeRegions();
  switchTemplate('mesh-body');
  toast(`展开好了：${res.template.pieces.length} 片，用了 ${Math.round(performance.now() - t0)} 毫秒。看「娃娃体型」页签里的失真和缝合对照。`);
}
const pct = (v) => (v * 100).toFixed(1) + '%';
function meshHtml() {
  const bean = { ...BEAN_DEFAULTS, ...(state.beanParams || {}) }, has = !!state.mesh;
  const earOpts = [['cat', '猫耳'], ['bear', '熊耳'], ['bunny', '兔耳'], ['none', '没有耳朵']].map(([k, t]) => `<option value="${k}" ${bean.ear === k ? 'selected' : ''}>${t}</option>`).join('');
  const sl = (k, label, min, max, step) => `<div class="field"><label for="m-${k}">${label}<output id="mo-${k}">${bean[k]}</output></label><input type="range" id="m-${k}" data-mk="${k}" min="${min}" max="${max}" step="${step}" value="${bean[k]}"></div>`;
  let h = `<h3>娃娃体型与裁片</h3>
    <p>这里调整还没画脸、加头发的娃娃素体：头有多高、身体多宽、手脚多长。原来的“粗模”就是这个素体。</p>
    <p>只想做长发或辫子，可以直接用「发型与缝合」里的模板，不需要重新生成体型。</p>
    <p>需要自定义身体时，生成素体会自动分出裁片；不同颜色代表不同裁片。「展开成裁片」会把它们摊成纸样，同号缝线互相配对。</p>
    <div class="row"><button class="primary" id="beanGo">${has ? '重新生成球豆素体' : '生成球豆素体'}</button>
      <label style="font-size:12px">耳朵 <select id="m-ear">${earOpts}</select></label>
      <button id="objBtn">导入 OBJ（Blender 导出）…</button></div>
    <div class="fields" style="margin-top:6px">${sl('headH', '头的高度', 0.8, 1.2, 0.01)}${sl('bodyW', '身体宽度', 0.8, 1.3, 0.01)}${sl('legLen', '腿的长度', 0.2, 1, 0.01)}${sl('armLen', '手臂长度', 0.3, 1, 0.01)}</div>`;
  if (!has) return h + '<div class="note-box">还没有粗模。点「生成球豆素体」会得到一个头、身体、两臂、两腿、两耳连在一起的素体，并且自动分好片；也可以导入你自己建的模型，自己分片。</div>';
  if (ui.mode === 'regions' && rg) {
    const counts = regionCounts(), ids = Object.keys(rg.names).map(Number).sort((a, b) => a - b), un = counts[0] || 0;
    const err = Object.fromEntries((rg.errors || []).map((e) => [e.id, e.reason]));
    const rows = ids.map((id) => `<tr class="pick ${rg.active === id ? 'on' : ''}" data-rp="${id}"><td><span class="chip" style="background:${model ? model.regionHex(id) : '#ccc'}"></span></td><td><input data-rn="${id}" value="${esc(rg.names[id])}" style="width:110px"></td><td>${counts[id] || 0} 面</td><td style="color:var(--bad);font-size:11px">${esc(err[id] || '')}</td><td><button data-rd="${id}" title="删掉这一片（它的面变成没分）">删</button></td></tr>`).join('');
    h += `<div class="two-col" style="margin-top:12px"><div><h3>分片（${ids.length} 片，还有 ${un} 个面没分）</h3>
      <div class="row"><button class="seg ${rg.tool === 'paint' ? 'on' : ''}" id="rgPaint">✎ 涂</button><button class="seg ${rg.tool === 'erase' ? 'on' : ''}" id="rgErase">擦</button>
        <label style="font-size:12px">笔刷 <input type="range" id="rgBrush" min="0.05" max="0.6" step="0.01" value="${rg.brush}" style="width:110px"></label>
        <button id="rgExit">退出分片模式</button><button id="rgNew">＋ 新建一片</button><button id="rgAuto">自动分片（球豆）</button><button id="rgClear">清空分片</button></div>
      <table><tr><th></th><th>名字</th><th>面数</th><th>展开提示</th><th></th></tr>${rows}</table></div>
      <div><h3>下一步</h3><p>每一片必须是「一整块、中间没有洞、只有一圈边」（像一张饼）；管子（手臂、腿）要沿着长度分成前后两片才摊得平。</p>
      <div class="row"><button class="primary" id="rgUnfold">展开成裁片</button></div>
      <div class="note-box">3D 里：左键涂色，右键拖动旋转，滚轮缩放；撤销 / 重做按顶上的 ↶ ↷。名字以「头·前」开头的那片会当成脸片，「头·后」当成发片布。</div></div></div>`;
    return h;
  }
  const u = meshUnfold(), tpl = state.template === 'mesh-body';
  h += `<div class="row" style="margin-top:10px"><button id="rgOpen">回到分片调整</button>${tpl ? '' : '<button class="primary" id="rgUse">使用已展开的娃娃</button>'}<span style="font-size:12px;color:var(--muted)">调整分区时保留上一次纸样；重新展开保留笔迹，裁片变化后需核对位置。</span></div>`;
  if (u && u.ok) {
    const prow = u.report.pieces.map((p) => `<tr><td>${esc(p.name)}</td><td>${pct(p.meanErr)}</td><td style="${p.maxErr > 0.25 ? 'color:var(--warn)' : ''}">${pct(p.maxErr)}</td></tr>`).join('');
    const srows = u.template.seams.slice().sort((a, b) => Math.abs(b.a - b.b) / Math.max(b.a, b.b) - Math.abs(a.a - a.b) / Math.max(a.a, a.b)).slice(0, 12).map((sm) => { const k = C.mmPerPx(doc, state.faceMm), d = Math.abs(sm.a - sm.b) / Math.max(sm.a, sm.b); return `<tr><td><span class="chip" style="background:${sm.color}"></span>${esc(sm.name)}</td><td>${(sm.a * k).toFixed(0)} mm</td><td>${(sm.b * k).toFixed(0)} mm</td><td style="${d > 0.06 ? 'color:var(--bad);font-weight:600' : ''}">${pct(d)}</td></tr>`; }).join('');
    h += `<div class="two-col" style="margin-top:12px"><div><h3>展开后的失真（边长和粗模比）</h3><table><tr><th>裁片</th><th>平均</th><th>最大</th></tr>${prow}</table>
      <p style="margin-top:8px">失真大的地方（特别是头顶的圆弧）摊平时会被拉伸或压缩：要么多分几片（像橙子瓣），要么在那里剪一个省道。</p></div>
      <div><h3>缝合边长对照（差得最多的 12 条）</h3><table><tr><th>缝</th><th>一边</th><th>另一边</th><th>差</th></tr>${srows}</table>
      <p style="margin-top:8px">差超过 6% 缝起来会皱：回去调整分片，或者在差得多的那一边加省道 / 缝缩。同一条缝两边颜色一样，数字是缝号。</p></div></div>`;
  }
  return h;
}
function wireMesh() {
  const g = (id) => document.getElementById(id);
  $$('#dockBody [data-mk]').forEach((el) => { el.oninput = () => { state.beanParams = { ...(state.beanParams || {}), [el.dataset.mk]: +el.value }; $('#mo-' + el.dataset.mk).textContent = el.value; scheduleSave(); }; });
  if (g('m-ear')) g('m-ear').onchange = (e) => { state.beanParams = { ...(state.beanParams || {}), ear: e.target.value }; scheduleSave(); };
  if (g('beanGo')) g('beanGo').onclick = () => { if (state.mesh && !confirm('重新生成会换掉现在的粗模和分片，确定吗？')) return; startBean(); };
  if (g('objBtn')) g('objBtn').onclick = () => $('#meshFile').click();
  if (g('rgOpen')) g('rgOpen').onclick = openRegions;
  if (g('rgUse')) g('rgUse').onclick = () => switchTemplate('mesh-body');
  if (!rg || ui.mode !== 'regions') return;
  if (g('rgPaint')) g('rgPaint').onclick = () => { rg.tool = 'paint'; renderDock(); };
  if (g('rgErase')) g('rgErase').onclick = () => { rg.tool = 'erase'; renderDock(); };
  if (g('rgBrush')) g('rgBrush').oninput = (e) => { rg.brush = +e.target.value; };
  if (g('rgNew')) g('rgNew').onclick = newPiece;
  if (g('rgExit')) g('rgExit').onclick = () => { closeRegions(); renderDock(); };
  if (g('rgAuto')) g('rgAuto').onclick = () => {
    if (!state.mesh || state.mesh.source !== 'bean') { toast('自动分片只对内置的球豆素体管用。导入的模型请用 3D 笔自己分。', true); return; }
    const m = MeshM().presetBean(rg.mesh, MeshM().makeBean({ ...BEAN_DEFAULTS, ...(state.beanParams || {}), level: 4 }).parts);
    rg.regions = Int32Array.from(m.regions); rg.names = m.names; rg.hist = []; rg.redo = []; rg.errors = [];
    model.updateRegions(rg.regions); saveRegions(); renderDock();
  };
  if (g('rgClear')) g('rgClear').onclick = () => { rg.regions.fill(0); rg.names = {}; rg.hist = []; rg.redo = []; rg.errors = []; model.updateRegions(rg.regions); saveRegions(); renderDock(); };
  if (g('rgUnfold')) g('rgUnfold').onclick = doUnfold;
  $$('#dockBody [data-rp]').forEach((tr) => { tr.onclick = (e) => { if (e.target.closest('input,button')) return; rg.active = +tr.dataset.rp; rg.tool = 'paint'; renderDock(); }; });
  $$('#dockBody [data-rn]').forEach((el) => { el.oninput = () => { rg.names[el.dataset.rn] = el.value; saveRegions(); }; });
  $$('#dockBody [data-rd]').forEach((b) => { b.onclick = () => deletePiece(+b.dataset.rd); });
}
function renderDock() {
  if (!report) return;
  $('#dockBody').innerHTML = dockHtml();
  wireDock();
}
function highlightRow() { $$('#dockBody tr.pick').forEach((tr) => tr.classList.toggle('on', tr.dataset.pick === ui.selected)); }
function wireDock() {
  wireHair();
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
  // —— 自创体子：滑条、耳朵、手臂 ——
  $$('#dockBody [data-bk]').forEach((el) => {
    el.oninput = () => {
      const f = BODY_FIELDS.find((q) => q[0] === el.dataset.bk);
      state.custom = { ...(state.custom || {}), [el.dataset.bk]: +el.value };
      $('#bo-' + el.dataset.bk).textContent = f[5](+el.value);
      customChanged();
    };
  });
  const earSel = $('#b-ear'), armSel = $('#b-arms');
  if (earSel) earSel.onchange = () => { state.custom = { ...(state.custom || {}), ear: earSel.value }; customChanged(); };
  if (armSel) armSel.onchange = () => { state.custom = { ...(state.custom || {}), arms: armSel.value }; customChanged(); };
  const useC = $('#useCustom');
  if (useC) useC.onclick = () => { switchTemplate('custom-body'); };
  const resetC = $('#bodyReset');
  if (resetC) resetC.onclick = () => { state.custom = null; customChanged(); };
  wireMesh();
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
      closeRegions();
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
    b.onclick = () => { if (b.dataset.tab !== 'mesh') closeRegions(); ui.tab = b.dataset.tab; $$('.tabs [data-tab]').forEach((x) => x.classList.toggle('on', x === b)); renderDock(); };
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
  $('#meshFile').onchange = (e) => { const f = e.target.files && e.target.files[0]; if (f) importObj(f); e.target.value = ''; };
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
    meshUnfold, startBean, openRegions, closeRegions, get rg() { return rg; }, startStroke, feed, endStroke, undo, redo, computeStats, selectPiece, switchTemplate, importImage, pointCheck, zoneOf, compose, td,
  };
  designer=null;                                   // 顶层那个，这里只赋值不重新声明
  let designPending=false,designTimer=null;
  const modelHome=$('#model').parentElement;
  const flushDesign=()=>{
    if(!designPending)return;
    clearTimeout(designTimer);designPending=false;
    const view=model?{...model.view}:null;
    buildDoc(false);replayAll();for(const p of allPieces())compose(p);buildModel();
    if(model&&view)Object.assign(model.view,view);
    if(sheet)sheet.setDoc(doc,true);
    computeStats();markAll();renderDock();
  };
  {
    // 四层设计台不再只认 2.5D 饼干体：只要有脸片和身体片的图纸都能进去做。
    // 每份图纸各自存自己的 design（存在 tplData[模板 id] 里），互不相串。
    const designData=()=>state.tplData[state.template] ||= {roles:{},materials:{},strokes:[],cut:{}};
    const projectStore=STORE+'-design-projects';
    const readProjects=()=>{const text=localStorage.getItem(projectStore);if(!text)return [];const list=JSON.parse(text);if(!Array.isArray(list))throw Error('已保存作品列表无法读取，当前作品未清空。');return list;};
    const archiveCurrent=value=>{
      const snapshot=clone(state);snapshot.tplData[state.template]={...clone(designData()),design:value};
      const list=readProjects();list.push({id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),name:state.name,state:snapshot});
      localStorage.setItem(projectStore,JSON.stringify(list));return list;
    };
    const activateProject=next=>{
      next=clone(next);next.studioMode='2.5d';next.designerVersion=1;
      next.template=next.template||DEFAULTS.template;
      next.tplData ||= {};next.tplData[next.template] ||= {roles:{},materials:{},strokes:[],cut:{}};
      // 白坯按这份图纸自己的体型来：自创体子就用自创体子的脸和身体
      const value=next.tplData[next.template].design ||= window.NunuDesign.initial(tplById(next.template)||P.cookie);
      // 先确认写入成功，再替换内存中的作品；存储失败时保留原作。
      localStorage.setItem(STORE,JSON.stringify(next));clearTimeout(saveTimer);
      for(const key of Object.keys(state))delete state[key];Object.assign(state,next);
      history.length=0;redoStack.length=0;$('#projectName').value=state.name;
      return value;
    };
    designer=window.NunuDesign.mount($('#layerDesigner'),{
      base:()=>tplById(state.template)||P.cookie,   // 白坯跟着当前这套图纸走
      // 「整张图纸」体型（努努体、公开图纸）：后脑/耳朵/手臂/围条按缝合表连成一体，
      // 不是 2.5D 那种能拉扯的白坯 —— 改体型一律拒绝（2026-10-30 春子定的规矩）
      shapeLocked:()=>{
        const t=tplById(state.template);
        if(!t)return false;
        const mapped=t.pieces.filter(p=>p.mesh&&/^头部/.test(p.name)).length===2;
        return !mapped&&t.pieces.some(p=>C.isFace(p))&&t.pieces.some(p=>p.role==='bodyFront');
      },
      get:()=>{const v=designData().design;return isBlankDesign(v)?null:v;},   // 白坯当作没有，设计台用图纸自己长出新坯
      projects:()=>readProjects().map((p,i)=>({id:p.id,name:p.name+' · '+(i+1)})),
      newProject:value=>{try{const list=archiveCurrent(value),next=clone(DEFAULTS);next.template=state.template;next.name='新的努努 '+(list.length+1);return activateProject(next);}catch(error){throw Error('新建未完成，当前作品保留。'+error.message);}},
      openProject:(id,value)=>{try{const entry=readProjects().find(p=>p.id===id);if(!entry)throw Error('找不到这份作品。');archiveCurrent(value);return activateProject(entry.state);}catch(error){throw Error('切换未完成，当前作品保留。'+error.message);}},
      change:(value,options)=>{
        if(booting)return;            // 刚开页面时的白坯不算「动过手」，别拿它盖掉原图纸的裁片
        value.edited=true;            // 打上记号：这份 design 是画过的，纸样就跟它走
        designData().design=value;   // 用哪套体型不用改，跟着当前图纸走
        if(options?.geometry===false&&!designPending){
          const mapped=window.NunuDesign.patternDesigns(tplById(state.template),value);
          if(mapped){for(const p of doc.pieces){const nd=mapped[p.id];if(!nd||nd.objectId!==options.objectId)continue;p.design=nd;for(const layer of C.LAYERS)replayLayer(p,layer);markPiece(p.id);}}
          else for(const p of doc.pieces){if(!p.design||p.design.objectId!==options.objectId)continue;const o=value.objects.find(o=>o.id===p.design.objectId);if(!o)continue;p.design.strokes=o[p.design.mirror?'back':'front'];p.design.color=p.design.mirror?o.backColor:o.color;for(const layer of C.LAYERS)replayLayer(p,layer);markPiece(p.id);}
          scheduleStats();
        }else{designPending=true;clearTimeout(designTimer);designTimer=setTimeout(flushDesign,0);}
        scheduleSave();
      },
      live:(value,objectId)=>{
        if(booting)return;            // 同上：开页面时的实时预览也是白坯，不落库
        value.edited=true;
        designData().design=value;
        // 整张图纸体型（努努体、公开图纸）：笔迹要先换算回图纸片的坐标再画，不然按住的那一刻已经画好的东西全「清空」，放手才回来
        const mapped=window.NunuDesign.patternDesigns(tplById(state.template),value);
        if(mapped){
          for(const p of doc.pieces){const nd=mapped[p.id];if(!nd||(objectId&&nd.objectId!==objectId))continue;p.design=nd;
            for(const layer of C.LAYERS)replayLayer(p,layer);compose(p);if(model)model.refresh(p.id);}
        }else
        for(const p of doc.pieces){if(!p.design||(objectId&&p.design.objectId!==objectId))continue;const o=value.objects.find(o=>o.id===p.design.objectId);if(!o)continue;p.design.strokes=o[p.design.mirror?'back':'front'];p.design.color=p.design.mirror?o.backColor:o.color;
          for(const layer of C.LAYERS)replayLayer(p,layer);compose(p);if(model)model.refresh(p.id);
        }
        dirty.scene=true;schedule();
      },
      bodyTypes:()=>allTemplates().filter(t=>t.id!=='mesh-body').map(t=>({id:t.id,on:t.id===state.template,name:({'nunu-25d':'2.5D 饼干体','nunu-public':'努努·公开图纸','custom-body':'球豆体·自创'})[t.id]||(t.name||'导入的').slice(0,10)})),
      pickBody:id=>{if(id!==state.template){switchTemplate(id);}},
      importPattern:()=>$('#importFile').click(),
      isImported:()=>{const t=tplById(state.template);return !!(t&&t.imported);},
      rolesWizard:()=>{const t=tplById(state.template);if(!t||!t.imported)return;
        const ed=state.tplData[t.id]&&state.tplData[t.id].design&&state.tplData[t.id].design.edited;
        if(ed&&!confirm('重新核对用途会换掉设计台里按旧用途长出来的白坯，已经画的笔迹会清掉。继续吗？'))return;
        openImportWizard(t,{byColor:false,seams:[],marks:[]},{mode:'lines'});},
      patternHelp:()=>openPatternHelp(),
      activate:()=>{designPending=true;},
      focus:objectId=>{
        flushDesign();if(!model)return;
        let lo=Infinity,hi=-Infinity,xlo=Infinity,xhi=-Infinity;
        for(const p of doc.pieces)if(p.design?.objectId===objectId&&p.mesh)for(let i=0;i<p.mesh.pos.length;i+=3){const ps=p.mesh.pos;lo=Math.min(lo,ps[i+1]);hi=Math.max(hi,ps[i+1]);xlo=Math.min(xlo,ps[i]);xhi=Math.max(xhi,ps[i]);}
        if(Number.isFinite(lo)){model.view.target=(lo+hi)/2;model.view.zoom=Math.min(3,Math.max(0.5,4/Math.max(hi-lo,xhi-xlo,1)));dirty.scene=true;schedule();}
      },
      preview3d:slot=>{
        const cv=$('#model');(slot||modelHome).appendChild(cv);
        ui.paint3d=false;ui.mode='doll';flushDesign();
        if(model){model.resize();dirty.scene=true;schedule();return true;}return false;
      },
      view:name=>{
        if(!model)return;
        model.view.rotY={front:0,side:Math.PI/2,back:Math.PI,all:-0.45}[name]??0;model.view.rotX=name==='all'?0.12:0;
        if(name==='all'){let lo=Infinity,hi=-Infinity,xlo=Infinity,xhi=-Infinity;for(const p of doc.pieces)if(p.mesh)for(let i=0;i<p.mesh.pos.length;i+=3){const ps=p.mesh.pos;lo=Math.min(lo,ps[i+1]);hi=Math.max(hi,ps[i+1]);xlo=Math.min(xlo,ps[i]);xhi=Math.max(xhi,ps[i]);}if(Number.isFinite(lo)){model.view.target=(lo+hi)/2;model.view.zoom=Math.min(2.2,Math.max(0.5,4.4/Math.max(hi-lo,xhi-xlo,1)));}}
        dirty.scene=true;schedule();
      },
      flush:flushDesign,
      paper:()=>{flushDesign();ui.hand=true;ui.paint3d=false;sheet.resize();sheet.fit();if(model)model.resize();markAll();}
    });
    $('#layerDesigner').hidden=false;
    $('#btnExport').addEventListener('click',flushDesign,true);
    window.__nunu.designer=designer;
    booting=false;                    // 页面开好了：从现在起设计台的改动才真的算数
    // 给「我的」页面用：按存档 id 打开一只之前做的努努；失败时当前作品原样保留
    window.__nunu.openProjectById=id=>{
      const entry=readProjects().find(p=>p.id===id);
      if(!entry)throw Error('找不到这份作品。');
      archiveCurrent(clone(designData().design));
      const value=activateProject(entry.state);
      designer.refresh(value);
      return entry.name;
    };
  }
}
init();
})();
