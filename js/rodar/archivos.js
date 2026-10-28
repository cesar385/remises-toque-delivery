// Archivos: exportar una tabla a CSV (Excel) y leer imágenes/documentos para guardarlos en la base.
// Agrega RODAR.csv y RODAR.archivoADataURL.
(function () {
  const celdaCsv = v => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : /[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const csv = (filas, nombre) => {
    const cols = Object.keys(filas[0] || {});
    const txt = '﻿' + cols.join(';') + '\n' + filas.map(f => cols.map(c => celdaCsv(f[c])).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = (nombre || 'informe') + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  // Se guardan como data URL dentro de la base (límite 1,5 MB)
  const archivoADataURL = file => new Promise((res, rej) => {
    if (file.size > 1.5e6) return rej(new Error('El archivo supera 1,5 MB. Subí una imagen más liviana.'));
    const fr = new FileReader(); fr.onload = () => res({ archivo: fr.result, nombre: file.name }); fr.onerror = rej; fr.readAsDataURL(file);
  });

  Object.assign(window.RODAR, { csv, archivoADataURL });
})();
