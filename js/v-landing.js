// Administración → Página principal: el admin agrega, edita, ordena, oculta y elimina secciones de la página de inicio
// y cambia el WhatsApp. Se guarda en la base (rodar.config 'landing'); sin cambios, la página usa su contenido original.
(function () {
  const LD = window.RODAR_LANDING;
  const TIPOS = { hero: ['🏁', 'Portada'], texto: ['📝', 'Texto con imagen'], tarjetas: ['🗂', 'Tarjetas'], banner: ['📢', 'Banner destacado'], videos: ['🎬', 'Videos'] };
  const NUEVA = {
    hero: () => ({ tipo: 'hero', visible: true, menu: '', titulo: 'Título', destacado: 'destacado', texto: '', boton: { t: 'Botón', u: 'pasajero.html' }, boton2: { t: '', u: '' } }),
    texto: () => ({ tipo: 'texto', visible: true, menu: '', titulo: 'Nueva sección', texto: 'Escribí acá el texto.', bullets: [], boton: { t: '', u: '' }, boton2: { t: '', u: '' }, visual: 'emoji', emoji: '⭐', imagen: '', lado: 'der', fondo: 'blanco' }),
    tarjetas: () => ({ tipo: 'tarjetas', visible: true, menu: '', titulo: 'Nuevas tarjetas', texto: '', fondo: 'gris', items: [{ emoji: '⭐', titulo: 'Tarjeta', texto: 'Descripción', cta: 'Ver más →', url: '' }] }),
    videos: () => ({ tipo: 'videos', visible: true, menu: '', titulo: 'Conocenos', texto: '', fondo: 'blanco', videos: [] }),
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
         <div class="card" style="margin-top:14px"><div class="head"><h3>📣 Redes sociales</h3></div><div class="body" id="redesF"></div></div>
         <div class="card" style="margin-top:14px"><div class="head"><h3>ℹ️ Página «Sobre nosotros»</h3><a class="btn sec chico" href="nosotros.html" target="_blank" rel="noopener">👁 Ver página</a></div><div class="body" id="nos"></div></div>
         <div class="card" style="margin-top:14px"><div class="head"><h3>📜 Términos y condiciones</h3><span class="fila" style="gap:6px"><a class="btn sec chico" href="terminos.html?para=pasajeros" target="_blank" rel="noopener">👁 Pasajeros</a><a class="btn sec chico" href="terminos.html?para=conductores" target="_blank" rel="noopener">👁 Conductores</a></span></div><div class="body"><div class="seg-t" id="tycTabs"><button type="button" data-t="p" class="on">🙂 Pasajeros</button><button type="button" data-t="c">🚕 Conductores</button></div><div id="tyc"></div><div id="tycC" style="display:none"></div></div></div>
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
      // Redes sociales: se muestran como íconos al pie de la página principal y de "Sobre nosotros"
      const redesF = formulario([{ t: 'html', html: '<div class="nota" style="font-size:12.5px">Pegá el enlace de cada red (o solo el usuario, ej. <b>@remisestoque</b>). Las que dejes vacías no aparecen. Se ven como íconos al pie de la página.</div>' },
        ...LD.REDES.map(r => ({ k: 'red_' + r.k, l: r.n, ph: r.base + 'remisestoque' }))], Object.fromEntries(LD.REDES.map(r => ['red_' + r.k, (cfg.redes || {})[r.k] || ''])));
      $('#redesF').append(redesF); $$('input', redesF).forEach(i => i.oninput = marcar);
      const leerRedes = () => { const d = leer(redesF), out = {}; LD.REDES.forEach(r => { const v = String(d['red_' + r.k] || '').trim(); if (v) out[r.k] = v; }); return out; };
      // "Sobre nosotros": se abre desde la tarjeta "Sobre nosotros → Saber más" de la página principal
      const N = cfg.nosotros;
      const nos = formulario([
        { t: 'html', html: '<div class="nota" style="font-size:12.5px">Es la página que se abre al tocar <b>Saber más</b> en la tarjeta <b>Sobre nosotros</b>. Contá por qué nació el servicio y qué problema resuelve. Cada bloque se muestra como una tarjeta.</div>' },
        { k: 'titulo', l: 'Título', w: 'full' }, { k: 'bajada', l: 'Texto debajo del título', t: 'textarea', w: 'full' },
        { k: 'bloques_txt', l: 'Bloques (uno por línea): emoji | título | texto', t: 'textarea', w: 'full', ph: '🌱 | ¿Por qué nació? | Remises TOQUE! nació en Federal…' },
        { k: 'cierre', l: 'Frase final (junto al botón «Pedí tu remís»)', w: 'full' },
      ], { titulo: N.titulo, bajada: N.bajada, cierre: N.cierre, bloques_txt: N.bloques.map(b => [b.emoji, b.titulo, b.texto].map(x => String(x ?? '').replace(/\|/g, '/').replace(/\n/g, ' ')).join(' | ')).join('\n') });
      $('#nos').append(nos); const bt = $('[name=bloques_txt]', nos); if (bt) bt.rows = 8;
      $$('input,textarea', nos).forEach(i => i.oninput = marcar);
      const leerNos = () => { const d = leer(nos); const bloques = String(d.bloques_txt || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [emoji, titulo, ...tx] = l.split('|').map(x => x.trim()); return { emoji: emoji || '', titulo: titulo || '', texto: tx.join(' | ') }; });
        return { titulo: (d.titulo || '').trim() || 'Sobre nosotros', bajada: (d.bajada || '').trim(), bloques, cierre: (d.cierre || '').trim() }; };

      // Términos y condiciones (terminos.html): enlazados desde el pie de la página, el registro de pasajeros y el ingreso de conductores
      const LN = LD.normalizar(null);
      const formTyc = (x, para) => formulario([
        { t: 'html', html: `<div class="nota" style="font-size:12.5px">Texto para <b>${para}</b>. Cada sección empieza con <b>## Título</b>, las viñetas con <b>- </b> y entre párrafos va una línea en blanco. El texto de ejemplo es una base original: <b>conviene que lo revise un abogado</b> antes de publicarlo. Al cambiarlo, actualizá la fecha.</div>` },
        { k: 'titulo', l: 'Título' }, { k: 'actualizado', l: 'Fecha de última actualización', t: 'date' },
        { k: 'texto', l: 'Texto', t: 'textarea', w: 'full' },
      ], x);
      const tyc = formTyc(cfg.terminos || LN.terminos, 'pasajeros'), tycC = formTyc(cfg.terminos_cond || LN.terminos_cond, 'conductores');
      $('#tyc').append(tyc); $('#tycC').append(tycC);
      [tyc, tycC].forEach(f => { const tt = $('[name=texto]', f); if (tt) { tt.rows = 18; tt.style.fontFamily = 'ui-monospace,Consolas,monospace'; tt.style.fontSize = '13px'; } $$('input,textarea', f).forEach(i => i.oninput = marcar); });
      $$('#tycTabs button').forEach(b => b.onclick = () => { $$('#tycTabs button').forEach(x => x.classList.toggle('on', x === b)); $('#tyc').style.display = b.dataset.t === 'p' ? '' : 'none'; $('#tycC').style.display = b.dataset.t === 'c' ? '' : 'none'; });
      const leerT = (f, def) => { const d = leer(f); return { titulo: (d.titulo || '').trim() || def, actualizado: d.actualizado || '', texto: String(d.texto || '').trim() }; };
      const leerTyc = () => leerT(tyc, 'Términos y condiciones para pasajeros'), leerTycC = () => leerT(tycC, 'Términos y condiciones para conductores');

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
          { t: 'html', html: '<div class="nota" style="font-size:12.5px"><b>Portada:</b> título grande con botones. <b>Texto con imagen:</b> título, texto, lista y botón junto a un dibujo, foto o celular. <b>Tarjetas:</b> una grilla de tarjetas con enlace. <b>Banner:</b> franja azul con un botón. <b>Videos:</b> uno o varios videos de YouTube, Facebook, Google Drive o Vimeo.</div>' }]);
        if (!r) return;
        const s = NUEVA[r.tipo](); s.id = ancla(cfg, s); cfg.secciones.push(s);
        if (await editar(s)) { marcar(); lista(); } else cfg.secciones.pop();
      };
      $('#gua').onclick = async () => {
        Object.assign(cfg, leer(gen)); cfg.nosotros = leerNos(); cfg.redes = leerRedes(); cfg.terminos = leerTyc(); cfg.terminos_cond = leerTycC();
        if (!cfg.terminos.texto || !cfg.terminos_cond.texto) return toast('Los Términos y condiciones no pueden quedar vacíos', 'error');
        const malasR = LD.REDES.filter(r => cfg.redes[r.k] && !LD.redUrl(r, cfg.redes[r.k])); if (malasR.length) return toast('Revisá el enlace de ' + malasR[0].n, 'error');
        if (!cfg.nosotros.bloques.length) return toast('La página «Sobre nosotros» necesita al menos un bloque', 'error');
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

  // Achica una foto en el navegador (máx. 1400 px, JPEG) para que la página cargue rápido; acepta fotos del celular
  function achicarFoto(file, max = 1400) {
    return new Promise((ok, mal) => {
      if (!/^image\//.test(file.type)) return mal(new Error('Elegí una imagen (JPG, PNG o WEBP)'));
      if (file.size > 20e6) return mal(new Error('La imagen pesa más de 20 MB'));
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.82)); };
      im.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen')); }; im.src = url;
    });
  }

  // ---------- editor de una sección ----------
  function editar(s) {
    return new Promise(res => {
      const bt = (k, l) => [{ k: k + '_t', l: l + ' · texto' }, { k: k + '_u', l: l + ' · enlace', ph: 'pasajero.html, #ayuda o https://…' }];
      const base = { ...s, boton_t: s.boton && s.boton.t, boton_u: s.boton && s.boton.u, boton2_t: s.boton2 && s.boton2.t, boton2_u: s.boton2 && s.boton2.u,
        bullets_txt: (s.bullets || []).join('\n'), videos_txt: (s.videos || []).map(v => v.titulo ? v.url + ' | ' + v.titulo : v.url).join('\n'), items_txt: (s.items || []).map(i => [i.emoji, i.titulo, i.texto, i.cta, i.url].map(x => String(x ?? '').replace(/\|/g, '/')).join(' | ')).join('\n') };
      const campos = [{ t: 'titulo', l: TIPOS[s.tipo][0] + ' ' + TIPOS[s.tipo][1] }];
      if (s.tipo === 'hero') campos.push({ k: 'titulo', l: 'Título' }, { k: 'destacado', l: 'Parte destacada (en verde)' }, { k: 'texto', l: 'Texto', t: 'textarea', w: 'full' }, ...bt('boton', 'Botón principal'), ...bt('boton2', 'Botón secundario'));
      if (s.tipo === 'texto') campos.push({ k: 'titulo', l: 'Título', w: 'full' }, { k: 'texto', l: 'Texto', t: 'textarea', w: 'full' }, { k: 'bullets_txt', l: 'Lista con tildes (una por línea)', t: 'textarea', w: 'full' }, ...bt('boton', 'Botón principal'), ...bt('boton2', 'Botón secundario'),
        { t: 'titulo', l: 'Imagen' }, { k: 'visual', l: 'Qué se muestra al costado', t: 'select', op: [['emoji', 'Dibujo (emoji)'], ['imagen', 'Foto propia'], ['video', 'Video (el primero de la lista de videos)'], ['celular', 'Celular de ejemplo'], ['ninguno', 'Nada']] }, { k: 'emoji', l: 'Emoji (si elegiste dibujo)' },
        { t: 'html', html: '<div class="campo"><label>Foto propia (JPG, PNG o WEBP; se achica sola)</label><small style="color:var(--suave)">Usá fotos tuyas o con licencia de uso comercial (por ejemplo, de bancos de imágenes gratuitos que lo permitan). No uses fotos de internet sin permiso ni con personas que no lo autorizaron.</small><input type="file" id="foto" accept="image/*"><div id="fotoPrev" style="margin-top:6px"></div></div>' },
        { k: 'lado', l: 'Lado de la imagen', t: 'select', op: [['der', 'Derecha'], ['izq', 'Izquierda']] }, { k: 'fondo', l: 'Fondo', t: 'select', op: [['blanco', 'Blanco'], ['gris', 'Gris']] });
      if (s.tipo === 'tarjetas') campos.push({ k: 'titulo', l: 'Título', w: 'full' }, { k: 'texto', l: 'Texto debajo del título (opcional)', w: 'full' }, { k: 'fondo', l: 'Fondo', t: 'select', op: [['blanco', 'Blanco'], ['gris', 'Gris']] },
        { k: 'items_txt', l: 'Tarjetas (una por línea): emoji | título | texto | texto del enlace | enlace', t: 'textarea', w: 'full', ph: '🚕 | Conductor | Recibí viajes… | Ingresar → | conductor.html' },
        { t: 'html', html: '<div class="campo" style="grid-column:1/-1"><label>📷 Foto de cada tarjeta (opcional: reemplaza al emoji)</label><small style="color:var(--suave)">Solo fotos propias o con licencia de uso comercial.</small><div id="fotosTj"></div></div>' });
      if (s.tipo === 'videos') campos.push({ k: 'titulo', l: 'Título', w: 'full' }, { k: 'texto', l: 'Texto debajo del título (opcional)', w: 'full' }, { k: 'fondo', l: 'Fondo', t: 'select', op: [['blanco', 'Blanco'], ['gris', 'Gris']] });
      if (s.tipo === 'banner') campos.push({ k: 'emoji', l: 'Emoji' }, { k: 'titulo', l: 'Título' }, { k: 'texto', l: 'Texto', t: 'textarea', w: 'full' }, ...bt('boton', 'Botón'));
      // Videos: en cualquier sección (en «Videos» son el contenido principal; en las demás se muestran debajo)
      campos.push({ t: 'titulo', l: '🎬 Videos' + (s.tipo === 'videos' ? '' : ' (opcional)') },
        { k: 'videos_txt', l: 'Videos (uno por línea): enlace | título opcional', t: 'textarea', w: 'full', ph: 'https://www.youtube.com/watch?v=… | Cómo pedir tu remís' },
        { t: 'html', html: '<div class="nota" style="font-size:12.5px">Pegá el enlace del video tal como lo copiás del navegador o de la app: <b>YouTube</b> (también Shorts), <b>Facebook</b>, <b>Google Drive</b> (compartido como «Cualquier persona con el enlace»), <b>Vimeo</b> o un archivo <b>.mp4</b> con dirección https. Para subir un video desde la compu o el celular, subilo primero a YouTube (puede ser «No listado») o a Google Drive y pegá acá el enlace.' + (s.tipo === 'texto' ? ' En «Texto con imagen» podés elegir <b>Video</b> en «Qué se muestra al costado» para poner el primero al lado del texto.' : s.tipo === 'videos' ? '' : ' Se muestran debajo del contenido de la sección.') + '</div><div class="campo" style="margin-top:8px"><label>📤 O subí un video desde la compu o el celular (MP4, hasta 50 MB · se reproduce solo y sin sonido)</label><input type="file" id="vidArch" accept="video/mp4,video/webm,video/quicktime"><div id="vidProg" style="font-size:13px;margin-top:6px"></div></div><div id="vidPrev" style="margin-top:8px"></div>' });
      campos.push({ t: 'titulo', l: 'Menú' }, { k: 'menu', l: 'Texto en el menú de arriba (vacío = no aparece)', w: 'full' });
      const f = formulario(campos, base); let imagen = s.imagen || '';
      const fotosTj = {}; (s.items || []).forEach(i => { if (i.imagen) fotosTj[(i.titulo || '').trim()] = i.imagen; });   // por título de la tarjeta
      const cuerpo = h('<div></div>'); cuerpo.append(f);
      const inp = $('#foto', cuerpo), prev = $('#fotoPrev', cuerpo);
      const verFoto = () => { if (prev) prev.innerHTML = LD.dataImg(imagen) ? `<img src="${esc(LD.dataImg(imagen))}" alt="Vista previa de la foto" style="max-height:90px;border-radius:8px"> <button type="button" class="btn sec chico" id="quitar">Quitar</button>` : ''; const q = $('#quitar', cuerpo); if (q) q.onclick = () => { imagen = ''; verFoto(); }; };
      if (inp) { verFoto(); inp.onchange = async () => { const fi = inp.files[0]; if (!fi) return; try { imagen = await achicarFoto(fi); $('[name=visual]', cuerpo).value = 'imagen'; verFoto(); } catch (e) { fallo(e); inp.value = ''; } }; }
      // Fotos de las tarjetas: una fila por tarjeta (según las líneas escritas), con subir / quitar
      const it = $('[name=items_txt]', cuerpo), ftj = $('#fotosTj', cuerpo);
      const titulosTj = () => (it ? it.value : '').split('\n').map(l => l.trim()).filter(Boolean).map(l => (l.split('|')[1] || '').trim());
      const verFotosTj = () => { if (!ftj) return; const ts = titulosTj();
        ftj.innerHTML = ts.length ? ts.map((t, n) => `<div class="fila" style="gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--borde)">
          <span style="width:70px;height:46px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none">${LD.dataImg(fotosTj[t]) ? `<img src="${esc(LD.dataImg(fotosTj[t]))}" alt="Foto de la tarjeta ${esc(t)}" style="width:100%;height:100%;object-fit:cover">` : '<small style="color:var(--suave)">sin foto</small>'}</span>
          <b style="flex:1;min-width:0">${esc(t || 'Tarjeta ' + (n + 1))}</b>
          <label class="btn sec chico" style="margin:0">${fotosTj[t] ? 'Cambiar' : 'Subir foto'}<input type="file" accept="image/*" data-ft="${n}" style="display:none"></label>
          ${fotosTj[t] ? `<button type="button" class="btn sec chico" data-fq="${n}">Quitar</button>` : ''}</div>`).join('') : '<small style="color:var(--suave)">Escribí las tarjetas arriba para poder ponerles foto.</small>';
        $$('[data-ft]', ftj).forEach(x => x.onchange = async () => { const fi = x.files[0]; if (!fi) return; try { fotosTj[titulosTj()[+x.dataset.ft]] = await achicarFoto(fi, 1000); verFotosTj(); } catch (e) { fallo(e); } });
        $$('[data-fq]', ftj).forEach(x => x.onclick = () => { delete fotosTj[titulosTj()[+x.dataset.fq]]; verFotosTj(); }); };
      if (it) { let tt; it.addEventListener('input', () => { clearTimeout(tt); tt = setTimeout(verFotosTj, 400); }); verFotosTj(); }
      const vt = $('[name=videos_txt]', cuerpo), vp = $('#vidPrev', cuerpo);
      const filasVid = () => (vt ? vt.value : '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf('|'); return i < 0 ? { url: l, titulo: '' } : { url: l.slice(0, i).trim(), titulo: l.slice(i + 1).trim() }; });
      const verVid = () => { if (!vp) return; const fs = filasVid(); vp.innerHTML = fs.length ? fs.map(v => `<div style="font-size:13px;padding:2px 0">${LD.video(v.url) ? '✅' : '❌'} ${esc(v.titulo || v.url)}${LD.video(v.url) ? '' : ' <small style="color:var(--rojo)">— enlace no reconocido</small>'}</div>`).join('') : ''; };
      if (vt) { vt.rows = 6; vt.oninput = verVid; verVid(); }
      // Subir un archivo de video al almacenamiento (bucket público "videos") y agregarlo a la lista
      const va = $('#vidArch', cuerpo), vpr = $('#vidProg', cuerpo);
      if (va) va.onchange = async () => {
        const fi = va.files[0]; if (!fi) return;
        const tipo = fi.type || (/\.mov$/i.test(fi.name) ? 'video/quicktime' : /\.webm$/i.test(fi.name) ? 'video/webm' : 'video/mp4');
        if (fi.size > 50 * 1024 * 1024) { toast(`El video pesa ${(fi.size / 1048576).toFixed(0)} MB y el máximo es 50 MB. Acortalo o bajale la calidad.`, 'error'); va.value = ''; return; }
        va.disabled = true; vpr.textContent = 'Preparando la subida…';
        try {
          const CFG = window.RODAR_CONFIG || {};
          const r = await fetch(CFG.supabaseUrl + '/functions/v1/subir-video', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey },
            body: JSON.stringify({ token: localStorage.getItem('rodar_token'), nombre: fi.name, tipo, tam: fi.size }) });
          const j = await r.json().catch(() => ({})); if (!r.ok || !j.subir) throw new Error(j.error || 'No se pudo preparar la subida');
          await new Promise((ok, mal) => { const x = new XMLHttpRequest(); x.open('PUT', j.subir); x.setRequestHeader('Content-Type', tipo); x.setRequestHeader('x-upsert', 'false');
            x.upload.onprogress = e => { if (e.lengthComputable) vpr.innerHTML = `Subiendo… <b>${Math.round(e.loaded / e.total * 100)}%</b> <progress max="100" value="${Math.round(e.loaded / e.total * 100)}" style="width:160px;vertical-align:middle"></progress>`; };
            x.onload = () => x.status < 300 ? ok() : mal(new Error('El almacenamiento rechazó el video (' + x.status + ')')); x.onerror = () => mal(new Error('Se cortó la conexión mientras subía el video')); x.send(fi); });
          const tit = fi.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 60);
          vt.value = (vt.value.trim() ? vt.value.trim() + '\n' : '') + j.publica + ' | ' + tit; verVid();
          vpr.innerHTML = '✅ Video subido. Se agregó a la lista (podés cambiarle el título después del «|»). Tocá <b>Aplicar</b> y después <b>Guardar cambios</b>.';
        } catch (e) { vpr.textContent = ''; fallo(e); }
        va.disabled = false; va.value = '';
      };
      let hecho = false;
      modal({ titulo: 'Editar sección', ancho: true, cuerpo, alCerrar: () => !hecho && res(false), botones: [{ texto: 'Cancelar', clase: 'sec' }, { texto: '✓ Aplicar', clase: 'verde', accion: () => {
        const d = leer(f);
        if (!(d.titulo || '').trim()) { toast('Poné un título', 'error'); return false; }
        Object.assign(s, { titulo: d.titulo.trim(), menu: (d.menu || '').trim() });
        ['texto', 'destacado', 'emoji', 'visual', 'lado', 'fondo'].forEach(k => { if (d[k] !== undefined) s[k] = d[k]; });
        ['boton', 'boton2'].forEach(k => { if (d[k + '_t'] !== undefined) s[k] = { t: (d[k + '_t'] || '').trim(), u: (d[k + '_u'] || '').trim() }; });
        if (d.bullets_txt !== undefined) s.bullets = d.bullets_txt.split('\n').map(x => x.trim()).filter(Boolean);
        if (s.tipo === 'texto') s.imagen = imagen;
        if (d.videos_txt !== undefined) { const fs = filasVid(), malos = fs.filter(v => !LD.video(v.url)); if (!fs.length && s.tipo === 'videos') { toast('Pegá al menos un enlace de video', 'error'); return false; } if (d.visual === 'video' && !fs.length) { toast('Elegiste «Video» al costado: pegá el enlace en Videos', 'error'); return false; } if (malos.length) { toast('Este enlace no es un video reconocido: ' + malos[0].url, 'error'); return false; } s.videos = fs; }
        if (d.items_txt !== undefined) s.items = d.items_txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [emoji, titulo, texto, cta, url] = l.split('|').map(x => x.trim()); return { emoji: emoji || '', titulo: titulo || '', texto: texto || '', cta: cta || '', url: url || '', imagen: fotosTj[(titulo || '').trim()] || '' }; });
        s.id = s.id || LD.slug(s.menu || s.titulo);
        hecho = true; res(true);
      } }] });
    });
  }
})();
