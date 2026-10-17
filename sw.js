// Service worker mínimo: permite instalar las apps y abrir aunque la red falle un momento.
// Siempre intenta la red primero, así las actualizaciones que subas a GitHub se ven enseguida.
const CACHE = 'rodar-v3';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); } return res; }).catch(() => caches.match(r)));
});

// Al tocar una notificación se vuelve a la app y se abre lo que corresponde (ej. conductor.html#soporte abre el chat con la central)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || 'conductor.html', self.registration.scope);
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const pag = u => new URL(u).pathname.replace(/\.html$/, '');
    const c = cs.find(x => pag(x.url) === pag(url.href)) || cs.find(x => 'focus' in x && /\/conductor(\.html)?$/.test(new URL(x.url).pathname));
    if (!c) return self.clients.openWindow(url.href);
    return c.focus().then(w => { if (url.hash) (w || c).postMessage({ abrir: url.hash }); });
  }));
});

// Notificaciones push (viajes y mensajes con el celular bloqueado o la app cerrada)
const IOS = /iphone|ipad|ipod/i.test(self.navigator.userAgent || '');
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { titulo: 'Remises TOQUE!', cuerpo: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const pag = u => new URL(u, self.registration.scope).pathname.replace(/\.html$/, '');
    const destino = pag(d.url || 'conductor.html');
    const app = cs.find(c => c.visibilityState === 'visible' && pag(c.url) === destino);
    // Viaje cancelado o reasignado: se quita el aviso del viaje ofrecido
    if (d.cerrar) { (await self.registration.getNotifications({ tag: d.cerrar })).forEach(n => n.close()); if (!IOS) return; }
    // Con la app en pantalla, el tiempo real ya lo muestra (en iPhone siempre hay que mostrar el aviso)
    if (app && !IOS) { app.postMessage({ push: d }); return; }
    await self.registration.showNotification(d.titulo || 'Remises TOQUE!', {
      body: d.cuerpo || '', tag: d.tag || 'rodar', renotify: !d.silencio, silent: !!d.silencio,
      requireInteraction: !!d.fijo, vibrate: d.silencio ? undefined : [500, 200, 500, 200, 500],
      icon: d.tipo === 'pasajero' ? 'img/pasajero-192.png' : 'img/conductor-192.png', badge: 'img/conductor-192.png', timestamp: Date.now(),
      data: { url: d.url || 'conductor.html' },
    });
  })());
});
