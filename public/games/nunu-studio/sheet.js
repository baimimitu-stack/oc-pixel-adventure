/* 努努赛博定制台 · 图样（二维版面）
 * 就是公开图纸本身：每一片裁片在它原来的位置。裁片里面显示的是它自己的画布（和 3D 贴的是同一张），所以两边同步。
 * 坐标全部用图纸像素；毫米 = 像素 × env.mm。 */
(function (root) {
'use strict';
const C = root.NunuCore;

/** opts.fixed = {w,h}：导出图片用，不看页面上有多大，按这个大小画 */
function create(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const view = { zoom: 1, x: 0, y: 0 };
  let doc = null, dpr = 1, W = 300, H = 300, extent = null;

  function resize() {
    if (opts.fixed) {
      dpr = 1; W = opts.fixed.w; H = opts.fixed.h;
      canvas.width = Math.round(W); canvas.height = Math.round(H);
      return;
    }
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(50, r.width);
    H = Math.max(50, r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  const size = () => ({ w: Math.max(doc.w, extent ? extent.w : 0), h: Math.max(doc.h, extent ? extent.h : 0) });
  function fit() {
    if (!doc) return;
    const e = size(), z = Math.min((W - 24) / e.w, (H - 24) / e.h);
    view.zoom = z;
    view.x = (W - e.w * z) / 2;
    view.y = (H - e.h * z) / 2;
  }
  const setExtent = (w, h) => { extent = { w, h }; };
  /** 让图纸上的一块矩形区域刚好装满画板 */
  function fitRect(x, y, w, h) {
    const z = Math.min((W - 24) / w, (H - 24) / h);
    view.zoom = z;
    view.x = (W - w * z) / 2 - x * z;
    view.y = (H - h * z) / 2 - y * z;
  }
  const setDoc = (d, refit) => { doc = d; if (refit) fit(); };
  const toSheet = (cx, cy) => { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.zoom, y: (cy - r.top - view.y) / view.zoom }; };
  function zoomAt(f, cx, cy) {
    const r = canvas.getBoundingClientRect();
    const px = (cx == null ? r.left + W / 2 : cx) - r.left, py = (cy == null ? r.top + H / 2 : cy) - r.top;
    const mx = (px - view.x) / view.zoom, my = (py - view.y) / view.zoom;
    view.zoom = Math.max(0.2, Math.min(12, view.zoom * f));
    view.x = px - mx * view.zoom;
    view.y = py - my * view.zoom;
  }
  const pan = (dx, dy) => { view.x += dx; view.y += dy; };

  /** 屏幕上的点落在哪一片：先看缝线里面（能画），再看裁剪线里面（只能选中）。env.cutPolys[id] 是裁剪线 */
  function pieceAt(cx, cy, cutPolys) {
    if (!doc) return null;
    const s = toSheet(cx, cy);
    let cutHit = null;
    for (let i = doc.pieces.length - 1; i >= 0; i--) {
      const p = doc.pieces[i];
      if (s.x < p.box.x - 40 || s.x > p.box.x + p.box.w + 40 || s.y < p.box.y - 40 || s.y > p.box.y + p.box.h + 40) continue;
      if (C.inPoly(p.poly, s.x, s.y)) return { piece: p, local: { x: s.x, y: s.y }, inSew: true };
      const cut = cutPolys && cutPolys[p.id];
      if (!cutHit && cut && C.inPoly(cut, s.x, s.y)) cutHit = { piece: p, local: { x: s.x, y: s.y }, inSew: false };
    }
    return cutHit;
  }
  /** 按住一片画的时候，指针移到哪都换算成图纸坐标（可能已经在片外） */
  function localOn(piece, cx, cy) {
    const s = toSheet(cx, cy);
    return { x: s.x, y: s.y, inside: C.inPoly(piece.poly, s.x, s.y) };
  }

  function path(poly) {
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }

  function label(p, env) {
    const z = 1 / view.zoom, fs = Math.max(9, Math.min(15, 12 * z * 1.1));
    ctx.save();
    ctx.font = `600 ${fs}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3 * z;
    ctx.strokeStyle = 'rgba(255,255,255,.92)';
    ctx.fillStyle = '#5f594e';
    const text = `${p.label} ${p.name}`, b = p.box;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    let x = cx, y = cy;
    // 名字放得下就放在片里；放不下就只在里面放编号，名字写在片的下面
    if (ctx.measureText(text).width <= b.w * 0.9) { ctx.strokeText(text, x, y); ctx.fillText(text, x, y); }
    else {
      ctx.strokeText(p.label, x, y); ctx.fillText(p.label, x, y);
      ctx.font = `500 ${fs * 0.85}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
      y = b.y + b.h + fs * 0.9;
      ctx.strokeText(p.name, x, y); ctx.fillText(p.name, x, y);
    }
    void env;
    ctx.restore();
  }

  function notch(n) {
    const z = 1 / view.zoom, s = 9;
    const base = n.y + (n.dir < 0 ? -s : s);
    ctx.beginPath();
    ctx.moveTo(n.x - s * 0.6, base);
    ctx.lineTo(n.x + s * 0.6, base);
    ctx.lineTo(n.x, n.y);
    ctx.closePath();
    ctx.lineWidth = 1.2 * z;
    ctx.strokeStyle = '#7d766a';
    ctx.stroke();
  }

  function drawPiece(env, p) {
    const z = 1 / view.zoom, c = env.comps[p.id], cut = env.cutPolys && env.cutPolys[p.id];
    ctx.save();
    if (cut && env.showCut) {
      path(cut);
      ctx.setLineDash([5 * z, 4 * z]);
      ctx.lineWidth = 1 * z;
      ctx.strokeStyle = '#b3aea0';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (c) ctx.drawImage(c.canvas, p.box.x, p.box.y, p.box.w, p.box.h);
    path(p.poly);
    ctx.lineWidth = 1.5 * z;
    ctx.strokeStyle = '#6f695e';
    ctx.stroke();
    if (p.role === 'none') {
      // 没有放到 3D 上的片，轮廓叠一道虚线
      path(p.poly);
      ctx.setLineDash([4 * z, 3 * z]);
      ctx.strokeStyle = '#a79f90';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    label(p, env);
    if (p.id === env.selectedId || p.id === env.hoverId) {
      path(p.poly);
      ctx.lineWidth = (p.id === env.selectedId ? 3.2 : 2) * z;
      ctx.strokeStyle = p.id === env.selectedId ? '#e0a02f' : '#9fb28a';
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 画出来的发片裁片：排在图样右边的空白区，按它的颜色填，带虚线裁剪线 */
  function drawExtra(d) {
    const z = 1 / view.zoom, fs = Math.max(9, Math.min(14, 11 * z * 1.1));
    ctx.save();
    ctx.translate(d.dx, d.dy);
    path(d.cut);
    ctx.setLineDash([5 * z, 4 * z]);
    ctx.lineWidth = 1 * z;
    ctx.strokeStyle = '#b3aea0';
    ctx.stroke();
    ctx.setLineDash([]);
    path(d.poly);
    ctx.fillStyle = d.hex;
    ctx.fill();
    ctx.lineWidth = 1.5 * z;
    ctx.strokeStyle = '#6f695e';
    ctx.stroke();
    ctx.font = `600 ${fs}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3 * z;
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.fillStyle = '#4a443a';
    const cx = d.box.x + d.box.w / 2, cy = d.box.y + d.box.h / 2;
    ctx.strokeText(d.label, cx, cy);
    ctx.fillText(d.label, cx, cy);
    ctx.restore();
  }

  /** 发片画板：一块浅色画布（前发是圆盘），画在上面的发片会变成发片裁片，也会另起一层贴到 3D 脑袋上 */
  function drawBoard(b, poly) {
    const z = 1 / view.zoom, bx = b.box;
    ctx.save();
    if (poly) { path(poly); ctx.clip(); }
    ctx.fillStyle = '#fbfaf3';
    ctx.fillRect(bx.x, bx.y, bx.w, bx.h);
    if (b.canvas) ctx.drawImage(b.canvas, bx.x, bx.y, bx.w, bx.h);
    ctx.restore();
    ctx.save();
    ctx.setLineDash([6 * z, 4 * z]);
    ctx.lineWidth = (b.selected ? 2.4 : 1.4) * z;
    ctx.strokeStyle = b.selected ? '#e0a02f' : '#9fb28a';
    if (poly) { path(poly); ctx.stroke(); } else ctx.strokeRect(bx.x, bx.y, bx.w, bx.h);
    ctx.setLineDash([]);
    ctx.font = `600 ${Math.max(9, Math.min(15, 12 * z * 1.1))}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#6b7a58';
    ctx.fillText(`${b.name}（${b.hint}）`, bx.x, bx.y - 4 * z);
    ctx.restore();
  }

  /** 画出来的发片裁片：排在图样右边的空白区，按它的颜色填，带虚线裁剪线 */
  function drawExtra(d) {
    const z = 1 / view.zoom, fs = Math.max(9, Math.min(14, 11 * z * 1.1));
    ctx.save();
    ctx.translate(d.dx, d.dy);
    path(d.cut);
    ctx.setLineDash([5 * z, 4 * z]);
    ctx.lineWidth = 1 * z;
    ctx.strokeStyle = '#b3aea0';
    ctx.stroke();
    ctx.setLineDash([]);
    path(d.poly);
    ctx.fillStyle = d.hex;
    ctx.fill();
    ctx.lineWidth = 1.5 * z;
    ctx.strokeStyle = '#6f695e';
    ctx.stroke();
    ctx.font = `600 ${fs}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3 * z;
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.fillStyle = '#4a443a';
    const cx = d.box.x + d.box.w / 2, cy = d.box.y + d.box.h / 2;
    ctx.strokeText(d.label, cx, cy);
    ctx.fillText(d.label, cx, cy);
    ctx.restore();
  }

  /** 发片画板：一块浅色画布，画在上面的发片会变成黏在头顶的发片裁片 */
  function drawBoard(b) {
    const z = 1 / view.zoom, bx = b.box;
    ctx.save();
    ctx.fillStyle = '#fbfaf3';
    ctx.fillRect(bx.x, bx.y, bx.w, bx.h);
    if (b.canvas) ctx.drawImage(b.canvas, bx.x, bx.y, bx.w, bx.h);
    ctx.setLineDash([6 * z, 4 * z]);
    ctx.lineWidth = 1.4 * z;
    ctx.strokeStyle = '#9fb28a';
    ctx.strokeRect(bx.x, bx.y, bx.w, bx.h);
    ctx.setLineDash([]);
    ctx.font = `600 ${Math.max(9, Math.min(15, 12 * z * 1.1))}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#7a8a66';
    ctx.fillText('发片画板：自由画发片（刺猬头也行），黏在头顶', bx.x + 8, bx.y + 6);
    ctx.restore();
  }

  function draw(env) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!doc) return;
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.zoom, view.zoom);
    const z = 1 / view.zoom;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(60,70,40,.18)';
    ctx.shadowBlur = 12 * z;
    const e = size();
    ctx.fillRect(0, 0, e.w, e.h);
    ctx.shadowColor = 'transparent';
    doc.pieces.forEach((p) => drawPiece(env, p));
    for (const b of env.boards || []) drawBoard(b, b.poly);
    for (const d of env.extra || []) drawExtra(d);
    if (env.showSeams && doc.guides && doc.guides.notches) for (const n of doc.guides.notches) if (doc.byId[n.piece]) notch(n);
    // 校准尺：50 mm
    const len = 50 / env.mm;
    ctx.strokeStyle = '#8a8677';
    ctx.fillStyle = '#8a8677';
    ctx.lineWidth = 1.4 * z;
    const bx = 24, by = doc.h - 18;
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx + len, by);
    ctx.moveTo(bx, by - 5); ctx.lineTo(bx, by + 5);
    ctx.moveTo(bx + len, by - 5); ctx.lineTo(bx + len, by + 5);
    ctx.stroke();
    ctx.font = `${Math.max(10, 12 * z * 1.1)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('5 cm（打印后用尺量一下）', bx + len + 8, by + 4 * z);
    ctx.restore();
  }

  return { view, resize, fit, fitRect, setDoc, setExtent, toSheet, zoomAt, pan, pieceAt, localOn, draw, get doc() { return doc; } };
}

root.NunuSheet = { create };
})(window);
