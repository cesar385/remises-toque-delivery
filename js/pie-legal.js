// Información legal de las páginas públicas (inicio, nosotros, términos, ayuda, solicitudes):
// - datos de la empresa al pie (razón social, CUIT, domicilio y contacto) tomados de la configuración
// - enlaces a privacidad, cookies, cancelaciones y reembolsos, y a la Ventanilla Única Federal (Defensa del Consumidor)
// - Botón de arrepentimiento y Botón de baja de servicio a la vista desde el primer acceso
// - aviso de cookies con dos opciones del mismo peso; el contenido de terceros (videos) se carga solo si se acepta
(function () {
  const CLAVE = 'rodar_cookies';
  const leer = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
  const guardar = v => { try { localStorage.setItem(CLAVE, v); } catch { } };
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const VUF = 'https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario';

  const CSS = `.barra-legal{background:#0f2740;color:#d6e6f5;font:13px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.barra-legal .w{max-width:1120px;margin:0 auto;padding:6px 20px;display:flex;gap:6px 18px;flex-wrap:wrap;justify-content:flex-end}
.barra-legal a{color:#fff;text-decoration:underline;text-underline-offset:2px;font-weight:600}
.legal-pie{display:flex;flex-direction:column;align-items:center;gap:12px;font-size:13.5px;color:#c8d9ea;max-width:860px}
.legal-pie .enl2{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 18px}.legal-pie .enl2 a,.legal-pie .enl2 button{color:#e6eef7;background:none;border:0;font:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding:0}
.legal-pie .botones{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
.legal-pie .botones a{background:#fff;color:#0f2740;border-radius:999px;padding:9px 16px;font-weight:800;text-decoration:none}
.legal-pie .datos{line-height:1.55;text-align:center}.legal-pie .datos b{color:#fff}
.legal-pie .vuf{color:#fff;font-weight:700;text-decoration:underline}
.cookies-aviso{position:fixed;left:12px;right:12px;bottom:12px;z-index:9000;max-width:720px;margin:0 auto;background:#fff;color:#1d2a2b;border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.28);padding:16px 18px;font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;gap:12px}
.cookies-aviso p{margin:0}.cookies-aviso a{color:#215181;font-weight:700}
.cookies-aviso .acc{display:flex;gap:10px;flex-wrap:wrap}.cookies-aviso button{flex:1 1 160px;border:2px solid #215181;border-radius:999px;padding:11px 16px;font:inherit;font-weight:800;cursor:pointer;background:#215181;color:#fff}
.vid-ok{position:absolute;inset:0;width:100%;height:100%;border:0;background:#0d1f33;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;font:inherit;padding:16px;text-align:center}
.vid-ok span{width:64px;height:64px;border-radius:50%;background:#fff;color:#0d1f33;display:grid;place-items:center;font-size:26px}.vid-ok b{font-size:17px}.vid-ok small{color:#c8d9ea;max-width:320px}`;

  const cargarVideo = b => { const L = window.RODAR_LANDING; if (!L || !L.iframeVideo) return; const d = document.createElement('div'); d.innerHTML = L.iframeVideo(b.dataset.src, b.dataset.tit); b.replaceWith(d.firstChild); };
  const cargarVideos = () => document.querySelectorAll('.vid-ok').forEach(cargarVideo);

  const avisoCookies = () => {
    document.querySelectorAll('.cookies-aviso').forEach(x => x.remove());
    const a = document.createElement('div'); a.className = 'cookies-aviso'; a.setAttribute('role', 'dialog'); a.setAttribute('aria-label', 'Aviso de cookies');
    a.innerHTML = `<p>Usamos almacenamiento local solo para que la página funcione (sesión y preferencias). Algunos contenidos de terceros, como los videos, pueden usar cookies propias: elegí si querés cargarlos. <a href="terminos.html?para=cookies">Política de cookies</a></p>
      <div class="acc"><button type="button" data-c="necesarias">Solo necesarias</button><button type="button" data-c="todas">Aceptar todas</button></div>`;
    a.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { guardar(b.dataset.c); a.remove(); if (b.dataset.c === 'todas') cargarVideos(); });
    document.body.append(a);
  };

  const barraSuperior = () => {
    const b = document.createElement('div'); b.className = 'barra-legal';
    b.innerHTML = '<div class="w"><a href="baja.html?tipo=arrepentimiento">Botón de arrepentimiento</a><a href="baja.html?tipo=baja">Botón de baja de servicio</a></div>';
    document.body.prepend(b);
  };

  const pieHtml = e => {
    const dom = [e.direccion, e.localidad, e.provincia].filter(Boolean).join(', ');
    const datos = [
      `<b>${esc(e.razon_social || e.nombre || 'Remises TOQUE!')}</b>${e.cuit ? ' · CUIT ' + esc(e.cuit) : ''}`,
      dom ? 'Domicilio: ' + esc(dom) : '',
      [e.telefono ? 'Tel. ' + esc(e.telefono) : '', e.email ? `<a href="mailto:${esc(e.email)}" style="color:inherit">${esc(e.email)}</a>` : ''].filter(Boolean).join(' · '),
      'Consultas y reclamos: <a href="ayuda.html" style="color:inherit">Centro de ayuda</a>' + (e.whatsapp ? ', WhatsApp o teléfono' : ' o teléfono'),
    ].filter(Boolean).join('<br>');
    return `<div class="enl2"><a href="terminos.html?para=privacidad">Política de privacidad</a><a href="terminos.html?para=cookies">Política de cookies</a><a href="terminos.html?para=reembolsos">Cancelaciones y reembolsos</a><button type="button" id="prefCookies">Preferencias de cookies</button></div>
      <div class="botones"><a href="baja.html?tipo=arrepentimiento">Botón de arrepentimiento</a><a href="baja.html?tipo=baja">Botón de baja de servicio</a></div>
      <div class="datos">${datos}</div>
      <a class="vuf" href="${VUF}" target="_blank" rel="noopener">Defensa de las y los Consumidores. Para reclamos ingrese aquí</a>`;
  };

  const iniciar = () => {
    const s = document.createElement('style'); s.textContent = CSS; document.head.append(s);
    barraSuperior();
    const f = document.querySelector('footer .w');
    let caja = null;
    if (f) { caja = document.createElement('div'); caja.className = 'legal-pie'; caja.innerHTML = pieHtml({}); const pie = f.querySelector('#pie, small'); pie ? f.insertBefore(caja, pie) : f.append(caja); }
    const pintar = e => { if (!caja) return; caja.innerHTML = pieHtml(e || {}); caja.querySelector('#prefCookies').onclick = avisoCookies; };
    pintar({});
    if (window.RODAR && RODAR.listo) RODAR.llamar('/api/pub/config', 'GET', null, null).then(pintar).catch(() => { });
    // un video se carga al tocarlo (con eso la persona acepta ese contenido puntual)
    document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('.vid-ok'); if (b) cargarVideo(b); });
    // abierta desde una app (…?de=pasajero.html): no se muestra el aviso, esa pantalla no carga contenido de terceros
    if (!leer() && !new URLSearchParams(location.search).get('de')) avisoCookies();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.RODAR_PIE_LEGAL = { avisoCookies };
})();
