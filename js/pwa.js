// Instalación como app (Android/PC: botón; iPhone: instrucciones) y registro del service worker.
(function () {
  let evento = null; const cbs = [];
  const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); evento = e; cbs.forEach(f => f()); });
  addEventListener('appinstalled', () => { evento = null; document.querySelectorAll('[data-instalar]').forEach(b => b.remove()); });
  function ayudaIos() {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:5000;display:flex;align-items:flex-end';
    d.innerHTML = `<div style="background:#fff;color:#1d2b2c;width:100%;max-width:520px;margin:0 auto;border-radius:18px 18px 0 0;padding:20px 18px 28px;font-size:16px;line-height:1.5">
      <b style="font-size:18px">Instalar en el iPhone</b><ol style="padding-left:20px;margin:10px 0"><li>Tocá el botón <b>Compartir</b> <span style="font-size:20px">⎋</span> abajo en Safari.</li><li>Elegí <b>Agregar a pantalla de inicio</b>.</li><li>Tocá <b>Agregar</b>. Listo: queda el ícono como una app.</li></ol>
      <button style="width:100%;min-height:48px;border:0;border-radius:12px;background:#215181;color:#fff;font-size:16px;font-weight:700">Entendido</button></div>`;
    d.onclick = ev => { if (ev.target === d || ev.target.tagName === 'BUTTON') d.remove(); };
    document.body.append(d);
  }
  // Pone un botón "Instalar app" dentro de `cont` solo si se puede instalar y todavía no está instalada.
  window.botonInstalar = function (cont, clase, texto) {
    if (!cont || instalada()) return;
    const poner = () => {
      if (cont.querySelector('[data-instalar]')) return;
      const b = document.createElement('button'); b.type = 'button'; b.dataset.instalar = '1'; b.className = clase || 'btn sec'; b.textContent = texto || '📲 Instalar app en el celular';
      b.onclick = async () => { if (evento) { evento.prompt(); const r = await evento.userChoice.catch(() => null); if (r && r.outcome === 'accepted') b.remove(); evento = null; } else if (ios()) ayudaIos(); };
      cont.append(b);
    };
    if (evento || ios()) poner(); else cbs.push(poner);
  };
  window.appInstalada = instalada;
})();

// ---------- Actualizaciones automáticas (pasajero, conductor y empresas) ----------
// 1) Versión web: cuando se publica un cambio en el sitio, la app lo detecta y se recarga sola al volver a primer plano
//    (o muestra "Actualizar" si la persona está en medio de algo). No hace falta reinstalar nada.
// 2) App Android: si hay un APK nuevo (app-version.json, lo escribe el workflow "App Android"), ofrece descargarlo;
//    se instala ENCIMA de la anterior, sin desinstalar (misma firma).
(function () {
  const pag = (location.pathname.match(/(conductor|pasajero|empresa)(\.html)?$/) || [])[1];
  if (!pag || location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  const CAP = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  const LSg = k => { try { return localStorage.getItem(k); } catch { return null; } }, LSs = (k, v) => { try { localStorage.setItem(k, v); } catch { } };
  const huella = async () => {
    const r = await fetch(location.pathname + '?u=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    const t = await r.text(); let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return t.length + ':' + h;
  };
  let base = null, nueva = false, ultimo = 0;
  // ¿Está en medio de algo? (escribiendo, con un viaje en curso, con una ventana abierta)
  const ocupada = () => {
    const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.value) return true;
    try { if (typeof window.appOcupada === 'function' && window.appOcupada()) return true; } catch { }
    return !!document.querySelector('.hoja, .oferta, .modal-fondo, .pdfv, .tk-ov');
  };
  const recargar = () => { LSs('rodar_act_' + pag, String(Date.now())); location.reload(); };
  function aviso() {
    if (document.getElementById('actWeb')) return;
    const b = document.createElement('div'); b.id = 'actWeb';
    b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom));z-index:4000;background:#0f2740;color:#fff;border-radius:999px;padding:8px 8px 8px 16px;display:flex;gap:10px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.35);font:600 14px system-ui,Roboto,Arial,sans-serif;max-width:calc(100% - 24px)';
    b.innerHTML = '<span>🔄 Hay una actualización</span><button style="border:0;border-radius:999px;background:#4a8125;color:#fff;font:inherit;font-weight:800;padding:8px 14px;cursor:pointer">Actualizar</button><button aria-label="Más tarde" style="border:0;background:none;color:#fff;opacity:.7;font-size:18px;cursor:pointer;padding:0 6px">×</button>';
    b.children[1].onclick = recargar; b.children[2].onclick = () => b.remove();
    document.body.append(b);
  }
  async function revisar(alVolver) {
    if (Date.now() - ultimo < 60000 && !alVolver) return; ultimo = Date.now();
    try {
      if (!nueva) { const h = await huella(); if (!h) return; if (!base) { base = h; return; } if (h !== base) nueva = true; }
      if (!nueva) return;
      // se recarga sola si vuelve a primer plano y no está en medio de algo; si no, botón "Actualizar"
      if ((alVolver || document.hidden) && !ocupada()) recargar(); else aviso();
    } catch { }
  }
  addEventListener('load', () => setTimeout(() => revisar(), 4000));
  setInterval(() => revisar(), 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) revisar(true); });
  // el service worker también se actualiza solo
  if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => { });

  // ---- APK nuevo (solo dentro de la app Android) ----
  if (!CAP) return;
  async function revisarApk() {
    try {
      const A = window.Capacitor.Plugins && window.Capacitor.Plugins.App; if (!A || !A.getInfo) return;
      const [info, v] = await Promise.all([A.getInfo(), fetch('app-version.json?u=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null)]);
      const remota = v && +v[pag], local = +(info && info.build);
      if (!remota || !local || remota <= local) return;
      if (+LSg('rodar_apk_omitir_' + remota) > Date.now() || document.getElementById('actApk')) return;   // "Más tarde": se vuelve a ofrecer al día siguiente
      // El APK se abre en el navegador del celular: dentro de la app (WebView) una descarga no hace nada.
      // La app solo navega por su propio dominio; un enlace a otro dominio Android lo abre en el navegador.
      let url = (v.url || 'https://remisestoque.com/apk/toque-{app}.apk').replace('{app}', pag);
      try { const u = new URL(url, location.href); if (u.host === location.host || u.host.endsWith('remisestoque.com')) url = 'https://remisestoque.netlify.app' + u.pathname; } catch { }
      const d = document.createElement('div'); d.id = 'actApk';
      d.style.cssText = 'position:fixed;inset:0;z-index:4500;background:rgba(10,20,35,.6);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,Roboto,Arial,sans-serif';
      d.innerHTML = `<div style="background:#fff;color:#16283a;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:22px 18px calc(20px + env(safe-area-inset-bottom));text-align:center">
        <div style="font-size:40px">⬆️</div><b style="font-size:19px">Nueva versión de la app</b>
        <p style="color:#5b6b7b;margin:8px 0 14px;font-size:15px">Tenés la versión 1.0.${local} y ya está la 1.0.${remota}. Se instala encima de la que tenés: <b>no hace falta desinstalar</b> y no perdés tu sesión.</p>
        <ol style="text-align:left;color:#33475b;font-size:14px;margin:0 0 14px;padding-left:20px"><li>Tocá <b>Descargar</b> (se abre el navegador).</li><li>Abrí el archivo descargado y tocá <b>Actualizar</b>.</li></ol>
        <button id="apkD" style="width:100%;border:0;border-radius:14px;padding:15px;background:#4a8125;color:#fff;font:inherit;font-size:17px;font-weight:800">⬇ Descargar actualización</button>
        <button id="apkL" style="width:100%;border:0;background:none;color:#5b6b7b;font:inherit;font-weight:700;padding:12px;margin-top:4px">Más tarde</button></div>`;
      document.body.append(d);
      d.querySelector('#apkD').onclick = () => { d.remove(); location.href = url; };   // otro dominio: la app lo pasa al navegador de Android
      d.querySelector('#apkL').onclick = () => { LSs('rodar_apk_omitir_' + remota, String(Date.now() + 864e5)); d.remove(); };
    } catch { }
  }
  addEventListener('load', () => setTimeout(revisarApk, 6000));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(revisarApk, 1500); });
})();
