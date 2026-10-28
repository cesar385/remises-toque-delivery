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
// Gestión de la cuenta de un móvil: resumen, operaciones con vista previa del saldo y movimientos con filtros
const CTA_TIPOS = { pago: ['💵', 'Pago', 'verde'], carga_mp: ['💳', 'Carga Mercado Pago', 'verde'], saldo_viajes: ['🎟', 'Saldo de viajes', 'verde'], bonificacion: ['🎁', 'Bonificación', 'verde'],
  cuota: ['📅', 'Cuota', 'rojo'], viaje: ['🚕', 'Cargo por viaje', 'rojo'], retiro: ['↩️', 'Retiro', 'rojo'], vencimiento: ['⌛', 'Vencimiento', 'rojo'], ajuste: ['✏️', 'Ajuste', ''] };
const CTA_FILTROS = [['', 'Todos'], ['pagos', 'Pagos y cargas'], ['cuota', 'Cuotas'], ['viaje', 'Viajes'], ['otros', 'Ajustes y otros']];
async function gestionarCuenta(id, numero, listo) {
  let c, limite = 200, filtro = '', busca = '', panel = null;
  const planes = R.cat.planes || [];
  const cuerpo = h('<div class="cta"></div>');
  const m = modal({ titulo: '💼 Cuenta del móvil ' + numero, ancho: true, cuerpo, botones: [{ texto: '🖨 Estado de cuenta', clase: 'sec', accion: () => { imprimirCuenta(); return false; } }, { texto: '⬇ CSV', clase: 'sec', accion: () => { csvCuenta(); return false; } }, { texto: 'Cerrar' }], alCerrar: listo });
  const fechaHora = t => fechaLarga(t);
  const plan = () => c.plan || {};
  const cuota = () => !plan().sistema && +plan().monto_fijo > 0 ? +plan().monto_fijo : 0;
  async function cargar() { c = await api(`/api/cuentas/${id}?limite=${limite}`); pintar(); }
  function movsFiltrados() {
    const q = busca.toLowerCase();
    return (c.movimientos || []).filter(x => (!filtro || (filtro === 'pagos' ? ['pago', 'carga_mp', 'saldo_viajes', 'bonificacion'].includes(x.tipo) : filtro === 'otros' ? !['pago', 'carga_mp', 'saldo_viajes', 'bonificacion', 'cuota', 'viaje'].includes(x.tipo) : x.tipo === filtro))
      && (!q || `${x.detalle || ''} ${x.usuario || ''} ${x.tipo}`.toLowerCase().includes(q)));
  }
  function conSaldo() { // saldo después de cada movimiento (la lista viene de la más nueva a la más vieja)
    let s = +c.saldo; return (c.movimientos || []).map(x => { const o = { ...x, saldo_desp: s }; s -= +x.monto; return o; });
  }
  function pintar() {
    const debe = c.saldo < 0 ? -c.saldo : 0, pr = c.prorroga || (c.movil && c.movil.prorroga_hasta);
    const ms = conSaldo(), vis = new Set(movsFiltrados().map(x => x.id)), lista = ms.filter(x => vis.has(x.id));
    const ent = lista.filter(x => x.monto > 0).reduce((a, x) => a + +x.monto, 0), sal = lista.filter(x => x.monto < 0).reduce((a, x) => a + +x.monto, 0);
    cuerpo.innerHTML = `
      <div class="cta-top c-${c.color}">
        <div class="cta-saldo"><small>Saldo de la cuenta</small><b class="${c.saldo < 0 ? 'neg' : 'pos'}">${pesos(c.saldo)}</b><span class="cta-est"><span class="dot c-${c.color}"></span>${esc(c.texto)}</span></div>
        <div class="cta-datos">
          <div><small>Plan</small><b>${esc(plan().descripcion || 'Sin plan')}</b>${cuota() ? `<span>${pesos(cuota())} · ${esc(plan().periodicidad || '')}</span>` : ''}</div>
          <div><small>Viajes disponibles</small><b>${c.viajes_disponibles ?? '—'}</b>${+plan().monto_viaje > 0 ? `<span>${pesos(plan().monto_viaje)} por viaje</span>` : ''}</div>
          <div><small>Prórroga</small><b>${pr ? '⏳ hasta ' + esc(String(pr).replace('T', ' ').slice(0, 16)) : '—'}</b></div>
        </div>
      </div>
      ${debe ? `<div class="cta-aviso">Para estar al día debe abonar <b>${pesos(debe)}</b>${c.bloqueado ? ' · <b>bloqueado por deuda</b>, no recibe viajes' : ''}. <button class="btn verde chico" data-rap="${debe}">Registrar pago de ${pesos(debe)}</button></div>` : ''}
      <div class="cta-ops">
        ${[['pago', '💵', 'Registrar pago', 'Efectivo o transferencia', 'verde'], ['bonificacion', '🎁', 'Bonificación', 'Saldo a favor sin cobro', 'azul'], ['retiro', '↩️', 'Retiro', 'Devolver saldo al móvil', 'rojo'],
          ['ajuste', '✏️', 'Ajuste', 'Corregir un error (+ o −)', 'gris'], ['prorroga', '⏳', 'Prórroga', 'Trabajar con deuda hasta…', 'naranja'], ['plan', '📋', 'Cambiar plan', 'Desde el próximo período', 'violeta']]
          .map(([k, ic, t, d, col]) => `<button class="cta-op ${col}${panel === k ? ' on' : ''}" data-op="${k}"><span>${ic}</span><b>${t}</b><small>${d}</small></button>`).join('')}
      </div>
      <div id="ctaForm"></div>
      <div class="cta-mov">
        <div class="cta-mh"><h4>Movimientos</h4><div class="cta-fil">${CTA_FILTROS.map(([k, t]) => `<button data-f="${k}" class="${filtro === k ? 'on' : ''}">${t}</button>`).join('')}</div><input id="ctaQ" placeholder="Buscar en detalle…" value="${esc(busca)}"></div>
        <div class="cta-res"><span>Entradas <b class="pos">${pesos(ent)}</b></span><span>Salidas <b class="neg">${pesos(-sal)}</b></span><span>${lista.length} movimiento${lista.length === 1 ? '' : 's'}</span></div>
        <div class="tabla-wrap cta-tab"><table class="t"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Usuario</th><th class="r">Monto</th><th class="r">Saldo</th></tr></thead><tbody>
          ${lista.map(x => { const [ic, tt, col] = CTA_TIPOS[x.tipo] || ['•', x.tipo, '']; return `<tr><td style="white-space:nowrap">${fechaHora(x.fecha)}</td><td><span class="cta-tipo ${col}">${ic} ${esc(tt)}</span></td><td>${esc(x.detalle || '')}</td><td>${esc(x.usuario || 'Sistema')}</td><td class="r"><b class="${x.monto < 0 ? 'neg' : 'pos'}">${x.monto > 0 ? '+' : ''}${pesos(x.monto)}</b></td><td class="r" style="color:var(--suave)">${pesos(x.saldo_desp)}</td></tr>`; }).join('')
          || '<tr><td colspan="6" style="text-align:center;color:var(--suave);padding:18px">Sin movimientos para este filtro.</td></tr>'}
        </tbody></table></div>
        ${(c.movimientos || []).length >= limite ? '<div style="text-align:center;margin-top:8px"><button class="btn sec chico" id="ctaMas">Ver movimientos más viejos</button></div>' : ''}
      </div>`;
    $$('[data-op]', cuerpo).forEach(b => b.onclick = () => { panel = panel === b.dataset.op ? null : b.dataset.op; pintar(); });
    $$('[data-f]', cuerpo).forEach(b => b.onclick = () => { filtro = b.dataset.f; pintar(); });
    const q = $('#ctaQ', cuerpo); q.oninput = () => { busca = q.value; const pos = q.selectionStart; pintar(); const n = $('#ctaQ', cuerpo); n.focus(); n.setSelectionRange(pos, pos); };
    const rap = $('[data-rap]', cuerpo); if (rap) rap.onclick = () => { panel = 'pago'; pintar(); $('#ctaForm [name=monto]').value = rap.dataset.rap; prever(); };
    const mas = $('#ctaMas', cuerpo); if (mas) mas.onclick = async () => { limite += 300; await cargar(); };
    formulario_();
  }
  function prever() {
    const f = $('#ctaForm form'); if (!f) return; const op = panel, v = parseFloat(f.monto && f.monto.value) || 0, out = $('.cta-prev', f); if (!out) return;
    const delta = op === 'pago' || op === 'bonificacion' ? Math.abs(v) : op === 'retiro' ? -Math.abs(v) : op === 'ajuste' ? v : 0;
    const n = +c.saldo + delta; out.innerHTML = v ? `Saldo después: <b class="${n < 0 ? 'neg' : 'pos'}">${pesos(n)}</b>${n >= 0 && c.saldo < 0 ? ' · <span class="pos">queda al día ✔</span>' : ''}` : '';
  }
  function formulario_() {
    const box = $('#ctaForm', cuerpo); if (!panel) { box.innerHTML = ''; return; }
    const debe = c.saldo < 0 ? -c.saldo : 0, rapidos = [...new Set([debe, cuota()].filter(x => x > 0))];
    const tit = { pago: '💵 Registrar pago', bonificacion: '🎁 Bonificación', retiro: '↩️ Retiro de saldo', ajuste: '✏️ Ajuste de cuenta', prorroga: '⏳ Prórroga', plan: '📋 Cambiar plan' }[panel];
    let campos = '';
    if (['pago', 'bonificacion', 'retiro', 'ajuste'].includes(panel)) campos = `
      <div class="campo"><label>${panel === 'ajuste' ? 'Monto (usá − para descontar)' : 'Monto ($)'}</label><input name="monto" type="number" step="1" ${panel === 'ajuste' ? '' : 'min="1"'} required autofocus></div>
      <div class="campo"><label>${panel === 'ajuste' ? 'Motivo' : 'Detalle'}</label><input name="detalle" ${panel === 'ajuste' ? 'required' : ''} placeholder="${{ pago: 'Efectivo, transferencia…', bonificacion: 'Motivo de la bonificación', retiro: 'Motivo del retiro', ajuste: 'Qué se corrige' }[panel]}"></div>
      ${panel === 'pago' ? `<div class="cta-chips">${['Efectivo', 'Transferencia', 'Mercado Pago'].map(t => `<button type="button" data-det="${t}">${t}</button>`).join('')}${rapidos.map(x => `<button type="button" data-mon="${x}">${x === debe ? 'Deuda' : 'Cuota'} ${pesos(x)}</button>`).join('')}</div>` : ''}
      <div class="cta-prev"></div>`;
    if (panel === 'prorroga') { const d = n => { const x = new Date(Date.now() + n * 864e5); return x.toISOString().slice(0, 10) + 'T23:59'; };
      campos = `<div class="campo"><label>Puede trabajar con deuda hasta</label><input name="hasta" type="datetime-local" value="${d(1)}" required></div>
      <div class="cta-chips">${[[0, 'Hoy 23:59'], [1, 'Mañana'], [3, '3 días'], [7, '1 semana']].map(([n, t]) => `<button type="button" data-pr="${d(n)}">${t}</button>`).join('')}</div>
      <p class="cta-nota">Durante la prórroga el móvil no se bloquea por deuda. Sigue sumando cuotas y cargos.</p>`; }
    if (panel === 'plan') campos = `<div class="campo"><label>Plan</label><select name="plan_id">${planes.map(p => `<option value="${p.id}" ${p.id === (c.movil && c.movil.plan_id) ? 'selected' : ''}>${esc(p.descripcion)}${+p.monto_fijo > 0 ? ' · ' + pesos(p.monto_fijo) : ''}</option>`).join('')}</select></div><p class="cta-nota">El cambio de cuota aplica desde el próximo período.</p>`;
    box.innerHTML = `<form class="cta-form"><div class="cta-fh"><b>${tit}</b><button type="button" class="btn-icono" data-x title="Cerrar">×</button></div><div class="cta-fb">${campos}</div>
      <div class="cta-ff"><button type="button" class="btn sec" data-x>Cancelar</button><button class="btn ${panel === 'retiro' ? 'rojo' : 'verde'}">Confirmar</button></div></form>`;
    const f = $('form', box);
    $$('[data-x]', f).forEach(b => b.onclick = () => { panel = null; pintar(); });
    $$('[data-det]', f).forEach(b => b.onclick = () => { f.detalle.value = b.dataset.det; });
    $$('[data-mon]', f).forEach(b => b.onclick = () => { f.monto.value = b.dataset.mon; prever(); });
    $$('[data-pr]', f).forEach(b => b.onclick = () => { f.hasta.value = b.dataset.pr; });
    if (f.monto) f.monto.oninput = prever;
    setTimeout(() => { const i = $('input,select', f); i && i.focus(); }, 30);
    f.onsubmit = async ev => {
      ev.preventDefault(); const r = Object.fromEntries(new FormData(f)); const bt = $('.cta-ff .btn:not(.sec)', f);
      if (r.monto !== undefined) { r.monto = +r.monto; if (!r.monto) return toast('Ingresá un monto', 'error'); }
      if (r.hasta) r.hasta = r.hasta.replace('T', ' ') + ':00';
      if (panel === 'retiro' || (panel === 'ajuste' && r.monto < 0)) { if (!(await confirmar(`¿Confirmás ${panel === 'retiro' ? 'el retiro' : 'el ajuste'} de ${pesos(Math.abs(r.monto))} en la cuenta del móvil ${numero}?`))) return; }
      bt.disabled = true;
      try { await api(`/api/cuentas/${id}/${panel}`, { body: r }); toast({ pago: 'Pago registrado', bonificacion: 'Bonificación registrada', retiro: 'Retiro registrado', ajuste: 'Ajuste registrado', prorroga: 'Prórroga guardada', plan: 'Plan cambiado' }[panel], 'ok'); panel = null; await cargar(); }
      catch (e) { fallo(e); bt.disabled = false; }
    };
    prever();
  }
  function csvCuenta() {
    const ms = conSaldo(), x = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['Fecha;Tipo;Detalle;Usuario;Monto;Saldo', ...ms.map(r => [r.fecha, (CTA_TIPOS[r.tipo] || [, r.tipo])[1], r.detalle, r.usuario, r.monto, r.saldo_desp].map(x).join(';'))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = `cuenta-movil-${numero}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  // Estado de cuenta en PDF sobre la hoja membretada, que se ve en la misma pestaña
  async function imprimirCuenta() {
    const bt = $$('.modal .btn').find(b => /Estado de cuenta/.test(b.textContent)), txt = bt && bt.textContent;
    if (bt) { bt.disabled = true; bt.textContent = '⏳ Generando PDF…'; }
    try {
      const ms = conSaldo().slice().reverse(), debe = c.saldo < 0 ? -c.saldo : 0, pr = c.prorroga || (c.movil && c.movil.prorroga_hasta);
      const tit = c.titular || (c.movil && (c.movil.titular || c.movil.titular_nombre)) || '';
      const pdf = await pdfMembretado({
        titulo: 'ESTADO DE CUENTA', derecha: ['MÓVIL', String(numero)],
        sub: [(R.cat.empresa && R.cat.empresa.nombre) || 'Remises TOQUE!', tit ? 'Titular: ' + tit : '', 'Emitido el ' + new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })].filter(Boolean).join('  ·  '),
        cajas: [['SALDO', pesos(c.saldo), c.saldo < 0 ? 'rojo' : 'verde'], ['ESTADO', c.texto || '—', c.bloqueado ? 'rojo' : ''], ['PLAN', plan().descripcion || 'Sin plan', ''],
          [debe ? 'PARA ESTAR AL DÍA' : 'PRÓRROGA', debe ? pesos(debe) : pr ? 'hasta ' + String(pr).replace('T', ' ').slice(0, 16) : '—', debe ? 'rojo' : '']],
        cols: [{ t: 'Fecha', w: 30 }, { t: 'Tipo', w: 32 }, { t: 'Detalle', w: 64 }, { t: 'Monto', w: 24, r: 1 }, { t: 'Saldo', w: 24, r: 1 }],
        filas: ms.map(r => ({ v: [fechaLarga(r.fecha), (CTA_TIPOS[r.tipo] || [, r.tipo])[1], [r.detalle, r.usuario && r.usuario !== 'Sistema' ? '(' + r.usuario + ')' : ''].filter(Boolean).join(' '), (r.monto > 0 ? '+' : '') + pesos(r.monto), pesos(r.saldo_desp)],
          col: [null, null, null, r.monto < 0 ? 'rojo' : 'verde', r.saldo_desp < 0 ? 'rojo' : null] })),
        vacio: 'La cuenta no tiene movimientos.',
        pie: `${ms.length} movimiento${ms.length === 1 ? '' : 's'}${(c.movimientos || []).length >= limite ? ' (los más recientes)' : ''}  ·  Saldo final ${pesos(c.saldo)}`,
      });
      verPdf(pdf, `estado-de-cuenta-movil-${numero}.pdf`, 'Estado de cuenta · Móvil ' + numero);
    } catch (e) { fallo(e); }
    finally { if (bt) { bt.disabled = false; bt.textContent = txt; } }
  }
  cuerpo.innerHTML = '<p style="padding:20px;color:var(--suave)">Cargando cuenta…</p>';
  try { await cargar(); } catch (e) { fallo(e); m.cerrar(); }
  return m;
}

ruta('mp-recargas', {
  titulo: 'Pagos de base', roles: ['gestion'], render(main) {
    main.innerHTML = cabecera('Pagos de base', 'Pagos de base pedidos por titulares y conductores (Mercado Pago, Ualá, Naranja X, Personal Pay u otra billetera). Mercado Pago y Ualá se acreditan solos si instalaste la función pagos; el resto, cuando verifiques el cobro en tu cuenta de la billetera o banco, confirmalo acá y se acredita en Cuentas.', '<button class="btn sec" id="rep">🧹 Quitar pedidos repetidos</button>') +
      `<div class="card"><div class="body fila"><div class="campo"><label>Desde</label><input type="date" id="d" value="${diasAtras(30)}"></div><div class="campo"><label>Hasta</label><input type="date" id="h" value="${hoyISO()}"></div><div class="campo"><label>Móvil</label><select id="m"><option value="">Todos</option>${R.cat.moviles.map(m => `<option>${m.numero}</option>`).join('')}</select></div><div class="campo"><label>Estado</label><select id="e"><option value="">Todos</option><option value="pagados">Pagados</option><option value="pendientes">Pendientes</option><option value="cancelados">Cancelados</option><option value="reembolsados">Reembolsados</option></select></div><button class="btn" id="b">Buscar</button></div><div class="body" id="tot" style="padding-top:0"></div><div id="tb"></div></div>`;
    const t = tabla($('#tb'), {
      vacio: 'Sin cargas de saldo.',
      cols: [{ t: 'Fecha', f: p => fechaLarga(p.fecha) }, { t: 'Móvil', k: 'numero' }, { t: 'Monto', c: 'r', f: p => pesos(p.monto) }, { t: 'Estado pago', f: p => `<span class="pill">${p.estado}</span>` }, { t: 'Acreditación', f: p => p.acreditado ? '✅ En cuentas' : '—' }, { t: 'Billetera', f: p => esc({ mercadopago: 'Mercado Pago', uala: 'Ualá', naranjax: 'Naranja X', personalpay: 'Personal Pay', transferencia: 'Transferencia' }[p.proveedor || 'mercadopago'] || p.proveedor) }, { t: 'Medio', f: p => esc(p.medio || '—') }, { t: 'Liberación', f: p => fechaLarga(p.liberacion) }, { t: 'ID del pago', f: p => esc(p.mp_id || '—') }],
      cargar: async () => { const r = await api('/api/mp/recargas?' + qs({ desde: $('#d').value, hasta: $('#h').value, movil: $('#m').value, estado: $('#e').value })); $('#tot').innerHTML = `<div class="grid g4">${[['Pagado', r.totales.pagado], ['Acreditado', r.totales.acreditado], ['Pendiente', r.totales.pendiente], ['Liberado', r.totales.liberado]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${pesos(v)}</div></div>`).join('')}</div>`; return r.filas; },
      acciones: p => [{ t: 'Ver detalle del pago', ico: '🔎', a: () => detallePagoBase(p) }, p.movil_id && { t: 'Ver cuenta del móvil ' + p.numero, ico: '💼', a: () => gestionarCuenta(p.movil_id, p.numero, () => t.refrescar()) },
        p.estado === 'pendiente' && { t: 'Confirmar pago y acreditar', ico: '✅', a: async () => { if (await confirmar(`¿Confirmás que recibiste ${pesos(p.monto)} del móvil ${p.numero}?`)) { await api(`/api/mp/pagos/${p.id}/consultar`, { body: { simular: true } }); toast('Acreditado en Cuentas', 'ok'); t.refrescar(); } } }, p.estado === 'pagado' && !p.acreditado && { t: 'Acreditar en Cuentas', ico: '➡', a: async () => { await api(`/api/mp/pagos/${p.id}/consultar`, { body: {} }); t.refrescar(); } },
        p.estado !== 'pagado' && !p.acreditado && { t: 'Eliminar pedido', ico: '🗑', a: async () => { if (await confirmar(`¿Eliminar el pedido #${p.id} de ${pesos(p.monto)} del móvil ${p.numero}? Usalo para pedidos repetidos o que no se van a pagar.`, 'Eliminar pedido')) { try { await api('/api/mp/pagos/' + p.id, { method: 'DELETE' }); toast('Pedido eliminado', 'ok'); t.refrescar(); } catch (e) { fallo(e); } } } }],
    });
    $('#b').onclick = () => t.refrescar(true);
    // Por cada móvil y monto deja el pedido pendiente más nuevo y elimina los anteriores (los que quedan por tocar varias veces "Pagar")
    $('#rep').onclick = async () => {
      try {
        const movil = $('#m').value, r = await api('/api/mp/recargas/repetidos', { body: { movil } });
        if (!r.cantidad) return toast('No hay pedidos repetidos' + (movil ? ' del móvil ' + movil : ''), 'ok');
        if (!(await confirmar(`Hay ${r.cantidad} pedido${r.cantidad > 1 ? 's' : ''} pendiente${r.cantidad > 1 ? 's' : ''} repetido${r.cantidad > 1 ? 's' : ''} en ${r.moviles} móvil${r.moviles > 1 ? 'es' : ''}${movil ? ' (móvil ' + movil + ')' : ''}. De cada móvil y monto se deja el pedido más nuevo y se eliminan los anteriores. Los pagados y acreditados no se tocan. ¿Continuar?`, 'Quitar pedidos repetidos'))) return;
        const x = await api('/api/mp/recargas/repetidos', { body: { movil, aplicar: true } }); toast(`Se eliminaron ${x.cantidad} pedidos repetidos`, 'ok'); t.refrescar();
      } catch (e) { fallo(e); }
    };
  }
});

function detallePagoBase(p) {
  const fila = (l, v) => `<tr><td style="color:var(--suave);width:42%">${l}</td><td><b>${v}</b></td></tr>`;
  const est = { pendiente: '⏳ Pendiente', pagado: '✅ Pagado', cancelado: '✖ Cancelado' }[p.estado] || esc(p.estado || '—');
  modal({ titulo: 'Pago de base #' + p.id, cuerpo: `<table class="t">${fila('Fecha', fechaLarga(p.fecha))}${fila('Móvil', esc(p.numero ?? '—'))}${fila('Monto', pesos(p.monto))}${fila('Estado', est)}
    ${fila('Acreditado en Cuentas', p.acreditado ? '✅ Sí' : 'No')}${fila('Medio', esc(p.medio || '—'))}${fila('Comisión', pesos(p.comision || 0))}${p.liberacion ? fila('Liberación', esc(p.liberacion)) : ''}${fila('Referencia', esc(p.mp_id || '—'))}</table>
    ${p.estado === 'pagado' ? '<p style="color:var(--suave);font-size:12.5px;margin:10px 0 0">Este pago ya está confirmado y acreditado. Si hubo un error, corregilo con un <b>Ajuste</b> desde la cuenta del móvil.</p>' : ''}`,
    botones: [p.movil_id && { texto: '💼 Ver cuenta del móvil', clase: 'sec', accion: () => { setTimeout(() => gestionarCuenta(p.movil_id, p.numero), 0); } }, { texto: 'Cerrar' }].filter(Boolean) });
}

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
    main.innerHTML = cabecera('Viajes cobrados por Mercado Pago', 'Cuánto pagó el pasajero, cuánto se quedó Mercado Pago, cuánto recibió el conductor y cuánto la central (base cobrada).') +
      `<div class="card"><div class="body fila"><div class="campo"><label>Desde</label><input type="date" id="d" value="${diasAtras(30)}"></div><div class="campo"><label>Hasta</label><input type="date" id="h" value="${hoyISO()}"></div><div class="campo"><label>Móvil</label><select id="m"><option value="">Todos</option>${R.cat.moviles.map(m => `<option>${m.numero}</option>`).join('')}</select></div><div class="campo"><label>Estado</label><select id="e"><option value="">Todos</option><option value="cobrados">Cobrados</option><option value="pendientes">Pendientes</option><option value="cancelados">Cancelados</option><option value="reembolsados">Reembolsados</option></select></div><button class="btn" id="b">Buscar</button><button class="btn sec" id="rt">Rendir disponibles</button></div><div class="body" id="tot" style="padding-top:0"></div><div id="tb"></div></div>`;
    let ult = [];
    const t = tabla($('#tb'), {
      vacio: 'Sin cobros en el rango seleccionado.',
      cols: [{ t: 'Fecha', f: p => fechaLarga(p.fecha) }, { t: 'Viaje', f: p => '#' + p.viaje_id }, { t: 'Móvil', k: 'numero' },
        { t: 'Estado', f: p => `<span class="pill">${p.estado}</span>${p.directo ? ' <span class="pill" style="background:#e3f6e8;color:#1b6e31" title="El pago entró directo a la cuenta del conductor">directo</span>' : p.rendido ? ' ✅' : ''}` },
        { t: 'Pagó el pasajero', c: 'r', f: p => `<b>${pesos(p.monto)}</b>${+p.cargo_plataforma ? `<br><small style="color:var(--suave)">incl. ${pesos(p.cargo_plataforma)} cargos plat.</small>` : ''}` },
        { t: 'Comisión MP', c: 'r', f: p => `<span style="color:var(--rojo)">− ${pesos(p.comision)}</span>${+p.monto ? `<br><small style="color:var(--suave)">${(p.comision / p.monto * 100).toFixed(2).replace('.', ',')} %</small>` : ''}` },
        { t: 'Conductor recibe', c: 'r', f: p => `<b>${pesos(p.conductor)}</b>${p.directo ? '' : `<br><small style="color:var(--suave)">${p.rendido ? 'rendido' : 'a rendir'}</small>`}` },
        { t: 'Central', c: 'r', f: p => `${pesos(p.central)}<br><small style="color:var(--suave)">${p.directo ? 'base cobrada' : 'neto'}</small>` },
        { t: 'Medio', f: p => esc(p.medio || '—') }, { t: 'Liberación', f: p => p.directo ? '—' : fechaLarga(p.liberacion) }],
      cargar: async () => { const r = await api('/api/mp/viajes?' + qs({ desde: $('#d').value, hasta: $('#h').value, movil: $('#m').value, estado: $('#e').value })); ult = r.filas; const x = r.totales;
        $('#tot').innerHTML = `<div class="grid g4">${[['Pagó el pasajero', x.cobrado], ['Cargos de la plataforma', x.cargos], ['Comisión Mercado Pago', x.comision], ['Recibieron los conductores', x.conductores], ['Central (base cobrada / neto)', x.central], ['A rendir a móviles', x.a_rendir], ['Disponible para rendir', x.disponible], ['Reembolsado', x.reembolsado]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${pesos(v)}</div></div>`).join('')}</div>
          <p style="color:var(--suave);font-size:12.5px;margin:8px 0 0"><b>Directo:</b> el pago entra a la cuenta del conductor; Mercado Pago descuenta su comisión y la central recibe la base que el móvil debía (con el tope configurado). <b>Cargos de la plataforma:</b> el recargo que paga el pasajero para cubrir la comisión, así el conductor recibe el valor del viaje. Filas: ${r.filas.length} · Pend. ${x.pend} · Canc. ${x.canc}</p>`; return r.filas; },
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

// ---------- Cuenta corriente de empresas ----------
// Debe: viajes finalizados de la empresa (+ ajustes). Haber: pagos, notas de crédito (y ajustes a favor). Liquidación = cierre del período para facturar.
const CC_TIPO = { viaje: ['🚕', 'Viaje', ''], pago: ['💵', 'Pago', 'verde'], nota_credito: ['🧾', 'Nota de crédito', 'verde'], ajuste: ['✏️', 'Ajuste', ''] };
const ccMes = (off = 0) => { const d = new Date(); const a = new Date(d.getFullYear(), d.getMonth() + off, 1, 12), z = off ? new Date(d.getFullYear(), d.getMonth() + off + 1, 0, 12) : d;
  const f = x => new Date(x - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); return [f(a), f(z)]; };
ruta('cuentas-empresas', {
  titulo: 'Cuenta corriente empresas', roles: ['gestion'], async render(main) {
    const id = +paramsRuta().get('id');
    if (id) return cuentaEmpresa(main, id);
    main.innerHTML = cabecera('Cuenta corriente de empresas', 'Lo que debe cada empresa por sus viajes a cuenta corriente, sus pagos y las liquidaciones para facturar.', '<button class="btn sec" id="ac">⟳ Actualizar</button>') +
      '<div id="res"></div><div id="sinEmp"></div><div class="card" id="tb"></div>';
    const EST = { activa: '', suspendida: ' <span class="pill" style="background:#fff1e3;color:#8a4300">Suspendida</span>', baja: ' <span class="pill" style="background:#fdecec;color:#9b1c1c">De baja</span>' };
    const t = tabla($('#tb'), {
      vacio: 'No hay empresas. Se crean en Administración → Clientes corporativos.',
      cols: [{ t: 'Empresa', f: c => `<a href="#/cuentas-empresas?id=${c.id}"><b>${esc(c.nombre)}</b></a>${EST[c.estado] || ''}${c.cuit ? `<br><small style="color:var(--suave)">CUIT ${esc(c.cuit)}</small>` : ''}` },
        { t: 'Saldo', c: 'r', f: c => `<b style="font-size:15px;color:${c.saldo > 0 ? 'var(--rojo)' : 'var(--verde)'}">${pesos(c.saldo)}</b><br><small style="color:var(--suave)">${c.saldo > 0 ? 'debe' : c.saldo < 0 ? 'a favor' : 'al día'}</small>` },
        { t: 'Este mes', c: 'r', f: c => `${c.viajes_mes} viaje(s)<br><small>${pesos(c.monto_mes)}</small>` },
        { t: 'En curso / reservas', c: 'r', f: c => c.en_curso ? `<a href="#/cuentas-empresas?id=${c.id}" class="pill" style="background:#e6f1fb;color:#0b4f8a">🚕 ${c.en_curso}</a>` : '<span style="color:var(--suave)">—</span>' },
        { t: 'Último pago', f: c => c.ultimo_pago ? `${fechaLarga(c.ultimo_pago.fecha).slice(0, 10)}<br><small>${pesos(c.ultimo_pago.monto)}</small>` : '—' },
        { t: 'Última liquidación', f: c => c.ultima_liq ? `N° ${c.ultima_liq.numero} · ${fechaLarga(c.ultima_liq.desde).slice(0, 5)} al ${fechaLarga(c.ultima_liq.hasta).slice(0, 10)}<br><small>${pesos(c.ultima_liq.monto)}</small>` : '—' },
        { t: 'Contacto', f: c => esc([c.contacto, c.telefono].filter(Boolean).join(' · ') || '—') }],
      cargar: async () => { const r = await api('/api/corp-cuentas');
        const deuda = r.filter(c => c.saldo > 0).reduce((a, c) => a + +c.saldo, 0), mes = r.reduce((a, c) => a + +c.monto_mes, 0);
        $('#res').innerHTML = `<div class="grid g4" style="margin-bottom:14px">${[['Empresas', r.length], ['Total a cobrar', pesos(deuda)], ['Con deuda', r.filter(c => c.saldo > 0).length], ['Facturado este mes', pesos(mes)]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}</div>`;
        sinEmpresa();
        return r; },
      acciones: c => [{ t: 'Ver cuenta corriente', ico: '💼', a: () => ir('cuentas-empresas?id=' + c.id) }, { t: 'Registrar pago', ico: '💵', a: () => ccOperacion(c, 'pago', () => t.refrescar()) }],
    });
    $('#ac').onclick = () => t.refrescar();
    // Viajes cargados a cuenta corriente sin empresa (anteriores al control): se asignan acá para que entren en la cuenta
    async function sinEmpresa() {
      let l = []; try { l = await api('/api/cc-sin-empresa'); } catch (e) { }
      const box = $('#sinEmp'); if (!box) return;
      if (!l.length) { box.innerHTML = ''; return; }
      box.innerHTML = `<div class="card" style="border-left:4px solid #e67e22"><div class="head"><h3>⚠️ Viajes a cuenta corriente sin empresa</h3><span class="pill">${l.length}</span></div>
        <div class="body" style="padding-top:0;color:var(--suave)">Se cobraron a cuenta corriente pero no tienen empresa, por eso no figuran en ninguna cuenta. Asignalos a la empresa que corresponde.</div>
        <div class="tabla-wrap"><table class="t"><thead><tr><th>Viaje</th><th>Fecha</th><th>Estado</th><th>Pasajero</th><th>Recorrido</th><th class="r">Importe</th><th></th></tr></thead><tbody>
        ${l.map(v => `<tr><td><b>#${v.id}</b></td><td style="white-space:nowrap">${fechaLarga(v.fecha)}</td><td>${typeof estadoViaje === 'function' ? estadoViaje(v.estado) : esc(v.estado)}</td><td>${esc([v.alias, v.telefono].filter(Boolean).join(' · ') || '—')}</td>
          <td><small>${esc(v.origen || '')}${v.destino ? ' → ' + esc(v.destino) : ''}</small></td><td class="r">${v.monto != null ? pesos(v.monto) : '—'}</td>
          <td><button class="btn azul chico" data-asig="${v.id}">Asignar a empresa</button></td></tr>`).join('')}</tbody></table></div></div>`;
      $$('[data-asig]', box).forEach(b => b.onclick = async () => {
        const emps = (await api('/api/corp-cuentas')).filter(c => c.estado !== 'baja');
        if (!emps.length) return toast('Primero creá la empresa en Administración → Clientes corporativos', 'error');
        const r = await pedir('Asignar viaje #' + b.dataset.asig, [{ k: 'corporativo_id', l: 'Empresa', t: 'select', op: emps.map(c => [c.id, c.nombre]) }, { k: 'centro_costo', l: 'Centro de costo', ph: 'Opcional' }]);
        if (!r) return;
        try { await api('/api/cc-sin-empresa', { body: { viaje_id: +b.dataset.asig, corporativo_id: +r.corporativo_id, centro_costo: r.centro_costo || null } }); toast('Viaje asignado a la cuenta corriente', 'ok'); t.refrescar(); } catch (e) { fallo(e); }
      });
    }
  }
});
async function ccOperacion(c, op, listo) {
  const T = { pago: ['💵 Registrar pago', 'Monto pagado ($)'], nota_credito: ['🧾 Nota de crédito', 'Monto a descontar ($)'], ajuste: ['✏️ Ajuste', 'Monto (+ suma a la deuda, − descuenta)'] }[op];
  const campos = [{ k: 'monto', l: T[1], t: 'number' }, { k: 'fecha', l: 'Fecha', t: 'date', def: diasAtras(0) }];
  if (op === 'pago') campos.push({ k: 'medio', l: 'Medio', t: 'select', op: [['Transferencia', 'Transferencia'], ['Efectivo', 'Efectivo'], ['Cheque', 'Cheque'], ['Mercado Pago', 'Mercado Pago'], ['Otro', 'Otro']] }, { k: 'comprobante', l: 'Comprobante / N° de operación', ph: 'Opcional' });
  if (op === 'nota_credito') campos.push({ k: 'comprobante', l: 'N° de nota de crédito', ph: 'Opcional' });
  campos.push({ k: 'detalle', l: op === 'ajuste' ? 'Motivo del ajuste' : 'Detalle (opcional)', w: 'full' });
  const r = await pedir(T[0] + ' · ' + c.nombre, campos, op === 'pago' && c.saldo > 0 ? { monto: Math.round(c.saldo) } : {});
  if (!r) return;
  if (r.fecha) r.fecha = r.fecha + ' ' + new Date().toTimeString().slice(0, 8);
  try { const x = await api(`/api/corp-cuentas/${c.id}/${op}`, { body: r }); toast(`Registrado. Saldo: ${pesos(x.saldo)}`, 'ok'); listo && listo(); } catch (e) { fallo(e); }
}
async function cuentaEmpresa(main, id) {
  let [desde, hasta] = ccMes(0), d;
  const cargar = async () => { d = await api(`/api/corp-cuentas/${id}?desde=${desde}&hasta=${hasta}`); pintar(); };
  function pintar() {
    const e = d.empresa; let s = +d.saldo_anterior;
    const filas = d.movimientos.map(m => { if (!m.anulado) s += +m.monto; return { ...m, saldo: m.anulado ? null : s }; });
    const debe = d.movimientos.filter(m => !m.anulado && m.monto > 0).reduce((a, m) => a + +m.monto, 0), haber = d.movimientos.filter(m => !m.anulado && m.monto < 0).reduce((a, m) => a - m.monto, 0);
    main.innerHTML = cabecera('💼 ' + e.nombre, `Cuenta corriente${e.cuit ? ' · CUIT ' + esc(e.cuit) : ''}${e.estado !== 'activa' ? ' · <b>' + (e.estado === 'baja' ? 'De baja' : 'Suspendida') + '</b>' : ''}`, '<button class="btn sec" id="vol">← Empresas</button>') + `
      <div class="cce-top"><div class="cce-saldo ${d.saldo > 0 ? 'neg' : 'pos'}"><small>Saldo actual</small><b>${pesos(Math.abs(d.saldo))}</b><span>${d.saldo > 0 ? 'La empresa debe' : d.saldo < 0 ? 'Saldo a favor de la empresa' : 'Al día'}</span></div>
        <div class="cce-ops">${[['pago', '💵', 'Registrar pago', 'verde'], ['nota_credito', '🧾', 'Nota de crédito', 'azul'], ['ajuste', '✏️', 'Ajuste', 'gris'], ['liquidar', '📑', 'Cerrar período', 'naranja']]
          .map(([k, i, t, c]) => `<button class="cce-op ${c}" data-op="${k}"><span>${i}</span>${t}</button>`).join('')}</div></div>
      <div class="card"><div class="body fila" style="align-items:flex-end;flex-wrap:wrap">
        <div class="campo"><label>Desde</label><input type="date" id="cD" value="${desde}"></div><div class="campo"><label>Hasta</label><input type="date" id="cH" value="${hasta}"></div>
        <button class="btn sec chico" data-r="0">Este mes</button><button class="btn sec chico" data-r="-1">Mes anterior</button><span style="flex:1"></span>
        <button class="btn sec chico" id="csv">⬇ CSV</button><button class="btn sec chico" id="pdf">🖨 Resumen / PDF</button></div></div>
      <div class="grid g4" style="margin-bottom:14px">${[['Saldo anterior', pesos(d.saldo_anterior)], ['Viajes y cargos', pesos(debe)], ['Pagos y créditos', pesos(haber)], ['Saldo al ' + fechaLarga(d.hasta).slice(0, 5), pesos(d.saldo_al_cierre)]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}</div>
      ${(d.en_curso || []).length ? `<div class="card"><div class="head"><h3>🚕 Viajes en curso / reservados</h3><span class="pill">${d.en_curso.length}</span></div>
        <div class="body" style="padding-top:0;color:var(--suave)">Ya están registrados a cuenta corriente de la empresa. Se suman al saldo cuando el viaje finaliza.</div>
        <div class="tabla-wrap"><table class="t"><thead><tr><th>Viaje</th><th>Fecha</th><th>Estado</th><th>Pasajero</th><th>Recorrido</th><th>Móvil</th><th class="r">Estimado</th></tr></thead><tbody>
        ${d.en_curso.map(v => `<tr><td><b>#${v.id}</b></td><td style="white-space:nowrap">${fechaLarga(v.programado || v.creado)}${v.programado ? '<br><small>📅 reserva</small>' : ''}</td><td>${typeof estadoViaje === 'function' ? estadoViaje(v.estado) : esc(v.estado)}</td>
          <td>${esc(v.pasajero || v.telefono || '—')}${v.centro_costo ? `<br><small>🏷 ${esc(v.centro_costo)}</small>` : ''}</td><td><small>${esc(v.origen || '')}${v.destino ? ' → ' + esc(v.destino) : ''}</small></td><td>${v.movil ? 'N° ' + esc(v.movil) : '—'}</td>
          <td class="r">${v.estimado != null ? '≈ ' + pesos(v.estimado) : '—'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      <div class="card"><div class="head"><h3>Movimientos del período</h3><span class="pill">${d.movimientos.filter(m => m.tipo === 'viaje').length} viaje(s)</span></div>
        <div class="tabla-wrap" style="max-height:52vh;overflow:auto"><table class="t"><thead><tr><th>Fecha</th><th>Concepto</th><th>Detalle</th><th class="r">Debe</th><th class="r">Haber</th><th class="r">Saldo</th><th></th></tr></thead><tbody>
          <tr style="background:#f6f9fb"><td colspan="5"><i>Saldo anterior al ${fechaLarga(d.desde).slice(0, 10)}</i></td><td class="r"><b>${pesos(d.saldo_anterior)}</b></td><td></td></tr>
          ${filas.map(m => { const [ic, tt] = CC_TIPO[m.tipo] || ['•', m.tipo]; return `<tr style="${m.anulado ? 'opacity:.45;text-decoration:line-through' : ''}"><td style="white-space:nowrap">${fechaLarga(m.fecha)}</td><td style="white-space:nowrap">${ic} ${tt}${m.viaje_id ? ' #' + m.viaje_id : ''}</td>
            <td>${esc([m.detalle, m.medio, m.comprobante && 'Comp. ' + m.comprobante].filter(Boolean).join(' · '))}${m.centro_costo ? ' · 🏷 ' + esc(m.centro_costo) : ''}${m.usuario ? `<br><small style="color:var(--suave)">${esc(m.usuario)}</small>` : ''}</td>
            <td class="r">${m.monto > 0 ? pesos(m.monto) : ''}</td><td class="r" style="color:var(--verde)">${m.monto < 0 ? pesos(-m.monto) : ''}</td><td class="r">${m.saldo == null ? 'anulado' : pesos(m.saldo)}</td>
            <td>${m.mov_id && !m.anulado ? `<button class="btn-icono" data-anu="${m.mov_id}" title="Anular este movimiento">✖</button>` : ''}</td></tr>`; }).join('')}
          ${filas.length ? '' : '<tr><td colspan="7" style="text-align:center;color:var(--suave);padding:18px">Sin movimientos en el período.</td></tr>'}</tbody></table></div></div>
      <div class="card"><div class="head"><h3>📑 Liquidaciones</h3></div>${d.liquidaciones.length ? `<div class="tabla-wrap"><table class="t"><thead><tr><th>N°</th><th>Período</th><th class="r">Viajes</th><th class="r">Importe del período</th><th class="r">Saldo al cierre</th><th>Factura</th><th>Emitida</th><th></th></tr></thead><tbody>
        ${d.liquidaciones.map(l => `<tr style="${l.anulada ? 'opacity:.45;text-decoration:line-through' : ''}"><td><b>${l.numero}</b></td><td>${fechaLarga(l.desde).slice(0, 10)} al ${fechaLarga(l.hasta).slice(0, 10)}</td><td class="r">${l.viajes}</td><td class="r"><b>${pesos(l.monto)}</b></td><td class="r">${pesos(l.saldo)}</td><td>${esc(l.factura || '—')}</td><td>${fechaLarga(l.creado).slice(0, 10)}</td>
          <td style="white-space:nowrap">${l.anulada ? 'anulada' : `<button class="btn sec chico" data-lpdf="${l.id}">🖨 PDF</button> <button class="btn-icono" data-lanu="${l.id}" title="Anular liquidación">✖</button>`}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="body" style="color:var(--suave)">Todavía no hay liquidaciones. Usá <b>Cerrar período</b> para generar la del mes y facturarla.</div>'}</div>`;
    $('#vol').onclick = () => ir('cuentas-empresas');
    $('#cD').onchange = $('#cH').onchange = () => { desde = $('#cD').value; hasta = $('#cH').value; cargar(); };
    $$('[data-r]', main).forEach(b => b.onclick = () => { [desde, hasta] = ccMes(+b.dataset.r); cargar(); });
    $$('[data-op]').forEach(b => b.onclick = () => b.dataset.op === 'liquidar' ? liquidar() : ccOperacion({ ...e, saldo: d.saldo }, b.dataset.op, cargar));
    $$('[data-anu]').forEach(b => b.onclick = async () => { const m = d.movimientos.find(x => x.mov_id === +b.dataset.anu);
      const r = await pedir('Anular movimiento', [{ t: 'html', html: `<p style="margin:0">${(CC_TIPO[m.tipo] || [, m.tipo])[1]} de <b>${pesos(Math.abs(m.monto))}</b> del ${fechaLarga(m.fecha)}. Queda registrado como anulado.</p>` }, { k: 'motivo', l: 'Motivo', w: 'full' }]);
      if (!r) return; try { await api(`/api/corp-cuentas/${id}/anular`, { body: { mov_id: m.mov_id, motivo: r.motivo } }); toast('Movimiento anulado', 'ok'); cargar(); } catch (x) { fallo(x); } });
    $$('[data-lanu]').forEach(b => b.onclick = async () => { if (!(await confirmar('¿Anular esta liquidación? Podés volver a generar el período.'))) return; try { await api(`/api/corp-cuentas/${id}/liquidar`, { body: { anular: +b.dataset.lanu } }); toast('Liquidación anulada', 'ok'); cargar(); } catch (x) { fallo(x); } });
    $$('[data-lpdf]').forEach(b => b.onclick = async () => { const l = d.liquidaciones.find(x => x.id === +b.dataset.lpdf); const x = await api(`/api/corp-cuentas/${id}?desde=${l.desde}&hasta=${l.hasta}`); ccImprimir(x, l); });
    $('#pdf').onclick = () => ccImprimir(d);
    $('#csv').onclick = () => { let s2 = +d.saldo_anterior; const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = [['Fecha', 'Concepto', 'Detalle', 'Debe', 'Haber', 'Saldo'], ['', 'Saldo anterior', '', '', '', d.saldo_anterior], ...d.movimientos.filter(m => !m.anulado).map(m => { s2 += +m.monto; return [fechaLarga(m.fecha), (CC_TIPO[m.tipo] || [, m.tipo])[1] + (m.viaje_id ? ' #' + m.viaje_id : ''), [m.detalle, m.medio, m.comprobante].filter(Boolean).join(' · '), m.monto > 0 ? m.monto : '', m.monto < 0 ? -m.monto : '', s2]; })];
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(q).join(';')).join('\n')], { type: 'text/csv' })); a.download = `cuenta-${e.nombre.replace(/\W+/g, '-').toLowerCase()}-${desde}-a-${hasta}.csv`; a.click(); };
  }
  async function liquidar() {
    const [a, z] = ccMes(-1);
    const r = await pedir('📑 Cerrar período · ' + d.empresa.nombre, [{ t: 'html', html: '<p style="margin:0 0 6px;color:var(--suave)">Genera la liquidación con los viajes finalizados del período para facturarle a la empresa. Después podés imprimirla o guardarla en PDF.</p>' },
      { k: 'desde', l: 'Desde', t: 'date' }, { k: 'hasta', l: 'Hasta', t: 'date' }, { k: 'factura', l: 'N° de factura (opcional)', ph: 'Ej: A-0001-00001234' }], { desde: a, hasta: z });
    if (!r) return;
    try { const l = await api(`/api/corp-cuentas/${id}/liquidar`, { body: r }); toast(`Liquidación N° ${l.numero}: ${l.viajes} viaje(s), ${pesos(l.monto)}`, 'ok'); await cargar();
      const x = await api(`/api/corp-cuentas/${id}?desde=${l.desde}&hasta=${l.hasta}`); ccImprimir(x, l); } catch (x) { fallo(x); }
  }
  main.innerHTML = '<p style="padding:20px;color:var(--suave)">Cargando cuenta…</p>';
  try { await cargar(); } catch (x) { fallo(x); ir('cuentas-empresas'); }
}
// Resumen de cuenta corriente o liquidación: PDF sobre la hoja membretada, abierto dentro de la misma pestaña
async function ccImprimir(d, liq) {
  const e = d.empresa, viajes = d.movimientos.filter(m => m.tipo === 'viaje' && !m.anulado), otros = d.movimientos.filter(m => m.tipo !== 'viaje' && !m.anulado);
  const tot = viajes.reduce((a, m) => a + +m.monto, 0), pagos = -otros.filter(m => m.monto < 0).reduce((a, m) => a + +m.monto, 0), f10 = x => fechaLarga(x).slice(0, 10);
  const espera = toast('Generando el PDF…');
  try {
    const pdf = await pdfMembretado({
      titulo: liq ? 'LIQUIDACIÓN DE CUENTA CORRIENTE' : 'RESUMEN DE CUENTA CORRIENTE', derecha: liq ? ['N°', String(liq.numero)] : ['VIAJES', String(viajes.length)],
      sub: [e.nombre, e.cuit ? 'CUIT ' + e.cuit : '', `Período del ${f10(d.desde)} al ${f10(d.hasta)}`, liq && liq.factura ? 'Factura ' + liq.factura : '', 'Emitido el ' + new Date().toLocaleDateString('es-AR')].filter(Boolean).join('  ·  '),
      cajas: [['SALDO ANTERIOR', pesos(d.saldo_anterior), ''], [`VIAJES DEL PERÍODO (${viajes.length})`, pesos(tot), 'azul'], ['PAGOS Y CRÉDITOS', pesos(pagos), 'verde'], ['SALDO AL ' + f10(d.hasta), pesos(d.saldo_al_cierre), +d.saldo_al_cierre > 0 ? 'rojo' : 'verde']],
      tablas: [
        { titulo: 'Detalle de viajes', cols: [{ t: 'Fecha', w: 26 }, { t: 'N°', w: 11 }, { t: 'Pasajero y recorrido', w: 70 }, { t: 'Centro', w: 24 }, { t: 'Móvil', w: 12, r: 1 }, { t: 'Km', w: 12, r: 1 }, { t: 'Importe', w: 24, r: 1 }],
          filas: [...viajes.map(m => ({ v: [fechaLarga(m.fecha), m.viaje_id, String(m.detalle || '').replace(/→/g, '–'), m.centro_costo || '—', m.movil || '—', m.km != null ? (+m.km).toFixed(1) : '—', pesos(m.monto)] })),
            ...(viajes.length ? [{ total: 1, v: ['', '', 'Total viajes del período', '', '', '', pesos(tot)] }] : [])], vacio: 'Sin viajes en el período.' },
        ...(otros.length ? [{ titulo: 'Pagos, notas de crédito y ajustes', cols: [{ t: 'Fecha', w: 24 }, { t: 'Concepto', w: 30 }, { t: 'Detalle', w: 90 }, { t: 'Importe', w: 30, r: 1 }],
          filas: otros.map(m => ({ v: [f10(m.fecha), (CC_TIPO[m.tipo] || [, m.tipo])[1], [m.medio, m.comprobante && 'Comp. ' + m.comprobante, m.detalle].filter(Boolean).join(' · '), m.monto < 0 ? '- ' + pesos(-m.monto) : pesos(m.monto)], col: [null, null, null, m.monto < 0 ? 'verde' : null] })) }] : []),
      ],
      nota: 'Documento no válido como factura. Ante cualquier consulta comunicate con la central.',
    });
    verPdf(pdf, `${liq ? 'liquidacion-' + liq.numero : 'resumen-cuenta'}-${e.nombre.replace(/\W+/g, '-').toLowerCase()}-${d.desde}.pdf`, (liq ? 'Liquidación N° ' + liq.numero : 'Resumen de cuenta corriente') + ' · ' + e.nombre);
  } catch (x) { fallo(x); } finally { espera && espera.remove && espera.remove(); }
}
