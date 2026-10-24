// Función de Supabase: "Pagar base" con varias billeteras (Mercado Pago, Ualá, ...) y acreditación automática.
// Los proveedores están en ../_shared/adaptadores.ts. Despliegue (sin verificación JWT: los proveedores no mandan ese encabezado):
//   supabase functions deploy pagos --no-verify-jwt
// Secretos comunes: RODAR_WEBHOOK_TOKEN (el de Administración → Configuración y demo), SITE_URL (https://usuario.github.io/central/)
// Secretos por proveedor: MP_ACCESS_TOKEN · UALA_USER, UALA_CLIENT_ID, UALA_CLIENT_SECRET
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { crearAdaptadores } from '../_shared/adaptadores.ts';
import { crearManejador } from '../_shared/handler.ts';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const sb = createClient(URL_SB, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });

Deno.serve(crearManejador({
  adaptadores: crearAdaptadores(),
  rpc: (nombre, args) => sb.rpc(nombre, args) as any,
  urlSb: URL_SB,
  webhookToken: Deno.env.get('RODAR_WEBHOOK_TOKEN') ?? '',
  site: (Deno.env.get('SITE_URL') ?? '').replace(/\/?$/, '/').replace(/^\/$/, ''),
  proveedorPorDefecto: 'mercadopago',
}));
