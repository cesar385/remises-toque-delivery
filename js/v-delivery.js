// Delivery: negocios, categorías, pedidos, cambios de menú, pagos a comercios y configuración (clon del módulo Delivery de CabGo).
// Llama directo a las funciones r_dlv_… de Supabase (sql/30_delivery.sql).
(function () {
const dapi = async (fn, q, b) => {
try { return await RODAR.rpc(fn, localStorage.getItem('rodar_token'), q || {}, b === undefined ? {} : b); }
catch (e) { if (e.status === 401) { localStorage.removeItem('rodar_token'); location.hash = '#/login'; } throw e; }
};
window.dapi = dapi;
const D = window.DLV = { cfg: null };
async function cfg(recargar) { if (!D.cfg || recargar) { const r = await dapi('r_dlv_config'); D.cfg = r.config; D.negocios = r.negocios; D.pend = (r.pendientes_menu || 0) + (r.pendientes_negocio || 0); } return D.cfg; }

const EST_NEG = { pendiente: ['Pendiente', '#e8892b'], activo: ['Activo', '#2f9e57'], suspendido: ['Suspendido', '#d64545'], cerrado: ['Cerrado', '#8b9899'] };
const EST_PED = { pendiente: ['Pendiente', '#e8892b'], confirmado: ['Confirmado', '#2f6fd6'], preparando: ['Preparando', '#7a4fd6'], listo: ['Listo', '#0e9aa7'], recogido: ['Recogido', '#215181'], en_camino: ['En camino', '#215181'], cancelacion_solicitada: ['Cancelación solicitada', '#b0003a'], entregado: ['Entregado', '#2f9e57'], cancelado: ['Cancelado', '#8b9899'] };
const MEDIOS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', billetera: 'Billetera', transferencia: 'Transferencia / otro', b2b: 'Empresa (B2B)', vale: 'Vale corporativo' };
const TIPOS = { app: 'App', express: 'Express', directo: 'Envío directo' };
const pillE = (map, e) => { const x = map[e] || [e, '#8b9899']; return `<span class="pill" style="background:${x[1]}1f;color:${x[1]};border:1px solid ${x[1]}55;font-weight:600">${esc(x[0])}</span>`; };
const img = (src, t = 40, r = 8) => src ? `<img src="${esc(src)}" style="width:${t}px;height:${t}px;object-fit:cover;border-radius:${r}px;vertical-align:middle">` : `<span style="display:inline-grid;place-items:center;width:${t}px;height:${t}px;border-radius:${r}px;background:#e8eef3;color:#8b9899;vertical-align:middle">🏪</span>`;
const vacio = (ico, tit, txt, extra = '') => `<div class="dlv-vacio"><div class="ico">${ico}</div><b>${esc(tit)}</b><p>${esc(txt)}</p>${extra}</div>`;

// ---------- estilos propios del módulo ----------
document.head.append(h(`<style>
.dlv-vacio{text-align:center;padding:42px 16px;color:var(--suave)}.dlv-vacio .ico{font-size:40px;margin-bottom:6px}.dlv-vacio b{display:block;color:inherit;font-size:16px;color:#1d2a2b;margin-bottom:4px}
.dlv-filtros{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 14px}.dlv-filtros>*{width:auto}.dlv-filtros input[type=search]{flex:1;min-width:180px}
.dlv-cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;padding:14px}.dlv-cat{border:1px solid #e3e9ec;border-radius:12px;padding:14px;display:flex;gap:12px;align-items:center;background:#fff}
.dlv-cat .t{flex:1;min-width:0}.dlv-cat small{color:var(--suave);display:block}
.dlv-sec{border:1px solid #e3e9ec;border-radius:12px;background:#fff;margin-bottom:14px}.dlv-sec>.hd{padding:14px 16px;border-bottom:1px solid #eef2f3}.dlv-sec>.hd h3{margin:0;font-size:16px}.dlv-sec>.hd p{margin:4px 0 0;color:var(--suave);font-size:13px}
.dlv-sec>.bd{padding:6px 16px 14px}.dlv-op{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f4f5}.dlv-op:last-child{border-bottom:0}
.dlv-op .tx{flex:1}.dlv-op .tx b{display:block;font-weight:600}.dlv-op .tx small{color:var(--suave);display:block;margin-top:2px;line-height:1.4}.dlv-op .ctl{flex:0 0 auto;min-width:120px;text-align:right}.dlv-op .ctl input,.dlv-op .ctl select{width:170px}
.dlv-sw{position:relative;display:inline-block;width:44px;height:24px}.dlv-sw input{opacity:0;width:0;height:0}.dlv-sw span{position:absolute;inset:0;background:#c9d3d6;border-radius:24px;transition:.2s;cursor:pointer}.dlv-sw span:before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
.dlv-sw input:checked+span{background:#2f9e57}.dlv-sw input:checked+span:before{transform:translateX(20px)}
.dlv-chip{display:inline-flex;align-items:center;gap:6px;background:#eef3f8;border-radius:16px;padding:3px 10px;margin:2px;font-size:13px}.dlv-chip button{border:0;background:none;cursor:pointer;color:#8b9899}
.dlv-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}
.dlv-items td{padding:6px 4px}.dlv-tl{border-left:2px solid #dfe6e9;margin:6px 0 0 6px;padding-left:12px}.dlv-tl div{position:relative;padding:4px 0;font-size:13px}.dlv-tl div:before{content:'';position:absolute;left:-18px;top:9px;width:10px;height:10px;border-radius:50%;background:#215181}
.dlv-tl small{color:var(--suave);margin-right:6px}.dlv-map{height:240px;border-radius:10px;margin-top:6px;border:1px solid #e3e9ec}
.dlv-sug{position:absolute;z-index:1000;background:#fff;border:1px solid #dfe6e9;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);max-height:220px;overflow:auto;left:0;right:0}.dlv-sug a{display:block;padding:8px 10px;cursor:pointer;font-size:13px}.dlv-sug a:hover{background:#eef3f8}
.dlv-prod{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #f1f4f5}.dlv-prod .t{flex:1}.dlv-prod small{color:var(--suave)}
.dlv-codigo{font-family:monospace;font-size:18px;font-weight:700;letter-spacing:2px;background:#eef3f8;padding:2px 8px;border-radius:6px}
</style>`));

// ---------- menú de la barra superior ----------
const ICO_DLV = '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zm-9-1a2 2 0 0 1 4 0v1h-4zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2z"/></svg>';
const navOriginal = construirNav;
construirNav = function () {
navOriginal();
if (!tiene('admin', 'gestion', 'operador')) return;
const items = [{ tit: '📦 Operación' }, { t: 'Tablero de pedidos', r: 'dlv-tablero' }, { t: 'Pedidos', r: 'dlv-pedidos' }, { t: 'Negocios', r: 'dlv-negocios' }, { t: 'Categorías', r: 'dlv-categorias' },
{ tit: '💰 Aprobaciones y pagos' }, { t: 'Cambios de menú', r: 'dlv-cambios', roles: ['admin'], si: 'aprob' }, { t: 'Pagos a comercios', r: 'dlv-pagos', roles: ['admin', 'gestion'], si: 'pagos_comercios' },
{ tit: '🔗 Portales' }, { t: 'Portal de comercios', a: () => window.open('comercio.html') }, { t: 'Portal de repartidores', a: () => window.open('repartidor.html') }, { t: 'Pedido web de delivery', a: () => window.open('delivery.html') }];
const it = h(`<div class="item" data-g="delivery"><button>${ICO_DLV}<span>Delivery</span></button><div class="dropdown"><div class="dd-cols"></div></div></div>`);
const cols = $('.dd-cols', it);
const pintar = () => {
cols.innerHTML = '';
items.filter(x => !x.roles || tiene(...x.roles)).forEach(x => {
if (x.si && D.cfg && !(x.si === 'aprob' ? (D.cfg.aprob_menu || D.cfg.aprob_negocio || D.pend) : D.cfg[x.si])) return;
if (x.sep) return cols.append(h('<div class="sep"></div>'));
if (x.tit) return cols.append(h(`<div class="dd-tit">${esc(x.tit)}</div>`));
const a = h(`<a>${esc(x.t)}${x.r ? '' : '<span class="ext">↗</span>'}${x.r === 'dlv-cambios' && D.pend ? ` <span class="badge">${D.pend}</span>` : ''}</a>`);
if (x.r) { a.dataset.r = x.r; R.grupoDe[x.r] = 'Delivery'; }
const go = () => { cerrarMenus(); document.body.classList.remove('menu-abierto'); x.r ? ir(x.r) : x.a(); };
a.onclick = go; if (!R.atajos.some(y => y.t === x.t && y.g === 'Delivery')) R.atajos.push({ t: x.t, g: 'Delivery', go });
cols.append(a);
});
marcarActivo(rutaActual());
};
pintar();
$('button', it).onclick = e => { e.stopPropagation(); const ab = it.classList.contains('abierto'); cerrarMenus(); if (!ab) it.classList.add('abierto'); };
const nav = $('.nav'), usuario = $$('.nav > .item').pop();
nav.insertBefore(it, usuario);
cfg().then(pintar).catch(() => { });
if (R.socket) R.socket.on('dlv_pedido', d => { (D.oyentes || []).forEach(f => { try { f(d); } catch { } }); });
};
const oir = f => { D.oyentes = [f]; };

// ---------- buscador de direcciones con mapa ----------
// v: {dir, lat, lng}. Devuelve { get valor(), mapa }
function selectorDireccion(cont, v = {}, ph = 'Buscar dirección…') {
cont.innerHTML = `<div style="position:relative"><input class="dlv-dir" placeholder="${esc(ph)}" value="${esc(v.dir || '')}" autocomplete="off"><div class="dlv-sug" style="display:none"></div></div><div class="dlv-map"></div><small style="color:var(--suave)">Tocá el mapa o arrastrá el marcador para ajustar el punto exacto.</small>`;
const inp = $('.dlv-dir', cont), sug = $('.dlv-sug', cont), st = { dir: v.dir || '', lat: v.lat ?? null, lng: v.lng ?? null };
let m = null, mk = null;
setTimeout(() => {
m = mapaBase($('.dlv-map', cont), { zoom: 14 });
const poner = (lat, lng, centrar) => { st.lat = lat; st.lng = lng; if (!mk) { mk = L.marker([lat, lng], { draggable: true }).addTo(m); mk.on('dragend', ev => { const p = ev.target.getLatLng(); poner(p.lat, p.lng); inversa(p.lat, p.lng); }); } else mk.setLatLng([lat, lng]); if (centrar) m.setView([lat, lng], 16); };
const inversa = async (lat, lng) => { try { const r = await RODAR.geoInversa(lat, lng); st.dir = r.direccion; inp.value = r.direccion; } catch { } };
st.poner = poner;
if (st.lat != null) poner(+st.lat, +st.lng, true);
m.on('click', ev => { poner(ev.latlng.lat, ev.latlng.lng); inversa(ev.latlng.lat, ev.latlng.lng); });
setTimeout(() => m.invalidateSize(), 200);
}, 30);
let tm;
inp.oninput = () => { st.dir = inp.value; clearTimeout(tm); tm = setTimeout(async () => {
const q = inp.value.trim(); if (q.length < 3) return sug.style.display = 'none';
let r = []; try { r = await RODAR.geoBuscar(q); } catch { }
if (D.cfg && D.cfg.zonas_busqueda && R.cat && R.cat.zonas) R.cat.zonas.filter(z => z.nombre && z.nombre.toLowerCase().includes(q.toLowerCase())).forEach(z => { const c = centro(z.poligono); if (c) r.unshift({ direccion: z.nombre, localidad: 'Zona', lat: c[0], lng: c[1] }); });
sug.innerHTML = r.slice(0, 8).map((x, i) => `<a data-i="${i}">${esc(x.direccion)} <small style="color:var(--suave)">${esc(x.localidad || '')}</small></a>`).join('') || '<a>Sin resultados</a>';
sug.style.display = 'block';
$$('a[data-i]', sug).forEach(a => a.onclick = () => { const x = r[+a.dataset.i]; inp.value = st.dir = x.direccion + (x.localidad && x.localidad !== 'Zona' ? ', ' + x.localidad : ''); sug.style.display = 'none'; st.poner && st.poner(x.lat, x.lng, true); cont.dispatchEvent(new Event('cambio')); });
}, 350); };
inp.onblur = () => setTimeout(() => sug.style.display = 'none', 200);
return { get valor() { return { dir: st.dir, lat: st.lat, lng: st.lng }; } };
}
function centro(pol) { try { const p = typeof pol === 'string' ? JSON.parse(pol) : pol; if (!p || !p.length) return null; return [p.reduce((s, x) => s + +x[0], 0) / p.length, p.reduce((s, x) => s + +x[1], 0) / p.length]; } catch { return null; } }

// ---------- CSV / Excel ----------
function leerCSV(texto) {
const sep = (texto.split('\n')[0].match(/;/g) || []).length >= (texto.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
const filas = []; let f = [], c = '', q = false;
for (let i = 0; i < texto.length; i++) { const ch = texto[i];
if (q) { if (ch === '"' && texto[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
else if (ch === '"') q = true; else if (ch === sep) { f.push(c); c = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && texto[i + 1] === '\n') i++; f.push(c); filas.push(f); f = []; c = ''; } else c += ch; }
if (c || f.length) { f.push(c); filas.push(f); }
const cab = (filas.shift() || []).map(x => x.replace(/^﻿/, '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_'));
return filas.filter(r => r.some(x => x.trim())).map(r => Object.fromEntries(cab.map((k, i) => [k, (r[i] || '').trim()])));
}
function elegirArchivo(acepta) { return new Promise(res => { const i = h(`<input type="file" accept="${acepta}" style="display:none">`); document.body.append(i); i.onchange = () => { res(i.files[0]); i.remove(); }; i.click(); }); }

// ================= NEGOCIOS =================
ruta('dlv-negocios', {
titulo: 'Negocios', roles: ['admin', 'gestion', 'operador'], async render(main) {
await cfg().catch(() => { });
main.innerHTML = cabecera('Negocios', 'Administra los negocios registrados en la plataforma de delivery', (tiene('admin') ? '<button class="btn" id="nuevo">+ Crear Negocio</button><button class="btn sec" id="mas" title="Importar / Exportar">⋮</button>' : '')) +
`<div class="card"><div class="dlv-filtros"><select id="fe"><option value="">Todos</option>${Object.entries(EST_NEG).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select>
<input type="search" id="fb" placeholder="Buscar negocio…"><select id="fs"><option value="">Todos los saldos</option><option value="positivo">Saldo positivo</option><option value="negativo">Saldo negativo</option><option value="cero">Saldo en cero</option></select></div></div>
<div class="card"><div class="head"><h3>🏪 Negocios <small id="cant" style="color:var(--suave)"></small></h3></div><div id="tb"></div><div id="demo"></div></div>`;
let ultimo = null;
const t = tabla($('#tb'), {
vacio: 'No se encontraron negocios con los filtros seleccionados.',
cols: [{ t: '', f: n => img(n.logo) }, { t: 'Negocio', f: n => `<b>${esc(n.nombre)}</b>${n.demo ? ' <span class="pill">demo</span>' : ''}${n.tiene_cambio ? ' <span class="pill" style="background:#fff3e0">cambios por aprobar</span>' : ''}<br><small>${esc(n.direccion || 'Sin dirección')}</small>` },
{ t: 'Categoría', f: n => esc(n.categoria || '—') }, { t: 'Contacto', f: n => `${esc(n.telefono || '—')}<br><small>${esc(n.email || '')}</small>` },
{ t: 'Estado', f: n => pillE(EST_NEG, n.estado) + (n.estado === 'activo' ? `<br><small style="color:${n.abierto ? 'var(--verde)' : 'var(--suave)'}">${n.abierto ? 'Abierto' : 'Cerrado ahora'}</small>` : '') },
{ t: 'Pedidos', c: 'r', k: 'pedidos' }, { t: 'Saldo', c: 'r', f: n => `<b style="color:${n.saldo < 0 ? 'var(--rojo)' : n.saldo > 0 ? 'var(--verde)' : 'inherit'}">${pesos(n.saldo)}</b>` }],
cargar: async p => { const r = await dapi('r_dlv_negocios', { ...p, estado: $('#fe').value, buscar: $('#fb').value, saldo: $('#fs').value }); ultimo = r; pintarDemo(r); $('#cant').textContent = `(${r.total})`; return r; },
acciones: n => [{ t: 'Ver detalle', ico: '👁', a: () => ir('dlv-negocio?id=' + n.id) },
tiene('admin') && { t: 'Editar', ico: '✎', a: () => editarNegocio(n, () => t.refrescar()) },
tiene('admin') && { t: 'Cambiar estado', ico: '⇄', a: () => cambiarEstado(n, () => t.refrescar()) },
tiene('admin') && { t: 'Eliminar', ico: '🗑', a: async () => { if (await confirmar(`¿Eliminar el negocio ${n.nombre}? Se borran sus productos, usuarios y movimientos.`)) { try { await dapi('r_dlv_negocio_borrar', { id: n.id }); toast('Negocio eliminado', 'ok'); t.refrescar(); } catch (e) { fallo(e); } } } }],
});
function pintarDemo(r) {
const d = $('#demo'); if (!tiene('admin')) return d.innerHTML = '';
if (!r.hay) d.innerHTML = `<div class="body" style="text-align:center;border-top:1px solid #eef2f3;color:var(--suave)"><p>¿Querés ver cómo se ve el módulo? Cargá contenido de demo con negocios, productos y categorías de ejemplo. Podrás eliminarlo después en su conjunto.</p><button class="btn sec" id="cdemo">🧪 Cargar contenido de demo</button></div>`;
else if (r.demo) d.innerHTML = `<div class="body" style="text-align:right;border-top:1px solid #eef2f3"><button class="btn sec chico" id="bdemo">Eliminar contenido de demo</button></div>`;
else d.innerHTML = '';
const c = $('#cdemo'); if (c) c.onclick = async () => { try { await dapi('r_dlv_demo', {}, { accion: 'cargar' }); toast('Contenido de demo cargado', 'ok'); t.refrescar(true); } catch (e) { fallo(e); } };
const b = $('#bdemo'); if (b) b.onclick = async () => { if (await confirmar('¿Eliminar todos los negocios, productos, categorías y pedidos de demo?')) { await dapi('r_dlv_demo', {}, { accion: 'borrar' }); toast('Demo eliminada', 'ok'); t.refrescar(true); } };
}
let tb; $('#fb').oninput = () => { clearTimeout(tb); tb = setTimeout(() => t.refrescar(true), 300); };
$('#fe').onchange = $('#fs').onchange = () => t.refrescar(true);
if (tiene('admin')) {
$('#nuevo').onclick = () => editarNegocio({}, () => t.refrescar());
$('#mas').onclick = e => menuAcciones(e, [
{ t: 'Exportar a Excel (CSV)', ico: '⬇', a: async () => { const r = await dapi('r_dlv_negocios', { limite: 10000 }); RODAR.csv(r.filas.map(n => ({ id: n.id, nombre: n.nombre, categoria: n.categoria, telefono: n.telefono, email: n.email, direccion: n.direccion, localidad: n.localidad, lat: n.lat, lng: n.lng, cuit: n.cuit, estado: n.estado, pedido_minimo: n.pedido_minimo, comision_pct: n.comision_pct, saldo: n.saldo, pedidos: n.pedidos })), 'negocios'); } },
{ t: 'Importar desde Excel (CSV)', ico: '⬆', a: async () => { const f = await elegirArchivo('.csv,text/csv'); if (!f) return; try { const filas = leerCSV(await f.text()); if (!filas.length) return toast('El archivo no tiene filas', 'error'); const r = await dapi('r_dlv_negocios_importar', {}, { filas }); toast(`Importados: ${r.nuevos} nuevos, ${r.actualizados} actualizados`, 'ok'); t.refrescar(true); } catch (e) { fallo(e); } } },
{ t: 'Descargar plantilla', ico: '📄', a: () => RODAR.csv([{ nombre: 'Mi negocio', categoria: 'Restaurantes', telefono: '3454000000', email: 'negocio@ejemplo.com', direccion: 'San Martín 100', localidad: 'Federal', lat: '', lng: '', cuit: '', estado: 'activo', pedido_minimo: '', comision_pct: '' }], 'plantilla_negocios') },
], 'Importar / Exportar');
}
}
});

async function cambiarEstado(n, listo) {
const r = await pedir('Estado de ' + n.nombre, [{ k: 'estado', l: 'Estado', t: 'select', op: Object.entries(EST_NEG).map(([k, v]) => [k, v[0]]) }], { estado: n.estado });
if (r) try { await dapi('r_dlv_negocio_estado', {}, { id: n.id, estado: r.estado }); toast('Estado actualizado', 'ok'); listo && listo(); } catch (e) { fallo(e); }
}

async function editarNegocio(n, listo) {
const cats = await dapi('r_dlv_categorias');
const nuevo = !n.id;
const cuerpo = h('<div></div>');
const f = formulario([
{ k: 'nombre', l: 'Nombre del negocio *', w: 'full', ph: 'Nombre del negocio' }, { k: 'telefono', l: 'Teléfono *', ph: 'Número de teléfono' }, { k: 'email', l: 'Email *', t: 'email', ph: 'negocio@ejemplo.com' },
{ k: 'categoria_id', l: 'Categoría', t: 'select', op: [['', 'Sin categoría'], ...cats.map(c => [c.id, c.nombre])] }, { k: 'localidad', l: 'Localidad' },
{ t: 'html', html: '<div class="campo"><label>Dirección</label><div id="ndir"></div></div>' },
{ k: 'cuit', l: 'Identificación fiscal (CUIT / CUIL)' }, { k: 'banco', l: 'Banco' }, { k: 'cuenta', l: 'Cuenta bancaria (CBU / CVU / alias)' },
{ k: 'tipo_cuenta', l: 'Tipo de cuenta', t: 'select', op: [['', 'Seleccioná…'], ['corriente', 'Cuenta Corriente'], ['ahorro', 'Caja de Ahorro']] }, { k: 'cedula_rep', l: 'DNI del representante legal' },
...(nuevo ? [{ t: 'html', html: '<p style="color:var(--suave);margin:0">El propietario y los usuarios del negocio se gestionan desde el detalle del negocio, en la pestaña “Usuarios”.</p>' }] : []),
], n);
cuerpo.append(f);
const sd = selectorDireccion($('#ndir', f), { dir: n.direccion, lat: n.lat, lng: n.lng });
modal({ titulo: nuevo ? 'Crear Negocio' : 'Editar negocio', ancho: true, cuerpo, botones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: nuevo ? 'Crear Negocio' : '💾 Guardar', clase: 'verde', accion: async () => {
const d = leer(f), v = sd.valor;
const r = await dapi('r_dlv_negocio_guardar', {}, { ...d, id: n.id, direccion: v.dir, lat: v.lat, lng: v.lng, categoria_id: d.categoria_id || null });
toast(nuevo ? 'Negocio creado' : 'Negocio guardado', 'ok'); D.cfg = null; listo && listo(r.id);
} }] });
}

// ---------- detalle del negocio ----------
ruta('dlv-negocio', {
titulo: 'Detalle del negocio', roles: ['admin', 'gestion', 'operador'], async render(main) {
const id = +paramsRuta().get('id');
let n, tab = paramsRuta().get('tab') || 'info';
const adm = tiene('admin');
async function cargar() { n = await dapi('r_dlv_negocio', { id }); pintar(); }
function pintar() {
main.innerHTML = cabecera(n.nombre, `${pillE(EST_NEG, n.estado)} ${esc(n.categoria || 'Sin categoría')} · ${esc(n.direccion || 'sin dirección')}`, '<button class="btn sec" id="vol">← Negocios</button>' + (adm ? '<button class="btn sec" id="est">⇄ Estado</button><button class="btn" id="edi">✎ Editar</button>' : '')) +
(n.cambio_pendiente && adm ? `<div class="nota alerta"><b>El comercio pidió cambios en su perfil:</b> ${esc(Object.entries(n.cambio_pendiente).filter(([k]) => k !== 'logo' && k !== 'horario').map(([k, v]) => k + ': ' + v).join(' · ') || 'logo u horario')} <button class="btn chico verde" id="apc">Aprobar</button> <button class="btn chico rojo" id="rec">Rechazar</button></div>` : '') +
`<div class="dlv-kpis"><div class="kpi"><div class="l">Saldo</div><div class="v" style="color:${n.saldo < 0 ? 'var(--rojo)' : 'inherit'}">${pesos(n.saldo)}</div><small>${n.saldo >= 0 ? 'A favor del comercio' : 'Adeuda a la plataforma'}</small></div><div class="kpi"><div class="l">Pedidos</div><div class="v">${n.stats.pedidos}</div><small>${n.stats.entregados} entregados · ${n.stats.cancelados} cancelados</small></div><div class="kpi"><div class="l">Ventas entregadas</div><div class="v">${pesos(n.stats.ventas)}</div></div><div class="kpi"><div class="l">Comisiones</div><div class="v">${pesos(n.stats.comisiones)}</div></div></div>
<div class="tabs">${[['info', 'Información'], ['menu', 'Menú'], ['usuarios', 'Usuarios'], ['pedidos', 'Pedidos'], ['saldo', 'Saldo'], ['ajustes', 'Configuración']].map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'act' : ''}">${l}</button>`).join('')}</div><div id="tp"></div>`;
$('#vol').onclick = () => ir('dlv-negocios');
if (adm) { $('#edi').onclick = () => editarNegocio(n, cargar); $('#est').onclick = () => cambiarEstado(n, cargar);
const ap = $('#apc'); if (ap) { ap.onclick = async () => { await dapi('r_dlv_negocio_cambio', {}, { id, aprobar: true }); toast('Cambios aprobados', 'ok'); cargar(); }; $('#rec').onclick = async () => { await dapi('r_dlv_negocio_cambio', {}, { id, aprobar: false }); cargar(); }; } }
$$('.tabs button', main).forEach(b => b.onclick = () => { tab = b.dataset.t; $$('.tabs button', main).forEach(x => x.classList.toggle('act', x === b)); pestaña(); });
pestaña();
}
function pestaña() {
const p = $('#tp');
if (tab === 'info') {
p.innerHTML = `<div class="grid g2"><div class="card"><div class="head"><h3>Datos</h3></div><div class="body">${img(n.logo, 64, 12)}
<table class="t" style="margin-top:10px">${[['Teléfono', n.telefono], ['Email', n.email], ['Dirección', n.direccion], ['Localidad', n.localidad], ['CUIT', n.cuit], ['Banco', n.banco], ['Cuenta', n.cuenta], ['Tipo de cuenta', n.tipo_cuenta], ['Representante', n.cedula_rep], ['Alta', fechaLarga(n.creado)]].map(([a, b]) => `<tr><td style="color:var(--suave)">${a}</td><td>${esc(b || '—')}</td></tr>`).join('')}</table></div></div>
<div class="card"><div class="head"><h3>Ubicación</h3></div><div class="body"><div class="dlv-map" id="mp" style="height:300px"></div></div></div></div>`;
if (n.lat) setTimeout(() => { const m = mapaBase($('#mp')); m.setView([n.lat, n.lng], 16); L.marker([n.lat, n.lng]).addTo(m); }, 30); else $('#mp').outerHTML = '<p style="color:var(--suave)">Sin ubicación cargada.</p>';
} else if (tab === 'menu') pestañaMenu(p);
else if (tab === 'usuarios') {
p.innerHTML = `<div class="card"><div class="head"><h3>Usuarios del negocio</h3>${adm ? '<button class="btn chico" id="nu">+ Agregar usuario</button>' : ''}</div>${tablaSimple(n.usuarios, [{ t: 'Nombre', k: 'nombre' }, { t: 'Email', k: 'email' }, { t: 'Teléfono', k: 'telefono' }, { t: 'Rol', f: u => u.rol === 'propietario' ? 'Propietario' : 'Empleado' }, { t: 'Habilitado', f: u => u.habilitado ? 'SI' : 'NO' }, { t: '', f: u => adm ? `<button class="btn-icono" data-e="${u.id}">✎</button><button class="btn-icono" data-b="${u.id}">🗑</button>` : '' }], 'Sin usuarios. Agregá al propietario para que pueda entrar al portal de comercios.')}
<div class="body" style="color:var(--suave);font-size:13px">Los usuarios entran en <b>comercio.html</b> con su email y contraseña: ven los pedidos, los aceptan, marcan “listo” y piden repartidor.</div></div>`;
const ed = async u => { const r = await pedir(u.id ? 'Editar usuario' : 'Nuevo usuario del negocio', [{ k: 'nombre', l: 'Nombre' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'telefono', l: 'Teléfono' }, { k: 'rol', l: 'Rol', t: 'select', op: [['propietario', 'Propietario'], ['empleado', 'Empleado']] }, { k: 'password', l: u.id ? 'Nueva contraseña (opcional)' : 'Contraseña', t: 'text' }, ...(u.id ? [{ k: 'habilitado', t: 'check', cl: 'Habilitado' }] : [])], u);
if (r) try { await dapi('r_dlv_usuario_guardar', {}, { ...r, id: u.id, negocio_id: id }); toast('Usuario guardado', 'ok'); cargar(); } catch (e) { fallo(e); } };
if (adm) { $('#nu').onclick = () => ed({ rol: n.usuarios.length ? 'empleado' : 'propietario', email: n.usuarios.length ? '' : n.email });
$$('[data-e]', p).forEach(b => b.onclick = () => ed(n.usuarios.find(u => u.id === +b.dataset.e)));
$$('[data-b]', p).forEach(b => b.onclick = async () => { if (await confirmar('¿Quitar este usuario?')) { await dapi('r_dlv_usuario_borrar', { id: +b.dataset.b }); cargar(); } }); }
} else if (tab === 'pedidos') {
p.innerHTML = '<div class="card" id="tbp"></div>';
tabla($('#tbp'), { cols: colsPedidos(false), cargar: q => dapi('r_dlv_pedidos', { ...q, negocio: id }), acciones: x => accionesPedido(x, () => cargar()) });
} else if (tab === 'saldo') {
p.innerHTML = `<div class="card"><div class="head"><h3>Movimientos · saldo ${pesos(n.saldo)}</h3>${tiene('admin', 'gestion') ? '<button class="btn chico" id="aj">± Ajuste</button><button class="btn chico verde" id="pg">Registrar pago al comercio</button>' : ''}</div>
${tablaSimple(n.movimientos, [{ t: 'Fecha', f: m => fechaCorta(m.fecha) }, { t: 'Tipo', f: m => `<span class="pill">${esc(m.tipo)}</span>` }, { t: 'Detalle', f: m => esc(m.detalle || '') + (m.usuario ? ` <small>· ${esc(m.usuario)}</small>` : '') }, { t: 'Monto', c: 'r', f: m => `<b style="color:${m.monto < 0 ? 'var(--rojo)' : 'var(--verde)'}">${pesos(m.monto)}</b>` }], 'Sin movimientos')}
<div class="body" style="color:var(--suave);font-size:13px">Positivo: la plataforma le debe al comercio (cobró el repartidor). Negativo: el comercio adeuda envíos o comisiones.</div></div>`;
const mov = async tipo => { const r = await pedir(tipo === 'pago' ? 'Registrar pago al comercio' : 'Ajuste de saldo', [{ k: 'monto', l: tipo === 'pago' ? 'Monto pagado ($)' : 'Monto ($, negativo para descontar)', t: 'number' }, { k: 'detalle', l: 'Detalle', w: 'full' }], { monto: tipo === 'pago' ? Math.max(0, n.saldo) : '' }); if (r) try { await dapi('r_dlv_movimiento', {}, { ...r, tipo, negocio_id: id }); toast('Movimiento registrado', 'ok'); cargar(); } catch (e) { fallo(e); } };
const aj = $('#aj'); if (aj) { aj.onclick = () => mov('ajuste'); $('#pg').onclick = () => mov('pago'); }
} else if (tab === 'ajustes') pestañaAjustes(p);
}
function pestañaMenu(p) {
const sinCat = n.items.filter(x => !x.menu_cat_id || !n.menu.some(c => c.id === x.menu_cat_id));
const grupo = (c, lista) => `<div class="card"><div class="head"><h3>${esc(c ? c.nombre : 'Sin categoría')} <small style="color:var(--suave)">(${lista.length})</small></h3>${c && adm ? `<button class="btn-icono" data-ec="${c.id}">✎</button><button class="btn-icono" data-bc="${c.id}">🗑</button>` : ''}</div><div class="body">${lista.map(x => `<div class="dlv-prod">${img(x.imagen, 48)}<div class="t"><b>${esc(x.nombre)}</b>${!x.aprobado ? ' <span class="pill" style="background:#fff3e0">por aprobar</span>' : ''}${x.cambio ? ' <span class="pill" style="background:#fff3e0">cambio pendiente</span>' : ''}${!x.disponible ? ' <span class="pill">no disponible</span>' : ''}<br><small>${esc(x.descripcion || '')}</small></div><div style="text-align:right">${x.precio_promo ? `<s style="color:var(--suave)">${pesos(x.precio)}</s><br><b>${pesos(x.precio_promo)}</b>` : `<b>${pesos(x.precio)}</b>`}</div>${adm ? `<button class="btn-icono" data-ep="${x.id}">✎</button><button class="btn-icono" data-bp="${x.id}">🗑</button>` : ''}</div>`).join('') || '<p style="color:var(--suave)">Sin productos.</p>'}</div></div>`;
p.innerHTML = (adm ? `<div class="fila" style="margin-bottom:10px"><button class="btn" id="np">+ Producto</button><button class="btn sec" id="nc">+ Categoría de menú</button>${D.cfg && D.cfg.carga_masiva ? '<button class="btn sec" id="im">⬆ Carga masiva (Excel/CSV)</button><button class="btn sec" id="pl">Plantilla</button>' : ''}</div>` : '') +
n.menu.map(c => grupo(c, n.items.filter(x => x.menu_cat_id === c.id))).join('') + (sinCat.length || !n.menu.length ? grupo(null, sinCat) : '');
if (!adm) return;
const edC = async c => { const r = await pedir(c.id ? 'Editar categoría de menú' : 'Nueva categoría de menú', [{ k: 'nombre', l: 'Nombre' }, { k: 'orden', l: 'Orden', t: 'number' }], c); if (r) { await dapi('r_dlv_menucat_guardar', {}, { ...r, id: c.id, negocio_id: id }); cargar(); } };
$('#nc').onclick = () => edC({ orden: n.menu.length + 1 });
$('#np').onclick = () => editarProducto({ negocio_id: id, disponible: true }, n.menu, cargar);
const im = $('#im'); if (im) { im.onclick = async () => { const f = await elegirArchivo('.csv,text/csv'); if (!f) return; try { const r = await dapi('r_dlv_productos_importar', {}, { negocio_id: id, filas: leerCSV(await f.text()) }); toast(r.importados + ' productos importados', 'ok'); cargar(); } catch (e) { fallo(e); } };
$('#pl').onclick = () => RODAR.csv([{ categoria: 'Pizzas', nombre: 'Muzzarella', descripcion: 'Grande', precio: 7000, precio_promo: '' }], 'plantilla_productos'); }
$$('[data-ec]', p).forEach(b => b.onclick = () => edC(n.menu.find(c => c.id === +b.dataset.ec)));
$$('[data-bc]', p).forEach(b => b.onclick = async () => { if (await confirmar('¿Eliminar la categoría? Los productos quedan sin categoría.')) { await dapi('r_dlv_menucat_borrar', { id: +b.dataset.bc }); cargar(); } });
$$('[data-ep]', p).forEach(b => b.onclick = () => editarProducto(n.items.find(x => x.id === +b.dataset.ep), n.menu, cargar));
$$('[data-bp]', p).forEach(b => b.onclick = async () => { if (await confirmar('¿Eliminar el producto?')) { await dapi('r_dlv_producto_borrar', { id: +b.dataset.bp }); cargar(); } });
}
function pestañaAjustes(p) {
const hor = n.horario || {};
const DIAS7 = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']];
const sv = (arr, k) => (arr || D.cfg[k] || []).includes('entrega');
const f = formulario([
{ t: 'titulo', l: 'Pedidos' }, { k: 'vehiculo_defecto', l: 'Vehículo del reparto (por defecto)', t: 'select', op: [['', 'El de su rubro'], ['cualquiera', 'Cualquiera (moto o auto)'], ['moto', '🏍 Moto'], ['auto', '🚗 Auto']] }, { k: 'tiempo_prep', l: 'Tiempo de preparación / armado (min)', t: 'number' }, { k: 'pedido_minimo', l: 'Pedido mínimo ($)', t: 'number' }, { k: 'radio_km', l: `Radio de entrega (km, vacío = ${D.cfg.radio_km} por defecto)`, t: 'number', step: '0.1' }, { k: 'retiro_local', t: 'check', cl: 'Permite retiro en el local' },
{ t: 'titulo', l: 'Comisiones (vacío = valor por defecto)' }, { k: 'comision_pct', l: `Comisión al negocio % (defecto ${D.cfg.comision_negocio})`, t: 'number', step: '0.1' }, { k: 'comision_rep_pct', l: `Comisión al repartidor % (defecto ${D.cfg.comision_repartidor})`, t: 'number', step: '0.1' },
{ k: 'calendario_pago', l: 'Calendario de pagos', t: 'select', op: [['ninguno', 'Ninguno'], ['semanal', 'Semanal'], ['quincenal', 'Quincenal'], ['mensual', 'Mensual']] },
{ t: 'titulo', l: 'Vidriera' }, { k: 'descripcion', l: 'Descripción', t: 'textarea', w: 'full' }, { k: 'orden', l: 'Orden en la app', t: 'number' }, { k: 'destacado', t: 'check', cl: 'Destacado' },
{ t: 'html', html: '<div class="campo"><label>Logo</label><input type="file" id="flogo" accept="image/*"></div>' },
{ t: 'titulo', l: 'Servicios' }, { k: 'sv_neg', t: 'check', cl: 'Entrega · para solicitar repartidor (desde el negocio)' }, { k: 'sv_cli', t: 'check', cl: 'Entrega · para pedidos de cliente (delivery)' },
{ t: 'titulo', l: 'Horario (vacío = siempre abierto)' },
{ t: 'html', html: `<table class="t">${DIAS7.map(([d, l]) => `<tr><td>${l}</td><td><input type="time" data-hd="${d}" value="${(hor[d] || [])[0] || ''}" style="width:auto"> a <input type="time" data-hh="${d}" value="${(hor[d] || [])[1] || ''}" style="width:auto"></td></tr>`).join('')}</table>` },
], { ...n, sv_neg: sv(n.servicios_negocio, 'servicios_negocio'), sv_cli: sv(n.servicios_cliente, 'servicios_cliente') });
p.innerHTML = '<div class="card"><div class="body" id="fa"></div><div style="padding:0 14px 14px;text-align:right"><button class="btn verde" id="ga">💾 Guardar configuración</button></div></div>';
$('#fa').append(f);
if (!adm) { $('#ga').remove(); return; }
$('#ga').onclick = async () => {
const d = leer(f); const horario = {}; let alguno = false;
DIAS7.forEach(([x]) => { const a = $(`[data-hd="${x}"]`, f).value, b = $(`[data-hh="${x}"]`, f).value; if (a && b) { horario[x] = [a, b]; alguno = true; } });
const fl = $('#flogo', f).files[0]; if (fl) d.logo = (await subir(fl)).archivo;
const body = { id, nombre: n.nombre, tiempo_prep: d.tiempo_prep, pedido_minimo: d.pedido_minimo, radio_km: d.radio_km, retiro_local: d.retiro_local, comision_pct: d.comision_pct, comision_rep_pct: d.comision_rep_pct, calendario_pago: d.calendario_pago, descripcion: d.descripcion, orden: d.orden, destacado: d.destacado, horario: alguno ? horario : null, servicios_negocio: d.sv_neg ? ['entrega'] : [], servicios_cliente: d.sv_cli ? ['entrega'] : [] };
if (d.logo) body.logo = d.logo;
try { await dapi('r_dlv_negocio_guardar', {}, body); await dapi('r_dlv_negocio_vehiculo', {}, { id, vehiculo: d.vehiculo_defecto || '' }); toast('Configuración guardada', 'ok'); cargar(); } catch (e) { fallo(e); }
};
}
await cfg();
await cargar();
}
});

async function editarProducto(x, menu, listo) {
const f = formulario([{ k: 'nombre', l: 'Nombre', w: 'full' }, { k: 'descripcion', l: 'Descripción', t: 'textarea', w: 'full' }, { k: 'precio', l: 'Precio ($)', t: 'number' }, { k: 'precio_promo', l: 'Precio promocional ($, opcional)', t: 'number' },
{ k: 'menu_cat_id', l: 'Categoría de menú', t: 'select', op: [['', 'Sin categoría'], ...menu.map(c => [c.id, c.nombre])] }, { k: 'orden', l: 'Orden', t: 'number' }, { k: 'disponible', t: 'check', cl: 'Disponible' },
{ t: 'html', html: `<div class="campo"><label>Imagen</label>${x.imagen ? img(x.imagen, 56) : ''}<input type="file" id="fimg" accept="image/*"></div>` }], x);
modal({ titulo: x.id ? 'Editar producto' : 'Nuevo producto', ancho: true, cuerpo: f, botones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: '💾 Guardar', clase: 'verde', accion: async () => {
const d = leer(f); const fi = $('#fimg', f).files[0]; if (fi) d.imagen = (await subir(fi)).archivo;
await dapi('r_dlv_producto_guardar', {}, { ...d, id: x.id, negocio_id: x.negocio_id, menu_cat_id: d.menu_cat_id || null }); toast('Producto guardado', 'ok'); listo && listo();
} }] });
}

// ================= CATEGORÍAS =================
ruta('dlv-categorias', {
titulo: 'Categorías de Negocios', roles: ['admin', 'gestion', 'operador'], render(main) {
main.innerHTML = cabecera('Categorías de Negocios', 'Administra las categorías disponibles para los negocios de delivery', tiene('admin') ? '<button class="btn" id="nueva">+ Nueva Categoría</button>' : '') + '<div class="card"><div class="head"><h3>🏷 Categorías <small id="cc" style="color:var(--suave)"></small></h3></div><div id="lc"></div></div>';
async function cargar() {
const cs = await dapi('r_dlv_categorias');
$('#cc').textContent = `(${cs.length})`;
$('#lc').innerHTML = cs.length ? `<div class="dlv-cats">${cs.map(c => `<div class="dlv-cat">${c.icono ? img(c.icono, 48, 10) : '<span style="font-size:30px">🏷</span>'}<div class="t"><b>${esc(c.nombre)}</b>${c.demo ? ' <span class="pill">demo</span>' : ''}<small>${esc(c.descripcion || 'Sin descripción')}</small><small>${c.negocios} negocio${c.negocios === 1 ? '' : 's'}</small></div>${tiene('admin') ? `<button class="btn-icono" data-e="${c.id}">✎</button><button class="btn-icono" data-b="${c.id}">🗑</button>` : ''}</div>`).join('')}</div>`
: vacio('🏷', 'Sin categorías', 'Aún no hay categorías creadas. Crea la primera.', tiene('admin') ? '<button class="btn" id="nueva2">+ Nueva Categoría</button>' : '');
const n2 = $('#nueva2'); if (n2) n2.onclick = () => editar({});
$$('[data-e]', main).forEach(b => b.onclick = () => editar(cs.find(c => c.id === +b.dataset.e)));
$$('[data-b]', main).forEach(b => b.onclick = async () => { if (await confirmar('¿Eliminar la categoría? Los negocios quedan sin categoría.')) { await dapi('r_dlv_categoria_borrar', { id: +b.dataset.b }); cargar(); } });
}
function editar(c) {
let icono = c.icono || null;
const f = h(`<div><div class="campo"><label>Ícono</label><div class="fila"><span id="iv">${icono ? img(icono, 56, 10) : '<span style="display:inline-grid;place-items:center;width:56px;height:56px;border:2px dashed #c9d3d6;border-radius:10px">🖼</span>'}</span><button class="btn sec chico" id="si">Subir ícono</button>${icono ? '<button class="btn sec chico" id="qi">Quitar</button>' : ''}</div></div>
<div class="campo"><label>Nombre</label><input name="nombre" placeholder="Ej: Restaurantes" value="${esc(c.nombre || '')}"></div><div class="campo"><label>Descripción</label><input name="descripcion" placeholder="Descripción opcional" value="${esc(c.descripcion || '')}"></div><div class="campo"><label>Orden</label><input name="orden" type="number" value="${esc(c.orden ?? 0)}"></div>
<div class="campo"><label>Tipo de rubro</label><select name="tipo"><option value="comida" ${(c.tipo || 'comida') === 'comida' ? 'selected' : ''}>🍽 Comida (se prepara)</option><option value="productos" ${c.tipo === 'productos' ? 'selected' : ''}>📦 Productos (farmacia, kiosco, ferretería, mercado… se arma)</option></select></div>
<div class="campo"><label>Vehículo por defecto del reparto</label><select name="vehiculo_defecto">${[['', 'Cualquiera (moto o auto)'], ['moto', '🏍 Moto'], ['auto', '🚗 Auto']].map(([v, t]) => `<option value="${v}" ${(c.vehiculo_defecto || '') === v ? 'selected' : ''}>${t}</option>`).join('')}</select><small style="color:var(--suave)">Cada negocio y cada pedido pueden cambiarlo.</small></div></div>`);
$('#si', f).onclick = async () => { const fi = await elegirArchivo('image/*'); if (!fi) return; try { icono = (await subir(fi)).archivo; $('#iv', f).innerHTML = img(icono, 56, 10); } catch (e) { fallo(e); } };
const qi = $('#qi', f); if (qi) qi.onclick = () => { icono = null; $('#iv', f).innerHTML = '—'; };
modal({ titulo: c.id ? 'Editar Categoría' : 'Nueva Categoría', cuerpo: f, botones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: c.id ? 'Guardar' : 'Crear', accion: async () => { await dapi('r_dlv_categoria_guardar', {}, { ...leer(f), id: c.id, icono }); toast('Categoría guardada', 'ok'); cargar(); } }] });
}
if (tiene('admin')) $('#nueva').onclick = () => editar({});
cargar().catch(fallo);
}
});

// ================= TABLERO DE PEDIDOS (operador) =================
ruta('dlv-tablero', {
titulo: 'Tablero de pedidos', roles: ['admin', 'gestion', 'operador'], async render(main) {
const COLS = [['nuevo', '🆕 Nuevos', 'Esperando que el comercio acepte'], ['prep', '👨‍🍳 En preparación', 'Aceptados'], ['listo', '📦 Listos · repartidor', 'Listos para retirar'], ['camino', '🛵 En camino', 'Ya salieron']];
const colDe = x => x.estado === 'pendiente' || x.estado === 'cancelacion_solicitada' ? 'nuevo' : ['confirmado', 'preparando'].includes(x.estado) ? 'prep' : x.estado === 'listo' ? 'listo' : 'camino';
main.innerHTML = cabecera('Tablero de pedidos', 'Todos los pedidos activos por etapa. Se actualiza solo.', '<button class="btn sec" id="rf">↻ Actualizar</button><button class="btn" id="lista">Ver lista completa</button>') +
`<style>.tb-grid{display:grid;grid-template-columns:repeat(4,minmax(230px,1fr));gap:12px;overflow-x:auto;align-items:start}.tb-col{background:#eef2f4;border-radius:14px;padding:10px;min-height:120px}.tb-col h4{margin:0 0 2px;display:flex;justify-content:space-between}.tb-col small.s{color:var(--suave);display:block;margin-bottom:8px}
.tb-c{background:#fff;border:1px solid #dfe6e8;border-left:5px solid #cfd8dc;border-radius:10px;padding:10px;margin-bottom:8px;font-size:13px;display:flex;flex-direction:column;gap:4px}.tb-c.al{border-left-color:#e8892b;background:#fff8ee}.tb-c.rojo{border-left-color:#d64545;background:#fff3f3}.tb-c .f{display:flex;justify-content:space-between;gap:8px}
.tb-c select{width:100%;padding:6px;border-radius:8px;border:1px solid #cfd8dc;background:#fff}.tb-tag{display:inline-block;border-radius:10px;padding:1px 8px;font-size:11px;font-weight:700;background:#e8eef2}.tb-tag.ro{background:#fdecec;color:#9b1c1c}.tb-tag.na{background:#fff1dc;color:#8a4b00}</style>
<div class="dlv-kpis" id="kp"></div><div class="tb-grid" id="tg"></div>`;
$('#lista').onclick = () => ir('dlv-pedidos');
let T = null;
const edadTxt = m => m == null ? '' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
async function cargar() {
T = await dapi('r_dlv_tablero');
const h = T.hoy, rp = T.repartidores, al = T.alertas;
$('#kp').innerHTML = [['Activos', T.pedidos.length], ['Hoy', h.pedidos], ['Entregados', h.entregados], ['Cancelados', h.cancelados], ['Facturado hoy', pesos(h.facturado)], ['Repartidores', `${rp.libres} libres / ${rp.conectados} conectados`]].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('');
const por = { nuevo: [], prep: [], listo: [], camino: [] }; T.pedidos.forEach(x => por[colDe(x)].push(x));
$('#tg').innerHTML = COLS.map(([k, t, s]) => `<div class="tb-col"><h4><span>${t}</span><span>${por[k].length}</span></h4><small class="s">${s}</small>${por[k].map(x => {
  let nivel = '', av = [];
  if (x.estado === 'pendiente' && x.edad_min >= al.sin_aceptar) { nivel = 'rojo'; av.push('Sin aceptar hace ' + edadTxt(x.edad_min)); }
  if (x.estado === 'cancelacion_solicitada') { nivel = 'rojo'; av.push('Pide cancelar'); }
  if (['confirmado', 'preparando'].includes(x.estado) && x.tiempo_prep && x.en_estado_min > +x.tiempo_prep + al.demora_extra) { nivel = 'al'; av.push('Demorado: ' + edadTxt(x.en_estado_min)); }
  if (x.tipo_entrega === 'entrega' && !x.movil_numero && x.busca_min != null) { av.push('Buscando repartidor ' + edadTxt(x.busca_min)); if (x.busca_min >= al.sin_repartidor) nivel = 'rojo'; else if (!nivel) nivel = 'al'; }
  const veh = x.vehiculo === 'moto' ? '🏍 moto' : x.vehiculo === 'auto' ? '🚗 auto' : '';
  const accs = accionesPedido(x, () => cargar().catch(fallo)).filter(a => a && !/imprimir|copiar/i.test(a.t));
  return `<div class="tb-c ${nivel}" data-id="${x.id}"><div class="f"><b>#${esc(x.codigo)}</b><span>${pesos(x.total)}</span></div><div>${esc(x.negocio || 'Envío directo')}${x.rubro_tipo === 'productos' ? ' <span class="tb-tag">productos</span>' : ''}</div>
<small>${esc(x.cliente_nombre || '')} · ${x.tipo_entrega === 'retiro' ? 'retira en local' : esc(x.entrega_dir || '')}</small>
<div class="f"><small>⏱ ${edadTxt(x.edad_min)}${x.eta_min ? ' · llega ~' + x.eta_min + ' min' : ''}</small><small>${veh}</small></div>
${x.movil_numero ? `<small>${x.vehiculo_movil === 'auto' ? '🚗' : '🛵'} Móvil <b>${x.movil_numero}</b> ${esc(x.conductor || '')}</small>` : ''}${av.map(a => `<span class="tb-tag ${nivel === 'rojo' ? 'ro' : 'na'}">⚠ ${esc(a)}</span>`).join('')}
<select data-s="${x.id}"><option value="">Acciones…</option>${accs.map((a, i) => `<option value="${i}">${esc(a.ico || '')} ${esc(a.t)}</option>`).join('')}</select></div>`; }).join('') || '<small style="color:var(--suave)">Sin pedidos</small>'}</div>`).join('');
$$('[data-s]', main).forEach(s => s.onchange = () => { const x = T.pedidos.find(p => p.id === +s.dataset.s); const accs = accionesPedido(x, () => cargar().catch(fallo)).filter(a => a && !/imprimir|copiar/i.test(a.t)); const a = accs[+s.value]; s.value = ''; if (a) Promise.resolve(a.a()).catch(fallo); });
}
$('#rf').onclick = () => cargar().catch(fallo);
await cargar().catch(fallo);
const tm = setInterval(() => { if (rutaActual() !== 'dlv-tablero' || !document.body.contains(main)) return clearInterval(tm); if (document.visibilityState !== 'hidden') cargar().catch(() => { }); }, 20000);
oir(() => { if (rutaActual() === 'dlv-tablero') cargar().catch(() => { }); });
}
});

// ================= REPARTIDORES =================
ruta('dlv-repartidores', {
titulo: 'Repartidores', roles: ['admin', 'gestion', 'operador'], render(main) {
const adm = tiene('admin', 'operador'); let filtro = 'pendiente';
const ET = { pendiente: ['Por aprobar', '#e8892b'], aprobado: ['Aprobado', '#2f9e57'], rechazado: ['Rechazado', '#d64545'], suspendido: ['Suspendido', '#7a7a7a'] };
main.innerHTML = cabecera('Repartidores', 'Solicitudes y altas del portal de repartidores', '<button class="btn sec" id="pr">Abrir portal</button>') + `<div class="card"><div class="head"><h3>🛵 Repartidores <small id="cc" style="color:var(--suave)"></small></h3><select id="fe" style="width:auto"><option value="pendiente">Por aprobar</option><option value="aprobado">Aprobados</option><option value="suspendido">Suspendidos</option><option value="rechazado">Rechazados</option><option value="">Todos</option></select></div><div class="body" id="lr"></div></div>`;
$('#pr').onclick = () => window.open('repartidor.html');
$('#fe').onchange = e => { filtro = e.target.value; cargar().catch(fallo); };
async function cargar() {
const rs = await dapi('r_rep_lista', { estado: filtro });
$('#cc').textContent = `(${rs.length})`;
$('#lr').innerHTML = rs.length ? tablaSimple(rs, [
{ t: 'Repartidor', f: r => `<b>${esc(r.nombre)} ${esc(r.apellido)}</b><br><small>DNI ${esc(r.documento)} · ${esc(r.telefono || '')}</small>` },
{ t: 'Vehículo', f: r => `${r.vehiculo === 'moto' ? '🏍 Moto' : '🚗 Auto'}<br><small>${esc(r.patente || '')} ${esc(r.marca || '')} ${esc(r.modelo || '')}</small>` },
{ t: 'Móvil', f: r => (r.movil ? '#' + r.movil : '—') + ((r.otros_moviles || []).length ? `<br><small>🔗 También conductor: móvil ${r.otros_moviles.join(', ')}</small>` : '') },
{ t: 'Documentos', f: r => (r.docs || []).length ? (r.docs || []).map((d, i) => d.archivo ? `<a href="${esc(d.archivo)}" target="_blank" rel="noopener">${esc(d.tipo || 'Archivo ' + (i + 1))}</a>` : '').join('<br>') : '<small>Sin archivos</small>' },
{ t: 'Entregas', c: 'r', f: r => `${r.resumen.total.entregas}<br><small>${pesos(r.resumen.total.ganado)}</small><br><a href="#" data-g="${r.id}">Ver ganancias</a>` },
{ t: 'Estado', f: r => { const e = ET[r.estado] || [r.estado, '#888']; return `<span class="pill" style="background:${e[1]}22;color:${e[1]}">${e[0]}</span>${r.motivo ? '<br><small>' + esc(r.motivo) + '</small>' : ''}`; } },
{ t: '', f: r => !adm ? '' : r.estado === 'pendiente' ? `<button class="btn chico verde" data-a="aprobar" data-id="${r.id}">Aprobar</button> <button class="btn chico sec" data-a="rechazar" data-id="${r.id}">Rechazar</button>` : r.estado === 'aprobado' ? `<button class="btn chico sec" data-a="suspender" data-id="${r.id}">Suspender</button>` : `<button class="btn chico verde" data-a="reactivar" data-id="${r.id}">${r.estado === 'rechazado' ? 'Aprobar' : 'Reactivar'}</button>` }
]) : vacio('🛵', 'Sin repartidores', 'No hay repartidores en este estado.');
$$('[data-g]', main).forEach(a => a.onclick = e => { e.preventDefault(); gananciasRepartidor(rs.find(r => r.id === +a.dataset.g)); });
$$('[data-a]', main).forEach(b => b.onclick = async () => {
const a = b.dataset.a, body = { id: +b.dataset.id, accion: a };
if (a === 'rechazar' || a === 'suspender') { const r = await pedir(a === 'rechazar' ? 'Rechazar solicitud' : 'Suspender repartidor', [{ k: 'motivo', l: 'Motivo (lo ve el repartidor)', w: 'full' }]); if (!r || !r.motivo) return; body.motivo = r.motivo; }
try { await dapi('r_rep_resolver', {}, body); toast('Listo', 'ok'); cargar(); } catch (e) { fallo(e); } });
}
cargar().catch(fallo);
}
});

function gananciasRepartidor(r) {
const hoy = new Date().toISOString().slice(0, 10), hace = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
const cuerpo = h(`<div><div class="fila" style="margin-bottom:10px"><label>Desde <input type="date" id="gd" value="${hace}" style="width:auto"></label> <label>Hasta <input type="date" id="gh" value="${hoy}" style="width:auto"></label><button class="btn sec chico" id="gc">⬇ CSV</button></div><div id="gb"></div></div>`);
let datos = null;
async function cargar() {
datos = await dapi('r_rep_ganancias', { id: r.id, desde: $('#gd', cuerpo).value, hasta: $('#gh', cuerpo).value });
const p = datos.periodo, rs = datos.resumen;
$('#gb', cuerpo).innerHTML = `<div class="dlv-kpis"><div class="kpi"><div class="l">Entregas</div><div class="v">${p.entregas}</div></div><div class="kpi"><div class="l">Envíos</div><div class="v">${pesos(p.envios)}</div></div><div class="kpi"><div class="l">Propinas</div><div class="v">${pesos(p.propinas)}</div></div><div class="kpi"><div class="l">Retenido central</div><div class="v">${pesos(p.comision)}</div></div><div class="kpi"><div class="l">Ganó</div><div class="v">${pesos(p.ganado)}</div></div></div>
<p style="color:var(--suave);margin:6px 0">Hoy ${pesos(rs.hoy.ganado)} (${rs.hoy.entregas}) · Semana ${pesos(rs.semana.ganado)} (${rs.semana.entregas}) · Mes ${pesos(rs.mes.ganado)} (${rs.mes.entregas}) · Total ${pesos(rs.total.ganado)} (${rs.total.entregas})</p>
${datos.entregas.length ? tablaSimple(datos.entregas, [{ t: 'Pedido', f: e => '#' + esc(e.codigo) }, { t: 'Fecha', f: e => esc(String(e.fecha || '').slice(0, 16).replace('T', ' ')) }, { t: 'Negocio', f: e => esc(e.negocio) }, { t: 'Entrega', f: e => esc(e.entrega_dir || '') }, { t: 'Envío', c: 'r', f: e => pesos(e.envio) }, { t: 'Propina', c: 'r', f: e => pesos(e.propina) }, { t: 'Retenido', c: 'r', f: e => pesos(e.comision) }, { t: 'Ganó', c: 'r', f: e => `<b>${pesos(e.ganancia)}</b>` }]) : '<p style="color:var(--suave)">Sin entregas en este período.</p>'}`;
}
$('#gd', cuerpo).onchange = $('#gh', cuerpo).onchange = () => cargar().catch(fallo);
$('#gc', cuerpo).onclick = () => datos && RODAR.csv(datos.entregas.map(e => ({ pedido: e.codigo, fecha: e.fecha, negocio: e.negocio, cliente: e.cliente, direccion: e.entrega_dir, envio: e.envio, propina: e.propina, retenido: e.comision, ganancia: e.ganancia, pago: e.medio_pago })), 'ganancias-' + r.documento);
modal({ titulo: 'Ganancias · ' + r.nombre + ' ' + r.apellido, ancho: true, cuerpo, botones: [{ texto: 'Cerrar', clase: 'sec' }] });
cargar().catch(fallo);
}

// ================= PEDIDOS =================
function colsPedidos(conNegocio = true) {
return [{ t: 'Código', f: x => `<b>#${esc(x.codigo)}</b><br><small>${TIPOS[x.tipo] || x.tipo}${x.tipo_entrega === 'retiro' ? ' · retiro' : ''}</small>` }, { t: 'Fecha', f: x => fechaCorta(x.creado) },
...(conNegocio ? [{ t: 'Negocio', f: x => esc(x.negocio || (x.tipo === 'directo' ? 'Envío directo' : '—')) }] : []),
{ t: 'Cliente', f: x => `${esc(x.cliente_nombre || '—')}<br><small>${esc(x.cliente_tel || '')}</small>` }, { t: 'Estado', f: x => pillE(EST_PED, x.estado) + (x.devolucion_pendiente ? '<br><small style="color:var(--rojo)">Devolución pendiente</small>' : '') },
{ t: 'Repartidor', f: x => (x.movil_numero ? `Móvil <b>${x.movil_numero}</b><br><small>${esc(x.conductor || '')}</small>` : x.buscando_desde && !['entregado', 'cancelado'].includes(x.estado) ? '<small style="color:#e8892b">Buscando…</small>' : '—') + (x.tipo_entrega === 'entrega' && x.vehiculo && x.vehiculo !== 'cualquiera' ? `<br><small>${x.vehiculo === 'moto' ? '🏍 Moto' : '🚗 Auto'}</small>` : '') },
{ t: 'Pago', f: x => esc(MEDIOS[x.medio_pago] || x.medio_pago) + (x.pagado ? ' ✅' : '') + (x.efectivo_recibido ? '<br><small>Efectivo recibido</small>' : '') }, { t: 'Total', c: 'r', f: x => `<b>${pesos(x.total)}</b>` }];
}
function accionesPedido(x, listo) {
const op = tiene('admin', 'operador');
const acc = async (accion, extra = {}) => { try { await dapi('r_dlv_pedido_accion', {}, { id: x.id, accion, ...extra }); toast('Pedido actualizado', 'ok'); listo && listo(); } catch (e) { fallo(e); } };
const fin = ['entregado', 'cancelado'].includes(x.estado);
return [{ t: 'Ver detalle', ico: '👁', a: () => verPedido(x.id, listo) },
op && !fin && x.estado === 'pendiente' && { t: 'Confirmar', ico: '✅', a: () => acc('confirmado') },
op && !fin && ['confirmado', 'pendiente'].includes(x.estado) && { t: 'Preparando', ico: '🍳', a: () => acc('preparando') },
op && !fin && ['confirmado', 'preparando', 'pendiente'].includes(x.estado) && { t: 'Listo', ico: '📦', a: () => acc('listo', { con_repartidor: true }) },
op && !fin && x.tipo_entrega === 'entrega' && !x.movil_numero && { t: 'Buscar repartidor', ico: '🛵', a: () => acc('repartidor') },
op && !fin && x.tipo_entrega === 'entrega' && !x.movil_numero && { t: 'Vehículo del reparto: ' + ({ moto: 'moto', auto: 'auto' }[x.vehiculo] || 'cualquiera'), ico: '🏍', a: async () => { const r = await pedir('Vehículo del reparto · pedido #' + x.codigo, [{ k: 'vehiculo', l: 'El repartidor tiene que ir en', t: 'select', op: [['cualquiera', 'Cualquiera (moto o auto)'], ['moto', '🏍 Moto'], ['auto', '🚗 Auto']] }], { vehiculo: x.vehiculo || 'cualquiera' }); if (r) try { await dapi('r_dlv_pedido_vehiculo', {}, { id: x.id, vehiculo: r.vehiculo }); toast('Vehículo actualizado', 'ok'); listo && listo(); } catch (e) { fallo(e); } } },
op && !fin && x.viaje_id && { t: 'Quitar repartidor', ico: '↩', a: () => acc('quitar_repartidor') },
op && !fin && { t: 'Marcar entregado', ico: '🏁', a: () => acc('entregado') },
op && x.medio_pago === 'efectivo' && { t: x.efectivo_recibido ? 'Revertir efectivo recibido' : 'Efectivo recibido', ico: '💵', a: () => acc('efectivo') },
op && x.medio_pago !== 'efectivo' && !fin && { t: x.pagado ? 'Desmarcar pago' : 'Aprobar pago', ico: '💳', a: () => acc('pagado') },
op && x.devolucion_pendiente && { t: 'Marcar mercadería devuelta', ico: '↩', a: () => acc('devuelto') },
op && !fin && { t: x.estado === 'cancelacion_solicitada' ? 'Aprobar cancelación' : 'Cancelar pedido', ico: '⛔', a: async () => { const r = await pedir('Cancelar pedido #' + x.codigo, [{ k: 'motivo', l: 'Motivo', w: 'full' }], { motivo: x.motivo_cancelacion || '' }); if (r) acc('cancelado', { motivo: r.motivo || null }); } },
{ t: 'Copiar enlace de seguimiento', ico: '🔗', a: () => { const u = new URL('delivery.html#/seguir/' + x.id + '/' + x.k, location.href).href; navigator.clipboard.writeText(u).then(() => toast('Enlace copiado', 'ok'), () => prompt('Enlace de seguimiento', u)); } },
{ t: 'Imprimir comanda', ico: '🖨', a: () => comanda(x) },
];
}
function comanda(x) {
const w = window.open('', '_blank'); if (!w) return;
const desg = D.cfg && D.cfg.comanda_desglose;
w.document.write(`<!doctype html><meta charset="utf-8"><title>Comanda #${esc(x.codigo)}</title><style>body{font-family:monospace;max-width:300px;margin:10px auto;font-size:13px}h2{text-align:center;margin:4px}hr{border:0;border-top:1px dashed #000}.f{display:flex;justify-content:space-between}</style>
<h2>${esc(x.negocio || 'Envío')}</h2><div style="text-align:center">Pedido #${esc(x.codigo)}<br>${fechaCorta(x.creado)}</div><hr>
${(x.items || []).map(i => `<div class="f"><span>${i.cantidad} × ${esc(i.nombre)}</span><span>${pesos(i.subtotal)}</span></div>${i.notas ? `<div>  · ${esc(i.notas)}</div>` : ''}`).join('')}<hr>
<div class="f"><b>Subtotal</b><b>${pesos(x.subtotal)}</b></div>${desg ? `<div class="f"><span>Envío</span><span>${pesos(x.envio)}</span></div><div class="f"><span>Servicio</span><span>${pesos(x.service_fee)}</span></div><div class="f"><span>Propina</span><span>${pesos(x.propina)}</span></div><div class="f"><b>TOTAL</b><b>${pesos(x.total)}</b></div>` : ''}<hr>
<div>${esc(x.cliente_nombre || '')} ${esc(x.cliente_tel || '')}</div><div>${x.tipo_entrega === 'retiro' ? 'RETIRA EN EL LOCAL' : esc(x.entrega_dir || '')}</div>${x.notas ? `<div>Notas: ${esc(x.notas)}</div>` : ''}<div>Pago: ${esc(MEDIOS[x.medio_pago] || x.medio_pago)}</div><script>print()<\/script>`);
w.document.close();
}
async function verPedido(id, listo) {
const x = await dapi('r_dlv_pedido', { id });
const cuerpo = h(`<div><div class="fila" style="justify-content:space-between;margin-bottom:8px"><div>${pillE(EST_PED, x.estado)} <span class="pill">${TIPOS[x.tipo]}</span> ${x.tipo_entrega === 'retiro' ? '<span class="pill">Retiro en local</span>' : ''}</div><small>${fechaLarga(x.creado)}</small></div>
<div class="grid g2"><div><h4 style="margin:6px 0">Cliente</h4><div>${esc(x.cliente_nombre || '—')} · ${esc(x.cliente_tel || '')}</div><div style="color:var(--suave)">${esc(x.entrega_dir || '')}${x.entrega_ref ? ' · ' + esc(x.entrega_ref) : ''}</div>
<h4 style="margin:10px 0 6px">${x.tipo === 'directo' ? 'Retiro' : 'Negocio'}</h4><div>${esc(x.negocio || 'Envío directo')} ${x.negocio_tel ? '· ' + esc(x.negocio_tel) : ''}</div><div style="color:var(--suave)">${esc(x.recogida_dir || '')}</div>
<h4 style="margin:10px 0 6px">Repartidor</h4><div>${x.movil_numero ? `Móvil <b>${x.movil_numero}</b> · ${esc(x.conductor || '')} <small>(viaje #${x.viaje_id}, ${esc(x.viaje_estado || '')})</small>` : x.viaje_id ? `Buscando repartidor (viaje #${x.viaje_id})` : 'Sin repartidor'}${x.tipo_entrega === 'entrega' ? ` · Vehículo: <b>${{ moto: '🏍 moto', auto: '🚗 auto' }[x.vehiculo] || 'moto o auto'}</b>` : ''}</div>
<div class="fila" style="margin-top:8px">${x.codigo_recoleccion ? `<div>Código de retiro<br><span class="dlv-codigo">${esc(x.codigo_recoleccion)}</span></div>` : ''}${x.codigo_entrega ? `<div>Código del cliente<br><span class="dlv-codigo">${esc(x.codigo_entrega)}</span></div>` : ''}${x.codigo_devolucion ? `<div>Código de devolución<br><span class="dlv-codigo">${esc(x.codigo_devolucion)}</span></div>` : ''}</div></div>
<div><h4 style="margin:6px 0">Detalle</h4><table class="t dlv-items">${(x.items || []).map(i => `<tr><td>${i.cantidad} ×</td><td>${esc(i.nombre)}${i.notas ? `<br><small>${esc(i.notas)}</small>` : ''}</td><td class="r">${pesos(i.subtotal)}</td></tr>`).join('') || `<tr><td colspan="3" style="color:var(--suave)">${x.tipo === 'express' ? 'Pedido express: monto a cobrar ' + pesos(x.subtotal) : 'Envío de paquete'}</td></tr>`}
<tr><td></td><td>Subtotal</td><td class="r">${pesos(x.subtotal)}</td></tr><tr><td></td><td>Envío${x.metros ? ` <small>(${km1(x.metros / 1000)} km)</small>` : ''}</td><td class="r">${pesos(x.envio)}</td></tr>${+x.service_fee ? `<tr><td></td><td>Tarifa de servicio</td><td class="r">${pesos(x.service_fee)}</td></tr>` : ''}${+x.propina ? `<tr><td></td><td>Propina</td><td class="r">${pesos(x.propina)}</td></tr>` : ''}${+x.saldo_usado ? `<tr><td></td><td>Saldo de billetera</td><td class="r">−${pesos(x.saldo_usado)}</td></tr>` : ''}
<tr><td></td><td><b>Total</b></td><td class="r"><b>${pesos(x.total)}</b></td></tr></table>
<div style="margin-top:6px;color:var(--suave);font-size:13px">Pago: ${esc(MEDIOS[x.medio_pago] || x.medio_pago)}${x.paga_con ? ' · paga con ' + pesos(x.paga_con) : ''}${x.estado === 'entregado' ? ` · comisión negocio ${pesos(x.comision_negocio)} · comisión repartidor ${pesos(x.comision_repartidor)}${+x.cashback ? ' · cashback ' + pesos(x.cashback) : ''}` : ''}</div>
${x.notas ? `<div class="nota" style="margin-top:8px">${esc(x.notas)}</div>` : ''}${x.motivo_cancelacion ? `<div class="nota alerta" style="margin-top:8px">Motivo: ${esc(x.motivo_cancelacion)}</div>` : ''}</div></div>
<h4 style="margin:12px 0 4px">Historial</h4><div class="dlv-tl">${(x.historial || []).map(e => `<div><small>${fechaCorta(e.fecha)}</small>${esc(e.texto)}</div>`).join('')}</div></div>`);
const acciones = accionesPedido(x, () => { m.cerrar(); listo && listo(); }).filter(Boolean).filter(a => a.t !== 'Ver detalle');
const m = modal({ titulo: 'Pedido #' + x.codigo, ancho: true, cuerpo, botones: [{ texto: 'Acciones ⋯', clase: 'sec', accion: () => false }, { texto: 'Cerrar' }] });
const b = $$('.mf .btn', m.el)[0]; b.onclick = e => menuAcciones(e, acciones);
}

ruta('dlv-pedidos', {
titulo: 'Pedidos de Delivery', roles: ['admin', 'gestion', 'operador'], async render(main) {
await cfg().catch(() => { });
main.innerHTML = cabecera('Pedidos de Delivery', 'Registro de todos los pedidos realizados a través de la plataforma', tiene('admin', 'operador') ? '<button class="btn sec" id="exp">⚡ Crear pedido express</button>' : '') +
`<div class="dlv-kpis" id="kp"></div><div class="card"><div class="dlv-filtros"><select id="fe"><option value="">Todos</option>${Object.entries(EST_PED).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select>
<select id="fn"><option value="">Todos los negocios</option>${(D.negocios || []).map(n => `<option value="${n.id}">${esc(n.nombre)}</option>`).join('')}</select>
<select id="fm"><option value="">Todas las formas de pago</option>${Object.entries(MEDIOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
<input type="date" id="fd"><input type="date" id="fh"><input type="search" id="fb" placeholder="Buscar por código, cliente o teléfono"><button class="btn sec chico" id="csv">⬇ CSV</button></div></div>
<div class="card"><div class="head"><h3>🛍 Pedidos</h3></div><div id="tb"></div></div>`;
const q = () => ({ estado: $('#fe').value, negocio: $('#fn').value, medio: $('#fm').value, desde: $('#fd').value, hasta: $('#fh').value, buscar: $('#fb').value });
const t = tabla($('#tb'), { vacio: 'No se encontraron pedidos con los filtros seleccionados.', cols: colsPedidos(true),
cargar: async p => { const r = await dapi('r_dlv_pedidos', { ...p, ...q() }); $('#kp').innerHTML = `<div class="kpi"><div class="l">Pedidos activos</div><div class="v">${r.activos}</div></div><div class="kpi"><div class="l">Pedidos de hoy</div><div class="v">${r.hoy.pedidos}</div></div><div class="kpi"><div class="l">Entregados hoy</div><div class="v">${r.hoy.entregados}</div></div><div class="kpi"><div class="l">Ventas de hoy</div><div class="v">${pesos(r.hoy.ventas)}</div></div>`; return r; },
acciones: x => accionesPedido(x, () => t.refrescar()) });
let tb; $('#fb').oninput = () => { clearTimeout(tb); tb = setTimeout(() => t.refrescar(true), 300); };
['#fe', '#fn', '#fm', '#fd', '#fh'].forEach(s => $(s).onchange = () => t.refrescar(true));
$('#csv').onclick = async () => { const r = await dapi('r_dlv_pedidos', { ...q(), limite: 10000 }); RODAR.csv(r.filas.map(x => ({ codigo: x.codigo, fecha: x.creado, tipo: x.tipo, negocio: x.negocio, cliente: x.cliente_nombre, telefono: x.cliente_tel, direccion: x.entrega_dir, estado: x.estado, medio_pago: x.medio_pago, subtotal: x.subtotal, envio: x.envio, servicio: x.service_fee, propina: x.propina, total: x.total, movil: x.movil_numero, comision_negocio: x.comision_negocio })), 'pedidos_delivery'); };
const e = $('#exp'); if (e) e.onclick = () => pedidoExpress(() => t.refrescar(true));
oir(() => { if (rutaActual() === 'dlv-pedidos') t.refrescar(); });
}
});

async function pedidoExpress(listo) {
await cfg();
const cuerpo = h(`<div><p style="color:var(--suave);margin-top:0">Solicita un repartidor en nombre de un negocio. El pedido queda en el historial del negocio seleccionado.</p>
<div class="grid g2"><div class="campo" style="grid-column:1/-1"><label>Negocio</label><select name="negocio_id"><option value="">Seleccioná un negocio</option>${(D.negocios || []).map(n => `<option value="${n.id}">${esc(n.nombre)}</option>`).join('')}</select></div>
<div class="campo"><label>Nombre del cliente</label><input name="cliente_nombre" placeholder="Nombre de quien recibe"></div><div class="campo"><label>Teléfono del cliente</label><input name="cliente_tel" placeholder="Número de teléfono"></div>
<div class="campo" style="grid-column:1/-1"><label>Dirección de entrega</label><div id="edir"></div></div><div class="campo"><label>Referencia (opcional)</label><input name="entrega_ref" placeholder="Depto, timbre, entre calles…"></div>
<div class="campo"><label>Tipo de entrega</label><select name="cobro"><option value="entregar_cobrar">Entregar y cobrar</option><option value="solo_entrega">Solo entrega</option></select><small id="cobtx" style="color:var(--suave)"></small></div>
<div class="campo"><label>Monto a cobrar (valor del pedido)</label><input name="monto" type="number" value="0"></div><div class="campo"><label>¿Con cuánto paga el cliente? (efectivo, opcional)</label><input name="paga_con" type="number"><small style="color:var(--suave)">Para calcular el vuelto que debe llevar el repartidor. Dejalo vacío si paga exacto.</small></div>
<div class="campo"><label>Tiempo de recolección (minutos)</label><input name="tiempo_recoleccion" type="number" value="15"><small style="color:var(--suave)">En cuántos minutos estará listo el pedido para que el repartidor lo recoja.</small></div>
<div class="campo"><label>Tarifa de envío</label><label class="check"><input type="checkbox" id="auto" checked> Calcular automáticamente (zonas e interzona)</label><div class="fila"><input name="envio_manual" type="number" placeholder="Monto manual" disabled style="width:140px"><button class="btn sec chico" id="cot">Cotizar</button><b id="cotr"></b></div></div>
<div class="campo" style="grid-column:1/-1"><label>Notas (opcional)</label><textarea name="notas"></textarea></div></div></div>`);
const sd = selectorDireccion($('#edir', cuerpo), {}, 'Dirección de entrega');
const tx = () => $('#cobtx', cuerpo).textContent = $('[name=cobro]', cuerpo).value === 'entregar_cobrar' ? 'El repartidor cobra el pedido + el envío al recibir.' : 'El cliente ya pagó al negocio: el repartidor solo entrega (el negocio adeuda el envío).';
$('[name=cobro]', cuerpo).onchange = tx; tx();
$('#auto', cuerpo).onchange = e => { $('[name=envio_manual]', cuerpo).disabled = e.target.checked; };
let cot = null;
const datos = async () => { const d = leer(cuerpo), v = sd.valor; let met = null, min = null;
const neg = (D.negocios || []).find(n => n.id === +d.negocio_id);
if (v.lat != null && neg) { try { const nn = await dapi('r_dlv_negocio', { id: neg.id }); if (nn.lat) { const r = await RODAR.ruta({ lat: nn.lat, lng: nn.lng }, { lat: v.lat, lng: v.lng }); if (r) { met = Math.round(r.metros); min = Math.round(r.minutos); } } } catch { } }
return { ...d, entrega_dir: v.dir, entrega_lat: v.lat, entrega_lng: v.lng, metros: met, minutos: min, envio_manual: $('#auto', cuerpo).checked ? null : d.envio_manual, medio_pago: 'efectivo' }; };
$('#cot', cuerpo).onclick = async () => { try { const d = await datos(); cot = await dapi('r_dlv_cotizar', {}, { ...d, tipo: 'express' }); $('#cotr', cuerpo).textContent = `Envío ${pesos(d.envio_manual || cot.envio)}${cot.metros ? ' · ' + km1(cot.metros / 1000) + ' km' : ''} · Total a cobrar ${pesos(d.cobro === 'solo_entrega' ? 0 : (+d.monto || 0) + +(d.envio_manual || cot.envio))}`; } catch (e) { fallo(e); } };
modal({ titulo: 'Crear pedido express', ancho: true, cuerpo, botones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: 'Crear pedido', clase: 'verde', accion: async () => {
const d = await datos(); if (!d.negocio_id) throw new Error('Seleccioná un negocio');
const r = await dapi('r_dlv_pedido_crear', {}, { ...d, tipo: 'express' }); toast('Pedido #' + r.codigo + ' creado, buscando repartidor', 'ok'); listo && listo();
} }] });
}

// ================= CAMBIOS DE MENÚ =================
ruta('dlv-cambios', {
titulo: 'Cambios de menú', roles: ['admin'], async render(main) {
main.innerHTML = cabecera('Cambios de menú', 'Productos y perfiles que los negocios crearon, editaron o eliminaron y esperan tu aprobación.', '<button class="btn sec" id="ac">⟳ Actualizar</button>') + '<div id="c"></div>';
async function cargar() {
const d = await dapi('r_dlv_cambios');
const desc = p => p.cambio ? (p.cambio.borrar ? '<b style="color:var(--rojo)">Eliminar producto</b>' : 'Editar: ' + Object.entries(p.cambio).filter(([k, v]) => k !== 'imagen' && v != null && String(v) !== String(p[k])).map(([k, v]) => `${esc(k)} → <b>${esc(v)}</b>`).join(', ')) : '<b style="color:var(--verde)">Producto nuevo</b>';
$('#c').innerHTML = `<div class="card"><div class="head"><h3>Productos (${d.productos.length})</h3></div>${tablaSimple(d.productos, [{ t: '', f: p => img(p.imagen) }, { t: 'Negocio', k: 'negocio' }, { t: 'Producto', f: p => `<b>${esc(p.nombre)}</b> · ${pesos(p.precio)}<br><small>${esc(p.descripcion || '')}</small>` }, { t: 'Cambio', f: desc }, { t: 'Fecha', f: p => fechaCorta(p.creado) }, { t: '', f: p => `<button class="btn chico verde" data-ok="${p.id}">Aprobar</button> <button class="btn chico rojo" data-no="${p.id}">Rechazar</button>` }], 'No hay cambios de menú pendientes.')}</div>
<div class="card"><div class="head"><h3>Perfiles de negocio (${d.negocios.length})</h3></div>${tablaSimple(d.negocios, [{ t: 'Negocio', k: 'nombre' }, { t: 'Cambios', f: n => esc(Object.entries(n.cambio_pendiente || {}).filter(([k]) => k !== 'logo' && k !== 'horario').map(([k, v]) => k + ': ' + v).join(' · ') || 'logo u horario') }, { t: '', f: n => `<button class="btn chico verde" data-nok="${n.id}">Aprobar</button> <button class="btn chico rojo" data-nno="${n.id}">Rechazar</button>` }], 'No hay cambios de perfil pendientes.')}</div>`;
const res = async (fn, id, aprobar) => { try { await dapi(fn, {}, { id, aprobar }); toast(aprobar ? 'Aprobado' : 'Rechazado', 'ok'); D.cfg = null; cargar(); } catch (e) { fallo(e); } };
$$('[data-ok]').forEach(b => b.onclick = () => res('r_dlv_cambio_resolver', +b.dataset.ok, true)); $$('[data-no]').forEach(b => b.onclick = () => res('r_dlv_cambio_resolver', +b.dataset.no, false));
$$('[data-nok]').forEach(b => b.onclick = () => res('r_dlv_negocio_cambio', +b.dataset.nok, true)); $$('[data-nno]').forEach(b => b.onclick = () => res('r_dlv_negocio_cambio', +b.dataset.nno, false));
}
$('#ac').onclick = cargar; cargar().catch(fallo);
}
});

// ================= PAGOS A COMERCIOS =================
ruta('dlv-pagos', {
titulo: 'Pagos a comercios', roles: ['admin', 'gestion'], async render(main) {
main.innerHTML = cabecera('Pagos a comercios', 'Saldo de cada comercio y registro de liquidaciones. Sólo se liquida a los comercios con calendario de pagos distinto de «Ninguno».', '<button class="btn sec" id="ac">⟳ Actualizar</button>') + '<div class="card" id="tb"></div>';
const t = tabla($('#tb'), { cols: [{ t: 'Comercio', f: n => `<b>${esc(n.nombre)}</b><br><small>${esc([n.banco, n.tipo_cuenta, n.cuenta].filter(Boolean).join(' · ') || 'Sin datos bancarios')}</small>` }, { t: 'CUIT', k: 'cuit' }, { t: 'Calendario', f: n => esc(n.calendario_pago || 'ninguno') }, { t: 'Último pago', f: n => n.ultimo_pago ? fechaLarga(n.ultimo_pago) : '—' }, { t: 'Saldo', c: 'r', f: n => `<b style="color:${n.saldo < 0 ? 'var(--rojo)' : n.saldo > 0 ? 'var(--verde)' : 'inherit'}">${pesos(n.saldo)}</b>` }],
cargar: () => dapi('r_dlv_pagos'),
acciones: n => [n.calendario_pago !== 'ninguno' && n.saldo > 0 && { t: 'Registrar pago', ico: '💸', a: async () => { const r = await pedir('Pago a ' + n.nombre, [{ k: 'monto', l: 'Monto pagado ($)', t: 'number' }, { k: 'detalle', l: 'Detalle (transferencia, comprobante…)', w: 'full' }], { monto: n.saldo }); if (r) try { await dapi('r_dlv_movimiento', {}, { ...r, tipo: 'pago', negocio_id: n.id }); toast('Pago registrado', 'ok'); t.refrescar(); } catch (e) { fallo(e); } } },
{ t: 'Ver movimientos', ico: '📄', a: () => ir('dlv-negocio?id=' + n.id + '&tab=saldo') }] });
$('#ac').onclick = () => t.refrescar();
}
});

// ================= CONFIGURACIÓN DE DELIVERY =================
// tipos: sw (interruptor), num, txt, sel, tags (lista de números), tramos
const SECCIONES = [
{ t: 'Modo del catálogo', d: 'Qué ve el cliente al entrar a delivery: un marketplace con varios negocios, o directamente el menú de TU marca (uninegocio o sucursales).', c: [
{ k: 'modo_catalogo', t: 'sel', l: 'Modo', op: [['marketplace', 'Marketplace multinegocio (default)'], ['uninegocio', 'Uninegocio (una sola marca)'], ['sucursales', 'Sucursales de mi marca']] },
{ k: 'negocio_marca_id', t: 'neg', l: 'Negocio de la marca', d: 'En modo uninegocio, el cliente entra directo al menú de este negocio.' }] },
{ t: 'Comisiones (%)', d: 'Valores por defecto para todos los negocios. Cada negocio puede sobreescribirlos.', c: [
{ k: 'comision_negocio', t: 'num', l: 'Comisión al negocio (%)', d: 'Porcentaje del subtotal de productos que se queda la plataforma' },
{ k: 'comision_repartidor', t: 'num', l: 'Comisión al repartidor (%)', d: 'Porcentaje de la tarifa de envío que se queda la plataforma' },
{ k: 'recompensa_prepay', t: 'num', l: 'Recompensa al repartidor (% del subtotal, solo PREPAY)', d: 'En modo PREPAY el repartidor adelanta el subtotal al negocio; este porcentaje del subtotal se le acredita como bono adicional a su parte del envío. 0 = sin recompensa' },
{ k: 'cashback', t: 'num', l: 'Cashback al cliente (% del subtotal)', d: 'Al entregarse un pedido, este porcentaje del subtotal de productos se acredita a la billetera del cliente como saldo a favor para su próxima compra. No afecta las ganancias del negocio ni la comisión del repartidor. 0 = sin cashback' },
{ k: 'pagar_con_saldo', t: 'sw', l: 'Permitir pagar pedidos con el saldo de la billetera', d: 'Muestra «Usar mi saldo» en el checkout: el cliente puede pagar el pedido completo o una parte con el saldo de su billetera (por ejemplo, el cashback acumulado) y el resto en efectivo.' },
{ k: 'comision_express', t: 'sw', l: 'Cobrar comisión en pedidos express (Solicitar repartidor)', d: 'Por defecto la comisión al negocio solo se cobra en pedidos hechos desde la app del cliente; en los pedidos express que el negocio origina la plataforma la absorbe. Activalo para que el negocio también adeude la comisión en sus pedidos express. Los mandados directos nunca se cobran.' }] },
{ t: 'Tarifas', d: 'Costo de envío de los pedidos.', c: [
{ k: 'tarifa_base', t: 'num', l: 'Tarifa base', d: 'Tarifa base por cada entrega' }, { k: 'tarifa_km', t: 'num', l: 'Tarifa por km', d: 'Monto adicional por cada kilómetro' },
{ k: 'tarifa_min', t: 'num', l: 'Tarifa por minuto', d: 'Monto adicional por cada minuto estimado' }, { k: 'tarifa_minima', t: 'num', l: 'Tarifa mínima de entrega', d: 'Piso del costo de envío. Si el cálculo (base + km + min) da menos, se cobra este monto. 0 = sin piso.' },
{ h: 'Tarifa para pedidos B2B (negocio solicita repartidor)', d: 'Aplica solo cuando un negocio inicia el pedido. Los pedidos de cliente a un comercio ignoran esta tarifa.' },
{ k: 'b2b_fija', t: 'num', l: 'Tarifa fija B2B', d: 'Cuando hay valor, anula base+km+min para B2B (el piso de envío sigue aplicando). Vacío = sin tarifa fija.', vacio: true }, { k: 'b2b_sin_fee', t: 'sw', l: 'Sin service fee en B2B' },
{ h: 'Tarifa para envíos directos (pasajero pide repartidor punto a punto)', d: 'Aplica sólo al envío directo del pasajero (sin comercio). No se aplica a pedidos hechos a un comercio.' },
{ k: 'directo_activo', t: 'sw', l: 'Mostrar «Enviar paquete» en la app del cliente', d: 'Cuando está encendido, el cliente puede pedir un envío punto a punto (recogida y entrega en el mapa, sin comercio) a los repartidores cercanos. Apagado por defecto.' },
{ k: 'directo_texto', t: 'txt', l: 'Texto del botón (opcional)', d: 'Cómo se llama el botón y la pantalla en la app del cliente, p. ej. «Mandado». Vacío = «Enviar paquete». Máximo 30 caracteres.', max: 30 },
{ k: 'directo_por_distancia', t: 'sw', l: 'Cobrar el envío por distancia', d: 'El precio es base + precio por km × la distancia de la ruta, con la mínima abajo. Se ignora la tarifa fija directa y la app enseña el precio antes de pedir.' },
{ k: 'directo_base', t: 'num', l: 'Base (envío por distancia)' }, { k: 'directo_km', t: 'num', l: 'Precio por km (envío por distancia)' }, { k: 'directo_minima', t: 'num', l: 'Mínima (envío por distancia)' },
{ k: 'directo_fija', t: 'num', l: 'Tarifa fija directa', vacio: true, d: 'Vacío = se usa base + km + minutos.' }, { k: 'directo_sin_fee', t: 'sw', l: 'Sin service fee en envíos directos' },
{ h: 'Tarifa de servicio' },
{ k: 'fee_modo', t: 'sel', l: 'Modo Tarifa Servicio', op: [['porcentaje', 'Porcentaje'], ['fijo', 'Monto fijo']] }, { k: 'fee_valor', t: 'num', l: 'Tarifa Servicio (% o $)' },
{ k: 'fee_base', t: 'sel', l: 'Calcular el % sobre', op: [['productos', 'Sólo productos'], ['productos_envio', 'Productos + envío']], d: 'Con «Productos + envío», el porcentaje se aplica al subtotal más el costo de envío (antes de cupones o descuentos).' },
{ k: 'peajes', t: 'sw', l: 'Costos de peaje / casetas', d: 'Suma el costo de peajes de la ruta a la tarifa de envío. Desactivado por defecto.' },
{ k: 'tarifa_zona', t: 'sw', l: 'Usar la tarifa de la zona en el envío', d: 'Si una zona tiene tarifas personalizadas para el servicio de envíos, el envío se cobra con su tarifa. Si el comercio no tiene zona asignada, se usa la zona donde está el punto de recogida. Desactivado por defecto.' }] },
{ t: 'Propinas', c: [{ k: 'propina_tipo', t: 'sel', l: 'Tipo de Propina', op: [['porcentaje', 'Porcentaje'], ['monto', 'Monto fijo'], ['ninguna', 'Sin propinas']] }, { k: 'propina_opciones', t: 'tags', l: 'Opciones de Propina (valores predefinidos)' }] },
{ t: 'Límites', c: [
{ k: 'radio_km', t: 'num', l: 'Radio por defecto (Km)', d: 'Radio de entrega por defecto para negocios que no tienen uno propio. Si un negocio define su radio, ese prevalece.' },
{ k: 'aviso_sin_tomar', t: 'num', l: 'Avisar si nadie toma el pedido (min)', d: 'Si un pedido lleva estos minutos sin que ningún conductor lo tome, se avisa al panel. Vacío o 0 = desactivado.' },
{ k: 'cancelar_sin_repartidor', t: 'num', vacio: true, l: 'Cancelar pedidos sin repartidor tras (minutos)', d: 'Si el reparto de un pedido lleva estos minutos buscando y ningún repartidor lo toma, se cancela solo y se avisa al cliente y al comercio. Sólo aplica a pedidos sin cobro (efectivo); con este ajuste el cliente también puede cancelarlo él mismo pasado ese tiempo. Vacío = nunca.' },
{ k: 'minimo_tramos', t: 'tramos', l: 'Pedido mínimo por distancia', d: 'Exige un subtotal mínimo según la distancia de entrega. Rige el último tramo cuyo «desde» no supera la distancia. Sin tramos = sin mínimo por distancia. Si el comercio tiene su propio mínimo, rige el mayor. No aplica a recoger en tienda.' }] },
{ t: 'Opciones', c: [
{ k: 'retiro_local', t: 'sw', l: 'Retiro en Local', d: 'Valor por defecto de los negocios NUEVOS: permite que los clientes retiren su pedido en el local. Cada negocio tiene su propio interruptor y este ajuste no cambia los ya existentes.' },
{ k: 'aprob_negocio', t: 'sw', l: 'Aprobación de cambios de negocios', d: 'Los negocios que modifiquen su perfil necesitarán aprobación del administrador' },
{ k: 'aprob_menu', t: 'sw', l: 'Aprobación de cambios de menú', d: 'Los productos que un negocio cree, edite o elimine quedarán pendientes hasta que el administrador los apruebe en Delivery → Cambios de menú' },
{ k: 'pagos_comercios', t: 'sw', l: 'Pagos a comercios', d: 'Muestra la sección Pagos a comercios en el panel. Encenderlo no paga nada por sí solo: sólo se liquida a los comercios con calendario de pagos distinto de «Ninguno».' },
{ k: 'carga_masiva', t: 'sw', l: 'Carga masiva de productos (Excel/CSV)', d: 'Permite importar decenas de productos en lugar de cargarlos uno por uno.' },
{ k: 'solicitar_repartidor', t: 'sw', l: 'Solicitar repartidor (modo negocio)', d: 'Permite que los negocios soliciten un repartidor para clientes que pidieron por otro medio (teléfono, WhatsApp, local)' },
{ k: 'chat_soporte', t: 'sw', l: 'Chat de soporte con negocios', d: 'Habilita un canal directo entre tus negocios y vos (administrador).' },
{ k: 'zonas_busqueda', t: 'sw', l: 'Incluir zonas en la búsqueda de dirección', d: 'En el campo de dirección (Solicitar repartidor), además de direcciones reales se sugieren las zonas activas cuyo nombre coincida. Al seleccionar una zona se usa el centro de su polígono como punto de entrega.' }] },
{ t: 'Confirmaciones y evidencia', d: 'Códigos de confirmación y fotos de respaldo para cada entrega', c: [
{ k: 'aprobar_transferencias', t: 'sw', l: 'Aprobar transferencias recibidas por el negocio', d: 'Exige aprobar el pago antes de marcar el pedido como listo. No modifica pedidos creados antes de activar esta opción' },
{ k: 'aviso_comprobante', t: 'sw', l: 'Avisar cuando el cliente sube un comprobante de pago', d: 'Te llega un aviso a vos y al comercio. Sólo avisa: no aprueba ni mueve dinero. Apagado por defecto' },
{ k: 'foto_recoleccion', t: 'sw', l: 'Foto al recolectar en el negocio', d: 'El conductor debe tomar una foto del pedido al recogerlo' }, { k: 'foto_entrega', t: 'sw', l: 'Foto al entregar al cliente', d: 'El conductor debe tomar una foto al entregar el pedido' },
{ k: 'codigo_recoleccion', t: 'sw', l: 'Código de recolección en el negocio', d: 'El negocio ve un código en su panel y el repartidor debe dárselo al recoger el pedido. Apagá esta opción para que el repartidor confirme la recolección sin código' },
{ k: 'comercio_efectivo', t: 'sw', l: 'El comercio confirma el efectivo recibido', d: 'Permite que cada comercio marque en su portal «Efectivo recibido» en sus propios pedidos en efectivo. Revertir sigue siendo solo del administrador. Apagado por defecto' },
{ k: 'comercio_seguimiento', t: 'sw', l: 'El comercio comparte el enlace de seguimiento', d: 'Muestra en el portal de cada comercio un botón para enviar a su cliente el enlace de seguimiento en vivo del pedido. Apagado por defecto' },
{ k: 'comanda_desglose', t: 'sw', l: 'Comanda: mostrar desglose completo (envío, servicio, propina y total)', d: 'Apagado, la comanda sólo muestra el subtotal del negocio.' },
{ k: 'devolucion_codigo', t: 'sw', l: 'El repartidor devuelve la mercancía con código', d: 'Si un pedido se cancela cuando el repartidor ya lo recogió, el comercio ve un código de devolución. Mientras tanto el pedido figura como «Devolución pendiente». No cambia cobros ni comisiones.' },
{ k: 'gps_recoger', t: 'sw', l: 'Verificar GPS al recoger', d: 'Valida que el repartidor esté en la ubicación del negocio cuando marca el pedido como recogido.' },
{ k: 'codigo_cliente', t: 'sw', l: 'Código de confirmación del cliente', d: 'El cliente recibe un código que debe darle al conductor para confirmar la entrega' },
{ k: 'imagenes_completas', t: 'sw', l: 'Mostrar imágenes de producto completas', d: 'Las imágenes de productos y negocios se muestran completas (sin recortar). Útil cuando tus imágenes no son cuadradas' }] },
{ t: 'Opciones de cancelación', d: 'Define quién puede cancelar un pedido de entrega y en qué momento. Si una opción está desactivada, ese actor solo puede solicitar la cancelación en vez de cancelar directo.', c: [
{ k: 'cancel_cliente_antes', t: 'sw', l: 'Cliente cancela antes de aceptar', d: 'El cliente cancela directo si el comercio aún no aceptó el pedido' },
{ k: 'cancel_cliente_despues', t: 'sw', l: 'Cliente cancela tras aceptar', d: 'Tras aceptar, el cliente puede cancelar directo (si está desactivado, solo solicita la cancelación)' },
{ k: 'cancel_repartidor', t: 'sw', l: 'Repartidor cancela directo', d: 'El repartidor puede cancelar directo (si está desactivado, solo solicita la cancelación)' },
{ k: 'cancel_comercio', t: 'sw', l: 'Comercio cancela en proceso', d: 'El comercio puede cancelar un pedido en proceso (si está desactivado, solo solicita la cancelación)' },
{ k: 'cancel_solo_admin', t: 'sw', l: 'Solo el admin finaliza en proceso', d: 'Cuando el pedido ya está en proceso, solo el administrador finaliza la cancelación' },
{ k: 'cancel_motivo', t: 'sw', l: 'Exigir motivo', d: 'Pide un motivo al solicitar o cancelar un pedido' },
{ k: 'cancel_reembolso', t: 'sw', l: 'Reembolso de tarjeta al cancelar (admin)', d: 'Reembolsa automáticamente el pago con tarjeta cuando el administrador cancela el pedido' },
{ k: 'cancel_recogido', t: 'sel', l: 'Cancelar un pedido ya recogido desde la app', op: [['nadie', 'Nadie (solo el administrador)'], ['cliente', 'El cliente'], ['comercio', 'El comercio'], ['ambos', 'Cliente y comercio']], d: 'Quién puede cancelar (o solicitar cancelar) un pedido cuando el repartidor ya lo recogió. No genera adeudo al repartidor ni crédito al comercio: eso sigue siendo manual.' },
{ k: 'adeudo_recogido', t: 'sw', l: 'Adeudo al repartidor si se cancela con el pedido recogido', d: 'Al cancelar un pedido que el repartidor ya recogió, se le anota un adeudo por el subtotal de los productos. Se anula cuando devuelve la mercancía.' },
{ k: 'cobrar_al_aceptar', t: 'sw', l: 'Cobrar al aceptar el negocio (no al confirmar)', d: 'Difiere el cobro con tarjeta hasta que el negocio acepta el pedido. Solo aplica a pagos con tarjeta' },
{ k: 'comercio_login', t: 'sw', l: 'Entrada de comercios con correo y contraseña', d: 'Habilita el portal de comercios (comercio.html) con email y contraseña.' },
{ k: 'reversa_tarjeta', t: 'sw', l: 'Reversa al medio de pago (tarjeta)', d: 'Al cancelar un pedido pagado con tarjeta en línea, revierte el cobro a la tarjeta original. Desactivado: el reembolso siempre va al monedero' }] },
{ t: 'Servicios por defecto', d: 'Cuando se cree un negocio nuevo, se le asignarán estos servicios automáticamente. Después se puede personalizar por negocio desde su ficha.', c: [
{ k: 'servicios_negocio', t: 'svc', l: 'Servicios para solicitar repartidor (desde el negocio)', d: 'Aparecen en la pantalla “Solicitar repartidor” del lado del comercio.' },
{ k: 'servicios_cliente', t: 'svc', l: 'Servicios para pedidos de cliente (delivery)', d: 'Aparecen en la app del cliente cuando ordena desde un negocio.' }] },
{ t: 'Conciliación de efectivo por remisión', d: 'Cómo se salda la deuda del repartidor al registrar la remisión de efectivo', c: [
{ k: 'remision_recarga', t: 'sw', l: 'El repartidor compensa recargando (no entrega el efectivo)', d: 'Activado: el repartidor conserva el efectivo cobrado y compensa su deuda recargando su cuenta. Desactivado (predeterminado): el repartidor entrega el efectivo físicamente.' }] },
];
ruta('dlv-configuracion', {
titulo: 'Configuración de Delivery', roles: ['admin'], async render(main) {
const c = { ...(await cfg(true)) };
main.innerHTML = cabecera('Configuración de Delivery', 'Administrá las configuraciones de delivery de Remises TOQUE!', '<button class="btn verde" id="g">💾 Guardar cambios</button>') + '<div id="secs"></div><div style="text-align:right;margin:10px 0 30px"><button class="btn verde" id="g2">💾 Guardar cambios</button></div>';
const cont = $('#secs');
SECCIONES.forEach(s => {
const sec = h(`<div class="dlv-sec"><div class="hd"><h3>${esc(s.t)}</h3>${s.d ? `<p>${esc(s.d)}</p>` : ''}</div><div class="bd"></div></div>`); const bd = $('.bd', sec);
s.c.forEach(x => {
if (x.h) return bd.append(h(`<div style="padding:14px 0 4px;border-bottom:1px solid #f1f4f5"><b style="color:var(--pri-2)">${esc(x.h)}</b>${x.d ? `<br><small style="color:var(--suave)">${esc(x.d)}</small>` : ''}</div>`));
const v = c[x.k]; let ctl = '';
if (x.t === 'sw') ctl = `<label class="dlv-sw"><input type="checkbox" data-k="${x.k}" ${v ? 'checked' : ''}><span></span></label>`;
else if (x.t === 'num') ctl = `<input type="number" step="any" data-k="${x.k}" data-n="1" ${x.vacio ? 'data-v="1"' : ''} value="${v == null ? '' : esc(v)}">`;
else if (x.t === 'txt') ctl = `<input data-k="${x.k}" maxlength="${x.max || 200}" value="${esc(v || '')}">`;
else if (x.t === 'sel') ctl = `<select data-k="${x.k}">${x.op.map(o => `<option value="${o[0]}" ${String(o[0]) === String(v) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
else if (x.t === 'neg') ctl = `<select data-k="${x.k}" data-n="1" data-v="1"><option value="">—</option>${(D.negocios || []).map(n => `<option value="${n.id}" ${+v === n.id ? 'selected' : ''}>${esc(n.nombre)}</option>`).join('')}</select>`;
else if (x.t === 'svc') ctl = `<label class="check"><input type="checkbox" data-svc="${x.k}" ${(v || []).includes('entrega') ? 'checked' : ''}> Entrega</label>`;
const op = h(`<div class="dlv-op"><div class="tx"><b>${esc(x.l)}</b>${x.d ? `<small>${esc(x.d)}</small>` : ''}</div><div class="ctl">${ctl}</div></div>`);
if (x.t === 'tags') { const d = h('<div style="width:100%"></div>'); op.querySelector('.ctl').remove(); op.querySelector('.tx').append(d); tags(d, x.k); }
if (x.t === 'tramos') { const d = h('<div style="width:100%;margin-top:6px"></div>'); op.querySelector('.ctl').remove(); op.querySelector('.tx').append(d); tramos(d); }
bd.append(op);
});
cont.append(sec);
});
function tags(d, k) {
const pin = () => { d.innerHTML = (c[k] || []).map((x, i) => `<span class="dlv-chip">${esc(x)}${c.propina_tipo === 'monto' ? '' : '%'}<button data-i="${i}">×</button></span>`).join('') + '<input type="number" placeholder="Agregar" style="width:100px;margin-left:6px"> <button class="btn sec chico">Agregar</button>';
$$('button[data-i]', d).forEach(b => b.onclick = () => { c[k].splice(+b.dataset.i, 1); pin(); });
const inp = $('input', d); $('.btn', d).onclick = () => { if (inp.value !== '') { c[k] = [...(c[k] || []), +inp.value].sort((a, b) => a - b); pin(); } }; };
pin();
}
function tramos(d) {
const pin = () => { const t = c.minimo_tramos || [];
d.innerHTML = (t.length ? `<table class="t">${t.map((x, i) => `<tr><td>Desde <input type="number" step="0.1" data-t="${i}" data-c="desde_km" value="${x.desde_km}" style="width:90px"> km</td><td>mínimo $ <input type="number" data-t="${i}" data-c="minimo" value="${x.minimo}" style="width:110px"></td><td><button class="btn-icono" data-q="${i}">🗑</button></td></tr>`).join('')}</table>` : '<small style="color:var(--suave)">Sin tramos: no se exige pedido mínimo por distancia.</small>') + '<div><button class="btn sec chico" id="at">+ Agregar tramo</button></div>';
$$('[data-t]', d).forEach(i => i.oninput = () => { t[+i.dataset.t][i.dataset.c] = +i.value; });
$$('[data-q]', d).forEach(b => b.onclick = () => { t.splice(+b.dataset.q, 1); pin(); });
$('#at', d).onclick = () => { c.minimo_tramos = [...t, { desde_km: t.length ? t[t.length - 1].desde_km + 2 : 0, minimo: 0 }]; pin(); }; };
pin();
}
const guardar = async () => {
$$('[data-k]', main).forEach(i => { const k = i.dataset.k; if (i.type === 'checkbox') c[k] = i.checked; else if (i.dataset.n) c[k] = i.value === '' ? (i.dataset.v ? null : 0) : +i.value; else c[k] = i.value; });
$$('[data-svc]', main).forEach(i => c[i.dataset.svc] = i.checked ? ['entrega'] : []);
try { const r = await dapi('r_dlv_config_guardar', {}, c); D.cfg = r.config; toast('Configuración de delivery guardada', 'ok'); construirNav(); } catch (e) { fallo(e); }
};
$('#g').onclick = $('#g2').onclick = guardar;
}
});
})();
