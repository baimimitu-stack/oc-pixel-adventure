/* 努努体（整张图纸）体型保护：
 * 图纸 17 片是完整的（脸片/后脑/四耳/四臂/身体前后/围条，缝合表相连），
 * 设计台只能往上映射彩绘、往里追加发片衣服，绝不能清空重长。
 * 2026-10-30 之前：template() 对非 2.5D 一律 t.pieces=[]，涂一笔 17 片毁成 4 片。 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ctx = { console };
vm.createContext(ctx);
for (const f of ['nunu-shape.js', 'pattern-data.js', 'nunu-core.js', 'nunu-body.js', 'nunu-design.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/games/nunu-studio/' + f), 'utf8'), ctx);
const D = ctx.NunuDesign, B = ctx.NunuBody;

const make = () => {
  const tpl = B.generate({ earType: 'cat' });
  return { tpl, d: D.initial(tpl) };
};

test('努努体上涂一笔，图纸还是 17 片（以前会毁成 4 片）', () => {
  const { tpl, d } = make();
  d.objects.find(o => o.id === 'face').front.push({ color: '#e04a4a', width: 6, brush: 'round', points: [[190, 120], [200, 125], [210, 130]] });
  const t = D.template(tpl, d);
  assert.equal(t.pieces.length, 17);
  assert.ok(t.seams.length >= 5, '缝合表原样保留');
});

test('彩绘映射进图纸原片：脸片的笔迹落在脸片坐标里，身体背面落到身体·后', () => {
  const { tpl, d } = make();
  d.objects.find(o => o.id === 'face').front.push({ color: '#e04a4a', width: 6, brush: 'round', points: [[200, 120], [210, 126]] });
  d.objects.find(o => o.id === 'body').back.push({ color: '#3a6ea8', width: 5, brush: 'round', points: [[210, 300], [220, 306]] });
  const t = D.template(tpl, d);
  const inBox = (piece, pts) => {
    const b = piece.poly.reduce((a, [x, y]) => ({ x0: Math.min(a.x0, x), x1: Math.max(a.x1, x), y0: Math.min(a.y0, y), y1: Math.max(a.y1, y) }), { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 });
    return pts.every(([x, y]) => x >= b.x0 - 30 && x <= b.x1 + 30 && y >= b.y0 - 30 && y <= b.y1 + 30);
  };
  const face = t.pieces.find(p => p.role === 'faceFlat');
  assert.ok(face.design, '脸片拿到 design');
  assert.ok(inBox(face, face.design.strokes[0].points), '脸的笔迹落在脸片上');
  const back = t.pieces.find(p => p.role === 'bodyBack');
  assert.ok(back.design, '身体·后拿到 design');
  assert.ok(inBox(back, back.design.strokes[0].points), '背面笔迹落在身体·后上');
  const front = t.pieces.find(p => p.role === 'bodyFront');
  assert.ok(!front.design, '正面没画就不映到身体·前');
});

test('身体正面画的一笔也要映射到身体·前（以前只映背面，3D 上看不见、撤销也像没动）', () => {
  const { tpl, d } = make();
  const bo = d.objects.find(o => o.id === 'body');
  const bb = ctx.NunuCore.boxOfPoly(bo.poly);
  bo.front.push({ color: '#3a6ea8', width: 5, brush: 'round', points: [[bb.x + bb.w / 2, bb.y + bb.h / 2], [bb.x + bb.w / 2 + 12, bb.y + bb.h / 2 + 6]] });
  let t = D.template(tpl, d);
  const front = t.pieces.find(p => p.role === 'bodyFront');
  assert.ok(front.design, '画了正面就要映射到身体·前');
  assert.equal(front.design.strokes.length, 1);
  const fb = ctx.NunuCore.boxOfPoly(front.poly), q = front.design.strokes[0].points[0];
  assert.ok(q[0] >= fb.x && q[0] <= fb.x + fb.w && q[1] >= fb.y && q[1] <= fb.y + fb.h, '笔迹落在身体·前的范围内');
  bo.front.length = 0;   // 撤销之后：又回到没画过
  t = D.template(tpl, d);
  assert.ok(!t.pieces.find(p => p.role === 'bodyFront').design, '撤销后身体·前恢复图纸原样');
});

test('面部背面页：后脑左右两片各画各的，笔迹落到对应的图纸片；没画过就不碰', () => {
  const { tpl, d } = make();
  let t = D.template(tpl, d);
  assert.ok(!t.pieces.find(p => p.role === 'headBackL').design, '没画过，后脑保持图纸原样（头发底色不被盖掉）');
  const hl = d.objects.find(o => o.id === 'headL');
  const hb = ctx.NunuCore.boxOfPoly(hl.poly);
  hl.front.push({ color: '#3a6ea8', width: 5, brush: 'round', points: [[hb.x + hb.w / 2, hb.y + hb.h / 2], [hb.x + hb.w / 2 + 10, hb.y + hb.h / 2 + 6]] });
  t = D.template(tpl, d);
  const pl = t.pieces.find(p => p.id === hl.piece), pr = t.pieces.find(p => p.role === 'headBackR');
  assert.equal(pl.design.strokes.length, 1);
  assert.ok(!pr.design, '右片没画就不动');
  const b = ctx.NunuCore.boxOfPoly(pl.poly), q = pl.design.strokes[0].points[0];
  assert.ok(q[0] >= b.x && q[0] <= b.x + b.w && q[1] >= b.y && q[1] <= b.y + b.h, '笔迹落在后脑·左的范围内');
  assert.equal(t.pieces.length, 17, '图纸还是 17 片，后脑对象不会长出新片');
});

test('实时预览用的 patternDesigns 和整套纸样映射出来的一模一样（不然按住画的时候已画好的会「清空」）', () => {
  const { tpl, d } = make();
  const fb = ctx.NunuCore.boxOfPoly(d.objects.find(o => o.id === 'face').poly);
  d.objects.find(o => o.id === 'face').front.push({ color: '#e04a4a', width: 6, brush: 'round', points: [[fb.x + 100, fb.y + 100], [fb.x + 120, fb.y + 110]] });
  d.objects.find(o => o.id === 'body').back.push({ color: '#3a6ea8', width: 5, brush: 'round', points: [[200, 300], [210, 306]] });
  const t = D.template(tpl, d), live = D.patternDesigns(tpl, d);
  for (const p of t.pieces.filter(p => p.design && !p.id.startsWith('design-'))) {
    assert.ok(live[p.id], p.id + ' 在实时预览里也有 design');
    assert.equal(JSON.stringify(live[p.id]), JSON.stringify(p.design), p.id + ' 映射结果相同');
  }
  assert.equal(D.patternDesigns(null, d), null, '没有图纸就回 null，走老路');
});

test('圆头（公开图纸）上的发片 / 衣服贴在头 / 身体表面，不埋进去（穿模）', () => {
  const tpl = ctx.NunuPattern.public, d = D.initial(tpl);
  const fb = ctx.NunuCore.boxOfPoly(d.objects.find(o => o.id === 'face').poly);
  const cx = fb.x + fb.w / 2, cy = fb.y + fb.h / 2;
  // 一片刘海：整片在脸圆里面，靠上
  D.add(d, 'hair', [[cx - 70, cy - 90], [cx + 70, cy - 90], [cx + 70, cy - 40], [cx - 70, cy - 40]], '#7d594a');
  const t = D.template(tpl, d);
  const hair = t.pieces.filter(p => p.design && p.design.layer === 'hair');
  assert.equal(hair.length, 1, '发片只有 1 片（有厚度的一整片毛料）');
  const R = [1.5, 1.4, 1.45], P = [0, 2.05, 0];
  const front = hair[0].mesh.pos;
  let minF = 1e9;
  for (let i = 0; i < front.length; i += 3) {
    const e = Math.pow(front[i] / R[0], 2) + Math.pow((front[i + 1] - P[1]) / R[1], 2) + Math.pow(front[i + 2] / R[2], 2);
    minF = Math.min(minF, e);
  }
  assert.ok(minF >= 0.98, `发片正面每个点都在头的椭球外面（最小 ${minF.toFixed(3)}，<1 就是埋进头里了）`);
  const zs = []; for (let i = 2; i < front.length; i += 3) zs.push(front[i]);
  assert.ok(Math.min(...zs) > 0.5, '刘海在脸正面，不是躺在头中心那个平面上');
  // 衣服：贴在身体前面，不是 z 平放
  const d2 = D.initial(tpl), bb = ctx.NunuCore.boxOfPoly(d2.objects.find(o => o.id === 'body').poly);
  D.add(d2, 'clothes', [[bb.x + 40, bb.y + 40], [bb.x + bb.w - 40, bb.y + 40], [bb.x + bb.w - 40, bb.y + bb.h - 60], [bb.x + 40, bb.y + bb.h - 60]], '#3a6ea8');
  const t2 = D.template(tpl, d2);
  const cf = t2.pieces.find(p => p.design && p.design.layer === 'clothes' && p.id.endsWith('-front')).mesh.pos;
  const cz = []; for (let i = 2; i < cf.length; i += 3) cz.push(cf[i]);
  assert.ok(Math.max(...cz) > 0.5, '衣服中间鼓起来的地方也在身体外面（以前固定 0.23，埋在身体里）');
});

test('发型模板：每种都长出能单独编辑的发片对象（带 preset 标记），刘海是贴、两侧 / 辫子 / 披肩是缝', () => {
  const tpl = ctx.NunuPattern.public;
  const want = { bangs: 3, long: 5, braids: 5, cape: 4 };
  for (const [key, n] of Object.entries(want)) {
    const d = D.initial(tpl);
    const ids = D.hairPreset(d, key, '#7d594a');
    assert.equal(ids.length, n, `${key} 长出 ${n} 片`);
    const hair = d.objects.filter(o => o.layer === 'hair');
    assert.ok(hair.every(o => o.preset === key && o.root), '每片都带模板标记和发根');
    assert.equal(hair.filter(o => o.attach === 'glued').length, 3, '三片刘海是「贴」');
    assert.equal(hair.filter(o => o.attach === 'sewn').length, n - 3, '其余是「缝」');
    const t = D.template(tpl, d);
    assert.equal(t.pieces.length, 15 + n, `${key}：15 片图纸 + 每片发片只裁 1 片`);
  }
});

test('贴图也跟着映射：中心点和大小都换算进图纸坐标', () => {
  const { tpl, d } = make();
  d.objects.find(o => o.id === 'face').img = { src: 'data:x', cx: 200, cy: 130, w: 120, h: 90, rot: 0 };
  const t = D.template(tpl, d);
  const face = t.pieces.find(p => p.role === 'faceFlat');
  const b = face.poly.reduce((a, [x, y]) => ({ x0: Math.min(a.x0, x), x1: Math.max(a.x1, x), y0: Math.min(a.y0, y), y1: Math.max(a.y1, y) }), { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 });
  const img = face.design.img;
  assert.ok(img.cx > b.x0 && img.cx < b.x1 && img.cy > b.y0 && img.cy < b.y1, '贴图中心落在脸片范围内');
  assert.ok(img.w < 320, '贴图宽按比例缩进了图纸坐标');
});

test('加发片/衣服是追加：17 片原样 + 新片成对出现', () => {
  const { tpl, d } = make();
  D.add(d, 'hair', [[120, 60], [280, 55], [290, 140], [110, 145]], '#7d594a');
  const t = D.template(tpl, d);
  assert.equal(t.pieces.length, 18, '17 片图纸 + 发片 1 片');
  assert.ok(t.pieces.some(p => p.role === 'gussetBody'), '围条还在');
  const grown = t.pieces.filter(p => p.id.startsWith('design-'));
  assert.equal(grown.length, 1, '发片只有一片，没有反片');
  assert.ok(!t.pairs[grown[0].id], '单片不配对');
  assert.ok(t.attachments.some(a => /发际线/.test(a.instruction)), '发片工艺说明跟着来');
});

test('努努体的白坯就是图纸本身：脸片+身体前，脸不悬空', () => {
  const { tpl, d } = make();
  assert.equal(d.objects.length, 4, '脸、身体 + 面部背面页的后脑左右两片');
  assert.equal(JSON.stringify(d.objects.filter(o => o.piece).map(o => o.id).sort()), '["headL","headR"]');
  const face = d.objects.find(o => o.id === 'face'), body = d.objects.find(o => o.id === 'body');
  const fp = face.poly, bp = body.poly;
  const faceBox = fp.reduce((a, [x, y]) => ({ y0: Math.min(a.y0, y), y1: Math.max(a.y1, y) }), { y0: 1e9, y1: -1e9 });
  const bodyBox = bp.reduce((a, [x, y]) => ({ y0: Math.min(a.y0, y), y1: Math.max(a.y1, y) }), { y0: 1e9, y1: -1e9 });
  assert.ok(bodyBox.y0 >= faceBox.y1 - faceBox.y1 * 0.2, '身体在脸下面（脖子处略压接）');
});
