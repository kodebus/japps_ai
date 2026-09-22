// Cleanup worker for japps.ai root.
// Lamp's service worker was briefly published at the site root by mistake.
// This replaces it: clears its cache, unregisters itself, and reloads open tabs.
// Safe to delete this file in a few weeks.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("lamp-")).map(k => caches.delete(k)));
    await self.registration.unregister();
    const tabs = await self.clients.matchAll({ type: "window" });
    tabs.forEach(t => t.navigate(t.url));
  })());
});
