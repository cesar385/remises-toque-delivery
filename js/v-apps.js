// Apps y enlaces: links y códigos QR para repartir la app de pasajeros y la de conductores.
function qrSvg(texto, celda) {
  const q = qrcode(0, 'M'); q.addData(texto); q.make();
  return q.createSvgTag({ cellSize: celda || 5, margin: 2, scalable: true });
}
function urlApp(archivo) { return new URL(archivo, location.href.split('#')[0]).href; }
ruta('apps-enlaces', {
  titulo: 'Apps y enlaces', roles: ['admin'], async render(main) {
    const cfg = await api('/api/pub/config').catch(() => ({}));
    const emp = (cfg && cfg.nombre) || 'la remisería';
    const apps = [
      { k: 'pasajero', t: '🙋 App de pasajeros', url: urlApp('pasajero.html'), para: 'Para tus clientes: piden el remís desde el celular, ven el precio estimado, siguen el auto en el mapa y reciben el PIN.',
        msj: `¡Pedí tu remís de ${emp} desde el celular! Entrá acá y guardala como app: ` },
      { k: 'conductor', t: '🚕 App de conductores', url: urlApp('conductor.html'), para: 'Para tus choferes: reciben viajes, usan el tarifador, la radio y el botón SOS. Entran con su DNI o usuario y la contraseña que les das.',
        msj: `Hola, esta es la app de conductores de ${emp}. Abrila, instalala en el celular y entrá con tu DNI y tu contraseña: ` },
    ];
    main.innerHTML = cabecera('Apps y enlaces', 'Compartí las apps por WhatsApp o imprimí el cartel con el código QR. No hace falta Play Store ni App Store: se instalan desde el navegador.') +
      `<div class="nota"><b>¿Cómo se instalan?</b> En <b>Android</b>, al abrir el enlace aparece el botón <i>📲 Instalar app</i> (o menú ⋮ → <i>Instalar aplicación</i>). En <b>iPhone</b>, abrir con Safari → botón Compartir → <i>Agregar a pantalla de inicio</i>. Queda un ícono como cualquier app.</div>
      <div class="grid g2">${apps.map(a => `<div class="card"><div class="head"><h3>${a.t}</h3></div><div class="body">
        <p style="margin-top:0">${esc(a.para)}</p>
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="width:170px;height:170px;flex:none">${qrSvg(a.url)}</div>
        <div style="flex:1;min-width:200px"><div class="campo"><label>Enlace</label><input readonly value="${esc(a.url)}" onclick="this.select()"></div>
        <div class="fila" style="flex-wrap:wrap;margin-top:8px"><button class="btn chico" data-c="${a.k}">📋 Copiar</button><button class="btn chico verde" data-w="${a.k}">WhatsApp</button><a class="btn sec chico" href="${esc(a.url)}" target="_blank" rel="noopener">Abrir</a><button class="btn sec chico" data-p="${a.k}">🖨 Imprimir cartel</button></div></div></div>
      </div></div>`).join('')}</div>`;
    const de = k => apps.find(a => a.k === k);
    $$('[data-c]', main).forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(de(b.dataset.c).url); toast('Enlace copiado', 'ok'); } catch { toast('No se pudo copiar: seleccioná el enlace y copialo', 'error'); } });
    $$('[data-w]', main).forEach(b => b.onclick = () => { const a = de(b.dataset.w); window.open('https://wa.me/?text=' + encodeURIComponent(a.msj + a.url), '_blank', 'noopener'); });
    $$('[data-p]', main).forEach(b => b.onclick = () => {
      const a = de(b.dataset.p), pas = a.k === 'pasajero';
      paginaImpresion('Cartel ' + a.t, `<div style="text-align:center;padding:30px 10px;border:3px solid #215181;border-radius:24px">
        <img src="${new URL('img/logo.png', location.href).href}" alt="${esc(emp)}" style="width:300px">
        <div style="font-size:26px;font-weight:700;margin:14px 0 4px">${pas ? 'Pedí tu remís desde el celular' : 'App para conductores'}</div>
        <div style="font-size:17px;color:#444">${pas ? 'Escaneá el código con la cámara, marcá dónde estás y listo.' : 'Escaneá el código, instalá la app y entrá con tu DNI y contraseña.'}</div>
        <div style="width:330px;height:330px;margin:24px auto">${qrSvg(a.url, 8)}</div>
        <div style="font-size:14px;color:#555;word-break:break-all">${esc(a.url)}</div>
        ${pas && cfg.telefono ? `<div style="font-size:22px;font-weight:700;margin-top:18px">📞 ${esc(cfg.telefono)}</div>` : ''}</div>`);
    });
  }
});
