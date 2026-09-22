// Lamp offline support. Bump VERSION whenever you publish changes so phones pick them up.
const VERSION = "lamp-v2";
const CORE = ["./", "index.html", "privacy.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Show the saved copy right away, then refresh it in the background.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || e.request.headers.has("range")) return;   // let audio streaming go straight to the network
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return;
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: sameOrigin });
      const network = fetch(e.request)
        .then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
