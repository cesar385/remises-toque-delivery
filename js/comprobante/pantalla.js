// Pantalla del comprobante de viaje (app del pasajero, del conductor y de empresas) y diálogo simple con el mismo diseño.

// Diálogo simple (mismo estilo que el comprobante). Devuelve true si toca el botón principal.
function cpDialogo(o) {
  cpEstilos();
  return new Promise(res => {
    const d = document.createElement('div'); d.className = 'cp-dlg';
    d.innerHTML = `<div class="cp-dlg-c" role="dialog" aria-modal="true"><div class="cp-dlg-h">${o.icono ? `<div class="e">${o.icono}</div>` : ''}<h3>${cpEsc(o.titulo || '')}</h3></div>
      <div class="cp-dlg-b">${o.html || ''}</div><div class="cp-dlg-f"><button class="si ${o.peligro ? 'rojo' : ''}">${cpEsc(o.si || 'Aceptar')}</button>${o.no === false ? '' : `<button class="no">${cpEsc(o.no || 'Volver')}</button>`}</div></div>`;
    const fin = r => { d.remove(); res(r); };
    d.querySelector('.si').onclick = () => fin(true); const n = d.querySelector('.no'); if (n) n.onclick = () => fin(false);
    d.onclick = e => { if (e.target === d) fin(false); };
    document.body.append(d);
  });
}

function cerrarComprobante() { const sh = document.querySelector('.cp-sh'); if (sh) { sh.remove(); return true; } const ov = document.querySelector('.cp-ov'); if (ov) { ov._cerrar ? ov._cerrar() : ov.remove(); return true; } return false; }

// En la app, el ticket se abre en Chrome (ticket.html), donde se puede imprimir o compartir como PDF.
const cpTicketEnChrome = (datos, compartir) => {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(datos)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  location.href = 'https://remisestoque.netlify.app/ticket.html' + (compartir ? '?compartir=1' : '') + '#' + b64;
};

// Imprimir: en la computadora con un marco oculto (o una ventana nueva si el navegador no deja)
const cpImprimir = (datos, opc) => {
  document.querySelectorAll('iframe.cp-print').forEach(x => x.remove());
  const fr = document.createElement('iframe'); fr.className = 'cp-print'; fr.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.append(fr); fr.srcdoc = ticketHtml(datos, opc);
  fr.onload = () => setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { const w = window.open('', '_blank'); if (w) abrirTicket(w, datos, { ...opc, auto: true }); } }, 300);
};

const cpNombrePdf = (v, o) => (o.numero ? `ticket-viaje-${v.id}` : `comprobante-viaje-${(v.fin_at || v.creado || '').slice(0, 10) || 'remis'}`) + '.pdf';

// v: datos del viaje. o: { numero (mostrar N° de viaje), cliente, empresa, pagoMp (promesa → true si se pagó con MP), alVolver }
function abrirComprobante(v, o = {}) {
  cpEstilos();
  const e = o.empresa || v.empresa || {};
  document.querySelectorAll('.cp-ov').forEach(x => x.remove());
  const ov = document.createElement('div'); ov.className = 'cp-ov';
  ov.innerHTML = `<div class="cp-bar"><button class="cp-vol" aria-label="Volver">‹</button><b>${o.numero ? 'Ticket de viaje' : 'Comprobante'}</b><span></span></div>
    <div class="cp-scroll">${cpCardHtml(v, o)}</div>
    <div class="cp-acc"><button class="btn sec" id="cpComp">📤 Compartir</button><button class="btn" id="cpImp">🖨 Imprimir / PDF</button></div>`;
  document.body.append(ov);
  let externo = false;
  const alVolverApp = () => { if (!document.hidden && externo) externo = false; };
  const irAChrome = compartir => { externo = true; document.addEventListener('visibilitychange', alVolverApp); cpTicketEnChrome(datos, compartir); };
  ov._cerrar = () => { document.removeEventListener('visibilitychange', alVolverApp); ov.remove(); if (o.alVolver) o.alVolver(); };
  ov.querySelector('.cp-vol').onclick = ov._cerrar;
  if (o.pagoMp) Promise.resolve(o.pagoMp).then(ok => { const t = ov.querySelector('.cp-pago'); if (t && ok) { t.textContent = '✔ Pagado con Mercado Pago'; t.classList.add('ok'); } });
  const datos = { ...v, movil_patente: v.movil_patente || v.patente, _sinNumero: !o.numero, _cliente: o.cliente || '' }, opc = { empresa: e, cliente: o.cliente, sinNumero: !o.numero };
  ov.querySelector('#cpImp').onclick = () => cpNativo() ? irAChrome(false) : cpImprimir(datos, opc);
  ov.querySelector('#cpComp').onclick = () => {
    const b = ov.querySelector('#cpComp'), t0 = b.textContent;
    b.disabled = true; b.textContent = '⏳ Generando PDF…';
    compartirPdf(ov.querySelector('.cp'), cpNombrePdf(v, o), 'Comprobante de viaje', cpTextoCompartir(v, o))
      .catch(er => {
        if (cpNativo()) return irAChrome(true); // app sin el complemento para compartir archivos: el PDF se comparte desde Chrome
        if (typeof toast === 'function') toast('No se pudo generar el PDF: ' + (er && er.message || er), 'error');
      })
      .finally(() => { b.disabled = false; b.textContent = t0; });
  };
  return ov;
}
