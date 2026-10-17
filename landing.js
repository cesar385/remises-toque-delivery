// Página principal: contenido original, dibujado de secciones y utilidades (lo usan index.html y el editor del panel).
(function () {
  const DEFAULT = {
    whatsapp: '', whatsapp_texto: 'Hola, quiero pedir un remís', telefono: '', pie: '',
    secciones: [
      { id: 'inicio', tipo: 'hero', visible: true, menu: '', titulo: 'Tu remís', destacado: 'a un click', texto: 'Pedí tu viaje desde el celular, seguilo en tiempo real y pagá como prefieras. ¿Querés manejar? Sumate a nuestra flota.',
        boton: { t: 'Pedí tu remís', u: 'pasajero.html' }, boton2: { t: 'Quiero ser conductor', u: 'conductor.html#alta' } },
      { id: 'pasajeros', tipo: 'texto', visible: true, menu: 'Pasajero', titulo: 'Conectá tu próximo viaje con TOQUE! Pasajero', texto: 'Elegí de dónde salís y a dónde vas. El sistema ofrece el viaje al móvil más cercano y te avisa cuando está en camino.',
        bullets: [], boton: { t: 'Pedir un viaje', u: 'pasajero.html' }, boton2: { t: 'Crear mi cuenta', u: 'pasajero.html#/ingresar' }, visual: 'celular', emoji: '', imagen: '', lado: 'der', fondo: 'blanco' },
      { id: 'como', tipo: 'tarjetas', visible: true, menu: '', titulo: '¿Cómo querés usar TOQUE!?', texto: 'Cada perfil tiene su propia pantalla de ingreso.', fondo: 'gris', items: [
        { emoji: '🙂', titulo: 'Pasajero', texto: 'Pedí un viaje, guardá tus lugares y mirá tus viajes anteriores.', cta: 'Pedir o ingresar →', url: 'pasajero.html' },
        { emoji: '🚕', titulo: 'Conductor', texto: 'Recibí viajes, cambiá tu estado y controlá tu cuenta desde el celular.', cta: 'Ingresar →', url: 'conductor.html' },
        { emoji: '🏢', titulo: 'Empresa', texto: 'Viajes a cuenta corriente para tu equipo, con ingreso de empresas.', cta: 'Ingreso empresas →', url: 'pasajero.html#/ingresar' },
        { emoji: '🎧', titulo: 'Operador', texto: 'Central de despacho, mapa, informes y administración de la flota.', cta: 'Ingresar →', url: 'panel.html#/login' }] },
      { id: 'conductores', tipo: 'texto', visible: true, menu: 'Conductor', titulo: 'Manejá con TOQUE! Conductor', texto: 'Sumate a la flota y recibí viajes en tu celular, sin radio ni llamadas.',
        bullets: ['Los viajes te llegan como oferta: aceptás o rechazás con un toque.', 'Cola por parada: el primero en llegar es el primero en recibir viajes.', 'Consultá tu saldo y movimientos, y pedí cargas por Mercado Pago o transferencia.', 'Soporte directo con la central desde la app.'],
        boton: { t: 'Registrate como conductor', u: 'conductor.html#alta' }, boton2: { t: '', u: '' }, visual: 'emoji', emoji: '🚕', imagen: '', lado: 'izq', fondo: 'blanco' },
      { id: 'empresas', tipo: 'texto', visible: true, menu: 'Empresas', titulo: 'Viajes para tu empresa', texto: 'Si tu empresa tiene cuenta corriente, tus viajes quedan a su cargo y con centro de costo.',
        bullets: ['Ingreso propio para empresas desde el pedido web.', 'Seguimiento de cada viaje en tiempo real.', 'Pedí a la central si necesitás alta de cuenta.'],
        boton: { t: 'Ingreso para empresas', u: 'pasajero.html#/ingresar' }, boton2: { t: '', u: '' }, visual: 'emoji', emoji: '🏢', imagen: '', lado: 'der', fondo: 'gris' },
      { id: 'seguridad', tipo: 'banner', visible: true, menu: 'Seguridad', emoji: '🛡️', titulo: 'En TOQUE!, tu seguridad es nuestra prioridad', texto: 'Seguimiento del viaje en tiempo real, datos del móvil y del conductor antes de subir y botón de emergencia en la app del conductor.',
        boton: { t: 'Saber más', u: '#ayuda' } },
      { id: 'ayuda', tipo: 'tarjetas', visible: true, menu: 'Ayuda', titulo: 'Todo lo que necesitás saber', texto: '', fondo: 'gris', items: [
        { emoji: 'ℹ️', titulo: 'Sobre nosotros', texto: 'Servicio de remís con despacho centralizado.', cta: 'Saber más →', url: '#como' },
        { emoji: '💬', titulo: 'Centro de ayuda', texto: 'Escribinos desde el botón Ayuda del pedido web y te respondemos.', cta: 'Ir a ayuda →', url: 'pasajero.html' },
        { emoji: '🔐', titulo: 'Ingresar', texto: 'Elegí tu perfil: pasajero, conductor u operador.', cta: 'Ver ingresos →', url: 'ingresar.html' }] },
    ],
  };

  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Solo enlaces seguros: páginas del sitio, anclas, http(s), mailto, tel y WhatsApp.
  function url(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^(https?:\/\/|mailto:|tel:)/i.test(u) || /^[\w\-./]+\.html?(#.*)?$/i.test(u) || /^#[\w\-/]*$/.test(u) || /^[\w\-./]*#\/?[\w\-/?=&]*$/.test(u)) return u;
    return '';
  }
  const dataImg = s => (/^(data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s"'<>]+)$/i.test(String(s || '')) ? s : '');
  const slug = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seccion';
  const btn = (b, cls) => (b && b.t && url(b.u) ? `<a class="btn ${cls || ''}" href="${esc(url(b.u))}">${esc(b.t)}</a>` : '');

  function visual(s) {
    if (s.visual === 'celular') return `<div class="cel" aria-hidden="true"><div class="barra">Pedí tu remís</div><div class="mapa"><div class="pin"></div></div><div class="campo">Origen<b>San Martín 450</b></div><div class="campo">Destino<b>Terminal de ómnibus</b></div><div class="ok">Pedir ahora</div></div>`;
    if (s.visual === 'imagen' && dataImg(s.imagen)) return `<img class="foto-img" src="${esc(dataImg(s.imagen))}" alt="${esc(s.titulo)}" loading="lazy">`;
    if (s.visual === 'ninguno') return '';
    return `<div class="foto" aria-hidden="true">${esc(s.emoji || '🚕')}</div>`;
  }

  function seccion(s) {
    const id = esc(s.id || slug(s.titulo));
    if (s.tipo === 'hero') return `<section class="hero" id="${id}" style="padding:0"><div class="w"><div><h1>${esc(s.titulo)} <em>${esc(s.destacado)}</em></h1><p>${esc(s.texto)}</p><div class="acc">${btn(s.boton)}${btn(s.boton2, 'sec')}</div></div><img class="logo" src="img/logo-blanco.png" alt=""></div></section>`;
    if (s.tipo === 'tarjetas') return `<section class="${s.fondo === 'gris' ? 'gris' : ''}" id="${id}"><div class="w"><h2>${esc(s.titulo)}</h2>${s.texto ? `<p class="lead">${esc(s.texto)}</p>` : ''}<div class="cards">${(s.items || []).map(i => {
      const u = url(i.url); const inner = `<span class="ico">${esc(i.emoji)}</span><b>${esc(i.titulo)}</b><span class="d">${esc(i.texto)}</span>${i.cta ? `<span class="mas">${esc(i.cta)}</span>` : ''}`;
      return u ? `<a class="card" href="${esc(u)}">${inner}</a>` : `<div class="card">${inner}</div>`; }).join('')}</div></div></section>`;
    if (s.tipo === 'banner') return `<section id="${id}"><div class="w"><div class="seg"><div class="e">${esc(s.emoji)}</div><div><h2>${esc(s.titulo)}</h2><p>${esc(s.texto)}</p></div>${btn(s.boton)}</div></div></section>`;
    // texto + imagen
    const vis = visual(s); const bul = (s.bullets || []).filter(Boolean);
    const txt = `<div><h2>${esc(s.titulo)}</h2>${s.texto ? `<p class="lead">${esc(s.texto)}</p>` : ''}${bul.length ? `<ul class="lista">${bul.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}${btn(s.boton)}${btn(s.boton2, 'sec') ? ' ' + btn(s.boton2, 'sec') : ''}</div>`;
    return `<section class="${s.fondo === 'gris' ? 'gris' : ''}" id="${id}"><div class="w ${vis ? 'dos' : ''} ${s.lado === 'izq' ? 'inv' : ''}">${txt}${vis}</div></section>`;
  }

  // Une lo guardado con los valores por defecto (por si faltan campos)
  function normalizar(cfg) {
    const c = cfg && Array.isArray(cfg.secciones) ? cfg : DEFAULT;
    return { whatsapp: c.whatsapp || '', whatsapp_texto: c.whatsapp_texto || DEFAULT.whatsapp_texto, telefono: c.telefono || '', pie: c.pie || '', secciones: c.secciones };
  }
  const soloDigitos = n => String(n || '').replace(/\D/g, '');
  const waLink = (num, texto) => { const d = soloDigitos(num); return d ? `https://wa.me/${d}${texto ? '?text=' + encodeURIComponent(texto) : ''}` : ''; };

  window.RODAR_LANDING = { DEFAULT, esc, url, dataImg, slug, seccion, normalizar, waLink, soloDigitos,
    clonarDefault: () => JSON.parse(JSON.stringify(DEFAULT)) };
})();
