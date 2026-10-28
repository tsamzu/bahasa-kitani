import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../core.js', import.meta.url), 'utf8'), context);
vm.runInContext(readFileSync(new URL('../data/tutong.js', import.meta.url), 'utf8') + ';globalThis.dataset={WORDS,PHRASES};', context);
const { BK, dataset: { WORDS, PHRASES } } = context;

test('search works in all three languages and tolerates apostrophe variants', () => {
  assert(BK.searchWords(WORDS, { query: 'water' }).some(word => word.tutong === 'Empa / Eppa'));
  assert(BK.searchWords(WORDS, { query: 'Kucing' }).some(word => word.english === 'Cat'));
  assert(BK.searchWords(WORDS, { query: 'Terimo Kasi' }).some(word => word.english === 'Thank You'));
  assert.equal(BK.normalize('  Pi’on  '), BK.normalize("Pi'on"));
  assert.equal(BK.searchWords(WORDS, { query: 'qzx-unknown' }).length, 0);
});
test('category and saved filters combine, and sorting leaves source data unchanged', () => {
  const before = WORDS.map(word => word.id).join(',');
  const saved = new Set([26, 159]);
  const results = BK.searchWords(WORDS, { savedOnly: true, saved, category: 'Animals' });
  assert.equal(results.length, 1); assert.equal(results[0].english, 'Cat');
  const sorted = BK.searchWords(WORDS, { sort: 'az' });
  assert(sorted.every((word, index) => !index || sorted[index - 1].tutong.localeCompare(word.tutong) <= 0));
  assert.equal(WORDS.map(word => word.id).join(','), before);
});
test('quiz choices contain exactly one correct answer and distinct meanings', () => {
  const source = WORDS.filter(word => word.english && !word.english.includes('/'));
  for (const word of source) {
    const choices = BK.choicesFor(word, source);
    assert.equal(choices.length, 4);
    assert.equal(choices.filter(choice => choice.id === word.id).length, 1);
    assert.equal(new Set(choices.map(choice => BK.normalize(choice.english))).size, 4);
    assert.equal(choices.filter(choice => BK.normalize(choice.tutong) === BK.normalize(word.tutong)).length, 1);
  }
});
test('streak handles month/year boundaries, duplicate visits, and missed days', () => {
  const now = new Date(2026, 0, 2, 9);
  assert.equal(BK.streak(['2025-12-31', '2026-01-01', '2026-01-02', '2026-01-02'], now), 3);
  assert.equal(BK.streak(['2025-12-31', '2026-01-01'], now), 2);
  assert.equal(BK.streak(['2025-12-31'], now), 0);
  assert.equal(BK.streak(['2027-01-01'], now), 0);
  assert.equal(BK.dateForKey('2026-02-30'), null);
  assert.equal(BK.dayKey(new Date(2026, 9, 28, 0, 2)), '2026-10-28');
});
test('saved progress survives storage failures, invalid JSON and invalid shapes', () => {
  const denied = BK.storage(() => { throw new Error('blocked'); });
  assert.equal(denied.read('key', 'fallback'), 'fallback'); assert.equal(denied.write('key', []), false);
  const values = new Map([['bad', '{broken'], ['shape', '{}']]);
  const good = BK.storage(() => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }));
  assert.equal(good.read('bad', 'fallback'), 'fallback');
  assert.equal(good.read('shape', 'fallback', Array.isArray), 'fallback');
  assert(good.write('saved', [26])); assert.equal(good.read('saved', [], Array.isArray)[0], 26);
});
test('admin IDs follow the actual corpus and preserve higher reserved counters', () => {
  const nextWordId = Math.max(...WORDS.map(word => word.id)) + 1;
  const nextPhraseId = Math.max(...PHRASES.map(phrase => phrase.id)) + 1;
  assert.equal(BK.nextEntryId(WORDS, nextWordId - 4), nextWordId);
  assert.equal(BK.nextEntryId(PHRASES, 0), nextPhraseId);
  assert.equal(BK.nextEntryId(WORDS, nextWordId + 50), nextWordId + 50);
  assert.equal(BK.nextEntryId(WORDS, NaN), nextWordId);
});
