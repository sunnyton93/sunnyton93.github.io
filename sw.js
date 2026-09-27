const CACHE_PREFIX = 'ximena-app-';
const CACHE_NAME = `${CACHE_PREFIX}v4`;
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
 // Updates wait for open games to close; never force a reload during a round.
});

self.addEventListener('activate', event => {
 event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
  await self.clients.claim();
 })());
});

async function loadAsset(request, path) {
 const cache = await caches.open(CACHE_NAME);
 const cached = await cache.match(path);
 const controller = new AbortController();
 // On a failing Wi-Fi connection, use the installed copy promptly.
 const timeout = cached ? setTimeout(() => controller.abort(), 2500) : null;
 try {
  const response = await fetch(request, {cache: 'no-cache', signal: controller.signal});
  if (!response.ok) {
   if (cached) return cached;
   return response;
  }
  try { await cache.put(path, response.clone()); } catch { /* Storage can be full. */ }
  return response;
 } catch (error) {
  if (cached) return cached;
  throw error;
 } finally {
  if (timeout !== null) clearTimeout(timeout);
 }
}

self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if (event.request.method !== 'GET' || url.origin !== self.location.origin || !paths.has(url.pathname)) return;
 // Escribe has a new session query each visit; its HTML is always the same asset.
 event.respondWith(loadAsset(event.request, url.pathname));
});
