-- Cuentas de clientes (app de pasajeros): email + contraseña, mis viajes, lugares guardados, reservas y perfil.
alter table rodar.clientes add column if not exists email text;
alter table rodar.clientes add column if not exists password_hash text;
alter table rodar.clientes add column if not exists cuenta_creada timestamp;
alter table rodar.clientes add column if not exists medio_pago_pref text;
create unique index if not exists ux_clientes_email on rodar.clientes (lower(email)) where email is not null;
alter table rodar.cliente_domicilios add column if not exists etiqueta text;
create table if not exists rodar.sesiones_clientes (
  token text primary key, cliente_id bigint not null, inicio timestamp, ultimo timestamp, activa boolean default true
);
create index if not exists ix_ses_cli on rodar.sesiones_clientes(cliente_id);

create or replace function rodar.cliente_sesion(p_token text) returns rodar.clientes language plpgsql as $$
declare s rodar.sesiones_clientes; c rodar.clientes;
begin
  select * into s from rodar.sesiones_clientes where token = p_token and activa;
  if not found then raise exception 'SESION_VENCIDA'; end if;
  select * into c from rodar.clientes where id = s.cliente_id and email is not null and baja_at is null;
  if not found then raise exception 'SESION_VENCIDA'; end if;
  if c.bloqueado then raise exception 'Tu cuenta está bloqueada. Comunicate con la central.'; end if;
  if s.ultimo is null or s.ultimo < rodar.ahora() - interval '1 minute' then update rodar.sesiones_clientes set ultimo = rodar.ahora() where token = p_token; end if;
  return c;
end $$;

create or replace function rodar.cliente_publico(c rodar.clientes) returns jsonb language sql stable as $$
  select jsonb_build_object('id', c.id, 'nombre', c.alias, 'email', c.email, 'telefono', c.telefono, 'medio_pago_pref', c.medio_pago_pref, 'desde', c.cuenta_creada,
    'lugares', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'etiqueta', d.etiqueta, 'direccion', d.direccion, 'localidad', d.localidad, 'provincia', d.provincia, 'referencias', d.referencias, 'lat', d.lat, 'lng', d.lng) order by d.etiqueta)
      from rodar.cliente_domicilios d where d.cliente_id = c.id and d.etiqueta is not null), '[]'),
    'recientes', coalesce((select jsonb_agg(x) from (select jsonb_build_object('id', d.id, 'direccion', d.direccion, 'localidad', d.localidad, 'provincia', d.provincia, 'lat', d.lat, 'lng', d.lng) x
      from rodar.cliente_domicilios d where d.cliente_id = c.id and d.lat is not null order by d.ultimo_uso desc nulls last limit 6) z), '[]'))
$$;

create or replace function rodar.nueva_sesion_cliente(p_cliente bigint) returns text language plpgsql as $$
declare tk text := rodar.token();
begin
  insert into rodar.sesiones_clientes(token, cliente_id, inicio, ultimo) values (tk, p_cliente, rodar.ahora(), rodar.ahora());
  return tk;
end $$;

create or replace function rodar.limitar(p_clave text, p_max int, p_ventana interval, p_msj text) returns void language plpgsql as $$
begin
  if (select count(*) from rodar.limite_pedidos where clave = p_clave and ts > now() - p_ventana) >= p_max then raise exception '%', p_msj; end if;
  insert into rodar.limite_pedidos(clave) values (p_clave);
end $$;

create or replace function public.r_cli_registro(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare nom text := trim(coalesce(p_b ->> 'nombre', '')); em text := lower(trim(coalesce(p_b ->> 'email', ''))); tel text := regexp_replace(coalesce(p_b ->> 'telefono', ''), '\D', '', 'g');
pw text := coalesce(p_b ->> 'password', ''); c rodar.clientes;
begin
  if nom = '' then raise exception 'Escribí tu nombre'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el email: no parece válido'; end if;
  if length(tel) < 8 then raise exception 'Escribí tu celular con característica (ej. 3454 123456)'; end if;
  if length(pw) < 6 then raise exception 'La contraseña tiene que tener al menos 6 caracteres'; end if;
  perform rodar.limitar('registro', 30, interval '1 hour', 'Hay muchos registros en este momento, probá en unos minutos.');
  if exists(select 1 from rodar.clientes where lower(email) = em) then raise exception 'Ya hay una cuenta con ese email. Tocá "Ingresar" o "Olvidé mi contraseña".'; end if;
  select * into c from rodar.clientes where telefono = tel;
  if found then
    if c.email is not null then raise exception 'Ese celular ya tiene una cuenta con otro email. Si es tuyo, comunicate con la central.'; end if;
    if c.bloqueado then raise exception 'No podemos crear la cuenta. Comunicate con la central.'; end if;
    update rodar.clientes set email = em, password_hash = rodar.hash(pw), alias = nom, cuenta_creada = rodar.ahora(), baja_at = null where id = c.id returning * into c;
  else
    insert into rodar.clientes(telefono, alias, email, password_hash, cuenta_creada, creado) values (tel, nom, em, rodar.hash(pw), rodar.ahora(), rodar.ahora()) returning * into c;
  end if;
  return jsonb_build_object('token', rodar.nueva_sesion_cliente(c.id), 'cliente', rodar.cliente_publico(c));
end $$;

create or replace function public.r_cli_login(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare em text := lower(trim(coalesce(p_b ->> 'email', ''))); c rodar.clientes;
begin
  if (select count(*) from rodar.limite_pedidos where clave = 'login:' || em and ts > now() - interval '15 minutes') >= 8 then
    raise exception 'Demasiados intentos. Esperá 15 minutos o tocá "Olvidé mi contraseña".'; end if;
  select * into c from rodar.clientes where lower(email) = em;
  if not found or c.password_hash is null or not rodar.verificar(coalesce(p_b ->> 'password', ''), c.password_hash) then
    insert into rodar.limite_pedidos(clave) values ('login:' || em);
    raise exception 'El email o la contraseña no coinciden';
  end if;
  if c.bloqueado then raise exception 'Tu cuenta está bloqueada. Comunicate con la central.'; end if;
  if c.baja_at is not null then update rodar.clientes set baja_at = null where id = c.id returning * into c; end if;
  return jsonb_build_object('token', rodar.nueva_sesion_cliente(c.id), 'cliente', rodar.cliente_publico(c));
end $$;

create or replace function public.r_cli_logout(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin update rodar.sesiones_clientes set activa = false where token = p_token; return '{"ok":true}'; end $$;

create or replace function public.r_cli_perfil(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token);
begin return rodar.cliente_publico(c); end $$;

create or replace function public.r_cli_perfil_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token); nom text := trim(coalesce(p_b ->> 'nombre', c.alias)); em text := lower(trim(coalesce(p_b ->> 'email', c.email)));
tel text := regexp_replace(coalesce(p_b ->> 'telefono', c.telefono), '\D', '', 'g');
begin
  if nom = '' then raise exception 'Escribí tu nombre'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el email: no parece válido'; end if;
  if length(tel) < 8 then raise exception 'Escribí tu celular con característica'; end if;
  if em <> lower(c.email) and exists(select 1 from rodar.clientes where lower(email) = em and id <> c.id) then raise exception 'Ese email ya está en otra cuenta'; end if;
  if tel <> c.telefono and exists(select 1 from rodar.clientes where telefono = tel and id <> c.id) then raise exception 'Ese celular ya está registrado. Comunicate con la central para unificarlo.'; end if;
  if rodar.t(p_b, 'password_nueva') is not null then
    if not rodar.verificar(coalesce(p_b ->> 'password_actual', ''), c.password_hash) then raise exception 'La contraseña actual no es correcta'; end if;
    if length(p_b ->> 'password_nueva') < 6 then raise exception 'La nueva contraseña tiene que tener al menos 6 caracteres'; end if;
    update rodar.clientes set password_hash = rodar.hash(p_b ->> 'password_nueva') where id = c.id;
  end if;
  update rodar.clientes set alias = nom, email = em, telefono = tel, medio_pago_pref = coalesce(rodar.t(p_b, 'medio_pago_pref'), medio_pago_pref) where id = c.id returning * into c;
  return rodar.cliente_publico(c);
end $$;

create or replace function public.r_cli_viajes(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token); lim int := least(100, coalesce(rodar.n(p_q, 'limite'), 30)::int);
begin
  return coalesce((select jsonb_agg(x order by orden, creado desc) from (
    select v.id, v.creado, v.programado, v.estado, v.origen_dir, v.origen_ref, v.origen_lat, v.origen_lng, v.destino_dir, v.destino_lat, v.destino_lng,
      coalesce(v.monto, v.monto_estimado) monto, v.monto is not null monto_final, v.km, v.minutos, v.medio_pago, v.calificacion, v.inicio_at, v.fin_at, v.motivo_anulacion,
      m.numero movil_numero, m.patente, trim(coalesce(m.marca, '') || ' ' || coalesce(m.modelo, '')) movil, rodar.firma(v.id) k,
      case when v.estado in ('pendiente', 'ofrecido', 'confirmado', 'en_curso') then 0 when v.estado = 'reserva' then 1 else 2 end orden
    from rodar.viajes v left join rodar.moviles m on m.id = v.movil_id
    where v.cliente_id = c.id and v.creado >= c.cuenta_creada - interval '1 minute'
    order by orden, v.creado desc limit lim) x), '[]');
end $$;

create or replace function public.r_cli_viaje(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token); prog timestamp := rodar.ts(p_b, 'programado'); medio text := coalesce(rodar.t(p_b, 'medio_pago'), c.medio_pago_pref, 'efectivo'); ids bigint[];
begin
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

create or replace function public.r_cli_cancelar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token); v rodar.viajes; nada rodar.usuarios;
begin
  select * into v from rodar.viajes where id = (p_q ->> 'id')::bigint and cliente_id = c.id;
  if not found then raise exception 'No encontramos ese viaje'; end if;
  if v.estado not in ('reserva', 'pendiente', 'ofrecido', 'confirmado') then raise exception 'Ese viaje ya no se puede cancelar'; end if;
  perform rodar.anular(v.id, nada, case when v.estado = 'reserva' then 'Reserva cancelada por el cliente' else 'Cancelado por el cliente' end);
  return '{"ok":true}';
end $$;

create or replace function public.r_cli_lugar_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token); et text := trim(coalesce(p_b ->> 'etiqueta', '')); did bigint := rodar.n(p_b, 'id')::bigint; dir text := rodar.t(p_b, 'direccion');
begin
  if et = '' then raise exception 'Poné un nombre, por ejemplo Casa o Trabajo'; end if;
  if did is null and dir is not null then select id into did from rodar.cliente_domicilios where cliente_id = c.id and direccion = dir order by id limit 1; end if;
  if did is not null then
    update rodar.cliente_domicilios set etiqueta = left(et, 30), direccion = coalesce(dir, direccion), lat = coalesce((p_b ->> 'lat')::float8, lat), lng = coalesce((p_b ->> 'lng')::float8, lng),
      localidad = coalesce(rodar.t(p_b, 'localidad'), localidad), provincia = coalesce(rodar.t(p_b, 'provincia'), provincia), referencias = coalesce(p_b ->> 'referencias', referencias)
    where id = did and cliente_id = c.id;
    if not found then raise exception 'No encontramos ese lugar'; end if;
  else
    if dir is null or p_b ->> 'lat' is null then raise exception 'Elegí la dirección en el buscador o en el mapa'; end if;
    if (select count(*) from rodar.cliente_domicilios where cliente_id = c.id and etiqueta is not null) >= 12 then raise exception 'Llegaste al máximo de lugares guardados'; end if;
    insert into rodar.cliente_domicilios(cliente_id, direccion, localidad, provincia, referencias, lat, lng, usos, ultimo_uso, etiqueta)
    values (c.id, dir, rodar.t(p_b, 'localidad'), rodar.t(p_b, 'provincia'), p_b ->> 'referencias', (p_b ->> 'lat')::float8, (p_b ->> 'lng')::float8, 0, null, left(et, 30));
  end if;
  return rodar.cliente_publico(c);
end $$;

create or replace function public.r_cli_lugar_quitar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token);
begin
  update rodar.cliente_domicilios set etiqueta = null where id = (p_q ->> 'id')::bigint and cliente_id = c.id;
  return rodar.cliente_publico(c);
end $$;

create or replace function public.r_cli_olvide(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare em text := lower(trim(coalesce(p_b ->> 'email', ''))); c rodar.clientes; cid bigint;
begin
  perform rodar.limitar('olvide:' || em, 3, interval '1 hour', 'Ya recibimos tu pedido. La central se va a comunicar con vos.');
  select * into c from rodar.clientes where lower(email) = em;
  if found then
    insert into rodar.soporte_conv(tipo, cliente_tel, cliente_alias, asunto, no_leidos, actualizado) values ('cliente', c.telefono, c.alias, 'Recuperar contraseña de la app', 1, rodar.ahora()) returning id into cid;
    insert into rodar.soporte_msg(conv_id, de, texto, fecha) values (cid, 'cliente', 'Olvidé mi contraseña de la app. Email: ' || c.email || ' · Celular: ' || c.telefono ||
      '. (Para darle una clave nueva: Operador → cargar viaje → buscar el teléfono → botón "Cuenta app").', rodar.ahora());
    perform rodar.emit('panel', 'soporte', jsonb_build_object('conv', cid));
  end if;
  return '{"ok":true}';
end $$;

-- panel: ver y resetear la cuenta de la app de un cliente
create or replace function public.r_cliente_cuenta(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador'); c rodar.clientes; nueva text;
begin
  select * into c from rodar.clientes where id = (p_q ->> 'id')::bigint;
  if not found then raise exception 'No existe el cliente'; end if;
  if rodar.b(p_b, 'resetear') then
    if c.email is null then raise exception 'Este cliente todavía no creó su cuenta en la app'; end if;
    nueva := lpad((floor(random() * 1000000))::int::text, 6, '0');
    update rodar.clientes set password_hash = rodar.hash(nueva) where id = c.id;
    update rodar.sesiones_clientes set activa = false where cliente_id = c.id;
    perform rodar.accion(u, 'cliente_clave_app', c.telefono, 'Clave de la app reseteada');
  end if;
  return jsonb_build_object('tiene_cuenta', c.email is not null, 'email', c.email, 'desde', c.cuenta_creada, 'clave_nueva', nueva);
end $$;

-- no exponer el hash de la contraseña al panel
create or replace function public.r_clientes_buscar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare q text := trim(coalesce(p_q ->> 'q', ''));
begin
  perform rodar.need(p_token, 'operador');
  if q = '' then return '[]'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) - 'password_hash') from (select * from rodar.clientes where telefono ilike '%' || q || '%' or alias ilike '%' || q || '%' or email ilike '%' || q || '%'
    order by baja_at is not null, alias limit 15) c), '[]');
end $$;

create or replace function public.r_cliente_tel(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes;
begin
  perform rodar.need(p_token, 'operador');
  select * into c from rodar.clientes where telefono = p_q ->> 'tel';
  if not found then return 'null'; end if;
  return to_jsonb(c) - 'password_hash' || jsonb_build_object(
    'domicilios', rodar.lista('select * from rodar.cliente_domicilios where cliente_id = ' || c.id || ' order by etiqueta is null, usos desc, ultimo_uso desc'),
    'ultimos', rodar.lista('select id, creado, estado, origen_dir, destino_dir, monto from rodar.viajes where cliente_id = ' || c.id || ' order by id desc limit 10'),
    'negativos', rodar.lista('select n.movil_id, m.numero from rodar.negativos n join rodar.moviles m on m.id = n.movil_id where n.cliente_id = ' || c.id),
    'reservas', rodar.lista('select id, programado, origen_dir from rodar.viajes where cliente_id = ' || c.id || ' and estado = ''reserva'' order by programado'));
end $$;

grant execute on function public.r_cli_registro(text, jsonb, jsonb), public.r_cli_login(text, jsonb, jsonb), public.r_cli_logout(text, jsonb, jsonb),
  public.r_cli_perfil(text, jsonb, jsonb), public.r_cli_perfil_guardar(text, jsonb, jsonb), public.r_cli_viajes(text, jsonb, jsonb), public.r_cli_viaje(text, jsonb, jsonb),
  public.r_cli_cancelar(text, jsonb, jsonb), public.r_cli_lugar_guardar(text, jsonb, jsonb), public.r_cli_lugar_quitar(text, jsonb, jsonb), public.r_cli_olvide(text, jsonb, jsonb),
  public.r_cliente_cuenta(text, jsonb, jsonb) to anon, authenticated;
revoke all on rodar.sesiones_clientes from anon, authenticated;
alter function rodar.cliente_sesion(text) set search_path = rodar, public, extensions;
alter function rodar.cliente_publico(rodar.clientes) set search_path = rodar, public, extensions;
alter function rodar.nueva_sesion_cliente(bigint) set search_path = rodar, public, extensions;
alter function rodar.limitar(text, int, interval, text) set search_path = rodar, public, extensions;
notify pgrst, 'reload schema';
