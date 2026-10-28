// Edge Function "subir-video": permite al administrador subir un video (mp4/webm/mov, hasta 50 MB) para la página principal.
// 1) Verifica con la base (r_video_permiso) que el token sea de un administrador.
// 2) Devuelve una dirección firmada de un solo uso para subir el archivo directo al bucket público "videos".
// Usa SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY, que Supabase ya incluye en las funciones.
const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const TIPOS: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const MAX = 50 * 1024 * 1024;
const resp = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ error: "Método no permitido" }, 405);
  let d: { token?: string; nombre?: string; tipo?: string; tam?: number } = {};
  try { d = await req.json(); } catch { return resp({ error: "Pedido inválido" }, 400); }
  const ext = TIPOS[String(d.tipo || "")];
  if (!d.token) return resp({ error: "Iniciá sesión como administrador" }, 401);
  if (!ext) return resp({ error: "El archivo tiene que ser un video MP4, WebM o MOV" }, 400);
  if (!(Number(d.tam) > 0) || Number(d.tam) > MAX) return resp({ error: "El video supera los 50 MB. Acortalo o bajale la calidad y probá de nuevo." }, 400);
  // ¿es administrador?
  const p = await fetch(`${URL_BASE}/rest/v1/rpc/r_video_permiso`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ p_token: d.token, p_q: {}, p_b: { nombre: d.nombre || "" } }),
  });
  if (!p.ok) { const t = await p.text(); let m = "Sin permiso"; try { m = JSON.parse(t).message || m; } catch { /* */ } return resp({ error: m }, 403); }
  const ruta = `landing/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const s = await fetch(`${URL_BASE}/storage/v1/object/upload/sign/videos/${ruta}`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}` }, body: "{}",
  });
  const j = await s.json().catch(() => ({}));
  if (!s.ok || !j.url) return resp({ error: "No se pudo preparar la subida: " + (j.message || j.error || s.status) }, 500);
  const token = new URL(j.url, URL_BASE).searchParams.get("token");
  return resp({ subir: `${URL_BASE}/storage/v1/object/upload/sign/videos/${ruta}?token=${token}`, publica: `${URL_BASE}/storage/v1/object/public/videos/${ruta}`, ruta });
});
