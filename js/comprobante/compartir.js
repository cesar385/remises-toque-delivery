// Compartir el comprobante: como PDF (igual a la tarjeta de la pantalla) o como texto.
// En la app (Capacitor) usa el menú de Android; en el celular, el menú del sistema; en la computadora descarga el PDF.

function cpNativo() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
const cpCancelado = e => /cancel/i.test(String(e && (e.message || e)));

// Compartir: en la app usa el menú de Android (plugin Share); en el navegador, el del sistema; si no hay, un menú propio
async function compartirTexto(titulo, texto) {
  const SH = cpNativo() && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
  if (SH) { try { await SH.share({ title: titulo, text: texto, dialogTitle: 'Compartir comprobante' }); return; } catch (e) { if (cpCancelado(e)) return; } }
  if (navigator.share && !cpNativo()) { try { await navigator.share({ title: titulo, text: texto }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  cpEstilos(); document.querySelectorAll('.cp-sh').forEach(x => x.remove());
  const t = encodeURIComponent(texto), sh = document.createElement('div'); sh.className = 'cp-sh';
  sh.innerHTML = `<div><h4>Compartir comprobante</h4><div class="cp-sh-g">
    <a href="https://wa.me/?text=${t}" target="_blank" rel="noopener"><i style="background:#25d366">💬</i>WhatsApp</a>
    <a href="https://t.me/share/url?url=${encodeURIComponent('https://remisestoque.com')}&text=${t}" target="_blank" rel="noopener"><i style="background:#2aa3e0">✈️</i>Telegram</a>
    <a href="mailto:?subject=${encodeURIComponent(titulo)}&body=${t}"><i style="background:#ea7a2f">✉️</i>Correo</a>
    <button type="button" data-cp="copiar"><i style="background:#5b6b7b">📋</i>Copiar</button></div>
    <button class="cp-sh-x" type="button">Cancelar</button></div>`;
  document.body.append(sh);
  const fuera = () => sh.remove();
  sh.onclick = e => { if (e.target === sh) fuera(); };
  sh.querySelector('.cp-sh-x').onclick = fuera;
  sh.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setTimeout(fuera, 300)));
  sh.querySelector('[data-cp=copiar]').onclick = async () => {
    try { await navigator.clipboard.writeText(texto); } catch { const ta = document.createElement('textarea'); ta.value = texto; document.body.append(ta); ta.select(); try { document.execCommand('copy'); } catch { } ta.remove(); }
    fuera(); if (typeof toast === 'function') toast('Comprobante copiado', 'ok');
  };
}
// PDF del comprobante con el mismo formato que se ve en pantalla (html2canvas + jsPDF, cargados recién al usarlos)

// Comparte un PDF ya generado. Devuelve true si se abrió el menú de compartir, false si este equipo no puede compartir archivos.
async function compartirArchivoPdf(pdf, nombre, titulo, dialogo) {
  const P = cpNativo() && window.Capacitor.Plugins || {};
  if (cpNativo() && P.Filesystem && P.Share) {
    const w = await P.Filesystem.writeFile({ path: nombre, data: pdf.output('datauristring').split(',')[1], directory: 'CACHE' });
    try { await P.Share.share({ title: titulo, files: [w.uri], dialogTitle: dialogo }); } catch (e) { if (!cpCancelado(e)) throw e; }
    return true;
  }
  const f = new File([pdf.output('blob')], nombre, { type: 'application/pdf' });
  if (!(navigator.canShare && navigator.canShare({ files: [f] }))) return false;
  try { await navigator.share({ files: [f], title: titulo }); } catch (e) { if (e && e.name !== 'AbortError') throw e; }
  return true;
}
const descargarPdf = (pdf, nombre) => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(pdf.output('blob')); a.download = nombre; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
};

// <details>/<summary> se pasan a bloques comunes: html2canvas (sobre todo en Android) no los alinea bien
const cpSinDesplegables = raiz => raiz.querySelectorAll('details').forEach(d => {
  const nd = document.createElement('div'); nd.className = d.className;
  const sm = d.querySelector('summary'); if (sm) nd.append(...sm.childNodes);
  if (d.open) [...d.children].filter(x => x.tagName !== 'SUMMARY').forEach(x => nd.append(x));
  d.replaceWith(nd);
});
// PDF del comprobante con el mismo formato que se ve en pantalla (html2canvas + jsPDF, cargados recién al usarlos)
async function comprobantePdf(el) {
  await cpCargarLibs();
  const caja = document.createElement('div');
  caja.style.cssText = 'position:fixed;left:-10000px;top:0;width:420px;padding:14px;background:#eef2f6';
  const cl = el.cloneNode(true); cl.classList.add('cp-pdf'); cl.style.margin = '0'; cl.style.boxShadow = 'none'; caja.append(cl); document.body.append(caja);
  cpSinDesplegables(cl);
  await Promise.all([...caja.querySelectorAll('img')].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
  try {
    const cv = await window.html2canvas(caja, { scale: 2, backgroundColor: '#eef2f6', useCORS: true, logging: false });
    const ancho = 100, alto = ancho * cv.height / cv.width; // mm: tira tipo ticket
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: [ancho, alto], orientation: 'portrait', compress: true });
    pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, ancho, alto);
    return pdf;
  } finally { caja.remove(); }
}
async function compartirPdf(el, nombre, titulo, texto) {
  const pdf = await comprobantePdf(el);
  const P = cpNativo() && window.Capacitor.Plugins || {};
  if (cpNativo() && (!P.Filesystem || !P.Share)) throw new Error('sin-plugins'); // app vieja: se comparte desde Chrome
  if (await compartirArchivoPdf(pdf, nombre, titulo, 'Compartir comprobante (PDF)')) return;
  // computadora / navegador sin compartir archivos: se descarga el PDF
  descargarPdf(pdf, nombre);
  if (typeof toast === 'function') toast('PDF descargado: ' + nombre, 'ok');
}
