/* =====================================================================
   sw.js — PWA service worker (offline-first app shell)
   ---------------------------------------------------------------------
   • precaches the app shell (relative paths — subpath safe)
   • CACHE-FIRST for the whole shell → the app opens instantly, even on a very slow
     or missing network; a new release replaces the whole cache at once when
     VERSION is raised (never a mix of old and new files)
   • big, rarely used libraries (Excel) are NOT precached: they are loaded on first
     use (or quietly in the background) and then cached
   App DATA always lives in IndexedDB locally and syncs to Supabase —
   the service worker never touches user data.
   ===================================================================== */
'use strict';

/* bump VERSION on every release: it renames the caches, the old ones are deleted */
const VERSION = 'tdp-v11';
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
  './config.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      /* cache:'reload' → always the fresh file of this release (never an old HTTP-cache copy) */
      .then((c) => Promise.allSettled(APP_SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })))))
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

/* cache first, then network (and cache the answer) */
function cacheFirst(req, key) {
  return caches.match(key || req).then((hit) => {
    if (hit) return hit;
    return fetch(req).then((res) => {
      if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((c) => c.put(key || req, copy)).catch(() => {});
      }
      return res;
    });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // Supabase etc. never touched

  /* page navigations → the cached index.html at once (works offline; a paused or
     failing host can never replace the app with an error page) */
  if (req.mode === 'navigate') {
    e.respondWith(
      cacheFirst(new Request('./index.html'), './index.html')
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* everything else: cache first (precached shell, libraries, icons) */
  e.respondWith(cacheFirst(req).catch(() => Response.error()));
});
