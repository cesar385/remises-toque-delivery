-- ===================== Pagar base con varias billeteras (Mercado Pago, Ualá, Naranja X, Personal Pay, transferencia) =====================
-- Mercado Pago y Ualá se acreditan solos (función de Supabase "pagos"). Naranja X, Personal Pay y "otra billetera / transferencia"
-- se cobran por transferencia al alias/CVU de la central y se confirman a mano en Finanzas → Pagos de base.

alter table rodar.mp_pagos add column if not exists proveedor text default 'mercadopago';

-- Catálogo fijo de proveedores. api = true si existe un adaptador que acredita solo (ver supabase/functions/_shared/adaptadores.ts)
create or replace function rodar.pagos_catalogo() returns jsonb language sql immutable as $$
  select '[
    {"codigo":"mercadopago","nombre":"Mercado Pago","api":true},
    {"codigo":"uala","nombre":"Ualá","api":true},
    {"codigo":"naranjax","nombre":"Naranja X","api":false},
    {"codigo":"personalpay","nombre":"Personal Pay","api":false},
    {"codigo":"transferencia","nombre":"Otra billetera / transferencia","api":false}
  ]'::jsonb $$;

-- Configuración de un proveedor: {habilitado, alias, link}. Mercado Pago y transferencia heredan el alias/link de "Medios de pago" si no tienen uno propio.
create or replace function rodar.pagos_conf(prov text) returns jsonb language plpgsql stable as $$
declare c jsonb := rodar.cfg('pagos', '{}') -> 'proveedores' -> prov; mp jsonb := rodar.cfg('mp', '{}'); h boolean;
begin
  h := coalesce((c ->> 'habilitado')::boolean, prov in ('mercadopago', 'transferencia'));
  return jsonb_build_object('habilitado', h,
    'alias', coalesce(nullif(c ->> 'alias', ''), case when prov in ('mercadopago', 'transferencia') then nullif(mp ->> 'alias_cobro', '') end),
    'link',  coalesce(nullif(c ->> 'link', ''),  case when prov in ('mercadopago', 'transferencia') then nullif(mp ->> 'link_pago', '') end));
end $$;

-- Lista para la app del conductor / panel: solo los proveedores habilitados
create or replace function public.r_pagos_proveedores(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('codigo', x ->> 'codigo', 'nombre', x ->> 'nombre', 'api', (x ->> 'api')::boolean))
    from jsonb_array_elements(rodar.pagos_catalogo()) x where (rodar.pagos_conf(x ->> 'codigo') ->> 'habilitado')::boolean), '[]'::jsonb);
end $$;

-- Pantalla de administración (Medios de pago)
create or replace function public.r_pagos_config(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'admin');
  return jsonb_build_object('proveedores', (select jsonb_agg(x || rodar.pagos_conf(x ->> 'codigo') order by ord) from jsonb_array_elements(rodar.pagos_catalogo()) with ordinality t(x, ord)));
end $$;

create or replace function public.r_pagos_config_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); x jsonb; n jsonb := '{}';
begin
  for x in select jsonb_array_elements(coalesce(p_b -> 'proveedores', '[]')) loop
    if not exists (select 1 from jsonb_array_elements(rodar.pagos_catalogo()) c where c ->> 'codigo' = x ->> 'codigo') then raise exception 'Proveedor desconocido: %', x ->> 'codigo'; end if;
    n := n || jsonb_build_object(x ->> 'codigo', jsonb_build_object('habilitado', rodar.b(x, 'habilitado'), 'alias', btrim(coalesce(x ->> 'alias', '')), 'link', btrim(coalesce(x ->> 'link', ''))));
  end loop;
  perform rodar.cfg_set('pagos', jsonb_build_object('proveedores', n));
  perform rodar.accion(u, 'pagos_proveedores_guardados', null, 'Se actualizaron las billeteras para cargas de saldo');
  return '{"ok":true}';
end $$;

-- Pedido de carga de saldo (reemplaza la versión de 29_mp_repetidos.sql): ahora recuerda con qué billetera se paga.
-- Si ya hay un pedido pendiente del mismo móvil, monto y proveedor en las últimas 24 h, se reutiliza.
create or replace function public.r_cargar_saldo(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); s rodar.sesiones := rodar.sesion(p_token); m rodar.moviles; mto numeric := rodar.n(p_b, 'monto'); nid bigint;
  prov text := coalesce(nullif(p_b ->> 'proveedor', ''), 'mercadopago'); cat jsonb; conf jsonb; alias_c text;
begin
  select x into cat from jsonb_array_elements(rodar.pagos_catalogo()) x where x ->> 'codigo' = prov;
  if cat is null then raise exception 'Medio de pago desconocido'; end if;
  conf := rodar.pagos_conf(prov);
  if not (conf ->> 'habilitado')::boolean then raise exception '% no está habilitado para cargas de saldo', cat ->> 'nombre'; end if;
  select * into m from rodar.moviles where id = coalesce(s.movil_id, rodar.n(p_b, 'movil_id')::bigint);
  if not found then raise exception 'Elegí un móvil'; end if;
  if not (m.titular_id = u.id or exists(select 1 from rodar.movil_conductores where movil_id = m.id and usuario_id = u.id) or rodar.tiene(u, 'admin')) then raise exception 'Sin permiso sobre ese móvil'; end if;
  if coalesce(mto, 0) <= 0 then raise exception 'Monto inválido'; end if;
  select id into nid from rodar.mp_pagos where tipo = 'recarga' and movil_id = m.id and mp_pagos.monto = mto and estado = 'pendiente' and not coalesce(acreditado, false)
    and coalesce(mp_pagos.proveedor, 'mercadopago') = prov and fecha > rodar.ahora() - interval '24 hours' order by id desc limit 1;
  if nid is not null then update rodar.mp_pagos set fecha = rodar.ahora() where id = nid;
  else insert into rodar.mp_pagos(tipo, movil_id, monto, estado, fecha, proveedor) values ('recarga', m.id, mto, 'pendiente', rodar.ahora(), prov) returning id into nid; end if;
  alias_c := conf ->> 'alias';
  return jsonb_build_object('id', nid, 'proveedor', prov, 'nombre', cat ->> 'nombre', 'link', conf ->> 'link', 'alias', alias_c,
    'mensaje', 'La carga #' || nid || ' quedó pendiente. ' || case when coalesce(alias_c, '') <> '' then 'Transferí desde ' || (cat ->> 'nombre') || ' a ' || alias_c || ' indicando la carga #' || nid || '. ' else '' end ||
      'Cuando la central confirme el pago se acredita en tu cuenta.');
end $$;

-- Acreditación automática, para cualquier proveedor. La llama la función "pagos" cuando el proveedor confirma un pago.
-- Acredita una sola vez, solo si el pedido es de ese proveedor y el monto coincide.
create or replace function public.webhook_pago(token text, pago_id bigint, prov text, ref_prov text, monto_pagado numeric, estado_prov text default 'approved', medio_prov text default null) returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare p rodar.mp_pagos; m rodar.moviles; nom text;
begin
  if token is distinct from rodar.cfg('webhook_token') #>> '{}' then raise exception 'token inválido'; end if;
  select * into p from rodar.mp_pagos where id = pago_id and tipo = 'recarga' for update;
  if not found then raise exception 'El pago % no existe', pago_id; end if;
  if coalesce(p.proveedor, 'mercadopago') <> prov then raise exception 'El pago % no corresponde a %', pago_id, prov; end if;
  if p.acreditado then return jsonb_build_object('ok', true, 'ya_acreditado', true); end if;
  select x ->> 'nombre' into nom from jsonb_array_elements(rodar.pagos_catalogo()) x where x ->> 'codigo' = prov;
  if estado_prov <> 'approved' then
    update rodar.mp_pagos set estado = case when estado_prov in ('rejected', 'cancelled') then 'cancelado' else 'pendiente' end, mp_id = coalesce(mp_pagos.mp_id, ref_prov) where mp_pagos.id = p.id;
    return jsonb_build_object('ok', true, 'estado', estado_prov);
  end if;
  if abs(coalesce(monto_pagado, 0) - p.monto) > 0.01 then raise exception 'El monto pagado (%) no coincide con el pedido (%)', monto_pagado, p.monto; end if;
  update rodar.mp_pagos set estado = 'pagado', medio = coalesce(medio_prov, prov), mp_id = ref_prov, liberacion = rodar.hoy(), acreditado = true where mp_pagos.id = p.id;
  perform rodar.registrar_pago(p.movil_id, p.monto, 'Pago de base ' || coalesce(nom, prov) || ' #' || ref_prov, null, 'carga_mp');
  select * into m from rodar.moviles where id = p.movil_id;
  perform rodar.emitir_movil(p.movil_id);
  perform rodar.emit('panel', 'aviso', jsonb_build_object('texto', 'Móvil ' || m.numero || ' pagó la base (' || coalesce(nom, prov) || '): $' || p.monto));
  perform rodar.emit('movil-' || p.movil_id, 'pago_base', jsonb_build_object('monto', p.monto));
  return jsonb_build_object('ok', true);
end $$;

-- Compatibilidad con la función vieja "mercadopago" que todavía llame a webhook_mp
create or replace function public.webhook_mp(token text, pago_id bigint, pago_mp_id text, monto_pagado numeric, estado_mp text default 'approved', medio_mp text default null) returns jsonb
language sql security definer set search_path = rodar, public, extensions as $$
  select public.webhook_pago(token, pago_id, 'mercadopago', pago_mp_id, monto_pagado, estado_mp, medio_mp) $$;

grant execute on function public.r_pagos_proveedores(text, jsonb, jsonb), public.r_pagos_config(text, jsonb, jsonb), public.r_pagos_config_guardar(text, jsonb, jsonb),
  public.r_cargar_saldo(text, jsonb, jsonb), public.webhook_pago(text, bigint, text, text, numeric, text, text), public.webhook_mp(text, bigint, text, numeric, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
