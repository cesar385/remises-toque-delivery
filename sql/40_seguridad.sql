-- ===================== Revisión de seguridad (antes del lanzamiento) =====================
-- 1) Sistema viejo que quedó en el esquema public (tablas trips/drivers/customers… y funciones driver_*, passenger_*…):
--    está vacío y ninguna app lo usa, pero era accesible desde internet. Se le quita el acceso público (no se borra nada).
do $$
declare r record;
begin
  for r in select p.oid::regprocedure f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('activar_programados', 'driver_action', 'driver_login', 'driver_misc', 'driver_ping', 'driver_register',
             'passenger_action', 'passenger_history', 'public_config', 'request_trip', 'trip_status') loop
    execute format('revoke all on function %s from public, anon, authenticated', r.f);
  end loop;
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('customers', 'driver_log', 'drivers', 'emergencies', 'messages', 'records', 'settings', 'trips', 'wallet_tx') loop
    execute format('revoke all on table public.%I from anon, authenticated', r.relname);
  end loop;
end $$;

-- 2) RLS en todas las tablas del sistema (las que faltaban). Las apps acceden solo por funciones, así que no cambia nada para ellas.
do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'rodar' and c.relkind = 'r' and not c.relrowsecurity loop
    execute format('alter table rodar.%I enable row level security', r.relname);
    execute format('revoke all on table rodar.%I from anon, authenticated', r.relname);
  end loop;
end $$;

-- 3) search_path fijo en todas las funciones del sistema (evita que una función use un objeto "impostor")
do $$
declare r record;
begin
  for r in select p.oid::regprocedure f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'rodar' and p.prokind = 'f'
             and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%') loop
    execute format('alter function %s set search_path = rodar, public, extensions', r.f);
  end loop;
end $$;

-- 4) Límite de intentos de inicio de sesión (8 fallidos cada 15 minutos por usuario/email).
--    El error se devuelve como {"__error": "..."} en lugar de una excepción para que el intento fallido QUEDE registrado
--    (una excepción deshace todo lo hecho en la llamada, incluido el registro del intento).
do $$
declare d text; f text; viejo text := $q$if not found or not rodar.verificar(coalesce(p_b ->> 'password', ''), u.password_hash) then raise exception 'Usuario o contraseña incorrectos'; end if;$q$;
  nuevo text := $q$if (select count(*) from rodar.limite_pedidos where clave = 'login_u:' || lower(us) and ts > now() - interval '15 minutes') >= 8 then
    return jsonb_build_object('__error', 'Demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo, o pedile a la central que te restablezca la clave.'); end if;
  if not found or not rodar.verificar(coalesce(p_b ->> 'password', ''), u.password_hash) then
    insert into rodar.limite_pedidos(clave) values ('login_u:' || lower(us));
    return jsonb_build_object('__error', 'Usuario o contraseña incorrectos'); end if;$q$;
begin
  foreach f in array array['public.r_login(text,jsonb,jsonb)', 'public.r_cond_moviles(text,jsonb,jsonb)'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position('login_u:' in d) > 0 then continue; end if;
    if position(viejo in d) = 0 then raise exception 'No encontré el control de clave en %', f; end if;
    execute replace(d, viejo, nuevo);
  end loop;
  d := pg_get_functiondef('public.r_cli_login(text,jsonb,jsonb)'::regprocedure);
  if position('__error' in d) = 0 then
    if position($q$raise exception 'El email o la contraseña no coinciden';$q$ in d) = 0 then raise exception 'No encontré el control de clave en r_cli_login'; end if;
    execute replace(d, $q$raise exception 'El email o la contraseña no coinciden';$q$, $q$return jsonb_build_object('__error', 'El email o la contraseña no coinciden');$q$);
  end if;
end $$;

-- 5) Archivos subidos: solo fotos (JPG/PNG/WebP) o PDF, con tamaño máximo
create or replace function rodar.validar_archivo(p_archivo text, p_max int, p_pdf boolean default true) returns void language plpgsql immutable set search_path = rodar, public as $$
begin
  if p_archivo is null or p_archivo = '' then return; end if;
  if p_archivo !~ ('^data:(image/(jpeg|png|webp)' || case when p_pdf then '|application/pdf' else '' end || ');base64,[A-Za-z0-9+/=[:space:]]+$') then
    raise exception 'Archivo no permitido: subí una foto (JPG o PNG)%.', case when p_pdf then ' o un PDF' else '' end; end if;
  if length(p_archivo) > p_max then raise exception 'El archivo es demasiado grande (máximo % MB).', round(p_max * 0.75 / 1e6, 1); end if;
end $$;
create or replace function rodar.validar_foto(p_foto text) returns void language plpgsql immutable set search_path = rodar, public as $$
begin
  if p_foto is null or p_foto = '' or p_foto ~ '^https://[^[:space:]"<>]+$' then return; end if;
  perform rodar.validar_archivo(p_foto, 1500000, false);
end $$;
do $$
declare d text;
begin
  -- solicitud de alta de conductor: hasta 12 documentos de 2 MB
  d := pg_get_functiondef('public.r_solicitud_conductor(text,jsonb,jsonb)'::regprocedure);
  if position('validar_archivo' in d) = 0 then
    if position($q$if rodar.t(p_b, 'nombre') is null or rodar.t(p_b, 'dni') is null$q$ in d) = 0 then raise exception 'r_solicitud_conductor cambió'; end if;
    execute replace(d, $q$if rodar.t(p_b, 'nombre') is null or rodar.t(p_b, 'dni') is null$q$,
      $q$if jsonb_typeof(coalesce(p_b -> 'docs', '[]')) <> 'array' or jsonb_array_length(coalesce(p_b -> 'docs', '[]')) > 12 then raise exception 'Demasiados archivos'; end if;
  perform rodar.validar_archivo(x ->> 'archivo', 2700000) from jsonb_array_elements(coalesce(p_b -> 'docs', '[]')) x;
  if rodar.t(p_b, 'nombre') is null or rodar.t(p_b, 'dni') is null$q$);
  end if;
  -- foto de perfil (cada usuario) y alta/modificación de usuarios (admin)
  d := pg_get_functiondef('public.r_me_guardar(text,jsonb,jsonb)'::regprocedure);
  if position('validar_foto' in d) = 0 then
    if position('update rodar.usuarios set nombre' in d) = 0 then raise exception 'r_me_guardar cambió'; end if;
    execute replace(d, 'update rodar.usuarios set nombre', $q$perform rodar.validar_foto(rodar.t(p_b, 'foto'));
  update rodar.usuarios set nombre$q$);
  end if;
  d := pg_get_functiondef('public.r_usuario_guardar(text,jsonb,jsonb)'::regprocedure);
  if position('validar_foto' in d) = 0 then
    if position($q$if rodar.t(p_b, 'documento') is null or rodar.t(p_b, 'nombre') is null$q$ in d) = 0 then raise exception 'r_usuario_guardar cambió'; end if;
    execute replace(d, $q$if rodar.t(p_b, 'documento') is null or rodar.t(p_b, 'nombre') is null$q$, $q$perform rodar.validar_foto(rodar.t(p_b, 'foto'));
  if rodar.t(p_b, 'documento') is null or rodar.t(p_b, 'nombre') is null$q$);
  end if;
end $$;

-- 6) Tokens de Mercado Pago de los conductores: se guardan cifrados (la clave vive en Supabase Vault, no en el código)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'rodar_cifrado') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'rodar_cifrado', 'Clave para cifrar datos sensibles de Remises TOQUE!');
  end if;
end $$;
create or replace function rodar.clave_cifrado() returns text language sql stable security definer set search_path = rodar, public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'rodar_cifrado' limit 1 $$;
create or replace function rodar.cifrar(p text) returns text language sql stable set search_path = rodar, public, extensions as $$
  select case when p is null or p like 'enc:%' then p else 'enc:' || encode(extensions.pgp_sym_encrypt(p, rodar.clave_cifrado()), 'base64') end $$;
create or replace function rodar.descifrar(p text) returns text language sql stable set search_path = rodar, public, extensions as $$
  select case when p like 'enc:%' then extensions.pgp_sym_decrypt(decode(substr(p, 5), 'base64'), rodar.clave_cifrado()) else p end $$;
revoke all on function rodar.clave_cifrado(), rodar.cifrar(text), rodar.descifrar(text) from public, anon, authenticated;
create or replace function rodar.mp_cuentas_cifrar() returns trigger language plpgsql set search_path = rodar, public as $$
begin
  new.access_token := rodar.cifrar(new.access_token); new.refresh_token := rodar.cifrar(new.refresh_token); return new;
end $$;
create or replace trigger mp_cuentas_cifrar before insert or update of access_token, refresh_token on rodar.mp_cuentas for each row execute function rodar.mp_cuentas_cifrar();
update rodar.mp_cuentas set access_token = access_token, refresh_token = refresh_token where access_token not like 'enc:%';
do $$
declare d text;
begin
  d := pg_get_functiondef('public.mp_preparar_pago(bigint,text)'::regprocedure);
  if position('rodar.descifrar' in d) = 0 then
    if position('cta.access_token' in d) = 0 then raise exception 'mp_preparar_pago cambió'; end if;
    execute replace(replace(d, 'cta.access_token', 'rodar.descifrar(cta.access_token)'), $q$'refresh_token', cta.refresh_token$q$, $q$'refresh_token', rodar.descifrar(cta.refresh_token)$q$);
  end if;
  d := pg_get_functiondef('public.mp_token_pago(bigint)'::regprocedure);
  if position('rodar.descifrar' in d) = 0 then
    if position('c.access_token' in d) = 0 then raise exception 'mp_token_pago cambió'; end if;
    execute replace(d, 'then c.access_token', 'then rodar.descifrar(c.access_token)');
  end if;
end $$;

notify pgrst, 'reload schema';
