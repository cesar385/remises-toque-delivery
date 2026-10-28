// Tarifa: cálculo del precio del viaje (mismo criterio que rodar.calcular_monto en la base), resumen de la tarifa
// y formatos de distancia y pesos que usan el panel y las apps.

function precioTablaKm(tb, metros) {
  const km = (tb && tb.km) || []; if (!km.length) return 0;
  const u = Math.floor(Math.max(0, metros || 0) / 100); const ord = [...km].sort((a, b) => a[0] - b[0]); const ult = ord[ord.length - 1]; const lu = Math.round(ult[0] * 10);
  const cada = Math.max(1, Math.floor(((tb.extra && tb.extra.cada_m) || 400) / 100)); const monto = (tb.extra && +tb.extra.monto) || 0;
  if (u > lu) return ult[1] + Math.ceil((u - lu) / cada) * monto;
  let p = null; ord.forEach(r => { if (Math.round(r[0] * 10) <= u) p = r[1]; });
  return p == null ? ord[0][1] : p;
}
function precioTablaEspera(tb, seg) {
  const es = (tb && tb.espera) || []; if (!es.length) return 0;
  const mi = Math.floor(Math.max(0, seg || 0) / 60); const ord = [...es].sort((a, b) => a[0] - b[0]); const ult = ord[ord.length - 1];
  const cada = Math.max(1, (tb.espera_extra && +tb.espera_extra.cada_min) || 5); const monto = (tb.espera_extra && +tb.espera_extra.monto) || 0;
  if (mi > ult[0]) return ult[1] + Math.floor((mi - ult[0]) / cada) * monto;
  let p = 0; ord.forEach(r => { if (r[0] <= mi) p = r[1]; }); return p;
}
function montoTarifa(t, metros, esperaSeg, indice) {
  if (!t) return 0; const ind = indice || 1;
  if (t.tabla && t.tabla.km && t.tabla.km.length) {
    const mt = Math.max(0, (metros || 0) - (t.cortesia_mts || 0));
    const esp = t.con_espera ? precioTablaEspera(t.tabla, Math.max(0, (esperaSeg || 0) - (t.cortesia_min || 0) * 60)) : 0;
    // Viajes afuera: desde "desde_km" se cobra cada km a "precio_km" (independiente de la tabla)
    const af = t.tabla.afuera || {}, desde = parseFloat(af.desde_km), pk = parseFloat(af.precio_km);
    if (desde >= 0 && pk > 0 && mt >= desde * 1000) return Math.round((Math.ceil(mt / 1000) * pk + esp) * ind); // km entero hacia arriba
    return Math.round((precioTablaKm(t.tabla, mt) + esp) * ind);
  }
  const red = t.redondeo_mts || 100; let m = Math.max(0, (metros || 0) - (t.cortesia_mts || 0)); m = Math.ceil(m / red) * red;
  const fd = Math.floor(m / (t.ficha_mts || 100)); const fe = t.con_espera ? Math.floor(Math.max(0, (esperaSeg || 0) - (t.cortesia_min || 0) * 60) / (t.espera_seg || 60)) : 0;
  return Math.round(((+t.bajada || 0) + (fd + fe) * (+t.precio_ficha || 0)) * ind);
}
function resumenTarifa(t) {
  if (!t) return '—';
  if (t.tabla && t.tabla.km && t.tabla.km.length) { const k = t.tabla.km, af = t.tabla.afuera; return `Por tabla: ${k[0][0]} km ${pesos0(k[0][1])} … ${k[k.length - 1][0]} km ${pesos0(k[k.length - 1][1])} · espera por tramos de minutos${af && +af.precio_km > 0 ? ` · Viajes afuera: desde ${String(af.desde_km).replace('.', ',')} km, ${pesos0(af.precio_km)} por km entero` : ''}${t.tabla.correccion_pct ? ` · GPS +${String(t.tabla.correccion_pct).replace('.', ',')}%` : ''}`; }
  return `Bajada ${pesos0(t.bajada)} · ficha ${pesos0(t.precio_ficha)} cada ${t.ficha_mts} m`;
}
// Distancias: se muestran redondeadas a un decimal (1.47 km -> 1.5 km).
function km1(x) { if (x == null || x === '' || isNaN(+x)) return '—'; return (Math.round(+x * 10) / 10).toFixed(1); }
function pesos0(n) { return n == null || n === '' ? '—' : '$ ' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 }); }

// Corrección del GPS (porcentaje de la tarifa): el GPS del celular mide algo menos que el odómetro del auto
function correccionGps(t) { const c = parseFloat(t && t.tabla && t.tabla.correccion_pct); return isFinite(c) ? Math.max(-20, Math.min(30, c)) : 0; }
function metrosCorregidos(t, metros) { return (metros || 0) * (1 + correccionGps(t) / 100); }
