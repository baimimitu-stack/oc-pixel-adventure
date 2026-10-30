/* 四层设计台的无头测试脚手架：用假 DOM 跑真实的 mount()，模拟点按钮和拖鼠标。
 * nunu-design.test.cjs 和 nunu-interaction.test.cjs 共用。 */
const fs = require('fs'), vm = require('node:vm'), path = require('path');

function load(extra = {}) {
  const ctx = { console, ...extra };
  vm.createContext(ctx);
  for (const f of ['nunu-shape.js', 'pattern-data.js', 'nunu-core.js', 'nunu-25d.js', 'nunu-design.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/games/nunu-studio', f), 'utf8'), ctx);
  return ctx;
}

const LAYERS = ['body', 'clothes', 'face', 'hair'];
const ACTIONS = ['undo', 'redo', 'layout', 'overview', 'addPart', 'newHair', 'newClothes', 'ears', 'paper', 'project', 'newProject', 'clear', 'up', 'down', 'grow', 'shrink', 'fill', 'remove', 'imgPick', 'imgLock', 'imgClear', 'snapRoot', 'shapeOk', 'shapeCancel', 'lock', 'draftOk', 'draftUndo', 'draftClear', 'hairPng'];

function mountApp(overrides = {}) {
  const context = new Proxy({}, { get: (t, k) => t[k] || (() => {}), set: (t, k, v) => (t[k] = v, true) });
  const el = (extra = {}) => {
    const node = {
      hidden: false, disabled: false, value: '', checked: true, textContent: '', className: '',
      innerHTML: '', dataset: {}, style: {}, children: [],
      classList: { toggle(k, v) { node.classList[k] = v; }, add() {}, remove() {} },
      replaceChildren() { node.children = []; },
      append(...n) { node.children.push(...n); },
      after() {}, querySelector: () => el(), querySelectorAll: () => [],
      getContext: () => context, setPointerCapture() {}, releasePointerCapture() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 500 }),
      addEventListener() {},
    };
    return Object.assign(node, extra);
  };
  const groups = {
    '[data-dlayer]': LAYERS.map(k => ({ ...el(), dataset: { dlayer: k }, querySelector: () => el(), querySelectorAll: () => [] })),
    '[data-dtool]': ['paint', 'outline', 'image', 'hand'].map(v => ({ ...el(), dataset: { dtool: v } })),
    '[data-dbrush]': ['round', 'square'].map(v => ({ ...el(), dataset: { dbrush: v } })),
    '[data-dside]': ['front', 'back'].map(v => ({ ...el(), dataset: { dside: v } })),
    '[data-dview]': ['front', 'side', 'back', 'all'].map(v => ({ ...el(), dataset: { dview: v } })),
    '[data-daction]': ACTIONS.map(v => ({ ...el(), dataset: { daction: v } })),
    '[data-color]': [],
    '[data-dattach]': ['sewn', 'glued'].map(v => ({ ...el(), dataset: { dattach: v } })),
  };
  const reg = new Map([
    ['#designCanvas', el()], ['#designPreview', el()], ['#designObjects', el()],
    ['#designStatus', el()], ['#designHint', el()], ['#designColor', el({ value: '#7d5340' })],
    ['#designWidth', el({ value: '6' })], ['#designWidthOut', el()],
    ['#designMirror', el({ checked: true })], ['#designAxis', el({ value: '200' })],
    ['#design3d', el()], ['#designProjects', el()], ['#layoutBtn', el()], ['#designPalette', el()],
    ['#designImagePick', el({ click() {} })], ['#designImageSize', el({ value: '100' })],
    ['#designImageRot', el({ value: '0' })], ['#designImageWindow', el({ checked: true })],
    ['#designImageAdjust', el()],
    ['#designHairRow', el()], ['#designHairNote', el()],
    ['#designConfirm', el({ hidden: true })], ['#designConfirmTxt', el()],
    ['#designDraft', el({ hidden: true })], ['#designDraftTxt', el()],
    ['#designHairPick', el({ click() {} })],
    ['[data-dattach]', ['sewn', 'glued'].map(v => ({ ...el(), dataset: { dattach: v } }))],
  ]);
  const host = {
    ...el(),
    querySelector(sel) {
      if (reg.has(sel)) return reg.get(sel);
      const m = /^\[data-(\w+)="(.+)"\]$/.exec(sel);
      if (m) return groups[`[data-${m[1]}]`].find(b => b.dataset[m[1]] === m[2]) || el();
      if (groups[sel]) return groups[sel][0];
      return el();
    },
    querySelectorAll(sel) { return groups[sel] || []; },
  };
  const c = load({ document: { querySelector: () => el(), createElement: () => el() }, ...overrides });
  const calls = { change: null, flush: 0, paper: 0, views: [], live: 0 };
  let archived = null, ok3d = true;
  const designer = c.NunuDesign.mount(host, {
    get: () => null,
    change: (v) => { calls.change = v; },
    flush: () => { calls.flush++; },
    paper: () => { calls.paper++; },
    preview3d: () => ok3d,
    view: (n) => calls.views.push(n),
    projects: () => (archived ? [{ id: 'old', name: '旧作品' }] : []),
    newProject: (v) => { archived = v; return c.NunuDesign.initial(c.NunuPattern.cookie); },
    openProject: () => archived,
    live: () => { calls.live++; },
  });
  const click = (kind, v) => groups[`[data-${kind}]`].find(b => b.dataset[kind] === v).onclick();
  // 「看全部」之后视图是确定的：整块 400×500 留 6 白边
  const grid = () => { const s = Math.min((400 - 12) / 400, (500 - 12) / 500); return { s, x: (400 - 400 * s) / 2, y: (500 - 500 * s) / 2 }; };
  const at = ([wx, wy]) => { const g = grid(); return { button: 0, pointerId: 1, clientX: wx * g.s + g.x, clientY: wy * g.s + g.y, preventDefault() {}, stopPropagation() {}, getCoalescedEvents: () => [] }; };
  const cv = reg.get('#designCanvas');
  const drawShape = (pts) => { cv.onpointerdown(at(pts[0])); for (const p of pts.slice(1)) cv.onpointermove(at(p)); cv.onpointerup(); };
  // 一次「按下 -> 拖 -> 松手」的连续拖拽（拖手柄用），中间点会多点几步，模拟真鼠标
  const dragFrom = (from, to, steps = 6) => {
    cv.onpointerdown(at(from));
    for (let i = 1; i <= steps; i++)
      cv.onpointermove(at([from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps]));
    cv.onpointerup();
  };
  const status = () => reg.get('#designStatus').textContent;
  return { c, host, groups, reg, calls, click, at, grid, drawShape, drawStroke: drawShape, dragFrom, cv, designer, status, set3d: (v) => (ok3d = v), archive: () => archived };
}

module.exports = { load, mountApp, LAYERS, ACTIONS };
