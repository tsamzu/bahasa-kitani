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
  assert.equal(numbers.length, 35); assert.equal(catalog.numbers.brunei.length, 0);
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

test('counting milestones keep their source and do not generate unattested combinations', () => {
  const numbers = catalog.numbers.dusun;
  for (const [number,word] of [[100,'Sa ratus'],[1000,'Sa ribu']]) {
    const entry = numbers.find(item => item.number === number);
    assert.equal(entry.word,word); assert.equal(entry.status,'source');
    assert.equal(entry.records[0].sourceUrl,'https://khazanahbahasasangjatidusun.blogspot.com/2013/05/perbandingan-bahasa-sjd-dengan-bahasa.html');
  }
  for (const number of [32,50,90,99,101,125,999]) assert(!numbers.some(item => item.number === number));
});
test('counting stages partition source records and pairs only use recorded neighbours', () => {
  const numbers = catalog.numbers.dusun, stages = C.countingStages(numbers);
  assert.deepEqual(plain(stages.map(stage => [stage.id,stage.entries.length])),[['basics',10],['building',23],['milestones',2]]);
  assert.deepEqual(plain(stages.flatMap(stage => stage.entries.map(entry => entry.number))),plain(numbers.map(entry => entry.number)));
  assert.deepEqual(plain(C.countingPairs(stages[1].entries).map(pair => pair.map(entry => entry.number))),[[20,21],[30,31],[40,41]]);
  assert.equal(C.countingStages([]).length,0);
});
test('short counting checks omit disputed eight while retaining checked nine and source milestones', () => {
  const pool = C.countingPracticePool(catalog.numbers.dusun);
  assert(!pool.some(entry => entry.number === 8));
  for (const number of [9,100,1000]) assert(pool.some(entry => entry.number === number));
  assert.equal(C.countingPracticePool(catalog.numbers.tutong).length,catalog.numbers.tutong.length);
});
