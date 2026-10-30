/* 账号密码登录（暂时全存在自己的浏览器里）+ 备份下载 / 导入 + 管理员口令校验
 *
 * 因为没钱租服务器，账号、密码（只存加盐后的哈希，不存明文）、作品、评分、帖子、私信暂时都存在你自己的浏览器 localStorage：
 *   · 清缓存 / 换浏览器 / 换设备 / 重装系统，数据就没了；忘记密码也没法找回（没有服务器可以找）；
 *   · 所以要「及时下载备份」，换设备时「导入备份」。
 *   · 浏览器里的登录只是「这台浏览器上的账号分开」，谁拿到这台电脑谁就能用，防不了别人；
 *   · 「管理员」同理：它只决定你自己的浏览器里能不能看见管理台，真正的权限要等有服务器。
 * 哈希用 PBKDF2-SHA256（10 万次）慢一点，别人拿到哈希也不容易试出密码。需要 https 或 localhost（crypto.subtle）。 */
(function (root) {
  'use strict';
  const USERS_KEY = 'nunu-users', ITER = 100000;
  const te = new TextEncoder();
  const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const rand = (n) => { const a = new Uint8Array(n); (root.crypto || crypto).getRandomValues(a); return hex(a); };
  const subtle = () => { const c = root.crypto || (typeof crypto !== 'undefined' ? crypto : null); return c && c.subtle; };

  async function derive(password, salt, iter = ITER) {
    const s = subtle(); if (!s) throw new Error('这个浏览器环境不支持加密（需要 https 或 localhost）。');
    const key = await s.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits']);
    return hex(await s.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: te.encode(salt), iterations: iter }, key, 256));
  }
  function validateName(name) {
    const n = String(name || '').trim();
    if (n.length < 2 || n.length > 16) return { ok: false, reason: '用户名要 2 到 16 个字。' };
    if (!/^[A-Za-z0-9_\-一-龥]+$/.test(n)) return { ok: false, reason: '用户名只能用汉字、字母、数字、下划线、减号。' };
    return { ok: true, clean: n };
  }
  function validatePassword(pw, name) {
    const p = String(pw || '');
    if (p.length < 8 || p.length > 64) return { ok: false, reason: '密码要 8 到 64 位。' };
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return { ok: false, reason: '密码要同时有字母和数字。' };
    if (name && p.toLowerCase().includes(String(name).toLowerCase())) return { ok: false, reason: '密码里不要包含用户名。' };
    return { ok: true };
  }

  function load(ls) { try { const d = JSON.parse(ls.getItem(USERS_KEY)); if (d && Array.isArray(d.users)) return d; } catch { /* 坏了就当没有 */ } return { users: [], session: null }; }
  function save(ls, db) { ls.setItem(USERS_KEY, JSON.stringify(db)); }

  /** 注册。adopt：第一个账号可以认领这台浏览器里已有的匿名数据（沿用它的 id / 注册时间） */
  async function register(ls, name, password, adopt) {
    const vn = validateName(name); if (!vn.ok) return vn;
    const vp = validatePassword(password, vn.clean); if (!vp.ok) return vp;
    const db = load(ls);
    if (db.users.some(u => u.name === vn.clean)) return { ok: false, reason: '这个用户名在这台浏览器上已经有了。' };
    const salt = rand(16), user = { id: db.users.length === 0 && adopt && adopt.id ? adopt.id : 'u-' + rand(5), name: vn.clean, salt, hash: await derive(password, salt), created: db.users.length === 0 && adopt && adopt.created ? adopt.created : Date.now() };
    db.users.push(user); db.session = { id: user.id, ts: Date.now(), admin: false }; save(ls, db);
    return { ok: true, user };
  }
  async function login(ls, name, password, adminCfg) {
    const db = load(ls), u = db.users.find(x => x.name === String(name || '').trim());
    if (!u || (await derive(password || '', u.salt)) !== u.hash) return { ok: false, reason: '用户名或密码不对。' };
    let admin = false;
    if (adminCfg && adminCfg.name === u.name && adminCfg.salt && adminCfg.hash) admin = (await derive(password, adminCfg.salt)) === adminCfg.hash;
    db.session = { id: u.id, ts: Date.now(), admin }; save(ls, db);
    return { ok: true, user: u, admin };
  }
  function logout(ls) { const db = load(ls); db.session = null; save(ls, db); }
  function current(ls) { const db = load(ls); if (!db.session) return null; const u = db.users.find(x => x.id === db.session.id); return u ? { id: u.id, name: u.name, created: u.created, isAdmin: !!db.session.admin } : null; }
  /** 生成管理员口令的配置（贴进 sponsors.json 的 "admin"）：用户名 + 盐 + 哈希，不含明文密码 */
  async function makeAdmin(name, password) {
    const vp = validatePassword(password, name); if (!vp.ok) return vp;
    const salt = rand(16); return { ok: true, admin: { name: String(name).trim(), salt, hash: await derive(password, salt) } };
  }

  /* ---------- 备份：所有 nunu 开头的存档打成一个 JSON ---------- */
  function exportAll(ls) {
    const data = {};
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith('nunu')) data[k] = ls.getItem(k); }
    return { app: 'nunu-studio', version: 1, time: new Date().toISOString(), data };
  }
  function importAll(ls, obj) {
    if (!obj || obj.app !== 'nunu-studio' || typeof obj.data !== 'object') return { ok: false, reason: '这不是努努工作台的备份文件。' };
    let n = 0; for (const [k, v] of Object.entries(obj.data)) if (k.startsWith('nunu') && typeof v === 'string') { ls.setItem(k, v); n++; }
    return { ok: true, count: n };
  }

  const api = { validateName, validatePassword, register, login, logout, current, makeAdmin, exportAll, importAll, derive };
  root.NunuAuth = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
