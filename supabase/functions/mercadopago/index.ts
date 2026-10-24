// Compatibilidad: los pedidos de Mercado Pago creados ANTES de instalar la función "pagos" tienen guardada esta dirección
// (/functions/v1/mercadopago) como notification_url. Esta función solo reenvía a la lógica nueva.
// Si no tenés pagos viejos pendientes podés no desplegarla:  supabase functions deploy mercadopago --no-verify-jwt
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
