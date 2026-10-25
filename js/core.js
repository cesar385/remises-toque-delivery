// Núcleo del panel: API, sesión, enrutador, componentes
const R = window.R = { rutas: {}, yo: null, cat: null, socket: null };

// ---------- utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const pesos = n => n == null || n === '' ? '—' : '$ ' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });
const num = (n, d = 0) => n == null ? '—' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: d, minimumFractionDigits: d });
const fechaCorta = s => s ? s.slice(8, 10) + '-' + s.slice(5, 7) + ' ' + s.slice(11, 16) : '—';
const fechaLarga = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) + (s.length > 10 ? ' ' + s.slice(11, 16) : '') : '—';
const hoyISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const diasAtras = n => { const d = new Date(Date.now() - n * 86400000); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ESTADOS_MOVIL = { disponible: ['Disponible', '#2f9e57'], confirmado: ['Confirmado', '#e8892b'], con_pasajero: ['Con pasajero', '#d64545'], en_parada: ['En parada', '#2f6fd6'], desconectado: ['Desconectado', '#8b9899'], fuera_servicio: ['Fuera de servicio', '#4b5556'], emergencia: ['EMERGENCIA', '#b0003a'] };
const ESTADO_VIAJE = { reserva: 'Reserva', pendiente: 'Pendiente', ofrecido: 'Ofrecido', confirmado: 'Confirmado', en_curso: 'En curso', finalizado: 'Finalizado', anulado: 'Anulado' };
const CANALES_ICO = { whatsapp: '🟢', instagram: '📷', facebook: '📘', telegram: '✈️', aplicacion: '📱', web: '🌐', operador: '🎧', movil: '🚕', centralita: '☎️' };
const estadoViaje = e => `<span class="estado e-${e}">${ESTADO_VIAJE[e] || e}</span>`;

// ---------- API ----------
async function api(url, opts = {}) {
  const metodo = opts.method || (opts.body ? 'POST' : 'GET');
  try { return await RODAR.llamar(url, metodo, opts.body, localStorage.getItem('rodar_token')); }
  catch (e) {
    if (e.status === 401 && !url.includes('/api/login')) { localStorage.removeItem('rodar_token'); R.yo = null; location.hash = '#/login'; }
    throw e;
  }
}
const qs = o => Object.entries(o).filter(([, v]) => v !== '' && v != null && v !== false).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
async function subir(file) { return RODAR.archivoADataURL(file); }
// Abre un documento guardado (las fotos se guardan como data:, que el navegador no deja abrir directo en otra pestaña)
function verArchivo(u) {
  if (!/^data:/.test(u || '')) return window.open(u, '_blank');
  const w = window.open('', '_blank');
  fetch(u).then(r => r.blob()).then(b => { const x = URL.createObjectURL(b); if (w) w.location = x; else location.href = x; }).catch(() => w && w.close());
}
const linkDoc = (d, t) => d.archivo ? `<a href="#" data-doc="${esc(d.archivo)}" onclick="verArchivo(this.dataset.doc);return false">${esc(t || d.tipo || 'Ver')}</a>` : esc(t ? '—' : d.tipo);
// descargas: CSV de informes e impresiones (PDF desde el diálogo de impresión)
async function descargar(url) {
  try {
    if (url.startsWith('/print/')) return imprimir(url);
    const u = new URL(url, 'http://x');
    if (u.searchParams.get('formato') === 'csv') {
      u.searchParams.delete('formato');
      let d = await api(u.pathname + '?' + u.searchParams.toString());
      if (d && !Array.isArray(d)) d = d.filas || d.puntos || [];
      return RODAR.csv(d, u.pathname.split('/').pop());
    }
    window.open(url, '_blank');
  } catch (e) { fallo(e); }
}
// ---------- toast / confirm ----------
function toast(msg, tipo = '') {
  let c = $('#toasts'); if (!c) { c = h('<div id="toasts"></div>'); document.body.append(c); }
  const t = h(`<div class="toast ${tipo}">${esc(msg)}</div>`); c.append(t);
  setTimeout(() => t.remove(), tipo === 'error' ? 5000 : 3000);
}
const fallo = e => toast(e.message || String(e), 'error');

// ---------- modal ----------
function modal({ titulo, cuerpo, botones = [], ancho = false, alCerrar }) {
  const f = h(`<div class="modal-fondo"><div class="modal ${ancho ? 'ancho' : ''}"><div class="mh"><h3>${esc(titulo)}</h3><button title="Cerrar">×</button></div><div class="mb"></div><div class="mf"></div></div></div>`);
  const mb = $('.mb', f);
  if (typeof cuerpo === 'string') mb.innerHTML = cuerpo; else if (cuerpo) mb.append(cuerpo);
  const cerrar = () => { f.remove(); alCerrar && alCerrar(); };
  $('.mh button', f).onclick = cerrar;
  f.addEventListener('mousedown', e => { if (e.target === f) cerrar(); });
  const mf = $('.mf', f);
  if (!botones.length) mf.remove();
  botones.forEach(b => {
    const el = h(`<button class="btn ${b.clase || ''}">${b.texto}</button>`);
    el.onclick = async () => { if (!b.accion) return cerrar(); el.disabled = true; try { const r = await b.accion(mb); if (r !== false) cerrar(); } catch (e) { fallo(e); } finally { el.disabled = false; } };
    mf.append(el);
  });
  document.body.append(f);
  const pi = $('input,select,textarea', mb); if (pi && !pi.readOnly) setTimeout(() => pi.focus(), 50);
  return { el: f, cuerpo: mb, cerrar };
}
function confirmar(texto, titulo = 'Confirmar') {
  return new Promise(res => modal({ titulo, cuerpo: `<p>${esc(texto)}</p>`, botones: [{ texto: 'Cancelar', clase: 'sec', accion: () => res(false) }, { texto: 'Confirmar', accion: () => res(true) }], alCerrar: () => res(false) }));
}
function pedir(titulo, campos, valores = {}) {
  return new Promise(res => {
    const f = formulario(campos, valores);
    let ok = false;
    modal({ titulo, cuerpo: f, botones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: 'Aceptar', accion: () => { ok = true; res(leer(f)); } }], alCerrar: () => !ok && res(null) });
  });
}

// ---------- formularios ----------
// campo: {k, l, t, op:[[v,l]], w:'flex'|'full', ph, min, max, step, ayuda}
function formulario(campos, v = {}) {
  const f = h('<div class="grid g2"></div>');
  campos.forEach(c => {
    if (c.t === 'titulo') { f.append(h(`<h4 style="grid-column:1/-1;margin:6px 0 0;color:var(--pri-2)">${esc(c.l)}</h4>`)); return; }
    if (c.t === 'html') { const d = h(`<div style="grid-column:1/-1">${c.html}</div>`); f.append(d); return; }
    const val = v[c.k] ?? c.def ?? '';
    let input;
    if (c.t === 'select') input = `<select name="${c.k}">${(c.op || []).map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
    else if (c.t === 'multi') input = `<div class="fila" data-multi="${c.k}">${(c.op || []).map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; const sel = (Array.isArray(val) ? val : String(val).split(',')).map(String).includes(String(ov)); return `<label class="check"><input type="checkbox" value="${esc(ov)}" ${sel ? 'checked' : ''}> ${esc(ol)}</label>`; }).join('')}</div>`;
    else if (c.t === 'check') input = `<label class="check"><input type="checkbox" name="${c.k}" ${val && val !== '0' ? 'checked' : ''}> ${esc(c.cl || '')}</label>`;
    else if (c.t === 'textarea') input = `<textarea name="${c.k}" placeholder="${esc(c.ph || '')}">${esc(val)}</textarea>`;
    else input = `<input type="${c.t || 'text'}" name="${c.k}" value="${esc(val)}" placeholder="${esc(c.ph || '')}" ${c.min != null ? `min="${c.min}"` : ''} ${c.max != null ? `max="${c.max}"` : ''} ${c.step ? `step="${c.step}"` : ''} ${c.ro ? 'readonly' : ''}>`;
    const d = h(`<div class="campo" ${c.w === 'full' ? 'style="grid-column:1/-1"' : ''}><label>${esc(c.l || '')}</label>${input}${c.ayuda ? `<small style="color:var(--suave)">${esc(c.ayuda)}</small>` : ''}</div>`);
    f.append(d);
  });
  return f;
}
function leer(el) {
  const o = {};
  $$('[name]', el).forEach(i => { o[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
  $$('[data-multi]', el).forEach(m => { o[m.dataset.multi] = $$('input:checked', m).map(x => x.value); });
  return o;
}

// ---------- tabla con paginado ----------
// cols: [{t:'Título', k:'campo'|f:(fila)=>html, c:'r'}]
function tabla(el, { cols, cargar, porPagina = 25, acciones, vacio = 'Sin registros', pie }) {
  let pagina = 0, total = 0, filas = [];
  el.innerHTML = `<div class="tabla-wrap"><table class="t"><thead><tr>${cols.map(c => `<th class="${c.c || ''}">${c.t}</th>`).join('')}${acciones ? '<th class="r">Acciones</th>' : ''}</tr></thead><tbody></tbody></table></div><div class="paginado"><span class="info"></span><span><select class="pp" style="width:auto;min-height:30px">${[10, 25, 50, 100].map(n => `<option ${n === porPagina ? 'selected' : ''}>${n}</option>`).join('')}</select> <button class="btn sec chico ant">Anterior</button> <button class="btn sec chico sig">Siguiente</button></span></div>`;
  const tb = $('tbody', el);
  async function refrescar() {
    tb.innerHTML = `<tr><td class="vacio" colspan="${cols.length + 1}">Cargando…</td></tr>`;
    try {
      const r = await cargar({ limite: porPagina, offset: pagina * porPagina });
      if (Array.isArray(r)) { filas = r; total = r.length; } else { filas = r.filas; total = r.total; }
      const vis = Array.isArray(r) ? filas.slice(pagina * porPagina, (pagina + 1) * porPagina) : filas;
      tb.innerHTML = vis.length ? '' : `<tr><td class="vacio" colspan="${cols.length + 1}">${vacio}</td></tr>`;
      vis.forEach(f => {
        const tr = h(`<tr>${cols.map(c => `<td class="${c.c || ''}">${c.f ? c.f(f) : esc(f[c.k] ?? '—')}</td>`).join('')}${acciones ? '<td class="r"><button class="btn-icono" title="Acciones">⋮</button></td>' : ''}</tr>`);
        if (acciones) { const b = $('.btn-icono', tr); b.onclick = e => menuAcciones(e, acciones(f), f._titulo); tr.oncontextmenu = e => { e.preventDefault(); menuAcciones(e, acciones(f)); }; }
        tb.append(tr);
      });
      $('.info', el).textContent = total ? `Mostrando ${pagina * porPagina + 1} a ${Math.min(total, (pagina + 1) * porPagina)} de ${total} registros` : '';
      $('.ant', el).disabled = pagina === 0; $('.sig', el).disabled = (pagina + 1) * porPagina >= total;
      if (pie) pie(r);
    } catch (e) { tb.innerHTML = `<tr><td class="vacio" colspan="${cols.length + 1}">${esc(e.message)}</td></tr>`; }
  }
  $('.ant', el).onclick = () => { pagina--; refrescar(); };
  $('.sig', el).onclick = () => { pagina++; refrescar(); };
  $('.pp', el).onchange = e => { porPagina = +e.target.value; pagina = 0; refrescar(); };
  refrescar();
  return { refrescar: (reset) => { if (reset) pagina = 0; return refrescar(); }, get filas() { return filas; } };
}
function tablaSimple(filas, cols, vacio = 'Sin registros') {
  return `<div class="tabla-wrap"><table class="t"><thead><tr>${cols.map(c => `<th class="${c.c || ''}">${c.t}</th>`).join('')}</tr></thead><tbody>${filas.length ? filas.map(f => `<tr>${cols.map(c => `<td class="${c.c || ''}">${c.f ? c.f(f) : esc(f[c.k] ?? '—')}</td>`).join('')}</tr>`).join('') : `<tr><td class="vacio" colspan="${cols.length}">${vacio}</td></tr>`}</tbody></table></div>`;
}

// ---------- menú de acciones ----------
function menuAcciones(e, items, titulo) {
  e.stopPropagation();
  let m = $('#menuAcc'); if (!m) { m = h('<div class="menu-acciones" id="menuAcc"></div>'); document.body.append(m); document.addEventListener('click', () => m.style.display = 'none'); }
  m.innerHTML = (titulo ? `<div class="tit">${esc(titulo)}</div>` : '') + items.filter(Boolean).map((it, i) => `<a data-i="${i}">${it.ico || ''} ${esc(it.t)}</a>`).join('');
  const lista = items.filter(Boolean);
  $$('a', m).forEach(a => a.onclick = () => { m.style.display = 'none'; lista[+a.dataset.i].a(); });
  m.style.display = 'block';
  const x = Math.min(e.clientX, innerWidth - m.offsetWidth - 8), y = Math.min(e.clientY, innerHeight - m.offsetHeight - 8);
  m.style.left = x + 'px'; m.style.top = y + 'px';
}

// ---------- permisos ----------
const tiene = (...roles) => R.yo && (R.yo.roles.includes('admin') || roles.some(r => R.yo.roles.includes(r)));

// ---------- navegación ----------
const ICO = {
  inicio: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 12h3v8h6v-6h2v6h6v-8h3z"/></svg>',
  soporte: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a9 9 0 0 0-9 9v6a3 3 0 0 0 3 3h2v-8H5v-1a7 7 0 0 1 14 0v1h-3v8h3v1h-6v2h6a2 2 0 0 0 2-2V11a9 9 0 0 0-9-9z"/></svg>',
  operador: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4zm8 0c-.3 0-.7 0-1.1.1 1.2.9 2.1 2.1 2.1 3.9v3h7v-3c0-2.7-5.3-4-8-4z"/></svg>',
  admin: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-1.7-1L15 3h-4l-.4 2.9a7 7 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7 7 0 0 0 1.7 1L11 21h4l.4-2.9a7 7 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>',
  informes: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h2v16H3zm4 8h2v8H7zm4-6h2v14h-2zm4 9h2v5h-2zm4-6h2v11h-2z"/></svg>',
  flota: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zm3.2-4-.9 3h9.4l-.9-3zM7.5 12.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm9 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg>',
  finanzas: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm.8 13.7V18h-1.6v-1.3c-1.2-.2-2.2-.8-2.6-1.9l1.4-.6c.3.7.9 1.1 1.8 1.1 1 0 1.5-.4 1.5-1 0-.7-.5-.9-1.8-1.3-1.4-.4-2.2-1-2.2-2.2 0-1 .7-1.8 1.9-2.1V7h1.6v1.3c1 .2 1.8.8 2.1 1.7l-1.4.6c-.2-.5-.6-.9-1.5-.9-.8 0-1.3.4-1.3.9 0 .6.5.8 1.7 1.2 1.5.5 2.3 1.1 2.3 2.3 0 1.1-.8 1.9-2 2.1z"/></svg>',
  menu: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>',
};
const LOGO = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#215181"/><circle cx="20" cy="20" r="11" fill="none" stroke="#fff" stroke-width="3"/><circle cx="20" cy="20" r="3.5" fill="#e8892b"/><path d="M20 9v7M20 24v7M9 20h7M24 20h7" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';

function construirNav() {
  const ventana = (ruta) => () => window.open('panel.html#/' + ruta, 'rodar_' + ruta, 'width=1400,height=900');
  const grupos = [
    { id: 'inicio', t: 'Inicio', ico: ICO.inicio, ir: 'dashboard' },
    { id: 'soporte', t: 'Soporte', ico: ICO.soporte, ir: 'soporte', roles: ['operador'] },
    {
      id: 'operador', t: 'Operador', ico: ICO.operador, roles: ['operador'], items: [
        { t: 'Chat & Telefonía', a: ventana('chat') }, { t: 'Mapa', a: ventana('mapa') }, { t: 'Mensaje a flota', a: () => mensajeFlota() },
        { t: 'Telefonía', a: ventana('telefonia') }, { t: 'Viajes', r: 'viajes' }, { t: 'Viajes reservas', r: 'viajes-reservas' },
      ]
    },
    {
      id: 'flota', t: 'Flota', ico: ICO.flota, roles: ['admin', 'gestion'], items: [
        { tit: '🚕 Móviles y conductores' }, { t: 'Móviles', r: 'moviles', roles: ['admin'] }, { t: 'Solicitudes conductor', r: 'solicitudes-conductor', roles: ['admin'] }, { t: 'Penalizados', r: 'moviles-penalizados' },
        { tit: '🗺 Zonas' }, { t: 'Zonas & Paradas', r: 'zonas-paradas', roles: ['admin'] }, { t: 'Zonas peligrosas', r: 'zonas-peligrosas', roles: ['admin'] },
      ]
    },
    {
      id: 'finanzas', t: 'Finanzas', ico: ICO.finanzas, roles: ['admin', 'gestion'], items: [
        { tit: '📒 Cuentas' }, { t: 'Cuentas', r: 'cuentas' }, { t: 'Planes', r: 'planes' },
        { tit: '💳 Cobros' }, { t: 'Pagos de base', r: 'mp-recargas' }, { t: 'Saldos Mercado Pago', r: 'saldos-mercadopago' }, { t: 'Viajes Mercado Pago', r: 'mp-viajes' }, { t: 'Medios de pago', r: 'medios-pago', roles: ['admin'] },
      ]
    },
    {
      id: 'admin', t: 'Configuración', ico: ICO.admin, roles: ['admin'], items: [
        { tit: '🚖 Servicio' }, { t: 'Tarifas', r: 'tarifas', roles: ['admin'] }, { t: 'Canales de solicitud', r: 'canales-solicitud', roles: ['admin'] }, { t: 'Días feriados', r: 'feriados', roles: ['admin'] }, { t: 'Documentación reguladora', r: 'documentacion-reguladora', roles: ['admin'] },
        { tit: '👥 Personas' }, { t: 'Usuarios', r: 'usuarios', roles: ['admin'] }, { t: 'Clientes corporativos', r: 'corporativos', roles: ['admin'] },
        { tit: '🧩 Plataforma' }, { t: 'Módulos de la plataforma', r: 'modulos', roles: ['admin'] }, { t: 'Configuración y demo', r: 'configuracion', roles: ['admin'] }, { t: 'Apps y enlaces (QR)', r: 'apps-enlaces', roles: ['admin'] }, { t: 'Página principal', r: 'pagina-principal', roles: ['admin'] },
      ]
    },
    {
      id: 'informes', t: 'Informes', ico: ICO.informes, roles: ['gestion', 'operador'], items: [
        { t: 'Acciones usuarios', r: 'acciones-usuarios', roles: ['gestion'] }, { t: 'Clientes bloqueados', r: 'clientes-bloqueados' }, { t: 'Clientes en baja', r: 'clientes-baja' },
        { t: 'Conductores', r: 'conductores', roles: ['gestion'] }, { t: 'Conectados', r: 'conectados', roles: ['admin'] }, { t: 'Estadísticas móviles', r: 'estadisticas-moviles', roles: ['gestion'] },
        { t: 'Eventos móviles', r: 'eventos-moviles', roles: ['gestion'] }, { t: 'Facturación del mes', r: 'facturacion-mes', roles: ['gestion'] }, { t: 'Histórico recorrido', r: 'recorrido' },
        { t: 'Horas por conductor', r: 'horas-conductores', roles: ['gestion'] }, { t: 'Informe mensual', r: 'informe-mensual', roles: ['gestion'] }, { t: 'Informe operadores', r: 'informe-operadores', roles: ['gestion'] },
        { t: 'Mapa de demanda', r: 'mapa-demanda' }, { t: 'Mapa calor conductores', r: 'calor-conductores', roles: ['gestion'] }, { t: 'Movimientos de móviles', r: 'movimientos-moviles', roles: ['gestion'] },
        { t: 'Negativos por móvil', r: 'negativos-movil' }, { t: 'Top 10', r: 'top10' }, { t: 'Viajes por móvil', r: 'viajes-por-movil', roles: ['gestion'] },
      ]
    },
    {
      id: 'menu', t: 'Menú', ico: ICO.menu, items: [
        { t: 'Pagar base', a: () => cargarSaldo(), roles: ['titular', 'conductor'] }, { t: 'Mi cuenta', r: 'mi-cuenta', roles: ['titular'] }, { t: 'Mi rendimiento', r: 'mi-rendimiento', roles: ['conductor'] },
        { t: 'Mis vehículos', r: 'mis-vehiculos', roles: ['titular'] }, { t: 'Mis viajes', r: 'mis-viajes', roles: ['titular', 'conductor', 'corporativo'] }, { t: 'Recorrido de mis móviles', r: 'recorrido', roles: ['titular'] },
        { t: 'Top 10', r: 'top10' }, { sep: 1 }, { t: 'App de conductores', a: () => window.open('conductor.html') }, { t: 'Pedido web de pasajeros', a: () => window.open('pasajero.html') },
      ]
    },
  ];
  const nav = $('.nav'); nav.innerHTML = '';
  const visible = x => !x.roles || tiene(...x.roles);
  R.grupoDe = {}; R.atajos = [];
  grupos.filter(visible).forEach(g => {
    const it = h(`<div class="item" data-g="${g.id}"><button>${g.ico}<span>${g.t}</span></button></div>`);
    if (g.ir) R.grupoDe[g.ir] = g.t;
    if (g.items) {
      const dd = h('<div class="dropdown"></div>'), lista = g.items.filter(visible);
      const cant = lista.filter(x => x.t).length;
      // menús largos: buscador y varias columnas, con títulos de sección
      if (cant > 9) { dd.classList.add('mega'); const bq = h(`<div class="dd-busca"><input type="search" placeholder="Buscar en ${esc(g.t)}…" aria-label="Buscar en ${esc(g.t)}"></div>`); dd.append(bq);
        const inp = $('input', bq); inp.onclick = e => e.stopPropagation();
        inp.oninput = () => { const q = inp.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); $$('a', dd).forEach(a => a.style.display = !q || a.textContent.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) ? '' : 'none'); $$('.dd-tit', dd).forEach(t => t.style.display = q ? 'none' : ''); };
        inp.onkeydown = e => { if (e.key === 'Enter') { const a = $$('a', dd).find(x => x.style.display !== 'none'); if (a) a.click(); } }; }
      const cols = h('<div class="dd-cols"></div>'); dd.append(cols);
      lista.forEach(x => {
        if (x.sep) return cols.append(h('<div class="sep"></div>'));
        if (x.tit) return cols.append(h(`<div class="dd-tit">${esc(x.tit)}</div>`));
        const a = h(`<a>${esc(x.t)}${x.r ? '' : '<span class="ext" title="Se abre en otra ventana">↗</span>'}</a>`);
        if (x.r) { a.dataset.r = x.r; R.grupoDe[x.r] = g.t; }
        const go = () => { cerrarMenus(); document.body.classList.remove('menu-abierto'); x.r ? ir(x.r) : x.a(); };
        a.onclick = go; R.atajos.push({ t: x.t, g: g.t, go });
        cols.append(a);
      });
      if (!cant) return;
      it.append(dd);
      $('button', it).onclick = e => { e.stopPropagation(); const ab = it.classList.contains('abierto'); cerrarMenus(); if (!ab) { it.classList.add('abierto'); const i = $('.dd-busca input', it); if (i && innerWidth > 980) { i.value = ''; i.oninput(); setTimeout(() => i.focus(), 30); } } };
    } else { R.atajos.push({ t: g.t, g: '', go: () => ir(g.ir) }); }
    if (g.ir) $('button', it).onclick = () => { document.body.classList.remove('menu-abierto'); ir(g.ir); };
    nav.append(it);
  });
  // usuario
  const u = R.yo;
  const ini = (u.nombre[0] + (u.apellido || ' ')[0]).toUpperCase();
  const us = h(`<div class="item" style="margin-left:auto"><button class="usuario-btn">${u.foto ? `<img src="${esc(u.foto)}">` : `<span class="avatar">${ini}</span>`}<span>${esc(u.nombre + ' ' + (u.apellido || ''))}</span></button>
    <div class="dropdown" style="left:auto;right:0"><a data-r="ayuda">Centro de ayuda</a><a data-r="mis-reportes">Mis reportes <span class="badge ${u.reportesAbiertos ? '' : 'gris'}">${u.reportesAbiertos || 0}</span></a><a data-x="pass">Cambiar contraseña</a><a data-r="perfil">Editar perfil</a><div class="sep"></div><a data-x="salir">Salir</a></div></div>`);
  $('button', us).onclick = e => { e.stopPropagation(); const ab = us.classList.contains('abierto'); cerrarMenus(); if (!ab) us.classList.add('abierto'); };
  $$('a[data-r]', us).forEach(a => a.onclick = () => { cerrarMenus(); ir(a.dataset.r); });
  $('a[data-x=pass]', us).onclick = () => { cerrarMenus(); cambiarPassword(); };
  $('a[data-x=salir]', us).onclick = async () => { try { await api('/api/logout', { body: {} }); } catch { } localStorage.removeItem('rodar_token'); R.yo = null; location.hash = '#/login'; location.reload(); };
  nav.append(us);
}
function cerrarMenus() { $$('.nav .item.abierto').forEach(x => x.classList.remove('abierto')); }
document.addEventListener('click', cerrarMenus);

function rutaActual() { return (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'dashboard'; }
function paramsRuta() { return new URLSearchParams(location.hash.split('?')[1] || ''); }
function ir(ruta, reemplazar) {
  const url = '#/' + ruta;
  if (location.hash === url) return render();
  if (reemplazar) { history.replaceState({}, '', url); render(); } else location.hash = url;
}
window.addEventListener('hashchange', render);

const PANTALLA_COMPLETA = ['mapa', 'telefonia', 'chat'];
async function render() {
  let ruta = rutaActual();
  if (!RODAR.listo) return pantallaConfig();
  if (ruta === 'login') return pantallaLogin();
  if (!localStorage.getItem('rodar_token')) return ir('login', true);
  if (R.rutaRender && R.rutaRender !== ruta && (PANTALLA_COMPLETA.includes(ruta) || PANTALLA_COMPLETA.includes(R.rutaRender))) { location.reload(); return; }
  R.rutaRender = ruta;
  if (!R.yo) {
    try { R.yo = await api('/api/me'); R.cat = await api('/api/catalogos'); } catch (e) { if (e.status !== 401) { document.body.innerHTML = `<div class="login"><div class="caja"><h2>No se pudo conectar</h2><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reintentar</button></div></div>`; } return; }
    conectarSocket();
  }
  const def = R.rutas[ruta];
  if (PANTALLA_COMPLETA.includes(ruta)) { document.body.innerHTML = ''; return def.render(document.body); }
  if (!$('.topbar')) {
    document.body.innerHTML = `<header class="topbar"><button class="burger">☰</button><a class="marca" href="#/dashboard" title="Remises TOQUE!"><img src="img/logo-blanco.png" alt="Remises TOQUE!"></a><nav class="nav"></nav><button class="ir-a" title="Buscar una pantalla (Ctrl+K)">🔎<span>Buscar pantalla</span><kbd>Ctrl K</kbd></button></header><main id="main"></main>
    <button class="asistente-btn" title="Asistente">💬</button><div class="asistente"><div class="fh">Asistente de ayuda <span style="cursor:pointer" class="x">×</span></div><div class="lista"><div class="burbuja">Hola ${esc(R.yo.nombre)} 👋 ¿En qué te ayudo? Preguntame por cualquier pantalla (ej.: "cómo cargo un feriado").</div></div><form><input placeholder="Escribí tu pregunta…"><button class="btn">→</button></form></div>`;
    $('.marca').onclick = e => { e.preventDefault(); ir('dashboard'); };
    $('.burger').onclick = e => { e.stopPropagation(); document.body.classList.toggle('menu-abierto'); };
    construirNav(); iniciarAsistente();
    $('.ir-a').onclick = e => { e.stopPropagation(); paletaIrA(); };
  }
  marcarActivo(ruta);
  const main = $('#main');
  if (!def) { main.innerHTML = '<div class="card"><div class="body">Pantalla no encontrada.</div></div>'; return; }
  if (def.roles && !tiene(...def.roles)) { main.innerHTML = '<div class="card"><div class="body">No tenés permiso para esta pantalla.</div></div>'; return; }
  document.title = (def.titulo || 'Remises TOQUE!') + ' · Remises TOQUE!';
  main.innerHTML = '';
  window.scrollTo(0, 0);
  try { await def.render(main); } catch (e) { console.error(e); main.innerHTML = `<div class="card"><div class="body">Error: ${esc(e.message)}</div></div>`; }
}
function ruta(nombre, def) { R.rutas[nombre] = def; }
// Marca en la barra el grupo y la opción de la pantalla actual
function marcarActivo(r) {
  $$('.nav .item').forEach(it => it.classList.toggle('act', !!($(`a[data-r="${r}"]`, it) || (it.dataset.g === 'inicio' && r === 'dashboard') || (it.dataset.g === 'soporte' && r === 'soporte'))));
  $$('.nav a[data-r]').forEach(a => a.classList.toggle('act', a.dataset.r === r));
}
// Buscador de pantallas (Ctrl+K): escribís parte del nombre y Enter
function paletaIrA() {
  if ($('.paleta')) return;
  const f = h(`<div class="paleta-fondo"><div class="paleta"><input type="search" placeholder="¿A qué pantalla querés ir? (ej: tarifas, viajes, cuentas…)" aria-label="Buscar pantalla"><div class="pl"></div><div class="pp">↑ ↓ para elegir · Enter para abrir · Esc para cerrar</div></div></div>`);
  document.body.append(f);
  const inp = $('input', f), pl = $('.pl', f); let sel = 0, res = [];
  const norm = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const pintar = () => { const q = norm(inp.value.trim()); res = (R.atajos || []).filter(x => !q || norm(x.t + ' ' + x.g).includes(q)).slice(0, 12); sel = Math.min(sel, Math.max(0, res.length - 1));
    pl.innerHTML = res.length ? res.map((x, i) => `<a data-i="${i}" class="${i === sel ? 'on' : ''}"><b>${esc(x.t)}</b>${x.g ? `<small>${esc(x.g)}</small>` : ''}</a>`).join('') : '<div class="pv">No hay pantallas con ese nombre.</div>';
    $$('a', pl).forEach(a => a.onclick = () => abrir(+a.dataset.i)); };
  const cerrar = () => f.remove();
  const abrir = i => { const x = res[i]; cerrar(); if (x) x.go(); };
  inp.oninput = () => { sel = 0; pintar(); };
  inp.onkeydown = e => { if (e.key === 'ArrowDown') { sel = Math.min(res.length - 1, sel + 1); pintar(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); pintar(); e.preventDefault(); } else if (e.key === 'Enter') abrir(sel); else if (e.key === 'Escape') cerrar(); };
  f.onclick = e => { if (e.target === f) cerrar(); };
  pintar(); inp.focus();
}
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K') && $('.topbar')) { e.preventDefault(); paletaIrA(); } });
function cabecera(titulo, desc, botones = '') {
  const g = R.grupoDe && R.grupoDe[rutaActual()], miga = g && g !== titulo ? `<div class="miga">${esc(g)} <span>›</span> ${esc(titulo)}</div>` : '';
  return `<div class="cabecera"><div>${miga}<h1>${esc(titulo)}</h1>${desc ? `<p>${desc}</p>` : ''}</div><div class="fila">${botones}</div></div>`;
}

// ---------- socket ----------
function conectarSocket() {
  R.socket = RODAR.tiempoReal(R.yo.canal, ['panel', 'radio']);
  R.socket.on('aviso', d => toast(d.texto));
  R.socket.on('emergencia', d => { toast(`🚨 EMERGENCIA móvil ${d.movil} (${d.conductor})`, 'error'); try { const a = new AudioContext(); const o = a.createOscillator(); o.frequency.value = 900; o.connect(a.destination); o.start(); setTimeout(() => { o.stop(); a.close(); }, 1200); } catch { } });
  // latido: mantiene el despacho, el simulador y las horas de conexión aunque no haya pg_cron
  setInterval(() => { if (document.visibilityState !== 'hidden' || PANTALLA_COMPLETA.includes(rutaActual())) api('/api/tick', { body: {} }).catch(() => { }); }, 5000);
  if (R.cat.empresa && R.cat.empresa.lat) { RODAR.clima(R.cat.empresa.lat, R.cat.empresa.lng, localStorage.getItem('rodar_token')); setInterval(() => RODAR.clima(R.cat.empresa.lat, R.cat.empresa.lng, localStorage.getItem('rodar_token')), 15 * 60000); }
}
function pantallaConfig() {
  document.body.innerHTML = `<div class="login"><div class="caja" style="max-width:560px"><div style="width:52px">${LOGO}</div><h1>Falta conectar la base de datos</h1>
    <p>Editá el archivo <b>config.js</b> del repositorio y completá la <b>URL</b> y la <b>clave anon (public)</b> de tu proyecto de Supabase (Project Settings → API). Después hacé commit y recargá esta página.</p>
    <p style="color:var(--suave)">Los pasos completos están en el README.</p></div></div>`;
}

// ---------- acciones globales ----------
async function mensajeFlota() {
  const r = await pedir('Mensaje a la flota', [{ k: 'texto', l: 'Mensaje para todos los móviles conectados', t: 'textarea', w: 'full' }]);
  if (r && r.texto) { try { await api('/api/flota/mensaje', { body: r }); toast('Mensaje enviado a la flota', 'ok'); } catch (e) { fallo(e); } }
}
async function cambiarPassword() {
  const r = await pedir('Cambiar contraseña', [{ k: 'actual', l: 'Contraseña actual', t: 'password', w: 'full' }, { k: 'nueva', l: 'Nueva contraseña', t: 'password' }, { k: 'repetir', l: 'Confirmar nueva contraseña', t: 'password' }]);
  if (!r) return;
  if (r.nueva !== r.repetir) return toast('Las contraseñas no coinciden', 'error');
  try { await api('/api/me/password', { body: r }); toast('Contraseña actualizada', 'ok'); } catch (e) { fallo(e); }
}
async function cargarSaldo() {
  const ms = R.yo.moviles || [];
  if (!ms.length) return toast('No tenés móviles asociados', 'error');
  const r = await pedir('Pagar base', [{ k: 'movil_id', l: 'Móvil', t: 'select', op: ms.map(m => [m.id, 'Móvil ' + m.numero]) }]);
  if (!r) return;
  let b; try { b = await api('/api/base?movil_id=' + r.movil_id); } catch (e) { return fallo(e); }
  const r2 = await pedir('Pagar base · Móvil ' + b.numero, [{ k: 'monto', l: `Monto ($) · ${b.texto}. Saldo ${b.saldo}${b.deuda > 0 ? ', debe ' + b.deuda : ''}`, t: 'number', min: 1 }], { monto: Math.ceil(b.sugerido || b.cuota || 0) || '' });
  if (!r2) return;
  try {
    // Billeteras que la central habilitó (Administración → Medios de pago). Si hay una sola, no se pregunta.
    let provs = []; try { provs = await api('/api/pagos/proveedores'); } catch { /* base sin SQL 31: queda Mercado Pago */ }
    if (!provs.length) provs = [{ codigo: 'mercadopago', nombre: 'Mercado Pago', api: true }];
    let prov = provs[0];
    if (provs.length > 1) {
      const r3 = await pedir('¿Con qué billetera pagás?', [{ k: 'p', l: 'Billetera', t: 'select', op: provs.map(p => [p.codigo, p.nombre]) }]);
      if (!r3) return;
      prov = provs.find(p => p.codigo === r3.p) || provs[0];
    }
    // Mercado Pago y Ualá se cobran y acreditan solos si la función "pagos" está instalada; si no, o para el resto, se transfiere al alias de la central.
    if (prov.api) {
      try { const y = await RODAR.pagoCrear(localStorage.getItem('rodar_token'), +r2.monto, +r.movil_id, prov.codigo); window.open(y.url, '_blank'); return; }
      catch (er) { if (!er.noConectado) return fallo(er); }
    }
    const x = await api('/api/cargar-saldo', { body: { movil_id: r.movil_id, monto: r2.monto, proveedor: prov.codigo } });
    const alias = x.alias || (prov.codigo === 'mercadopago' ? b.alias || 'danderfertcesar.mp' : ''); // el alias de ejemplo solo se usa con Mercado Pago
    if (!alias && !x.link) return toast(`La central todavía no cargó el alias de ${prov.nombre}. Avisale para que lo cargue.`, 'error');
    const abrir = x.link || (prov.codigo === 'mercadopago' ? 'https://www.mercadopago.com.ar/' : '');
    modal({ titulo: 'Transferí desde ' + prov.nombre, cuerpo: `${alias ? `<p>Hacé una transferencia por <b>$${esc(String(r2.monto))}</b> al alias:</p><p style="font-size:22px;font-weight:700;user-select:all">${esc(alias)}</p>` : `<p>Pagá <b>$${esc(String(r2.monto))}</b> con el link de pago.</p>`}<p>${esc(x.mensaje || '')}</p>`, botones: [abrir && { texto: x.link ? 'Abrir link de pago' : 'Abrir ' + prov.nombre, accion: () => window.open(abrir, '_blank') }, { texto: 'Listo' }].filter(Boolean) });
  } catch (e) { fallo(e); }
}
const pagarBase = cargarSaldo;

// ---------- login ----------
function pantallaLogin() {
  document.title = 'Ingreso de operadores · Remises TOQUE!';
  document.body.innerHTML = `<div class="login login-op"><form class="caja"><div style="text-align:center"><img src="img/logo.png" alt="Remises TOQUE!" style="width:220px;max-width:80%"></div>
    <div class="rol-etiqueta">🎧 Operadores y administración</div>
    <p style="color:var(--suave);margin:6px 0 16px;text-align:center">Ingresá con tu usuario de la central.</p>
    <div class="campo" style="margin-bottom:10px"><label>Usuario o documento</label><input name="usuario" autocomplete="username" autocapitalize="none" required></div>
    <div class="campo" style="margin-bottom:12px"><label>Contraseña</label><input name="password" type="password" autocomplete="current-password" required></div>
    <div class="login-err" id="lerr"></div>
    <button class="btn" style="width:100%;justify-content:center">Ingresar</button>
    <div class="otros-ingresos"><span>¿No sos de la central?</span><a href="conductor.html">🚕 Soy conductor</a><a href="pasajero.html">🙂 Soy pasajero</a><a href="index.html">🏠 Página principal</a></div></form></div>`;
  const err = m => { const e = $('#lerr'); e.textContent = m || ''; e.style.display = m ? 'block' : 'none'; };
  $('form').onsubmit = async e => {
    e.preventDefault(); err('');
    try {
      const r = await api('/api/login', { body: leer(e.target) });
      const roles = r.usuario.roles || [];
      if (!roles.some(x => !['conductor', 'corporativo'].includes(x))) {
        try { await RODAR.llamar('/api/logout', 'POST', {}, r.token); } catch { }
        return err(roles.includes('conductor') ? 'Este usuario es de conductor. Ingresá desde la app de conductores.' : 'Este usuario es de una empresa. Ingresá desde el pedido web de pasajeros (botón Empresas).');
      }
      localStorage.setItem('rodar_token', r.token);
      R.yo = null; location.hash = '#/dashboard'; location.reload();
    } catch (er) { err(/incorrect/i.test(er.message) ? 'El usuario o la contraseña no coinciden.' : er.message); }
  };
}

// ---------- mapa base ----------
function mapaBase(el, opts = {}) {
  const e = (R.cat && R.cat.empresa) || { lat: -34.6, lng: -58.4 };
  const m = L.map(el, { zoomControl: true, ...opts }).setView([e.lat, e.lng], opts.zoom || 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  return m;
}
function iconoMovil(numero, color) {
  return L.divIcon({ className: '', html: `<div class="marcador-movil" style="background:${color}">${numero}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
}
function iconoPunto(color) { return L.divIcon({ className: '', html: `<div class="marcador-viaje" style="background:${color}"></div>`, iconSize: [22, 22], iconAnchor: [11, 22] }); }

// Dibujo de polígonos simple (clic agrega vértice; vértices arrastrables)
function editorPoligono(mapa, puntos = [], color = '#215181') {
  const st = { puntos: puntos.map(p => [...p]), marcadores: [], capa: null, activo: true };
  function dibujar() {
    st.capa && st.capa.remove(); st.marcadores.forEach(x => x.remove()); st.marcadores = [];
    if (st.puntos.length) st.capa = L.polygon(st.puntos, { color, weight: 2, fillOpacity: .25 }).addTo(mapa);
    st.puntos.forEach((p, i) => {
      const mk = L.marker(p, { draggable: true, icon: L.divIcon({ className: '', html: '<div style="width:12px;height:12px;background:#fff;border:2px solid ' + color + ';border-radius:2px"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }) }).addTo(mapa);
      mk.on('drag', ev => { st.puntos[i] = [ev.latlng.lat, ev.latlng.lng]; st.capa.setLatLngs(st.puntos); });
      mk.on('contextmenu', () => { if (st.goma || true) { st.puntos.splice(i, 1); dibujar(); } });
      mk.on('click', () => { if (st.goma) { st.puntos.splice(i, 1); dibujar(); } });
      st.marcadores.push(mk);
    });
  }
  const clic = ev => { if (st.activo && !st.goma) { st.puntos.push([ev.latlng.lat, ev.latlng.lng]); dibujar(); } };
  mapa.on('click', clic);
  dibujar();
  return { get puntos() { return st.puntos; }, goma(v) { st.goma = v; }, limpiar() { st.puntos = []; dibujar(); }, quitar() { mapa.off('click', clic); st.capa && st.capa.remove(); st.marcadores.forEach(x => x.remove()); } };
}

// ---------- asistente (búsqueda en guías) ----------
function iniciarAsistente() {
  const box = $('.asistente');
  $('.asistente-btn').onclick = () => box.classList.toggle('abierto');
  $('.x', box).onclick = () => box.classList.remove('abierto');
  $('form', box).onsubmit = e => {
    e.preventDefault();
    const inp = $('input', box); const q = inp.value.trim(); if (!q) return;
    const lista = $('.lista', box);
    lista.append(h(`<div class="burbuja mia">${esc(q)}</div>`));
    const res = buscarAyuda(q);
    lista.append(h(`<div class="burbuja">${res.length ? res.slice(0, 3).map(g => `<b>${esc(g.titulo)}</b><br>${esc(g.resumen)}${g.ruta ? `<br><a href="#" data-r="${g.ruta}">Abrir pantalla →</a>` : ''}`).join('<hr style="border:0;border-top:1px solid #eee">') : 'No encontré una guía para eso. Probá con otras palabras o abrí el Centro de ayuda.'}</div>`));
    $$('a[data-r]', lista).forEach(a => a.onclick = ev => { ev.preventDefault(); PANTALLA_COMPLETA.includes(a.dataset.r) ? window.open('panel.html#/' + a.dataset.r) : ir(a.dataset.r); });
    inp.value = ''; lista.scrollTop = 1e6;
  };
}
function buscarAyuda(q) {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const pal = norm(q).split(/\W+/).filter(p => p.length > 2 && !['como', 'para', 'que', 'donde', 'una', 'los', 'las', 'del'].includes(p));
  return (window.GUIAS || []).map(g => {
    const txt = norm(g.titulo + ' ' + g.resumen + ' ' + g.preguntas.map(p => p[0] + ' ' + p[1]).join(' '));
    return { ...g, score: pal.reduce((s, p) => s + (txt.includes(p) ? (norm(g.titulo).includes(p) ? 3 : 1) : 0), 0) };
  }).filter(g => g.score > 0).sort((a, b) => b.score - a.score);
}

document.addEventListener('DOMContentLoaded', render);
