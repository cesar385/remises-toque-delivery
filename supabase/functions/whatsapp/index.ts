// Función de Supabase: conecta el chat del panel con WhatsApp Business (API oficial de Meta, "Cloud API").
//  - GET  : verificación del webhook que pide Meta al configurarlo.
//  - POST de Meta : mensajes entrantes de clientes -> se guardan en la bandeja del panel.
//  - POST del panel {accion:'enviar', token, conv_id, texto} : un operador responde -> se envía por WhatsApp.
// Secretos necesarios (supabase secrets set ...): WA_ACCESS_TOKEN, WA_PHONE_ID, WA_VERIFY_TOKEN, RODAR_WEBHOOK_TOKEN
// Opcionales: WA_APP_SECRET (valida la firma de Meta), WA_PAIS (prefijo para números locales; por defecto 549 = Argentina)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
const ACCESS = Deno.env.get('WA_ACCESS_TOKEN') ?? '';
const PHONE_ID = Deno.env.get('WA_PHONE_ID') ?? '';
const VERIFY = Deno.env.get('WA_VERIFY_TOKEN') ?? '';
const WEBHOOK = Deno.env.get('RODAR_WEBHOOK_TOKEN') ?? '';
const APP_SECRET = Deno.env.get('WA_APP_SECRET') ?? '';
const PAIS = Deno.env.get('WA_PAIS') ?? '549';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// 5493454123456 -> 3454123456 (así se guardan los teléfonos en el sistema)
const aLocal = (wa: string) => (wa.startsWith(PAIS) && wa.length > PAIS.length + 6 ? wa.slice(PAIS.length) : wa);
// 3454123456 -> 5493454123456 (formato que pide WhatsApp)
const aWhatsapp = (tel: string) => { const d = tel.replace(/\D/g, ''); return d.length <= 11 ? PAIS + d.replace(/^0/, '') : d; };

async function firmaValida(req: Request, cuerpo: string) {
  if (!APP_SECRET) return true;
  const firma = req.headers.get('x-hub-signature-256') ?? '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(cuerpo)));
  const esperado = 'sha256=' + [...mac].map(b => b.toString(16).padStart(2, '0')).join('');
  return firma === esperado;
}

function textoDe(m: any): string {
  switch (m.type) {
    case 'text': return m.text?.body ?? '';
    case 'button': return m.button?.text ?? '[botón]';
    case 'interactive': return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '[respuesta]';
    case 'location': return `📍 Ubicación: https://maps.google.com/?q=${m.location?.latitude},${m.location?.longitude}`;
    case 'image': return '[📷 imagen]' + (m.image?.caption ? ' ' + m.image.caption : '');
    case 'audio': return '[🎤 audio]';
    case 'video': return '[🎥 video]';
    case 'document': return '[📎 documento]';
    case 'sticker': return '[sticker]';
    default: return `[${m.type}]`;
  }
}

async function entrante(body: any) {
  for (const entry of body.entry ?? []) for (const ch of entry.changes ?? []) {
    const v = ch.value ?? {};
    const nombres: Record<string, string> = {};
    for (const c of v.contacts ?? []) nombres[c.wa_id] = c.profile?.name ?? '';
    for (const m of v.messages ?? []) {
      const { error } = await sb.rpc('webhook_chat', { token: WEBHOOK, telefono: aLocal(m.from), texto: textoDe(m), canal: 'whatsapp', alias: nombres[m.from] || null });
      if (error) console.error('webhook_chat', error.message);
    }
  }
}

async function enviar(b: any) {
  if (!ACCESS || !PHONE_ID) return json({ error: 'WhatsApp no está configurado en Supabase (faltan los secretos WA_ACCESS_TOKEN y WA_PHONE_ID).' }, 503);
  const prep = await sb.rpc('r_wa_preparar', { p_token: b.token, p_q: {}, p_b: { conv_id: b.conv_id, texto: b.texto } });
  if (prep.error) return json({ error: prep.error.message.includes('SESION_VENCIDA') ? 'Sesión vencida. Volvé a ingresar.' : prep.error.message }, 400);
  const { msg_id, telefono } = prep.data;
  let ok = false, err = '', waId = '';
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: aWhatsapp(telefono), type: 'text', text: { body: b.texto, preview_url: true } }),
    });
    const j = await r.json();
    if (r.ok) { ok = true; waId = j.messages?.[0]?.id ?? ''; }
    else err = j.error?.error_data?.details ?? j.error?.message ?? 'WhatsApp rechazó el mensaje';
  } catch (e) { err = 'No se pudo conectar con WhatsApp: ' + (e as Error).message; }
  await sb.rpc('r_wa_resultado', { p_token: b.token, p_q: {}, p_b: { msg_id, ok, error: err, wa_id: waId } });
  return ok ? json({ ok: true }) : json({ error: err }, 502);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  if (req.method === 'GET') {
    if (url.searchParams.get('hub.mode') === 'subscribe' && VERIFY && url.searchParams.get('hub.verify_token') === VERIFY) return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
    return new Response('Forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const cuerpo = await req.text();
  let b: any; try { b = JSON.parse(cuerpo); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (b.accion === 'enviar') return await enviar(b);
  if (b.object === 'whatsapp_business_account') {
    if (!(await firmaValida(req, cuerpo))) return new Response('Firma inválida', { status: 401 });
    await entrante(b);
    return new Response('ok', { status: 200 });
  }
  return json({ error: 'Pedido no reconocido' }, 400);
});
