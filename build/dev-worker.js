self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        return;
    }
    const match = pathname.match(/^\/(?:npm\/)?@raruto\/leaflet-elevation(?:@[^/]+)?(\/.*)?$/);
    if (!match) return;

    const local = new URL(self.location.origin);
    local.pathname = match[1] || '/dist/leaflet-elevation.min.js';
    local.search = url.search;
    event.respondWith(fetch(new Request(local, event.request)));
});
