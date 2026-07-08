/* ══════════════════════════════════════════════════════════════════════════
   Service Worker — Sentinel Project (version Online, GitHub Pages)
   Objectif : permettre le LANCEMENT HORS LIGNE de l'application.
   - Pré-cache le "shell" : la page de l'app + les bibliothèques + les polices + icônes.
   - Page de l'app : réseau d'abord (toujours la dernière version en ligne), cache en
     secours (hors ligne).
   - Bibliothèques/polices/icônes : cache d'abord (rapide + hors-ligne).
   - Tuiles cartographiques (IGN/OSM…) : réseau uniquement, JAMAIS mises en cache.
   NB : incrémenter CACHE (v4, v5…) à chaque changement pour forcer la mise à jour.
   ══════════════════════════════════════════════════════════════════════════ */

const CACHE = 'sentinel-v3';
const BASE  = '/Sentinel-Project/';

const PRECACHE = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Turf.js/6.5.0/turf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

const CACHEABLE_HOSTS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  const isAppPage =
    req.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname === BASE ||
    url.pathname === BASE.slice(0, -1);

  if (isAppPage) {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); return res; })
        .catch(() => caches.match(req).then(r => r || caches.match(BASE + 'index.html') || caches.match(BASE)))
    );
    return;
  }

  const cacheable = (url.origin === self.location.origin) ||
                    CACHEABLE_HOSTS.indexOf(url.hostname) >= 0;
  if (!cacheable) return;

  e.respondWith(
    caches.match(req).then(cached =>
      cached ||
      fetch(req).then(res => { const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); return res; })
      .catch(() => cached)
    )
  );
});
