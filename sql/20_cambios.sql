-- ===================== Eliminar viajes (admin) y datos del conductor para el pasajero con cuenta =====================

-- Elimina un viaje del listado. Solo admin. No se puede si el viaje está en proceso (pendiente, ofrecido, confirmado o en curso):
-- primero hay que anularlo. Los movimientos de cuenta quedan (la contabilidad no cambia), pero sin el vínculo al viaje.
create or replace function public.r_viaje_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); vid bigint := rodar.n(p_q, 'id')::bigint; v rodar.viajes;
begin
  select * into v from rodar.viajes where id = vid;
  if not found then raise exception 'El viaje no existe'; end if;
  if v.estado in ('pendiente', 'ofrecido', 'confirmado', 'en_curso') then
    raise exception 'El viaje #% está en proceso. Anulalo antes de eliminarlo.', vid;
  end if;
  update rodar.cuenta_movimientos set viaje_id = null where viaje_id = vid;
  delete from rodar.mp_pagos where viaje_id = vid and tipo = 'viaje' and not coalesce(acreditado, false);
  update rodar.mp_pagos set viaje_id = null where viaje_id = vid;
  delete from rodar.eventos_moviles where ref = '#' || vid;
  delete from rodar.viajes where id = vid;
  perform rodar.accion(u, 'viaje_eliminado', vid::text, 'Se eliminó el viaje #' || vid || ' (' || v.estado || ', ' || coalesce(v.origen_dir, '') || ')');
  perform rodar.emit('panel', 'viaje_baja', jsonb_build_object('id', vid));
  return jsonb_build_object('ok', true);
end $$;

-- Datos del conductor y del móvil que ve el pasajero (con cuenta o sin cuenta): se agregan marca, modelo y color por separado.
create or replace function rodar.publico_pasajero(p_id bigint) returns jsonb language sql stable as $$
  select jsonb_build_object('id', v.id, 'estado', v.estado, 'movil_numero', m.numero,
    'movil', nullif(trim(coalesce(m.marca, '') || ' ' || coalesce(m.modelo, '') || ' ' || coalesce(m.color, '')), ''), 'patente', m.patente,
    'marca', m.marca, 'modelo', m.modelo, 'color', m.color,
    'conductor', trim(u.nombre || ' ' || coalesce(u.apellido, '')), 'pin', case when v.pin_requerido then v.pin end, 'monto', coalesce(v.monto, v.monto_estimado),
    'origen', v.origen_dir, 'destino', v.destino_dir, 'lat', m.lat, 'lng', m.lng, 'origen_lat', v.origen_lat, 'origen_lng', v.origen_lng,
    'destino_lat', v.destino_lat, 'destino_lng', v.destino_lng, 'calificacion', v.calificacion)
  from rodar.viajes v left join rodar.moviles m on m.id = v.movil_id left join rodar.usuarios u on u.id = v.conductor_id where v.id = p_id $$;

-- Mis viajes del pasajero con cuenta: ahora también trae el nombre del conductor y la patente del móvil.
create or replace function public.r_cli_viajes(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token); lim int := least(100, coalesce(rodar.n(p_q, 'limite'), 30)::int);
begin
  return coalesce((select jsonb_agg(x order by orden, creado desc) from (
    select v.id, v.creado, v.programado, v.estado, v.origen_dir, v.origen_ref, v.origen_lat, v.origen_lng, v.destino_dir, v.destino_lat, v.destino_lng,
      coalesce(v.monto, v.monto_estimado) monto, v.monto is not null monto_final, v.km, v.minutos, v.medio_pago, v.calificacion, v.inicio_at, v.fin_at, v.motivo_anulacion,
      m.numero movil_numero, m.patente, trim(coalesce(m.marca, '') || ' ' || coalesce(m.modelo, '') || ' ' || coalesce(m.color, '')) movil, rodar.firma(v.id) k,
      case when v.estado in ('confirmado', 'en_curso', 'finalizado') then trim(cu.nombre || ' ' || coalesce(cu.apellido, '')) end conductor,
      case when v.estado in ('pendiente', 'ofrecido', 'confirmado', 'en_curso') then 0 when v.estado = 'reserva' then 1 else 2 end orden
    from rodar.viajes v left join rodar.moviles m on m.id = v.movil_id left join rodar.usuarios cu on cu.id = v.conductor_id
    where v.cliente_id = c.id and v.creado >= c.cuenta_creada - interval '1 minute'
    order by orden, v.creado desc limit lim) x), '[]');
end $$;

notify pgrst, 'reload schema';
