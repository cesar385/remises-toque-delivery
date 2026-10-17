// Mapa operativo y vistas de mapa (zonas, peligrosas, demanda, recorrido)

ruta('mapa', {
  titulo: 'Mapa', roles: ['operador'], async render(body) {
    document.title = 'Mapa · Remises TOQUE!';
    const filtrosEstado = new Set(Object.keys(ESTADOS_MOVIL));
    body.innerHTML = `<div class="pantalla">
      <div class="leyenda"><button class="btn-icono" id="capas" title="Capas" style="color:#fff">☰</button>${Object.entries(ESTADOS_MOVIL).map(([k, [t, c]]) => `<span data-e="${k}" style="background:${c}">${t}</span>`).join('')}
        <span style="background:#7a4fb0" data-x="deuda">Con deuda</span><span style="background:#a33" data-x="sinsaldo">Sin saldo</span>
        <span style="margin-left:auto;background:transparent" id="act">Sin actividad</span><button class="btn chico naranja" id="audio">🔊 Activar audio</button></div>
      <div class="mapa-area"><div id="mapa"></div>
        <div class="flotante panel-moviles"><div class="fh">Móviles <span id="cntM"></span></div><div style="display:flex;gap:4px;padding:8px 8px 0"><input id="bm" placeholder="Nro móvil" type="number"><button class="btn chico" id="bmb">🔍</button></div><div class="chips" id="chips"></div></div>
        <div class="flotante panel-paradas"><div class="fh">Paradas</div><div class="lista" id="paradas"></div></div>
        <div class="flotante panel-viajes" id="pv"><div class="fh"><span>Viajes en proceso <span class="badge" id="cntV">0</span></span><span class="fila" style="gap:6px"><input id="bv" placeholder="Buscar…" style="min-height:26px;width:160px;color:#000"><select id="fv" style="min-height:26px;width:auto;color:#000"><option value="">Todos</option><option value="central">Central</option><option value="calle">Calle</option></select><button class="btn-icono" style="color:#fff" id="minv">▁</button></span></div>
          <div class="tabla-wrap"><table class="t"><thead><tr><th>N°</th><th>Canal</th><th>Cliente</th><th>Pedido</th><th>Estado</th><th>Tiempo</th><th>Móvil N°</th><th class="r">Monto</th><th>Dirección</th><th>Zona</th><th></th></tr></thead><tbody id="tv"></tbody></table></div></div>
        <button class="ptt" id="ptt" title="Mantener apretado para hablar">🎙</button><div class="radio-ind" id="radioInd"></div>
      </div>
      <div class="pie" id="pie"></div></div>`;
    const mapa = mapaBase($('#mapa'), { zoom: 14 });
    const capaZonas = L.layerGroup().addTo(mapa), capaPel = L.layerGroup().addTo(mapa), capaViajes = L.layerGroup().addTo(mapa);
    R.cat.zonas.forEach(z => { if (z.poligono.length > 2) L.polygon(z.poligono, { color: z.color, weight: 1.5, fillOpacity: .06 }).addTo(capaZonas).bindTooltip(z.nombre, { sticky: true }); if (z.parada_lat) L.circleMarker([z.parada_lat, z.parada_lng], { radius: 6, color: z.color, fillOpacity: .9 }).addTo(capaZonas).bindTooltip('Parada ' + z.nombre); });
    R.cat.peligrosas.forEach(z => L.polygon(z.poligono, { color: '#d00', weight: 1, fillOpacity: .18, dashArray: '4' }).addTo(capaPel).bindTooltip('⚠ ' + (z.nombre || 'Zona peligrosa')));
    const marcadores = {}, moviles = {}, viajes = {};
    const colorMovil = m => m.estado === 'disponible' && m.bloqueado ? '#7a4fb0' : m.estado === 'disponible' && m.sin_saldo ? '#a33' : (ESTADOS_MOVIL[m.estado] || [, '#888'])[1];
    function popupMovil(m) {
      return `<b>Móvil ${m.numero}</b> · ${(ESTADOS_MOVIL[m.estado] || [m.estado])[0]}<br>${esc(m.conductor || 'Sin conductor')}<br>${esc(m.marca || '')} ${esc(m.modelo || '')} ${esc(m.patente || '')}<br>Zona: ${esc(m.zona || '—')} · ${m.velocidad ? Math.round(m.velocidad) + ' km/h' : 'detenido'}<br>Cuenta: <span class="dot c-${m.cuenta}"></span>${pesos(m.saldo)}${m.penalizado ? '<br><b style="color:#c00">Penalizado hasta ' + m.penalizado.hasta.slice(11, 16) + '</b>' : ''}${m.sin_saldo ? '<br><b style="color:#a33">Sin saldo</b>' : ''}
        <div class="fila" style="margin-top:6px"><button class="btn chico" data-mm="${m.id}" data-op="msg">Mensaje</button><button class="btn chico sec" data-mm="${m.id}" data-op="menu">Acciones</button></div>`;
    }
    // Círculo rojo de emergencia: se dibuja mientras el móvil está en emergencia y se quita cuando la cancela
    const circEm = {};
    function circuloEmergencia(m) {
      const en = m.estado === 'emergencia' && m.lat != null;
      if (en && !circEm[m.numero]) circEm[m.numero] = L.circle([m.lat, m.lng], { radius: 60, color: '#b0003a' }).addTo(mapa);
      else if (en) circEm[m.numero].setLatLng([m.lat, m.lng]);
      else if (circEm[m.numero]) { circEm[m.numero].remove(); delete circEm[m.numero]; }
    }
    function pintarMovil(m) {
      moviles[m.id] = m; circuloEmergencia(m);
      const visible = m.lat != null && filtrosEstado.has(m.estado) && m.estado !== 'desconectado';
      if (!visible) { if (marcadores[m.id]) { marcadores[m.id].remove(); delete marcadores[m.id]; } }
      else if (marcadores[m.id]) { marcadores[m.id].setLatLng([m.lat, m.lng]).setIcon(iconoMovil(m.numero, colorMovil(m))); marcadores[m.id].getPopup().setContent(popupMovil(m)); }
      else { marcadores[m.id] = L.marker([m.lat, m.lng], { icon: iconoMovil(m.numero, colorMovil(m)), zIndexOffset: 500 }).addTo(mapa).bindPopup(popupMovil(m)); }
      pintarChips(); pintarParadas();
    }
    let tChips;
    function pintarChips() {
      clearTimeout(tChips); tChips = setTimeout(() => {
        const ms = Object.values(moviles).sort((a, b) => a.numero - b.numero);
        const hora = t => +String(t).replace('T', ' ').slice(11, 13);
        const turnoDe = t => { const h = hora(t); return h >= 5 && h < 13 ? 'manana' : h >= 13 && h < 21 ? 'tarde' : 'noche'; };
        const TURNOS = [['manana', '🌅 Mañana · 05 a 13'], ['tarde', '☀️ Tarde · 13 a 21'], ['noche', '🌙 Noche · 21 a 05']];
        const ahoraT = turnoDe(new Date().toLocaleString('sv', { timeZone: 'America/Argentina/Buenos_Aires' }));
        const grupos = { manana: [], tarde: [], noche: [], fuera: [] };
        ms.forEach(m => (m.en_servicio_desde ? grupos[turnoDe(m.en_servicio_desde)] : grupos.fuera).push(m));
        ['manana', 'tarde', 'noche'].forEach(k => grupos[k].sort((a, b) => String(a.en_servicio_desde).localeCompare(String(b.en_servicio_desde))));
        const chip = m => `<span class="chip-movil" data-id="${m.id}" title="${esc((ESTADOS_MOVIL[m.estado] || [m.estado])[0] + ' · ' + (m.conductor || '') + (m.en_servicio_desde ? ' · en servicio ' + String(m.en_servicio_desde).replace('T', ' ').slice(11, 16) : ''))}" style="background:${colorMovil(m)};${m.penalizado ? 'border-color:#000' : ''}">${m.numero}</span>`;
        $('#chips').innerHTML = TURNOS.map(([k, t]) => grupos[k].length ? `<div class="turno-t${k === ahoraT ? ' actual' : ''}">${t} <b>${grupos[k].length}</b></div><div class="turno-c">${grupos[k].map(chip).join('')}</div>` : '').join('')
          + (grupos.fuera.length ? `<div class="turno-t fuera">Fuera de servicio <b>${grupos.fuera.length}</b></div><div class="turno-c">${grupos.fuera.map(chip).join('')}</div>` : '');
        $('#cntM').textContent = ms.filter(m => m.estado !== 'desconectado').length + '/' + ms.length;
        $$('.chip-movil', $('#chips')).forEach(c => { c.onclick = () => centrar(+c.dataset.id); c.oncontextmenu = e => { e.preventDefault(); menuMovil(e, moviles[+c.dataset.id]); }; });
      }, 150);
    }
    function pintarParadas() {
      $('#paradas').innerHTML = R.cat.zonas.filter(z => z.es_parada).map(z => {
        const cola = Object.values(moviles).filter(m => m.estado === 'en_parada' && m.parada_id === z.id).sort((a, b) => (a.parada_ingreso || '').localeCompare(b.parada_ingreso || ''));
        return `<div class="parada-fila"><span class="nom" data-z="${z.id}" style="background:${cola.length ? 'var(--verde)' : '#2f6fd6'}" title="${esc(z.nombre)}">${esc(z.nombre.slice(0, 8).toUpperCase())}</span><div class="cola">${cola.map(m => `<b data-id="${m.id}" style="cursor:pointer">${m.numero}</b>`).join('')}</div></div>`;
      }).join('');
      $$('#paradas .nom').forEach(n => n.onclick = () => { const z = R.cat.zonas.find(x => x.id === +n.dataset.z); if (z.parada_lat) mapa.setView([z.parada_lat, z.parada_lng], 16); });
      $$('#paradas b[data-id]').forEach(b => b.onclick = e => menuMovil(e, moviles[+b.dataset.id]));
    }
    function centrar(id) { const m = moviles[id]; if (!m || m.lat == null) return toast('Sin ubicación'); mapa.setView([m.lat, m.lng], 17); marcadores[id] && marcadores[id].openPopup(); }
    function menuMovil(e, m) {
      menuAcciones(e, [
        { t: 'Centrar en el mapa', ico: '🎯', a: () => centrar(m.id) },
        { t: 'Enviar mensaje', ico: '💬', a: () => mensajeMovil(m) },
        m.estado === 'en_parada' && { t: 'Sacar de la parada', ico: '⏏', a: () => estadoMovil(m, 'disponible') },
        ['disponible', 'en_parada'].includes(m.estado) && { t: 'Poner fuera de servicio', ico: '⛔', a: () => estadoMovil(m, 'fuera_servicio') },
        ['fuera_servicio', 'emergencia'].includes(m.estado) && { t: 'Poner disponible', ico: '✅', a: () => estadoMovil(m, 'disponible') },
        { t: 'Penalizar', ico: '⏱', a: async () => { const r = await pedir('Penalizar móvil ' + m.numero, [{ k: 'minutos', l: 'Minutos', t: 'number', def: 60 }, { k: 'motivo', l: 'Motivo', w: 'full' }]); if (r) { await api('/api/penalizados', { body: { ...r, numero: m.numero } }); toast('Penalizado', 'ok'); } } },
        { t: 'Recorrido histórico', ico: '🛣', a: () => window.open('panel.html#/recorrido?movil=' + m.id) },
      ], 'Móvil ' + m.numero);
    }
    async function estadoMovil(m, estado) { try { await api(`/api/moviles/${m.id}/estado`, { body: { estado } }); } catch (e) { fallo(e); } }
    async function mensajeMovil(m) { const r = await pedir('Mensaje al móvil ' + m.numero, [{ k: 'texto', l: 'Mensaje', t: 'textarea', w: 'full' }]); if (r && r.texto) { await api(`/api/moviles/${m.id}/mensaje`, { body: r }); toast('Enviado', 'ok'); } }
    mapa.on('popupopen', e => { $$('[data-mm]', e.popup.getElement()).forEach(b => b.onclick = ev => { const m = moviles[+b.dataset.mm]; b.dataset.op === 'msg' ? mensajeMovil(m) : menuMovil(ev, m); }); });

    // viajes en proceso
    const enProceso = v => ['pendiente', 'ofrecido', 'confirmado', 'en_curso'].includes(v.estado);
    const marcV = {};
    function pintarViaje(v) {
      if (enProceso(v)) viajes[v.id] = v; else delete viajes[v.id];
      if (marcV[v.id]) { marcV[v.id].remove(); delete marcV[v.id]; }
      if (enProceso(v) && v.origen_lat != null && ['pendiente', 'ofrecido', 'confirmado'].includes(v.estado)) {
        const col = { pendiente: '#e2a007', ofrecido: '#e8892b', confirmado: '#2f6fd6' }[v.estado];
        marcV[v.id] = L.marker([v.origen_lat, v.origen_lng], { icon: iconoPunto(col) }).addTo(capaViajes).bindTooltip(`#${v.id} ${esc(v.alias || v.telefono || '')} · ${ESTADO_VIAJE[v.estado]}`);
      }
      pintarTabla();
    }
    let tTabla;
    function pintarTabla() {
      clearTimeout(tTabla); tTabla = setTimeout(() => {
        const fil = $('#fv').value, b = $('#bv').value.toLowerCase();
        const vs = Object.values(viajes).filter(v => (!fil || v.origen_tipo === fil) && (!b || `${v.id} ${v.alias} ${v.telefono} ${v.origen_dir} ${v.movil_numero}`.toLowerCase().includes(b))).sort((a, b) => a.id - b.id);
        $('#cntV').textContent = vs.length;
        $('#tv').innerHTML = vs.length ? vs.map(v => `<tr data-id="${v.id}" style="${v.estado === 'pendiente' && v.intentos >= 5 ? 'background:#ffe9e9' : ''}"><td><b>${v.id}</b></td><td>${CANALES_ICO[v.canal] || ''}</td><td>${esc(v.alias || v.telefono || 'EVENTUAL')}</td><td>${(v.creado || '').slice(11, 16)}</td><td>${estadoViaje(v.estado)}${v.a_oferta ? ' 📣' : ''}</td><td class="tiempo" data-t="${v.creado}"></td><td>${v.movil_numero || '—'}</td><td class="r">${pesos(v.monto_estimado)}</td><td>📍 ${esc(v.origen_dir)}</td><td>${esc(v.zona || '')}</td><td><button class="btn-icono">⋮</button></td></tr>`).join('') : '<tr><td colspan="11" class="vacio">Sin viajes en proceso</td></tr>';
        $$('#tv tr[data-id]').forEach(tr => { const v = viajes[+tr.dataset.id]; const fn = e => { e.preventDefault(); menuAcciones(e, accionesViaje(v), `#${v.id} - ${v.alias || v.telefono || ''}`); }; $('.btn-icono', tr).onclick = fn; tr.oncontextmenu = fn; tr.ondblclick = () => { if (v.origen_lat) mapa.setView([v.origen_lat, v.origen_lng], 17); }; });
        tiempos();
      }, 120);
    }
    function tiempos() { $$('#tv .tiempo').forEach(td => { const s = Math.max(0, (Date.now() - (R.desfase || 0) - new Date(td.dataset.t.replace(' ', 'T'))) / 1000); td.textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }); }
    setInterval(tiempos, 1000);
    $('#fv').onchange = pintarTabla; $('#bv').oninput = pintarTabla;
    $('#minv').onclick = () => $('#pv').classList.toggle('min');
    $('#bmb').onclick = () => { const m = Object.values(moviles).find(x => x.numero === +$('#bm').value); m ? centrar(m.id) : toast('No existe ese móvil'); };
    $('#bm').onkeydown = e => e.key === 'Enter' && $('#bmb').click();

    // leyenda: filtros
    $$('.leyenda span[data-e]').forEach(s => s.onclick = () => { const e = s.dataset.e; filtrosEstado.has(e) ? filtrosEstado.delete(e) : filtrosEstado.add(e); s.classList.toggle('off'); Object.values(moviles).forEach(pintarMovil); });
    $('#capas').onclick = e => menuAcciones(e, [
      { t: (mapa.hasLayer(capaZonas) ? '☑' : '☐') + ' Zonas y paradas', a: () => mapa.hasLayer(capaZonas) ? capaZonas.remove() : capaZonas.addTo(mapa) },
      { t: (mapa.hasLayer(capaPel) ? '☑' : '☐') + ' Zonas peligrosas', a: () => mapa.hasLayer(capaPel) ? capaPel.remove() : capaPel.addTo(mapa) },
      { t: (mapa.hasLayer(capaViajes) ? '☑' : '☐') + ' Viajes esperando', a: () => mapa.hasLayer(capaViajes) ? capaViajes.remove() : capaViajes.addTo(mapa) },
      { t: 'Centrar en la empresa', a: () => mapa.setView([R.cat.empresa.lat, R.cat.empresa.lng], 14) },
      { t: 'Mensaje a la flota', a: mensajeFlota },
    ], 'Capas del mapa');

    // carga inicial
    const d = await api('/api/mapa');
    d.moviles.forEach(pintarMovil); d.viajes.forEach(pintarViaje);
    async function pie() {
      try {
        const s = await api('/api/estado');
        R.desfase = Date.now() - new Date(s.servidor.replace(' ', 'T'));
        $('#pie').innerHTML = `<span>☁ <b>${s.clima.temp != null ? s.clima.temp + ' °C' : '—'}</b> ${esc(s.clima.desc)}</span><span>Índice <b>${s.indice.modo === 'Fija' ? 'Fija' : '×' + s.indice.indice}</b></span><span>Tarifa <b>${esc(s.tarifa || '—')}</b></span><span>Total <b>${s.total}</b></span><span>Reales <b>${s.reales} (${s.total ? Math.round(s.reales * 100 / s.total) : 0}%)</b></span><span>Recibidos <b>${s.recibidos}</b></span><span>Reservas <b>${s.reservas}</b></span><span>Canales <b>${s.canales}</b></span><span>Conectados <b>${s.conectados}</b></span><span>Señal <b style="color:${R.socket && R.socket.connected ? '#7f7' : '#f77'}">${R.socket && R.socket.connected ? 'Excelente' : 'Sin conexión'}</b></span>`;
      } catch { }
    }
    pie(); setInterval(pie, 15000);
    let ultAct = Date.now();
    // respaldo por si el tiempo real no está disponible: refresca cada 8 segundos
    setInterval(async () => { if (document.visibilityState === 'hidden') return; try { const d3 = await api('/api/mapa'); d3.moviles.forEach(pintarMovil); Object.keys(viajes).forEach(id => { if (!d3.viajes.find(v => v.id === +id)) pintarViaje({ ...viajes[id], estado: 'finalizado' }); }); d3.viajes.forEach(pintarViaje); } catch { } }, 5000);
    R.socket.on('movil', m => { pintarMovil(m); ultAct = Date.now(); });
    R.socket.on('viaje', v => { pintarViaje(v); ultAct = Date.now(); });
    R.socket.on('viaje_baja', d => { delete viajes[d.id]; if (marcV[d.id]) { marcV[d.id].remove(); delete marcV[d.id]; } pintarTabla(); });
    R.socket.on('refrescar_viajes', async () => { const d2 = await api('/api/mapa'); d2.viajes.forEach(pintarViaje); });
    R.socket.on('emergencia', e => { if (e.lat) { mapa.setView([e.lat, e.lng], 17); circuloEmergencia({ numero: e.movil, estado: 'emergencia', lat: e.lat, lng: e.lng }); } });
    setInterval(() => { const s = Math.round((Date.now() - ultAct) / 1000); $('#act').textContent = s < 5 ? 'En vivo' : 'Sin actividad ' + s + 's'; }, 1000);

    // ---- radio PTT ----
    let audioOk = false;
    $('#audio').onclick = () => { audioOk = true; $('#audio').textContent = '🔊 Audio activo'; $('#audio').classList.remove('naranja'); try { new AudioContext().resume(); } catch { } };
    R.socket.on('radio', d => {
      if (d.clave && radioPropios.has(d.clave)) return; // la central no se escucha a sí misma
      $('#radioInd').textContent = '📻 ' + (d.de || 'Móvil'); $('#radioInd').classList.add('habla'); $('#radioInd').style.display = 'block'; setTimeout(() => $('#radioInd').style.display = 'none', 4000);
      if (!audioOk) return;
      const tocar = src => { const a = new Audio(src); a.play().catch(() => { }); };
      if (d.audio) tocar(d.audio); else if (d.id) api('/api/radio/' + d.id).then(r => r && r.audio && tocar(r.audio)).catch(() => { });
    });
    let rec = null, chunks = [];
    async function empezar(e) {
      e.preventDefault();
      if (!audioOk) $('#audio').click();
      try {
        const st = await navigator.mediaDevices.getUserMedia({ audio: true });
        rec = new MediaRecorder(st, radioOpciones()); chunks = []; clearTimeout(window.__radioMax); window.__radioMax = setTimeout(terminar, 30000);
        rec.ondataavailable = ev => chunks.push(ev.data);
        rec.onstop = () => { st.getTracks().forEach(t => t.stop()); const b = new Blob(chunks, { type: rec.mimeType }); if (b.size < 800) return; const fr = new FileReader(); fr.onload = () => enviarRadio(fr.result, rec.mimeType, 'Central · ' + ((R.yo && (R.yo.nombre || R.yo.usuario)) || 'operador')); fr.readAsDataURL(b); };
        rec.start(); $('#ptt').classList.add('grabando');
      } catch { toast('No se pudo acceder al micrófono', 'error'); }
    }
    function terminar() { if (rec && rec.state === 'recording') rec.stop(); $('#ptt').classList.remove('grabando'); }
    $('#ptt').addEventListener('mousedown', empezar); $('#ptt').addEventListener('touchstart', empezar);
    ['mouseup', 'mouseleave', 'touchend'].forEach(ev => $('#ptt').addEventListener(ev, terminar));
  }
});

// ---------- Zonas & Paradas ----------
// Radio: el audio viaja por el servidor (se guarda y se avisa a todos); antes se mandaba directo y los audios largos o la app Android lo perdían
function radioOpciones() { const o = { audioBitsPerSecond: 24000 }; try { if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) o.mimeType = 'audio/webm;codecs=opus'; } catch { } return o; }
const radioPropios = new Set();
async function enviarRadio(audio, mime, de) {
  const clave = Math.random().toString(36).slice(2) + Date.now().toString(36); radioPropios.add(clave);
  try { await api('/api/radio', { body: { audio, mime, de, clave } }); }
  catch (e) { try { R.socket.emit('radio', { audio, mime, de }); } catch { } toast('No se pudo enviar el audio: ' + e.message, 'error'); }
}
ruta('zonas-paradas', {
  titulo: 'Zonas & Paradas', roles: ['admin'], async render(main) {
    main.innerHTML = cabecera('Zonas & Paradas', 'Paradas y zonas de espera en el mapa. Al editar una zona, las demás se muestran en gris para ver solapamientos.', '<button class="btn" id="nueva">+ Nueva zona</button>') +
      `<div class="grid" style="grid-template-columns:260px 1fr"><div class="card"><div class="head"><h3>Zonas</h3></div><div id="lz"></div></div><div class="card" style="height:72vh;position:relative"><div id="mz" style="position:absolute;inset:0;border-radius:10px"></div><div id="ed" class="flotante oculto" style="right:10px;top:10px;width:280px;padding:10px"></div></div></div>`;
    const mapa = mapaBase($('#mz'));
    let zonas = await api('/api/zonas'), capas = L.layerGroup().addTo(mapa), editor = null, paradaMk = null;
    function pintar(editId) {
      capas.clearLayers();
      zonas.forEach(z => { if (z.id === editId || z.poligono.length < 3) return; L.polygon(z.poligono, { color: editId ? '#333' : z.color, weight: 1.5, fillOpacity: editId ? .15 : .12 }).addTo(capas).bindTooltip(z.nombre); });
      $('#lz').innerHTML = zonas.map(z => `<div class="conv" style="padding:9px 12px;border-bottom:1px solid #eef2f2;cursor:pointer;display:flex;gap:8px;align-items:center" data-id="${z.id}"><span class="dot" style="background:${z.color}"></span><span style="flex:1">${esc(z.nombre)}</span>${z.es_parada ? '<span class="pill">parada</span>' : ''}</div>`).join('');
      $$('#lz [data-id]').forEach(d => d.onclick = () => editar(zonas.find(z => z.id === +d.dataset.id)));
    }
    function editar(z) {
      editor && editor.quitar(); paradaMk && paradaMk.remove();
      pintar(z.id);
      editor = editorPoligono(mapa, z.poligono || [], z.color || '#215181');
      if (z.poligono && z.poligono.length) mapa.fitBounds(L.polygon(z.poligono).getBounds(), { padding: [60, 60] });
      const ed = $('#ed'); ed.classList.remove('oculto');
      ed.innerHTML = `<b>${z.id ? 'Editar zona' : 'Nueva zona'}</b><p style="font-size:12px;color:var(--suave)">Clic: agrega vértice · arrastrá para mover · clic derecho: borra vértice. Mantené Shift + clic para ubicar la parada.</p>`;
      const f = formulario([{ k: 'nombre', l: 'Nombre', w: 'full' }, { k: 'color', l: 'Color', t: 'color' }, { k: 'orden', l: 'Orden', t: 'number' }, { k: 'es_parada', t: 'check', cl: 'Tiene parada (cola de móviles)', w: 'full' }], { ...z, es_parada: z.id ? z.es_parada : true, color: z.color || '#215181' });
      f.classList.remove('g2'); ed.append(f);
      ed.append(h('<div class="fila" style="margin-top:8px"><button class="btn" id="gz">Guardar</button><button class="btn sec" id="lz2">Limpiar</button>' + (z.id ? '<button class="btn rojo" id="bz">Eliminar</button>' : '') + '<button class="btn sec" id="cz">Cerrar</button></div>'));
      let par = z.parada_lat ? [z.parada_lat, z.parada_lng] : null;
      const ponerPar = () => { paradaMk && paradaMk.remove(); if (par) paradaMk = L.marker(par, { draggable: true, icon: iconoPunto('#2f6fd6') }).addTo(mapa).bindTooltip('Parada'); paradaMk && paradaMk.on('dragend', e => par = [e.target.getLatLng().lat, e.target.getLatLng().lng]); };
      ponerPar();
      const shift = e => { if (e.originalEvent.shiftKey) { editor.puntos.pop(); editor.goma(false); par = [e.latlng.lat, e.latlng.lng]; ponerPar(); } };
      mapa.on('click', shift);
      const cerrar = () => { mapa.off('click', shift); editor.quitar(); editor = null; paradaMk && paradaMk.remove(); ed.classList.add('oculto'); pintar(); };
      $('#cz').onclick = cerrar;
      $('#lz2').onclick = () => editor.limpiar();
      $('#gz').onclick = async () => {
        const d = leer(f);
        if (editor.puntos.length < 3) return toast('Dibujá al menos 3 vértices', 'error');
        if (!par) { const b = L.polygon(editor.puntos).getBounds().getCenter(); par = [b.lat, b.lng]; }
        await api('/api/zonas', { body: { ...d, id: z.id, poligono: editor.puntos, parada_lat: par[0], parada_lng: par[1] } });
        toast('Zona guardada', 'ok'); zonas = await api('/api/zonas'); R.cat = await api('/api/catalogos'); cerrar();
      };
      if ($('#bz')) $('#bz').onclick = async () => { if (await confirmar('¿Eliminar la zona ' + z.nombre + '?')) { await api('/api/zonas/' + z.id, { method: 'DELETE' }); zonas = await api('/api/zonas'); cerrar(); } };
    }
    $('#nueva').onclick = () => editar({});
    pintar();
    if (zonas.length) mapa.fitBounds(L.featureGroup(zonas.filter(z => z.poligono.length > 2).map(z => L.polygon(z.poligono))).getBounds());
  }
});

// ---------- Zonas peligrosas ----------
ruta('zonas-peligrosas', {
  titulo: 'Zonas peligrosas', roles: ['admin'], async render(main) {
    main.innerHTML = cabecera('Zonas peligrosas', 'Polígonos de alerta para el mapa operativo, la telefonía y la app de conductores. Dibujar: marcá vértices y tocá Finalizar. Editar / Goma para ajustar.') +
      `<div class="card"><div class="head"><button class="btn" id="dib">✏ Dibujar</button><button class="btn sec" id="edi">Editar</button><button class="btn sec" id="gom">Goma</button><button class="btn verde oculto" id="fin">Finalizar</button><button class="btn sec" id="sal">Salir</button><span id="msg" style="color:var(--suave)"></span></div><div style="height:68vh;position:relative"><div id="mz" style="position:absolute;inset:0"></div></div></div>`;
    const mapa = mapaBase($('#mz'));
    let zs = await api('/api/zonas-peligrosas'), capas = L.layerGroup().addTo(mapa), ed = null, actual = null;
    function pintar() {
      capas.clearLayers();
      zs.forEach(z => { if (actual && actual.id === z.id) return; const p = L.polygon(z.poligono, { color: '#d00', fillOpacity: .2 }).addTo(capas); p.bindTooltip(z.nombre || 'Zona peligrosa'); p.on('click', () => { if (modo === 'editar') iniciar(z); else if (modo === 'borrar') borrar(z); }); });
      $('#msg').textContent = zs.length ? `${zs.length} zona(s) cargadas` : 'No hay zonas cargadas.';
    }
    let modo = '';
    function iniciar(z) { actual = z; ed && ed.quitar(); ed = editorPoligono(mapa, z.poligono || [], '#d00'); pintar(); $('#fin').classList.remove('oculto'); $('#msg').textContent = 'Clic para agregar vértices; arrastrá para mover. Goma: clic en un vértice para quitarlo.'; }
    async function borrar(z) { if (await confirmar('¿Eliminar la zona "' + (z.nombre || '') + '"?')) { await api('/api/zonas-peligrosas/' + z.id, { method: 'DELETE' }); zs = await api('/api/zonas-peligrosas'); pintar(); } }
    $('#dib').onclick = () => { modo = 'dibujar'; iniciar({}); };
    $('#edi').onclick = () => { modo = 'editar'; $('#msg').textContent = 'Tocá una zona para editarla (o Goma y clic en una zona para eliminarla).'; };
    $('#gom').onclick = () => { if (ed) { const v = !$('#gom').classList.contains('rojo'); ed.goma(v); $('#gom').classList.toggle('rojo', v); } else { modo = 'borrar'; $('#msg').textContent = 'Tocá una zona para eliminarla.'; } };
    $('#fin').onclick = async () => {
      if (ed.puntos.length < 3) return toast('Marcá al menos 3 vértices', 'error');
      const r = await pedir('Nombre de la zona', [{ k: 'nombre', l: 'Nombre', w: 'full' }], actual);
      if (!r) return;
      await api('/api/zonas-peligrosas', { body: { id: actual.id, nombre: r.nombre, poligono: ed.puntos } });
      ed.quitar(); ed = null; actual = null; $('#fin').classList.add('oculto'); $('#gom').classList.remove('rojo'); zs = await api('/api/zonas-peligrosas'); pintar(); toast('Guardada', 'ok');
    };
    $('#sal').onclick = () => { ed && ed.quitar(); ed = null; actual = null; modo = ''; $('#fin').classList.add('oculto'); pintar(); };
    pintar();
  }
});

// ---------- Mapas de calor (grilla) ----------
function grillaCalor(mapa, puntos, capa, tam = 0.0015) {
  capa.clearLayers();
  const celdas = {};
  puntos.forEach(p => { const k = Math.floor(p.lat / tam) + ':' + Math.floor(p.lng / tam); celdas[k] = (celdas[k] || 0) + 1; });
  const max = Math.max(1, ...Object.values(celdas));
  Object.entries(celdas).forEach(([k, c]) => {
    const [a, b] = k.split(':').map(Number); const t = c / max;
    const col = `hsl(${Math.round(120 - 120 * t)},85%,45%)`;
    L.rectangle([[a * tam, b * tam], [(a + 1) * tam, (b + 1) * tam]], { color: col, weight: 0, fillOpacity: .25 + .5 * t }).addTo(capa).bindTooltip(c + ' registro(s)');
  });
}
ruta('mapa-demanda', {
  titulo: 'Mapa de demanda', roles: ['operador', 'gestion'], async render(main) {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const d = new Date();
    main.innerHTML = cabecera('Mapa de demanda', 'Zonas con más pedidos históricos (últimos 90 días) para el día y franja elegidos · verde = menos · rojo = más.', `<select id="dia" style="width:auto">${dias.map((x, i) => `<option value="${i}" ${i === d.getDay() ? 'selected' : ''}>${x}</option>`).join('')}</select><select id="hora" style="width:auto">${Array.from({ length: 24 }, (_, i) => `<option value="${i}" ${i === d.getHours() ? 'selected' : ''}>${String(i).padStart(2, '0')}:00</option>`).join('')}</select><button class="btn" id="ac">Actualizar</button>`) +
      '<div class="card" style="height:72vh;position:relative"><div id="mz" style="position:absolute;inset:0;border-radius:10px"></div></div>';
    const mapa = mapaBase($('#mz')); const capa = L.layerGroup().addTo(mapa);
    const cargar = async () => { const r = await api('/api/informes/demanda?' + qs({ dia: $('#dia').value, hora: $('#hora').value })); grillaCalor(mapa, r.puntos, capa); toast(r.puntos.length + ' pedidos en la franja'); };
    $('#ac').onclick = cargar; cargar();
  }
});
ruta('calor-conductores', {
  titulo: 'Mapa calor conductores', roles: ['gestion'], async render(main) {
    main.innerHTML = cabecera('Mapa calor conductores', 'Presencia de los móviles según las posiciones registradas.', '<select id="hs" style="width:auto"><option value="2">Últimas 2 h</option><option value="6" selected>Últimas 6 h</option><option value="24">Último día</option><option value="168">Última semana</option></select><button class="btn" id="ac">Actualizar</button>') +
      '<div class="card" style="height:72vh;position:relative"><div id="mz" style="position:absolute;inset:0;border-radius:10px"></div></div>';
    const mapa = mapaBase($('#mz')); const capa = L.layerGroup().addTo(mapa);
    const cargar = async () => grillaCalor(mapa, await api('/api/informes/calor-conductores?horas=' + $('#hs').value), capa, 0.001);
    $('#ac').onclick = cargar; cargar();
  }
});

// ---------- Recorrido histórico ----------
ruta('recorrido', {
  titulo: 'Recorrido histórico', roles: ['gestion', 'operador', 'titular'], async render(main) {
    const ms = tiene('gestion', 'operador') ? R.cat.moviles : (R.yo.moviles || []);
    const pre = paramsRuta().get('movil');
    main.innerHTML = cabecera('Recorrido histórico', 'Reproducción del recorrido de un móvil entre dos fechas.') +
      `<div class="grid" style="grid-template-columns:300px 1fr"><div><div class="card"><div class="head"><h3>Filtros</h3></div><div class="body">
        <div class="campo"><label>Móvil</label><select id="mv"><option value="">Seleccionar móvil</option>${ms.map(m => `<option value="${m.id}" ${String(m.id) === pre ? 'selected' : ''}>Móvil ${m.numero}</option>`).join('')}</select></div>
        <label class="check" style="margin:8px 0"><input type="checkbox" id="em"> Solo emergencias</label>
        <div class="campo"><label>Desde</label><input type="datetime-local" id="d" value="${hoyISO()}T00:00"></div><div class="campo"><label>Hasta</label><input type="datetime-local" id="h" value="${hoyISO()}T23:59"></div>
        <button class="btn" id="ap" style="margin-top:10px;width:100%;justify-content:center">Aplicar fechas</button></div></div>
        <div class="card"><div class="head"><h3>Km / horas por estado</h3></div><div class="body" id="ke">Sin datos.</div></div>
        <div class="card"><div class="head"><h3>Eventos</h3></div><div id="ev" style="max-height:260px;overflow:auto">Sin eventos en el rango.</div></div></div>
      <div class="card" style="display:flex;flex-direction:column;height:78vh"><div class="head"><button class="btn-icono" id="pa" title="Punto anterior">⏮</button><button class="btn" id="play">▶ Play</button><button class="btn-icono" id="rev" title="Reproducir hacia atrás">⏪</button><button class="btn-icono" id="ps" title="Punto siguiente">⏭</button>
        <select id="vel" style="width:auto">${['0.5', '1', '1.5', '2', '3', '4'].map(v => `<option ${v === '1' ? 'selected' : ''}>${v}</option>`).join('')}</select>x<input type="range" id="pos" min="0" max="0" value="0" style="flex:1"><span id="pinfo" style="min-width:150px;font-size:12px"></span><button class="btn sec chico" id="exp">Exportar CSV</button><button class="btn sec chico" id="cen">Centrar</button></div>
        <div style="flex:1;position:relative"><div id="mz" style="position:absolute;inset:0"></div></div>
        <div class="leyenda" style="background:#fff;color:#000">${Object.entries(ESTADOS_MOVIL).map(([k, [t, c]]) => `<span style="background:${c};color:#fff">${t}</span>`).join('')}</div></div></div>`;
    const mapa = mapaBase($('#mz')); const capa = L.layerGroup().addTo(mapa);
    let pts = [], mk = null, i = 0, timer = null, dir = 1;
    async function cargar() {
      if (!$('#mv').value) return toast('Seleccioná un móvil');
      const r = await api('/api/informes/recorrido?' + qs({ movil: $('#mv').value, desde: $('#d').value.replace('T', ' ') + ':00', hasta: $('#h').value.replace('T', ' ') + ':59', emergencias: $('#em').checked ? 1 : '' }));
      pts = r.puntos; capa.clearLayers(); i = 0;
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k];
        const salto = (new Date(b.ts.replace(' ', 'T')) - new Date(a.ts.replace(' ', 'T'))) > 600000;
        L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: salto ? '#999' : (ESTADOS_MOVIL[a.estado] || [, '#555'])[1], weight: 4, dashArray: salto ? '4 6' : null, opacity: .85 }).addTo(capa);
      }
      $('#pos').max = Math.max(0, pts.length - 1); $('#pos').value = 0;
      if (pts.length) { mapa.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])), { padding: [30, 30] }); mover(0); } else toast('Sin datos en el rango');
      $('#ke').innerHTML = Object.keys(r.porEstado).length ? tablaSimple(Object.entries(r.porEstado).map(([k, v]) => ({ k, ...v })), [{ t: 'Estado', f: x => (ESTADOS_MOVIL[x.k] || [x.k])[0] }, { t: 'Km', k: 'km', c: 'r' }, { t: 'Horas', k: 'horas', c: 'r' }]) : 'Sin datos.';
      $('#ev').innerHTML = r.eventos.length ? tablaSimple(r.eventos, [{ t: 'Hora', f: e => e.fecha.slice(11, 16) }, { t: 'Evento', k: 'tipo' }, { t: 'Detalle', k: 'detalle' }]) : '<p style="padding:10px">Sin eventos en el rango.</p>';
    }
    function mover(k) {
      if (!pts.length) return; i = Math.max(0, Math.min(pts.length - 1, k)); const p = pts[i];
      const num = (ms.find(m => String(m.id) === $('#mv').value) || {}).numero || '';
      if (!mk) mk = L.marker([p.lat, p.lng], { icon: iconoMovil(num, (ESTADOS_MOVIL[p.estado] || [, '#555'])[1]), zIndexOffset: 1000 }).addTo(mapa);
      mk.setLatLng([p.lat, p.lng]).setIcon(iconoMovil(num, (ESTADOS_MOVIL[p.estado] || [, '#555'])[1]));
      $('#pos').value = i; $('#pinfo').textContent = `${p.ts.slice(11)} · ${(ESTADOS_MOVIL[p.estado] || [p.estado])[0]} · ${Math.round(p.velocidad || 0)} km/h`;
    }
    function play(d) { if (timer) { clearInterval(timer); timer = null; $('#play').textContent = '▶ Play'; return; } dir = d; $('#play').textContent = '⏸ Pausa'; timer = setInterval(() => { if ((dir > 0 && i >= pts.length - 1) || (dir < 0 && i <= 0)) return play(); mover(i + dir); }, 400 / +$('#vel').value); }
    $('#ap').onclick = cargar; $('#play').onclick = () => play(1); $('#rev').onclick = () => play(-1);
    $('#pa').onclick = () => mover(i - 1); $('#ps').onclick = () => mover(i + 1); $('#pos').oninput = e => mover(+e.target.value);
    $('#cen').onclick = () => pts.length && mapa.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])));
    $('#exp').onclick = () => { if (!$('#mv').value) return; descargar('/api/informes/recorrido?' + qs({ movil: $('#mv').value, desde: $('#d').value.replace('T', ' ') + ':00', hasta: $('#h').value.replace('T', ' ') + ':59', formato: 'csv' })); };
    if (pre) cargar();
  }
});
