// service-worker.js

const CACHE_NAME = "ghost-ai-v2.1.12"; // Update version to force refreshing the cache.

const urlsToCache = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./favicon.png",
    "./ghost!.jpg"
];

// Install: Cache core assets
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
    );
    self.skipWaiting(); 
});

// Activate: Clear old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim(); // new SW turant control le
});

// Fetch: Serve from cache, else network
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// Listen for SKIP_WAITING trigger (from front-end)
self.addEventListener("message", (event) => {
    if (event.data === "SKIP_WAITING") {
        self.skipWaiting();
    }
});