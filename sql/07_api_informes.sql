-- ===================== API: informes =====================

create or replace function rodar.rango_desde(p jsonb) returns timestamp language sql immutable as $$
  select case when nullif(p ->> 'desde', '') is null then '2000-01-01'::timestamp else replace(p ->> 'desde', 'T', ' ')::timestamp end $$;
create or replace function rodar.rango_hasta(p jsonb) returns timestamp language sql immutable as $$
  select case when nullif(p ->> 'hasta', '') is null then '2999-12-31'::timestamp
              when length(p ->> 'hasta') = 10 then (p ->> 'hasta')::date + interval '1 day' - interval '1 second'
              else replace(p ->> 'hasta', 'T', ' ')::timestamp end $$;
-- móviles visibles para titulares/conductores (null = todos)
create or replace function rodar.moviles_permitidos(u rodar.usuarios) returns bigint[] language sql stable as $$
  select case when rodar.tiene(u, 'gestion', 'operador') then null else
    coalesce((select array_agg(id) from (select id from rodar.moviles where titular_id = u.id union select movil_id from rodar.movil_conductores where usuario_id = u.id) z), '{}') end $$;

create or replace function public.r_inf_acciones(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare w text;
begin
  perform rodar.need(p_token, 'gestion');
  w := format('fecha between %L and %L', rodar.rango_desde(p_q), rodar.rango_hasta(p_q));
  if rodar.t(p_q, 'tipo') is not null then w := w || format(' and tipo = %L', p_q ->> 'tipo'); end if;
  if coalesce(rodar.n(p_q, 'actor'), 0) > 0 then w := w || format(' and actor_id = %s', rodar.n(p_q, 'actor')); end if;
  if rodar.t(p_q, 'buscar') is not null then w := w || format(' and (afectado ilike %1$L or actor ilike %1$L or detalle ilike %1$L or tipo ilike %1$L)', '%' || (p_q ->> 'buscar') || '%'); end if;
  return rodar.lista('select * from rodar.acciones_usuarios where ' || w || ' order by id desc limit 2000');
end $$;
create or replace function public.r_inf_eventos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare w text;
begin
  perform rodar.need(p_token, 'gestion');
  w := format('fecha between %L and %L', rodar.rango_desde(p_q), rodar.rango_hasta(p_q));
  if rodar.t(p_q, 'tipo') is not null then w := w || format(' and tipo = %L', p_q ->> 'tipo'); end if;
  if coalesce(rodar.n(p_q, 'movil'), 0) > 0 then w := w || format(' and movil_numero = %s', rodar.n(p_q, 'movil')); end if;
  return rodar.lista('select * from rodar.eventos_moviles where ' || w || ' order by id desc limit 3000');
end $$;
create or replace function public.r_inf_bloqueados(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'operador', 'gestion');
  return rodar.lista('select c.id, c.telefono, c.alias, c.motivo_bloqueo motivo, trim(u.nombre || '' '' || coalesce(u.apellido, '''')) bloqueado_por, c.bloqueado_at fecha from rodar.clientes c left join rodar.usuarios u on u.id = c.bloqueado_por where c.bloqueado order by c.bloqueado_at desc nulls last');
end $$;
create or replace function public.r_inf_baja(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'operador', 'gestion');
  return rodar.lista('select c.id, c.telefono, c.alias, c.baja_at, trim(u.nombre || '' '' || coalesce(u.apellido, '''')) quien, c.baja_at + interval ''7 days'' purga from rodar.clientes c left join rodar.usuarios u on u.id = c.baja_por where c.baja_at is not null order by c.baja_at desc');
end $$;
create or replace function public.r_inf_conductores(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare d timestamp := rodar.rango_desde(p_q); h timestamp := rodar.rango_hasta(p_q);
begin
  perform rodar.need(p_token, 'gestion');
  return rodar.lista(format($q$select u.id, u.foto, u.documento, trim(u.nombre || ' ' || coalesce(u.apellido, '')) nombre,
    (select count(*) from rodar.viajes where conductor_id = u.id and estado = 'finalizado' and creado between %1$L and %2$L) viajes,
    (select coalesce(sum(monto), 0) from rodar.viajes where conductor_id = u.id and estado = 'finalizado' and creado between %1$L and %2$L) ingresos,
    (select round(coalesce(sum(segundos), 0) / 3600.0, 1) from rodar.conexion_diaria where usuario_id = u.id and tipo = 'app' and fecha between %1$L::date and %2$L::date) horas,
    (select round(avg(calificacion), 2) from rodar.viajes where conductor_id = u.id and calificacion is not null and creado between %1$L and %2$L) calificacion,
    (select count(*) from rodar.eventos_moviles e where e.tipo in ('timeout', 'rechazado_movil') and e.fecha between %1$L and %2$L and e.movil_id in (select movil_id from rodar.movil_conductores where usuario_id = u.id)) no_respondidos
    from rodar.usuarios u where 'conductor' = any(string_to_array(u.roles, ',')) order by viajes desc$q$, d, h));
end $$;
create or replace function public.r_inf_conectados(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare w text := 's.activa and s.ultimo >= rodar.ahora() - interval ''30 minutes''';
begin
  perform rodar.need(p_token, 'admin');
  if rodar.t(p_q, 'tipo') is not null then w := w || format(' and s.tipo = %L', p_q ->> 'tipo'); end if;
  if rodar.t(p_q, 'buscar') is not null then w := w || format(' and ((u.nombre || '' '' || u.apellido) ilike %1$L or u.documento ilike %1$L)', '%' || (p_q ->> 'buscar') || '%'); end if;
  return rodar.lista('select left(s.token, 8) token, s.tipo, s.inicio, s.ultimo, s.ip, s.cooldown_hasta, u.id usuario_id, trim(u.nombre || '' '' || coalesce(u.apellido, '''')) usuario, u.documento, u.roles, m.numero movil,
      (select round(coalesce(sum(segundos), 0) / 60) from rodar.conexion_diaria where usuario_id = u.id and fecha = rodar.hoy() and tipo = s.tipo) min_hoy
      from rodar.sesiones s join rodar.usuarios u on u.id = s.usuario_id left join rodar.moviles m on m.id = s.movil_id where ' || w || ' order by s.inicio desc')
    || case when coalesce(p_q ->> 'tipo', '') = 'web' then '[]'::jsonb else rodar.lista(format('select ''app'' tipo, trim(u.nombre || '' '' || coalesce(u.apellido, '''')) usuario, u.documento, u.roles, m.numero movil, ''simulado'' ip
      from rodar.moviles m join rodar.usuarios u on u.id = m.conductor_id where m.simulado and m.estado <> ''desconectado'' and (u.nombre || '' '' || u.apellido) ilike %L', '%' || coalesce(p_q ->> 'buscar', '') || '%')) end;
end $$;
create or replace function public.r_inf_conectado_op(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); s rodar.sesiones;
begin
  select * into s from rodar.sesiones where token like (p_q ->> 'tk') || '%';
  if not found then raise exception 'Sesión no encontrada'; end if;
  if p_q ->> 'op' = 'cerrar' then update rodar.sesiones set activa = false where token = s.token; end if;
  if p_q ->> 'op' = 'cooldown' then update rodar.sesiones set activa = false, cooldown_hasta = rodar.ahora() + make_interval(mins => coalesce(rodar.n(p_b, 'minutos'), 15)::int) where token = s.token; end if;
  if s.movil_id is not null then perform rodar.emit('movil-' || s.movil_id, 'forzar_salida', '{}'); end if;
  perform rodar.accion(u, 'sesion_cerrada', s.usuario_id::text, p_q ->> 'op');
  return '{"ok":true}';
end $$;
create or replace function public.r_inf_estadisticas(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'gestion');
  return rodar.lista(format($q$select m.numero movil, trim(u.nombre || ' ' || coalesce(u.apellido, '')) conductor, count(*) filter (where v.origen_tipo = 'central') central,
    count(*) filter (where v.origen_tipo = 'calle') calle, count(*) total from rodar.viajes v join rodar.moviles m on m.id = v.movil_id left join rodar.usuarios u on u.id = v.conductor_id
    where v.estado = 'finalizado' and to_char(v.creado, 'YYYY-MM') = %L group by m.numero, u.id order by total desc$q$, coalesce(rodar.t(p_q, 'mes'), to_char(rodar.hoy(), 'YYYY-MM'))));
end $$;
create or replace function public.r_inf_horas(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'gestion');
  return rodar.lista(format($q$select u.documento, trim(u.nombre || ' ' || coalesce(u.apellido, '')) conductor, round(sum(c.segundos) / 3600.0, 1) horas from rodar.conexion_diaria c join rodar.usuarios u on u.id = c.usuario_id
    where c.tipo = 'app' and to_char(c.fecha, 'YYYY-MM') = %L group by u.id order by horas desc$q$, coalesce(rodar.t(p_q, 'mes'), to_char(rodar.hoy(), 'YYYY-MM'))));
end $$;
create or replace function public.r_inf_facturacion(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare mes text := coalesce(rodar.t(p_q, 'anio'), to_char(rodar.hoy(), 'YYYY')) || '-' || lpad(coalesce(rodar.t(p_q, 'mes'), to_char(rodar.hoy(), 'MM')), 2, '0'); hab int; packs jsonb; w text;
begin
  perform rodar.need(p_token, 'gestion');
  hab := greatest((select count(*) from rodar.moviles where habilitado), (select count(distinct movil_id) from rodar.viajes where to_char(creado, 'YYYY-MM') = mes));
  select coalesce(jsonb_agg(jsonb_build_object('pack', nombre, 'bonif', 0, 'qty', q, 'unitario', precio, 'monto', q * precio)), '[]') into packs
    from (select *, case when unidad = 'móvil' then hab when unidad = 'puesto' then cantidad else 1 end q from rodar.modulos where activo) z;
  w := format('to_char(fecha, ''YYYY-MM'') = %L', mes);
  if coalesce(rodar.n(p_q, 'numero'), 0) > 0 then w := w || format(' and movil_numero = %s', rodar.n(p_q, 'numero')); end if;
  return jsonb_build_object('mes', mes, 'packs', packs, 'total', (select coalesce(sum((x ->> 'monto')::numeric), 0) from jsonb_array_elements(packs) x), 'habilitados', hab,
    'moviles', rodar.lista(format($q$select numero movil, horas, viajes_central, case when horas > 0 then 'SI' else 'NO' end conectado, case when viajes_central > 0 then 'SI' else 'NO' end con_viaje,
      case when habilitado then '' else 'Inhabilitado' end exclusion from (select m.numero, m.habilitado,
      (select round(coalesce(sum(c.segundos), 0) / 3600.0, 1) from rodar.conexion_diaria c where c.tipo = 'app' and to_char(c.fecha, 'YYYY-MM') = %1$L and c.usuario_id in (select usuario_id from rodar.movil_conductores where movil_id = m.id)) horas,
      (select count(*) from rodar.viajes v where v.movil_id = m.id and v.origen_tipo = 'central' and v.estado = 'finalizado' and to_char(v.creado, 'YYYY-MM') = %1$L) viajes_central
      from rodar.moviles m) z order by numero$q$, mes)),
    'log', rodar.lista('select * from rodar.moviles_historial where ' || w || ' order by id desc'));
end $$;
create or replace function public.r_inf_movimientos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare w text;
begin
  perform rodar.need(p_token, 'gestion');
  w := format('fecha between %L and %L', rodar.rango_desde(p_q), rodar.rango_hasta(p_q));
  if coalesce(rodar.n(p_q, 'numero'), 0) > 0 then w := w || format(' and movil_numero = %s', rodar.n(p_q, 'numero')); end if;
  return rodar.lista('select * from rodar.moviles_historial where ' || w || ' order by id desc');
end $$;
create or replace function public.r_inf_recorrido(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); vid bigint := rodar.n(p_q, 'movil')::bigint; perm bigint[]; d timestamp := rodar.rango_desde(p_q); h timestamp := rodar.rango_hasta(p_q); pts jsonb; est jsonb;
begin
  perm := rodar.moviles_permitidos(u);
  if perm is not null and not (vid = any(perm)) then raise exception 'Sin permiso'; end if;
  pts := rodar.lista(format('select ts, lat, lng, estado, velocidad from rodar.posiciones where movil_id = %s and ts between %L and %L %s order by ts limit 20000', vid, d, h, case when p_q ->> 'emergencias' = '1' then ' and estado = ''emergencia''' else '' end));
  with p as (select (x ->> 'ts')::timestamp ts, (x ->> 'lat')::float8 lat, (x ->> 'lng')::float8 lng, x ->> 'estado' estado from jsonb_array_elements(pts) x),
  s as (select estado, lat, lng, ts, lead(lat) over (order by ts) lat2, lead(lng) over (order by ts) lng2, lead(ts) over (order by ts) ts2 from p),
  g as (select estado, sum(rodar.dist(lat, lng, lat2, lng2)) / 1000 km, sum(extract(epoch from ts2 - ts)) / 3600 horas from s where ts2 is not null and extract(epoch from ts2 - ts) <= 600 group by estado)
  select coalesce(jsonb_object_agg(estado, jsonb_build_object('km', round(km::numeric, 2), 'horas', round(horas::numeric, 2))), '{}') into est from g;
  return jsonb_build_object('puntos', pts, 'eventos', rodar.lista(format('select * from rodar.eventos_moviles where movil_id = %s and fecha between %L and %L order by id', vid, d, h)), 'porEstado', est);
end $$;
create or replace function public.r_inf_mensual(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare mes text := coalesce(rodar.t(p_q, 'anio'), to_char(rodar.hoy(), 'YYYY')) || '-' || lpad(coalesce(rodar.t(p_q, 'mes'), to_char(rodar.hoy(), 'MM')), 2, '0');
  viajes int; conv int; cnx int; canales jsonb; tipos jsonb; parada int; canc int; rango int; hist jsonb;
begin
  perform rodar.need(p_token, 'gestion');
  select count(*), count(distinct movil_id), count(*) filter (where parada_id is not null) into viajes, conv, parada from rodar.viajes where estado = 'finalizado' and to_char(creado, 'YYYY-MM') = mes;
  select count(distinct usuario_id) into cnx from rodar.conexion_diaria where tipo = 'app' and to_char(fecha, 'YYYY-MM') = mes;
  select coalesce(jsonb_object_agg(canal, c), '{}') into canales from (select canal, count(*) c from rodar.viajes where estado = 'finalizado' and to_char(creado, 'YYYY-MM') = mes group by canal) z;
  select coalesce(jsonb_object_agg(origen_tipo, c), '{}') into tipos from (select origen_tipo, count(*) c from rodar.viajes where estado = 'finalizado' and to_char(creado, 'YYYY-MM') = mes group by origen_tipo) z;
  select count(*) into canc from rodar.viajes where estado = 'anulado' and to_char(creado, 'YYYY-MM') = mes;
  rango := case coalesce(p_q ->> 'rango', '12') when '24' then 24 when '36' then 36 when 'todo' then 999 else 12 end;
  hist := rodar.lista(format('select * from (select to_char(creado, ''YYYY-MM'') mes, count(*) c from rodar.viajes where estado = ''finalizado'' group by 1 order by 1 desc limit %s) z order by mes', rango));
  return jsonb_build_object('mes', mes, 'viajes', viajes, 'por_movil', case when conv > 0 then round(viajes::numeric / conv, 1) else 0 end, 'con_viaje', conv, 'conectados', cnx,
    'desglose', jsonb_build_object('central', coalesce((tipos ->> 'central')::int, 0), 'calle', coalesce((tipos ->> 'calle')::int, 0), 'telefonica', coalesce((canales ->> 'centralita')::int, 0),
      'whatsapp', coalesce((canales ->> 'whatsapp')::int, 0), 'app', coalesce((canales ->> 'aplicacion')::int, 0) + coalesce((canales ->> 'web')::int, 0), 'telegram', coalesce((canales ->> 'telegram')::int, 0),
      'parada', parada, 'domicilio', coalesce((tipos ->> 'central')::int, 0) - parada, 'cancelados', canc),
    'diario', rodar.lista(format('select to_char(creado, ''DD'') dia, count(*) c from rodar.viajes where estado = ''finalizado'' and to_char(creado, ''YYYY-MM'') = %L group by 1 order by 1', mes)),
    'historico', hist, 'media', (select coalesce(round(avg((x ->> 'c')::numeric), 1), 0) from jsonb_array_elements(hist) x));
end $$;
create or replace function public.r_inf_operadores(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'gestion');
  return rodar.lista(format($q$select trim(u.nombre || ' ' || coalesce(u.apellido, '')) operador, u.documento, sum(c.cargados) cargados, round(sum(c.segundos) / 3600.0, 2) horas
    from rodar.conexion_diaria c join rodar.usuarios u on u.id = c.usuario_id where c.tipo = 'web' and c.fecha between %L and %L and 'operador' = any(string_to_array(u.roles, ',')) group by u.id order by cargados desc$q$,
    coalesce(rodar.t(p_q, 'desde')::date, rodar.hoy()), coalesce(rodar.t(p_q, 'hasta')::date, rodar.hoy())));
end $$;
create or replace function public.r_inf_demanda(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare a timestamp := rodar.ahora(); dia int; desde int;
begin
  perform rodar.usuario(p_token);
  dia := coalesce(rodar.n(p_q, 'dia')::int, extract(dow from a)::int);
  desde := coalesce(rodar.n(p_q, 'hora')::int * 60, extract(hour from a)::int * 60 + case when extract(minute from a) < 30 then 0 else 30 end);
  return jsonb_build_object('dia', dia, 'desde', desde, 'puntos', rodar.lista(format($q$select origen_lat lat, origen_lng lng from rodar.viajes where origen_lat is not null and creado >= rodar.ahora() - interval '90 days'
    and extract(dow from creado) = %s and (extract(hour from creado) * 60 + extract(minute from creado)) between %s and %s$q$, dia, desde - 30, desde + 60)));
end $$;
create or replace function public.r_inf_calor(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'gestion');
  return rodar.lista(format('select lat, lng from rodar.posiciones where ts >= rodar.ahora() - make_interval(hours => %s) and id %% 3 = 0 limit 15000', least(168, coalesce(rodar.n(p_q, 'horas'), 6))::int));
end $$;
create or replace function public.r_inf_negativos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare mid bigint;
begin
  perform rodar.need(p_token, 'operador', 'gestion');
  select id into mid from rodar.moviles where numero = rodar.n(p_q, 'movil');
  if mid is null then return '[]'; end if;
  return rodar.lista('select c.id cliente_id, c.telefono, c.alias, (select direccion from rodar.cliente_domicilios where cliente_id = c.id order by usos desc limit 1) domicilio from rodar.negativos n join rodar.clientes c on c.id = n.cliente_id where n.movil_id = ' || mid);
end $$;
create or replace function public.r_inf_top10(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare r jsonb := '{}'; d int;
begin
  perform rodar.usuario(p_token);
  foreach d in array array[1, 7, 30] loop
    r := r || jsonb_build_object(d::text, rodar.lista(format($q$select trim(u.nombre || ' ' || coalesce(u.apellido, '')) conductor, m.numero movil, count(*) viajes from rodar.viajes v join rodar.usuarios u on u.id = v.conductor_id
      join rodar.moviles m on m.id = v.movil_id where v.estado = 'finalizado' and v.creado >= rodar.ahora() - interval '%s days' group by u.id, m.numero order by viajes desc limit 10$q$, d)));
  end loop;
  return r;
end $$;
create or replace function public.r_inf_viajes_movil(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); perm bigint[]; w text; f jsonb;
begin
  w := format('v.estado = ''finalizado'' and v.creado between %L and %L', rodar.rango_desde(p_q), rodar.rango_hasta(p_q));
  perm := rodar.moviles_permitidos(u);
  if rodar.tiene(u, 'corporativo') and not rodar.tiene(u, 'gestion', 'operador') then w := w || format(' and v.corporativo_id = %s', coalesce(u.corporativo_id, -1));
  elsif perm is not null then
    w := w || format(' and v.movil_id = any(%L::bigint[])', perm);
    if not rodar.tiene(u, 'titular') then w := w || format(' and v.conductor_id = %s', u.id); end if;
  end if;
  if coalesce(rodar.n(p_q, 'movil'), 0) > 0 then w := w || format(' and m.numero = %s', rodar.n(p_q, 'movil')); end if;
  if p_q ->> 'tipo' = 'central' then w := w || ' and v.origen_tipo = ''central'''; end if;
  if p_q ->> 'tipo' = 'calle' then w := w || ' and v.origen_tipo = ''calle'''; end if;
  if p_q ->> 'tipo' = 'corporativos' then w := w || ' and v.corporativo_id is not null'; end if;
  f := rodar.lista('select v.id, v.creado fecha, m.numero movil, v.origen_dir, v.destino_dir, v.km, v.minutos, v.monto, v.medio_pago pago, v.origen_tipo from rodar.viajes v join rodar.moviles m on m.id = v.movil_id where ' || w || ' order by v.id desc limit 5000');
  return jsonb_build_object('filas', f, 'totales', (select jsonb_build_object('viajes', count(*), 'monto', coalesce(sum((x ->> 'monto')::numeric), 0), 'moviles', count(distinct x ->> 'movil')) from jsonb_array_elements(f) x));
end $$;
create or replace function public.r_inf_rendimiento(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); d timestamp := rodar.rango_desde(p_q); h timestamp := rodar.rango_hasta(p_q); r jsonb; e jsonb; horas numeric;
begin
  select jsonb_build_object('viajes', count(*), 'ingresos', coalesce(sum(monto), 0), 'calificacion', round(avg(calificacion), 2), 'km', round(coalesce(sum(km), 0), 1)) into r
    from rodar.viajes where conductor_id = u.id and estado = 'finalizado' and creado between d and h;
  select coalesce(jsonb_object_agg(tipo, c), '{}') into e from (select tipo, count(*) c from rodar.eventos_moviles where movil_id in (select movil_id from rodar.movil_conductores where usuario_id = u.id)
    and fecha between d and h and tipo in ('ofrecido', 'aceptado', 'rechazado_movil', 'timeout') group by tipo) z;
  select round(coalesce(sum(segundos), 0) / 3600.0, 1) into horas from rodar.conexion_diaria where usuario_id = u.id and tipo = 'app' and fecha between d::date and h::date;
  return r || jsonb_build_object('horas', horas, 'ofrecidos', coalesce((e ->> 'ofrecido')::int, 0), 'aceptados', coalesce((e ->> 'aceptado')::int, 0), 'rechazados', coalesce((e ->> 'rechazado_movil')::int, 0),
    'sin_respuesta', coalesce((e ->> 'timeout')::int, 0), 'respuesta', case when coalesce((e ->> 'ofrecido')::int, 0) > 0 then round(coalesce((e ->> 'aceptado')::int, 0) * 100.0 / (e ->> 'ofrecido')::int) end,
    'por_hora', case when horas > 0 then round((r ->> 'ingresos')::numeric / horas) else 0 end);
end $$;
create or replace function public.r_inf_mis_vehiculos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); perm bigint[] := rodar.moviles_permitidos(u);
begin
  return coalesce((select jsonb_agg(rodar.movil_publico(m) order by m.numero) from rodar.moviles m where perm is null or m.id = any(perm)), '[]');
end $$;
