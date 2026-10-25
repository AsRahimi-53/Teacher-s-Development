/* =====================================================================
   sw.js — PWA service worker (offline-first app shell)
   ---------------------------------------------------------------------
   • precaches the full app shell (relative paths — subpath safe)
   • navigations: network-first, fall back to cached index (offline)
   • everything else: cache-first, then network, cache the result
   App DATA always lives in IndexedDB locally and syncs to Supabase —
   the service worker never touches user data.
   ===================================================================== */
'use strict';

/* bump VERSION on every release: it renames the caches, the old ones are deleted */
const VERSION = 'tdp-v9';
const SHELL_CACHE = VERSION + '-shell';
const RUNTIME_CACHE = VERSION + '-runtime';
const NET_TIMEOUT = 4000;   // ms — on a slow network fall back to the cached copy

/* relative to the service worker scope */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/responsive.css',
  './css/print.css',
  './css/mobile.css',
  './js/mobile.js',
  './js/utils.js',
  './js/database.js',
  './js/translations.js',
  './js/jalali.js',
  './lib/jalaali.js',
  './js/cloud.js',
  './js/sync.js',
  './js/settings.js',
  './js/ui.js',
  './js/navigation.js',
  './js/auth.js',
  './js/moduleEngine.js',
  './js/print.js',
  './js/export.js',
  './js/members.js',
  './js/schools.js',
  './js/employees.js',
  './js/teachers.js',
  './js/studentStatistics.js',
  './js/tashkil.js',
  './js/observations.js',
  './js/observationReports.js',
  './js/annualPlan.js',
  './js/monthlyPlan.js',
  './js/duties.js',
  './js/activities.js',
  './js/professionalDevelopment.js',
  './js/monitoring.js',
  './js/reportGenerator.js',
  './js/admin.js',
  './js/dashboard.js',
  './js/reports.js',
  './js/statistics.js',
  './js/backup.js',
  './js/app.js',
  './lib/supabase.js',
  './lib/xlsx.full.min.js',
  './config.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => Promise.allSettled(APP_SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.indexOf(VERSION) !== 0).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

/* network first (fresh code reaches users) with a timeout, cache as fallback */
function networkFirst(req, cacheName, timeout) {
  return new Promise((resolve) => {
    let done = false;
    const fromCache = () => caches.match(req).then((hit) => hit || caches.match('./index.html'));
    const timer = setTimeout(() => {
      if (done) return;
      caches.match(req).then((hit) => { if (hit && !done) { done = true; resolve(hit); } });
    }, timeout);
    fetch(req).then((res) => {
      clearTimeout(timer);
      if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(req, copy)).catch(() => {});
      }
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      if (!done) { done = true; fromCache().then((hit) => resolve(hit || Response.error())); }
    });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // Supabase etc. never touched

  /* 1) page navigations → network first, offline fallback to the cached shell */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* 2) big, rarely changing libraries and icons → cache first */
  if (url.pathname.indexOf('/lib/') >= 0 || url.pathname.indexOf('/icons/') >= 0) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }))
    );
    return;
  }

  /* 3) app code (js / css / json) → network first so updates arrive at once */
  e.respondWith(networkFirst(req, SHELL_CACHE, NET_TIMEOUT));
});
