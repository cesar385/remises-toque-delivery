// Tarjeta del comprobante / ticket de viaje: la MISMA en pantalla, al compartir (PDF) y al imprimir.
// Usada por la app del pasajero, la del conductor, la de empresas, el panel y ticket.html.

function cpEsc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function cpPesos(n) { return n == null || n === '' ? '—' : '$ ' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 }); }

// Datos del móvil y del conductor para el ticket / comprobante (lo que haya cargado)
function datosMovil(v, conDni) {
  const marcaMod = [v.movil_marca, v.movil_modelo].filter(Boolean).join(' ') || v.movil || '';
  return {
    numero: v.movil_numero || '', conductor: v.conductor || '', dni: conDni ? v.conductor_documento || '' : '',
    vehiculo: [marcaMod, v.movil_anio].filter(Boolean).join(' · '), color: v.movil_color || '',
    patente: String(v.movil_patente || v.patente || '').toUpperCase(), licencia: conDni ? v.movil_licencia || '' : '',   // licencia y DNI: solo conductor y panel
  };
}

const CP_ICONO_MEDIO = { efectivo: '💵', mercadopago: '💳', transferencia: '🏦', cuenta_corriente: '🏢', tarjeta: '💳', vale: '🎟' };
// "2026-10-24 16:31:05" -> "24/10/2026 · 16:31 hs"
const cpFechaHora = t => { const m = String(t || '').match(/(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/); return m ? `${m[3]}/${m[2]}/${m[1]} · ${m[4]}:${m[5]} hs` : ''; };
const cpHora = t => { const m = String(t || '').match(/(\d\d):(\d\d)/); return m ? m[0] : ''; };
const cpDato = (ico, l, val) => val ? `<div class="cp-d"><span>${ico}</span><div><small>${l}</small><b>${cpEsc(val)}</b></div></div>` : '';

// Lo que muestran la tarjeta y el texto para compartir. o.numero: es el ticket del conductor/panel (con N°, DNI y licencia)
function cpResumen(v, o = {}) {
  const medio = String(v.medio_pago || 'efectivo').replace(/_/g, ' ');
  const dm = datosMovil(v, !!o.numero);
  return {
    empresa: o.empresa || v.empresa || {}, dm,
    total: v.monto != null ? v.monto : v.monto_estimado,
    medioTxt: medio.charAt(0).toUpperCase() + medio.slice(1),
    movil: dm.numero ? ['N° ' + dm.numero, dm.patente, dm.vehiculo].filter(Boolean).join(' · ') : '',
    horas: v.inicio_at || v.fin_at ? [cpHora(v.inicio_at), cpHora(v.fin_at)].filter(Boolean).join(' → ') : '',
    kmTxt: v.km != null && v.km !== '' ? (Math.round(+v.km * 10) / 10).toFixed(1) + ' km' : '',
  };
}

// ---- Secciones de la tarjeta ----
const cpCabecera = (v, o, r) => `<div class="cp-cab"><img src="${o.logo || 'img/logo-blanco.png'}" alt="${cpEsc(r.empresa.nombre || 'Remises TOQUE!')}"><div class="cp-ok">✓</div><h3>¡Viaje finalizado!</h3><small>${cpEsc(cpFechaHora(v.fin_at || v.creado))}</small>${o.numero ? `<div class="cp-num">Viaje N° ${cpEsc(v.id)}</div>` : ''}</div>`;

const cpTotal = (v, r) => `<div class="cp-tot"><small>Total del viaje</small><b>${cpPesos(r.total)}</b><span class="cp-pago">${CP_ICONO_MEDIO[v.medio_pago] || '💵'} ${cpEsc(r.medioTxt)}</span>${+v.cargo_cancelacion > 0 ? `<em class="cp-cargo">Incluye ${cpPesos(v.cargo_cancelacion)} por cancelación tardía de una reserva</em>` : ''}</div>`;

// Desglose: viaje + cancelación tardía + cargos de la plataforma (con la ⓘ que despliega la explicación)
const cpDesglose = v => {
  if (!(+v.cargo_plataforma > 0 && v.monto != null)) return '';
  const linea = (l, m) => `<div class="cp-dl"><span>${l}</span><b>${cpPesos(m)}</b></div>`;
  return `<div class="cp-desg">${linea('Viaje', +v.monto - +v.cargo_plataforma - (+v.cargo_cancelacion || 0))}${+v.cargo_cancelacion > 0 ? linea('Cancelación tardía de reserva', v.cargo_cancelacion) : ''}<details class="cp-info"><summary>${linea('Cargos de la plataforma<i class="cp-i" title="Más información">i</i>', v.cargo_plataforma)}</summary><p>Esto nos ayuda a gestionar nuestra plataforma y ofrecer una mejor experiencia.</p></details></div>`;
};

const cpRuta = v => `<div class="cp-sec"><div class="cp-ruta"><div><i class="o"></i><small>Origen</small><b>${cpEsc(v.origen_dir || '—')}</b></div>${v.destino_dir ? `<div><i class="d"></i><small>Destino</small><b>${cpEsc(v.destino_dir)}</b></div>` : ''}</div></div>`;

const cpMovil = dm => {
  if (!dm.numero && !dm.conductor) return '';
  const fila = (ico, l, val, extra) => `<div class="cp-mov-c"><span>${ico}</span><div><small>${l}</small><b>${cpEsc(val)}</b>${extra}</div></div>`;
  return `<div class="cp-sec cp-mov">${dm.numero ? `<div class="cp-mov-n"><small>Móvil</small><b>${cpEsc(dm.numero)}</b></div>` : ''}
        <div class="cp-mov-d">${dm.conductor ? fila('👤', 'Conductor', dm.conductor, dm.dni ? `<em>DNI ${cpEsc(dm.dni)}</em>` : '') : ''}
          ${dm.vehiculo ? fila('🚗', 'Vehículo', dm.vehiculo, dm.color ? `<em>Color ${cpEsc(dm.color)}</em>` : '') : ''}
          <div class="cp-mov-t">${dm.patente ? `<span class="cp-pat" title="Patente">${cpEsc(dm.patente)}</span>` : ''}${dm.licencia ? `<span class="cp-lic">🪪 Licencia ${cpEsc(dm.licencia)}</span>` : ''}</div></div></div>`;
};

const cpDatosViaje = (v, o, r) => `<div class="cp-sec cp-grid">
        ${cpDato('📏', 'Distancia', r.kmTxt)}${cpDato('⏱', 'Duración', v.minutos ? Math.round(v.minutos) + ' min' : '')}
        ${cpDato('🕒', 'Inicio → fin', r.horas)}${v.espera_min > 0 ? cpDato('⏳', 'Espera', Math.round(v.espera_min) + ' min') : ''}
        ${o.cliente ? cpDato('🙋', 'Pasajero', o.cliente) : ''}
      </div>`;

const cpCalificacion = (v, o) => v.calificacion ? `<div class="cp-sec cp-cal">${o.numero ? 'Calificación del pasajero' : 'Tu calificación'} <b>${'★'.repeat(v.calificacion)}<i>${'★'.repeat(5 - v.calificacion)}</i></b></div>` : '';

// v: datos del viaje. o: { numero (mostrar N° de viaje, DNI y licencia), cliente, empresa, logo (URL absoluta para documentos impresos) }
function cpCardHtml(v, o = {}) {
  const r = cpResumen(v, o);
  return `<div class="cp">
      ${cpCabecera(v, o, r)}
      ${cpTotal(v, r)}
      ${cpDesglose(v)}
      <div class="cp-corte"></div>
      ${cpRuta(v)}
      ${cpMovil(r.dm)}
      ${cpDatosViaje(v, o, r)}
      ${cpCalificacion(v, o)}
      <div class="cp-pie">¡Gracias por viajar con nosotros!<br><small>Comprobante no válido como factura.</small></div>
</div>`;
}

// Texto para compartir por WhatsApp, Telegram, etc.
function cpTextoCompartir(v, o = {}) {
  const r = cpResumen(v, o), dm = r.dm;
  return `🚕 ${r.empresa.nombre || 'Remises TOQUE!'} · Comprobante de viaje${o.numero ? ' N° ' + v.id : ''}\n📅 ${cpFechaHora(v.fin_at || v.creado)}\n🟢 De: ${v.origen_dir || ''}${v.destino_dir ? '\n🔵 A: ' + v.destino_dir : ''}${r.movil ? '\n🚕 Móvil ' + r.movil : ''}${dm.color ? '\n🎨 Color ' + dm.color : ''}${dm.licencia ? '\n🪪 Licencia ' + dm.licencia : ''}${dm.conductor ? '\n👤 Conductor: ' + dm.conductor + (dm.dni ? ' (DNI ' + dm.dni + ')' : '') : ''}${r.kmTxt ? '\n📏 ' + r.kmTxt : ''}\n💰 Total: ${cpPesos(r.total)} (${r.medioTxt})${+v.cargo_plataforma > 0 ? '\n🧾 Incluye ' + cpPesos(v.cargo_plataforma) + ' de cargos de la plataforma' : ''}\n¡Gracias por viajar con nosotros!`;
}

// Ticket imprimible (página completa), el mismo para el panel, la app del conductor y la del pasajero.
// v: datos del viaje. o.empresa: datos de la empresa. o.cliente: nombre del pasajero (opcional). o.auto: abre el diálogo de impresión solo.
const CP_AUTO_IMPRIMIR = `<script>(function(){var ims=[].slice.call(document.images),n=ims.length,ok=false;function p(){if(ok)return;ok=true;setTimeout(function(){try{window.focus();window.print()}catch(e){}},250)}function u(){if(--n<=0)p()}if(!n)p();ims.forEach(function(i){if(i.complete)u();else{i.onload=u;i.onerror=u}});setTimeout(p,2500)})()<\/script>`;
function ticketHtml(v, o = {}) {
  const numero = !(o.sinNumero || v._sinNumero);
  const card = cpCardHtml(v, { numero, cliente: o.cliente || v._cliente, empresa: o.empresa || v.empresa, logo: new URL('img/logo-blanco.png', location.href).href });
  const tit = numero ? 'Ticket de viaje N° ' + cpEsc(v.id) : 'Comprobante de viaje';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${tit}</title>
<style>${CP_CSS}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
html,body{margin:0;background:#eef2f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
.barra{max-width:420px;margin:14px auto 0;text-align:right;padding:0 14px}.barra button{background:#215181;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-size:15px;font-weight:700;cursor:pointer}
.hoja{max-width:420px;margin:12px auto 24px;padding:0 14px}.hoja .cp{margin:0}
@page{size:A4;margin:10mm}
@media print{html,body{background:#fff}.barra{display:none}.hoja{margin:0 auto;max-width:105mm;padding:0}.hoja .cp{box-shadow:none;border:1px solid #e3e9ef;break-inside:avoid}}
</style></head><body>
<div class="barra"><button onclick="print()">Imprimir / Guardar PDF</button></div>
<div class="hoja">${card}</div>
${o.auto ? CP_AUTO_IMPRIMIR : ''}
</body></html>`;
}
function abrirTicket(w, v, o) { w.document.open(); w.document.write(ticketHtml(v, o)); w.document.close(); }
