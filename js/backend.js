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
    ['GET', '/api/reservas', 'r_reservas_cfg'], ['GET', '/api/informes/corporativos', 'r_inf_corporativos'], ['GET', '/api/sos', 'r_sos'], ['POST', '/api/sos/:id/atender', 'r_sos_atender'], ['POST', '/api/pub/sos', 'r_pub_sos'], ['POST', '/api/reservas/:op', 'r_reservas_guardar'], ['GET', '/api/seguridad', 'r_seguridad'], ['POST', '/api/seguridad', 'r_seguridad_guardar'], ['GET', '/api/simulador', 'r_simulador'], ['POST', '/api/simulador', 'r_simulador_guardar'], ['GET', '/api/config/webhook', 'r_config_webhook'],
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
    ['GET', '/api/corporativos', 'r_corporativos'], ['POST', '/api/corporativos', 'r_corporativo_guardar'], ['POST', '/api/corporativos/:id/estado', 'r_corporativo_estado'], ['GET', '/api/corp-cuentas', 'r_corp_cuentas'], ['GET', '/api/corp-cuentas/:id', 'r_corp_cuenta'], ['POST', '/api/corp-cuentas/:id/liquidar', 'r_corp_liquidar'], ['POST', '/api/corp-cuentas/:id/:op', 'r_corp_cuenta_op'], ['GET', '/api/emp/cuenta', 'r_emp_cuenta'], ['GET', '/api/cc-sin-empresa', 'r_cc_sin_empresa'], ['POST', '/api/cc-sin-empresa', 'r_cc_sin_empresa'],
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
    ['POST', '/api/pub/viaje/:id/cancelar', 'r_pub_cancelar'], ['GET', '/api/emp/inicio', 'r_emp_inicio'], ['POST', '/api/emp/pedir', 'r_emp_pedir'], ['GET', '/api/emp/activos', 'r_emp_activos'], ['GET', '/api/emp/viajes', 'r_emp_viajes'], ['POST', '/api/emp/viajes/:id/cancelar', 'r_emp_cancelar'], ['POST', '/api/emp/pasajero', 'r_emp_pasajero'], ['POST', '/api/emp/lugar', 'r_emp_lugar'], ['GET', '/api/cli/tyc', 'r_cli_tyc'], ['POST', '/api/cli/tyc', 'r_cli_tyc'], ['GET', '/api/conductor/tyc', 'r_cond_tyc'], ['POST', '/api/conductor/tyc', 'r_cond_tyc'], ['GET', '/api/pub/viaje/:id/mp', 'r_pub_mp'], ['GET', '/api/conductor/mp', 'r_cond_mp'], ['POST', '/api/conductor/mp', 'r_cond_mp'],
    ['POST', '/api/cli/registro', 'r_cli_registro'], ['POST', '/api/cli/login', 'r_cli_login'], ['POST', '/api/cli/logout', 'r_cli_logout'], ['POST', '/api/cli/olvide', 'r_cli_olvide'],
    ['GET', '/api/cli/push', 'r_cli_push'], ['POST', '/api/cli/push', 'r_cli_push'], ['GET', '/api/cli/perfil', 'r_cli_perfil'], ['PUT', '/api/cli/perfil', 'r_cli_perfil_guardar'], ['GET', '/api/cli/viajes', 'r_cli_viajes'], ['POST', '/api/cli/viaje', 'r_cli_viaje'],
    ['POST', '/api/cli/viajes/:id/cancelar', 'r_cli_cancelar'], ['GET', '/api/cli/viajes/:id/cancelar-previa', 'r_cli_cancelar_previa'], ['GET', '/api/pub/viaje/:id/cancelar-previa', 'r_cli_cancelar_previa'], ['GET', '/api/pub/reservas', 'r_pub_reservas'], ['GET', '/api/cli/cargos', 'r_cli_cargos'], ['POST', '/api/cli/lugares', 'r_cli_lugar_guardar'], ['POST', '/api/cli/lugares/:id/quitar', 'r_cli_lugar_quitar'],
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
    // errores devueltos como dato (p. ej. intentos de inicio de sesión: así el intento fallido queda registrado)
    if (data && typeof data === 'object' && !Array.isArray(data) && typeof data.__error === 'string') throw new ErrorApi(data.__error, { status: 400 });
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
  // canal: 'whatsapp' o 'telegram' (cada uno tiene su función de Supabase con el mismo formato)
  async function whatsappEnviar(token, convId, texto, canal = 'whatsapp') {
    if (!SB) throw new ErrorApi('Falta configurar Supabase.');
    const nom = canal === 'telegram' ? 'Telegram' : 'WhatsApp';
    let r;
    try {
      r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/functions/v1/' + (canal === 'telegram' ? 'telegram' : 'whatsapp'), { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey }, body: JSON.stringify({ accion: 'enviar', token, conv_id: convId, texto }) });
    } catch { throw new ErrorApi('Sin conexión con el servidor. Revisá internet.', { noConectado: true }); }
    let j = {}; try { j = await r.json(); } catch { }
    if (r.status === 404) throw new ErrorApi(`La función de ${nom} todavía no está instalada en Supabase.`, { noConectado: true });
    if (!r.ok) throw new ErrorApi(j.error || 'No se pudo enviar por ' + nom, { noConectado: r.status === 503 });
    return j;
  }
  // Bot de Telegram (solo administrador): accion = 'estado' | 'conectar' | 'desconectar'
  async function telegramAdmin(token, accion) {
    let r;
    try { r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/functions/v1/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey }, body: JSON.stringify({ accion, token }) }); }
    catch { throw new ErrorApi('Sin conexión con el servidor. Revisá internet.'); }
    let j = {}; try { j = await r.json(); } catch { }
    if (r.status === 404) return { instalada: false };
    if (!r.ok && !j.configurado) throw new ErrorApi(j.error || 'No se pudo consultar Telegram');
    return { instalada: true, ...j };
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

  // ---- Captcha invisible (Cloudflare Turnstile) para el registro y el pedido web sin cuenta ----
  // Si el captcha está activado en el panel, resuelve el desafío (casi siempre sin que la persona haga nada),
  // lo verifica en la función "captcha" de Supabase y devuelve un pase de un solo uso. Si está desactivado devuelve null.
  let capCfg = null, capScript = null;
  function cargarTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (!capScript) capScript = new Promise((ok, mal) => {
      const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
      s.onload = () => ok(); s.onerror = () => { capScript = null; mal(new ErrorApi('No se pudo cargar la verificación anti-robots. Revisá la conexión y probá de nuevo.')); };
      document.head.append(s);
    });
    return capScript;
  }
  async function captcha(accion) {
    if (!capCfg) { try { capCfg = await rpc('r_pub_captcha'); } catch { capCfg = null; return null; } }
    if (!capCfg || !capCfg.activo || !capCfg.site_key) return null;
    await cargarTurnstile();
    const caja = document.createElement('div');
    caja.style.cssText = 'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9000';
    document.body.append(caja);
    let wid = null;
    try {
      const tok = await new Promise((ok, mal) => {
        const t = setTimeout(() => mal(new ErrorApi('La verificación anti-robots tardó demasiado. Probá de nuevo.')), 90000);
        wid = window.turnstile.render(caja, { sitekey: capCfg.site_key, action: accion, appearance: 'interaction-only', language: 'es',
          callback: x => { clearTimeout(t); ok(x); }, 'error-callback': () => { clearTimeout(t); mal(new ErrorApi('No pudimos confirmar que no sos un robot. Probá de nuevo.')); },
          'expired-callback': () => { clearTimeout(t); mal(new ErrorApi('La verificación venció. Probá de nuevo.')); } });
      });
      const r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/functions/v1/captcha', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey }, body: JSON.stringify({ token: tok, accion }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.pase) throw new ErrorApi(d.error || 'No pudimos confirmar que no sos un robot. Probá de nuevo.');
      return d.pase;
    } finally { try { if (wid != null) window.turnstile.remove(wid); } catch { } caja.remove(); }
  }

  window.RODAR = { SB, listo, rpc, llamar, captcha, whatsappEnviar, telegramAdmin, mercadopagoCrear, tiempoReal, csv, clima, geoBuscar, geoInversa, ruta, compDir, enTexto, partirDir, archivoADataURL, normalizar, ErrorApi, setEmpresa: e => empresaGeo = e };
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
    if (desde >= 0 && pk > 0 && mt >= desde * 1000) return Math.round((Math.ceil(mt / 1000) * pk + esp) * ind); // km entero hacia arriba
    return Math.round((precioTablaKm(t.tabla, mt) + esp) * ind);
  }
  const red = t.redondeo_mts || 100; let m = Math.max(0, (metros || 0) - (t.cortesia_mts || 0)); m = Math.ceil(m / red) * red;
  const fd = Math.floor(m / (t.ficha_mts || 100)); const fe = t.con_espera ? Math.floor(Math.max(0, (esperaSeg || 0) - (t.cortesia_min || 0) * 60) / (t.espera_seg || 60)) : 0;
  return Math.round(((+t.bajada || 0) + (fd + fe) * (+t.precio_ficha || 0)) * ind);
}
function resumenTarifa(t) {
  if (!t) return '—';
  if (t.tabla && t.tabla.km && t.tabla.km.length) { const k = t.tabla.km, af = t.tabla.afuera; return `Por tabla: ${k[0][0]} km ${pesos0(k[0][1])} … ${k[k.length - 1][0]} km ${pesos0(k[k.length - 1][1])} · espera por tramos de minutos${af && +af.precio_km > 0 ? ` · Viajes afuera: desde ${String(af.desde_km).replace('.', ',')} km, ${pesos0(af.precio_km)} por km entero` : ''}${t.tabla.correccion_pct ? ` · GPS +${String(t.tabla.correccion_pct).replace('.', ',')}%` : ''}`; }
  return `Bajada ${pesos0(t.bajada)} · ficha ${pesos0(t.precio_ficha)} cada ${t.ficha_mts} m`;
}
// Distancias: se muestran redondeadas a un decimal (1.47 km -> 1.5 km).
function km1(x) { if (x == null || x === '' || isNaN(+x)) return '—'; return (Math.round(+x * 10) / 10).toFixed(1); }

// Datos del móvil y del conductor para el ticket / comprobante (lo que haya cargado)
function datosMovil(v, conDni) {
  const marcaMod = [v.movil_marca, v.movil_modelo].filter(Boolean).join(' ') || v.movil || '';
  return {
    numero: v.movil_numero || '', conductor: v.conductor || '', dni: conDni ? v.conductor_documento || '' : '',
    vehiculo: [marcaMod, v.movil_anio].filter(Boolean).join(' · '), color: v.movil_color || '',
    patente: String(v.movil_patente || v.patente || '').toUpperCase(), licencia: conDni ? v.movil_licencia || '' : '',   // licencia y DNI: solo conductor y panel
  };
}
// Ticket imprimible, el mismo para el panel, la app del conductor y la del pasajero.
// v: datos del viaje. o.empresa: datos de la empresa. o.cliente: nombre del pasajero (opcional). o.auto: abre el diálogo de impresión solo.
function ticketHtml(v, o = {}) {
  // Mismo diseño que el comprobante de la pantalla (y que el PDF de Compartir), listo para imprimir o guardar como PDF.
  const numero = !(o.sinNumero || v._sinNumero);
  const card = cpCardHtml(v, { numero, cliente: o.cliente || v._cliente, empresa: o.empresa || v.empresa, logo: new URL('img/logo-blanco.png', location.href).href });
  const tit = numero ? 'Ticket de viaje N° ' + cpEsc(v.id) : 'Comprobante de viaje';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${tit}</title>
<style>${CP_CSS}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
html,body{margin:0;background:#eef2f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
.barra{max-width:420px;margin:14px auto 0;text-align:right;padding:0 14px}.barra button{background:#215181;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-size:15px;font-weight:700;cursor:pointer}
.hoja{max-width:420px;margin:12px auto 24px;padding:0 14px}.hoja .cp{margin:0}
@page{size:A4;margin:10mm}
@media print{html,body{background:#fff}.barra{display:none}.hoja{margin:0 auto;max-width:105mm;padding:0}.hoja .cp{box-shadow:none;border:1px solid #e3e9ef;break-inside:avoid}}
</style></head><body>
<div class="barra"><button onclick="print()">Imprimir / Guardar PDF</button></div>
<div class="hoja">${card}</div>
${o.auto ? `<script>(function(){var ims=[].slice.call(document.images),n=ims.length,ok=false;function p(){if(ok)return;ok=true;setTimeout(function(){try{window.focus();window.print()}catch(e){}},250)}function u(){if(--n<=0)p()}if(!n)p();ims.forEach(function(i){if(i.complete)u();else{i.onload=u;i.onerror=u}});setTimeout(p,2500)})()<\/script>` : ''}
</body></html>`;
}
// ===================== Comprobante de viaje (app del pasajero y del conductor) =====================
const CP_CSS = `.cp-desg{margin:0 18px 4px;padding:8px 12px;background:#f6f8fb;border-radius:12px;font-size:13.5px;color:#33475b} .cp-dl{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:3px 0} .cp-dl b{color:#0f2740;white-space:nowrap} .cp-info summary{display:block;list-style:none;cursor:pointer} .cp-info summary::-webkit-details-marker,.cp-info summary::marker{display:none;content:''} .cp-dl>span{display:inline-block;min-width:0;text-align:left} .cp-i{display:inline-block;width:17px;height:17px;line-height:17px;text-align:center;border-radius:50%;background:#2a86e8;color:#fff;font:italic 700 11.5px/17px Georgia,serif;margin-left:6px;vertical-align:middle} .cp-info p{margin:4px 0 2px;padding:7px 10px;background:#e8f1fc;color:#1d4f86;border-radius:9px;font-size:12.5px;line-height:1.4} .cp-cargo{display:block;margin-top:8px;font-style:normal;font-size:12.5px;color:#9b5b00;background:#fff4e5;border-radius:10px;padding:5px 10px} .cp-dlg{position:fixed;inset:0;z-index:7000;background:rgba(10,25,45,.6);display:flex;align-items:center;justify-content:center;padding:16px} .cp-dlg-c{background:#fff;width:100%;max-width:420px;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:cpIn .2s ease-out;color:#0f2740;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif} .cp-dlg-h{background:linear-gradient(135deg,#183c62,#215181);color:#fff;text-align:center;padding:18px 16px 14px} .cp-dlg-h .e{font-size:34px} .cp-dlg-h h3{margin:4px 0 0;font-size:19px} .cp-dlg-b{padding:16px 18px 6px;font-size:15px;line-height:1.5;color:#33475b} .cp-dlg-b ul{margin:8px 0;padding-left:0;list-style:none} .cp-dlg-b li{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:12px;margin:6px 0;background:#f4f7fa} .cp-dlg-b li b{color:#0f2740} .cp-dlg-b li.v{background:#eaf7ee} .cp-dlg-b li.a{background:#fff6e5} .cp-dlg-b li.r{background:#fdeeee} .cp-dlg-b .t{font-size:20px;line-height:1.2} .cp-dlg-b .nota{font-size:13px;color:#6b7c8c;margin:8px 0} .cp-dlg-b .monto{font-size:30px;font-weight:900;color:#b42323;text-align:center;margin:6px 0} .cp-dlg-f{display:flex;flex-direction:column;gap:6px;padding:12px 18px 18px} .cp-dlg-f button{border:0;border-radius:14px;padding:14px;font:inherit;font-size:16px;font-weight:800;cursor:pointer} .cp-dlg-f .si{background:#5fa52f;color:#fff} .cp-dlg-f .si.rojo{background:#d64545} .cp-dlg-f .no{background:none;color:#6b7c8c;font-weight:700;font-size:14.5px;padding:8px} .cp-mov{display:flex;gap:12px;align-items:stretch} .cp-mov-n{flex:0 0 74px;border-radius:14px;background:linear-gradient(135deg,#183c62,#215181);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 4px} .cp-mov-n small{font-size:10.5px;letter-spacing:.6px;text-transform:uppercase;opacity:.8;font-weight:700} .cp-mov-n b{font-size:30px;line-height:1.1} .cp-mov-d{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px} .cp-mov-c{display:flex;gap:8px;align-items:flex-start} .cp-mov-c>span{font-size:17px;line-height:1.2} .cp-mov-c small{display:block;font-size:11px;color:#6b7c8c;font-weight:700;text-transform:uppercase;letter-spacing:.4px} .cp-mov-c b{display:block;font-size:14.5px;color:#0f2740;word-break:break-word} .cp-mov-c em{display:block;font-style:normal;font-size:12.5px;color:#5b6b7b} .cp-mov-t{display:flex;flex-wrap:wrap;gap:6px;align-items:center} .cp-pat{display:inline-block;border:2px solid #0f2740;border-top:6px solid #1f4e9c;border-radius:6px;padding:1px 9px;font:800 14px/1.3 ui-monospace,Menlo,Consolas,monospace;letter-spacing:1.5px;color:#0f2740;background:#fff} .cp-lic{font-size:12.5px;font-weight:700;color:#33475b;background:#eef2f6;border-radius:999px;padding:3px 10px} .cp-ov{position:fixed;inset:0;z-index:5500;background:#eef2f6;display:flex;flex-direction:column;animation:cpIn .2s ease-out} @keyframes cpIn{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}} .cp-bar{display:flex;align-items:center;gap:10px;padding:10px 12px;padding-top:calc(10px + env(safe-area-inset-top));background:#0f2740;color:#fff} .cp-bar b{flex:1;font-size:17px}.cp-bar span{width:38px} .cp-vol{width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:26px;line-height:1;cursor:pointer} .cp-scroll{flex:1;overflow:auto;padding:16px 14px 20px} .cp{max-width:440px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,39,64,.12)} .cp-cab{background:linear-gradient(135deg,#183c62,#215181);color:#fff;text-align:center;padding:18px 16px 22px;position:relative} .cp-cab img{height:38px;width:auto;opacity:.95} .cp-ok{width:46px;height:46px;border-radius:50%;background:#7ac143;color:#fff;font-size:26px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:12px auto 6px;box-shadow:0 0 0 6px rgba(122,193,67,.25)} .cp-cab h3{margin:4px 0 2px;font-size:19px}.cp-cab small{opacity:.8} .cp-num{display:table;margin:8px auto 0;background:rgba(255,255,255,.16);border-radius:999px;padding:3px 12px;font-weight:800;font-size:13px;letter-spacing:.3px} .cp-tot{text-align:center;padding:16px 16px 12px}.cp-tot small{display:block;color:#6b7c8c;font-size:13px} .cp-tot b{display:block;font-size:38px;font-weight:900;color:#0f2740;letter-spacing:-.5px;margin:2px 0 8px} .cp-pago{display:inline-block;background:#eef2f6;color:#33475b;border-radius:999px;padding:4px 12px;font-size:13px;font-weight:700}.cp-pago.ok{background:#e3f6e8;color:#1b6e31} .cp-corte{height:22px;position:relative;margin:0 -1px} .cp-corte::before{content:'';position:absolute;left:22px;right:22px;top:10px;border-top:2px dashed #d5dee6} .cp-corte::after{content:'';position:absolute;left:-11px;right:-11px;top:0;height:22px;background:radial-gradient(circle at 11px 11px,#eef2f6 10.5px,transparent 11px) left/100% 100% no-repeat,radial-gradient(circle at calc(100% - 11px) 11px,#eef2f6 10.5px,transparent 11px) left/100% 100% no-repeat} .cp-sec{padding:12px 18px;border-bottom:1px solid #eef2f6} .cp-ruta{position:relative;display:flex;flex-direction:column;gap:12px} .cp-ruta>div{position:relative;padding-left:24px}.cp-ruta small{display:block;color:#6b7c8c;font-size:11.5px;text-transform:uppercase;letter-spacing:.4px}.cp-ruta b{font-size:14.5px;color:#0f2740} .cp-ruta i{position:absolute;left:3px;top:4px;width:12px;height:12px;border-radius:50%}.cp-ruta i.o{background:#2f9e57;box-shadow:0 0 0 3px #dff3e6}.cp-ruta i.d{background:#2a86e8;box-shadow:0 0 0 3px #dcebfb} .cp-ruta>div:first-child:not(:last-child)::after{content:'';position:absolute;left:8px;top:20px;bottom:-12px;border-left:2px dotted #b9c6d2} .cp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 10px} .cp-d{display:flex;gap:8px;align-items:flex-start;min-width:0}.cp-d>span{width:30px;height:30px;flex:none;border-radius:9px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:15px} .cp-d div{min-width:0}.cp-d small{display:block;color:#6b7c8c;font-size:11.5px}.cp-d b{display:block;font-size:13.5px;color:#0f2740;word-break:break-word} .cp-cal{display:flex;justify-content:space-between;align-items:center;color:#33475b;font-size:14px}.cp-cal b{color:#f5a623;font-size:18px;letter-spacing:2px}.cp-cal i{color:#d5dee6;font-style:normal} .cp-pie{text-align:center;padding:16px;color:#33475b;font-weight:700}.cp-pie small{font-weight:400;color:#8696a5} .cp-acc{display:flex;gap:10px;padding:12px 14px;padding-bottom:calc(12px + env(safe-area-inset-bottom));background:#fff;box-shadow:0 -4px 14px rgba(0,0,0,.06)} .cp-acc .btn{flex:1;margin:0} .cp-pdf .cp-corte::after{display:none} .cp-sh{position:fixed;inset:0;z-index:6000;background:rgba(10,20,30,.45);display:flex;align-items:flex-end;justify-content:center;animation:cpIn .15s} .cp-sh>div{background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom))} .cp-sh h4{margin:2px 4px 12px;font-size:16px;color:#0f2740} .cp-sh-g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px} .cp-sh-g a,.cp-sh-g button{display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;padding:8px 2px;font:inherit;font-size:12.5px;color:#33475b;text-decoration:none;cursor:pointer;border-radius:12px} .cp-sh-g a:active,.cp-sh-g button:active{background:#f1f5f9} .cp-sh-g i{width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:24px;color:#fff} .cp-sh-x{display:block;width:100%;margin-top:12px;border:0;background:#eef2f6;border-radius:12px;padding:12px;font:inherit;font-weight:700;color:#33475b;cursor:pointer}`;
function cpEstilos() { if (document.getElementById('cp-css')) return; const s = document.createElement('style'); s.id = 'cp-css'; s.textContent = CP_CSS; document.head.append(s); }
function cpNativo() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
// Diálogo simple (mismo estilo que el comprobante). Devuelve true si toca el botón principal.
function cpDialogo(o) {
  cpEstilos();
  return new Promise(res => {
    const d = document.createElement('div'); d.className = 'cp-dlg';
    d.innerHTML = `<div class="cp-dlg-c" role="dialog" aria-modal="true"><div class="cp-dlg-h">${o.icono ? `<div class="e">${o.icono}</div>` : ''}<h3>${cpEsc(o.titulo || '')}</h3></div>
      <div class="cp-dlg-b">${o.html || ''}</div><div class="cp-dlg-f"><button class="si ${o.peligro ? 'rojo' : ''}">${cpEsc(o.si || 'Aceptar')}</button>${o.no === false ? '' : `<button class="no">${cpEsc(o.no || 'Volver')}</button>`}</div></div>`;
    const fin = r => { d.remove(); res(r); };
    d.querySelector('.si').onclick = () => fin(true); const n = d.querySelector('.no'); if (n) n.onclick = () => fin(false);
    d.onclick = e => { if (e.target === d) fin(false); };
    document.body.append(d);
  });
}
function cpEsc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function cpPesos(n) { return n == null || n === '' ? '—' : '$ ' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 }); }
// Compartir: en la app usa el menú de Android (plugin Share); en el navegador, el del sistema; si no hay, un menú propio
async function compartirTexto(titulo, texto) {
  const SH = cpNativo() && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
  if (SH) { try { await SH.share({ title: titulo, text: texto, dialogTitle: 'Compartir comprobante' }); return; } catch (e) { if (/cancel/i.test(String(e && (e.message || e)))) return; } }
  if (navigator.share && !cpNativo()) { try { await navigator.share({ title: titulo, text: texto }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  cpEstilos(); document.querySelectorAll('.cp-sh').forEach(x => x.remove());
  const t = encodeURIComponent(texto), sh = document.createElement('div'); sh.className = 'cp-sh';
  sh.innerHTML = `<div><h4>Compartir comprobante</h4><div class="cp-sh-g">
    <a href="https://wa.me/?text=${t}" target="_blank" rel="noopener"><i style="background:#25d366">💬</i>WhatsApp</a>
    <a href="https://t.me/share/url?url=${encodeURIComponent('https://remisestoque.com')}&text=${t}" target="_blank" rel="noopener"><i style="background:#2aa3e0">✈️</i>Telegram</a>
    <a href="mailto:?subject=${encodeURIComponent(titulo)}&body=${t}"><i style="background:#ea7a2f">✉️</i>Correo</a>
    <button type="button" data-cp="copiar"><i style="background:#5b6b7b">📋</i>Copiar</button></div>
    <button class="cp-sh-x" type="button">Cancelar</button></div>`;
  document.body.append(sh);
  const fuera = () => sh.remove();
  sh.onclick = e => { if (e.target === sh) fuera(); };
  sh.querySelector('.cp-sh-x').onclick = fuera;
  sh.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setTimeout(fuera, 300)));
  sh.querySelector('[data-cp=copiar]').onclick = async () => {
    try { await navigator.clipboard.writeText(texto); } catch { const ta = document.createElement('textarea'); ta.value = texto; document.body.append(ta); ta.select(); try { document.execCommand('copy'); } catch { } ta.remove(); }
    fuera(); if (typeof toast === 'function') toast('Comprobante copiado', 'ok');
  };
}
// PDF del comprobante con el mismo formato que se ve en pantalla (html2canvas + jsPDF, cargados recién al usarlos)
const CP_BASE = (document.currentScript && document.currentScript.src || '').replace(/js\/backend\.js.*$/, '');
let cpLibs = null;
function cpCargarLibs() {
  if (cpLibs) return cpLibs;
  const sc = src => new Promise((ok, mal) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = mal; document.head.append(s); });
  cpLibs = Promise.all([window.html2canvas ? null : sc(CP_BASE + 'vendor/pdf/html2canvas.min.js'), window.jspdf ? null : sc(CP_BASE + 'vendor/pdf/jspdf.umd.min.js')])
    .catch(e => { cpLibs = null; throw e; });
  return cpLibs;
}
// ===================== PDF sobre la hoja membretada (A4) — panel y app de empresas =====================
// La hoja (img/membrete-a4.jpg) tiene el logo arriba y las franjas abajo: el contenido va entre 44 mm y 258 mm.
// o: { titulo, derecha:[etiqueta, valor], sub, cajas:[[l, v, color]], cols, filas, vacio, pie } o, para varias tablas,
//    tablas: [{ titulo, cols, filas, vacio, pie }]. Cada fila: { v:[...], col:[...] }. Columnas: { t, w, r }.
let membreteImg = null;
function cargarMembrete() {
  if (membreteImg) return membreteImg;
  membreteImg = new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => { membreteImg = null; mal(new Error('No se pudo cargar la hoja membretada')); }; i.src = CP_BASE + 'img/membrete-a4.jpg?v=1'; });
  return membreteImg;
}
async function pdfMembretado(o) {
  const [img] = await Promise.all([cargarMembrete(), cpCargarLibs()]);
  const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const AZ = [33, 81, 129], VE = [111, 176, 52], RO = [190, 40, 40], GR = [96, 110, 124], TX = [24, 38, 52], X0 = 18, X1 = 192, TOP = 44, BOT = 256;
  const col = c => c === 'rojo' ? RO : c === 'verde' ? VE : c === 'azul' ? AZ : TX;
  const hoja = () => pdf.addImage(img, 'JPEG', 0, 0, 210, 297, 'membrete', 'FAST');
  const nueva = () => { pdf.addPage(); hoja(); y = TOP; };
  hoja();
  let y = TOP;
  // Encabezado: título, número a la derecha y datos
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17); pdf.setTextColor(...AZ); pdf.text(o.titulo, X0, y + 6);
  if (o.derecha) {
    pdf.setFillColor(...AZ); pdf.roundedRect(X1 - 34, y - 1, 34, 15, 2.5, 2.5, 'F'); pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(7.5); pdf.text(o.derecha[0], X1 - 17, y + 4, { align: 'center' }); pdf.setFontSize(14); pdf.text(o.derecha[1], X1 - 17, y + 11.3, { align: 'center' });
  }
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...GR);
  const sub = pdf.splitTextToSize(o.sub || '', X1 - X0 - 40); pdf.text(sub, X0, y + 12); y += 12 + sub.length * 4 + 3;
  pdf.setDrawColor(...VE); pdf.setLineWidth(.8); pdf.line(X0, y, X0 + 26, y); y += 5;
  // Cajas de resumen
  if (o.cajas && o.cajas.length) {
    const n = o.cajas.length, gap = 3, w = (X1 - X0 - gap * (n - 1)) / n;
    o.cajas.forEach(([l, v, c], i) => {
      const x = X0 + i * (w + gap);
      pdf.setFillColor(244, 247, 250); pdf.setDrawColor(222, 229, 236); pdf.setLineWidth(.25); pdf.roundedRect(x, y, w, 17, 2, 2, 'FD');
      pdf.setFillColor(...(c ? col(c) : AZ)); pdf.rect(x, y + 2, .9, 13, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.8); pdf.setTextColor(...GR); pdf.text(pdf.splitTextToSize(l, w - 5)[0], x + 3.5, y + 5.5);
      pdf.setFontSize(10.5); pdf.setTextColor(...col(c)); let ln = pdf.splitTextToSize(String(v), w - 6); if (ln.length > 1) { pdf.setFontSize(8); ln = pdf.splitTextToSize(String(v), w - 6).slice(0, 2); pdf.text(ln, x + 3.5, y + (ln.length > 1 ? 10.3 : 12.5)); } else pdf.text(ln[0], x + 3.5, y + 12.5);
    });
    y += 23;
  }
  // Tablas
  const tablas = o.tablas || [{ cols: o.cols, filas: o.filas, vacio: o.vacio, pie: o.pie }];
  tablas.forEach((t, ti) => {
    const cols = t.cols.map(c => ({ ...c })), tw = cols.reduce((a, c) => a + c.w, 0), k_ = (X1 - X0) / tw; cols.forEach(c => c.w *= k_);
    if (t.titulo) {
      if (y + 20 > BOT) nueva(); else if (ti) y += 4;
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5); pdf.setTextColor(...AZ); pdf.text(t.titulo, X0, y + 4); y += 7;
    }
    const cab = () => {
      pdf.setFillColor(...AZ); pdf.rect(X0, y, X1 - X0, 7, 'F'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(255, 255, 255);
      let x = X0; cols.forEach(c => { pdf.text(c.t.toUpperCase(), c.r ? x + c.w - 2 : x + 2, y + 4.7, c.r ? { align: 'right' } : undefined); x += c.w; }); y += 7;
    };
    if (y + 16 > BOT) nueva();
    cab();
    pdf.setFontSize(8.3);
    if (!t.filas.length) { pdf.setFont('helvetica', 'italic'); pdf.setTextColor(...GR); pdf.text(t.vacio || 'Sin datos.', X0 + 2, y + 6); y += 10; }
    t.filas.forEach((f, i) => {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.3);
      const lineas = f.v.map((v, k) => cols[k].r ? [String(v ?? '')] : pdf.splitTextToSize(String(v ?? ''), cols[k].w - 4).slice(0, 3));
      const h = Math.max(...lineas.map(l => l.length)) * 3.6 + 2.6;
      if (y + h > BOT) { nueva(); cab(); pdf.setFontSize(8.3); }
      if (f.total) { pdf.setFillColor(232, 239, 246); pdf.rect(X0, y, X1 - X0, h, 'F'); } else if (i % 2) { pdf.setFillColor(246, 248, 251); pdf.rect(X0, y, X1 - X0, h, 'F'); }
      let x = X0;
      lineas.forEach((l, k) => {
        const c = cols[k]; pdf.setFont('helvetica', c.r || f.total ? 'bold' : 'normal'); pdf.setTextColor(...(f.col && f.col[k] ? col(f.col[k]) : f.total ? AZ : TX));
        pdf.text(l, c.r ? x + c.w - 2 : x + 2, y + 4.3, c.r ? { align: 'right' } : undefined); x += c.w;
      });
      pdf.setDrawColor(228, 233, 239); pdf.setLineWidth(.2); pdf.line(X0, y + h, X1, y + h); y += h;
    });
    if (t.pie) { if (y + 9 > BOT) nueva(); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...AZ); pdf.text(t.pie, X1, y + 6, { align: 'right' }); y += 8; }
  });
  if (o.nota) { if (y + 10 > BOT) nueva(); pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.setTextColor(...GR); pdf.text(pdf.splitTextToSize(o.nota, X1 - X0), X0, y + 7); }
  // numeración de páginas
  const np = pdf.getNumberOfPages();
  for (let p = 1; p <= np; p++) { pdf.setPage(p); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(...GR); pdf.text(`Página ${p} de ${np}`, X1, 263, { align: 'right' }); }
  pdf.setProperties({ title: o.titulo + (o.derecha ? ' ' + o.derecha.join(' ') : ''), author: 'Remises TOQUE!' });
  return pdf;
}
// Muestra un PDF dentro de la misma pestaña (sin ventanas nuevas), con Descargar / Imprimir / Cerrar
const PDFV_CSS = `.pdfv{position:fixed;inset:0;z-index:8000;background:rgba(15,25,40,.72);display:flex;flex-direction:column;animation:pdfvIn .15s ease-out;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
@keyframes pdfvIn{from{opacity:0}to{opacity:1}}
.pdfv-b{display:flex;align-items:center;gap:8px;padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top));background:#0f2740;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.3)}
.pdfv-b b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdfv-k{border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:#fff;border-radius:9px;padding:8px 13px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap}
.pdfv-k.x{background:#fff;color:#0f2740;border-color:#fff}.pdfv-k.g{background:#5fa52f;border-color:#5fa52f;font-size:16px;padding:12px 20px}
.pdfv iframe{flex:1;border:0;width:min(1000px,100%);margin:14px auto;background:#fff;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.4)}
.pdfv-m{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:12px;font-size:16px;text-align:center;padding:20px}
@media (max-width:600px){.pdfv-b{flex-wrap:wrap}.pdfv-b b{flex-basis:100%}.pdfv iframe{margin:0;border-radius:0}}`;
// Compartir el PDF: en la app con los complementos de Capacitor, en el celular con el menú del sistema
async function pdfvCompartir(pdf, blob, nombre, titulo) {
  const P = cpNativo() && window.Capacitor.Plugins || {};
  if (cpNativo() && P.Filesystem && P.Share) {
    const w = await P.Filesystem.writeFile({ path: nombre, data: pdf.output('datauristring').split(',')[1], directory: 'CACHE' });
    try { await P.Share.share({ title: titulo, files: [w.uri], dialogTitle: 'Compartir PDF' }); } catch (e) { if (!/cancel/i.test(String(e && (e.message || e)))) throw e; }
    return true;
  }
  const f = new File([blob], nombre, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: titulo }); } catch (e) { if (e && e.name !== 'AbortError') throw e; } return true; }
  return false;
}
function verPdf(pdf, nombre, titulo) {
  if (!document.getElementById('pdfv-css')) { const s = document.createElement('style'); s.id = 'pdfv-css'; s.textContent = PDFV_CSS; document.head.append(s); }
  const blob = pdf.output('blob'), url = URL.createObjectURL(blob), tit = cpEsc(titulo || nombre);
  const vis = navigator.pdfViewerEnabled !== false && !/Android|iPhone|iPad/i.test(navigator.userAgent) && !cpNativo();
  const el = document.createElement('div'); el.className = 'pdfv';
  el.innerHTML = `<div class="pdfv-b"><b>📄 ${tit}</b><span style="flex:1"></span>
    <button class="pdfv-k" data-a="d">⬇ Descargar</button>${vis ? '<button class="pdfv-k" data-a="p">🖨 Imprimir</button>' : '<button class="pdfv-k" data-a="s">📤 Compartir</button>'}<button class="pdfv-k x" data-a="x">✕ Cerrar</button></div>
    ${vis ? `<iframe src="${url}#view=FitH" title="${tit}"></iframe>` : `<div class="pdfv-m"><div style="font-size:46px">📄</div><p style="margin:0"><b>${tit}</b><br>El PDF está listo.</p><button class="pdfv-k g" data-a="d">⬇ Descargar PDF</button></div>`}`;
  const cerrar = () => { el.remove(); document.removeEventListener('keydown', tecla, true); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const tecla = e => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(); } };
  document.addEventListener('keydown', tecla, true);
  el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'x') return cerrar();
    if (a === 's' || (a === 'd' && cpNativo())) { try { if (await pdfvCompartir(pdf, blob, nombre, titulo || nombre)) return; } catch { } }
    if (a === 'd' || a === 's') { const l = document.createElement('a'); l.href = url; l.download = nombre; document.body.append(l); l.click(); l.remove(); return; }
    const fr = el.querySelector('iframe'); try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { pdf.autoPrint(); fr.src = URL.createObjectURL(pdf.output('blob')); }
  });
  document.body.append(el);
}
async function comprobantePdf(el) {
  await cpCargarLibs();
  const caja = document.createElement('div');
  caja.style.cssText = 'position:fixed;left:-10000px;top:0;width:420px;padding:14px;background:#eef2f6';
  const cl = el.cloneNode(true); cl.classList.add('cp-pdf'); cl.style.margin = '0'; cl.style.boxShadow = 'none'; caja.append(cl); document.body.append(caja);
  // <details>/<summary> se pasan a bloques comunes: html2canvas (sobre todo en Android) no los alinea bien
  cl.querySelectorAll('details').forEach(d => { const nd = document.createElement('div'); nd.className = d.className;
    const sm = d.querySelector('summary'); if (sm) nd.append(...sm.childNodes);
    if (d.open) [...d.children].filter(x => x.tagName !== 'SUMMARY').forEach(x => nd.append(x));
    d.replaceWith(nd); });
  await Promise.all([...caja.querySelectorAll('img')].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
  try {
    const cv = await window.html2canvas(caja, { scale: 2, backgroundColor: '#eef2f6', useCORS: true, logging: false });
    const ancho = 100, alto = ancho * cv.height / cv.width; // mm: tira tipo ticket
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: [ancho, alto], orientation: 'portrait', compress: true });
    pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, ancho, alto);
    return pdf;
  } finally { caja.remove(); }
}
async function compartirPdf(el, nombre, titulo, texto) {
  const pdf = await comprobantePdf(el);
  const P = cpNativo() && window.Capacitor.Plugins || {};
  if (cpNativo()) {
    if (!P.Filesystem || !P.Share) throw new Error('sin-plugins'); // app vieja: se comparte desde Chrome
    const b64 = pdf.output('datauristring').split(',')[1];
    const w = await P.Filesystem.writeFile({ path: nombre, data: b64, directory: 'CACHE' });
    try { await P.Share.share({ title: titulo, files: [w.uri], dialogTitle: 'Compartir comprobante (PDF)' }); }
    catch (e) { if (!/cancel/i.test(String(e && (e.message || e)))) throw e; }
    return;
  }
  const blob = pdf.output('blob'), file = new File([blob], nombre, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: titulo }); } catch (e) { if (e && e.name !== 'AbortError') throw e; }
    return;
  }
  // computadora / navegador sin compartir archivos: se descarga el PDF
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  if (typeof toast === 'function') toast('PDF descargado: ' + nombre, 'ok');
}
// Aceptación de Términos y condiciones (pasajeros y conductores). Bloquea la app hasta aceptar o salir.
// o: { para: 'pasajeros'|'conductores', primera, version, aceptar: async () => {}, salir: () => {} }
function pedirTyc(o) {
  cpEstilos();
  if (!document.getElementById('tyc-css')) { const st = document.createElement('style'); st.id = 'tyc-css'; st.textContent = `
    .tyc-ov{position:fixed;inset:0;z-index:7000;background:rgba(10,25,45,.72);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px)}
    .tyc-c{background:#fff;width:100%;max-width:440px;border-radius:22px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:cpIn .2s ease-out;color:#0f2740}
    .tyc-h{background:linear-gradient(135deg,#183c62,#215181);color:#fff;text-align:center;padding:22px 18px 18px}.tyc-h .e{font-size:40px}.tyc-h h3{margin:6px 0 2px;font-size:20px}.tyc-h small{opacity:.8}
    .tyc-b{padding:18px 18px 6px;font-size:15px;line-height:1.5;color:#33475b}.tyc-b ul{margin:10px 0;padding-left:20px}.tyc-b li{margin:4px 0}
    .tyc-b a.ver{display:flex;align-items:center;justify-content:center;gap:8px;border:2px solid #215181;color:#215181;border-radius:12px;padding:11px;font-weight:800;text-decoration:none;margin:12px 0}
    .tyc-chk{display:flex;gap:10px;align-items:flex-start;background:#f1f5f9;border-radius:12px;padding:12px;cursor:pointer;font-size:14.5px}.tyc-chk input{width:20px;height:20px;min-height:0;margin:1px 0 0;flex:none;accent-color:#215181}
    .tyc-f{display:flex;flex-direction:column;gap:8px;padding:14px 18px 18px}
    .tyc-f button{border:0;border-radius:14px;padding:14px;font:inherit;font-size:16px;font-weight:800;cursor:pointer}
    .tyc-f .si{background:#5fa52f;color:#fff}.tyc-f .si:disabled{opacity:.45;cursor:not-allowed}.tyc-f .no{background:none;color:#6b7c8c;font-weight:600;font-size:14px;padding:8px}`; document.head.append(st); }
  return new Promise(res => {
    const cond = o.para === 'conductores', url = 'terminos.html?para=' + (cond ? 'conductores' : 'pasajeros') + '&de=' + (cond ? 'conductor.html' : 'pasajero.html');
    const ov = document.createElement('div'); ov.className = 'tyc-ov';
    ov.innerHTML = `<div class="tyc-c" role="dialog" aria-modal="true"><div class="tyc-h"><div class="e">📜</div><h3>${o.primera ? 'Términos y condiciones' : 'Actualizamos los términos'}</h3><small>${cond ? 'App de conductores' : 'App de pasajeros'}</small></div>
      <div class="tyc-b"><p style="margin:0">${o.primera ? 'Para usar la app tenés que leer y aceptar los Términos y condiciones de Remises TOQUE!' : 'Cambiaron los Términos y condiciones. Para seguir usando la app, leelos y aceptalos.'}</p>
        <ul>${cond ? '<li>Requisitos, documentación y conducta.</li><li>Ubicación del móvil mientras estás en servicio.</li><li>Cobros, plan y base de la cuenta.</li>' : '<li>Cómo funcionan los pedidos y las tarifas.</li><li>Pagos, cancelaciones y esperas.</li><li>Seguridad y uso de tus datos.</li>'}</ul>
        <a class="ver" href="${url}" target="_blank" rel="opener">📖 Leer los términos completos</a>
        <label class="tyc-chk"><input type="checkbox" id="tycOk"> <span>Leí y acepto los <b>Términos y condiciones${cond ? ' para conductores' : ''}</b>.</span></label></div>
      <div class="tyc-f"><button class="si" id="tycSi" disabled>Aceptar y continuar</button><button class="no" id="tycNo">${o.textoSalir || 'Ahora no, cerrar sesión'}</button></div></div>`;
    document.body.append(ov);
    const si = ov.querySelector('#tycSi');
    ov.querySelector('#tycOk').onchange = e => { si.disabled = !e.target.checked; };
    si.onclick = async () => { si.disabled = true; si.textContent = 'Guardando…'; try { await o.aceptar(); ov.remove(); res(true); } catch (er) { si.disabled = false; si.textContent = 'Aceptar y continuar'; if (typeof toast === 'function') toast(er.message, 'error'); } };
    ov.querySelector('#tycNo').onclick = () => { ov.remove(); res(false); if (o.salir) o.salir(); };
  });
}
function cerrarComprobante() { const sh = document.querySelector('.cp-sh'); if (sh) { sh.remove(); return true; } const ov = document.querySelector('.cp-ov'); if (ov) { ov._cerrar ? ov._cerrar() : ov.remove(); return true; } return false; }
// v: datos del viaje. o: { numero (mostrar N° de viaje), cliente, empresa, pagoMp (promesa → true si se pagó con MP), alVolver }
// Tarjeta del comprobante / ticket: la MISMA en pantalla, al compartir (PDF) y al imprimir.
// o: { numero (mostrar N° de viaje, DNI y licencia), cliente, empresa, logo (URL absoluta para documentos impresos) }
function cpCardHtml(v, o = {}) {
  const e = o.empresa || v.empresa || {};
  const fl = t => { const m = String(t || '').match(/(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/); return m ? `${m[3]}/${m[2]}/${m[1]} · ${m[4]}:${m[5]} hs` : ''; };
  const hh = t => { const m = String(t || '').match(/(\d\d):(\d\d)/); return m ? m[0] : ''; };
  const total = v.monto != null ? v.monto : v.monto_estimado;
  const medio = String(v.medio_pago || 'efectivo').replace(/_/g, ' '), medioTxt = medio.charAt(0).toUpperCase() + medio.slice(1);
  const ICO = { efectivo: '💵', mercadopago: '💳', transferencia: '🏦', cuenta_corriente: '🏢', tarjeta: '💳', vale: '🎟' };
  const dato = (ico, l, val) => val ? `<div class="cp-d"><span>${ico}</span><div><small>${l}</small><b>${cpEsc(val)}</b></div></div>` : '';
  const patente = v.movil_patente || v.patente;
  const dm = datosMovil(v, !!o.numero);
  const movil = dm.numero ? ['N° ' + dm.numero, dm.patente, dm.vehiculo].filter(Boolean).join(' · ') : '';
  const horas = v.inicio_at || v.fin_at ? [hh(v.inicio_at), hh(v.fin_at)].filter(Boolean).join(' → ') : '';
  const kmTxt = v.km != null && v.km !== '' ? (Math.round(+v.km * 10) / 10).toFixed(1) + ' km' : '';
  return `<div class="cp">
      <div class="cp-cab"><img src="${o.logo || 'img/logo-blanco.png'}" alt="${cpEsc(e.nombre || 'Remises TOQUE!')}"><div class="cp-ok">✓</div><h3>¡Viaje finalizado!</h3><small>${cpEsc(fl(v.fin_at || v.creado))}</small>${o.numero ? `<div class="cp-num">Viaje N° ${cpEsc(v.id)}</div>` : ''}</div>
      <div class="cp-tot"><small>Total del viaje</small><b>${cpPesos(total)}</b><span class="cp-pago">${ICO[v.medio_pago] || '💵'} ${cpEsc(medioTxt)}</span>${+v.cargo_cancelacion > 0 ? `<em class="cp-cargo">Incluye ${cpPesos(v.cargo_cancelacion)} por cancelación tardía de una reserva</em>` : ''}</div>
      ${+v.cargo_plataforma > 0 && v.monto != null ? `<div class="cp-desg"><div class="cp-dl"><span>Viaje</span><b>${cpPesos(+v.monto - +v.cargo_plataforma - (+v.cargo_cancelacion || 0))}</b></div>${+v.cargo_cancelacion > 0 ? `<div class="cp-dl"><span>Cancelación tardía de reserva</span><b>${cpPesos(v.cargo_cancelacion)}</b></div>` : ''}<details class="cp-info"><summary><div class="cp-dl"><span>Cargos de la plataforma<i class="cp-i" title="Más información">i</i></span><b>${cpPesos(v.cargo_plataforma)}</b></div></summary><p>Esto nos ayuda a gestionar nuestra plataforma y ofrecer una mejor experiencia.</p></details></div>` : ''}
      <div class="cp-corte"></div>
      <div class="cp-sec"><div class="cp-ruta"><div><i class="o"></i><small>Origen</small><b>${cpEsc(v.origen_dir || '—')}</b></div>${v.destino_dir ? `<div><i class="d"></i><small>Destino</small><b>${cpEsc(v.destino_dir)}</b></div>` : ''}</div></div>
      ${dm.numero || dm.conductor ? `<div class="cp-sec cp-mov">${dm.numero ? `<div class="cp-mov-n"><small>Móvil</small><b>${cpEsc(dm.numero)}</b></div>` : ''}
        <div class="cp-mov-d">${dm.conductor ? `<div class="cp-mov-c"><span>👤</span><div><small>Conductor</small><b>${cpEsc(dm.conductor)}</b>${dm.dni ? `<em>DNI ${cpEsc(dm.dni)}</em>` : ''}</div></div>` : ''}
          ${dm.vehiculo ? `<div class="cp-mov-c"><span>🚗</span><div><small>Vehículo</small><b>${cpEsc(dm.vehiculo)}</b>${dm.color ? `<em>Color ${cpEsc(dm.color)}</em>` : ''}</div></div>` : ''}
          <div class="cp-mov-t">${dm.patente ? `<span class="cp-pat" title="Patente">${cpEsc(dm.patente)}</span>` : ''}${dm.licencia ? `<span class="cp-lic">🪪 Licencia ${cpEsc(dm.licencia)}</span>` : ''}</div></div></div>` : ''}
      <div class="cp-sec cp-grid">
        ${dato('📏', 'Distancia', kmTxt)}${dato('⏱', 'Duración', v.minutos ? Math.round(v.minutos) + ' min' : '')}
        ${dato('🕒', 'Inicio → fin', horas)}${v.espera_min > 0 ? dato('⏳', 'Espera', Math.round(v.espera_min) + ' min') : ''}
        ${o.cliente ? dato('🙋', 'Pasajero', o.cliente) : ''}
      </div>
      ${v.calificacion ? `<div class="cp-sec cp-cal">${o.numero ? 'Calificación del pasajero' : 'Tu calificación'} <b>${'★'.repeat(v.calificacion)}<i>${'★'.repeat(5 - v.calificacion)}</i></b></div>` : ''}
      <div class="cp-pie">¡Gracias por viajar con nosotros!<br><small>Comprobante no válido como factura.</small></div>
</div>`;
}
function abrirComprobante(v, o = {}) {
  cpEstilos();
  const e = o.empresa || v.empresa || {};
  const fl = t => { const m = String(t || '').match(/(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/); return m ? `${m[3]}/${m[2]}/${m[1]} · ${m[4]}:${m[5]} hs` : ''; };
  const hh = t => { const m = String(t || '').match(/(\d\d):(\d\d)/); return m ? m[0] : ''; };
  const total = v.monto != null ? v.monto : v.monto_estimado;
  const medio = String(v.medio_pago || 'efectivo').replace(/_/g, ' '), medioTxt = medio.charAt(0).toUpperCase() + medio.slice(1);
  const ICO = { efectivo: '💵', mercadopago: '💳', transferencia: '🏦', cuenta_corriente: '🏢', tarjeta: '💳', vale: '🎟' };
  const dato = (ico, l, val) => val ? `<div class="cp-d"><span>${ico}</span><div><small>${l}</small><b>${cpEsc(val)}</b></div></div>` : '';
  const patente = v.movil_patente || v.patente;
  const dm = datosMovil(v, !!o.numero);
  const movil = dm.numero ? ['N° ' + dm.numero, dm.patente, dm.vehiculo].filter(Boolean).join(' · ') : '';
  const horas = v.inicio_at || v.fin_at ? [hh(v.inicio_at), hh(v.fin_at)].filter(Boolean).join(' → ') : '';
  const kmTxt = v.km != null && v.km !== '' ? (Math.round(+v.km * 10) / 10).toFixed(1) + ' km' : '';
  document.querySelectorAll('.cp-ov').forEach(x => x.remove());
  const ov = document.createElement('div'); ov.className = 'cp-ov';
  ov.innerHTML = `<div class="cp-bar"><button class="cp-vol" aria-label="Volver">‹</button><b>${o.numero ? 'Ticket de viaje' : 'Comprobante'}</b><span></span></div>
    <div class="cp-scroll">${cpCardHtml(v, o)}</div>
    <div class="cp-acc"><button class="btn sec" id="cpComp">📤 Compartir</button><button class="btn" id="cpImp">🖨 Imprimir / PDF</button></div>`;
  document.body.append(ov);
  let externo = false;
  const alVolverApp = () => { if (!document.hidden && externo) externo = false; };
  ov._cerrar = () => { document.removeEventListener('visibilitychange', alVolverApp); ov.remove(); if (o.alVolver) o.alVolver(); };
  ov.querySelector('.cp-vol').onclick = ov._cerrar;
  if (o.pagoMp) Promise.resolve(o.pagoMp).then(ok => { const t = ov.querySelector('.cp-pago'); if (t && ok) { t.textContent = '✔ Pagado con Mercado Pago'; t.classList.add('ok'); } });
  const datos = { ...v, movil_patente: patente, _sinNumero: !o.numero, _cliente: o.cliente || '' }, opc = { empresa: e, cliente: o.cliente, sinNumero: !o.numero };
  ov.querySelector('#cpImp').onclick = () => {
    if (cpNativo()) { // se abre en Chrome, donde se puede imprimir o guardar como PDF
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(datos)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      externo = true; document.addEventListener('visibilitychange', alVolverApp);
      location.href = 'https://remisestoque.netlify.app/ticket.html#' + b64; return;
    }
    document.querySelectorAll('iframe.cp-print').forEach(x => x.remove());
    const fr = document.createElement('iframe'); fr.className = 'cp-print'; fr.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    document.body.append(fr); fr.srcdoc = ticketHtml(datos, opc);
    fr.onload = () => setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { const w = window.open('', '_blank'); if (w) abrirTicket(w, datos, { ...opc, auto: true }); } }, 300);
  };
  ov.querySelector('#cpComp').onclick = () => {
    const txt = `🚕 ${e.nombre || 'Remises TOQUE!'} · Comprobante de viaje${o.numero ? ' N° ' + v.id : ''}\n📅 ${fl(v.fin_at || v.creado)}\n🟢 De: ${v.origen_dir || ''}${v.destino_dir ? '\n🔵 A: ' + v.destino_dir : ''}${movil ? '\n🚕 Móvil ' + movil : ''}${dm.color ? '\n🎨 Color ' + dm.color : ''}${dm.licencia ? '\n🪪 Licencia ' + dm.licencia : ''}${dm.conductor ? '\n👤 Conductor: ' + dm.conductor + (dm.dni ? ' (DNI ' + dm.dni + ')' : '') : ''}${kmTxt ? '\n📏 ' + kmTxt : ''}\n💰 Total: ${cpPesos(total)} (${medioTxt})${+v.cargo_plataforma > 0 ? '\n🧾 Incluye ' + cpPesos(v.cargo_plataforma) + ' de cargos de la plataforma' : ''}\n¡Gracias por viajar con nosotros!`;
    const b = ov.querySelector('#cpComp'), t0 = b.textContent, f = (v.fin_at || v.creado || '').slice(0, 10);
    const nombre = (o.numero ? `ticket-viaje-${v.id}` : `comprobante-viaje-${f || 'remis'}`) + '.pdf';
    b.disabled = true; b.textContent = '⏳ Generando PDF…';
    compartirPdf(ov.querySelector('.cp'), nombre, 'Comprobante de viaje', txt)
      .catch(er => {
        if (cpNativo()) { // app sin el complemento para compartir archivos: el PDF se comparte desde Chrome
          const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(datos)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          externo = true; document.addEventListener('visibilitychange', alVolverApp);
          location.href = 'https://remisestoque.netlify.app/ticket.html?compartir=1#' + b64; return;
        }
        if (typeof toast === 'function') toast('No se pudo generar el PDF: ' + (er && er.message || er), 'error');
      })
      .finally(() => { b.disabled = false; b.textContent = t0; });
  };
  return ov;
}
function abrirTicket(w, v, o) { w.document.open(); w.document.write(ticketHtml(v, o)); w.document.close(); }

function pesos0(n) { return n == null || n === '' ? '—' : '$ ' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 }); }

// Corrección del GPS (porcentaje de la tarifa): el GPS del celular mide algo menos que el odómetro del auto
function correccionGps(t) { const c = parseFloat(t && t.tabla && t.tabla.correccion_pct); return isFinite(c) ? Math.max(-20, Math.min(30, c)) : 0; }
function metrosCorregidos(t, metros) { return (metros || 0) * (1 + correccionGps(t) / 100); }
