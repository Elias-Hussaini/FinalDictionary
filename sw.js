const CACHE_NAME = 'my-cache-v1';
const urlsToCache = [
  '/',
  './index.html',
  './manifest.json',
  './icon-512.png',
  // اینجا می‌تونی فایل‌های CSS یا JS سایتت رو هم اضافه کنی
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => {
          return cacheName !== CACHE_NAME;
        }).map((cacheName) => caches.delete(cacheName))
      );
    })
  );
});
