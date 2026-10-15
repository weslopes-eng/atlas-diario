// Cache simples: funciona offline depois da primeira visita. Mude VERSION a cada deploy.
const VERSION = 'atlas-v2';
const ASSETS = ['./', 'index.html', 'style.css?v=2', 'i18n.js?v=2', 'app.js?v=2', 'data/countries.json?v=1', 'data/map.json?v=1', 'data/challenges.json?v=1', 'icons/favicon.svg', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // rede primeiro (para pegar atualizações), cache como reserva
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('index.html'))));
});
