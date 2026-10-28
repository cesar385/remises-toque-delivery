// Mapas de Remises TOQUE! con MapLibre GL (vectorial, fluido y nítido), sin Leaflet.
// Expone un objeto global "L" con la misma forma de uso que tenía Leaflet (L.map, L.marker, L.polygon, L.divIcon,
// bindTooltip, fitBounds…) para que el resto de la app no cambie. Fondo: OpenFreeMap (estilo "liberty");
// si no carga, se usa el mapa clásico de OpenStreetMap. Las zonas, rutas y círculos se dibujan todos juntos en
// una sola fuente GeoJSON (rápido aunque haya cientos); los móviles y puntos son marcadores HTML.
(function () {
  'use strict';
  const ML = window.maplibregl;
  const ESTILO = 'https://tiles.openfreemap.org/styles/liberty';
  const CLASICO = {
    version: 8,
    sources: { osm: { type: 'raster', tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' } },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  };
  const Z = 1; // Leaflet usa teselas de 256 px y MapLibre de 512: zoom Leaflet = zoom MapLibre + 1
  let seq = 0;
  const nid = () => 'lg' + (++seq);
  const css = `
.maplibregl-map{font:inherit}.lg-mapa{z-index:0}
.lg-ic{position:absolute;left:0;top:0;line-height:0}.lg-ic>.lg-in{line-height:normal}
.lg-tt{position:absolute;z-index:5;background:#fff;border:1px solid #fff;border-radius:4px;color:#222;white-space:nowrap;padding:4px 8px;box-shadow:0 1px 4px rgba(0,0,0,.35);font:600 12px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;pointer-events:none;line-height:1.4}
.lg-tt.arriba{left:50%;bottom:100%;transform:translate(-50%,-6px)}.lg-tt.derecha{left:100%;top:50%;transform:translate(6px,-50%)}.lg-tt.centro{left:50%;top:50%;transform:translate(-50%,-50%)}
.lg-tt-flot{position:absolute;z-index:3;transform:translate(10px,-50%)}.lg-oculto{display:none}
.lg-tt-ctr{pointer-events:none}
.maplibregl-popup-content{border-radius:12px;padding:10px 12px;box-shadow:0 6px 20px rgba(0,0,0,.25);font:inherit}
.maplibregl-ctrl-attrib{font-size:10.5px}`;
  if (!document.getElementById('lg-css')) { const s = document.createElement('style'); s.id = 'lg-css'; s.textContent = css; document.head.append(s); }

  // ---------- coordenadas ----------
  class LatLng {
    constructor(lat, lng) { this.lat = +lat; this.lng = +lng; }
    distanceTo(o) { o = latLng(o); const R = 6371000, r = Math.PI / 180, dLa = (o.lat - this.lat) * r, dLo = (o.lng - this.lng) * r; const a = Math.sin(dLa / 2) ** 2 + Math.cos(this.lat * r) * Math.cos(o.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(a))); }
    equals(o) { o = latLng(o); return Math.abs(o.lat - this.lat) < 1e-9 && Math.abs(o.lng - this.lng) < 1e-9; }
    toML() { return [this.lng, this.lat]; }
  }
  function latLng(a, b) {
    if (a instanceof LatLng) return a;
    if (Array.isArray(a)) return new LatLng(a[0], a[1]);
    if (a && typeof a === 'object' && 'lat' in a) return new LatLng(a.lat, a.lng != null ? a.lng : a.lon);
    return new LatLng(a, b);
  }
  class LatLngBounds {
    constructor(a, b) { this._sw = null; this._ne = null; if (Array.isArray(a) && b === undefined && (Array.isArray(a[0]) || (a[0] && typeof a[0] === 'object'))) a.forEach(p => this.extend(p)); else if (a) { this.extend(a); if (b) this.extend(b); } }
    extend(x) {
      if (x instanceof LatLngBounds) { if (x.isValid()) { this.extend(x._sw); this.extend(x._ne); } return this; }
      const p = latLng(x); if (isNaN(p.lat) || isNaN(p.lng)) return this;
      if (!this._sw) { this._sw = new LatLng(p.lat, p.lng); this._ne = new LatLng(p.lat, p.lng); }
      else { this._sw.lat = Math.min(this._sw.lat, p.lat); this._sw.lng = Math.min(this._sw.lng, p.lng); this._ne.lat = Math.max(this._ne.lat, p.lat); this._ne.lng = Math.max(this._ne.lng, p.lng); }
      return this;
    }
    isValid() { return !!this._sw; }
    pad(r) { if (!this.isValid()) return this; const h = (this._ne.lat - this._sw.lat) * r, w = (this._ne.lng - this._sw.lng) * r; return new LatLngBounds([this._sw.lat - h, this._sw.lng - w], [this._ne.lat + h, this._ne.lng + w]); }
    getCenter() { return new LatLng((this._sw.lat + this._ne.lat) / 2, (this._sw.lng + this._ne.lng) / 2); }
    getSouthWest() { return this._sw; } getNorthEast() { return this._ne; }
    getNorth() { return this._ne.lat; } getSouth() { return this._sw.lat; } getEast() { return this._ne.lng; } getWest() { return this._sw.lng; }
    contains(x) { if (x instanceof LatLngBounds) return this.contains(x._sw) && this.contains(x._ne); const p = latLng(x); return p.lat >= this._sw.lat && p.lat <= this._ne.lat && p.lng >= this._sw.lng && p.lng <= this._ne.lng; }
    toML() { return [[this._sw.lng, this._sw.lat], [this._ne.lng, this._ne.lat]]; }
  }
  const latLngBounds = (a, b) => a instanceof LatLngBounds ? a : new LatLngBounds(a, b);

  // ---------- eventos ----------
  class Evented {
    on(tipos, fn, ctx) { if (typeof tipos === 'object') { Object.keys(tipos).forEach(t => this.on(t, tipos[t], fn)); return this; } String(tipos).split(/\s+/).forEach(t => { (this._ev = this._ev || {})[t] = (this._ev[t] || []).concat({ fn, ctx }); this._alEscuchar && this._alEscuchar(t); }); return this; }
    off(tipos, fn) { if (!this._ev) return this; if (!tipos) { this._ev = {}; return this; } String(tipos).split(/\s+/).forEach(t => { if (!this._ev[t]) return; this._ev[t] = fn ? this._ev[t].filter(h => h.fn !== fn) : []; }); return this; }
    once(t, fn, ctx) { const w = e => { this.off(t, w); fn.call(ctx || this, e); }; return this.on(t, w); }
    fire(t, d = {}) { const hs = this._ev && this._ev[t]; if (!hs || !hs.length) return this; const e = Object.assign({ type: t, target: this, sourceTarget: this }, d); hs.slice().forEach(h => h.fn.call(h.ctx || this, e)); return this; }
    listens(t) { return !!(this._ev && this._ev[t] && this._ev[t].length); }
  }

  // ---------- mapa ----------
  const webgl = () => { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } };
  class Mapa extends Evented {
    constructor(el, o = {}) {
      super();
      this._c = typeof el === 'string' ? document.getElementById(el) : el;
      this._c.classList.add('lg-mapa');
      this._o = o; this._capas = new Set(); this._paths = new Map(); this._cola = []; this._listo = false; this._dash = new Set();
      let clasico = false; try { clasico = localStorage.getItem('rodar_mapa_clasico') === '1'; } catch (e) { }
      if (!ML || !webgl()) { this._c.innerHTML = '<div style="padding:20px;text-align:center;color:#555;font:14px system-ui">Este dispositivo no puede mostrar el mapa (falta WebGL).</div>'; }
      const centro = o.center ? latLng(o.center) : new LatLng(-31, -58.8);
      this._m = new ML.Map({
        container: this._c, style: clasico ? CLASICO : ESTILO, center: centro.toML(), zoom: (o.zoom != null ? o.zoom : 13) - Z,
        attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false, maxZoom: 19 - Z + 0.5,
        fadeDuration: 0, cooperativeGestures: false, locale: { 'NavigationControl.ZoomIn': 'Acercar', 'NavigationControl.ZoomOut': 'Alejar' },
      });
      const m = this._m;
      try { m.touchZoomRotate.disableRotation(); m.keyboard.disableRotation(); } catch (e) { }
      if (o.zoomControl !== false) m.addControl(new ML.NavigationControl({ showCompass: false }), 'top-left');
      // si el estilo vectorial no carga, se pasa al mapa clásico
      let cargo = false;
      const aClasico = () => { if (this._clasico) return; this._clasico = true; try { m.setStyle(CLASICO); } catch (e) { } };
      m.on('error', e => { const msg = String(e && e.error && (e.error.message || e.error) || ''); if (!cargo && !this._clasico && /style|Failed to fetch|NetworkError|404|load/i.test(msg)) aClasico(); });
      setTimeout(() => { if (!cargo && !this._clasico && !clasico) aClasico(); }, 12000);
      m.on('style.load', () => { cargo = true; this._listo = true; this._montarPaths(); const q = this._cola; this._cola = []; q.forEach(f => f()); });
      m.on('load', () => this.fire('load'));
      // clic largo en pantallas táctiles = "contextmenu" (como en Leaflet)
      let lp = null;
      m.on('touchstart', e => { if (e.originalEvent.touches && e.originalEvent.touches.length > 1) return; if (e.originalEvent.target && e.originalEvent.target.closest && e.originalEvent.target.closest('.lg-ic')) return; clearTimeout(lp); const ev = e; lp = setTimeout(() => this._evMapa('contextmenu', ev), 600); });
      ['touchend', 'touchcancel', 'touchmove', 'dragstart', 'zoomstart'].forEach(t => m.on(t, () => clearTimeout(lp)));
      this._hover = null;
    }
    _cuando(fn) { if (this._listo) fn(); else this._cola.push(fn); }
    _evMapa(t, e) {
      const d = {};
      if (e && e.lngLat) d.latlng = new LatLng(e.lngLat.lat, e.lngLat.lng);
      if (e && e.point) d.containerPoint = e.point;
      if (e && e.originalEvent) d.originalEvent = e.originalEvent;
      this.fire(t, d);
    }
    _alEscuchar(t) {
      this._enganchados = this._enganchados || new Set(); if (this._enganchados.has(t)) return; this._enganchados.add(t);
      const ML_EV = { click: 'click', dblclick: 'dblclick', contextmenu: 'contextmenu', mousemove: 'mousemove', mousedown: 'mousedown', mouseup: 'mouseup',
        dragstart: 'dragstart', drag: 'drag', dragend: 'dragend', movestart: 'movestart', move: 'move', moveend: 'moveend', zoomstart: 'zoomstart', zoom: 'zoom', zoomend: 'zoomend', resize: 'resize' };
      if (!ML_EV[t]) return;
      // Con { dobleClicAcerca: true }: el doble clic (o doble toque) solo acerca el mapa; el clic simple se avisa
      // recién cuando se sabe que no viene un segundo clic (así no se mueve el pin al hacer zoom).
      if (t === 'click' && this._o.dobleClicAcerca) {
        let pend = null, ult = 0, pos = null;
        this._m.on('click', e => {
          if (this._buscar) { const p = this._buscar(e); if (p && p.listens(t)) return; }
          const ahora = Date.now(), cerca = pos && e.point && Math.hypot(e.point.x - pos.x, e.point.y - pos.y) < 30;
          if (pend && ahora - ult < 330 && cerca) { clearTimeout(pend); pend = null; ult = 0; return; }
          ult = ahora; pos = e.point; clearTimeout(pend);
          pend = setTimeout(() => { pend = null; this._evMapa(t, e); }, 300);
        });
        return;
      }
      this._m.on(ML_EV[t], e => {
        // un clic sobre una forma "interactiva" que corta la propagación no llega al mapa
        if ((t === 'click' || t === 'contextmenu') && this._buscar) { const p = this._buscar(e); if (p && p.listens(t)) return; }
        this._evMapa(t, e);
      });
    }
    // --- vista ---
    setView(c, z, o = {}) { const p = latLng(c); const op = { center: p.toML() }; if (z != null) op.zoom = z - Z; if (o.animate) this._m.easeTo(Object.assign(op, { duration: 500 })); else this._m.jumpTo(op); return this; }
    panTo(c, o = {}) { const p = latLng(c); if (o.animate === false) this._m.jumpTo({ center: p.toML() }); else this._m.easeTo({ center: p.toML(), duration: (o.duration != null ? o.duration : .25) * 1000 }); return this; }
    flyTo(c, z, o = {}) { const p = latLng(c); this._m.flyTo({ center: p.toML(), zoom: z != null ? z - Z : undefined, duration: (o.duration || 1) * 1000 }); return this; }
    setZoom(z) { this._m.setZoom(z - Z); return this; }
    getZoom() { return this._m.getZoom() + Z; }
    getCenter() { const c = this._m.getCenter(); return new LatLng(c.lat, c.lng); }
    getBounds() { const b = this._m.getBounds(); return new LatLngBounds([b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]); }
    fitBounds(b, o = {}) {
      b = latLngBounds(b); if (!b.isValid()) return this;
      let pad = o.padding != null ? o.padding : 20; if (Array.isArray(pad)) pad = { top: pad[1], bottom: pad[1], left: pad[0], right: pad[0] };
      const r = this._c.getBoundingClientRect(); if (r.width < 40 || r.height < 40) pad = 0;
      try { this._m.fitBounds(b.toML(), { padding: pad, maxZoom: (o.maxZoom || 17) - Z, duration: o.animate ? 500 : 0 }); } catch (e) { this.setView(b.getCenter(), 16); }
      return this;
    }
    invalidateSize() { this._m.resize(); return this; }
    getContainer() { return this._c; }
    latLngToContainerPoint(c) { return this._m.project(latLng(c).toML()); }
    containerPointToLatLng(p) { const x = this._m.unproject(p); return new LatLng(x.lat, x.lng); }
    distance(a, b) { return latLng(a).distanceTo(b); }
    hasLayer(l) { return !!l && l._map === this; }
    addLayer(l) { l.addTo(this); return this; }
    removeLayer(l) { if (l && l._map === this) l.remove(); return this; }
    eachLayer(fn) { this._capas.forEach(fn); return this; }
    whenReady(fn) { this._cuando(() => fn.call(this)); return this; }
    remove() { this._capas.forEach(l => { try { l.remove(); } catch (e) { } }); this._m.remove(); return this; }
    getMaplibreMap() { return this._m; }
    // --- formas (todas en una sola fuente GeoJSON) ---
    _montarPaths() {
      const m = this._m; if (m.getSource('lg')) return;
      m.addSource('lg', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id' });
      m.addLayer({ id: 'lg-fill', type: 'fill', source: 'lg', filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['get', 'fill']], paint: { 'fill-color': ['get', 'fillColor'], 'fill-opacity': ['get', 'fillOpacity'] } });
      this._dash.clear(); this._capaLinea('');
      m.addLayer({ id: 'lg-pt', type: 'circle', source: 'lg', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': ['get', 'radius'], 'circle-color': ['get', 'fillColor'], 'circle-opacity': ['get', 'fillOpacity'], 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': ['get', 'weight'], 'circle-stroke-opacity': ['get', 'opacity'] } });
      const capas = () => ['lg-fill', 'lg-pt', ...[...this._dash].map(d => 'lg-l' + d)].filter(id => m.getLayer(id));
      const buscar = e => { const fs = m.queryRenderedFeatures(e.point, { layers: capas() }).filter(f => f.properties.interactive); if (!fs.length) return null; const ps = fs.map(f => this._paths.get(f.properties.id)).filter(Boolean); return ps.sort((a, b) => b._orden - a._orden)[0] || null; };
      this._buscar = buscar;
      m.on('click', e => { const p = buscar(e); if (p) p._clic(e); });
      m.on('contextmenu', e => { const p = buscar(e); if (p && p.listens('contextmenu')) p.fire('contextmenu', { latlng: new LatLng(e.lngLat.lat, e.lngLat.lng), originalEvent: e.originalEvent }); });
      m.on('mousemove', e => {
        const p = buscar(e); if (p !== this._hover) { if (this._hover) this._hover._salir(); this._hover = p; if (p) p._entrar(e); }
        if (p) p._mover(e); m.getCanvas().style.cursor = p && (p.listens('click') || p._tt) ? 'pointer' : '';
      });
      m.on('mouseout', () => { if (this._hover) { this._hover._salir(); this._hover = null; } });
      this._datos();
    }
    _capaLinea(dash) {
      const m = this._m, id = 'lg-l' + dash; if (this._dash.has(dash) && m.getLayer(id)) return; this._dash.add(dash);
      const paint = { 'line-color': ['get', 'color'], 'line-width': ['get', 'weight'], 'line-opacity': ['get', 'opacity'] };
      if (dash) paint['line-dasharray'] = dash.split('_').map(Number);
      m.addLayer({ id, type: 'line', source: 'lg', filter: ['all', ['!=', ['geometry-type'], 'Point'], ['get', 'stroke'], ['==', ['get', 'dash'], dash]], layout: { 'line-join': 'round', 'line-cap': dash ? 'butt' : 'round' }, paint }, m.getLayer('lg-pt') ? 'lg-pt' : undefined);
    }
    _datos() {
      if (this._pend) return; this._pend = true;
      requestAnimationFrame(() => {
        this._pend = false; if (!this._listo) return; const src = this._m.getSource('lg'); if (!src) return;
        const fs = []; [...this._paths.values()].sort((a, b) => a._orden - b._orden).forEach(p => { const f = p._feature(); if (f) { if (f.properties.stroke && f.geometry.type !== 'Point') this._capaLinea(f.properties.dash); fs.push(f); } });
        src.setData({ type: 'FeatureCollection', features: fs });
      });
    }
  }

  // ---------- capas ----------
  class Capa extends Evented {
    addTo(t) { if (t instanceof Grupo) { t.addLayer(this); return this; } if (this._map === t) return this; if (this._map) this.remove(); this._map = t; t._capas.add(this); this._alAgregar(t); return this; }
    remove() { const m = this._map; if (this._grupo) { const g = this._grupo; this._grupo = null; g._ls.delete(this); } if (!m) return this; this._map = null; m._capas.delete(this); this._alQuitar(m); return this; }
    removeFrom(m) { return this.remove(); }
    bindTooltip(html, o = {}) { this._tt = { html: String(html), o }; if (this._map) this._ponerTooltip(); return this; }
    unbindTooltip() { this._quitarTooltip && this._quitarTooltip(); this._tt = null; return this; }
    setTooltipContent(html) { if (this._tt) { this._tt.html = String(html); if (this._ttEl) this._ttEl.innerHTML = this._tt.html; } return this; }
    bindPopup(html, o = {}) { this._pop = { html, o }; return this; }
    getPopup() { return this._popup || null; }
  }

  // Íconos
  class DivIcon { constructor(o = {}) { this.options = Object.assign({ className: 'leaflet-div-icon', html: '', iconSize: [12, 12] }, o); } }
  const PIN = '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#2a81cb" stroke="#1f5f96" stroke-width="1"/><circle cx="12.5" cy="12.5" r="4.6" fill="#fff"/></svg>';
  const ICONO_DEF = new DivIcon({ className: '', html: PIN, iconSize: [25, 41], iconAnchor: [12, 41], tooltipAnchor: [0, -34] });

  class Marcador extends Capa {
    constructor(c, o = {}) { super(); this._ll = latLng(c); this.options = Object.assign({ interactive: true, draggable: false, zIndexOffset: 0 }, o); this._icono = o.icon || ICONO_DEF; this.dragging = { enable: () => { this.options.draggable = true; this._mk && this._mk.setDraggable(true); }, disable: () => { this.options.draggable = false; this._mk && this._mk.setDraggable(false); }, enabled: () => !!this.options.draggable }; }
    _armarIcono() {
      const io = this._icono.options, sz = io.iconSize || [12, 12], an = io.iconAnchor || [sz[0] / 2, sz[1] / 2];
      if (!this._el) {
        this._el = document.createElement('div'); this._el.className = 'lg-ic'; this._el.setAttribute('role', 'img'); // MapLibre le pone aria-label: con role img es válido
        if (this.options.interactive) {
          // los clics sobre el marcador no llegan al mapa (como en Leaflet)
          // (mousedown/touchstart sí llegan al mapa: MapLibre los necesita para arrastrar el marcador)
          ['click', 'dblclick', 'contextmenu'].forEach(t => this._el.addEventListener(t, e => { e.stopPropagation(); if (t === 'contextmenu') e.preventDefault(); }));
          this._el.addEventListener('click', e => { this.fire('click', { latlng: this._ll, originalEvent: e }); if (this._pop) this.togglePopup(); });
          this._el.addEventListener('contextmenu', e => this.fire('contextmenu', { latlng: this._ll, originalEvent: e }));
          this._el.addEventListener('mouseenter', e => { this._el.style.zIndex = '99999'; this.fire('mouseover', { originalEvent: e }); if (this._ttEl && !this._tt.o.permanent) this._ttEl.classList.remove('lg-oculto'); });
          this._el.addEventListener('mouseleave', e => { this._el.style.zIndex = String(1000 + (this.options.zIndexOffset || 0)); this.fire('mouseout', { originalEvent: e }); if (this._ttEl && !this._tt.o.permanent) this._ttEl.classList.add('lg-oculto'); });
          let lp; this._el.addEventListener('touchstart', () => { clearTimeout(lp); lp = setTimeout(() => this.fire('contextmenu', { latlng: this._ll }), 650); }, { passive: true });
          ['touchend', 'touchmove', 'touchcancel'].forEach(t => this._el.addEventListener(t, () => clearTimeout(lp), { passive: true }));
          this._el.style.cursor = 'pointer';
        } else this._el.style.pointerEvents = 'none';
      }
      const tt = this._el.querySelector(':scope > .lg-tt');
      this._el.innerHTML = ''; const inn = document.createElement('div'); inn.className = 'lg-in ' + (io.className || ''); inn.style.width = sz[0] + 'px'; inn.style.height = sz[1] + 'px';
      if (io.html instanceof Node) inn.append(io.html); else inn.innerHTML = io.html || '';
      this._el.append(inn); if (tt) this._el.append(tt);
      this._el.style.width = sz[0] + 'px'; this._el.style.height = sz[1] + 'px';
      this._el.style.zIndex = String(1000 + (this.options.zIndexOffset || 0));
      this._off = [-an[0], -an[1]]; this._tamI = sz; this._anc = an;
      if (this._mk) this._mk.setOffset(this._off);
    }
    _alAgregar(map) {
      this._armarIcono();
      this._mk = new ML.Marker({ element: this._el, anchor: 'top-left', offset: this._off, draggable: !!this.options.draggable }).setLngLat(this._ll.toML()).addTo(map._m);
      this._el.style.zIndex = String(1000 + (this.options.zIndexOffset || 0));
      this._mk.on('dragstart', () => this.fire('dragstart'));
      this._mk.on('drag', () => { const p = this._mk.getLngLat(); this._ll = new LatLng(p.lat, p.lng); this.fire('drag', { latlng: this._ll }); this.fire('move', { latlng: this._ll }); });
      this._mk.on('dragend', () => { const p = this._mk.getLngLat(); this._ll = new LatLng(p.lat, p.lng); this.fire('dragend', { latlng: this._ll }); });
      if (this._tt) this._ponerTooltip();
      this.fire('add');
    }
    _alQuitar(map) { if (this._popup) { this._popup.remove(); this._popup = null; } if (this._mk) { this._mk.remove(); this._mk = null; } this.fire('remove'); }
    _ponerTooltip() {
      if (!this._el) return; if (this._ttEl) this._ttEl.remove();
      const o = this._tt.o, d = o.direction === 'center' ? 'centro' : o.direction === 'right' ? 'derecha' : 'arriba';
      const t = document.createElement('div'); t.className = 'lg-tt ' + d + ' ' + (o.className || '') + (o.permanent ? '' : ' lg-oculto'); t.innerHTML = this._tt.html;
      if (d === 'arriba') { t.style.left = (this._anc[0]) + 'px'; t.style.bottom = 'auto'; t.style.top = '0'; t.style.transform = 'translate(-50%, calc(-100% - 4px))'; }
      this._el.append(t); this._ttEl = t;
    }
    _quitarTooltip() { if (this._ttEl) { this._ttEl.remove(); this._ttEl = null; } }
    openTooltip() { if (this._ttEl) this._ttEl.classList.remove('lg-oculto'); return this; }
    closeTooltip() { if (this._ttEl && !this._tt.o.permanent) this._ttEl.classList.add('lg-oculto'); return this; }
    getLatLng() { return this._ll; }
    setLatLng(c) { this._ll = latLng(c); if (this._mk) this._mk.setLngLat(this._ll.toML()); if (this._popup) this._popup.setLngLat(this._ll.toML()); this.fire('move', { latlng: this._ll }); return this; }
    setIcon(ic) { this._icono = ic; if (this._el) this._armarIcono(); return this; }
    setZIndexOffset(z) { this.options.zIndexOffset = z; if (this._el) this._el.style.zIndex = String(1000 + z); return this; }
    setOpacity(o) { if (this._el) this._el.style.opacity = o; return this; }
    getElement() { return this._el; }
    openPopup() {
      if (!this._map || !this._pop) return this; if (this._popup) this._popup.remove();
      const o = this._pop.o; this._popup = new ML.Popup({ offset: [this._anc[0] - this._tamI[0] / 2, -this._anc[1] - 4], maxWidth: (o.maxWidth || 300) + 'px', closeButton: true, className: o.className || '' })
        .setLngLat(this._ll.toML()).setHTML(typeof this._pop.html === 'function' ? this._pop.html(this) : String(this._pop.html)).addTo(this._map._m);
      const pop = this._popup; this._popup.on('close', () => { if (this._popup === pop) this._popup = null; });
      this._map.fire('popupopen', { popup: { getElement: () => pop.getElement(), _source: this } });
      return this;
    }
    closePopup() { if (this._popup) { this._popup.remove(); this._popup = null; } return this; }
    togglePopup() { return this._popup ? this.closePopup() : this.openPopup(); }
    setPopupContent(h) { if (this._pop) this._pop.html = h; if (this._popup) this._popup.setHTML(String(h)); return this; }
    toGeoJSON() { return { type: 'Feature', geometry: { type: 'Point', coordinates: this._ll.toML() }, properties: {} }; }
  }

  // Formas: polígonos, líneas, círculos
  let orden = 0;
  const dashKey = d => d ? String(d).trim().split(/[\s,]+/).map(Number).filter(x => !isNaN(x)) : null;
  class Forma extends Capa {
    constructor(o) { super(); this.options = Object.assign({ color: '#3388ff', weight: 3, opacity: 1, fill: false, fillColor: null, fillOpacity: .2, dashArray: null, interactive: true }, o || {}); this._id = nid(); this._orden = ++orden; }
    _props() {
      const o = this.options, w = +o.weight || 0, d = dashKey(o.dashArray);
      return { id: this._id, color: o.color, weight: w, opacity: o.stroke === false ? 0 : +o.opacity, stroke: o.stroke !== false && w > 0, fill: !!o.fill, fillColor: o.fillColor || o.color, fillOpacity: +o.fillOpacity, interactive: o.interactive !== false,
        dash: d && d.length ? d.map(x => Math.max(.5, Math.round(x / Math.max(1, w) * 2) / 2)).join('_') : '' };
    }
    _alAgregar(map) { map._paths.set(this._id, this); map._cuando(() => { map._montarPaths(); if (this._tt) this._ponerTooltip(); }); map._datos(); this.fire('add'); }
    _alQuitar(map) { map._paths.delete(this._id); if (map._hover === this) map._hover = null; this._quitarTooltip(); map._datos(); this.fire('remove'); }
    _refrescar() { if (this._map) { this._map._datos(); if (this._ttMk) this._ttMk.setLngLat(this._centroTT().toML()); } }
    setStyle(s) { Object.assign(this.options, s || {}); this._refrescar(); return this; }
    bringToFront() { this._orden = ++orden; this._refrescar(); return this; }
    bringToBack() { this._orden = -(++orden); this._refrescar(); return this; }
    _corta(t) { return this.listens(t); }
    _clic(e) { const d = { latlng: new LatLng(e.lngLat.lat, e.lngLat.lng), originalEvent: e.originalEvent }; this.fire('click', d); if (this._tt && !this._tt.o.permanent && 'ontouchstart' in window) this._mostrarTT(e); }
    _entrar(e) { this.fire('mouseover', { originalEvent: e.originalEvent }); if (this._tt && !this._tt.o.permanent) this._mostrarTT(e); }
    _salir() { this.fire('mouseout', {}); if (this._ttFlot) { this._ttFlot.remove(); this._ttFlot = null; } }
    _mover(e) { if (this._ttFlot && (this._tt.o.sticky || true)) { this._ttFlot.style.left = e.point.x + 'px'; this._ttFlot.style.top = e.point.y + 'px'; } }
    _mostrarTT(e) {
      if (!this._map) return; if (this._ttFlot) this._ttFlot.remove();
      const t = document.createElement('div'); t.className = 'lg-tt lg-tt-flot ' + (this._tt.o.className || ''); t.innerHTML = this._tt.html;
      t.style.left = e.point.x + 'px'; t.style.top = e.point.y + 'px'; this._map._c.append(t); this._ttFlot = t;
      if ('ontouchstart' in window) setTimeout(() => { if (this._ttFlot === t) { t.remove(); this._ttFlot = null; } }, 2500);
    }
    _centroTT() { return this.getBounds().getCenter(); }
    _ponerTooltip() {
      this._quitarTooltip(); if (!this._map || !this._tt || !this._tt.o.permanent) return;
      const el = document.createElement('div'); el.className = 'lg-tt-ctr'; el.style.pointerEvents = 'none'; el.style.zIndex = '3000';
      const t = document.createElement('div'); t.className = 'lg-tt centro ' + (this._tt.o.className || ''); t.innerHTML = this._tt.html; el.append(t);
      this._ttMk = new ML.Marker({ element: el, anchor: 'center' }).setLngLat(this._centroTT().toML()).addTo(this._map._m);
    }
    _quitarTooltip() { if (this._ttMk) { this._ttMk.remove(); this._ttMk = null; } if (this._ttFlot) { this._ttFlot.remove(); this._ttFlot = null; } }
  }
  const aLL = a => (a || []).map(p => latLng(p));
  class Linea extends Forma {
    constructor(pts, o) { super(Object.assign({ fill: false }, o)); this._pts = aLL(pts); }
    _feature() { if (this._pts.length < 2) return null; return { type: 'Feature', geometry: { type: 'LineString', coordinates: this._pts.map(p => p.toML()) }, properties: this._props() }; }
    getLatLngs() { return this._pts; }
    setLatLngs(p) { this._pts = aLL(p); this._refrescar(); return this; }
    addLatLng(p) { this._pts.push(latLng(p)); this._refrescar(); return this; }
    getBounds() { return new LatLngBounds(this._pts); }
    getCenter() { return this.getBounds().getCenter(); }
    _centroTT() { return this._pts.length ? this._pts[Math.floor(this._pts.length / 2)] : new LatLng(0, 0); }
  }
  class Poligono extends Forma {
    constructor(pts, o) { super(Object.assign({ fill: true }, o)); this._pts = aLL(Array.isArray(pts) && Array.isArray(pts[0]) && Array.isArray(pts[0][0]) ? pts[0] : pts); }
    _anillo() { const c = this._pts.map(p => p.toML()); if (c.length && (c[0][0] !== c[c.length - 1][0] || c[0][1] !== c[c.length - 1][1])) c.push(c[0]); return c; }
    _feature() { if (this._pts.length < 3) { if (this._pts.length === 2) return { type: 'Feature', geometry: { type: 'LineString', coordinates: this._pts.map(p => p.toML()) }, properties: this._props() }; return null; } return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [this._anillo()] }, properties: this._props() }; }
    getLatLngs() { return [this._pts]; }
    setLatLngs(p) { this._pts = aLL(Array.isArray(p) && Array.isArray(p[0]) && Array.isArray(p[0][0]) ? p[0] : p); this._refrescar(); return this; }
    getBounds() { return new LatLngBounds(this._pts); }
    getCenter() { // centroide del polígono (para etiquetas)
      const p = this._pts; if (p.length < 3) return this.getBounds().getCenter();
      let a = 0, x = 0, y = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const f = p[j].lng * p[i].lat - p[i].lng * p[j].lat; a += f; x += (p[j].lng + p[i].lng) * f; y += (p[j].lat + p[i].lat) * f; }
      if (Math.abs(a) < 1e-12) return this.getBounds().getCenter(); return new LatLng(y / (3 * a), x / (3 * a));
    }
    _centroTT() { return this.getCenter(); }
    toGeoJSON() { return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [this._anillo()] }, properties: {} }; }
  }
  class Rectangulo extends Poligono { constructor(b, o) { const x = latLngBounds(b); super([[x._sw.lat, x._sw.lng], [x._ne.lat, x._sw.lng], [x._ne.lat, x._ne.lng], [x._sw.lat, x._ne.lng]], o); } setBounds(b) { const x = latLngBounds(b); return this.setLatLngs([[x._sw.lat, x._sw.lng], [x._ne.lat, x._sw.lng], [x._ne.lat, x._ne.lng], [x._sw.lat, x._ne.lng]]); } }
  class Circulo extends Poligono { // radio en metros
    constructor(c, o = {}) { super([], Object.assign({ fill: true }, typeof o === 'number' ? { radius: o } : o)); this._c = latLng(c); this._r = this.options.radius || 10; this._calc(); }
    _calc() { const n = 48, out = [], la = this._c.lat * Math.PI / 180, dLat = this._r / 111320, dLng = this._r / (111320 * Math.cos(la)); for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; out.push(new LatLng(this._c.lat + dLat * Math.sin(t), this._c.lng + dLng * Math.cos(t))); } this._pts = out; }
    setLatLng(c) { this._c = latLng(c); this._calc(); this._refrescar(); return this; }
    getLatLng() { return this._c; }
    setRadius(r) { this._r = r; this._calc(); this._refrescar(); return this; }
    getRadius() { return this._r; }
  }
  class CirculoPx extends Forma { // radio en píxeles
    constructor(c, o = {}) { super(Object.assign({ fill: true, radius: 10, weight: 3 }, o)); this._c = latLng(c); }
    _feature() { const p = this._props(); p.radius = +this.options.radius; return { type: 'Feature', geometry: { type: 'Point', coordinates: this._c.toML() }, properties: p }; }
    setLatLng(c) { this._c = latLng(c); this._refrescar(); return this; }
    getLatLng() { return this._c; }
    setRadius(r) { this.options.radius = r; this._refrescar(); return this; }
    getBounds() { return new LatLngBounds([this._c, this._c]); }
    _centroTT() { return this._c; }
  }

  // Grupos
  class Grupo extends Capa {
    constructor(ls) { super(); this._ls = new Set(); (ls || []).forEach(l => this.addLayer(l)); }
    addLayer(l) { if (l._grupo && l._grupo !== this) l._grupo._ls.delete(l); l._grupo = this; this._ls.add(l); if (this._map && l._map !== this._map) { const g = l._grupo; Capa.prototype.addTo.call(l, this._map); l._grupo = g; } return this; }
    removeLayer(l) { if (this._ls.has(l)) { this._ls.delete(l); const m = l._map; l._grupo = null; if (m) Capa.prototype.remove.call(l); } return this; }
    hasLayer(l) { return this._ls.has(l); }
    clearLayers() { [...this._ls].forEach(l => this.removeLayer(l)); return this; }
    eachLayer(fn) { this._ls.forEach(fn); return this; }
    getLayers() { return [...this._ls]; }
    _alAgregar(map) { this._ls.forEach(l => { const g = l._grupo; Capa.prototype.addTo.call(l, map); l._grupo = g; }); }
    _alQuitar(map) { this._ls.forEach(l => { if (l._map) { const g = l._grupo; l._grupo = null; Capa.prototype.remove.call(l); l._grupo = g; } }); }
    getBounds() { const b = new LatLngBounds(); this._ls.forEach(l => { if (l.getBounds) b.extend(l.getBounds()); else if (l.getLatLng) b.extend(l.getLatLng()); }); return b; }
    setStyle(s) { this._ls.forEach(l => l.setStyle && l.setStyle(s)); return this; }
  }
  // Al quitar una capa que está en un grupo, también sale del grupo (como layer.remove() + group)
  const quitarBase = Capa.prototype.remove;

  window.L = {
    version: 'maplibre-' + (ML && ML.getVersion ? ML.getVersion() : ''),
    map: (el, o) => new Mapa(el, o), Map: Mapa,
    latLng, LatLng, latLngBounds, LatLngBounds,
    marker: (c, o) => new Marcador(c, o), Marker: Marcador,
    divIcon: o => new DivIcon(o), DivIcon, icon: o => new DivIcon({ className: '', html: o && o.iconUrl ? `<img src="${o.iconUrl}" alt="" style="width:100%;height:100%">` : '', iconSize: o && o.iconSize, iconAnchor: o && o.iconAnchor }),
    polyline: (p, o) => new Linea(p, o), polygon: (p, o) => new Poligono(p, o), rectangle: (b, o) => new Rectangulo(b, o),
    circle: (c, o) => new Circulo(c, o), circleMarker: (c, o) => new CirculoPx(c, o),
    layerGroup: ls => new Grupo(ls), featureGroup: ls => new Grupo(ls), LayerGroup: Grupo, FeatureGroup: Grupo,
    tileLayer: () => ({ addTo() { return this; }, remove() { return this; } }),
    Evented, _quitarBase: quitarBase,
  };
})();
