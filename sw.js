/* Bump VERSION with each release that changes cached files. */
const VERSION = '2.1.0';
const PREFIX = 'bahasa-kitani-';
const CACHE = `${PREFIX}${VERSION}`;
const CORE = ['./', './index.html', './dictionary.html', './redirect.js', './styles.css', './core.js', './app.js', './data/tutong.js', './favicon.svg', './manifest.webmanifest'];
const CORE_URLS = new Set(CORE.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE.map(path => new Request(path, { cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const canonical = new URL(url.pathname, self.location.origin).href;
  if (!CORE_URLS.has(canonical)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request, { cache: 'no-cache' });
      if (response.ok && response.type === 'basic') await cache.put(canonical, response.clone());
      return response;
    } catch (error) {
      const saved = await cache.match(canonical);
      if (saved) return saved;
      if (event.request.mode === 'navigate') {
        const home = await cache.match(new URL('./index.html', self.registration.scope).href);
        if (home) return home;
      }
      throw error;
    }
  })());
});
