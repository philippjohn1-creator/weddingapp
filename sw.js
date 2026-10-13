/* Wedding – sw.js (Service Worker)
   Network-first für eigene Dateien und die Firebase-Bibliotheken, Fallback auf den Cache.
   Firestore und Authentication werden nicht abgefangen. Nicht-GET-Anfragen auch nicht. */
const CACHE_NAME = 'wedding-v1';
const DATEIEN = [
  './', './index.html', './style.css', './app.js', './cloud.js',
  './firebase-config.js', './manifest.json', './icon-180.png', './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Einzeln laden, damit eine fehlende Datei nicht alles verhindert
      return Promise.all(DATEIEN.map(function (d) { return cache.add(d).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.filter(function (n) { return n !== CACHE_NAME; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;                       // keine Nicht-GET-Anfragen

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  const eigene = url.origin === self.location.origin;
  const firebaseBibliothek = url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0;
  if (!eigene && !firebaseBibliothek) return;             // Firestore, Auth und alles andere durchlassen

  event.respondWith(
    fetch(req).then(function (antwort) {
      if (antwort && antwort.ok) {
        const kopie = antwort.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, kopie); }).catch(function () {});
      }
      return antwort;
    }).catch(function () {
      return caches.match(req).then(function (treffer) {
        if (treffer) return treffer;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
