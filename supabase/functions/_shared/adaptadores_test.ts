// Pruebas de los adaptadores y del manejador, sin red: se simulan fetch y la base.
// Ejecutar:  deno test supabase/functions/_shared/
import { crearAdaptadores } from './adaptadores.ts';
import { crearManejador } from './handler.ts';

function igual(a: unknown, b: unknown, m = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}\n  esperado: ${JSON.stringify(b)}\n  obtenido: ${JSON.stringify(a)}`); }
function cierto(c: unknown, m = '') { if (!c) throw new Error('falló: ' + m); }

type Llamada = { url: string; method: string; headers: Record<string, string>; body: any };
function falsoFetch(respuestas: Array<[RegExp, number, unknown]>) {
  const llamadas: Llamada[] = [];
  const f = ((url: string, init: RequestInit = {}) => {
    llamadas.push({ url: String(url), method: init.method ?? 'GET', headers: (init.headers ?? {}) as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const r = respuestas.find(([re]) => re.test(String(url)));
    if (!r) return Promise.resolve(new Response('{}', { status: 404 }));
    return Promise.resolve(new Response(JSON.stringify(r[2]), { status: r[1] }));
  }) as typeof fetch;
  return { f, llamadas };
}
const ENV_UALA = { UALA_USER: 'u', UALA_CLIENT_ID: 'cid', UALA_CLIENT_SECRET: 'sec' };
const env = (o: Record<string, string>) => (k: string) => o[k];

Deno.test('Ualá: crea la orden con token, monto como texto y callbacks', async () => {
  const { f, llamadas } = falsoFetch([[/auth\/token/, 200, { access_token: 'TKN' }], [/\/checkout$/, 200, { uuid: 'U-1', links: { checkout_link: 'https://uala/pagar' } }]]);
  const a = crearAdaptadores(env(ENV_UALA), f).uala;
  const r = await a.crear({ pagoId: 12, monto: 1000, urlSb: 'https://x.supabase.co', site: 'https://s.io/central/' });
  igual(r, { url: 'https://uala/pagar', ref: 'U-1' });
  igual(llamadas[0].body, { username: 'u', client_id: 'cid', client_secret_id: 'sec', grant_type: 'client_credentials' }, 'auth');
  igual(llamadas[1].headers.Authorization, 'Bearer TKN');
  igual(llamadas[1].url, 'https://checkout.developers.ar.ua.la/v2/api/checkout');
  igual(llamadas[1].body.amount, '1000.00', 'monto como texto con 2 decimales');
  igual(llamadas[1].body.external_reference, '12');
  igual(llamadas[1].body.notification_url, 'https://x.supabase.co/functions/v1/pagos?p=uala');
  igual(llamadas[1].body.callback_success, 'https://s.io/central/conductor.html#pago-ok');
});

Deno.test('Ualá: sin SITE_URL avisa en vez de mandar callbacks vacíos', async () => {
  const { f } = falsoFetch([]);
  let msg = ''; try { await crearAdaptadores(env(ENV_UALA), f).uala.crear({ pagoId: 1, monto: 100, urlSb: 'u', site: '' }); } catch (e) { msg = (e as Error).message; }
  cierto(msg.includes('SITE_URL'), msg);
});

Deno.test('Ualá: el estado sale de la orden consultada, no del aviso', async () => {
  const mk = (estadoOrden: string) => falsoFetch([[/auth\/token/, 200, { access_token: 'T' }], [/orders\/U-1$/, 200, { uuid: 'U-1', external_reference: '7', amount: 1000, status: estadoOrden }]]);
  for (const [orden, esperado] of [['APPROVED', 'approved'], ['REJECTED', 'rejected'], ['PROCESSED', 'pending'], ['PENDING', 'pending']]) {
    const { f } = mk(orden);
    const av = await crearAdaptadores(env(ENV_UALA), f).uala.verificar(new Request('https://x'), { uuid: 'U-1', status: 'APPROVED' }); // el aviso miente: dice APPROVED
    igual(av?.estado, esperado, `orden ${orden}`);
    igual(av?.pagoId, 7); igual(av?.monto, 1000); igual(av?.refProveedor, 'U-1');
  }
});

Deno.test('Ualá: avisos sin uuid se ignoran', async () => {
  const { f, llamadas } = falsoFetch([]);
  igual(await crearAdaptadores(env(ENV_UALA), f).uala.verificar(new Request('https://x'), {}), null);
  igual(llamadas.length, 0);
});

Deno.test('Mercado Pago: crea la preferencia y verifica el pago consultándolo', async () => {
  const { f, llamadas } = falsoFetch([[/checkout\/preferences/, 201, { init_point: 'https://mp/pagar' }], [/v1\/payments\/55/, 200, { id: 55, external_reference: '12', status: 'approved', transaction_amount: 100, payment_method_id: 'visa' }]]);
  const a = crearAdaptadores(env({ MP_ACCESS_TOKEN: 'MPT' }), f).mercadopago;
  igual((await a.crear({ pagoId: 12, monto: 100, urlSb: 'https://x.supabase.co', site: '' })).url, 'https://mp/pagar');
  igual(llamadas[0].body.notification_url, 'https://x.supabase.co/functions/v1/pagos?p=mercadopago');
  cierto(llamadas[0].body.back_urls === undefined, 'sin site no manda back_urls');
  igual(await a.verificar(new Request('https://x/?p=mercadopago'), { type: 'payment', data: { id: '55' } }), { pagoId: 12, refProveedor: '55', estado: 'approved', monto: 100, medio: 'visa' });
  igual(await a.verificar(new Request('https://x'), { type: 'merchant_order', data: { id: '1' } }), null);
});

function manejador(envv: Record<string, string>, f: typeof fetch, rpcs: Array<[string, any]>, montoPedido: number | null = 16378) {
  const adaptadores = crearAdaptadores(env(envv), f);
  return crearManejador({
    adaptadores, urlSb: 'https://x.supabase.co', webhookToken: 'WH', site: 'https://s.io/central/', proveedorPorDefecto: 'mercadopago',
    rpc: (nombre, args) => {
      rpcs.push([nombre, args]);
      if (nombre === 'r_cargar_saldo') return Promise.resolve({ data: { id: 33 }, error: null });
      if (nombre === 'r_dlv_pub_pagar') return Promise.resolve(montoPedido === null ? { data: null, error: { message: 'El tiempo para pagar este pedido venció' } }
        : { data: { pago_id: 77, monto: montoPedido, descripcion: 'Pedido #AB12 · La Esquina', volver: 'delivery.html#/seguir/5/abc' }, error: null });
      return Promise.resolve({ data: { ok: true }, error: null });
    },
  });
}
const post = (cuerpo: unknown, url = 'https://x/functions/v1/pagos') => new Request(url, { method: 'POST', body: JSON.stringify(cuerpo) });

Deno.test('Manejador: crear con Ualá registra el pedido con el proveedor y devuelve el link', async () => {
  const rpcs: Array<[string, any]> = [];
  const { f } = falsoFetch([[/auth\/token/, 200, { access_token: 'T' }], [/\/checkout$/, 200, { uuid: 'U', links: { checkout_link: 'https://uala/pagar' } }]]);
  const res = await manejador(ENV_UALA, f, rpcs)(post({ accion: 'crear', proveedor: 'uala', token: 'tk', monto: 500, movil_id: 4 }));
  igual(res.status, 200); igual((await res.json()).url, 'https://uala/pagar');
  igual(rpcs[0], ['r_cargar_saldo', { p_token: 'tk', p_q: {}, p_b: { monto: 500, movil_id: 4, proveedor: 'uala' } }]);
});

Deno.test('Manejador: mínimo de Ualá, proveedor sin API y proveedor sin credenciales', async () => {
  const rpcs: Array<[string, any]> = [];
  const { f } = falsoFetch([]);
  const h = manejador(ENV_UALA, f, rpcs);
  igual((await h(post({ accion: 'crear', proveedor: 'uala', token: 't', monto: 10 }))).status, 400, 'mínimo 25');
  const na = await h(post({ accion: 'crear', proveedor: 'naranjax', token: 't', monto: 100 }));
  igual(na.status, 400); igual((await na.json()).noAutomatico, true);
  const sin = await manejador({}, f, rpcs)(post({ accion: 'crear', proveedor: 'uala', token: 't', monto: 100 }));
  igual(sin.status, 503); cierto((await sin.json()).error.includes('UALA_USER'), 'nombra el secreto que falta');
  igual(rpcs.length, 0, 'ninguno de los tres llegó a crear un pedido');
});

Deno.test('Manejador: lista solo los proveedores con credenciales', async () => {
  const { f } = falsoFetch([]);
  igual((await (await manejador(ENV_UALA, f, [])(post({ accion: 'proveedores' }))).json()).proveedores, ['uala']);
  igual((await (await manejador({ ...ENV_UALA, MP_ACCESS_TOKEN: 'x' }, f, [])(post({ accion: 'proveedores' }))).json()).proveedores, ['mercadopago', 'uala']);
});

Deno.test('Manejador: el aviso de Ualá acredita con webhook_pago y los errores se reintentan', async () => {
  const rpcs: Array<[string, any]> = [];
  const { f } = falsoFetch([[/auth\/token/, 200, { access_token: 'T' }], [/orders\/U-1$/, 200, { uuid: 'U-1', external_reference: '7', amount: 1000, status: 'APPROVED' }]]);
  const res = await manejador(ENV_UALA, f, rpcs)(post({ uuid: 'U-1', status: 'APPROVED' }, 'https://x/functions/v1/pagos?p=uala'));
  igual(res.status, 200);
  igual(rpcs[0], ['webhook_pago', { token: 'WH', pago_id: 7, prov: 'uala', ref_prov: 'U-1', monto_pagado: 1000, estado_prov: 'approved', medio_prov: 'uala' }]);
  const { f: caido } = falsoFetch([[/auth\/token/, 200, { access_token: 'T' }]]); // la consulta de la orden da 404
  igual((await manejador(ENV_UALA, caido, [])(post({ uuid: 'U-1', status: 'APPROVED' }, 'https://x/functions/v1/pagos?p=uala'))).status, 502, 'si no se puede verificar, el proveedor reintenta');
});

Deno.test('Manejador: aviso viejo sin ?p se trata como Mercado Pago; proveedor desconocido se ignora', async () => {
  const rpcs: Array<[string, any]> = [];
  const { f } = falsoFetch([[/v1\/payments\/55/, 200, { id: 55, external_reference: '12', status: 'approved', transaction_amount: 100, payment_method_id: 'visa' }]]);
  const h = manejador({ MP_ACCESS_TOKEN: 'x' }, f, rpcs);
  igual((await h(post({ type: 'payment', data: { id: '55' } }, 'https://x/functions/v1/mercadopago'))).status, 200);
  igual(rpcs[0][1].prov, 'mercadopago');
  igual((await h(post({}, 'https://x/functions/v1/pagos?p=bitcoin'))).status, 200);
  igual(rpcs.length, 1);
});

Deno.test('Pedido de delivery con Ualá: cobra el total del pedido y vuelve al seguimiento', async () => {
  const rpcs: Array<[string, any]> = [];
  const { f, llamadas } = falsoFetch([[/auth\/token/, 200, { access_token: 'T' }], [/\/checkout$/, 200, { uuid: 'U', links: { checkout_link: 'https://uala/pagar' } }]]);
  const res = await manejador(ENV_UALA, f, rpcs)(post({ accion: 'crear_pedido', proveedor: 'uala', id: 5, k: 'abc' }));
  igual(res.status, 200); igual((await res.json()).url, 'https://uala/pagar');
  igual(rpcs[0], ['r_dlv_pub_pagar', { p_token: null, p_q: { id: 5, k: 'abc' }, p_b: { proveedor: 'uala' } }]);
  const c = llamadas[1].body;
  igual(c.amount, '16378.00'); igual(c.description, 'Pedido #AB12 · La Esquina'); igual(c.external_reference, '77');
  igual(c.callback_success, 'https://s.io/central/delivery.html#/seguir/5/abc'); igual(c.callback_fail, 'https://s.io/central/delivery.html#/seguir/5/abc');
});

Deno.test('Pedido de delivery con Mercado Pago: el título y las 3 vueltas apuntan al pedido', async () => {
  const { f, llamadas } = falsoFetch([[/checkout\/preferences/, 201, { init_point: 'https://mp/pagar' }]]);
  const res = await manejador({ MP_ACCESS_TOKEN: 'x' }, f, [])(post({ accion: 'crear_pedido', proveedor: 'mercadopago', id: 5, k: 'abc' }));
  igual((await res.json()).url, 'https://mp/pagar');
  igual(llamadas[0].body.items[0].title, 'Pedido #AB12 · La Esquina');
  igual(llamadas[0].body.items[0].unit_price, 16378);
  igual(llamadas[0].body.external_reference, '77');
  const v = 'https://s.io/central/delivery.html#/seguir/5/abc';
  igual(llamadas[0].body.back_urls, { success: v, pending: v, failure: v });
});

Deno.test('Pedido de delivery: errores del pedido, mínimo de Ualá y proveedor sin credenciales', async () => {
  const { f } = falsoFetch([]);
  const vencido = await manejador(ENV_UALA, f, [], null)(post({ accion: 'crear_pedido', proveedor: 'uala', id: 5, k: 'abc' }));
  igual(vencido.status, 400); cierto((await vencido.json()).error.includes('venció'), 'muestra el motivo del pedido');
  const chico = await manejador(ENV_UALA, f, [], 20)(post({ accion: 'crear_pedido', proveedor: 'uala', id: 5, k: 'abc' }));
  igual(chico.status, 400); cierto((await chico.json()).error.includes('$25'), 'avisa el mínimo');
  const rpcs: Array<[string, any]> = [];
  igual((await manejador({}, f, rpcs)(post({ accion: 'crear_pedido', proveedor: 'uala', id: 5, k: 'abc' }))).status, 503);
  igual(rpcs.length, 0, 'sin credenciales no se registra ningún cobro');
});
