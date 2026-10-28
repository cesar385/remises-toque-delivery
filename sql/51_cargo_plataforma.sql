-- ===================== Cargos de la plataforma =====================
-- Recargo que se suma a cada viaje (efectivo, tarjeta, Mercado Pago, etc.; no a cuenta corriente de empresas)
-- para que, cuando se cobra con Mercado Pago, el conductor reciba el valor del viaje sin la comisión de MP.
-- Config en cfg('mp'): cargo_activo (bool) y cargo_pct (comisión a cubrir, % sobre el total; por defecto 7,99 = 6,6 % + IVA).
-- Cargo = base × pct / (100 − pct)  → con 7,99 % el cargo es ≈ 8,68 % del viaje.
alter table rodar.viajes add column if not exists cargo_plataforma numeric not null default 0;

create or replace function rodar.cargo_plataforma(p_base numeric, p_medio text) returns numeric language sql stable set search_path = rodar, public, extensions as $$
  select case when coalesce((rodar.cfg('mp', '{}') ->> 'cargo_activo')::boolean, false) and coalesce(p_medio, '') <> 'cuenta_corriente' and coalesce(p_base, 0) > 0
    then round(p_base * least(50, greatest(0, coalesce(nullif(rodar.cfg('mp', '{}') ->> 'cargo_pct', '')::numeric, 7.99))) / (100 - least(50, greatest(0, coalesce(nullif(rodar.cfg('mp', '{}') ->> 'cargo_pct', '')::numeric, 7.99)))))
    else 0 end $$;
-- Parte de un total que ya incluye el cargo (precio fijo / monto cargado a mano)
create or replace function rodar.cargo_incluido(p_total numeric, p_medio text) returns numeric language sql stable set search_path = rodar, public, extensions as $$
  select case when rodar.cargo_plataforma(1000000, p_medio) > 0 and coalesce(p_total, 0) > 0
    then p_total - round(p_total * 1000000 / (1000000 + rodar.cargo_plataforma(1000000, p_medio))) else 0 end $$;

-- Activado: 7,99 % (comisión real cobrada por Mercado Pago en el primer pago, liberación en el momento)
do $$ begin
  perform rodar.cfg_set('mp', rodar.cfg('mp', '{}') || jsonb_build_object('cargo_activo', true, 'cargo_pct', coalesce(nullif(rodar.cfg('mp', '{}') ->> 'cargo_pct', '')::numeric, 7.99),
    'tasas', coalesce(rodar.cfg('mp', '{}') -> 'tasas', '{}') || jsonb_build_object('inmediata', 7.99)));
end $$;

-- Estimación: el precio que ve el pasajero / operador ya incluye el cargo
do $$
declare d text; a text := $q$  monto := round(monto * (1 + aj / 100.0));$q$; cp text;
begin
  d := pg_get_functiondef('rodar.estimar(double precision,double precision,double precision,double precision,text,text,double precision)'::regprocedure);
  if position('cargo_plataforma' in d) = 0 then
    if position(a in d) = 0 then raise exception 'estimar cambió'; end if;
    d := replace(d, a, a || $q$
  cp := case when dlat is null then 0 else rodar.cargo_plataforma(monto, p_medio) end;
  base := monto; monto := monto + cp;$q$);
    d := replace(d, 'recta numeric;', 'recta numeric; cp numeric := 0; base numeric;');
    d := replace(d, $q$'cobro', coalesce(c.cobro_modo, 'tarifado'));$q$, $q$'cobro', coalesce(c.cobro_modo, 'tarifado'), 'cargo_plataforma', cp, 'cargo_activo', rodar.cargo_plataforma(1000000, p_medio) > 0, 'base', case when dlat is null then null else base end);$q$);
    execute d;
  end if;
end $$;

-- Al finalizar: tarifado = viaje + cargo; precio fijo o monto cargado a mano = ya lo incluye
do $$
declare d text; a text := $q$  -- cargos pendientes del pasajero (cancelación tardía de reservas): se suman a este viaje$q$;
begin
  d := pg_get_functiondef('rodar.finalizar(bigint,numeric,numeric,numeric,double precision,double precision,text)'::regprocedure);
  if position('cplat' in d) = 0 then
    if position(a in d) = 0 or position('monto = total, km =' in d) = 0 then raise exception 'finalizar cambió'; end if;
    d := replace(d, a, $q$  -- cargos de la plataforma
  if total is not null and total > 0 then
    if p_monto is not null or (c.cobro_modo = 'fijo' and v.monto_estimado is not null) then cplat := rodar.cargo_incluido(total, v.medio_pago);
    else cplat := rodar.cargo_plataforma(total, v.medio_pago); total := total + cplat; end if;
  end if;
$q$ || a);
    d := replace(d, 'cargo numeric := 0;', 'cargo numeric := 0; cplat numeric := 0;');
    d := replace(d, 'monto = total, km =', 'monto = total, cargo_plataforma = cplat, km =');
    execute d;
  end if;
end $$;

-- Rendición de cobros que entraron a la cuenta de la central: el cargo queda para cubrir la comisión
do $$
declare d text; a text := $q$then p.comision else 0 end, 'Viaje #'$q$;
begin
  d := pg_get_functiondef('public.r_mp_viaje_op(text,jsonb,jsonb)'::regprocedure);
  if position('cargo_plataforma' in d) = 0 then
    if position(a in d) = 0 then raise exception 'r_mp_viaje_op cambió'; end if;
    execute replace(d, a, $q$then p.comision else coalesce((select cargo_plataforma from rodar.viajes where id = p.viaje_id), 0) end, 'Viaje #'$q$);
  end if;
end $$;

-- Comisión real de Mercado Pago (la informa el webhook con el detalle del pago)
create or replace function public.mp_comision(p_pago bigint, p_comision numeric) returns void language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  if p_comision is null or p_comision < 0 then return; end if;
  execute 'up' || 'date rodar.mp_pagos set comision = round($2, 2) where id = $1' using p_pago, p_comision;
end $$;
revoke all on function public.mp_comision(bigint, numeric) from public, anon, authenticated;
grant execute on function public.mp_comision(bigint, numeric) to service_role;

-- Pantalla "Viajes cobrados por Mercado Pago"
create or replace function public.r_mp_viajes(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
#variable_conflict use_variable
declare w text := 'p.tipo = ''viaje'''; e text; f jsonb; abs_movil boolean := coalesce(rodar.cfg('mp', '{}') ->> 'absorbe', '') = 'movil';
begin
  perform rodar.need(p_token, 'gestion');
  if rodar.t(p_q, 'desde') is not null then w := w || format(' and p.fecha >= %L::date', p_q ->> 'desde'); end if;
  if rodar.t(p_q, 'hasta') is not null then w := w || format(' and p.fecha < %L::date + 1', p_q ->> 'hasta'); end if;
  if rodar.n(p_q, 'movil') is not null then w := w || format(' and m.numero = %s', rodar.n(p_q, 'movil')); end if;
  e := case p_q ->> 'estado' when 'cobrados' then 'pagado' when 'pendientes' then 'pendiente' when 'cancelados' then 'cancelado' when 'reembolsados' then 'reembolsado' end;
  if e is not null then w := w || format(' and p.estado = %L', e); end if;
  -- directo: el dinero entra al conductor; MP descuenta su comisión y la central recibe la base (fee_central)
  -- a la central: entra todo a la cuenta de la central y se rinde al móvil (sin el cargo de la plataforma, o sin la comisión si la absorbe el móvil)
  f := rodar.lista(format($s$select x.*, case when x.directo then 0 else x.rinde end a_rendir,
      case when x.directo then round(x.monto - x.comision - coalesce(x.fee_central, 0), 2) else x.rinde end conductor,
      case when x.directo then coalesce(x.fee_central, 0) else round(x.monto - x.comision - x.rinde, 2) end central
    from (select p.*, m.numero, coalesce(v.cargo_plataforma, 0) cargo_plataforma,
      round(p.monto - case when %L::boolean then p.comision else coalesce(v.cargo_plataforma, 0) end, 2) rinde
      from rodar.mp_pagos p left join rodar.moviles m on m.id = p.movil_id left join rodar.viajes v on v.id = p.viaje_id where %s) x order by x.id desc$s$, abs_movil, w));
  return jsonb_build_object('filas', f, 'totales', (select jsonb_build_object(
    'cobrado', coalesce(sum((x ->> 'monto')::numeric) filter (where x ->> 'estado' = 'pagado'), 0),
    'cargos', coalesce(sum((x ->> 'cargo_plataforma')::numeric) filter (where x ->> 'estado' = 'pagado'), 0),
    'comision', coalesce(sum((x ->> 'comision')::numeric) filter (where x ->> 'estado' = 'pagado'), 0),
    'central', coalesce(sum((x ->> 'central')::numeric) filter (where x ->> 'estado' = 'pagado'), 0),
    'conductores', coalesce(sum((x ->> 'conductor')::numeric) filter (where x ->> 'estado' = 'pagado'), 0),
    'a_rendir', coalesce(sum((x ->> 'a_rendir')::numeric) filter (where x ->> 'estado' = 'pagado' and not (x ->> 'rendido')::boolean), 0),
    'disponible', coalesce(sum((x ->> 'a_rendir')::numeric) filter (where x ->> 'estado' = 'pagado' and not (x ->> 'rendido')::boolean and (x ->> 'liberacion')::date <= rodar.hoy()), 0),
    'pendiente_liberacion', coalesce(sum((x ->> 'monto')::numeric) filter (where x ->> 'estado' = 'pagado' and not coalesce((x ->> 'directo')::boolean, false) and (x ->> 'liberacion')::date > rodar.hoy()), 0),
    'reembolsado', coalesce(sum((x ->> 'monto')::numeric) filter (where x ->> 'estado' = 'reembolsado'), 0),
    'pend', count(*) filter (where x ->> 'estado' = 'pendiente'), 'canc', count(*) filter (where x ->> 'estado' = 'cancelado')) from jsonb_array_elements(f) x));
end $$;
notify pgrst, 'reload schema';
