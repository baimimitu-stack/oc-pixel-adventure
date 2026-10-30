/* 账号密码（本机）：注册 / 登录 / 管理员口令 / 备份导入 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const ctx = { console, TextEncoder, crypto: globalThis.crypto }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/games/nunu-studio/nunu-auth.js'), 'utf8'), ctx);
const A = ctx.NunuAuth;
const mkLS = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i], get length() { return m.size; } }; };

test('用户名 / 密码规则', () => {
  assert.equal(A.validateName('a').ok, false);
  assert.equal(A.validateName('有空 格').ok, false);
  assert.equal(A.validateName('努努小能手').ok, true);
  assert.equal(A.validatePassword('short1').ok, false);
  assert.equal(A.validatePassword('onlyletters').ok, false);
  assert.equal(A.validatePassword('12345678').ok, false);
  assert.equal(A.validatePassword('努努abc12345', '努努').ok, false, '密码里含用户名');
  assert.equal(A.validatePassword('goodpass123').ok, true);
});

test('注册 → 退出 → 登录；密码不存明文；第一个账号认领匿名数据；重名拒绝；错密码拒绝', async () => {
  const ls = mkLS();
  const r = await A.register(ls, '小明', 'goodpass123', { id: 'u-anon', created: 1234 });
  assert.equal(r.ok, true);
  assert.equal(r.user.id, 'u-anon'); assert.equal(r.user.created, 1234);
  assert.ok(!ls.getItem('nunu-users').includes('goodpass123'), '没有明文密码');
  assert.equal(A.current(ls).name, '小明');
  A.logout(ls); assert.equal(A.current(ls), null);
  assert.equal((await A.login(ls, '小明', 'wrongpass999')).ok, false);
  assert.equal((await A.login(ls, '小明', 'goodpass123')).ok, true);
  assert.equal(A.current(ls).isAdmin, false);
  assert.equal((await A.register(ls, '小明', 'another123pw')).ok, false, '重名');
  const second = await A.register(ls, '小红', 'goodpass123', { id: 'u-anon', created: 1 });
  assert.notEqual(second.user.id, 'u-anon', '第二个账号不能再认领');
});

test('管理员口令：用户名和密码都对才算管理员，别人登录不是', async () => {
  const ls = mkLS();
  const made = await A.makeAdmin('站长', 'adminpass123');
  assert.equal(made.ok, true);
  assert.ok(!JSON.stringify(made.admin).includes('adminpass123'));
  await A.register(ls, '站长', 'adminpass123'); A.logout(ls);
  assert.equal((await A.login(ls, '站长', 'adminpass123', made.admin)).admin, true);
  assert.equal(A.current(ls).isAdmin, true);
  await A.register(ls, '路人', 'strangerpw123'); A.logout(ls);
  assert.equal((await A.login(ls, '路人', 'strangerpw123', made.admin)).admin, false);
  // 同名但密码不同的「站长」也不是
  const ls2 = mkLS(); await A.register(ls2, '站长', 'otherpass123'); A.logout(ls2);
  assert.equal((await A.login(ls2, '站长', 'otherpass123', made.admin)).admin, false);
});

test('备份：导出所有 nunu 存档，导入后原样回来；不是备份文件会拒绝', () => {
  const a = mkLS(); a.setItem('nunu-v4', '{"x":1}'); a.setItem('nunu-factory-v2', '{"y":2}'); a.setItem('other', 'zzz');
  const bk = A.exportAll(a);
  assert.deepEqual(Object.keys(bk.data).sort(), ['nunu-factory-v2', 'nunu-v4']);
  const b = mkLS(); assert.equal(A.importAll(b, bk).count, 2);
  assert.equal(b.getItem('nunu-v4'), '{"x":1}');
  assert.equal(A.importAll(b, { foo: 1 }).ok, false);
});
