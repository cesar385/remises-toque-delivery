// Remises TOQUE! – mp-pagar (incluye lo común para desplegar como un solo archivo)
import { createClient } from "jsr:@supabase/supabase-js@2";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
export const APP_URL = (Deno.env.get("APP_URL") ?? "https://remisestoque.com").replace(/\/$/, "");
export const MP_CLIENT_ID = Deno.env.get("MP_CLIENT_ID") ?? "";
export const MP_CLIENT_SECRET = Deno.env.get("MP_CLIENT_SECRET") ?? "";
export const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";

export const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

export async function rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// El pasajero toca "Pagar con Mercado Pago" al terminar el viaje.
// Crea la preferencia con el token del CONDUCTOR (el dinero va a su cuenta) y
// marketplace_fee = día de base / cargos que le debe a la central.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { id, k } = await req.json();
    if (!id || !k) return json({ error: "Faltan datos del viaje" }, 400);

    const p = await rpc("mp_preparar_pago", { p_viaje: Number(id), p_k: String(k) });
    if (p.ya_pagado) return json({ ya_pagado: true });

    let token: string = p.access_token;
    if (!token) return json({ error: "La central todavía no vinculó Mercado Pago" }, 400);

    // Renueva el token del conductor si vence en menos de 7 días
    if (p.directo && p.refresh_token && p.vence && new Date(p.vence).getTime() - Date.now() < 7 * 86400e3) {
      const r = await fetch("https://api.mercadopago.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: MP_CLIENT_ID, client_secret: MP_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: p.refresh_token }),
      });
      if (r.ok) {
        const t = await r.json();
        token = t.access_token;
        await rpc("mp_token_renovado", { p_usuario: p.conductor_id, p_access: t.access_token, p_refresh: t.refresh_token ?? null, p_expira: t.expires_in ?? null });
      }
    }

    const volver = `${APP_URL}/pasajero.html?viaje=${id}&k=${encodeURIComponent(k)}`; // pasajero.html lo pasa al seguimiento
    const pref: Record<string, unknown> = {
      items: [{ id: `viaje-${id}`, title: `Remises TOQUE! - ${p.descripcion}`, quantity: 1, unit_price: Number(p.monto), currency_id: "ARS" }],
      external_reference: `viaje-${id}-pago-${p.pago_id}`,
      notification_url: `${FUNCTIONS_URL}/mp-webhook?pago=${p.pago_id}`,
      back_urls: { success: `${volver}&pago=ok`, pending: `${volver}&pago=pendiente`, failure: `${volver}&pago=error` },
      auto_return: "approved",
      statement_descriptor: "REMISES TOQUE",
      payment_methods: { installments: 1 },
    };
    if (p.directo && Number(p.fee) > 0) pref.marketplace_fee = Number(p.fee);

    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Idempotency-Key": `pref-${p.pago_id}-${Date.now()}` },
      body: JSON.stringify(pref),
    });
    const out = await r.json();
    if (!r.ok) {
      console.error("MP preferencia", out);
      return json({ error: "Mercado Pago no pudo generar el cobro. Pagale al conductor en efectivo o probá de nuevo." }, 502);
    }
    await rpc("mp_guardar_preferencia", { p_pago: p.pago_id, p_pref: out.id });

    return json({ init_point: out.init_point, monto: p.monto, conductor: p.conductor, directo: p.directo });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
