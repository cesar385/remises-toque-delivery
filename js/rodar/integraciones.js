// Servicios externos: mensajes por WhatsApp/Telegram, bot de Telegram, pago de base con Mercado Pago,
// clima para el índice dinámico y captcha anti-robots. Agrega sus funciones a window.RODAR.
(function () {
  const R = window.RODAR;
  const { ErrorApi, funcionSupabase } = R;
  const faltaSupabase = () => { if (!R.SB) throw new ErrorApi('Falta configurar Supabase.'); };

  // ---- WhatsApp / Telegram: el envío real pasa por la función de Supabase del canal (guarda el token en secreto) ----
  const whatsappEnviar = async (token, convId, texto, canal = 'whatsapp') => {
    faltaSupabase();
    const tg = canal === 'telegram', nom = tg ? 'Telegram' : 'WhatsApp';
    const { r, j } = await funcionSupabase(tg ? 'telegram' : 'whatsapp', { accion: 'enviar', token, conv_id: convId, texto }, { noConectado: true });
    if (r.status === 404) throw new ErrorApi(`La función de ${nom} todavía no está instalada en Supabase.`, { noConectado: true });
    if (!r.ok) throw new ErrorApi(j.error || 'No se pudo enviar por ' + nom, { noConectado: r.status === 503 });
    return j;
  };

  // Bot de Telegram (solo administrador): accion = 'estado' | 'conectar' | 'desconectar'
  const telegramAdmin = async (token, accion) => {
    const { r, j } = await funcionSupabase('telegram', { accion, token });
    if (r.status === 404) return { instalada: false };
    if (!r.ok && !j.configurado) throw new ErrorApi(j.error || 'No se pudo consultar Telegram');
    return { instalada: true, ...j };
  };

  // ---- Pagar base con Mercado Pago: la función "mercadopago" crea el pago y lo acredita sola cuando MP lo aprueba ----
  // ---- Pagar base con una billetera: la función "pagos" crea el cobro (Mercado Pago, Ualá…) y lo acredita sola al aprobarse ----
  const pagoCrear = async (token, monto, movilId, proveedor) => {
    faltaSupabase();
    const { r, j } = await funcionSupabase('pagos', { accion: 'crear', proveedor: proveedor || 'mercadopago', token, monto, movil_id: movilId || null });
    if (r.status === 404) throw new ErrorApi('El pago automático todavía no está instalado en Supabase (ver README).', { noConectado: true });
    if (!r.ok) throw new ErrorApi(j.error || 'No se pudo crear el pago', { noConectado: r.status === 503 || !!j.noAutomatico });
    return j;
  };
  const mercadopagoCrear = (token, monto, movilId) => pagoCrear(token, monto, movilId, 'mercadopago'); // compatibilidad

  // ---- Clima (Open-Meteo) para el índice dinámico ----
  const descripcionClima = c => c === 0 ? 'Despejado' : c < 4 ? 'Nublado' : c < 50 ? 'Niebla' : c < 70 ? 'Lluvia' : c < 80 ? 'Nieve' : c < 90 ? 'Chaparrones' : 'Tormenta';
  const clima = async (lat, lng, token) => {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`);
      const j = await r.json(); const c = j.current.weather_code;
      await R.rpc('r_clima', token, {}, { temp: Math.round(j.current.temperature_2m), desc: descripcionClima(c), lluvia: c >= 51 });
    } catch { }
  };

  // ---- Captcha invisible (Cloudflare Turnstile) para el registro y el pedido web sin cuenta ----
  // Si el captcha está activado en el panel, resuelve el desafío (casi siempre sin que la persona haga nada),
  // lo verifica en la función "captcha" de Supabase y devuelve un pase de un solo uso. Si está desactivado devuelve null.
  let capCfg = null, capScript = null;
  const cargarTurnstile = () => {
    if (window.turnstile) return Promise.resolve();
    if (!capScript) capScript = new Promise((ok, mal) => {
      const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
      s.onload = () => ok(); s.onerror = () => { capScript = null; mal(new ErrorApi('No se pudo cargar la verificación anti-robots. Revisá la conexión y probá de nuevo.')); };
      document.head.append(s);
    });
    return capScript;
  };
  // Muestra el desafío en `caja` y devuelve el token de Turnstile
  const resolverDesafio = (caja, accion, setWid) => new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new ErrorApi('La verificación anti-robots tardó demasiado. Probá de nuevo.')), 90000);
    setWid(window.turnstile.render(caja, { sitekey: capCfg.site_key, action: accion, appearance: 'interaction-only', language: 'es',
      callback: x => { clearTimeout(t); ok(x); }, 'error-callback': () => { clearTimeout(t); mal(new ErrorApi('No pudimos confirmar que no sos un robot. Probá de nuevo.')); },
      'expired-callback': () => { clearTimeout(t); mal(new ErrorApi('La verificación venció. Probá de nuevo.')); } }));
  });
  const captcha = async accion => {
    if (!capCfg) { try { capCfg = await R.rpc('r_pub_captcha'); } catch { capCfg = null; return null; } }
    if (!capCfg || !capCfg.activo || !capCfg.site_key) return null;
    await cargarTurnstile();
    const caja = document.createElement('div');
    caja.style.cssText = 'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9000';
    document.body.append(caja);
    let wid = null;
    try {
      const tok = await resolverDesafio(caja, accion, w => { wid = w; });
      const { r, j } = await funcionSupabase('captcha', { token: tok, accion });
      if (!r.ok || !j.pase) throw new ErrorApi(j.error || 'No pudimos confirmar que no sos un robot. Probá de nuevo.');
      return j.pase;
    } finally { try { if (wid != null) window.turnstile.remove(wid); } catch { } caja.remove(); }
  };

  Object.assign(R, { whatsappEnviar, telegramAdmin, mercadopagoCrear, pagoCrear, clima, captcha });
})();
