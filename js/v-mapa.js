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
        <div class="flotante panel-moviles"><div class="fh"><span>🚕 Móviles</span><span class="tot" id="cntM" title="Conectados / total"></span><button class="vista" id="vistaM" title="Ver como fichas o como lista">☰</button><button class="min" title="Minimizar / mostrar" aria-label="Minimizar">–</button></div>
          <div class="pm-cuerpo"><div class="pm-busca"><input id="bm" placeholder="Nº de móvil o conductor…" autocomplete="off"><button class="btn chico" id="bmb" title="Ubicar en el mapa">📍</button></div>
          <div class="pm-est" id="pmEst"></div><div class="chips" id="chips"></div></div></div>
        <div class="flotante panel-paradas"><div class="fh"><span>🅿️ Paradas</span><span class="tot"></span><button class="min" title="Minimizar / mostrar" aria-label="Minimizar">–</button></div><div class="lista" id="paradas"></div></div>
        <div class="flotante panel-viajes" id="pv"><div class="fh"><span>Viajes en proceso <span class="badge" id="cntV">0</span></span><span class="fila" style="gap:6px"><input id="bv" placeholder="Buscar…" style="min-height:26px;width:160px;color:#000"><select id="fv" style="min-height:26px;width:auto;color:#000"><option value="">Todos</option><option value="central">Central</option><option value="calle">Calle</option></select><button class="btn-icono" style="color:#fff" id="minv">▁</button></span></div>
          <div class="tabla-wrap"><table class="t"><thead><tr><th>N°</th><th>Canal</th><th>Cliente</th><th>Pedido</th><th>Estado</th><th>Tiempo</th><th>Móvil N°</th><th class="r">Monto</th><th>Dirección</th><th>Zona</th><th></th></tr></thead><tbody id="tv"></tbody></table></div></div>
        <button class="ptt" id="ptt" title="Mantener apretado para hablar">🎙</button><div class="radio-ind" id="radioInd"></div>
      </div>
      <div class="pie" id="pie"></div></div>`;
    const mapa = mapaBase($('#mapa'), { zoom: 14 });
    // panel de paradas: minimizar/mostrar (se recuerda) y refresco de los minutos de espera
    { const pp = $('.panel-paradas'), bm = $('.panel-paradas .min'); try { if (localStorage.getItem('rodar_paradas_min') === '1') pp.classList.add('mini'); } catch { }
      bm.onclick = e => { e.stopPropagation(); pp.classList.toggle('mini'); bm.textContent = pp.classList.contains('mini') ? '+' : '–'; try { localStorage.setItem('rodar_paradas_min', pp.classList.contains('mini') ? '1' : ''); } catch { } };
      bm.textContent = pp.classList.contains('mini') ? '+' : '–'; setInterval(() => { try { pintarParadas(); } catch { } }, 30000); }
    // panel de móviles: minimizar, vista fichas/lista, filtro por estado, turnos plegables (se recuerda en este navegador)
    const PM = { filtro: '', vista: 'fichas', plegados: {} };
    try { Object.assign(PM, JSON.parse(localStorage.getItem('rodar_moviles_panel') || '{}')); } catch { }
    const guardarPM = () => { try { localStorage.setItem('rodar_moviles_panel', JSON.stringify({ vista: PM.vista, plegados: PM.plegados, mini: PM.mini })); } catch { } };
    { const pm = $('.panel-moviles'), bmin = $('.panel-moviles .min'), bv = $('#vistaM');
      const pint = () => { pm.classList.toggle('mini', !!PM.mini); bmin.textContent = PM.mini ? '+' : '–'; bv.textContent = PM.vista === 'lista' ? '▦' : '☰'; bv.title = PM.vista === 'lista' ? 'Ver como fichas' : 'Ver como lista'; };
      bmin.onclick = e => { e.stopPropagation(); PM.mini = !PM.mini; pint(); guardarPM(); };
      bv.onclick = e => { e.stopPropagation(); PM.vista = PM.vista === 'lista' ? 'fichas' : 'lista'; pint(); guardarPM(); pintarChips(); };
      pint(); setInterval(() => { try { pintarChips(); } catch { } }, 60000); }
    const capaZonas = L.layerGroup().addTo(mapa), capaPel = L.layerGroup().addTo(mapa), capaViajes = L.layerGroup().addTo(mapa);
    R.cat.zonas.forEach(z => { if (z.poligono.length > 2) L.polygon(z.poligono, { color: z.color, weight: 1.5, fillOpacity: .06 }).addTo(capaZonas).bindTooltip(esc(z.nombre), { sticky: true }); if (z.parada_lat) L.circleMarker([z.parada_lat, z.parada_lng], { radius: 6, color: z.color, fillOpacity: .9 }).addTo(capaZonas).bindTooltip('Parada ' + esc(z.nombre)); });
    R.cat.peligrosas.forEach(z => L.polygon(z.poligono, { color: '#d00', weight: 1, fillOpacity: .18, dashArray: '4' }).addTo(capaPel).bindTooltip('⚠ ' + esc(z.nombre || 'Zona peligrosa')));
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
    // Desplaza el marcador de su posición anterior a la nueva en ~1 segundo (si el salto es corto y la pestaña está a la vista)
    function moverSuave(mk, lat, lng) {
      const a = mk.getLatLng(); if (!a) return mk.setLatLng([lat, lng]);
      const dLat = lat - a.lat, dLng = lng - a.lng;
      if ((!dLat && !dLng) || document.hidden || Math.abs(dLat) + Math.abs(dLng) > 0.02) { cancelAnimationFrame(mk._anim); return mk.setLatLng([lat, lng]); }
      cancelAnimationFrame(mk._anim); const t0 = performance.now(), D = 900;
      const paso = t => { const k = Math.min(1, (t - t0) / D), e = k * (2 - k); mk.setLatLng([a.lat + dLat * e, a.lng + dLng * e]); if (k < 1) mk._anim = requestAnimationFrame(paso); };
      mk._anim = requestAnimationFrame(paso);
    }
    function pintarMovil(m) {
      moviles[m.id] = m; circuloEmergencia(m);
      const visible = m.lat != null && filtrosEstado.has(m.estado) && m.estado !== 'desconectado';
      if (!visible) { if (marcadores[m.id]) { marcadores[m.id].remove(); delete marcadores[m.id]; } }
      else {
        // el ícono se rehace solo si cambió algo que se ve (así no parpadea en cada posición)
        const op = { rumbo: m.rumbo, velocidad: m.velocidad, sinSenal: movilSinSenal(m), emergencia: m.estado === 'emergencia' };
        const clave = [m.numero, colorMovil(m), op.velocidad > 3 ? Math.round((+m.rumbo || 0) / 15) : '-', op.sinSenal, op.emergencia].join('|');
        const tt = `<b>Móvil ${m.numero}</b> · ${(ESTADOS_MOVIL[m.estado] || [m.estado])[0]}${m.conductor ? '<br>' + esc(m.conductor) : ''}${op.sinSenal ? '<br>⚠ Sin señal de GPS' : m.velocidad > 3 ? `<br>${Math.round(m.velocidad)} km/h` : ''}`;
        let mk = marcadores[m.id];
        if (!mk) { mk = marcadores[m.id] = L.marker([m.lat, m.lng], { icon: iconoMovil(m.numero, colorMovil(m), op), zIndexOffset: m.estado === 'emergencia' ? 2000 : 500 }).addTo(mapa).bindPopup(popupMovil(m)).bindTooltip(tt, { direction: 'top', offset: [0, -18] }); mk._clave = clave; }
        else {
          moverSuave(mk, m.lat, m.lng);
          if (mk._clave !== clave) { mk.setIcon(iconoMovil(m.numero, colorMovil(m), op)); mk._clave = clave; }
          mk.setPopupContent(popupMovil(m)); if (mk.setTooltipContent) mk.setTooltipContent(tt);
        }
      }
      pintarChips(); pintarParadas();
    }
    let tChips;
    // grupos de estado para el resumen/filtro del panel
    const GRUPOS_EST = [['libre', 'Libres', '#278449', m => m.estado === 'disponible'], ['parada', 'En parada', '#2f6fd6', m => m.estado === 'en_parada'],
      ['ocupado', 'Ocupados', '#d43d3d', m => m.estado === 'confirmado' || m.estado === 'con_pasajero'], ['emerg', 'Emergencia', '#b0003a', m => m.estado === 'emergencia'],
      ['desc', 'Desconect.', '#8b9899', m => m.estado === 'desconectado'], ['fuera', 'Fuera', '#4b5556', m => m.estado === 'fuera_servicio']];
    const dur = t => { if (!t) return ''; const d = new Date(String(t).replace(' ', 'T')); if (isNaN(d)) return ''; const mi = Math.max(0, Math.round((Date.now() - d) / 60000)); return mi < 60 ? mi + "'" : Math.floor(mi / 60) + 'h' + String(mi % 60).padStart(2, '0'); };
    function pintarChips() {
      clearTimeout(tChips); tChips = setTimeout(() => {
        const todos = Object.values(moviles).sort((a, b) => a.numero - b.numero);
        // resumen por estado (clic = filtrar; otro clic = quitar filtro)
        $('#pmEst').innerHTML = GRUPOS_EST.map(([k, t, c, f]) => { const n = todos.filter(f).length; return n || PM.filtro === k ? `<button data-f="${k}" class="${PM.filtro === k ? 'on' : ''}" style="--c:${c}" title="${PM.filtro === k ? 'Quitar filtro' : 'Mostrar solo ' + t.toLowerCase()}"><i></i>${t} <b>${n}</b></button>` : ''; }).join('');
        $$('#pmEst button').forEach(b => b.onclick = () => { PM.filtro = PM.filtro === b.dataset.f ? '' : b.dataset.f; pintarChips(); });
        const q = ($('#bm').value || '').trim().toLowerCase(), fg = GRUPOS_EST.find(g => g[0] === PM.filtro);
        const ms = todos.filter(m => (!fg || fg[3](m)) && (!q || String(m.numero).startsWith(q) || String(m.conductor || '').toLowerCase().includes(q)));
        const hora = t => +String(t).replace('T', ' ').slice(11, 13);
        const turnoDe = t => { const h = hora(t); return h >= 5 && h < 13 ? 'manana' : h >= 13 && h < 21 ? 'tarde' : 'noche'; };
        const TURNOS = [['manana', '🌅 Mañana', '05 a 13'], ['tarde', '☀️ Tarde', '13 a 21'], ['noche', '🌙 Noche', '21 a 05'], ['fuera', '⏸ Sin turno', 'fuera de servicio']];
        const ahoraT = turnoDe(new Date().toLocaleString('sv', { timeZone: 'America/Argentina/Buenos_Aires' }));
        const grupos = { manana: [], tarde: [], noche: [], fuera: [] };
        ms.forEach(m => (m.en_servicio_desde ? grupos[turnoDe(m.en_servicio_desde)] : grupos.fuera).push(m));
        ['manana', 'tarde', 'noche'].forEach(k => grupos[k].sort((a, b) => String(a.en_servicio_desde).localeCompare(String(b.en_servicio_desde))));
        const estT = m => (ESTADOS_MOVIL[m.estado] || [m.estado])[0] + (m.estado === 'disponible' && m.bloqueado ? ' · con deuda' : m.estado === 'disponible' && m.sin_saldo ? ' · sin saldo' : '');
        const marcas = m => (m.penalizado ? '<em class="pen" title="Penalizado">⛔</em>' : '') + (m.sin_saldo || m.bloqueado ? '<em class="sal" title="Sin saldo / con deuda">$</em>' : '') + (m.lat == null ? '<em class="gps" title="Sin ubicación">⌀</em>' : '');
        const tip = m => esc(`Móvil ${m.numero} · ${estT(m)}\n${m.conductor || 'Sin conductor'}${m.zona ? '\nZona: ' + m.zona : ''}${m.en_servicio_desde ? '\nEn servicio desde ' + String(m.en_servicio_desde).replace('T', ' ').slice(11, 16) + ' (' + dur(m.en_servicio_desde) + ')' : ''}${m.penalizado ? '\nPenalizado hasta ' + String(m.penalizado.hasta || '').slice(11, 16) : ''}\nClic: ver en el mapa · Clic derecho: acciones`);
        const ficha = m => `<span class="chip-movil${m.estado === 'emergencia' ? ' emerg' : ''}${m.estado === 'desconectado' ? ' off' : ''}" data-id="${m.id}" title="${tip(m)}" style="--c:${colorMovil(m)}">${m.numero}${marcas(m)}</span>`;
        const fila = m => `<div class="pm-fila${m.estado === 'emergencia' ? ' emerg' : ''}" data-id="${m.id}" title="${tip(m)}" style="--c:${colorMovil(m)}"><span class="n">${m.numero}</span><span class="d"><b>${esc(m.conductor || 'Sin conductor')}</b><small>${esc(estT(m))}${m.zona ? ' · ' + esc(m.zona) : ''}${movilSinSenal(m) ? ' · <span style="color:#a15c00;font-weight:700">⚠ sin señal</span>' : ''}</small></span><span class="t">${m.estado === 'en_parada' ? dur(m.parada_ingreso) : m.velocidad ? Math.round(m.velocidad) + ' km/h' : ''}</span>${marcas(m)}</div>`;
        const html = TURNOS.map(([k, t, h]) => { const g = grupos[k]; if (!g.length) return ''; const pleg = PM.plegados[k] && !q;
          const libres = g.filter(m => m.estado === 'disponible' || m.estado === 'en_parada').length;
          return `<div class="turno"><div class="turno-t${k === ahoraT ? ' actual' : ''}${k === 'fuera' ? ' fuera' : ''}${pleg ? ' plegado' : ''}" data-t="${k}" title="${pleg ? 'Mostrar' : 'Ocultar'} · ${h}"><span class="fl">▾</span>${t}${k === ahoraT ? '<span class="ya">ahora</span>' : ''}<span class="ct">${k !== 'fuera' ? `<i title="Libres o en parada">${libres} libres</i>` : ''}<b>${g.length}</b></span></div>${pleg ? '' : PM.vista === 'lista' ? `<div class="pm-lista">${g.map(fila).join('')}</div>` : `<div class="turno-c">${g.map(ficha).join('')}</div>`}</div>`; }).join('');
        $('#chips').innerHTML = html || `<div class="pvac">${todos.length ? 'Ningún móvil coincide.' : 'No hay móviles cargados.'}</div>`;
        const con = todos.filter(m => m.estado !== 'desconectado' && m.estado !== 'fuera_servicio').length;
        $('#cntM').textContent = con + '/' + todos.length;
        $$('.turno-t', $('#chips')).forEach(h => h.onclick = () => { PM.plegados[h.dataset.t] = !PM.plegados[h.dataset.t]; guardarPM(); pintarChips(); });
        $$('[data-id]', $('#chips')).forEach(c => { c.onclick = () => centrar(+c.dataset.id); c.oncontextmenu = e => { e.preventDefault(); menuMovil(e, moviles[+c.dataset.id]); }; });
      }, 150);
    }
    // Paradas: cada una con su cola en orden de llegada (1º es el próximo en salir) y cuánto hace que espera cada móvil
    function pintarParadas() {
      const minutos = t => { if (!t) return null; const d = new Date(String(t).replace(' ', 'T')); return isNaN(d) ? null : Math.max(0, Math.round((Date.now() - d) / 60000)); };
      const ps = R.cat.zonas.filter(z => z.es_parada);
      let total = 0;
      const filas = ps.map(z => {
        const cola = Object.values(moviles).filter(m => m.estado === 'en_parada' && m.parada_id === z.id).sort((a, b) => (a.parada_ingreso || '').localeCompare(b.parada_ingreso || ''));
        total += cola.length;
        const chips = cola.map((m, i) => { const mi = minutos(m.parada_ingreso); return `<b data-id="${m.id}" class="${i === 0 ? 'pri' : ''}" title="Móvil ${m.numero} · ${i + 1}º en la cola${mi != null ? ' · espera ' + mi + ' min' : ''}"><i>${i + 1}º</i>${m.numero}${mi != null ? `<small>${mi}'</small>` : ''}</b>`; }).join('');
        return `<div class="parada-fila${cola.length ? '' : ' vacia'}"><div class="pf1"><span class="nom" data-z="${z.id}" title="Ver ${esc(z.nombre)} en el mapa"><i class="pd" style="background:${esc(z.color || '#2f6fd6')}"></i>${esc(z.nombre)}</span><span class="cnt">${cola.length ? cola.length + ' en cola' : 'Vacía'}</span></div>${cola.length ? `<div class="cola">${chips}</div>` : ''}</div>`;
      });
      $('#paradas').innerHTML = ps.length ? filas.join('') : '<div class="pvac">No hay paradas cargadas. Se crean en Administración → Zonas & Paradas.</div>';
      const t = $('.panel-paradas .fh .tot'); if (t) t.textContent = total ? total + ' en cola' : '';
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
    // El cambio se ve enseguida en el mapa y en la lista (no espera la próxima actualización)
    async function estadoMovil(m, estado) { try { const r = await api(`/api/moviles/${m.id}/estado`, { body: { estado } }); if (r && r.movil) pintarMovil(r.movil); else pintarMovil({ ...m, estado }); } catch (e) { fallo(e); } }
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
    $('#bmb').onclick = () => { const q = ($('#bm').value || '').trim().toLowerCase(); if (!q) return $('#bm').focus(); const ms = Object.values(moviles);
      const m = ms.find(x => String(x.numero) === q) || ms.find(x => String(x.conductor || '').toLowerCase().includes(q)); m ? centrar(m.id) : toast('No existe ese móvil'); };
    $('#bm').onkeydown = e => { if (e.key === 'Enter') $('#bmb').click(); if (e.key === 'Escape') { $('#bm').value = ''; pintarChips(); } };
    $('#bm').oninput = () => pintarChips();

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
    setInterval(async () => { if (document.visibilityState === 'hidden') return; try { const d3 = await api('/api/mapa'); d3.moviles.forEach(pintarMovil); Object.keys(viajes).forEach(id => { if (!d3.viajes.find(v => v.id === +id)) pintarViaje({ ...viajes[id], estado: 'finalizado' }); }); d3.viajes.forEach(pintarViaje); } catch { } }, 6000);
    // Cada 2,5 s: ubicación, estado, conductor y parada de cada móvil (consulta liviana). Mueve los marcadores y
    // mantiene al día el panel de Móviles y las paradas; si cambió el estado o el conductor, repinta ese móvil completo.
    setInterval(async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const ps = await api('/api/mapa/pos'); let cambios = false;
        ps.forEach(p => {
          const m = moviles[p.id]; if (!m) return;   // los móviles nuevos llegan con la carga completa
          if (m.estado !== p.estado || m.conductor_id !== p.conductor_id || m.parada_id !== p.parada_id || (m.lat == null) !== (p.lat == null)) { cambios = true; return pintarMovil({ ...m, ...p }); }
          if (m.lat === p.lat && m.lng === p.lng && m.rumbo === p.rumbo && m.velocidad === p.velocidad && m.ultima_senal === p.ultima_senal) return;
          cambios = true; Object.assign(m, p);
          const mk = marcadores[p.id]; if (!mk || p.lat == null) return;
          moverSuave(mk, p.lat, p.lng);
          const op = { rumbo: p.rumbo, velocidad: p.velocidad, sinSenal: movilSinSenal(m), emergencia: m.estado === 'emergencia' };
          const clave = [m.numero, colorMovil(m), op.velocidad > 3 ? Math.round((+p.rumbo || 0) / 15) : '-', op.sinSenal, op.emergencia].join('|');
          if (mk._clave !== clave) { mk.setIcon(iconoMovil(m.numero, colorMovil(m), op)); mk._clave = clave; }
        });
        if (cambios) pintarChips();   // velocidad, "sin señal" y contadores del panel de Móviles
        ultAct = Date.now();
      } catch { }
    }, 2500);
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
      `<div class="zp"><div class="card zp-lista"><div class="head"><h3>Zonas</h3><span class="zp-res" id="res"></span></div>
        <div class="zp-busca"><input type="search" id="bzq" placeholder="Buscar zona…"></div><div id="lz"></div></div>
        <div class="card zp-mapa"><div id="mz"></div><div id="ed" class="flotante zp-ed oculto"></div>
        <div class="zp-ley"><span><i class="lz"></i>Zona</span><span><i class="lp">P</i>Parada (cola de móviles)</span><span>Tocá una zona en el mapa o en la lista para editarla</span></div></div></div>`;
    const mapa = mapaBase($('#mz'));
    let zonas = await api('/api/zonas'), capas = L.layerGroup().addTo(mapa), editor = null, paradaMk = null, actual = null;
    const iconoP = color => L.divIcon({ className: '', html: `<div class="zp-p" style="background:${color}">P</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
    // superficie aproximada del polígono (km²)
    const km2 = pts => { if (!pts || pts.length < 3) return 0; const lat0 = pts[0][0] * Math.PI / 180, kx = 111.32 * Math.cos(lat0), ky = 110.57; let a = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; a += (p[1] * kx) * (q[0] * ky) - (q[1] * kx) * (p[0] * ky); }); return Math.abs(a / 2); };
    const fmtA = a => a >= 1 ? a.toFixed(1).replace('.', ',') + ' km²' : Math.round(a * 100) + ' ha';
    function pintar(editId) {
      capas.clearLayers();
      zonas.forEach(z => {
        if (z.id === editId) return;
        if (z.poligono.length > 2) {
          const pg = L.polygon(z.poligono, { color: editId ? '#7b8a8b' : z.color, weight: editId ? 1 : 2, fillOpacity: editId ? .1 : .14, dashArray: editId ? '4 4' : null }).addTo(capas);
          if (!editId) { pg.bindTooltip(esc(z.nombre), { permanent: true, direction: 'center', className: 'zp-etq' }); pg.on('click', () => editar(z)); pg.on('mouseover', () => pg.setStyle({ fillOpacity: .3 })); pg.on('mouseout', () => pg.setStyle({ fillOpacity: .14 })); z._pg = pg; }
        }
        if (z.es_parada && z.parada_lat && !editId) L.marker([z.parada_lat, z.parada_lng], { icon: iconoP(z.color || '#2f6fd6') }).addTo(capas).bindTooltip('Parada ' + esc(z.nombre)).on('click', () => editar(z));
      });
      const q = ($('#bzq').value || '').trim().toLowerCase();
      const lista = zonas.filter(z => !q || z.nombre.toLowerCase().includes(q));
      $('#res').textContent = `${zonas.length} zona${zonas.length === 1 ? '' : 's'} · ${zonas.filter(z => z.es_parada).length} con parada`;
      $('#lz').innerHTML = lista.length ? lista.map(z => `<div class="zp-item${z.id === editId ? ' act' : ''}" data-id="${z.id}"><span class="sw" style="background:${esc(z.color || '#215181')}"></span>
        <div class="zi"><b>${esc(z.nombre)}</b><small>${z.poligono.length > 2 ? `${z.poligono.length} vértices · ${fmtA(km2(z.poligono))}` : '<span style="color:var(--rojo)">Sin dibujar</span>'}</small></div>
        ${z.es_parada ? `<span class="zp-tag${z.parada_lat ? '' : ' falta'}" title="${z.parada_lat ? 'Tiene parada' : 'Falta ubicar la parada'}">🅿️ Parada</span>` : ''}</div>`).join('') : `<div class="zp-vac">${zonas.length ? 'No hay zonas con ese nombre.' : 'Todavía no hay zonas. Tocá <b>+ Nueva zona</b> y dibujala en el mapa.'}</div>`;
      $$('#lz [data-id]').forEach(d => { const z = zonas.find(x => x.id === +d.dataset.id); d.onclick = () => editar(z);
        d.onmouseenter = () => { if (!editor && z._pg) z._pg.setStyle({ fillOpacity: .35, weight: 3 }); }; d.onmouseleave = () => { if (!editor && z._pg) z._pg.setStyle({ fillOpacity: .14, weight: 2 }); }; });
    }
    $('#bzq').oninput = () => pintar(actual && actual.id);
    function editar(z) {
      editor && editor.quitar(); paradaMk && paradaMk.remove(); actual = z;
      pintar(z.id || -1);
      editor = editorPoligono(mapa, z.poligono || [], z.color || '#215181');
      // Una zona existente se abre bloqueada: no se agregan ni mueven puntos hasta tocar "Editar dibujo"
      let bloq = !!(z.id && z.poligono && z.poligono.length > 2); if (bloq) editor.bloquear(true);
      if (z.poligono && z.poligono.length) mapa.fitBounds(L.polygon(z.poligono).getBounds(), { padding: [60, 60] });
      const ed = $('#ed'); ed.classList.remove('oculto');
      ed.innerHTML = `<div class="zp-eh"><span class="sw" id="sw" style="background:${esc(z.color || '#215181')}"></span><b>${z.id ? 'Editar zona' : 'Nueva zona'}</b><button class="x" id="cz" title="Cerrar">×</button></div>
        <div class="zp-lock" id="lock"></div>
        <ul class="zp-ayuda" id="ayz"><li>🖱️ <b>Clic</b> en el mapa: agrega un vértice</li><li>✋ <b>Arrastrá</b> un vértice para moverlo</li><li>🗑️ <b>Clic derecho</b> en un vértice: lo borra</li><li>🅿️ <b>Shift + clic</b> o el botón <b>Ubicar parada</b>: marca dónde esperan los móviles</li></ul>
        <div class="zp-est" id="est"></div>`;
      const f = formulario([{ k: 'nombre', l: 'Nombre', w: 'full' }, { k: 'color', l: 'Color', t: 'color' }, { k: 'orden', l: 'Orden', t: 'number' }, { k: 'es_parada', t: 'check', cl: 'Tiene parada (cola de móviles)', w: 'full' }], { ...z, es_parada: z.id ? z.es_parada : true, color: z.color || '#215181' });
      f.classList.remove('g2'); ed.append(f);
      ed.append(h('<div class="zp-acc"><button class="btn verde" id="gz">💾 Guardar</button><button class="btn sec" id="upz">🅿️ Ubicar parada</button><button class="btn sec" id="lz2">↺ Borrar dibujo</button>' + (z.id ? '<button class="btn rojo" id="bz">🗑 Eliminar</button>' : '') + '</div>'));
      // modo bloqueado / edición del dibujo
      const pintarLock = () => {
        $('#lock').innerHTML = bloq ? '<div class="zl-txt">🔒 <b>Dibujo bloqueado</b><br><small>Podés cambiar nombre, color y orden sin tocar el mapa. Para mover puntos o la parada, tocá Editar dibujo.</small></div><button class="btn" id="edz">✏️ Editar dibujo</button>'
          : (z.id ? '<div class="zl-txt on">✏️ <b>Editando el dibujo</b><br><small>Los cambios en el mapa se guardan al tocar Guardar.</small></div><button class="btn sec" id="edz">🔒 Bloquear</button>' : '');
        $('#ayz').style.display = bloq ? 'none' : ''; $('#upz').style.display = $('#lz2').style.display = bloq ? 'none' : '';
        if (paradaMk && paradaMk.dragging) bloq ? paradaMk.dragging.disable() : paradaMk.dragging.enable();
        const b = $('#edz'); if (b) b.onclick = () => { bloq = !bloq; editor.bloquear(bloq); if (bloq && modoPar) { modoPar = false; $('#upz').classList.remove('on'); $('#mz').style.cursor = ''; } pintarLock(); };
      };
      let par = z.parada_lat ? [z.parada_lat, z.parada_lng] : null, modoPar = false;
      const estado = () => { const n = editor ? editor.puntos.length : 0; $('#est').innerHTML = `<span class="${n >= 3 ? 'ok' : 'no'}">${n >= 3 ? '✓' : '•'} ${n} vértice${n === 1 ? '' : 's'}${n >= 3 ? ' · ' + fmtA(km2(editor.puntos)) : ' (mínimo 3)'}</span><span class="${par ? 'ok' : 'no'}">${par ? '✓ Parada ubicada' : '• Sin parada ubicada'}</span>`; };
      const ponerPar = () => { paradaMk && paradaMk.remove(); paradaMk = null; if (par) paradaMk = L.marker(par, { draggable: true, icon: iconoP($('[name=color]', f).value || '#2f6fd6') }).addTo(mapa).bindTooltip('Parada · arrastrala para moverla'); paradaMk && paradaMk.on('dragend', e => { par = [e.target.getLatLng().lat, e.target.getLatLng().lng]; estado(); }); if (paradaMk && typeof bloq !== 'undefined' && bloq) paradaMk.dragging.disable(); estado(); };
      ponerPar(); pintarLock();
      const clicMapa = e => { if (bloq) return; if (e.originalEvent.shiftKey || modoPar) { editor.puntos.pop(); editor.goma(false); editor.redibujar && editor.redibujar(); par = [e.latlng.lat, e.latlng.lng]; ponerPar(); if (modoPar) { modoPar = false; $('#upz').classList.remove('on'); $('#mz').style.cursor = ''; } } setTimeout(estado, 0); };
      mapa.on('click', clicMapa);
      const obs = setInterval(() => { if (!editor) return clearInterval(obs); estado(); }, 700);
      $('[name=color]', f).oninput = e => { $('#sw').style.background = e.target.value; ponerPar(); };
      const cerrar = () => { clearInterval(obs); mapa.off('click', clicMapa); editor.quitar(); editor = null; actual = null; paradaMk && paradaMk.remove(); ed.classList.add('oculto'); $('#mz').style.cursor = ''; pintar(); };
      $('#cz').onclick = cerrar;
      $('#upz').onclick = () => { modoPar = !modoPar; $('#upz').classList.toggle('on', modoPar); $('#mz').style.cursor = modoPar ? 'crosshair' : ''; if (modoPar) toast('Tocá en el mapa dónde esperan los móviles'); };
      $('#lz2').onclick = () => { editor.limpiar(); estado(); };
      $('#gz').onclick = async () => {
        const d = leer(f);
        if (!(d.nombre || '').trim()) return toast('Poné un nombre a la zona', 'error');
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
      zs.forEach(z => { if (actual && actual.id === z.id) return; const p = L.polygon(z.poligono, { color: '#d00', fillOpacity: .2 }).addTo(capas); p.bindTooltip(esc(z.nombre || 'Zona peligrosa')); p.on('click', () => { if (modo === 'editar') iniciar(z); else if (modo === 'borrar') borrar(z); }); });
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
