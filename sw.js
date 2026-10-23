// Network-first service worker: always tries for fresh files, falls back to cache offline.
// Only same-origin requests are handled, so the Toddle feed is never cached.
const CACHE = 'study-hub-v1';
const SHELL = ['./', 'index.html', 'scheduler.html', 'styles.css', 'icon.svg', 'js/app.js', 'js/config.js', 'js/ics.js', 'js/util.js', 'js/store.js', 'js/ui.js', 'js/sync.js', 'js/components.js', 'js/timer.js', 'js/cards.js', 'js/pages.js', 'js/planner.js', 'js/planlogic.js', 'js/textmatch.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
