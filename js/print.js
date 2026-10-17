// Documentos imprimibles (se guardan como PDF desde el diálogo de impresión del navegador)
let ventanaImpresion = null;
function paginaImpresion(titulo, cuerpo) {
  const w = ventanaImpresion && !ventanaImpresion.closed ? ventanaImpresion : window.open('', '_blank');
  ventanaImpresion = null;
  if (!w) { toast('Permití las ventanas emergentes para imprimir', 'error'); return; }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
  <style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1d2a2a;max-width:780px;margin:24px auto;padding:0 16px;font-size:14px;line-height:1.5}
  h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:20px 0 6px;color:#215181}table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border-bottom:1px solid #d9e2e2;padding:6px 4px;text-align:left;font-size:12.5px}th{background:#eef5f5}.r{text-align:right}
  .muted{color:#5b6b6b}.box{border:1px solid #cfdcdc;border-radius:8px;padding:12px 14px;margin:10px 0}.firma{margin-top:70px;border-top:1px solid #333;width:260px;padding-top:4px}
  @media print{.noprint{display:none}body{margin:0}}</style></head><body>
  <div class="noprint" style="text-align:right"><button onclick="print()">Imprimir / Guardar PDF</button></div><div style="margin-bottom:10px"><img src="${new URL('img/logo.png', location.href).href}" alt="" style="height:64px"></div>${cuerpo}</body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { } }, 500);
}

async function imprimir(url) {
  // la ventana se abre en el mismo clic para que el navegador no la bloquee
  ventanaImpresion = window.open('', '_blank');
  if (ventanaImpresion) ventanaImpresion.document.write('<p style="font-family:sans-serif">Preparando documento…</p>');
  const u = new URL(url, 'http://x');
  const partes = u.pathname.split('/').filter(Boolean); // print, tipo, id
  const q = Object.fromEntries(u.searchParams.entries());
  try {
    if (partes[1] === 'ticket') return imprimirTicket(await api(`/api/viajes/${partes[2]}/ticket`));
    if (partes[1] === 'conductores') {
      const filas = await api('/api/informes/conductores?' + qs(q));
      return paginaImpresion('Reporte de conductores', `<h1>Reporte de conductores</h1><div class="muted">${esc(q.desde || '')} a ${esc(q.hasta || '')}</div>
        <table><tr><th>Documento</th><th>Nombre</th><th class="r">Viajes</th><th class="r">Ingresos</th><th class="r">Horas</th><th class="r">Calif.</th></tr>
        ${filas.map(f => `<tr><td>${esc(f.documento)}</td><td>${esc(f.nombre)}</td><td class="r">${f.viajes}</td><td class="r">${pesos(f.ingresos)}</td><td class="r">${f.horas}</td><td class="r">${f.calificacion ?? '—'}</td></tr>`).join('')}</table>`);
    }
    if (partes[1] === 'docreg') return imprimirDocReg(partes[2], +q.autoridad);
  } catch (e) { if (ventanaImpresion) ventanaImpresion.close(); fallo(e); }
}

function imprimirTicket(v) {
  const w = ventanaImpresion && !ventanaImpresion.closed ? ventanaImpresion : window.open('', '_blank');
  ventanaImpresion = null;
  if (!w) { toast('Permití las ventanas emergentes para imprimir', 'error'); return; }
  abrirTicket(w, v, { auto: true });
}

async function imprimirDocReg(tipo, autoridadId) {
  const d = await api('/api/docreg');
  const e = d.empresa || {}; const a = d.autoridades.find(x => x.id === autoridadId) || {};
  const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  const dest = `<p>${esc(e.localidad)}, ${fecha}</p><p>A: ${esc(a.nombre || '')}<br>${esc(a.cargo || '')} — ${esc(a.organismo || '')}<br>${esc(a.direccion || '')}</p><p>S/D</p>`;
  const firma = `<div class="firma">${esc(e.firmante_nombre || '')}<br>${esc(e.firmante || '')} — ${esc(e.razon_social || e.nombre)}<br>CUIT ${esc(e.cuit || '')}</div>`;
  let titulo, cuerpo;
  if (tipo === 'nota') {
    titulo = 'Nota de presentación';
    cuerpo = `${dest}<p>Por medio de la presente, ${esc(e.razon_social || e.nombre)}, CUIT ${esc(e.cuit)}, con domicilio en ${esc(e.direccion)}, ${esc(e.localidad)}, ${esc(e.provincia)}, se dirige a usted a fin de informar que presta el servicio de <b>${esc(e.tipo_servicio || 'remis')}</b> mediante un sistema de despacho centralizado con seguimiento satelital de las unidades.</p>
      <p>La facturación del servicio la realiza ${esc((e.quien_factura || 'la empresa').toLowerCase())}. ${e.pagos_electronicos ? 'Se aceptan medios de pago electrónicos.' : ''} ${e.boton_emergencia ? 'El pasajero dispone de un mecanismo de emergencia y de PIN de seguridad al abordar.' : ''}</p>
      <p>Quedamos a disposición para ampliar la información que estime necesaria.</p><p>Saludamos a usted atentamente.</p>${firma}`;
  } else if (tipo === 'carta') {
    titulo = 'Carta del sistema de despacho';
    cuerpo = `${dest}<p>Dejamos constancia de que ${esc(e.razon_social || e.nombre)} utiliza el sistema de despacho <b>${esc(e.nombre || 'Remises TOQUE!')}</b> para la gestión de su flota, que provee:</p>
      <ul><li>Registro de cada viaje con fecha, hora, origen, destino, móvil y conductor asignado.</li><li>Seguimiento en tiempo real de las unidades y recorrido histórico.</li><li>Identificación del conductor y del vehículo para el pasajero, con PIN de seguridad.</li>
      <li>Tarifas configuradas por la empresa (por distancia recorrida y tiempo de espera).</li><li>Conservación de registros para consulta de la autoridad.</li></ul>${firma}`;
  } else {
    titulo = 'Presentación del servicio';
    const t = d.tarifa;
    cuerpo = `<h1>${esc(e.nombre)}</h1><div class="muted">${esc(e.razon_social)} · CUIT ${esc(e.cuit)}</div><h2>Descripción</h2><p>${esc(e.descripcion || '')}</p>
      <h2>Datos operativos</h2><table><tr><th>Tipo de servicio</th><td>${esc(e.tipo_servicio)}</td></tr><tr><th>Móviles habilitados</th><td>${d.moviles_habilitados}</td></tr><tr><th>Domicilio</th><td>${esc(e.direccion)}, ${esc(e.localidad)}, ${esc(e.provincia)}</td></tr>
      <tr><th>Teléfono</th><td>${esc(e.telefono)}</td></tr><tr><th>Canales de pedido</th><td>Teléfono, WhatsApp, pedido web${e.apps_ios ? ', apps Android e iOS' : ', app Android'}</td></tr>
      <tr><th>Tarifa vigente</th><td>${t ? `${esc(t.nombre)}: ${esc(resumenTarifa(t))}` : '—'}</td></tr></table>${firma}`;
  }
  await api('/api/docreg/generado', { body: { tipo: titulo, autoridad: a.organismo || a.nombre || '' } });
  paginaImpresion(titulo, cuerpo + '<p class="muted" style="margin-top:30px;font-size:11px">Plantilla operativa: revisala con un asesor legal y con el ente antes de presentarla.</p>');
}
