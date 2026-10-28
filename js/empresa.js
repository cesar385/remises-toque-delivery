// App para empresas (empresa.html): viajes corporativos a cuenta corriente.
// Pedir y reservar · Viajes en curso con mapa en vivo · Historial y resumen mensual · Equipo (pasajeros y lugares) · Cuenta
(function () {
  const $ = (s, e = document) => e.querySelector(s), $$ = (s, e = document) => [...e.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pesos = n => n == null || n === '' ? '—' : '$ ' + Math.round(+n).toLocaleString('es-AR');
  const km1 = x => x == null || x === '' ? '—' : (Math.round(+x * 10) / 10).toLocaleString('es-AR');
  const LS = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { } }, del: k => { try { localStorage.removeItem(k); } catch { } } };
  const NATIVO = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const E = { tk: LS.get('rodar_emp_token'), ini: null, vista: null, timers: [], mapa: null, capa: null };
  const fh = t => { const m = String(t || '').match(/(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/); return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : ''; };
  const fhl = t => { const m = String(t || '').match(/(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : ''; };
  const iniciales = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

  function toast(m, t) { let c = $('#toasts'); if (!c) { c = document.createElement('div'); c.id = 'toasts'; document.body.append(c); } const e = document.createElement('div'); e.className = 'toast ' + (t || ''); e.textContent = m; c.append(e); setTimeout(() => e.remove(), 4200); }
  window.toast = toast;
  async function api(url, body, metodo) {
    try { return await RODAR.llamar(url, metodo || (body === undefined ? 'GET' : 'POST'), body, E.tk); }
    catch (e) { if (e.status === 401 || /sesi[oó]n|no es de una empresa|inactiva/i.test(e.message || '')) { if (E.tk) { salir(true); } } throw e; }
  }
  function salir(silencio) {
    if (!silencio) RODAR.llamar('/api/logout', 'POST', {}, E.tk).catch(() => { });
    E.tk = null; LS.del('rodar_emp_token'); E.timers.forEach(clearInterval); E.timers = []; login();
    if (silencio) toast('Tu sesión terminó. Volvé a ingresar.');
  }
  function modal(titulo, cuerpo, botones) {
    const f = document.createElement('div'); f.className = 'modal-f';
    f.innerHTML = `<div class="modal"><div class="mh"><h3>${titulo}</h3><button aria-label="Cerrar">×</button></div><div class="mb">${cuerpo}</div>${botones ? `<div class="mf">${botones}</div>` : ''}</div>`;
    document.body.append(f); const cerrar = () => f.remove();
    $('.mh button', f).onclick = cerrar; f.addEventListener('mousedown', e => { if (e.target === f) cerrar(); });
    return { el: f, cerrar };
  }

  // ---------------- Ingreso ----------------
  function login() {
    document.title = 'Remises TOQUE! · Empresas';
    $('#app').innerHTML = `<div class="login"><form class="caja" id="fl" autocomplete="on">
      <img src="img/logo.png" alt="Remises TOQUE!"><span class="tag">🏢 EMPRESAS</span>
      <p class="sub">Viajes de tu equipo a <b>cuenta corriente</b>.</p>
      <ul class="ventajas"><li>Pedí y reservá viajes para cualquier persona de tu empresa.</li><li>Seguí los viajes en curso en el mapa.</li><li>Historial y resumen mensual para facturar.</li></ul>
      <div class="campo"><label>Usuario de la empresa</label><input name="usuario" autocomplete="username" autocapitalize="none" required></div>
      <div class="campo"><label>Contraseña</label><div class="pass"><input name="password" id="pw" type="password" autocomplete="current-password" required><button type="button" id="ver" aria-label="Ver contraseña">👁</button></div></div>
      <div class="err" id="err"></div>
      <button class="btn grande" id="ok">Ingresar</button>
      <p class="pie">¿Tu empresa todavía no tiene cuenta? Pedila a la central.</p>
      <div class="ing-pie">
        <div class="ing-tit">¿Necesitás ayuda?</div>
        <div class="ing-grid">
          <a href="index.html"><span class="ic">🏠</span><b>Inicio</b><small>Página web</small></a>
          <a href="ayuda.html"><span class="ic">💬</span><b>Ayuda</b><small>Escribinos</small></a>
          <a href="terminos.html?para=pasajeros&de=empresa.html"><span class="ic">📜</span><b>Términos</b><small>Uso de la app</small></a>
          <a href="terminos.html?para=privacidad&de=empresa.html"><span class="ic">🔒</span><b>Privacidad</b><small>Tus datos</small></a>
        </div>
        <div class="ing-tit">Defensa del consumidor</div>
        <div class="ing-legal">
          <a href="baja.html?tipo=arrepentimiento&de=empresa.html">↩️ Botón de arrepentimiento</a>
          <a href="baja.html?tipo=baja&de=empresa.html">⛔ Botón de baja de servicio</a>
        </div>
      </div>
      <div id="inst" style="display:flex;justify-content:center"></div></form></div>`;
    botonInstalar($('#inst'), 'btn sec chico', '📲 Instalar la app');
    $('#ver').onclick = () => { const p = $('#pw'); p.type = p.type === 'password' ? 'text' : 'password'; };
    $('#fl').onsubmit = async e => {
      e.preventDefault(); const er = $('#err'); er.style.display = 'none'; const b = $('#ok'); b.disabled = true; b.textContent = 'Ingresando…';
      try {
        const r = await RODAR.llamar('/api/login', 'POST', { usuario: e.target.usuario.value.trim(), password: e.target.password.value, tipo: 'empresa' }, null);
        if (!String(r.usuario.roles || '').includes('corporativo')) { RODAR.llamar('/api/logout', 'POST', {}, r.token).catch(() => { }); throw new Error('Este usuario no es de una empresa. Si sos pasajero, usá la app de pasajeros.'); }
        // se verifica que el usuario esté asociado a una empresa activa antes de guardar la sesión
        try { await RODAR.llamar('/api/emp/inicio', 'GET', null, r.token); }
        catch (y) { RODAR.llamar('/api/logout', 'POST', {}, r.token).catch(() => { }); throw new Error(/no es de una empresa|ninguna empresa/i.test(y.message) ? 'Tu usuario no está asociado a ninguna empresa. La central tiene que crearte un usuario de empresa (Administración → Clientes corporativos → 👤 Crear usuario de acceso).' : y.message); }
        E.tk = r.token; LS.set('rodar_emp_token', r.token); await arrancar();
      } catch (x) { er.textContent = x.message; er.style.display = 'block'; b.disabled = false; b.textContent = 'Ingresar'; }
    };
  }

  // ---------------- App ----------------
  const VISTAS = [['pedir', '🚕', 'Pedir'], ['curso', '🗺', 'En curso'], ['historial', '🧾', 'Historial'], ['equipo', '👥', 'Equipo'], ['cuenta', '🏢', 'Cuenta']];
  async function arrancar() {
    try { E.ini = await api('/api/emp/inicio'); } catch (e) { if (E.tk) { toast(e.message, 'error'); } return login(); }
    RODAR.llamar('/api/pub/config', 'GET', null, null).catch(() => { });
    const emp = E.ini.empresa, u = E.ini.usuario;
    document.title = emp.nombre + ' · TOQUE! Empresas';
    $('#app').innerHTML = `<div class="top"><img src="img/logo-blanco.png" alt="Remises TOQUE!"><div class="emp"><b>🏢 ${esc(emp.nombre)}</b><small>${esc((u.nombre || '') + ' ' + (u.apellido || ''))} · Cuenta corriente</small></div><span class="esp"></span>
      <nav class="tabs">${VISTAS.map(([k, i, t]) => `<button data-v="${k}"><span class="ic">${i}</span>${t}${k === 'curso' ? '<span class="badge" id="bdg"></span>' : ''}</button>`).join('')}</nav></div>
      <div class="cuerpo" id="cuerpo"><div class="panel" id="panel"></div><div class="mapa-box"><div id="mapa"></div></div></div>`;
    E.mapa = L.map('mapa', { zoomControl: true, dobleClicAcerca: true }).setView([E.ini.central.lat, E.ini.central.lng], 14);
    capaBase(E.mapa); E.capa = L.layerGroup().addTo(E.mapa);
    $$('.tabs button').forEach(b => b.onclick = () => ir(b.dataset.v));
    pintarBadge();
    E.timers.push(setInterval(async () => { try { E.ini.activos = await api('/api/emp/activos'); pintarBadge(); if (E.vista === 'curso') curso(true); } catch { } }, 10000));
    const v = (location.hash.match(/^#\/(\w+)/) || [])[1];
    ir(VISTAS.some(x => x[0] === v) ? v : (E.ini.activos.length ? 'curso' : 'pedir'));
  }
  function pintarBadge() { const b = $('#bdg'); if (b) b.textContent = (E.ini.activos || []).length || ''; }
  function ir(v) {
    E.vista = v; history.replaceState({}, '', '#/' + v);
    $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    const conMapa = v === 'pedir' || v === 'curso';
    $('#cuerpo').classList.toggle('sin-mapa', !conMapa);
    E.capa.clearLayers(); E.mapa.off('click');
    if (conMapa) setTimeout(() => E.mapa.invalidateSize(), 50);
    ({ pedir, curso, historial, equipo, cuenta })[v]();
  }

  // ---------------- Pedir / reservar ----------------
  const P = { pas: null, o: null, d: null, modo: 'o', prog: false, mk: {}, linea: null };
  function pedir() {
    const pas = E.ini.pasajeros, lug = E.ini.lugares;
    $('#panel').innerHTML = `<h2 class="tit">Pedir un remís</h2><p class="sub">El viaje queda a <span class="cc">🏢 cuenta corriente de ${esc(E.ini.empresa.nombre)}</span></p>
      <div class="card"><div class="paso"><i>1</i><b>¿Quién viaja?</b></div><div id="pasBox"></div></div>
      <div class="card"><div class="paso"><i>2</i><b>¿Desde dónde y hacia dónde?</b></div>
        <div class="dir"><span class="pt o"></span><div class="buscador"><input id="oIn" placeholder="Origen: calle y altura" autocomplete="off"><div class="sug oculto" id="oSug"></div></div><button class="mp" id="oMp" title="Marcar el origen tocando el mapa">📍</button></div>
        ${lug.length ? `<div class="chips" id="oLug">${lug.map(l => `<button type="button" data-l="${l.id}">📍 ${esc(l.etiqueta)}</button>`).join('')}</div>` : ''}
        <div class="campo" style="margin:8px 0 10px"><input id="ref" placeholder="Referencias para el conductor (portón, piso, oficina…)"></div>
        <div class="dir"><span class="pt d"></span><div class="buscador"><input id="dIn" placeholder="Destino: calle y altura" autocomplete="off"><div class="sug oculto" id="dSug"></div></div><button class="mp" id="dMp" title="Marcar el destino tocando el mapa">📍</button></div>
        ${lug.length ? `<div class="chips" id="dLug">${lug.map(l => `<button type="button" data-l="${l.id}">📍 ${esc(l.etiqueta)}</button>`).join('')}</div>` : ''}
        <p class="ayuda">También podés tocar 📍 y marcar el lugar en el mapa.</p></div>
      <div class="card"><div class="paso"><i>3</i><b>¿Cuándo?</b></div><div class="seg"><button type="button" data-c="ahora" class="${P.prog ? '' : 'on'}">🚕 Ahora</button><button type="button" data-c="prog" class="${P.prog ? 'on' : ''}">📅 Reservar</button></div>
        <div class="campo ${P.prog ? '' : 'oculto'}" id="progBox" style="margin-top:8px"><label>Día y hora</label><input id="prog" type="datetime-local"></div>
        <div class="campo" style="margin-top:10px"><label>Centro de costo (opcional)</label><input id="cc" list="ccList" placeholder="Ej: Ventas, Administración"><datalist id="ccList">${(E.ini.centros || []).map(c => `<option value="${esc(c)}">`).join('')}</datalist></div></div>
      <div class="est" id="est"><div><small>Precio estimado</small><b id="estM">—</b><small id="estD">Elegí origen y destino</small></div><span class="cc">Cuenta corriente</span></div>
      <div class="err" id="err"></div>
      <button class="btn verde grande" id="pedirB">Pedir remís</button>`;
    pintarPasajero();
    autocompletar($('#oIn'), $('#oSug'), x => fijar('o', x));
    autocompletar($('#dIn'), $('#dSug'), x => fijar('d', x));
    $('#oIn').onfocus = () => modoMapa('o'); $('#dIn').onfocus = () => modoMapa('d');
    $('#oMp').onclick = () => modoMapa('o', true); $('#dMp').onclick = () => modoMapa('d', true);
    const lugar = id => { const l = E.ini.lugares.find(x => x.id === +id); return l && { direccion: l.direccion, lat: l.lat, lng: l.lng, ref: l.referencias }; };
    $$('#oLug [data-l]').forEach(b => b.onclick = () => fijar('o', lugar(b.dataset.l)));
    $$('#dLug [data-l]').forEach(b => b.onclick = () => fijar('d', lugar(b.dataset.l)));
    $$('[data-c]').forEach(b => b.onclick = () => { P.prog = b.dataset.c === 'prog'; $$('[data-c]').forEach(x => x.classList.toggle('on', x === b)); $('#progBox').classList.toggle('oculto', !P.prog); $('#pedirB').textContent = P.prog ? 'Reservar remís' : 'Pedir remís'; });
    $('#pedirB').textContent = P.prog ? 'Reservar remís' : 'Pedir remís';
    E.mapa.on('click', e => marcarEn(P.modo, e.latlng.lat, e.latlng.lng));
    if (P.o) fijar('o', P.o, true); if (P.d) fijar('d', P.d, true);
    $('#pedirB').onclick = enviarPedido;
  }
  // Marca un punto ya mismo y después completa la dirección (la búsqueda inversa puede tardar)
  const inversa = (lat, lng) => Promise.race([RODAR.llamar(`/api/pub/geocodificar/inversa?lat=${lat}&lng=${lng}`, 'GET', null, null).catch(() => null), new Promise(r => setTimeout(() => r(null), 6000))]);
  async function marcarEn(c, lat, lng) {
    fijar(c, { direccion: 'Buscando la dirección…', lat, lng });
    const x = await inversa(lat, lng); if (E.vista !== 'pedir' || !P[c] || P[c].lat !== +lat) return;
    P[c].direccion = (x && x.direccion) || `Punto en el mapa (${(+lat).toFixed(5)}, ${(+lng).toFixed(5)})`; P[c].localidad = x && x.localidad; P[c].provincia = x && x.provincia;
    const inp = $('#' + c + 'In'); if (inp) inp.value = P[c].direccion;
  }
  function modoMapa(c, aviso) { if (!$('#oMp')) return; P.modo = c; $('#oMp').classList.toggle('on', c === 'o'); $('#dMp').classList.toggle('on', c === 'd'); if (aviso) toast(c === 'o' ? 'Tocá el mapa donde busca el remís' : 'Tocá el mapa en el destino'); }
  function pintarPasajero() {
    const box = $('#pasBox'); if (!box) return;
    if (P.pas) {
      box.innerHTML = `<div class="pas-sel"><span class="av">${esc(iniciales(P.pas.nombre))}</span><div><b>${esc(P.pas.nombre)}</b><small>${esc(P.pas.telefono)}${P.pas.centro_costo ? ' · ' + esc(P.pas.centro_costo) : ''}</small></div><button class="btn sec chico x" id="pasX">Cambiar</button></div>`;
      $('#pasX').onclick = () => { P.pas = null; pintarPasajero(); };
      if (P.pas.centro_costo && $('#cc') && !$('#cc').value) $('#cc').value = P.pas.centro_costo;
      return;
    }
    const pas = E.ini.pasajeros;
    box.innerHTML = `${pas.length ? `<div class="buscador"><input id="pasQ" placeholder="🔎 Buscar en el equipo (${pas.length})" autocomplete="off"><div class="sug oculto" id="pasSug"></div></div>
      <div class="chips">${pas.slice(0, 6).map(p => `<button type="button" data-p="${p.id}">${esc(p.nombre.split(' ')[0])}</button>`).join('')}</div>
      <div style="text-align:center;color:var(--suave);font-size:13px;margin:10px 0 6px">— o un pasajero nuevo —</div>` : ''}
      <div class="dos"><div class="campo"><label>Nombre y apellido</label><input id="pN" autocomplete="off"></div><div class="campo"><label>Celular</label><input id="pT" type="tel" inputmode="tel" placeholder="3454 123456"></div></div>
      <label class="chk" style="margin-top:8px"><input type="checkbox" id="pG" checked> Guardar en el equipo para la próxima</label>
      <p class="ayuda">Después del pedido, desde "En curso" le podés compartir el seguimiento y el PIN por WhatsApp.</p>`;
    const elegir = id => { P.pas = E.ini.pasajeros.find(p => p.id === +id); pintarPasajero(); };
    $$('[data-p]', box).forEach(b => b.onclick = () => elegir(b.dataset.p));
    const q = $('#pasQ'); if (q) { const sug = $('#pasSug');
      q.oninput = () => { const t = q.value.trim().toLowerCase(); const r = E.ini.pasajeros.filter(p => !t || (p.nombre + ' ' + p.telefono + ' ' + (p.centro_costo || '')).toLowerCase().includes(t)).slice(0, 8);
        sug.innerHTML = r.map(p => `<div data-p="${p.id}"><b>${esc(p.nombre)}</b><small>${esc(p.telefono)}${p.centro_costo ? ' · ' + esc(p.centro_costo) : ''}</small></div>`).join('') || '<div style="color:var(--suave)">Sin resultados</div>';
        sug.classList.remove('oculto'); $$('[data-p]', sug).forEach(d => d.onmousedown = () => elegir(d.dataset.p)); };
      q.onfocus = q.oninput; q.onblur = () => setTimeout(() => sug.classList.add('oculto'), 200); }
  }
  function autocompletar(inp, sug, alElegir) {
    let t, res = [];
    inp.oninput = () => { clearTimeout(t); const v = inp.value.trim(); if (v.length < 4) return sug.classList.add('oculto');
      t = setTimeout(async () => { try { res = await RODAR.llamar('/api/pub/geocodificar?q=' + encodeURIComponent(v), 'GET', null, null); } catch { res = []; }
        sug.innerHTML = res.slice(0, 7).map((x, i) => `<div data-i="${i}"><b>${esc(x.direccion)}</b><small>${esc([x.localidad, x.provincia].filter(Boolean).join(', '))}${x.aprox ? ' · aproximada' : ''}</small></div>`).join('') || '<div style="color:var(--suave)">No la encontramos: probá con calle y altura o tocá el mapa</div>';
        sug.classList.remove('oculto'); $$('[data-i]', sug).forEach(d => d.onmousedown = () => { sug.classList.add('oculto'); alElegir(res[+d.dataset.i]); }); }, 350); };
    inp.onblur = () => setTimeout(() => sug.classList.add('oculto'), 200);
  }
  function fijar(c, x, quieto) {
    if (!x || E.vista !== 'pedir') return; P[c] = { direccion: x.direccion, localidad: x.localidad, provincia: x.provincia, lat: +x.lat, lng: +x.lng, ref: x.ref };
    const inp = $('#' + c + 'In'); if (inp) inp.value = x.direccion;
    if (c === 'o' && x.ref && $('#ref') && !$('#ref').value) $('#ref').value = x.ref;
    if (P.mk[c]) P.mk[c].remove();
    P.mk[c] = L.marker([P[c].lat, P[c].lng], { draggable: true, icon: L.divIcon({ className: '', html: `<div style="width:22px;height:22px;border-radius:50%;background:${c === 'o' ? '#278449' : '#2a86e8'};border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(E.capa);
    P.mk[c].on('dragend', e => { const p = e.target.getLatLng(); marcarEn(c, p.lat, p.lng); });
    if (c === 'o' && !P.d) modoMapa('d');
    estimar(quieto);
  }
  let estN = 0;
  async function estimar(quieto) {
    const n = ++estN; if (P.linea) { P.linea.remove(); P.linea = null; }
    if (!P.o || !P.d) { if (P.o && !quieto) E.mapa.setView([P.o.lat, P.o.lng], 16); return; }
    const rt = await RODAR.ruta(P.o, P.d).catch(() => null); if (n !== estN) return;
    P.metros = rt ? rt.metros : null;
    P.linea = L.polyline(rt ? rt.coords : [[P.o.lat, P.o.lng], [P.d.lat, P.d.lng]], rt ? { color: '#1d6fe0', weight: 5, opacity: .8 } : { color: '#555', weight: 3, dashArray: '6' }).addTo(E.capa);
    E.mapa.fitBounds(P.linea.getBounds().pad(.2));
    const r = await RODAR.llamar('/api/pub/estimar', 'POST', { origen_lat: P.o.lat, origen_lng: P.o.lng, destino_lat: P.d.lat, destino_lng: P.d.lng, medio_pago: 'cuenta_corriente', metros_ruta: P.metros }, null).catch(() => null);
    if (!r || !$('#estM')) return;
    $('#estM').textContent = r.monto != null ? pesos(r.monto) : 'Desde ' + pesos(r.bajada);
    $('#estD').textContent = r.monto != null ? `${km1(r.km)} km aprox. · se factura el importe final del viaje` : 'Se cobra lo que marca el reloj';
  }
  async function enviarPedido() {
    const er = $('#err'); er.style.display = 'none'; const fallar = m => { er.textContent = m; er.style.display = 'block'; er.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    const pas = P.pas || { nombre: ($('#pN') || {}).value?.trim(), telefono: ($('#pT') || {}).value?.trim() };
    if (!pas.nombre) return fallar('Elegí un pasajero del equipo o escribí el nombre de quien viaja');
    if (String(pas.telefono || '').replace(/\D/g, '').length < 8) return fallar('Escribí el celular del pasajero, con característica');
    if (!P.o) return fallar('Indicá el origen: buscá la dirección, elegí un lugar o tocá el mapa');
    if (!P.d) return fallar('Indicá el destino');
    if (/^Buscando/.test(P.o.direccion + P.d.direccion)) return fallar('Esperá un segundo: estamos buscando la dirección del punto marcado');
    let programado = null;
    if (P.prog) { const v = $('#prog').value; if (!v) return fallar('Elegí el día y la hora de la reserva'); programado = v.replace('T', ' ') + ':00'; }
    const b = $('#pedirB'); b.disabled = true; b.textContent = 'Enviando…';
    try {
      const r = await api('/api/emp/pedir', { nombre: pas.nombre, telefono: pas.telefono, pasajero_id: P.pas ? P.pas.id : null, guardar: !P.pas && $('#pG') && $('#pG').checked,
        centro_costo: $('#cc').value.trim() || null, origen_dir: P.o.direccion, origen_loc: P.o.localidad, origen_prov: P.o.provincia, origen_lat: P.o.lat, origen_lng: P.o.lng, origen_ref: $('#ref').value.trim() || null,
        destino_dir: P.d.direccion, destino_loc: P.d.localidad, destino_lat: P.d.lat, destino_lng: P.d.lng, metros_ruta: P.metros, programado });
      toast(r.reserva ? `Reserva confirmada para ${fh(r.programado)}` : 'Pedido enviado: buscando un móvil', 'ok');
      Object.assign(P, { pas: null, o: null, d: null, prog: false, mk: {}, linea: null });
      E.ini = await api('/api/emp/inicio'); pintarBadge(); ir('curso');
    } catch (x) { fallar(x.message); b.disabled = false; b.textContent = P.prog ? 'Reservar remís' : 'Pedir remís'; }
  }

  // ---------------- En curso ----------------
  const EST = { reserva: ['📅 Reservado', '#7a4fb0'], pendiente: ['⏳ Buscando móvil', '#e8892b'], ofrecido: ['⏳ Buscando móvil', '#e8892b'], confirmado: ['🚕 En camino', '#2a86e8'], en_curso: ['🛣 En viaje', '#278449'], finalizado: ['✔ Finalizado', '#1b6e31'], anulado: ['✖ Cancelado', '#c0392b'] };
  function curso(refresco) {
    const vs = E.ini.activos || [];
    const lista = vs.map(v => { const [et, col] = v.estado === 'confirmado' && v.llego ? ['📍 Llegó, esperando', '#0f8b8d'] : (EST[v.estado] || [v.estado, '#888']);
      return `<div class="vj" style="--c:${col}" data-id="${v.id}"><div class="cab"><span class="est-v"><i></i>${et}</span><small style="color:var(--suave)">${v.estado === 'reserva' ? '📅 ' + fhl(v.programado) : 'Pedido ' + fh(v.creado)}</small></div>
        <div class="pas">${esc(v.pasajero || '')}<small>${esc(v.telefono || '')}</small></div>
        <div class="ruta"><div><i class="o"></i>${esc(v.origen_dir || '')}</div>${v.destino_dir ? `<div><i class="d"></i>${esc(v.destino_dir)}</div>` : ''}</div>
        ${v.movil_numero && ['confirmado', 'en_curso'].includes(v.estado) ? `<div class="mov"><span class="n">${v.movil_numero}</span><div>${esc([v.movil, v.patente].filter(Boolean).join(' · '))}<br><small>${esc(v.conductor || '')}</small></div><div class="pin"><small>PIN</small><b>${esc(v.pin || '')}</b></div></div>`
          : `<div class="mov"><span>⏱</span><div>${v.estado === 'reserva' ? 'La central asigna un móvil antes del horario' : 'Asignando el móvil más cercano…'}</div><div class="pin"><small>PIN</small><b>${esc(v.pin || '')}</b></div></div>`}
        <div class="fila" style="justify-content:space-between"><small style="color:var(--suave)">${v.centro_costo ? '🏷 ' + esc(v.centro_costo) + ' · ' : ''}${v.pedido_por ? 'Pidió ' + esc(v.pedido_por) : ''}</small><b>${pesos(v.monto)}</b></div>
        <div class="acc"><button class="btn sec chico" data-ver="${v.id}">🗺 Ver</button><button class="btn sec chico" data-comp="${v.id}">📤 Compartir seguimiento</button>${['reserva', 'pendiente', 'ofrecido', 'confirmado'].includes(v.estado) ? `<button class="btn rojo chico" data-canc="${v.id}">Cancelar</button>` : ''}</div></div>`; }).join('');
    $('#panel').innerHTML = `<div class="fila" style="justify-content:space-between"><h2 class="tit">Viajes en curso</h2><button class="btn sec chico" id="act">⟳ Actualizar</button></div>
      <p class="sub">Se actualiza solo cada 10 segundos.</p>${lista || `<div class="vacio"><div class="e">🚕</div><p>No hay viajes en curso ni reservas.</p><button class="btn verde" id="irPedir">Pedir un remís</button></div>`}`;
    if ($('#irPedir')) $('#irPedir').onclick = () => ir('pedir');
    $('#act').onclick = async () => { E.ini.activos = await api('/api/emp/activos'); pintarBadge(); curso(); };
    const byId = id => vs.find(x => x.id === +id);
    $$('[data-ver]').forEach(b => b.onclick = () => { const v = byId(b.dataset.ver); const p = v.lat ? [v.lat, v.lng] : [v.origen_lat, v.origen_lng]; if (p[0]) E.mapa.setView(p, 16); if (innerWidth < 860) scrollTo(0, 0); });
    $$('[data-comp]').forEach(b => b.onclick = () => { const v = byId(b.dataset.comp); const url = location.href.replace(/[^/]*$/, '') + `pasajero.html#/seguimiento/${v.id}?k=${v.k}`;
      compartirTexto('Seguimiento del remís', `🚕 ${E.ini.empresa.nombre} te pidió un remís${v.estado === 'reserva' ? ' para el ' + fhl(v.programado) : ''}.\n📍 ${v.origen_dir}${v.destino_dir ? ' → ' + v.destino_dir : ''}\n🔐 PIN para el conductor: ${v.pin}\nSeguilo en el mapa: ${url}`); });
    $$('[data-canc]').forEach(b => b.onclick = async () => { const v = byId(b.dataset.canc); if (!confirm(`¿Cancelar el ${v.estado === 'reserva' ? 'viaje reservado' : 'viaje'} de ${v.pasajero}?`)) return;
      try { await api(`/api/emp/viajes/${v.id}/cancelar`, {}); toast('Viaje cancelado', 'ok'); E.ini.activos = await api('/api/emp/activos'); pintarBadge(); curso(); } catch (x) { toast(x.message, 'error'); } });
    // mapa en vivo
    E.capa.clearLayers(); const pts = [];
    vs.forEach(v => {
      if (v.origen_lat) { L.circleMarker([v.origen_lat, v.origen_lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#278449', fillOpacity: 1 }).addTo(E.capa).bindTooltip(esc(v.pasajero) + ' · ' + esc(v.origen_dir)); pts.push([v.origen_lat, v.origen_lng]); }
      if (v.lat) { L.marker([v.lat, v.lng], { icon: L.divIcon({ className: '', html: `<div class="marc-movil">${v.movil_numero}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 500 }).addTo(E.capa).bindTooltip(`Móvil ${v.movil_numero} · ${esc(v.pasajero)}`); pts.push([v.lat, v.lng]); }
    });
    if (!refresco) { if (pts.length > 1) E.mapa.fitBounds(L.latLngBounds(pts).pad(.25)); else if (pts.length) E.mapa.setView(pts[0], 15); }
  }

  // ---------------- Historial ----------------
  const H = { desde: null, hasta: null, estado: '', centro: '', q: '', tab: 'viajes', data: null };
  async function historial() {
    if (!H.desde) { const d = new Date(); H.desde = new Date(d.getFullYear(), d.getMonth(), 1, 12).toISOString().slice(0, 10); H.hasta = hoyISO(); }
    $('#panel').innerHTML = `<div class="fila" style="justify-content:space-between;flex-wrap:wrap"><div><h2 class="tit">Historial y resumen</h2><p class="sub">Viajes a cuenta corriente de ${esc(E.ini.empresa.nombre)}.</p></div>
        <div class="fila no-print"><button class="btn sec chico" id="csv">⬇ CSV</button><button class="btn sec chico" id="imp">🖨 Resumen / PDF</button></div></div>
      <div class="card filtros"><div class="campo"><label>Desde</label><input type="date" id="hD" value="${H.desde}"></div><div class="campo"><label>Hasta</label><input type="date" id="hH" value="${H.hasta}"></div>
        <div class="campo"><label>Estado</label><select id="hE"><option value="">Todos</option><option value="finalizados">Finalizados</option><option value="anulados">Cancelados</option><option value="activos">En curso / reservas</option></select></div>
        <div class="campo"><label>Centro de costo</label><select id="hC"><option value="">Todos</option>${(E.ini.centros || []).map(c => `<option>${esc(c)}</option>`).join('')}</select></div>
        <div class="campo"><label>Buscar</label><input id="hQ" placeholder="Pasajero, dirección…" value="${esc(H.q)}"></div></div>
      <div class="chips no-print" style="margin:0 0 4px">${[['mes', 'Este mes'], ['ant', 'Mes anterior'], ['30', 'Últimos 30 días']].map(([k, t]) => `<button type="button" data-r="${k}">${t}</button>`).join('')}</div>
      <div id="hRes"><div class="vacio">Cargando…</div></div>`;
    $('#hE').value = H.estado; $('#hC').value = H.centro;
    const recargar = () => { H.desde = $('#hD').value; H.hasta = $('#hH').value; H.estado = $('#hE').value; H.centro = $('#hC').value; H.q = $('#hQ').value.trim(); cargarHist(); };
    ['hD', 'hH', 'hE', 'hC'].forEach(id => $('#' + id).onchange = recargar); let t; $('#hQ').oninput = () => { clearTimeout(t); t = setTimeout(recargar, 400); };
    $$('[data-r]', $('#panel')).forEach(b => b.onclick = () => { const d = new Date(); let a, z;
      if (b.dataset.r === 'mes') { a = new Date(d.getFullYear(), d.getMonth(), 1, 12); z = d; } else if (b.dataset.r === 'ant') { a = new Date(d.getFullYear(), d.getMonth() - 1, 1, 12); z = new Date(d.getFullYear(), d.getMonth(), 0, 12); } else { a = new Date(Date.now() - 29 * 864e5); z = d; }
      $('#hD').value = a.toISOString().slice(0, 10); $('#hH').value = b.dataset.r === 'ant' ? z.toISOString().slice(0, 10) : hoyISO(); recargar(); });
    $('#csv').onclick = csvHist; $('#imp').onclick = imprimirHist;
    cargarHist();
  }
  async function cargarHist() {
    try { H.data = await api('/api/emp/viajes?' + new URLSearchParams({ desde: H.desde, hasta: H.hasta, estado: H.estado, centro: H.centro, q: H.q }).toString()); } catch (x) { $('#hRes').innerHTML = `<div class="vacio">${esc(x.message)}</div>`; return; }
    pintarHist();
  }
  function pintarHist() {
    const d = H.data, t = d.totales;
    const est = v => `<span class="chip-e ${v.estado === 'finalizado' ? 'fin' : v.estado === 'anulado' ? 'anu' : 'act'}">${esc((EST[v.estado] || [v.estado])[0])}</span>`;
    const tabla = H.tab === 'viajes' ? `<table><thead><tr><th>Fecha</th><th>Pasajero</th><th>Recorrido</th><th>Centro</th><th>Móvil</th><th class="r">Km</th><th>Estado</th><th class="r">Importe</th><th class="no-print"></th></tr></thead><tbody>
        ${d.filas.map(v => `<tr><td>${fhl(v.creado)}</td><td><b>${esc(v.pasajero || '')}</b><br><small style="color:var(--suave)">${esc(v.telefono || '')}</small></td><td class="w">${esc(v.origen_dir || '')}${v.destino_dir ? ' → ' + esc(v.destino_dir) : ''}</td><td>${esc(v.centro_costo || '—')}</td><td>${v.movil_numero && !['pendiente', 'ofrecido', 'reserva'].includes(v.estado) ? v.movil_numero : '—'}</td><td class="r">${v.km != null ? km1(v.km) : '—'}</td><td>${est(v)}</td><td class="r"><b>${v.estado === 'anulado' ? '—' : pesos(v.monto)}</b></td><td class="no-print">${v.estado === 'finalizado' ? `<button class="btn sec chico" data-tk="${v.id}" title="Ver el ticket del viaje">🧾 Ticket</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--suave);padding:24px">Sin viajes en el período.</td></tr>'}</tbody></table>`
      : H.tab === 'pasajeros' ? `<table><thead><tr><th>Pasajero</th><th>Celular</th><th class="r">Viajes</th><th class="r">Km</th><th class="r">Importe</th></tr></thead><tbody>${d.por_pasajero.map(p => `<tr><td><b>${esc(p.nombre)}</b></td><td>${esc(p.telefono)}</td><td class="r">${p.viajes}</td><td class="r">${km1(p.km)}</td><td class="r"><b>${pesos(p.monto)}</b></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--suave);padding:24px">Sin viajes finalizados.</td></tr>'}</tbody></table>`
      : `<table><thead><tr><th>Centro de costo</th><th class="r">Viajes</th><th class="r">Importe</th><th class="r">% del total</th></tr></thead><tbody>${d.por_centro.map(c => `<tr><td><b>${esc(c.centro)}</b></td><td class="r">${c.viajes}</td><td class="r"><b>${pesos(c.monto)}</b></td><td class="r">${t.monto ? Math.round(c.monto * 100 / t.monto) : 0}%</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--suave);padding:24px">Sin viajes finalizados.</td></tr>'}</tbody></table>`;
    $('#hRes').innerHTML = `<div class="kpis"><div class="kpi"><small>Viajes realizados</small><b>${t.viajes}</b></div><div class="kpi" style="--c:var(--ve)"><small>Total a facturar</small><b>${pesos(t.monto)}</b></div>
        <div class="kpi" style="--c:#2a86e8"><small>Km recorridos</small><b>${km1(t.km)}</b></div><div class="kpi" style="--c:var(--rojo)"><small>Cancelados</small><b>${t.anulados}</b></div></div>
      <div class="seg no-print" style="grid-template-columns:repeat(3,1fr);margin-bottom:10px">${[['viajes', '🧾 Viajes'], ['pasajeros', '👤 Por pasajero'], ['centros', '🏷 Por centro de costo']].map(([k, x]) => `<button type="button" data-t="${k}" class="${H.tab === k ? 'on' : ''}">${x}</button>`).join('')}</div>
      <div class="tabla-w">${tabla}</div>`;
    $$('[data-t]', $('#hRes')).forEach(b => b.onclick = () => { H.tab = b.dataset.t; pintarHist(); });
    $$('[data-tk]', $('#hRes')).forEach(b => b.onclick = () => ticketEmp(d.filas.find(v => v.id === +b.dataset.tk)));
  }
  // Ticket del viaje (mismo comprobante que ven el pasajero y el conductor)
  function ticketEmp(v) {
    if (!v) return; const c = E.ini.central || {};
    abrirComprobante({ ...v, movil_patente: v.patente }, { numero: false, cliente: [v.pasajero, v.centro_costo && '(' + v.centro_costo + ')'].filter(Boolean).join(' '), empresa: { nombre: c.nombre, telefono: c.telefono } });
  }
  function csvHist() {
    if (!H.data) return; const x = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = [['Fecha', 'Pasajero', 'Celular', 'Origen', 'Destino', 'Centro de costo', 'Móvil', 'Km', 'Estado', 'Importe', 'Pedido por'], ...H.data.filas.map(v => [fhl(v.creado), v.pasajero, v.telefono, v.origen_dir, v.destino_dir, v.centro_costo, v.movil_numero, v.km, (EST[v.estado] || [v.estado])[0].replace(/^\S+\s/, ''), v.estado === 'anulado' ? '' : v.monto, v.pedido_por])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + filas.map(f => f.map(x).join(';')).join('\n')], { type: 'text/csv' })); a.download = `viajes-${E.ini.empresa.nombre.replace(/\W+/g, '-').toLowerCase()}-${H.desde}-a-${H.hasta}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  // Resumen de viajes a cuenta corriente: PDF sobre la hoja membretada, dentro de la misma ventana
  async function imprimirHist() {
    if (!H.data) return; const d = H.data, t = d.totales, e = E.ini.empresa, b = $('#imp'), tx = b.textContent;
    const f = x => x.split('-').reverse().join('/'), fin = d.filas.filter(v => v.estado === 'finalizado');
    b.disabled = true; b.textContent = '⏳ Generando…';
    try {
      const pdf = await pdfMembretado({
        titulo: 'RESUMEN DE CUENTA CORRIENTE', derecha: ['VIAJES', String(t.viajes)],
        sub: [e.nombre, e.cuit ? 'CUIT ' + e.cuit : '', `Período del ${f(H.desde)} al ${f(H.hasta)}`, 'Emitido el ' + new Date().toLocaleDateString('es-AR')].filter(Boolean).join('  ·  '),
        cajas: [['VIAJES REALIZADOS', String(t.viajes), ''], ['TOTAL DEL PERÍODO', pesos(t.monto), 'azul'], ['KM RECORRIDOS', km1(t.km), ''], ['CANCELADOS', String(t.anulados), t.anulados ? 'rojo' : '']],
        tablas: [
          { titulo: 'Por centro de costo', cols: [{ t: 'Centro de costo', w: 100 }, { t: 'Viajes', w: 25, r: 1 }, { t: 'Importe', w: 35, r: 1 }], filas: d.por_centro.map(c => ({ v: [c.centro, String(c.viajes), pesos(c.monto)] })), vacio: 'Sin viajes realizados.' },
          { titulo: 'Por pasajero', cols: [{ t: 'Pasajero', w: 80 }, { t: 'Viajes', w: 22, r: 1 }, { t: 'Km', w: 22, r: 1 }, { t: 'Importe', w: 34, r: 1 }], filas: d.por_pasajero.map(x => ({ v: [x.nombre || x.telefono || '—', String(x.viajes), km1(x.km), pesos(x.monto)] })), vacio: 'Sin viajes realizados.' },
          { titulo: 'Detalle de viajes', cols: [{ t: 'Fecha', w: 26 }, { t: 'Pasajero', w: 30 }, { t: 'Recorrido', w: 64 }, { t: 'Centro', w: 22 }, { t: 'Móvil', w: 12, r: 1 }, { t: 'Km', w: 12, r: 1 }, { t: 'Importe', w: 24, r: 1 }],
            filas: [...fin.map(v => ({ v: [fhl(v.creado), v.pasajero || '', [v.origen_dir, v.destino_dir].filter(Boolean).join(' – '), v.centro_costo || '—', v.movil_numero || '—', v.km != null ? km1(v.km) : '—', pesos(v.monto)] })),
              ...(fin.length ? [{ total: 1, v: ['', '', 'Total del período', '', '', km1(t.km), pesos(t.monto)] }] : [])], vacio: 'Sin viajes realizados en el período.' },
        ],
        nota: 'Resumen informativo. La factura la emite la central de Remises TOQUE!',
      });
      verPdf(pdf, `resumen-cuenta-${e.nombre.replace(/\W+/g, '-').toLowerCase()}-${H.desde}-a-${H.hasta}.pdf`, 'Resumen de cuenta corriente · ' + e.nombre);
    } catch (x) { toast(x.message, 'error'); } finally { b.disabled = false; b.textContent = tx; }
  }

  // ---------------- Equipo: pasajeros y lugares ----------------
  function equipo() {
    const pas = E.ini.pasajeros, lug = E.ini.lugares;
    $('#panel').innerHTML = `<h2 class="tit">Equipo</h2><p class="sub">Guardá a las personas que viajan seguido y los lugares de la empresa para pedir más rápido.</p>
      <div class="grid2"><div class="card"><div class="fila" style="justify-content:space-between"><h3 style="margin:0">👤 Pasajeros (${pas.length})</h3><button class="btn chico" id="addP">+ Agregar</button></div>
        ${pas.length > 6 ? '<input id="eqQ" placeholder="🔎 Buscar…" style="margin-top:10px">' : ''}
        <div class="lista-e" id="lP">${pas.map(p => `<div class="it" data-n="${esc((p.nombre + ' ' + p.telefono + ' ' + (p.centro_costo || '')).toLowerCase())}"><span class="av">${esc(iniciales(p.nombre))}</span><div class="tx"><b>${esc(p.nombre)}</b><small>${esc(p.telefono)}${p.centro_costo ? ' · 🏷 ' + esc(p.centro_costo) : ''}</small></div>
          <button class="btn sec chico" data-pedir="${p.id}">🚕</button><button class="btn sec chico" data-ed="${p.id}">✎</button></div>`).join('') || '<div class="vacio" style="padding:16px">Todavía no guardaste pasajeros. También se guardan al pedir un viaje.</div>'}</div></div>
      <div class="card"><div class="fila" style="justify-content:space-between"><h3 style="margin:0">📍 Lugares (${lug.length})</h3><button class="btn chico" id="addL">+ Agregar</button></div>
        <div class="lista-e">${lug.map(l => `<div class="it"><span class="av">📍</span><div class="tx"><b>${esc(l.etiqueta)}</b><small>${esc(l.direccion)}${l.referencias ? ' · ' + esc(l.referencias) : ''}</small></div><button class="btn sec chico" data-qL="${l.id}">🗑</button></div>`).join('') || '<div class="vacio" style="padding:16px">Agregá la oficina, la planta, el aeropuerto…</div>'}</div></div></div>`;
    const q = $('#eqQ'); if (q) q.oninput = () => { const t = q.value.trim().toLowerCase(); $$('#lP .it').forEach(i => i.style.display = !t || i.dataset.n.includes(t) ? '' : 'none'); };
    $('#addP').onclick = () => editarPasajero({});
    $$('[data-ed]').forEach(b => b.onclick = () => editarPasajero(pas.find(p => p.id === +b.dataset.ed)));
    $$('[data-pedir]').forEach(b => b.onclick = () => { P.pas = pas.find(p => p.id === +b.dataset.pedir); ir('pedir'); });
    $('#addL').onclick = nuevoLugar;
    $$('[data-qL]').forEach(b => b.onclick = async () => { if (!confirm('¿Quitar este lugar?')) return; try { await api('/api/emp/lugar', { id: +b.dataset.ql, quitar: true }); await recargarIni(); equipo(); } catch (x) { toast(x.message, 'error'); } });
  }
  async function recargarIni() { E.ini = await api('/api/emp/inicio'); pintarBadge(); }
  function editarPasajero(p) {
    const m = modal(p.id ? 'Editar pasajero' : 'Nuevo pasajero', `<div class="campo"><label>Nombre y apellido</label><input id="eN" value="${esc(p.nombre || '')}"></div>
      <div class="campo"><label>Celular</label><input id="eT" type="tel" inputmode="tel" value="${esc(p.telefono || '')}"></div>
      <div class="campo"><label>Centro de costo (opcional)</label><input id="eC" list="ccL2" value="${esc(p.centro_costo || '')}"><datalist id="ccL2">${(E.ini.centros || []).map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="campo"><label>Notas (opcional)</label><input id="eO" value="${esc(p.notas || '')}" placeholder="Ej: gerente, viaja a planta los lunes"></div>`,
      `${p.id ? '<button class="btn rojo" id="eQ">Quitar</button><span style="flex:1"></span>' : ''}<button class="btn sec" id="eX">Cancelar</button><button class="btn" id="eG">Guardar</button>`);
    $('#eX', m.el).onclick = m.cerrar;
    $('#eG', m.el).onclick = async () => { try { await api('/api/emp/pasajero', { id: p.id || null, nombre: $('#eN', m.el).value.trim(), telefono: $('#eT', m.el).value, centro_costo: $('#eC', m.el).value.trim() || null, notas: $('#eO', m.el).value.trim() || null }); m.cerrar(); toast('Guardado', 'ok'); await recargarIni(); equipo(); } catch (x) { toast(x.message, 'error'); } };
    if (p.id) $('#eQ', m.el).onclick = async () => { if (!confirm(`¿Quitar a ${p.nombre} del equipo? Sus viajes quedan en el historial.`)) return; try { await api('/api/emp/pasajero', { id: p.id, quitar: true }); m.cerrar(); await recargarIni(); equipo(); } catch (x) { toast(x.message, 'error'); } };
  }
  function nuevoLugar() {
    let elegido = null;
    const m = modal('Nuevo lugar', `<div class="campo"><label>Nombre del lugar</label><input id="lE" placeholder="Ej: Oficina central, Planta, Aeropuerto"></div>
      <div class="campo"><label>Dirección</label><div class="buscador"><input id="lD" placeholder="Calle y altura" autocomplete="off"><div class="sug oculto" id="lS"></div></div></div>
      <div class="campo"><label>Referencias (opcional)</label><input id="lR" placeholder="Portón, piso, recepción…"></div><p class="ayuda" id="lOk"></p>`,
      '<button class="btn sec" id="lX">Cancelar</button><button class="btn" id="lG">Guardar</button>');
    autocompletar($('#lD', m.el), $('#lS', m.el), x => { elegido = x; $('#lD', m.el).value = x.direccion; $('#lOk', m.el).textContent = '✔ ' + [x.direccion, x.localidad].filter(Boolean).join(', '); });
    $('#lX', m.el).onclick = m.cerrar;
    $('#lG', m.el).onclick = async () => { if (!elegido) return toast('Elegí la dirección de la lista de sugerencias', 'error');
      try { await api('/api/emp/lugar', { etiqueta: $('#lE', m.el).value.trim(), direccion: elegido.direccion, referencias: $('#lR', m.el).value.trim() || null, lat: elegido.lat, lng: elegido.lng }); m.cerrar(); toast('Lugar guardado', 'ok'); await recargarIni(); equipo(); } catch (x) { toast(x.message, 'error'); } };
  }

  // ---------------- Cuenta ----------------
  function cuenta() {
    const e = E.ini.empresa, u = E.ini.usuario, c = E.ini.central;
    $('#panel').innerHTML = `<h2 class="tit">Cuenta</h2><p class="sub">Datos de la empresa y de tu usuario.</p>
      <div class="card" id="ccE"><h3>💳 Cuenta corriente</h3><div class="vacio">Cargando…</div></div>
      <div class="grid2"><div class="card"><h3>🏢 Empresa</h3><div class="info-c"><span>Nombre</span><b>${esc(e.nombre)}</b>${e.cuit ? `<span>CUIT</span><b>${esc(e.cuit)}</b>` : ''}${e.centro_costo ? `<span>Centro de costo</span><b>${esc(e.centro_costo)}</b>` : ''}${e.contacto ? `<span>Contacto</span><b>${esc(e.contacto)}</b>` : ''}${e.telefono ? `<span>Teléfono</span><b>${esc(e.telefono)}</b>` : ''}<span>Forma de pago</span><b>Cuenta corriente</b></div>
          <p class="ayuda">Para cambiar estos datos o sumar usuarios, comunicate con la central.</p></div>
        <div class="card"><h3>👤 Tu usuario</h3><div class="info-c"><span>Nombre</span><b>${esc((u.nombre || '') + ' ' + (u.apellido || ''))}</b>${u.email ? `<span>Email</span><b>${esc(u.email)}</b>` : ''}${u.telefono ? `<span>Teléfono</span><b>${esc(u.telefono)}</b>` : ''}</div>
          <button class="btn rojo grande" id="salir" style="margin-top:14px">🚪 Cerrar sesión</button></div>
        <div class="card"><h3>📞 Central de Remises TOQUE!</h3><div class="info-c">${c.telefono ? `<span>Teléfono</span><b><a href="tel:${esc(c.telefono)}">${esc(c.telefono)}</a></b>` : ''}</div>
          <p class="ayuda">Ante cualquier problema con un viaje, llamá a la central o escribí desde la página de ayuda.</p><a class="btn sec chico" href="ayuda.html?tipo=Consulta">💬 Escribir a la central</a></div>
        <div class="card"><h3>📲 La app</h3><p class="ayuda" style="margin-top:0">Instalala en la computadora o en el celular para tenerla a mano.</p><div id="inst2"></div>
          <p style="margin:12px 0 0"><a href="terminos.html?para=pasajeros&de=empresa.html%23%2Fcuenta" style="color:var(--az);font-weight:700">📜 Términos y condiciones</a></p></div>
        <div class="card"><h3>⚖️ Defensa del consumidor</h3><p class="ayuda" style="margin-top:0">Revocar un servicio contratado que todavía no se prestó o dar de baja la cuenta de la empresa, sin trámites previos. Te damos un código de identificación.</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px"><a class="btn sec chico" href="baja.html?tipo=arrepentimiento&de=empresa.html%23%2Fcuenta">↩️ Botón de arrepentimiento</a><a class="btn sec chico" href="baja.html?tipo=baja&de=empresa.html%23%2Fcuenta">⛔ Botón de baja de servicio</a></div></div></div>`;
    ctaCte();
    botonInstalar($('#inst2'), 'btn sec chico', '📲 Instalar la app');
    if (/Android/i.test(navigator.userAgent) && !NATIVO) { const a = document.createElement('a'); a.className = 'btn sec chico'; a.style.marginLeft = '6px'; a.href = 'https://remisestoque.com/apk/toque-empresa.apk'; a.textContent = '⬇ App Android (APK)'; $('#inst2').append(a); }
    if (!$('#inst2').children.length) $('#inst2').innerHTML = `<small style="color:var(--suave)">${window.appInstalada && appInstalada() ? '✔ Ya está instalada.' : NATIVO ? '✔ Estás usando la app.' : 'Desde Chrome: menú ⋮ → Instalar app.'}</small>`;
    $('#salir').onclick = () => { if (confirm('¿Cerrar la sesión de la empresa en este dispositivo?')) salir(); };
  }

  async function ctaCte() {
    const box = $('#ccE'); let d;
    try { d = await api('/api/emp/cuenta'); } catch (x) { if (box) box.innerHTML = `<h3>💳 Cuenta corriente</h3><div class="vacio">${esc(x.message)}</div>`; return; }
    if (!document.body.contains(box)) return;
    const $$ = n => '$ ' + Math.round(Math.abs(+n || 0)).toLocaleString('es-AR'), f = x => x ? new Date(String(x).length === 10 ? x + 'T12:00' : x).toLocaleDateString('es-AR') : '';
    const pagos = d.movimientos.slice().reverse().slice(0, 8), liqs = d.liquidaciones.slice(0, 6), TIP = { pago: '💵 Pago', nota_credito: '🧾 Nota de crédito', ajuste: '✏️ Ajuste' };
    box.innerHTML = `<h3>💳 Cuenta corriente</h3>
      <div class="cc-sal ${d.saldo > 0 ? 'debe' : ''}"><small>Saldo actual</small><b>${$$(d.saldo)}</b><span>${d.saldo > 0 ? 'Saldo a pagar a la central' : d.saldo < 0 ? 'Saldo a favor de la empresa' : 'Cuenta al día ✔'}</span></div>
      <h4>Liquidaciones</h4>${liqs.length ? `<table class="cc-t"><tr><th>N°</th><th>Período</th><th class="r">Viajes</th><th class="r">Total período</th><th class="r">Saldo</th><th></th></tr>${liqs.map((l, i) => `<tr><td>${l.numero}</td><td>${f(l.desde)} al ${f(l.hasta)}${l.factura ? `<br><small>Factura ${esc(l.factura)}</small>` : ''}</td><td class="r">${l.viajes}</td><td class="r">${$$(l.monto)}</td><td class="r"><b>${$$(l.saldo)}</b></td><td><button class="btn sec chico" data-l="${i}">🖨️</button></td></tr>`).join('')}</table>` : '<p class="ayuda">Todavía no hay períodos cerrados.</p>'}
      <h4>Pagos y créditos recientes</h4>${pagos.length ? `<table class="cc-t">${pagos.map(m => `<tr><td>${f(m.fecha)}</td><td>${TIP[m.tipo] || esc(m.tipo)}${m.medio ? ' · ' + esc(m.medio) : ''}${m.comprobante ? `<br><small>Comp. ${esc(m.comprobante)}</small>` : ''}</td><td class="r" style="color:${+m.monto < 0 ? '#1b6e31' : '#9b1c1c'};font-weight:700">${+m.monto < 0 ? '' : '+ '}${$$(m.monto)}</td></tr>`).join('')}</table>` : '<p class="ayuda">No hay pagos registrados en los últimos meses.</p>'}
      <p class="ayuda">Los viajes de la empresa se cargan a esta cuenta. Para coordinar un pago, comunicate con la central.</p>
      <button class="btn sec chico" id="ccPdf">🖨 Estado de cuenta (PDF)</button>`;
    box.querySelectorAll('[data-l]').forEach(b => b.onclick = () => imprimirLiq(d, liqs[+b.dataset.l]));
    $('#ccPdf').onclick = () => imprimirCuenta(d);
  }
  // Liquidación y estado de cuenta: PDF sobre la hoja membretada, dentro de la misma ventana
  const fd = x => x ? new Date(String(x).length === 10 ? x + 'T12:00' : x).toLocaleDateString('es-AR') : '';
  async function imprimirLiq(d, l) {
    const e = d.empresa;
    try {
      const pdf = await pdfMembretado({
        titulo: 'LIQUIDACIÓN DE CUENTA CORRIENTE', derecha: ['N°', String(l.numero)],
        sub: [e.nombre, e.cuit ? 'CUIT ' + e.cuit : '', `Período del ${fd(l.desde)} al ${fd(l.hasta)}`, l.factura ? 'Factura ' + l.factura : '', 'Emitido el ' + new Date().toLocaleDateString('es-AR')].filter(Boolean).join('  ·  '),
        cajas: [['SALDO ANTERIOR', pesos(l.saldo_anterior), ''], [`VIAJES (${l.viajes})`, pesos(l.monto), 'azul'], ['PAGOS Y CRÉDITOS', pesos(Math.abs(+l.pagos || 0)), 'verde'], ['SALDO AL CIERRE', pesos(l.saldo), +l.saldo > 0 ? 'rojo' : 'verde']],
        cols: [{ t: 'Concepto', w: 120 }, { t: 'Importe', w: 40, r: 1 }],
        filas: [{ v: ['Saldo anterior', pesos(l.saldo_anterior)] }, { v: [`Viajes del período (${l.viajes})`, pesos(l.monto)] }, { v: ['Pagos y créditos', '- ' + pesos(Math.abs(+l.pagos || 0))], col: [null, 'verde'] }, { total: 1, v: ['Saldo al cierre', pesos(l.saldo)] }],
        nota: 'El detalle de los viajes está en Historial → Resumen. Documento no válido como factura.',
      });
      verPdf(pdf, `liquidacion-${l.numero}-${e.nombre.replace(/\W+/g, '-').toLowerCase()}.pdf`, 'Liquidación N° ' + l.numero + ' · ' + e.nombre);
    } catch (x) { toast(x.message, 'error'); }
  }
  async function imprimirCuenta(d) {
    const e = d.empresa, TIP = { pago: 'Pago', nota_credito: 'Nota de crédito', ajuste: 'Ajuste' }, s = +d.saldo;
    try {
      const pdf = await pdfMembretado({
        titulo: 'ESTADO DE CUENTA CORRIENTE', derecha: ['SALDO', pesos(Math.abs(s))],
        sub: [e.nombre, e.cuit ? 'CUIT ' + e.cuit : '', 'Al ' + new Date().toLocaleDateString('es-AR')].filter(Boolean).join('  ·  '),
        cajas: [['SALDO ACTUAL', pesos(Math.abs(s)), s > 0 ? 'rojo' : 'verde'], ['SITUACIÓN', s > 0 ? 'A pagar a la central' : s < 0 ? 'A favor de la empresa' : 'Al día', ''], ['VIAJES EN CURSO / RESERVAS', String((d.en_curso || []).length), 'azul']],
        tablas: [
          { titulo: 'Liquidaciones', cols: [{ t: 'N°', w: 12 }, { t: 'Período', w: 50 }, { t: 'Factura', w: 30 }, { t: 'Viajes', w: 16, r: 1 }, { t: 'Total período', w: 28, r: 1 }, { t: 'Saldo', w: 28, r: 1 }],
            filas: d.liquidaciones.map(l => ({ v: [String(l.numero), `${fd(l.desde)} al ${fd(l.hasta)}`, l.factura || '—', String(l.viajes), pesos(l.monto), pesos(l.saldo)] })), vacio: 'Todavía no hay períodos cerrados.' },
          { titulo: 'Pagos, notas de crédito y ajustes', cols: [{ t: 'Fecha', w: 24 }, { t: 'Concepto', w: 30 }, { t: 'Detalle', w: 80 }, { t: 'Importe', w: 30, r: 1 }],
            filas: d.movimientos.map(m => ({ v: [fd(m.fecha), TIP[m.tipo] || m.tipo, [m.medio, m.comprobante && 'Comp. ' + m.comprobante, m.detalle].filter(Boolean).join(' · '), (+m.monto < 0 ? '- ' : '+ ') + pesos(Math.abs(+m.monto))], col: [null, null, null, +m.monto < 0 ? 'verde' : 'rojo'] })), vacio: 'No hay pagos registrados en los últimos meses.' },
        ],
        nota: 'Documento no válido como factura. Para coordinar un pago comunicate con la central.',
      });
      verPdf(pdf, `estado-de-cuenta-${e.nombre.replace(/\W+/g, '-').toLowerCase()}.pdf`, 'Estado de cuenta · ' + e.nombre);
    } catch (x) { toast(x.message, 'error'); }
  }

  // ---------------- inicio ----------------
  if (!window.RODAR || !RODAR.listo) { $('#app').innerHTML = '<p style="padding:20px">Falta configurar config.js.</p>'; return; }
  if (E.tk) arrancar(); else login();
})();
