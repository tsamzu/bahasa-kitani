import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
function harness({ offline = false, cached = new Map() } = {}) {
  const listeners = {}, removed = [], writes = [], installed = [], requests = [];
  const cache = { addAll: async requests => installed.push(...requests.map(request => request.url)), match: async key => cached.get(key), put: async (key, value) => writes.push([key, value]) };
  class BrowserRequest extends Request { constructor(input, options) { super(new URL(input, 'https://bahasa-kitani.xyz/'), options); } }
  const context = vm.createContext({ URL, setTimeout, clearTimeout, Request: BrowserRequest, self: { registration: { scope: 'https://bahasa-kitani.xyz/' }, location: { origin: 'https://bahasa-kitani.xyz' }, clients: { claim: async () => {} }, addEventListener: (type, listener) => listeners[type] = listener }, caches: { open: async () => cache, keys: async () => ['unrelated-app', 'bahasa-kitani-old', `bahasa-kitani-${version}`], delete: async key => removed.push(key) }, fetch: async request => { requests.push(request.url); if (offline) throw new Error('offline'); return { ok: true, type: 'basic', clone: () => 'network-body' }; } });
  vm.runInContext(source, context);
  async function request(url, mode = 'cors') {
    let pending;
    listeners.fetch({ request: { url, method: 'GET', mode }, respondWith: promise => pending = promise, waitUntil: promise => promise.catch(() => {}) });
    return pending;
  }
  return { listeners, removed, writes, installed, requests, request };
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

test('matching versioned assets reuse the installed response without a network request', async () => {
  const app = harness({cached:new Map([['https://bahasa-kitani.xyz/app.js','installed-js']])});
  assert.equal(await app.request(`https://bahasa-kitani.xyz/app.js?v=${version}`),'installed-js');
  assert.equal(app.requests.length,0);
});
test('an older worker fetches newer assets without overwriting its own offline version', async () => {
  const app = harness({cached:new Map([['https://bahasa-kitani.xyz/app.js','installed-js']])});
  assert.notEqual(await app.request('https://bahasa-kitani.xyz/app.js?v=next'),'installed-js');
  assert.equal(app.requests.length,1); assert.equal(app.writes.length,0);
});
test('vocabulary and pages revalidate even when cached, preserving current review content', async () => {
  const app = harness({cached:new Map([['https://bahasa-kitani.xyz/data/brunei.json','old-vocabulary'],['https://bahasa-kitani.xyz/index.html','old-page']])});
  await app.request('https://bahasa-kitani.xyz/data/brunei.json'); await app.request('https://bahasa-kitani.xyz/index.html','navigate');
  assert.equal(app.requests.length,2); assert.equal(app.writes.length,2);
});
