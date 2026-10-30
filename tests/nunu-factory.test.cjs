/* 娃厂评分规矩：每天 5 个、一家一天一次、不能自评、低权重不能「一高一低」、权重高放宽、极端分涌入不计分 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const ctx0 = { console }; vm.createContext(ctx0);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/games/nunu-studio/nunu-factory.js'), 'utf8'), ctx0);
const F = ctx0.NunuFactory;

const DAY = 864e5, NOW = new Date(2026, 9, 30, 12, 0, 0).getTime();
const day = F.dayKey(NOW);
const newbie = { id: 'u-new', created: NOW - 1 * DAY, works: 0, rated: 0 };
const veteran = { id: 'u-old', created: NOW - 40 * DAY, works: 6, rated: 40 };
const fac = (id, extra = {}) => ({ id, name: id, base: 8, votes: 50, ...extra });
const rec = (by, f, s, w = 0.3, lvl = 'low') => ({ by, f, s, w, day, lvl });

test('账号权重：新账号低，用得久 + 做得多 + 评得多的是高', () => {
  assert.equal(F.weightOf(newbie, NOW).level, 'low');
  assert.equal(F.weightOf(veteran, NOW).level, 'high');
  assert.equal(F.weightOf({ id: 'm', created: NOW - 10 * DAY, works: 2, rated: 5 }, NOW).level, 'mid');
  assert.ok(F.weightOf(veteran, NOW).weight > F.weightOf(newbie, NOW).weight);
});

test('每天最多评 5 家，第 6 家被拒；换一天重新算', () => {
  const records = [1, 2, 3, 4, 5].map((i) => rec(veteran.id, 'f' + i, 6, 1, 'high'));
  const r = F.judgeVote({ account: veteran, now: NOW, factory: fac('f6'), score: 6, records });
  assert.equal(r.ok, false);
  assert.match(r.reason, /5 次/);
  const tomorrow = F.judgeVote({ account: veteran, now: NOW + DAY, factory: fac('f6'), score: 6, records });
  assert.equal(tomorrow.ok, true);
});

test('同一家一天只能评一次；不能给自己上传的娃厂打分', () => {
  const records = [rec(veteran.id, 'f1', 8, 1, 'high')];
  assert.equal(F.judgeVote({ account: veteran, now: NOW, factory: fac('f1'), score: 6, records }).ok, false);
  const own = F.judgeVote({ account: veteran, now: NOW, factory: fac('mine', { owner: veteran.id }), score: 10, records: [] });
  assert.equal(own.ok, false);
  assert.match(own.reason, /自己/);
});

test('低权重账号：一天里一家打很高、另一家打很低 → 后一个被拒（两个顺序都一样）', () => {
  const afterHigh = F.judgeVote({ account: newbie, now: NOW, factory: fac('b'), score: 2, records: [rec(newbie.id, 'a', 10)] });
  assert.equal(afterHigh.ok, false);
  assert.match(afterHigh.reason, /一家打很高、另一家打很低/);
  const afterLow = F.judgeVote({ account: newbie, now: NOW, factory: fac('b'), score: 10, records: [rec(newbie.id, 'a', 2)] });
  assert.equal(afterLow.ok, false);
  // 一高一中、一低一中都没事
  assert.equal(F.judgeVote({ account: newbie, now: NOW, factory: fac('b'), score: 6, records: [rec(newbie.id, 'a', 10)] }).ok, true);
  assert.equal(F.judgeVote({ account: newbie, now: NOW, factory: fac('b'), score: 10, records: [rec(newbie.id, 'a', 8)] }).ok, true);
});

test('权重高的账号放宽：同一天一高一低可以', () => {
  const r = F.judgeVote({ account: veteran, now: NOW, factory: fac('b'), score: 2, records: [rec(veteran.id, 'a', 10, 1, 'high')] });
  assert.equal(r.ok, true);
  assert.equal(r.weight, 1);
});

test('低权重账号不能把大家公认的好厂打极低分、把公认的差厂打极高分；高权重可以', () => {
  const good = fac('good', { base: 9, votes: 120 }), bad = fac('bad', { base: 3.5, votes: 80 });
  const low1 = F.judgeVote({ account: newbie, now: NOW, factory: good, score: 2, records: [], avg: 9 });
  assert.equal(low1.ok, false);
  assert.match(low1.reason, /极低分/);
  const low2 = F.judgeVote({ account: newbie, now: NOW, factory: bad, score: 10, records: [], avg: 3.5 });
  assert.equal(low2.ok, false);
  assert.equal(F.judgeVote({ account: veteran, now: NOW, factory: good, score: 2, records: [], avg: 9 }).ok, true);
  // 评价人数太少（没形成共识）时不拦
  assert.equal(F.judgeVote({ account: newbie, now: NOW, factory: fac('few', { base: 9, votes: 3 }), score: 2, records: [], avg: 9 }).ok, true);
});

test('一家一天涌进来很多非高权重的极端分：超出上限的这一票权重降到 0', () => {
  const records = [1, 2, 3, 4, 5, 6].map((i) => rec('x' + i, 'target', 10, 0.3, 'low'));   // 已经累计 1.8 > 1.5
  const r = F.judgeVote({ account: { id: 'x7', created: NOW - DAY, works: 0, rated: 0 }, now: NOW, factory: fac('target', { base: 6, votes: 2 }), score: 10, records, avg: 6 });
  assert.equal(r.ok, true);
  assert.equal(r.weight, 0);
  assert.match(r.note, /不计分/);
  // 高权重账号的极端分不受这条限制
  assert.equal(F.judgeVote({ account: veteran, now: NOW, factory: fac('target', { base: 6, votes: 2 }), score: 10, records, avg: 6 }).weight, 1);
});

test('算分按权重加权：同样是 10 分，新账号的一票比老账号轻', () => {
  const f = fac('f', { base: 5, votes: 10 });
  const light = F.scoreOf(f, [{ f: 'f', s: 10, w: 0.3 }]).score, heavy = F.scoreOf(f, [{ f: 'f', s: 10, w: 1 }]).score;
  assert.ok(heavy > light && light > 5);
  assert.equal(F.scoreOf(fac('empty', { base: 0, votes: 0 }), []).score, null, '没人评过就没有分');
});

test('上传娃厂：名字 2–16 字、不重名、不放网址 / 联系方式；新账号一天只能传 1 家', () => {
  const ctx = { account: newbie, now: NOW, factories: [fac('云朵朵工坊')] };
  assert.equal(F.validateUpload({ name: '丁' }, ctx).ok, false);
  assert.equal(F.validateUpload({ name: '云朵朵工坊' }, ctx).ok, false);
  assert.equal(F.validateUpload({ name: '小熊工坊', note: '加我微信 abc' }, ctx).ok, false);
  const ok = F.validateUpload({ name: '小熊工坊', tags: '做工细，发货快、回复甜、多余的', note: '  慢工出细活  ' }, ctx);
  assert.equal(ok.ok, true);
  assert.equal(ok.clean.tags.length, 3);
  assert.equal(ok.clean.note, '慢工出细活');
  const again = F.validateUpload({ name: '小熊工坊二号' }, { ...ctx, factories: [{ ...fac('小熊工坊'), owner: newbie.id, ts: NOW }] });
  assert.equal(again.ok, false);
  assert.match(again.reason, /一天只能上传 1 家/);
  assert.equal(F.validateUpload({ name: '小熊工坊二号' }, { account: veteran, now: NOW, factories: [{ ...fac('小熊工坊'), owner: veteran.id, ts: NOW }] }).ok, true);
});

test('评论：2–100 字、不放联系方式、一家一天一条、不评自己的、低权重一天 3 条', () => {
  const f = fac('f1'), ok = (text, comments = [], account = veteran, factory = f) => F.validateComment(text, { account, now: NOW, factory, comments });
  assert.equal(ok('做工很细，发货也快').ok, true);
  assert.equal(ok('好').ok, false);
  assert.equal(ok('加我微信聊').ok, false);
  assert.equal(ok('看这里 www.x.com').ok, false);
  assert.equal(ok('很好', [{ by: veteran.id, f: 'f1', day }]).ok, false);
  assert.equal(ok('很好很好', [], veteran, fac('mine', { owner: veteran.id })).ok, false);
  const three = [1, 2, 3].map((i) => ({ by: newbie.id, f: 'x' + i, day }));
  assert.equal(ok('这家不错呀', three, newbie).ok, false);
  assert.equal(ok('这家不错呀', three, veteran).ok, true);
});

test('帖子：板块 / 标题 / 正文长度、不放联系方式、低权重一天 2 帖；点赞不能赞自己、一帖一次、低权重一天 5 个；3 人举报折叠', () => {
  const good = { board: 'avoid', title: '这家工期拖了两个月', body: '下单以后一直说在做，两个月才发货，而且回复很慢。' };
  const post = (input, posts = [], account = veteran) => F.validatePost(input, { account, now: NOW, posts });
  assert.equal(post(good).ok, true);
  assert.equal(post({ ...good, board: 'x' }).ok, false);
  assert.equal(post({ ...good, title: '短' }).ok, false);
  assert.equal(post({ ...good, body: '太短' }).ok, false);
  assert.equal(post({ ...good, body: '加我微信 abc 私聊给你看图片和价格' }).ok, false);
  const two = [1, 2].map(() => ({ by: newbie.id, day }));
  assert.equal(post(good, two, newbie).ok, false);
  assert.equal(post(good, two, veteran).ok, true);
  const like = (p, account = veteran, likeDays = {}) => F.validateLike(p, { account, now: NOW, likeDays });
  assert.equal(like({ by: veteran.id, likes: [] }).ok, false);
  assert.equal(like({ by: 'o', likes: [veteran.id] }).ok, false);
  assert.equal(like({ by: 'o', likes: [] }).ok, true);
  assert.equal(like({ by: 'o', likes: [] }, newbie, { [day]: 5 }).ok, false);
  assert.equal(like({ by: 'o', likes: [] }, veteran, { [day]: 5 }).ok, true);
  assert.equal(F.isFolded({ flags: ['a', 'b'] }), false);
  assert.equal(F.isFolded({ flags: ['a', 'b', 'c'] }), true);
});

test('论坛新板块：体型图要附图、经验 / 宣传区不能带买卖信息（入驻的可以）、娃厂业务只有入驻的能发且要分类、敏感话题拒绝', () => {
  const base = { board: 'tips', title: '我的 20cm 娃体型心得', body: '体型和头身比这样调看起来更可爱，棉花别塞太满，脖子处留一点松量。' };
  const post = (input, joined = false, account = veteran) => F.validatePost({ ...base, ...input }, { account, now: NOW, posts: [], joined });
  assert.equal(post({}).ok, true, '经验帖');
  assert.equal(post({ board: 'shape' }).ok, false, '体型图没附图');
  assert.equal(post({ board: 'shape', img: 'data:image/jpeg;base64,AAAA' }).ok, true);
  assert.equal(post({ board: 'shape', img: 'data:image/jpeg;base64,' + 'A'.repeat(270000) }).ok, false, '图太大');
  assert.equal(post({ board: 'promo', body: '这是我自己做的娃，棉花很软，欢迎来看，下单价 80 元包邮。' }).ok, false, '没入驻不能带买卖信息');
  assert.equal(post({ board: 'promo', body: '这是我自己做的娃，棉花很软，脸片五官是自己画的，欢迎来看。' }).ok, true, '纯展示可以');
  assert.equal(post({ board: 'promo', body: '这是我自己做的娃，下单价 80 元包邮。' }, true).ok, true, '入驻的可以');
  assert.equal(post({ board: 'biz', cat: 'order' }).ok, false, '没入驻不能发业务');
  assert.equal(post({ board: 'biz', cat: 'order' }, true).ok, true);
  assert.equal(post({ board: 'biz' }, true).ok, false, '业务要分类');
  assert.equal(post({ board: 'biz', cat: 'xx' }, true).ok, false);
  const bad = post({ body: '这里聊聊赌博和色情怎么赚钱，大家一起来看看吧朋友们。' });
  assert.equal(bad.ok, false); assert.match(bad.reason, /敏感/);
  assert.equal(F.validateComment('一起去赌博吧', { account: veteran, now: NOW, factory: fac('f1'), comments: [] }).ok, false);
});

test('娃厂不能给自己的厂发 Repo / 避雷（刷分）；可以在业务区宣传', () => {
  const input = { board: 'repo', f: 'mine', title: '我家的娃做得特别好', body: '线头少、充棉均匀，欢迎大家来买，保证好评。' };
  const ctx = { account: veteran, now: NOW, posts: [], joined: true, ownFactories: ['mine'] };
  assert.equal(F.validatePost(input, ctx).ok, false);
  assert.equal(F.validatePost({ ...input, board: 'avoid' }, ctx).ok, false);
  assert.equal(F.validatePost({ ...input, board: 'biz', cat: 'new' }, ctx).ok, true);
  assert.equal(F.validatePost({ ...input, f: 'other' }, ctx).ok, true);
});

test('手作娘接单区：必须选第三方平台 + 写店铺名；不能提私下转账 / 加好友；不用入驻；可以带价格', () => {
  const base = { board: 'maker', title: '接 20cm 棉花娃娃单子', body: '手作接单，20cm 努努 80 元起，可选发片布料，工期两周。', platform: '闲鱼', shop: '某某手作坊' };
  const post = (input) => F.validatePost({ ...base, ...input }, { account: veteran, now: NOW, posts: [], joined: false });
  assert.equal(post({}).ok, true, '不用入驻也能发，价格也行');
  assert.equal(post({ platform: '' }).ok, false);
  assert.equal(post({ platform: '微信' }).ok, false, '微信不算有保障的第三方平台');
  assert.equal(post({ shop: '' }).ok, false);
  assert.equal(post({ body: '手作接单，20cm 努努 80 元起，可以私下转账给我，不走平台更便宜。' }).ok, false);
  assert.equal(post({ body: '手作接单，20cm 努努 80 元起，付款后扫码确认工期两周内发货。' }).ok, false);
  assert.equal(post({ body: '手作接单，20cm 努努 80 元起，加我微信聊款式和工期两周。' }).ok, false);
});
