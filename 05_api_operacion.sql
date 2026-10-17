-- ===================== API: operación (mapa, telefonía, viajes, reservas, chat, soporte) =====================

create or replace function public.r_mapa(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'operador');
  perform rodar.procesar();
  return jsonb_build_object(
    'moviles', coalesce((select jsonb_agg(rodar.movil_publico(m) order by m.numero) from rodar.moviles m where habilitado), '[]'),
    'viajes', coalesce((select jsonb_agg(rodar.viaje_detalle(v.id) order by v.creado) from rodar.viajes v where estado in ('pendiente', 'ofrecido', 'confirmado', 'en_curso')), '[]'));
end $$;

create or replace function public.r_movil_estado(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador'); id bigint := (p_q ->> 'id')::bigint;
begin
  perform rodar.set_estado_movil(id, p_b ->> 'estado', rodar.n(p_b, 'parada_id')::bigint, true);
  if p_b ->> 'estado' = 'fuera_servicio' then perform rodar.evento_movil(id, 'fuera_servicio', null, 'Puesto fuera de servicio por ' || u.nombre); end if;
  return '{"ok":true}';
end $$;

create or replace function public.r_movil_mensaje(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare id bigint := (p_q ->> 'id')::bigint; cid bigint;
begin
  perform rodar.need(p_token, 'operador');
  select c.id into cid from rodar.soporte_conv c where tipo = 'movil' and movil_id = id and not cerrada;
  if cid is null then insert into rodar.soporte_conv(tipo, movil_id, asunto, actualizado) values ('movil', id, 'Mensaje de la central', rodar.ahora()) returning soporte_conv.id into cid; end if;
  insert into rodar.soporte_msg(conv_id, de, texto, fecha) values (cid, 'central', p_b ->> 'texto', rodar.ahora());
  update rodar.soporte_conv set actualizado = rodar.ahora() where soporte_conv.id = cid;
  perform rodar.emit('movil-' || id, 'mensaje', jsonb_build_object('de', 'Central', 'texto', p_b ->> 'texto', 'conv', cid));
  return '{"ok":true}';
end $$;

create or replace function public.r_flota_mensaje(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador'); t text := trim(coalesce(p_b ->> 'texto', ''));
begin
  if t = '' then raise exception 'Escribí un mensaje'; end if;
  insert into rodar.mensajes_flota(texto, usuario_id, fecha) values (t, u.id, rodar.ahora());
  perform rodar.emit('flota', 'mensaje_flota', jsonb_build_object('texto', t, 'de', u.nombre, 'fecha', rodar.ahora()));
  return '{"ok":true}';
end $$;
create or replace function public.r_flota_mensajes(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'operador'); return rodar.lista('select f.*, u.nombre from rodar.mensajes_flota f left join rodar.usuarios u on u.id = f.usuario_id order by f.id desc limit 50'); end $$;

-- ---- Telefonía / clientes ----
create or replace function public.r_clientes_buscar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare q text := trim(coalesce(p_q ->> 'q', ''));
begin
  perform rodar.need(p_token, 'operador');
  if q = '' then return '[]'; end if;
  return rodar.lista(format('select * from rodar.clientes where telefono ilike %L or alias ilike %L order by baja_at is not null, alias limit 15', '%' || q || '%', '%' || q || '%'));
end $$;
create or replace function public.r_cliente_tel(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes;
begin
  perform rodar.need(p_token, 'operador');
  select * into c from rodar.clientes where telefono = p_q ->> 'tel';
  if not found then return 'null'; end if;
  return to_jsonb(c) || jsonb_build_object(
    'domicilios', rodar.lista('select * from rodar.cliente_domicilios where cliente_id = ' || c.id || ' order by usos desc, ultimo_uso desc'),
    'ultimos', rodar.lista('select id, creado, estado, origen_dir, destino_dir, monto from rodar.viajes where cliente_id = ' || c.id || ' order by id desc limit 10'),
    'negativos', rodar.lista('select n.movil_id, m.numero from rodar.negativos n join rodar.moviles m on m.id = n.movil_id where n.cliente_id = ' || c.id),
    'reservas', rodar.lista('select id, programado, origen_dir from rodar.viajes where cliente_id = ' || c.id || ' and estado = ''reserva'' order by programado'));
end $$;
create or replace function public.r_cliente_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'operador');
  update rodar.clientes set alias = coalesce(p_b ->> 'alias', alias), notas = coalesce(p_b ->> 'notas', notas) where id = (p_q ->> 'id')::bigint;
  return '{"ok":true}';
end $$;
create or replace function public.r_cliente_anotacion(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare tel text := rodar.t(p_b, 'telefono');
begin
  perform rodar.need(p_token, 'operador');
  if tel is null then raise exception 'Ingresá el teléfono'; end if;
  insert into rodar.clientes(telefono, alias, notas, creado) values (tel, rodar.t(p_b, 'alias'), p_b ->> 'notas', rodar.ahora())
  on conflict (telefono) do update set notas = excluded.notas, alias = coalesce(excluded.alias, rodar.clientes.alias);
  return '{"ok":true}';
end $$;
create or replace function public.r_cliente_bloqueo(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador'); c rodar.clientes; b boolean := rodar.b(p_b, 'bloquear');
begin
  update rodar.clientes set bloqueado = b, motivo_bloqueo = case when b then rodar.t(p_b, 'motivo') end, bloqueado_por = case when b then u.id end, bloqueado_at = case when b then rodar.ahora() end
    where id = (p_q ->> 'id')::bigint returning * into c;
  perform rodar.accion(u, case when b then 'cliente_bloqueo' else 'cliente_desbloqueo' end, c.telefono, rodar.t(p_b, 'motivo'));
  return '{"ok":true}';
end $$;
create or replace function public.r_cliente_baja(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador'); c rodar.clientes;
begin
  update rodar.clientes set baja_at = rodar.ahora(), baja_por = u.id where id = (p_q ->> 'id')::bigint returning * into c;
  perform rodar.accion(u, 'cliente_baja', c.telefono, c.alias); return '{"ok":true}';
end $$;
create or replace function public.r_cliente_recuperar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador'); c rodar.clientes;
begin
  update rodar.clientes set baja_at = null, baja_por = null where id = (p_q ->> 'id')::bigint returning * into c;
  perform rodar.accion(u, 'cliente_recupera', c.telefono, c.alias); return '{"ok":true}';
end $$;
create or replace function public.r_cliente_negativos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador'); m rodar.moviles; c rodar.clientes;
begin
  select * into m from rodar.moviles where numero = rodar.n(p_b, 'numero');
  if not found then raise exception 'No existe ese móvil'; end if;
  select * into c from rodar.clientes where id = (p_q ->> 'id')::bigint;
  if rodar.b(p_b, 'quitar') then
    delete from rodar.negativos where cliente_id = c.id and movil_id = m.id; perform rodar.accion(u, 'cliente_negativo_quitar', c.telefono, 'Móvil ' || m.numero);
  else
    insert into rodar.negativos(cliente_id, movil_id, usuario_id, creado) values (c.id, m.id, u.id, rodar.ahora()) on conflict do nothing;
    perform rodar.accion(u, 'cliente_negativo_agregar', c.telefono, 'Móvil ' || m.numero);
  end if;
  return '{"ok":true}';
end $$;
create or replace function public.r_telefonia_ultimos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'operador');
  return rodar.lista('select telefono, max(creado) hora from rodar.viajes where telefono is not null and creado >= rodar.ahora() - interval ''1 day'' group by telefono order by hora desc limit 15');
end $$;
create or replace function public.r_estimar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.usuario(p_token);
  return rodar.estimar((p_b ->> 'origen_lat')::float8, (p_b ->> 'origen_lng')::float8, (p_b ->> 'destino_lat')::float8, (p_b ->> 'destino_lng')::float8, rodar.t(p_b, 'canal'), rodar.t(p_b, 'medio_pago'));
end $$;

-- ---- Viajes ----
create or replace function public.r_viaje_crear(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador'); zp text; ids bigint[] := '{}'; f text;
begin
  if rodar.t(p_b, 'origen_dir') is null then raise exception 'Ingresá la dirección de origen'; end if;
  if p_b ->> 'origen_lat' is not null then
    zp := rodar.peligrosa((p_b ->> 'origen_lat')::float8, (p_b ->> 'origen_lng')::float8);
    if zp is not null and not rodar.b(p_b, 'confirmar_peligrosa') then raise exception 'PELIGROSA:El origen está en una zona peligrosa (%). ¿Confirmás igual?', zp; end if;
  end if;
  if jsonb_typeof(p_b -> 'repetir') = 'object' and jsonb_array_length(coalesce(p_b -> 'repetir' -> 'fechas', '[]')) > 0 then
    for f in select jsonb_array_elements_text(p_b -> 'repetir' -> 'fechas') loop
      ids := ids || rodar.crear_viaje(p_b || jsonb_build_object('programado', f || ' ' || (p_b -> 'repetir' ->> 'hora') || ':00'), u);
    end loop;
  else
    ids := rodar.crear_viaje(p_b, u);
  end if;
  perform rodar.procesar();
  return jsonb_build_object('ids', to_jsonb(ids));
end $$;

create or replace function public.r_viajes(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare w text := 'true'; total bigint; filas jsonb; lim int := least(500, coalesce(rodar.n(p_q, 'limite'), 25)::int); off int := coalesce(rodar.n(p_q, 'offset'), 0)::int;
begin
  perform rodar.need(p_token, 'operador', 'gestion');
  if rodar.t(p_q, 'estado') is not null then w := w || format(' and v.estado = %L', p_q ->> 'estado'); end if;
  if rodar.t(p_q, 'desde') is not null then w := w || format(' and v.creado >= %L::timestamp', p_q ->> 'desde'); end if;
  if rodar.t(p_q, 'hasta') is not null then w := w || format(' and v.creado <= %L::timestamp', p_q ->> 'hasta'); end if;
  if rodar.t(p_q, 'origen') is not null then w := w || format(' and v.origen_tipo = %L', p_q ->> 'origen'); end if;
  if rodar.t(p_q, 'canal') is not null then w := w || format(' and v.canal = %L', p_q ->> 'canal'); end if;
  if rodar.t(p_q, 'telefono') is not null then w := w || format(' and v.telefono ilike %L', '%' || (p_q ->> 'telefono') || '%'); end if;
  if rodar.n(p_q, 'movil') is not null then w := w || format(' and m.numero = %s', rodar.n(p_q, 'movil')); end if;
  if rodar.t(p_q, 'patente') is not null then w := w || format(' and m.patente ilike %L', '%' || (p_q ->> 'patente') || '%'); end if;
  if rodar.t(p_q, 'licencia') is not null then w := w || format(' and m.licencia ilike %L', '%' || (p_q ->> 'licencia') || '%'); end if;
  if rodar.t(p_q, 'direccion') is not null then w := w || format(' and v.origen_dir ilike %L', '%' || (p_q ->> 'direccion') || '%'); end if;
  if rodar.t(p_q, 'buscar') is not null then w := w || format(' and (v.alias ilike %1$L or v.telefono ilike %1$L or v.origen_dir ilike %1$L or v.id::text = %2$L)', '%' || (p_q ->> 'buscar') || '%', p_q ->> 'buscar'); end if;
  execute 'select count(*) from rodar.viajes v left join rodar.moviles m on m.id = v.movil_id where ' || w into total;
  filas := rodar.lista(format('select v.*, m.numero movil_numero, z.nombre zona from rodar.viajes v left join rodar.moviles m on m.id = v.movil_id left join rodar.zonas z on z.id = v.zona_id where %s order by v.id desc limit %s offset %s', w, lim, off));
  return jsonb_build_object('total', total, 'filas', filas);
end $$;

create or replace function public.r_viaje(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare d jsonb;
begin
  perform rodar.need(p_token, 'operador', 'gestion');
  d := rodar.viaje_detalle((p_q ->> 'id')::bigint);
  if d is null then raise exception 'No existe'; end if;
  return d || jsonb_build_object('eventos', rodar.lista(format('select * from rodar.eventos_moviles where ref = %L order by id', '#' || (p_q ->> 'id'))));
end $$;

-- Ticket: lo puede ver el operador/gestión, el conductor, el titular o la empresa corporativa del viaje
create or replace function public.r_ticket(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); v rodar.viajes;
begin
  select * into v from rodar.viajes where id = (p_q ->> 'id')::bigint;
  if not found then raise exception 'No existe'; end if;
  if not (rodar.tiene(u, 'operador', 'gestion') or v.conductor_id = u.id or exists(select 1 from rodar.moviles where id = v.movil_id and titular_id = u.id)
          or (u.corporativo_id is not null and v.corporativo_id = u.corporativo_id)) then raise exception 'Sin permiso'; end if;
  return rodar.viaje_detalle(v.id) || jsonb_build_object('empresa', rodar.cfg('empresa'));
end $$;

create or replace function public.r_viaje_anular(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador');
begin perform rodar.anular((p_q ->> 'id')::bigint, u, rodar.t(p_b, 'motivo')); return '{"ok":true}'; end $$;
create or replace function public.r_viaje_reenviar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'operador'); perform rodar.reasignar((p_q ->> 'id')::bigint); return '{"ok":true}'; end $$;
create or replace function public.r_viaje_asignar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador'); m rodar.moviles; v rodar.viajes;
begin
  select * into m from rodar.moviles where numero = rodar.n(p_b, 'numero');
  if not found then raise exception 'No existe el móvil %', p_b ->> 'numero'; end if;
  if m.conductor_id is null then raise exception 'El móvil no tiene conductor conectado'; end if;
  select * into v from rodar.viajes where id = (p_q ->> 'id')::bigint;
  if v.movil_id is not null and v.movil_id <> m.id and v.estado in ('ofrecido', 'confirmado') then
    update rodar.moviles set estado = 'disponible' where id = v.movil_id and estado = 'confirmado';
    perform rodar.emit('movil-' || v.movil_id, 'oferta_cancelada', jsonb_build_object('viajeId', v.id)); perform rodar.emitir_movil(v.movil_id);
  end if;
  perform rodar.aceptar(v.id, m.id, true, u);
  perform rodar.emit('movil-' || m.id, 'asignado', jsonb_build_object('id', v.id));
  return '{"ok":true}';
end $$;
create or replace function public.r_viaje_finalizar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'operador'); return rodar.finalizar((p_q ->> 'id')::bigint, null, null, rodar.n(p_b, 'monto')); end $$;
create or replace function public.r_viaje_oferta(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare v rodar.viajes;
begin
  perform rodar.need(p_token, 'operador');
  select * into v from rodar.viajes where id = (p_q ->> 'id')::bigint;
  if v.estado = 'ofrecido' and v.movil_id is not null then perform rodar.emit('movil-' || v.movil_id, 'oferta_cancelada', jsonb_build_object('viajeId', v.id)); end if;
  update rodar.viajes set a_oferta = true, estado = 'pendiente', movil_id = null, conductor_id = null, oferta_expira = null where id = v.id and estado in ('pendiente', 'ofrecido');
  perform rodar.emitir_viaje(v.id); perform rodar.procesar();
  return '{"ok":true}';
end $$;
create or replace function public.r_viaje_enlace(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.usuario(p_token); return jsonb_build_object('url', 'pasajero.html#/seguimiento/' || (p_q ->> 'id') || '?k=' || rodar.firma((p_q ->> 'id')::bigint)); end $$;

-- ---- Reservas ----
create or replace function public.r_reservas(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare w text := 'v.estado = ''reserva''';
begin
  perform rodar.need(p_token, 'operador');
  if rodar.t(p_q, 'desde') is not null then w := w || format(' and v.programado >= %L::date', p_q ->> 'desde'); end if;
  if rodar.t(p_q, 'hasta') is not null then w := w || format(' and v.programado < %L::date + 1', p_q ->> 'hasta'); end if;
  if rodar.t(p_q, 'buscar') is not null then w := w || format(' and (v.alias ilike %1$L or v.telefono ilike %1$L or v.origen_dir ilike %1$L)', '%' || (p_q ->> 'buscar') || '%'); end if;
  return rodar.lista('select v.*, trim(o.nombre || '' '' || coalesce(o.apellido, '''')) operador, z.nombre zona from rodar.viajes v left join rodar.usuarios o on o.id = v.operador_id left join rodar.zonas z on z.id = v.zona_id where ' || w || ' order by v.programado');
end $$;
create or replace function public.r_reservas_anular(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador'); i bigint;
begin
  for i in select (jsonb_array_elements_text(coalesce(p_b -> 'ids', '[]')))::bigint loop
    begin perform rodar.anular(i, u, 'Reserva anulada'); exception when others then null; end;
  end loop;
  return '{"ok":true}';
end $$;

-- ---- Chat de clientes ----
create or replace function public.r_chat(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'operador');
  return rodar.lista(format('select c.*, (select texto from rodar.chat_msg where conv_id = c.id order by id desc limit 1) ultimo from rodar.chat_conv c where estado = %L order by actualizado desc', coalesce(rodar.t(p_q, 'estado'), 'abierta')));
end $$;
create or replace function public.r_chat_conv(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare id bigint := (p_q ->> 'id')::bigint;
begin
  perform rodar.need(p_token, 'operador');
  update rodar.chat_conv set no_leidos = 0 where chat_conv.id = id;
  return jsonb_build_object('conv', (select to_jsonb(c) from rodar.chat_conv c where c.id = id), 'mensajes', rodar.lista('select * from rodar.chat_msg where conv_id = ' || id || ' order by id'));
end $$;
create or replace function public.r_chat_enviar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare id bigint := (p_q ->> 'id')::bigint;
begin
  perform rodar.need(p_token, 'operador');
  if p_b ? 'cerrar' then update rodar.chat_conv set estado = case when rodar.b(p_b, 'cerrar') then 'resuelta' else 'abierta' end where chat_conv.id = id; return '{"ok":true}'; end if;
  insert into rodar.chat_msg(conv_id, de, texto, fecha) values (id, 'operador', p_b ->> 'texto', rodar.ahora());
  update rodar.chat_conv set actualizado = rodar.ahora() where chat_conv.id = id;
  perform rodar.emit('panel', 'chat', jsonb_build_object('conv', id));
  return '{"ok":true}';
end $$;
create or replace function rodar.chat_entrante(p_canal text, p_tel text, p_alias text, p_texto text) returns bigint language plpgsql as $$
declare cid bigint;
begin
  select id into cid from rodar.chat_conv where telefono = p_tel and canal = coalesce(p_canal, 'whatsapp') and estado = 'abierta';
  if cid is null then insert into rodar.chat_conv(canal, telefono, alias, actualizado) values (coalesce(p_canal, 'whatsapp'), p_tel, p_alias, rodar.ahora()) returning id into cid; end if;
  insert into rodar.chat_msg(conv_id, de, texto, fecha) values (cid, 'cliente', p_texto, rodar.ahora());
  update rodar.chat_conv set no_leidos = no_leidos + 1, actualizado = rodar.ahora() where id = cid;
  perform rodar.emit('panel', 'chat', jsonb_build_object('conv', cid, 'nuevo', true));
  return cid;
end $$;
create or replace function public.r_chat_simular(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'operador'); return jsonb_build_object('id', rodar.chat_entrante(rodar.t(p_b, 'canal'), p_b ->> 'telefono', rodar.t(p_b, 'alias'), p_b ->> 'texto')); end $$;

-- Webhooks para integraciones externas (POST https://TU-PROYECTO.supabase.co/rest/v1/rpc/webhook_chat con header apikey)
create or replace function public.webhook_chat(token text, telefono text, texto text, canal text default 'whatsapp', alias text default null) returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  if token is distinct from rodar.cfg('webhook_token') #>> '{}' then raise exception 'token inválido'; end if;
  return jsonb_build_object('id', rodar.chat_entrante(canal, telefono, alias, texto));
end $$;
create or replace function public.webhook_llamada(token text, telefono text, linea int default 1, interno text default null) returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  if token is distinct from rodar.cfg('webhook_token') #>> '{}' then raise exception 'token inválido'; end if;
  perform rodar.emit('panel', 'llamada', jsonb_build_object('linea', linea, 'interno', interno, 'telefono', telefono));
  return '{"ok":true}';
end $$;
create or replace function public.r_llamada_simular(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'operador');
  perform rodar.emit('panel', 'llamada', jsonb_build_object('linea', coalesce(rodar.n(p_b, 'linea'), 1), 'interno', coalesce(rodar.t(p_b, 'interno'), 'Int ' || coalesce(p_b ->> 'linea', '1')), 'telefono', p_b ->> 'telefono'));
  return '{"ok":true}';
end $$;

-- ---- Soporte / reclamos ----
create or replace function public.r_soporte(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare w text := 'true'; q text := rodar.t(p_q, 'q');
begin
  perform rodar.need(p_token, 'operador');
  if p_q ->> 'filtro' = 'no_leidos' then w := w || ' and c.no_leidos > 0'; end if;
  if p_q ->> 'filtro' = 'moviles' then w := w || ' and c.tipo = ''movil'''; end if;
  if p_q ->> 'filtro' = 'clientes' then w := w || ' and c.tipo = ''cliente'''; end if;
  if q is not null then w := w || format(' and (c.asunto ilike %1$L or c.cliente_tel ilike %1$L or c.cliente_alias ilike %1$L or m.numero::text ilike %1$L)', '%' || q || '%'); end if;
  return rodar.lista('select c.*, m.numero movil_numero, (select texto from rodar.soporte_msg where conv_id = c.id order by id desc limit 1) ultimo from rodar.soporte_conv c left join rodar.moviles m on m.id = c.movil_id where ' || w || ' order by c.actualizado desc');
end $$;
create or replace function public.r_soporte_conv(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare id bigint := (p_q ->> 'id')::bigint;
begin
  perform rodar.need(p_token, 'operador');
  update rodar.soporte_conv set no_leidos = 0 where soporte_conv.id = id;
  return jsonb_build_object('conv', (select to_jsonb(c) || jsonb_build_object('movil_numero', m.numero) from rodar.soporte_conv c left join rodar.moviles m on m.id = c.movil_id where c.id = id),
    'mensajes', rodar.lista('select * from rodar.soporte_msg where conv_id = ' || id || ' order by id'));
end $$;
create or replace function public.r_soporte_enviar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.soporte_conv;
begin
  perform rodar.need(p_token, 'operador');
  select * into c from rodar.soporte_conv where id = (p_q ->> 'id')::bigint;
  if p_b ? 'cerrar' then update rodar.soporte_conv set cerrada = rodar.b(p_b, 'cerrar') where id = c.id; return '{"ok":true}'; end if;
  insert into rodar.soporte_msg(conv_id, de, texto, fecha) values (c.id, 'central', p_b ->> 'texto', rodar.ahora());
  update rodar.soporte_conv set actualizado = rodar.ahora() where id = c.id;
  if c.movil_id is not null then perform rodar.emit('movil-' || c.movil_id, 'mensaje', jsonb_build_object('de', 'Central', 'texto', p_b ->> 'texto', 'conv', c.id)); end if;
  return '{"ok":true}';
end $$;
create or replace function public.r_soporte_nuevo(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare m rodar.moviles; cid bigint;
begin
  perform rodar.need(p_token, 'operador');
  select * into m from rodar.moviles where numero = rodar.n(p_b, 'numero');
  if not found then raise exception 'No existe el móvil'; end if;
  insert into rodar.soporte_conv(tipo, movil_id, asunto, actualizado) values ('movil', m.id, coalesce(rodar.t(p_b, 'asunto'), 'Mensaje de la central'), rodar.ahora()) returning id into cid;
  insert into rodar.soporte_msg(conv_id, de, texto, fecha) values (cid, 'central', p_b ->> 'texto', rodar.ahora());
  perform rodar.emit('movil-' || m.id, 'mensaje', jsonb_build_object('de', 'Central', 'texto', p_b ->> 'texto', 'conv', cid));
  return jsonb_build_object('id', cid);
end $$;
