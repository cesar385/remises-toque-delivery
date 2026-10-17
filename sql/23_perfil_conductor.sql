-- ===================== El conductor actualiza sus propios datos desde la app =====================
-- Solo datos personales de contacto. No se tocan el DNI, el usuario, la clave, los roles ni los datos bancarios (esos tienen su propia pantalla).

create or replace function public.r_cond_perfil(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token);
begin
  perform rodar.movil_sesion(p_token);
  return jsonb_build_object('documento', u.documento, 'nombre', u.nombre, 'apellido', u.apellido, 'telefono', u.telefono, 'email', u.email,
    'tel_recupero', u.tel_recupero, 'email_recupero', u.email_recupero);
end $$;

create or replace function public.r_cond_perfil_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); nom text := rodar.t(p_b, 'nombre'); em text := lower(rodar.t(p_b, 'email')); emr text := lower(rodar.t(p_b, 'email_recupero'));
  tel text := rodar.t(p_b, 'telefono'); telr text := rodar.t(p_b, 'tel_recupero');
begin
  perform rodar.movil_sesion(p_token);
  if nom is null then raise exception 'Escribí tu nombre'; end if;
  if em is not null and em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el email: no parece válido'; end if;
  if emr is not null and emr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el email de recupero: no parece válido'; end if;
  if tel is not null and length(regexp_replace(tel, '\D', '', 'g')) < 8 then raise exception 'Revisá el teléfono: tiene que incluir la característica'; end if;
  if telr is not null and length(regexp_replace(telr, '\D', '', 'g')) < 8 then raise exception 'Revisá el teléfono de recupero: tiene que incluir la característica'; end if;
  update rodar.usuarios set nombre = left(nom, 60), apellido = left(coalesce(rodar.t(p_b, 'apellido'), ''), 60), telefono = left(tel, 30), email = left(em, 120),
    tel_recupero = left(telr, 30), email_recupero = left(emr, 120) where id = u.id;
  perform rodar.accion(u, 'perfil_conductor', u.documento, 'El conductor actualizó sus datos desde la app');
  return jsonb_build_object('ok', true);
end $$;

notify pgrst, 'reload schema';
