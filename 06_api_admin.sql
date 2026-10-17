-- ===================== API: administración =====================

-- ---- Móviles ----
create or replace function public.r_moviles(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare w text := 'true'; total bigint; b text := rodar.t(p_q, 'buscar'); lim int := least(500, coalesce(rodar.n(p_q, 'limite'), 25)::int); off int := coalesce(rodar.n(p_q, 'offset'), 0)::int;
begin
  perform rodar.need(p_token, 'operador', 'gestion');
  if b is not null then w := format('(m.numero::text ilike %1$L or m.patente ilike %1$L or m.licencia ilike %1$L or (t.nombre || '' '' || t.apellido) ilike %1$L)', '%' || b || '%'); end if;
  execute 'select count(*) from rodar.moviles m left join rodar.usuarios t on t.id = m.titular_id where ' || w into total;
  return jsonb_build_object('total', total, 'filas', rodar.lista(format($q$select m.*, trim(t.nombre || ' ' || coalesce(t.apellido, '')) titular, t.documento titular_doc, p.descripcion plan,
    coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'nombre', trim(u.nombre || ' ' || coalesce(u.apellido, '')), 'documento', u.documento)) from rodar.movil_conductores mc join rodar.usuarios u on u.id = mc.usuario_id where mc.movil_id = m.id), '[]') conductores
    from rodar.moviles m left join rodar.usuarios t on t.id = m.titular_id left join rodar.planes p on p.id = m.plan_id where %s order by m.numero limit %s offset %s$q$, w, lim, off)));
end $$;
create or replace function public.r_movil_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); vid bigint := rodar.n(p_b, 'id')::bigint; prev rodar.moviles; hab boolean; c text;
begin
  if rodar.n(p_b, 'numero') is null then raise exception 'Indicá el número de móvil'; end if;
  if exists(select 1 from rodar.moviles where numero = rodar.n(p_b, 'numero') and id <> coalesce(vid, 0)) then raise exception 'Ya existe el móvil %', p_b ->> 'numero'; end if;
  hab := not (p_b ? 'habilitado') or rodar.b(p_b, 'habilitado');
  if vid is not null then
    select * into prev from rodar.moviles where id = vid;
    update rodar.moviles set numero = rodar.n(p_b, 'numero')::int, patente = rodar.t(p_b, 'patente'), licencia = rodar.t(p_b, 'licencia'), marca = rodar.t(p_b, 'marca'), modelo = rodar.t(p_b, 'modelo'),
      anio = rodar.n(p_b, 'anio')::int, color = rodar.t(p_b, 'color'), titular_id = rodar.n(p_b, 'titular_id')::bigint, tarifador = rodar.b(p_b, 'tarifador'), exigir_obd = rodar.b(p_b, 'exigir_obd'),
      habilitado = hab, simulado = rodar.b(p_b, 'simulado'), docs = coalesce((p_b -> 'docs')::text, '[]') where id = vid;
    if prev.habilitado <> hab then perform rodar.historial_movil(vid, case when hab then 'alta' else 'baja' end, rodar.nombre(u), case when hab then 'Habilitado' else 'Inhabilitado' end); end if;
  else
    insert into rodar.moviles(numero, patente, licencia, marca, modelo, anio, color, titular_id, tarifador, exigir_obd, habilitado, simulado, docs, plan_id)
    values (rodar.n(p_b, 'numero')::int, rodar.t(p_b, 'patente'), rodar.t(p_b, 'licencia'), rodar.t(p_b, 'marca'), rodar.t(p_b, 'modelo'), rodar.n(p_b, 'anio')::int, rodar.t(p_b, 'color'),
      rodar.n(p_b, 'titular_id')::bigint, rodar.b(p_b, 'tarifador'), rodar.b(p_b, 'exigir_obd'), hab, rodar.b(p_b, 'simulado'), coalesce((p_b -> 'docs')::text, '[]'), (select id from rodar.planes where sistema limit 1))
    returning id into vid;
    perform rodar.historial_movil(vid, 'alta', rodar.nombre(u), 'Alta de móvil');
  end if;
  if jsonb_typeof(p_b -> 'conductores') = 'array' then
    delete from rodar.movil_conductores where movil_id = vid;
    for c in select jsonb_array_elements_text(p_b -> 'conductores') loop insert into rodar.movil_conductores values (vid, c::bigint) on conflict do nothing; end loop;
  end if;
  perform rodar.emitir_movil(vid);
  return jsonb_build_object('id', vid);
end $$;

-- ---- Penalizados ----
create or replace function public.r_penalizados(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'operador', 'gestion');
  return rodar.lista('select p.*, m.numero, trim(u.nombre || '' '' || coalesce(u.apellido, '''')) usuario from rodar.penalizaciones p join rodar.moviles m on m.id = p.movil_id left join rodar.usuarios u on u.id = p.usuario_id where p.hasta > rodar.ahora() order by p.hasta');
end $$;
create or replace function public.r_penalizar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador', 'gestion'); m rodar.moviles; hasta timestamp;
begin
  select * into m from rodar.moviles where numero = rodar.n(p_b, 'numero');
  if not found then raise exception 'No existe el móvil'; end if;
  hasta := rodar.ahora() + make_interval(mins => coalesce(rodar.n(p_b, 'minutos'), 60)::int);
  insert into rodar.penalizaciones(movil_id, hasta, usuario_id, motivo, creado) values (m.id, hasta, u.id, rodar.t(p_b, 'motivo'), rodar.ahora());
  perform rodar.evento_movil(m.id, 'penalizado', null, 'Hasta ' || hasta || ': ' || coalesce(p_b ->> 'motivo', ''));
  perform rodar.emit('movil-' || m.id, 'mensaje', jsonb_build_object('de', 'Central', 'texto', 'Fuiste penalizado hasta ' || to_char(hasta, 'HH24:MI') || '. Motivo: ' || coalesce(p_b ->> 'motivo', '-')));
  perform rodar.emitir_movil(m.id);
  return '{"ok":true}';
end $$;
create or replace function public.r_penalizacion_quitar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare mid bigint;
begin
  perform rodar.need(p_token, 'operador', 'gestion');
  update rodar.penalizaciones set hasta = rodar.ahora() where id = (p_q ->> 'id')::bigint returning movil_id into mid;
  perform rodar.emitir_movil(mid); return '{"ok":true}';
end $$;

-- ---- Solicitudes de alta de conductor ----
create or replace function public.r_solicitudes(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare w text := 'true'; e text;
begin
  perform rodar.need(p_token, 'admin');
  e := case p_q ->> 'estado' when 'pendientes' then 'pendiente' when 'observadas' then 'observada' when 'precargadas' then 'precargada' when 'rechazadas' then 'rechazada' end;
  if e is not null then w := w || format(' and estado = %L', e); end if;
  if rodar.t(p_q, 'conductor') is not null then w := w || format(' and (nombre || '' '' || coalesce(apellido, '''')) ilike %L', '%' || (p_q ->> 'conductor') || '%'); end if;
  if rodar.t(p_q, 'dni') is not null then w := w || format(' and dni ilike %L', '%' || (p_q ->> 'dni') || '%'); end if;
  if rodar.t(p_q, 'patente') is not null then w := w || format(' and patente ilike %L', '%' || (p_q ->> 'patente') || '%'); end if;
  return rodar.lista('select * from rodar.solicitudes_conductor where ' || w || ' order by id desc');
end $$;
create or replace function public.r_solicitud_accion(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); s rodar.solicitudes_conductor; uid bigint; mid bigint; acc text := p_q ->> 'accion';
begin
  select * into s from rodar.solicitudes_conductor where id = (p_q ->> 'id')::bigint;
  if acc = 'observar' then update rodar.solicitudes_conductor set estado = 'observada', observacion = p_b ->> 'observacion' where id = s.id;
  elsif acc = 'rechazar' then update rodar.solicitudes_conductor set estado = 'rechazada', observacion = p_b ->> 'observacion' where id = s.id;
  elsif acc = 'precargar' then
    select id into uid from rodar.usuarios where documento = s.dni;
    if uid is null then
      insert into rodar.usuarios(documento, nombre, apellido, email, telefono, password_hash, roles, docs)
      values (s.dni, s.nombre, coalesce(s.apellido, ''), s.email, s.telefono, rodar.hash(right(s.dni, 6)), 'conductor', s.docs) returning id into uid;
    end if;
    if rodar.n(p_b, 'numero') is not null then
      select id into mid from rodar.moviles where numero = rodar.n(p_b, 'numero');
      if mid is null then
        insert into rodar.moviles(numero, patente, marca, modelo, anio, plan_id, habilitado) values (rodar.n(p_b, 'numero')::int, s.patente, s.marca, s.modelo, s.anio, (select id from rodar.planes where sistema limit 1), false) returning id into mid;
        perform rodar.historial_movil(mid, 'alta', rodar.nombre(u), 'Precargado desde solicitud (inhabilitado)');
      end if;
      insert into rodar.movil_conductores values (mid, uid) on conflict do nothing;
    end if;
    update rodar.solicitudes_conductor set estado = 'precargada' where id = s.id;
    perform rodar.accion(u, 'solicitud_precargada', s.dni, 'Clave inicial: últimos 6 del DNI');
  end if;
  return '{"ok":true}';
end $$;

-- ---- Zonas ----
create or replace function public.r_zonas(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.usuario(p_token); return rodar.lista('select * from rodar.zonas order by orden'); end $$;
create or replace function public.r_zona_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'admin');
  if rodar.n(p_b, 'id') is not null then
    update rodar.zonas set nombre = p_b ->> 'nombre', poligono = coalesce(p_b -> 'poligono', '[]'), color = coalesce(rodar.t(p_b, 'color'), color), parada_lat = (p_b ->> 'parada_lat')::float8,
      parada_lng = (p_b ->> 'parada_lng')::float8, es_parada = rodar.b(p_b, 'es_parada'), orden = coalesce(rodar.n(p_b, 'orden'), 0) where id = rodar.n(p_b, 'id');
  else
    insert into rodar.zonas(nombre, poligono, color, parada_lat, parada_lng, es_parada, orden) values (p_b ->> 'nombre', coalesce(p_b -> 'poligono', '[]'), coalesce(rodar.t(p_b, 'color'), '#1f8a8a'),
      (p_b ->> 'parada_lat')::float8, (p_b ->> 'parada_lng')::float8, rodar.b(p_b, 'es_parada'), coalesce(rodar.n(p_b, 'orden'), 99));
  end if;
  perform rodar.emit('panel', 'zonas', '{}'); perform rodar.emit('flota', 'zonas', '{}');
  return '{"ok":true}';
end $$;
create or replace function public.r_zona_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); delete from rodar.zonas where id = (p_q ->> 'id')::bigint; return '{"ok":true}'; end $$;
create or replace function public.r_peligrosas(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.usuario(p_token); return rodar.lista('select * from rodar.zonas_peligrosas order by id'); end $$;
create or replace function public.r_peligrosa_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'admin');
  if rodar.n(p_b, 'id') is not null then update rodar.zonas_peligrosas set nombre = p_b ->> 'nombre', poligono = p_b -> 'poligono' where id = rodar.n(p_b, 'id');
  else insert into rodar.zonas_peligrosas(nombre, poligono, creado) values (coalesce(rodar.t(p_b, 'nombre'), 'Zona peligrosa'), p_b -> 'poligono', rodar.ahora()); end if;
  perform rodar.emit('flota', 'zonas', '{}');
  return '{"ok":true}';
end $$;
create or replace function public.r_peligrosa_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); delete from rodar.zonas_peligrosas where id = (p_q ->> 'id')::bigint; return '{"ok":true}'; end $$;

-- ---- Cuentas ----
create or replace function public.r_cuentas(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare f text := coalesce(rodar.t(p_q, 'filtro'), 'todos'); filas jsonb; r jsonb;
begin
  perform rodar.need(p_token, 'gestion');
  with base as (
    select m.id, m.numero, trim(t.nombre || ' ' || coalesce(t.apellido, '')) titular, t.documento titular_doc, m.habilitado, rodar.estado_cuenta(m) ec
    from rodar.moviles m left join rodar.usuarios t on t.id = m.titular_id where rodar.n(p_q, 'numero') is null or m.numero = rodar.n(p_q, 'numero')),
  x as (select id, numero, titular, titular_doc, habilitado, (ec ->> 'saldo')::numeric saldo, ec ->> 'color' color, ec ->> 'texto' estado,
      coalesce(ec -> 'plan' ->> 'descripcion', 'Sin plan') plan, (ec -> 'plan' is null or ec -> 'plan' = 'null' or (ec -> 'plan' ->> 'sistema')::boolean) sin_plan, ec ->> 'prorroga' prorroga from base),
  y as (select * from x where f = 'todos' or (f = 'activos' and habilitado) or (f = 'inactivos' and not habilitado) or (f = 'con_plan' and habilitado and not sin_plan) or (f = 'sin_plan' and habilitado and sin_plan))
  select coalesce(jsonb_agg(to_jsonb(y) order by numero), '[]'),
    jsonb_build_object('moviles', count(*), 'falta', coalesce(sum(case when saldo < 0 then -saldo else 0 end), 0), 'al_dia', count(*) filter (where color = 'verde'),
      'deuda', count(*) filter (where saldo < 0), 'bloqueados', count(*) filter (where color = 'rojo'), 'sin_plan', count(*) filter (where sin_plan),
      'pct', case when count(*) = 0 then 0 else round(count(*) filter (where color = 'verde') * 100.0 / count(*), 1) end)
  into filas, r from y;
  return jsonb_build_object('filas', filas, 'resumen', r);
end $$;
create or replace function public.r_cuenta(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); m rodar.moviles; ec jsonb; pv numeric;
begin
  select * into m from rodar.moviles where id = (p_q ->> 'id')::bigint;
  if not found then raise exception 'No existe'; end if;
  if not rodar.tiene(u, 'gestion') and m.titular_id is distinct from u.id then raise exception 'Sin permiso'; end if;
  ec := rodar.estado_cuenta(m);
  pv := (ec -> 'plan' ->> 'monto_viaje')::numeric;
  return ec || jsonb_build_object('movil', jsonb_build_object('id', m.id, 'numero', m.numero, 'plan_id', m.plan_id),
    'viajes_disponibles', case when pv > 0 then greatest(0, floor((ec ->> 'saldo')::numeric / pv)) end,
    'movimientos', rodar.lista(format('select c.*, u.nombre usuario from rodar.cuenta_movimientos c left join rodar.usuarios u on u.id = c.usuario_id where movil_id = %s order by c.fecha desc, c.id desc limit %s', m.id, coalesce(rodar.n(p_q, 'limite'), 200))));
end $$;
create or replace function public.r_cuenta_op(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'gestion'); vid bigint := (p_q ->> 'id')::bigint; op text := p_q ->> 'op'; monto numeric := abs(coalesce(rodar.n(p_b, 'monto'), 0)); m rodar.moviles; p rodar.planes;
begin
  select * into m from rodar.moviles where id = vid;
  if op in ('pago', 'retiro', 'bonificacion') and monto = 0 then raise exception 'Monto inválido'; end if;
  if op = 'pago' then perform rodar.registrar_pago(vid, monto, coalesce(rodar.t(p_b, 'detalle'), 'Pago'), u.id);
  elsif op = 'retiro' then perform rodar.movimiento(vid, 'retiro', -monto, coalesce(rodar.t(p_b, 'detalle'), 'Retiro'), u.id, null);
  elsif op = 'bonificacion' then perform rodar.movimiento(vid, 'bonificacion', monto, coalesce(rodar.t(p_b, 'detalle'), 'Bonificación'), u.id, null);
  elsif op = 'ajuste' then perform rodar.movimiento(vid, 'ajuste', rodar.n(p_b, 'monto'), coalesce(rodar.t(p_b, 'detalle'), 'Ajuste'), u.id, null);
  elsif op = 'prorroga' then update rodar.moviles set prorroga_hasta = rodar.ts(p_b, 'hasta') where id = vid; perform rodar.accion(u, 'prorroga', 'Móvil ' || m.numero, 'Hasta ' || (p_b ->> 'hasta'));
  elsif op = 'plan' then
    select * into p from rodar.planes where id = rodar.n(p_b, 'plan_id');
    update rodar.moviles set plan_id = p.id where id = vid;
    perform rodar.accion(u, case when p.sistema then 'plan_movil_quitado' else 'plan_movil_cambiado' end, 'Móvil ' || m.numero, p.descripcion);
    perform rodar.historial_movil(vid, 'plan', rodar.nombre(u), 'Plan: ' || p.descripcion);
  else raise exception 'Operación desconocida'; end if;
  perform rodar.emitir_movil(vid);
  return '{"ok":true}';
end $$;

-- ---- Mercado Pago ----
create or replace function public.r_mp_recargas(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare w text := 'p.tipo = ''recarga'''; e text; f jsonb;
begin
  perform rodar.need(p_token, 'gestion');
  if rodar.t(p_q, 'desde') is not null then w := w || format(' and p.fecha >= %L::date', p_q ->> 'desde'); end if;
  if rodar.t(p_q, 'hasta') is not null then w := w || format(' and p.fecha < %L::date + 1', p_q ->> 'hasta'); end if;
  if rodar.n(p_q, 'movil') is not null then w := w || format(' and m.numero = %s', rodar.n(p_q, 'movil')); end if;
  e := case p_q ->> 'estado' when 'pagados' then 'pagado' when 'pendientes' then 'pendiente' when 'cancelados' then 'cancelado' when 'reembolsados' then 'reembolsado' end;
  if e is not null then w := w || format(' and p.estado = %L', e); end if;
  f := rodar.lista('select p.*, m.numero from rodar.mp_pagos p left join rodar.moviles m on m.id = p.movil_id where ' || w || ' order by p.id desc');
  return jsonb_build_object('filas', f, 'totales', (select jsonb_build_object(
    'pagado', coalesce(sum((x ->> 'monto')::numeric) filter (where x ->> 'estado' = 'pagado'), 0), 'acreditado', coalesce(sum((x ->> 'monto')::numeric) filter (where (x ->> 'acreditado')::boolean), 0),
    'pendiente', coalesce(sum((x ->> 'monto')::numeric) filter (where x ->> 'estado' = 'pendiente'), 0),
    'liberado', coalesce(sum((x ->> 'monto')::numeric) filter (where x ->> 'estado' = 'pagado' and (x ->> 'liberacion')::date <= rodar.hoy()), 0)) from jsonb_array_elements(f) x));
end $$;
-- Consultar pago: sin servidor no se puede consultar a Mercado Pago con el token secreto; se marca a mano (o lo hace la Edge Function opcional)
create or replace function public.r_mp_consultar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'gestion'); p rodar.mp_pagos;
begin
  if rodar.b(p_b, 'simular') then
    update rodar.mp_pagos set estado = 'pagado', medio = coalesce(medio, 'manual'), mp_id = coalesce(mp_id, 'MANUAL-' || id), liberacion = rodar.hoy() where id = (p_q ->> 'id')::bigint;
  end if;
  select * into p from rodar.mp_pagos where id = (p_q ->> 'id')::bigint;
  if p.tipo = 'recarga' and p.estado = 'pagado' and not p.acreditado then
    perform rodar.registrar_pago(p.movil_id, p.monto, 'Carga de saldo Mercado Pago #' || coalesce(p.mp_id, p.id::text), u.id, 'carga_mp');
    update rodar.mp_pagos set acreditado = true where id = p.id;
  end if;
  return (select to_jsonb(x) from rodar.mp_pagos x where id = p.id);
end $$;
create or replace function public.r_mp_viajes(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare w text := 'p.tipo = ''viaje'''; e text; f jsonb; abs_movil boolean := coalesce(rodar.cfg('mp', '{}') ->> 'absorbe', '') = 'movil';
begin
  perform rodar.need(p_token, 'gestion');
  if rodar.t(p_q, 'desde') is not null then w := w || format(' and p.fecha >= %L::date', p_q ->> 'desde'); end if;
  if rodar.t(p_q, 'hasta') is not null then w := w || format(' and p.fecha < %L::date + 1', p_q ->> 'hasta'); end if;
  if rodar.n(p_q, 'movil') is not null then w := w || format(' and m.numero = %s', rodar.n(p_q, 'movil')); end if;
  e := case p_q ->> 'estado' when 'cobrados' then 'pagado' when 'pendientes' then 'pendiente' when 'cancelados' then 'cancelado' when 'reembolsados' then 'reembolsado' end;
  if e is not null then w := w || format(' and p.estado = %L', e); end if;
  f := rodar.lista(format('select p.*, m.numero, round(p.monto - p.comision, 2) central, case when %L::boolean then round(p.monto - p.comision, 2) else p.monto end a_rendir from rodar.mp_pagos p left join rodar.moviles m on m.id = p.movil_id where %s order by p.id desc', abs_movil, w));
  return jsonb_build_object('filas', f, 'totales', (select jsonb_build_object(
    'cobrado', coalesce(sum((x ->> 'monto')::numeric) filter (where x ->> 'estado' = 'pagado'), 0),
    'central', coalesce(sum((x ->> 'central')::numeric) filter (where x ->> 'estado' = 'pagado'), 0),
    'a_rendir', coalesce(sum((x ->> 'a_rendir')::numeric) filter (where x ->> 'estado' = 'pagado' and not (x ->> 'rendido')::boolean), 0),
    'disponible', coalesce(sum((x ->> 'a_rendir')::numeric) filter (where x ->> 'estado' = 'pagado' and not (x ->> 'rendido')::boolean and (x ->> 'liberacion')::date <= rodar.hoy()), 0),
    'pendiente_liberacion', coalesce(sum((x ->> 'monto')::numeric) filter (where x ->> 'estado' = 'pagado' and (x ->> 'liberacion')::date > rodar.hoy()), 0),
    'reembolsado', coalesce(sum((x ->> 'monto')::numeric) filter (where x ->> 'estado' = 'reembolsado'), 0),
    'pend', count(*) filter (where x ->> 'estado' = 'pendiente'), 'canc', count(*) filter (where x ->> 'estado' = 'cancelado')) from jsonb_array_elements(f) x));
end $$;
create or replace function public.r_mp_viaje_op(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare p rodar.mp_pagos; op text := p_q ->> 'op';
begin
  perform rodar.need(p_token, 'gestion');
  select * into p from rodar.mp_pagos where id = (p_q ->> 'id')::bigint;
  if op = 'rendir' and p.estado = 'pagado' and not p.rendido then
    update rodar.mp_pagos set rendido = true where id = p.id;
    insert into rodar.mp_saldo_mov(movil_id, fecha, tipo, monto, detalle) values (p.movil_id, rodar.ahora(), 'credito', p.monto - case when rodar.cfg('mp', '{}') ->> 'absorbe' = 'movil' then p.comision else 0 end, 'Viaje #' || p.viaje_id);
  elsif op = 'reembolsar' then update rodar.mp_pagos set estado = 'reembolsado' where id = p.id;
  elsif op = 'marcar_pagado' then update rodar.mp_pagos set estado = 'pagado', acreditado = true where id = p.id; end if;
  return '{"ok":true}';
end $$;
create or replace function public.r_mp_saldos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'gestion'); return rodar.lista('select m.id, m.numero, coalesce(sum(s.monto), 0) saldo from rodar.moviles m join rodar.mp_saldo_mov s on s.movil_id = m.id group by m.id order by m.numero'); end $$;
create or replace function public.r_mp_saldo(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'gestion'); return rodar.lista('select * from rodar.mp_saldo_mov where movil_id = ' || (p_q ->> 'id')::bigint || ' order by id desc'); end $$;
create or replace function public.r_mp_saldo_aplicar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'gestion'); vid bigint := (p_q ->> 'id')::bigint; s numeric; monto numeric;
begin
  select coalesce(sum(x.monto), 0) into s from rodar.mp_saldo_mov x where movil_id = vid;
  monto := least(s, coalesce(rodar.n(p_b, 'monto'), s));
  if monto <= 0 then raise exception 'Sin saldo para aplicar'; end if;
  insert into rodar.mp_saldo_mov(movil_id, fecha, tipo, monto, detalle) values (vid, rodar.ahora(), 'aplicado_cuota', -monto, 'Aplicado a cuota');
  perform rodar.registrar_pago(vid, monto, 'Aplicación de saldo Mercado Pago', u.id, 'aplicacion_mp');
  return '{"ok":true}';
end $$;
create or replace function public.r_mp_saldo_retiro(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'gestion');
  insert into rodar.mp_saldo_mov(movil_id, fecha, tipo, monto, detalle) values ((p_q ->> 'id')::bigint, rodar.ahora(), 'pago_movil', -abs(coalesce(rodar.n(p_b, 'monto'), 0)), coalesce(rodar.t(p_b, 'detalle'), 'Pago al móvil'));
  return '{"ok":true}';
end $$;

-- ---- Medios de pago y módulos ----
create or replace function public.r_medios(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare mp jsonb := rodar.cfg('mp', '{}');
begin
  perform rodar.need(p_token, 'admin');
  return jsonb_build_object('medios', rodar.lista('select * from rodar.medios_pago order by orden'),
    'mp', mp || jsonb_build_object('access_token', case when coalesce(mp ->> 'access_token', '') <> '' then '••••' else '' end));
end $$;
create or replace function public.r_medios_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare x jsonb; cur jsonb := rodar.cfg('mp', '{}'); n jsonb;
begin
  perform rodar.need(p_token, 'admin');
  for x in select jsonb_array_elements(coalesce(p_b -> 'medios', '[]')) loop
    update rodar.medios_pago set habilitado = rodar.b(x, 'habilitado'), ajuste_pct = coalesce(rodar.n(x, 'ajuste_pct'), 0), aplica_promo = rodar.b(x, 'aplica_promo') where codigo = x ->> 'codigo';
  end loop;
  if p_b ? 'mp' then
    n := cur || (p_b -> 'mp');
    if coalesce(p_b -> 'mp' ->> 'access_token', '') in ('', '••••') then n := n || jsonb_build_object('access_token', coalesce(cur ->> 'access_token', '')); end if;
    n := n || jsonb_build_object('vinculado', coalesce(n ->> 'access_token', '') <> '');
    perform rodar.cfg_set('mp', n);
  end if;
  return '{"ok":true}';
end $$;
create or replace function public.r_modulos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'admin');
  return jsonb_build_object('modulos', rodar.lista('select * from rodar.modulos'), 'moviles_estimados', (select count(*) from rodar.moviles where habilitado));
end $$;
create or replace function public.r_modulos_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare x jsonb;
begin
  perform rodar.need(p_token, 'admin');
  for x in select jsonb_array_elements(p_b) loop
    update rodar.modulos set activo_prox = rodar.b(x, 'activo_prox'), cantidad = coalesce(rodar.n(x, 'cantidad'), 1) where codigo = x ->> 'codigo' and not obligatorio;
  end loop;
  return '{"ok":true}';
end $$;

-- ---- Planes ----
create or replace function public.r_planes(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'gestion'); return rodar.lista('select p.*, (select count(*) from rodar.moviles where plan_id = p.id) moviles from rodar.planes p order by sistema desc, id'); end $$;
create or replace function public.r_plan_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'gestion'); mc text := coalesce(rodar.t(p_b, 'modo_cobro'), 'fijo');
begin
  if rodar.n(p_b, 'id') is not null then
    update rodar.planes set descripcion = p_b ->> 'descripcion', modo_pago = coalesce(rodar.t(p_b, 'modo_pago'), 'prepago'), modo_cobro = mc, tipo1 = rodar.b(p_b, 'tipo1'), vencer_saldo = rodar.b(p_b, 'vencer_saldo'),
      monto_fijo = coalesce(rodar.n(p_b, 'monto_fijo'), 0), monto_viaje = case when mc = 'fijo' then 0 else coalesce(rodar.n(p_b, 'monto_viaje'), 0) end, pct_viaje = case when mc = 'fijo' then 0 else coalesce(rodar.n(p_b, 'pct_viaje'), 0) end,
      periodicidad = coalesce(rodar.t(p_b, 'periodicidad'), 'mensual'), dia_semana = coalesce(rodar.n(p_b, 'dia_semana'), 0), dia_mes = least(28, greatest(1, coalesce(rodar.n(p_b, 'dia_mes'), 1))),
      hora_cobro = least(23, greatest(0, coalesce(rodar.n(p_b, 'hora_cobro'), 0))), horas_bloqueo = coalesce(rodar.n(p_b, 'horas_bloqueo'), 0), minimo = coalesce(rodar.n(p_b, 'minimo'), 0) where id = rodar.n(p_b, 'id');
    perform rodar.accion(u, 'plan_modificado', p_b ->> 'descripcion', null);
  else
    insert into rodar.planes(descripcion, modo_pago, modo_cobro, tipo1, vencer_saldo, monto_fijo, monto_viaje, pct_viaje, periodicidad, dia_semana, dia_mes, hora_cobro, horas_bloqueo, minimo)
    values (p_b ->> 'descripcion', coalesce(rodar.t(p_b, 'modo_pago'), 'prepago'), mc, rodar.b(p_b, 'tipo1'), rodar.b(p_b, 'vencer_saldo'), coalesce(rodar.n(p_b, 'monto_fijo'), 0),
      case when mc = 'fijo' then 0 else coalesce(rodar.n(p_b, 'monto_viaje'), 0) end, case when mc = 'fijo' then 0 else coalesce(rodar.n(p_b, 'pct_viaje'), 0) end,
      coalesce(rodar.t(p_b, 'periodicidad'), 'mensual'), coalesce(rodar.n(p_b, 'dia_semana'), 0), least(28, greatest(1, coalesce(rodar.n(p_b, 'dia_mes'), 1))),
      least(23, greatest(0, coalesce(rodar.n(p_b, 'hora_cobro'), 0))), coalesce(rodar.n(p_b, 'horas_bloqueo'), 0), coalesce(rodar.n(p_b, 'minimo'), 0));
    perform rodar.accion(u, 'plan_creado', p_b ->> 'descripcion', null);
  end if;
  return '{"ok":true}';
end $$;
create or replace function public.r_plan_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'gestion'); p rodar.planes;
begin
  select * into p from rodar.planes where id = (p_q ->> 'id')::bigint;
  if p.sistema then raise exception 'No se puede eliminar el plan del sistema'; end if;
  update rodar.moviles set plan_id = (select id from rodar.planes where sistema limit 1) where plan_id = p.id;
  delete from rodar.planes where id = p.id;
  perform rodar.accion(u, 'plan_eliminado', p.descripcion, null);
  return '{"ok":true}';
end $$;

-- ---- Tarifas ----
create or replace function public.r_tarifas(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare t rodar.tarifas;
begin
  perform rodar.usuario(p_token);
  t := rodar.tarifa_vigente();
  return jsonb_build_object('tarifas', rodar.lista('select * from rodar.tarifas order by orden'), 'vigente', case when t.id is null then null else to_jsonb(t) end,
    'indice', rodar.indice_zona(null, t), 'clima', coalesce(rodar.cfg('clima'), '{"temp":null,"desc":"—"}'));
end $$;
create or replace function public.r_tarifa_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare dias text := coalesce((p_b -> 'dias')::text, '[]');
begin
  perform rodar.need(p_token, 'admin');
  if jsonb_typeof(p_b -> 'dias') = 'string' then dias := p_b ->> 'dias'; end if;
  if rodar.n(p_b, 'id') is not null then
    update rodar.tarifas set orden = coalesce(rodar.n(p_b, 'orden'), 1), nombre = p_b ->> 'nombre', tipo = coalesce(rodar.t(p_b, 'tipo'), 'fija'), activa = rodar.b(p_b, 'activa'), bajada = coalesce(rodar.n(p_b, 'bajada'), 0),
      suba_max = coalesce(rodar.n(p_b, 'suba_max'), 0), baja_max = coalesce(rodar.n(p_b, 'baja_max'), 0), con_espera = rodar.b(p_b, 'con_espera'), espera_seg = coalesce(rodar.n(p_b, 'espera_seg'), 60),
      precio_ficha = coalesce(rodar.n(p_b, 'precio_ficha'), 0), cortesia_mts = coalesce(rodar.n(p_b, 'cortesia_mts'), 0), cortesia_min = coalesce(rodar.n(p_b, 'cortesia_min'), 0), dias = dias,
      feriado = rodar.b(p_b, 'feriado'), hora_desde = coalesce(rodar.t(p_b, 'hora_desde'), '00:00'), hora_hasta = coalesce(rodar.t(p_b, 'hora_hasta'), '23:59'),
      redondeo_mts = coalesce(rodar.n(p_b, 'redondeo_mts'), 100), ficha_mts = coalesce(rodar.n(p_b, 'ficha_mts'), 100) where id = rodar.n(p_b, 'id');
  else
    insert into rodar.tarifas(orden, nombre, tipo, activa, bajada, suba_max, baja_max, con_espera, espera_seg, precio_ficha, cortesia_mts, cortesia_min, dias, feriado, hora_desde, hora_hasta, redondeo_mts, ficha_mts)
    values (coalesce(rodar.n(p_b, 'orden'), 1), p_b ->> 'nombre', coalesce(rodar.t(p_b, 'tipo'), 'fija'), rodar.b(p_b, 'activa'), coalesce(rodar.n(p_b, 'bajada'), 0), coalesce(rodar.n(p_b, 'suba_max'), 0),
      coalesce(rodar.n(p_b, 'baja_max'), 0), rodar.b(p_b, 'con_espera'), coalesce(rodar.n(p_b, 'espera_seg'), 60), coalesce(rodar.n(p_b, 'precio_ficha'), 0), coalesce(rodar.n(p_b, 'cortesia_mts'), 0),
      coalesce(rodar.n(p_b, 'cortesia_min'), 0), dias, rodar.b(p_b, 'feriado'), coalesce(rodar.t(p_b, 'hora_desde'), '00:00'), coalesce(rodar.t(p_b, 'hora_hasta'), '23:59'),
      coalesce(rodar.n(p_b, 'redondeo_mts'), 100), coalesce(rodar.n(p_b, 'ficha_mts'), 100));
  end if;
  perform rodar.emit('flota', 'tarifas', '{}');
  return '{"ok":true}';
end $$;
create or replace function public.r_tarifa_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); delete from rodar.tarifas where id = (p_q ->> 'id')::bigint; return '{"ok":true}'; end $$;

-- ---- Usuarios y corporativos ----
create or replace function public.r_usuarios(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare w text := 'true'; total bigint; lim int := least(500, coalesce(rodar.n(p_q, 'limite'), 25)::int); off int := coalesce(rodar.n(p_q, 'offset'), 0)::int;
begin
  perform rodar.need(p_token, 'operador', 'gestion');
  if rodar.t(p_q, 'buscar') is not null then w := w || format(' and (documento ilike %1$L or (nombre || '' '' || apellido) ilike %1$L or usuario ilike %1$L)', '%' || (p_q ->> 'buscar') || '%'); end if;
  if rodar.t(p_q, 'permiso') is not null then w := w || format(' and %L = any(string_to_array(roles, '',''))', p_q ->> 'permiso'); end if;
  execute 'select count(*) from rodar.usuarios where ' || w into total;
  return jsonb_build_object('total', total, 'filas', rodar.lista(format($q$select id, documento, usuario, nombre, apellido, email, telefono, roles, habilitado, foto, corporativo_id, licencia_vence, docs,
    coalesce((select jsonb_agg(n order by n) from (select numero n from rodar.moviles where titular_id = u.id union select m.numero from rodar.movil_conductores mc join rodar.moviles m on m.id = mc.movil_id where mc.usuario_id = u.id) z), '[]') moviles
    from rodar.usuarios u where %s order by nombre, apellido limit %s offset %s$q$, w, lim, off)));
end $$;
create or replace function public.r_usuario_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); vid bigint := rodar.n(p_b, 'id')::bigint; roles text; prev rodar.usuarios; hab boolean;
begin
  if rodar.t(p_b, 'documento') is null or rodar.t(p_b, 'nombre') is null then raise exception 'Documento y nombre son obligatorios'; end if;
  if exists(select 1 from rodar.usuarios where documento = p_b ->> 'documento' and id <> coalesce(vid, 0)) then raise exception 'Ya existe un usuario con ese documento'; end if;
  if rodar.t(p_b, 'usuario') is not null and exists(select 1 from rodar.usuarios where usuario = p_b ->> 'usuario' and id <> coalesce(vid, 0)) then raise exception 'Ese nombre de usuario ya está en uso'; end if;
  select coalesce(string_agg(x, ','), 'operador') into roles from jsonb_array_elements_text(coalesce(p_b -> 'roles', '["operador"]')) x;
  hab := not (p_b ? 'habilitado') or rodar.b(p_b, 'habilitado');
  if vid is not null then
    select * into prev from rodar.usuarios where id = vid;
    update rodar.usuarios set documento = p_b ->> 'documento', usuario = rodar.t(p_b, 'usuario'), nombre = p_b ->> 'nombre', apellido = coalesce(p_b ->> 'apellido', ''), email = rodar.t(p_b, 'email'),
      telefono = rodar.t(p_b, 'telefono'), roles = roles, habilitado = hab, corporativo_id = rodar.n(p_b, 'corporativo_id')::bigint, licencia_vence = rodar.t(p_b, 'licencia_vence')::date,
      docs = coalesce((p_b -> 'docs')::text, '[]'), foto = coalesce(rodar.t(p_b, 'foto'), foto) where id = vid;
    if prev.roles <> roles then perform rodar.accion(u, 'usuario_permisos_modificados', p_b ->> 'documento', prev.roles || ' → ' || roles); end if;
    if rodar.t(p_b, 'password') is not null then update rodar.usuarios set password_hash = rodar.hash(p_b ->> 'password') where id = vid; end if;
    if not hab then update rodar.sesiones set activa = false where usuario_id = vid; end if;
    return jsonb_build_object('id', vid);
  end if;
  insert into rodar.usuarios(documento, usuario, nombre, apellido, email, telefono, roles, habilitado, corporativo_id, licencia_vence, docs, foto, password_hash)
  values (p_b ->> 'documento', rodar.t(p_b, 'usuario'), p_b ->> 'nombre', coalesce(p_b ->> 'apellido', ''), rodar.t(p_b, 'email'), rodar.t(p_b, 'telefono'), roles, hab,
    rodar.n(p_b, 'corporativo_id')::bigint, rodar.t(p_b, 'licencia_vence')::date, coalesce((p_b -> 'docs')::text, '[]'), rodar.t(p_b, 'foto'), rodar.hash(coalesce(rodar.t(p_b, 'password'), p_b ->> 'documento')))
  returning id into vid;
  perform rodar.accion(u, 'usuario_creado', p_b ->> 'documento', roles);
  return jsonb_build_object('id', vid);
end $$;
create or replace function public.r_usuario_reset(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); x rodar.usuarios;
begin
  select * into x from rodar.usuarios where id = (p_q ->> 'id')::bigint;
  update rodar.usuarios set password_hash = rodar.hash(coalesce(rodar.t(p_b, 'password'), x.documento)) where id = x.id;
  perform rodar.accion(u, 'password_reset_admin', x.documento, null);
  return '{"ok":true}';
end $$;
create or replace function public.r_corporativos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); return rodar.lista('select * from rodar.corporativos order by nombre'); end $$;
create or replace function public.r_corporativo_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'admin');
  if rodar.n(p_b, 'id') is not null then
    update rodar.corporativos set nombre = p_b ->> 'nombre', cuit = p_b ->> 'cuit', centro_costo = p_b ->> 'centro_costo', contacto = p_b ->> 'contacto', telefono = p_b ->> 'telefono', activo = rodar.b(p_b, 'activo') where id = rodar.n(p_b, 'id');
  else insert into rodar.corporativos(nombre, cuit, centro_costo, contacto, telefono) values (p_b ->> 'nombre', p_b ->> 'cuit', p_b ->> 'centro_costo', p_b ->> 'contacto', p_b ->> 'telefono'); end if;
  return '{"ok":true}';
end $$;

-- ---- Canales, feriados ----
create or replace function public.r_canales(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); return rodar.lista('select * from rodar.canales order by orden'); end $$;
create or replace function public.r_canales_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare x jsonb;
begin
  perform rodar.need(p_token, 'admin');
  for x in select jsonb_array_elements(p_b) loop
    update rodar.canales set promo = rodar.b(x, 'promo'), exigir_pin = rodar.b(x, 'exigir_pin'), cobro_modo = coalesce(rodar.t(x, 'cobro_modo'), 'tarifado'), ajuste_pct = coalesce(rodar.n(x, 'ajuste_pct'), 0) where codigo = x ->> 'codigo';
  end loop;
  return '{"ok":true}';
end $$;
create or replace function public.r_feriados(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.usuario(p_token); return rodar.lista('select * from rodar.feriados order by fecha'); end $$;
create or replace function public.r_feriado_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'admin');
  begin
    if rodar.n(p_b, 'id') is not null then update rodar.feriados set fecha = (p_b ->> 'fecha')::date, descripcion = p_b ->> 'descripcion' where id = rodar.n(p_b, 'id');
    else insert into rodar.feriados(fecha, descripcion) values ((p_b ->> 'fecha')::date, p_b ->> 'descripcion'); end if;
  exception when unique_violation then raise exception 'Ya hay un feriado en esa fecha'; end;
  return '{"ok":true}';
end $$;
create or replace function public.r_feriado_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); delete from rodar.feriados where id = (p_q ->> 'id')::bigint; return '{"ok":true}'; end $$;

-- ---- Documentación reguladora ----
create or replace function public.r_docreg(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'admin');
  return jsonb_build_object('autoridades', rodar.lista('select * from rodar.autoridades order by id'), 'empresa', rodar.cfg('empresa'),
    'historial', rodar.lista('select d.*, u.nombre usuario from rodar.docs_generados d left join rodar.usuarios u on u.id = d.usuario_id order by d.id desc limit 100'),
    'moviles_habilitados', (select count(*) from rodar.moviles where habilitado), 'tarifa', (select to_jsonb(t) from rodar.tarifa_vigente() t));
end $$;
create or replace function public.r_docreg_autoridad(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare vid bigint := rodar.n(p_b, 'id')::bigint;
begin
  perform rodar.need(p_token, 'admin');
  if vid is not null then update rodar.autoridades set nombre = p_b ->> 'nombre', cargo = p_b ->> 'cargo', organismo = p_b ->> 'organismo', direccion = p_b ->> 'direccion', email = p_b ->> 'email' where id = vid;
  else insert into rodar.autoridades(nombre, cargo, organismo, direccion, email) values (p_b ->> 'nombre', p_b ->> 'cargo', p_b ->> 'organismo', p_b ->> 'direccion', p_b ->> 'email') returning id into vid; end if;
  return jsonb_build_object('id', vid);
end $$;
create or replace function public.r_docreg_autoridad_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); delete from rodar.autoridades where id = (p_q ->> 'id')::bigint; return '{"ok":true}'; end $$;
create or replace function public.r_docreg_empresa(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); perform rodar.cfg_set('empresa', rodar.cfg('empresa', '{}') || p_b); return '{"ok":true}'; end $$;
create or replace function public.r_docreg_generado(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin');
begin insert into rodar.docs_generados(tipo, autoridad, usuario_id, fecha) values (p_b ->> 'tipo', p_b ->> 'autoridad', u.id, rodar.ahora()); return '{"ok":true}'; end $$;
