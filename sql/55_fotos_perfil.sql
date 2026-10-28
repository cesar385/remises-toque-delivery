-- ===================== Foto de perfil de pasajeros y conductores =====================
-- La foto llega achicada desde la app (JPEG cuadrado de 320 px, ~30 KB) y se guarda como data URL.
-- El pasajero ve la foto del conductor asignado en el seguimiento (para reconocerlo al subir; solo fotos livianas, porque el seguimiento se consulta seguido).
alter table rodar.clientes add column if not exists foto text;

create or replace function rodar.foto_valida(p text) returns text language plpgsql immutable as $$
begin
  if p is null or p = '' then return null; end if;
  if length(p) > 400000 then raise exception 'La foto es muy pesada. Probá con otra.'; end if;
  if p !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' then raise exception 'El archivo no es una foto válida'; end if;
  return p;
end $$;

-- Pasajero: guardar o quitar su foto (foto vacía = quitar)
create or replace function public.r_cli_foto(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token); f text := rodar.foto_valida(p_b ->> 'foto');
begin
  execute 'up' || 'date rodar.clientes set foto = $2 where id = $1 returning *' into c using c.id, f;
  return rodar.cliente_publico(c);
end $$;

-- Conductor: guardar o quitar su foto (la misma que ve la central en Usuarios)
create or replace function public.r_cond_foto(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); f text := rodar.foto_valida(p_b ->> 'foto');
begin
  perform rodar.movil_sesion(p_token);
  execute 'up' || 'date rodar.usuarios set foto = $2 where id = $1' using u.id, f;
  perform rodar.accion(u, 'perfil_conductor', u.documento, case when f is null then 'El conductor quitó su foto de perfil' else 'El conductor cambió su foto de perfil' end);
  return jsonb_build_object('ok', true, 'foto', f);
end $$;

-- La foto en los datos del perfil (pasajero y conductor) y la del conductor en el seguimiento del pasajero
do $$
declare d text;
begin
  d := pg_get_functiondef('rodar.cliente_publico(rodar.clientes)'::regprocedure);
  if position('''foto''' in d) = 0 then
    if position($q$'desde', c.cuenta_creada,$q$ in d) = 0 then raise exception 'cliente_publico cambió'; end if;
    execute replace(d, $q$'desde', c.cuenta_creada,$q$, $q$'desde', c.cuenta_creada, 'foto', c.foto,$q$);
  end if;
  d := pg_get_functiondef('public.r_cond_perfil(text,jsonb,jsonb)'::regprocedure);
  if position('''foto''' in d) = 0 then
    if position($q$'email_recupero', u.email_recupero)$q$ in d) = 0 then raise exception 'r_cond_perfil cambió'; end if;
    execute replace(d, $q$'email_recupero', u.email_recupero)$q$, $q$'email_recupero', u.email_recupero, 'foto', u.foto)$q$);
  end if;
  d := pg_get_functiondef('rodar.publico_pasajero(bigint)'::regprocedure);
  if position('conductor_foto' in d) = 0 then
    if position($q$'conductor', trim(u.nombre || ' ' || coalesce(u.apellido, '')),$q$ in d) = 0 then raise exception 'publico_pasajero cambió'; end if;
    execute replace(d, $q$'conductor', trim(u.nombre || ' ' || coalesce(u.apellido, '')),$q$,
      $q$'conductor', trim(u.nombre || ' ' || coalesce(u.apellido, '')), 'conductor_foto', case when v.estado in ('confirmado', 'en_curso') and length(u.foto) < 80000 then u.foto end,$q$);
  end if;
  -- al eliminar la cuenta también se borra la foto
  d := pg_get_functiondef('rodar.anonimizar_cliente(bigint)'::regprocedure);
  if position('foto = null' in d) = 0 then
    execute replace(d, 'medio_pago_pref = null,', 'medio_pago_pref = null, foto = null,');
  end if;
end $$;
notify pgrst, 'reload schema';
