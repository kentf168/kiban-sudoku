// Bump this on every deploy that changes app.js / styles.css / index.html.
// Changing this string is what makes the browser notice the service worker
// itself changed, install the new one, and drop old cached files.
const CACHE = "kiban-sudoku-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: always try to fetch the live version first (so a fresh
// deploy shows up immediately), and only fall back to the cache when
// there's no network (real offline play).
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).then((response) => {
      if (event.request.method === "GET" && response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
