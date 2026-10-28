// Librerías para armar PDF (html2canvas + jsPDF, en vendor/pdf): se cargan recién la primera vez que se usan.
// CP_BASE es la raíz del sitio, calculada desde la ubicación de este archivo (sirve también en ticket.html y en las apps).
const CP_BASE = (document.currentScript && document.currentScript.src || '').replace(/js\/pdf\/librerias\.js.*$/, '');
let cpLibs = null;
function cpCargarLibs() {
  if (cpLibs) return cpLibs;
  const sc = src => new Promise((ok, mal) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = mal; document.head.append(s); });
  cpLibs = Promise.all([window.html2canvas ? null : sc(CP_BASE + 'vendor/pdf/html2canvas.min.js'), window.jspdf ? null : sc(CP_BASE + 'vendor/pdf/jspdf.umd.min.js')])
    .catch(e => { cpLibs = null; throw e; });
  return cpLibs;
}
