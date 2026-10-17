// Cuentas de móviles, Mercado Pago y planes

ruta('cuentas', {
  titulo: 'Cuentas de móviles', roles: ['gestion'], render(main) {
    main.innerHTML = cabecera('Cuentas de móviles', '<span class="dot c-verde"></span>Al día · <span class="dot c-amarillo"></span>Debajo del mínimo del plan · <span class="dot c-rojo"></span>Bloqueado por deuda · <span class="dot c-gris"></span>Inhabilitado o fuera de servicio · <span class="dot c-azul"></span>Habilitado sin plan') +
      `<div class="card"><div class="body fila"><div class="campo"><label>Mostrar móviles</label><select id="f"><option value="todos">Todos</option><option value="activos">Solo activos</option><option value="inactivos">Solo inactivos</option><option value="con_plan">Activos con plan</option><option value="sin_plan">Activos sin plan</option></select></div><div class="campo"><label>N° móvil</label><input type="number" id="n" style="width:110px"></div><button class="btn sec" id="ac">⟳ Actualizar</button></div><div class="body" id="res" style="padding-top:0"></div><div id="tb"></div></div>`;
    const t = tabla($('#tb'), {
      porPagina: 50,
      cols: [{ t: 'Móvil', f: c => `<span class="dot c-${c.color}"></span><b>${c.numero}</b>` }, { t: 'Saldo', c: 'r', f: c => `<b style="color:${c.saldo < 0 ? 'var(--rojo)' : 'var(--verde)'}">${pesos(c.saldo)}</b>` }, { t: 'Titular deudor', f: c => c.titular ? `${esc(c.titular.toUpperCase())} <small>(${esc(c.titular_doc)})</small>` : '—' }, { t: 'Plan', f: c => esc(c.plan) + (c.prorroga ? `<br><small>Prórroga hasta ${fechaLarga(c.prorroga)}</small>` : '') }, { t: 'Estado', k: 'estado' }, { t: '', f: c => `<button class="btn chico" data-g="${c.id}" data-n="${c.numero}">Gestionar</button>` }],
      cargar: async () => { const r = await api('/api/cuentas?' + qs({ filtro: $('#f').value, numero: $('#n').value })); const s = r.resumen; $('#res').innerHTML = `<div class="grid g6">${[['Móviles', s.moviles], ['Falta para estar al día', pesos(s.falta)], ['Al día', s.al_dia], ['Con deuda', s.deuda], ['Bloqueados', s.bloqueados], ['Sin plan', s.sin_plan]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}</div><p style="color:var(--suave)">${s.pct}% al día</p>`; return r.filas; },
      pie: () => $$('[data-g]', main).forEach(b => b.onclick = () => gestionarCuenta(+b.dataset.g, b.dataset.n, () => t.refrescar())),
    });
    $('#f').onchange = $('#n').onchange = $('#ac').onclick = () => t.refrescar(true);
  }
});
async function gestionarCuenta(id, numero, listo) {
  const c = await api('/api/cuentas/' + id);
  const planes = R.cat.planes;
  const cuerpo = h(`<div><div class="grid g4" style="margin-bottom:12px"><div class="kpi"><div class="l">Saldo</div><div class="v" style="color:${c.saldo < 0 ? 'var(--rojo)' : 'var(--verde)'}">${pesos(c.saldo)}</div></div><div class="kpi"><div class="l">Estado</div><div class="v" style="font-size:15px"><span class="dot c-${c.color}"></span>${esc(c.texto)}</div></div><div class="kpi"><div class="l">Plan</div><div class="v" style="font-size:15px">${esc(c.plan ? c.plan.descripcion : 'Sin plan')}</div></div><div class="kpi"><div class="l">Viajes disponibles</div><div class="v">${c.viajes_disponibles ?? '—'}</div></div></div>
    <div class="fila" style="margin-bottom:12px"><button class="btn verde" data-op="pago">💵 Pago</button><button class="btn rojo" data-op="retiro">Retiro</button><button class="btn azul" data-op="bonificacion">🎁 Bonificación</button><button class="btn sec" data-op="ajuste">Ajuste</button><button class="btn naranja" data-op="prorroga">⏳ Prórroga</button><button class="btn violeta" data-op="plan">Cambiar plan</button></div>
    ${c.saldo < 0 ? `<div class="nota">Para estar al día debe abonar <b>${pesos(-c.saldo)}</b>. Si tiene saldo a favor, solo cobrás la diferencia de la cuota.</div>` : ''}
    <h4>Movimientos</h4>${tablaSimple(c.movimientos, [{ t: 'Fecha', f: x => fechaLarga(x.fecha) }, { t: 'Tipo', k: 'tipo' }, { t: 'Detalle', k: 'detalle' }, { t: 'Usuario', k: 'usuario' }, { t: 'Monto', c: 'r', f: x => `<b style="color:${x.monto < 0 ? 'var(--rojo)' : 'var(--verde)'}">${pesos(x.monto)}</b>` }])}</div>`);
  const m = modal({ titulo: 'Cuenta del móvil ' + numero, ancho: true, cuerpo, botones: [{ texto: 'Cerrar' }], alCerrar: listo });
  $$('[data-op]', cuerpo).forEach(b => b.onclick = async () => {
    const op = b.dataset.op;
    let campos = [{ k: 'monto', l: 'Monto ($)', t: 'number', min: 0 }, { k: 'detalle', l: 'Detalle', ph: op === 'pago' ? 'Efectivo / transferencia…' : '' }];
    if (op === 'ajuste') campos = [{ k: 'monto', l: 'Monto (+ o −)', t: 'number' }, { k: 'detalle', l: 'Motivo' }];
    if (op === 'prorroga') campos = [{ k: 'hasta', l: 'Puede trabajar con deuda hasta', t: 'datetime-local', def: diasAtras(-3) + 'T23:59' }];
    if (op === 'plan') campos = [{ k: 'plan_id', l: 'Plan', t: 'select', op: planes.map(p => [p.id, p.descripcion]), def: c.movil.plan_id }, { t: 'html', html: '<small>Los cambios de cuota aplican desde el próximo período.</small>' }];
    const r = await pedir(b.textContent.trim(), campos);
    if (!r) return;
    if (r.hasta) r.hasta = r.hasta.replace('T', ' ') + ':00';
    try { await api(`/api/cuentas/${id}/${op}`, { body: r }); toast('Registrado', 'ok'); m.cerrar(); gestionarCuenta(id, numero, listo); } catch (e) { fallo(e); }
  });
}

ruta('mp-recargas', {
  titulo: 'Pagos de base MP', roles: ['gestion'], render(main) {
    main.innerHTML = cabecera('Pagos de base Mercado Pago', 'Pagos de base pedidos por titulares y conductores. Cuando verifiques el cobro en tu cuenta de Mercado Pago o banco, confirmalo acá y se acredita en Cuentas.') +
      `<div class="card"><div class="body fila"><div class="campo"><label>Desde</label><input type="date" id="d" value="${diasAtras(30)}"></div><div class="campo"><label>Hasta</label><input type="date" id="h" value="${hoyISO()}"></div><div class="campo"><label>Móvil</label><select id="m"><option value="">Todos</option>${R.cat.moviles.map(m => `<option>${m.numero}</option>`).join('')}</select></div><div class="campo"><label>Estado</label><select id="e"><option value="">Todos</option><option value="pagados">Pagados</option><option value="pendientes">Pendientes</option><option value="cancelados">Cancelados</option><option value="reembolsados">Reembolsados</option></select></div><button class="btn" id="b">Buscar</button></div><div class="body" id="tot" style="padding-top:0"></div><div id="tb"></div></div>`;
    const t = tabla($('#tb'), {
      vacio: 'Sin cargas de saldo.',
      cols: [{ t: 'Fecha', f: p => fechaLarga(p.fecha) }, { t: 'Móvil', k: 'numero' }, { t: 'Monto', c: 'r', f: p => pesos(p.monto) }, { t: 'Estado pago', f: p => `<span class="pill">${p.estado}</span>` }, { t: 'Acreditación', f: p => p.acreditado ? '✅ En cuentas' : '—' }, { t: 'Medio', f: p => esc(p.medio || '—') }, { t: 'Liberación', f: p => fechaLarga(p.liberacion) }, { t: 'ID pago MP', f: p => esc(p.mp_id || '—') }],
      cargar: async () => { const r = await api('/api/mp/recargas?' + qs({ desde: $('#d').value, hasta: $('#h').value, movil: $('#m').value, estado: $('#e').value })); $('#tot').innerHTML = `<div class="grid g4">${[['Pagado', r.totales.pagado], ['Acreditado', r.totales.acreditado], ['Pendiente', r.totales.pendiente], ['Liberado', r.totales.liberado]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${pesos(v)}</div></div>`).join('')}</div>`; return r.filas; },
      acciones: p => [p.estado === 'pendiente' && { t: 'Confirmar pago y acreditar', ico: '✅', a: async () => { if (await confirmar(`¿Confirmás que recibiste ${pesos(p.monto)} del móvil ${p.numero}?`)) { await api(`/api/mp/pagos/${p.id}/consultar`, { body: { simular: true } }); toast('Acreditado en Cuentas', 'ok'); t.refrescar(); } } }, p.estado === 'pagado' && !p.acreditado && { t: 'Acreditar en Cuentas', ico: '➡', a: async () => { await api(`/api/mp/pagos/${p.id}/consultar`, { body: {} }); t.refrescar(); } }],
    });
    $('#b').onclick = () => t.refrescar(true);
  }
});

ruta('saldos-mercadopago', {
  titulo: 'Saldos Mercado Pago', roles: ['gestion'], render(main) {
    main.innerHTML = cabecera('Saldos Mercado Pago', 'Dinero de conductores por cobros de viajes con Mercado Pago (rendidos). Podés aplicarlo a la cuota del móvil o registrar el pago al móvil.', '<button class="btn sec" id="ac">⟳ Actualizar</button>') +
      '<div class="grid g2"><div class="card" id="tb"></div><div class="card"><div class="head"><h3 id="tit">Movimientos — móvil —</h3></div><div id="mv"><p style="padding:14px;color:var(--suave)">Elegí un móvil.</p></div></div></div>';
    const ver = async (s) => { $('#tit').textContent = 'Movimientos — móvil ' + s.numero; const r = await api('/api/mp/saldos/' + s.id); $('#mv').innerHTML = tablaSimple(r, [{ t: 'Fecha', f: x => fechaLarga(x.fecha) }, { t: 'Tipo', k: 'tipo' }, { t: 'Monto', c: 'r', f: x => pesos(x.monto) }, { t: 'Detalle', k: 'detalle' }]); };
    const t = tabla($('#tb'), {
      vacio: 'Sin saldos MP', cols: [{ t: 'Móvil', f: s => `<b>${s.numero}</b>` }, { t: 'Saldo', c: 'r', f: s => pesos(s.saldo) }], cargar: () => api('/api/mp/saldos'),
      acciones: s => [{ t: 'Ver movimientos', a: () => ver(s) }, { t: 'Aplicar a cuota', ico: '➡', a: async () => { const r = await pedir('Aplicar a cuota', [{ k: 'monto', l: 'Monto (vacío = todo)', t: 'number', def: s.saldo }]); if (r) try { await api(`/api/mp/saldos/${s.id}/aplicar`, { body: r }); t.refrescar(); ver(s); } catch (e) { fallo(e); } } }, { t: 'Registrar pago al móvil', ico: '💵', a: async () => { const r = await pedir('Pago al móvil ' + s.numero, [{ k: 'monto', l: 'Monto', t: 'number', def: s.saldo }, { k: 'detalle', l: 'Detalle', def: 'Transferencia al conductor' }]); if (r) { await api(`/api/mp/saldos/${s.id}/retiro`, { body: r }); t.refrescar(); ver(s); } } }],
    });
    $('#ac').onclick = () => t.refrescar();
  }
});

ruta('mp-viajes', {
  titulo: 'Viajes Mercado Pago', roles: ['gestion'], render(main) {
    main.innerHTML = cabecera('Viajes cobrados por Mercado Pago', 'Recaudación en la cuenta de la central: cobrado, neto recibido, a rendir al móvil y liberación de fondos.') +
      `<div class="card"><div class="body fila"><div class="campo"><label>Desde</label><input type="date" id="d" value="${diasAtras(30)}"></div><div class="campo"><label>Hasta</label><input type="date" id="h" value="${hoyISO()}"></div><div class="campo"><label>Móvil</label><select id="m"><option value="">Todos</option>${R.cat.moviles.map(m => `<option>${m.numero}</option>`).join('')}</select></div><div class="campo"><label>Estado</label><select id="e"><option value="">Todos</option><option value="cobrados">Cobrados</option><option value="pendientes">Pendientes</option><option value="cancelados">Cancelados</option><option value="reembolsados">Reembolsados</option></select></div><button class="btn" id="b">Buscar</button><button class="btn sec" id="rt">Rendir disponibles</button></div><div class="body" id="tot" style="padding-top:0"></div><div id="tb"></div></div>`;
    let ult = [];
    const t = tabla($('#tb'), {
      vacio: 'Sin cobros en el rango seleccionado.',
      cols: [{ t: 'Fecha', f: p => fechaLarga(p.fecha) }, { t: 'Viaje', f: p => '#' + p.viaje_id }, { t: 'Móvil', k: 'numero' }, { t: 'Estado', f: p => `<span class="pill">${p.estado}</span>${p.rendido ? ' ✅' : ''}` }, { t: 'Pagó cliente', c: 'r', f: p => pesos(p.monto) }, { t: 'Central (neto)', c: 'r', f: p => pesos(p.central) }, { t: 'Móvil', c: 'r', f: p => pesos(p.a_rendir) }, { t: 'Medio', f: p => esc(p.medio || '—') }, { t: 'Liberación', f: p => fechaLarga(p.liberacion) }],
      cargar: async () => { const r = await api('/api/mp/viajes?' + qs({ desde: $('#d').value, hasta: $('#h').value, movil: $('#m').value, estado: $('#e').value })); ult = r.filas; const x = r.totales; $('#tot').innerHTML = `<div class="grid g6">${[['Total cobrado', x.cobrado], ['Central (neto)', x.central], ['A rendir móviles', x.a_rendir], ['Disponible para rendir', x.disponible], ['Pendiente liberación', x.pendiente_liberacion], ['Reembolsado', x.reembolsado]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${pesos(v)}</div></div>`).join('')}</div><p style="color:var(--suave)">Filas: ${r.filas.length} · Pend. ${x.pend} · Canc. ${x.canc}</p>`; return r.filas; },
      acciones: p => [p.estado === 'pagado' && !p.rendido && { t: 'Rendir al móvil', ico: '➡', a: async () => { await api(`/api/mp/viajes/${p.id}/rendir`, { body: {} }); t.refrescar(); } }, p.estado === 'pendiente' && { t: 'Marcar cobrado', ico: '✅', a: async () => { await api(`/api/mp/viajes/${p.id}/marcar_pagado`, { body: {} }); t.refrescar(); } }, p.estado === 'pagado' && { t: 'Registrar reembolso', ico: '↩', a: async () => { if (await confirmar('¿Marcar como reembolsado?')) { await api(`/api/mp/viajes/${p.id}/reembolsar`, { body: {} }); t.refrescar(); } } }, { t: 'Ver viaje', a: () => infoViaje(p.viaje_id) }],
    });
    $('#b').onclick = () => t.refrescar(true);
    $('#rt').onclick = async () => { const h = hoyISO(); const disp = ult.filter(p => p.estado === 'pagado' && !p.rendido && p.liberacion <= h); if (!disp.length) return toast('No hay cobros liberados para rendir'); if (!await confirmar(`Rendir ${disp.length} cobro(s) a sus móviles?`)) return; for (const p of disp) await api(`/api/mp/viajes/${p.id}/rendir`, { body: {} }); t.refrescar(); };
  }
});

ruta('planes', {
  titulo: 'Planes', roles: ['gestion'], render(main) {
    main.innerHTML = cabecera('Tipos de abonos', 'Planes de cobro. Los cambios aplican en el próximo período. Al eliminar un plan, sus móviles pasan a «Sin abono».', '<button class="btn" id="n">+ Nuevo</button><button class="btn sec" id="ac">⟳ Actualizar</button>') + '<div class="card" id="tb"></div>';
    const MC = { fijo: 'Monto fijo', fijo_viaje: 'Fijo + por viaje', por_viaje: 'Solo por viaje', porcentaje: '% por viaje' };
    const t = tabla($('#tb'), {
      cols: [{ t: 'Descripción', f: p => `<b>${esc(p.descripcion)}</b>${p.tipo1 ? ' <span class="pill">tipo 1</span>' : ''}${p.sistema ? ' <small>(sistema)</small>' : ''}` }, { t: 'Móviles', k: 'moviles' }, { t: 'Modo cobro', f: p => MC[p.modo_cobro] }, { t: 'Pago', f: p => p.modo_pago === 'prepago' ? 'Prepago' : 'Pospago' }, { t: 'Periodicidad', f: p => p.periodicidad === 'diaria' ? `diaria (${p.hora_cobro} h)` : p.periodicidad + (p.periodicidad === 'semanal' ? ` (${DIAS.find(d => d[0] === p.dia_semana)[1]})` : ` (día ${p.dia_mes})`) }, { t: 'Monto fijo', c: 'r', f: p => pesos(p.monto_fijo) }, { t: 'Por viaje', c: 'r', f: p => p.modo_cobro === 'porcentaje' ? p.pct_viaje + '%' : p.monto_viaje ? pesos(p.monto_viaje) : '—' }],
      cargar: () => api('/api/planes'),
      acciones: p => p.sistema ? [{ t: 'Cambiar nombre', ico: '✎', a: async () => { const r = await pedir('Plan del sistema', [{ k: 'descripcion', l: 'Nombre del plan', w: 'full' }, { t: 'html', html: '<div class="nota" style="font-size:12.5px">Es el plan por defecto de los móviles sin abono: no cobra cuotas ni bloquea. Solo se puede cambiar el nombre; no se puede eliminar.</div>' }], { descripcion: p.descripcion }); if (r && r.descripcion && r.descripcion.trim()) { try { await api('/api/planes', { body: { ...p, descripcion: r.descripcion.trim() } }); toast('Nombre actualizado', 'ok'); R.cat = await api('/api/catalogos'); t.refrescar(); } catch (e) { fallo(e); } } } }, { t: 'Ir a Cuentas de móviles', ico: '🚗', a: () => ir('cuentas') }] : [{ t: 'Modificar', ico: '✎', a: () => editarPlan(p, () => t.refrescar()) }, { t: 'Eliminar', ico: '🗑', a: async () => { if (await confirmar(`¿Eliminar "${p.descripcion}"? Sus ${p.moviles} móviles pasan a Sin abono.`)) { await api('/api/planes/' + p.id, { method: 'DELETE' }); t.refrescar(); } } }],
    });
    $('#n').onclick = () => editarPlan({ modo_pago: 'prepago', modo_cobro: 'fijo', periodicidad: 'mensual', dia_mes: 1, hora_cobro: 0, horas_bloqueo: 48 }, () => t.refrescar());
    $('#ac').onclick = () => t.refrescar();
  }
});
function editarPlan(p, listo) {
  const f = formulario([
    { t: 'titulo', l: '🏷 Identificación' }, { k: 'descripcion', l: 'Descripción' }, { k: 'modo_pago', l: 'Modo pago', t: 'select', op: [['prepago', 'Prepago'], ['pospago', 'Pospago']] },
    { t: 'titulo', l: '💲 Cobro' }, { k: 'modo_cobro', l: 'Modo cobro', t: 'select', w: 'full', op: [['fijo', 'Monto fijo (solo cuota, sin viaje)'], ['fijo_viaje', 'Fijo + por viaje ($)'], ['por_viaje', 'Solo por viaje ($)'], ['porcentaje', 'Porcentaje por viaje (%)']] },
    { k: 'tipo1', t: 'check', cl: 'Tipo 1 — el monto fijo incluye saldo para viajes', w: 'full' }, { k: 'vencer_saldo', t: 'check', cl: 'Vencer saldo prepago al cierre del período (solo tipo 1)', w: 'full' },
    { t: 'html', html: '<div class="nota" style="font-size:12.5px"><b>Tipo 1:</b> pagan la cuota (ej. $27.000 ≈ 20 viajes) y al quedar al día se acredita ese monto como saldo para viajes. <b>Tipo 2</b> (desmarcado): la cuota es solo el abono; para viajar cargan saldo aparte.</div>' },
    { k: 'monto_fijo', l: 'Monto fijo ($)', t: 'number' }, { k: 'monto_viaje', l: 'Monto por viaje ($)', t: 'number' }, { k: 'pct_viaje', l: '% por viaje', t: 'number' }, { k: 'minimo', l: 'Saldo mínimo (amarillo debajo)', t: 'number' },
    { t: 'titulo', l: '📅 Período y bloqueo' }, { k: 'periodicidad', l: 'Periodicidad', t: 'select', op: [['diaria', 'Diaria (el móvil paga por día para trabajar)'], ['semanal', 'Semanal'], ['quincenal', 'Quincenal'], ['mensual', 'Mensual']] }, { k: 'dia_semana', l: 'Día de semana (semanal)', t: 'select', op: DIAS },
    { k: 'dia_mes', l: 'Día del mes (1–28)', t: 'number', min: 1, max: 28 }, { k: 'hora_cobro', l: 'Hora de cobro (0–23)', t: 'number', min: 0, max: 23 }, { k: 'horas_bloqueo', l: 'Horas de tolerancia antes de bloquear', t: 'number' },
    { t: 'html', html: '<div class="nota" style="font-size:12.5px"><b>Plan diario:</b> cada día, a la hora de cobro, se descuenta el monto fijo de la cuenta del móvil. Con <b>0 h</b> se bloquea apenas queda debiendo; con <b>24 h</b> tiene un día de gracia; con <b>48 h</b>, dos. Bloqueado no recibe viajes hasta que cargue saldo. El saldo mínimo marca en amarillo a quien está por debajo (sigue trabajando).</div>' },
  ], p);
  modal({ titulo: p.id ? 'Modificar plan' : 'Nuevo plan', ancho: true, cuerpo: f, botones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: '✓ Guardar', clase: 'verde', accion: async () => { await api('/api/planes', { body: { ...leer(f), id: p.id } }); toast('Plan guardado', 'ok'); R.cat = await api('/api/catalogos'); listo && listo(); } }] });
}
