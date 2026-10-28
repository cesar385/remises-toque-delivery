// Remises TOQUE! – captcha (Cloudflare Turnstile)
// La página resuelve el desafío invisible de Turnstile y manda el token acá. Esta función lo verifica con la clave
// SECRETA (secreto TURNSTILE_SECRET, se carga en Supabase → Edge Functions → Secrets) y, si es válido, entrega un
// "pase" de un solo uso que el registro o el pedido web presentan a la base de datos.
// GET ?estado=1 → { secreto: true/false } para que el panel muestre si falta configurar el secreto.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SECRETO = Deno.env.get("TURNSTILE_SECRET") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ORIGENES = (Deno.env.get("APP_ORIGINS") ?? "https://remisestoque.com,https://remisestoque.netlify.app,https://www.remisestoque.com").split(",");
const cors = (req: Request) => {
  const o = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGENES.includes(o) || /^https?:\/\/localhost(:\d+)?$/.test(o) ? o : ORIGENES[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
};
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method === "GET") return json(req, { secreto: !!SECRETO });
  try {
    if (!SECRETO) return json(req, { error: "El captcha no está configurado (falta el secreto TURNSTILE_SECRET en Supabase)." }, 503);
    const { token, accion } = await req.json();
    if (!token || typeof token !== "string" || token.length > 4096) return json(req, { error: "Falta el captcha" }, 400);
    const acc = ["registro", "pedido"].includes(accion) ? accion : "general";
    const form = new FormData();
    form.append("secret", SECRETO); form.append("response", token);
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip) form.append("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const v = await r.json();
    if (!v.success) return json(req, { error: "No pudimos confirmar que no sos un robot. Probá de nuevo.", codigos: v["error-codes"] ?? [] }, 403);
    const { data, error } = await db.rpc("captcha_emitir", { p_accion: acc });
    if (error) throw new Error(error.message);
    return json(req, { pase: data });
  } catch (e) {
    return json(req, { error: String((e as Error)?.message ?? e) }, 500);
  }
});
