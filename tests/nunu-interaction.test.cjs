/* 四层设计台的交互契约。
 * 这一份原本是上一轮（codex）按它自己设想的 UI 写的，随 UI 重做一起改成新契约；
 * 它想守住的那些行为——工具别乱跳、填色只管当前面、加发片/加衣服不受层限制、
 * 耳朵成对——全部保留下来，只是换成现在这套按钮和雷区检查。
 */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { mountApp } = require('./nunu-design-harness.cjs');

test('改形状可以连续用，不会画一笔就被踢回彩绘', () => {
  const f = mountApp();
  f.click('daction', 'overview');
  f.click('dlayer', 'hair');
  f.click('daction', 'newHair');
  f.drawShape([[100, 80], [300, 70], [320, 170], [90, 180]]);
  const tool = f.groups['[data-dtool]'].find(b => b.dataset.dtool === 'outline');
  assert.equal(tool.classList.on, true, '画完还在「改形状」');
  f.drawShape([[110, 90], [290, 85], [295, 165], [100, 170]]);
  assert.equal(tool.classList.on, true, '再画一次依旧停在「改形状」');
});

test('填底色不报错，而且只涂当前这一面', () => {
  const f = mountApp();
  f.click('daction', 'overview');
  const body = () => f.calls.change.objects.find(o => o.id === 'body');
  const before = { front: body().color, back: body().backColor };
  assert.doesNotThrow(() => f.click('daction', 'fill'));
  assert.notEqual(body().color, before.front, '正面底色变了');
  assert.equal(body().backColor, before.back, '背面底色没跟着动');
  f.click('dside', 'back');
  f.click('daction', 'fill');
  assert.notEqual(body().backColor, before.back, '切到背面后再涂，才改背面');
});

test('加发片 / 加衣服不受当前图层限制，能一层层往上叠', () => {
  const f = mountApp();
  f.click('daction', 'overview');
  f.click('daction', 'newHair');
  f.drawShape([[60, 80], [200, 70], [205, 170], [55, 175]]);
  assert.equal(f.calls.change.objects.filter(o => o.layer === 'hair').length, 1);
  f.click('daction', 'newHair');
  f.drawShape([[200, 80], [340, 75], [348, 180], [195, 178]]);
  assert.equal(f.calls.change.objects.filter(o => o.layer === 'hair').length, 2, '第二片叠上去了');
  // 从身体层直接点「加衣服」，不用先切层
  f.click('dlayer', 'body');
  f.click('daction', 'newClothes');
  f.drawShape([[150, 300], [255, 300], [250, 360], [155, 362]]);
  const clothes = f.calls.change.objects.filter(o => o.layer === 'clothes');
  assert.equal(clothes.length, 1, '身上ing也能直接加衣服');
  // 后续着色不会写歪到别的片
  clothes[0].front.push({ color: '#fff', width: 4, points: [] });
  assert.equal(f.calls.change.objects.find(o => o.id === 'body').front.length, 0);
});

test('一笔锁定起点：中途抬笔再画不会连成长线', () => {
  const f = mountApp();
  f.reg.get('#designMirror').checked = false;   // 关掉对称，专测每一笔的边界
  f.click('daction', 'overview');
  f.click('dtool', 'paint');
  const { cv, at } = f;
  cv.onpointerdown(at([200, 340]));
  cv.onpointermove(at([230, 350]));
  cv.onpointerup(at([230, 350]));
  cv.onpointermove(at([205, 345]));       // 抬笔后移动，不该续在这笔上
  cv.onpointermove(at([900, 900]));       // 跑出画布也不该拉线
  cv.onpointerdown(at([210, 350]));
  cv.onpointerup(at([210, 350]));
  const strokes = f.calls.change.objects.find(o => o.id === 'body').front;
  assert.equal(strokes.length, 2, '两笔就是两笔');
  assert.equal(strokes[0].points.length, 2);
  assert.equal(strokes[1].points.length, 1, '第二笔只有起点，没有把远处的点拉进来');
});

test('系统半路发 pointercancel 不再把整笔画好的部分抹掉，但仍可撤销', () => {
  const f = mountApp();
  f.reg.get('#designMirror').checked = false;
  f.click('daction', 'overview');
  f.click('dtool', 'paint');
  const { cv, at } = f;
  const body = () => f.calls.change.objects.find(o => o.id === 'body');
  const n = body().front.length;
  cv.onpointerdown(at([200, 340]));
  cv.onpointermove(at([230, 350]));
  cv.onpointermove(at([260, 360]));
  cv.onpointercancel(at([260, 360]));
  // 以前这里是「回到画之前」——快慢帧一打断就前功尽弃，正是「画笔老是断」的一部分。
  // 现在改保留：已经画出来的就是成果，不想要就撤销。
  assert.equal(body().front.length, n + 1, '取消也要留下已经画出的那一笔');
  assert.equal(body().front[n].points.length, 3, '两点都有落在笔迹里');
  f.designer.undo();
  assert.equal(body().front.length, n, '撤销能把这一笔收回去');
});

test('同一位置重复描两次，得到的轮廓完全一致（坐标不漂移）', () => {
  const f = mountApp();
  f.click('dlayer', 'face');
  f.click('daction', 'overview');
  f.click('dtool', 'outline');
  const shape = [[130, 110], [240, 90], [270, 220], [140, 240]];
  f.drawShape(shape);
  const first = JSON.parse(JSON.stringify(f.calls.change.objects.find(o => o.id === 'face').poly));
  f.drawShape(shape);
  const second = f.calls.change.objects.find(o => o.id === 'face').poly;
  assert.equal(second.length, first.length);
  second.forEach((p, i) => p.forEach((v, j) => assert.ok(Math.abs(v - first[i][j]) < 1e-7, '重复描画的坐标漂移')));
});

test('发片两面分开画，对称只在当前这一面生效', () => {
  const f = mountApp();
  f.click('daction', 'overview');
  f.click('daction', 'newHair');
  f.drawShape([[100, 80], [300, 80], [300, 160], [100, 160]]);
  f.click('dtool', 'paint');
  const hair = () => f.calls.change.objects.at(-1);
  f.drawShape([[130, 100], [150, 100]]);
  assert.equal(hair().front.length, 2, '正面镜像出两笔');
  assert.equal(hair().back.length, 0, '背面没被同步');
  f.click('dside', 'back');
  f.click('daction', 'newHair');
  f.drawShape([[100, 220], [300, 220], [300, 300], [100, 300]]);
  const back = hair();
  assert.ok(back.onBack, '在背面新长的发片属于背面（落在脑袋后面）');
  assert.equal(back.front.length, 0, '背面这片还没画笔迹，正面那片的笔迹没串过来');
});

test('耳朵成对出片，四条配缝长度两两相等', () => {
  const f = mountApp();
  f.click('daction', 'ears');
  const ears = f.calls.change.objects.filter(o => o.kind === 'ear');
  assert.equal(ears.length, 2);
  const t = f.c.NunuDesign.template(f.c.NunuPattern.cookie, f.calls.change);
  assert.equal(t.pieces.filter(p => p.design && String(p.design.objectId).startsWith('ear')).length, 4, '两只耳朵各出正反两片');
  const seams = t.seams.filter(s => /E/.test(s.label));
  assert.equal(seams.length, 4);
  for (const s of seams) assert.ok(Math.abs(s.a - s.b) < 1e-6, s.label + ' 两边不等长');
});

test('形状越出画布会整笔拒绝，并给出明确提示', () => {
  const f = mountApp();
  f.click('daction', 'overview');
  f.click('dtool', 'outline');
  const before = JSON.stringify(f.calls.change);
  f.drawShape([[170, 320], [900, 900], [230, 360], [170, 360]]);
  assert.equal(JSON.stringify(f.calls.change), before, '出了画布的形状没有落进去');
  assert.match(f.status(), /超出/, '给出了「超出」的提示');
});

test('看全局时改形状只动选中的那一片，不会波及旁边的部件', () => {
  const f = mountApp();
  f.click('daction', 'overview');
  f.click('dlayer', 'hair');
  f.click('daction', 'newHair');
  f.drawShape([[120, 90], [280, 85], [285, 160], [115, 165]]);
  window_before = JSON.parse(JSON.stringify(f.calls.change.objects.find(o => o.id === 'face')));
  f.click('daction', 'overview');
  f.drawShape([[125, 95], [275, 90], [280, 155], [120, 160]]);
  assert.equal(f.calls.change.objects.filter(o => o.layer === 'hair').length, 1, '没有多冒出一片');
  assert.equal(JSON.stringify(f.calls.change.objects.find(o => o.id === 'face')), JSON.stringify(window_before), '脸片完全没被碰到');
});
