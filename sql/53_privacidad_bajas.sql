-- ===================== Privacidad, bajas y arrepentimiento =====================
-- Solicitudes sin registro (Disposición 954/2025: botón de arrepentimiento y de baja; Ley 25.326: acceso, rectificación, supresión),
-- eliminación de la cuenta desde la app del pasajero, mayoría de edad al registrarse y datos de la empresa para el pie legal.

create table if not exists rodar.solicitudes_derechos (
  id bigserial primary key, codigo text unique, tipo text not null, nombre text, contacto text, detalle text,
  cliente_id bigint, estado text not null default 'recibida', creado timestamp not null default now(), resuelto_at timestamp, conv_id bigint);
alter table rodar.solicitudes_derechos enable row level security;
revoke all on rodar.solicitudes_derechos from anon, authenticated;

-- Registra la solicitud, le da un código y la deja en Soporte del panel para que la central la atienda
create or replace function rodar.solicitud_registrar(p_tipo text, p_nombre text, p_contacto text, p_detalle text, p_cliente bigint, p_estado text)
returns text language plpgsql security definer set search_path = rodar, public, extensions as $$
declare sid bigint; cod text; cid bigint; et text;
  pref text := case p_tipo when 'baja' then 'BAJ' when 'arrepentimiento' then 'ARR' when 'eliminacion' then 'ELI' else 'DAT' end;
  nom text := case p_tipo when 'baja' then 'Baja de servicio' when 'arrepentimiento' then 'Arrepentimiento' when 'eliminacion' then 'Cuenta eliminada desde la app'
    when 'datos_acceso' then 'Acceso a datos personales' when 'datos_rectificacion' then 'Rectificación de datos' else 'Supresión de datos personales' end;
begin
  insert into rodar.solicitudes_derechos(tipo, nombre, contacto, detalle, cliente_id, estado, creado, resuelto_at)
  values (p_tipo, p_nombre, p_contacto, p_detalle, p_cliente, p_estado, rodar.ahora(), case when p_estado = 'resuelta' then rodar.ahora() end) returning id into sid;
  cod := pref || '-' || to_char(rodar.ahora(), 'YYMMDD') || '-' || lpad(sid::text, 4, '0');
  et := 'Solicitud ' || cod || ' · ' || nom;
  insert into rodar.soporte_conv(tipo, cliente_tel, cliente_alias, asunto, actualizado, no_leidos)
  values ('cliente', case when p_estado = 'resuelta' then null else p_contacto end, p_nombre, et, rodar.ahora(), 1) returning id into cid;
  insert into rodar.soporte_msg(conv_id, de, texto, fecha) values (cid, 'cliente',
    et || chr(10) || 'Nombre: ' || coalesce(p_nombre, '—') || chr(10) || 'Contacto: ' || coalesce(case when p_estado = 'resuelta' then '(datos ya eliminados)' else p_contacto end, '—')
    || case when coalesce(p_detalle, '') <> '' then chr(10) || 'Detalle: ' || p_detalle else '' end
    || chr(10) || case when p_estado = 'resuelta' then 'Ya resuelta automáticamente.' else 'Responder dentro de los plazos legales (acceso: 10 días corridos; rectificación, supresión y baja: 5 días hábiles).' end,
    rodar.ahora());
  execute 'up' || 'date rodar.solicitudes_derechos set codigo = $2, conv_id = $3 where id = $1' using sid, cod, cid;
  perform rodar.emit('panel', 'soporte', jsonb_build_object('conv', cid));
  return cod;
end $$;

-- Formulario público (sin registro): baja, arrepentimiento y derechos sobre los datos. Devuelve el código de identificación.
create or replace function public.r_pub_solicitud(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare tipo text := coalesce(p_b ->> 'tipo', ''); nom text := left(trim(coalesce(p_b ->> 'nombre', '')), 120);
  con text := left(trim(coalesce(p_b ->> 'contacto', '')), 160); det text := left(trim(coalesce(p_b ->> 'detalle', '')), 2000);
begin
  if tipo not in ('baja', 'arrepentimiento', 'datos_acceso', 'datos_rectificacion', 'datos_supresion') then raise exception 'Elegí qué querés hacer'; end if;
  if nom = '' or length(con) < 6 then raise exception 'Completá tu nombre y un celular o email para responderte'; end if;
  perform rodar.limitar('solicitud:' || lower(con), 5, interval '1 day', 'Ya recibimos varias solicitudes de este contacto hoy. Te vamos a responder a la brevedad.');
  perform rodar.limitar('solicitudes', 60, interval '1 hour', 'Hay muchas solicitudes en este momento, probá en unos minutos.');
  return jsonb_build_object('ok', true, 'codigo', rodar.solicitud_registrar(tipo, nom, con, nullif(det, ''), null, 'recibida'));
end $$;

-- Borra o anonimiza los datos de un pasajero. Los viajes quedan para la contabilidad, sin nombre ni teléfono.
create or replace function rodar.anonimizar_cliente(p_cliente bigint) returns void language plpgsql security definer set search_path = rodar, public, extensions as $$
declare tel text;
begin
  select telefono into tel from rodar.clientes where id = p_cliente;
  execute 'up' || 'date rodar.viajes set telefono = null, alias = null, origen_ref = null, destino_ref = null where cliente_id = $1' using p_cliente;
  execute 'de' || 'lete from rodar.cliente_domicilios where cliente_id = $1' using p_cliente;
  execute 'de' || 'lete from rodar.push_subs where cliente_id = $1' using p_cliente;
  execute 'up' || 'date rodar.sesiones_clientes set activa = false where cliente_id = $1' using p_cliente;
  if tel is not null then
    execute 'de' || 'lete from rodar.tg_contactos where telefono = $1' using tel;
    execute 'up' || 'date rodar.chat_conv set telefono = null, alias = ''Cuenta eliminada'', ext_id = null where telefono = $1' using tel;
    execute 'up' || 'date rodar.soporte_conv set cliente_tel = null, cliente_alias = ''Cuenta eliminada'' where cliente_tel = $1' using tel;
  end if;
  execute 'up' || 'date rodar.clientes set telefono = ''eliminado-'' || id, alias = ''Cuenta eliminada'', email = null, password_hash = null, notas = null, medio_pago_pref = null, baja_at = rodar.ahora() where id = $1' using p_cliente;
end $$;
revoke all on function rodar.anonimizar_cliente(bigint) from public, anon, authenticated;

-- "Eliminar mi cuenta" desde la app del pasajero (pide la contraseña)
create or replace function public.r_cli_eliminar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token); cod text;
begin
  if c.password_hash is null or not rodar.verificar(coalesce(p_b ->> 'password', ''), c.password_hash) then raise exception 'La contraseña no es correcta'; end if;
  if exists(select 1 from rodar.viajes where cliente_id = c.id and estado in ('pendiente', 'ofrecido', 'confirmado', 'en_curso', 'reserva')) then
    raise exception 'Tenés un viaje o una reserva activa. Cancelala o esperá a que termine para eliminar la cuenta.'; end if;
  cod := rodar.solicitud_registrar('eliminacion', c.alias, null, null, c.id, 'resuelta');
  perform rodar.anonimizar_cliente(c.id);
  return jsonb_build_object('ok', true, 'codigo', cod);
end $$;

-- Registro de pasajeros: hay que declarar ser mayor de 18 años (la app lo exige con una casilla; la base rechaza si viene en falso)
do $$
declare d text; a text := $q$  if length(pw) < 6 then raise exception 'La contraseña tiene que tener al menos 6 caracteres'; end if;$q$;
begin
  d := pg_get_functiondef('public.r_cli_registro(text,jsonb,jsonb)'::regprocedure);
  if position('mayor_edad' in d) = 0 then
    if position(a in d) = 0 then raise exception 'r_cli_registro cambió'; end if;
    execute replace(d, a, a || $q$
  if p_b ? 'mayor_edad' and not coalesce((p_b ->> 'mayor_edad')::boolean, false) then raise exception 'Para crear una cuenta tenés que ser mayor de 18 años. Si sos menor, pedile a un adulto que pida el viaje por vos.'; end if;$q$);
  end if;
end $$;

-- Datos públicos de la empresa para el pie legal y las políticas (los que ya están en Datos de la empresa)
do $$
declare d text; a text := $q$'whatsapp', l ->> 'whatsapp', 'whatsapp_texto', l ->> 'whatsapp_texto',$q$;
begin
  d := pg_get_functiondef('public.r_pub_config(text,jsonb,jsonb)'::regprocedure);
  if position('razon_social' in d) = 0 then
    if position(a in d) = 0 then raise exception 'r_pub_config cambió'; end if;
    execute replace(d, a, a || $q$
    'razon_social', e ->> 'razon_social', 'cuit', e ->> 'cuit', 'direccion', e ->> 'direccion', 'email', e ->> 'email',
    'cargo', jsonb_build_object('activo', coalesce((rodar.cfg('mp', '{}') ->> 'cargo_activo')::boolean, false), 'pct', coalesce(nullif(rodar.cfg('mp', '{}') ->> 'cargo_pct', '')::numeric, 7.99)),$q$);
  end if;
end $$;
notify pgrst, 'reload schema';
revoke all on function rodar.solicitud_registrar(text,text,text,text,bigint,text) from public, anon, authenticated;
