// ====== CONFIGURACIÓN ======
// Completá con los datos de tu proyecto de Supabase (Project Settings → API).
// La clave "anon / public" se puede publicar: la seguridad está en la base (solo se aceptan sesiones válidas).
//
// VARIAS REMISERÍAS CON EL MISMO CÓDIGO
// Cada remisería cliente tiene su propio proyecto de Supabase. Agregala en CLIENTES con la dirección
// (dominio) donde usa el sistema: al entrar por esa dirección, las páginas se conectan a SU base.
// Cualquier otra dirección usa la configuración principal (Remises TOQUE!).
(function () {
  const PRINCIPAL = {
    supabaseUrl: 'https://zytpxjungbaethgitfwn.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5dHB4anVuZ2JhZXRoZ2l0ZnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTk0ODMsImV4cCI6MjEwNzgzNTQ4M30.NORR6ka47QvVJydM0K3f-ffoIUcNO_ynsE23ZKLCsoI',
    // Rutas por calles con OpenRouteService (gratis, clave en openrouteservice.org → Dev Dashboard). Opcional: sin clave se usa OSRM público.
    // Google Maps (opcional): ubicación exacta con numeración. Clave de Google Cloud con Maps JavaScript API y Geocoding API habilitadas.
    googleKey: 'AIzaSyDXGDYWqsCOo1W2X2aS4FKjmKpYNFl6c-E',
    orsKey: 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImJiZGVkYWY5Mjc5ODQwN2JiMjcxNWY4YWI4ZTliMWFiIiwiaCI6Im11cm11cjY0In0=',
    // orsUrl: 'https://tu-servidor-ors',  // solo si instalás OpenRouteService en tu propio servidor

    // Central de clientes (superadmin.html). Vacío = está en este mismo proyecto de Supabase.
    // saasUrl: 'https://xxxx.supabase.co',
    // saasKey: 'eyJ…clave anon de la central…',
  };

  // Remiserías clientes: 'dirección': { supabaseUrl, supabaseKey }. Las claves que no pongas (googleKey,
  // orsKey…) se toman de la configuración principal.
  const CLIENTES = {
    // 'remiseriasol.tudominio.com': {
    //   supabaseUrl: 'https://abcd1234.supabase.co',
    //   supabaseKey: 'eyJ…clave anon de la remisería…',
    // },
  };

  const host = (location.hostname || '').toLowerCase().replace(/^www\./, '');
  window.RODAR_CONFIG = Object.assign({}, PRINCIPAL, CLIENTES[host] || {});
})();
