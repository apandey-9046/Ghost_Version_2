// service-worker.js

const CACHE_NAME = "ghost-ai-v1";
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
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

// Fetch: Serve from cache if offline
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
    );
});