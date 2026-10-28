// Visor de PDF dentro de la misma pestaña (sin ventanas nuevas), con Descargar / Imprimir o Compartir / Cerrar.
// Lo usan el panel y la app de empresas para los resúmenes membretados.
const PDFV_CSS = `.pdfv{position:fixed;inset:0;z-index:8000;background:rgba(15,25,40,.72);display:flex;flex-direction:column;animation:pdfvIn .15s ease-out;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
@keyframes pdfvIn{from{opacity:0}to{opacity:1}}
.pdfv-b{display:flex;align-items:center;gap:8px;padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top));background:#0f2740;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.3)}
.pdfv-b b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdfv-k{border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:#fff;border-radius:9px;padding:8px 13px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap}
.pdfv-k.x{background:#fff;color:#0f2740;border-color:#fff}.pdfv-k.g{background:#4a8125;border-color:#4a8125;font-size:16px;padding:12px 20px}
.pdfv iframe{flex:1;border:0;width:min(1000px,100%);margin:14px auto;background:#fff;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.4)}
.pdfv-m{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:12px;font-size:16px;text-align:center;padding:20px}
@media (max-width:600px){.pdfv-b{flex-wrap:wrap}.pdfv-b b{flex-basis:100%}.pdfv iframe{margin:0;border-radius:0}}`;
function verPdf(pdf, nombre, titulo) {
  if (!document.getElementById('pdfv-css')) { const s = document.createElement('style'); s.id = 'pdfv-css'; s.textContent = PDFV_CSS; document.head.append(s); }
  const blob = pdf.output('blob'), url = URL.createObjectURL(blob), tit = cpEsc(titulo || nombre);
  const vis = navigator.pdfViewerEnabled !== false && !/Android|iPhone|iPad/i.test(navigator.userAgent) && !cpNativo();
  const el = document.createElement('div'); el.className = 'pdfv';
  el.innerHTML = `<div class="pdfv-b"><b>📄 ${tit}</b><span style="flex:1"></span>
    <button class="pdfv-k" data-a="d">⬇ Descargar</button>${vis ? '<button class="pdfv-k" data-a="p">🖨 Imprimir</button>' : '<button class="pdfv-k" data-a="s">📤 Compartir</button>'}<button class="pdfv-k x" data-a="x">✕ Cerrar</button></div>
    ${vis ? `<iframe src="${url}#view=FitH" title="${tit}"></iframe>` : `<div class="pdfv-m"><div style="font-size:46px">📄</div><p style="margin:0"><b>${tit}</b><br>El PDF está listo.</p><button class="pdfv-k g" data-a="d">⬇ Descargar PDF</button></div>`}`;
  const cerrar = () => { el.remove(); document.removeEventListener('keydown', tecla, true); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const tecla = e => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(); } };
  document.addEventListener('keydown', tecla, true);
  el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'x') return cerrar();
    if (a === 's' || (a === 'd' && cpNativo())) { try { if (await compartirArchivoPdf(pdf, nombre, titulo || nombre, 'Compartir PDF')) return; } catch { } }
    if (a === 'd' || a === 's') { const l = document.createElement('a'); l.href = url; l.download = nombre; document.body.append(l); l.click(); l.remove(); return; }
    const fr = el.querySelector('iframe'); try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { pdf.autoPrint(); fr.src = URL.createObjectURL(pdf.output('blob')); }
  });
  document.body.append(el);
}
