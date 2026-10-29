import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = vm.createContext({ AbortController, setTimeout, clearTimeout });
vm.runInContext(read('core.js'), context); vm.runInContext(read('collections.js'), context);
vm.runInContext(read('data/tutong.js') + ';globalThis.input={words:WORDS,phrases:PHRASES,numbers:NUMBERS};', context);
const brunei = JSON.parse(read('data/brunei.json')), dusun = JSON.parse(read('data/dusun.json'));
const { BKCollections: C, BK } = context;
const data = { ...context.input, brunei, dusun }, catalog = C.build(data);
const plain = x => JSON.parse(JSON.stringify(x));
test('main dictionary includes each source record once without changing Tutong IDs or source data', () => {
  assert.equal(catalog.words.length, data.words.length + brunei.length + dusun.length);
  assert.equal(new Set(catalog.words.map(word => word.id)).size, catalog.words.length);
  for (const word of data.words) assert.equal(catalog.words.find(entry => entry.sourceId === 'tutong-' + word.id).id, word.id);
  assert.equal(brunei[0].id, 'brunei-001'); assert.equal(dusun[0].id, 'dusun-001');
  assert.deepEqual(new Set(catalog.words.slice(0, 3).map(word => word.language)), new Set(['tutong', 'brunei', 'dusun']));
});
test('language filters search headwords, meanings and notes only within the selected collection', () => {
  const pool = C.select(catalog.words, 'dusun'), found = BK.findWords(pool, { query: 'Abuk', fuzzy: false });
  assert(found.results.length > 0); assert(found.results.every(word => word.language === 'dusun'));
  assert(BK.findWords(pool, { query: 'hair', language: 'english', fuzzy: false }).results.some(word => word.tutong === 'Abuk'));
  assert.equal(BK.findWords(C.select(catalog.words, 'brunei'), { query: 'Salamat Sambut', fuzzy: false }).results.length, 0);
});
test('saved IDs survive dataset reordering and a progress backup round trip across all languages', () => {
  const reversed = C.build({ ...data, brunei: [...brunei].reverse(), dusun: [...dusun].reverse() });
  for (const entry of catalog.words) assert.equal(reversed.words.find(word => word.sourceId === entry.sourceId).id, entry.id);
  const saved = ['tutong-159', 'brunei-053', 'dusun-web-074'].map(id => catalog.words.find(word => word.sourceId === id).id);
  const progress = { saved, learned: [159], days: ['2026-10-29'], lessonIndex: 0, theme: 'day' };
  const parsed = BK.parseProgressBackup(JSON.stringify(BK.createProgressBackup(progress)));
  const restored = BK.restoreProgress(progress, parsed.data, { validIds: new Set(catalog.words.map(word => word.id)), mode: 'replace' });
  assert.deepEqual(plain(restored.data.saved), saved); assert.equal(restored.missing, 0);
});
test('phrasebook reuses recorded phrases and greetings without treating number phrases as conversation', () => {
  const br = C.select(catalog.phrases, 'brunei'), du = C.select(catalog.phrases, 'dusun');
  assert.deepEqual(plain(br.map(word => word.sourceId)).sort(), ['brunei-053', 'brunei-144']);
  assert.equal(du.length, 14); assert(du.every(word => word.cat === 'Greetings'));
  assert.equal(C.select(catalog.phrases, 'tutong').length, data.phrases.length);
});
test('counting preserves recorded alternatives, checked nine and the uncertainty for eight', () => {
  const numbers = catalog.numbers.dusun;
  assert.equal(numbers.length, 33); assert.equal(catalog.numbers.brunei.length, 0);
  assert.equal(numbers.find(entry => entry.number === 1).word, 'Sa / Miso');
  assert.equal(numbers.find(entry => entry.number === 6).word, 'Anom / Anaom');
  const nine = numbers.find(entry => entry.number === 9);
  assert.equal(nine.word, "Siam / Walu'"); assert.equal(nine.status, 'reviewed');
  assert.equal(numbers.find(entry => entry.number === 8).status, 'needs_review');
  assert.equal(catalog.numbers.tutong.length, data.numbers.length);
});
test('duplicate source IDs are rejected before saved words could point at a different record', () => {
  assert.throws(() => C.build({ ...data, brunei: [brunei[0], brunei[0]] }), /Duplicate/);
});
test('a failed collection does not prevent the other collection from loading', async () => {
  let calls = 0;
  const partial = vm.createContext({ AbortController, setTimeout, clearTimeout, fetch: async url => {
    calls++; if (url.includes('brunei')) throw new Error('Offline'); return { ok: true, json: async () => dusun };
  } });
  vm.runInContext(read('collections.js'), partial);
  const [first, second] = await Promise.all([partial.BKCollections.load(), partial.BKCollections.load()]);
  assert.equal(calls, 2); assert.equal(first, second); assert.deepEqual(plain(first.failed), ['brunei']); assert.equal(first.dusun.length, dusun.length);
});
