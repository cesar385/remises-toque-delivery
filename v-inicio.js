// Inicio, perfil, reportes, ayuda, configuración y menú titular/conductor

ruta('dashboard', {
  titulo: 'Inicio', async render(main) {
    const nov = await api('/api/novedades');
    const e = R.cat.empresa || {};
    const dest = nov.filter(n => n.seccion === 'destacado'), sem = nov.filter(n => n.seccion === 'semana'), arc = nov.filter(n => n.seccion === 'archivo');
    main.innerHTML = `<div class="hero"><div><div class="sup">${esc(e.nombre || 'Remises TOQUE!')} · Central de movilidad</div><h1>Novedades</h1><div style="color:var(--suave)">Hola <b>${esc(R.yo.nombre)}</b>. Lo destacado arriba, lo de esta semana al medio y el historial abajo.</div></div>
      <div class="fila">${tiene('admin') ? '<button class="btn sec" id="nuevaNov">+ Nueva novedad</button>' : ''}${tiene('operador') ? '<button class="btn" onclick="window.open(\'panel.html#/mapa\',\'rodar_mapa\')">Abrir mapa</button><button class="btn naranja" onclick="window.open(\'panel.html#/telefonia\',\'rodar_telefonia\')">Telefonía</button>' : ''}</div></div>
      <div id="kpis"></div>
      <div class="card"><div class="head"><h3>📢 Destacados</h3><span class="pill" id="pos"></span><button class="btn-icono" id="prev">‹</button><button class="btn-icono" id="next">›</button></div><div class="body" id="dest"></div></div>
      <div class="card"><div class="head"><h3>Esta semana</h3></div><div class="body">${sem.map(nh).join('') || '<p style="color:var(--suave)">Sin novedades esta semana.</p>'}</div></div>
      <details class="arch"><summary><b>Archivo</b> (${arc.length})</summary><div style="margin-top:10px">${arc.map(nh).join('')}</div></details>`;
    function nh(n) {
      return `<div class="novedad" data-id="${n.id}"><div style="display:flex;justify-content:space-between;gap:8px"><div class="et">${esc(n.etiqueta || '')} · ${fechaLarga(n.fecha)}</div>
      <div>${tiene('admin') ? `<button class="btn-icono ed" title="Editar">✎</button><button class="btn-icono bo" title="Borrar">🗑</button>` : ''}${n.seccion === 'destacado' ? `<button class="btn sec chico ok">${n.vista ? '✓ Entendido' : 'Entendido'}</button>` : ''}</div></div>
      <h3>${esc(n.titulo)}</h3><div>${esc(n.cuerpo)}</div>${n.alerta ? `<div class="alerta">⚠ ${esc(n.alerta)}</div>` : ''}</div>`;
    }
    let i = Math.max(0, dest.findIndex(n => !n.vista));
    const mostrar = () => { $('#dest').innerHTML = dest.length ? nh(dest[i]) : '<p>Sin destacados.</p>'; $('#pos').textContent = dest.length ? `${i + 1}/${dest.length}` : ''; enlazar(); };
    $('#prev').onclick = () => { i = (i - 1 + dest.length) % dest.length; mostrar(); };
    $('#next').onclick = () => { i = (i + 1) % dest.length; mostrar(); };
    function enlazar() {
      $$('.novedad', main).forEach(el => {
        const n = nov.find(x => x.id === +el.dataset.id);
        const ok = $('.ok', el); if (ok) ok.onclick = async () => { await api(`/api/novedades/${n.id}/vista`, { body: {} }); n.vista = true; ok.textContent = '✓ Entendido'; };
        const ed = $('.ed', el); if (ed) ed.onclick = () => editarNovedad(n);
        const bo = $('.bo', el); if (bo) bo.onclick = async () => { if (await confirmar('¿Borrar la novedad?')) { await api('/api/novedades/' + n.id, { method: 'DELETE' }); render(); } };
      });
    }
    mostrar(); enlazar();
    const nb = $('#nuevaNov'); if (nb) nb.onclick = () => editarNovedad({});
    if (tiene('operador', 'gestion')) {
      const s = await api('/api/estado');
      $('#kpis').innerHTML = `<div class="grid g6" style="margin-bottom:14px">${[['Viajes hoy', s.total], ['Finalizados', s.reales], ['Esperando móvil', s.recibidos], ['Reservas', s.reservas], ['Móviles conectados', s.conectados], ['Tarifa', (s.tarifa || '—') + ' · ' + s.indice.modo]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>`;
    }
  }
});
async function editarNovedad(n) {
  const r = await pedir(n.id ? 'Editar novedad' : 'Nueva novedad', [
    { k: 'seccion', l: 'Sección', t: 'select', op: [['destacado', 'Destacado'], ['semana', 'Esta semana'], ['archivo', 'Archivo']] }, { k: 'etiqueta', l: 'Etiqueta', ph: 'NUEVO, AVISO…' },
    { k: 'titulo', l: 'Título', w: 'full' }, { k: 'cuerpo', l: 'Texto', t: 'textarea', w: 'full' }, { k: 'alerta', l: 'Alerta (opcional)', w: 'full' }, { k: 'fecha', l: 'Fecha', t: 'date', def: hoyISO() }], n);
  if (!r) return;
  await api('/api/novedades', { body: { ...r, id: n.id } }); render();
}

ruta('perfil', {
  titulo: 'Mi perfil', async render(main) {
    const u = await api('/api/me');
    main.innerHTML = cabecera('Mi perfil', 'Tus datos personales y de contacto. La contraseña se cambia desde el menú de usuario.') + '<div class="card"><div class="body" id="f"></div><div class="mf" style="padding:12px 14px;display:flex;justify-content:flex-end"><button class="btn" id="g">Guardar</button></div></div>';
    const f = formulario([
      { t: 'html', html: `<div class="fila" style="align-items:center">${u.foto ? `<img src="${esc(u.foto)}" style="width:72px;height:72px;border-radius:50%;object-fit:cover">` : '<span class="avatar" style="width:72px;height:72px;font-size:24px">' + esc(u.nombre[0]) + '</span>'}<div class="campo"><label>Foto</label><input type="file" id="foto" accept="image/*"></div></div>` },
      { k: 'documento', l: 'Documento', ro: true }, { k: 'usuario', l: 'Usuario de ingreso', ayuda: 'Podés ingresar con este usuario o con tu documento' },
      { k: 'nombre', l: 'Nombre' }, { k: 'apellido', l: 'Apellido' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'telefono', l: 'Teléfono' },
      { t: 'titulo', l: 'Recupero de cuenta' }, { k: 'email_recupero', l: 'Email de recupero' }, { k: 'tel_recupero', l: 'Teléfono de recupero' },
      ...(tiene('titular', 'conductor') ? [{ t: 'titulo', l: 'Datos bancarios' }, { k: 'cbu', l: 'CBU / CVU' }, { k: 'alias_bancario', l: 'Alias' }] : []),
    ], u);
    $('#f').append(f);
    $('#g').onclick = async () => {
      const d = leer(f); const file = $('#foto').files[0];
      if (file) d.foto = (await subir(file)).archivo;
      try { await api('/api/me', { method: 'PUT', body: d }); toast('Perfil guardado', 'ok'); R.yo = null; location.reload(); } catch (e) { fallo(e); }
    };
  }
});

ruta('mis-reportes', {
  titulo: 'Mis reportes', async render(main) {
    let filtro = '';
    main.innerHTML = cabecera('Mis reportes', 'Seguimiento de fallas que reportaste. Cada respuesta o cambio de estado aparece en el historial.', `${tiene('admin') ? '<label class="check"><input type="checkbox" id="todos"> Ver todos los usuarios</label>' : ''}<button class="btn naranja" id="nuevo">Reportar problema</button>`) +
      `<div class="card"><div class="head"><div class="tabs" style="margin:0;border:0">${['Todos', 'Abiertos', 'Cerrados'].map((t, i) => `<button data-f="${['', 'abiertos', 'cerrados'][i]}" class="${i ? '' : 'act'}">${t}</button>`).join('')}</div><button class="btn sec chico" id="act">Actualizar</button></div>
      <div class="chat-layout" style="height:60vh"><div class="chat-lista" id="lista"></div><div class="chat-msgs" id="det"><div style="padding:20px;color:var(--suave)">Elegí un reporte para ver la consulta y el historial.</div></div></div></div>`;
    async function cargar() {
      const todos = $('#todos') && $('#todos').checked ? 1 : '';
      const rs = await api('/api/reportes?' + qs({ estado: filtro, todos }));
      $('#lista').innerHTML = rs.length ? rs.map(r => `<div class="conv" data-id="${r.id}"><b>#${r.id} ${esc(r.titulo)}</b><br><small>${fechaLarga(r.fecha)} · <span class="pill">${esc(r.estado)}</span>${todos ? ' · ' + esc(r.usuario) : ''}</small></div>`).join('') : '<div style="padding:20px;color:var(--suave)">Sin reportes en este filtro.</div>';
      $$('.conv', main).forEach(c => c.onclick = () => { $$('.conv', main).forEach(x => x.classList.remove('act')); c.classList.add('act'); ver(+c.dataset.id); });
    }
    async function ver(id) {
      const r = await api('/api/reportes/' + id);
      $('#det').innerHTML = `<div class="lista"><div class="burbuja"><b>${esc(r.titulo)}</b> <small>Pantalla: ${esc(r.pantalla || '—')}</small><br>${esc(r.descripcion || '')}</div>${r.historial.map(x => `<div class="burbuja ${x.de === R.yo.nombre ? 'mia' : ''}">${esc(x.texto)}<small>${esc(x.de)} · ${fechaLarga(x.fecha)} · ${esc(x.estado || '')}</small></div>`).join('')}</div>
        <form class="enviar">${tiene('admin') ? `<select name="estado" style="width:140px">${['abierto', 'en_revision', 'respondido', 'cerrado'].map(e => `<option ${e === r.estado ? 'selected' : ''}>${e}</option>`).join('')}</select>` : ''}<input name="texto" placeholder="Agregar comentario…"><button class="btn">Enviar</button></form>`;
      $('#det form').onsubmit = async e => { e.preventDefault(); await api(`/api/reportes/${id}/respuesta`, { body: leer(e.target) }); ver(id); cargar(); };
    }
    $$('.tabs button', main).forEach(b => b.onclick = () => { $$('.tabs button', main).forEach(x => x.classList.remove('act')); b.classList.add('act'); filtro = b.dataset.f; cargar(); });
    $('#act').onclick = cargar; if ($('#todos')) $('#todos').onchange = cargar;
    $('#nuevo').onclick = async () => {
      const r = await pedir('Reportar problema', [{ k: 'titulo', l: 'Título', w: 'full' }, { k: 'pantalla', l: 'Pantalla', t: 'select', op: Object.keys(R.rutas) }, { k: 'descripcion', l: '¿Qué pasó?', t: 'textarea', w: 'full' }]);
      if (r) { await api('/api/reportes', { body: r }); toast('Reporte enviado', 'ok'); cargar(); }
    };
    cargar();
  }
});

ruta('ayuda', {
  titulo: 'Centro de ayuda', async render(main) {
    const cats = [...new Set(GUIAS.map(g => g.cat))];
    let cat = '';
    main.innerHTML = cabecera('Centro de ayuda', 'Guías de cada pantalla, agrupadas como el menú.') + `<div class="ayuda-cat"><button class="act" data-c="">Todas</button>${cats.map(c => `<button data-c="${esc(c)}">${esc(c)} <small>(${GUIAS.filter(g => g.cat === c).length})</small></button>`).join('')}</div>
      <input type="search" id="bq" placeholder="Buscar en las guías…" style="margin-bottom:12px"><div id="gs"></div>`;
    const pintar = () => {
      const q = $('#bq').value.trim();
      const lista = q ? buscarAyuda(q) : GUIAS.filter(g => !cat || g.cat === cat);
      $('#gs').innerHTML = lista.map(g => `<details class="guia"><summary>${esc(g.titulo)} <small style="color:var(--suave);font-weight:400">— ${esc(g.resumen)}</small></summary><div class="gb">${g.preguntas.map(p => `<p><b>${esc(p[0])}</b><br>${esc(p[1])}</p>`).join('') || '<p>' + esc(g.resumen) + '</p>'}${g.ruta ? `<a href="#" data-r="${g.ruta}">Abrir pantalla →</a>` : ''}</div></details>`).join('') || '<p>Sin resultados.</p>';
      $$('a[data-r]', main).forEach(a => a.onclick = e => { e.preventDefault(); ['mapa', 'telefonia', 'chat'].includes(a.dataset.r) ? window.open('panel.html#/' + a.dataset.r) : ir(a.dataset.r); });
    };
    $$('.ayuda-cat button', main).forEach(b => b.onclick = () => { $$('.ayuda-cat button', main).forEach(x => x.classList.remove('act')); b.classList.add('act'); cat = b.dataset.c; pintar(); });
    $('#bq').oninput = pintar; pintar();
  }
});

ruta('configuracion', {
  titulo: 'Configuración', roles: ['admin'], async render(main) {
    const [simu, disp, wh] = await Promise.all([api('/api/simulador'), api('/api/config/dispatch'), api('/api/config/webhook')]);
    main.innerHTML = cabecera('Configuración y modo demo', 'Parámetros del despacho automático y simulador de flota/demanda para pruebas.') +
      `<div class="grid g2"><div class="card"><div class="head"><h3>Despacho automático</h3></div><div class="body" id="fd"></div><div style="padding:0 14px 14px;text-align:right"><button class="btn" id="gd">Guardar</button></div></div>
      <div class="card"><div class="head"><h3>Simulador (demo)</h3></div><div class="body"><p style="color:var(--suave)">Mueve los móviles marcados como simulados, acepta ofertas y genera pedidos de ejemplo. Corre mientras haya un panel abierto (o siempre, si activaste pg_cron). Apagalo cuando empieces a operar con conductores reales: cuando un conductor real ingresa a un móvil, ese móvil deja de ser simulado.</p>
      <label class="check"><input type="checkbox" id="sf" ${simu.flota ? 'checked' : ''}> Flota simulada</label><br><label class="check"><input type="checkbox" id="sd" ${simu.demanda ? 'checked' : ''}> Pedidos simulados</label><br><br><button class="btn" id="gs">Aplicar</button></div></div></div>
      <div class="card"><div class="head"><h3>Integraciones (webhooks)</h3></div><div class="body"><p>Para conectar WhatsApp/Telegram/Instagram (vía tu proveedor o bot) y el identificador de llamadas de la centralita, enviá POST JSON a:</p>
      <pre style="background:#f4f8f8;padding:10px;border-radius:8px;overflow:auto">POST ${esc(RODAR_CONFIG.supabaseUrl)}/rest/v1/rpc/webhook_chat\nHeaders: apikey: (tu clave anon) · Content-Type: application/json\n  {"token":"${esc(wh.token)}","canal":"whatsapp","telefono":"3454123456","alias":"Ana","texto":"Hola"}\n\nPOST ${esc(RODAR_CONFIG.supabaseUrl)}/rest/v1/rpc/webhook_llamada\n  {"token":"${esc(wh.token)}","linea":1,"interno":"101","telefono":"3454123456"}</pre>
      <button class="btn sec" id="sl">Simular llamada entrante en Telefonía</button></div></div>
      <div class="card" style="border:2px solid var(--rojo)"><div class="head"><h3 style="color:var(--rojo)">⚠ Zona de peligro</h3></div><div class="body"><p><b>Borrar todo el sistema y dejarlo en cero.</b> Se eliminan viajes, clientes, móviles, usuarios (menos el tuyo), cuentas y movimientos, chats, soporte, reportes, informes, zonas y paradas, empresas y direcciones aprendidas. Se conservan los datos de tu empresa, tarifas, planes, módulos, canales, medios de pago, feriados y tu usuario. No se puede deshacer: hacé antes una copia de seguridad desde Supabase.</p><button class="btn" id="reset" style="background:var(--rojo)">🗑 Borrar todo y dejar en cero</button></div></div>`;
    $('#reset').onclick = () => {
      const cuerpo = h(`<div><p>Vas a borrar <b>todos los datos</b> del sistema. Para confirmar, escribí <b>BORRAR TODO</b> y tu contraseña de administrador.</p><div class="campo" style="margin-bottom:10px"><label>Confirmación</label><input name="confirmacion" autocomplete="off" placeholder="BORRAR TODO"></div><div class="campo"><label>Tu contraseña</label><input name="password" type="password" autocomplete="current-password"></div></div>`);
      modal({ titulo: 'Borrar todo el sistema', cuerpo, botones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: '🗑 Borrar todo', clase: 'rojo', accion: async () => {
        const d = leer(cuerpo);
        if ((d.confirmacion || '').trim().toUpperCase() !== 'BORRAR TODO') { toast('Escribí BORRAR TODO para confirmar', 'error'); return false; }
        await api('/api/sistema/reiniciar', { body: d }); toast('Sistema en cero', 'ok'); setTimeout(() => location.reload(), 800);
      } }] });
    };
    $('#sl').onclick = async () => { const r = await pedir('Simular llamada', [{ k: 'linea', l: 'Línea (F1–F9)', t: 'number', def: 1 }, { k: 'telefono', l: 'Teléfono', def: '3454400037' }]); if (r) { await api('/api/llamada-simular', { body: r }); toast('Llamada enviada a Telefonía', 'ok'); } };
    const fd = formulario([{ k: 'timeout_oferta_seg', l: 'Segundos para aceptar una oferta', t: 'number' }, { k: 'radio_busqueda_m', l: 'Radio de búsqueda (metros)', t: 'number' }, { k: 'max_intentos', l: 'Ofertas antes de dejarlo para asignación manual', t: 'number' }, { k: 'deuda_bloqueo', l: 'Saldo que bloquea por deuda ($, negativo)', t: 'number' }], disp);
    $('#fd').append(fd);
    $('#gd').onclick = async () => { const d = leer(fd); Object.keys(d).forEach(k => d[k] = +d[k]); await api('/api/config/dispatch', { body: d }); toast('Guardado', 'ok'); };
    $('#gs').onclick = async () => { await api('/api/simulador', { body: { flota: $('#sf').checked, demanda: $('#sd').checked } }); toast('Simulador actualizado', 'ok'); };
  }
});

// ---------- Menú titular / conductor ----------
ruta('mi-cuenta', {
  titulo: 'Mi cuenta', roles: ['titular'], async render(main) {
    const ms = R.yo.moviles || [];
    main.innerHTML = cabecera('Mi cuenta', 'Saldo, plan y movimientos del móvil seleccionado.', `<select id="mv" style="width:auto">${ms.map(m => `<option value="${m.id}">Móvil ${m.numero}</option>`).join('')}</select><button class="btn naranja" id="cs">Pagar base</button><button class="btn sec" id="ac">Actualizar</button>`) + '<div id="c">Seleccioná un móvil para ver saldo y movimientos.</div>';
    const cargar = async () => {
      if (!$('#mv').value) return;
      const c = await api('/api/cuentas/' + $('#mv').value);
      $('#c').innerHTML = `<div class="grid g4" style="margin-bottom:14px"><div class="kpi"><div class="l">Saldo</div><div class="v" style="color:${c.saldo < 0 ? 'var(--rojo)' : 'var(--verde)'}">${pesos(c.saldo)}</div></div><div class="kpi"><div class="l">Estado</div><div class="v" style="font-size:16px"><span class="dot c-${c.color}"></span>${esc(c.texto)}</div></div><div class="kpi"><div class="l">Plan</div><div class="v" style="font-size:16px">${esc(c.plan ? c.plan.descripcion : 'Sin plan')}</div></div><div class="kpi"><div class="l">Viajes disponibles</div><div class="v">${c.viajes_disponibles ?? '—'}</div></div></div>
        <div class="card"><div class="head"><h3>Movimientos</h3></div>${tablaSimple(c.movimientos, [{ t: 'Fecha', f: x => fechaLarga(x.fecha) }, { t: 'Tipo', k: 'tipo' }, { t: 'Detalle', k: 'detalle' }, { t: 'Monto', c: 'r', f: x => `<b style="color:${x.monto < 0 ? 'var(--rojo)' : 'var(--verde)'}">${pesos(x.monto)}</b>` }])}</div>`;
    };
    $('#mv').onchange = cargar; $('#ac').onclick = cargar; $('#cs').onclick = cargarSaldo; cargar();
  }
});
ruta('mi-rendimiento', {
  titulo: 'Mi rendimiento', roles: ['conductor'], async render(main) {
    main.innerHTML = cabecera('Mi rendimiento', 'Métricas de tus viajes en el período seleccionado.') + `<div class="card"><div class="body fila"><div class="campo"><label>Fecha desde</label><input type="date" id="d" value="${diasAtras(30)}"></div><div class="campo"><label>Fecha hasta</label><input type="date" id="h" value="${hoyISO()}"></div><button class="btn" id="g">Generar</button></div></div><div id="r"><p style="color:var(--suave)">Seleccioná un período y presioná Generar.</p></div>`;
    $('#g').onclick = async () => {
      const r = await api('/api/informes/mi-rendimiento?' + qs({ desde: $('#d').value, hasta: $('#h').value }));
      $('#r').innerHTML = `<div class="grid g4">${[['Viajes', r.viajes], ['Ingresos', pesos(r.ingresos)], ['Horas conectado', r.horas], ['Ingreso por hora', pesos(r.por_hora)], ['Ofertas recibidas', r.ofrecidos], ['Aceptadas', r.aceptados], ['Rechazadas / sin respuesta', r.rechazados + ' / ' + r.sin_respuesta], ['Tasa de respuesta', r.respuesta != null ? r.respuesta + '%' : '—'], ['Km recorridos', r.km], ['Calificación', r.calificacion ?? '—']].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>`;
    };
  }
});
ruta('mis-vehiculos', {
  titulo: 'Mis vehículos', roles: ['titular'], async render(main) {
    main.innerHTML = cabecera('Mis vehículos', 'Ubicación de tus móviles en el mapa.', '<select id="mv" style="width:auto"></select>') + '<div class="card" style="height:70vh;position:relative"><div id="mp" style="position:absolute;inset:0;border-radius:10px"></div></div>';
    const mapa = mapaBase($('#mp'));
    const capas = {};
    async function cargar() {
      const ms = await api('/api/informes/mis-vehiculos');
      const sel = $('#mv'); const v = sel.value;
      sel.innerHTML = '<option value="">Todos</option>' + ms.map(m => `<option value="${m.id}">${m.numero} — ${(ESTADOS_MOVIL[m.estado] || [m.estado])[0]}${m.zona ? ' ' + m.zona : ''}</option>`).join(''); sel.value = v;
      ms.forEach(m => { if (m.lat == null) return; const ic = iconoMovil(m.numero, (ESTADOS_MOVIL[m.estado] || [, '#888'])[1]); if (capas[m.id]) capas[m.id].setLatLng([m.lat, m.lng]).setIcon(ic); else capas[m.id] = L.marker([m.lat, m.lng], { icon: ic }).addTo(mapa).bindPopup(`Móvil ${m.numero}<br>${esc(m.conductor || 'Sin conductor')}<br>Última señal: ${esc(m.ultima_senal || '—')}`); });
      return ms;
    }
    const ms = await cargar();
    $('#mv').onchange = () => { const m = ms.find(x => x.id === +$('#mv').value); if (m && m.lat) mapa.setView([m.lat, m.lng], 16); };
    const t = setInterval(() => { if (!document.body.contains($('#mp'))) return clearInterval(t); cargar(); }, 5000);
  }
});
ruta('mis-viajes', { titulo: 'Mis viajes', roles: ['titular', 'conductor', 'corporativo'], render: main => vistaViajesMovil(main, 'Mis viajes', 'Viajes finalizados de tus móviles. Podés filtrar por unidad o ver todos.', R.yo.moviles) });
