// Adaptadores de proveedores de pago para "Pagar base".
// Cada adaptador sabe hacer dos cosas:
//   crear(...)     -> crea el cobro en el proveedor y devuelve el link donde paga el conductor.
//   verificar(...) -> recibe el aviso (webhook) del proveedor, VUELVE A CONSULTAR el pago al proveedor con nuestras
//                     credenciales y devuelve el estado real. Nunca se confía en lo que trae el aviso.
// Para sumar un proveedor nuevo: escribir un adaptador acá y registrarlo en crearAdaptadores().
//
// Naranja X y Personal Pay NO están acá: al momento de escribir esto no publican una API pública para
// comercios (ver README). Se cobran por transferencia al alias/CVU de la central y se confirman a mano.

export class ErrorProveedor extends Error {
  constructor(mensaje: string, public status = 502) { super(mensaje); }
}

export interface Aviso {
  pagoId: number;               // id del pedido en rodar.mp_pagos (external_reference)
  refProveedor: string;         // id del pago/orden en el proveedor
  estado: string;               // 'approved' | 'pending' | 'rejected' (normalizado)
  monto: number;                // monto realmente cobrado
  medio: string | null;         // medio con el que se pagó
}

// descripcion y volver: para cobros de pedidos de delivery (por defecto se cobra la base del conductor).
// volver = página y hash donde vuelve el cliente al terminar de pagar, relativa a SITE_URL (ej. "delivery.html#/seguir/12/abc").
export interface Contexto { pagoId: number; monto: number; urlSb: string; site: string; descripcion?: string; volver?: string }

const titulo = (c: Contexto) => c.descripcion ?? 'Pago de base · carga #' + c.pagoId;
const vuelta = (c: Contexto, que: 'ok' | 'pendiente' | 'error') =>
  c.site + (c.volver ?? 'conductor.html#pago-' + que);

export interface Adaptador {
  id: string;
  nombre: string;
  minimo: number;               // monto mínimo que acepta el proveedor
  configurado(): boolean;
  faltante(): string;           // texto con los secretos que faltan
  crear(c: Contexto): Promise<{ url: string; ref?: string }>;
  verificar(req: Request, cuerpo: any): Promise<Aviso | null>; // null = aviso que se ignora
}

type Env = (k: string) => string | undefined;
type Fetch = typeof fetch;

async function json(res: Response) { try { return await res.json(); } catch { return {}; } }

// ---------------------------------------------------------------- Mercado Pago
function mercadoPago(env: Env, f: Fetch): Adaptador {
  const MP = () => env('MP_ACCESS_TOKEN') ?? '';
  return {
    id: 'mercadopago', nombre: 'Mercado Pago', minimo: 1,
    configurado: () => !!MP(),
    faltante: () => 'MP_ACCESS_TOKEN',
    async crear(c) {
      const pref: Record<string, unknown> = {
        items: [{ title: titulo(c), quantity: 1, unit_price: c.monto, currency_id: 'ARS' }],
        external_reference: String(c.pagoId),
        notification_url: `${c.urlSb}/functions/v1/pagos?p=mercadopago`,
        statement_descriptor: 'REMISES',
      };
      if (c.site) {
        pref.back_urls = { success: vuelta(c, 'ok'), pending: vuelta(c, 'pendiente'), failure: vuelta(c, 'error') };
        pref.auto_return = 'approved';
      }
      const res = await f('https://api.mercadopago.com/checkout/preferences', { method: 'POST', headers: { Authorization: `Bearer ${MP()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(pref) });
      const j = await json(res);
      if (!res.ok) throw new ErrorProveedor('Mercado Pago rechazó el pedido: ' + (j.message ?? res.status));
      return { url: j.init_point };
    },
    async verificar(req, cuerpo) {
      const u = new URL(req.url);
      const tipo = cuerpo?.type ?? cuerpo?.topic ?? u.searchParams.get('type') ?? u.searchParams.get('topic');
      const id = cuerpo?.data?.id ?? u.searchParams.get('data.id') ?? u.searchParams.get('id');
      if (tipo !== 'payment' || !id) return null;
      const res = await f(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${MP()}` } });
      if (!res.ok) throw new ErrorProveedor('no se pudo verificar', 502); // MP reintenta
      const p = await res.json();
      const pagoId = Number(p.external_reference);
      if (!pagoId) return null;
      return { pagoId, refProveedor: String(p.id), estado: String(p.status), monto: Number(p.transaction_amount), medio: p.payment_method_id ?? null };
    },
  };
}

// ---------------------------------------------------------------- Ualá Bis (API v2)
// Docs: https://developers.ualabis.com.ar/v2   (la v1 se depreca el 31/12/2026)
// Secretos: UALA_USER, UALA_CLIENT_ID, UALA_CLIENT_SECRET
// Opcionales: UALA_ENV=stage para pruebas; UALA_AUTH_URL / UALA_API_URL para forzar otras direcciones.
// El aviso de Ualá no trae firma: por eso se consulta la orden con nuestro token antes de acreditar.
function uala(env: Env, f: Fetch): Adaptador {
  const AUTH = () => env('UALA_AUTH_URL') ?? 'https://auth.developers.ar.ua.la/v2/api/auth/token';
  const API = () => (env('UALA_API_URL') ?? (env('UALA_ENV') === 'stage' ? 'https://checkout.stage.developers.ar.ua.la/v2/api' : 'https://checkout.developers.ar.ua.la/v2/api')).replace(/\/$/, '');
  const ok = () => !!(env('UALA_USER') && env('UALA_CLIENT_ID') && env('UALA_CLIENT_SECRET'));

  async function token(): Promise<string> {
    const res = await f(AUTH(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: env('UALA_USER'), client_id: env('UALA_CLIENT_ID'), client_secret_id: env('UALA_CLIENT_SECRET'), grant_type: 'client_credentials' }) });
    const j = await json(res);
    const t = j.access_token ?? j.token;
    if (!res.ok || !t) throw new ErrorProveedor('Ualá no aceptó las credenciales: ' + (j.message ?? j.error ?? res.status));
    return t;
  }
  const estado = (s: string) => ({ APPROVED: 'approved', REJECTED: 'rejected' } as Record<string, string>)[s] ?? 'pending'; // PROCESSED = falta el desembolso: todavía no se acredita

  return {
    id: 'uala', nombre: 'Ualá', minimo: 25,
    configurado: ok,
    faltante: () => 'UALA_USER, UALA_CLIENT_ID y UALA_CLIENT_SECRET',
    async crear(c) {
      if (!c.site) throw new ErrorProveedor('Ualá exige direcciones de retorno: falta el secreto SITE_URL.', 503);
      const res = await f(API() + '/checkout', {
        method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: c.monto.toFixed(2), // Ualá espera el monto como texto
          description: titulo(c),
          callback_success: vuelta(c, 'ok'),
          callback_fail: vuelta(c, 'error'),
          notification_url: `${c.urlSb}/functions/v1/pagos?p=uala`,
          external_reference: String(c.pagoId),
        }),
      });
      const j = await json(res);
      if (!res.ok || !j.links?.checkout_link) throw new ErrorProveedor('Ualá rechazó el pedido: ' + (j.message ?? j.error ?? res.status));
      return { url: j.links.checkout_link, ref: j.uuid };
    },
    async verificar(_req, cuerpo) {
      const uuid = cuerpo?.uuid;
      if (!uuid || cuerpo?.status === undefined) return null; // ignora avisos de reembolso sin orden
      const res = await f(`${API()}/orders/${encodeURIComponent(uuid)}`, { headers: { Authorization: `Bearer ${await token()}` } });
      if (!res.ok) throw new ErrorProveedor('no se pudo verificar', 502); // Ualá reintenta hasta 4 veces
      const o = await res.json();
      const pagoId = Number(o.external_reference);
      if (!pagoId) return null;
      return { pagoId, refProveedor: String(o.uuid), estado: estado(String(o.status)), monto: Number(o.amount), medio: 'uala' };
    },
  };
}

export function crearAdaptadores(env: Env = (k) => Deno.env.get(k), f: Fetch = fetch): Record<string, Adaptador> {
  const lista = [mercadoPago(env, f), uala(env, f)];
  return Object.fromEntries(lista.map((a) => [a.id, a]));
}
