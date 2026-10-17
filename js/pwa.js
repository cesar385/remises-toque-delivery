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
