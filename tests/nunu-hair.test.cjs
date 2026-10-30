const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ctx = { console }; vm.createContext(ctx);
for (const file of ['nunu-shape.js', 'pattern-data.js', 'nunu-core.js', 'nunu-mesh.js', 'nunu-hair.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/games/nunu-studio', file), 'utf8'), ctx);
const C = ctx.NunuCore, M = ctx.NunuMesh, H = ctx.NunuHair, base = ctx.NunuPattern.public;
const mesh = M.makeBean({ level: 3 }), pre = M.presetBean(mesh, mesh.parts), body = M.unfold({ mesh, ...pre }).template;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

for (const template of [base, body]) for (const style of ['long', 'braids', 'cape']) {
  test(`${template.id} / ${style}：独立正反裁片、完整配缝和头部安装标记`, () => {
    const before = JSON.stringify(template), tpl = H.apply(template, { style }), doc = C.makeDoc(tpl);
    assert.equal(JSON.stringify(template), before, '不修改原图纸');
    const added = doc.pieces.filter((p) => p.accessory);
    assert.ok(added.length >= 12);
    assert.equal(tpl.attachments.length * 2, added.length);
    for (const p of added) {
      assert.ok(p.mesh.pos.every(Number.isFinite));
      assert.equal(p.mesh.pos.length / 3, p.mesh.uv.length / 2);
      assert.ok(p.mesh.idx.every((i) => Number.isInteger(i) && i >= 0 && i < p.mesh.pos.length / 3));
      const q = doc.byId[p.partner]; assert.equal(q.partner, p.id);
      near(p.area, q.area);
      const mirrored = C.mirrorOf(doc, p.id, p.axis, p.box.y + p.box.h / 2);
      near(mirrored.x, q.axis); near(mirrored.y, q.box.y + q.box.h / 2);
      for (let v = 0; v < p.mesh.pos.length / 3; v++) {
        if (v % 13 !== 0 && v % 13 !== 12 && v >= 13 && v < p.mesh.pos.length / 3 - 13) continue;
        for (let k = 0; k < 3; k++) near(p.mesh.pos[v * 3 + k], q.mesh.pos[v * 3 + k]);
      }
      const center = (12 * 13 + 6) * 3 + 2;
      assert.ok(Math.abs(p.mesh.pos[center] - q.mesh.pos[center]) > 0.1, '正反片之间有可见厚度');
      for (const r of added) if (r !== p) {
        const overlap = Math.min(p.box.x + p.box.w, r.box.x + r.box.w) - Math.max(p.box.x, r.box.x) > 0.01 && Math.min(p.box.y + p.box.h, r.box.y + r.box.h) - Math.max(p.box.y, r.box.y) > 0.01;
        assert.equal(overlap, false, `${p.name} 与 ${r.name} 不重叠`);
      }
    }
    for (const s of tpl.seams.filter((s) => /^H/.test(s.label))) {
      near(s.a, s.b);
      assert.equal(added.flatMap((p) => p.seamEdges).filter((e) => e.label === s.label).length, 2);
    }
    for (const a of tpl.attachments) {
      assert.ok(doc.byId[a.host]); assert.ok(doc.byId[a.piece]);
      assert.equal(doc.pieces.flatMap((p) => p.mounts).filter((m) => m.label === a.label).length, 2);
    }
    const head = H.headFrame(C.makeDoc(template));
    assert.ok(added.some((p) => p.mesh.pos.some((v, i) => i % 3 === 1 && v < head.center[1] - head.radius[1])), '长发垂到头部以下');
    const stats = Object.fromEntries(doc.pieces.map((p) => [p.id, { coverage: 1, colors: [{ hex: '#7d594a', frac: 1 }] }]));
    assert.equal(C.bom(doc, stats, { faceMm: 100 }).pieceCount, doc.pieces.length);
  });
}
test('长度、分区与重新载入：头部不变、部件 ID 稳定、关掉后可恢复', () => {
  const full = H.apply(body, { style: 'long', length: 1 });
  const shorter = H.apply(body, { style: 'long', length: 0.6, hidden: ['sideL'] });
  assert.ok(!shorter.pieces.some((p) => p.accessory === 'sideL'));
  const id = full.pieces.find((p) => p.accessory === 'back').id;
  assert.ok(C.boxOfPoly(shorter.pieces.find((p) => p.id === id).poly).h < C.boxOfPoly(full.pieces.find((p) => p.id === id).poly).h);
  assert.equal(H.apply(body, { style: 'none' }), body);
  assert.deepEqual(JSON.parse(JSON.stringify(H.apply(body, JSON.parse('{"style":"long","length":1}')))), JSON.parse(JSON.stringify(full)));
});
test('粗模前后发画板保留原头部网格和 UV 对应，不占用外挂发片', () => {
  const doc = C.makeDoc(H.apply(body, { style: 'long' })), boards = C.makeBoards(doc).boards;
  assert.equal(boards.map((b) => b.board).sort().join(), 'back,front,top');
  for (const b of boards.filter((b) => b.meshBoard)) {
    const source = doc.pieces.find((p) => p.mesh && p.mesh.pos === b.mesh.pos);
    assert.ok(source && !source.accessory);
    for (let i = 0; i < b.mesh.uv.length; i += 2) {
      near(b.mesh.uv[i] - b.box.x, source.mesh.uv[i] - source.box.x);
      near(b.mesh.uv[i + 1] - b.box.y, source.mesh.uv[i + 1] - source.box.y);
    }
  }
});
test('完整缝合要求所有面分区，漏面和损坏的分区数据不能静默导出', () => {
  const regions = pre.regions.slice(); regions[0] = 0;
  assert.match(M.unfold({ mesh, regions, names: pre.names }).errors[0].reason, /没有分片/);
  assert.equal(M.unfold({ mesh, regions: regions.slice(1), names: pre.names }).ok, false);
});
