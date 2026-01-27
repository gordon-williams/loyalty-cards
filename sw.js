// Service Worker for Loyalty Cards PWA
const CACHE_NAME = 'loyalty-cards-v2';

const CDN_ASSETS = [
    'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js',
    'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

// Install event - cache assets dynamically based on location
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching assets');
                // Get the service worker's location to build relative URLs
                const swUrl = new URL(self.location);
                const base = swUrl.href.replace(/sw\.js$/, '');

                const staticAssets = [
                    base,
                    base + 'index.html',
                    base + 'style.css',
                    base + 'app.js',
                    base + 'manifest.json'
                ];

                // Cache static assets
                return cache.addAll(staticAssets)
                    .then(() => {
                        // Then try to cache CDN assets (don't fail if these fail)
                        return Promise.allSettled(
                            CDN_ASSETS.map(url =>
                                fetch(url, { mode: 'cors' })
                                    .then(response => {
                                        if (response.ok) {
                                            return cache.put(url, response);
                                        }
                                    })
                                    .catch(() => console.log(`Failed to cache: ${url}`))
                            )
                        );
                    });
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('loyalty-cards-') && name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http(s) requests
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        // Try network first
        fetch(event.request)
            .then((response) => {
                // Don't cache if not a valid response
                if (!response || response.status !== 200) {
                    return response;
                }

                // Clone the response
                const responseToCache = response.clone();

                // Cache the fetched response
                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }

                        // If both cache and network fail, return fallback for HTML
                        if (event.request.headers.get('accept')?.includes('text/html')) {
                            // Try to match index.html from cache
                            return caches.match(new Request(self.location.href.replace(/sw\.js$/, 'index.html')));
                        }

                        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                    });
            })
    );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
