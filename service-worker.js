const CACHE_NAME = "guess-flags-v17";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./data/countries.json",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

function appUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

function cachedIndex() {
  return caches.match(appUrl("./index.html"), { ignoreSearch: true }).then((response) => {
    return response || caches.match(appUrl("./"), { ignoreSearch: true });
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        APP_FILES.map((path) => {
          return cache.add(appUrl(path)).catch(() => null);
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => cachedIndex())
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).catch(() => {
        return new Response("", {
          status: 504,
          statusText: "Offline"
        });
      });
    })
  );
});
