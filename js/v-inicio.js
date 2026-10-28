// Inicio, perfil, reportes, ayuda, configuración y menú titular/conductor

ruta('dashboard', {
  titulo: 'Inicio', async render(main) {
    const nov = await api('/api/novedades');
    const e = R.cat.empresa || {};
    const dest = nov.filter(n => n.seccion === 'destacado'), sem = nov.filter(n => n.seccion === 'semana'), arc = nov.filter(n => n.seccion === 'archivo');
    main.innerHTML = `<div class="hero"><div><div class="sup">${esc(e.nombre || 'Remises TOQUE!')} · Central de movilidad</div><h1>Novedades</h1><div style="color:var(--suave)">Hola <b>${esc(R.yo.nombre)}</b>. Lo destacado arriba, lo de esta semana al medio y el historial abajo.</div></div>
      <div class="fila">${tiene('admin') ? '<button class="btn sec" id="nuevaNov">+ Nueva novedad</button>' : ''}${tiene('operador') ? '<button class="btn" onclick="window.open(\'panel.html#/mapa\',\'rodar_mapa\')">Abrir mapa</button><button class="btn naranja" onclick="window.open(\'panel.html#/telefonia\',\'rodar_telefonia\')">Telefonía</button>' : ''}</div></div>
      ${tiene('admin', 'gestion', 'operador') ? '<div id="accesos"></div>' : ''}
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
    if ($('#accesos')) pintarAccesos($('#accesos'));
    const nb = $('#nuevaNov'); if (nb) nb.onclick = () => editarNovedad({});
    if (tiene('operador', 'gestion')) {
      const s = await api('/api/estado');
      $('#kpis').innerHTML = `<div class="grid g6" style="margin-bottom:14px">${[['Viajes hoy', s.total], ['Finalizados', s.reales], ['Esperando móvil', s.recibidos], ['Reservas', s.reservas], ['Móviles conectados', s.conectados], ['Tarifa', (s.tarifa || '—') + ' · ' + s.indice.modo]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>`;
    }
  }
});
// ---------- Accesos directos del inicio (se pueden personalizar; se guardan en este navegador por usuario) ----------
const ACC_ICO = { 'Mapa': '🗺️', 'Viajes': '🚕', 'Viajes reservas': '📅', 'Chat & Telefonía': '💬', 'Telefonía': '📞', 'Mensaje a flota': '📣', 'Soporte': '🎧',
  'Móviles': '🚗', 'Penalizados': '⛔', 'Solicitudes conductor': '📝', 'Zonas & Paradas': '🅿️', 'Zonas peligrosas': '⚠️',
  'Cuentas': '💼', 'Cuenta corriente empresas': '🏢', 'Pagos de base MP': '💳', 'Saldos Mercado Pago': '🏦', 'Viajes Mercado Pago': '🧾', 'Medios de pago': '💵', 'Módulos de la plataforma': '🧩', 'Planes': '📋',
  'Tarifas': '💲', 'Usuarios': '👥', 'Clientes corporativos': '🏢', 'Días feriados': '🎉', 'Documentación reguladora': '📂', 'Configuración y demo': '⚙️',
  'Acciones usuarios': '🕵️', 'Clientes bloqueados': '🚫', 'Clientes en baja': '📉', 'Conductores': '🧑‍✈️', 'Conectados': '🟢', 'Estadísticas móviles': '📊', 'Eventos móviles': '📍',
  'Facturación del mes': '💰', 'Histórico recorrido': '🛣️', 'Horas por conductor': '⏱️', 'Informe mensual': '📈', 'Informe operadores': '🎧', 'Mapa de demanda': '🔥',
  'Mapa calor conductores': '🌡️', 'Movimientos de móviles': '🔁', 'Negativos por móvil': '➖', 'Top 10': '🏆', 'Viajes por móvil': '📑', 'Página principal': '🌐', 'Canales de solicitud': '📡', 'Apps y enlaces (QR)': '📱', 'Mi cuenta': '👛', 'Mis viajes': '🧾', 'Pagar base': '💲', 'Mis vehículos': '🚙', 'Mi rendimiento': '📈', 'Recorrido de mis móviles': '🛣️', 'App de conductores': '📲', 'Pedido web de pasajeros': '🙋' };
const ACC_COL = ['#215181', '#278449', '#e8892b', '#7a4fb0', '#d43d3d', '#0f8b8d', '#2a86e8', '#b5651d'];
const ACC_DEF = ['Mapa', 'Viajes', 'Viajes reservas', 'Chat & Telefonía', 'Móviles', 'Cuentas', 'Pagos de base MP', 'Viajes Mercado Pago', 'Tarifas', 'Zonas & Paradas', 'Usuarios', 'Medios de pago', 'Informe mensual', 'Facturación del mes', 'Top 10', 'Configuración y demo'];
function accesosGuardados() { try { const x = JSON.parse(localStorage.getItem('rodar_accesos_' + R.yo.id) || 'null'); return Array.isArray(x) ? x : null; } catch { return null; } }
function pintarAccesos(cont) {
  const todos = (R.atajos || []).filter(x => x.t && x.t !== 'Inicio');
  const unico = new Map(); todos.forEach(x => { if (!unico.has(x.t)) unico.set(x.t, x); });
  const elegidos = (accesosGuardados() || ACC_DEF).map(t => unico.get(t)).filter(Boolean);
  const col = t => ACC_COL[[...t].reduce((a, c) => a + c.charCodeAt(0), 0) % ACC_COL.length];
  cont.innerHTML = `<div class="card accesos"><div class="head"><h3>⚡ Accesos directos</h3><button class="btn sec chico" id="accEd">✎ Personalizar</button></div>
    <div class="body"><div class="acc-grid">${elegidos.map((x, i) => `<button class="acc-t" data-i="${i}" style="--c:${col(x.t)}" title="${esc((x.g ? x.g + ' › ' : '') + x.t)}"><span class="ic">${ACC_ICO[x.t] || '⭐'}</span><b>${esc(x.t)}</b>${x.g ? `<small>${esc(x.g)}</small>` : ''}</button>`).join('')
      || '<p style="color:var(--suave);margin:0">No elegiste accesos. Tocá <b>Personalizar</b>.</p>'}</div></div></div>`;
  $$('.acc-t', cont).forEach(b => b.onclick = () => elegidos[+b.dataset.i].go());
  $('#accEd', cont).onclick = () => {
    const sel = new Set(elegidos.map(x => x.t)), grupos = {};
    unico.forEach(x => (grupos[x.g || 'General'] = grupos[x.g || 'General'] || []).push(x));
    const cuerpo = h(`<div class="acc-ed"><p style="margin:0 0 10px;color:var(--suave)">Marcá las pantallas que querés tener a mano en el inicio.</p>
      ${Object.entries(grupos).map(([g, xs]) => `<div class="acc-g"><div class="acc-gt">${esc(g)}</div><div class="acc-op">${xs.map(x => `<label><input type="checkbox" value="${esc(x.t)}" ${sel.has(x.t) ? 'checked' : ''}><span>${ACC_ICO[x.t] || '⭐'}</span> ${esc(x.t)}</label>`).join('')}</div></div>`).join('')}</div>`);
    modal({ titulo: 'Personalizar accesos directos', cuerpo, ancho: true, botones: [
      { texto: 'Restablecer', clase: 'sec', accion: () => { try { localStorage.removeItem('rodar_accesos_' + R.yo.id); } catch { } pintarAccesos(cont); } },
      { texto: 'Guardar', accion: mb => { const orden = [...(accesosGuardados() || ACC_DEF)], marc = $$('input:checked', mb).map(i => i.value);
          const lista = orden.filter(t => marc.includes(t)).concat(marc.filter(t => !orden.includes(t)));
          try { localStorage.setItem('rodar_accesos_' + R.yo.id, JSON.stringify(lista)); } catch { } pintarAccesos(cont); } }] });
  };
}
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
      { t: 'html', html: `<div class="fila" style="align-items:center">${u.foto ? `<img src="${esc(u.foto)}" alt="Foto de perfil" style="width:72px;height:72px;border-radius:50%;object-fit:cover">` : '<span class="avatar" style="width:72px;height:72px;font-size:24px">' + esc(u.nombre[0]) + '</span>'}<div class="campo"><label>Foto</label><input type="file" id="foto" accept="image/*"></div></div>` },
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

// Bot de Telegram: los mensajes llegan a Chat & Telefonía y el operador responde desde el panel
async function telegramCard() {
  const b = $('#tgB'); if (!b) return;
  const tk = localStorage.getItem('rodar_token');
  const pintar = async accion => {
    b.innerHTML = '<p style="color:var(--suave)">' + (accion === 'estado' ? 'Consultando…' : 'Aplicando…') + '</p>';
    let e; try { e = await RODAR.telegramAdmin(tk, accion); } catch (x) { b.innerHTML = `<p style="color:var(--rojo)">${esc(x.message)}</p><button class="btn sec chico" id="tgR">⟳ Reintentar</button>`; $('#tgR').onclick = () => pintar('estado'); return; }
    const pasos = `<ol style="margin:6px 0 10px;padding-left:20px;line-height:1.6">
      <li>En Telegram, hablale a <b>@BotFather</b> y copiá el <b>token</b> de tu bot (o creá uno con <code>/newbot</code>).</li>
      <li>En <b>Supabase → Edge Functions → Secrets</b> agregá <code>TG_BOT_TOKEN</code> con ese token. <small>(el token es secreto: no lo pegues en el panel ni lo compartas)</small></li>
      <li>Volvé acá y tocá <b>Conectar el bot</b>.</li></ol>`;
    if (!e.instalada) { b.innerHTML = `<p>La función <code>telegram</code> todavía no está instalada en Supabase.</p>`; return; }
    if (!e.configurado) { b.innerHTML = `<p>Conectá tu bot para que los mensajes lleguen a <b>Operador → Chat &amp; Telefonía</b> y se respondan desde ahí.</p>${pasos}<button class="btn sec chico" id="tgR">⟳ Ya cargué el token</button>`; $('#tgR').onclick = () => pintar('estado'); return; }
    if (e.error) { b.innerHTML = `<p style="color:var(--rojo)">${esc(e.error)}</p><p style="color:var(--suave)">Revisá que el secreto <code>TG_BOT_TOKEN</code> sea el token correcto del bot.</p><button class="btn sec chico" id="tgR">⟳ Reintentar</button>`; $('#tgR').onclick = () => pintar('estado'); return; }
    b.innerHTML = `<div class="fila" style="align-items:center;gap:10px;flex-wrap:wrap"><span class="pill" style="background:${e.conectado ? '#e3f6e8;color:#1b6e31' : '#fff1e3;color:#8a4300'};font-weight:700">${e.conectado ? '✅ Conectado' : '⏸ Sin conectar'}</span>
        <b>@${esc(e.bot)}</b><a href="https://t.me/${esc(e.bot)}" target="_blank" rel="noopener" class="btn sec chico">Abrir en Telegram</a></div>
      <p style="margin:10px 0">${e.conectado ? 'Los mensajes que le escriban al bot aparecen en <b>Operador → Chat &amp; Telefonía</b> (✈️) y lo que respondas ahí le llega al cliente por Telegram. El bot le pide al cliente que comparta su número para cargarle el viaje.' : 'El bot está configurado pero no recibe mensajes. Tocá <b>Conectar el bot</b>.'}</p>
      ${e.otra_url ? `<p style="color:#8a4300">⚠️ El bot está conectado a otra dirección (${esc(e.otra_url)}). Al conectarlo acá deja de mandar mensajes allá.</p>` : ''}
      ${e.ultimo_error ? `<p style="color:var(--rojo)">Último error de Telegram: ${esc(e.ultimo_error)}</p>` : ''}
      ${e.pendientes ? `<p style="color:var(--suave)">${e.pendientes} mensaje(s) esperando ser entregados.</p>` : ''}
      <div class="fila" style="gap:6px"><button class="btn ${e.conectado ? 'sec' : 'verde'} chico" id="tgC">${e.conectado ? '↻ Volver a conectar' : '🔌 Conectar el bot'}</button>${e.conectado ? '<button class="btn sec chico" id="tgD">Desconectar</button>' : ''}<button class="btn sec chico" id="tgR">⟳ Actualizar</button></div>`;
    $('#tgC').onclick = () => pintar('conectar'); $('#tgR').onclick = () => pintar('estado');
    if ($('#tgD')) $('#tgD').onclick = async () => { if (await confirmar('¿Desconectar el bot? Los mensajes que le escriban dejan de llegar al panel.')) pintar('desconectar'); };
    if (accion === 'conectar' && e.conectado) toast('Bot de Telegram conectado', 'ok');
  };
  pintar('estado');
}
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
      <div class="card" id="tgCard"><div class="head"><h3>✈️ Bot de Telegram</h3></div><div class="body" id="tgB"><p style="color:var(--suave)">Cargando…</p></div></div>
      <div class="card" id="resCard" style="grid-column:1/-1"><div class="head"><h3>🚫 Cancelaciones de pasajeros (viajes y reservas)</h3></div><div class="body" id="resB"><p style="color:var(--suave)">Cargando…</p></div></div>
      <div class="card" id="segCard"><div class="head"><h3>🔒 Seguridad</h3></div><div class="body" id="segB"><p style="color:var(--suave)">Cargando…</p></div></div>
      <div class="card" style="border:2px solid var(--rojo)"><div class="head"><h3 style="color:var(--rojo)">⚠ Zona de peligro</h3></div><div class="body"><p><b>Borrar todo el sistema y dejarlo en cero.</b> Se eliminan viajes, clientes, móviles, usuarios (menos el tuyo), cuentas y movimientos, chats, soporte, reportes, informes, empresas y direcciones aprendidas. Se conservan las zonas y paradas (salvo que pidas borrarlas al confirmar), los datos de tu empresa, tarifas, planes, módulos, canales, medios de pago, feriados y tu usuario. No se puede deshacer: hacé antes una copia de seguridad desde Supabase.</p><button class="btn" id="reset" style="background:var(--rojo)">🗑 Borrar todo y dejar en cero</button></div></div>`;
    $('#reset').onclick = () => {
      const cuerpo = h(`<div><p>Vas a borrar <b>todos los datos</b> del sistema. Para confirmar, escribí <b>BORRAR TODO</b> y tu contraseña de administrador.</p><div class="campo" style="margin-bottom:10px"><label>Confirmación</label><input name="confirmacion" autocomplete="off" placeholder="BORRAR TODO"></div><div class="campo"><label>Tu contraseña</label><input name="password" type="password" autocomplete="current-password"></div><label class="check" style="margin-top:12px"><input type="checkbox" name="borrar_zonas"> Borrar también las zonas y paradas</label></div>`);
      modal({ titulo: 'Borrar todo el sistema', cuerpo, botones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: '🗑 Borrar todo', clase: 'rojo', accion: async () => {
        const d = leer(cuerpo);
        if ((d.confirmacion || '').trim().toUpperCase() !== 'BORRAR TODO') { toast('Escribí BORRAR TODO para confirmar', 'error'); return false; }
        await api('/api/sistema/reiniciar', { body: { confirmacion: d.confirmacion, password: d.password, zonas: d.borrar_zonas ? 'borrar' : 'conservar' } }); toast('Sistema en cero', 'ok'); setTimeout(() => location.reload(), 800);
      } }] });
    };
    $('#sl').onclick = async () => { const r = await pedir('Simular llamada', [{ k: 'linea', l: 'Línea (F1–F9)', t: 'number', def: 1 }, { k: 'telefono', l: 'Teléfono', def: '3454400037' }]); if (r) { await api('/api/llamada-simular', { body: r }); toast('Llamada enviada a Telefonía', 'ok'); } };
    const fd = formulario([{ k: 'timeout_oferta_seg', l: 'Segundos para aceptar una oferta', t: 'number' }, { k: 'radio_busqueda_m', l: 'Radio de búsqueda (metros)', t: 'number' }, { k: 'max_intentos', l: 'Ofertas antes de dejarlo para asignación manual', t: 'number' }, { k: 'deuda_bloqueo', l: 'Saldo que bloquea por deuda ($, negativo)', t: 'number' }, { k: 'cancelar_minutos', l: 'Minutos que tiene el pasajero para cancelar (0 = sin límite)', t: 'number' }], { cancelar_minutos: 2.5, ...disp });
    $('#fd').append(fd);
    $('#gd').onclick = async () => { const d = leer(fd); Object.keys(d).forEach(k => d[k] = +d[k]); await api('/api/config/dispatch', { body: d }); toast('Guardado', 'ok'); };
    seguridadCard(); reservasCard(); telegramCard();
    $('#gs').onclick = async () => { await api('/api/simulador', { body: { flota: $('#sf').checked, demanda: $('#sd').checked } }); toast('Simulador actualizado', 'ok'); };
  }
});

// Política de cancelación de reservas (app de pasajeros), cargos pendientes y clientes penalizados
async function reservasCard() {
  const b = $('#resB'); if (!b) return;
  let d; try { d = await api('/api/reservas'); } catch (e) { b.innerHTML = `<p>${esc(e.message)}</p>`; return; }
  const c = d.cfg, n = (k, l, ayuda, max) => `<div class="campo"><label>${l}</label><input type="number" id="rs_${k}" min="0" ${max ? `max="${max}"` : ''} value="${esc(c[k])}" style="max-width:130px">${ayuda ? `<small style="color:var(--suave)">${ayuda}</small>` : ''}</div>`;
  const EST = { pendiente: '<span class="cta-tipo" style="background:#fff4e5;color:#8a5300">Pendiente</span>', aplicado: '<span class="cta-tipo verde">Cobrado</span>', perdonado: '<span class="cta-tipo">Perdonado</span>' };
  b.innerHTML = `<p class="ayuda" style="margin-top:0">El pasajero ve estas condiciones al pedir, <b>antes de reservar</b> y al cancelar. El cargo se calcula sobre el precio estimado y <b>se suma a su próximo viaje</b>.</p>
    <h4 style="margin:4px 0 8px">🚕 Viajes para ahora</h4>
    <div class="grid g3" style="align-items:start;margin-bottom:10px">
      <div class="nota" style="background:#eaf7ee;border-color:#bfe3c9">✅ <b>Sin cargo</b> mientras se busca móvil (ningún chofer lo aceptó todavía).</div>
      <div class="nota" style="background:#fff6e5;border-color:#f3d39b">⚠️ <b>Chofer asignado y en camino</b>:${n('pct_asignado', 'Se cobra (%)', '0 = sin cargo', 100)}</div><div></div>
    </div>
    <h4 style="margin:4px 0 8px">📅 Reservas</h4>
    <div class="grid g3" style="align-items:start">
      <div class="nota" style="background:#eaf7ee;border-color:#bfe3c9">✅ <b>Sin cargo</b> si cancela con al menos:${n('sin_cargo_min', 'Minutos de anticipación', '', 1440)}</div>
      <div class="nota" style="background:#fff6e5;border-color:#f3d39b">⚠️ <b>Cancelación tardía</b> (entre el límite anterior y este):${n('tardio_min', 'Minutos de anticipación', '', 1440)}${n('pct_tardio', 'Se cobra (%)', '', 100)}</div>
      <div class="nota" style="background:#fdeeee;border-color:#f3c0c0">⛔ <b>Último momento</b> (menos del límite anterior):
        <div class="campo"><label>Qué pasa</label><select id="rs_ultimo_modo"><option value="cargo">Se cobra un porcentaje</option><option value="penalizacion">Se penaliza (sin reservas por unos días)</option><option value="ambos">Se cobra y se penaliza</option></select></div>
        ${n('pct_ultimo', 'Se cobra (%)', '', 100)}${n('dias_penalizacion', 'Días sin poder reservar', '', 365)}</div>
    </div>
    <div style="text-align:right;margin:4px 0 14px"><button class="btn" id="rsG">Guardar política</button></div>
    <div class="grid g2" style="align-items:start">
      <div><h4 style="margin:0 0 6px">Cargos por cancelación</h4>${d.cargos.length ? `<table class="tabla-simple" style="width:100%"><tr><th>Fecha</th><th>Cliente</th><th class="r">Monto</th><th>Estado</th><th></th></tr>${d.cargos.slice(0, 30).map(x => `<tr><td>${fechaLarga(x.creado)}</td><td>${esc(x.cliente || '')}<br><small style="color:var(--suave)">${esc(x.telefono || '')}</small></td><td class="r"><b>${pesos(x.monto)}</b></td><td>${EST[x.estado] || esc(x.estado)}${x.aplicado_viaje_id ? `<br><small>Viaje #${x.aplicado_viaje_id}</small>` : ''}</td><td>${x.estado === 'pendiente' ? `<button class="btn chico sec" data-perd="${x.id}">Perdonar</button>` : ''}</td></tr>`).join('')}</table>` : '<p style="color:var(--suave)">Todavía no hay cargos.</p>'}</div>
      <div><h4 style="margin:0 0 6px">Clientes sin poder reservar</h4>${d.penalizados.length ? `<table class="tabla-simple" style="width:100%"><tr><th>Cliente</th><th>Hasta</th><th></th></tr>${d.penalizados.map(x => `<tr><td>${esc(x.cliente || '')}<br><small style="color:var(--suave)">${esc(x.telefono || '')}</small></td><td>${fechaLarga(x.hasta)}</td><td><button class="btn chico sec" data-desp="${x.id}">Quitar penalización</button></td></tr>`).join('')}</table>` : '<p style="color:var(--suave)">Ninguno.</p>'}</div>
    </div>`;
  $('#rs_ultimo_modo').value = c.ultimo_modo || 'cargo';
  const modo = () => { const m = $('#rs_ultimo_modo').value; $('#rs_pct_ultimo').closest('.campo').style.display = m === 'penalizacion' ? 'none' : ''; $('#rs_dias_penalizacion').closest('.campo').style.display = m === 'cargo' ? 'none' : ''; };
  $('#rs_ultimo_modo').onchange = modo; modo();
  $('#rsG').onclick = async () => {
    const body = { ultimo_modo: $('#rs_ultimo_modo').value }; ['sin_cargo_min', 'tardio_min', 'pct_tardio', 'pct_ultimo', 'dias_penalizacion', 'pct_asignado'].forEach(k => body[k] = +$('#rs_' + k).value);
    try { await api('/api/reservas/cfg', { body }); toast('Política de cancelación guardada', 'ok'); reservasCard(); } catch (e) { fallo(e); }
  };
  $$('[data-perd]', b).forEach(x => x.onclick = async () => { if (!(await confirmar('¿Perdonar este cargo? No se va a sumar al próximo viaje del cliente.', 'Perdonar cargo'))) return; try { await api('/api/reservas/perdonar', { body: { id: +x.dataset.perd } }); toast('Cargo perdonado', 'ok'); reservasCard(); } catch (e) { fallo(e); } });
  $$('[data-desp]', b).forEach(x => x.onclick = async () => { try { await api('/api/reservas/despenalizar', { body: { id: +x.dataset.desp } }); toast('El cliente ya puede reservar', 'ok'); reservasCard(); } catch (e) { fallo(e); } });
}
// Tarjeta de seguridad: inactividad del panel y captcha (Cloudflare Turnstile)
async function seguridadCard() {
  const b = $('#segB'); if (!b) return;
  let c; try { c = await api('/api/seguridad'); } catch (e) { b.innerHTML = `<p>${esc(e.message)}</p>`; return; }
  let secreto = null; try { const r = await fetch(RODAR_CONFIG.supabaseUrl + '/functions/v1/captcha', { headers: { apikey: RODAR_CONFIG.supabaseKey, Authorization: 'Bearer ' + RODAR_CONFIG.supabaseKey } }); secreto = r.ok ? !!(await r.json()).secreto : null; } catch { }
  b.innerHTML = `<div class="campo"><label>Cerrar la sesión del panel después de (horas sin uso)</label><input type="number" id="sgH" min="1" max="72" value="${+c.panel_horas || 8}" style="max-width:120px"></div>
    <p class="ayuda" style="margin:4px 0 14px">Si nadie toca el panel durante ese tiempo, se cierra la sesión y hay que volver a ingresar. Las apps de conductores y de empresas no se cierran solas.</p>
    <h4 style="margin:6px 0">Captcha invisible (Cloudflare Turnstile)</h4>
    <p class="ayuda" style="margin:0 0 8px">Frena robots en el <b>registro de pasajeros</b> y en el <b>pedido web sin cuenta</b>. Casi nadie ve el desafío: se resuelve solo.</p>
    <div class="campo"><label>Clave de sitio (Site Key)</label><input id="sgK" value="${esc(c.captcha_site_key || '')}" placeholder="0x4AAAAAAA…" autocomplete="off"></div>
    <div style="margin:6px 0 10px;font-size:13.5px">Clave secreta en Supabase (TURNSTILE_SECRET): ${secreto === true ? '<b style="color:var(--verde)">✔ cargada</b>' : secreto === false ? '<b style="color:var(--rojo)">✖ falta cargarla</b>' : '<span style="color:var(--suave)">no se pudo comprobar (¿falta desplegar la función captcha?)</span>'}</div>
    <label class="check"><input type="checkbox" id="sgA" ${c.captcha_activo ? 'checked' : ''}> Activar el captcha</label>
    <div style="text-align:right;margin-top:12px"><button class="btn" id="sgG">Guardar</button></div>`;
  $('#sgG').onclick = async () => {
    const act = $('#sgA').checked;
    if (act && secreto === false && !(await confirmar('Falta cargar la clave secreta TURNSTILE_SECRET en Supabase: con el captcha activado, el registro y el pedido web sin cuenta van a fallar. ¿Activarlo igual?', 'Activar captcha'))) return;
    try { await api('/api/seguridad', { body: { panel_horas: +$('#sgH').value, captcha_site_key: $('#sgK').value.trim(), captcha_activo: act } }); toast('Seguridad guardada', 'ok'); } catch (e) { fallo(e); }
  };
}

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
      $('#r').innerHTML = `<div class="grid g4">${[['Viajes', r.viajes], ['Ingresos', pesos(r.ingresos)], ['Horas conectado', r.horas], ['Ingreso por hora', pesos(r.por_hora)], ['Ofertas recibidas', r.ofrecidos], ['Aceptadas', r.aceptados], ['Rechazadas / sin respuesta', r.rechazados + ' / ' + r.sin_respuesta], ['Tasa de respuesta', r.respuesta != null ? r.respuesta + '%' : '—'], ['Km recorridos', km1(r.km)], ['Calificación', r.calificacion ?? '—']].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>`;
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
