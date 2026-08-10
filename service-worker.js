// Versioned app-shell cache. Change CACHE_VERSION whenever a shipped file changes.
const CACHE_VERSION = "ws-terms-v4";
const APP_SHELL = ["./", "index.html", "css/styles.css", "js/app.js", "js/db.js", "js/search.js", "js/ui.js", "js/terms-editor.js", "js/icons.js", "js/term-images.js", "js/sw-register.js", "data/terms.json", "manifest.json", "icons/icon-192.png", "icons/icon-512.png", "fonts/space-grotesk-var.woff2", "fonts/ibm-plex-sans-var.woff2", "fonts/ibm-plex-mono-400.woff2", "fonts/ibm-plex-mono-500.woff2"];
// Install atomically: first visit downloads the entire offline shell.
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())));
// Activate cleans prior versions so updates do not accumulate indefinitely.
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
// Cache-first gives hard reloads a zero-network app shell after first visit.
self.addEventListener("fetch", (event) => { if (event.request.method !== "GET") return; event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy)); return response; }))); });
