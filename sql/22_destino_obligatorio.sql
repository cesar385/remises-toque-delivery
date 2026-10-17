-- ===================== "¿A dónde vas?" obligatorio en los pedidos de pasajeros (con y sin cuenta) =====================
-- Los pedidos de operadores, de la calle y de la centralita siguen pudiendo no tener destino.

create or replace function public.r_pub_viaje(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare tel text := regexp_replace(coalesce(p_b ->> 'telefono', ''), '\D', '', 'g'); corp bigint; medio text := coalesce(rodar.t(p_b, 'medio_pago'), 'efectivo'); ids bigint[]; s rodar.usuarios;
begin
  if rodar.t(p_b, 'destino_dir') is null or p_b ->> 'destino_lat' is null then raise exception 'Indicá a dónde vas'; end if;
  if (select count(*) from rodar.limite_pedidos where clave = tel and ts > now() - interval '10 minutes') >= 5 then raise exception 'Demasiados pedidos seguidos. Esperá unos minutos o llamá a la central.'; end if;
  if (select count(*) from rodar.limite_pedidos where ts > now() - interval '1 minute') >= 40 then raise exception 'Hay demasiados pedidos en este momento, probá en un minuto.'; end if;
  insert into rodar.limite_pedidos(clave) values (tel);
  if length(tel) < 8 then raise exception 'Ingresá un teléfono válido'; end if;
  if rodar.t(p_b, 'origen_dir') is null or p_b ->> 'origen_lat' is null then raise exception 'Indicá el origen en el mapa o buscá la dirección'; end if;
  if rodar.t(p_b, 'token') is not null then
    select u.* into s from rodar.sesiones x join rodar.usuarios u on u.id = x.usuario_id where x.token = p_b ->> 'token' and x.activa;
    if s.corporativo_id is not null then corp := s.corporativo_id; medio := 'cuenta_corriente'; end if;
  end if;
  ids := rodar.crear_viaje(p_b || jsonb_build_object('telefono', tel, 'alias', p_b ->> 'nombre', 'canal', 'web', 'medio_pago', medio, 'corporativo_id', corp, 'pin_requerido', true,
    'cantidad_moviles', 1, 'estado', 'pendiente', 'movil_id', null, 'conductor_id', null, 'programado', null, 'monto_fijo', null), null);
  perform rodar.procesar();
  return jsonb_build_object('id', ids[1], 'k', rodar.firma(ids[1]), 'canal', rodar.topico('viaje-' || ids[1] || '-' || rodar.firma(ids[1])));
end $$;

create or replace function public.r_cli_viaje(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token); prog timestamp := rodar.ts(p_b, 'programado'); medio text := coalesce(rodar.t(p_b, 'medio_pago'), c.medio_pago_pref, 'efectivo'); ids bigint[];
begin
  if rodar.t(p_b, 'destino_dir') is null or p_b ->> 'destino_lat' is null then raise exception 'Indicá a dónde vas'; end if;
  if rodar.t(p_b, 'origen_dir') is null or p_b ->> 'origen_lat' is null then raise exception 'Indicá el origen en el mapa o buscá la dirección'; end if;
  if prog is not null then
    if prog < rodar.ahora() + interval '15 minutes' then raise exception 'Para reservar elegí un horario con al menos 15 minutos de anticipación (o pedí "Ahora").'; end if;
    if prog > rodar.ahora() + interval '60 days' then raise exception 'Se puede reservar hasta 60 días antes'; end if;
    if (select count(*) from rodar.viajes where cliente_id = c.id and estado = 'reserva') >= 10 then raise exception 'Tenés muchas reservas pendientes. Cancelá alguna o llamá a la central.'; end if;
  elsif (select count(*) from rodar.viajes where cliente_id = c.id and estado in ('pendiente', 'ofrecido', 'confirmado', 'en_curso')) >= 2 then
    raise exception 'Ya tenés viajes en curso. Si necesitás otro móvil, llamá a la central.';
  end if;
  perform rodar.limitar('cli:' || c.id, 6, interval '10 minutes', 'Demasiados pedidos seguidos. Esperá unos minutos o llamá a la central.');
  ids := rodar.crear_viaje(p_b || jsonb_build_object('telefono', c.telefono, 'alias', c.alias, 'canal', 'aplicacion', 'medio_pago', medio, 'pin_requerido', true,
    'cantidad_moviles', 1, 'estado', 'pendiente', 'movil_id', null, 'conductor_id', null, 'monto_fijo', null, 'corporativo_id', null, 'a_oferta', false, 'origen_tipo', 'central', 'datos_movil', null,
    'programado', case when prog is null then null else to_char(prog, 'YYYY-MM-DD HH24:MI:SS') end), null);
  update rodar.clientes set medio_pago_pref = medio where id = c.id;
  perform rodar.procesar();
  return jsonb_build_object('id', ids[1], 'k', rodar.firma(ids[1]), 'reserva', prog is not null, 'canal', rodar.topico('viaje-' || ids[1] || '-' || rodar.firma(ids[1])));
end $$;

notify pgrst, 'reload schema';
