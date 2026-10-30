/* 娃厂评分规矩（纯逻辑，不碰页面、不碰存档）
 * 现在数据都在本浏览器里，所以这些规矩只能防「正常使用里的误操作和顺手刷分」；
 * 清掉浏览器数据就能绕过。真要防刷，同一份逻辑要搬到服务器上跑（账号权重、当天记录都以服务器为准）。
 *
 * 规矩：
 *   1. 每天最多评 5 家，同一家一天只能评一次；
 *   2. 不能给自己上传的娃厂打分；
 *   3. 账号权重：用得越久、做的娃娃越多、评得越多，权重越高（低 / 中 / 高）；
 *   4. 权重低的账号：同一天里不能「一家打很高、另一家打很低」（典型的刷高分 + 抹黑对手）；
 *      也不能把大家公认的好厂打成极低分、把公认的差厂打成极高分；权重高的账号放宽；
 *   5. 同一家一天之内涌进来很多非高权重账号的极端分：超出的部分这一票不计分（先收下，记录里权重为 0）；
 *   6. 算分按权重加权：新账号的一票轻，老账号的一票重。 */
(function (root) {
  'use strict';

  const DAILY_LIMIT = 5;
  const HIGH_SCORE = 9, LOW_SCORE = 3;                 // 10 分制：≥9 算「很高」，≤3 算「很低」
  const LEVEL_WEIGHT = { low: 0.3, mid: 0.7, high: 1 };
  const LEVEL_NAME = { low: '低（新账号）', mid: '中', high: '高' };
  const SPIKE_CAP = 1.5;                               // 一家一天里，非高权重账号的极端分，最多让总权重涨这么多
  const DAY = 864e5;
  const ADMIN_WEIGHT = 3;

  /** 日期键：按本地时间的自然日算 */
  const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  /** 账号权重：用了几天 / 做了几只娃娃 / 评过几次 */
  function weightOf(account, now = Date.now()) {
    if (account.admin) return { score: 1, level: 'high', weight: ADMIN_WEIGHT, name: '管理员' };   // 站长：按「高」放宽规矩，一票算 3 票
    const ageDays = Math.max(0, (now - (account.created || now)) / DAY);
    const s = 0.4 * Math.min(1, ageDays / 14) + 0.3 * Math.min(1, (account.works || 0) / 3) + 0.3 * Math.min(1, (account.rated || 0) / 20);
    const level = s >= 0.7 ? 'high' : s >= 0.35 ? 'mid' : 'low';
    return { score: s, level, weight: LEVEL_WEIGHT[level], name: LEVEL_NAME[level] };
  }

  /** 一家娃厂现在的分：示例底分 + 大家的加权票。records: [{ f, s, w }] */
  function scoreOf(factory, records) {
    const mine = records.filter((r) => r.f === factory.id);
    const baseVotes = factory.votes || 0, baseSum = (factory.base || 0) * baseVotes;
    const wSum = mine.reduce((n, r) => n + r.w, 0), sSum = mine.reduce((n, r) => n + r.s * r.w, 0);
    const total = baseVotes + wSum;
    return { score: total > 0 ? (baseSum + sSum) / total : null, votes: baseVotes + mine.length, rated: mine.length };
  }

  /** 这一票收不收。
   *  ctx: { account, now, factory, score(2/4/6/8/10), records(全部评价记录), avg(这家现在的均分，可空) }
   *  返回 { ok, weight, reason?, note? }：不收就带 reason（给人看的话），收了带实际记进去的权重。 */
  function judgeVote(ctx) {
    const { account, factory, score, records } = ctx, now = ctx.now || Date.now();
    const today = dayKey(now);
    const mineToday = records.filter((r) => r.by === account.id && r.day === today);
    const w = weightOf(account, now);
    if ((factory.owner && factory.owner === account.id) || (factory.claimedBy && factory.claimedBy === account.name)) return { ok: false, reason: '不能给自己上传 / 认领的娃厂打分。' };
    if (!Number.isFinite(score) || score < 1 || score > 10) return { ok: false, reason: '分数不对。' };
    if (mineToday.some((r) => r.f === factory.id)) return { ok: false, reason: '这家今天已经评过了，明天再来改。' };
    if (mineToday.length >= DAILY_LIMIT) return { ok: false, reason: `今天的 ${DAILY_LIMIT} 次评价用完了，明天再来。` };
    if (w.level === 'low') {
      const hasHigh = mineToday.some((r) => r.s >= HIGH_SCORE), hasLow = mineToday.some((r) => r.s <= LOW_SCORE);
      if ((score >= HIGH_SCORE && hasLow) || (score <= LOW_SCORE && hasHigh))
        return { ok: false, reason: '同一天里一家打很高、另一家打很低，权重还低的账号不能这样评（像是在刷高分 + 抹黑别家）。想打的话，先多用几天、多做几只娃娃、多评几家，权重高了就放开。' };
      if (Number.isFinite(ctx.avg) && (factory.votes || 0) + records.filter((r) => r.f === factory.id).length >= 10) {
        if (score <= LOW_SCORE && ctx.avg >= 7.5) return { ok: false, reason: '这家大家评得很高（均分 ' + ctx.avg.toFixed(1) + '），权重还低的账号不能直接打极低分。权重高了就放开。' };
        if (score >= HIGH_SCORE && ctx.avg <= 5) return { ok: false, reason: '这家大家评得很低（均分 ' + ctx.avg.toFixed(1) + '），权重还低的账号不能直接打极高分。权重高了就放开。' };
      }
    }
    // 一家一天之内涌进来的非高权重极端分：超出上限的部分这一票不计分
    let weight = w.weight, note = '';
    const extreme = score >= HIGH_SCORE || score <= LOW_SCORE;
    if (extreme && w.level !== 'high') {
      const used = records.filter((r) => r.f === factory.id && r.day === today && r.lvl !== 'high' && (r.s >= HIGH_SCORE || r.s <= LOW_SCORE)).reduce((n, r) => n + r.w, 0);
      const left = Math.max(0, SPIKE_CAP - used);
      if (left < weight) { weight = left; note = left <= 0 ? '收下了，但这家今天已经涌进来很多极端分，这一票先不计分。' : '收下了，这家今天极端分太多，这一票只算一部分。'; }
    }
    return { ok: true, weight, level: w.level, note };
  }

  /** 上传娃厂的检查：名字 2–16 字、不重名；标签最多 3 个、每个最多 6 字；简介最多 80 字；低权重账号一天只能传 1 家 */
  function validateUpload(input, ctx) {
    const name = String(input.name || '').trim();
    if (name.length < 2 || name.length > 16) return { ok: false, reason: '娃厂名字要 2 到 16 个字。' };
    if (/https?:|www\.|\.com|\.cn|微信|vx|v信|\+q|扣扣/i.test(name + ' ' + (input.note || ''))) return { ok: false, reason: '名字和简介里不要放网址 / 联系方式，评价区不做引流。' };
    if ((ctx.factories || []).some((f) => f.name === name)) return { ok: false, reason: '已经有同名的娃厂了。' };
    const tags = String(input.tags || '').split(/[,，、\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 3).map((t) => t.slice(0, 6));
    const note = String(input.note || '').trim().slice(0, 80);
    const w = weightOf(ctx.account, ctx.now || Date.now()), today = dayKey(ctx.now || Date.now());
    const mineToday = (ctx.factories || []).filter((f) => f.owner === ctx.account.id && dayKey(f.ts) === today).length;
    if (w.level === 'low' && mineToday >= 1) return { ok: false, reason: '新账号一天只能上传 1 家娃厂。权重高了再放开。' };
    if (mineToday >= 3) return { ok: false, reason: '一天最多上传 3 家娃厂。' };
    return { ok: true, clean: { name, tags, note } };
  }

  /* ---------- 评论 / 论坛帖子 / 点赞 的规矩 ----------
   * 评论：2–100 字；一天最多 5 条（低权重 3 条）；同一家一天一条；不能评自己上传的娃厂；不放网址 / 联系方式。
   * 帖子（避雷 / Repo）：标题 4–30 字、正文 10–500 字；一天最多 5 帖（低权重 2 帖）；不放网址 / 联系方式。
   * 点赞：不能赞自己的、同一帖只能赞一次；一天最多 10 个（低权重 5 个）。
   * 举报：同一帖 3 个人举报就先折叠。 */
  const CONTACT_RE = /https?:|www\.|\.com|\.cn|微信|vx|v信|\+q|扣扣|qq\s*\d|加我|私聊|私信/i;
  const hasContact = (t) => CONTACT_RE.test(String(t || ''));
  const FOLD_AT = 3;
  const lim = (acc, now, low, other) => (weightOf(acc, now).level === 'low' ? low : other);

  function validateComment(text, ctx) {
    const t = String(text || '').trim(), now = ctx.now || Date.now(), today = dayKey(now);
    if (t.length < 2 || t.length > 100) return { ok: false, reason: '评论要 2 到 100 个字。' };
    if (hasContact(t)) return { ok: false, reason: '评论里不要放网址 / 联系方式 / 引流的话。' };
    if (hasSensitive(t)) return { ok: false, reason: '涉及敏感话题的内容不能发布。' };
    if ((ctx.factory.owner && ctx.factory.owner === ctx.account.id) || (ctx.factory.claimedBy && ctx.factory.claimedBy === ctx.account.name)) return { ok: false, reason: '不能评论自己上传 / 认领的娃厂。' };
    const mine = (ctx.comments || []).filter((c) => c.by === ctx.account.id && c.day === today);
    if (mine.some((c) => c.f === ctx.factory.id)) return { ok: false, reason: '这家今天已经评论过了，明天再来。' };
    const cap = lim(ctx.account, now, 3, 5);
    if (mine.length >= cap) return { ok: false, reason: `今天的 ${cap} 条评论用完了，明天再来。` };
    return { ok: true, clean: t };
  }
  /* 论坛板块：避雷 / Repo / 体型图 / 经验 / 棉花娃娃宣传区 / 娃厂业务（只有已入驻的娃厂能发，要选分类） */
  const BOARDS = ['avoid', 'repo', 'shape', 'tips', 'promo', 'maker', 'biz'];
  /* 手作娘接单区：个人手作娘不用认证，但必须走闲鱼 / 淘宝这类有交易保障的第三方平台下单，不得私下转账 */
  const PLATFORMS = ['闲鱼', '淘宝', '天猫', '拼多多', '京东'];
  const PRIVATE_PAY_RE = /私下|转账|扫码|微信支付|支付宝转|定金转|转我|加我|私聊|私信我|线下交易|不走平台|绕过平台/;
  const BIZ_CATS = ['order', 'event', 'new', 'recruit', 'other'];
  const SENSITIVE_RE = /政治|游行|反动|颠覆|邪教|恐怖|炸弹|枪支|毒品|吸毒|赌博|博彩|赌球|色情|裸聊|约炮|招嫖|成人视频|自杀|自残|杀人|代孕|诈骗|洗钱|黄赌毒/;
  const COMMERCIAL_RE = /接单|开单|下单|代工|报价|定制价|团购|开团|出售|售价|批发|代购|\d+\s*(元|块|rmb)|￥\s*\d+|低价|包邮|预售/i;
  const hasSensitive = (t) => SENSITIVE_RE.test(String(t || ''));
  const hasCommercial = (t) => COMMERCIAL_RE.test(String(t || ''));
  const IMG_MAX = 260000;
  function validatePost(input, ctx) {
    const title = String(input.title || '').trim(), body = String(input.body || '').trim(), now = ctx.now || Date.now(), today = dayKey(now);
    const board = input.board;
    if (!BOARDS.includes(board)) return { ok: false, reason: '选一个板块。' };
    if (title.length < 4 || title.length > 30) return { ok: false, reason: '标题要 4 到 30 个字。' };
    if (body.length < 10 || body.length > 500) return { ok: false, reason: '正文要 10 到 500 个字。' };
    if (hasContact(title + ' ' + body)) return { ok: false, reason: '帖子里不要放网址 / 联系方式 / 引流的话。想让人联系你：娃厂请入驻，有官方客服入口。' };
    if (hasSensitive(title + ' ' + body)) return { ok: false, reason: '涉及敏感话题的内容不能发布。' };
    // 娃厂不能给自己刷好评：自己的娃厂不能发 Repo / 避雷
    if (input.f && (ctx.ownFactories || []).includes(input.f) && ['repo', 'avoid'].includes(board)) return { ok: false, reason: '不能给自己上传 / 入驻的娃厂发 Repo 或避雷（算自己刷分）。想宣传自己，用娃厂业务区。' };
    if (board === 'maker') {
      if (!PLATFORMS.includes(input.platform)) return { ok: false, reason: '手作娘接单必须走第三方平台下单：选闲鱼 / 淘宝 / 天猫 / 拼多多 / 京东。' };
      const shop = String(input.shop || '').trim();
      if (shop.length < 2 || shop.length > 30) return { ok: false, reason: '写上你在平台上的店铺名或商品标题（2–30 字），方便别人搜到你。' };
      if (PRIVATE_PAY_RE.test(title + ' ' + body + ' ' + shop)) return { ok: false, reason: '不能提私下转账 / 扫码 / 不走平台 / 加好友私聊。接单只能在第三方平台内下单，平台保障交易。' };
    }
    // 娃厂做生意 / 打广告需要入驻
    if (board === 'biz' && !ctx.joined) return { ok: false, reason: '娃厂业务区只有已入驻的娃厂能发。入驻方法见说明书。' };
    if (board === 'biz' && !BIZ_CATS.includes(input.cat)) return { ok: false, reason: '娃厂业务要选一个分类（接单 / 活动 / 新品 / 招人 / 其他）。' };
    if (['promo', 'shape', 'tips'].includes(board) && !ctx.joined && hasCommercial(title + ' ' + body))
      return { ok: false, reason: '这里可以展示你自己的娃、分享体型和经验，但不能带价格 / 接单 / 开团等买卖信息。娃厂做生意请入驻；个人手作娘接单请去「手作娘接单」区（走闲鱼等第三方平台）。' };
    if (board === 'shape' && !input.img) return { ok: false, reason: '体型图板块要附一张图。' };
    if (input.img && (!/^data:image\//.test(input.img) || input.img.length > IMG_MAX)) return { ok: false, reason: '图片不对或太大（压缩后要小于 250KB）。' };
    const mine = (ctx.posts || []).filter((p) => p.by === ctx.account.id && p.day === today);
    const cap = lim(ctx.account, now, 2, 5);
    if (mine.length >= cap) return { ok: false, reason: `今天最多发 ${cap} 个帖子，明天再来。` };
    return { ok: true, clean: { board, title, body, f: input.f || '', cat: board === 'biz' ? input.cat : '', img: input.img || '', platform: board === 'maker' ? input.platform : '', shop: board === 'maker' ? String(input.shop || '').trim() : '' } };
  }
  function validateLike(post, ctx) {
    const now = ctx.now || Date.now(), today = dayKey(now);
    if (post.by === ctx.account.id) return { ok: false, reason: '不能给自己的帖子点赞。' };
    if ((post.likes || []).includes(ctx.account.id)) return { ok: false, reason: '已经赞过了。' };
    const cap = lim(ctx.account, now, 5, 10);
    const used = (ctx.likeDays || {})[today] || 0;
    if (used >= cap) return { ok: false, reason: `今天的 ${cap} 个赞用完了，明天再来。` };
    return { ok: true };
  }
  const isFolded = (post) => (post.flags || []).length >= FOLD_AT;

  /* ---------- 站长批量加娃厂 ----------
   * 每行一家，字段用 | 或 ｜ 或 Tab 隔开（从 Excel 复制过来是 Tab）：
   *   名字 | 标签 | 擅长体型 | 其他平台账号 | 简介 | 客服
   * 标签、擅长体型用逗号 / 顿号隔开；其他平台账号写成「闲鱼:账号名;小红书:账号名」；客服可空（有客服 = 已入驻）。
   * 也可以直接粘 JSON 数组：[{ "name", "tags", "specialties", "platforms":[{platform,account}], "note", "service" }]。 */
  const splitList = (t, re) => String(t || '').split(re).map((x) => x.trim()).filter(Boolean);
  function normFactory(o) {
    const name = String(o.name || '').trim();
    if (name.length < 2 || name.length > 16) return { ok: false, reason: '名字要 2 到 16 个字' };
    const tags = (Array.isArray(o.tags) ? o.tags : splitList(o.tags, /[,，、/\s]+/)).map((x) => String(x).trim().slice(0, 8)).filter(Boolean).slice(0, 5);
    const specialties = (Array.isArray(o.specialties) ? o.specialties : splitList(o.specialties, /[,，、/\s]+/)).map((x) => String(x).trim().slice(0, 12)).filter(Boolean).slice(0, 8);
    let platforms = o.platforms;
    if (!Array.isArray(platforms)) platforms = splitList(platforms, /[;；\n]+/).map((x) => { const i = x.search(/[:：]/); return i < 0 ? { platform: x, account: '' } : { platform: x.slice(0, i).trim(), account: x.slice(i + 1).trim() }; });
    platforms = platforms.map((x) => ({ platform: String(x.platform || '').trim().slice(0, 8), account: String(x.account || '').trim().slice(0, 40) })).filter((x) => x.platform).slice(0, 6);
    return { ok: true, f: { name, tags, specialties, platforms, note: String(o.note || '').trim().slice(0, 120), service: String(o.service || '').trim().slice(0, 40) } };
  }
  function parseFactoryText(text, existingNames = []) {
    const t = String(text || '').trim(), list = [], errors = [], seen = new Set(existingNames);
    const push = (o, label) => { const r = normFactory(o); if (!r.ok) { errors.push(`${label}：${r.reason}`); return; } if (seen.has(r.f.name)) { errors.push(`${label}：「${r.f.name}」已经有了，跳过`); return; } seen.add(r.f.name); list.push(r.f); };
    if (t.startsWith('[')) {
      let arr; try { arr = JSON.parse(t); } catch { return { list, errors: ['JSON 格式不对，读不出来。'] }; }
      (Array.isArray(arr) ? arr : []).forEach((o, i) => push(o || {}, `第 ${i + 1} 项`));
      return { list, errors };
    }
    t.split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return;
      const c = line.split(/[|｜\t]/);
      if (i === 0 && /^名字|^娃厂|^name/i.test(c[0].trim())) return;      // 表头
      push({ name: c[0], tags: c[1], specialties: c[2], platforms: c[3], note: c[4], service: c[5] }, `第 ${i + 1} 行`);
    });
    return { list, errors };
  }

  /* ---------- 一家娃厂的评价时间线 ----------
   * 评分、评论、Repo、避雷、这家自己发的业务动态，全部按时间排成一条线，按月分组（新的在上）。
   * 不再是「评论一块、Repo 一块、避雷一块」零零散散。被 3 人举报折叠的帖子不进时间线。 */
  const monthKey = (ts) => dayKey(ts).slice(0, 7);
  function buildTimeline(factory, data) {
    const items = [];
    for (const r of data.records || []) if (r.f === factory.id) items.push({ ts: r.ts, type: 'rate', by: r.by, byName: r.byName || '', lvl: r.lvl, score: r.s, weight: r.w });
    for (const c of data.comments || []) if (c.f === factory.id) items.push({ ts: c.ts, type: 'comment', by: c.by, byName: c.byName || '', lvl: c.lvl, text: c.text });
    for (const p of data.posts || []) {
      if (p.f !== factory.id || isFolded(p)) continue;
      const type = p.board === 'repo' ? 'repo' : p.board === 'avoid' ? 'avoid' : p.board === 'biz' ? 'news' : null;
      if (type) items.push({ ts: p.ts, type, by: p.by, byName: p.byName || '', title: p.title, text: p.body, likes: (p.seedLikes || 0) + (p.likes || []).length, cat: p.cat || '', example: !!p.example });
    }
    items.sort((a, b) => b.ts - a.ts);
    const counts = { rate: 0, comment: 0, repo: 0, avoid: 0, news: 0 };
    items.forEach((i) => { counts[i.type]++; });
    const groups = [];
    for (const it of items) {
      const k = monthKey(it.ts);
      let g = groups[groups.length - 1];
      if (!g || g.key !== k) { g = { key: k, label: `${k.slice(0, 4)} 年 ${Number(k.slice(5))} 月`, items: [] }; groups.push(g); }
      g.items.push(it);
    }
    return { total: items.length, counts, groups };
  }

  const api = { buildTimeline, parseFactoryText, validateComment, validatePost, validateLike, hasContact, hasSensitive, hasCommercial, BOARDS, BIZ_CATS, PLATFORMS, isFolded, FOLD_AT, DAILY_LIMIT, HIGH_SCORE, LOW_SCORE, SPIKE_CAP, dayKey, weightOf, scoreOf, judgeVote, validateUpload, LEVEL_NAME };
  root.NunuFactory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
