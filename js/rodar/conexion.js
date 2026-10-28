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

  window.RODAR = { SB, listo, rpc, tiempoReal, normalizar, ErrorApi, funcionSupabase };
})();
