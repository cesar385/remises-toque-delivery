-- Cancelación de viajes para ahora: sin cargo mientras ningún móvil lo aceptó; si ya hay chofer asignado y en camino,
-- se cobra pct_asignado % del viaje estimado (rodar.cfg('reservas').pct_asignado, por defecto 10). En una reserva que
-- ya tiene chofer en camino se cobra lo mayor entre las dos reglas.
create or replace function rodar.reservas_cfg() returns jsonb language sql stable set search_path = rodar, public as $$
  select jsonb_build_object('sin_cargo_min', 60, 'tardio_min', 30, 'pct_tardio', 20, 'ultimo_modo', 'cargo', 'pct_ultimo', 50, 'dias_penalizacion', 7, 'pct_asignado', 10)
    || coalesce(rodar.cfg('reservas', '{}'), '{}'::jsonb) $$;

create or replace function rodar.politica_cancelacion(v rodar.viajes) returns jsonb language plpgsql stable set search_path = rodar, public as $$
declare c jsonb := rodar.reservas_cfg(); mins numeric; tramo text := 'libre'; pct numeric := 0; pena boolean := false; base numeric := coalesce(v.monto_estimado, 0);
  asig boolean := v.estado = 'confirmado' and v.movil_id is not null; pa numeric := coalesce((c ->> 'pct_asignado')::numeric, 0);
begin
  if v.corporativo_id is not null or v.estado not in ('reserva', 'pendiente', 'ofrecido', 'confirmado') then
    return jsonb_build_object('aplica', false, 'tramo', 'libre', 'monto', 0, 'penaliza', false);
  end if;
  if v.programado is null then
    -- viaje para ahora
    if asig and pa > 0 then tramo := 'asignado'; pct := pa; end if;
    return jsonb_build_object('aplica', true, 'reserva', false, 'tramo', tramo, 'asignado', asig, 'pct', pct, 'base', base, 'monto', ceil(base * pct / 100), 'penaliza', false);
  end if;
  mins := round(extract(epoch from (v.programado - rodar.ahora())) / 60.0);
  if mins >= (c ->> 'sin_cargo_min')::numeric then tramo := 'libre';
  elsif mins >= (c ->> 'tardio_min')::numeric then tramo := 'tardio'; pct := (c ->> 'pct_tardio')::numeric;
  else tramo := 'ultimo';
    if c ->> 'ultimo_modo' in ('cargo', 'ambos') then pct := (c ->> 'pct_ultimo')::numeric; end if;
    pena := c ->> 'ultimo_modo' in ('penalizacion', 'ambos') and (c ->> 'dias_penalizacion')::int > 0;
  end if;
  if asig and pa > pct then pct := pa; if tramo = 'libre' then tramo := 'asignado'; end if; end if;
  return jsonb_build_object('aplica', true, 'reserva', true, 'tramo', tramo, 'asignado', asig, 'minutos', mins, 'pct', pct, 'base', base, 'monto', ceil(base * pct / 100),
    'penaliza', pena, 'dias', (c ->> 'dias_penalizacion')::int, 'programado', v.programado);
end $$;

-- El motivo del cargo dice si fue reserva o viaje con chofer en camino
do $$
declare d text; a text := $q$'Cancelación tardía de la reserva #' || v.id || ' (' || (pol ->> 'pct') || '% del viaje)'$q$;
begin
  d := pg_get_functiondef('rodar.cancelar_por_cliente(rodar.viajes,text)'::regprocedure);
  if position('chofer en camino' in d) = 0 then
    if position(a in d) = 0 then raise exception 'cancelar_por_cliente cambió'; end if;
    execute replace(d, a, $q$case when (pol ->> 'tramo') = 'asignado' then 'Cancelación del viaje #' || v.id || ' con el chofer en camino' else 'Cancelación tardía de la reserva #' || v.id end || ' (' || (pol ->> 'pct') || '% del viaje)'$q$);
  end if;
end $$;

-- Guardar: también el porcentaje con chofer asignado (sin perder lo demás)
do $$
declare d text;
begin
  d := pg_get_functiondef('public.r_reservas_guardar(text,jsonb,jsonb)'::regprocedure);
  if position('pct_asignado' in d) = 0 then
    d := replace(d, $q$dias int := coalesce(rodar.n(p_b, 'dias_penalizacion')::int, 0);$q$, $q$dias int := coalesce(rodar.n(p_b, 'dias_penalizacion')::int, 0); p3 numeric := coalesce(rodar.n(p_b, 'pct_asignado'), 0);$q$);
    d := replace(d, $q$if p1 < 0 or p1 > 100 or p2 < 0 or p2 > 100 then$q$, $q$if p1 < 0 or p1 > 100 or p2 < 0 or p2 > 100 or p3 < 0 or p3 > 100 then$q$);
    d := replace(d, $q$'dias_penalizacion', dias);$q$, $q$'dias_penalizacion', dias, 'pct_asignado', p3);$q$);
    if position('p3 numeric' in d) = 0 or position($q$'pct_asignado', p3$q$ in d) = 0 then raise exception 'r_reservas_guardar cambió'; end if;
    execute d;
  end if;
end $$;

-- Plazo para cancelar desde la app: mientras se busca móvil se puede cancelar siempre (gratis); con chofer en camino
-- también (con el cargo). El plazo viejo (cancelar_minutos) solo queda si el porcentaje con chofer asignado es 0.
do $$
declare d text; a text := $q$if v.estado = 'reserva' or mins <= 0 then return null; end if;$q$;
begin
  d := pg_get_functiondef('rodar.cancelar_restante(rodar.viajes)'::regprocedure);
  if position('pct_asignado' in d) = 0 then
    if position(a in d) = 0 then raise exception 'cancelar_restante cambió'; end if;
    execute replace(d, a, $q$if v.estado in ('reserva', 'pendiente', 'ofrecido') or mins <= 0 then return null; end if;
  if v.estado = 'confirmado' and coalesce((rodar.reservas_cfg() ->> 'pct_asignado')::numeric, 0) > 0 then return null; end if;$q$);
  end if;
end $$;
