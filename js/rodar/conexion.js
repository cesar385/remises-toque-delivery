// Conexión con Supabase: cliente, llamadas RPC, funciones de Supabase (Edge Functions) y tiempo real.
// Crea window.RODAR; los demás archivos de js/rodar/ le agregan sus funciones.
(function () {
  const CFG = window.RODAR_CONFIG || {};
  const listo = CFG.supabaseUrl && CFG.supabaseKey && !/TU-PROYECTO|TU-ANON/.test(CFG.supabaseUrl + CFG.supabaseKey);
  const SB = listo ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  const SIN_CONEXION = 'Sin conexión con el servidor. Revisá internet.';

  class ErrorApi extends Error { constructor(msg, extra) { super(msg); Object.assign(this, extra || {}); } }

  // "2026-10-13T12:40:05" -> "2026-10-13 12:40:05" (formato que usa la interfaz)
  const RE_TS = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?$/;
  const normalizar = x => {
    if (typeof x === 'string') return RE_TS.test(x) ? x.slice(0, 19).replace('T', ' ') : x;
    if (Array.isArray(x)) return x.map(normalizar);
    if (x && typeof x === 'object') { for (const k in x) x[k] = normalizar(x[k]); }
    return x;
  };

  // Traduce el error de la base a un mensaje para la persona
  const errorDeRpc = error => {
    const msg = error.message || 'Error';
    if (msg.includes('SESION_VENCIDA')) return new ErrorApi('Sesión vencida. Volvé a ingresar.', { status: 401 });
    if (msg.includes('LICENCIA_SUSPENDIDA')) { licencia.revisar(true); return new ErrorApi('El servicio está suspendido momentáneamente.', { status: 403 }); }
    if (msg.startsWith('PELIGROSA:')) return new ErrorApi(msg.slice(10), { data: { peligrosa: true }, status: 409 });
    if (/Failed to fetch|NetworkError/i.test(msg)) return new ErrorApi(SIN_CONEXION, { status: 400 });
    return new ErrorApi(msg, { status: 400 });
  };

  const rpc = async (fn, token, q, b) => {
    if (!SB) throw new ErrorApi('Falta configurar Supabase: completá config.js con la URL y la clave anon de tu proyecto (ver README).');
    const { data, error } = await SB.rpc(fn, { p_token: token || null, p_q: q || {}, p_b: b === undefined ? {} : b });
    if (error) throw errorDeRpc(error);
    // errores devueltos como dato (p. ej. intentos de inicio de sesión: así el intento fallido queda registrado)
    if (data && typeof data === 'object' && !Array.isArray(data) && typeof data.__error === 'string') throw new ErrorApi(data.__error, { status: 400 });
    return normalizar(data);
  };

  // POST a una función de Supabase. Devuelve { r, j } (respuesta y JSON); si no hay red lanza ErrorApi con `extraSinRed`.
  const funcionSupabase = async (nombre, cuerpo, extraSinRed) => {
    let r;
    try {
      r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/functions/v1/' + nombre, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey }, body: JSON.stringify(cuerpo),
      });
    } catch { throw new ErrorApi(SIN_CONEXION, extraSinRed); }
    let j = {}; try { j = await r.json(); } catch { }
    return { r, j };
  };

  // ---- Tiempo real (Supabase Realtime Broadcast) ----
  // Devuelve un objeto con .on(evento, cb), .emit(evento, datos) y .connected, parecido a socket.io
  const tiempoReal = (prefijo, topicos) => {
    const handlers = {}; const canales = [];
    const obj = { connected: false, on(ev, cb) { (handlers[ev] = handlers[ev] || []).push(cb); return obj; }, emit(ev, data) { const c = canales.find(c => c._radio) || canales[0]; if (c) c.send({ type: 'broadcast', event: ev, payload: data }); }, cerrar() { canales.forEach(c => SB.removeChannel(c)); } };
    if (!SB || !prefijo) return obj;
    topicos.forEach(t => {
      const ch = SB.channel(prefijo + t, { config: { broadcast: { self: false } } });
      if (t === 'radio') ch._radio = true;
      ch.on('broadcast', { event: '*' }, msg => (handlers[msg.event] || []).forEach(cb => { try { cb(normalizar(msg.payload)); } catch (e) { console.error(e); } }));
      ch.subscribe(st => { obj.connected = st === 'SUBSCRIBED'; if (st === 'SUBSCRIBED') (handlers.connect || []).forEach(cb => cb()); });
      canales.push(ch);
    });
    return obj;
  };

  // ---- Licencia (cuando el sistema se vende a otras remiserías) ----
  // Si el servicio está suspendido, tapa la página con el motivo. En el panel de la central muestra
  // además un aviso cuando está vencido (días de gracia) o en período de prueba.
  const licencia = {
    revisada: false,
    async revisar(forzar) {
      if (!SB || (this.revisada && !forzar)) return;
      this.revisada = true;
      let l;
      try { const r = await SB.rpc('r_licencia', {}); if (r.error) return; l = r.data; } catch { return; }
      if (!l || l.estado === 'propia') return;
      const listoDom = f => document.body ? f() : document.addEventListener('DOMContentLoaded', f);
      if (l.estado === 'suspendido' || l.estado === 'baja') listoDom(() => this.tapar(l));
      else if ((l.estado === 'moroso' || l.estado === 'prueba') && /panel/.test(location.pathname)) listoDom(() => this.franja(l));
    },
    tapar(l) {
      if (document.getElementById('licencia-tapa')) return;
      const d = document.createElement('div');
      d.id = 'licencia-tapa'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true');
      d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(242,245,246,.97);display:grid;place-items:center;padding:24px;font-family:system-ui,Arial,sans-serif';
      const t = document.createElement('div');
      t.style.cssText = 'max-width:440px;background:#fff;border-radius:14px;box-shadow:0 6px 30px rgba(0,0,0,.12);padding:28px;text-align:center;color:#1d2a2b';
      const h = document.createElement('h2'); h.textContent = 'Servicio no disponible'; h.style.cssText = 'margin:0 0 10px;font-size:20px';
      const p = document.createElement('p'); p.style.cssText = 'margin:0;color:#5e6f70;line-height:1.5';
      p.textContent = /panel/.test(location.pathname) ? (l.mensaje || 'El servicio está suspendido.') : 'El servicio no está disponible en este momento. Probá más tarde.';
      t.append(h, p);
      if (l.pago_url && /panel/.test(location.pathname)) t.append(this.botonPago(l.pago_url, 'margin-top:16px'));
      d.append(t); document.body.append(d);
    },
    botonPago(url, estilo) {
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Pagar con Mercado Pago';
      a.style.cssText = 'display:inline-block;background:#009ee3;color:#fff;border-radius:8px;padding:9px 16px;font-weight:600;text-decoration:none;' + (estilo || '');
      return a;
    },
    franja(l) {
      if (document.getElementById('licencia-franja') || !l.mensaje) return;
      const d = document.createElement('div');
      d.id = 'licencia-franja'; d.setAttribute('role', 'status');
      const moroso = l.estado === 'moroso';
      d.style.cssText = 'position:sticky;top:0;z-index:1000;padding:8px 14px;font-size:13px;text-align:center;font-family:system-ui,Arial,sans-serif;'
        + (moroso ? 'background:#fdf3d6;color:#7a5800;border-bottom:1px solid #f0dc9a' : 'background:#e6eefc;color:#1f4fa8;border-bottom:1px solid #c9d8f5');
      d.textContent = l.mensaje;
      if (l.pago_url) { d.append(' '); d.append(this.botonPago(l.pago_url, 'margin-left:8px;padding:4px 10px;font-size:12px')); }
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', 'Cerrar aviso');
      x.style.cssText = 'margin-left:10px;border:0;background:none;cursor:pointer;color:inherit;font-size:14px';
      x.onclick = () => d.remove(); d.append(x);
      document.body.prepend(d);
    },
  };
  licencia.revisar();

  // ---- Marca de cada remisería (config.js → CLIENTES[dominio].marca) ----
  // Cambia el nombre "Remises TOQUE!" y el logo por los del cliente en todas las páginas, también en
  // lo que se va dibujando después (pantallas del panel, comprobantes, avisos).
  const marca = CFG.marca;
  if (marca && marca.nombre && marca.nombre.indexOf('TOQUE!') < 0) {
    const RE = /Remis(?:es)? TOQUE!|TOQUE!/g;
    const cambiarTexto = t => t.replace(RE, marca.nombre);
    const logo = src => {
      if (!src) return null;
      if (/logo-blanco\.png/.test(src)) return marca.logoBlanco || marca.logo || null;
      if (/(^|\/)logo\.png/.test(src)) return marca.logo || null;
      return null;
    };
    const tratar = raiz => {
      tratar.uno(raiz);
      if (raiz.nodeType !== 1) return;
      const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let n; while ((n = w.nextNode())) tratar.uno(n);
    };
    tratar.uno = n => {
      if (n.nodeType === 3) { if (n.nodeValue.indexOf('TOQUE!') >= 0) n.nodeValue = cambiarTexto(n.nodeValue); return; }
      if (n.nodeType !== 1) return;
      if (n.tagName === 'IMG') { const x = logo(n.getAttribute('src')); if (x && n.getAttribute('src') !== x) n.src = x; }
      for (const at of ['alt', 'title', 'placeholder', 'aria-label']) { const v = n.getAttribute(at); if (v && v.indexOf('TOQUE!') >= 0) n.setAttribute(at, cambiarTexto(v)); }
    };
    const aplicar = () => {
      document.title = cambiarTexto(document.title);
      if (marca.color) document.documentElement.style.setProperty('--pri', marca.color);
      tratar(document.body);
      new MutationObserver(ms => ms.forEach(m => {
        if (m.type === 'characterData') { tratar.uno(m.target); return; }
        m.addedNodes.forEach(tratar);
      })).observe(document.body, { childList: true, subtree: true, characterData: true });
      new MutationObserver(() => { if (document.title.indexOf('TOQUE!') >= 0) document.title = cambiarTexto(document.title); })
        .observe(document.querySelector('title') || document.head, { childList: true, subtree: true, characterData: true });
    };
    if (document.body) aplicar(); else document.addEventListener('DOMContentLoaded', aplicar);
  }

  window.RODAR = { SB, listo, rpc, tiempoReal, normalizar, ErrorApi, funcionSupabase, licencia };
})();
