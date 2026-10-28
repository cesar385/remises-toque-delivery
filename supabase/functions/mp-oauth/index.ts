// Remises TOQUE! – mp-oauth (incluye lo común para desplegar como un solo archivo)
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

// Vuelta del conductor después de autorizar en Mercado Pago.
// Cambia el código por sus credenciales y las guarda (solo las ve el servidor).

const volver = (q: string) => Response.redirect(`${APP_URL}/conductor.html?${q}`, 302);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return volver("mp=error&msg=" + encodeURIComponent("Se canceló la vinculación"));
  if (!MP_CLIENT_ID || !MP_CLIENT_SECRET) return volver("mp=error&msg=" + encodeURIComponent("La central todavía no terminó de configurar Mercado Pago"));

  try {
    const r = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: MP_CLIENT_ID, client_secret: MP_CLIENT_SECRET, grant_type: "authorization_code",
        code, redirect_uri: `${FUNCTIONS_URL}/mp-oauth`,
      }),
    });
    const t = await r.json();
    if (!r.ok) { console.error("OAuth", t); return volver("mp=error&msg=" + encodeURIComponent("Mercado Pago rechazó la vinculación")); }

    await rpc("mp_oauth_guardar", {
      p_state: state, p_mp_user: String(t.user_id ?? ""), p_access: t.access_token,
      p_refresh: t.refresh_token ?? null, p_public: t.public_key ?? null, p_expira: t.expires_in ?? null,
    });
    return volver("mp=vinculado");
  } catch (e) {
    return volver("mp=error&msg=" + encodeURIComponent((e as Error).message));
  }
});
