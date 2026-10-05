const CACHE_PREFIX = 'ximena-app-';
// Replaced automatically by build:web and by the publication workflow.
const APP_VERSION = '1209278b2217.eda6cfa29444';
const CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;
const APP_ASSETS = [
 '/', '/style.css', '/app-shell.css', '/ocean.js', '/archipelago.js', '/sound.js',
 '/island-vocabulary.js', '/games.js', '/platforms.js', '/app.js', '/pwa.js',
 '/blaster.html', '/manifest.webmanifest', '/favicon.ico', '/icons/island.svg',
 '/icons/apple-touch-icon.png', '/icons/icon-192.png', '/icons/icon-512.png',
 '/icons/icon-maskable-512.png'
];
const paths = new Set(APP_ASSETS);

self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE_NAME).then(cache =>
  cache.addAll(APP_ASSETS.map(path => new Request(path, {cache: 'reload'})))
 ));
 // The page offers the update only after every asset has downloaded.
});

self.addEventListener('message', event => {
 if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
 if (event.data?.type === 'GET_VERSION') event.source?.postMessage({type: 'APP_VERSION', version: APP_VERSION});
});

self.addEventListener('activate', event => {
 event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
  await self.clients.claim();
  const clients = await self.clients.matchAll({type: 'window'});
  for (const client of clients) client.postMessage({type: 'APP_VERSION', version: APP_VERSION});
 })());
});

async function loadAsset(request, path) {
 const cache = await caches.open(CACHE_NAME);
 const cached = await cache.match(path);
 // Keep one complete release until the player accepts the next one.
 if (cached) return cached;
 const response = await fetch(request, {cache: 'no-cache'});
 if (!response.ok) return response;
 try { await cache.put(path, response.clone()); } catch { /* Storage can be full. */ }
 return response;
}

self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if (event.request.method !== 'GET' || url.origin !== self.location.origin || !paths.has(url.pathname)) return;
 // Escribe has a new session query each visit; its HTML is always the same asset.
 event.respondWith(loadAsset(event.request, url.pathname));
});
