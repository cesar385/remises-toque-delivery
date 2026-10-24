// Manejador común de la función "pagos" (y del alias "mercadopago" que se mantiene por compatibilidad).
//  - POST {accion:'crear', proveedor, token, monto, movil_id?}: crea el pedido y devuelve el link de pago del proveedor.
//  - POST {accion:'crear_pedido', proveedor, id, k}: el cliente paga online un pedido de delivery (sin cuenta: el enlace de seguimiento id+k lo identifica).
//  - POST {accion:'proveedores'}: lista los proveedores con credenciales cargadas (los que se acreditan solos).
//  - POST del proveedor (webhook, ?p=<proveedor>): verifica el pago contra su API y lo acredita en la cuenta del móvil.
import { type Adaptador, ErrorProveedor } from './adaptadores.ts';

export interface Deps {
  adaptadores: Record<string, Adaptador>;
  rpc: (nombre: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;
  urlSb: string;
  webhookToken: string;
  site: string;                 // dirección de la página, termina en "/"
  proveedorPorDefecto: string;  // para avisos viejos que no traen ?p=
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export function crearManejador(d: Deps) {
  async function crear(b: any) {
    const a = d.adaptadores[String(b.proveedor ?? 'mercadopago')];
    if (!a) return json({ error: 'Ese medio de pago no se acredita automáticamente.', noAutomatico: true }, 400);
    if (!a.configurado()) return json({ error: `${a.nombre} no está configurado en Supabase (falta ${a.faltante()}).` }, 503);
    const monto = Number(b.monto);
    if (!(monto >= a.minimo) || monto > 5000000) return json({ error: a.minimo > 1 ? `Monto inválido (mínimo $${a.minimo} en ${a.nombre})` : 'Monto inválido' }, 400);
    // r_cargar_saldo valida la sesión y el permiso sobre el móvil, y registra el pedido como pendiente
    const r = await d.rpc('r_cargar_saldo', { p_token: b.token, p_q: {}, p_b: { monto, movil_id: b.movil_id, proveedor: a.id } });
    if (r.error) return json({ error: r.error.message.includes('SESION_VENCIDA') ? 'Sesión vencida. Volvé a ingresar.' : r.error.message }, 400);
    try {
      const y = await a.crear({ pagoId: r.data.id, monto, urlSb: d.urlSb, site: d.site });
      return json({ ok: true, id: r.data.id, url: y.url, proveedor: a.id });
    } catch (e) {
      if (e instanceof ErrorProveedor) return json({ error: e.message }, e.status);
      throw e;
    }
  }

  async function crearPedido(b: any) {
    const a = d.adaptadores[String(b.proveedor ?? 'mercadopago')];
    if (!a) return json({ error: 'Ese medio de pago no se acredita automáticamente.', noAutomatico: true }, 400);
    if (!a.configurado()) return json({ error: `${a.nombre} no está configurado en Supabase (falta ${a.faltante()}).` }, 503);
    // r_dlv_pub_pagar valida la firma del pedido, que siga sin pagar y a tiempo, y registra el cobro como pendiente
    const r = await d.rpc('r_dlv_pub_pagar', { p_token: null, p_q: { id: b.id, k: b.k }, p_b: { proveedor: a.id } });
    if (r.error) return json({ error: r.error.message }, 400);
    const monto = Number(r.data.monto);
    if (!(monto >= a.minimo)) return json({ error: `El monto mínimo para pagar con ${a.nombre} es $${a.minimo}. Elegí otra forma de pago.` }, 400);
    try {
      const y = await a.crear({ pagoId: r.data.pago_id, monto, urlSb: d.urlSb, site: d.site, descripcion: r.data.descripcion, volver: r.data.volver });
      return json({ ok: true, id: r.data.pago_id, url: y.url, proveedor: a.id });
    } catch (e) {
      if (e instanceof ErrorProveedor) return json({ error: e.message }, e.status);
      throw e;
    }
  }

  async function notificacion(req: Request, cuerpo: any) {
    const prov = new URL(req.url).searchParams.get('p') ?? d.proveedorPorDefecto;
    const a = d.adaptadores[prov];
    if (!a) return new Response('proveedor desconocido', { status: 200 });
    let av;
    try { av = await a.verificar(req, cuerpo); }
    catch (e) { if (e instanceof ErrorProveedor) return new Response(e.message, { status: e.status }); throw e; }
    if (!av) return new Response('ignorado', { status: 200 });
    const r = await d.rpc('webhook_pago', { token: d.webhookToken, pago_id: av.pagoId, prov: a.id, ref_prov: av.refProveedor, monto_pagado: av.monto, estado_prov: av.estado, medio_prov: av.medio });
    if (r.error) { console.error('webhook_pago', r.error.message); return new Response('error', { status: 500 }); }
    return new Response('ok', { status: 200 });
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const txt = await req.text(); let b: any = {};
    try { b = txt ? JSON.parse(txt) : {}; } catch { /* el aviso puede venir solo con parámetros */ }
    if (b.accion === 'crear') return await crear(b);
    if (b.accion === 'crear_pedido') return await crearPedido(b);
    if (b.accion === 'proveedores') return json({ proveedores: Object.values(d.adaptadores).filter((a) => a.configurado()).map((a) => a.id) });
    return await notificacion(req, b);
  };
}
