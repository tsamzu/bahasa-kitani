import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
for (const file of ['core.js', 'app.js', 'sw.js', 'redirect.js', 'admin/admin.js', 'data/tutong.js']) new vm.Script(read(file), { filename: file });
const html = read('index.html');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');
for (const match of html.matchAll(/\b(?:src|href)="([^"#]+)"/g)) {
  const value = match[1];
  if (/^(https?:|mailto:|data:)/.test(value)) continue;
  assert(existsSync(resolve(root, value.split(/[?#]/)[0])), `Missing asset: ${value}`);
}
for (const match of html.matchAll(/data-route="([^"]+)"/g)) assert(ids.includes(`view-${match[1]}`), `Missing route ${match[1]}`);
assert(!/interactive concept|vnext|current website|prototype/i.test(html), 'Remove prototype copy before publication');
assert.equal(read('CNAME').trim(), 'bahasa-kitani.xyz');
assert(existsSync(resolve(root, '.nojekyll')));
const manifest = JSON.parse(read('manifest.webmanifest'));
for (const icon of manifest.icons) assert(existsSync(resolve(root, icon.src)));
const context = vm.createContext({});
vm.runInContext(read('data/tutong.js') + ';globalThis.dataset={WORDS,PHRASES,NUMBERS};', context);
for (const key of ['WORDS', 'PHRASES']) {
  const entries = context.dataset[key];
  assert(entries.length > 0);
  assert.equal(entries.length, new Set(entries.map(entry => entry.id)).size, `Duplicate IDs in ${key}`);
  for (const entry of entries) for (const field of ['tutong', 'malay', 'english', 'cat']) assert.equal(typeof entry[field], 'string', `${key} ${entry.id} has invalid ${field}`);
}
assert.equal(context.dataset.NUMBERS.length, 30);
for (const path of ['admin/index.html', 'admin/feedback']) {
  for (const [index, match] of [...read(path).matchAll(/<script>([\s\S]*?)<\/script>/g)].entries()) new vm.Script(match[1], { filename: `${path} inline ${index}` });
}
console.log(`Site checks passed: ${context.dataset.WORDS.length} words, ${context.dataset.PHRASES.length} phrases, 30 numbers, ${ids.length} unique HTML IDs.`);
