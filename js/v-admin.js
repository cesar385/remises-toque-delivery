// Administración: móviles, penalizados, solicitudes, usuarios, corporativos, tarifas, canales, feriados, docs, medios, módulos

// ---------- Móviles ----------
ruta('moviles', {
  titulo: 'Móviles', roles: ['admin'], render(main) {
    main.innerHTML = cabecera('Móviles', 'Administración de la flota. Usá el botón de acciones en cada fila para modificar un móvil.', '<button class="btn" id="nuevo">+ Nuevo</button><button class="btn sec" id="ac">⟳ Actualizar</button>') +
      '<div class="card"><div class="head"><input type="search" id="b" placeholder="Buscar por número, patente, licencia o titular" style="max-width:360px"></div><div id="tb"></div></div>';
    const t = tabla($('#tb'), {
      cols: [{ t: 'Número', f: m => `<b>${m.numero}</b>` }, { t: 'Patente', k: 'patente' }, { t: 'Licencia', k: 'licencia' }, { t: 'Vehículo', f: m => esc([m.marca, m.modelo, m.anio].filter(Boolean).join(' ')) }, { t: 'Titular', f: m => m.titular ? `${esc(m.titular)} <small>(${esc(m.titular_doc)})</small>` : '—' }, { t: 'Conductores', f: m => m.conductores.map(c => esc(c.nombre)).join('<br>') || '—' }, { t: 'Plan', k: 'plan' }, { t: 'Hab', f: m => m.habilitado ? '<b style="color:var(--verde)">SI</b>' : '<b style="color:var(--rojo)">NO</b>' }],
      cargar: p => api('/api/moviles?' + qs({ ...p, buscar: $('#b').value })),
      acciones: m => [{ t: 'Modificar', ico: '✎', a: () => editarMovil(m, () => t.refrescar()) }, { t: m.habilitado ? 'Inhabilitar' : 'Habilitar', ico: m.habilitado ? '⛔' : '✅', a: async () => { await api('/api/moviles', { body: { ...m, conductores: m.conductores.map(c => c.id), docs: JSON.parse(m.docs || '[]'), habilitado: !m.habilitado } }); t.refrescar(); } }, { t: 'Cuenta', ico: '💲', a: () => gestionarCuenta(m.id, m.numero) }, { t: 'Recorrido', ico: '🛣', a: () => ir('recorrido?movil=' + m.id) }, { t: 'Eliminar', ico: '🗑', a: () => eliminarMovil(m, () => t.refrescar()) }],
    });
    let tb; $('#b').oninput = () => { clearTimeout(tb); tb = setTimeout(() => t.refrescar(true), 300); };
    $('#ac').onclick = () => t.refrescar(); $('#nuevo').onclick = () => editarMovil({ habilitado: 1, tarifador: 1, conductores: [] }, () => t.refrescar());
  }
});
async function eliminarMovil(m, listo) {
  const ok = await confirmar(`¿Eliminar el móvil ${m.numero}${m.patente ? ' (' + m.patente + ')' : ''}? Se borran también su cuenta, sus movimientos y sus asignaciones de conductores. Los viajes ya realizados quedan en el historial. Esta acción no se puede deshacer.`, 'Eliminar móvil');
  if (!ok) return;
  try { await api('/api/moviles/' + m.id, { method: 'DELETE' }); toast('Móvil ' + m.numero + ' eliminado', 'ok'); R.cat = await api('/api/catalogos'); listo && listo(); } catch (e) { fallo(e); }
}
async function editarMovil(m, listo) {
  const us = (await api('/api/usuarios?limite=500')).filas;
  const titulares = us.filter(u => u.roles.includes('titular'));
  const conductores = us.filter(u => u.roles.includes('conductor'));
  let docs = typeof m.docs === 'string' ? JSON.parse(m.docs || '[]') : (m.docs || []);
  const cuerpo = h(`<div><div class="tabs"><button class="act" data-t="datos">Datos</button><button data-t="docs">Documentación</button></div><div data-p="datos"></div><div data-p="docs" class="oculto"></div></div>`);
  const f = formulario([
    { t: 'titulo', l: '🚗 Identificación' }, { k: 'numero', l: 'Número de móvil', t: 'number' }, { k: 'patente', l: 'Patente' }, { k: 'licencia', l: 'Licencia' },
    { t: 'titulo', l: 'Vehículo' }, { k: 'tipo_vehiculo', l: 'Tipo de vehículo', t: 'select', op: [['auto', '🚗 Auto'], ['moto', '🏍 Moto']] }, { k: 'marca', l: 'Marca' }, { k: 'modelo', l: 'Modelo' }, { k: 'anio', l: 'Año', t: 'number' }, { k: 'color', l: 'Color' },
    { t: 'titulo', l: '⚙ Operación' }, { k: 'titular_id', l: 'Titular', t: 'select', op: [['', '— sin titular —'], ...titulares.map(u => [u.id, `${u.nombre} ${u.apellido} (${u.documento})`])] },
    { k: 'tarifador', t: 'check', cl: 'Usa tarifador de la app' }, { k: 'simulado', t: 'check', cl: 'Móvil simulado (demo)' }, { k: 'exigir_obd', t: 'check', cl: 'Exigir dispositivo OBD' }, { k: 'habilitado', t: 'check', cl: 'Habilitado' },
    { k: 'conductores', l: 'Conductores habilitados', t: 'multi', w: 'full', op: conductores.map(u => [u.id, `${u.nombre} ${u.apellido}`]) },
  ], { ...m, conductores: (m.conductores || []).map(c => c.id) });
  $('[data-p=datos]', cuerpo).append(f);
  const pd = $('[data-p=docs]', cuerpo);
  function pintarDocs() {
    pd.innerHTML = tablaSimple(docs, [{ t: 'Tipo', k: 'tipo' }, { t: 'Vence', f: d => d.vence ? fechaLarga(d.vence) + (d.vence < hoyISO() ? ' <b style="color:var(--rojo)">VENCIDO</b>' : '') : '—' }, { t: 'Archivo', f: d => linkDoc(d, 'Ver') }, { t: '', f: (d) => `<button class="btn-icono" data-del="${docs.indexOf(d)}">🗑</button>` }], 'Sin documentación') +
      `<div class="fila" style="margin-top:10px"><select id="dt" style="width:auto">${['Seguro', 'VTV / RTO', 'Cédula verde', 'Habilitación municipal', 'Título', 'Otro'].map(x => `<option>${x}</option>`).join('')}</select><input type="date" id="dv" style="width:auto"><input type="file" id="df" style="width:auto"><button class="btn chico" id="da">Agregar</button></div>`;
    $$('[data-del]', pd).forEach(b => b.onclick = () => { docs.splice(+b.dataset.del, 1); pintarDocs(); });
    $('#da', pd).onclick = async () => { const fi = $('#df', pd).files[0]; let archivo = null; if (fi) archivo = (await subir(fi)).archivo; docs.push({ tipo: $('#dt', pd).value, vence: $('#dv', pd).value || null, archivo }); pintarDocs(); };
  }
  pintarDocs();
  $$('.tabs button', cuerpo).forEach(b => b.onclick = () => { $$('.tabs button', cuerpo).forEach(x => x.classList.toggle('act', x === b)); $$('[data-p]', cuerpo).forEach(p => p.classList.toggle('oculto', p.dataset.p !== b.dataset.t)); });
  modal({ titulo: m.id ? 'Modificar móvil ' + m.numero : 'Nuevo móvil', ancho: true, cuerpo, botones: [{ texto: 'Cerrar', clase: 'sec' }, { texto: '💾 Guardar', clase: 'verde', accion: async () => { const dm = leer(f); const gm = await api('/api/moviles', { body: { ...dm, id: m.id, docs } }); await api('/api/moviles/' + (m.id || gm.id) + '/tipo', { body: { tipo: dm.tipo_vehiculo || 'auto' } }); toast('Móvil guardado', 'ok'); R.cat = await api('/api/catalogos'); listo && listo(); } }] });
}

// ---------- Penalizados ----------
ruta('moviles-penalizados', {
  titulo: 'Móviles penalizados', roles: ['admin', 'gestion', 'operador'], render(main) {
    main.innerHTML = cabecera('Móviles penalizados', 'Gestión de penalizaciones de conductores. Usá el botón de acciones para quitar una penalización.', '<button class="btn rojo" id="pen">Penalizar</button><button class="btn sec" id="ac">⟳ Actualizar</button>') + '<div class="card" id="tb"></div>';
    const t = tabla($('#tb'), { cols: [{ t: 'Móvil', f: p => `<b>${p.numero}</b>` }, { t: 'Hasta', f: p => fechaLarga(p.hasta) }, { t: 'Usuario', k: 'usuario' }, { t: 'Motivo', k: 'motivo' }], cargar: () => api('/api/penalizados'), acciones: p => [{ t: 'Quitar penalización', ico: '✅', a: async () => { await api('/api/penalizados/' + p.id, { method: 'DELETE' }); t.refrescar(); } }] });
    $('#ac').onclick = () => t.refrescar();
    $('#pen').onclick = async () => { const r = await pedir('Penalizar móvil', [{ k: 'numero', l: 'Número de móvil', t: 'number' }, { k: 'minutos', l: 'Duración', t: 'select', op: [[30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [240, '4 horas'], [720, '12 horas'], [1440, '1 día'], [4320, '3 días'], [10080, '1 semana']] }, { k: 'motivo', l: 'Motivo', w: 'full' }]); if (r) try { await api('/api/penalizados', { body: r }); t.refrescar(); } catch (e) { fallo(e); } };
  }
});

// ---------- Solicitudes de alta ----------
ruta('solicitudes-conductor', {
  titulo: 'Solicitudes de alta conductor', roles: ['admin'], render(main) {
    main.innerHTML = cabecera('Solicitudes de alta conductor', 'Revisá solicitudes, precargá datos en el sistema o pedí correcciones al conductor.') +
      `<div class="card"><div class="body fila"><div class="campo"><label>Estado</label><select id="e"><option value="pendientes">Pendientes</option><option value="observadas">Observadas</option><option value="precargadas">Precargadas</option><option value="rechazadas">Rechazadas</option><option value="">Todas</option></select></div><div class="campo"><label>Conductor</label><input id="c"></div><div class="campo"><label>DNI</label><input id="d"></div><div class="campo"><label>Patente</label><input id="p"></div><button class="btn" id="bu">Buscar</button></div><div id="tb"></div></div>`;
    const t = tabla($('#tb'), {
      vacio: 'No hay solicitudes.',
      cols: [{ t: 'ID', k: 'id' }, { t: 'Estado', f: s => `<span class="pill">${esc(s.estado)}</span>` }, { t: 'Conductor', f: s => `${esc(s.nombre)} ${esc(s.apellido || '')}<br><small>DNI ${esc(s.dni)}</small>` }, { t: 'Contacto', f: s => `${esc(s.telefono)}<br><small>${esc(s.email || '')}</small>` }, { t: 'Vehículo', f: s => esc([s.marca, s.modelo, s.anio, s.patente].filter(Boolean).join(' ')) }, { t: 'Fecha', f: s => fechaLarga(s.fecha) }, { t: 'Docs', f: s => JSON.parse(s.docs || '[]').map(d => linkDoc(d)).join(', ') || '—' }],
      cargar: () => api('/api/solicitudes?' + qs({ estado: $('#e').value, conductor: $('#c').value, dni: $('#d').value, patente: $('#p').value })),
      acciones: s => [
        { t: 'Precargar usuario (y móvil)', ico: '📥', a: async () => { const r = await pedir('Precargar', [{ t: 'html', html: '<p>Se crea el usuario conductor (clave inicial: últimos 6 dígitos del DNI). Si indicás número de móvil, se crea inhabilitado o se vincula al existente.</p>' }, { k: 'numero', l: 'Número de móvil (opcional)', t: 'number' }]); if (r) { await api(`/api/solicitudes/${s.id}/precargar`, { body: r }); toast('Precargado', 'ok'); t.refrescar(); } } },
        { t: 'Pedir corrección', ico: '✎', a: async () => { const r = await pedir('Observar solicitud', [{ k: 'observacion', l: 'Qué debe corregir', t: 'textarea', w: 'full' }]); if (r) { await api(`/api/solicitudes/${s.id}/observar`, { body: r }); t.refrescar(); } } },
        { t: 'Rechazar', ico: '⛔', a: async () => { const r = await pedir('Rechazar solicitud', [{ k: 'observacion', l: 'Motivo', w: 'full' }]); if (r) { await api(`/api/solicitudes/${s.id}/rechazar`, { body: r }); t.refrescar(); } } },
      ],
    });
    $('#bu').onclick = $('#e').onchange = () => t.refrescar(true);
  }
});

// ---------- Usuarios ----------
const ROLES = [['admin', 'Admin'], ['gestion', 'Gestión / Contable'], ['operador', 'Operador'], ['titular', 'Titular'], ['conductor', 'Conductor'], ['corporativo', 'Corporativo']];
ruta('usuarios', {
  titulo: 'Usuarios', roles: ['admin'], render(main) {
    main.innerHTML = cabecera('Usuarios', 'Usuarios del sistema. Usá el botón de acciones en cada fila para modificar datos o resetear la contraseña.', '<button class="btn" id="nuevo">+ Nuevo</button><button class="btn sec" id="ac">⟳ Actualizar</button>') +
      `<div class="card"><div class="head"><input type="search" id="b" placeholder="Buscar por documento, nombre o usuario" style="max-width:320px"><select id="p" style="width:auto"><option value="">Todos</option>${ROLES.map(r => `<option value="${r[0]}">${r[1]}</option>`).join('')}</select><button class="btn sec chico" id="rf">Restablecer filtros</button></div><div id="tb"></div></div>`;
    const t = tabla($('#tb'), {
      cols: [{ t: 'Foto', f: u => u.foto ? `<img src="${esc(u.foto)}" class="avatar">` : `<span class="avatar">${esc(u.nombre[0])}</span>` }, { t: 'Documento', k: 'documento' }, { t: 'Nombre y apellido', f: u => `${esc(u.nombre)} ${esc(u.apellido)}${u.usuario ? `<br><small>@${esc(u.usuario)}</small>` : ''}` }, { t: 'Móviles', f: u => u.moviles.join(', ') || '—' }, { t: 'Permisos', f: u => u.roles.split(',').map(r => `<span class="pill">${(ROLES.find(x => x[0] === r) || [, r])[1]}</span>`).join(' ') }, { t: 'Hab', f: u => u.habilitado ? '<b style="color:var(--verde)">SI</b>' : '<b style="color:var(--rojo)">NO</b>' }],
      cargar: p => api('/api/usuarios?' + qs({ ...p, buscar: $('#b').value, permiso: $('#p').value })),
      acciones: u => [{ t: 'Modificar', ico: '✎', a: () => editarUsuario(u, () => t.refrescar()) }, { t: 'Resetear contraseña', ico: '🔑', a: async () => { const r = await pedir('Resetear contraseña de ' + u.nombre, [{ k: 'password', l: 'Nueva contraseña (vacío = documento)', t: 'text' }]); if (r) { await api(`/api/usuarios/${u.id}/reset`, { body: r }); toast('Contraseña reseteada', 'ok'); } } }],
    });
    let tb; $('#b').oninput = () => { clearTimeout(tb); tb = setTimeout(() => t.refrescar(true), 300); };
    $('#p').onchange = () => t.refrescar(true); $('#ac').onclick = () => t.refrescar(); $('#rf').onclick = () => { $('#b').value = $('#p').value = ''; t.refrescar(true); };
    $('#nuevo').onclick = () => editarUsuario({ habilitado: 1, roles: 'operador' }, () => t.refrescar());
  }
});
async function editarUsuario(u, listo) {
  const corps = await api('/api/corporativos');
  let docs = typeof u.docs === 'string' ? JSON.parse(u.docs || '[]') : (u.docs || []);
  const f = formulario([
    { k: 'documento', l: 'Documento' }, { k: 'usuario', l: 'Usuario de login (opcional)' }, { k: 'nombre', l: 'Nombre' }, { k: 'apellido', l: 'Apellido' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'telefono', l: 'Teléfono' },
    { k: 'roles', l: 'Permisos', t: 'multi', w: 'full', op: ROLES }, { k: 'corporativo_id', l: 'Empresa (si es corporativo)', t: 'select', op: [['', '—'], ...corps.map(c => [c.id, c.nombre])] }, { k: 'licencia_vence', l: 'Vencimiento licencia de conducir', t: 'date' },
    { k: 'password', l: u.id ? 'Nueva contraseña (opcional)' : 'Contraseña (vacío = documento)', t: 'text' }, { k: 'habilitado', t: 'check', cl: 'Habilitado' },
    { t: 'html', html: '<div class="campo"><label>Foto</label><input type="file" id="ufoto" accept="image/*"></div>' },
  ], { ...u, roles: (u.roles || '').split(',') });
  modal({ titulo: u.id ? 'Modificar usuario' : 'Nuevo usuario', ancho: true, cuerpo: f, botones: [{ texto: 'Cerrar', clase: 'sec' }, { texto: '💾 Guardar', clase: 'verde', accion: async () => { const d = leer(f); const fi = $('#ufoto').files[0]; if (fi) d.foto = (await subir(fi)).archivo; await api('/api/usuarios', { body: { ...d, id: u.id, docs } }); toast('Usuario guardado', 'ok'); listo && listo(); } }] });
}

ruta('corporativos', {
  titulo: 'Clientes corporativos', roles: ['admin'], render(main) {
    main.innerHTML = cabecera('Clientes corporativos', 'Empresas con cuenta corriente. Sus usuarios (rol Corporativo) piden viajes desde el pedido web y los viajes quedan a cuenta de la empresa.', '<button class="btn" id="n">+ Nueva empresa</button>') + '<div class="card" id="tb"></div>';
    const campos = [{ k: 'nombre', l: 'Nombre' }, { k: 'cuit', l: 'CUIT' }, { k: 'centro_costo', l: 'Centro de costo' }, { k: 'contacto', l: 'Contacto' }, { k: 'telefono', l: 'Teléfono' }, { k: 'activo', t: 'check', cl: 'Activa' }];
    const ed = async c => { const r = await pedir(c.id ? 'Modificar empresa' : 'Nueva empresa', campos, c); if (r) { await api('/api/corporativos', { body: { ...r, id: c.id } }); t.refrescar(); } };
    const t = tabla($('#tb'), { cols: [{ t: 'Empresa', k: 'nombre' }, { t: 'CUIT', k: 'cuit' }, { t: 'Centro de costo', k: 'centro_costo' }, { t: 'Contacto', f: c => esc((c.contacto || '') + ' ' + (c.telefono || '')) }, { t: 'Activa', f: c => c.activo ? 'SI' : 'NO' }], cargar: () => api('/api/corporativos'), acciones: c => [{ t: 'Modificar', a: () => ed(c) }, { t: 'Ver viajes', a: () => ir('viajes-por-movil') }] });
    $('#n').onclick = () => ed({ activo: 1 });
  }
});

// ---------- Tarifas ----------
const DIAS = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];
ruta('tarifas', {
  titulo: 'Tarifas', roles: ['admin'], async render(main) {
    main.innerHTML = cabecera('Gestión de tarifas', 'Administrá bandera, fichas y tipo fija o dinámica. El índice muestra cómo está la demanda ahora.', '<button class="btn" id="nueva">+ Nueva</button><button class="btn sec" id="ac">⟳ Actualizar</button>') +
      `<div class="nota"><b>Tarifa dinámica, en simple:</b> arranca de la tarifa de siempre (bandera + fichas). Si hay más pedidos de lo habitual, pocos autos libres o lluvia, el precio sube de a 5% sin pasar la <i>suba máxima</i>. No baja por defecto. Destino, canal y medio de pago no entran en esa cuenta.</div>
      <div class="grid g2"><div class="card"><div class="head"><h3>📈 Índice ahora</h3><button class="btn sec chico" id="ref">Refrescar</button></div><div class="body" id="ind"></div></div><div class="card"><div class="head"><h3>🧮 Simulador de precio</h3></div><div class="body fila"><div class="campo"><label>Km</label><input type="number" id="sk" value="3" step="0.1"></div><div class="campo"><label>Minutos de espera</label><input type="number" id="se" value="0"></div><b id="sr" style="font-size:20px;margin-left:auto">—</b></div></div></div>
      <div class="card" id="tb"></div>`;
    let datos;
    async function cargarInd() {
      datos = await api('/api/tarifas');
      const v = datos.vigente, i = datos.indice;
      $('#ind').innerHTML = v ? `<div class="grid g3"><div class="kpi"><div class="l">Tarifa vigente</div><div class="v" style="font-size:16px">${esc(v.nombre)} (${v.tipo})</div></div><div class="kpi"><div class="l">Índice</div><div class="v">${i.modo === 'Fija' ? 'Fija' : '×' + i.indice}</div></div><div class="kpi"><div class="l">Clima</div><div class="v" style="font-size:16px">${datos.clima.temp != null ? datos.clima.temp + '°C ' : ''}${esc(datos.clima.desc)}</div></div>
        ${v.tabla && v.tabla.km && v.tabla.km.length ? `<div class="kpi"><div class="l">Viaje mínimo ahora</div><div class="v">${pesos(montoTarifa(v, 0, 0, i.indice))}</div><small>hasta ${v.tabla.km[0][0]} km</small></div><div class="kpi"><div class="l">Cálculo</div><div class="v" style="font-size:16px">Tabla por km</div><small>${v.tabla.km.length} tramos · espera por minutos</small></div>` : `<div class="kpi"><div class="l">Bajada ahora</div><div class="v">${pesos(v.bajada * i.indice)}</div></div><div class="kpi"><div class="l">Ficha</div><div class="v">${pesos(v.precio_ficha * i.indice)}</div><small>cada ${v.ficha_mts} m · espera c/${v.espera_seg}s</small></div>`}<div class="kpi"><div class="l">Pedidos 15' / libres</div><div class="v">${i.demanda ?? '—'} / ${i.libres ?? '—'}</div></div></div>` : 'No hay tarifas activas.';
      sim();
    }
    function sim() {
      const v = datos && datos.vigente; if (!v) return;
      $('#sr').textContent = pesos(montoTarifa(v, +$('#sk').value * 1000, +$('#se').value * 60, datos.indice.indice));
    }
    $('#sk').oninput = $('#se').oninput = sim; $('#ref').onclick = cargarInd;
    const t = tabla($('#tb'), {
      cols: [{ t: 'Orden', k: 'orden' }, { t: 'Tarifa', f: x => `<b>${esc(x.nombre)}</b><br><small>${esc(resumenTarifa(x))}</small>` }, { t: 'Tipo', f: x => x.tipo === 'dinamica' ? `Dinámica (≤ +${x.suba_max}%)` : 'Fija' }, { t: 'Activa', f: x => x.activa ? 'SI' : 'NO' }, { t: 'Días', f: x => JSON.parse(x.dias).map(d => DIAS.find(y => y[0] === d)[1].slice(0, 3)).join(', ') + (x.feriado ? ', Feriado' : '') }, { t: 'Horario', f: x => `${x.hora_desde} a ${x.hora_hasta}` }],
      cargar: async () => (await api('/api/tarifas')).tarifas,
      acciones: x => [{ t: 'Modificar', ico: '✎', a: () => editarTarifa(x, () => { t.refrescar(); cargarInd(); }) }, { t: 'Tabla de precios', ico: '📋', a: () => editarTablaTarifa(x, () => { t.refrescar(); cargarInd(); }) }, { t: 'Duplicar', ico: '⧉', a: () => editarTarifa({ ...x, id: null, nombre: x.nombre + ' (copia)' }, () => t.refrescar()) }, { t: x.activa ? 'Desactivar' : 'Activar', a: async () => { await api('/api/tarifas', { body: { ...x, dias: JSON.parse(x.dias), activa: !x.activa } }); t.refrescar(); cargarInd(); } }, { t: 'Eliminar', ico: '🗑', a: async () => { if (await confirmar('¿Eliminar la tarifa ' + x.nombre + '?')) { await api('/api/tarifas/' + x.id, { method: 'DELETE' }); t.refrescar(); } } }],
    });
    $('#nueva').onclick = () => editarTarifa({ activa: 1, tipo: 'fija', con_espera: 1, espera_seg: 60, dias: '[1,2,3,4,5,6,0]', hora_desde: '00:00', hora_hasta: '23:59', redondeo_mts: 100, ficha_mts: 100, suba_max: 30, orden: 10 }, () => t.refrescar());
    $('#ac').onclick = () => { t.refrescar(); cargarInd(); };
    cargarInd();
  }
});
function editarTablaTarifa(x, listo) {
  const tb = x.tabla || {};
  const km = (tb.km || []).map(r => `${String(r[0]).replace('.', ',')} ${r[1]}`).join('\n');
  const es = (tb.espera || []).map(r => `${r[0]} ${r[1]}`).join('\n');
  const f = formulario([
    { t: 'html', html: '<div class="nota">Con tabla, el precio sale de la distancia recorrida (en tramos de 100 m) y de los minutos de espera; la bajada y las fichas no se usan. Una fila por línea: <b>km precio</b> (ej. <code>1,0 4500</code>) y <b>minutos precio</b> (ej. <code>5 1500</code>). Si dejás vacía la tabla de km, la tarifa vuelve a calcular con bajada + fichas.</div>' },
    { k: 'km', l: 'Distancia: km y precio', t: 'textarea' }, { k: 'espera', l: 'Espera: minutos y precio', t: 'textarea' },
    { k: 'extra_m', l: 'Pasado el último km, sumar cada (metros)', t: 'number', def: 400 }, { k: 'extra_monto', l: '… este monto ($)', t: 'number', def: 500 },
    { k: 'esp_min', l: 'Pasado el último tramo de espera, sumar cada (min)', t: 'number', def: 5 }, { k: 'esp_monto', l: '… este monto ($)', t: 'number', def: 500 },
    { t: 'titulo', l: '🛣 Viajes afuera (larga distancia)' },
    { t: 'html', html: '<div class="nota">Independiente de la tabla de km: cuando el viaje llega a esta distancia, <b>todo el recorrido</b> se cobra al precio por km de abajo (en tramos de 100 m), más la espera. Ej.: 15 km × $1.800 = $27.000. Dejá el precio en 0 para no usarlo.</div>' },
    { k: 'af_desde', l: 'Desde (km)', t: 'number', def: 15 }, { k: 'af_precio', l: 'Precio por km ($)', t: 'number', def: 1800 },
  ], { km, espera: es, extra_m: tb.extra ? tb.extra.cada_m : 400, extra_monto: tb.extra ? tb.extra.monto : 500, esp_min: tb.espera_extra ? tb.espera_extra.cada_min : 5, esp_monto: tb.espera_extra ? tb.espera_extra.monto : 500,
    af_desde: tb.afuera ? tb.afuera.desde_km : 15, af_precio: tb.afuera ? tb.afuera.precio_km : 1800 });
  $$('textarea', f).forEach(a => { a.rows = 14; a.style.fontFamily = 'monospace'; });
  const filas = (txt, nombre) => txt.split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => {
    const p = l.replace(/\$/g, '').split(/[\s;\t]+/); const a = parseFloat(p[0].replace(',', '.')); const b = parseFloat((p[1] || '').replace(/\./g, '').replace(',', '.'));
    if (!(a >= 0) || !(b >= 0)) throw new Error(`${nombre}: la línea ${i + 1} ("${l}") no se entiende`); return [a, b];
  }).sort((a, b) => a[0] - b[0]);
  modal({ titulo: 'Tabla de precios · ' + x.nombre, ancho: true, cuerpo: f, botones: [{ texto: 'Cerrar', clase: 'sec' }, { texto: '💾 Guardar tabla', clase: 'verde', accion: async () => {
    const d = leer(f);
    const tabla = { km: filas(d.km, 'Distancia'), extra: { cada_m: +d.extra_m || 400, monto: +d.extra_monto || 0 }, espera: filas(d.espera, 'Espera'), espera_extra: { cada_min: +d.esp_min || 5, monto: +d.esp_monto || 0 }, afuera: { desde_km: Math.max(0, parseFloat(String(d.af_desde).replace(',', '.')) || 0), precio_km: Math.max(0, parseFloat(String(d.af_precio).replace(',', '.')) || 0) } };
    await api(`/api/tarifas/${x.id}/tabla`, { body: { tabla } }); toast('Tabla guardada', 'ok'); listo && listo();
  } }] });
}
function editarTarifa(x, listo) {
  const f = formulario([
    ...(x.tabla && x.tabla.km && x.tabla.km.length ? [{ t: 'html', html: '<div class="nota">Esta tarifa usa <b>tabla de precios</b> (botón 📋): la bajada y las fichas de abajo no se aplican. Acá se configuran nombre, días, horario y si cobra espera.</div>' }] : []),
    { t: 'titulo', l: '🏷 Datos generales' }, { k: 'nombre', l: 'Nombre' }, { k: 'tipo', l: 'Tipo', t: 'select', op: [['fija', 'Fija'], ['dinamica', 'Dinámica']] }, { k: 'orden', l: 'Orden (prioridad)', t: 'number' }, { k: 'activa', t: 'check', cl: 'Tarifa activa' },
    { k: 'bajada', l: 'Bajada de bandera ($)', t: 'number' }, { k: 'suba_max', l: 'Suba máxima % (dinámica)', t: 'number' }, { k: 'baja_max', l: 'Baja máxima % (dinámica)', t: 'number' },
    { t: 'titulo', l: '⏳ Espera y cortesía' }, { k: 'con_espera', l: 'Espera', t: 'select', op: [['true', 'Tarifador con espera'], ['false', 'Tarifador sin espera']] }, { k: 'espera_seg', l: 'Una ficha de espera cada', t: 'select', op: [[30, '30 segundos'], [60, '1 minuto'], [120, '2 minutos'], [180, '3 minutos'], [300, '5 minutos'], [600, '10 minutos'], [900, '15 minutos'], [1800, '30 minutos'], [3600, '1 hora']] },
    { k: 'precio_ficha', l: 'Precio ficha ($)', t: 'number' }, { k: 'cortesia_mts', l: 'Cortesía distancia (metros)', t: 'number' }, { k: 'cortesia_min', l: 'Minutos de cortesía (espera)', t: 'select', op: Array.from({ length: 16 }, (_, i) => [i, i ? i + ' minuto' + (i > 1 ? 's' : '') : 'Sin tiempo de cortesía']) },
    { t: 'titulo', l: '📅 Días y horario' }, { k: 'dias', l: 'Días', t: 'multi', w: 'full', op: DIAS }, { k: 'feriado', t: 'check', cl: 'Aplica en feriados', w: 'full' }, { k: 'hora_desde', l: 'Horario desde', t: 'time' }, { k: 'hora_hasta', l: 'Horario hasta', t: 'time' },
    { t: 'titulo', l: '📏 Distancia y fichas' }, { k: 'redondeo_mts', l: 'Redondeo de distancia (m)', t: 'select', op: [[10, '10 m'], [50, '50 m'], [100, '100 m'], [200, '200 m']] }, { k: 'ficha_mts', l: 'Caída de ficha por distancia (m)', t: 'select', op: [[50, '50 m'], [100, '100 m'], [130, '130 m'], [150, '150 m'], [200, '200 m'], [250, '250 m'], [500, '500 m'], [1000, '1000 m']] },
  ], { ...x, dias: JSON.parse(x.dias || '[]') });
  modal({ titulo: x.id ? 'Modificar tarifa' : 'Nueva tarifa', ancho: true, cuerpo: f, botones: [{ texto: 'Cerrar', clase: 'sec' }, { texto: '💾 Guardar', clase: 'verde', accion: async () => { const d = leer(f); d.dias = d.dias.map(Number); d.con_espera = d.con_espera === 'true'; await api('/api/tarifas', { body: { ...d, id: x.id } }); toast('Tarifa guardada', 'ok'); listo && listo(); } }] });
}

// ---------- Canales ----------
ruta('canales-solicitud', {
  titulo: 'Canales de solicitud', roles: ['admin'], async render(main) {
    main.innerHTML = cabecera('Canales de solicitud', 'Definí ajuste de precio, promo, PIN y si el canal cobra con tarifador (precio sugerido), fijo (exacto) o ya está pagado. Los canales son fijos del sistema.', '<button class="btn sec" id="ac">⟳ Actualizar</button><button class="btn verde" id="g">💾 Guardar cambios</button>') +
      '<div class="nota"><b>Tarifado:</b> el monto mostrado es estimado aunque haya destino. <b>Fijo:</b> se cobra exactamente lo cotizado. <b>Pagado:</b> no se cobra al pasajero. Mercado Pago siempre es precio fijo según el estado del pago.</div><div class="grid g3" id="cs"></div>';
    async function cargar() {
      const cs = await api('/api/canales');
      $('#cs').innerHTML = cs.map(c => `<div class="card" data-c="${c.codigo}"><div class="head"><h3>${CANALES_ICO[c.codigo] || ''} ${esc(c.nombre)}</h3><small>${c.codigo}</small></div><div class="body" style="display:flex;flex-direction:column;gap:8px">
        <label class="check"><input type="checkbox" name="promo" ${c.promo ? 'checked' : ''}> Promo / ajuste al pedir</label>
        <div class="campo"><label>Ajuste %</label><select name="ajuste_pct">${Array.from({ length: 41 }, (_, i) => -100 + i * 5).map(v => `<option ${v === c.ajuste_pct ? 'selected' : ''} value="${v}">${v > 0 ? '+' : ''}${v}%</option>`).join('')}</select></div>
        <label class="check"><input type="checkbox" name="exigir_pin" ${c.exigir_pin ? 'checked' : ''}> Exigir PIN al iniciar viaje</label>
        <div class="campo"><label>Cobro / precio</label><select name="cobro_modo">${[['tarifado', 'Tarifado (sugerido / aprox.)'], ['fijo', 'Fijo (cobrar lo cotizado)'], ['pagado', 'Pagado (ya cobrado)']].map(o => `<option value="${o[0]}" ${o[0] === c.cobro_modo ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div></div></div>`).join('');
    }
    $('#ac').onclick = cargar;
    $('#g').onclick = async () => { await api('/api/canales', { body: $$('[data-c]').map(el => ({ codigo: el.dataset.c, ...leer(el) })) }); toast('Canales guardados', 'ok'); R.cat = await api('/api/catalogos'); };
    cargar();
  }
});

// ---------- Feriados ----------
ruta('feriados', {
  titulo: 'Feriados', roles: ['admin'], render(main) {
    main.innerHTML = cabecera('Feriados', 'Días feriados del calendario operativo. Usá el botón de acciones para modificar o quitar un feriado.', '<button class="btn" id="n">+ Nuevo</button><button class="btn sec" id="ac">⟳ Actualizar</button>') + '<div class="card" id="tb"></div>';
    const ed = async x => { const r = await pedir(x.id ? 'Modificar feriado' : 'Nuevo feriado', [{ k: 'fecha', l: 'Fecha', t: 'date' }, { k: 'descripcion', l: 'Descripción' }], x); if (r) try { await api('/api/feriados', { body: { ...r, id: x.id } }); t.refrescar(); } catch (e) { fallo(e); } };
    const t = tabla($('#tb'), { porPagina: 50, cols: [{ t: 'Fecha', f: x => fechaLarga(x.fecha) + (x.fecha < hoyISO() ? ' <small style="color:var(--suave)">(pasado)</small>' : '') }, { t: 'Descripción', k: 'descripcion' }], cargar: () => api('/api/feriados'), acciones: x => [{ t: 'Modificar', a: () => ed(x) }, { t: 'Quitar', ico: '🗑', a: async () => { await api('/api/feriados/' + x.id, { method: 'DELETE' }); t.refrescar(); } }] });
    $('#n').onclick = () => ed({ fecha: hoyISO() }); $('#ac').onclick = () => t.refrescar();
  }
});

// ---------- Documentación reguladora ----------
ruta('documentacion-reguladora', {
  titulo: 'Documentación reguladora', roles: ['admin'], async render(main) {
    main.innerHTML = cabecera('Documentación reguladora', 'Generá notas y cartas para presentar ante municipios o entes de control.') + '<div class="nota alerta">Estos documentos son plantillas operativas, no asesoramiento legal. Revisalos con un abogado y con cada ente antes de presentarlos.</div><div class="tabs"><button class="act" data-t="docs">Documentos PDF</button><button data-t="emp">Datos de la empresa</button><button data-t="hist">Historial</button></div><div id="p"></div>';
    let tab = 'docs';
    async function pintar() {
      const d = await api('/api/docreg');
      const p = $('#p');
      if (tab === 'docs') {
        p.innerHTML = `<div class="card"><div class="head"><h3>1. Autoridad / ente destino</h3><button class="btn chico" id="na">+ Nueva autoridad</button><button class="btn sec chico" id="ea">Editar</button><button class="btn rojo chico" id="ba">Eliminar</button></div><div class="body"><select id="aut">${d.autoridades.map(a => `<option value="${a.id}">${esc(a.nombre)} — ${esc(a.organismo || '')}</option>`).join('')}</select></div></div>
          <div class="card"><div class="head"><h3>2. Documento</h3></div><div class="body grid g3">${[['nota', 'Nota de presentación', 'Presenta la empresa y el servicio ante la autoridad.'], ['carta', 'Carta del sistema de despacho', 'Describe el registro de viajes, seguimiento y seguridad.'], ['presentacion', 'Presentación del servicio', 'Ficha con datos operativos, flota y tarifa vigente.']].map(x => `<div class="kpi"><b>${x[1]}</b><p style="color:var(--suave)">${x[2]}</p><button class="btn" data-doc="${x[0]}">Generar PDF</button></div>`).join('')}</div></div>`;
        const edA = async a => { const r = await pedir(a.id ? 'Editar autoridad' : 'Nueva autoridad', [{ k: 'nombre', l: 'Nombre y apellido' }, { k: 'cargo', l: 'Cargo' }, { k: 'organismo', l: 'Organismo' }, { k: 'direccion', l: 'Dirección' }, { k: 'email', l: 'Email' }], a); if (r) { await api('/api/docreg/autoridad', { body: { ...r, id: a.id } }); pintar(); } };
        $('#na').onclick = () => edA({});
        $('#ea').onclick = () => edA(d.autoridades.find(a => a.id === +$('#aut').value) || {});
        $('#ba').onclick = async () => { if ($('#aut').value && await confirmar('¿Eliminar la autoridad?')) { await api('/api/docreg/autoridad/' + $('#aut').value, { method: 'DELETE' }); pintar(); } };
        $$('[data-doc]').forEach(b => b.onclick = () => descargar(`/print/docreg/${b.dataset.doc}?autoridad=${$('#aut').value}`));
      } else if (tab === 'emp') {
        const f = formulario([{ k: 'nombre', l: 'Nombre de fantasía' }, { k: 'razon_social', l: 'Razón social' }, { k: 'cuit', l: 'CUIT' }, { k: 'telefono', l: 'Teléfono' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'direccion', l: 'Dirección' }, { k: 'localidad', l: 'Localidad' }, { k: 'provincia', l: 'Provincia' },
        { k: 'lat', l: 'Latitud (centro del mapa)', t: 'number', step: 'any' }, { k: 'lng', l: 'Longitud', t: 'number', step: 'any' },
        { k: 'firmante_nombre', l: 'Firmante' }, { k: 'firmante', l: 'Carácter del firmante', t: 'select', op: ['Titular', 'Apoderado', 'Encargado'] }, { k: 'tipo_servicio', l: 'Tipo de servicio', t: 'select', op: ['Taxi', 'Remis', 'Mixto (taxi/remis)', 'Conductor particular'] }, { k: 'quien_factura', l: 'Quién factura', t: 'select', op: ['La empresa', 'El conductor'] },
        { k: 'descripcion', l: 'Descripción del servicio', t: 'textarea', w: 'full' }, { k: 'apps_ios', t: 'check', cl: 'Apps iPhone / iOS habilitadas' }, { k: 'pagos_electronicos', t: 'check', cl: 'Acepta medios de pago electrónicos' }, { k: 'boton_emergencia', t: 'check', cl: 'Pasajero tiene mecanismo de emergencia' }], d.empresa);
        p.innerHTML = '<div class="card"><div class="body" id="fe"></div><div style="padding:0 14px 14px;text-align:right"><button class="btn verde" id="ge">💾 Guardar perfil</button></div></div>';
        $('#fe').append(f);
        $('#ge').onclick = async () => { const x = leer(f); x.lat = +x.lat; x.lng = +x.lng; await api('/api/docreg/empresa', { body: x }); toast('Datos guardados', 'ok'); R.cat = await api('/api/catalogos'); };
      } else p.innerHTML = '<div class="card">' + tablaSimple(d.historial, [{ t: 'Fecha', f: x => fechaLarga(x.fecha) }, { t: 'Documento', k: 'tipo' }, { t: 'Destino', k: 'autoridad' }, { t: 'Usuario', k: 'usuario' }], 'Sin documentos generados') + '</div>';
    }
    $$('.tabs button', main).forEach(b => b.onclick = () => { $$('.tabs button', main).forEach(x => x.classList.toggle('act', x === b)); tab = b.dataset.t; pintar(); });
    pintar();
  }
});

// ---------- Medios de pago ----------
ruta('medios-pago', {
  titulo: 'Medios de pago', roles: ['admin'], async render(main) {
    const d = await api('/api/medios-pago');
    main.innerHTML = cabecera('Medios de pago', 'Habilitá los medios de cobro de tu empresa y configurá cómo te pagan los conductores las cargas de saldo.', '<button class="btn verde" id="g">💾 Guardar</button>') +
      `<div class="card"><div class="head"><h3>Medios habilitados</h3></div>${tablaSimple(d.medios, [{ t: 'Habilitado', f: m => `<input type="checkbox" data-m="${m.codigo}" data-k="habilitado" ${m.habilitado ? 'checked' : ''}>` }, { t: 'Medio', k: 'nombre' }, { t: 'Ajuste %', f: m => `<select data-m="${m.codigo}" data-k="ajuste_pct" style="width:auto">${Array.from({ length: 41 }, (_, i) => -100 + i * 5).map(v => `<option value="${v}" ${v === m.ajuste_pct ? 'selected' : ''}>${v > 0 ? '+' : ''}${v}%</option>`).join('')}</select>` }, { t: 'Aplica promo/ajuste de canal', f: m => `<input type="checkbox" data-m="${m.codigo}" data-k="aplica_promo" ${m.aplica_promo ? 'checked' : ''}>` }])}</div>
      <div class="grid g2"><div class="card"><div class="head"><h3>Cobro de cargas de saldo</h3></div><div class="body" id="mpf"></div></div>
      <div class="card"><div class="head"><h3>Tasas de procesamiento (referencia)</h3></div>${tablaSimple(Object.entries(d.mp.tasas || {}).map(([k, v]) => ({ k, v })), [{ t: 'Liberación', f: x => ({ inmediata: 'En el momento', d10: '10 días', d18: '18 días', d35: '35 días' }[x.k] || x.k) }, { t: 'Procesamiento', f: x => `<input type="number" step="0.01" data-tasa="${x.k}" value="${x.v}" style="width:90px"> %` }])}<div class="body" style="color:var(--suave);font-size:12.5px">Verificá las tasas vigentes en tu cuenta de Mercado Pago; se usan para calcular el neto de la central.</div></div></div>`;
    const f = formulario([{ t: 'html', html: '<p style="color:var(--suave);margin:0">Sin servidor propio no se guarda el token secreto de Mercado Pago. Las cargas se cobran con tu <b>link de pago</b> (Mercado Pago → Link de pago) o por <b>transferencia al alias</b>, y se acreditan desde <i>Cargas de saldo MP</i>.</p>' }, { k: 'link_pago', l: 'Link de pago (opcional)', w: 'full', ph: 'https://mpago.la/…' }, { k: 'alias_cobro', l: 'Alias / CVU para transferencias', w: 'full' }, { k: 'plazo', l: 'Plazo de liberación elegido', t: 'select', op: [['inmediata', 'En el momento'], ['d10', '10 días'], ['d18', '18 días'], ['d35', '35 días']] }, { k: 'absorbe', l: 'Quién absorbe la comisión', t: 'select', op: [['central', 'La central'], ['movil', 'El móvil (se descuenta al rendir)']] }], d.mp);
    $('#mpf').append(f);
    // Billeteras para "Pagar base": cuáles ofrece la app del conductor y a qué alias/CVU se transfiere
    let pv = null; try { pv = await api('/api/pagos/config'); } catch { /* falta correr sql/31_pagos_proveedores.sql */ }
    if (pv) main.insertAdjacentHTML('beforeend', `<div class="card"><div class="head"><h3>Billeteras para cargas de saldo</h3></div><div class="body" style="color:var(--suave);font-size:12.5px">Las que tienen ⚡ se acreditan solas cuando instalás la función <b>pagos</b> con las credenciales del proveedor (ver README); si no, funcionan como transferencia. Las demás se cobran por transferencia al alias o CVU que cargues acá y las confirmás en <i>Finanzas → Pagos de base</i>. El conductor elige entre las habilitadas.</div>${tablaSimple(pv.proveedores, [{ t: 'Habilitada', f: p => `<input type="checkbox" data-pv="${p.codigo}" data-k="habilitado" ${p.habilitado ? 'checked' : ''}>` }, { t: 'Billetera', f: p => esc(p.nombre) + (p.api ? ' ⚡' : '') }, { t: 'Alias / CVU de la central', f: p => `<input data-pv="${p.codigo}" data-k="alias" value="${esc(p.alias || '')}" placeholder="alias.o.cvu">` }, { t: 'Link de pago (opcional)', f: p => `<input data-pv="${p.codigo}" data-k="link" value="${esc(p.link || '')}" placeholder="https://…">` }])}</div>`);
    $('#g').onclick = async () => {
      const medios = d.medios.map(m => { const o = { codigo: m.codigo }; $$(`[data-m="${m.codigo}"]`).forEach(i => o[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value); return o; });
      const tasas = {}; $$('[data-tasa]').forEach(i => tasas[i.dataset.tasa] = +i.value);
      await api('/api/medios-pago', { body: { medios, mp: { ...leer(f), tasas } } });
      if (pv) {
        const proveedores = pv.proveedores.map(p => { const o = { codigo: p.codigo }; Array.from($$(`[data-pv="${p.codigo}"]`)).forEach(i => o[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value); return o; });
        await api('/api/pagos/config', { body: { proveedores } });
      }
      toast('Guardado', 'ok'); R.cat = await api('/api/catalogos');
    };
  }
});

// ---------- Módulos de la plataforma ----------
ruta('modulos', {
  titulo: 'Módulos', roles: ['admin'], async render(main) {
    const d = await api('/api/modulos');
    const prox = new Date(); prox.setMonth(prox.getMonth() + 1);
    main.innerHTML = cabecera('Módulos de la plataforma', `Marcá lo que querés activo el próximo mes (${MESES[prox.getMonth()]} ${prox.getFullYear()}). La flota es obligatoria.`, '<button class="btn verde" id="g">Guardar cambios</button>') +
      `<div class="grid g2">${d.modulos.map(m => `<div class="card" data-m="${m.codigo}"><div class="body"><div class="fila" style="justify-content:space-between"><b>${esc(m.nombre)}</b><label class="check"><input type="checkbox" name="activo_prox" ${m.activo_prox ? 'checked' : ''} ${m.obligatorio ? 'disabled checked' : ''}> ${m.obligatorio ? 'Obligatorio' : 'Habilitar'}</label></div><p style="color:var(--suave)">${esc(m.descripcion)}</p><div class="fila" style="justify-content:space-between"><span>${pesos(m.precio)} / ${esc(m.unidad)}${m.unidad === 'móvil' ? ` · ~${d.moviles_estimados} móviles = <b>${pesos(m.precio * d.moviles_estimados)}</b>` : ''}</span>${m.unidad === 'puesto' ? `<span>Cantidad: <input type="number" name="cantidad" value="${m.cantidad}" min="1" style="width:70px"></span>` : ''}</div></div></div>`).join('')}</div>
      <div class="card"><div class="body" id="tot"></div></div>`;
    const total = () => { let s = 0; $$('[data-m]').forEach(el => { const m = d.modulos.find(x => x.codigo === el.dataset.m); const on = $('[name=activo_prox]', el).checked; if (!on) return; const q = m.unidad === 'móvil' ? d.moviles_estimados : m.unidad === 'puesto' ? +$('[name=cantidad]', el).value : 1; s += q * m.precio; }); $('#tot').innerHTML = `<b>Qué vas a pagar el próximo mes:</b> ${pesos(s)} aprox.`; };
    $$('input', main).forEach(i => i.onchange = total); total();
    $('#g').onclick = async () => { await api('/api/modulos', { body: $$('[data-m]').map(el => ({ codigo: el.dataset.m, ...leer(el) })) }); toast('Guardado', 'ok'); };
  }
});
