// Función de Supabase: "Pagar base" con Mercado Pago y acreditación automática.
//  - POST del panel / app del conductor {accion:'crear', token, monto, movil_id?}: crea el pedido de pago y devuelve el link de Mercado Pago.
//  - POST de Mercado Pago (webhook): al aprobarse el pago lo verifica contra la API de MP y lo acredita en la cuenta del móvil.
// Secretos: MP_ACCESS_TOKEN (Mercado Pago → Tus integraciones → Credenciales de producción), RODAR_WEBHOOK_TOKEN
// Opcional: SITE_URL (dirección de tu página, ej. https://usuario.github.io/central/) para volver a la app después de pagar.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const sb = createClient(URL_SB, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
const MP = Deno.env.get('MP_ACCESS_TOKEN') ?? '';
const WEBHOOK = Deno.env.get('RODAR_WEBHOOK_TOKEN') ?? '';
const SITE = (Deno.env.get('SITE_URL') ?? '').replace(/\/?$/, '/');

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function crear(b: any) {
  if (!MP) return json({ error: 'Mercado Pago no está configurado en Supabase (falta el secreto MP_ACCESS_TOKEN).' }, 503);
  const monto = Number(b.monto);
  if (!(monto >= 1) || monto > 5000000) return json({ error: 'Monto inválido' }, 400);
  // r_cargar_saldo valida la sesión y que el usuario tenga permiso sobre el móvil, y registra el pago como pendiente
  const r = await sb.rpc('r_cargar_saldo', { p_token: b.token, p_q: {}, p_b: { monto, movil_id: b.movil_id } });
  if (r.error) return json({ error: r.error.message.includes('SESION_VENCIDA') ? 'Sesión vencida. Volvé a ingresar.' : r.error.message }, 400);
  const pagoId = r.data.id;
  const pref: Record<string, unknown> = {
    items: [{ title: 'Pago de base · carga #' + pagoId, quantity: 1, unit_price: monto, currency_id: 'ARS' }],
    external_reference: String(pagoId),
    notification_url: `${URL_SB}/functions/v1/mercadopago`,
    statement_descriptor: 'REMISES',
  };
  if (SITE) { pref.back_urls = { success: SITE + 'conductor.html#pago-ok', pending: SITE + 'conductor.html#pago-pendiente', failure: SITE + 'conductor.html#pago-error' }; pref.auto_return = 'approved'; }
  const res = await fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST', headers: { Authorization: `Bearer ${MP}`, 'Content-Type': 'application/json' }, body: JSON.stringify(pref) });
  const j = await res.json();
  if (!res.ok) return json({ error: 'Mercado Pago rechazó el pedido: ' + (j.message ?? res.status) }, 502);
  return json({ ok: true, id: pagoId, url: j.init_point });
}

async function notificacion(req: Request, cuerpo: any) {
  const u = new URL(req.url);
  const tipo = cuerpo?.type ?? cuerpo?.topic ?? u.searchParams.get('type') ?? u.searchParams.get('topic');
  const id = cuerpo?.data?.id ?? u.searchParams.get('data.id') ?? u.searchParams.get('id');
  if (tipo !== 'payment' || !id) return new Response('ignorado', { status: 200 });
  // El pago se vuelve a consultar a Mercado Pago con nuestro token: no se confía en lo que llega en el aviso.
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${MP}` } });
  if (!res.ok) return new Response('no se pudo verificar', { status: 502 }); // MP reintenta
  const p = await res.json();
  const pagoId = Number(p.external_reference);
  if (!pagoId) return new Response('sin referencia', { status: 200 });
  const r = await sb.rpc('webhook_mp', { token: WEBHOOK, pago_id: pagoId, pago_mp_id: String(p.id), monto_pagado: p.transaction_amount, estado_mp: p.status, medio_mp: p.payment_method_id ?? null });
  if (r.error) { console.error('webhook_mp', r.error.message); return new Response('error', { status: 500 }); }
  return new Response('ok', { status: 200 });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const txt = await req.text(); let b: any = {}; try { b = txt ? JSON.parse(txt) : {}; } catch { /* el aviso de MP puede venir solo con parámetros */ }
  if (b.accion === 'crear') return await crear(b);
  return await notificacion(req, b);
});
