const CACHE_NAME = "tx-manager-cache-v2";

self.addEventListener("install", (event) => {
    const appShellUrl = new URL("index.html", self.registration.scope).toString();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll([appShellUrl]))
    );

    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );

    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const requestUrl = new URL(event.request.url);
    const appOrigin = self.location.origin;

    if (requestUrl.origin !== appOrigin) {
        return;
    }

    if (event.request.mode === "navigate") {
        const appShellUrl = new URL("index.html", self.registration.scope).toString();

        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(async () => {
                    const cachedPage = await caches.match(event.request);
                    if (cachedPage) return cachedPage;

                    const shell = await caches.match(appShellUrl);
                    if (shell) return shell;

                    return new Response("Offline", {
                        status: 503,
                        headers: { "Content-Type": "text/plain" },
                    });
                })
        );

        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;

            return fetch(event.request)
                .then((response) => {
                    if (!response || response.status !== 200 || response.type !== "basic") {
                        return response;
                    }

                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });

                    return response;
                })
                .catch(() => caches.match(new URL("index.html", self.registration.scope).toString()));
        })
    );
});
