// Función de Supabase: conecta un bot de Telegram con Chat & Telefonía del panel.
//  - POST de Telegram (webhook): mensajes de los clientes -> bandeja del panel.
//  - POST del panel {accion:'enviar', token, conv_id, texto}: el operador responde -> se envía por Telegram.
//  - POST de la base de datos {accion:'aviso', id}: avisa al cliente el móvil asignado, la llegada, la cancelación y el final del viaje.
//  - POST del panel {accion:'estado'|'conectar'|'desconectar', token}: el administrador conecta el bot (solo admin).
// Secreto necesario (lo carga el administrador en Supabase → Edge Functions → Secrets): TG_BOT_TOKEN (el que da @BotFather).
// Opcional: TG_PAIS (prefijo de país de los números, por defecto 549 = Argentina).
// Se publica sin verificación JWT (Telegram no manda ese encabezado); los pedidos de Telegram se validan con un secreto propio.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const anon = createClient(URL_SB, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
const servicio = createClient(URL_SB, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const BOT = Deno.env.get('TG_BOT_TOKEN') ?? '';
const PAIS = Deno.env.get('TG_PAIS') ?? '549';
const API = `https://api.telegram.org/bot${BOT}`;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Secreto del webhook: derivado del token del bot (Telegram lo manda en cada pedido)
async function secreto() {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('rodar-tg:' + BOT)));
  return [...h].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
}
async function tg(metodo: string, cuerpo: Record<string, unknown> = {}) {
  const r = await fetch(`${API}/${metodo}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `Telegram respondió ${r.status}`);
  return j.result;
}
// +54 9 345 412-3456 -> 3454123456 (así se guardan los teléfonos en el sistema)
function aLocal(tel: string) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith(PAIS)) d = d.slice(PAIS.length); else if (d.startsWith('54')) d = d.slice(2);
  return d.replace(/^0/, '');
}
function textoDe(m: any): string {
  if (m.text) return m.text;
  if (m.location) return `📍 Ubicación: https://maps.google.com/?q=${m.location.latitude},${m.location.longitude}`;
  if (m.contact) return `📱 Compartió su número: ${m.contact.phone_number}`;
  if (m.photo) return '[📷 foto]' + (m.caption ? ' ' + m.caption : '');
  if (m.voice || m.audio) return '[🎤 audio]';
  if (m.video || m.video_note) return '[🎥 video]';
  if (m.document) return '[📎 documento]';
  if (m.sticker) return '[sticker ' + (m.sticker.emoji ?? '') + ']';
  return '[mensaje]';
}
const PEDIR_NUMERO = { keyboard: [[{ text: '📱 Compartir mi número', request_contact: true }], [{ text: '📍 Enviar mi ubicación', request_location: true }]], resize_keyboard: true, one_time_keyboard: true };

async function entrante(u: any) {
  const m = u.message ?? u.edited_message;
  if (!m || m.chat?.type !== 'private') return;           // solo chats privados con el bot
  const chat = String(m.chat.id), f = m.from ?? {};
  const alias = [f.first_name, f.last_name].filter(Boolean).join(' ') || (f.username ? '@' + f.username : null);
  // el número solo se toma si el cliente compartió el suyo (no el de otra persona)
  const tel = m.contact && (!m.contact.user_id || m.contact.user_id === f.id) ? aLocal(m.contact.phone_number) : null;
  const texto = m.text === '/start' ? '👋 Inició la conversación con el bot' : textoDe(m);
  const { data, error } = await servicio.rpc('tg_entrante', { p_chat: chat, p_alias: alias, p_texto: texto, p_telefono: tel });
  if (error) { console.error('tg_entrante', error.message); return; }
  // respuestas automáticas breves
  try {
    if (tel) await tg('sendMessage', { chat_id: chat, text: '¡Gracias! Ya tenemos tu número. Contanos dónde te buscamos (podés enviar tu ubicación) y un operador te responde enseguida.', reply_markup: { remove_keyboard: true } });
    else if (m.text === '/start' || (data?.nuevo && !data?.telefono)) await tg('sendMessage', { chat_id: chat, text: '¡Hola! Somos la central de remises. Para pedir un viaje compartí tu número con el botón de abajo y escribinos dónde te buscamos. Un operador te responde enseguida.', reply_markup: PEDIR_NUMERO });
    else if (data?.nuevo) await tg('sendMessage', { chat_id: chat, text: 'Recibimos tu mensaje. Un operador te responde enseguida.' });
  } catch (e) { console.error('respuesta automática', (e as Error).message); }
}

async function enviar(b: any) {
  if (!BOT) return json({ error: 'Telegram no está configurado en Supabase (falta el secreto TG_BOT_TOKEN).' }, 503);
  const prep = await anon.rpc('r_wa_preparar', { p_token: b.token, p_q: {}, p_b: { conv_id: b.conv_id, texto: b.texto } });
  if (prep.error) return json({ error: prep.error.message.includes('SESION_VENCIDA') ? 'Sesión vencida. Volvé a ingresar.' : prep.error.message }, 400);
  const { msg_id, chat_id } = prep.data;
  let ok = false, err = '', id = '';
  try { const r = await tg('sendMessage', { chat_id, text: b.texto }); ok = true; id = String(r?.message_id ?? ''); }
  catch (e) { err = /blocked/i.test((e as Error).message) ? 'El cliente bloqueó el bot' : 'Telegram: ' + (e as Error).message; }
  await anon.rpc('r_wa_resultado', { p_token: b.token, p_q: {}, p_b: { msg_id, ok, error: err, wa_id: id } });
  return ok ? json({ ok: true }) : json({ error: err }, 502);
}

// Aviso automático de un viaje (lo pide la base de datos al asignarse el móvil, al llegar, al cancelar o al finalizar).
// Solo lleva el id del aviso: la función lo toma una única vez con la clave de servicio.
async function aviso(b: any) {
  if (!BOT || typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.id)) return json({ ok: false }, 400);
  const { data, error } = await servicio.rpc('tg_aviso_tomar', { p_id: b.id });
  if (error) { console.error('tg_aviso_tomar', error.message); return json({ ok: false }, 500); }
  if (!data) return json({ ok: true, ya: true });
  let ok = false, err = '';
  try { await tg('sendMessage', { chat_id: data.chat_id, text: data.texto, disable_web_page_preview: true }); ok = true; }
  catch (e) { err = /blocked/i.test((e as Error).message) ? 'El cliente bloqueó el bot' : 'Telegram: ' + (e as Error).message; }
  await servicio.rpc('tg_aviso_resultado', { p_msg: data.msg_id, p_ok: ok, p_error: err || null });
  return json({ ok });
}

// Administración: estado, conectar y desconectar el webhook del bot
async function admin(b: any) {
  const chk = await anon.rpc('r_tg_admin', { p_token: b.token, p_q: {}, p_b: {} });
  if (chk.error) return json({ error: chk.error.message.includes('SESION_VENCIDA') ? 'Sesión vencida. Volvé a ingresar.' : chk.error.message }, 403);
  if (!BOT) return json({ configurado: false, error: 'Falta cargar el secreto TG_BOT_TOKEN en Supabase.' });
  try {
    const yo = await tg('getMe');
    const url = `${URL_SB.replace(/\/$/, '')}/functions/v1/telegram`;
    if (b.accion === 'conectar') {
      await tg('setWebhook', { url, secret_token: await secreto(), allowed_updates: ['message', 'edited_message'], max_connections: 10 });
      await tg('setMyCommands', { commands: [{ command: 'start', description: 'Pedir un remís' }] }).catch(() => { });
      await anon.rpc('r_tg_admin', { p_token: b.token, p_q: {}, p_b: { conectado: true, bot: yo.username } });
    }
    if (b.accion === 'desconectar') {
      await tg('deleteWebhook', {});
      await anon.rpc('r_tg_admin', { p_token: b.token, p_q: {}, p_b: { conectado: false, bot: yo.username } });
    }
    const w = await tg('getWebhookInfo');
    return json({ configurado: true, bot: yo.username, nombre: yo.first_name, conectado: w.url === url, otra_url: w.url && w.url !== url ? w.url : null,
      pendientes: w.pending_update_count ?? 0, ultimo_error: w.last_error_message ?? null, ultimo_error_fecha: w.last_error_date ?? null });
  } catch (e) { return json({ configurado: true, error: 'Telegram: ' + (e as Error).message }, 502); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let b: any; try { b = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (b.accion === 'enviar') return await enviar(b);
  if (b.accion === 'aviso') return await aviso(b);
  if (['estado', 'conectar', 'desconectar'].includes(b.accion)) return await admin(b);
  if (b.update_id !== undefined) {
    if (!BOT || req.headers.get('x-telegram-bot-api-secret-token') !== await secreto()) return new Response('Forbidden', { status: 403 });
    await entrante(b);
    return new Response('ok', { status: 200 });
  }
  return json({ error: 'Pedido no reconocido' }, 400);
});
