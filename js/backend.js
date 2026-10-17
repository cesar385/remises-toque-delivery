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
    ['DELETE', '/api/viajes/:id', 'r_viaje_borrar'], ['POST', '/api/viajes/:id/anular', 'r_viaje_anular'], ['POST', '/api/viajes/:id/reenviar', 'r_viaje_reenviar'], ['POST', '/api/viajes/:id/asignar', 'r_viaje_asignar'],
    ['POST', '/api/viajes/:id/finalizar', 'r_viaje_finalizar'], ['POST', '/api/viajes/:id/oferta', 'r_viaje_oferta'],
    ['GET', '/api/reservas', 'r_reservas'], ['POST', '/api/reservas/anular', 'r_reservas_anular'],
    ['GET', '/api/chat', 'r_chat'], ['GET', '/api/chat/:id', 'r_chat_conv'], ['POST', '/api/chat/:id', 'r_chat_enviar'], ['POST', '/api/chat-simular', 'r_chat_simular'], ['POST', '/api/llamada-simular', 'r_llamada_simular'],
    ['GET', '/api/soporte', 'r_soporte'], ['GET', '/api/soporte/:id', 'r_soporte_conv'], ['POST', '/api/soporte/:id', 'r_soporte_enviar'], ['POST', '/api/soporte-nuevo', 'r_soporte_nuevo'], ['DELETE', '/api/soporte/:id', 'r_soporte_borrar'], ['POST', '/api/soporte-borrar-cerradas', 'r_soporte_borrar_cerradas'],
    // administración
    ['GET', '/api/moviles', 'r_moviles'], ['POST', '/api/moviles', 'r_movil_guardar'], ['DELETE', '/api/moviles/:id', 'r_movil_borrar'], ['POST', '/api/sistema/reiniciar', 'r_sistema_reiniciar'],
    ['GET', '/api/base', 'r_base_info'], ['POST', '/api/whatsapp/preparar', 'r_wa_preparar'], ['POST', '/api/whatsapp/resultado', 'r_wa_resultado'], ['GET', '/api/pub/landing', 'r_pub_landing'], ['GET', '/api/landing', 'r_landing'], ['POST', '/api/landing', 'r_landing_guardar'],
    ['GET', '/api/penalizados', 'r_penalizados'], ['POST', '/api/penalizados', 'r_penalizar'], ['DELETE', '/api/penalizados/:id', 'r_penalizacion_quitar'],
    ['GET', '/api/solicitudes', 'r_solicitudes'], ['POST', '/api/solicitudes/:id/:accion', 'r_solicitud_accion'],
    ['GET', '/api/zonas', 'r_zonas'], ['POST', '/api/zonas', 'r_zona_guardar'], ['DELETE', '/api/zonas/:id', 'r_zona_borrar'],
    ['GET', '/api/zonas-peligrosas', 'r_peligrosas'], ['POST', '/api/zonas-peligrosas', 'r_peligrosa_guardar'], ['DELETE', '/api/zonas-peligrosas/:id', 'r_peligrosa_borrar'],
    ['GET', '/api/cuentas', 'r_cuentas'], ['GET', '/api/cuentas/:id', 'r_cuenta'], ['POST', '/api/cuentas/:id/:op', 'r_cuenta_op'],
    ['GET', '/api/mp/recargas', 'r_mp_recargas'], ['POST', '/api/mp/recargas/repetidos', 'r_mp_repetidos'], ['DELETE', '/api/mp/pagos/:id', 'r_mp_pago_borrar'], ['POST', '/api/mp/pagos/:id/consultar', 'r_mp_consultar'], ['GET', '/api/mp/viajes', 'r_mp_viajes'], ['POST', '/api/mp/viajes/:id/:op', 'r_mp_viaje_op'],
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
    ['POST', '/api/radio', 'r_radio_enviar'], ['GET', '/api/radio/:id', 'r_radio_audio'], ['GET', '/api/conductor/push', 'r_cond_push'], ['POST', '/api/conductor/push', 'r_cond_push'], ['GET', '/api/conductor/soporte', 'r_cond_soporte'], ['POST', '/api/conductor/soporte', 'r_cond_soporte_enviar'], ['POST', '/api/conductor/salir', 'r_cond_salir'], ['GET', '/api/conductor/perfil', 'r_cond_perfil'], ['POST', '/api/conductor/perfil', 'r_cond_perfil_guardar'], ['GET', '/api/conductor/billetera', 'r_cond_billetera'], ['PUT', '/api/conductor/billetera', 'r_cond_billetera'],
    ['POST', '/api/cargar-saldo', 'r_cargar_saldo'], ['POST', '/api/solicitud-conductor', 'r_solicitud_conductor'],
    ['GET', '/api/pub/config', 'r_pub_config'], ['POST', '/api/pub/estimar', 'r_pub_estimar'], ['POST', '/api/pub/viaje', 'r_pub_viaje'], ['GET', '/api/pub/viaje/:id', 'r_pub_seguimiento'],
    ['POST', '/api/pub/viaje/:id/cancelar', 'r_pub_cancelar'],
    ['POST', '/api/cli/registro', 'r_cli_registro'], ['POST', '/api/cli/login', 'r_cli_login'], ['POST', '/api/cli/logout', 'r_cli_logout'], ['POST', '/api/cli/olvide', 'r_cli_olvide'],
    ['GET', '/api/cli/push', 'r_cli_push'], ['POST', '/api/cli/push', 'r_cli_push'], ['GET', '/api/cli/perfil', 'r_cli_perfil'], ['PUT', '/api/cli/perfil', 'r_cli_perfil_guardar'], ['GET', '/api/cli/viajes', 'r_cli_viajes'], ['POST', '/api/cli/viaje', 'r_cli_viaje'],
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
  // Toda Argentina: sin recorte por zona. Si el texto trae localidad ("San Martín 76, Concordia") se usa esa;
  // si no, la localidad de la empresa sólo ordena y prioriza los resultados (no los limita).
  async function nominatim(q) {
    const e = empresaGeo || {};
    const vb = e.lat ? `&viewbox=${e.lng - 1.5},${+e.lat + 1.5},${+e.lng + 1.5},${e.lat - 1.5}&bounded=0` : '';
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&countrycodes=ar${vb}&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'es' } });
    return r.json();
  }
  // Google Maps (opcional: clave en config.js → googleKey). Se usa el Geocoder del navegador, que ubica la puerta exacta con numeración.
  let googlePromesa = null, googleFalla = false;
  function googleListo() {
    if (!CFG.googleKey || googleFalla) return Promise.resolve(null);
    if (googlePromesa) return googlePromesa;
    googlePromesa = new Promise(ok => {
      if (window.google && window.google.maps && window.google.maps.Geocoder) return ok(window.google.maps);
      window.gm_authFailure = () => { googleFalla = true; ok(null); };
      window.__gmListo = async () => { try { if (window.google && google.maps && google.maps.importLibrary && !google.maps.Geocoder) await google.maps.importLibrary('geocoding'); } catch { } ok(window.google && window.google.maps && window.google.maps.Geocoder ? window.google.maps : null); };
      const sc = document.createElement('script');
      sc.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(CFG.googleKey)}&language=es&region=AR&loading=async&callback=__gmListo`;
      sc.async = true; sc.onerror = () => { googleFalla = true; ok(null); };
      document.head.append(sc); setTimeout(() => ok(null), 8000);
    });
    return googlePromesa;
  }
  const compG = (r, t) => { const c = (r.address_components || []).find(x => x.types.includes(t)); return c ? c.long_name : ''; };
  const itemG = r => {
    const calle = compG(r, 'route'), num = compG(r, 'street_number'), tipo = r.geometry.location_type;
    return { nombre: r.formatted_address, direccion: calle ? `${calle}${num ? ' ' + num : ''}` : r.formatted_address.split(',')[0], localidad: compG(r, 'locality') || compG(r, 'administrative_area_level_2') || compG(r, 'sublocality') || '', provincia: compG(r, 'administrative_area_level_1'),
      lat: r.geometry.location.lat(), lng: r.geometry.location.lng(), aprox: !num || !(tipo === 'ROOFTOP' || tipo === 'RANGE_INTERPOLATED'), google: true };
  };
  async function googleBuscar(texto) {
    const gm = await googleListo(); if (!gm) return [];
    const e = empresaGeo || {};
    const req = { address: texto, componentRestrictions: { country: 'AR' } };
    if (e.lat) req.bounds = { south: +e.lat - 1.5, north: +e.lat + 1.5, west: +e.lng - 1.5, east: +e.lng + 1.5 };
    return new Promise(ok => new gm.Geocoder().geocode(req, (res, st) => ok(st === 'OK' && res ? res.filter(r => (r.types || []).some(t => ['street_address', 'premise', 'subpremise', 'route', 'intersection'].includes(t))).map(itemG) : [])));
  }
  async function googleInversa(lat, lng) {
    const gm = await googleListo(); if (!gm) return null;
    return new Promise(ok => new gm.Geocoder().geocode({ location: { lat: +lat, lng: +lng } }, (res, st) => {
      if (st !== 'OK' || !res || !res.length) return ok(null);
      const r = res.find(x => x.types.includes('street_address')) || res.find(x => x.types.includes('route')) || res[0];
      ok(itemG(r));
    }));
  }
  // Georef (datos.gob.ar): geocodificador oficial de direcciones de Argentina, con numeración por calle en todo el país.
  async function georef(calle, altura, lugar) {
    const dir = altura ? `${calle} ${altura}` : calle;
    const l = String(lugar || '').split(',').map(x => x.trim()).filter(Boolean);
    const base = `https://apis.datos.gob.ar/georef/api/direcciones?max=6&direccion=${encodeURIComponent(dir)}`;
    const probar = async extra => { const r = await fetch(base + extra); if (!r.ok) return []; const j = await r.json(); return j.direcciones || []; };
    let res = [];
    if (l[0]) res = await probar(`&localidad_censal=${encodeURIComponent(l[0])}${l[1] ? '&provincia=' + encodeURIComponent(l[1]) : ''}`).catch(() => []);
    if (!res.length && l[0]) res = await probar(`&departamento=${encodeURIComponent(l[0])}${l[1] ? '&provincia=' + encodeURIComponent(l[1]) : ''}`).catch(() => []);
    if (!res.length) res = await probar(l[1] ? `&provincia=${encodeURIComponent(l[1])}` : '').catch(() => []);
    return res.filter(x => x.ubicacion && x.ubicacion.lat != null).map(x => ({ direccion: `${x.calle.nombre} ${x.altura.valor || ''}`.trim(), localidad: (x.localidad_censal && x.localidad_censal.nombre) || (x.departamento && x.departamento.nombre) || '', provincia: x.provincia && x.provincia.nombre, lat: +x.ubicacion.lat, lng: +x.ubicacion.lon, aprox: false, georef: true }));
  }
  // Una sola línea: "calle altura, localidad, provincia". compDir arma el texto; enTexto lo desarma.
  const compDir = (dir, loc, prov) => [dir, loc, prov].map(x => String(x || '').trim()).filter(Boolean).join(', ');
  const enTexto = t => { const p = String(t || '').split(',').map(x => x.trim()); return { dir: p[0] || '', loc: p[1] || '', prov: p[2] || '' }; };
  // Busca direcciones. OpenStreetMap casi no tiene la numeración de Federal: se conserva la altura escrita,
  // y si el sistema ya aprendió esa dirección (GPS de los choferes) la ubica con precisión.
  async function geoBuscar(q) {
    q = String(q || '').trim(); if (!q) return [];
    const e = empresaGeo || {};
    const k = 'g:' + q.toLowerCase() + '|' + (e.localidad || ''); if (cacheGeo.has(k)) return cacheGeo.get(k);
    const { calle, altura } = partirDir(q);
    const lugar = q.includes(',') ? q.split(',').slice(1).join(',').trim() : '';
    const [conocida, gr, osm1, goo] = await Promise.all([
      altura && !lugar ? rpc('r_dir_buscar', null, { q }, {}).catch(() => null) : null,
      calle ? georef(calle, altura, lugar || e.localidad).catch(() => []) : [],
      nominatim(lugar ? q : q + (e.localidad ? ', ' + e.localidad : '')).catch(() => []),
      googleBuscar(lugar ? q : q + (e.localidad ? ', ' + e.localidad : '')).catch(() => []),
    ]);
    let osm = osm1;
    if (!osm.length) osm = await nominatim(q).catch(() => []);
    if (!osm.length && altura && calle) osm = await nominatim(calle + (lugar ? ', ' + lugar : '')).catch(() => []);
    const deOsm = osm.map(x => {
      const a = x.address || {}, conNumero = !!a.house_number;
      const dir = conNumero ? `${a.road} ${a.house_number}` : (a.road ? (altura ? `${a.road} ${altura}` : a.road) : x.display_name.split(',')[0]);
      return { nombre: x.display_name, direccion: dir, localidad: a.city || a.town || a.village || a.municipality || a.county || '', provincia: a.state || '', lat: +x.lat, lng: +x.lon, aprox: !conNumero && !!altura };
    });
    const out = [...goo, ...gr, ...deOsm];
    if (conocida) out.unshift({ direccion: `${conocida.calle} ${conocida.altura}`, localidad: conocida.localidad || e.localidad, provincia: e.provincia, lat: conocida.lat, lng: conocida.lng, conocida: conocida.precision, aprox: conocida.precision !== 'exacta' });
    const vistos = new Set(); const fin = out.filter(x => { const kk = sinTildes(x.direccion) + '|' + sinTildes(x.localidad); if (vistos.has(kk)) return false; vistos.add(kk); return true; });
    cacheGeo.set(k, fin); return fin;
  }
  // Ruta por calles (OSRM público): devuelve { coords:[[lat,lng]…], metros, minutos } o null si no hay servicio.
  const cacheRuta = new Map();
  async function ruta(o, d) {
    if (!o || !d) return null;
    const k = [o.lat, o.lng, d.lat, d.lng].map(x => (+x).toFixed(5)).join(','); if (cacheRuta.has(k)) return cacheRuta.get(k);
    let out = null;
    // 1) OpenRouteService (si hay clave en config.js → orsKey; o servidor propio en orsUrl)
    if (CFG.orsKey || CFG.orsUrl) {
      try {
        const base = (CFG.orsUrl || 'https://api.openrouteservice.org').replace(/\/$/, '');
        const r = await fetch(base + '/v2/directions/driving-car/geojson', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(CFG.orsKey ? { Authorization: CFG.orsKey } : {}) }, body: JSON.stringify({ coordinates: [[+o.lng, +o.lat], [+d.lng, +d.lat]] }) });
        const j = await r.json(), f = j.features && j.features[0];
        if (f) out = { coords: f.geometry.coordinates.map(c => [c[1], c[0]]), metros: f.properties.summary.distance, minutos: f.properties.summary.duration / 60 };
      } catch { }
    }
    // 2) Respaldo: OSRM público
    if (!out) try {
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`);
      const j = await r.json(), x = j.routes && j.routes[0];
      if (x) out = { coords: x.geometry.coordinates.map(c => [c[1], c[0]]), metros: x.distance, minutos: x.duration / 60 };
    } catch { }
    if (out) cacheRuta.set(k, out); return out;
  }
  // Al tocar el mapa o usar el GPS: OpenStreetMap suele devolver sólo la calle. Si el sistema conoce una dirección
  // con altura a menos de 70 m sobre la misma calle, la propone; si no, avisa que falta la altura.
  async function geoInversa(lat, lng) {
    const k = `r:${(+lat).toFixed(5)},${(+lng).toFixed(5)}`; if (cacheGeo.has(k)) return cacheGeo.get(k);
    let out;
    const gi = await googleInversa(lat, lng).catch(() => null);
    if (gi && gi.direccion) { out = { direccion: gi.direccion, localidad: gi.localidad, provincia: gi.provincia }; if (gi.aprox) { out.sinAltura = !/\d/.test(gi.direccion); out.aprox = !out.sinAltura; } cacheGeo.set(k, out); return out; }
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

  window.RODAR = { SB, listo, rpc, llamar, whatsappEnviar, mercadopagoCrear, tiempoReal, csv, clima, geoBuscar, geoInversa, ruta, compDir, enTexto, partirDir, archivoADataURL, normalizar, ErrorApi, setEmpresa: e => empresaGeo = e };
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
    const mt = Math.max(0, (metros || 0) - (t.cortesia_mts || 0));
    const esp = t.con_espera ? precioTablaEspera(t.tabla, Math.max(0, (esperaSeg || 0) - (t.cortesia_min || 0) * 60)) : 0;
    // Viajes afuera: desde "desde_km" se cobra cada km a "precio_km" (independiente de la tabla)
    const af = t.tabla.afuera || {}, desde = parseFloat(af.desde_km), pk = parseFloat(af.precio_km);
    if (desde >= 0 && pk > 0 && mt >= desde * 1000) return Math.round((Math.ceil(mt / 100) / 10 * pk + esp) * ind);
    return Math.round((precioTablaKm(t.tabla, mt) + esp) * ind);
  }
  const red = t.redondeo_mts || 100; let m = Math.max(0, (metros || 0) - (t.cortesia_mts || 0)); m = Math.ceil(m / red) * red;
  const fd = Math.floor(m / (t.ficha_mts || 100)); const fe = t.con_espera ? Math.floor(Math.max(0, (esperaSeg || 0) - (t.cortesia_min || 0) * 60) / (t.espera_seg || 60)) : 0;
  return Math.round(((+t.bajada || 0) + (fd + fe) * (+t.precio_ficha || 0)) * ind);
}
function resumenTarifa(t) {
  if (!t) return '—';
  if (t.tabla && t.tabla.km && t.tabla.km.length) { const k = t.tabla.km, af = t.tabla.afuera; return `Por tabla: ${k[0][0]} km ${pesos0(k[0][1])} … ${k[k.length - 1][0]} km ${pesos0(k[k.length - 1][1])} · espera por tramos de minutos${af && +af.precio_km > 0 ? ` · Viajes afuera: desde ${String(af.desde_km).replace('.', ',')} km, ${pesos0(af.precio_km)} por km` : ''}`; }
  return `Bajada ${pesos0(t.bajada)} · ficha ${pesos0(t.precio_ficha)} cada ${t.ficha_mts} m`;
}
// Distancias: se muestran redondeadas a un decimal (1.47 km -> 1.5 km).
function km1(x) { if (x == null || x === '' || isNaN(+x)) return '—'; return (Math.round(+x * 10) / 10).toFixed(1); }

// Ticket imprimible, el mismo para el panel, la app del conductor y la del pasajero.
// v: datos del viaje. o.empresa: datos de la empresa. o.cliente: nombre del pasajero (opcional). o.auto: abre el diálogo de impresión solo.
function ticketHtml(v, o = {}) {
  const x = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fh = t => { const m = String(t || '').match(/(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : (t || '—'); };
  const hh = t => { const m = String(t || '').match(/(\d\d):(\d\d)/); return m ? m[0] : '—'; };
  const e = o.empresa || v.empresa || {};
  const logo = new URL('img/logo.png', location.href).href;
  const total = v.monto != null ? v.monto : v.monto_estimado;
  const medio = String(v.medio_pago || 'efectivo').replace(/_/g, ' '); const medioTxt = medio.charAt(0).toUpperCase() + medio.slice(1);
  const fila = (l, val) => val == null || val === '' ? '' : `<div class="f"><span>${l}</span><b>${x(val)}</b></div>`;
  const movil = v.movil_numero ? ['N° ' + v.movil_numero, v.movil_patente || v.patente, v.movil].filter(Boolean).join(' · ') : '';
  // El logo ya muestra el nombre: la razón social solo se agrega si es distinta del nombre de fantasía.
  const mismo = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const linea2 = [mismo(e.razon_social, e.nombre) ? '' : e.razon_social, e.cuit ? 'CUIT ' + e.cuit : ''].filter(Boolean).join(' · ');
  const linea3 = [e.direccion, e.localidad].filter(Boolean).join(', ');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ticket de viaje #${x(v.id)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eef2f4;font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#1d2a2b;font-size:14px}
.barra{max-width:380px;margin:14px auto 0;text-align:right;padding:0 12px}.barra button{background:#215181;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-size:15px;cursor:pointer}
.t{max-width:380px;margin:12px auto 24px;background:#fff;border-radius:10px;padding:20px 18px;box-shadow:0 6px 24px rgba(0,0,0,.12)}
.cab{text-align:center}.cab img{max-height:72px;max-width:80%;object-fit:contain}.cab h1{font-size:18px;margin:8px 0 2px}.cab p{margin:0;font-size:12px;color:#5b6b6b;line-height:1.4}
.tit{text-align:center;font-weight:800;letter-spacing:.6px;font-size:13px;margin:14px 0 2px}.num{text-align:center;font-size:22px;font-weight:800;color:#215181}
.sep{border:0;border-top:2px dashed #b9c6c8;margin:12px 0}
.f{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #eef2f3}.f span{color:#5b6b6b;flex:0 0 36%}.f b{font-weight:600;text-align:right;word-break:break-word}
.tot{display:flex;justify-content:space-between;align-items:baseline;margin-top:6px;padding:10px 12px;background:#eef5fb;border-radius:8px}.tot span{font-weight:700}.tot b{font-size:26px;color:#215181}
.pie{text-align:center;font-size:12px;color:#5b6b6b;line-height:1.5;margin-top:14px}.pie b{display:block;color:#1d2a2b;font-size:13px;margin-bottom:2px}
@page{margin:8mm}
@media print{body{background:#fff}.barra{display:none}.t{box-shadow:none;margin:0 auto;border-radius:0;max-width:80mm;padding:4mm 2mm}}
</style></head><body>
<div class="barra"><button onclick="print()">Imprimir / Guardar PDF</button></div>
<div class="t">
  <div class="cab"><img src="${logo}" alt="${x(e.nombre || '')}"></div>
  <div class="tit">TICKET DE VIAJE</div><div class="num">N° ${x(v.id)}</div>
  <hr class="sep">
  ${fila('Fecha', fh(v.creado))}${o.cliente ? fila('Pasajero', o.cliente) : ''}${fila('Origen', v.origen_dir)}${fila('Destino', v.destino_dir || '—')}${fila('Móvil', movil)}${fila('Conductor', v.conductor)}
  ${fila('Inicio / fin', v.inicio_at || v.fin_at ? hh(v.inicio_at) + ' / ' + hh(v.fin_at) : '')}${fila('Distancia', v.km != null ? km1(v.km) + ' km' : '')}${v.minutos ? fila('Duración', Math.round(v.minutos) + ' min') : ''}${fila('Forma de pago', medioTxt)}
  <hr class="sep">
  <div class="tot"><span>TOTAL</span><b>${total != null ? '$ ' + Number(total).toLocaleString('es-AR', { maximumFractionDigits: 0 }) : '—'}</b></div>
  <div class="pie"><b>¡Gracias por viajar con nosotros!</b>Comprobante no válido como factura.</div>
</div>
${o.auto ? `<script>(function(){var im=document.images[0],ok=false;function p(){if(ok)return;ok=true;setTimeout(function(){try{window.focus();window.print()}catch(e){}},200)}if(!im||im.complete)p();else{im.onload=p;im.onerror=p;setTimeout(p,2500)}})()<\/script>` : ''}
</body></html>`;
}
function abrirTicket(w, v, o) { w.document.open(); w.document.write(ticketHtml(v, o)); w.document.close(); }

function pesos0(n) { return n == null || n === '' ? '—' : '$ ' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 }); }
