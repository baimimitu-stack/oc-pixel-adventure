const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/services/memory.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function setup() {
  const data = new Map();
  const context = { exports: {}, crypto: webcrypto, localStorage: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  } };
  vm.runInNewContext(code, context);
  return { ...context.exports, data, context };
}
const scope = { npc_id: 'world:1', oc_id: 'oc-a' };
const input = { role: 'player', kind: 'dialogue', content: '明天一起去看海。' };

test('NPC and OC relationships are isolated; permanent keeps the original transcript', () => {
  const { Memory } = setup();
  const entry = Memory.append(scope, input);
  assert.equal(Memory.get({ ...scope, npc_id: 'world:2' }).length, 0);
  assert.equal(Memory.get({ ...scope, oc_id: 'oc-b' }).length, 0);
  Memory.promote(scope, entry.id);
  assert.equal(Memory.get(scope).length, 1);
  assert.equal(Memory.get(scope)[0].content, input.content);
  assert.equal(Memory.get(scope)[0].id, entry.id);
  assert.match(Memory.buildContext(scope), /明天一起去看海/);
});

test('removal excludes prompts; repeated imports never resurrect a tombstone; restore is explicit', () => {
  const { Memory } = setup();
  const entry = Memory.append(scope, input);
  const backup = Memory.exportJsonl(scope);
  Memory.wipe(scope, entry.id);
  assert.equal(Memory.get(scope).length, 0);
  assert.equal(Memory.buildContext(scope), '');
  assert.equal(Memory.importJsonl(backup, scope).added, 0);
  assert.equal(Memory.get(scope).length, 0);
  assert.match(Memory.exportJsonl(scope), /明天一起去看海/);
  Memory.restore(scope, entry.id);
  assert.equal(Memory.get(scope).length, 1);
});

test('v1.2 diary and three tiers import to two tiers, preserve source and never invent spoken dialogue', () => {
  const { Memory } = setup();
  const rows = [
    { id: 'd1', created_at: '2026-09-18T00:00:00Z', content: '一起喝了花茶。', facts: [{ content: '喜欢花茶', importance: 4 }], mood_signal: '开心', source_events: ['evt1'] },
    { id: 's1', tier: 'short_term', content: '短期内容', muted: true },
    { id: 'l1', tier: 'long_term', content: '长期内容', source_diary_ids: ['d1'] },
    { id: 'p1', tier: 'permanent', content: '永久内容' },
    { id: 'a1', tier: 'permanent', content: '分析式自我定义', self_reference_type: 'analytical' },
  ];
  assert.equal(Memory.importJsonl(rows.map(JSON.stringify).join('\n'), scope).added, 5);
  const entries = Memory.get(scope, true);
  assert.equal(entries.filter(e => e.tier === 'permanent').length, 1);
  assert.ok(entries.every(e => e.kind === 'memory'));
  assert.equal(entries.find(e => e.id === 'd1').source.source_events[0], 'evt1');
  assert.equal(entries.find(e => e.id === 'd1').facts[0].importance, 4);
  assert.ok(!Memory.buildContext(scope).includes('短期内容'));
  assert.throws(() => Memory.promote(scope, 'a1'));
});

test('invalid JSONL is atomic; duplicates skip; exported transcript round-trips', () => {
  const { Memory, data } = setup();
  Memory.append(scope, input);
  const before = JSON.stringify([...data]);
  assert.throws(() => Memory.importJsonl('{"id":"new","content":"ok"}\nnot JSON', scope));
  assert.equal(JSON.stringify([...data]), before);
  assert.throws(() => Memory.importJsonl('{"id":"bad","content":"ok","created_at":"bad"}', scope));
  const exported = Memory.exportJsonl(scope);
  assert.equal(Memory.importJsonl(exported, scope).skipped, 1);
  const other = { ...scope, oc_id: 'oc-b' };
  assert.equal(Memory.importJsonl(exported, other).added, 1);
  assert.equal(Memory.get(other)[0].content, input.content);
});

test('only recent six plus permanent enter context; corruption and quota errors do not overwrite data', () => {
  const { Memory, MEMORY_KEY, data, context } = setup();
  for (let i = 0; i < 8; i++) Memory.append(scope, { ...input, content: `record-${i}` });
  const prompt = Memory.buildContext(scope);
  assert.ok(!prompt.includes('record-1'));
  assert.ok(prompt.includes('record-2') && prompt.includes('record-7'));
  const before = data.get(MEMORY_KEY);
  context.localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
  assert.throws(() => Memory.append(scope, input));
  assert.equal(data.get(MEMORY_KEY), before);
  data.set(MEMORY_KEY, '{broken');
  assert.throws(() => Memory.append(scope, input));
  assert.equal(data.get(MEMORY_KEY), '{broken');
});
