import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
function harness({ offline = false, cached = new Map() } = {}) {
  const listeners = {}, removed = [], writes = [], installed = [];
  const cache = { addAll: async requests => installed.push(...requests.map(request => request.url)), match: async key => cached.get(key), put: async (key, value) => writes.push([key, value]) };
  class BrowserRequest extends Request { constructor(input, options) { super(new URL(input, 'https://bahasa-kitani.xyz/'), options); } }
  const context = vm.createContext({ URL, Request: BrowserRequest, self: { registration: { scope: 'https://bahasa-kitani.xyz/' }, location: { origin: 'https://bahasa-kitani.xyz' }, clients: { claim: async () => {} }, addEventListener: (type, listener) => listeners[type] = listener }, caches: { open: async () => cache, keys: async () => ['unrelated-app', 'bahasa-kitani-old', `bahasa-kitani-${version}`], delete: async key => removed.push(key) }, fetch: async () => { if (offline) throw new Error('offline'); return { ok: true, type: 'basic', clone: () => 'network-body' }; } });
  vm.runInContext(source, context);
  async function request(url, mode = 'cors') {
    let pending;
    listeners.fetch({ request: { url, method: 'GET', mode }, respondWith: promise => pending = promise });
    return pending;
  }
  return { listeners, removed, writes, installed, request };
}
test('offline installation includes the dependencies of home and legacy dictionary pages', async () => {
  const app = harness();
  let installation;
  app.listeners.install({ waitUntil: promise => installation = promise });
  await installation;
  for (const page of ['index.html', 'dictionary.html']) {
    const html = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
    for (const tag of html.matchAll(/<(script|link)\b[^>]*>/g)) {
      if (tag[1] === 'link' && !/\brel="(?:stylesheet|icon|manifest)"/.test(tag[0])) continue;
      const source = tag[0].match(/\b(?:src|href)="([^"]+)"/);
      if (!source) continue;
      const dependency = new URL(source[1], 'https://bahasa-kitani.xyz/');
      if (dependency.origin !== 'https://bahasa-kitani.xyz') continue;
      dependency.search = '';
      assert(app.installed.includes(dependency.href), `${page} needs ${dependency.pathname} offline`);
    }
  }
});
test('offline assets use their matching cached response', async () => {
  const app = harness({ offline: true, cached: new Map([['https://bahasa-kitani.xyz/app.js', 'cached-js']]) });
  assert.equal(await app.request('https://bahasa-kitani.xyz/app.js?v=2.0.2'), 'cached-js');
});
test('a missing script is never replaced with HTML', async () => {
  const app = harness({ offline: true, cached: new Map([['https://bahasa-kitani.xyz/index.html', 'home-html']]) });
  await assert.rejects(app.request('https://bahasa-kitani.xyz/core.js'), /offline/);
});
test('third-party resources and admin pages are outside the offline cache', async () => {
  const app = harness();
  assert.equal(await app.request('https://example.com/app.js'), undefined);
  assert.equal(await app.request('https://bahasa-kitani.xyz/admin/index.html'), undefined);
});
test('online requests refresh cached files and cleanup touches only this app', async () => {
  const app = harness(); await app.request('https://bahasa-kitani.xyz/app.js');
  assert.equal(app.writes[0][0], 'https://bahasa-kitani.xyz/app.js');
  let activation; app.listeners.activate({ waitUntil: promise => activation = promise }); await activation;
  assert.deepEqual(app.removed, ['bahasa-kitani-old']);
});
