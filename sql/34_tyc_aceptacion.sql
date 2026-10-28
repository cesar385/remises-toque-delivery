-- Aceptación de Términos y condiciones: pasajeros al crear la cuenta y conductores al ingresar a la app.
-- Se guarda qué versión (fecha de actualización) aceptó cada uno; si los términos cambian, se vuelve a pedir.
alter table rodar.clientes add column if not exists tyc_version text, add column if not exists tyc_aceptado_at timestamp;
alter table rodar.usuarios add column if not exists tyc_version text, add column if not exists tyc_aceptado_at timestamp;
create table if not exists rodar.tyc_aceptaciones (
  id bigserial primary key, para text not null, cliente_id bigint, usuario_id bigint, version text not null, fecha timestamp not null default now()
);
alter table rodar.tyc_aceptaciones enable row level security;
revoke all on rodar.tyc_aceptaciones from anon, authenticated;

-- Versión vigente: la fecha de "última actualización" que se edita en Administración → Página principal
create or replace function rodar.tyc_version(p_para text) returns text language sql stable set search_path = rodar, public as $$
  select coalesce(nullif(case when coalesce(t ->> 'texto', '') <> '' and coalesce(t ->> 'texto', '') not like '%## 12. Contacto%' then t ->> 'actualizado' end, ''), '2026-10-18')
  from (select rodar.cfg('landing', '{}') -> case when p_para = 'conductores' then 'terminos_cond' else 'terminos' end t) x $$;

create or replace function public.r_cli_registro(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
#variable_conflict use_variable
declare nom text := trim(coalesce(p_b ->> 'nombre', '')); em text := lower(trim(coalesce(p_b ->> 'email', ''))); tel text := regexp_replace(coalesce(p_b ->> 'telefono', ''), '\D', '', 'g');
pw text := coalesce(p_b ->> 'password', ''); c rodar.clientes; ver text := rodar.tyc_version('pasajeros');
begin
  if nom = '' then raise exception 'Escribí tu nombre'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el email: no parece válido'; end if;
  if length(tel) < 8 then raise exception 'Escribí tu celular con característica (ej. 3454 123456)'; end if;
  if length(pw) < 6 then raise exception 'La contraseña tiene que tener al menos 6 caracteres'; end if;
  -- La app actual siempre manda acepto_tyc. Si llega un registro sin ese dato (app vieja en caché) se crea la cuenta
  -- sin registrar la aceptación, y la app se la pide al ingresar.
  if p_b ? 'acepto_tyc' and not coalesce((p_b ->> 'acepto_tyc')::boolean, false) then raise exception 'Para crear la cuenta tenés que aceptar los Términos y condiciones'; end if;
  if not coalesce((p_b ->> 'acepto_tyc')::boolean, false) then ver := null; end if;
  perform rodar.limitar('registro', 30, interval '1 hour', 'Hay muchos registros en este momento, probá en unos minutos.');
  if exists(select 1 from rodar.clientes where lower(email) = em) then raise exception 'Ya hay una cuenta con ese email. Tocá "Ingresar" o "Olvidé mi contraseña".'; end if;
  select * into c from rodar.clientes where telefono = tel;
  if found then
    if c.email is not null then raise exception 'Ese celular ya tiene una cuenta con otro email. Si es tuyo, comunicate con la central.'; end if;
    if c.bloqueado then raise exception 'No podemos crear la cuenta. Comunicate con la central.'; end if;
    update rodar.clientes set email = em, password_hash = rodar.hash(pw), alias = nom, cuenta_creada = rodar.ahora(), baja_at = null, tyc_version = ver, tyc_aceptado_at = case when ver is not null then rodar.ahora() end where id = c.id returning * into c;
  else
    insert into rodar.clientes(telefono, alias, email, password_hash, cuenta_creada, creado, tyc_version, tyc_aceptado_at) values (tel, nom, em, rodar.hash(pw), rodar.ahora(), rodar.ahora(), ver, case when ver is not null then rodar.ahora() end) returning * into c;
  end if;
  if ver is not null then insert into rodar.tyc_aceptaciones(para, cliente_id, version, fecha) values ('pasajeros', c.id, ver, rodar.ahora()); end if;
  return jsonb_build_object('token', rodar.nueva_sesion_cliente(c.id), 'cliente', rodar.cliente_publico(c));
end $$;

-- Pasajero con cuenta: estado y aceptación (se pide si nunca aceptó o si cambió la versión)
create or replace function public.r_cli_tyc(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token); ver text := rodar.tyc_version('pasajeros');
begin
  if coalesce((p_b ->> 'aceptar')::boolean, false) then
    update rodar.clientes set tyc_version = ver, tyc_aceptado_at = rodar.ahora() where id = c.id returning * into c;
    insert into rodar.tyc_aceptaciones(para, cliente_id, version, fecha) values ('pasajeros', c.id, ver, rodar.ahora());
  end if;
  return jsonb_build_object('version', ver, 'aceptado', c.tyc_version is not distinct from ver, 'aceptado_at', c.tyc_aceptado_at, 'primera', c.tyc_version is null);
end $$;

-- Conductor: igual, con el usuario de la sesión de la app
create or replace function public.r_cond_tyc(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); ver text := rodar.tyc_version('conductores');
begin
  if coalesce((p_b ->> 'aceptar')::boolean, false) then
    update rodar.usuarios set tyc_version = ver, tyc_aceptado_at = rodar.ahora() where id = u.id returning * into u;
    insert into rodar.tyc_aceptaciones(para, usuario_id, version, fecha) values ('conductores', u.id, ver, rodar.ahora());
    perform rodar.accion(u, 'tyc_aceptados', null, 'Aceptó los Términos y condiciones para conductores (versión ' || ver || ')');
  end if;
  return jsonb_build_object('version', ver, 'aceptado', u.tyc_version is not distinct from ver, 'aceptado_at', u.tyc_aceptado_at, 'primera', u.tyc_version is null);
end $$;

grant execute on function public.r_cli_registro(text, jsonb, jsonb), public.r_cli_tyc(text, jsonb, jsonb), public.r_cond_tyc(text, jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
