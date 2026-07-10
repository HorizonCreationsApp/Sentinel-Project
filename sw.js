/* ══════════════════════════════════════════════════════════════════════════
   Service Worker — Sentinel Project (version Online, GitHub Pages)
   Objectif : permettre le LANCEMENT HORS LIGNE de l'application.
   - Pré-cache le "shell" : la page de l'app + les bibliothèques + les polices + icônes.
   - Page de l'app : réseau d'abord (toujours la dernière version en ligne), cache en
     secours (hors ligne). → On garde la fraîcheur ET le hors-ligne.
   - Bibliothèques/polices/icônes : cache d'abord (rapide + hors-ligne).
   - Tuiles cartographiques (IGN/OSM…) : réseau uniquement, JAMAIS mises en cache
     (trop volumineuses et différentes à chaque vue).
   NB : incrémenter CACHE (v3, v4…) à chaque changement pour forcer la mise à jour.
   ══════════════════════════════════════════════════════════════════════════ */

const CACHE = 'sentinel-v6';
const BASE  = '/Sentinel-Project/';

// Le "shell" pré-chargé à l'installation (première visite EN LIGNE requise pour remplir le cache)
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

// Hôtes dont les ressources peuvent être mises en cache (libs + polices)
const CACHEABLE_HOSTS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // Une ressource qui échoue ne doit pas faire échouer toute l'installation
      Promise.allSettled(PRECACHE.map(u => c.add(u)))
    )
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

  // ── 1. Page de l'app → réseau d'abord, cache en secours ──
  const isAppPage =
    req.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname === BASE ||
    url.pathname === BASE.slice(0, -1);

  if (isAppPage) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          // IMPORTANT : chaque repli est tenté en SÉQUENCE (un objet Promise est toujours
          // "truthy", donc `r || caches.match(...)` ne retomberait JAMAIS sur le repli suivant
          // si on l'écrivait ainsi — bug corrigé ici). `ignoreSearch` tolère une éventuelle
          // query string ajoutée par le lanceur PWA. En tout dernier recours, on NE RENVOIE
          // JAMAIS `undefined` (provoquerait la page d'erreur NATIVE du navigateur) : une page
          // minimale explicite est servie à la place.
          const opts = { ignoreSearch: true };
          const direct = await caches.match(req, opts);
          if (direct) return direct;
          const indexMatch = await caches.match(BASE + 'index.html', opts);
          if (indexMatch) return indexMatch;
          const baseMatch = await caches.match(BASE, opts);
          if (baseMatch) return baseMatch;
          return new Response(
            '<!doctype html><meta charset="utf-8"><body style="background:#0f172a;color:#fff;' +
            'font-family:sans-serif;display:flex;align-items:center;justify-content:center;' +
            'height:100vh;margin:0;text-align:center;padding:20px"><p>Hors ligne — aucune ' +
            'version de l\'application n\'est encore en cache sur cet appareil.<br>Connectez-vous ' +
            'une première fois avec internet, puis réessayez.</p></body>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // ── 2. Tuiles & ressources externes non listées → réseau normal (pas de cache) ──
  const cacheable = (url.origin === self.location.origin) ||
                    CACHEABLE_HOSTS.indexOf(url.hostname) >= 0;
  if (!cacheable) return; // laisse le navigateur gérer (réseau) — tuiles hors ligne = vides

  // ── 3. Libs / polices / icônes → cache d'abord, réseau sinon (et on met en cache) ──
  e.respondWith(
    caches.match(req).then(cached =>
      cached ||
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached)
    )
  );
});
