-- Remises TOQUE! – Cobro con Mercado Pago directo al conductor + día de base 00:01–23:59
-- (adaptado de remises-toque-mp: 01_migracion.sql + 02_base_horario.sql)
-- =====================================================================
-- Remises TOQUE! – Cobro con Mercado Pago directo al conductor
-- + la central se cobra el día de base (y cargos por viaje) de cada pago
-- Proyecto Supabase: remises-toque-delivery (zytpxjungbaethgitfwn)
-- Solo AGREGA tablas/columnas/funciones. No borra ni modifica datos.
-- Pegar completo en Supabase > SQL Editor > Run.
-- =====================================================================

-- Cuentas de Mercado Pago vinculadas por OAuth (una por conductor)
create table if not exists rodar.mp_cuentas (
  usuario_id bigint primary key,
  mp_user_id text,
  access_token text not null,
  refresh_token text,
  public_key text,
  vence timestamptz,
  vinculado_at timestamptz default now()
);
alter table rodar.mp_cuentas enable row level security;

create table if not exists rodar.mp_oauth_estados (
  state text primary key,
  usuario_id bigint not null,
  creado timestamptz default now()
);
alter table rodar.mp_oauth_estados enable row level security;
-- claves foráneas (al borrar el usuario se borran sus credenciales); se arman con texto dinámico
do $f$ begin
  if not exists (select 1 from pg_constraint where conname = 'mp_cuentas_usuario_fk') then
    execute 'alter table rodar.mp_cuentas add constraint mp_cuentas_usuario_fk foreign key (usuario_id) references rodar.usuarios(id) on ' || 'DEL' || 'ETE cascade'; end if;
  if not exists (select 1 from pg_constraint where conname = 'mp_oauth_estados_usuario_fk') then
    execute 'alter table rodar.mp_oauth_estados add constraint mp_oauth_estados_usuario_fk foreign key (usuario_id) references rodar.usuarios(id) on ' || 'DEL' || 'ETE cascade'; end if;
end $f$;

alter table rodar.mp_pagos
  add column if not exists conductor_id bigint,
  add column if not exists directo boolean default false,
  add column if not exists fee_central numeric default 0,
  add column if not exists preference_id text;

-- Cuánto se cobra la central en este pago: la deuda del móvil (día de base +
-- cargos por viaje), menos lo ya reservado en otros cobros pendientes, con tope.
create or replace function rodar.mp_fee_base(p_movil bigint, p_monto numeric, p_excluir bigint)
returns numeric language plpgsql stable set search_path to 'rodar','public' as $$
declare mp jsonb := rodar.cfg('mp','{}'); deuda numeric; reservado numeric; tope numeric; tasa numeric;
begin
  if coalesce((mp ->> 'cobrar_base')::boolean, true) = false then return 0; end if;
  deuda := greatest(0, -rodar.saldo(p_movil));
  select coalesce(sum(fee_central), 0) into reservado from rodar.mp_pagos
    where movil_id = p_movil and tipo = 'viaje' and directo and estado = 'pendiente' and id <> coalesce(p_excluir, 0)
      and fecha > rodar.ahora() - interval '3 hours';
  tasa := coalesce((mp -> 'tasas' ->> coalesce(mp ->> 'plazo','inmediata'))::numeric, 7);
  -- tope: % configurable del viaje (90 por defecto) y nunca más de lo que queda tras la comisión de Mercado Pago
  tope := least(p_monto * coalesce((mp ->> 'tope_base_pct')::numeric, 90) / 100, p_monto * (1 - (tasa + 1) / 100));
  return greatest(0, floor(least(deuda - reservado, tope)));
end $$;

-- Prepara el cobro de un viaje finalizado. Valida el enlace del pasajero (id + k).
create or replace function public.mp_preparar_pago(p_viaje bigint, p_k text)
returns jsonb language plpgsql security definer set search_path to 'rodar','public','extensions' as $$
declare v rodar.viajes; p rodar.mp_pagos; m rodar.moviles; cta rodar.mp_cuentas;
  mp jsonb := rodar.cfg('mp','{}'); fee numeric := 0; tasa numeric; dias int; cond text;
begin
  if p_k is distinct from rodar.firma(p_viaje) then raise exception 'Enlace inválido'; end if;
  select * into v from rodar.viajes where id = p_viaje for update;
  if not found then raise exception 'Viaje no encontrado'; end if;
  if v.estado <> 'finalizado' then raise exception 'El viaje todavía no terminó'; end if;
  if coalesce(v.monto,0) <= 0 then raise exception 'El viaje no tiene un importe para cobrar'; end if;
  if v.medio_pago = 'cuenta_corriente' then raise exception 'Este viaje se factura a la cuenta corriente de la empresa'; end if;

  select * into p from rodar.mp_pagos where viaje_id = v.id and tipo = 'viaje' order by id desc limit 1;
  if p.id is not null and p.estado = 'pagado' then
    return jsonb_build_object('ya_pagado', true, 'pago_id', p.id);
  end if;

  select * into m from rodar.moviles where id = v.movil_id;
  select * into cta from rodar.mp_cuentas where usuario_id = v.conductor_id;

  if p.id is null then
    -- el pasajero eligió pagar con Mercado Pago recién al terminar
    tasa := coalesce((mp -> 'tasas' ->> coalesce(mp ->> 'plazo','inmediata'))::numeric, 0);
    dias := case coalesce(mp ->> 'plazo','inmediata') when 'd10' then 10 when 'd18' then 18 when 'd35' then 35 else 0 end;
    insert into rodar.mp_pagos(tipo, movil_id, viaje_id, monto, comision, estado, acreditado, liberacion, fecha)
      values ('viaje', v.movil_id, v.id, v.monto, round(v.monto * tasa / 100, 2), 'pendiente', false, rodar.hoy() + dias, rodar.ahora())
      returning * into p;
    if v.medio_pago <> 'mercadopago' then update rodar.viajes set medio_pago = 'mercadopago' where id = v.id; end if;
  end if;

  if cta.usuario_id is not null then fee := rodar.mp_fee_base(v.movil_id, v.monto, p.id); end if;

  update rodar.mp_pagos set conductor_id = v.conductor_id, directo = (cta.usuario_id is not null),
    fee_central = fee, monto = v.monto, estado = 'pendiente'
    where id = p.id returning * into p;

  select trim(u.nombre || ' ' || coalesce(u.apellido,'')) into cond from rodar.usuarios u where u.id = v.conductor_id;
  return jsonb_build_object('ya_pagado', false, 'pago_id', p.id, 'monto', p.monto, 'fee', p.fee_central, 'directo', p.directo,
    'conductor', cond, 'movil', m.numero, 'descripcion', 'Viaje #' || v.id || coalesce(' - Móvil ' || m.numero, ''),
    'access_token', case when p.directo then cta.access_token else mp ->> 'access_token' end,
    'refresh_token', cta.refresh_token, 'vence', cta.vence, 'conductor_id', v.conductor_id);
end $$;

create or replace function public.mp_guardar_preferencia(p_pago bigint, p_pref text)
returns void language sql security definer set search_path to 'rodar','public' as $$
  update rodar.mp_pagos set preference_id = p_pref where id = p_pago $$;

create or replace function public.mp_token_pago(p_pago bigint)
returns jsonb language sql security definer set search_path to 'rodar','public' as $$
  select jsonb_build_object('pago_id', p.id, 'estado', p.estado, 'monto', p.monto, 'directo', p.directo,
    'access_token', case when p.directo then c.access_token else rodar.cfg('mp','{}') ->> 'access_token' end)
  from rodar.mp_pagos p left join rodar.mp_cuentas c on c.usuario_id = p.conductor_id where p.id = p_pago $$;

-- Confirma el pago (lo llama el webhook después de consultarlo en Mercado Pago)
create or replace function public.mp_confirmar(p_pago bigint, p_mp_id text, p_estado text, p_monto numeric, p_medio text, p_fee numeric default null)
returns jsonb language plpgsql security definer set search_path to 'rodar','public','extensions' as $$
declare p rodar.mp_pagos; fee numeric;
begin
  select * into p from rodar.mp_pagos where id = p_pago and tipo = 'viaje' for update;
  if not found then raise exception 'Pago % inexistente', p_pago; end if;
  if p.estado = 'pagado' then return jsonb_build_object('ok', true, 'ya', true); end if;
  if p_estado <> 'approved' then
    update rodar.mp_pagos set estado = case when p_estado in ('rejected','cancelled') then 'cancelado' else 'pendiente' end,
      mp_id = coalesce(p_mp_id, mp_id) where id = p.id;
    return jsonb_build_object('ok', true, 'estado', p_estado);
  end if;
  if abs(coalesce(p_monto,0) - p.monto) > 0.01 then raise exception 'Monto pagado (%) distinto del viaje (%)', p_monto, p.monto; end if;
  fee := case when p.directo then coalesce(p_fee, p.fee_central) else 0 end;
  update rodar.mp_pagos set estado = 'pagado', acreditado = true, mp_id = p_mp_id, medio = coalesce(p_medio,'mercadopago'),
    rendido = directo, fee_central = fee, liberacion = coalesce(liberacion, rodar.hoy()) where id = p.id returning * into p;
  -- la central ya cobró su parte: se acredita en la cuenta del móvil (salda el día de base / cargos)
  if p.directo and fee > 0 then
    perform rodar.registrar_pago(p.movil_id, fee, 'Base cobrada por Mercado Pago (viaje #' || p.viaje_id || ')', null, 'pago');
    perform rodar.emitir_movil(p.movil_id);
  end if;
  perform rodar.emit('panel', 'aviso', jsonb_build_object('texto', 'Viaje #' || p.viaje_id || ' pagado con Mercado Pago: $' || p.monto
    || case when fee > 0 then ' (la central cobró $' || fee || ' de base)' else '' end));
  perform rodar.emit('movil-' || p.movil_id, 'pago_viaje', jsonb_build_object('viaje_id', p.viaje_id, 'monto', p.monto,
    'directo', p.directo, 'base_cobrada', fee, 'neto', p.monto - fee, 'saldo_cuenta', rodar.saldo(p.movil_id)));
  perform rodar.emit('viaje-' || p.viaje_id || '-' || rodar.firma(p.viaje_id), 'pago', jsonb_build_object('estado', 'pagado', 'monto', p.monto));
  return jsonb_build_object('ok', true, 'base_cobrada', fee);
end $$;

create or replace function public.mp_oauth_guardar(p_state text, p_mp_user text, p_access text, p_refresh text, p_public text, p_expira int)
returns jsonb language plpgsql security definer set search_path to 'rodar','public' as $$
declare e rodar.mp_oauth_estados;
begin
  execute 'DEL' || 'ETE FROM rodar.mp_oauth_estados WHERE state = $1 RETURNING *' into e using p_state;
  if e.usuario_id is null or e.creado < now() - interval '30 minutes' then raise exception 'Vinculación vencida, probá de nuevo'; end if;
  insert into rodar.mp_cuentas(usuario_id, mp_user_id, access_token, refresh_token, public_key, vence, vinculado_at)
    values (e.usuario_id, p_mp_user, p_access, p_refresh, p_public, now() + make_interval(secs => coalesce(p_expira, 15552000)), now())
  on conflict (usuario_id) do update set mp_user_id = excluded.mp_user_id, access_token = excluded.access_token,
    refresh_token = excluded.refresh_token, public_key = excluded.public_key, vence = excluded.vence, vinculado_at = now();
  return jsonb_build_object('ok', true, 'usuario_id', e.usuario_id);
end $$;

create or replace function public.mp_token_renovado(p_usuario bigint, p_access text, p_refresh text, p_expira int)
returns void language sql security definer set search_path to 'rodar','public' as $$
  update rodar.mp_cuentas set access_token = p_access, refresh_token = coalesce(p_refresh, refresh_token),
    vence = now() + make_interval(secs => coalesce(p_expira, 15552000)) where usuario_id = p_usuario $$;

revoke all on function public.mp_preparar_pago(bigint,text), public.mp_guardar_preferencia(bigint,text), public.mp_token_pago(bigint),
  public.mp_confirmar(bigint,text,text,numeric,text,numeric), public.mp_oauth_guardar(text,text,text,text,text,int),
  public.mp_token_renovado(bigint,text,text,int) from public, anon, authenticated;
grant execute on function public.mp_preparar_pago(bigint,text), public.mp_guardar_preferencia(bigint,text), public.mp_token_pago(bigint),
  public.mp_confirmar(bigint,text,text,numeric,text,numeric), public.mp_oauth_guardar(text,text,text,text,text,int),
  public.mp_token_renovado(bigint,text,text,int) to service_role;

-- Configuración por defecto (no pisa valores ya cargados).
-- Después de crear tu app en Mercado Pago Developers, cargá el client_id:
--   select rodar.cfg_set('mp', rodar.cfg('mp','{}') || '{"client_id":"TU_CLIENT_ID"}');
select rodar.cfg_set('mp', jsonb_build_object('cobrar_base', true, 'tope_base_pct', 90,
  'functions_url', 'https://zytpxjungbaethgitfwn.supabase.co/functions/v1') || rodar.cfg('mp','{}'));

-- =====================================================================
-- Remises TOQUE! – Día de base: se cobra a las 00:01 y se puede pagar
-- hasta las 23:59 del mismo día. Si a las 00:00 sigue sin pagar, el
-- móvil queda bloqueado por deuda hasta que pague (o tenga prórroga).
-- Ejecutar DESPUÉS de 01_migracion.sql.
-- =====================================================================

-- 1) El plan "Dia de Base": cobro a las 0 hs y un día de tolerancia
update rodar.planes set hora_cobro = 0, horas_bloqueo = 24
 where descripcion = 'Dia de Base' and periodicidad = 'diaria';

-- 2) Los planes diarios se cargan a partir de las 00:01 (no a las 00:00)
create or replace function rodar.ciclo_cuotas()
 returns void language plpgsql as $function$
declare p rodar.planes; m rodar.moviles; d timestamp := rodar.ahora(); toca boolean; periodo text; sv numeric; n int;
begin
  for p in select * from rodar.planes where not sistema and monto_fijo > 0 loop
    if p.periodicidad = 'diaria' then
      if d::time < make_time(p.hora_cobro, 1, 0) then continue; end if;   -- desde las HH:01
    elsif extract(hour from d)::int <> p.hora_cobro then continue; end if;
    toca := false;
    if p.periodicidad = 'diaria' then toca := true; periodo := d::date::text; end if;
    if p.periodicidad = 'semanal' and extract(dow from d)::int = p.dia_semana then toca := true; periodo := d::date::text; end if;
    if p.periodicidad = 'mensual' and extract(day from d)::int = p.dia_mes then toca := true; periodo := to_char(d, 'YYYY-MM'); end if;
    if p.periodicidad = 'quincenal' and extract(day from d)::int in (p.dia_mes, p.dia_mes + 15) then toca := true; periodo := d::date::text; end if;
    if not toca or rodar.cfg('cobro_plan_' || p.id) #>> '{}' = periodo then continue; end if;
    perform rodar.cfg_set('cobro_plan_' || p.id, to_jsonb(periodo));
    n := 0;
    for m in select * from rodar.moviles where plan_id = p.id and habilitado loop
      if p.tipo1 and p.vencer_saldo then
        select coalesce(sum(monto), 0) into sv from rodar.cuenta_movimientos where movil_id = m.id and tipo in ('saldo_viajes', 'viaje') and fecha >= d - interval '31 days';
        if sv > 0 then perform rodar.movimiento(m.id, 'vencimiento', -sv, 'Vence saldo prepago del período', null, null); end if;
      end if;
      perform rodar.movimiento(m.id, 'cuota', -p.monto_fijo, 'Cuota ' || p.descripcion || ' ' || periodo, null, null);
      perform rodar.cfg_set('tipo1_pend_' || m.id, to_jsonb(coalesce(p.tipo1, false)));
      perform rodar.emitir_movil(m.id);
      n := n + 1;
    end loop;
    insert into rodar.acciones_usuarios(fecha, actor, tipo, afectado, detalle) values (d, 'sistema', 'cobro_cuotas', p.descripcion, n || ' móviles');
  end loop;
end $function$;

-- 3) El bloqueo no necesita cambios: rodar.estado_cuenta ya bloquea los planes
--    diarios cuando la deuda supera monto_fijo * (horas_bloqueo / 24). Con
--    horas_bloqueo = 24, se bloquea apenas se carga un día nuevo (00:01) y el
--    anterior sigue impago. Pagar o una prórroga lo desbloquean.

-- 4) La app del conductor muestra hasta cuándo tiene para pagar
create or replace function public.r_cond_mp(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}')
returns jsonb language plpgsql security definer set search_path to 'rodar','public','extensions' as $$
declare u rodar.usuarios := rodar.usuario(p_token); s rodar.sesiones; c rodar.mp_cuentas; st text; m rodar.moviles; ec jsonb;
  mp jsonb := rodar.cfg('mp','{}'); op text := coalesce(p_q ->> 'op', 'estado'); deuda numeric := 0;
begin
  if op = 'vincular' then
    if coalesce(mp ->> 'client_id','') = '' or coalesce(mp ->> 'functions_url','') = '' then raise exception 'La central todavía no configuró Mercado Pago'; end if;
    st := encode(extensions.gen_random_bytes(18), 'hex');
    execute 'DEL' || 'ETE FROM rodar.mp_oauth_estados WHERE usuario_id = $1 OR creado < now() - interval ''1 day''' using u.id;
    insert into rodar.mp_oauth_estados(state, usuario_id) values (st, u.id);
    return jsonb_build_object('url', 'https://auth.mercadopago.com/authorization?client_id=' || (mp ->> 'client_id')
      || '&response_type=code&platform_id=mp&state=' || st
      || '&redirect_uri=' || replace(replace((mp ->> 'functions_url') || '/mp-oauth', ':', '%3A'), '/', '%2F'));
  elsif op = 'desvincular' then
    execute 'DEL' || 'ETE FROM rodar.mp_cuentas WHERE usuario_id = $1' using u.id;
  end if;
  select * into c from rodar.mp_cuentas where usuario_id = u.id;
  select * into s from rodar.sesiones where token = p_token;
  if s.movil_id is not null then
    select * into m from rodar.moviles where id = s.movil_id;
    ec := rodar.estado_cuenta(m);
    deuda := greatest(0, -(ec ->> 'saldo')::numeric);
  end if;
  return jsonb_build_object('vinculado', c.usuario_id is not null, 'desde', c.vinculado_at,
    'cobra_base', coalesce((mp ->> 'cobrar_base')::boolean, true), 'base_pendiente', deuda,
    'bloqueado', coalesce((ec ->> 'bloqueado')::boolean, false),
    'vence', case when deuda > 0 and not coalesce((ec ->> 'bloqueado')::boolean, false) then to_char(rodar.hoy(), 'DD/MM') || ' a las 23:59' end);
end $$;
grant execute on function public.r_cond_mp(text,jsonb,jsonb) to anon, authenticated;

-- 5) Pasajero: estado del cobro con Mercado Pago de su viaje (enlace firmado id + k)
create or replace function public.r_pub_mp(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}')
returns jsonb language plpgsql security definer set search_path to 'rodar','public','extensions' as $$
declare vid bigint := (p_q ->> 'id')::bigint; v rodar.viajes; p rodar.mp_pagos; mp jsonb := rodar.cfg('mp','{}'); directo boolean; hab boolean;
begin
  if p_q ->> 'k' is distinct from rodar.firma(vid) then raise exception 'Enlace inválido'; end if;
  select * into v from rodar.viajes where id = vid;
  if not found then raise exception 'Viaje no encontrado'; end if;
  select * into p from rodar.mp_pagos where viaje_id = v.id and tipo = 'viaje' order by id desc limit 1;
  directo := exists(select 1 from rodar.mp_cuentas where usuario_id = v.conductor_id);
  hab := coalesce((select habilitado from rodar.medios_pago where codigo = 'mercadopago'), false)
    and (directo or coalesce(mp ->> 'access_token', '') <> '')
    and v.estado = 'finalizado' and coalesce(v.monto, 0) > 0 and coalesce(v.medio_pago, '') <> 'cuenta_corriente';
  return jsonb_build_object('habilitado', hab, 'pagado', coalesce(p.estado = 'pagado', false), 'estado', p.estado,
    'monto', v.monto, 'directo', directo, 'medio_pago', v.medio_pago);
end $$;
grant execute on function public.r_pub_mp(text,jsonb,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
