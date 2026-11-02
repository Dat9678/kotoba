/* Kotoba Studio - cho phep dung khi khong co mang.
   Uu tien tai ban moi tu mang; chi khi mat mang moi dung ban da luu,
   nen cap nhat moi luon den ngay va khong bi ket ban cu. */
var CACHE = 'kotoba-202611022246';
var FILES = ['./', './index.html', './app.js', './style.css', './data/n3.js', './data/kanji.js', './data/n3-examples.js', './data/n3-ex-02.js', './data/n3-ex-03.js', './data/n3-ex-04.js', './data/n3-ex-05.js', './data/n3-ex-06.js', './data/n3-ex-07.js', './data/n3-ex-08.js', './data/n3-ex-09.js', './data/n3-ex-10.js', './data/n3-ex-11.js', './data/n3-ex5-01.js', './data/n3-ex5-02.js', './data/n3-ex5-03.js', './data/n3-ex5-04.js', './data/n3-ex5-05.js', './data/n2.js', './data/n1.js', './data/kanji-list.js', './data/kj-01.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).catch(function () {}));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('kotoba-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('./index.html'); });
    })
  );
});
