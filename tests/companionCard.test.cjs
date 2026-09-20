const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');
const path = require('node:path');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/companionCard.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function load() {
  const context = { exports: {}, crypto: webcrypto };
  vm.runInNewContext(code, context);
  return context.exports;
}

test('Tavern V3 without companion fills the 8 fields and exports .companion.json name', () => {
  const { parseCompanionCard, companionFileName, flattenToV3, summarizeCompanion, cardToOC } = load();
  const card = parseCompanionCard(JSON.stringify({
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: { name: '阿岚', description: '同楼邻居', personality: '温柔治愈', scenario: '住同一栋楼', first_mes: '晚上好。' },
  }));
  assert.equal(card.spec, 'chara_card_v3');
  assert.equal(card.data.extensions.companion.character.basic_info.name, '阿岚');
  assert.equal(companionFileName('阿岚'), '阿岚.companion.json');
  const oc = cardToOC(card);
  assert.equal(oc.personality, '温柔治愈');
  assert.equal(oc.catchphrase, '晚上好。');
  const flat = flattenToV3(card.data.extensions.companion.character);
  assert.equal(flat.name, '阿岚');
  assert.ok(!summarizeCompanion(oc).includes('不要出现的备注'));
});

test('notes stay out of prompt summary; flatten uses structured fields', () => {
  const { emptyCompanionCharacter, flattenToV3, toCompanionCard, summarizeCompanion, cardToOC } = load();
  const character = emptyCompanionCharacter({ name: '茶茶', identity: '柴犬剑客', personality: '热血勇者' });
  character.notes = '内部备忘，禁止注入';
  character.appearance.signature_features = ['左耳有星形贴纸'];
  character.three_faces.public = '见面就打招呼';
  const oc = cardToOC(toCompanionCard({
    id: 'oc-1', name: '茶茶', title: '剑客', personality: '热血勇者', bio: '简介', catchphrase: '汪！',
    avatarUrl: 'x', createdAt: 1, affection: 1, coinsCollected: 0, starsCollected: 0, unlockedAppearances: [], equippedCosmetics: {},
  }, character));
  const summary = summarizeCompanion(oc);
  assert.match(summary, /左耳有星形贴纸/);
  assert.doesNotMatch(summary, /内部备忘/);
  const flat = flattenToV3(character);
  assert.match(flat.description, /柴犬剑客/);
});

test('roster JSON is rejected; v2 upgrades to v3', () => {
  const { parseCompanionCard } = load();
  assert.throws(() => parseCompanionCard('[{"id":"oc-1","name":"a"}]'));
  const card = parseCompanionCard(JSON.stringify({ spec: 'chara_card_v2', data: { name: 'Vic' } }));
  assert.equal(card.spec, 'chara_card_v3');
  assert.match(card.data.extensions.companion.companion_id, /^urn:uuid:/);
});
