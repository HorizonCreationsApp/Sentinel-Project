const CACHE = 'sentinel-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Ne jamais mettre en cache index.html — toujours récupérer la dernière version
  if(e.request.url.includes('index.html') || 
     e.request.url.endsWith('/Sentinel-Project/') ||
     e.request.url.endsWith('/Sentinel-Project')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Pour le reste : réseau d'abord, cache en fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
