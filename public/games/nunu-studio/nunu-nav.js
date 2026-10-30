/* 努努工作台 · 底栏导航 + 娃厂红黑榜 + 我的页面
 * 只管「页面切换」和两张新页面的渲染；做娃娃的逻辑在 app.js / nunu-design.js。
 * 数据都在本浏览器（localStorage）；联网同步还没上。
 */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];

  /* ============ 底栏四页切换 ============ */
  const pages = $$('.page');
  const navBtns = $$('.bnav');
  let current = 'make';

  function setActive(name, fromDesigner) {
    current = name;
    navBtns.forEach(b => b.classList.toggle('on', b.dataset.goto === name));
    pages.forEach(p => { p.hidden = p.dataset.page !== name; });
    const designer = window.__nunu && window.__nunu.designer;
    if (!fromDesigner && designer) {
      if (name === 'make') designer.show(true);       // 四层设计台
      else if (name === 'pattern') designer.show(false); // 纸样 + 3D + 备料检查
    }
    if (name === 'mine') { renderMine(); if (window.__nunuNav) window.__nunuNav.renderMineSponsor(); }
    if (name === 'factory') renderFactory();
    if (name === 'forum' && window.__nunuNav) window.__nunuNav.renderForum();
    window.scrollTo({ top: 0 });
  }
  navBtns.forEach(b => b.addEventListener('click', () => setActive(b.dataset.goto)));

  /* 设计台里点「回到四层设计台 / 裁片与备料」时，底栏跟着切 */
  const designerHost = $('#layerDesigner');
  if (designerHost) {
    designerHost.addEventListener('nunu:viewchange', (e) => {
      setActive(e.detail && e.detail.paper ? 'pattern' : 'make', true);
    });
  }
  // 设计台挂载前点底栏也能用：设计台出现后补一次同步
  const syncWhenReady = () => { if (window.__nunu && window.__nunu.designer) setActive(current, true); else setTimeout(syncWhenReady, 300); };
  syncWhenReady();

  /* ============ 娃厂红黑榜 ============ */
  const FACTORIES = [];   // 没有任何预置娃厂：榜单上只会出现真实有人上传、有人评过的娃厂
  const F = window.NunuFactory;
  const STORE_KEY = 'nunu-factory-v2';
  const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (msg) => { const t = $('#toast'); if (t) { t.textContent = msg; t.classList.add('show'); clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('show'), 2600); } };

  /* 本机存档：账号（id、第一次用的时间、评过几次）、所有评价记录、上传的娃厂。
   * 现在都在这个浏览器里，规矩（nunu-factory.js）只能防正常使用里的顺手刷分；联网以后同一份逻辑搬到服务器上跑。 */
  function loadStore() {
    let st = null;
    try { st = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { st = null; }
    if (!st || !st.account) st = { account: { id: 'u-' + Math.random().toString(36).slice(2, 10), created: Date.now(), rated: 0 }, records: [], uploads: [] };
    st.records = st.records || []; st.uploads = st.uploads || []; st.comments = st.comments || []; st.posts = st.posts || []; st.likeDays = st.likeDays || {}; st.dms = (st.dms || []).filter(t => Date.now() - t.ts < 7 * 864e5);   // 私信只留 7 天
    return st;
  }
  let store = loadStore();
  const A = window.NunuAuth;
  let USER = A ? A.current(localStorage) : null;
  /* 登录后，这台浏览器里的「账号」就是登录的用户（第一个注册的用户会认领之前的匿名数据） */
  function syncAccount() {
    if (USER && store.account.id !== USER.id) store.account = { id: USER.id, created: USER.created, rated: 0 };
    if (USER) store.account.created = USER.created;
    saveStore();
  }
  const saveStore = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { toast('存储空间满了，这次没存上。请先下载备份、删掉一些图片帖。'); } };
  const readWorks = () => { try { const l = JSON.parse(localStorage.getItem('nunu-v4-design-projects')); return (Array.isArray(l) ? l.length : 0) + 1; } catch { return 1; } };
  const accountNow = () => ({ ...store.account, works: readWorks(), admin: !!(USER && USER.isAdmin), name: USER ? USER.name : '' });
  const guard = () => { if (USER) return true; toast('请先登录：到「我的」页 → 登录 / 注册。'); openLogin(); return false; };
  const adminFactories = () => (SPON.factories || []).map(f => ({ id: 'sf-' + f.name, name: f.name, tags: f.tags || [], note: f.note || '', specialties: f.specialties || [], platforms: f.platforms || [], base: 0, votes: 0, fromAdmin: true }));
  const rawFactories = () => [...FACTORIES, ...adminFactories(), ...store.uploads.filter(u => !(SPON.factories || []).some(f => f.name === u.name)).map(u => ({ id: u.id, name: u.name, tags: u.tags, note: u.note, owner: u.owner, base: 0, votes: 0, isNew: true }))];
  const claimOf = (f) => (SPON.claims || []).find(c => c.factory === f.name) || null;
  const allFactories = () => rawFactories().map(f => { const c = claimOf(f); return c ? { ...f, claimedBy: c.user } : f; });
  /* 认领（付费）：站长在管理台把「账号 ↔ 娃厂」绑上，这个账号走到哪（评论、帖子、私信）都带「✔ 认证」牌子 */
  const badgeOf = (name) => { const c = (SPON.claims || []).find(x => x.user === name); return c ? `<span class="fcVerified" title="付费认领认证：站长确认过这个账号是「${esc(c.factory)}」的人。不代表质量，不影响评分和排序">✔ ${esc(c.factory)}（认证）</span>` : ''; };
  const authorTag = (by, byName, lvl) => (by === store.account.id ? '我' : (lvl === 'low' ? '新账号' : '玩家')) + (byName ? badgeOf(byName) : '');
  /* 站长维护的名单（public/games/nunu-studio/sponsors.json）：认证的娃厂、微信号、感谢榜。谁打钱了就在这个文件里加一行。 */
  let SPON = { ownerWechat: '', joined: [], thanks: [], notices: [], factories: [], claims: [], admin: null };
  const DRAFT_KEY = 'nunu-admin-draft';
  const applyDraft = () => { if (USER && USER.isAdmin) { try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY)); if (d) SPON = { ...SPON, ...d }; } catch { /* 草稿坏了就不用 */ } } };
  /* 入驻 = 站长名单里有这家：joined 里每一项是娃厂名字（字符串），或 { name, service: '客服怎么联系' } */
  const joinOf = (f) => { const cl = (SPON.claims || []).find(c => c.factory === f.name); if (cl) return { service: cl.service || '' }; const own = (SPON.factories || []).find(x => x.name === f.name && (x.service || x.joined)); if (own) return { service: own.service || '' }; const hit = SPON.joined.find(v => (typeof v === 'string' ? v : (v.id || v.name)) === f.id || (typeof v === 'string' ? v : v.name) === f.name); return hit ? { service: typeof hit === 'string' ? '' : (hit.service || '') } : null; };
  const isVerified = (f) => !!joinOf(f);
  const loadSpon = () => fetch('sponsors.json?t=' + Date.now()).then(r => r.ok ? r.json() : null).then(j => { if (j) { SPON = { ownerWechat: '', joined: [], thanks: [], notices: [], factories: [], claims: [], admin: null, ...j }; SPON.joined = SPON.joined || j.verified || []; SPON._remote = JSON.parse(JSON.stringify(SPON)); applyDraft(); renderNotices(); renderFactory(); renderMineSponsor(); } }).catch(() => { /* 没有这个文件就当没人 */ });
  const myVoteCount = () => store.records.filter(r => r.by === store.account.id).length;
  const todayLeft = () => F.DAILY_LIMIT - store.records.filter(r => r.by === store.account.id && r.day === F.dayKey(Date.now())).length;

  const scoreOf = (f) => {
    const s = F.scoreOf(f, store.records);
    const mine = store.records.filter(r => r.by === store.account.id && r.f === f.id).sort((x, y) => y.ts - x.ts)[0];
    return { score: s.score, votes: s.votes, mine: mine ? mine.s : 0 };
  };
  const stars = (score) => {
    const full = Math.round(score / 2);
    return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
  };

  function factoryItem(f, rank, red) {
    const s = scoreOf(f);
    const li = document.createElement('li');
    li.className = 'fcItem';
    li.innerHTML = `
      <span class="fcRank">${rank}</span>
      <div class="fcName">${esc(f.name)}${isVerified(f) ? '<span class="fcVerified" title="付费认领认证：站长确认过身份并收费，不代表质量，不影响评分和排序">✔ 认证</span>' : ''}${f.tags.map(t => `<span class="fcTag${red ? '' : ' bad'}">${esc(t)}</span>`).join('')}</div>
      <div class="fcMeta">${s.votes} 人评过${s.mine ? ' · 我打了 ' + s.mine + ' 分' : ''}</div>
      <div class="fcScore">
        <span class="fcNum">${s.score.toFixed(1)}</span>
        <span class="fcStars">${stars(s.score)}</span>
        <button type="button" class="fcVote">${s.mine ? '看看 / 再评' : '评价'}</button>
      </div>`;
    li.querySelector('.fcVote').addEventListener('click', () => openFactory(f.id));
    li.querySelector('.fcName').addEventListener('click', () => openFactory(f.id));
    return li;
  }

  function renderFactory() {
    const redList = $('#fcRedList'), blackList = $('#fcBlackList');
    if (!redList || !blackList) return;
    // 榜单只排「有分」的；新上传、还没人评的先不上榜
    const ranked = allFactories().filter(f => scoreOf(f).score != null).sort((a, b) => scoreOf(b).score - scoreOf(a).score);
    redList.innerHTML = ''; blackList.innerHTML = '';
    ranked.slice(0, 3).forEach((f, i) => redList.appendChild(factoryItem(f, i + 1, true)));
    ranked.slice(-3).reverse().forEach((f, i) => blackList.appendChild(factoryItem(f, i + 1, false)));
    if (!ranked.length) { const msg = '<li class="fcEmpty">还没有娃厂有评分。点右上角「＋ 上传娃厂」添加，大家评过以后才会上榜。</li>'; redList.innerHTML = msg; blackList.innerHTML = msg; }
    // 全部娃厂：榜上没有的（新上传的、中间的）也能点进去评价
    const all = $('#fcAllList');
    if (all) {
      const list = allFactories();
      $('#fcAllCount').textContent = list.length;
      all.innerHTML = '';
      list.forEach((f) => {
        const s = scoreOf(f), li = document.createElement('li');
        li.className = 'fcAllItem';
        li.innerHTML = `<b>${esc(f.name)}</b>${isVerified(f) ? '<span class="fcVerified">✔</span>' : ''}${f.isNew ? '<span class="fcTag">新</span>' : ''}<span class="fcAllScore">${s.score == null ? '还没人评' : s.score.toFixed(1)}</span>`;
        li.addEventListener('click', () => openFactory(f.id));
        all.appendChild(li);
      });
    }
    const left = $('#fcLeft');
    if (left) left.textContent = `今天还能评 ${todayLeft()} 家`;
  }

  /* ---- 点进去：看分、评价 ---- */
  function dialogShell(id, html) {
    let dlg = $('#' + id);
    if (dlg) dlg.remove();
    dlg = document.createElement('dialog');
    dlg.id = id; dlg.className = 'fcDialog';
    dlg.innerHTML = `<div class="fcBox">${html}</div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    return dlg;
  }
  const RULES_HTML = `<ul class="fcRules">
    <li>每天最多评 <b>${F.DAILY_LIMIT}</b> 家，同一家一天只能评一次。</li>
    <li>不能给自己上传的娃厂打分。</li>
    <li>账号有「权重」：用得越久、做的娃娃越多、评得越多，权重越高。新账号的一票比较轻。</li>
    <li>权重低的账号：同一天里<b>不能一家打很高（9 分以上）、另一家打很低（3 分以下）</b>；也不能把大家公认的好厂打成极低分、把公认的差厂打成极高分。<b>权重高了放宽。</b></li>
    <li>一家娃厂一天之内涌进来很多极端分，超出的部分这一票先不计分。</li>
  </ul>`;

  function openFactory(id) {
    const f = allFactories().find(x => x.id === id);
    if (!f) return;
    const s = scoreOf(f), w = F.weightOf(accountNow());
    let pick = 0;
    const dlg = dialogShell('fcDetail', `
      <header><h2>${esc(f.name)}${f.isNew ? ' <span class="fcTag">新上传</span>' : ''}</h2><button type="button" class="fcX" aria-label="关闭">✕</button></header>
      <div class="fcTagsRow">${f.tags.map(t => `<span class="fcTag">${esc(t)}</span>`).join('')}</div>
      ${f.note ? `<p class="fcNoteTxt">${esc(f.note)}</p>` : ''}
      ${(f.specialties && f.specialties.length) ? `<p class="fcSpec"><b>擅长体型：</b>${f.specialties.map(x => `<span class="fcTag">${esc(x)}</span>`).join('')}</p>` : ''}
      ${(f.platforms && f.platforms.length) ? `<p class="fcSpec"><b>其他平台账号：</b>${f.platforms.map(x => `<span class="fcPlat">${esc(x.platform)}${x.account ? '：' + esc(x.account) : ''}</span>`).join('')}<small>${f.fromAdmin ? '站长录入；' : ''}仅供搜索，不是跳转链接；下单请走平台内交易。</small></p>` : ''}
      <div class="fcBig"><span class="fcNum">${s.score == null ? '—' : s.score.toFixed(1)}</span><span class="fcStars">${s.score == null ? '还没人评' : stars(s.score)}</span><span class="fcMeta">${s.votes} 人评过${s.mine ? ' · 我最近打了 ' + s.mine + ' 分' : ''}</span></div>
      <h3>联系客服</h3>
      ${(() => { const j = joinOf(f); return j
        ? `<p class="fcContact">✔ 这家已被认领认证（付费），有官方客服。${j.service ? '客服：<b>' + esc(j.service) + '</b>' : '客服联系方式站长还没填。'}</p>`
        : '<p class="fcContact">这家还没被认领，暂时没有官方客服。下面是大家的评价、Repo 和避雷。<button type="button" class="fcMini" id="fcClaim">🏷 我是这家的人，认领</button></p>'; })()}
      <p class="fcContact"><small>平台只提供入口，不负责后续对接：下单、付款、售后、纠纷都由你和娃厂自己处理。认证是付费的，只代表站长确认过身份，不代表质量，也不影响评分和排序。</small></p>
      <h3>我的评分</h3>
      <div class="fcPick">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="fcStarBtn" data-star="${n * 2}" aria-label="${n * 2} 分">★</button>`).join('')}<span class="fcPickTxt">点星星：2 / 4 / 6 / 8 / 10 分</span></div>
      <p class="fcMsg" id="fcMsg"></p>
      <div class="fcRow"><button type="button" class="fcOk" disabled>提交评分</button></div>
      <p class="fcAcct">你的账号权重：<b>${esc(w.name)}</b> · 今天还能评 <b>${todayLeft()}</b> 家</p>
      <details><summary>评分规矩</summary>${RULES_HTML}</details>
      <h3>📜 评价时间线（<span id="fcTlN">0</span>）</h3>
      <p class="fcNoteTxt" id="fcTlSum"></p>
      <div class="fmCats" id="fcTlFilter"></div>
      <div class="fcTimeline" id="fcTimeline"></div>
      <h3>我也说一句</h3>
      <div class="fcCmtBox"><textarea id="fcCmtText" maxlength="100" rows="2" placeholder="说说你的体验（2–100 字，不放网址 / 联系方式）"></textarea><button type="button" class="fcOk" id="fcCmtGo">发表评论</button></div>
      <p class="fcMsg" id="fcCmtMsg"></p>
      <div class="fcRow"><button type="button" class="fcMini" data-newpost="repo">＋ 发 Repo</button> <button type="button" class="fcMini" data-newpost="avoid">＋ 发避雷</button></div>`);
    const msg = dlg.querySelector('#fcMsg'), ok = dlg.querySelector('.fcOk');
    let tlFilter = '';
    const TL_NAME = { rate: '评分', comment: '评论', repo: 'Repo', avoid: '避雷', news: '业务动态' };
    const paintTimeline = () => {
      const tl = F.buildTimeline(f, { records: store.records, comments: store.comments, posts: allPosts() });
      dlg.querySelector('#fcTlN').textContent = tl.total;
      dlg.querySelector('#fcTlSum').textContent = tl.total ? `共 ${tl.total} 条：` + Object.entries(TL_NAME).filter(([k]) => tl.counts[k]).map(([k, n]) => `${n} ${tl.counts[k]}`).join(' · ') + '。按时间从新到旧，按月分组。' : '还没有任何评价。打分、评论、发 Repo、发避雷都会按时间排在这里。';
      const fl = dlg.querySelector('#fcTlFilter');
      fl.innerHTML = tl.total ? [['', '全部'], ...Object.entries(TL_NAME).filter(([k]) => tl.counts[k])].map(([k, n]) => `<button type="button" data-tl="${k}" class="${k === tlFilter ? 'on' : ''}">${n}</button>`).join('') : '';
      fl.querySelectorAll('[data-tl]').forEach(btn => btn.onclick = () => { tlFilter = btn.dataset.tl; paintTimeline(); });
      const body = dlg.querySelector('#fcTimeline');
      const groups = tl.groups.map(g => ({ ...g, items: g.items.filter(i => !tlFilter || i.type === tlFilter) })).filter(g => g.items.length);
      body.innerHTML = groups.length ? groups.map(g => `<section class="fcTlMonth"><h4>${g.label}</h4><ol>${g.items.map(i => `<li class="fcTl-${i.type}"><time>${new Date(i.ts).toLocaleDateString()}</time><span class="fcTlType">${TL_NAME[i.type]}${i.cat ? '·' + esc(BIZ_CAT_NAME[i.cat] || i.cat) : ''}</span><div class="fcTlBody"><b>${authorTag(i.by, i.byName, i.lvl)}</b>${i.type === 'rate' ? `打了 <b>${i.score}</b> 分${i.weight === 0 ? '（这一票先不计分）' : ''}` : i.type === 'comment' ? esc(i.text) : `<strong>${esc(i.title)}</strong><span>${esc(i.text.slice(0, 120))}${i.text.length > 120 ? '…' : ''}</span><small>👍 ${i.likes}</small>`}</div></li>`).join('')}</ol></section>`).join('') : '<p class="fcEmpty">这一类还没有。</p>';
    };
    paintTimeline();
    const claimBtn = dlg.querySelector('#fcClaim');
    if (claimBtn) claimBtn.onclick = () => openClaim(f);
    dlg.querySelectorAll('[data-newpost]').forEach(b => b.onclick = () => { dlg.close(); setActive('forum'); openPost(b.dataset.newpost, f.id); });
    dlg.querySelector('#fcCmtGo').onclick = () => {
      if (!guard()) return;
      const m = dlg.querySelector('#fcCmtMsg');
      const res = F.validateComment(dlg.querySelector('#fcCmtText').value, { account: accountNow(), now: Date.now(), factory: f, comments: store.comments });
      if (!res.ok) { m.textContent = '✋ ' + res.reason; m.className = 'fcMsg bad'; return; }
      store.comments.push({ id: 'c-' + Date.now().toString(36), f: f.id, by: store.account.id, byName: USER ? USER.name : '', text: res.clean, ts: Date.now(), day: F.dayKey(Date.now()), lvl: F.weightOf(accountNow()).level });
      saveStore(); dlg.querySelector('#fcCmtText').value = ''; m.textContent = '评论发出去了。'; m.className = 'fcMsg'; paintTimeline();
    };
    dlg.querySelector('.fcX').onclick = () => dlg.close();
    const paint = () => dlg.querySelectorAll('.fcStarBtn').forEach(b => b.classList.toggle('pick', Number(b.dataset.star) <= pick));
    dlg.querySelectorAll('.fcStarBtn').forEach(b => b.onclick = () => { pick = Number(b.dataset.star); paint(); ok.disabled = false; msg.textContent = ''; });
    ok.onclick = () => {
      if (!guard()) return;
      const res = F.judgeVote({ account: accountNow(), now: Date.now(), factory: f, score: pick, records: store.records, avg: s.score });
      if (!res.ok) { msg.textContent = '✋ ' + res.reason; msg.className = 'fcMsg bad'; return; }
      store.records.push({ by: store.account.id, byName: USER ? USER.name : '', f: f.id, s: pick, w: res.weight, lvl: res.level, day: F.dayKey(Date.now()), ts: Date.now() });
      store.account.rated = (store.account.rated || 0) + 1;
      saveStore(); renderFactory();
      dlg.close();
      toast(`给「${f.name}」打了 ${pick} 分${res.note ? '。' + res.note : '，榜单已更新'}`);
    };
  }

  /* ---- 认领娃厂（付费）---- */
  function openClaim(f) {
    const dlg = dialogShell('fcClaimDlg', `
      <header><h2>🏷 认领「${esc(f.name)}」</h2><button type="button" class="fcX" aria-label="关闭">✕</button></header>
      <p class="fcNoteTxt">认领 = 把你的账号和这家娃厂绑在一起，得到「✔ 认证」牌子。<b>价格：${esc(SPON.joinPrice || '200 元')}</b>。</p>
      <ol class="fcRules"><li>先在「我的」页注册 / 登录，记下你的<b>用户名</b>。</li><li>打赏站长 ${esc(SPON.joinPrice || '200 元')}（赞赏码在「我的」页），备注娃厂名字。</li><li>把<b>用户名 + 娃厂名字 + 客服联系方式</b>发给站长${SPON.ownerWechat ? '（微信：<b>' + esc(SPON.ownerWechat) + '</b>）' : '（站长微信见「我的」页）'}。</li><li>站长核对后在管理台把你的账号绑上。绑定后：你的账号走到哪里（评论、论坛帖子、私信）都带「✔ ${esc(f.name)}（认证）」牌子，娃厂页会显示你的官方客服，你还能在「娃厂业务」区发接单、活动、新品、招人合作。</li></ol>
      <p class="fcNoteTxt"><b>说清楚：</b>认证是付费的，牌子旁边的提示也写着这一点；它只代表站长确认过身份，<b>不代表质量，也不影响评分和榜单排序</b>。认领后<b>不能给自己的娃厂打分、评论、发 Repo / 避雷</b>。平台不负责你和玩家之间后续的交易对接。</p>
      <img src="donate.png?v=2" alt="站长赞赏码" class="mineDonate" onerror="this.style.display='none'">`);
    dlg.querySelector('.fcX').onclick = () => dlg.close();
  }

  /* ---- 上传娃厂 ---- */
  function openUpload() {
    const w = F.weightOf(accountNow());
    const dlg = dialogShell('fcUploadDlg', `
      <header><h2>＋ 上传娃厂</h2><button type="button" class="fcX" aria-label="关闭">✕</button></header>
      <p class="fcNoteTxt">把你知道的娃厂加进来，大家就能给它打分。上传的娃厂一开始没有分，有人评了才会排进红黑榜。</p>
      <label class="fcField">娃厂名字（2–16 字）<input id="fcName" maxlength="16" placeholder="例如：小熊慢工坊"></label>
      <label class="fcField">标签（最多 3 个，用逗号隔开）<input id="fcTags" maxlength="30" placeholder="做工细，发货快，回复甜"></label>
      <label class="fcField">一句话介绍（最多 80 字）<textarea id="fcNote" maxlength="80" rows="2" placeholder="做什么、擅长什么"></textarea></label>
      <p class="fcMsg" id="fcUpMsg"></p>
      <div class="fcRow"><button type="button" class="fcOk">上传</button></div>
      <p class="fcAcct">你的账号权重：<b>${esc(w.name)}</b> · 新账号一天只能传 1 家，最多 3 家 · 名字和简介里不要放网址 / 联系方式 · 不能给自己传的厂打分</p>`);
    dlg.querySelector('.fcX').onclick = () => dlg.close();
    dlg.querySelector('.fcOk').onclick = () => {
      if (!guard()) return;
      const res = F.validateUpload({ name: dlg.querySelector('#fcName').value, tags: dlg.querySelector('#fcTags').value, note: dlg.querySelector('#fcNote').value },
        { account: accountNow(), now: Date.now(), factories: allFactories().map(f => ({ ...f, ts: (store.uploads.find(u => u.id === f.id) || {}).ts })) });
      const msg = dlg.querySelector('#fcUpMsg');
      if (!res.ok) { msg.textContent = '✋ ' + res.reason; msg.className = 'fcMsg bad'; return; }
      const up = { id: 'up-' + Date.now().toString(36), ...res.clean, owner: store.account.id, ts: Date.now() };
      store.uploads.push(up); saveStore(); renderFactory();
      dlg.close();
      toast(`「${up.name}」上传好了，有人评了才会上榜。`);
    };
  }
  const upBtn = $('#fcUpload');
  if (upBtn) upBtn.addEventListener('click', openUpload);

  /* ============ 论坛：避雷 / Repo / 体型图 / 经验 / 棉花娃娃宣传区 / 娃厂业务 ============ */
  const BOARD_META = [
    { k: 'avoid', name: '⚠️ 避雷', tip: '亲身踩过的坑，写清楚经过，不骂人、不猜测。' },
    { k: 'repo', name: '📦 Repo 榜单', tip: '收货报告（做工、工期、和图纸对不对得上）。点赞多的排前面。' },
    { k: 'shape', name: '🧍 体型图', tip: '分享你的体型图 / 版型，要附一张图。' },
    { k: 'tips', name: '💡 经验', tip: '制作、选布、缝纫、购买的经验分享。' },
    { k: 'promo', name: '🌸 棉花娃娃宣传区', tip: '展示你自己的娃。不能带价格 / 接单 / 开团等买卖信息；做生意请入驻。' },
    { k: 'maker', name: '🧵 手作娘接单', tip: '个人手作娘接单：不用认证，但必须走闲鱼 / 淘宝等有交易保障的第三方平台下单，不得私下转账。' },
    { k: 'biz', name: '🏭 娃厂业务', tip: '只有已入驻的娃厂能发：接单、活动、新品、招人合作。' },
  ];
  const BIZ_CAT_NAME = { order: '接单 / 开单', event: '活动 / 优惠', new: '新品上线', recruit: '招人 / 合作', other: '其他' };
  const SEED_POSTS = [];   // 没有预置帖子
  let fmTab = 'avoid', fmCat = '';
  const allPosts = () => [...SEED_POSTS, ...store.posts];
  const likeCount = (p) => (p.seedLikes || 0) + (p.likes || []).length;
  const ownerJoined = () => (USER && (SPON.claims || []).some(c => c.user === USER.name)) || store.uploads.some(u => u.owner === store.account.id && joinOf(u));   // 我上传的娃厂已入驻 = 我是入驻方
  function renderForum() {
    const box = $('#fmList'); if (!box) return;
    const tabs = $('#fmTabs');
    tabs.innerHTML = BOARD_META.map(m => `<button type="button" data-fmtab="${m.k}" class="${m.k === fmTab ? 'on' : ''}">${m.name}</button>`).join('');
    tabs.querySelectorAll('[data-fmtab]').forEach(b => b.onclick = () => { fmTab = b.dataset.fmtab; fmCat = ''; renderForum(); });
    $('#fmTip').textContent = BOARD_META.find(m => m.k === fmTab).tip;
    const cats = $('#fmCats');
    cats.hidden = fmTab !== 'biz';
    if (fmTab === 'biz') {
      cats.innerHTML = [['', '全部'], ...Object.entries(BIZ_CAT_NAME)].map(([k, n]) => `<button type="button" data-cat="${k}" class="${k === fmCat ? 'on' : ''}">${n}</button>`).join('');
      cats.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { fmCat = b.dataset.cat; renderForum(); });
    }
    let list = allPosts().filter(p => p.board === fmTab && (fmTab !== 'biz' || !fmCat || p.cat === fmCat));
    list = fmTab === 'repo' ? list.sort((a, b) => likeCount(b) - likeCount(a)) : list.sort((a, b) => b.ts - a.ts);
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<li class="fcEmpty">还没有帖子，来发第一个。</li>'; return; }
    list.forEach((p, i) => {
      const fac = allFactories().find(f => f.id === p.f);
      const li = document.createElement('li');
      const folded = F.isFolded(p);
      li.className = 'fmPost' + (folded ? ' folded' : '');
      li.innerHTML = `${fmTab === 'repo' ? `<span class="fcRank">${i + 1}</span>` : ''}
        <div class="fmBody"><h3>${esc(p.title)}${p.example ? '<span class="fcTag">示例</span>' : ''}${p.cat ? `<span class="fcTag">${esc(BIZ_CAT_NAME[p.cat] || p.cat)}</span>` : ''}${p.platform ? `<span class="fcTag">${esc(p.platform)} · ${esc(p.shop)}</span>` : ''}${fac ? `<span class="fcTag">${esc(fac.name)}</span>` : ''}</h3>
        <p>${folded ? '这个帖子被多人举报，先折叠了。' : esc(p.body)}</p>
        ${p.platform && !folded ? `<p class="fmMakerWarn">请在「${esc(p.platform)}」平台内下单，平台保障交易；不要私下转账、不要扫陌生二维码。</p>` : ''}
        ${p.img && !folded ? `<img class="fmImg" src="${p.img}" alt="">` : ''}
        <small>${p.by === store.account.id ? '我发的' : (p.example ? '示例' : '玩家')}${p.byName ? badgeOf(p.byName) : ''} · ${new Date(p.ts).toLocaleDateString()}</small></div>
        <div class="fmOps"><button type="button" class="fmLike">👍 ${likeCount(p)}</button>${p.example || p.by === store.account.id ? '' : '<button type="button" class="fmDm">私信</button><button type="button" class="fmFlag">举报</button>'}</div>`;
      li.querySelector('.fmLike').onclick = () => {
        if (!guard()) return;
        if (p.example) { toast('示例帖不能点赞。'); return; }
        const res = F.validateLike(p, { account: accountNow(), now: Date.now(), likeDays: store.likeDays });
        if (!res.ok) { toast('✋ ' + res.reason); return; }
        p.likes.push(store.account.id); const d = F.dayKey(Date.now()); store.likeDays[d] = (store.likeDays[d] || 0) + 1;
        saveStore(); renderForum();
      };
      const dm = li.querySelector('.fmDm'); if (dm) dm.onclick = () => openDM({ with: p.by, ref: p.title });
      const fl = li.querySelector('.fmFlag');
      if (fl) fl.onclick = () => { if (!guard()) return; if (!p.flags.includes(store.account.id)) { p.flags.push(store.account.id); saveStore(); renderForum(); toast('已举报，谢谢。'); } else toast('已经举报过了。'); };
      box.appendChild(li);
    });
  }
  /** 图片压到 600 边长以内的 JPEG，再不行就继续降质量，直到小于 250KB */
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const k = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
        const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, cv.width, cv.height);
        let q = 0.78, out = cv.toDataURL('image/jpeg', q);
        while (out.length > 250000 && q > 0.3) { q -= 0.12; out = cv.toDataURL('image/jpeg', q); }
        out.length > 250000 ? reject(new Error('图片太大，换一张小一点的。')) : resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('这张图打不开。')); };
      img.src = url;
    });
  }
  function openPost(board, fid) {
    if (typeof board === 'string') fmTab = board;
    let img = '';
    const dlg = dialogShell('fmPostDlg', `
      <header><h2>＋ 发帖</h2><button type="button" class="fcX" aria-label="关闭">✕</button></header>
      <label class="fcField">板块<select id="fmBoard">${BOARD_META.map(m => `<option value="${m.k}" ${m.k === fmTab ? 'selected' : ''}>${m.name}${m.k === 'biz' ? '（仅入驻娃厂）' : ''}</option>`).join('')}</select></label>
      <label class="fcField" id="fmCatRow" hidden>业务分类<select id="fmCat">${Object.entries(BIZ_CAT_NAME).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
      <label class="fcField" id="fmPlatRow" hidden>下单平台（必须是有交易保障的第三方）<select id="fmPlat">${(F.PLATFORMS || []).map(x => `<option>${x}</option>`).join('')}</select></label>
      <label class="fcField" id="fmShopRow" hidden>你在平台上的店铺名 / 商品标题（别人搜这个找到你，2–30 字）<input id="fmShop" maxlength="30"></label>
      <label class="fcField">关于哪家娃厂（选填）<select id="fmFac"><option value="">不指定</option>${allFactories().map(f => `<option value="${f.id}" ${f.id === fid ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
      <label class="fcField">标题（4–30 字）<input id="fmTitle" maxlength="30"></label>
      <label class="fcField">正文（10–500 字；不放网址 / 联系方式；不得发布敏感话题）<textarea id="fmText" maxlength="500" rows="5"></textarea></label>
      <label class="fcField">图片（体型图板块必附，其他选填；会自动压缩）<input id="fmImg" type="file" accept="image/*"></label>
      <img id="fmPrev" class="fmImg" hidden alt="">
      <p class="fcMsg" id="fmMsg"></p>
      <div class="fcRow"><button type="button" class="fcOk">发布</button></div>
      <p class="fcAcct">大家都是为爱发电，不是客服：请礼貌，别反复催、别要求别人必须回复。每天最多发 5 帖（新账号 2 帖）· 被 3 个人举报会先折叠 · 恶意抹黑、引流、敏感话题的帖子会被拒 / 删。娃厂做生意、打广告需要入驻；娃厂不能给自己评分、刷分。</p>`);
    const syncCat = () => { const b = dlg.querySelector('#fmBoard').value; dlg.querySelector('#fmCatRow').hidden = b !== 'biz'; dlg.querySelector('#fmPlatRow').hidden = dlg.querySelector('#fmShopRow').hidden = b !== 'maker'; };
    dlg.querySelector('#fmBoard').onchange = syncCat; syncCat();
    dlg.querySelector('.fcX').onclick = () => dlg.close();
    dlg.querySelector('#fmImg').onchange = async (e) => {
      const m = dlg.querySelector('#fmMsg'), f0 = e.target.files && e.target.files[0]; if (!f0) return;
      try { img = await shrinkImage(f0); const pv = dlg.querySelector('#fmPrev'); pv.src = img; pv.hidden = false; m.textContent = ''; }
      catch (err) { img = ''; m.textContent = '✋ ' + err.message; m.className = 'fcMsg bad'; }
    };
    dlg.querySelector('.fcOk').onclick = () => {
      if (!guard()) return;
      const res = F.validatePost({ board: dlg.querySelector('#fmBoard').value, cat: dlg.querySelector('#fmCat').value, platform: dlg.querySelector('#fmPlat').value, shop: dlg.querySelector('#fmShop').value, f: dlg.querySelector('#fmFac').value, title: dlg.querySelector('#fmTitle').value, body: dlg.querySelector('#fmText').value, img }, { account: accountNow(), now: Date.now(), posts: store.posts, joined: ownerJoined(), ownFactories: [...store.uploads.filter(u => u.owner === store.account.id).map(u => u.id), ...allFactories().filter(f => USER && f.claimedBy === USER.name).map(f => f.id)] });
      const m = dlg.querySelector('#fmMsg');
      if (!res.ok) { m.textContent = '✋ ' + res.reason; m.className = 'fcMsg bad'; return; }
      store.posts.push({ id: 'p-' + Date.now().toString(36), ...res.clean, by: store.account.id, byName: USER ? USER.name : '', ts: Date.now(), day: F.dayKey(Date.now()), likes: [], flags: [] });
      fmTab = res.clean.board; saveStore(); renderForum(); dlg.close(); toast('帖子发出去了。');
    };
  }
  const newBtn = $('#fmNew'); if (newBtn) newBtn.addEventListener('click', () => openPost());

  /* ============ 私信（短期交流过渡）============
   * 现在没有服务器：消息只存在这台浏览器里，对方收不到，联网以后才能真正收发。只留 7 天。
   * 我们不是中介平台、不担保交易，所以每个私信窗口顶上都写着防骗提醒。 */
  const SCAM_TIP = `<div class="dmWarn"><b>⚠️ 我们不是中介平台，不担保任何交易，小心上单被骗。</b><ul><li>不要提前转大额定金；不要私下转账给陌生人。</li><li>不要扫陌生二维码、不要点陌生链接、不要装对方发来的软件。</li><li>想联系娃厂，优先用「✔ 已入驻」娃厂页面上的官方客服；没入驻的自己多核实。</li><li>聊天记录、付款凭证、实拍图都留好；出了问题要自己和对方处理，平台不负责后续对接。</li></ul></div>`;
  function openDM(ref) {
    let th = store.dms.find(t => t.with === ref.with && (t.ref || '') === (ref.ref || ''));
    const dlg = dialogShell('dmDlg', `
      <header><h2>✉️ 私信${ref.ref ? '：' + esc(ref.ref) : ''}</h2><button type="button" class="fcX" aria-label="关闭">✕</button></header>
      ${SCAM_TIP}
      <p class="fcNoteTxt"><b>对方不是客服，大家都是为爱发电：</b>请礼貌，别反复催；对方不回你是正常的。</p>
      <p class="fcNoteTxt">现在是单机版：消息只存在你这台浏览器里，<b>对方暂时收不到</b>，联网后才能真正收发；私信只保留 7 天，用来做短期交流过渡。</p>
      <ul class="dmMsgs" id="dmMsgs"></ul>
      <div class="fcCmtBox"><textarea id="dmText" maxlength="200" rows="2" placeholder="想说的话（2–200 字）"></textarea><button type="button" class="fcOk" id="dmGo">发送</button></div>
      <p class="fcMsg" id="dmMsg"></p>`);
    const paint = () => { dlg.querySelector('#dmMsgs').innerHTML = th && th.msgs.length ? th.msgs.map(m => `<li><span>${esc(m.text)}</span><small>${new Date(m.ts).toLocaleString()} · 待联网发送</small></li>`).join('') : '<li class="fcEmpty">还没有消息。</li>'; };
    paint();
    dlg.querySelector('.fcX').onclick = () => dlg.close();
    dlg.querySelector('#dmGo').onclick = () => {
      if (!guard()) return;
      const m = dlg.querySelector('#dmMsg'), t = dlg.querySelector('#dmText').value.trim(), today = F.dayKey(Date.now());
      const sentToday = store.dms.reduce((n, x) => n + x.msgs.filter(y => F.dayKey(y.ts) === today).length, 0);
      const cap = F.weightOf(accountNow()).level === 'low' ? 3 : 10;
      if (t.length < 2 || t.length > 200) { m.textContent = '✋ 2 到 200 个字。'; m.className = 'fcMsg bad'; return; }
      if (F.hasSensitive(t)) { m.textContent = '✋ 涉及敏感话题的内容不能发。'; m.className = 'fcMsg bad'; return; }
      if (sentToday >= cap) { m.textContent = `✋ 今天最多发 ${cap} 条私信。`; m.className = 'fcMsg bad'; return; }
      if (!th) { th = { id: 'd-' + Date.now().toString(36), with: ref.with, ref: ref.ref || '', msgs: [], ts: Date.now() }; store.dms.push(th); }
      th.msgs.push({ text: t, ts: Date.now() }); th.ts = Date.now();
      saveStore(); dlg.querySelector('#dmText').value = ''; m.textContent = '已存下，联网后才会发出。'; m.className = 'fcMsg'; paint();
    };
  }
  function openInbox() {
    const dlg = dialogShell('dmInbox', `
      <header><h2>✉️ 私信</h2><button type="button" class="fcX" aria-label="关闭">✕</button></header>
      ${SCAM_TIP}
      <p class="fcNoteTxt">用来做短期的交流过渡，消息只保留 7 天。现在是单机版，消息只存在本机、对方收不到。</p>
      <ul class="dmThreads" id="dmThreads"></ul>`);
    dlg.querySelector('.fcX').onclick = () => dlg.close();
    const ul = dlg.querySelector('#dmThreads'), list = [...store.dms].sort((a, b) => b.ts - a.ts);
    ul.innerHTML = list.length ? '' : '<li class="fcEmpty">还没有私信。在论坛帖子旁边点「私信」可以开始。</li>';
    list.forEach(t => { const li = document.createElement('li'); li.innerHTML = `<b>${esc(t.ref || '私信')}</b><small>${t.msgs.length} 条 · ${new Date(t.ts).toLocaleDateString()}</small>`; li.onclick = () => { dlg.close(); openDM({ with: t.with, ref: t.ref }); }; ul.appendChild(li); });
  }
  const dmBtn = $('#mineDm'); if (dmBtn) dmBtn.addEventListener('click', openInbox);

  /* ============ 说明书（娃厂 + 论坛 + 认证 + 赞助）============ */
  function openGuide() {
    dialogShell('fcGuide', `
      <header><h2>📖 娃厂 · 论坛说明书</h2><button type="button" class="fcX" aria-label="关闭">✕</button></header>
      <h3>娃厂榜</h3><p>红榜是综合评分高的，黑榜是低的；新上传的娃厂没人评之前不上榜，在「全部娃厂」里找。点进娃厂能看分、<b>联系方式</b>、<b>评论区</b>，也能打分。</p>
      <h3>打分和评论的规矩</h3>${RULES_HTML}
      <ul class="fcRules"><li>评论：2–100 字，一天最多 5 条（新账号 3 条），同一家一天一条，不能评自己上传的娃厂，不放网址 / 联系方式。</li><li>只有<b>已入驻</b>的娃厂才有官方客服入口；没入驻的，看评价、Repo、避雷自己判断。平台只提供入口，<b>不负责后续对接</b>，付款前自己再确认，不要给陌生人转大额定金。</li></ul>
      <h3>论坛</h3><ul class="fcRules"><li><b>避雷</b>：亲身踩过的坑，写清楚经过，不骂人、不猜测。</li><li><b>Repo</b>：收货报告。点赞多的排在 Repo 榜单前面。</li><li><b>体型图</b>：分享你的体型图 / 版型（要附图）。<b>经验</b>：制作、选布、缝纫、购买的经验。</li><li><b>棉花娃娃宣传区</b>：展示你自己的娃；不能带价格 / 接单 / 开团等买卖信息。</li><li><b>手作娘接单</b>：见下面。</li><li><b>娃厂业务</b>：只有<b>已入驻</b>的娃厂能发，分类：接单、活动、新品、招人合作、其他。娃厂打广告、做生意都需要入驻。</li><li><b>不得发布敏感话题</b>（政治、色情、赌博、毒品、暴力、诈骗等）；发联系方式 / 网址引流会被拒；3 个人举报先折叠。</li><li>每天最多发 5 帖（新账号 2 帖）；点赞每天 10 个（新账号 5 个），不能赞自己的。</li><li><b>娃厂不能给自己评分、评论、刷分</b>：自己上传的娃厂不能打分 / 评论，不能赞自己的帖子。</li></ul>
      <h3>私信（短期交流过渡）</h3><p>在「我的」页点「✉️ 私信」，或在论坛帖子旁点「私信」。<b>我们不是中介平台，不担保任何交易，小心上单被骗</b>：不要提前转大额定金、不要扫陌生二维码、不要私下转账给陌生人；想联系娃厂优先用「✔ 已入驻」的官方客服。平台不负责后续对接。现在是单机版，私信只存在本机、对方收不到，联网后才能真正收发；私信只保留 7 天。</p>
      <h3>手作娘接单区</h3><p>个人手作娘<b>不用认证</b>就能发，但<b>必须走闲鱼 / 淘宝 / 天猫 / 拼多多 / 京东这类有交易保障的第三方平台下单</b>：发帖要选平台、写店铺名或商品标题；<b>不能提私下转账、扫码、不走平台、加好友私聊</b>。平台里的交易纠纷由平台处理，我们不是中介、不担保。</p>
      <h3>社区公约</h3><p>大家都是<b>为爱发电</b>，不是客服。教程、经验、帖子的作者没有义务回复你：请不要反复私信、催更；<b>不回你是正常的</b>。请保持礼貌，先自己多探索（搜帖子、看说明书、动手试试），再提问，提问时写清楚你试过什么。</p>
      <h3>账号、备份</h3><p>现在没有服务器（没钱），账号、作品、评分、帖子、私信都只存在<b>你自己的浏览器</b>里：清缓存、换浏览器、换设备数据就没了，忘记密码也没法找回。请在「我的」页<b>及时「下载备份」</b>，换设备时「导入备份」。</p>
      <h3>账号权重</h3><p>用得越久、做的娃娃越多、评得越多，权重越高。新账号的票更轻，限制也更严；权重高了放宽。</p>
      <h3>认领娃厂（付费，目前 200 元）</h3><p>娃厂想认领：在娃厂页点「🏷 我是这家的人，认领」，打赏站长后，把<b>用户名 + 娃厂名字 + 客服联系方式</b>发给站长，站长在管理台把你的账号和这家厂绑上。绑定后你的账号走到哪里（评论、论坛帖子、私信）都带「✔ 厂名（认证）」牌子，娃厂页显示官方客服，还能在「娃厂业务」区发帖。<b>认证是付费的，只代表站长确认过身份，不代表质量，也不影响评分和榜单排序。</b>认领后不能给自己的厂打分、评论、发 Repo / 避雷。平台不负责下单、付款、售后、纠纷等后续对接。</p>
      <h3>感谢榜</h3><p>打赏过站长的，经本人同意，名字会放进「我的」页的感谢榜。</p>
      <h3>数据在哪</h3><p>现在评分、评论、帖子都存在你自己的浏览器里，别人看不到，清掉浏览器数据就没了。联网同步上线后才会是大家共用的。</p>`);
    const dlg = $('#fcGuide'); dlg.querySelector('.fcX').onclick = () => dlg.close();
  }
  ['#fcHelp', '#fmHelp'].forEach(sel => { const b = $(sel); if (b) b.addEventListener('click', openGuide); });

  /* ============ 我的页：赞助 / 认证 + 感谢榜 ============ */
  function renderMineSponsor() {
    const box = $('#mineSponsor');
    if (box) box.innerHTML = `<h2>🤝 赞助与娃厂入驻</h2>
      <p class="mineTip">赞助 = 打赏站长，用来维护服务器和图纸。想让你的名字上感谢榜：打赏后告诉站长，经你同意就放上去。</p>
      <p class="mineTip"><b>娃厂想入驻</b>：打赏后加站长微信，发<b>赞助码 + 娃厂名字 + 客服联系方式</b>，站长确认后加「✔ 已入驻」，玩家点进娃厂就能直接联系客服。</p>
      <p class="mineTip"><b>娃厂认领认证：${esc(SPON.joinPrice || '200 元')}</b>（认证牌子跟着账号走；打赏时备注娃厂名字，再把用户名发给站长）。赞赏码：</p>
      <img src="donate.png?v=2" alt="站长赞赏码" class="mineDonate" onerror="this.style.display='none'">
      <p class="mineTip">站长微信：<b>${SPON.ownerWechat ? esc(SPON.ownerWechat) : '（站长还没公布，公布后会写在这里）'}</b></p>
      <p class="mineTip" style="color:var(--ink-soft)">入驻只代表有官方客服入口，不代表质量，也不影响评分和排序；平台不负责后续对接（下单、付款、售后、纠纷）。</p>`;
    const ul = $('#thanksList');
    if (ul) {
      ul.innerHTML = SPON.thanks.length ? SPON.thanks.map((t, i) => `<li><span class="fcRank">${i + 1}</span><b>${esc(t.name)}</b><small>${esc(t.note || '')}${t.date ? ' · ' + esc(t.date) : ''}</small></li>`).join('') : '<li class="fcEmpty">还没有人上榜。打赏站长、经你同意，名字就放在这里。</li>';
    }
    renderMineAccount();
    const strip = $('#fcThanks');
    if (strip) { strip.hidden = !SPON.thanks.length; strip.innerHTML = SPON.thanks.length ? `🌸 感谢：${SPON.thanks.map(t => esc(t.name)).join('、')}` : ''; }
  }

  /* ============ 公告 ============ */
  const BUILTIN_NOTICE = { title: '📢 社区公约', body: '大家都是为爱发电，不是客服。教程、经验、帖子的作者没有义务回复你：请不要反复私信、催更，不回你是正常的。请保持礼貌，先自己多探索（搜帖子、看说明书、动手试试），再提问。手作娘接单只能走闲鱼 / 淘宝等第三方平台；我们不是中介，小心上单被骗。' };
  function renderNotices() {
    const list = [BUILTIN_NOTICE, ...(SPON.notices || [])];
    const html = list.map(n => `<div class="fcNoticeItem"><b>${esc(n.title)}</b><span>${esc(n.body)}</span>${n.date ? `<small>${esc(n.date)}</small>` : ''}</div>`).join('');
    ['#fmNotice', '#fcNotice'].forEach(sel => { const el = $(sel); if (el) el.innerHTML = html; });
  }
  renderNotices();

  /* ============ 账号：登录 / 注册 / 备份 ============ */
  const LOCAL_WARN = '因为没钱租服务器，账号、作品、评分、帖子、私信暂时都只存在<b>你自己的浏览器</b>里：清缓存、换浏览器、换设备数据就没了，忘记密码也没法找回。请及时在「我的」页<b>下载备份</b>。登录只是区分这台浏览器上的账号，防不了别人用你的电脑。';
  function afterAuth(msg) {
    USER = A.current(localStorage); syncAccount();
    loadSpon(); renderFactory(); renderForum(); renderMineSponsor(); renderMine();
    if (msg) toast(msg);
  }
  function openLogin(tab) {
    if (!A) { toast('登录模块没加载出来。'); return; }
    let mode = tab || 'login';
    const dlg = dialogShell('loginDlg', `
      <header><h2>🔐 登录 / 注册</h2><button type="button" class="fcX" aria-label="关闭">✕</button></header>
      <div class="dmWarn"><b>⚠️ 先看这个：</b>${LOCAL_WARN}</div>
      <div class="fmTabs"><button type="button" data-lm="login">登录</button><button type="button" data-lm="reg">注册</button></div>
      <label class="fcField">用户名（2–16 字，汉字 / 字母 / 数字 / _ -）<input id="lgName" maxlength="16" autocomplete="username"></label>
      <label class="fcField">密码（8 位以上，要有字母和数字）<input id="lgPw" type="password" maxlength="64" autocomplete="current-password"></label>
      <p class="fcMsg" id="lgMsg"></p>
      <div class="fcRow"><button type="button" class="fcOk" id="lgGo">登录</button></div>
      <p class="fcAcct"><a href="#" id="lgAdminTool">我是站长：生成管理员口令</a></p>`);
    const paint = () => { dlg.querySelectorAll('[data-lm]').forEach(b => b.classList.toggle('on', b.dataset.lm === mode)); dlg.querySelector('#lgGo').textContent = mode === 'login' ? '登录' : '注册'; dlg.querySelector('#lgPw').autocomplete = mode === 'login' ? 'current-password' : 'new-password'; };
    dlg.querySelectorAll('[data-lm]').forEach(b => b.onclick = () => { mode = b.dataset.lm; paint(); });
    paint();
    dlg.querySelector('.fcX').onclick = () => dlg.close();
    dlg.querySelector('#lgGo').onclick = async () => {
      const m = dlg.querySelector('#lgMsg'), name = dlg.querySelector('#lgName').value, pw = dlg.querySelector('#lgPw').value;
      m.textContent = '处理中…'; m.className = 'fcMsg';
      try {
        const res = mode === 'login' ? await A.login(localStorage, name, pw, SPON._remote ? SPON._remote.admin : SPON.admin) : await A.register(localStorage, name, pw, store.account);
        if (!res.ok) { m.textContent = '✋ ' + res.reason; m.className = 'fcMsg bad'; return; }
        dlg.close(); afterAuth(mode === 'login' ? `欢迎回来，${res.user.name}${res.admin ? '（管理员）' : ''}` : `注册好了，${res.user.name}。记得及时下载备份。`);
      } catch (err) { m.textContent = '✋ ' + err.message; m.className = 'fcMsg bad'; }
    };
    dlg.querySelector('#lgAdminTool').onclick = (e) => { e.preventDefault(); openAdminTool(); };
  }
  function openAdminTool() {
    const dlg = dialogShell('adminTool', `
      <header><h2>🛠 生成管理员口令</h2><button type="button" class="fcX" aria-label="关闭">✕</button></header>
      <p class="fcNoteTxt">在这里输入你想用的<b>站长用户名和密码</b>，会生成一段配置（只含盐和哈希，不含密码）。把它贴进 <code>sponsors.json</code> 的 <code>"admin"</code> 字段、重新上线，然后用同样的用户名密码注册 / 登录，就能看到管理台。<b>密码要长要复杂</b>：哈希是公开文件，别人可以离线试密码。管理员只决定你自己浏览器里看不看得见管理台，真正的权限要等有服务器。</p>
      <label class="fcField">站长用户名<input id="atName" maxlength="16"></label>
      <label class="fcField">站长密码（8 位以上，字母 + 数字）<input id="atPw" type="password" maxlength="64"></label>
      <p class="fcMsg" id="atMsg"></p>
      <textarea id="atOut" rows="5" readonly style="width:100%;box-sizing:border-box" placeholder="生成的配置会出现在这里"></textarea>
      <div class="fcRow"><button type="button" class="fcOk" id="atGo">生成</button></div>`);
    dlg.querySelector('.fcX').onclick = () => dlg.close();
    dlg.querySelector('#atGo').onclick = async () => {
      const m = dlg.querySelector('#atMsg');
      const nv = A.validateName(dlg.querySelector('#atName').value); if (!nv.ok) { m.textContent = '✋ ' + nv.reason; m.className = 'fcMsg bad'; return; }
      const r = await A.makeAdmin(nv.clean, dlg.querySelector('#atPw').value);
      if (!r.ok) { m.textContent = '✋ ' + r.reason; m.className = 'fcMsg bad'; return; }
      m.textContent = ''; dlg.querySelector('#atOut').value = '"admin": ' + JSON.stringify(r.admin, null, 2);
    };
  }
  function download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function renderMineAccount() {
    const box = $('#mineAccount'); if (!box) return;
    const last = Number(localStorage.getItem('nunu-last-backup') || 0), days = last ? Math.floor((Date.now() - last) / 864e5) : null;
    const stale = days === null || days >= 7;
    box.innerHTML = `<h2>🔐 账号与备份</h2>
      <div class="dmWarn"><b>⚠️ 数据只在你的浏览器里：</b>${LOCAL_WARN}</div>
      ${USER
        ? `<p class="mineTip">已登录：<b>${esc(USER.name)}</b>${USER.isAdmin ? ' · <b>管理员</b>' : ''} · 账号权重：${esc(F.weightOf(accountNow()).name)}</p>
           <div class="mineAcctBtns"><button type="button" id="acLogout" class="fcMini">退出登录</button>${USER.isAdmin ? '<button type="button" id="acAdmin" class="fcMini">🛠 管理台</button>' : ''}</div>`
        : `<p class="mineTip">还没登录：登录后才能评分、评论、发帖、点赞、私信。</p><div class="mineAcctBtns"><button type="button" id="acLogin" class="fcMini">登录 / 注册</button></div>`}
      <p class="mineTip" style="${stale ? 'color:var(--red);font-weight:700' : ''}">${days === null ? '你还没下载过备份。' : '上次备份：' + (days === 0 ? '今天' : days + ' 天前') + '。'}${stale ? '建议现在就下载一份。' : ''}</p>
      <div class="mineAcctBtns"><button type="button" id="acBackup" class="fcMini">⬇ 下载备份</button><button type="button" id="acRestore" class="fcMini">⬆ 导入备份</button><input type="file" id="acFile" accept="application/json,.json" hidden></div>`;
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on('#acLogin', () => openLogin('login'));
    on('#acLogout', () => { A.logout(localStorage); afterAuth('已退出登录。'); });
    on('#acAdmin', openAdmin);
    on('#acBackup', () => { localStorage.setItem('nunu-last-backup', String(Date.now())); download(`努努备份-${F.dayKey(Date.now())}.json`, JSON.stringify(A.exportAll(localStorage))); renderMineAccount(); toast('备份下载好了，放在安全的地方。'); });
    on('#acRestore', () => $('#acFile').click());
    const f = $('#acFile');
    if (f) f.onchange = async () => {
      const file = f.files && f.files[0]; if (!file) return;
      try {
        const obj = JSON.parse(await file.text());
        if (!confirm('导入会覆盖这台浏览器里现有的账号、作品、评分、帖子。继续吗？（建议先下载一份当前的备份）')) return;
        const r = A.importAll(localStorage, obj);
        if (!r.ok) { toast('✋ ' + r.reason); return; }
        toast(`导入了 ${r.count} 项，页面即将刷新。`); setTimeout(() => location.reload(), 900);
      } catch { toast('✋ 这个文件读不出来。'); }
    };
  }

  /* ============ 管理台（只有管理员账号看得见）============
   * 改的是「草稿」：存在本机、立刻在你自己的浏览器里生效；点「导出 sponsors.json」下载，替换项目里的文件并上线，所有人才能看到。 */
  function openAdmin() {
    if (!USER || !USER.isAdmin) { toast('只有管理员能打开管理台。'); return; }
    const draft = () => { let d = null; try { d = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { /* 无草稿 */ } return d || { ownerWechat: SPON.ownerWechat || '', factories: JSON.parse(JSON.stringify(SPON.factories || [])), claims: JSON.parse(JSON.stringify(SPON.claims || [])), joined: JSON.parse(JSON.stringify(SPON.joined || [])), thanks: JSON.parse(JSON.stringify(SPON.thanks || [])), notices: JSON.parse(JSON.stringify(SPON.notices || [])) }; };
    let d = draft(); if (!d.factories) d.factories = []; if (!d.claims) d.claims = [];
    const commit = () => { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); applyDraft(); renderFactory(); renderMineSponsor(); renderNotices(); };
    const dlg = dialogShell('adminDlg', `
      <header><h2>🛠 管理台</h2><button type="button" class="fcX" aria-label="关闭">✕</button></header>
      <p class="fcNoteTxt">这里改的是<b>草稿</b>：存在本机、立刻在你的浏览器里生效。想让所有人看到：点最下面「导出 sponsors.json」，替换项目里 <code>public/games/nunu-studio/sponsors.json</code> 再上线。</p>
      <h3>站长微信（显示在「我的」页）</h3><input id="adWx" value="${esc(d.ownerWechat)}" maxlength="40" style="width:100%;box-sizing:border-box">
      <h3>批量添加娃厂（会出现在所有人的娃厂列表里）</h3>
      <p class="fcNoteTxt">每行一家，用 <code>|</code> 或 Tab 隔开（从 Excel 复制过来就是 Tab）：<br><code>名字 | 标签 | 擅长体型 | 其他平台账号 | 简介 | 客服</code><br>标签、擅长体型用逗号隔开；其他平台账号写成 <code>闲鱼:账号名;小红书:账号名</code>；客服填了就算「已入驻」。也可以直接粘 JSON 数组。</p>
      <textarea id="adBulk" rows="5" style="width:100%;box-sizing:border-box" placeholder="云朵朵工坊|做工细,发货快|2.5D,努努|闲鱼:yunduo;小红书:云朵朵|慢工出细活|客服 kf01"></textarea>
      <div class="adAdd"><button type="button" class="fcMini" id="adBulkGo">解析并加入</button><span id="adBulkMsg" class="fcMsg"></span></div>
      <h3>认领绑定（收了钱的：账号 ↔ 娃厂，账号到处带「✔ 认证」）</h3><ul class="adList" id="adClaims"></ul>
      <div class="adAdd"><input id="adCFac" list="adCFacList" placeholder="娃厂名字" maxlength="16"><datalist id="adCFacList">${[...new Set([...allFactories().map(x => x.name), ...d.factories.map(x => x.name)])].map(n => `<option value="${esc(n)}">`).join('')}</datalist><input id="adCUser" placeholder="对方的用户名" maxlength="16"><input id="adCSvc" placeholder="客服怎么联系（可空）" maxlength="40"><button type="button" class="fcMini" id="adCGo">绑定</button></div>
      <h3>站长录入的娃厂（<span id="adFacN">0</span>）</h3><ul class="adList" id="adFacs"></ul>
      <h3>入驻娃厂（有「✔ 已入驻」标记和官方客服）</h3><ul class="adList" id="adJoined"></ul>
      <div class="adAdd"><input id="adJName" placeholder="娃厂名字（要和上传时一致）" maxlength="16"><input id="adJSvc" placeholder="客服怎么联系" maxlength="40"><button type="button" class="fcMini" id="adJGo">加入驻</button></div>
      <h3>感谢榜（经本人同意再加）</h3><ul class="adList" id="adThanks"></ul>
      <div class="adAdd"><input id="adTName" placeholder="名字" maxlength="16"><input id="adTNote" placeholder="一句话" maxlength="30"><button type="button" class="fcMini" id="adTGo">加感谢</button></div>
      <h3>公告</h3><ul class="adList" id="adNotices"></ul>
      <div class="adAdd"><input id="adNTitle" placeholder="标题" maxlength="20"><input id="adNBody" placeholder="内容" maxlength="200"><button type="button" class="fcMini" id="adNGo">发公告</button></div>
      <div class="fcRow"><button type="button" class="fcOk" id="adExport">⬇ 导出 sponsors.json</button> <button type="button" class="fcMini" id="adReset">丢掉草稿</button></div>
      <p class="fcMsg" id="adMsg"></p>`);
    const list = (id, arr, text, key) => {
      const ul = dlg.querySelector(id); ul.innerHTML = arr.length ? '' : '<li class="fcEmpty">空的。</li>';
      arr.forEach((x, i) => { const li = document.createElement('li'); li.innerHTML = `<span>${esc(text(x))}</span><button type="button" class="fcMini">删</button>`; li.querySelector('button').onclick = () => { arr.splice(i, 1); commit(); paint(); }; ul.appendChild(li); });
    };
    const paint = () => {
      dlg.querySelector('#adFacN').textContent = d.factories.length;
      list('#adFacs', d.factories, x => `${x.name}｜${(x.specialties || []).join('、')}｜${(x.platforms || []).map(p => p.platform + ':' + p.account).join(';')}${x.service ? '｜✔ 客服 ' + x.service : ''}`);
      list('#adClaims', d.claims, x => `${x.factory}｜账号 ${x.user}${x.service ? '｜客服 ' + x.service : ''}`);
      list('#adJoined', d.joined, x => typeof x === 'string' ? x : `${x.name}｜${x.service || '（客服没填）'}`);
      list('#adThanks', d.thanks, x => `${x.name}｜${x.note || ''}`);
      list('#adNotices', d.notices, x => `${x.title}｜${x.body}`);
    };
    paint();
    dlg.querySelector('.fcX').onclick = () => dlg.close();
    dlg.querySelector('#adBulkGo').onclick = () => {
      const names = [...d.factories.map(x => x.name), ...allFactories().map(x => x.name)];
      const r = F.parseFactoryText(dlg.querySelector('#adBulk').value, names), m = dlg.querySelector('#adBulkMsg');
      d.factories.push(...r.list); if (r.list.length) { commit(); paint(); dlg.querySelector('#adBulk').value = ''; }
      m.textContent = `加入 ${r.list.length} 家${r.errors.length ? `；${r.errors.length} 条没加：${r.errors.slice(0, 4).join('；')}${r.errors.length > 4 ? '…' : ''}` : ''}`; m.className = 'fcMsg' + (r.errors.length ? ' bad' : '');
    };
    dlg.querySelector('#adCGo').onclick = () => {
      const fac = dlg.querySelector('#adCFac').value.trim(), user = dlg.querySelector('#adCUser').value.trim();
      if (!fac || !user) return;
      d.claims = d.claims.filter(c => c.factory !== fac);        // 一家厂只绑一个账号，重新绑定 = 换人
      d.claims.push({ factory: fac, user, service: dlg.querySelector('#adCSvc').value.trim(), date: F.dayKey(Date.now()) });
      dlg.querySelector('#adCFac').value = dlg.querySelector('#adCUser').value = dlg.querySelector('#adCSvc').value = ''; commit(); paint();
    };
    dlg.querySelector('#adWx').onchange = (e) => { d.ownerWechat = e.target.value.trim(); commit(); };
    dlg.querySelector('#adJGo').onclick = () => { const n = dlg.querySelector('#adJName').value.trim(); if (!n) return; d.joined.push({ name: n, service: dlg.querySelector('#adJSvc').value.trim() }); dlg.querySelector('#adJName').value = dlg.querySelector('#adJSvc').value = ''; commit(); paint(); };
    dlg.querySelector('#adTGo').onclick = () => { const n = dlg.querySelector('#adTName').value.trim(); if (!n) return; d.thanks.push({ name: n, note: dlg.querySelector('#adTNote').value.trim(), date: F.dayKey(Date.now()).slice(0, 7) }); dlg.querySelector('#adTName').value = dlg.querySelector('#adTNote').value = ''; commit(); paint(); };
    dlg.querySelector('#adNGo').onclick = () => { const t = dlg.querySelector('#adNTitle').value.trim(), b = dlg.querySelector('#adNBody').value.trim(); if (!t || !b) return; d.notices.push({ title: '📢 ' + t, body: b, date: F.dayKey(Date.now()) }); dlg.querySelector('#adNTitle').value = dlg.querySelector('#adNBody').value = ''; commit(); paint(); };
    dlg.querySelector('#adReset').onclick = () => { if (!confirm('丢掉本机草稿，回到线上的 sponsors.json？')) return; localStorage.removeItem(DRAFT_KEY); SPON = { ...SPON, ...(SPON._remote || {}) }; d = draft(); renderFactory(); renderMineSponsor(); renderNotices(); paint(); };
    dlg.querySelector('#adExport').onclick = () => {
      const out = { ownerWechat: d.ownerWechat, claims: d.claims, factories: d.factories, admin: (SPON._remote && SPON._remote.admin) || SPON.admin || null, joined: d.joined, thanks: d.thanks, notices: d.notices };
      if (!out.admin) delete out.admin;
      download('sponsors.json', JSON.stringify(out, null, 2));
      dlg.querySelector('#adMsg').textContent = '已下载。替换 public/games/nunu-studio/sponsors.json 再上线才对所有人生效。';
    };
  }

    loadSpon();

  /* ============ 我的 ============ */
  const PROJECTS_KEY = 'nunu-v4-design-projects';
  const CODE_KEY = 'nunu-sponsor-code';

  const readProjects = () => { try { const l = JSON.parse(localStorage.getItem(PROJECTS_KEY)); return Array.isArray(l) ? l : []; } catch { return []; } };
  const writeProjects = (l) => { try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(l)); } catch { /* 忽略 */ } };

  function sponsorCode() {
    let code = localStorage.getItem(CODE_KEY);
    if (!code) {
      const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
      code = `NUNU-${seg()}-${seg()}`;
      try { localStorage.setItem(CODE_KEY, code); } catch { /* 忽略 */ }
    }
    return code;
  }

  function renderMine() {
    /* -- 我的娃娃图纸 -- */
    const box = $('#mineProjects');
    if (box) {
      const list = readProjects();
      const curName = ($('#projectName') && $('#projectName').value) || '当前这只';
      box.innerHTML = '';
      const cur = document.createElement('div');
      cur.className = 'mineProj';
      cur.innerHTML = `<b>🧸 ${curName.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</b>
        <span class="mineProjMeta">正在做的这只 · 自动保存在浏览器</span>
        <div class="mineProjOps"><button type="button" data-open="current">继续做</button></div>`;
      cur.querySelector('[data-open]').addEventListener('click', () => setActive('make'));
      box.appendChild(cur);
      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'mineEmpty';
        empty.textContent = '还没有别的存档。在「制作娃娃」里点「新建作品」，旧的就会自动收进这里。';
        box.appendChild(empty);
      } else {
        list.forEach((p, i) => {
          const card = document.createElement('div');
          card.className = 'mineProj';
          card.innerHTML = `<b>🧸 ${String(p.name || '未命名').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</b>
            <span class="mineProjMeta">存档 ${i + 1}</span>
            <div class="mineProjOps">
              <button type="button" data-open="${p.id}">打开</button>
              <button type="button" data-del="${p.id}">删掉</button>
            </div>`;
          card.querySelector('[data-open]').addEventListener('click', () => {
            try {
              if (window.__nunu && window.__nunu.openProjectById) {
                window.__nunu.openProjectById(p.id);
                setActive('make');
              }
            } catch (err) { alert(err.message); }
          });
          card.querySelector('[data-del]').addEventListener('click', () => {
            if (!confirm(`删掉存档「${p.name}」？删了就找不回来了。`)) return;
            writeProjects(readProjects().filter(x => x.id !== p.id));
            renderMine();
          });
          box.appendChild(card);
        });
      }
    }

    /* -- 光荣榜 -- */
    const badges = $('#mineBadges');
    if (badges) {
      const projects = readProjects().length;
      const votes = myVoteCount();
      const designed = (() => { try { const s = JSON.parse(localStorage.getItem('nunu-v4')); const d = s && s.tplData['nunu-25d'] && s.tplData['nunu-25d'].design; return d ? d.objects.length : 0; } catch { return 0; } })();
      const all = [
        { ico: '🐣', name: '第一只努努', desc: '拥有 1 个存档', got: projects >= 1 },
        { ico: '🖌', name: '动手小能手', desc: '当前作品有 3 个以上部件', got: designed >= 3 },
        { ico: '🏭', name: '热心评委', desc: '给娃厂打过 1 次分', got: votes >= 1 },
        { ico: '🌟', name: '图纸收藏家', desc: '存下 3 只努努', got: projects >= 3 },
      ];
      badges.innerHTML = '';
      all.forEach(b => {
        const li = document.createElement('li');
        li.className = b.got ? '' : 'locked';
        li.innerHTML = `<span class="bIco">${b.ico}</span><span><b>${b.name}</b><small>${b.desc}${b.got ? ' · 已点亮' : ' · 未点亮'}</small></span>`;
        badges.appendChild(li);
      });
    }

    /* -- 赞助码 -- */
    const codeEl = $('#mineCode');
    if (codeEl) codeEl.textContent = sponsorCode();
  }

  const copyBtn = $('#mineCopy');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const code = sponsorCode();
    try { await navigator.clipboard.writeText(code); }
    catch {
      const ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
    }
    copyBtn.textContent = '已复制 ✓'; setTimeout(() => { copyBtn.textContent = '复制赞助码'; }, 1500);
  });

  /* 首屏 */
  setActive('make', true);
  window.__nunuNav = { setActive, renderFactory, renderMine, renderForum, renderMineSponsor, openLogin };
})();
