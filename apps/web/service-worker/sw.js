// Kaneo's offline shell. The build replaces the two placeholders below.
// Data comes from the app's own saved query cache, so this worker never
// touches API requests: it only keeps the page and its assets available.
const VERSION = "__KANEO_SW_VERSION__";
const ASSETS = __KANEO_SW_ASSETS__;
const CACHE = `kaneo-shell-${VERSION}`;
const SHELL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([SHELL, ...ASSETS]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("kaneo-shell-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/api") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
  } else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(staleWhileRevalidate(event, request));
  }
});

// Pages always try the network so deploys show at once; offline, every
// route gets the cached SPA shell.
async function networkFirstShell(request) {
  try {
    const response = await fetch(request);
    const type = response.headers.get("content-type") ?? "";
    if (response.ok && type.includes("text/html")) {
      const cache = await caches.open(CACHE);
      await cache.put(SHELL, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(SHELL);
    if (cached) return cached;
    throw error;
  }
}

// Asset names carry a content hash, but the Docker image rewrites runtime
// settings into them in place, so refresh each one in the background.
async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then((response) => {
    if (response.ok)
      return cache.put(request, response.clone()).then(() => response);
    return response;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => undefined));
    return cached;
  }
  return refresh;
}
