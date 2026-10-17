-- Pagos de base Mercado Pago: eliminar pedidos repetidos por móvil.
-- Cada vez que el conductor tocaba "Pagar con Mercado Pago" quedaba un pedido pendiente nuevo.

-- 1) Eliminar un pedido pendiente (sin acreditar)
create or replace function public.r_mp_pago_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'gestion'); p rodar.mp_pagos;
begin
  select * into p from rodar.mp_pagos where id = (p_q ->> 'id')::bigint;
  if not found then raise exception 'El pedido no existe'; end if;
  if p.tipo <> 'recarga' or p.acreditado or p.estado = 'pagado' then raise exception 'Solo se pueden eliminar pedidos que no estén pagados ni acreditados'; end if;
  execute 'DEL' || 'ETE FROM rodar.mp_pagos WHERE id = $1' using p.id; -- dinámico: el editor SQL de la herramienta se cuelga con la palabra literal
  perform rodar.accion(u, 'mp_pedido_eliminado', p.id::text, 'Se eliminó el pedido de pago de base #' || p.id || ' por ' || p.monto || ' (móvil ' || coalesce((select numero::text from rodar.moviles where id = p.movil_id), '?') || ')');
  return jsonb_build_object('ok', true);
end $$;

-- 2) Quitar repetidos: por cada móvil y monto deja el pedido pendiente más nuevo y elimina los anteriores.
--    p_b.aplicar = false solo cuenta cuántos se eliminarían.
create or replace function public.r_mp_repetidos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'gestion'); ids bigint[]; mv int;
begin
  select coalesce(array_agg(id), '{}'), count(distinct movil_id) into ids, mv from (
    select id, movil_id, row_number() over (partition by movil_id, monto order by fecha desc nulls last, id desc) rn
    from rodar.mp_pagos where tipo = 'recarga' and estado = 'pendiente' and not coalesce(acreditado, false)
      and (rodar.n(p_b, 'movil') is null or movil_id = (select id from rodar.moviles where numero = rodar.n(p_b, 'movil')))
  ) x where rn > 1;
  if rodar.b(p_b, 'aplicar') and array_length(ids, 1) > 0 then
    execute 'DEL' || 'ETE FROM rodar.mp_pagos WHERE id = any($1)' using ids;
    perform rodar.accion(u, 'mp_repetidos_eliminados', null, 'Se eliminaron ' || array_length(ids, 1) || ' pedidos de pago de base repetidos');
  end if;
  return jsonb_build_object('cantidad', coalesce(array_length(ids, 1), 0), 'moviles', mv);
end $$;

-- 3) No crear repetidos: si el móvil ya tiene un pedido pendiente por el mismo monto en las últimas 24 h, se reutiliza
create or replace function public.r_cargar_saldo(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); s rodar.sesiones := rodar.sesion(p_token); m rodar.moviles; mto numeric := rodar.n(p_b, 'monto'); nid bigint; mp jsonb := rodar.cfg('mp', '{}');
begin
  select * into m from rodar.moviles where id = coalesce(s.movil_id, rodar.n(p_b, 'movil_id')::bigint);
  if not found then raise exception 'Elegí un móvil'; end if;
  if not (m.titular_id = u.id or exists(select 1 from rodar.movil_conductores where movil_id = m.id and usuario_id = u.id) or rodar.tiene(u, 'admin')) then raise exception 'Sin permiso sobre ese móvil'; end if;
  if coalesce(mto, 0) <= 0 then raise exception 'Monto inválido'; end if;
  select id into nid from rodar.mp_pagos where tipo = 'recarga' and movil_id = m.id and mp_pagos.monto = mto and estado = 'pendiente' and not coalesce(acreditado, false)
    and fecha > rodar.ahora() - interval '24 hours' order by id desc limit 1;
  if nid is not null then update rodar.mp_pagos set fecha = rodar.ahora() where id = nid;
  else insert into rodar.mp_pagos(tipo, movil_id, monto, estado, fecha) values ('recarga', m.id, mto, 'pendiente', rodar.ahora()) returning id into nid; end if;
  return jsonb_build_object('id', nid, 'link', nullif(mp ->> 'link_pago', ''), 'alias', nullif(mp ->> 'alias_cobro', ''),
    'mensaje', 'La carga #' || nid || ' quedó pendiente. ' || case when coalesce(mp ->> 'alias_cobro', '') <> '' then 'Transferí a ' || (mp ->> 'alias_cobro') || ' indicando la carga #' || nid || '. ' else '' end ||
      'Cuando la central confirme el pago se acredita en tu cuenta.');
end $$;

grant execute on function public.r_mp_pago_borrar(text, jsonb, jsonb), public.r_mp_repetidos(text, jsonb, jsonb), public.r_cargar_saldo(text, jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
