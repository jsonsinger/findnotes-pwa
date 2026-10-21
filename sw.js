// FindNotes service worker: keeps the app on the device so it opens with no connection.
//
// Change VERSION whenever you change any file of the app (Settings shows it, by asking this
// worker); `python check.py` tells you when it's due and `--fix` bumps it. Browsers notice
// that sw.js changed, fetch the new files into a fresh cache, and the app offers an "Update"
// button. Notes themselves are in IndexedDB and are never touched here.
const VERSION = '0.0.67';
const CACHE = `find-notes-${VERSION}`;

// The version the app runs is not always this one. Once the app is fully closed the browser
// starts a new worker by itself, with no way to stop it, so the worker keeps serving the
// files of the version in use (written down in IN_USE) until you tap Update.
const IN_USE = 'find-notes:in-use';
const cacheOf = (version) => `find-notes-${version}`;
let inUse = null; // read once, then kept here

async function getInUse() {
  if (inUse) return inUse;
  const saved = await (await caches.open(IN_USE)).match('version');
  inUse = saved ? await saved.text() : VERSION;
  return inUse;
}

async function setInUse(version) {
  inUse = version;
  await (await caches.open(IN_USE)).put('version', new Response(version));
}

const SHELL = [
  './',
  'index.html',
  'welcome.html',
  'gate.js',
  'styles.css',
  'app.js',
  'db.js',
  'editor.js',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'splash/launch-1125x2436.png',
  'splash/launch-1170x2532.png',
  'splash/launch-1179x2556.png',
  'splash/launch-1206x2622.png',
  'splash/launch-1242x2208.png',
  'splash/launch-1242x2688.png',
  'splash/launch-1260x2736.png',
  'splash/launch-1284x2778.png',
  'splash/launch-1290x2796.png',
  'splash/launch-1320x2868.png',
  'splash/launch-750x1334.png',
  'splash/launch-828x1792.png',
  'fonts/Caveat.woff2',
  'fonts/Karla.woff2',
];

self.addEventListener('install', (event) => {
  // `reload` skips the browser's own cache, so a new version is never built from old files.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })))),
  );
  // No skipWaiting here: the new version waits until you tap Update, so the app never
  // changes underneath you half way through writing a note.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Written down every time, so the next worker knows. A worker from before 0.0.63 never
    // wrote it, and a version whose files are gone can't be served: both move to this one.
    const version = await getInUse();
    await setInUse(await caches.has(cacheOf(version)) ? version : VERSION);
    await dropOldCaches();
    await self.clients.claim();
  })());
});

// Keeps this version's files and those of the version in use, nothing else
async function dropOldCaches() {
  const keep = [CACHE, cacheOf(await getInUse())];
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith('find-notes-') && !keep.includes(k)).map((k) => caches.delete(k)));
}

self.addEventListener('message', (event) => {
  const reply = (answer) => event.ports[0]?.postMessage(answer);
  // Update tapped while this worker waits: it goes in now, and its files with it
  if (event.data === 'skip-waiting') event.waitUntil(setInUse(VERSION).then(() => self.skipWaiting()));
  // Update tapped after the browser already started this worker: the app reloads afterwards
  if (event.data === 'use-latest') event.waitUntil(setInUse(VERSION).then(() => reply('done')).then(dropOldCaches));
  if (event.data === 'version') event.waitUntil(getInUse().then(reply)); // what the app runs
  if (event.data === 'latest') reply(VERSION); // what it would run after Update
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  event.respondWith(
    getInUse().then((version) => caches.open(cacheOf(version))).then(async (cache) => {
      const hit = await cache.match(request, { ignoreSearch: true });
      if (hit) return hit;
      try {
        return await fetch(request);
      } catch (error) {
        // Offline and not in the cache: opening the app still has to work.
        if (request.mode === 'navigate') return cache.match('index.html');
        throw error;
      }
    }),
  );
});
