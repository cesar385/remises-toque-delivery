-- ===================== Pagar base (Mercado Pago con acreditación automática) =====================

-- Datos para la pantalla "Pagar base": saldo, estado de la cuenta, cuota del plan y monto sugerido.
-- La app del conductor la llama con su sesión (móvil de la sesión); el panel pasa movil_id.
create or replace function public.r_base_info(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); s rodar.sesiones := rodar.sesion(p_token); m rodar.moviles; ec jsonb; p jsonb; sal numeric; cuota numeric; deuda numeric; sug numeric; mp jsonb := rodar.cfg('mp', '{}');
begin
  select * into m from rodar.moviles where id = coalesce(s.movil_id, rodar.n(p_q, 'movil_id')::bigint);
  if not found then raise exception 'Elegí un móvil'; end if;
  if not (m.titular_id = u.id or exists(select 1 from rodar.movil_conductores where movil_id = m.id and usuario_id = u.id) or rodar.tiene(u, 'admin')) then raise exception 'Sin permiso sobre ese móvil'; end if;
  ec := rodar.estado_cuenta(m); p := ec -> 'plan'; sal := (ec ->> 'saldo')::numeric;
  cuota := case when p is not null and not coalesce((p ->> 'sistema')::boolean, false) then coalesce((p ->> 'monto_fijo')::numeric, 0) else 0 end;
  deuda := greatest(0, -sal);
  sug := greatest(deuda, case when cuota > 0 then cuota - greatest(sal, 0) else 0 end, coalesce((p ->> 'minimo')::numeric, 0) - sal, 0);
  return jsonb_build_object('movil_id', m.id, 'numero', m.numero, 'saldo', sal, 'color', ec ->> 'color', 'texto', ec ->> 'texto', 'bloqueado', (ec ->> 'bloqueado')::boolean,
    'plan', case when p is null then null else jsonb_build_object('descripcion', p ->> 'descripcion', 'periodicidad', p ->> 'periodicidad', 'monto_fijo', cuota, 'minimo', p -> 'minimo', 'horas_bloqueo', p -> 'horas_bloqueo', 'sistema', p -> 'sistema') end,
    'deuda', deuda, 'cuota', cuota, 'sugerido', greatest(sug, 0), 'alias', nullif(mp ->> 'alias_cobro', ''), 'link', nullif(mp ->> 'link_pago', ''));
end $$;

-- La función de Supabase "mercadopago" avisa acá cuando Mercado Pago confirma un pago aprobado.
-- Acredita el pago en la cuenta del móvil una sola vez y solo si el monto coincide con el pedido.
create or replace function public.webhook_mp(token text, pago_id bigint, pago_mp_id text, monto_pagado numeric, estado_mp text default 'approved', medio_mp text default null) returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare p rodar.mp_pagos; m rodar.moviles;
begin
  if token is distinct from rodar.cfg('webhook_token') #>> '{}' then raise exception 'token inválido'; end if;
  select * into p from rodar.mp_pagos where id = pago_id and tipo = 'recarga' for update;
  if not found then raise exception 'El pago % no existe', pago_id; end if;
  if p.acreditado then return jsonb_build_object('ok', true, 'ya_acreditado', true); end if;
  if estado_mp <> 'approved' then
    update rodar.mp_pagos set estado = case when estado_mp in ('rejected', 'cancelled') then 'cancelado' else 'pendiente' end, mp_id = coalesce(mp_pagos.mp_id, pago_mp_id) where mp_pagos.id = p.id;
    return jsonb_build_object('ok', true, 'estado', estado_mp);
  end if;
  if abs(coalesce(monto_pagado, 0) - p.monto) > 0.01 then raise exception 'El monto pagado (%) no coincide con el pedido (%)', monto_pagado, p.monto; end if;
  update rodar.mp_pagos set estado = 'pagado', medio = coalesce(medio_mp, 'mercadopago'), mp_id = pago_mp_id, liberacion = rodar.hoy(), acreditado = true where mp_pagos.id = p.id;
  perform rodar.registrar_pago(p.movil_id, p.monto, 'Pago de base Mercado Pago #' || pago_mp_id, null, 'carga_mp');
  select * into m from rodar.moviles where id = p.movil_id;
  perform rodar.emitir_movil(p.movil_id);
  perform rodar.emit('panel', 'aviso', jsonb_build_object('texto', 'Móvil ' || m.numero || ' pagó la base: $' || p.monto));
  perform rodar.emit('movil-' || p.movil_id, 'pago_base', jsonb_build_object('monto', p.monto));
  return jsonb_build_object('ok', true);
end $$;

notify pgrst, 'reload schema';
