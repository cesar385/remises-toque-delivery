// Remises TOQUE! – mp-webhook (incluye lo común para desplegar como un solo archivo)
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

// Aviso de Mercado Pago. Valida la firma, consulta el pago en Mercado Pago
// (nunca se confía en lo que llega en el aviso) y marca el viaje como pagado.

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  let body: any = {};
  try { body = await req.json(); } catch { /* algunos avisos vienen sin cuerpo */ }

  const tipo = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? body.topic;
  const dataId = String(url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? body?.data?.id ?? "");
  const pagoId = Number(url.searchParams.get("pago"));

  // Validación de origen (x-signature: "ts=...,v1=...")
  if (MP_WEBHOOK_SECRET) {
    const partes = Object.fromEntries((req.headers.get("x-signature") ?? "").split(",").map((s) => s.trim().split("=")));
    const manifest = `id:${dataId.toLowerCase()};request-id:${req.headers.get("x-request-id") ?? ""};ts:${partes.ts};`;
    if (!partes.v1 || (await hmacHex(MP_WEBHOOK_SECRET, manifest)) !== partes.v1) {
      console.warn("Firma inválida", { dataId, pagoId });
      return json({ error: "firma inválida" }, 401);
    }
  }

  if (tipo !== "payment" || !dataId || !pagoId) return json({ ok: true, ignorado: true });

  try {
    const info = await rpc("mp_token_pago", { p_pago: pagoId });
    if (!info?.access_token) return json({ ok: true, sin_token: true });
    if (info.estado === "pagado") return json({ ok: true, ya: true });

    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, { headers: { Authorization: `Bearer ${info.access_token}` } });
    if (!r.ok) { console.error("No se pudo consultar el pago", dataId, await r.text()); return json({ ok: false }, 500); }
    const pay = await r.json();

    if (!String(pay.external_reference ?? "").endsWith(`-pago-${pagoId}`)) {
      console.warn("Referencia que no corresponde", pay.external_reference, pagoId);
      return json({ ok: true, ignorado: true });
    }
    const fee = (pay.fee_details ?? []).filter((f: any) => f.type === "application_fee").reduce((s: number, f: any) => s + Number(f.amount), 0);

    const res = await rpc("mp_confirmar", {
      p_pago: pagoId, p_mp_id: String(pay.id), p_estado: pay.status, p_monto: Number(pay.transaction_amount),
      p_medio: pay.payment_method_id ?? null, p_fee: info.directo && fee > 0 ? fee : null,
    });
    // comisión real que descontó Mercado Pago (se muestra en Viajes cobrados por Mercado Pago)
    const comMp = (pay.fee_details ?? []).filter((f: any) => f.type !== "application_fee").reduce((s: number, f: any) => s + Number(f.amount), 0);
    if (pay.status === "approved" && comMp > 0) await rpc("mp_comision", { p_pago: pagoId, p_comision: comMp }).catch((e) => console.error("mp_comision", (e as Error).message));
    return json(res);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500); // Mercado Pago reintenta
  }
});
