/* Versioned assets are reused; pages and vocabulary stay fresh. */
const VERSION = '2.5.0';
const PREFIX = 'bahasa-kitani-';
const CACHE = `${PREFIX}${VERSION}`;
const CORE = ['./', './index.html', './dictionary.html', './languages.html', './redirect.js', './styles.css', './core.js', './collections.js', './app.js', './enhancements.js', './data/tutong.js', './favicon.svg', './assets/bahasa-tutong-badge.svg', './manifest.webmanifest', './data/brunei.json', './data/dusun.json'];
const CORE_URLS = new Set(CORE.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE.map(path => new Request(path, {cache:'reload'})))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const canonical = new URL(url.pathname,self.location.origin).href;
  if (!CORE_URLS.has(canonical)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE), saved = await cache.match(canonical);
    const version = url.searchParams.get('v');
    const isData = url.pathname.includes('/data/');
    // A newer page must fetch its own assets, even while the previous worker controls a tab.
    const matchingAsset = version === VERSION && !isData && !url.pathname.endsWith('.html');
    if (matchingAsset && saved) return saved;
    let timer;
    const network = fetch(event.request,{cache:'no-cache'}).then(async response => {
      if (response.ok && response.type === 'basic' && (!version || version === VERSION || isData)) await cache.put(canonical,response.clone());
      return response;
    });
    // Complete a late refresh after returning the offline page on a slow connection.
    event.waitUntil(network.then(() => {}, () => {}));
    try {
      const response = event.request.mode === 'navigate' && saved ? await Promise.race([network,new Promise((_,reject) => {timer = setTimeout(() => reject(new Error('Navigation timeout')),3000);})]) : await network;
      return !response.ok && saved ? saved : response;
    } catch (error) {
      if (saved) return saved;
      if (event.request.mode === 'navigate') {
        const home = await cache.match(new URL('./index.html',self.registration.scope).href); if (home) return home;
      }
      throw error;
    } finally { clearTimeout(timer); }
  })());
});
