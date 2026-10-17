-- ===================== Eliminar viajes (admin) y datos del conductor para clientes con cuenta =====================

-- Elimina un viaje del listado. Solo admin. No se puede si está ofrecido, confirmado o en curso (primero hay que anularlo o finalizarlo).
-- No toca la cuenta del móvil: los movimientos ya registrados (cuota o comisión del viaje) se conservan como estaban.
create or replace function public.r_viaje_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); vid bigint := (p_q ->> 'id')::bigint; v rodar.viajes;
begin
  select * into v from rodar.viajes where id = vid;
  if not found then raise exception 'El viaje no existe'; end if;
  if v.estado in ('ofrecido', 'confirmado', 'en_curso') then
    raise exception 'El viaje #% está en curso. Anulalo o finalizalo antes de eliminarlo.', vid;
  end if;
  delete from rodar.viajes where id = vid;
  perform rodar.accion(u, 'viaje_eliminado', vid::text, 'Se eliminó el viaje #' || vid || ' (' || coalesce(v.estado, '') || ') · ' || coalesce(v.origen_dir, ''));
  perform rodar.emit('panel', 'viaje_baja', jsonb_build_object('id', vid));
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.r_viaje_borrar(text, jsonb, jsonb) to anon, authenticated;

-- Mis viajes (cliente con cuenta): ahora incluye el conductor y el color del auto, igual que el seguimiento de un pedido sin cuenta.
create or replace function public.r_cli_viajes(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token); lim int := least(100, coalesce(rodar.n(p_q, 'limite'), 30)::int);
begin
  return coalesce((select jsonb_agg(x order by orden, creado desc) from (
    select v.id, v.creado, v.programado, v.estado, v.origen_dir, v.origen_ref, v.origen_lat, v.origen_lng, v.destino_dir, v.destino_lat, v.destino_lng,
      coalesce(v.monto, v.monto_estimado) monto, v.monto is not null monto_final, v.km, v.minutos, v.medio_pago, v.calificacion, v.inicio_at, v.fin_at, v.motivo_anulacion,
      m.numero movil_numero, m.patente, m.color movil_color, trim(coalesce(m.marca, '') || ' ' || coalesce(m.modelo, '')) movil,
      case when v.estado in ('confirmado', 'en_curso', 'finalizado') then nullif(trim(coalesce(u.nombre, '') || ' ' || coalesce(u.apellido, '')), '') end conductor,
      rodar.firma(v.id) k,
      case when v.estado in ('pendiente', 'ofrecido', 'confirmado', 'en_curso') then 0 when v.estado = 'reserva' then 1 else 2 end orden
    from rodar.viajes v left join rodar.moviles m on m.id = v.movil_id left join rodar.usuarios u on u.id = v.conductor_id
    where v.cliente_id = c.id and v.creado >= c.cuenta_creada - interval '1 minute'
    order by orden, v.creado desc limit lim) x), '[]');
end $$;

notify pgrst, 'reload schema';
