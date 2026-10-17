// Informes

function filtroFechas(d = 7) { return `<div class="campo"><label>Desde</label><input type="date" id="fd" value="${diasAtras(d)}"></div><div class="campo"><label>Hasta</label><input type="date" id="fh" value="${hoyISO()}"></div>`; }
function selMes(id = 'mes') { const out = []; const d = new Date(); for (let i = 0; i < 12; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`<option value="${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}">${MESES[x.getMonth()]}-${x.getFullYear()}</option>`); } return `<select id="${id}" style="width:auto">${out.join('')}</select>`; }
const botonCSV = '<button class="btn sec" id="csv">⬇ CSV</button>';

ruta('acciones-usuarios', {
  titulo: 'Acciones de usuarios', roles: ['gestion'], render(main) {
    const tipos = ['cliente_baja', 'cliente_recupera', 'cliente_bloqueo', 'cliente_desbloqueo', 'cliente_negativo_agregar', 'cliente_negativo_quitar', 'password_change_self', 'password_reset_admin', 'usuario_permisos_modificados', 'usuario_creado', 'cliente_purge_cron', 'plan_creado', 'plan_modificado', 'plan_eliminado', 'plan_movil_cambiado', 'plan_movil_quitado', 'prorroga', 'sesion_cerrada', 'login_web', 'solicitud_precargada', 'cobro_cuotas'];
    main.innerHTML = cabecera('Acciones de usuarios', 'Bitácora de bajas, claves, permisos, negativos y cambios de planes (solo lectura).') +
      `<div class="card"><div class="body fila">${filtroFechas(30)}<div class="campo"><label>Tipo</label><select id="ti"><option value="">Todos</option>${tipos.map(t => `<option>${t}</option>`).join('')}</select></div><div class="campo"><label>Actor ID</label><input type="number" id="ac" placeholder="0 = todos" style="width:100px"></div><div class="campo flex"><label>Buscar texto</label><input id="bt" placeholder="alias, teléfono, actor, detalle…"></div><button class="btn" id="b">Buscar</button>${botonCSV}</div><div id="tb"></div></div>`;
    const p = () => ({ desde: $('#fd').value, hasta: $('#fh').value, tipo: $('#ti').value, actor: $('#ac').value, buscar: $('#bt').value });
    const t = tabla($('#tb'), { porPagina: 50, cols: [{ t: 'Fecha', f: x => fechaLarga(x.fecha) }, { t: 'Quién (actor)', f: x => `${esc(x.actor)} <small>#${x.actor_id ?? '-'}</small>` }, { t: 'Tipo', f: x => `<span class="pill">${esc(x.tipo)}</span>` }, { t: 'Afectado', k: 'afectado' }, { t: 'Detalle', k: 'detalle' }], cargar: () => api('/api/informes/acciones-usuarios?' + qs(p())) });
    $('#b').onclick = () => t.refrescar(true); $('#csv').onclick = () => descargar('/api/informes/acciones-usuarios?' + qs({ ...p(), formato: 'csv' }));
  }
});

ruta('eventos-moviles', {
  titulo: 'Eventos de móviles', roles: ['gestion'], render(main) {
    const tipos = ['login', 'cerroapp', 'logout', 'qta_parada', 'salida_parada', 'salida_parada_operador', 'desconexion_logica', 'ofrecido', 'aceptado', 'asignado_manual', 'rechazado_movil', 'timeout', 'fuera_servicio', 'emergencia', 'penalizado'];
    main.innerHTML = cabecera('Eventos de móviles', 'Bitácora de sesión (login, cierre, parada) y de viaje (ofrecido, aceptado, rechazo). Solo lectura.') +
      `<div class="card"><div class="body fila">${filtroFechas(1)}<div class="campo"><label>Tipo</label><select id="ti"><option value="">Todos</option>${tipos.map(t => `<option>${t}</option>`).join('')}</select></div><div class="campo"><label>Móvil</label><input type="number" id="mv" placeholder="0 = todos" style="width:100px"></div><button class="btn" id="b">Buscar</button>${botonCSV}</div><div id="tb"></div></div>`;
    const p = () => ({ desde: $('#fd').value, hasta: $('#fh').value, tipo: $('#ti').value, movil: $('#mv').value });
    const t = tabla($('#tb'), { porPagina: 50, cols: [{ t: 'Fecha', f: x => fechaLarga(x.fecha) + x.fecha.slice(16) }, { t: 'Móvil', k: 'movil_numero' }, { t: 'Tipo', f: x => `<span class="pill">${esc(x.tipo)}</span>` }, { t: 'Ref', k: 'ref' }, { t: 'Detalle', k: 'detalle' }], cargar: () => api('/api/informes/eventos-moviles?' + qs(p())) });
    $('#b').onclick = () => t.refrescar(true); $('#csv').onclick = () => descargar('/api/informes/eventos-moviles?' + qs({ ...p(), formato: 'csv' }));
  }
});

ruta('clientes-bloqueados', {
  titulo: 'Clientes bloqueados', roles: ['operador', 'gestion'], render(main) {
    main.innerHTML = cabecera('Clientes bloqueados', 'Clientes con bloqueo operativo (telefonía / chat): quién bloqueó, cuándo y el motivo.', '<button class="btn sec" id="ac">⟳ Actualizar</button>') + '<div class="card"><div class="head"><input type="search" id="f" placeholder="Filtrar por teléfono, alias, motivo…" style="max-width:320px"><span id="n" class="pill"></span></div><div id="tb"></div></div>';
    const t = tabla($('#tb'), {
      cols: [{ t: 'Teléfono', k: 'telefono' }, { t: 'Alias', k: 'alias' }, { t: 'Motivo', k: 'motivo' }, { t: 'Bloqueado por', k: 'bloqueado_por' }, { t: 'Fecha', f: x => fechaLarga(x.fecha) }, { t: '', f: x => `<button class="btn chico" data-u="${x.id}">Desbloquear</button>` }],
      cargar: async () => { const r = (await api('/api/informes/clientes-bloqueados')).filter(x => !$('#f').value || JSON.stringify(x).toLowerCase().includes($('#f').value.toLowerCase())); $('#n').textContent = r.length + ' bloqueados'; return r; },
      pie: () => $$('[data-u]', main).forEach(b => b.onclick = async () => { await api(`/api/clientes/${b.dataset.u}/bloqueo`, { body: { bloquear: false } }); toast('Desbloqueado', 'ok'); t.refrescar(); }),
    });
    $('#f').oninput = () => t.refrescar(true); $('#ac').onclick = () => t.refrescar();
  }
});

ruta('clientes-baja', {
  titulo: 'Clientes en baja', roles: ['operador', 'gestion'], render(main) {
    main.innerHTML = cabecera('Clientes dados de baja', 'Se borran físicamente a los 7 días desde la baja. Podés recuperarlos antes (con sus domicilios).', '<button class="btn sec" id="ac">⟳ Actualizar</button>') + '<div class="card" id="tb"></div>';
    const t = tabla($('#tb'), {
      vacio: 'No hay clientes en baja', cols: [{ t: 'ID', k: 'id' }, { t: 'Teléfono', k: 'telefono' }, { t: 'Alias', k: 'alias' }, { t: 'Fecha baja', f: x => fechaLarga(x.baja_at) }, { t: 'Quién', k: 'quien' }, { t: 'Se elimina', f: x => fechaLarga(x.purga) }, { t: '', f: x => `<button class="btn chico" data-r="${x.id}">Recuperar</button>` }],
      cargar: () => api('/api/informes/clientes-baja'), pie: () => $$('[data-r]', main).forEach(b => b.onclick = async () => { await api(`/api/clientes/${b.dataset.r}/recuperar`, { body: {} }); toast('Recuperado', 'ok'); t.refrescar(); }),
    });
    $('#ac').onclick = () => t.refrescar();
  }
});

ruta('conductores', {
  titulo: 'Reporte de conductores', roles: ['gestion'], render(main) {
    main.innerHTML = cabecera('Reporte de conductores', 'Ranking y métricas por conductor en el período seleccionado.') +
      `<div class="card"><div class="body fila">${filtroFechas(30)}<button class="btn" id="g">Generar</button><button class="btn sec" id="pdf">PDF</button>${botonCSV}<input type="search" id="bq" placeholder="Buscar…" style="max-width:200px;margin-left:auto"></div><div id="tb"></div></div>`;
    const p = () => ({ desde: $('#fd').value, hasta: $('#fh').value });
    let cache = null;
    const t = tabla($('#tb'), {
      porPagina: 50, cols: [{ t: 'Foto', f: x => x.foto ? `<img class="avatar" src="${esc(x.foto)}">` : `<span class="avatar">${esc(x.nombre[0])}</span>` }, { t: 'Documento', k: 'documento' }, { t: 'Nombre', k: 'nombre' }, { t: 'Viajes realizados', c: 'r', k: 'viajes' }, { t: 'Ingresos generados', c: 'r', f: x => pesos(x.ingresos) }, { t: 'Horas trabajadas', c: 'r', k: 'horas' }, { t: 'Calificación promedio', c: 'r', f: x => x.calificacion ? '⭐ ' + x.calificacion : '—' }, { t: 'No respondidos', c: 'r', k: 'no_respondidos' }],
      cargar: async () => { if (!cache) cache = await api('/api/informes/conductores?' + qs(p())); const q = $('#bq').value.toLowerCase(); return cache.filter(x => !q || (x.nombre + x.documento).toLowerCase().includes(q)); },
    });
    $('#g').onclick = () => { cache = null; t.refrescar(true); }; $('#bq').oninput = () => t.refrescar(true);
    $('#pdf').onclick = () => descargar('/print/conductores?' + qs(p())); $('#csv').onclick = () => descargar('/api/informes/conductores?' + qs({ ...p(), formato: 'csv' }));
  }
});

ruta('conectados', {
  titulo: 'Sesiones conectadas', roles: ['admin'], render(main) {
    main.innerHTML = cabecera('Sesiones conectadas', 'Usuarios conectados por web o app de conductor.', '<button class="btn sec" id="ac">⟳ Actualizar</button>') +
      '<div class="card"><div class="head"><input type="search" id="b" placeholder="Buscar por nombre, documento…" style="max-width:280px"><select id="ti" style="width:auto"><option value="">Todos</option><option value="web">Web</option><option value="app">App</option></select><span class="pill" id="n"></span></div><div id="tb"></div></div>';
    const t = tabla($('#tb'), {
      porPagina: 50,
      cols: [{ t: 'Usuario', f: x => `${esc(x.usuario)}<br><small>${esc(x.documento)}</small>` }, { t: 'Tipo', f: x => `<span class="pill">${x.tipo}</span>` }, { t: 'Móvil', f: x => x.movil ?? '—' }, { t: 'Inicio', f: x => fechaLarga(x.inicio) }, { t: 'Horas hoy', f: x => x.min_hoy != null ? `${Math.floor(x.min_hoy / 60)}h ${x.min_hoy % 60}m` : '—' }, { t: 'Último', f: x => x.ultimo ? x.ultimo.slice(11, 16) : '—' }, { t: 'Cooldown', f: x => x.cooldown_hasta ? x.cooldown_hasta.slice(11, 16) : '—' }, { t: 'IP', k: 'ip' }, { t: 'Permisos', k: 'roles' }],
      cargar: async () => { const r = await api('/api/informes/conectados?' + qs({ tipo: $('#ti').value, buscar: $('#b').value })); $('#n').textContent = r.length + ' sesiones'; return r; },
      acciones: x => x.token ? [{ t: 'Cerrar sesión', ico: '⏏', a: async () => { await api(`/api/informes/conectados/${x.token}/cerrar`, { body: {} }); t.refrescar(); } }, { t: 'Cooldown (bloquear reingreso)', ico: '⏱', a: async () => { const r = await pedir('Cooldown', [{ k: 'minutos', l: 'Minutos', t: 'number', def: 15 }]); if (r) { await api(`/api/informes/conectados/${x.token}/cooldown`, { body: r }); t.refrescar(); } } }] : [{ t: 'Conductor simulado (demo)', a: () => { } }],
    });
    $('#b').oninput = () => t.refrescar(true); $('#ti').onchange = () => t.refrescar(true); $('#ac').onclick = () => t.refrescar();
  }
});

ruta('estadisticas-moviles', {
  titulo: 'Estadísticas por móvil', roles: ['gestion'], render(main) {
    main.innerHTML = cabecera('Estadísticas por móvil', 'Viajes finalizados por móvil y conductor. Central y calle son contadores independientes; el total es la suma.') +
      `<div class="card"><div class="body fila"><div class="campo"><label>Período</label>${selMes()}</div><button class="btn sec" id="ac">⟳ Actualizar</button>${botonCSV}</div><div class="body" id="k" style="padding-top:0"></div><div id="tb"></div></div>`;
    const t = tabla($('#tb'), { porPagina: 50, cols: [{ t: 'Móvil', k: 'movil' }, { t: 'Conductor', k: 'conductor' }, { t: 'Viajes central', c: 'r', k: 'central' }, { t: 'Solicitudes calle', c: 'r', k: 'calle' }, { t: 'Total', c: 'r', f: x => `<b>${x.total}</b>` }], cargar: async () => { const r = await api('/api/informes/estadisticas-moviles?mes=' + $('#mes').value); $('#k').innerHTML = `<div class="grid g3">${[['Móviles', new Set(r.map(x => x.movil)).size], ['Viajes totales', r.reduce((s, x) => s + x.total, 0)], ['Viajes central', r.reduce((s, x) => s + x.central, 0)]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}</div>`; return r; } });
    $('#mes').onchange = $('#ac').onclick = () => t.refrescar(true); $('#csv').onclick = () => descargar('/api/informes/estadisticas-moviles?formato=csv&mes=' + $('#mes').value);
  }
});

ruta('horas-conductores', {
  titulo: 'Horas por conductor', roles: ['gestion'], render(main) {
    main.innerHTML = cabecera('Horas por conductor', 'Tiempo conectado a la app por conductor en el mes seleccionado.') +
      `<div class="card"><div class="body fila"><div class="campo"><label>Período</label>${selMes()}</div><button class="btn sec" id="ac">⟳ Actualizar</button>${botonCSV}</div><div class="body" id="k" style="padding-top:0"></div><div id="tb"></div></div>`;
    const t = tabla($('#tb'), { porPagina: 50, cols: [{ t: 'Documento', k: 'documento' }, { t: 'Conductor', k: 'conductor' }, { t: 'Horas', c: 'r', f: x => num(x.horas, 1) }], cargar: async () => { const r = await api('/api/informes/horas-conductores?mes=' + $('#mes').value); const tot = r.reduce((s, x) => s + x.horas, 0); $('#k').innerHTML = `<div class="grid g3"><div class="kpi"><div class="l">Conductores</div><div class="v">${r.length}</div></div><div class="kpi"><div class="l">Horas totales</div><div class="v">${num(tot, 1)}</div></div><div class="kpi"><div class="l">Promedio / conductor</div><div class="v">${num(r.length ? tot / r.length : 0, 1)}</div></div></div>`; return r; } });
    $('#mes').onchange = $('#ac').onclick = () => t.refrescar(true); $('#csv').onclick = () => descargar('/api/informes/horas-conductores?formato=csv&mes=' + $('#mes').value);
  }
});

ruta('facturacion-mes', {
  titulo: 'Facturación del mes', roles: ['gestion'], render(main) {
    const d = new Date();
    main.innerHTML = cabecera('Facturación del mes', 'Costo de los módulos de la plataforma para el mes elegido. Se cobra el máximo de móviles habilitados en el mes.') +
      `<div class="card"><div class="body fila"><div class="campo"><label>Año</label><select id="an">${[0, 1, 2].map(i => `<option>${d.getFullYear() - i}</option>`).join('')}</select></div><div class="campo"><label>Mes de cobro</label><select id="me">${MESES.map((m, i) => `<option value="${i + 1}" ${i === d.getMonth() ? 'selected' : ''}>${m}</option>`).join('')}</select></div><button class="btn" id="g">Generar</button></div></div><div id="r"></div>`;
    async function gen() {
      const r = await api('/api/informes/facturacion-mes?' + qs({ anio: $('#an').value, mes: $('#me').value }));
      $('#r').innerHTML = `<div class="card"><div class="head"><h3>Cobro — ${MESES[+r.mes.slice(5) - 1]} ${r.mes.slice(0, 4)}</h3><span class="pill">Pico habilitados: ${r.habilitados}</span><b>${pesos(r.total)}</b></div>${tablaSimple(r.packs, [{ t: 'Pack', k: 'pack' }, { t: 'Bonif.', k: 'bonif', c: 'r' }, { t: 'Qty', k: 'qty', c: 'r' }, { t: 'Unitario', c: 'r', f: x => pesos(x.unitario) }, { t: 'Monto', c: 'r', f: x => pesos(x.monto) }])}</div>
        <div class="card"><div class="head"><h3>Detalle por móvil</h3></div>${tablaSimple(r.moviles, [{ t: 'Móvil', k: 'movil' }, { t: 'Horas', k: 'horas', c: 'r' }, { t: 'Viajes central', k: 'viajes_central', c: 'r' }, { t: 'Conectado', k: 'conectado' }, { t: 'Con viaje', k: 'con_viaje' }, { t: 'Exclusión', k: 'exclusion' }])}</div>
        <div class="card"><div class="head"><h3>Log de altas / bajas</h3><input type="number" id="ln" placeholder="N° móvil" style="width:110px"><button class="btn sec chico" id="fl">Filtrar log</button></div><div id="lg">${tablaSimple(r.log, [{ t: 'Fecha', f: x => fechaLarga(x.fecha) }, { t: 'Móvil', k: 'movil_numero' }, { t: 'Tipo', k: 'tipo' }, { t: 'Entidad', k: 'entidad' }, { t: 'Usuario', k: 'usuario' }, { t: 'Detalle', k: 'detalle' }], 'Sin movimientos')}</div></div>`;
      $('#fl').onclick = async () => { const x = await api('/api/informes/facturacion-mes?' + qs({ anio: $('#an').value, mes: $('#me').value, numero: $('#ln').value })); $('#lg').innerHTML = tablaSimple(x.log, [{ t: 'Fecha', f: y => fechaLarga(y.fecha) }, { t: 'Móvil', k: 'movil_numero' }, { t: 'Tipo', k: 'tipo' }, { t: 'Entidad', k: 'entidad' }, { t: 'Usuario', k: 'usuario' }, { t: 'Detalle', k: 'detalle' }], 'Sin movimientos'); };
    }
    $('#g').onclick = gen; gen();
  }
});

ruta('informe-mensual', {
  titulo: 'Informe mensual', roles: ['gestion'], render(main) {
    const d = new Date();
    main.innerHTML = cabecera('Informe mensual', 'Tablero del mes: viajes, móviles con viaje, conectados y gráficos.') +
      `<div class="card"><div class="body fila"><div class="campo"><label>Año</label><select id="an">${[0, 1, 2].map(i => `<option>${d.getFullYear() - i}</option>`).join('')}</select></div><div class="campo"><label>Mes</label><select id="me">${MESES.map((m, i) => `<option value="${i + 1}" ${i === d.getMonth() ? 'selected' : ''}>${m}</option>`).join('')}</select></div><div class="campo"><label>Rango comparación</label><select id="ra"><option value="12">12 meses</option><option value="24">24 meses</option><option value="36">36 meses</option><option value="todo">Todo</option></select></div><button class="btn" id="c">Consultar</button></div></div><div id="r"></div>`;
    let g1, g2;
    async function cons() {
      const r = await api('/api/informes/mensual?' + qs({ anio: $('#an').value, mes: $('#me').value, rango: $('#ra').value }));
      const x = r.desglose;
      $('#r').innerHTML = `<div class="grid g4" style="margin-bottom:14px">${[['Viajes del mes', r.viajes], ['Viajes por móvil (prom.)', num(r.por_movil, 1)], ['Móviles con viaje', r.con_viaje], ['Móviles conectados', r.conectados]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}</div>
        <div class="card"><div class="head"><h3>Desglose del mes</h3></div><div class="body grid g6">${[['Central', x.central], ['Calle', x.calle], ['Telefónica', x.telefonica], ['WhatsApp', x.whatsapp], ['App / web', x.app], ['Telegram', x.telegram], ['Origen domicilio', x.domicilio], ['Origen parada', x.parada], ['Cancelados', x.cancelados]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}</div></div>
        <div class="grid g2"><div class="card"><div class="head"><h3>Viajes por día</h3></div><div class="body"><canvas id="c1" height="220"></canvas></div></div><div class="card"><div class="head"><h3>Comparación con otros meses</h3><small>barras = viajes/mes · línea = media</small></div><div class="body"><canvas id="c2" height="220"></canvas></div></div></div>`;
      g1 && g1.destroy(); g2 && g2.destroy();
      g1 = new Chart($('#c1'), { type: 'bar', data: { labels: r.diario.map(d => d.dia), datasets: [{ label: 'Viajes', data: r.diario.map(d => d.c), backgroundColor: '#215181' }] }, options: { plugins: { legend: { display: false } } } });
      g2 = new Chart($('#c2'), { data: { labels: r.historico.map(h => h.mes), datasets: [{ type: 'bar', label: 'Viajes', data: r.historico.map(h => h.c), backgroundColor: '#8fc3c7' }, { type: 'line', label: 'Media', data: r.historico.map(() => r.media), borderColor: '#e8892b', pointRadius: 0 }] } });
    }
    $('#c').onclick = cons; cons();
  }
});

ruta('informe-operadores', {
  titulo: 'Informe operadores', roles: ['gestion'], render(main) {
    main.innerHTML = cabecera('Informe operadores', 'Viajes cargados y horas trabajadas por operador (contadores diarios).') + `<div class="card"><div class="body fila">${filtroFechas(0)}<button class="btn" id="c">Consultar</button>${botonCSV}</div><div id="tb"></div></div>`;
    const p = () => ({ desde: $('#fd').value, hasta: $('#fh').value });
    const t = tabla($('#tb'), { cols: [{ t: 'Operador', k: 'operador' }, { t: 'Documento', k: 'documento' }, { t: 'Cargados', c: 'r', k: 'cargados' }, { t: 'Horas', c: 'r', f: x => num(x.horas, 2) }], cargar: () => api('/api/informes/operadores?' + qs(p())) });
    $('#c').onclick = () => t.refrescar(true); $('#csv').onclick = () => descargar('/api/informes/operadores?' + qs({ ...p(), formato: 'csv' }));
  }
});

ruta('movimientos-moviles', {
  titulo: 'Movimientos de móviles', roles: ['gestion'], render(main) {
    main.innerHTML = cabecera('Movimientos de móviles', 'Altas, bajas y cambios de plan de móviles en un rango de fechas.') + `<div class="card"><div class="body fila">${filtroFechas(90)}<div class="campo"><label>N° móvil</label><input type="number" id="n" style="width:100px"></div><button class="btn" id="b">Buscar</button>${botonCSV}</div><div id="tb"></div></div>`;
    const p = () => ({ desde: $('#fd').value, hasta: $('#fh').value, numero: $('#n').value });
    const t = tabla($('#tb'), { cols: [{ t: 'Fecha', f: x => fechaLarga(x.fecha) }, { t: 'Móvil', k: 'movil_numero' }, { t: 'Tipo', f: x => `<span class="pill">${esc(x.tipo)}</span>` }, { t: 'Usuario', k: 'usuario' }, { t: 'Detalle', k: 'detalle' }], cargar: () => api('/api/informes/movimientos-moviles?' + qs(p())) });
    $('#b').onclick = () => t.refrescar(true); $('#csv').onclick = () => descargar('/api/informes/movimientos-moviles?' + qs({ ...p(), formato: 'csv' }));
  }
});

ruta('negativos-movil', {
  titulo: 'Negativos por móvil', roles: ['operador', 'gestion'], render(main) {
    main.innerHTML = cabecera('Negativos por móvil', 'Clientes que no deben ser asignados a un móvil determinado.') +
      `<div class="card"><div class="body fila"><div class="campo"><label>Móvil</label><select id="m"><option value="">Seleccionar móvil</option>${R.cat.moviles.map(m => `<option value="${m.numero}">Móvil ${m.numero}</option>`).join('')}</select></div><button class="btn" id="b">Buscar</button><button class="btn sec" id="ag">+ Agregar negativo</button></div><div id="r"><p style="padding:14px;color:var(--suave)">Elegí un móvil y presioná Buscar.</p></div></div>`;
    async function buscar() {
      if (!$('#m').value) return;
      const r = await api('/api/informes/negativos?movil=' + $('#m').value);
      $('#r').innerHTML = tablaSimple(r, [{ t: 'Teléfono', k: 'telefono' }, { t: 'Alias / cliente', k: 'alias' }, { t: 'Domicilio', k: 'domicilio' }, { t: 'Acción', f: x => `<button class="btn chico rojo" data-q="${x.cliente_id}">Quitar</button>` }], 'Sin negativos para este móvil');
      $$('[data-q]', main).forEach(b => b.onclick = async () => { await api(`/api/clientes/${b.dataset.q}/negativos`, { body: { numero: $('#m').value, quitar: true } }); buscar(); });
    }
    $('#b').onclick = buscar; $('#m').onchange = buscar;
    $('#ag').onclick = async () => {
      const r = await pedir('Agregar negativo', [{ k: 'telefono', l: 'Teléfono del cliente' }, { k: 'numero', l: 'Móvil', t: 'number', def: $('#m').value }]);
      if (!r) return; const c = await api('/api/clientes/tel/' + encodeURIComponent(r.telefono)); if (!c) return toast('No existe ese cliente', 'error');
      try { await api(`/api/clientes/${c.id}/negativos`, { body: { numero: r.numero } }); $('#m').value = r.numero; buscar(); } catch (e) { fallo(e); }
    };
  }
});

ruta('top10', {
  titulo: 'Top 10', async render(main) {
    main.innerHTML = cabecera('Top conductores', 'Ranking por conductor y móvil. Se actualiza automáticamente cada 60 segundos.', '<button class="btn sec" id="ac">⟳ Actualizar</button>') + '<div class="grid g3" id="r"></div>';
    async function cargar() {
      if (!document.body.contains($('#r'))) return clearInterval(tm);
      const r = await api('/api/informes/top10');
      $('#r').innerHTML = [[1, '1 día'], [7, '7 días'], [30, '30 días']].map(([k, t]) => `<div class="card"><div class="head"><h3>🏆 ${t}</h3></div><ol class="body top10" style="margin:0;padding-left:30px">${r[k].map((x, i) => `<li><span>${i < 3 ? ['🥇', '🥈', '🥉'][i] : ''} <b>${esc(x.conductor.toUpperCase())}</b> <small>Móvil ${x.movil}</small></span><b>${x.viajes}</b></li>`).join('') || '<p>Sin viajes</p>'}</ol></div>`).join('');
    }
    const tm = setInterval(cargar, 60000);
    $('#ac').onclick = cargar; cargar();
  }
});

// Viajes por móvil / Mis viajes
function vistaViajesMovil(main, titulo, desc, moviles) {
  const horas = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
  main.innerHTML = cabecera(titulo, desc) +
    `<div class="card"><div class="body fila"><div class="campo"><label>Desde</label><input type="date" id="fd" value="${diasAtras(7)}"></div><div class="campo"><label>Hora</label><select id="hd">${horas.map(h => `<option>${h}</option>`).join('')}</select></div><div class="campo"><label>Hasta</label><input type="date" id="fh" value="${hoyISO()}"></div><div class="campo"><label>Hora</label><select id="hh">${horas.map(h => `<option ${h === '23:30' ? 'selected' : ''}>${h}</option>`).join('')}</select></div>
      <div class="campo"><label>Móvil</label><select id="mv"><option value="">Todos</option>${(moviles || []).map(m => `<option value="${m.numero}">Móvil ${m.numero}</option>`).join('')}</select></div><div class="campo"><label>Tipo</label><select id="ti"><option value="">Todos</option><option value="central">De central</option><option value="calle">De calle</option><option value="corporativos">Corporativos</option></select></div><button class="btn" id="b">Buscar</button><button class="btn sec" id="rs">Reset</button>${botonCSV}</div><div class="body" id="k" style="padding-top:0"></div><div id="tb"></div></div>`;
  const p = () => ({ desde: $('#fd').value + ' ' + $('#hd').value + ':00', hasta: $('#fh').value + ' ' + $('#hh').value + ':59', movil: $('#mv').value, tipo: $('#ti').value });
  const t = tabla($('#tb'), {
    cols: [{ t: 'N° viaje', f: x => `<a href="#" data-v="${x.id}">#${x.id}</a>` }, { t: 'Fecha', f: x => fechaLarga(x.fecha) }, { t: 'Móvil', k: 'movil' }, { t: 'Trayecto', f: x => `${esc(x.origen_dir)}<br><small>→ ${esc(x.destino_dir || '—')}</small>` }, { t: 'Km / tiempo', f: x => `${km1(x.km)} km · ${x.minutos ? Math.round(x.minutos) + ' min' : '—'}` }, { t: 'Monto', c: 'r', f: x => pesos(x.monto) }, { t: 'Pago', k: 'pago' }],
    cargar: async () => { const r = await api('/api/informes/viajes-movil?' + qs(p())); $('#k').innerHTML = `<div class="grid g3"><div class="kpi"><div class="l">Viajes</div><div class="v">${r.totales.viajes}</div></div><div class="kpi"><div class="l">Monto total</div><div class="v">${pesos(r.totales.monto)}</div></div><div class="kpi"><div class="l">Móviles</div><div class="v">${r.totales.moviles}</div></div></div>`; return r.filas; },
    pie: () => $$('[data-v]', main).forEach(a => a.onclick = e => { e.preventDefault(); descargar('/print/ticket/' + a.dataset.v); }),
  });
  $('#b').onclick = () => t.refrescar(true);
  $('#rs').onclick = () => { $('#fd').value = diasAtras(7); $('#fh').value = hoyISO(); $('#mv').value = $('#ti').value = ''; t.refrescar(true); };
  $('#csv').onclick = () => descargar('/api/informes/viajes-movil?' + qs({ ...p(), formato: 'csv' }));
}
ruta('viajes-por-movil', { titulo: 'Viajes por móvil', roles: ['gestion'], render: main => vistaViajesMovil(main, 'Viajes por móvil', 'Informe de viajes finalizados con filtros de fecha, móvil y tipo.', R.cat.moviles) });
