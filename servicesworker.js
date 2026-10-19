
const CACHE_NAME = "pokedex-pwa-v2";

const urlsToCache = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/style.css",
    "./javascript/app.js",
    "./javascript/detalle.html",
    "./javascript/detalle.js"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(cacheName => cacheName.startsWith("pokedex-pwa-") &&
                        cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    const requestURL = new URL(request.url);
    const isSameOrigin = requestURL.origin === self.location.origin;
    const isHTML =
        request.mode === "navigate" ||
        request.destination === "document" ||
        requestURL.pathname.endsWith(".html");

    // Páginas y peticiones a PokéAPI: primero intenta la red.
    if (isHTML || requestURL.hostname === "pokeapi.co") {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const responseCopy = response.clone();

                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseCopy);
                        });
                    }

                    return response;
                })
                .catch(async () => {
                    const cachedResponse = await caches.match(request);

                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    if (isHTML && isSameOrigin) {
                        const path = requestURL.pathname;

                        if (path.endsWith("/detalle.html")) {
                            const detailPage = await caches.match(
                                "./javascript/detalle.html"
                            );

                            if (detailPage) {
                                return detailPage;
                            }
                        }

                        const homePage = await caches.match("./index.html");

                        if (homePage) {
                            return homePage;
                        }
                    }

                    return new Response(
                        "No hay conexión y este recurso no está disponible sin conexión.",
                        {
                            status: 503,
                            statusText: "Sin conexión",
                            headers: {
                                "Content-Type": "text/plain; charset=utf-8"
                            }
                        }
                    );
                })
        );

        return;
    }

    // Recursos estáticos: primero caché y después red.
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request).then(response => {
                    if (response.ok && isSameOrigin) {
                        const responseCopy = response.clone();

                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseCopy);
                        });
                    }

                    return response;
                });
            })
    );
});
