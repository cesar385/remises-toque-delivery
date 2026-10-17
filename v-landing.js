// Administración → Página principal: el admin agrega, edita, ordena, oculta y elimina secciones de la página de inicio
// y cambia el WhatsApp. Se guarda en la base (rodar.config 'landing'); sin cambios, la página usa su contenido original.
(function () {
  const LD = window.RODAR_LANDING;
  const TIPOS = { hero: ['🏁', 'Portada'], texto: ['📝', 'Texto con imagen'], tarjetas: ['🗂', 'Tarjetas'], banner: ['📢', 'Banner destacado'] };
  const NUEVA = {
    hero: () => ({ tipo: 'hero', visible: true, menu: '', titulo: 'Título', destacado: 'destacado', texto: '', boton: { t: 'Botón', u: 'pasajero.html' }, boton2: { t: '', u: '' } }),
    texto: () => ({ tipo: 'texto', visible: true, menu: '', titulo: 'Nueva sección', texto: 'Escribí acá el texto.', bullets: [], boton: { t: '', u: '' }, boton2: { t: '', u: '' }, visual: 'emoji', emoji: '⭐', imagen: '', lado: 'der', fondo: 'blanco' }),
    tarjetas: () => ({ tipo: 'tarjetas', visible: true, menu: '', titulo: 'Nuevas tarjetas', texto: '', fondo: 'gris', items: [{ emoji: '⭐', titulo: 'Tarjeta', texto: 'Descripción', cta: 'Ver más →', url: '' }] }),
    banner: () => ({ tipo: 'banner', visible: true, menu: '', emoji: '📢', titulo: 'Título del banner', texto: 'Texto del banner.', boton: { t: 'Saber más', u: '' } }),
  };
  const ancla = (cfg, s) => { let base = LD.slug(s.menu || s.titulo), id = base, n = 2; while (cfg.secciones.some(x => x !== s && x.id === id)) id = base + '-' + n++; return id; };
  const urlsMalas = s => {
    const lista = [s.boton, s.boton2, ...(s.items || []).map(i => ({ t: i.cta || i.titulo, u: i.url }))].filter(b => b && b.u && String(b.u).trim());
    return lista.filter(b => !LD.url(b.u)).map(b => b.u);
  };

  ruta('pagina-principal', {
    titulo: 'Página principal', roles: ['admin'], async render(main) {
      let guardada = null; try { guardada = await api('/api/landing'); } catch (e) { fallo(e); }
      const cfg = JSON.parse(JSON.stringify(LD.normalizar(guardada)));
      cfg.secciones.forEach(s => { if (!s.id) s.id = ancla(cfg, s); });
      let sucio = false;
      main.innerHTML = cabecera('Página principal', 'Elegí qué secciones se muestran en la página de inicio, su orden y su contenido. También podés cambiar el WhatsApp.',
        '<a class="btn sec" id="ver" href="index.html" target="_blank" rel="noopener">👁 Ver página</a><button class="btn sec" id="rest">↺ Restaurar original</button><button class="btn verde" id="gua">💾 Guardar cambios</button>') +
        `<div class="card"><div class="head"><h3>💬 Contacto de la página</h3></div><div class="body" id="gen"></div></div>
         <div class="card" style="margin-top:14px"><div class="head"><h3>🧩 Secciones</h3><button class="btn chico" id="add">+ Agregar sección</button></div><div class="body" id="lst"></div></div>`;
      const gen = formulario([
        { k: 'whatsapp', l: 'Número de WhatsApp (con código de país, sin + ni espacios)', ph: '5493454123456', ayuda: 'Se usa en el botón verde flotante de la página. Vacío = el botón no aparece.' },
        { k: 'whatsapp_texto', l: 'Mensaje que se escribe al abrir el chat', ph: 'Hola, quiero pedir un remís' },
        { k: 'telefono', l: 'Teléfono que se muestra arriba (opcional)', ayuda: 'Vacío = se usa el de los datos de la empresa.' },
        { k: 'pie', l: 'Texto del pie de página (opcional)', ph: '© 2026 Remises TOQUE!' },
        { t: 'html', html: '<div class="nota" style="font-size:12.5px"><b>Ojo:</b> este número es el que ven los clientes en la página. Los mensajes que se reciben y se envían desde el panel salen por la línea de WhatsApp Business conectada en Supabase (ver README); si cambiás de línea, hay que actualizar también esas credenciales.</div>' },
      ], cfg);
      $('#gen').append(gen);
      const marcar = () => { sucio = true; $('#gua').textContent = '💾 Guardar cambios •'; };
      $$('input,textarea', gen).forEach(i => i.oninput = marcar);

      function lista() {
        $('#lst').innerHTML = cfg.secciones.length ? cfg.secciones.map((s, i) => {
          const [ico, nom] = TIPOS[s.tipo] || ['❔', s.tipo];
          return `<div class="fila" data-i="${i}" style="gap:8px;padding:10px 4px;border-bottom:1px solid var(--borde);align-items:center;${s.visible === false ? 'opacity:.55' : ''}">
            <span style="font-size:24px;width:34px;text-align:center">${ico}</span>
            <div style="flex:1;min-width:0"><b>${esc(s.titulo || '(sin título)')}</b>${s.destacado ? ' <span style="color:var(--suave)">' + esc(s.destacado) + '</span>' : ''}<br><small style="color:var(--suave)">${nom}${s.menu ? ' · en el menú: «' + esc(s.menu) + '»' : ''}</small></div>
            ${s.visible === false ? '<span class="pill">Oculta</span>' : ''}
            <button class="btn-icono" data-a="sube" title="Subir" ${i === 0 ? 'disabled' : ''}>▲</button><button class="btn-icono" data-a="baja" title="Bajar" ${i === cfg.secciones.length - 1 ? 'disabled' : ''}>▼</button>
            <button class="btn-icono" data-a="vis" title="${s.visible === false ? 'Mostrar' : 'Ocultar'}">${s.visible === false ? '🙈' : '👁'}</button>
            <button class="btn-icono" data-a="edit" title="Editar">✎</button><button class="btn-icono" data-a="dup" title="Duplicar">⧉</button><button class="btn-icono" data-a="del" title="Eliminar">🗑</button></div>`;
        }).join('') : '<p style="color:var(--suave)">No hay secciones. Agregá la primera.</p>';
        $$('#lst [data-a]').forEach(b => b.onclick = () => accion(+b.closest('[data-i]').dataset.i, b.dataset.a));
      }
      async function accion(i, a) {
        const s = cfg.secciones[i];
        if (a === 'sube' || a === 'baja') { const j = a === 'sube' ? i - 1 : i + 1; [cfg.secciones[i], cfg.secciones[j]] = [cfg.secciones[j], cfg.secciones[i]]; }
        else if (a === 'vis') s.visible = s.visible === false;
        else if (a === 'dup') { const c = JSON.parse(JSON.stringify(s)); c.titulo = (c.titulo || '') + ' (copia)'; c.menu = ''; c.id = ancla(cfg, c); cfg.secciones.splice(i + 1, 0, c); }
        else if (a === 'del') { if (!(await confirmar(`¿Eliminar la sección «${s.titulo}»? Si solo querés que no se vea, usá el ojo para ocultarla.`, 'Eliminar sección'))) return; cfg.secciones.splice(i, 1); }
        else if (a === 'edit') { const ok = await editar(s); if (!ok) return; }
        marcar(); lista();
      }
      $('#add').onclick = async () => {
        const r = await pedir('Agregar sección', [{ k: 'tipo', l: 'Tipo de sección', t: 'select', w: 'full', op: Object.entries(TIPOS).map(([k, [ico, n]]) => [k, ico + ' ' + n]) },
          { t: 'html', html: '<div class="nota" style="font-size:12.5px"><b>Portada:</b> título grande con botones. <b>Texto con imagen:</b> título, texto, lista y botón junto a un dibujo, foto o celular. <b>Tarjetas:</b> una grilla de tarjetas con enlace. <b>Banner:</b> franja azul con un botón.</div>' }]);
        if (!r) return;
        const s = NUEVA[r.tipo](); s.id = ancla(cfg, s); cfg.secciones.push(s);
        if (await editar(s)) { marcar(); lista(); } else cfg.secciones.pop();
      };
      $('#gua').onclick = async () => {
        Object.assign(cfg, leer(gen));
        if (cfg.whatsapp && LD.soloDigitos(cfg.whatsapp).length < 8) return toast('El número de WhatsApp parece incompleto. Poné código de país y área, ej. 5493454123456', 'error');
        const malas = cfg.secciones.flatMap(urlsMalas);
        if (malas.length && !(await confirmar('Hay enlaces que no son válidos y no van a funcionar: ' + malas.slice(0, 4).join(', ') + '. Usá páginas del sitio (pasajero.html), anclas (#ayuda) o direcciones https://. ¿Guardar igual?', 'Enlaces inválidos'))) return;
        try { await api('/api/landing', { body: { ...cfg, whatsapp: LD.soloDigitos(cfg.whatsapp) } }); sucio = false; $('#gua').textContent = '💾 Guardar cambios'; toast('Página principal guardada', 'ok'); } catch (e) { fallo(e); }
      };
      $('#rest').onclick = async () => {
        if (!(await confirmar('Se borran todos tus cambios y la página vuelve al contenido original. ¿Continuar?', 'Restaurar original'))) return;
        try { await api('/api/landing', { body: { restaurar: true } }); toast('Página restaurada', 'ok'); ir('pagina-principal'); } catch (e) { fallo(e); }
      };
      window.addEventListener('beforeunload', e => { if (sucio && rutaActual() === 'pagina-principal') { e.preventDefault(); e.returnValue = ''; } });
      lista();
    }
  });

  // ---------- editor de una sección ----------
  function editar(s) {
    return new Promise(res => {
      const bt = (k, l) => [{ k: k + '_t', l: l + ' · texto' }, { k: k + '_u', l: l + ' · enlace', ph: 'pasajero.html, #ayuda o https://…' }];
      const base = { ...s, boton_t: s.boton && s.boton.t, boton_u: s.boton && s.boton.u, boton2_t: s.boton2 && s.boton2.t, boton2_u: s.boton2 && s.boton2.u,
        bullets_txt: (s.bullets || []).join('\n'), items_txt: (s.items || []).map(i => [i.emoji, i.titulo, i.texto, i.cta, i.url].map(x => String(x ?? '').replace(/\|/g, '/')).join(' | ')).join('\n') };
      const campos = [{ t: 'titulo', l: TIPOS[s.tipo][0] + ' ' + TIPOS[s.tipo][1] }];
      if (s.tipo === 'hero') campos.push({ k: 'titulo', l: 'Título' }, { k: 'destacado', l: 'Parte destacada (en verde)' }, { k: 'texto', l: 'Texto', t: 'textarea', w: 'full' }, ...bt('boton', 'Botón principal'), ...bt('boton2', 'Botón secundario'));
      if (s.tipo === 'texto') campos.push({ k: 'titulo', l: 'Título', w: 'full' }, { k: 'texto', l: 'Texto', t: 'textarea', w: 'full' }, { k: 'bullets_txt', l: 'Lista con tildes (una por línea)', t: 'textarea', w: 'full' }, ...bt('boton', 'Botón principal'), ...bt('boton2', 'Botón secundario'),
        { t: 'titulo', l: 'Imagen' }, { k: 'visual', l: 'Qué se muestra al costado', t: 'select', op: [['emoji', 'Dibujo (emoji)'], ['imagen', 'Foto propia'], ['celular', 'Celular de ejemplo'], ['ninguno', 'Nada']] }, { k: 'emoji', l: 'Emoji (si elegiste dibujo)' },
        { t: 'html', html: '<div class="campo"><label>Foto propia (JPG/PNG, hasta 1,5 MB)</label><input type="file" id="foto" accept="image/*"><div id="fotoPrev" style="margin-top:6px"></div></div>' },
        { k: 'lado', l: 'Lado de la imagen', t: 'select', op: [['der', 'Derecha'], ['izq', 'Izquierda']] }, { k: 'fondo', l: 'Fondo', t: 'select', op: [['blanco', 'Blanco'], ['gris', 'Gris']] });
      if (s.tipo === 'tarjetas') campos.push({ k: 'titulo', l: 'Título', w: 'full' }, { k: 'texto', l: 'Texto debajo del título (opcional)', w: 'full' }, { k: 'fondo', l: 'Fondo', t: 'select', op: [['blanco', 'Blanco'], ['gris', 'Gris']] },
        { k: 'items_txt', l: 'Tarjetas (una por línea): emoji | título | texto | texto del enlace | enlace', t: 'textarea', w: 'full', ph: '🚕 | Conductor | Recibí viajes… | Ingresar → | conductor.html' });
      if (s.tipo === 'banner') campos.push({ k: 'emoji', l: 'Emoji' }, { k: 'titulo', l: 'Título' }, { k: 'texto', l: 'Texto', t: 'textarea', w: 'full' }, ...bt('boton', 'Botón'));
      campos.push({ t: 'titulo', l: 'Menú' }, { k: 'menu', l: 'Texto en el menú de arriba (vacío = no aparece)', w: 'full' });
      const f = formulario(campos, base); let imagen = s.imagen || '';
      const cuerpo = h('<div></div>'); cuerpo.append(f);
      const inp = $('#foto', cuerpo), prev = $('#fotoPrev', cuerpo);
      const verFoto = () => { if (prev) prev.innerHTML = LD.dataImg(imagen) ? `<img src="${esc(LD.dataImg(imagen))}" style="max-height:90px;border-radius:8px"> <button type="button" class="btn sec chico" id="quitar">Quitar</button>` : ''; const q = $('#quitar', cuerpo); if (q) q.onclick = () => { imagen = ''; verFoto(); }; };
      if (inp) { verFoto(); inp.onchange = async () => { const fi = inp.files[0]; if (!fi) return; try { imagen = (await subir(fi)).archivo; $('[name=visual]', cuerpo).value = 'imagen'; verFoto(); } catch (e) { fallo(e); inp.value = ''; } }; }
      let hecho = false;
      modal({ titulo: 'Editar sección', ancho: true, cuerpo, alCerrar: () => !hecho && res(false), botones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: '✓ Aplicar', clase: 'verde', accion: () => {
        const d = leer(f);
        if (!(d.titulo || '').trim()) { toast('Poné un título', 'error'); return false; }
        Object.assign(s, { titulo: d.titulo.trim(), menu: (d.menu || '').trim() });
        ['texto', 'destacado', 'emoji', 'visual', 'lado', 'fondo'].forEach(k => { if (d[k] !== undefined) s[k] = d[k]; });
        ['boton', 'boton2'].forEach(k => { if (d[k + '_t'] !== undefined) s[k] = { t: (d[k + '_t'] || '').trim(), u: (d[k + '_u'] || '').trim() }; });
        if (d.bullets_txt !== undefined) s.bullets = d.bullets_txt.split('\n').map(x => x.trim()).filter(Boolean);
        if (s.tipo === 'texto') s.imagen = imagen;
        if (d.items_txt !== undefined) s.items = d.items_txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [emoji, titulo, texto, cta, url] = l.split('|').map(x => x.trim()); return { emoji: emoji || '', titulo: titulo || '', texto: texto || '', cta: cta || '', url: url || '' }; });
        s.id = s.id || LD.slug(s.menu || s.titulo);
        hecho = true; res(true);
      } }] });
    });
  }
})();
