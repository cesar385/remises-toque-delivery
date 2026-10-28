// Edge Function "push": entrega las notificaciones push a la app del conductor.
// La base (pg_net) la llama con el id de un aviso encolado y el secreto compartido; las claves VAPID se leen de la base.
// No necesita configurar secretos en Supabase: usa SUPABASE_URL y SUPABASE_ANON_KEY, que ya vienen incluidas.
import webpush from "npm:web-push@3.6.7";

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

async function rpc(fn: string, body: unknown) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ p_token: null, p_q: {}, p_b: body }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const secreto = req.headers.get("x-push-secreto") || "";
  let id = 0;
  try { id = (await req.json()).id; } catch { /* cuerpo inválido */ }
  if (!secreto || !id) return new Response(JSON.stringify({ error: "falta id o secreto" }), { status: 400 });
  try {
    const t = await rpc("r_push_tomar", { id, secreto });
    if (!t || t.nada) return new Response(JSON.stringify({ ok: true, nada: true }));
    webpush.setVapidDetails(t.sujeto, t.publica, t.privada);
    const msg = t.msg || {};
    const vencidas: string[] = [];
    const resultado: Record<string, unknown>[] = [];
    await Promise.all((t.subs || []).map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        const r = await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(msg),
          { TTL: Number(msg.ttl) || 60, urgency: "high", topic: String(msg.tag || "rodar").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined },
        );
        resultado.push({ ok: r.statusCode });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) vencidas.push(s.endpoint);
        resultado.push({ error: code || String((e as Error).message || e).slice(0, 200) });
      }
    }));
    await rpc("r_push_resultado", { id, secreto, vencidas, resultado });
    return new Response(JSON.stringify({ ok: true, enviados: resultado.length, vencidas: vencidas.length }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500 });
  }
});
