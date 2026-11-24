/* Service worker do Narrative: permite instalar a ferramenta e usá-la sem ligação à internet.
   Estratégia: rede primeiro (para receber atualizações), cópia local quando não há rede.
   O nome da cache vem da versão publicada (js/version.js): uma versão nova muda este ficheiro, o browser instala-o e
   descarrega tudo de novo; a ferramenta (js/update.js) escolhe o momento de passar a usá-la. */
importScripts('js/version.js');
const CACHE = 'narrativa-app-' + self.APP_RELEASE.version;
const SHELL = ['./', 'index.html', 'js/version.js', 'js/update.js', 'styles.css', 'logo.svg', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
  'js/i18n.js', 'js/lang-en.js', 'js/lang-es.js', 'js/lang-fr.js', 'js/data.js',
  'js/apoio-pt-0.js', 'js/apoio-a.js', 'js/apoio-b.js', 'js/apoio-c.js', 'js/apoio-d.js', 'js/apoio-e.js', 'js/apoio-f.js', 'js/apoio-g.js', 'js/apoio-h.js', 'js/apoio-i.js',
  'js/apoio-en-1.js', 'js/apoio-en-2.js', 'js/apoio-en-3.js', 'js/apoio-es-1.js', 'js/apoio-es-2.js', 'js/apoio-es-3.js', 'js/apoio-fr-1.js', 'js/apoio-fr-2.js', 'js/apoio-fr-3.js',
  'js/core.js', 'js/board.js', 'js/fichas.js', 'js/tabs.js', 'js/nav.js', 'js/view.js', 'js/find.js', 'js/projects.js', 'js/plan.js', 'js/device.js', 'js/sync.js', 'js/vendor/peerjs.min.js', 'js/tour.js', 'js/tips.js', 'js/prefs.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/qa/')) return;
  e.respondWith(
    // «no-cache»: pergunta sempre ao servidor se há versão nova, em vez de confiar na cache HTTP do browser
    fetch(req.url, {cache:'no-cache'}).then(res => {
      if (res.ok && !url.search){ const copy = res.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(req, copy))); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch:true}).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
