const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../public/games/nunu-studio/app.js'), 'utf8');
test('退出分片恢复绘画模式、模型可见性和原视角，保留分区修改', () => {
  let cleared = 0, saved = 0, scheduled = 0;
  const ctx = { ui: { mode: 'regions' }, rg: { stroke: [[0, 1]], hist: [] }, model: { view: { zoom: 0.85 }, clearRegionView() { cleared++; } }, openRegions: { view: { zoom: 1.4, rotY: 0.6 } }, saveRegions() { saved++; }, setCaption() {}, dirty: {}, schedule() { scheduled++; } };
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('function closeRegions()'), source.indexOf('function setCaption()')), ctx);
  ctx.closeRegions();
  assert.equal(ctx.ui.mode, 'doll'); assert.equal(cleared, 1); assert.equal(saved, 1);
  assert.equal(ctx.model.view.zoom, 1.4); assert.equal(ctx.model.view.rotY, 0.6);
  assert.equal(ctx.rg.hist.length, 1); assert.equal(ctx.dirty.scene, true);
  ctx.closeRegions(); assert.equal(cleared, 1); assert.equal(scheduled, 1);
});
test('画笔、切换模板、离开分片页签都有退出分片的入口', () => {
  assert.match(source, /modePaint'\)\.onclick = \(\) => \{ closeRegions\(\)/);
  assert.match(source, /function switchTemplate\(id\) \{\s*endStroke\(\);\s*closeRegions\(\)/);
  assert.match(source, /b\.dataset\.tab !== 'mesh'\) closeRegions\(\)/);
  assert.match(source, /closeRegions\(\);\s*ui\.layer = b\.dataset\.layer/);
  assert.ok(!source.includes("delete state.tplData['mesh-body']"));
});
