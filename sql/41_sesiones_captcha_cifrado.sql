-- ===================== Seguridad II: vencimiento de sesiones, captcha y cifrado del token de la central =====================
-- Configuración: rodar.cfg('seguridad') = {"panel_horas": 8, "captcha_activo": false, "captcha_site_key": ""}

-- 1) Sesiones del panel (tipo 'web'): vencen tras X horas sin uso (por defecto 8). La app de conductores ('app')
--    y la de empresas ('empresa') no vencen por inactividad.
do $$
declare d text; ancla text := $q$select * into u from rodar.usuarios where id = s.usuario_id and habilitado;$q$;
begin
  d := pg_get_functiondef('rodar.usuario(text)'::regprocedure);
  if position('panel_horas' in d) = 0 then
    if position(ancla in d) = 0 then raise exception 'rodar.usuario cambió'; end if;
    execute replace(d, ancla, $q$if s.tipo = 'web' and s.ultimo is not null
     and s.ultimo < rodar.ahora() - make_interval(hours => greatest(1, coalesce((rodar.cfg('seguridad', '{}') ->> 'panel_horas')::int, 8))) then
    raise exception 'SESION_VENCIDA';
  end if;
  $q$ || ancla);
  end if;
end $$;

-- 2) Captcha (Cloudflare Turnstile). La función de Supabase "captcha" verifica el desafío con la clave secreta
--    (secreto TURNSTILE_SECRET, lo carga el administrador en Supabase) y entrega un "pase" de un solo uso.
create table if not exists rodar.captcha_pases (pase text primary key, accion text not null, creado timestamptz not null default now(), usado boolean not null default false);
alter table rodar.captcha_pases enable row level security;
revoke all on rodar.captcha_pases from anon, authenticated;

create or replace function public.captcha_emitir(p_accion text) returns text language plpgsql security definer set search_path = rodar, public, extensions as $$
declare p text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into rodar.captcha_pases(pase, accion) values (p, coalesce(p_accion, 'general'));
  return p;
end $$;
revoke all on function public.captcha_emitir(text) from public, anon, authenticated;
grant execute on function public.captcha_emitir(text) to service_role;

create or replace function rodar.exigir_captcha(p_b jsonb, p_accion text) returns void language plpgsql set search_path = rodar, public as $$
declare s jsonb := rodar.cfg('seguridad', '{}'); n int;
begin
  if not coalesce((s ->> 'captcha_activo')::boolean, false) or coalesce(s ->> 'captcha_site_key', '') = '' then return; end if;
  with x as (select pase from rodar.captcha_pases where pase = p_b ->> 'captcha' and not usado and creado > now() - interval '10 minutes' for update)
  update rodar.captcha_pases c set usado = true from x where c.pase = x.pase;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'CAPTCHA: no pudimos confirmar que no sos un robot. Probá de nuevo.'; end if;
end $$;

-- Datos públicos del captcha para las páginas (solo la clave de sitio, que es pública)
create or replace function public.r_pub_captcha(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare s jsonb := rodar.cfg('seguridad', '{}');
begin
  return jsonb_build_object('activo', coalesce((s ->> 'captcha_activo')::boolean, false) and coalesce(s ->> 'captcha_site_key', '') <> '',
    'site_key', nullif(s ->> 'captcha_site_key', ''));
end $$;

-- Configuración de seguridad (admin) y horas de inactividad para el panel (cualquier sesión del panel)
create or replace function public.r_seguridad(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); s jsonb := rodar.cfg('seguridad', '{}');
begin
  if rodar.tiene(u, 'admin') then
    return jsonb_build_object('panel_horas', coalesce((s ->> 'panel_horas')::int, 8), 'captcha_activo', coalesce((s ->> 'captcha_activo')::boolean, false),
      'captcha_site_key', coalesce(s ->> 'captcha_site_key', ''));
  end if;
  return jsonb_build_object('panel_horas', coalesce((s ->> 'panel_horas')::int, 8));
end $$;

create or replace function public.r_seguridad_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); h int := coalesce(rodar.n(p_b, 'panel_horas')::int, 8); k text := coalesce(trim(p_b ->> 'captcha_site_key'), '');
  act boolean := coalesce(rodar.b(p_b, 'captcha_activo'), false);
begin
  if h < 1 or h > 72 then raise exception 'Las horas tienen que estar entre 1 y 72'; end if;
  if k <> '' and k !~ '^[0-9A-Za-z_-]{10,80}$' then raise exception 'La clave de sitio de Turnstile no parece válida'; end if;
  if act and k = '' then raise exception 'Para activar el captcha cargá la clave de sitio'; end if;
  perform rodar.cfg_set('seguridad', jsonb_build_object('panel_horas', h, 'captcha_activo', act, 'captcha_site_key', k));
  perform rodar.accion(u, 'seguridad', null, 'Sesión del panel: ' || h || ' h sin uso · Captcha ' || case when act then 'activado' else 'desactivado' end);
  return '{"ok":true}';
end $$;

grant execute on function public.r_pub_captcha(text, jsonb, jsonb), public.r_seguridad(text, jsonb, jsonb), public.r_seguridad_guardar(text, jsonb, jsonb) to anon, authenticated;

-- Registro de pasajeros y pedido web sin cuenta: exigen el captcha (cuando está activado)
do $$
declare d text;
begin
  d := pg_get_functiondef('public.r_cli_registro(text,jsonb,jsonb)'::regprocedure);
  if position('exigir_captcha' in d) = 0 then
    if position($q$if nom = '' then raise exception 'Escribí tu nombre'; end if;$q$ in d) = 0 then raise exception 'r_cli_registro cambió'; end if;
    execute replace(d, $q$if nom = '' then raise exception 'Escribí tu nombre'; end if;$q$, $q$perform rodar.exigir_captcha(p_b, 'registro');
  if nom = '' then raise exception 'Escribí tu nombre'; end if;$q$);
  end if;
  d := pg_get_functiondef('public.r_pub_viaje(text,jsonb,jsonb)'::regprocedure);
  if position('exigir_captcha' in d) = 0 then
    if position($q$insert into rodar.limite_pedidos(clave) values (tel);$q$ in d) = 0 then raise exception 'r_pub_viaje cambió'; end if;
    -- los pedidos de usuarios de empresa (con sesión válida) no lo necesitan
    execute replace(d, $q$insert into rodar.limite_pedidos(clave) values (tel);$q$, $q$if not exists(select 1 from rodar.sesiones x where x.token = p_b ->> 'token' and x.activa) then perform rodar.exigir_captcha(p_b, 'pedido'); end if;
  insert into rodar.limite_pedidos(clave) values (tel);$q$);
  end if;
end $$;

-- 3) Token de Mercado Pago de la central: también cifrado
do $$
declare d text; mp jsonb := rodar.cfg('mp', '{}');
begin
  d := pg_get_functiondef('public.r_medios_guardar(text,jsonb,jsonb)'::regprocedure);
  if position('rodar.cifrar' in d) = 0 then
    if position($q$perform rodar.cfg_set('mp', n);$q$ in d) = 0 then raise exception 'r_medios_guardar cambió'; end if;
    execute replace(d, $q$perform rodar.cfg_set('mp', n);$q$, $q$if coalesce(n ->> 'access_token', '') <> '' then n := n || jsonb_build_object('access_token', rodar.cifrar(n ->> 'access_token')); end if;
    perform rodar.cfg_set('mp', n);$q$);
  end if;
  d := pg_get_functiondef('public.mp_preparar_pago(bigint,text)'::regprocedure);
  if position($q$else mp ->> 'access_token' end$q$ in d) > 0 then
    execute replace(d, $q$else mp ->> 'access_token' end$q$, $q$else rodar.descifrar(mp ->> 'access_token') end$q$);
  end if;
  d := pg_get_functiondef('public.mp_token_pago(bigint)'::regprocedure);
  if position($q$else rodar.cfg('mp','{}') ->> 'access_token' end$q$ in d) > 0 then
    execute replace(d, $q$else rodar.cfg('mp','{}') ->> 'access_token' end$q$, $q$else rodar.descifrar(rodar.cfg('mp','{}') ->> 'access_token') end$q$);
  end if;
  if coalesce(mp ->> 'access_token', '') <> '' and mp ->> 'access_token' not like 'enc:%' then
    perform rodar.cfg_set('mp', mp || jsonb_build_object('access_token', rodar.cifrar(mp ->> 'access_token')));
  end if;
end $$;

notify pgrst, 'reload schema';
