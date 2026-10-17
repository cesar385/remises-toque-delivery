-- ===================== API: app de conductores, pedido web, carga de saldo =====================

create or replace function rodar.movil_sesion(p_token text) returns rodar.moviles language plpgsql as $$
declare s rodar.sesiones; m rodar.moviles;
begin
  perform rodar.usuario(p_token);
  select * into s from rodar.sesiones where token = p_token;
  if s.movil_id is null then raise exception 'Sesión sin móvil'; end if;
  select * into m from rodar.moviles where id = s.movil_id;
  return m;
end $$;

create or replace function public.r_cond_moviles(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios; us text := trim(coalesce(p_b ->> 'usuario', '')); cd timestamp;
begin
  select * into u from rodar.usuarios where (usuario = us or documento = us) and habilitado;
  if not found or not rodar.verificar(coalesce(p_b ->> 'password', ''), u.password_hash) then raise exception 'Usuario o contraseña incorrectos'; end if;
  if not rodar.tiene(u, 'conductor', 'titular') then raise exception 'El usuario no es conductor'; end if;
  select max(cooldown_hasta) into cd from rodar.sesiones where usuario_id = u.id;
  if cd > rodar.ahora() then raise exception 'Sesión suspendida hasta %', to_char(cd, 'HH24:MI'); end if;
  return rodar.lista('select m.id, m.numero, m.patente, m.estado, m.conductor_id from rodar.moviles m join rodar.movil_conductores mc on mc.movil_id = m.id where mc.usuario_id = ' || u.id || ' and m.habilitado order by m.numero');
end $$;

create or replace function public.r_cond_iniciar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); m rodar.moviles := rodar.movil_sesion(p_token);
begin
  if not exists(select 1 from rodar.movil_conductores where movil_id = m.id and usuario_id = u.id) then raise exception 'No estás asignado a ese móvil'; end if;
  if m.conductor_id is not null and m.conductor_id <> u.id and m.estado <> 'desconectado' and not m.simulado then raise exception 'Otro conductor está usando el móvil'; end if;
  update rodar.moviles set conductor_id = u.id, simulado = false, estado = case when estado = 'desconectado' then 'disponible' else estado end where id = m.id;
  delete from rodar.sim_estado where movil_id = m.id;
  perform rodar.evento_movil(m.id, 'login', null, 'Ingreso ' || rodar.nombre(u));
  perform rodar.emitir_movil(m.id);
  return '{"ok":true}';
end $$;

create or replace function public.r_cond_estado(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); m rodar.moviles := rodar.movil_sesion(p_token); vid bigint; t rodar.tarifas;
begin
  perform rodar.procesar();
  select id into vid from rodar.viajes where movil_id = m.id and estado in ('ofrecido', 'confirmado', 'en_curso') order by id desc limit 1;
  t := rodar.tarifa_vigente();
  return jsonb_build_object('movil', rodar.movil_publico(m), 'conductor', jsonb_build_object('nombre', u.nombre, 'apellido', u.apellido, 'documento', u.documento),
    'viaje', case when vid is not null then rodar.viaje_detalle(vid) end,
    'paradas', coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'nombre', z.nombre, 'lat', z.parada_lat, 'lng', z.parada_lng,
        'cola', coalesce((select jsonb_agg(x.numero order by x.parada_ingreso) from rodar.moviles x where x.estado = 'en_parada' and x.parada_id = z.id), '[]')) order by z.orden) from rodar.zonas z where z.es_parada), '[]'),
    'tarifa', case when t.id is null then null else to_jsonb(t) end, 'saldo', rodar.saldo(m.id), 'cuenta', rodar.estado_cuenta(m),
    'zonas', rodar.lista('select * from rodar.zonas order by orden'), 'peligrosas', rodar.lista('select * from rodar.zonas_peligrosas'),
    'empresa', rodar.cfg('empresa'), 'mensajes', rodar.lista('select * from rodar.mensajes_flota order by id desc limit 5'), 'canal', rodar.topico(''),
    'abiertas', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'origen_dir', v.origen_dir, 'zona', z.nombre, 'destino_dir', v.destino_dir) order by v.id)
      from rodar.viajes v left join rodar.zonas z on z.id = v.zona_id where v.estado = 'pendiente' and v.a_oferta and rodar.elegible(m, v)), '[]'));
end $$;

create or replace function public.r_cond_set_estado(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); m rodar.moviles := rodar.movil_sesion(p_token); e text := p_b ->> 'estado';
begin
  if e not in ('disponible', 'fuera_servicio', 'en_parada', 'emergencia') then raise exception 'Estado inválido'; end if;
  if m.estado in ('confirmado', 'con_pasajero') and e <> 'emergencia' then raise exception 'Tenés un viaje en curso'; end if;
  perform rodar.set_estado_movil(m.id, e, rodar.n(p_b, 'parada_id')::bigint, false);
  if e = 'fuera_servicio' then perform rodar.evento_movil(m.id, 'fuera_servicio', null, 'Fuera de servicio'); end if;
  if e = 'emergencia' then
    perform rodar.evento_movil(m.id, 'emergencia', null, 'BOTÓN DE EMERGENCIA');
    insert into rodar.posiciones(movil_id, ts, lat, lng, estado) values (m.id, rodar.ahora(), m.lat, m.lng, 'emergencia');
    perform rodar.emit('panel', 'emergencia', jsonb_build_object('movil', m.numero, 'lat', m.lat, 'lng', m.lng, 'conductor', rodar.nombre(u)));
  end if;
  perform rodar.procesar();
  return '{"ok":true}';
end $$;

create or replace function public.r_cond_posicion(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare m rodar.moviles := rodar.movil_sesion(p_token); lat float8 := (p_b ->> 'lat')::float8; lng float8 := (p_b ->> 'lng')::float8; z rodar.zonas;
begin
  if lat is null then return '{"ok":true}'; end if;
  perform rodar.posicion(m.id, lat, lng, (p_b ->> 'vel')::float8, (p_b ->> 'rumbo')::float8, true);
  -- las posiciones no se emiten por tiempo real (ahorra mensajes): el mapa las consulta cada pocos segundos
  if m.estado = 'en_parada' then z := rodar.zona_de(lat, lng); if z.id is distinct from m.parada_id then perform rodar.set_estado_movil(m.id, 'disponible'); end if; end if;
  perform rodar.procesar();
  return jsonb_build_object('ok', true, 'peligrosa', rodar.peligrosa(lat, lng));
end $$;

create or replace function public.r_cond_viaje(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); m rodar.moviles := rodar.movil_sesion(p_token); vid bigint := (p_q ->> 'id')::bigint; op text := p_q ->> 'op';
begin
  if op in ('aceptar', 'postular') then perform rodar.aceptar(vid, m.id);
  elsif op = 'rechazar' then perform rodar.rechazar(vid, m.id); perform rodar.procesar();
  elsif op = 'llegue' then perform rodar.llegada(vid);
  elsif op = 'iniciar' then perform rodar.iniciar(vid, p_b ->> 'pin');
  elsif op = 'finalizar' then
    return rodar.finalizar(vid, coalesce(rodar.n(p_b, 'metros'), 0), coalesce(rodar.n(p_b, 'esperaSeg'), 0), rodar.n(p_b, 'monto'), (p_b ->> 'lat')::float8, (p_b ->> 'lng')::float8, rodar.t(p_b, 'destino_dir'));
  elsif op = 'cancelar' then perform rodar.anular(vid, u, 'Cancelado por el conductor: ' || coalesce(p_b ->> 'motivo', ''));
  else raise exception 'Operación desconocida'; end if;
  return rodar.viaje_detalle(vid);
end $$;

create or replace function public.r_cond_calle(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); m rodar.moviles := rodar.movil_sesion(p_token); ids bigint[]; p text;
begin
  if m.estado not in ('disponible', 'en_parada') then raise exception 'Tenés que estar Libre o en Parada'; end if;
  ids := rodar.crear_viaje(jsonb_build_object('origen_dir', coalesce(rodar.t(p_b, 'origen_dir'), 'Viaje de calle'), 'origen_lat', m.lat, 'origen_lng', m.lng, 'destino_dir', p_b ->> 'destino_dir',
    'destino_lat', p_b -> 'destino_lat', 'destino_lng', p_b -> 'destino_lng', 'canal', 'movil', 'origen_tipo', 'calle', 'alias', 'CALLE', 'estado', 'pendiente', 'movil_id', m.id, 'conductor_id', u.id, 'pin_requerido', false), null);
  if m.estado = 'en_parada' then update rodar.viajes set parada_id = m.parada_id where id = ids[1]; end if;
  perform rodar.aceptar(ids[1], m.id);
  select pin into p from rodar.viajes where id = ids[1];
  perform rodar.iniciar(ids[1], p);
  return rodar.viaje_detalle(ids[1]);
end $$;

create or replace function public.r_cond_viajes(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token);
begin return rodar.lista('select id, creado, origen_dir, destino_dir, monto, km, estado, medio_pago from rodar.viajes where conductor_id = ' || u.id || ' and creado >= rodar.ahora() - interval ''7 days'' order by id desc limit 100'); end $$;
create or replace function public.r_cond_movimientos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare m rodar.moviles := rodar.movil_sesion(p_token);
begin return jsonb_build_object('saldo', rodar.saldo(m.id), 'movimientos', rodar.lista('select * from rodar.cuenta_movimientos where movil_id = ' || m.id || ' order by id desc limit 60')); end $$;
create or replace function public.r_cond_soporte(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare m rodar.moviles := rodar.movil_sesion(p_token); cid bigint;
begin
  select id into cid from rodar.soporte_conv where tipo = 'movil' and movil_id = m.id order by id desc limit 1;
  if cid is null then return '[]'; end if;
  return rodar.lista('select * from rodar.soporte_msg where conv_id = ' || cid || ' order by id');
end $$;
create or replace function public.r_cond_soporte_enviar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare m rodar.moviles := rodar.movil_sesion(p_token); cid bigint;
begin
  select id into cid from rodar.soporte_conv where tipo = 'movil' and movil_id = m.id and not cerrada order by id desc limit 1;
  if cid is null then insert into rodar.soporte_conv(tipo, movil_id, asunto, actualizado) values ('movil', m.id, 'Consulta app conductor', rodar.ahora()) returning id into cid; end if;
  insert into rodar.soporte_msg(conv_id, de, texto, fecha) values (cid, 'movil', p_b ->> 'texto', rodar.ahora());
  update rodar.soporte_conv set no_leidos = no_leidos + 1, actualizado = rodar.ahora() where id = cid;
  perform rodar.emit('panel', 'soporte', jsonb_build_object('conv', cid));
  return '{"ok":true}';
end $$;
create or replace function public.r_cond_salir(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare m rodar.moviles := rodar.movil_sesion(p_token);
begin
  update rodar.moviles set estado = 'desconectado', conductor_id = null, parada_id = null where id = m.id and estado not in ('confirmado', 'con_pasajero');
  update rodar.sesiones set activa = false where token = p_token;
  perform rodar.evento_movil(m.id, case when rodar.b(p_b, 'cerrar_app') then 'cerroapp' else 'logout' end, null, case when rodar.b(p_b, 'cerrar_app') then 'Cerró la app' else 'Cambio de conductor / salida' end);
  perform rodar.emitir_movil(m.id);
  return '{"ok":true}';
end $$;

-- Carga de saldo (conductor desde la app o titular desde el panel). Queda pendiente hasta que se acredita.
create or replace function public.r_cargar_saldo(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); s rodar.sesiones := rodar.sesion(p_token); m rodar.moviles; monto numeric := rodar.n(p_b, 'monto'); nid bigint; mp jsonb := rodar.cfg('mp', '{}');
begin
  select * into m from rodar.moviles where id = coalesce(s.movil_id, rodar.n(p_b, 'movil_id')::bigint);
  if not found then raise exception 'Elegí un móvil'; end if;
  if not (m.titular_id = u.id or exists(select 1 from rodar.movil_conductores where movil_id = m.id and usuario_id = u.id) or rodar.tiene(u, 'admin')) then raise exception 'Sin permiso sobre ese móvil'; end if;
  if coalesce(monto, 0) <= 0 then raise exception 'Monto inválido'; end if;
  insert into rodar.mp_pagos(tipo, movil_id, monto, estado, fecha) values ('recarga', m.id, monto, 'pendiente', rodar.ahora()) returning id into nid;
  return jsonb_build_object('id', nid, 'link', nullif(mp ->> 'link_pago', ''), 'alias', nullif(mp ->> 'alias_cobro', ''),
    'mensaje', 'La carga #' || nid || ' quedó pendiente. ' || case when coalesce(mp ->> 'alias_cobro', '') <> '' then 'Transferí a ' || (mp ->> 'alias_cobro') || ' indicando la carga #' || nid || '. ' else '' end ||
      'Cuando la central confirme el pago se acredita en tu cuenta.');
end $$;

-- Solicitud de alta de conductor (pública)
create or replace function public.r_solicitud_conductor(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  if rodar.t(p_b, 'nombre') is null or rodar.t(p_b, 'dni') is null or rodar.t(p_b, 'telefono') is null then raise exception 'Completá nombre, DNI y teléfono'; end if;
  if (select count(*) from rodar.solicitudes_conductor where fecha > rodar.ahora() - interval '1 hour') > 30 then raise exception 'Demasiadas solicitudes, probá más tarde'; end if;
  insert into rodar.solicitudes_conductor(nombre, apellido, dni, telefono, email, patente, marca, modelo, anio, origen, docs, fecha)
  values (p_b ->> 'nombre', p_b ->> 'apellido', p_b ->> 'dni', p_b ->> 'telefono', p_b ->> 'email', p_b ->> 'patente', p_b ->> 'marca', p_b ->> 'modelo', rodar.n(p_b, 'anio')::int, coalesce(rodar.t(p_b, 'origen'), 'web'), coalesce((p_b -> 'docs')::text, '[]'), rodar.ahora());
  perform rodar.emit('panel', 'aviso', jsonb_build_object('texto', 'Nueva solicitud de alta de conductor: ' || (p_b ->> 'nombre') || ' ' || coalesce(p_b ->> 'apellido', '')));
  return '{"ok":true}';
end $$;

-- ================= Pasajero (público) =================
create or replace function public.r_pub_config(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare e jsonb := rodar.cfg('empresa', '{}');
begin
  return jsonb_build_object('nombre', e ->> 'nombre', 'lat', e -> 'lat', 'lng', e -> 'lng', 'telefono', e ->> 'telefono', 'localidad', e ->> 'localidad', 'provincia', e ->> 'provincia',
    'medios', rodar.lista('select codigo, nombre from rodar.medios_pago where habilitado and codigo not in (''cuenta_corriente'') order by orden'));
end $$;
create or replace function public.r_pub_estimar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  if p_b ->> 'origen_lat' is null then return 'null'; end if;
  return rodar.estimar((p_b ->> 'origen_lat')::float8, (p_b ->> 'origen_lng')::float8, (p_b ->> 'destino_lat')::float8, (p_b ->> 'destino_lng')::float8, 'web', rodar.t(p_b, 'medio_pago'), rodar.n(p_b, 'metros_ruta')::float8);
end $$;
create or replace function public.r_pub_viaje(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare tel text := regexp_replace(coalesce(p_b ->> 'telefono', ''), '\D', '', 'g'); corp bigint; medio text := coalesce(rodar.t(p_b, 'medio_pago'), 'efectivo'); ids bigint[]; s rodar.usuarios;
begin
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
create or replace function public.r_pub_seguimiento(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare vid bigint := (p_q ->> 'id')::bigint;
begin
  if p_q ->> 'k' is distinct from rodar.firma(vid) then raise exception 'Enlace inválido'; end if;
  perform rodar.procesar();
  return rodar.publico_pasajero(vid) || jsonb_build_object('canal', rodar.topico('viaje-' || vid || '-' || rodar.firma(vid)));
end $$;
create or replace function public.r_pub_cancelar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare vid bigint := (p_q ->> 'id')::bigint; nada rodar.usuarios;
begin
  if p_q ->> 'k' is distinct from rodar.firma(vid) then raise exception 'Enlace inválido'; end if;
  perform rodar.anular(vid, nada, 'Cancelado por el pasajero');
  return '{"ok":true}';
end $$;
create or replace function public.r_pub_calificar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare vid bigint := (p_q ->> 'id')::bigint;
begin
  if p_q ->> 'k' is distinct from rodar.firma(vid) then raise exception 'Enlace inválido'; end if;
  update rodar.viajes set calificacion = greatest(1, least(5, coalesce(rodar.n(p_b, 'estrellas'), 5)::int)) where id = vid and estado = 'finalizado';
  return '{"ok":true}';
end $$;
create or replace function public.r_pub_soporte(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare cid bigint; tel text := rodar.t(p_b, 'telefono');
begin
  if tel is null or rodar.t(p_b, 'texto') is null then raise exception 'Completá teléfono y mensaje'; end if;
  select id into cid from rodar.soporte_conv where tipo = 'cliente' and cliente_tel = tel and not cerrada;
  if cid is null then insert into rodar.soporte_conv(tipo, cliente_tel, cliente_alias, asunto, actualizado) values ('cliente', tel, rodar.t(p_b, 'alias'), 'Consulta app pasajero', rodar.ahora()) returning id into cid; end if;
  insert into rodar.soporte_msg(conv_id, de, texto, fecha) values (cid, 'cliente', p_b ->> 'texto', rodar.ahora());
  update rodar.soporte_conv set no_leidos = no_leidos + 1, actualizado = rodar.ahora() where id = cid;
  perform rodar.emit('panel', 'soporte', jsonb_build_object('conv', cid));
  return '{"ok":true}';
end $$;
