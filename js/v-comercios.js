// Comercios: anuncios (novedades de la central, promos de comercios y pedidos para anunciar) y lugares de la Guía de la ciudad.
// Llama directo a las funciones de Supabase (sql/66_comercios_guia_anuncios.sql) con dapi(), igual que v-delivery.js.
(function () {
const api = (fn, q, b) => window.dapi(fn, q, b);

const TIPOS = [['novedad', '📣 Novedad de la central'], ['promo', '🏷️ Promoción'], ['comercio', '🏪 Comercio'], ['evento', '🎉 Evento'], ['aviso', '⚠️ Aviso']];
const ESTADOS = { publicado: ['Publicado', '#2f9e57'], pendiente: ['Para revisar', '#e8892b'], solicitud: ['Quiere anunciar', '#1d6fe0'], pausado: ['Pausado', '#8b9899'], rechazado: ['Rechazado', '#d64545'] };
const COLORES = [['', 'Automático'], ['linear-gradient(135deg,#0b4fa8,#1fae5b)', 'Azul y verde (TOQUE!)'], ['linear-gradient(135deg,#083a7c,#0b4fa8)', 'Azul'],
  ['linear-gradient(135deg,#178a48,#1fae5b)', 'Verde'], ['linear-gradient(135deg,#e8892b,#d64545)', 'Naranja'], ['linear-gradient(135deg,#6b3fa0,#d63384)', 'Violeta'], ['#fff3d6', 'Crema'], ['#e8eef8', 'Celeste claro']];
const CATS = [['transporte', '🚌 Transporte'], ['salud', '🏥 Salud'], ['farmacias', '💊 Farmacias'], ['tramites', '🏛️ Trámites'], ['turismo', '🌳 Paseos y cultura'], ['educacion', '🎓 Educación'],
  ['comidas', '🍔 Comidas'], ['compras', '🛒 Compras'], ['hoteles', '🛏️ Alojamiento'], ['bancos', '🏧 Bancos y cajeros'], ['deportes', '⚽ Clubes y deportes'], ['otros', '📍 Otros']];
const pill = e => { const [t, c] = ESTADOS[e] || [e, '#8b9899']; return `<span class="pill" style="background:${c}22;color:${c};border-color:${c}55">${esc(t)}</span>`; };
const fecha = s => s ? fechaLarga(String(s)) : '—';
const fallo = e => toast(e.message, 'error');

// ---------- menú: se suma al menú de Delivery (v-delivery.js lee window.DLV_MENU_EXTRA) ----------
window.DLV_MENU_EXTRA = (window.DLV_MENU_EXTRA || []).concat([
  { tit: '📢 Comercios y anuncios' }, { t: 'Anuncios', r: 'anuncios', roles: ['admin'] }, { t: 'Guía de la ciudad', r: 'guia-lugares', roles: ['admin'] },
  { t: 'Página de anuncios', a: () => window.open('anuncios.html') }, { t: 'Página de la guía', a: () => window.open('guia.html') }
]);

// ---------- formulario de anuncio ----------
async function editarAnuncio(a, negocios, listo) {
  const r = await pedir(a.id ? 'Modificar anuncio' : 'Nuevo anuncio', [
    { t: 'titulo', l: 'Contenido' },
    { k: 'titulo', l: 'Título', w: 'full' },
    { k: 'tipo', l: 'Tipo', t: 'select', op: TIPOS },
    { k: 'estado', l: 'Estado', t: 'select', op: [['publicado', 'Publicado'], ['pausado', 'Pausado'], ['pendiente', 'Para revisar'], ['rechazado', 'Rechazado']] },
    { k: 'texto', l: 'Texto', t: 'textarea', w: 'full' },
    { k: 'anunciante', l: 'Anunciante (si no es un comercio de delivery)' },
    { k: 'negocio_id', l: 'Comercio de delivery (opcional)', t: 'select', op: [['', '— Ninguno —'], ...negocios.map(n => [n.id, n.nombre])], ayuda: 'Si elegís uno, el anuncio muestra "Pedir delivery".' },
    { t: 'titulo', l: 'Diseño' },
    { k: 'emoji', l: 'Emoji', ph: '🏷️' }, { k: 'color', l: 'Color de fondo', t: 'select', op: COLORES },
    { k: 'imagen', l: 'Imagen (dirección https://, opcional)', w: 'full' },
    { t: 'titulo', l: 'Vigencia y botón' },
    { k: 'desde', l: 'Desde', t: 'date' }, { k: 'hasta', l: 'Hasta (vacío = sin vencimiento)', t: 'date' },
    { k: 'destacado', l: 'Carrusel principal', t: 'select', op: [['false', 'No'], ['true', 'Sí, destacado']] }, { k: 'orden', l: 'Orden', t: 'number' },
    { k: 'codigo', l: 'Cupón (opcional)', ph: 'TOQUE10' }, { k: 'cta', l: 'Texto del botón', ph: 'Ver más' },
    { k: 'link', l: 'Enlace del botón', ph: 'https://… o guia.html' }, { k: 'destino', l: 'Dirección para "Ir en remís"' },
    { k: 'tel', l: 'WhatsApp del anunciante', ph: '543454…' }, { k: 'nota', l: 'Nota interna', w: 'full' }
  ], { estado: 'publicado', tipo: 'comercio', orden: 0, ...a, negocio_id: a.negocio_id || '', destacado: String(!!a.destacado), desde: a.desde ? String(a.desde).slice(0, 10) : '', hasta: a.hasta ? String(a.hasta).slice(0, 10) : '', estado: a.estado === 'solicitud' ? 'publicado' : (a.estado || 'publicado') });
  if (!r) return;
  try {
    await api('r_anuncio_guardar', {}, { ...r, id: a.id || null, negocio_id: r.negocio_id ? +r.negocio_id : null, destacado: r.destacado === 'true', orden: +r.orden || 0 });
    toast('Anuncio guardado', 'ok'); listo && listo();
  } catch (e) { fallo(e); }
}

ruta('anuncios', {
  titulo: 'Anuncios', roles: ['admin'], render(main) {
    main.innerHTML = cabecera('Anuncios', 'Novedades de la central y promociones de comercios. Lo publicado y vigente aparece en anuncios.html; lo que cargan los comercios espera tu aprobación.', '<button class="btn" id="nuevo">+ Nuevo anuncio</button>') +
      `<div class="card"><div class="body fila"><div class="campo"><label>Estado</label><select id="fe"><option value="">Todos</option>${Object.entries(ESTADOS).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}</select></div><span id="pend" style="align-self:center"></span></div><div id="tb"></div></div>`;
    let negocios = [];
    const t = tabla($('#tb'), {
      vacio: 'No hay anuncios.',
      cols: [{ t: '', f: a => `<span style="font-size:22px">${esc(a.emoji || '📌')}</span>` },
        { t: 'Anuncio', f: a => `<b>${esc(a.titulo)}</b>${a.destacado ? ' ⭐' : ''}<br><small>${esc((TIPOS.find(x => x[0] === a.tipo) || [, a.tipo])[1])} · ${esc(a.negocio || a.anunciante || '')}</small>` },
        { t: 'Estado', f: a => pill(a.estado) + (a.estado === 'publicado' && !a.vigente ? '<br><small>fuera de fecha</small>' : '') },
        { t: 'Vigencia', f: a => `${fecha(a.desde)} → ${a.hasta ? fecha(a.hasta) : 'sin fin'}` },
        { t: 'Contacto', f: a => a.contacto ? `${esc(a.contacto.telefono || '')}<br><small>${esc([a.contacto.rubro, a.contacto.plan].filter(Boolean).join(' · '))}</small>` : '—' }],
      cargar: async () => { const r = await api('r_anuncios', { estado: $('#fe').value }); negocios = r.negocios; $('#pend').innerHTML = r.pendientes ? `<b>${r.pendientes}</b> para revisar` : ''; return r.filas; },
      acciones: a => [
        { t: a.estado === 'solicitud' ? 'Armar el anuncio' : 'Modificar', ico: '✎', a: () => editarAnuncio(a, negocios, () => t.refrescar()) },
        a.estado !== 'publicado' && a.estado !== 'solicitud' && { t: 'Publicar', ico: '✅', a: async () => { try { await api('r_anuncio_estado', { id: a.id }, { estado: 'publicado' }); t.refrescar(); } catch (e) { fallo(e); } } },
        a.estado === 'publicado' && { t: 'Pausar', ico: '⏸', a: async () => { try { await api('r_anuncio_estado', { id: a.id }, { estado: 'pausado' }); t.refrescar(); } catch (e) { fallo(e); } } },
        a.estado === 'pendiente' && { t: 'Rechazar', ico: '⛔', a: async () => { const r = await pedir('Rechazar promoción', [{ k: 'nota', l: 'Motivo (lo ve el comercio)', w: 'full' }]); if (r) try { await api('r_anuncio_estado', { id: a.id }, { estado: 'rechazado', nota: r.nota }); t.refrescar(); } catch (e) { fallo(e); } } },
        a.contacto && a.contacto.telefono && { t: 'Escribir por WhatsApp', ico: '💬', a: () => window.open('https://wa.me/' + (String(a.contacto.telefono).startsWith('54') ? '' : '549') + a.contacto.telefono) },
        { t: 'Eliminar', ico: '🗑', a: async () => { if (await confirmar(`¿Eliminar "${a.titulo}"?`)) try { await api('r_anuncio_borrar', { id: a.id }); t.refrescar(); } catch (e) { fallo(e); } } }
      ].filter(Boolean)
    });
    $('#fe').onchange = () => t.refrescar(true);
    $('#nuevo').onclick = () => editarAnuncio({}, negocios, () => t.refrescar());
  }
});

// ---------- Guía de la ciudad ----------
async function editarLugar(l, listo) {
  const r = await pedir(l.id ? 'Modificar lugar' : 'Nuevo lugar', [
    { k: 'nombre', l: 'Nombre', w: 'full' }, { k: 'categoria', l: 'Categoría', t: 'select', op: CATS }, { k: 'orden', l: 'Orden', t: 'number' },
    { k: 'direccion', l: 'Dirección', w: 'full', ayuda: 'Se usa para "Ir en remís" y para ubicarlo en el mapa.' },
    { k: 'descripcion', l: 'Descripción', t: 'textarea', w: 'full' },
    { k: 'telefono', l: 'Teléfono' }, { k: 'horario', l: 'Horario', ph: 'Lun a vie 7 a 13' },
    { k: 'h24', l: 'Abre las 24 hs', t: 'select', op: [['false', 'No'], ['true', 'Sí']] }, { k: 'destacado', l: 'Destino más pedido', t: 'select', op: [['false', 'No'], ['true', 'Sí']] },
    { k: 'activo', l: 'Visible en la guía', t: 'select', op: [['true', 'Sí'], ['false', 'No (oculto)']] },
    { t: 'titulo', l: 'Ubicación exacta (opcional)' }, { k: 'lat', l: 'Latitud', ph: '-30.95…' }, { k: 'lng', l: 'Longitud', ph: '-58.78…' }
  ], { categoria: 'otros', orden: 0, ...l, h24: String(!!l.h24), destacado: String(!!l.destacado), activo: String(l.activo !== false) });
  if (!r) return;
  try {
    await api('r_guia_lugar_guardar', {}, { ...r, id: l.id || null, h24: r.h24 === 'true', destacado: r.destacado === 'true', activo: r.activo === 'true', orden: +r.orden || 0,
      lat: r.lat ? +String(r.lat).replace(',', '.') : null, lng: r.lng ? +String(r.lng).replace(',', '.') : null });
    toast('Lugar guardado', 'ok'); listo && listo();
  } catch (e) { fallo(e); }
}

ruta('guia-lugares', {
  titulo: 'Guía de la ciudad', roles: ['admin'], render(main) {
    main.innerHTML = cabecera('Guía de la ciudad', 'Lugares de referencia que aparecen en guia.html con el botón "Ir en remís". Los comercios de delivery activos se suman solos.', '<button class="btn" id="nuevo">+ Nuevo lugar</button>') + '<div class="card" id="tb"></div>';
    const t = tabla($('#tb'), {
      vacio: 'Todavía no cargaste lugares.',
      cols: [{ t: 'Orden', k: 'orden' }, { t: 'Lugar', f: l => `<b>${esc(l.nombre)}</b>${l.destacado ? ' ⭐' : ''}${l.h24 ? ' <small>24 hs</small>' : ''}<br><small>${esc((CATS.find(c => c[0] === l.categoria) || [, l.categoria])[1])}</small>` },
        { t: 'Dirección', f: l => l.direccion ? esc(l.direccion) : '<small style="color:var(--suave)">a confirmar</small>' }, { t: 'Teléfono', f: l => esc(l.telefono || '—') },
        { t: 'Visible', f: l => l.activo ? 'Sí' : 'No' }],
      cargar: () => api('r_guia_lugares'),
      acciones: l => [{ t: 'Modificar', ico: '✎', a: () => editarLugar(l, () => t.refrescar()) },
        { t: l.activo ? 'Ocultar' : 'Mostrar', ico: l.activo ? '🙈' : '👁', a: async () => { try { await api('r_guia_lugar_guardar', {}, { ...l, activo: !l.activo }); t.refrescar(); } catch (e) { fallo(e); } } },
        { t: 'Eliminar', ico: '🗑', a: async () => { if (await confirmar(`¿Eliminar "${l.nombre}" de la guía?`)) try { await api('r_guia_lugar_borrar', { id: l.id }); t.refrescar(); } catch (e) { fallo(e); } } }]
    });
    $('#nuevo').onclick = () => editarLugar({}, () => t.refrescar());
  }
});
})();
