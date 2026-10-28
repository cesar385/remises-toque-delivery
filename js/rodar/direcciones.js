// Direcciones y rutas: búsqueda de direcciones (Google opcional, Georef, OpenStreetMap y las aprendidas por el sistema),
// dirección de un punto del mapa y recorrido por calles. Agrega sus funciones a window.RODAR.
(function () {
  const CFG = window.RODAR_CONFIG || {};
  const { rpc } = window.RODAR;
  // ---- Geocodificación (OpenStreetMap Nominatim, desde el navegador) ----
  const cacheGeo = new Map();
  let empresaGeo = null;
  // "San Martín 450, Federal" -> { calle: 'San Martín', altura: 450 }
  function partirDir(q) {
    const base = String(q || '').split(',')[0].trim();
    const m = base.match(/^(.+?)\s+(?:n(?:ro|°|º)?\.?\s*)?(\d{1,5})$/i);
    return m ? { calle: m[1].trim(), altura: +m[2] } : { calle: base, altura: null };
  }
  const sinTildes = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^(calle|avenida|av\.?|bv\.?|boulevard|pje\.?|pasaje)\s+/, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  // Toda Argentina: sin recorte por zona. Si el texto trae localidad ("San Martín 76, Concordia") se usa esa;
  // si no, la localidad de la empresa sólo ordena y prioriza los resultados (no los limita).
  async function nominatim(q) {
    const e = empresaGeo || {};
    const vb = e.lat ? `&viewbox=${e.lng - 1.5},${+e.lat + 1.5},${+e.lng + 1.5},${e.lat - 1.5}&bounded=0` : '';
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&countrycodes=ar${vb}&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'es' } });
    return r.json();
  }
  // Google Maps (opcional: clave en config.js → googleKey). Se usa el Geocoder del navegador, que ubica la puerta exacta con numeración.
  let googlePromesa = null, googleFalla = false;
  function googleListo() {
    if (!CFG.googleKey || googleFalla) return Promise.resolve(null);
    if (googlePromesa) return googlePromesa;
    googlePromesa = new Promise(ok => {
      if (window.google && window.google.maps && window.google.maps.Geocoder) return ok(window.google.maps);
      window.gm_authFailure = () => { googleFalla = true; ok(null); };
      window.__gmListo = async () => { try { if (window.google && google.maps && google.maps.importLibrary && !google.maps.Geocoder) await google.maps.importLibrary('geocoding'); } catch { } ok(window.google && window.google.maps && window.google.maps.Geocoder ? window.google.maps : null); };
      const sc = document.createElement('script');
      sc.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(CFG.googleKey)}&language=es&region=AR&loading=async&callback=__gmListo`;
      sc.async = true; sc.onerror = () => { googleFalla = true; ok(null); };
      document.head.append(sc); setTimeout(() => ok(null), 8000);
    });
    return googlePromesa;
  }
  const compG = (r, t) => { const c = (r.address_components || []).find(x => x.types.includes(t)); return c ? c.long_name : ''; };
  const itemG = r => {
    const calle = compG(r, 'route'), num = compG(r, 'street_number'), tipo = r.geometry.location_type;
    return { nombre: r.formatted_address, direccion: calle ? `${calle}${num ? ' ' + num : ''}` : r.formatted_address.split(',')[0], localidad: compG(r, 'locality') || compG(r, 'administrative_area_level_2') || compG(r, 'sublocality') || '', provincia: compG(r, 'administrative_area_level_1'),
      lat: r.geometry.location.lat(), lng: r.geometry.location.lng(), aprox: !num || !(tipo === 'ROOFTOP' || tipo === 'RANGE_INTERPOLATED'), google: true };
  };
  async function googleBuscar(texto) {
    const gm = await googleListo(); if (!gm) return [];
    const e = empresaGeo || {};
    const req = { address: texto, componentRestrictions: { country: 'AR' } };
    if (e.lat) req.bounds = { south: +e.lat - 1.5, north: +e.lat + 1.5, west: +e.lng - 1.5, east: +e.lng + 1.5 };
    return new Promise(ok => new gm.Geocoder().geocode(req, (res, st) => ok(st === 'OK' && res ? res.filter(r => (r.types || []).some(t => ['street_address', 'premise', 'subpremise', 'route', 'intersection'].includes(t))).map(itemG) : [])));
  }
  async function googleInversa(lat, lng) {
    const gm = await googleListo(); if (!gm) return null;
    return new Promise(ok => new gm.Geocoder().geocode({ location: { lat: +lat, lng: +lng } }, (res, st) => {
      if (st !== 'OK' || !res || !res.length) return ok(null);
      const r = res.find(x => x.types.includes('street_address')) || res.find(x => x.types.includes('route')) || res[0];
      ok(itemG(r));
    }));
  }
  // Georef (datos.gob.ar): geocodificador oficial de direcciones de Argentina, con numeración por calle en todo el país.
  async function georef(calle, altura, lugar) {
    const dir = altura ? `${calle} ${altura}` : calle;
    const l = String(lugar || '').split(',').map(x => x.trim()).filter(Boolean);
    const base = `https://apis.datos.gob.ar/georef/api/direcciones?max=6&direccion=${encodeURIComponent(dir)}`;
    const probar = async extra => { const r = await fetch(base + extra); if (!r.ok) return []; const j = await r.json(); return j.direcciones || []; };
    let res = [];
    if (l[0]) res = await probar(`&localidad_censal=${encodeURIComponent(l[0])}${l[1] ? '&provincia=' + encodeURIComponent(l[1]) : ''}`).catch(() => []);
    if (!res.length && l[0]) res = await probar(`&departamento=${encodeURIComponent(l[0])}${l[1] ? '&provincia=' + encodeURIComponent(l[1]) : ''}`).catch(() => []);
    if (!res.length) res = await probar(l[1] ? `&provincia=${encodeURIComponent(l[1])}` : '').catch(() => []);
    return res.filter(x => x.ubicacion && x.ubicacion.lat != null).map(x => ({ direccion: `${x.calle.nombre} ${x.altura.valor || ''}`.trim(), localidad: (x.localidad_censal && x.localidad_censal.nombre) || (x.departamento && x.departamento.nombre) || '', provincia: x.provincia && x.provincia.nombre, lat: +x.ubicacion.lat, lng: +x.ubicacion.lon, aprox: false, georef: true }));
  }
  // Una sola línea: "calle altura, localidad, provincia". compDir arma el texto; enTexto lo desarma.
  const compDir = (dir, loc, prov) => [dir, loc, prov].map(x => String(x || '').trim()).filter(Boolean).join(', ');
  const enTexto = t => { const p = String(t || '').split(',').map(x => x.trim()); return { dir: p[0] || '', loc: p[1] || '', prov: p[2] || '' }; };
  // Busca direcciones. OpenStreetMap casi no tiene la numeración de Federal: se conserva la altura escrita,
  // y si el sistema ya aprendió esa dirección (GPS de los choferes) la ubica con precisión.
  async function geoBuscar(q) {
    q = String(q || '').trim(); if (!q) return [];
    const e = empresaGeo || {};
    const k = 'g:' + q.toLowerCase() + '|' + (e.localidad || ''); if (cacheGeo.has(k)) return cacheGeo.get(k);
    const { calle, altura } = partirDir(q);
    const lugar = q.includes(',') ? q.split(',').slice(1).join(',').trim() : '';
    const [conocida, gr, osm1, goo] = await Promise.all([
      altura && !lugar ? rpc('r_dir_buscar', null, { q }, {}).catch(() => null) : null,
      calle ? georef(calle, altura, lugar || e.localidad).catch(() => []) : [],
      nominatim(lugar ? q : q + (e.localidad ? ', ' + e.localidad : '')).catch(() => []),
      googleBuscar(lugar ? q : q + (e.localidad ? ', ' + e.localidad : '')).catch(() => []),
    ]);
    let osm = osm1;
    if (!osm.length) osm = await nominatim(q).catch(() => []);
    if (!osm.length && altura && calle) osm = await nominatim(calle + (lugar ? ', ' + lugar : '')).catch(() => []);
    const deOsm = osm.map(x => {
      const a = x.address || {}, conNumero = !!a.house_number;
      const dir = conNumero ? `${a.road} ${a.house_number}` : (a.road ? (altura ? `${a.road} ${altura}` : a.road) : x.display_name.split(',')[0]);
      return { nombre: x.display_name, direccion: dir, localidad: a.city || a.town || a.village || a.municipality || a.county || '', provincia: a.state || '', lat: +x.lat, lng: +x.lon, aprox: !conNumero && !!altura };
    });
    const out = [...goo, ...gr, ...deOsm];
    if (conocida) out.unshift({ direccion: `${conocida.calle} ${conocida.altura}`, localidad: conocida.localidad || e.localidad, provincia: e.provincia, lat: conocida.lat, lng: conocida.lng, conocida: conocida.precision, aprox: conocida.precision !== 'exacta' });
    const vistos = new Set(); const fin = out.filter(x => { const kk = sinTildes(x.direccion) + '|' + sinTildes(x.localidad); if (vistos.has(kk)) return false; vistos.add(kk); return true; });
    cacheGeo.set(k, fin); return fin;
  }
  // Ruta por calles (OSRM público): devuelve { coords:[[lat,lng]…], metros, minutos } o null si no hay servicio.
  const cacheRuta = new Map();
  async function ruta(o, d) {
    if (!o || !d) return null;
    const k = [o.lat, o.lng, d.lat, d.lng].map(x => (+x).toFixed(5)).join(','); if (cacheRuta.has(k)) return cacheRuta.get(k);
    let out = null;
    // 1) OpenRouteService (si hay clave en config.js → orsKey; o servidor propio en orsUrl)
    if (CFG.orsKey || CFG.orsUrl) {
      try {
        const base = (CFG.orsUrl || 'https://api.openrouteservice.org').replace(/\/$/, '');
        const r = await fetch(base + '/v2/directions/driving-car/geojson', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(CFG.orsKey ? { Authorization: CFG.orsKey } : {}) }, body: JSON.stringify({ coordinates: [[+o.lng, +o.lat], [+d.lng, +d.lat]] }) });
        const j = await r.json(), f = j.features && j.features[0];
        if (f) out = { coords: f.geometry.coordinates.map(c => [c[1], c[0]]), metros: f.properties.summary.distance, minutos: f.properties.summary.duration / 60 };
      } catch { }
    }
    // 2) Respaldo: OSRM público
    if (!out) try {
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`);
      const j = await r.json(), x = j.routes && j.routes[0];
      if (x) out = { coords: x.geometry.coordinates.map(c => [c[1], c[0]]), metros: x.distance, minutos: x.duration / 60 };
    } catch { }
    if (out) cacheRuta.set(k, out); return out;
  }
  // Al tocar el mapa o usar el GPS: OpenStreetMap suele devolver sólo la calle. Si el sistema conoce una dirección
  // con altura a menos de 70 m sobre la misma calle, la propone; si no, avisa que falta la altura.
  async function geoInversa(lat, lng) {
    const k = `r:${(+lat).toFixed(5)},${(+lng).toFixed(5)}`; if (cacheGeo.has(k)) return cacheGeo.get(k);
    let out;
    const gi = await googleInversa(lat, lng).catch(() => null);
    if (gi && gi.direccion) { out = { direccion: gi.direccion, localidad: gi.localidad, provincia: gi.provincia }; if (gi.aprox) { out.sinAltura = !/\d/.test(gi.direccion); out.aprox = !out.sinAltura; } cacheGeo.set(k, out); return out; }
    try {
      const [r, cerca] = await Promise.all([
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': 'es' } }).then(x => x.json()),
        rpc('r_dir_cercana', null, { lat, lng }, {}).catch(() => null),
      ]);
      const a = r.address || {};
      out = { direccion: [a.road, a.house_number].filter(Boolean).join(' ') || 'Punto en el mapa', localidad: a.city || a.town || a.village || '', provincia: a.state || '' };
      if (!a.house_number) {
        if (cerca && (!a.road || sinTildes(cerca.calle) === sinTildes(a.road))) { out.direccion = `${cerca.calle} ${cerca.altura}`; out.aprox = true; }
        else if (a.road) out.sinAltura = true;
      }
    } catch { out = { direccion: `Punto ${(+lat).toFixed(5)}, ${(+lng).toFixed(5)}`, localidad: '', provincia: '', sinAltura: true }; }
    cacheGeo.set(k, out); return out;
  }

  // La localidad de la empresa ordena los resultados (se actualiza al leer la configuración)
  const setEmpresa = e => { empresaGeo = e; };
  Object.assign(window.RODAR, { geoBuscar, geoInversa, ruta, compDir, enTexto, partirDir, setEmpresa });
})();
