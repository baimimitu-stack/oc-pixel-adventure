/* 外挂发型：独立的正反裁片、缝线、安装定位点。3D 是装配示意，不模拟布料。 */
(function (root) {
'use strict';
const C = root.NunuCore;
const STYLES = { none: '不加外挂发片', long: '长直发', braids: '双辫子', cape: '披肩大发片' };
const GROUPS = { front: '前发', back: '后发', sideL: '左侧发', sideR: '右侧发', braidL: '左辫子', braidR: '右辫子' };
const length = (ps) => ps.reduce((s, p, i) => i ? s + Math.hypot(p[0] - ps[i - 1][0], p[1] - ps[i - 1][1]) : s, 0);

function headFrame(doc) {
  const samples = [];
  for (const p of doc.pieces) {
    if (p.mesh && (C.isFace(p) || p.role === 'meshHair' || /^头/.test(p.name))) {
      for (let i = 0; i < p.mesh.pos.length; i += 3) samples.push({ pos: p.mesh.pos.slice(i, i + 3), uv: p.mesh.uv.slice(i / 3 * 2, i / 3 * 2 + 2), piece: p.id });
    } else if (C.ROLES[p.role].target === 'head') {
      for (let j = 0; j <= 20; j++) for (let i = 0; i <= 20; i++) {
        const x = p.box.x + p.box.w * i / 20, y = p.box.y + p.box.h * j / 20;
        if (!C.inPoly(p.poly, x, y)) continue;
        const dir = C.pieceDir(p, x, y);
        if (dir) samples.push({ pos: C.targetPoint('head', dir, 0.02), uv: [x, y], piece: p.id });
      }
    }
  }
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const s of samples) s.pos.forEach((v, k) => { lo[k] = Math.min(lo[k], v); hi[k] = Math.max(hi[k], v); });
  const center = samples.length ? lo.map((v, k) => (v + hi[k]) / 2) : C.TARGETS.head.pos.slice();
  const radius = samples.length ? lo.map((v, k) => Math.max(0.1, (hi[k] - v) / 2)) : C.TARGETS.head.r.slice();
  return { center, radius, samples };
}

function apply(tpl, config = {}) {
  const style = Object.hasOwn(STYLES, config.style) ? config.style : 'none';
  if (style === 'none') return tpl;
  const doc = C.makeDoc(tpl), frame = headFrame(doc), [cx, cy, cz] = frame.center, [rx, ry, rz] = frame.radius;
  // 未指定头部用途的导入图纸不猜安装位置。
  if (!frame.samples.length) return tpl;
  const scale = Math.min(1.5, Math.max(0.6, Number(config.length) || 1));
  const color = /^#[0-9a-f]{6}$/i.test(config.color || '') ? config.color : '#7d594a';
  const unit = C.unitPerPx({ faceWidthPx: tpl.faceWidthPx });
  const pieces = tpl.pieces.map((p) => ({ ...p, seamEdges: [...(p.seamEdges || [])], mounts: [] }));
  const bonded=tpl.construction==='2.5d';
  const seams = [...(tpl.seams || [])], pairs = { ...(tpl.pairs || {}) }, attachments = [...(tpl.attachments || [])];
  const guides = { ...(tpl.guides || {}), ticks: [...(tpl.guides?.ticks || [])], notches: [...(tpl.guides?.notches || [])] };
  const specs = [];
  const add = (group, name, width, height, x, y, z, scallop = false) => {
    specs.push({ group, name, width, height, x, y, z, scallop });
  };
  for (const side of [-1, 0, 1]) add('front', ['前发·左', '前发·中', '前发·右'][side + 1], rx * 0.55, ry * (side ? 0.65 : 0.48), cx + side * rx * 0.53, cy + ry * 0.88, cz + rz * 0.96);
  if (style === 'long' || style === 'cape') {
    for (const side of [-1, 0, 1]) add('back', ['后发·左', '后发·中', '后发·右'][side + 1], rx * (style === 'cape' ? 0.82 : 0.72), ry * 2.0 * scale, cx + side * rx * 0.68, cy + ry * 0.65, cz - rz * 1.03);
    for (const s of [-1, 1]) add(s < 0 ? 'sideL' : 'sideR', s < 0 ? '左侧长发' : '右侧长发', rx * 0.38, ry * 1.65 * scale, cx + s * rx * 1.01, cy + ry * 0.35, cz + rz * 0.4);
  } else {
    for (const s of [-1, 1]) add(s < 0 ? 'braidL' : 'braidR', s < 0 ? '左辫子' : '右辫子', rx * 0.48, ry * 2.0 * scale, cx + s * rx * 1.05, cy + ry * 0.15, cz, true);
    add('back', '后发·短片', rx * 1.6, ry * 0.9, cx, cy + ry * 0.65, cz - rz * 1.03);
  }
  let px = 40, py = tpl.h + 70, rowH = 0;
  for (const [i, s] of specs.entries()) {
    if (config.hidden?.includes(s.group)) continue;
    const target = [s.x, s.y, s.z];
    const anchor = frame.samples.reduce((a, b) => {
      const d = (v) => v.pos.reduce((sum, x, k) => sum + (x - target[k]) ** 2, 0);
      return d(a) <= d(b) ? a : b;
    });
    const w = s.width / unit, h = s.height / unit, rows = 24;
    const profile = Array.from({ length: rows + 1 }, (_, j) => {
      const t = j / rows;
      const f = s.scallop ? (0.75 + 0.23 * Math.sin(t * Math.PI * 12) ** 2) * (1 - 0.7 * t ** 8) : Math.max(0.09, Math.sqrt(Math.max(0, 1 - t ** 4)));
      return { y: h * t, half: w * f / 2 };
    });
    const local = profile.map((r) => [-r.half, r.y]).concat(profile.slice().reverse().map((r) => [r.half, r.y]));
    const ids = [], made = [];
    for (const side of [1, -1]) {
      if (px + w + 40 > tpl.w && px > 40) { px = 40; py += rowH + 70; rowH = 0; }
      const ox = px + w / 2, oy = py, poly = local.map(([x, y]) => [ox + x, oy + y]);
      const pos = [], uv = [], idx = [], cols = 12;
      profile.forEach((r, j) => {
        for (let col = 0; col <= cols; col++) {
          const sign = col / cols * 2 - 1;
          const x = sign * r.half;
          const rootBlend = (1 - j / rows) ** 4;
          // 两片在周边合拢，横截面鼓成圆弧；辫子比普通发片更饱满。
          const bulge = bonded ? 0.008 : r.half * unit * (s.scallop ? 0.85 : 0.38)
            * Math.sqrt(Math.max(0, 1 - sign * sign)) * Math.sin(Math.PI * j / rows) ** 0.45;
          pos.push(s.x + x * unit + (anchor.pos[0] - s.x) * rootBlend,
            s.y - r.y * unit + (anchor.pos[1] - s.y) * rootBlend,
            s.z + (anchor.pos[2] - s.z) * rootBlend + side * bulge);
          uv.push(ox + x, oy + r.y);
        }
        if (j < rows) for (let col = 0; col < cols; col++) {
          const a = j * (cols + 1) + col, b = a + cols + 1;
          if (side > 0) idx.push(a, b, a + 1, a + 1, b, b + 1);
          else idx.push(a, a + 1, b, a + 1, b + 1, b);
        }
      });
      const id = `hair-${style}-${s.group}-${i}-${side > 0 ? 'front' : 'back'}`;
      const p = { id, name: s.name + (side > 0 ? '·正片' : '·反片'), role: 'meshHair', smooth: false, poly, mesh: { pos, uv, idx }, accessory: s.group, bonded, baseColor: color, seamEdges: [], mounts: [] };
      pieces.push(p); ids.push(id); made.push(p);
      if (bonded) { p.name+=' · 裁1片 · 毛流↓'; p.quantity=1; }
      px += w + 70; rowH = Math.max(rowH, h);
    }
    pairs[ids[0]] = ids[1]; pairs[ids[1]] = ids[0];
    // 周边缝与根部返口分开编号：先缝周边，翻面，再封根部返口。
    for (const [part, label, col] of bonded ? [] : [['edge', `H${i + 1}a`, '#8a5ca8'], ['root', `H${i + 1}b`, '#bf7c31']]) {
      const lines = made.map((p) => part === 'edge' ? p.poly : [p.poly[p.poly.length - 1], p.poly[0]]);
      made.forEach((p, k) => {
        p.seamEdges.push({ label, color: col, pts: lines[k] });
        const mid = lines[k][Math.floor(lines[k].length / 2)];
        guides.ticks.push({ piece: p.id, x: mid[0], y: mid[1], dx: 0, dy: 1, color: col });
      });
      seams.push({ label, name: `${s.name}·${part === 'edge' ? '周边缝' : '返口（翻面后藏针封口）'}`, a: length(lines[0]), b: length(lines[1]), pieceA: ids[0], pieceB: ids[1], color: col, tol: 0.01 });
    }
    const label = `装${i + 1}`, host = pieces.find((p) => p.id === anchor.piece);
    host.mounts.push({ label, x: anchor.uv[0], y: anchor.uv[1] });
    const rootPt = made[1].poly[0], rootEnd = made[1].poly.at(-1);
    made[1].mounts.push({ label, x: (rootPt[0] + rootEnd[0]) / 2, y: rootPt[1] });
    attachments.push({ label, name: s.name, host: anchor.piece, piece: ids[1], instruction: bonded ? `${label}：${s.name}两片毛流都向下，背对背涂布料胶贴合；干透后沿轮廓裁剪，不加缝份、不塞棉。根部对准「${host.name}」同号安装点固定。` : `${label}：${s.name}正反片对缝 H${i + 1}a，留 H${i + 1}b 翻面；封返口后，将根部中心对准「${host.name}」的同号安装点，沿根部加固缝。` });
  }
  return { ...tpl, pieces, pairs, seams, guides, attachments, hairStyle: style, h: py + rowH + 50 };
}
root.NunuHair = { STYLES, GROUPS, apply, headFrame };
})(typeof window === 'undefined' ? globalThis : window);
