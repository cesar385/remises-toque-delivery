// Enrutador de la app: traduce cada ruta "/api/..." (método + URL) a su función RPC de Supabase.
// Agrega RODAR.llamar(url, método, cuerpo, token).
(function () {
  const R = window.RODAR;
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
    ['GET', '/api/mapa', 'r_mapa'], ['GET', '/api/mapa/pos', 'r_mapa_pos'], ['POST', '/api/moviles/:id/estado', 'r_movil_estado'], ['POST', '/api/moviles/:id/mensaje', 'r_movil_mensaje'],
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
    ['GET', '/api/moto', 'r_moto_cfg'], ['POST', '/api/moto', 'r_moto_cfg_guardar'],
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
    ['POST', '/api/pub/solicitud', 'r_pub_solicitud'], ['POST', '/api/cli/foto', 'r_cli_foto'], ['POST', '/api/cli/recientes/:id/quitar', 'r_cli_reciente_quitar'], ['POST', '/api/conductor/foto', 'r_cond_foto'], ['POST', '/api/cli/eliminar', 'r_cli_eliminar'], ['POST', '/api/clientes/:id/cuenta', 'r_cliente_cuenta'], ['POST', '/api/pub/viaje/:id/calificar', 'r_pub_calificar'], ['POST', '/api/pub/soporte', 'r_pub_soporte'],
    // billeteras, modo de trabajo del conductor y tipo de vehículo
    ['GET', '/api/pagos/proveedores', 'r_pagos_proveedores'], ['GET', '/api/pagos/config', 'r_pagos_config'], ['POST', '/api/pagos/config', 'r_pagos_config_guardar'],
    ['GET', '/api/conductor/modos', 'r_cond_modos'], ['POST', '/api/conductor/repartidor', 'r_cond_repartidor_solicitar'], ['POST', '/api/conductor/cambiar-movil', 'r_cond_cambiar_movil'], ['POST', '/api/moviles/:id/tipo', 'r_movil_tipo'],
  ].map(([m, p, f]) => ({ m, f, nombres: (p.match(/:(\w+)/g) || []).map(x => x.slice(1)), re: new RegExp('^' + p.replace(/:(\w+)/g, '([^/]+)') + '$') }));

  // Lo que devuelve r_me / r_catalogos / r_pub_config trae la localidad de la empresa (ordena la búsqueda de direcciones)
  const RUTAS_CON_EMPRESA = ['r_me', 'r_catalogos', 'r_pub_config'];
  const geocodificar = (ruta, q) => {
    if (ruta === '/api/geocodificar' || ruta === '/api/pub/geocodificar') return R.geoBuscar(q.q);
    if (ruta === '/api/geocodificar/inversa' || ruta === '/api/pub/geocodificar/inversa') return R.geoInversa(q.lat, q.lng);
    return null;
  };

  // ---- (url, método, cuerpo, token) -> RPC ----
  const llamar = async (url, metodo, cuerpo, token) => {
    const u = new URL(url, 'http://x');
    const q = Object.fromEntries(u.searchParams.entries());
    const ruta = u.pathname;
    const geo = geocodificar(ruta, q);
    if (geo) return geo;
    const r = RUTAS.find(x => x.m === metodo && x.re.test(ruta));
    if (!r) throw new R.ErrorApi('Ruta no disponible: ' + metodo + ' ' + ruta);
    const m = ruta.match(r.re);
    r.nombres.forEach((n, i) => q[n] = decodeURIComponent(m[i + 1]));
    const res = await R.rpc(r.f, token, q, cuerpo);
    const empresa = RUTAS_CON_EMPRESA.includes(r.f) && res && (res.empresa || res);
    if (empresa) R.setEmpresa(empresa);
    return res;
  };

  R.llamar = llamar;
})();
