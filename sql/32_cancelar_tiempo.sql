-- El pasajero puede cancelar un viaje solo dentro de los primeros minutos desde que lo pidió (por defecto 2,5 min).
-- Se ajusta en el panel → Administración → Configuración y demo → "Minutos que tiene el pasajero para cancelar" (0 = sin límite).
-- Las reservas se pueden cancelar hasta que empiezan; el tiempo cuenta desde la hora programada.
create or replace function rodar.cancelar_minutos() returns numeric language sql stable as $$
  select coalesce(nullif(rodar.cfg('dispatch', '{}') ->> 'cancelar_minutos', '')::numeric, 2.5) $$;

-- segundos que le quedan al pasajero para cancelar (null = sin límite)
create or replace function rodar.cancelar_restante(v rodar.viajes) returns numeric language plpgsql stable as $$
declare mins numeric := rodar.cancelar_minutos();
begin
  if v.estado = 'reserva' or mins <= 0 then return null; end if;
  return greatest(0, round(mins * 60 - extract(epoch from rodar.ahora() - greatest(v.creado, coalesce(v.programado, v.creado)))));
end $$;

create or replace function rodar.verificar_cancelacion(v rodar.viajes) returns void language plpgsql stable as $$
declare r numeric;
begin
  if v.estado not in ('reserva', 'pendiente', 'ofrecido', 'confirmado') then raise exception 'Ese viaje ya no se puede cancelar'; end if;
  r := rodar.cancelar_restante(v);
  if r is not null and r <= 0 then
    raise exception 'Ya pasaron los % minutos para cancelar el viaje desde la app. Si necesitás cancelarlo, comunicate con la central.', replace(trim(to_char(rodar.cancelar_minutos(), 'FM990.9')), '.', ',');
  end if;
end $$;

create or replace function public.r_pub_cancelar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare vid bigint := (p_q ->> 'id')::bigint; nada rodar.usuarios; v rodar.viajes;
begin
  if p_q ->> 'k' is distinct from rodar.firma(vid) then raise exception 'Enlace inválido'; end if;
  select * into v from rodar.viajes where id = vid;
  if not found then raise exception 'No encontramos ese viaje'; end if;
  perform rodar.verificar_cancelacion(v);
  perform rodar.anular(vid, nada, 'Cancelado por el pasajero');
  return '{"ok":true}';
end $$;

create or replace function public.r_cli_cancelar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token); v rodar.viajes; nada rodar.usuarios;
begin
  select * into v from rodar.viajes where id = (p_q ->> 'id')::bigint and cliente_id = c.id;
  if not found then raise exception 'No encontramos ese viaje'; end if;
  perform rodar.verificar_cancelacion(v);
  perform rodar.anular(v.id, nada, case when v.estado = 'reserva' then 'Reserva cancelada por el cliente' else 'Cancelado por el cliente' end);
  return '{"ok":true}';
end $$;

-- el seguimiento del pasajero informa cuántos segundos le quedan para cancelar
create or replace function rodar.publico_pasajero(p_id bigint) returns jsonb language sql stable as $$
  select jsonb_build_object('id', v.id, 'estado', v.estado, 'movil_numero', m.numero,
    'movil', nullif(trim(coalesce(m.marca, '') || ' ' || coalesce(m.modelo, '') || ' ' || coalesce(m.color, '')), ''), 'patente', m.patente,
    'conductor', trim(u.nombre || ' ' || coalesce(u.apellido, '')), 'pin', case when v.pin_requerido then v.pin end, 'monto', coalesce(v.monto, v.monto_estimado),
    'origen', v.origen_dir, 'destino', v.destino_dir, 'lat', m.lat, 'lng', m.lng, 'origen_lat', v.origen_lat, 'origen_lng', v.origen_lng,
    'destino_lat', v.destino_lat, 'destino_lng', v.destino_lng, 'calificacion', v.calificacion, 'llego', v.llegada_at is not null,
    'cancelar_seg', rodar.cancelar_restante(v), 'cancelar_min', rodar.cancelar_minutos())
  from rodar.viajes v left join rodar.moviles m on m.id = v.movil_id left join rodar.usuarios u on u.id = v.conductor_id where v.id = p_id $$;

update rodar.config set valor = valor || '{"cancelar_minutos":2.5}'::jsonb where clave = 'dispatch' and not (valor ? 'cancelar_minutos');
notify pgrst, 'reload schema';
