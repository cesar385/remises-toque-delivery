-- =====================================================================
-- Central de clientes (SaaS) — para vender el sistema a otras remiserías
-- ---------------------------------------------------------------------
-- Se instala UNA sola vez, en el proyecto de Supabase donde vive tu
-- panel de superadministrador (superadmin.html). Cada remisería cliente
-- tiene su propio proyecto con supabase/rodar.sql, y consulta acá su
-- licencia cada 10 minutos (ver sql/67_licencia.sql).
-- Se puede volver a correr: no borra datos.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create schema if not exists saas;
revoke all on schema saas from anon, authenticated;

-- ---------- tablas ----------
create table if not exists saas.config (
  clave text primary key,
  valor jsonb not null
);

create table if not exists saas.admins (
  id bigint generated always as identity primary key,
  usuario text not null unique,
  nombre text,
  hash text not null,
  debe_cambiar boolean not null default true,
  habilitado boolean not null default true,
  creado timestamptz not null default now()
);

create table if not exists saas.sesiones (
  token text primary key,
  admin_id bigint not null references saas.admins(id) on delete cascade,
  creada timestamptz not null default now(),
  vence timestamptz not null default now() + interval '12 hours'
);

create table if not exists saas.planes (
  id bigint generated always as identity primary key,
  nombre text not null,
  precio numeric(12,2) not null default 0,
  max_moviles int,                       -- null = sin límite
  descripcion text,
  activo boolean not null default true,
  mp_plan_id text,                       -- id del plan de suscripción de Mercado Pago (paso 4)
  orden int not null default 0
);

create table if not exists saas.clientes (
  id bigint generated always as identity primary key,
  nombre text not null,                  -- nombre comercial de la remisería
  slug text not null unique,             -- identificador corto: "remiseria-sol"
  titular text,
  email text,
  telefono text,
  cuit text,
  ciudad text,
  plan_id bigint references saas.planes(id),
  precio_especial numeric(12,2),         -- si se acordó otro precio (null = el del plan)
  prueba_hasta date,                     -- fin del período de prueba
  pagado_hasta date,                     -- hasta cuándo está pago el servicio
  bloqueo_manual boolean not null default false,
  motivo_bloqueo text,
  baja boolean not null default false,
  supabase_url text,                     -- proyecto de Supabase de la remisería
  supabase_anon text,                    -- clave anon de ese proyecto (pública)
  dominio text,                          -- dirección donde usa el sistema
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  mp_preapproval_id text,                -- suscripción de Mercado Pago (débito automático)
  mp_email text,                         -- email de la cuenta de Mercado Pago que paga
  mp_estado text,                        -- pending / authorized / paused / cancelled
  mp_link text,                          -- link para suscribirse
  mp_actualizado timestamptz,
  ultima_conexion timestamptz,
  moviles_en_uso int,
  notas text,
  alta timestamptz not null default now()
);

create table if not exists saas.pagos (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references saas.clientes(id) on delete cascade,
  fecha date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  meses int not null default 1 check (meses between 1 and 24),
  monto numeric(12,2) not null,
  medio text not null default 'transferencia' check (medio in ('mercadopago','transferencia','efectivo','otro')),
  referencia text,
  nota text,
  desde date,                            -- período que cubre
  hasta date,
  anulado boolean not null default false,
  registrado_por text,
  creado timestamptz not null default now()
);

create table if not exists saas.eventos (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  cliente_id bigint references saas.clientes(id) on delete cascade,
  tipo text not null,
  detalle text,
  admin text
);
create index if not exists eventos_cliente_idx on saas.eventos(cliente_id, fecha desc);
create index if not exists pagos_cliente_idx on saas.pagos(cliente_id, fecha desc);
create index if not exists clientes_plan_idx on saas.clientes(plan_id);
create index if not exists sesiones_admin_idx on saas.sesiones(admin_id);
create index if not exists clientes_mp_idx on saas.clientes(mp_preapproval_id);
create unique index if not exists pagos_mp_ref_uidx on saas.pagos(referencia) where medio = 'mercadopago' and referencia is not null;
-- columnas agregadas después (para instalaciones anteriores)
alter table saas.clientes add column if not exists mp_email text;
alter table saas.clientes add column if not exists mp_estado text;
alter table saas.clientes add column if not exists mp_link text;
alter table saas.clientes add column if not exists mp_actualizado timestamptz;

alter table saas.config   enable row level security;
alter table saas.admins   enable row level security;
alter table saas.sesiones enable row level security;
alter table saas.planes   enable row level security;
alter table saas.clientes enable row level security;
alter table saas.pagos    enable row level security;
alter table saas.eventos  enable row level security;

insert into saas.config(clave, valor) values
  ('dias_gracia', '7'),            -- días que sigue funcionando después del vencimiento (con aviso)
  ('dias_prueba', '15'),           -- días de prueba gratis para clientes nuevos
  ('contacto', '"Comunicate con tu proveedor del sistema para regularizar el servicio."')
on conflict (clave) do nothing;

insert into saas.planes(nombre, precio, max_moviles, descripcion, orden)
select * from (values
  ('Inicial', 30000::numeric, 10, 'Hasta 10 móviles. Central, app de conductores y pedido web de pasajeros.', 1),
  ('Profesional', 55000::numeric, 30, 'Hasta 30 móviles. Todo lo del plan Inicial, más delivery e informes.', 2),
  ('Flota', 90000::numeric, null::int, 'Móviles sin límite y soporte prioritario.', 3)
) v(nombre, precio, max_moviles, descripcion, orden)
where not exists (select 1 from saas.planes);

-- ---------- helpers ----------
create or replace function saas.cfg(k text) returns jsonb language sql stable
set search_path = saas, pg_temp as $$
  select valor from saas.config where clave = k $$;

create or replace function saas.hoy() returns date language sql stable
set search_path = saas, pg_temp as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

-- Estado de un cliente, calculado siempre a partir de sus fechas:
--   prueba     → dentro del período de prueba
--   activo     → pagado al día
--   moroso     → vencido, pero dentro de los días de gracia (funciona con aviso)
--   suspendido → vencido fuera de la gracia, o bloqueado a mano (no funciona)
--   baja       → dado de baja (no funciona)
create or replace function saas.estado(c saas.clientes) returns text language sql stable
set search_path = saas, pg_temp as $$
  select case
    when c.baja then 'baja'
    when c.bloqueo_manual then 'suspendido'
    when c.pagado_hasta is not null and c.pagado_hasta >= saas.hoy() then 'activo'
    when c.prueba_hasta is not null and c.prueba_hasta >= saas.hoy() then 'prueba'
    when greatest(c.pagado_hasta, c.prueba_hasta) is not null
         and greatest(c.pagado_hasta, c.prueba_hasta) + coalesce((saas.cfg('dias_gracia') #>> '{}')::int, 7) >= saas.hoy() then 'moroso'
    else 'suspendido'
  end $$;

create or replace function saas.precio(c saas.clientes) returns numeric language sql stable
set search_path = saas, pg_temp as $$
  select coalesce(c.precio_especial, (select precio from saas.planes where id = c.plan_id), 0) $$;

create or replace function saas.admin(p_token text) returns saas.admins language plpgsql
set search_path = saas, pg_temp as $$
declare s saas.sesiones; a saas.admins;
begin
  select * into s from saas.sesiones where token = p_token and vence > now();
  if not found then raise exception 'SESION_VENCIDA'; end if;
  select * into a from saas.admins where id = s.admin_id and habilitado;
  if not found then raise exception 'SESION_VENCIDA'; end if;
  return a;
end $$;

create or replace function saas.log(p_cliente bigint, p_tipo text, p_detalle text, p_admin text) returns void language sql
set search_path = saas, pg_temp as $$
  insert into saas.eventos(cliente_id, tipo, detalle, admin) values (p_cliente, p_tipo, p_detalle, p_admin) $$;

create or replace function saas.cliente_json(c saas.clientes) returns jsonb language sql stable
set search_path = saas, pg_temp as $$
  select to_jsonb(c) - 'token'
    || jsonb_build_object(
         'estado', saas.estado(c),
         'precio', saas.precio(c),
         'plan', (select nombre from saas.planes where id = c.plan_id),
         'max_moviles', (select max_moviles from saas.planes where id = c.plan_id),
         'token_fin', right(c.token, 4)) $$;

create or replace function saas.slugify(p text) returns text language sql immutable
set search_path = saas, pg_temp as $$
  select trim(both '-' from regexp_replace(lower(translate(coalesce(p,''),
    'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')), '[^a-z0-9]+', '-', 'g')) $$;

-- =====================================================================
-- API del panel de superadministrador (superadmin.html)
-- Todas reciben el token de sesión del superadmin.
-- =====================================================================

-- Iniciar sesión
create or replace function public.saas_login(p_usuario text, p_clave text) returns jsonb
language plpgsql security definer set search_path = saas, extensions, pg_temp as $$
declare a saas.admins; t text;
begin
  select * into a from saas.admins where lower(usuario) = lower(trim(p_usuario)) and habilitado;
  if not found or a.hash <> extensions.crypt(p_clave, a.hash) then
    perform pg_sleep(0.6);
    raise exception 'Usuario o contraseña incorrectos.';
  end if;
  delete from saas.sesiones where vence < now();
  t := encode(extensions.gen_random_bytes(24), 'hex');
  insert into saas.sesiones(token, admin_id) values (t, a.id);
  return jsonb_build_object('token', t, 'nombre', coalesce(a.nombre, a.usuario), 'debe_cambiar', a.debe_cambiar);
end $$;

create or replace function public.saas_salir(p_token text) returns jsonb
language sql security definer set search_path = saas, pg_temp as $$
  with d as (delete from saas.sesiones where token = p_token) select '{"ok":true}'::jsonb $$;

create or replace function public.saas_cambiar_clave(p_token text, p_actual text, p_nueva text) returns jsonb
language plpgsql security definer set search_path = saas, extensions, pg_temp as $$
declare a saas.admins;
begin
  a := saas.admin(p_token);
  if a.hash <> extensions.crypt(p_actual, a.hash) then raise exception 'La contraseña actual no es correcta.'; end if;
  if length(coalesce(p_nueva,'')) < 10 then raise exception 'La contraseña nueva tiene que tener al menos 10 caracteres.'; end if;
  update saas.admins set hash = extensions.crypt(p_nueva, extensions.gen_salt('bf', 10)), debe_cambiar = false where id = a.id;
  delete from saas.sesiones where admin_id = a.id and token <> p_token;
  return '{"ok":true}';
end $$;

-- Resumen para la pantalla de inicio
create or replace function public.saas_resumen(p_token text) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare a saas.admins; r jsonb; ini date := date_trunc('month', saas.hoy())::date;
begin
  a := saas.admin(p_token);
  select jsonb_build_object(
    'clientes', count(*) filter (where e <> 'baja'),
    'activos', count(*) filter (where e = 'activo'),
    'prueba', count(*) filter (where e = 'prueba'),
    'morosos', count(*) filter (where e = 'moroso'),
    'suspendidos', count(*) filter (where e = 'suspendido'),
    'bajas', count(*) filter (where e = 'baja'),
    'ingreso_mensual', coalesce(sum(p) filter (where e in ('activo','moroso')), 0),
    'potencial_prueba', coalesce(sum(p) filter (where e = 'prueba'), 0),
    'moviles', coalesce(sum(m) filter (where e <> 'baja'), 0)
  ) into r
  from (select saas.estado(c) e, saas.precio(c) p, coalesce(c.moviles_en_uso, 0) m from saas.clientes c) x;
  r := r || jsonb_build_object(
    'cobrado_mes', (select coalesce(sum(monto), 0) from saas.pagos where not anulado and fecha >= ini),
    'vencen_7_dias', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'vence', greatest(c.pagado_hasta, c.prueba_hasta), 'estado', saas.estado(c)) order by greatest(c.pagado_hasta, c.prueba_hasta)), '[]')
                      from saas.clientes c where not c.baja and greatest(c.pagado_hasta, c.prueba_hasta) between saas.hoy() - 30 and saas.hoy() + 7),
    'sin_conexion', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'ultima', c.ultima_conexion)), '[]')
                     from saas.clientes c where not c.baja and c.supabase_url is not null and (c.ultima_conexion is null or c.ultima_conexion < now() - interval '1 day')));
  return r;
end $$;

-- Clientes
create or replace function public.saas_clientes(p_token text) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
begin
  perform saas.admin(p_token);
  return (select coalesce(jsonb_agg(saas.cliente_json(c) order by c.baja, c.nombre), '[]') from saas.clientes c);
end $$;

create or replace function public.saas_cliente(p_token text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare c saas.clientes;
begin
  perform saas.admin(p_token);
  select * into c from saas.clientes where id = p_id;
  if not found then raise exception 'No existe ese cliente.'; end if;
  return saas.cliente_json(c) || jsonb_build_object(
    'pagos', (select coalesce(jsonb_agg(to_jsonb(p) order by p.fecha desc, p.id desc), '[]') from saas.pagos p where p.cliente_id = c.id),
    'eventos', (select coalesce(jsonb_agg(to_jsonb(e) order by e.fecha desc), '[]') from (select * from saas.eventos where cliente_id = c.id order by fecha desc limit 50) e));
end $$;

-- Alta o edición. Datos: nombre, slug, titular, email, telefono, cuit, ciudad, plan_id,
-- precio_especial, prueba_hasta, supabase_url, supabase_anon, dominio, notas
create or replace function public.saas_cliente_guardar(p_token text, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare a saas.admins; c saas.clientes; v_id bigint := nullif(p_datos->>'id','')::bigint; v_slug text;
  t text := 'cliente_editado';
begin
  a := saas.admin(p_token);
  if nullif(trim(p_datos->>'nombre'),'') is null then raise exception 'Falta el nombre de la remisería.'; end if;
  v_slug := saas.slugify(coalesce(nullif(p_datos->>'slug',''), p_datos->>'nombre'));
  if v_slug = '' then raise exception 'El identificador no es válido.'; end if;
  if exists (select 1 from saas.clientes where slug = v_slug and id is distinct from v_id) then
    raise exception 'Ya hay un cliente con el identificador "%".', v_slug;
  end if;
  if v_id is null then
    insert into saas.clientes(nombre, slug, prueba_hasta)
    values (trim(p_datos->>'nombre'), v_slug, saas.hoy() + coalesce((saas.cfg('dias_prueba') #>> '{}')::int, 15))
    returning id into v_id;
    t := 'alta';
  end if;
  update saas.clientes set
    nombre = trim(p_datos->>'nombre'),
    slug = v_slug,
    titular = nullif(trim(p_datos->>'titular'),''),
    email = nullif(trim(p_datos->>'email'),''),
    telefono = nullif(trim(p_datos->>'telefono'),''),
    cuit = nullif(trim(p_datos->>'cuit'),''),
    ciudad = nullif(trim(p_datos->>'ciudad'),''),
    plan_id = nullif(p_datos->>'plan_id','')::bigint,
    precio_especial = nullif(p_datos->>'precio_especial','')::numeric,
    prueba_hasta = case when p_datos ? 'prueba_hasta' then nullif(p_datos->>'prueba_hasta','')::date else prueba_hasta end,
    supabase_url = nullif(rtrim(trim(p_datos->>'supabase_url'), '/'),''),
    supabase_anon = nullif(trim(p_datos->>'supabase_anon'),''),
    dominio = nullif(trim(p_datos->>'dominio'),''),
    notas = nullif(trim(p_datos->>'notas'),''),
    mp_email = case when p_datos ? 'mp_email' then nullif(lower(trim(p_datos->>'mp_email')),'') else mp_email end
  where id = v_id returning * into c;
  perform saas.log(c.id, t, c.nombre, a.usuario);
  return saas.cliente_json(c);
end $$;

-- Suspender o reactivar a mano
create or replace function public.saas_cliente_bloquear(p_token text, p_id bigint, p_bloquear boolean, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare a saas.admins; c saas.clientes;
begin
  a := saas.admin(p_token);
  update saas.clientes set bloqueo_manual = p_bloquear, motivo_bloqueo = case when p_bloquear then nullif(trim(p_motivo),'') end
  where id = p_id returning * into c;
  if not found then raise exception 'No existe ese cliente.'; end if;
  perform saas.log(c.id, case when p_bloquear then 'suspendido_a_mano' else 'reactivado' end, p_motivo, a.usuario);
  return saas.cliente_json(c);
end $$;

-- Dar de baja o reincorporar
create or replace function public.saas_cliente_baja(p_token text, p_id bigint, p_baja boolean) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare a saas.admins; c saas.clientes;
begin
  a := saas.admin(p_token);
  update saas.clientes set baja = p_baja where id = p_id returning * into c;
  if not found then raise exception 'No existe ese cliente.'; end if;
  perform saas.log(c.id, case when p_baja then 'baja' else 'reincorporado' end, null, a.usuario);
  return saas.cliente_json(c);
end $$;

-- Nueva clave de licencia (si se filtró). Hay que volver a configurar la instancia del cliente.
create or replace function public.saas_cliente_nuevo_token(p_token text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = saas, extensions, pg_temp as $$
declare a saas.admins; c saas.clientes;
begin
  a := saas.admin(p_token);
  update saas.clientes set token = encode(extensions.gen_random_bytes(24), 'hex') where id = p_id returning * into c;
  if not found then raise exception 'No existe ese cliente.'; end if;
  perform saas.log(c.id, 'nuevo_token', null, a.usuario);
  return saas.cliente_json(c);
end $$;

-- SQL para pegar en el proyecto de Supabase de la remisería: la conecta con esta central.
create or replace function public.saas_cliente_sql_licencia(p_token text, p_id bigint, p_central_url text, p_central_anon text) returns text
language plpgsql security definer set search_path = saas, pg_temp as $$
declare c saas.clientes;
begin
  perform saas.admin(p_token);
  select * into c from saas.clientes where id = p_id;
  if not found then raise exception 'No existe ese cliente.'; end if;
  return format(
    E'-- Licencia de %s. Pegar en Supabase de la remisería → SQL Editor → Run\n'
    'insert into rodar.licencia(id, central_url, central_anon, slug, token)\n'
    'values (1, %L, %L, %L, %L)\n'
    'on conflict (id) do update set central_url = excluded.central_url, central_anon = excluded.central_anon,\n'
    '  slug = excluded.slug, token = excluded.token, verificada = null;\n'
    'select rodar.licencia_sincronizar();\n',
    c.nombre, rtrim(p_central_url, '/'), p_central_anon, c.slug, c.token);
end $$;

-- Pagos: registra un pago y extiende "pagado hasta" la cantidad de meses pagados (lo usan el panel y Mercado Pago).
-- El período arranca donde termina lo ya pagado. Si estaba en los días de gracia, se cobra desde el
-- vencimiento (no quedan días gratis); si estaba suspendido o es el primer pago, desde hoy o desde el
-- fin de la prueba.
create or replace function saas.pago_interno(p_cliente bigint, p_monto numeric, p_meses int, p_medio text,
  p_ref text, p_nota text, p_fecha date, p_quien text) returns saas.clientes language plpgsql
set search_path = saas, pg_temp as $$
declare c saas.clientes; v_desde date; v_hasta date; v_meses int := coalesce(p_meses, 1);
begin
  select * into c from saas.clientes where id = p_cliente for update;
  if not found then raise exception 'No existe ese cliente.'; end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto tiene que ser mayor a cero.'; end if;
  if c.pagado_hasta is not null and c.pagado_hasta + coalesce((saas.cfg('dias_gracia') #>> '{}')::int, 7) >= saas.hoy() then
    v_desde := c.pagado_hasta + 1;
  else
    v_desde := greatest(saas.hoy(), coalesce(c.prueba_hasta + 1, saas.hoy()));
  end if;
  v_hasta := (v_desde + make_interval(months => v_meses))::date - 1;
  insert into saas.pagos(cliente_id, fecha, meses, monto, medio, referencia, nota, desde, hasta, registrado_por)
  values (c.id, coalesce(p_fecha, saas.hoy()), v_meses, p_monto, coalesce(nullif(p_medio,''), 'transferencia'),
          nullif(trim(p_ref),''), nullif(trim(p_nota),''), v_desde, v_hasta, p_quien);
  update saas.clientes set pagado_hasta = v_hasta where id = c.id returning * into c;
  perform saas.log(c.id, 'pago', format('$ %s · %s mes(es) · hasta %s%s', p_monto, v_meses, to_char(v_hasta, 'DD/MM/YYYY'),
    case when p_medio = 'mercadopago' then ' · Mercado Pago' else '' end), p_quien);
  return c;
end $$;

-- Datos: cliente_id, monto, meses, medio, referencia, nota, fecha
create or replace function public.saas_pago_registrar(p_token text, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare a saas.admins; c saas.clientes; v_meses int := coalesce(nullif(p_datos->>'meses','')::int, 1);
begin
  a := saas.admin(p_token);
  select * into c from saas.clientes where id = (p_datos->>'cliente_id')::bigint;
  if not found then raise exception 'No existe ese cliente.'; end if;
  c := saas.pago_interno(c.id, coalesce(nullif(p_datos->>'monto','')::numeric, saas.precio(c) * v_meses), v_meses,
         p_datos->>'medio', p_datos->>'referencia', p_datos->>'nota', nullif(p_datos->>'fecha','')::date, a.usuario);
  return saas.cliente_json(c);
end $$;

-- Anular un pago: recalcula "pagado hasta" con los pagos que quedan.
create or replace function public.saas_pago_anular(p_token text, p_pago bigint) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare a saas.admins; p saas.pagos; c saas.clientes;
begin
  a := saas.admin(p_token);
  update saas.pagos set anulado = true where id = p_pago and not anulado returning * into p;
  if not found then raise exception 'Ese pago no existe o ya estaba anulado.'; end if;
  update saas.clientes set pagado_hasta = (select max(hasta) from saas.pagos where cliente_id = p.cliente_id and not anulado)
  where id = p.cliente_id returning * into c;
  perform saas.log(c.id, 'pago_anulado', format('$ %s del %s', p.monto, to_char(p.fecha, 'DD/MM/YYYY')), a.usuario);
  return saas.cliente_json(c);
end $$;

create or replace function public.saas_pagos(p_token text, p_desde date default null, p_hasta date default null) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
begin
  perform saas.admin(p_token);
  return (select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('cliente', c.nombre) order by p.fecha desc, p.id desc), '[]')
          from saas.pagos p join saas.clientes c on c.id = p.cliente_id
          where p.fecha between coalesce(p_desde, saas.hoy() - 365) and coalesce(p_hasta, saas.hoy()));
end $$;

-- Planes
create or replace function public.saas_planes(p_token text) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
begin
  perform saas.admin(p_token);
  return (select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('clientes',
            (select count(*) from saas.clientes c where c.plan_id = p.id and not c.baja)) order by p.orden, p.id), '[]')
          from saas.planes p);
end $$;

create or replace function public.saas_plan_guardar(p_token text, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare a saas.admins; p saas.planes; v_id bigint := nullif(p_datos->>'id','')::bigint;
begin
  a := saas.admin(p_token);
  if nullif(trim(p_datos->>'nombre'),'') is null then raise exception 'Falta el nombre del plan.'; end if;
  if v_id is null then
    insert into saas.planes(nombre) values (trim(p_datos->>'nombre')) returning id into v_id;
  end if;
  update saas.planes set
    nombre = trim(p_datos->>'nombre'),
    precio = coalesce(nullif(p_datos->>'precio','')::numeric, 0),
    max_moviles = nullif(p_datos->>'max_moviles','')::int,
    descripcion = nullif(trim(p_datos->>'descripcion'),''),
    activo = coalesce((p_datos->>'activo')::boolean, true),
    mp_plan_id = nullif(trim(p_datos->>'mp_plan_id'),''),
    orden = coalesce(nullif(p_datos->>'orden','')::int, orden)
  where id = v_id returning * into p;
  return to_jsonb(p);
end $$;

-- Configuración (días de gracia, días de prueba, texto de contacto)
create or replace function public.saas_config(p_token text, p_datos jsonb default null) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare k text;
begin
  perform saas.admin(p_token);
  if p_datos is not null then
    foreach k in array array['dias_gracia','dias_prueba','contacto'] loop
      if p_datos ? k then
        insert into saas.config(clave, valor) values (k, p_datos->k) on conflict (clave) do update set valor = excluded.valor;
      end if;
    end loop;
  end if;
  return (select jsonb_object_agg(clave, valor) from saas.config);
end $$;

-- =====================================================================
-- Consulta de licencia (la llama cada remisería desde su propia base)
-- No requiere sesión: se identifica con su slug + token secreto.
-- =====================================================================
create or replace function public.saas_licencia(p_slug text, p_token text, p_moviles int default null) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare c saas.clientes; e text; pl saas.planes; vence date;
begin
  select * into c from saas.clientes where slug = p_slug and token = p_token;
  if not found then
    perform pg_sleep(0.5);
    return jsonb_build_object('estado', 'desconocido', 'mensaje', 'Licencia no reconocida.');
  end if;
  update saas.clientes set ultima_conexion = now(), moviles_en_uso = coalesce(p_moviles, moviles_en_uso) where id = c.id;
  e := saas.estado(c);
  select * into pl from saas.planes where id = c.plan_id;
  vence := greatest(c.pagado_hasta, c.prueba_hasta);
  return jsonb_build_object(
    'estado', e,
    'plan', pl.nombre,
    'max_moviles', pl.max_moviles,
    'pago_url', case when e in ('prueba','moroso','suspendido') and coalesce(c.mp_estado,'') <> 'authorized' then c.mp_link end,
    'vence', vence,
    'suspende', case when e in ('moroso') then vence + coalesce((saas.cfg('dias_gracia') #>> '{}')::int, 7) end,
    'mensaje', case e
      when 'prueba' then format('Período de prueba hasta el %s.', to_char(c.prueba_hasta, 'DD/MM/YYYY'))
      when 'moroso' then format('El servicio venció el %s. Se suspende el %s si no se regulariza. %s',
                                to_char(vence, 'DD/MM/YYYY'),
                                to_char(vence + coalesce((saas.cfg('dias_gracia') #>> '{}')::int, 7), 'DD/MM/YYYY'),
                                saas.cfg('contacto') #>> '{}')
      when 'suspendido' then 'El servicio está suspendido. ' || coalesce(c.motivo_bloqueo || '. ', '') || (saas.cfg('contacto') #>> '{}')
      when 'baja' then 'El servicio fue dado de baja. ' || (saas.cfg('contacto') #>> '{}')
      else null end);
end $$;

-- =====================================================================
-- Mercado Pago: débito automático mensual (función de Supabase saas-mp)
-- Solo las llama esa función con la clave de servicio; no se pueden llamar desde las páginas.
-- =====================================================================
create or replace function public.saas_mp_datos(p_token text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare a saas.admins; c saas.clientes;
begin
  a := saas.admin(p_token);
  select * into c from saas.clientes where id = p_id;
  if not found then raise exception 'No existe ese cliente.'; end if;
  if c.baja then raise exception 'El cliente está dado de baja.'; end if;
  if coalesce(c.mp_email, c.email) is null then raise exception 'Cargá el email de Mercado Pago del cliente (Editar datos).'; end if;
  if saas.precio(c) <= 0 then raise exception 'El cliente no tiene plan ni precio.'; end if;
  return jsonb_build_object('id', c.id, 'nombre', c.nombre, 'slug', c.slug, 'email', coalesce(c.mp_email, c.email),
    'precio', saas.precio(c), 'plan', (select nombre from saas.planes where id = c.plan_id),
    'inicio', case when greatest(c.pagado_hasta, c.prueba_hasta) >= saas.hoy() then greatest(c.pagado_hasta, c.prueba_hasta) + 1 end,
    'preapproval', c.mp_preapproval_id, 'admin', a.usuario);
end $$;

create or replace function public.saas_mp_guardar(p_id bigint, p_preapproval text, p_link text, p_estado text, p_admin text default null) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare c saas.clientes;
begin
  update saas.clientes set mp_preapproval_id = coalesce(p_preapproval, mp_preapproval_id), mp_link = coalesce(p_link, mp_link),
    mp_estado = coalesce(p_estado, mp_estado), mp_actualizado = now()
  where id = p_id returning * into c;
  perform saas.log(c.id, 'mercadopago', format('Suscripción %s', coalesce(p_estado, '')), coalesce(p_admin, 'mercadopago'));
  return saas.cliente_json(c);
end $$;

-- Cambio de estado de la suscripción (authorized, paused, cancelled, pending)
create or replace function public.saas_mp_estado(p_preapproval text, p_estado text, p_slug text default null) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare c saas.clientes;
begin
  select * into c from saas.clientes where mp_preapproval_id = p_preapproval or (p_slug is not null and slug = p_slug)
  order by (mp_preapproval_id = p_preapproval) desc limit 1;
  if not found then return '{"ok":false,"motivo":"cliente no encontrado"}'; end if;
  if c.mp_estado is distinct from p_estado or c.mp_preapproval_id is distinct from p_preapproval then
    update saas.clientes set mp_estado = p_estado, mp_preapproval_id = p_preapproval, mp_actualizado = now() where id = c.id;
    perform saas.log(c.id, 'mercadopago', 'Suscripción ' || p_estado, 'mercadopago');
  end if;
  return '{"ok":true}';
end $$;

-- Pago aprobado de una suscripción: registra un mes. No se duplica (la referencia es el id del pago).
create or replace function public.saas_mp_pago(p_preapproval text, p_slug text, p_pago text, p_monto numeric, p_fecha date) returns jsonb
language plpgsql security definer set search_path = saas, pg_temp as $$
declare c saas.clientes;
begin
  if exists (select 1 from saas.pagos where medio = 'mercadopago' and referencia = p_pago) then return '{"ok":true,"ya":true}'; end if;
  select * into c from saas.clientes
  where (p_preapproval is not null and mp_preapproval_id = p_preapproval) or (p_slug is not null and slug = p_slug)
  order by (mp_preapproval_id = p_preapproval) desc nulls last limit 1;
  if not found then return '{"ok":false,"motivo":"cliente no encontrado"}'; end if;
  c := saas.pago_interno(c.id, p_monto, 1, 'mercadopago', p_pago, 'Débito automático', p_fecha, 'mercadopago');
  return jsonb_build_object('ok', true, 'cliente', c.nombre, 'pagado_hasta', c.pagado_hasta);
end $$;

-- ---------- permisos ----------
revoke all on all functions in schema saas from public, anon, authenticated;
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'saas\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    if f like 'saas\_mp\_%' then
      execute format('grant execute on function %s to service_role', f);   -- solo la función saas-mp
    else
      execute format('grant execute on function %s to anon, authenticated', f);
    end if;
  end loop;
end $$;

-- ---------- primer superadministrador ----------
-- Crea el usuario "admin" con una contraseña temporal SOLO si todavía no hay ninguno.
-- La contraseña temporal se muestra una sola vez al correr este archivo; el panel pide cambiarla al entrar.
do $$
declare clave text;
begin
  if not exists (select 1 from saas.admins) then
    clave := encode(extensions.gen_random_bytes(9), 'base64');
    insert into saas.admins(usuario, nombre, hash) values ('admin', 'Superadministrador', extensions.crypt(clave, extensions.gen_salt('bf', 10)));
    raise notice 'Superadmin creado → usuario: admin · contraseña temporal: %', clave;
  end if;
end $$;
