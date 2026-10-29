// Operador: telefonía, chat & telefonía, viajes, reservas, soporte

// ================= Formulario de viaje (Telefonía) =================
function formViaje(cont, opts = {}) {
  const st = { cliente: null, origen: null, destino: null, programado: null, repetir: null, est: null };
  cont.innerHTML = `
  <div>
    <button class="btn naranja btn-lat" data-a="limpiar">🗑 Limpiar</button>
    <button class="btn azul btn-lat" data-a="reservas">📅 Reservas <span class="badge gris" id="nRes">0</span></button>
    <button class="btn violeta btn-lat" data-a="negativos">👎 Negativos</button>
    <button class="btn azul btn-lat" data-a="cuentaapp">📱 Cuenta app</button>
    <button class="btn rojo btn-lat" data-a="eliminar">✖ Eliminar cliente</button>
    <label class="check" style="background:#2b3a3b;color:#fff;padding:8px;border-radius:8px;margin-bottom:8px"><input type="checkbox" id="bloq"> Bloqueado en sistema</label>
    <div class="bloque"><div class="tt">Líneas</div><table class="t" id="lineas"><thead><tr><th>F</th><th>Interno</th><th>Teléfono</th></tr></thead><tbody>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<tr data-f="${i}"><td>F${i}</td><td>—</td><td>—</td></tr>`).join('')}</tbody></table></div>
    <div class="bloque" style="margin-top:8px"><div class="tt">Últimos clientes</div><div id="ultimos" style="max-height:220px;overflow:auto"></div></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
    <div class="fila"><div class="rel campo flex"><input id="tel" placeholder="Número de teléfono" inputmode="tel" autocomplete="off"><div class="sug oculto" id="sugTel"></div></div><div class="campo flex"><input id="alias" placeholder="Cliente / Empresa"></div></div>
    <div class="bloque"><div class="tt">Dirección origen</div><div class="in">
      <div class="rel"><input id="oDir" placeholder="Calle y altura, localidad, provincia… o clic en el mapa" autocomplete="off"><div class="sug oculto" id="sugO"></div></div>
      <input type="hidden" id="oLoc"><input type="hidden" id="oProv">
      <textarea id="oRef" placeholder="Referencias del origen" style="min-height:44px"></textarea></div></div>
    <div class="bloque"><div class="tt azul">Dirección destino</div><div class="in">
      <div class="rel"><input id="dDir" placeholder="Destino (opcional) — calle y altura o clic derecho en el mapa" autocomplete="off"><div class="sug oculto" id="sugD"></div></div>
      <input type="hidden" id="dLoc"><input type="hidden" id="dProv"></div></div>
    <div class="bloque"><div class="tt">Datos para el móvil</div><div class="in"><textarea id="datosMovil" placeholder="Información para el conductor, detalles u observaciones"></textarea></div></div>
    <div class="bloque"><div class="tt">Momento del viaje</div><div class="in">
      <div class="fila"><label class="check" style="border:1px solid var(--borde);padding:8px;border-radius:8px"><input type="checkbox" id="oferta"> <span><b>A oferta</b><br><small>Sin móvil automático</small></span></label>
      <label class="check" style="border:1px solid #f0c27b;padding:8px;border-radius:8px"><input type="checkbox" id="pin"> <span><b>PIN seguridad</b><br><small>Pedir PIN al abordar</small></span></label>
      <div class="campo"><label>Vehículo</label><select id="veh"><option value="">🚗 Remís (auto)</option><option value="moto">🏍 Moto (1 pasajero)</option></select></div>
      <div class="campo"><label>Cantidad de móviles</label><select id="cant">${[1, 2, 3, 4, 5].map(n => `<option value="${n}">${n} móvil${n > 1 ? 'es' : ''}</option>`).join('')}</select></div>
      <div class="campo"><label>Canal</label><select id="canal">${R.cat.canales.filter(c => c.codigo !== 'movil').map(c => `<option value="${c.codigo}" ${c.codigo === (opts.canal || 'centralita') ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div></div>
      <div class="fila"><span id="momento" style="flex:1;color:var(--suave)">Ahora</span><button class="btn azul" id="fh">📅 Fecha y hora</button><button class="btn verde" id="ingresar">▶ Ingresar viaje</button></div></div></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
    <div class="bloque"><div class="tt">Total del viaje</div><div class="in"><div class="fila">
      <div class="campo flex"><select id="medio">${R.cat.medios.filter(m => m.habilitado).map(m => `<option value="${m.codigo}">${esc(m.nombre)}</option>`).join('')}</select>
      <div id="ajuste" style="color:var(--suave);font-size:12px;margin-top:4px">Precio normal</div>
      <div id="ccBox" style="display:none;margin-top:6px"><select id="ccEmp"><option value="">— Elegí la empresa —</option>${(R.cat.corporativos || []).map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select>
      <input id="ccCentro" placeholder="Centro de costo (opcional)" style="margin-top:4px"></div></div>
      <div class="campo flex"><div style="border:1px solid var(--borde);border-radius:8px;padding:8px"><div class="fila" style="justify-content:space-between"><span>Total</span><b id="total" style="font-size:18px">—</b></div><small id="detalle" style="color:var(--suave)">Ingresá origen y destino para calcular</small>
      <div class="fila" style="margin-top:6px"><input id="fijo" type="number" placeholder="Precio fijo (opcional)"></div></div></div></div></div></div>
    <div class="bloque"><div class="tt naranja" style="display:flex;justify-content:space-between;padding:5px 10px"><span>Anotaciones internas</span><span style="cursor:pointer" id="gNotas" title="Guardar anotaciones sin ingresar viaje">💾</span></div><div class="in"><textarea id="notas" placeholder="Información interna del cliente / anotaciones del operador"></textarea></div></div>
    <div class="bloque" style="flex:1;min-height:320px;display:flex;flex-direction:column"><div class="tt">Mapa del viaje <small style="font-weight:400">(clic: origen · clic derecho: destino)</small></div><div id="mapaViaje" style="flex:1;min-height:300px"></div></div>
  </div>`;
  const q = s => $(s, cont);
  const mapa = mapaBase(q('#mapaViaje'), { zoom: 14, dobleClicAcerca: true });
  setTimeout(() => mapa.invalidateSize(), 300);
  R.cat.zonas.forEach(z => z.poligono.length > 2 && L.polygon(z.poligono, { color: z.color, weight: 1, fillOpacity: .05, interactive: false }).addTo(mapa));
  R.cat.peligrosas.forEach(z => L.polygon(z.poligono, { color: '#d00', weight: 1, fillOpacity: .15, dashArray: '4' }).addTo(mapa).bindTooltip('Zona peligrosa: ' + esc(z.nombre || '')));
  let mO = null, mD = null, linea = null;
  function ponerMarcadores() {
    mO && mO.remove(); mD && mD.remove(); linea && linea.remove(); mO = mD = linea = null;
    // al arrastrar el marcador: si la dirección ya tiene altura escrita se conserva el texto y sólo se corrige la ubicación
    const arrastre = cual => async e => { const p = e.target.getLatLng(); const txt = q(cual === 'o' ? '#oDir' : '#dDir').value.trim();
      if (RODAR.partirDir(txt).altura) { st[cual === 'o' ? 'origen' : 'destino'] = { lat: p.lat, lng: p.lng, calle: RODAR.partirDir(txt).calle.toLowerCase() }; ponerMarcadores(); } else await fijar(cual, p.lat, p.lng, true); };
    if (st.origen) { mO = L.marker([st.origen.lat, st.origen.lng], { draggable: true, icon: iconoPunto('#278449') }).addTo(mapa); mO.on('dragend', arrastre('o')); }
    if (st.destino) { mD = L.marker([st.destino.lat, st.destino.lng], { draggable: true, icon: iconoPunto('#2a86e8') }).addTo(mapa); mD.on('dragend', arrastre('d')); }
    st.rutaM = null;
    if (st.origen && st.destino) {
      linea = L.polyline([[st.origen.lat, st.origen.lng], [st.destino.lat, st.destino.lng]], { dashArray: '6', color: '#555' }).addTo(mapa); mapa.fitBounds(linea.getBounds(), { padding: [40, 40] });
      // Ruta por calles (si el servicio responde): reemplaza la línea recta y ajusta la distancia del precio estimado
      const o = st.origen, d = st.destino;
      RODAR.ruta(o, d).then(rt => { if (!rt || st.origen !== o || st.destino !== d) return; linea && linea.remove(); linea = L.polyline(rt.coords, { color: '#1d6fe0', weight: 5, opacity: .8 }).addTo(mapa); mapa.fitBounds(linea.getBounds(), { padding: [40, 40] }); st.rutaM = rt.metros; estimar(); });
    }
    else if (st.origen) mapa.setView([st.origen.lat, st.origen.lng], 16);
    estimar();
  }
  async function fijar(cual, lat, lng, inversa, datos) {
    let d = datos;
    if (!d && inversa) d = await api(`/api/geocodificar/inversa?lat=${lat}&lng=${lng}`);
    const p = cual === 'o' ? 'o' : 'd';
    if (d) { q('#' + p + 'Loc').value = d.localidad || ''; q('#' + p + 'Prov').value = d.provincia || ''; q('#' + p + 'Dir').value = RODAR.compDir(d.direccion, d.localidad, d.provincia); if (d.referencias && p === 'o') q('#oRef').value = d.referencias; }
    st[cual === 'o' ? 'origen' : 'destino'] = { lat, lng, calle: RODAR.partirDir(q('#' + p + 'Dir').value).calle.toLowerCase() };
    if (d && d.sinAltura) { const inp = q('#' + p + 'Dir'), pos = (d.direccion || '').length + 1; inp.value = (d.direccion || '') + ' ' + inp.value.slice((d.direccion || '').length); inp.focus(); inp.setSelectionRange(pos, pos); toast('Escribí la altura: el mapa no tiene la numeración de esa calle. La ubicación del marcador se mantiene.'); }
    else if (d && d.aprox) toast(d.conocida === 'estimada' ? 'Ubicación estimada con direcciones conocidas de la misma calle. Si hace falta, arrastrá el marcador.' : 'Ubicación aproximada: el mapa no tiene esa altura. Arrastrá el marcador hasta la puerta si hace falta.');
    ponerMarcadores();
  }
  mapa.on('click', e => fijar('o', e.latlng.lat, e.latlng.lng, true));
  mapa.on('contextmenu', e => fijar('d', e.latlng.lat, e.latlng.lng, true));

  // autocompletado de direcciones
  function autocompletar(inp, sug, cual) {
    let t;
    inp.addEventListener('input', () => {
      clearTimeout(t);
      const v = inp.value.trim(), kk = cual === 'o' ? 'origen' : 'destino';
      { const x = RODAR.enTexto(v), pf = cual === 'o' ? 'o' : 'd'; if (x.loc) q('#' + pf + 'Loc').value = x.loc; if (x.prov) q('#' + pf + 'Prov').value = x.prov; }
      // si sólo se agregó o corrigió la altura de la misma calle, se conserva la ubicación marcada
      if (st[kk] && st[kk].calle !== RODAR.partirDir(v).calle.toLowerCase()) st[kk] = null; if (v.length < 4) { sug.classList.add('oculto'); return; }
      t = setTimeout(async () => {
        const doms = cual === 'o' && st.cliente ? st.cliente.domicilios.filter(d => d.direccion.toLowerCase().includes(v.toLowerCase())) : [];
        const lg = [q(cual === 'o' ? '#oLoc' : '#dLoc').value, q(cual === 'o' ? '#oProv' : '#dProv').value].map(x => x.trim()).filter(Boolean).join(', ');
        const r = await api('/api/geocodificar?q=' + encodeURIComponent(v.includes(',') || !lg ? v : v + ', ' + lg));
        const items = [...doms.map(d => ({ ...d, frecuente: true })), ...r];
        sug.innerHTML = items.map((x, i) => `<div data-i="${i}">${x.frecuente ? '⭐ ' : '📍 '}${esc(x.direccion)} <small style="color:var(--suave)">${esc(x.localidad || '')}</small></div>`).join('') || '<div>Sin resultados — marcá el punto en el mapa</div>';
        sug.classList.remove('oculto');
        $$('div[data-i]', sug).forEach(d => d.onclick = () => { const x = items[+d.dataset.i]; sug.classList.add('oculto'); fijar(cual, x.lat, x.lng, false, x); });
      }, 450);
    });
    inp.addEventListener('blur', () => setTimeout(() => sug.classList.add('oculto'), 200));
  }
  autocompletar(q('#oDir'), q('#sugO'), 'o'); autocompletar(q('#dDir'), q('#sugD'), 'd');

  function mostrarDomicilios() {
    if (!st.cliente || !st.cliente.domicilios.length) return;
    const sug = q('#sugO');
    sug.innerHTML = st.cliente.domicilios.map((d, i) => `<div data-i="${i}">⭐ ${esc(d.direccion)} <small>(${d.usos} viajes)</small></div>`).join('');
    sug.classList.remove('oculto');
    $$('div[data-i]', sug).forEach(el => el.onclick = () => { const d = st.cliente.domicilios[+el.dataset.i]; sug.classList.add('oculto'); fijar('o', d.lat, d.lng, false, d); });
  }
  q('#oDir').addEventListener('focus', () => { if (!q('#oDir').value) mostrarDomicilios(); });

  // búsqueda de cliente
  let tt;
  async function cargarCliente(tel) {
    const c = await api('/api/clientes/tel/' + encodeURIComponent(tel));
    st.cliente = c;
    q('#bloq').checked = !!(c && c.bloqueado);
    q('#nRes').textContent = c ? c.reservas.length : 0;
    if (!c) { q('#notas').value = ''; return; }
    q('#tel').value = c.telefono; q('#alias').value = c.alias || ''; q('#notas').value = c.notas || '';
    if (c.bloqueado) toast('⚠ Cliente BLOQUEADO: ' + (c.motivo_bloqueo || ''), 'error');
    if (c.baja_at) toast('Cliente dado de baja: si ingresás un viaje se recupera');
    if (c.negativos.length) toast('Negativos: no asignar a móvil ' + c.negativos.map(n => n.numero).join(', '));
    if (c.domicilios.length === 1 && !st.origen) fijar('o', c.domicilios[0].lat, c.domicilios[0].lng, false, c.domicilios[0]);
    else { q('#oDir').focus(); mostrarDomicilios(); }
  }
  q('#tel').addEventListener('input', () => {
    clearTimeout(tt); const v = q('#tel').value.trim(); const sug = q('#sugTel');
    if (v.length < 3) { sug.classList.add('oculto'); return; }
    tt = setTimeout(async () => {
      const r = await api('/api/clientes/buscar?q=' + encodeURIComponent(v));
      sug.innerHTML = r.map(c => `<div data-t="${esc(c.telefono)}">${esc(c.telefono)} — ${esc(c.alias || '')}${c.bloqueado ? ' 🚫' : ''}</div>`).join('');
      sug.classList.toggle('oculto', !r.length);
      $$('div', sug).forEach(d => d.onclick = () => { sug.classList.add('oculto'); cargarCliente(d.dataset.t); });
    }, 300);
  });
  q('#tel').addEventListener('keydown', e => { if (e.key === 'Enter') { q('#sugTel').classList.add('oculto'); cargarCliente(q('#tel').value.trim()); } });
  q('#tel').addEventListener('blur', () => setTimeout(() => q('#sugTel').classList.add('oculto'), 200));

  // estimación
  async function estimar() {
    if (!st.origen) { q('#total').textContent = '—'; q('#detalle').textContent = 'Ingresá origen y destino para calcular'; return; }
    const r = await api('/api/estimar', { body: { origen_lat: st.origen.lat, origen_lng: st.origen.lng, destino_lat: st.destino && st.destino.lat, destino_lng: st.destino && st.destino.lng, metros_ruta: st.rutaM || undefined, canal: q('#canal').value, medio_pago: q('#medio').value, vehiculo: (q('#veh') && q('#veh').value) || undefined } });
    st.est = r;
    if (!r) return;
    q('#total').textContent = r.monto != null ? pesos(r.monto) : 'Bajada ' + pesos(r.bajada);
    q('#detalle').textContent = `${r.tarifa}${r.indice > 1 ? ' · índice ×' + r.indice : ''}${r.km ? ' · ' + km1(r.km) + ' km aprox.' : ' · sin destino'} · ${r.cobro}${+r.cargo_plataforma > 0 ? ` · incl. ${pesos(r.cargo_plataforma)} cargos de la plataforma` : ''}`;
    q('#ajuste').textContent = r.ajuste ? `Ajuste ${r.ajuste > 0 ? '+' : ''}${r.ajuste}%` : 'Precio normal';
  }
  const verCC = () => { q('#ccBox').style.display = q('#medio').value === 'cuenta_corriente' ? '' : 'none'; };
  q('#medio').onchange = () => { verCC(); estimar(); }; q('#canal').onchange = estimar; verCC();
  if (q('#veh')) q('#veh').onchange = () => { if (q('#veh').value === 'moto') q('#cant').value = '1'; estimar(); };

  function limpiar() {
    Object.assign(st, { cliente: null, origen: null, destino: null, programado: null, repetir: null, est: null });
    $$('input:not([type=checkbox]),textarea', cont).forEach(i => { if (i.id !== 'fijo' || true) i.value = ''; });
    q('#oferta').checked = q('#pin').checked = q('#bloq').checked = false; q('#cant').value = 1; q('#momento').textContent = 'Ahora'; q('#nRes').textContent = 0;
    ponerMarcadores(); q('#tel').focus();
  }
  async function ultimos() {
    const u = await api('/api/telefonia/ultimos');
    q('#ultimos').innerHTML = u.length ? `<table class="t"><tbody>${u.map(x => `<tr style="cursor:pointer" data-t="${esc(x.telefono)}"><td>${x.hora.slice(11, 16)}</td><td>${esc(x.telefono)}</td></tr>`).join('')}</tbody></table>` : '<p style="text-align:center;color:var(--suave)">No hay teléfonos</p>';
    $$('tr[data-t]', q('#ultimos')).forEach(tr => tr.onclick = () => cargarCliente(tr.dataset.t));
  }
  ultimos();

  // acciones laterales
  cont.querySelector('[data-a=limpiar]').onclick = limpiar;
  cont.querySelector('[data-a=reservas]').onclick = () => {
    if (!st.cliente) return toast('Primero buscá un cliente');
    modal({ titulo: 'Reservas del cliente', cuerpo: tablaSimple(st.cliente.reservas, [{ t: '#', k: 'id' }, { t: 'Fecha', f: r => fechaLarga(r.programado) }, { t: 'Origen', k: 'origen_dir' }]), botones: [{ texto: 'Cerrar' }] });
  };
  cont.querySelector('[data-a=negativos]').onclick = async () => {
    if (!st.cliente) return toast('Primero buscá un cliente');
    const r = await pedir('Negativos del cliente', [{ t: 'html', html: `<p>Actuales: ${st.cliente.negativos.map(n => 'Móvil ' + n.numero).join(', ') || 'ninguno'}</p>` }, { k: 'numero', l: 'Número de móvil', t: 'number' }, { k: 'quitar', l: '', t: 'check', cl: 'Quitar en lugar de agregar' }]);
    if (r && r.numero) { try { await api(`/api/clientes/${st.cliente.id}/negativos`, { body: r }); toast('Negativos actualizados', 'ok'); cargarCliente(st.cliente.telefono); } catch (e) { fallo(e); } }
  };
  cont.querySelector('[data-a=cuentaapp]').onclick = async () => {
    if (!st.cliente) return toast('Primero buscá un cliente');
    try {
      const c = await api(`/api/clientes/${st.cliente.id}/cuenta`, { body: {} });
      if (!c.tiene_cuenta) return modal({ titulo: 'Cuenta en la app', cuerpo: '<p>Este cliente todavía no creó su cuenta en la app de pasajeros. Puede crearla desde el Pedido web con su email y este mismo celular: verá sus viajes nuevos, lugares guardados y reservas.</p>', botones: [{ texto: 'Cerrar' }] });
      modal({ titulo: 'Cuenta en la app', cuerpo: `<p><b>Email:</b> ${esc(c.email)}<br><b>Cuenta creada:</b> ${esc(c.desde || '')}</p><p>Si el cliente olvidó su contraseña, generá una nueva y dictásela (después la puede cambiar en su Perfil). Se cierran sus sesiones abiertas.</p>`,
        botones: [{ texto: 'Cerrar', clase: 'sec' }, { texto: '🔑 Generar contraseña nueva', clase: 'verde', accion: async () => { const r = await api(`/api/clientes/${st.cliente.id}/cuenta`, { body: { resetear: true } }); modal({ titulo: 'Contraseña nueva', cuerpo: `<p>Decile al cliente que ingrese con su email <b>${esc(r.email)}</b> y esta contraseña:</p><div style="font-size:34px;font-weight:800;letter-spacing:6px;text-align:center;color:var(--pri-2)">${esc(r.clave_nueva)}</div>`, botones: [{ texto: 'Listo' }] }); } }] });
    } catch (e) { fallo(e); }
  };
  cont.querySelector('[data-a=eliminar]').onclick = async () => {
    if (!st.cliente) return toast('Primero buscá un cliente');
    if (await confirmar('El cliente pasa a "Clientes en baja" y se borra en 7 días si no se recupera.', 'Eliminar cliente')) { await api(`/api/clientes/${st.cliente.id}/baja`, { body: {} }); toast('Cliente dado de baja', 'ok'); limpiar(); }
  };
  q('#bloq').onchange = async () => {
    if (!st.cliente) { q('#bloq').checked = false; return toast('Primero buscá un cliente'); }
    let motivo = null;
    if (q('#bloq').checked) { const r = await pedir('Bloquear cliente', [{ k: 'motivo', l: 'Motivo', w: 'full' }]); if (!r) { q('#bloq').checked = false; return; } motivo = r.motivo; }
    await api(`/api/clientes/${st.cliente.id}/bloqueo`, { body: { bloquear: q('#bloq').checked, motivo } }); toast(q('#bloq').checked ? 'Cliente bloqueado' : 'Cliente desbloqueado', 'ok');
  };
  q('#gNotas').onclick = async () => { try { await api('/api/clientes/anotacion', { body: { telefono: q('#tel').value.trim(), alias: q('#alias').value, notas: q('#notas').value } }); toast('Anotaciones guardadas', 'ok'); } catch (e) { fallo(e); } };
  q('#fh').onclick = async () => {
    const d = new Date(Date.now() + 3600000);
    const r = await pedir('Fecha y hora del viaje', [{ k: 'fecha', l: 'Fecha', t: 'date', def: hoyISO() }, { k: 'hora', l: 'Hora', t: 'time', def: String(d.getHours()).padStart(2, '0') + ':00' },
    { k: 'repetir', l: '', t: 'check', cl: 'Repetir varios días (agendado masivo)' }, { k: 'dias', l: 'Días de la semana', t: 'multi', op: [[1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [0, 'Dom']], w: 'full' }, { k: 'hasta', l: 'Repetir hasta', t: 'date', def: diasAtras(-14) },
    { t: 'html', html: '<button type="button" class="btn sec chico" id="ahora">Volver a "Ahora"</button>' }]);
    if (!r) return;
    if (r.repetir) {
      const fechas = []; const fin = new Date(r.hasta + 'T23:59'); let x = new Date(r.fecha + 'T12:00');
      while (x <= fin && fechas.length < 120) { if (r.dias.map(Number).includes(x.getDay())) fechas.push(new Date(x - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10)); x = new Date(x.getTime() + 86400000); }
      if (!fechas.length) return toast('No hay días que coincidan', 'error');
      st.repetir = { fechas, hora: r.hora }; st.programado = null;
      q('#momento').innerHTML = `<b>${fechas.length} reservas</b> a las ${r.hora} (${fechas[0]} → ${fechas[fechas.length - 1]}) <a href="#" id="xm">quitar</a>`;
    } else {
      st.programado = `${r.fecha} ${r.hora}:00`; st.repetir = null;
      q('#momento').innerHTML = `<b>Reserva:</b> ${fechaLarga(st.programado)} <a href="#" id="xm">quitar</a>`;
    }
    q('#xm').onclick = e => { e.preventDefault(); st.programado = st.repetir = null; q('#momento').textContent = 'Ahora'; };
  };
  async function ingresar(confirmarPeligrosa) {
    if (!q('#oDir').value.trim()) return toast('Ingresá la dirección de origen', 'error');
    const esCC = q('#medio').value === 'cuenta_corriente';
    if (esCC && !q('#ccEmp').value) { q('#ccEmp').focus(); return toast('Para cobrar a cuenta corriente elegí la empresa', 'error'); }
    if (!st.origen) { const r = await api('/api/geocodificar?q=' + encodeURIComponent(q('#oDir').value + (q('#oDir').value.includes(',') ? '' : [q('#oLoc').value, q('#oProv').value].filter(Boolean).map(x => ', ' + x.trim()).join('')))); if (r[0]) st.origen = { lat: r[0].lat, lng: r[0].lng }; }
    if (q('#dDir').value.trim() && !st.destino) { const r = await api('/api/geocodificar?q=' + encodeURIComponent(q('#dDir').value + (q('#dDir').value.includes(',') ? '' : [q('#dLoc').value, q('#dProv').value].filter(Boolean).map(x => ', ' + x.trim()).join('')))); if (r[0]) st.destino = { lat: r[0].lat, lng: r[0].lng }; }
    const body = {
      telefono: q('#tel').value.trim() || null, alias: q('#alias').value.trim() || null,
      origen_dir: RODAR.enTexto(q('#oDir').value).dir, origen_loc: q('#oLoc').value, origen_prov: q('#oProv').value, origen_ref: q('#oRef').value, origen_lat: st.origen && st.origen.lat, origen_lng: st.origen && st.origen.lng,
      destino_dir: RODAR.enTexto(q('#dDir').value).dir || null, destino_loc: q('#dLoc').value, destino_prov: q('#dProv').value, destino_lat: st.destino && st.destino.lat, destino_lng: st.destino && st.destino.lng, metros_ruta: st.rutaM || undefined,
      datos_movil: q('#datosMovil').value, canal: q('#canal').value, medio_pago: q('#medio').value, a_oferta: q('#oferta').checked, pin_requerido: q('#pin').checked || null,
      cantidad_moviles: +q('#cant').value, vehiculo: (q('#veh') && q('#veh').value) || undefined, programado: st.programado, repetir: st.repetir, monto_fijo: q('#fijo').value ? +q('#fijo').value : undefined, confirmar_peligrosa: confirmarPeligrosa, conv_id: opts.convId && opts.convId(),
      corporativo_id: esCC ? +q('#ccEmp').value : undefined, centro_costo: esCC ? (q('#ccCentro').value.trim() || undefined) : undefined,
    };
    try {
      if (q('#notas').value && body.telefono) await api('/api/clientes/anotacion', { body: { telefono: body.telefono, alias: body.alias, notas: q('#notas').value } });
      const r = await api('/api/viajes', { body });
      toast(`Viaje${r.ids.length > 1 ? 's' : ''} ingresado${r.ids.length > 1 ? 's' : ''}: #${r.ids.join(', #')}`, 'ok');
      opts.onIngresado && opts.onIngresado(r.ids, body);
      limpiar(); ultimos();
    } catch (e) {
      if (e.data && e.data.peligrosa) { if (await confirmar(e.message, 'Zona peligrosa')) ingresar(true); }
      else fallo(e);
    }
  }
  q('#ingresar').onclick = () => ingresar(false);
  // atajo: Ctrl+Enter ingresa
  cont.addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) ingresar(false); });
  // líneas entrantes (identificador de llamadas vía webhook)
  if (R.socket) R.socket.on('llamada', d => {
    const tr = q(`#lineas tr[data-f="${d.linea}"]`); if (!tr) return;
    tr.children[1].textContent = d.interno || d.linea; tr.children[2].textContent = d.telefono; tr.style.background = '#fff4d6'; tr.style.cursor = 'pointer';
    tr.onclick = () => { limpiar(); q('#tel').value = d.telefono; cargarCliente(d.telefono); tr.style.background = ''; };
  });
  document.addEventListener('keydown', e => { const m = /^F([1-9])$/.exec(e.key); if (m && document.body.contains(cont)) { const tr = q(`#lineas tr[data-f="${m[1]}"]`); if (tr && tr.onclick) { e.preventDefault(); tr.onclick(); } } });
  return { cargarCliente, limpiar, setDatos(tel, alias) { limpiar(); q('#tel').value = tel || ''; q('#alias').value = alias || ''; if (tel) cargarCliente(tel); }, set canal(c) { q('#canal').value = c; } };
}

ruta('telefonia', {
  titulo: 'Telefonía', roles: ['operador'], render(body) {
    document.title = 'Telefonía · Remises TOQUE!';
    const c = h('<div class="telefonia"></div>'); body.append(c);
    formViaje(c);
    setTimeout(() => $('#tel', c).focus(), 300);
  }
});

// Envía una respuesta del chat. En conversaciones de WhatsApp sale por la función de Supabase; si no está instalada,
// el mensaje queda guardado en el panel y marcado como "no enviado".
async function enviarChat(conv, texto) {
  if (!['whatsapp', 'telegram'].includes(conv.canal) || (conv.canal === 'telegram' && !conv.ext_id)) return api('/api/chat/' + conv.id, { body: { texto } });
  try { await RODAR.whatsappEnviar(localStorage.getItem('rodar_token'), conv.id, texto, conv.canal); }
  catch (er) {
    if (!er.noConectado) throw er;
    const p = await api('/api/whatsapp/preparar', { body: { conv_id: conv.id, texto } });
    await api('/api/whatsapp/resultado', { body: { msg_id: p.msg_id, ok: false, error: (conv.canal === 'telegram' ? 'Telegram' : 'WhatsApp') + ' no está conectado' } });
    toast(er.message, 'error');
  }
}
ruta('chat', {
  titulo: 'Chat & Telefonía', roles: ['operador'], async render(body) {
    document.title = 'Chat & Telefonía · Remises TOQUE!';
    body.innerHTML = `<div class="chat-tel"><div class="chat-bandeja">
      <div style="background:#1f2b2c;color:#fff;padding:8px 10px;display:flex;gap:6px;align-items:center"><b style="flex:1">Bandeja de clientes</b><select id="est" style="width:auto;min-height:28px"><option value="abierta">Abiertas</option><option value="resuelta">Resueltas</option></select><button class="btn chico naranja" id="sim" title="Simular un mensaje entrante">+ Simular</button></div>
      <div style="display:grid;grid-template-rows:40% 60%;flex:1;min-height:0"><div class="chat-lista" id="convs"></div><div class="chat-msgs" id="msgs" style="border-top:1px solid var(--borde)"><div style="padding:20px;color:var(--suave)">Elegí una conversación.</div></div></div></div>
      <div class="telefonia" id="tf"></div></div>`;
    let actual = null;
    const fv = formViaje($('#tf'), { canal: 'whatsapp', convId: () => actual && actual.id, onIngresado: async (ids) => { if (actual) { await enviarChat(actual, `Tu viaje #${ids[0]} fue ingresado. Te avisamos cuando se asigne el móvil.`).catch(fallo); abrir(actual.id); } } });
    async function lista() {
      const cs = await api('/api/chat?estado=' + $('#est').value);
      $('#convs').innerHTML = cs.map(c => `<div class="conv ${actual && actual.id === c.id ? 'act' : ''}" data-id="${c.id}"><div class="fila" style="justify-content:space-between"><b>${CANALES_ICO[c.canal] || ''} ${esc(c.alias || c.telefono)}</b>${c.no_leidos ? `<span class="badge">${c.no_leidos}</span>` : ''}</div><small style="color:var(--suave)">${esc(c.telefono)} · ${fechaCorta(c.actualizado)}</small><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--suave)">${esc(c.ultimo || '')}</div></div>`).join('') || '<p style="padding:14px;color:var(--suave)">Sin conversaciones.</p>';
      $$('.conv', $('#convs')).forEach(el => el.onclick = () => abrir(+el.dataset.id, true));
    }
    async function abrir(id, cambiar) {
      const r = await api('/api/chat/' + id);
      actual = r.conv;
      if (cambiar) { fv.setDatos(r.conv.telefono, r.conv.alias); fv.canal = ['whatsapp', 'telegram', 'instagram', 'facebook', 'web'].includes(r.conv.canal) ? r.conv.canal : 'whatsapp'; }
      $('#msgs').innerHTML = `<div style="padding:8px 10px;border-bottom:1px solid var(--borde);display:flex;gap:6px;align-items:center"><b style="flex:1">${esc(r.conv.alias || r.conv.telefono)}</b><button class="btn sec chico" id="res">${r.conv.estado === 'abierta' ? 'Resolver' : 'Reabrir'}</button></div>
        <div class="lista">${r.mensajes.map(m => `<div class="burbuja ${m.de === 'operador' ? 'mia' : ''}">${esc(m.texto)}<small>${fechaCorta(m.fecha)}${m.estado === 'enviando' ? ' · enviando…' : ''}${m.estado === 'error' ? ` · <b style="color:var(--rojo)" title="${esc(m.error || '')}">⚠ no enviado${m.error ? ': ' + esc(m.error) : ''}</b>` : ''}</small></div>`).join('')}</div>
        <form class="enviar"><input name="texto" placeholder="Escribí una respuesta…" autocomplete="off"><button class="btn">Enviar</button></form>`;
      const l = $('#msgs .lista'); l.scrollTop = 1e6;
      $('#msgs form').onsubmit = async e => {
        e.preventDefault(); const t = e.target.texto.value.trim(); if (!t) return;
        const btn = $('button', e.target); btn.disabled = true;
        try { await enviarChat(r.conv, t); } catch (er) { fallo(er); }
        btn.disabled = false; abrir(id);
      };
      $('#res').onclick = async () => { await api('/api/chat/' + id, { body: { cerrar: r.conv.estado === 'abierta' } }); actual = null; $('#msgs').innerHTML = ''; lista(); };
      lista();
    }
    $('#est').onchange = lista;
    $('#sim').onclick = async () => {
      const r = await pedir('Simular mensaje entrante', [{ k: 'canal', l: 'Canal', t: 'select', op: [['whatsapp', 'WhatsApp'], ['telegram', 'Telegram'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['web', 'Web']] }, { k: 'telefono', l: 'Teléfono', def: '3454' + Math.floor(100000 + Math.random() * 899999) }, { k: 'alias', l: 'Nombre' }, { k: 'texto', l: 'Mensaje', t: 'textarea', w: 'full', def: 'Hola, ¿me mandan un auto?' }]);
      if (r) { await api('/api/chat-simular', { body: r }); lista(); }
    };
    if (R.socket) R.socket.on('chat', d => { lista(); if (actual && actual.id === d.conv) abrir(d.conv); else if (d.nuevo) toast('Nuevo mensaje de cliente'); });
    setInterval(() => { if (!R.socket || !R.socket.connected) { lista(); const inp = $('#msgs input'); if (actual && !(inp && inp.value)) abrir(actual.id); } }, 8000);
    lista();
  }
});

// ================= Info de viaje y acciones (compartido con mapa) =================
async function infoViaje(id) {
  const v = await api('/api/viajes/' + id);
  const fila = (l, x) => `<tr><th style="background:#eef5f5;color:var(--texto);width:38%">${l}</th><td>${x ?? '—'}</td></tr>`;
  modal({
    titulo: `Viaje #${v.id}`, ancho: true, cuerpo: `<div class="grid g2"><table class="t">${fila('Estado', estadoViaje(v.estado))}${fila('Cliente', esc((v.alias || '') + ' ' + (v.telefono || '')))}${fila('Canal', (CANALES_ICO[v.canal] || '') + ' ' + esc(v.canal))}${fila('Origen', esc(v.origen_dir) + (v.origen_ref ? `<br><small>${esc(v.origen_ref)}</small>` : ''))}${fila('Destino', esc(v.destino_dir))}${fila('Zona', esc(v.zona))}${fila('Datos para el móvil', esc(v.datos_movil))}${fila('Medio de pago', esc(v.medio_pago))}${fila('PIN', v.pin_requerido ? `<b>${v.pin}</b>` : 'No requerido')}</table>
      <table class="t">${fila('Móvil', v.movil_numero ? `${v.movil_numero} · ${esc(v.movil_patente || '')}` : '—')}${fila('Conductor', esc(v.conductor))}${fila('Operador', esc(v.operador))}${fila('Pedido', fechaLarga(v.creado))}${fila('Programado', fechaLarga(v.programado))}${fila('Asignado', fechaLarga(v.asignado_at))}${fila('Llegó', fechaLarga(v.llegada_at))}${fila('Inicio / Fin', fechaLarga(v.inicio_at) + ' / ' + fechaLarga(v.fin_at))}${fila('Km / minutos', km1(v.km) + ' / ' + (v.minutos ?? '—'))}${fila('Monto', pesos(v.monto ?? v.monto_estimado) + (v.indice > 1 ? ` (índice ×${v.indice})` : ''))}${v.motivo_anulacion ? fila('Anulación', esc(v.motivo_anulacion)) : ''}</table></div>
      <h4>Eventos</h4>${tablaSimple(v.eventos, [{ t: 'Fecha', f: e => fechaLarga(e.fecha) }, { t: 'Móvil', k: 'movil_numero' }, { t: 'Tipo', k: 'tipo' }, { t: 'Detalle', k: 'detalle' }], 'Sin eventos')}`, botones: [{ texto: 'Cerrar' }]
  });
}
function accionesViaje(v, refrescar) {
  const activo = ['pendiente', 'ofrecido', 'confirmado', 'en_curso'].includes(v.estado);
  return [
    v.telefono && { t: 'Copiar teléfono', ico: '📋', a: () => { navigator.clipboard.writeText(v.telefono); toast('Copiado'); } },
    { t: 'Información', ico: 'ℹ️', a: () => infoViaje(v.id) },
    { t: 'Descargar ticket PDF', ico: '🧾', a: () => descargar('/print/ticket/' + v.id) },
    v.telefono && { t: 'Ver en Telefonía', ico: '🎧', a: () => { window.open('panel.html#/telefonia', 'rodar_telefonia'); toast('Abrí Telefonía y buscá ' + v.telefono); } },
    activo && { t: 'Aviso WhatsApp (copiar)', ico: '🟢', a: async () => { const l = await api(`/api/viajes/${v.id}/enlace`); const txt = `Hola${v.alias ? ' ' + v.alias : ''}! Tu móvil ${v.movil_numero || ''} está en camino. ${v.pin_requerido ? 'PIN: ' + v.pin + '. ' : ''}Seguilo acá: ${new URL(l.url, location.href).href}`; navigator.clipboard.writeText(txt); toast('Mensaje copiado'); if (v.telefono) window.open('https://wa.me/549' + v.telefono.replace(/\D/g, '') + '?text=' + encodeURIComponent(txt)); } },
    ['pendiente', 'ofrecido', 'confirmado'].includes(v.estado) && { t: 'Asignar / cambiar móvil', ico: '🚕', a: async () => { const r = await pedir('Asignar móvil', [{ k: 'numero', l: 'Número de móvil', t: 'number' }]); if (r) try { await api(`/api/viajes/${v.id}/asignar`, { body: r }); toast('Asignado', 'ok'); refrescar && refrescar(); } catch (e) { fallo(e); } } },
    ['ofrecido', 'confirmado', 'pendiente'].includes(v.estado) && { t: 'Reenviar a otro móvil', ico: '🔁', a: async () => { try { await api(`/api/viajes/${v.id}/reenviar`, { body: {} }); toast('Reenviado', 'ok'); refrescar && refrescar(); } catch (e) { fallo(e); } } },
    ['pendiente', 'ofrecido'].includes(v.estado) && !v.a_oferta && { t: 'Pasar a oferta', ico: '📣', a: async () => { await api(`/api/viajes/${v.id}/oferta`, { body: {} }); refrescar && refrescar(); } },
    ['confirmado', 'en_curso'].includes(v.estado) && { t: 'Finalizar manualmente', ico: '🏁', a: async () => { const r = await pedir('Finalizar viaje', [{ k: 'monto', l: 'Monto (vacío = tarifador)', t: 'number' }]); if (r) try { await api(`/api/viajes/${v.id}/finalizar`, { body: r }); toast('Finalizado', 'ok'); refrescar && refrescar(); } catch (e) { fallo(e); } } },
    R.yo && R.yo.roles.includes('admin') && !['ofrecido', 'confirmado', 'en_curso'].includes(v.estado) && { t: 'Eliminar viaje', ico: '🗑', a: async () => { if (!(await confirmar(`¿Eliminar el viaje #${v.id}? Se borra del listado y de los informes. Los movimientos de cuenta del móvil no se modifican. Esta acción no se puede deshacer.`, 'Eliminar viaje'))) return; try { await api('/api/viajes/' + v.id, { method: 'DELETE' }); toast('Viaje #' + v.id + ' eliminado', 'ok'); refrescar && refrescar(); } catch (e) { fallo(e); } } },
    (activo || v.estado === 'reserva') && { t: 'Anular viaje', ico: '⛔', a: async () => { const r = await pedir('Anular viaje #' + v.id, [{ k: 'motivo', l: 'Motivo', w: 'full' }]); if (r) try { await api(`/api/viajes/${v.id}/anular`, { body: r }); toast('Anulado', 'ok'); refrescar && refrescar(); } catch (e) { fallo(e); } } },
  ];
}

// ================= Viajes =================
ruta('viajes', {
  titulo: 'Viajes', roles: ['operador', 'gestion'], render(main) {
    const ahora = new Date();
    main.innerHTML = `<div class="card"><div class="head" style="background:var(--pri);color:#fff"><h3 style="color:#fff;flex:none">Listado de viajes</h3>
      <button class="btn sec chico" id="rf" title="Restablecer filtros">🗑</button>
      <select id="fe" style="width:auto"><option value="">Todos</option>${Object.entries(ESTADO_VIAJE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <input type="datetime-local" id="fd" style="width:auto" value="${hoyISO()}T00:00"><input type="datetime-local" id="fh" style="width:auto" value="${hoyISO()}T23:59">
      <select id="fo" style="width:auto"><option value="">Origen: todos</option><option value="central">Central</option><option value="calle">Calle</option></select>
      <select id="fc" style="width:auto"><option value="">Canal: todos</option>${R.cat.canales.map(c => `<option value="${c.codigo}">${esc(c.nombre)}</option>`).join('')}</select>
      <button class="btn sec chico" id="mf">⚙ Más filtros</button><button class="btn sec chico" id="ac">⟳ Actualizar</button></div>
      <div class="body oculto fila" id="masf"><input id="ft" placeholder="Teléfono" style="width:150px"><input id="fm" placeholder="Móvil" type="number" style="width:100px"><input id="fp" placeholder="Patente" style="width:120px"><input id="fl" placeholder="Licencia" style="width:120px"><input id="fdir" placeholder="Dirección origen" style="width:200px"></div>
      <div id="tb"></div></div>`;
    const f = () => ({ estado: $('#fe').value, desde: $('#fd').value.replace('T', ' ') + ':00', hasta: $('#fh').value.replace('T', ' ') + ':59', origen: $('#fo').value, canal: $('#fc').value, telefono: $('#ft').value, movil: $('#fm').value, patente: $('#fp').value, licencia: $('#fl').value, direccion: $('#fdir').value });
    const t = tabla($('#tb'), {
      porPagina: 10,
      cols: [{ t: 'N°', f: v => `<b>${v.id}</b>${v.cliente_id ? ' 🏠' : ''}` }, { t: 'Canal', f: v => CANALES_ICO[v.canal] || v.canal }, { t: 'Cliente', f: v => esc(v.alias || v.telefono || (v.origen_tipo === 'calle' ? 'CALLE' : 'EVENTUAL')) }, { t: 'Pedido', f: v => fechaCorta(v.creado) }, { t: 'Estado', f: v => estadoViaje(v.estado) }, { t: 'Móvil N°', k: 'movil_numero' }, { t: 'Dirección', f: v => '📍 ' + esc(v.origen_dir) }, { t: 'Monto', c: 'r', f: v => pesos(v.monto ?? v.monto_estimado) }, { t: 'Zona', k: 'zona' }],
      cargar: p => api('/api/viajes?' + qs({ ...f(), ...p })), acciones: v => accionesViaje(v, () => t.refrescar()),
    });
    ['#fe', '#fd', '#fh', '#fo', '#fc'].forEach(s => $(s).onchange = () => t.refrescar(true));
    $$('#masf input').forEach(i => i.onchange = () => t.refrescar(true));
    $('#mf').onclick = () => $('#masf').classList.toggle('oculto');
    $('#ac').onclick = () => t.refrescar();
    $('#rf').onclick = () => { $('#fe').value = $('#fo').value = $('#fc').value = ''; $$('#masf input').forEach(i => i.value = ''); $('#fd').value = hoyISO() + 'T00:00'; $('#fh').value = hoyISO() + 'T23:59'; t.refrescar(true); };
  }
});

ruta('viajes-reservas', {
  titulo: 'Viajes reservas', roles: ['operador'], render(main) {
    main.innerHTML = cabecera('Viajes reservas', 'Reservas pendientes. Se actualiza solo con el botón.', '<button class="btn sec" id="ac">⟳ Actualizar</button>') +
      `<div class="card"><div class="body fila"><div class="campo"><label>Desde</label><input type="date" id="d" value="${hoyISO()}"></div><div class="campo"><label>Hasta</label><input type="date" id="h" value="${diasAtras(-30)}"></div><div class="campo flex"><label>Buscar</label><input id="b" placeholder="Cliente, teléfono o dirección"></div><button class="btn" id="fl">Filtrar</button><button class="btn rojo" id="an">Anular seleccionadas</button></div><div id="tb"></div></div>`;
    const t = tabla($('#tb'), {
      porPagina: 100,
      cols: [{ t: '<input type="checkbox" id="all">', f: v => `<input type="checkbox" class="sel" value="${v.id}">` }, { t: 'Hora', f: v => fechaLarga(v.programado) }, { t: 'Cliente', f: v => esc(v.alias || '—') }, { t: 'Teléfono', k: 'telefono' }, { t: 'Dirección', k: 'origen_dir' }, { t: 'Canal', f: v => (CANALES_ICO[v.canal] || '') + ' ' + v.canal }, { t: 'Operador', k: 'operador' }, { t: 'Zona', k: 'zona' }],
      cargar: () => api('/api/reservas?' + qs({ desde: $('#d').value, hasta: $('#h').value, buscar: $('#b').value })), acciones: v => accionesViaje(v, () => t.refrescar()),
      pie: () => { const a = $('#all'); if (a) a.onchange = () => $$('.sel').forEach(c => c.checked = a.checked); },
    });
    $('#fl').onclick = $('#ac').onclick = () => t.refrescar(true);
    $('#an').onclick = async () => { const ids = $$('.sel:checked').map(c => +c.value); if (!ids.length) return toast('Seleccioná reservas'); if (await confirmar(`¿Anular ${ids.length} reserva(s)?`)) { await api('/api/reservas/anular', { body: { ids } }); t.refrescar(); } };
  }
});

ruta('soporte', {
  titulo: 'Soporte / Reclamos', roles: ['operador'], render(main) {
    let filtro = '', actual = null;
    main.innerHTML = cabecera('Soporte / Reclamos', 'Consultas de pasajeros y conductores con la central.', '<button class="btn" id="em">Escribir a móvil</button><button class="btn naranja" id="mf">Mensaje a flota</button><button class="btn sec" id="ac">Actualizar</button><button class="btn rojo" id="bc">🗑 Eliminar cerradas</button>') +
      `<div class="card"><div class="head"><input type="search" id="q" placeholder="Buscar asunto, número, teléfono…" style="max-width:260px"><div class="tabs" style="margin:0;border:0">${[['', 'Todos'], ['no_leidos', 'No leídos'], ['moviles', 'Móviles'], ['clientes', 'Clientes']].map((x, i) => `<button data-f="${x[0]}" class="${i ? '' : 'act'}">${x[1]}</button>`).join('')}</div></div>
      <div class="chat-layout"><div class="chat-lista" id="l"></div><div class="chat-msgs" id="m"><div style="padding:20px;color:var(--suave)">Elegí una conversación.</div></div></div></div>`;
    async function lista() {
      const cs = await api('/api/soporte?' + qs({ filtro, q: $('#q').value }));
      $('#l').innerHTML = cs.map(c => `<div class="conv ${actual === c.id ? 'act' : ''}" data-id="${c.id}"><div class="fila" style="justify-content:space-between"><b>${c.tipo === 'movil' ? '🚕 Móvil ' + c.movil_numero : '👤 ' + esc(c.cliente_alias || '') + ' · ' + esc(c.cliente_tel)}</b>${c.no_leidos ? `<span class="badge">${c.no_leidos}</span>` : ''}</div><small>${esc(c.asunto)} · ${fechaCorta(c.actualizado)}${c.cerrada ? ' · cerrada' : ''}</small><div style="color:var(--suave);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.ultimo || '')}</div></div>`).join('') || '<p style="padding:14px;color:var(--suave)">Sin conversaciones.</p>';
      $$('.conv', $('#l')).forEach(el => el.onclick = () => abrir(+el.dataset.id));
      if (actual && !filtro && !$('#q').value && !cs.some(c => c.id === actual)) vaciar(); // la conversación abierta fue eliminada
    }
    function vaciar() { actual = null; $('#m').innerHTML = '<div style="padding:20px;color:var(--suave)">Elegí una conversación.</div>'; }
    async function abrir(id) {
      actual = id;
      const r = await api('/api/soporte/' + id);
      $('#m').innerHTML = `<div style="padding:8px 12px;border-bottom:1px solid var(--borde);display:flex;align-items:center"><b style="flex:1">${r.conv.tipo === 'movil' ? 'Móvil ' + r.conv.movil_numero : esc(r.conv.cliente_alias || r.conv.cliente_tel)} — ${esc(r.conv.asunto)}</b><button class="btn sec chico" id="ce">${r.conv.cerrada ? 'Reabrir' : 'Cerrar'}</button><button class="btn rojo chico" id="bo" style="margin-left:6px" title="Eliminar conversación">🗑 Eliminar</button></div>
        <div class="lista">${r.mensajes.map(m => `<div class="burbuja ${m.de === 'central' ? 'mia' : ''}" style="white-space:pre-wrap">${esc(m.texto)}<small>${esc(m.de)} · ${fechaCorta(m.fecha)}</small></div>`).join('') || '<p style="color:var(--suave)">Sin mensajes todavía. Esperá el próximo o escribí vos.</p>'}</div>
        <form class="enviar"><textarea name="texto" placeholder="Escribí un mensaje…" style="min-height:40px"></textarea><button class="btn">Enviar</button></form>`;
      $('#m .lista').scrollTop = 1e6;
      $('#m form').onsubmit = async e => { e.preventDefault(); const t = e.target.texto.value.trim(); if (!t) return; await api('/api/soporte/' + id, { body: { texto: t } }); abrir(id); };
      $('#ce').onclick = async () => { await api('/api/soporte/' + id, { body: { cerrar: !r.conv.cerrada } }); abrir(id); lista(); };
      $('#bo').onclick = async () => {
        const quien = r.conv.tipo === 'movil' ? 'del móvil ' + r.conv.movil_numero : 'de ' + (r.conv.cliente_alias || r.conv.cliente_tel);
        if (!(await confirmar(`Se va a eliminar la conversación ${quien} con todos sus mensajes. No se puede deshacer.`, 'Eliminar conversación'))) return;
        try { await api('/api/soporte/' + id, { method: 'DELETE' }); toast('Conversación eliminada', 'ok'); vaciar(); lista(); } catch (e) { fallo(e); }
      };
      lista();
    }
    $$('.tabs button', main).forEach(b => b.onclick = () => { $$('.tabs button', main).forEach(x => x.classList.remove('act')); b.classList.add('act'); filtro = b.dataset.f; lista(); });
    $('#q').oninput = () => lista(); $('#ac').onclick = lista; $('#mf').onclick = mensajeFlota;
    $('#bc').onclick = async () => {
      if (!(await confirmar('Se van a eliminar todas las conversaciones cerradas con sus mensajes. No se puede deshacer.', 'Eliminar conversaciones cerradas'))) return;
      try { const x = await api('/api/soporte-borrar-cerradas', { body: {} }); toast(x.borradas ? `Se eliminaron ${x.borradas} conversaciones` : 'No había conversaciones cerradas', 'ok'); lista(); } catch (e) { fallo(e); }
    };
    $('#em').onclick = async () => { const r = await pedir('Escribir a móvil', [{ k: 'numero', l: 'Número de móvil', t: 'number' }, { k: 'asunto', l: 'Asunto' }, { k: 'texto', l: 'Mensaje', t: 'textarea', w: 'full' }]); if (r) try { const x = await api('/api/soporte-nuevo', { body: r }); abrir(x.id); } catch (e) { fallo(e); } };
    if (R.socket) R.socket.on('soporte', d => { lista(); if (d.borrada && actual === d.conv) return vaciar(); if (!d.borrada && actual === d.conv) abrir(d.conv); });
    const tSop = setInterval(() => { if (!document.body.contains($('#l'))) return clearInterval(tSop); if (!R.socket || !R.socket.connected) { lista(); } }, 10000);
    lista();
  }
});
