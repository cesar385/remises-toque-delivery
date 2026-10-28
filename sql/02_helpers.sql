-- ===================== Helpers internos (esquema rodar) =====================

create or replace function rodar.cfg(k text, def jsonb default null) returns jsonb language sql stable as $$
  select coalesce((select valor from rodar.config where clave = k), def) $$;
-- Guarda una clave de configuración. Con valor nulo (SQL null) borra la clave en vez de fallar por "valor" not null.
create or replace function rodar.cfg_set(k text, v jsonb) returns void language plpgsql as $$
begin
  if k is null then return; end if;
  if v is null then delete from rodar.config where clave = k; return; end if;
  insert into rodar.config(clave, valor) values (k, v) on conflict (clave) do update set valor = excluded.valor;
end $$;

create or replace function rodar.tz() returns text language sql stable as $$
  select coalesce(rodar.cfg('zona_horaria') #>> '{}', 'America/Argentina/Buenos_Aires') $$;
create or replace function rodar.ahora() returns timestamp language sql stable as $$
  select date_trunc('second', now() at time zone rodar.tz()) $$;
create or replace function rodar.hoy() returns date language sql stable as $$ select rodar.ahora()::date $$;

-- texto de un campo jsonb (vacío = null)
create or replace function rodar.t(p jsonb, k text) returns text language sql immutable as $$ select nullif(p->>k, '') $$;
create or replace function rodar.n(p jsonb, k text) returns numeric language sql immutable as $$
  select case when nullif(p->>k,'') is null then null when (p->>k) ~ '^-?[0-9]+(\.[0-9]+)?$' then (p->>k)::numeric else null end $$;
create or replace function rodar.b(p jsonb, k text) returns boolean language sql immutable as $$
  select case when p->k is null or jsonb_typeof(p->k) = 'null' then false
              when jsonb_typeof(p->k) = 'boolean' then (p->k)::boolean
              else lower(p->>k) in ('1','true','si','on') end $$;
create or replace function rodar.ts(p jsonb, k text) returns timestamp language sql immutable as $$
  select case when nullif(p->>k,'') is null then null else replace(p->>k, 'T', ' ')::timestamp end $$;

create or replace function rodar.err(msg text) returns void language plpgsql as $$ begin raise exception '%', msg; end $$;

-- ---------- sesión ----------
create or replace function rodar.usuario(p_token text) returns rodar.usuarios language plpgsql as $$
declare u rodar.usuarios; s rodar.sesiones;
begin
  select * into s from rodar.sesiones where token = p_token and activa;
  if not found then raise exception 'SESION_VENCIDA'; end if;
  select * into u from rodar.usuarios where id = s.usuario_id and habilitado;
  if not found then raise exception 'SESION_VENCIDA'; end if;
  if s.ultimo is null or s.ultimo < rodar.ahora() - interval '20 seconds' then
    update rodar.sesiones set ultimo = rodar.ahora() where token = p_token;
  end if;
  return u;
end $$;
create or replace function rodar.sesion(p_token text) returns rodar.sesiones language sql stable as $$
  select * from rodar.sesiones where token = p_token $$;
create or replace function rodar.tiene(u rodar.usuarios, variadic r text[]) returns boolean language sql immutable as $$
  select 'admin' = any(string_to_array(u.roles, ',')) or string_to_array(u.roles, ',') && r $$;
create or replace function rodar.need(p_token text, variadic r text[]) returns rodar.usuarios language plpgsql as $$
declare u rodar.usuarios;
begin
  u := rodar.usuario(p_token);
  if array_length(r, 1) is not null and not rodar.tiene(u, variadic r) then raise exception 'No tenés permiso para esta pantalla.'; end if;
  return u;
end $$;
create or replace function rodar.nombre(u rodar.usuarios) returns text language sql immutable as $$ select trim(u.nombre || ' ' || coalesce(u.apellido,'')) $$;

-- ---------- bitácoras ----------
create or replace function rodar.accion(u rodar.usuarios, p_tipo text, p_afectado text, p_detalle text) returns void language sql as $$
  insert into rodar.acciones_usuarios(fecha, actor_id, actor, tipo, afectado, detalle)
  values (rodar.ahora(), u.id, coalesce(rodar.nombre(u), 'sistema'), p_tipo, p_afectado, p_detalle) $$;
create or replace function rodar.evento_movil(p_movil bigint, p_tipo text, p_ref text, p_detalle text) returns void language sql as $$
  insert into rodar.eventos_moviles(fecha, movil_id, movil_numero, tipo, ref, detalle)
  values (rodar.ahora(), p_movil, (select numero from rodar.moviles where id = p_movil), p_tipo, p_ref, p_detalle) $$;
create or replace function rodar.historial_movil(p_movil bigint, p_tipo text, p_usuario text, p_detalle text) returns void language sql as $$
  insert into rodar.moviles_historial(fecha, movil_id, movil_numero, tipo, entidad, usuario, detalle)
  values (rodar.ahora(), p_movil, (select numero from rodar.moviles where id = p_movil), p_tipo, 'movil', coalesce(p_usuario,'sistema'), p_detalle) $$;

-- ---------- geo ----------
create or replace function rodar.dist(a double precision, b double precision, c double precision, d double precision) returns double precision language sql immutable as $$
  select case when a is null or b is null or c is null or d is null then null else
    2 * 6371000 * asin(sqrt(power(sin(radians(c - a) / 2), 2) + cos(radians(a)) * cos(radians(c)) * power(sin(radians(d - b) / 2), 2))) end $$;
create or replace function rodar.dentro(lat double precision, lng double precision, pol jsonb) returns boolean language plpgsql immutable as $$
declare n int; i int; j int; yi float8; xi float8; yj float8; xj float8; dentro boolean := false;
begin
  if lat is null or pol is null or jsonb_array_length(pol) < 3 then return false; end if;
  n := jsonb_array_length(pol); j := n - 1;
  for i in 0 .. n - 1 loop
    yi := (pol->i->>0)::float8; xi := (pol->i->>1)::float8; yj := (pol->j->>0)::float8; xj := (pol->j->>1)::float8;
    if ((yi > lat) <> (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) then dentro := not dentro; end if;
    j := i;
  end loop;
  return dentro;
end $$;
create or replace function rodar.area(pol jsonb) returns double precision language plpgsql immutable as $$
declare n int; i int; j int; a float8 := 0;
begin
  n := jsonb_array_length(pol); if n < 3 then return 0; end if; j := n - 1;
  for i in 0 .. n - 1 loop
    a := a + ((pol->j->>1)::float8 + (pol->i->>1)::float8) * ((pol->j->>0)::float8 - (pol->i->>0)::float8); j := i;
  end loop;
  return abs(a);
end $$;
create or replace function rodar.zona_de(lat double precision, lng double precision) returns rodar.zonas language sql stable as $$
  select * from rodar.zonas where rodar.dentro(lat, lng, poligono) order by rodar.area(poligono) limit 1 $$;
create or replace function rodar.peligrosa(lat double precision, lng double precision) returns text language sql stable as $$
  select coalesce(nombre, 'Zona peligrosa') from rodar.zonas_peligrosas where rodar.dentro(lat, lng, poligono) limit 1 $$;

-- ---------- tiempo real (Supabase Realtime Broadcast) ----------
create or replace function rodar.topico(p text) returns text language sql stable as $$
  select 'rodar-' || (rodar.cfg('secreto') #>> '{}') || '-' || p $$;
create or replace function rodar.emit(p_topic text, p_evento text, p_payload jsonb) returns void language plpgsql as $$
begin
  perform realtime.send(coalesce(p_payload, '{}'::jsonb), p_evento, rodar.topico(p_topic), false);
exception when others then null; -- sin Realtime disponible: se ignora (los clientes también consultan periódicamente)
end $$;

-- lista jsonb desde una consulta
create or replace function rodar.lista(q text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  execute 'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (' || q || ') x' into r;
  return r;
end $$;

-- hash de contraseñas
create or replace function rodar.hash(p text) returns text language sql as $$ select extensions.crypt(p, extensions.gen_salt('bf', 8)) $$;
create or replace function rodar.verificar(p text, h text) returns boolean language sql as $$ select h = extensions.crypt(p, h) $$;
create or replace function rodar.token() returns text language sql as $$ select encode(extensions.gen_random_bytes(24), 'hex') $$;
create or replace function rodar.firma(p_id bigint) returns text language sql stable as $$
  select left(encode(extensions.hmac(p_id::text, rodar.cfg('secreto') #>> '{}', 'sha256'), 'hex'), 16) $$;
