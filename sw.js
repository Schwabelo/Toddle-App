// Network-first service worker: always tries for fresh files, falls back to cache offline.
// Only same-origin requests are handled, so the Toddle feed is never cached.
// Bump VERSION whenever the file list changes; tests/build.test.mjs checks that every file is listed.
const VERSION = 2;
const CACHE = `study-hub-v${VERSION}`;
const SHELL = ['./', 'index.html', 'scheduler.html', 'styles.css', 'icon.svg', 'fonts/nunito-latin.woff2', 'js/alerts.js', 'js/app.js', 'js/calendar.js', 'js/cards.js', 'js/components.js', 'js/config.js', 'js/dialog.js', 'js/drawer.js', 'js/enrich.js', 'js/ics.js', 'js/pages.js', 'js/planlogic.js', 'js/planner.js', 'js/store.js', 'js/sync.js', 'js/textmatch.js', 'js/timer.js', 'js/timetable.js', 'js/todo.js', 'js/ttlogic.js', 'js/ui.js', 'js/urgency.js', 'js/util.js'];

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
