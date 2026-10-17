// Conexión con Supabase: traduce las rutas de la app a funciones RPC, tiempo real, geocodificación y utilidades.
(function () {
  const CFG = window.RODAR_CONFIG || {};
  const listo = CFG.supabaseUrl && CFG.supabaseKey && !/TU-PROYECTO|TU-ANON/.test(CFG.supabaseUrl + CFG.supabaseKey);
  const SB = listo ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

  // [método, ruta, función]
  const RUTAS = [
    ['POST', '/api/login', 'r_login'], ['POST', '/api/logout', 'r_logout'],
    ['GET', '/api/me', 'r_me'], ['PUT', '/api/me', 'r_me_guardar'], ['POST', '/api/me/password', 'r_me_password'],
    ['GET', '/api/novedades', 'r_novedades'], ['POST', '/api/novedades/:id/vista', 'r_novedad_vista'], ['POST', '/api/novedades', 'r_novedad_guardar'], ['DELETE', '/api/novedades/:id', 'r_novedad_borrar'],
    ['GET', '/api/reportes', 'r_reportes'], ['GET', '/api/reportes/:id', 'r_reporte'], ['POST', '/api/reportes', 'r_reporte_crear'], ['POST', '/api/reportes/:id/respuesta', 'r_reporte_responder'],
    ['GET', '/api/catalogos', 'r_catalogos'], ['GET', '/api/estado', 'r_estado'], ['POST', '/api/tick', 'r_tick'], ['POST', '/api/clima', 'r_clima'],
    ['GET', '/api/simulador', 'r_simulador'], ['POST', '/api/simulador', 'r_simulador_guardar'], ['GET', '/api/config/webhook', 'r_config_webhook'],
    ['GET', '/api/config/dispatch', 'r_config_dispatch'], ['POST', '/api/config/dispatch', 'r_config_dispatch_guardar'],
    // operación
    ['GET', '/api/mapa', 'r_mapa'], ['POST', '/api/moviles/:id/estado', 'r_movil_estado'], ['POST', '/api/moviles/:id/mensaje', 'r_movil_mensaje'],
    ['POST', '/api/flota/mensaje', 'r_flota_mensaje'], ['GET', '/api/flota/mensajes', 'r_flota_mensajes'],
    ['GET', '/api/clientes/buscar', 'r_clientes_buscar'], ['GET', '/api/clientes/tel/:tel', 'r_cliente_tel'], ['PUT', '/api/clientes/:id', 'r_cliente_guardar'],
    ['POST', '/api/clientes/anotacion', 'r_cliente_anotacion'], ['POST', '/api/clientes/:id/bloqueo', 'r_cliente_bloqueo'], ['POST', '/api/clientes/:id/baja', 'r_cliente_baja'],
    ['POST', '/api/clientes/:id/recuperar', 'r_cliente_recuperar'], ['POST', '/api/clientes/:id/negativos', 'r_cliente_negativos'],
    ['GET', '/api/telefonia/ultimos', 'r_telefonia_ultimos'], ['POST', '/api/estimar', 'r_estimar'],
    ['POST', '/api/viajes', 'r_viaje_crear'], ['GET', '/api/viajes', 'r_viajes'], ['GET', '/api/viajes/:id/enlace', 'r_viaje_enlace'], ['GET', '/api/viajes/:id/ticket', 'r_ticket'], ['GET', '/api/viajes/:id', 'r_viaje'],
    ['POST', '/api/viajes/:id/anular', 'r_viaje_anular'], ['POST', '/api/viajes/:id/reenviar', 'r_viaje_reenviar'], ['POST', '/api/viajes/:id/asignar', 'r_viaje_asignar'],
    ['POST', '/api/viajes/:id/finalizar', 'r_viaje_finalizar'], ['POST', '/api/viajes/:id/oferta', 'r_viaje_oferta'],
    ['GET', '/api/reservas', 'r_reservas'], ['POST', '/api/reservas/anular', 'r_reservas_anular'],
    ['GET', '/api/chat', 'r_chat'], ['GET', '/api/chat/:id', 'r_chat_conv'], ['POST', '/api/chat/:id', 'r_chat_enviar'], ['POST', '/api/chat-simular', 'r_chat_simular'], ['POST', '/api/llamada-simular', 'r_llamada_simular'],
    ['GET', '/api/soporte', 'r_soporte'], ['GET', '/api/soporte/:id', 'r_soporte_conv'], ['POST', '/api/soporte/:id', 'r_soporte_enviar'], ['POST', '/api/soporte-nuevo', 'r_soporte_nuevo'],
    // administración
    ['GET', '/api/moviles', 'r_moviles'], ['POST', '/api/moviles', 'r_movil_guardar'], ['DELETE', '/api/moviles/:id', 'r_movil_borrar'], ['POST', '/api/sistema/reiniciar', 'r_sistema_reiniciar'],
    ['GET', '/api/base', 'r_base_info'], ['POST', '/api/whatsapp/preparar', 'r_wa_preparar'], ['POST', '/api/whatsapp/resultado', 'r_wa_resultado'], ['GET', '/api/pub/landing', 'r_pub_landing'], ['GET', '/api/landing', 'r_landing'], ['POST', '/api/landing', 'r_landing_guardar'],
    ['GET', '/api/penalizados', 'r_penalizados'], ['POST', '/api/penalizados', 'r_penalizar'], ['DELETE', '/api/penalizados/:id', 'r_penalizacion_quitar'],
    ['GET', '/api/solicitudes', 'r_solicitudes'], ['POST', '/api/solicitudes/:id/:accion', 'r_solicitud_accion'],
    ['GET', '/api/zonas', 'r_zonas'], ['POST', '/api/zonas', 'r_zona_guardar'], ['DELETE', '/api/zonas/:id', 'r_zona_borrar'],
    ['GET', '/api/zonas-peligrosas', 'r_peligrosas'], ['POST', '/api/zonas-peligrosas', 'r_peligrosa_guardar'], ['DELETE', '/api/zonas-peligrosas/:id', 'r_peligrosa_borrar'],
    ['GET', '/api/cuentas', 'r_cuentas'], ['GET', '/api/cuentas/:id', 'r_cuenta'], ['POST', '/api/cuentas/:id/:op', 'r_cuenta_op'],
    ['GET', '/api/mp/recargas', 'r_mp_recargas'], ['POST', '/api/mp/pagos/:id/consultar', 'r_mp_consultar'], ['GET', '/api/mp/viajes', 'r_mp_viajes'], ['POST', '/api/mp/viajes/:id/:op', 'r_mp_viaje_op'],
    ['GET', '/api/mp/saldos', 'r_mp_saldos'], ['GET', '/api/mp/saldos/:id', 'r_mp_saldo'], ['POST', '/api/mp/saldos/:id/aplicar', 'r_mp_saldo_aplicar'], ['POST', '/api/mp/saldos/:id/retiro', 'r_mp_saldo_retiro'],
    ['GET', '/api/medios-pago', 'r_medios'], ['POST', '/api/medios-pago', 'r_medios_guardar'], ['GET', '/api/modulos', 'r_modulos'], ['POST', '/api/modulos', 'r_modulos_guardar'],
    ['GET', '/api/planes', 'r_planes'], ['POST', '/api/planes', 'r_plan_guardar'], ['DELETE', '/api/planes/:id', 'r_plan_borrar'],
    ['GET', '/api/tarifas', 'r_tarifas'], ['POST', '/api/tarifas', 'r_tarifa_guardar'], ['DELETE', '/api/tarifas/:id', 'r_tarifa_borrar'], ['POST', '/api/tarifas/:id/tabla', 'r_tarifa_tabla'],
    ['GET', '/api/usuarios', 'r_usuarios'], ['POST', '/api/usuarios', 'r_usuario_guardar'], ['POST', '/api/usuarios/:id/reset', 'r_usuario_reset'],
    ['GET', '/api/corporativos', 'r_corporativos'], ['POST', '/api/corporativos', 'r_corporativo_guardar'],
    ['GET', '/api/canales', 'r_canales'], ['POST', '/api/canales', 'r_canales_guardar'],
    ['GET', '/api/feriados', 'r_feriados'], ['POST', '/api/feriados', 'r_feriado_guardar'], ['DELETE', '/api/feriados/:id', 'r_feriado_borrar'],
    ['GET', '/api/docreg', 'r_docreg'], ['POST', '/api/docreg/autoridad', 'r_docreg_autoridad'], ['DELETE', '/api/docreg/autoridad/:id', 'r_docreg_autoridad_borrar'],
    ['POST', '/api/docreg/empresa', 'r_docreg_empresa'], ['POST', '/api/docreg/generado', 'r_docreg_generado'],
    // informes
    ['GET', '/api/informes/acciones-usuarios', 'r_inf_acciones'], ['GET', '/api/informes/eventos-moviles', 'r_inf_eventos'], ['GET', '/api/informes/clientes-bloqueados', 'r_inf_bloqueados'],
    ['GET', '/api/informes/clientes-baja', 'r_inf_baja'], ['GET', '/api/informes/conductores', 'r_inf_conductores'], ['GET', '/api/informes/conectados', 'r_inf_conectados'],
    ['POST', '/api/informes/conectados/:tk/:op', 'r_inf_conectado_op'], ['GET', '/api/informes/estadisticas-moviles', 'r_inf_estadisticas'], ['GET', '/api/informes/horas-conductores', 'r_inf_horas'],
    ['GET', '/api/informes/facturacion-mes', 'r_inf_facturacion'], ['GET', '/api/informes/movimientos-moviles', 'r_inf_movimientos'], ['GET', '/api/informes/recorrido', 'r_inf_recorrido'],
    ['GET', '/api/informes/mensual', 'r_inf_mensual'], ['GET', '/api/informes/operadores', 'r_inf_operadores'], ['GET', '/api/informes/demanda', 'r_inf_demanda'],
    ['GET', '/api/informes/calor-conductores', 'r_inf_calor'], ['GET', '/api/informes/negativos', 'r_inf_negativos'], ['GET', '/api/informes/top10', 'r_inf_top10'],
    ['GET', '/api/informes/viajes-movil', 'r_inf_viajes_movil'], ['GET', '/api/informes/mi-rendimiento', 'r_inf_rendimiento'], ['GET', '/api/informes/mis-vehiculos', 'r_inf_mis_vehiculos'],
    // apps
    ['POST', '/api/conductor/moviles', 'r_cond_moviles'], ['POST', '/api/conductor/iniciar', 'r_cond_iniciar'], ['GET', '/api/conductor/estado', 'r_cond_estado'],
    ['POST', '/api/conductor/estado', 'r_cond_set_estado'], ['POST', '/api/conductor/posicion', 'r_cond_posicion'], ['POST', '/api/conductor/viaje/:id/:op', 'r_cond_viaje'],
    ['POST', '/api/conductor/calle', 'r_cond_calle'], ['GET', '/api/conductor/viajes', 'r_cond_viajes'], ['GET', '/api/conductor/movimientos', 'r_cond_movimientos'],
    ['GET', '/api/conductor/soporte', 'r_cond_soporte'], ['POST', '/api/conductor/soporte', 'r_cond_soporte_enviar'], ['POST', '/api/conductor/salir', 'r_cond_salir'],
    ['POST', '/api/cargar-saldo', 'r_cargar_saldo'], ['POST', '/api/solicitud-conductor', 'r_solicitud_conductor'],
    ['GET', '/api/pub/config', 'r_pub_config'], ['POST', '/api/pub/estimar', 'r_pub_estimar'], ['POST', '/api/pub/viaje', 'r_pub_viaje'], ['GET', '/api/pub/viaje/:id', 'r_pub_seguimiento'],
    ['POST', '/api/pub/viaje/:id/cancelar', 'r_pub_cancelar'],
    ['POST', '/api/cli/registro', 'r_cli_registro'], ['POST', '/api/cli/login', 'r_cli_login'], ['POST', '/api/cli/logout', 'r_cli_logout'], ['POST', '/api/cli/olvide', 'r_cli_olvide'],
    ['GET', '/api/cli/perfil', 'r_cli_perfil'], ['PUT', '/api/cli/perfil', 'r_cli_perfil_guardar'], ['GET', '/api/cli/viajes', 'r_cli_viajes'], ['POST', '/api/cli/viaje', 'r_cli_viaje'],
    ['POST', '/api/cli/viajes/:id/cancelar', 'r_cli_cancelar'], ['POST', '/api/cli/lugares', 'r_cli_lugar_guardar'], ['POST', '/api/cli/lugares/:id/quitar', 'r_cli_lugar_quitar'],
    ['POST', '/api/clientes/:id/cuenta', 'r_cliente_cuenta'], ['POST', '/api/pub/viaje/:id/calificar', 'r_pub_calificar'], ['POST', '/api/pub/soporte', 'r_pub_soporte'],
  ].map(([m, p, f]) => ({ m, f, nombres: (p.match(/:(\w+)/g) || []).map(x => x.slice(1)), re: new RegExp('^' + p.replace(/:(\w+)/g, '([^/]+)') + '$') }));

  // "2026-10-13T12:40:05" -> "2026-10-13 12:40:05" (formato que usa la interfaz)
  const RE_TS = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?$/;
  function normalizar(x) {
    if (typeof x === 'string') return RE_TS.test(x) ? x.slice(0, 19).replace('T', ' ') : x;
    if (Array.isArray(x)) return x.map(normalizar);
    if (x && typeof x === 'object') { for (const k in x) x[k] = normalizar(x[k]); }
    return x;
  }

  class ErrorApi extends Error { constructor(msg, extra) { super(msg); Object.assign(this, extra || {}); } }

  async function rpc(fn, token, q, b) {
    if (!SB) throw new ErrorApi('Falta configurar Supabase: completá config.js con la URL y la clave anon de tu proyecto (ver README).');
    const { data, error } = await SB.rpc(fn, { p_token: token || null, p_q: q || {}, p_b: b === undefined ? {} : b });
    if (error) {
      let msg = error.message || 'Error';
      if (msg.includes('SESION_VENCIDA')) throw new ErrorApi('Sesión vencida. Volvé a ingresar.', { status: 401 });
      if (msg.startsWith('PELIGROSA:')) throw new ErrorApi(msg.slice(10), { data: { peligrosa: true }, status: 409 });
      if (/Failed to fetch|NetworkError/i.test(msg)) msg = 'Sin conexión con el servidor. Revisá internet.';
      throw new ErrorApi(msg, { status: 400 });
    }
    return normalizar(data);
  }

  // ---- Geocodificación (OpenStreetMap Nominatim, desde el navegador) ----
  const cacheGeo = new Map();
  let empresaGeo = null;
  // "San Martín 450, Federal" -> { calle: 'San Martín', altura: 450 }
  function partirDir(q) {
    const base = String(q || '').split(',')[0].trim();
    const m = base.match(/^(.+?)\s+(?:n(?:ro|°|º)?\.?\s*)?(\d{1,5})$/i);
    return m ? { calle: m[1].trim(), altura: +m[2] } : { calle: base, altura: null };
  }
  const sinTildes = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^(calle|avenida|av\.?|bv\.?|boulevard|pje\.?|pasaje)\s+/, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  async function nominatim(q) {
    const e = empresaGeo || {};
    const vb = e.lat ? `&viewbox=${e.lng - 0.15},${+e.lat + 0.15},${+e.lng + 0.15},${e.lat - 0.15}&bounded=1` : '';
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=ar${vb}&q=${encodeURIComponent(q + (e.localidad ? ', ' + e.localidad : ''))}`, { headers: { 'Accept-Language': 'es' } });
    return r.json();
  }
  // Busca direcciones. OpenStreetMap casi no tiene la numeración de Federal: se conserva la altura escrita,
  // y si el sistema ya aprendió esa dirección (GPS de los choferes) la ubica con precisión.
  async function geoBuscar(q) {
    q = String(q || '').trim(); if (!q) return [];
    const e = empresaGeo || {};
    const k = 'g:' + q.toLowerCase(); if (cacheGeo.has(k)) return cacheGeo.get(k);
    const { calle, altura } = partirDir(q);
    const [conocida, osm1] = await Promise.all([
      altura ? rpc('r_dir_buscar', null, { q }, {}).catch(() => null) : null,
      nominatim(q).catch(() => []),
    ]);
    let osm = osm1;
    if (!osm.length && altura && calle) osm = await nominatim(calle).catch(() => []);
    const out = osm.map(x => {
      const a = x.address || {}, conNumero = !!a.house_number;
      const dir = conNumero ? `${a.road} ${a.house_number}` : (a.road ? (altura ? `${a.road} ${altura}` : a.road) : x.display_name.split(',')[0]);
      return { nombre: x.display_name, direccion: dir, localidad: a.city || a.town || a.village || e.localidad, provincia: a.state || e.provincia, lat: +x.lat, lng: +x.lon, aprox: !conNumero && !!altura };
    });
    if (conocida) out.unshift({ direccion: `${conocida.calle} ${conocida.altura}`, localidad: conocida.localidad || e.localidad, provincia: e.provincia, lat: conocida.lat, lng: conocida.lng,
      conocida: conocida.precision, aprox: conocida.precision !== 'exacta' });
    const vistos = new Set(); const fin = out.filter(x => { const kk = sinTildes(x.direccion) + '|' + sinTildes(x.localidad); if (vistos.has(kk)) return false; vistos.add(kk); return true; });
    cacheGeo.set(k, fin); return fin;
  }
  // Al tocar el mapa o usar el GPS: OpenStreetMap suele devolver sólo la calle. Si el sistema conoce una dirección
  // con altura a menos de 70 m sobre la misma calle, la propone; si no, avisa que falta la altura.
  async function geoInversa(lat, lng) {
    const k = `r:${(+lat).toFixed(5)},${(+lng).toFixed(5)}`; if (cacheGeo.has(k)) return cacheGeo.get(k);
    let out;
    try {
      const [r, cerca] = await Promise.all([
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': 'es' } }).then(x => x.json()),
        rpc('r_dir_cercana', null, { lat, lng }, {}).catch(() => null),
      ]);
      const a = r.address || {};
      out = { direccion: [a.road, a.house_number].filter(Boolean).join(' ') || 'Punto en el mapa', localidad: a.city || a.town || a.village || '', provincia: a.state || '' };
      if (!a.house_number) {
        if (cerca && (!a.road || sinTildes(cerca.calle) === sinTildes(a.road))) { out.direccion = `${cerca.calle} ${cerca.altura}`; out.aprox = true; }
        else if (a.road) out.sinAltura = true;
      }
    } catch { out = { direccion: `Punto ${(+lat).toFixed(5)}, ${(+lng).toFixed(5)}`, localidad: '', provincia: '', sinAltura: true }; }
    cacheGeo.set(k, out); return out;
  }

  // ---- Enrutador: (url, método, cuerpo, token) -> RPC ----
  async function llamar(url, metodo, cuerpo, token) {
    const u = new URL(url, 'http://x');
    const q = Object.fromEntries(u.searchParams.entries());
    const ruta = u.pathname;
    if (ruta === '/api/geocodificar' || ruta === '/api/pub/geocodificar') return geoBuscar(q.q);
    if (ruta === '/api/geocodificar/inversa' || ruta === '/api/pub/geocodificar/inversa') return geoInversa(q.lat, q.lng);
    for (const r of RUTAS) {
      if (r.m !== metodo) continue;
      const m = ruta.match(r.re);
      if (!m) continue;
      r.nombres.forEach((n, i) => q[n] = decodeURIComponent(m[i + 1]));
      const res = await rpc(r.f, token, q, cuerpo);
      if (r.f === 'r_me' || r.f === 'r_catalogos' || r.f === 'r_pub_config') empresaGeo = (res && (res.empresa || res)) || empresaGeo;
      return res;
    }
    throw new ErrorApi('Ruta no disponible: ' + metodo + ' ' + ruta);
  }

  // ---- Tiempo real (Supabase Realtime Broadcast) ----
  // Devuelve un objeto con .on(evento, cb), .emit(evento, datos) y .connected, parecido a socket.io
  function tiempoReal(prefijo, topicos) {
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
  }

  // ---- WhatsApp: el envío real pasa por la función de Supabase "whatsapp" (guarda el token de Meta en secreto) ----
  async function whatsappEnviar(token, convId, texto) {
    if (!SB) throw new ErrorApi('Falta configurar Supabase.');
    let r;
    try {
      r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/functions/v1/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey }, body: JSON.stringify({ accion: 'enviar', token, conv_id: convId, texto }) });
    } catch { throw new ErrorApi('Sin conexión con el servidor. Revisá internet.', { noConectado: true }); }
    let j = {}; try { j = await r.json(); } catch { }
    if (r.status === 404) throw new ErrorApi('La función de WhatsApp todavía no está instalada en Supabase (ver README).', { noConectado: true });
    if (!r.ok) throw new ErrorApi(j.error || 'No se pudo enviar por WhatsApp', { noConectado: r.status === 503 });
    return j;
  }

  // ---- Pagar base con Mercado Pago: la función de Supabase "mercadopago" crea el pago y lo acredita sola cuando MP lo aprueba ----
  async function mercadopagoCrear(token, monto, movilId) {
    if (!SB) throw new ErrorApi('Falta configurar Supabase.');
    let r;
    try {
      r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/functions/v1/mercadopago', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey }, body: JSON.stringify({ accion: 'crear', token, monto, movil_id: movilId || null }) });
    } catch { throw new ErrorApi('Sin conexión con el servidor. Revisá internet.'); }
    let j = {}; try { j = await r.json(); } catch { }
    if (r.status === 404) throw new ErrorApi('El pago con Mercado Pago todavía no está instalado en Supabase (ver README).', { noConectado: true });
    if (!r.ok) throw new ErrorApi(j.error || 'No se pudo crear el pago', { noConectado: r.status === 503 });
    return j;
  }

  // ---- CSV ----
  function csv(filas, nombre) {
    const cols = Object.keys(filas[0] || {});
    const esc = v => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : /[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    const txt = '\ufeff' + cols.join(';') + '\n' + filas.map(f => cols.map(c => esc(f[c])).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = (nombre || 'informe') + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ---- Clima (Open-Meteo) para el índice dinámico ----
  async function clima(lat, lng, token) {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`);
      const j = await r.json(); const c = j.current.weather_code;
      const desc = c === 0 ? 'Despejado' : c < 4 ? 'Nublado' : c < 50 ? 'Niebla' : c < 70 ? 'Lluvia' : c < 80 ? 'Nieve' : c < 90 ? 'Chaparrones' : 'Tormenta';
      await rpc('r_clima', token, {}, { temp: Math.round(j.current.temperature_2m), desc, lluvia: c >= 51 });
    } catch { }
  }

  // ---- Archivos: se guardan como data URL dentro de la base (límite 1,5 MB) ----
  function archivoADataURL(file) {
    return new Promise((res, rej) => {
      if (file.size > 1.5e6) return rej(new Error('El archivo supera 1,5 MB. Subí una imagen más liviana.'));
      const fr = new FileReader(); fr.onload = () => res({ archivo: fr.result, nombre: file.name }); fr.onerror = rej; fr.readAsDataURL(file);
    });
  }

  window.RODAR = { SB, listo, rpc, llamar, whatsappEnviar, mercadopagoCrear, tiempoReal, csv, clima, geoBuscar, geoInversa, partirDir, archivoADataURL, normalizar, ErrorApi, setEmpresa: e => empresaGeo = e };
})();

// ---------- cálculo de tarifa (mismo criterio que rodar.calcular_monto en la base) ----------
function precioTablaKm(tb, metros) {
  const km = (tb && tb.km) || []; if (!km.length) return 0;
  const u = Math.floor(Math.max(0, metros || 0) / 100); const ord = [...km].sort((a, b) => a[0] - b[0]); const ult = ord[ord.length - 1]; const lu = Math.round(ult[0] * 10);
  const cada = Math.max(1, Math.floor(((tb.extra && tb.extra.cada_m) || 400) / 100)); const monto = (tb.extra && +tb.extra.monto) || 0;
  if (u > lu) return ult[1] + Math.ceil((u - lu) / cada) * monto;
  let p = null; ord.forEach(r => { if (Math.round(r[0] * 10) <= u) p = r[1]; });
  return p == null ? ord[0][1] : p;
}
function precioTablaEspera(tb, seg) {
  const es = (tb && tb.espera) || []; if (!es.length) return 0;
  const mi = Math.floor(Math.max(0, seg || 0) / 60); const ord = [...es].sort((a, b) => a[0] - b[0]); const ult = ord[ord.length - 1];
  const cada = Math.max(1, (tb.espera_extra && +tb.espera_extra.cada_min) || 5); const monto = (tb.espera_extra && +tb.espera_extra.monto) || 0;
  if (mi > ult[0]) return ult[1] + Math.floor((mi - ult[0]) / cada) * monto;
  let p = 0; ord.forEach(r => { if (r[0] <= mi) p = r[1]; }); return p;
}
function montoTarifa(t, metros, esperaSeg, indice) {
  if (!t) return 0; const ind = indice || 1;
  if (t.tabla && t.tabla.km && t.tabla.km.length) {
    return Math.round((precioTablaKm(t.tabla, Math.max(0, (metros || 0) - (t.cortesia_mts || 0))) + (t.con_espera ? precioTablaEspera(t.tabla, Math.max(0, (esperaSeg || 0) - (t.cortesia_min || 0) * 60)) : 0)) * ind);
  }
  const red = t.redondeo_mts || 100; let m = Math.max(0, (metros || 0) - (t.cortesia_mts || 0)); m = Math.ceil(m / red) * red;
  const fd = Math.floor(m / (t.ficha_mts || 100)); const fe = t.con_espera ? Math.floor(Math.max(0, (esperaSeg || 0) - (t.cortesia_min || 0) * 60) / (t.espera_seg || 60)) : 0;
  return Math.round(((+t.bajada || 0) + (fd + fe) * (+t.precio_ficha || 0)) * ind);
}
function resumenTarifa(t) {
  if (!t) return '—';
  if (t.tabla && t.tabla.km && t.tabla.km.length) { const k = t.tabla.km; return `Por tabla: ${k[0][0]} km ${pesos0(k[0][1])} … ${k[k.length - 1][0]} km ${pesos0(k[k.length - 1][1])} · espera por tramos de minutos`; }
  return `Bajada ${pesos0(t.bajada)} · ficha ${pesos0(t.precio_ficha)} cada ${t.ficha_mts} m`;
}
function pesos0(n) { return n == null || n === '' ? '—' : '$ ' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 }); }
