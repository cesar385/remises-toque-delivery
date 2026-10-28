// PDF sobre la hoja membretada (A4) — resúmenes e informes del panel y de la app de empresas.
// La hoja (img/membrete-a4.jpg) tiene el logo arriba y las franjas abajo: el contenido va entre 44 mm y 258 mm.
// o: { titulo, derecha:[etiqueta, valor], sub, cajas:[[l, v, color]], cols, filas, vacio, pie, nota } o, para varias tablas,
//    tablas: [{ titulo, cols, filas, vacio, pie }]. Cada fila: { v:[...], col:[...], total }. Columnas: { t, w, r }.

let membreteImg = null;
function cargarMembrete() {
  if (membreteImg) return membreteImg;
  membreteImg = new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => { membreteImg = null; mal(new Error('No se pudo cargar la hoja membretada')); }; i.src = CP_BASE + 'img/membrete-a4.jpg?v=1'; });
  return membreteImg;
}

const MEMB = { AZ: [33, 81, 129], VE: [111, 176, 52], RO: [190, 40, 40], GR: [96, 110, 124], TX: [24, 38, 52], X0: 18, X1: 192, TOP: 44, BOT: 256 };
const membColor = c => c === 'rojo' ? MEMB.RO : c === 'verde' ? MEMB.VE : c === 'azul' ? MEMB.AZ : MEMB.TX;

// Hoja en uso: el PDF, la posición vertical (y) y el salto a una hoja nueva
const membHoja = (pdf, img) => {
  const h = { pdf, y: MEMB.TOP };
  h.fondo = () => pdf.addImage(img, 'JPEG', 0, 0, 210, 297, 'membrete', 'FAST');
  h.nueva = () => { pdf.addPage(); h.fondo(); h.y = MEMB.TOP; };
  h.lugar = alto => { if (h.y + alto > MEMB.BOT) h.nueva(); };
  h.fondo();
  return h;
};

// Título, recuadro con el número a la derecha y subtítulo
const membEncabezado = (h, o) => {
  const { pdf } = h, { AZ, VE, GR, X0, X1 } = MEMB;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17); pdf.setTextColor(...AZ); pdf.text(o.titulo, X0, h.y + 6);
  if (o.derecha) {
    pdf.setFillColor(...AZ); pdf.roundedRect(X1 - 34, h.y - 1, 34, 15, 2.5, 2.5, 'F'); pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(7.5); pdf.text(o.derecha[0], X1 - 17, h.y + 4, { align: 'center' }); pdf.setFontSize(14); pdf.text(o.derecha[1], X1 - 17, h.y + 11.3, { align: 'center' });
  }
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...GR);
  const sub = pdf.splitTextToSize(o.sub || '', X1 - X0 - 40); pdf.text(sub, X0, h.y + 12); h.y += 12 + sub.length * 4 + 3;
  pdf.setDrawColor(...VE); pdf.setLineWidth(.8); pdf.line(X0, h.y, X0 + 26, h.y); h.y += 5;
};

// Cajas de resumen en una fila: [etiqueta, valor, color]
const membCajas = (h, cajas) => {
  if (!cajas || !cajas.length) return;
  const { pdf } = h, { AZ, GR, X0, X1 } = MEMB, y = h.y;
  const n = cajas.length, gap = 3, w = (X1 - X0 - gap * (n - 1)) / n;
  cajas.forEach(([l, v, c], i) => {
    const x = X0 + i * (w + gap);
    pdf.setFillColor(244, 247, 250); pdf.setDrawColor(222, 229, 236); pdf.setLineWidth(.25); pdf.roundedRect(x, y, w, 17, 2, 2, 'FD');
    pdf.setFillColor(...(c ? membColor(c) : AZ)); pdf.rect(x, y + 2, .9, 13, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.8); pdf.setTextColor(...GR); pdf.text(pdf.splitTextToSize(l, w - 5)[0], x + 3.5, y + 5.5);
    pdf.setFontSize(10.5); pdf.setTextColor(...membColor(c)); let ln = pdf.splitTextToSize(String(v), w - 6);
    if (ln.length > 1) { pdf.setFontSize(8); ln = pdf.splitTextToSize(String(v), w - 6).slice(0, 2); pdf.text(ln, x + 3.5, y + (ln.length > 1 ? 10.3 : 12.5)); } else pdf.text(ln[0], x + 3.5, y + 12.5);
  });
  h.y += 23;
};

// Encabezado azul de las columnas
const membCabeceraTabla = (h, cols) => {
  const { pdf } = h, { AZ, X0, X1 } = MEMB;
  pdf.setFillColor(...AZ); pdf.rect(X0, h.y, X1 - X0, 7, 'F'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(255, 255, 255);
  let x = X0; cols.forEach(c => { pdf.text(c.t.toUpperCase(), c.r ? x + c.w - 2 : x + 2, h.y + 4.7, c.r ? { align: 'right' } : undefined); x += c.w; }); h.y += 7;
};

// Una fila de la tabla (si no entra, pasa a una hoja nueva y repite el encabezado)
const membFila = (h, cols, f, i) => {
  const { pdf } = h, { AZ, TX, X0, X1 } = MEMB;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.3);
  const lineas = f.v.map((v, k) => cols[k].r ? [String(v ?? '')] : pdf.splitTextToSize(String(v ?? ''), cols[k].w - 4).slice(0, 3));
  const alto = Math.max(...lineas.map(l => l.length)) * 3.6 + 2.6;
  if (h.y + alto > MEMB.BOT) { h.nueva(); membCabeceraTabla(h, cols); pdf.setFontSize(8.3); }
  if (f.total) { pdf.setFillColor(232, 239, 246); pdf.rect(X0, h.y, X1 - X0, alto, 'F'); } else if (i % 2) { pdf.setFillColor(246, 248, 251); pdf.rect(X0, h.y, X1 - X0, alto, 'F'); }
  let x = X0;
  lineas.forEach((l, k) => {
    const c = cols[k]; pdf.setFont('helvetica', c.r || f.total ? 'bold' : 'normal'); pdf.setTextColor(...(f.col && f.col[k] ? membColor(f.col[k]) : f.total ? AZ : TX));
    pdf.text(l, c.r ? x + c.w - 2 : x + 2, h.y + 4.3, c.r ? { align: 'right' } : undefined); x += c.w;
  });
  pdf.setDrawColor(228, 233, 239); pdf.setLineWidth(.2); pdf.line(X0, h.y + alto, X1, h.y + alto); h.y += alto;
};

// Una tabla completa: título opcional, encabezado, filas (o el texto de vacío) y pie
const membTabla = (h, t, ti) => {
  const { pdf } = h, { AZ, GR, X0, X1 } = MEMB;
  const cols = t.cols.map(c => ({ ...c })), tw = cols.reduce((a, c) => a + c.w, 0), k_ = (X1 - X0) / tw; cols.forEach(c => c.w *= k_);
  if (t.titulo) {
    if (h.y + 20 > MEMB.BOT) h.nueva(); else if (ti) h.y += 4;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5); pdf.setTextColor(...AZ); pdf.text(t.titulo, X0, h.y + 4); h.y += 7;
  }
  h.lugar(16);
  membCabeceraTabla(h, cols);
  pdf.setFontSize(8.3);
  if (!t.filas.length) { pdf.setFont('helvetica', 'italic'); pdf.setTextColor(...GR); pdf.text(t.vacio || 'Sin datos.', X0 + 2, h.y + 6); h.y += 10; }
  t.filas.forEach((f, i) => membFila(h, cols, f, i));
  if (t.pie) { h.lugar(9); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...AZ); pdf.text(t.pie, X1, h.y + 6, { align: 'right' }); h.y += 8; }
};

// Nota final y "Página N de M" en cada hoja
const membCierre = (h, o) => {
  const { pdf } = h, { GR, X0, X1 } = MEMB;
  if (o.nota) { h.lugar(10); pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.setTextColor(...GR); pdf.text(pdf.splitTextToSize(o.nota, X1 - X0), X0, h.y + 7); }
  const np = pdf.getNumberOfPages();
  for (let p = 1; p <= np; p++) { pdf.setPage(p); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(...GR); pdf.text(`Página ${p} de ${np}`, X1, 263, { align: 'right' }); }
  pdf.setProperties({ title: o.titulo + (o.derecha ? ' ' + o.derecha.join(' ') : ''), author: 'Remises TOQUE!' });
};

async function pdfMembretado(o) {
  const [img] = await Promise.all([cargarMembrete(), cpCargarLibs()]);
  const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const h = membHoja(pdf, img);
  membEncabezado(h, o);
  membCajas(h, o.cajas);
  (o.tablas || [{ cols: o.cols, filas: o.filas, vacio: o.vacio, pie: o.pie }]).forEach((t, ti) => membTabla(h, t, ti));
  membCierre(h, o);
  return pdf;
}
