// Central de clientes – saas-mp
// Cobro mensual automático de la suscripción de cada remisería con Mercado Pago (Suscripciones / preapproval).
//
//  · POST {accion:"suscripcion", token, cliente_id}  → crea el link de suscripción (lo pide superadmin.html)
//  · POST {accion:"cancelar", token, cliente_id}     → cancela la suscripción en Mercado Pago
//  · Avisos de Mercado Pago (webhook)                → registran cada cobro aprobado y los cambios de estado
//
// Secretos (Supabase → Edge Functions → Secrets):
//  MP_SAAS_ACCESS_TOKEN    Access token de producción de TU cuenta de Mercado Pago (la que cobra).
//  MP_SAAS_WEBHOOK_SECRET  (opcional) Clave secreta de los avisos, para validar que vienen de Mercado Pago.
//  APP_URL                 (opcional) Dirección del sitio, por defecto https://remisestoque.com
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const APP_URL = (Deno.env.get("APP_URL") ?? "https://remisestoque.com").replace(/\/$/, "");
const MP_TOKEN = Deno.env.get("MP_SAAS_ACCESS_TOKEN") ?? "";
const MP_WEBHOOK_SECRET = Deno.env.get("MP_SAAS_WEBHOOK_SECRET") ?? "";
const MP = "https://api.mercadopago.com";
const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

async function mp(path: string, init: RequestInit = {}) {
  const r = await fetch(MP + path, {
    ...init,
    headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const txt = await r.text();
  let j: any = {}; try { j = JSON.parse(txt); } catch { /* respuesta no JSON */ }
  if (!r.ok) throw new Error(j?.message || j?.error || `Mercado Pago respondió ${r.status}`);
  return j;
}

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const slugDe = (ref: unknown) => { const s = String(ref ?? ""); return s.startsWith("saas-") ? s.slice(5) : null; };
const fechaDe = (iso: unknown) => (iso ? String(iso).slice(0, 10) : null);

// ---------- pedidos del panel de superadministrador ----------
async function suscripcion(token: string, clienteId: number) {
  const c = await rpc("saas_mp_datos", { p_token: token, p_id: clienteId });
  // Si ya había una suscripción pendiente o activa, se cancela para no cobrar dos veces.
  if (c.preapproval) {
    try { await mp(`/preapproval/${encodeURIComponent(c.preapproval)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) }); }
    catch (e) { console.warn("No se pudo cancelar la suscripción anterior", c.preapproval, String(e)); }
  }
  const auto: Record<string, unknown> = {
    frequency: 1, frequency_type: "months", transaction_amount: Number(c.precio), currency_id: "ARS",
  };
  // Si todavía está en prueba o tiene meses pagos, el primer débito es al terminar ese período.
  if (c.inicio) auto.start_date = new Date(`${c.inicio}T12:00:00-03:00`).toISOString();
  const pre = await mp("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: `Sistema de remises · Plan ${c.plan ?? ""} · ${c.nombre}`.slice(0, 120),
      external_reference: `saas-${c.slug}`,
      payer_email: c.email,
      auto_recurring: auto,
      back_url: `${APP_URL}/suscripcion-lista.html`,
      status: "pending",
    }),
  });
  return await rpc("saas_mp_guardar", { p_id: clienteId, p_preapproval: pre.id, p_link: pre.init_point, p_estado: pre.status, p_admin: c.admin });
}

async function cancelar(token: string, clienteId: number) {
  const c = await rpc("saas_mp_datos", { p_token: token, p_id: clienteId });
  if (!c.preapproval) throw new Error("Este cliente no tiene una suscripción de Mercado Pago.");
  await mp(`/preapproval/${encodeURIComponent(c.preapproval)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  return await rpc("saas_mp_guardar", { p_id: clienteId, p_preapproval: c.preapproval, p_link: null, p_estado: "cancelled", p_admin: c.admin });
}

// ---------- avisos de Mercado Pago ----------
async function aviso(req: Request, url: URL, body: any) {
  const tipo = String(url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? body.topic ?? "");
  const id = String(url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? body?.data?.id ?? "");
  if (!id) return json({ ok: true, ignorado: true });

  if (MP_WEBHOOK_SECRET) {
    const partes = Object.fromEntries((req.headers.get("x-signature") ?? "").split(",").map((s) => s.trim().split("=")));
    const manifest = `id:${id.toLowerCase()};request-id:${req.headers.get("x-request-id") ?? ""};ts:${partes.ts};`;
    if (!partes.v1 || (await hmacHex(MP_WEBHOOK_SECRET, manifest)) !== partes.v1) {
      console.warn("Firma inválida", { tipo, id });
      return json({ error: "firma inválida" }, 401);
    }
  }

  // Nunca se confía en el aviso: se consulta el dato real en Mercado Pago.
  if (tipo === "subscription_preapproval" || tipo === "preapproval") {
    const pre = await mp(`/preapproval/${encodeURIComponent(id)}`);
    await rpc("saas_mp_estado", { p_preapproval: pre.id, p_estado: pre.status, p_slug: slugDe(pre.external_reference) });
    return json({ ok: true });
  }

  if (tipo === "subscription_authorized_payment" || tipo === "authorized_payment") {
    const ap = await mp(`/authorized_payments/${encodeURIComponent(id)}`);
    const pago = ap.payment ?? {};
    if (pago.status !== "approved" || !pago.id) return json({ ok: true, estado: pago.status ?? ap.status });
    const r = await rpc("saas_mp_pago", {
      p_preapproval: ap.preapproval_id ?? null, p_slug: slugDe(ap.external_reference), p_pago: String(pago.id),
      p_monto: Number(ap.transaction_amount ?? pago.transaction_amount), p_fecha: fechaDe(ap.debit_date ?? ap.date_created),
    });
    return json(r);
  }

  if (tipo === "payment") {
    const pay = await mp(`/v1/payments/${encodeURIComponent(id)}`);
    const slug = slugDe(pay.external_reference);
    const pre = pay.metadata?.preapproval_id ?? pay.point_of_interaction?.transaction_data?.subscription_id ?? null;
    if (!slug && !pre) return json({ ok: true, ignorado: true });   // no es de una suscripción del sistema
    if (pay.status !== "approved") return json({ ok: true, estado: pay.status });
    const r = await rpc("saas_mp_pago", {
      p_preapproval: pre, p_slug: slug, p_pago: String(pay.id), p_monto: Number(pay.transaction_amount),
      p_fecha: fechaDe(pay.date_approved ?? pay.date_created),
    });
    return json(r);
  }

  return json({ ok: true, ignorado: true, tipo });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  let body: any = {};
  try { body = await req.json(); } catch { /* los avisos pueden venir sin cuerpo */ }

  try {
    if (body?.accion === "suscripcion" || body?.accion === "cancelar") {
      if (!MP_TOKEN) return json({ error: "Falta cargar MP_SAAS_ACCESS_TOKEN en los secretos de Supabase (Edge Functions → Secrets)." }, 400);
      const id = Number(body.cliente_id);
      if (!body.token || !id) return json({ error: "Faltan datos." }, 400);
      const r = body.accion === "suscripcion" ? await suscripcion(String(body.token), id) : await cancelar(String(body.token), id);
      return json({ ok: true, cliente: r });
    }
    if (!MP_TOKEN) { console.error("Aviso recibido sin MP_SAAS_ACCESS_TOKEN configurado"); return json({ ok: false }, 500); }
    return await aviso(req, url, body);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).replace(/^Error: /, "");
    console.error("saas-mp", msg);
    return json({ error: /SESION_VENCIDA/.test(msg) ? "Tu sesión venció. Volvé a ingresar." : msg }, 400);
  }
});
