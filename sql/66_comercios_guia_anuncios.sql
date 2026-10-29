-- ===================== Comercios: Guía de la ciudad y Anuncios =====================
-- 1) GUÍA: lugares de referencia (terminal, hospital, trámites, plazas…) que carga la central, más los comercios de
--    delivery activos (rodar.dlv_negocios), que aparecen solos con el botón "Pedir delivery".
-- 2) ANUNCIOS: novedades de la central y promos de comercios, con vigencia (desde/hasta) y estado:
--      publicado | pendiente (lo cargó un comercio, espera aprobación) | pausado | rechazado | solicitud (pedido de "quiero anunciar")
--    Los comercios cargan sus promos desde su portal (quedan pendientes); la central aprueba desde el panel.
-- Las tablas no se leen directo: todo pasa por funciones (security definer), como el resto del sistema.
-- Se puede volver a correr: no borra datos.

-- ---------- tablas ----------
create table if not exists rodar.guia_lugares (
  id bigserial primary key,
  nombre text not null,
  categoria text not null default 'otros',          -- transporte | salud | farmacias | tramites | turismo | educacion | comidas | compras | hoteles | bancos | deportes | otros
  direccion text, descripcion text, telefono text, horario text,
  lat double precision, lng double precision,
  h24 boolean not null default false, destacado boolean not null default false, activo boolean not null default true,
  orden int not null default 0,
  creado timestamp default rodar.ahora()
);
alter table rodar.guia_lugares enable row level security;

create table if not exists rodar.anuncios (
  id bigserial primary key,
  titulo text not null,
  tipo text not null default 'comercio' check (tipo in ('novedad', 'promo', 'comercio', 'evento', 'aviso')),
  texto text, anunciante text,
  negocio_id bigint references rodar.dlv_negocios(id) on delete set null,
  emoji text, color text, imagen text,
  desde date, hasta date,
  destacado boolean not null default false,
  codigo text, destino text, tel text, link text, cta text,
  estado text not null default 'publicado' check (estado in ('publicado', 'pendiente', 'pausado', 'rechazado', 'solicitud')),
  contacto jsonb, nota text,
  orden int not null default 0,
  creado timestamp default rodar.ahora(), actualizado timestamp default rodar.ahora()
);
alter table rodar.anuncios enable row level security;
create index if not exists anuncios_estado_idx on rodar.anuncios(estado, desde, hasta);

-- ---------- helpers ----------
-- Valida y normaliza los campos que se pueden cargar en un anuncio
create or replace function rodar.anuncio_datos(d jsonb) returns jsonb language plpgsql stable set search_path to 'rodar', 'public', 'extensions' as $$
declare img text := rodar.t(d, 'imagen'); lnk text := rodar.t(d, 'link'); tel text := regexp_replace(coalesce(rodar.t(d, 'tel'), ''), '\D', '', 'g');
  de date := nullif(d ->> 'desde', '')::date; ha date := nullif(d ->> 'hasta', '')::date;
begin
  if rodar.t(d, 'titulo') is null then raise exception 'Escribí un título'; end if;
  if length(rodar.t(d, 'titulo')) > 90 then raise exception 'El título es muy largo (máximo 90 caracteres)'; end if;
  if length(coalesce(rodar.t(d, 'texto'), '')) > 600 then raise exception 'El texto es muy largo (máximo 600 caracteres)'; end if;
  if de is not null and ha is not null and ha < de then raise exception 'La fecha "hasta" no puede ser anterior a "desde"'; end if;
  if img is not null then
    if img like 'data:%' then perform rodar.validar_archivo(img, 900000, false);
    elsif img !~ '^https://' then raise exception 'La imagen tiene que ser un archivo o una dirección https://'; end if;
  end if;
  if lnk is not null and lnk !~ '^(https://|[a-z0-9_-]+\.html)' then raise exception 'El enlace tiene que empezar con https://'; end if;
  return jsonb_build_object('titulo', rodar.t(d, 'titulo'), 'texto', rodar.t(d, 'texto'), 'anunciante', rodar.t(d, 'anunciante'),
    'tipo', case when rodar.t(d, 'tipo') in ('novedad', 'promo', 'comercio', 'evento', 'aviso') then rodar.t(d, 'tipo') else 'comercio' end,
    'emoji', left(rodar.t(d, 'emoji'), 8), 'color', left(rodar.t(d, 'color'), 120), 'imagen', img,
    'desde', de, 'hasta', ha, 'codigo', left(upper(rodar.t(d, 'codigo')), 24), 'destino', left(rodar.t(d, 'destino'), 160),
    'tel', nullif(tel, ''), 'link', lnk, 'cta', left(rodar.t(d, 'cta'), 30));
end $$;

-- Anuncio tal como lo ve el público (sin datos internos)
create or replace function rodar.anuncio_publico(a rodar.anuncios) returns jsonb language sql stable set search_path to 'rodar', 'public', 'extensions' as $$
  select jsonb_build_object('id', a.id, 'titulo', a.titulo, 'tipo', a.tipo, 'texto', a.texto,
    'anunciante', coalesce(a.anunciante, (select nombre from rodar.dlv_negocios where id = a.negocio_id)),
    'negocio_id', a.negocio_id, 'tiene_delivery', exists(select 1 from rodar.dlv_negocios where id = a.negocio_id and estado = 'activo'),
    'emoji', a.emoji, 'color', a.color, 'imagen', a.imagen, 'desde', a.desde, 'hasta', a.hasta, 'destacado', a.destacado,
    'codigo', a.codigo, 'destino', coalesce(a.destino, (select direccion from rodar.dlv_negocios where id = a.negocio_id)),
    'tel', a.tel, 'link', a.link, 'cta', a.cta) $$;

-- ---------- públicas ----------
create or replace function public.r_pub_guia(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
begin
  return jsonb_build_object(
    'lugares', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre, 'cat', l.categoria, 'dir', l.direccion, 'desc', l.descripcion,
        'tel', l.telefono, 'horario', l.horario, 'lat', l.lat, 'lng', l.lng, 'h24', l.h24, 'destacado', l.destacado) order by l.orden, l.nombre)
      from rodar.guia_lugares l where l.activo), '[]'::jsonb),
    'comercios', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'nombre', n.nombre, 'rubro', c.nombre, 'dir', n.direccion,
        'desc', n.descripcion, 'tel', n.telefono, 'lat', n.lat, 'lng', n.lng, 'abierto', rodar.dlv_abierto(n.horario), 'destacado', n.destacado)
        order by n.destacado desc nulls last, n.orden nulls last, n.nombre)
      from rodar.dlv_negocios n left join rodar.dlv_categorias c on c.id = n.categoria_id where n.estado = 'activo' and not coalesce(n.demo, false)), '[]'::jsonb));
end $function$;

create or replace function public.r_pub_anuncios(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
begin
  return coalesce((select jsonb_agg(rodar.anuncio_publico(a) order by a.destacado desc, a.orden, a.desde desc nulls last, a.id desc)
    from rodar.anuncios a where a.estado = 'publicado' and (a.desde is null or a.desde <= rodar.hoy()) and (a.hasta is null or a.hasta >= rodar.hoy())), '[]'::jsonb);
end $function$;

-- "Quiero anunciar": queda como solicitud para la central
create or replace function public.r_pub_anuncio_solicitud(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare tel text := regexp_replace(coalesce(p_b ->> 'telefono', ''), '\D', '', 'g'); neg text := rodar.t(p_b, 'negocio');
begin
  if neg is null then raise exception 'Escribí el nombre del comercio'; end if;
  if length(tel) < 8 then raise exception 'Dejanos un teléfono o WhatsApp para contactarte'; end if;
  if (select count(*) from rodar.limite_pedidos where clave = 'anuncio:' || tel and ts > now() - interval '1 hour') >= 3 then raise exception 'Ya recibimos tu pedido. Te vamos a contactar pronto.'; end if;
  if (select count(*) from rodar.limite_pedidos where clave like 'anuncio:%' and ts > now() - interval '1 hour') >= 30 then raise exception 'Hay muchos pedidos en este momento, probá más tarde.'; end if;
  insert into rodar.limite_pedidos(clave) values ('anuncio:' || tel);
  insert into rodar.anuncios(titulo, tipo, anunciante, texto, estado, contacto)
  values (left('Solicitud: ' || neg, 90), 'comercio', left(neg, 90), left(rodar.t(p_b, 'texto'), 600), 'solicitud',
    jsonb_build_object('telefono', tel, 'rubro', left(rodar.t(p_b, 'rubro'), 80), 'plan', left(rodar.t(p_b, 'plan'), 60)));
  perform rodar.emit('panel', 'aviso', jsonb_build_object('texto', 'Nuevo pedido para anunciar: ' || neg || ' (' || tel || ')'));
  return '{"ok":true}';
end $function$;

-- ---------- panel (administración) ----------
create or replace function public.r_anuncios(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.need(p_token, 'admin'); est text := nullif(p_q ->> 'estado', '');
begin
  return jsonb_build_object(
    'filas', coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object('negocio', (select nombre from rodar.dlv_negocios where id = a.negocio_id),
        'vigente', (a.desde is null or a.desde <= rodar.hoy()) and (a.hasta is null or a.hasta >= rodar.hoy())) order by a.creado desc)
      from rodar.anuncios a where est is null or a.estado = est), '[]'::jsonb),
    'pendientes', (select count(*) from rodar.anuncios where estado in ('pendiente', 'solicitud')),
    'negocios', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre) order by nombre) from rodar.dlv_negocios), '[]'::jsonb));
end $function$;

create or replace function public.r_anuncio_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.need(p_token, 'admin'); d jsonb := rodar.anuncio_datos(p_b); aid bigint := rodar.n(p_b, 'id')::bigint;
  est text := case when rodar.t(p_b, 'estado') in ('publicado', 'pendiente', 'pausado', 'rechazado', 'solicitud') then rodar.t(p_b, 'estado') else 'publicado' end;
  neg bigint := rodar.n(p_b, 'negocio_id')::bigint;
begin
  if neg is not null and not exists(select 1 from rodar.dlv_negocios where id = neg) then neg := null; end if;
  if aid is null then
    insert into rodar.anuncios(titulo, tipo, texto, anunciante, negocio_id, emoji, color, imagen, desde, hasta, destacado, codigo, destino, tel, link, cta, estado, nota, orden)
    values (d ->> 'titulo', d ->> 'tipo', d ->> 'texto', d ->> 'anunciante', neg, d ->> 'emoji', d ->> 'color', d ->> 'imagen', (d ->> 'desde')::date, (d ->> 'hasta')::date,
      coalesce(rodar.b(p_b, 'destacado'), false), d ->> 'codigo', d ->> 'destino', d ->> 'tel', d ->> 'link', d ->> 'cta', est, rodar.t(p_b, 'nota'), coalesce(rodar.n(p_b, 'orden')::int, 0))
    returning id into aid;
  else
    update rodar.anuncios set titulo = d ->> 'titulo', tipo = d ->> 'tipo', texto = d ->> 'texto', anunciante = d ->> 'anunciante', negocio_id = neg,
      emoji = d ->> 'emoji', color = d ->> 'color', imagen = d ->> 'imagen', desde = (d ->> 'desde')::date, hasta = (d ->> 'hasta')::date,
      destacado = coalesce(rodar.b(p_b, 'destacado'), false), codigo = d ->> 'codigo', destino = d ->> 'destino', tel = d ->> 'tel', link = d ->> 'link', cta = d ->> 'cta',
      estado = est, nota = rodar.t(p_b, 'nota'), orden = coalesce(rodar.n(p_b, 'orden')::int, 0), actualizado = rodar.ahora()
    where id = aid;
    if not found then raise exception 'Anuncio no encontrado'; end if;
  end if;
  perform rodar.accion(u, 'anuncio_guardar', aid::text, d ->> 'titulo');
  return jsonb_build_object('ok', true, 'id', aid);
end $function$;

create or replace function public.r_anuncio_estado(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.need(p_token, 'admin'); aid bigint := coalesce((p_q ->> 'id')::bigint, rodar.n(p_b, 'id')::bigint); est text := rodar.t(p_b, 'estado');
begin
  if est not in ('publicado', 'pendiente', 'pausado', 'rechazado') then raise exception 'Estado no válido'; end if;
  update rodar.anuncios set estado = est, nota = coalesce(rodar.t(p_b, 'nota'), nota), actualizado = rodar.ahora() where id = aid;
  if not found then raise exception 'Anuncio no encontrado'; end if;
  perform rodar.accion(u, 'anuncio_' || est, aid::text, null);
  return '{"ok":true}';
end $function$;

create or replace function public.r_anuncio_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.need(p_token, 'admin'); aid bigint := coalesce((p_q ->> 'id')::bigint, rodar.n(p_b, 'id')::bigint);
begin
  delete from rodar.anuncios where id = aid;
  perform rodar.accion(u, 'anuncio_borrar', aid::text, null);
  return '{"ok":true}';
end $function$;

create or replace function public.r_guia_lugares(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.need(p_token, 'admin');
begin
  return coalesce((select jsonb_agg(to_jsonb(l) order by l.orden, l.nombre) from rodar.guia_lugares l), '[]'::jsonb);
end $function$;

create or replace function public.r_guia_lugar_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.need(p_token, 'admin'); lid bigint := rodar.n(p_b, 'id')::bigint; nom text := rodar.t(p_b, 'nombre');
  cat text := coalesce(rodar.t(p_b, 'categoria'), 'otros');
begin
  if nom is null then raise exception 'Escribí el nombre del lugar'; end if;
  if cat not in ('transporte', 'salud', 'farmacias', 'tramites', 'turismo', 'educacion', 'comidas', 'compras', 'hoteles', 'bancos', 'deportes', 'otros') then cat := 'otros'; end if;
  if lid is null then
    insert into rodar.guia_lugares(nombre, categoria, direccion, descripcion, telefono, horario, lat, lng, h24, destacado, activo, orden)
    values (left(nom, 120), cat, left(rodar.t(p_b, 'direccion'), 160), left(rodar.t(p_b, 'descripcion'), 400), left(rodar.t(p_b, 'telefono'), 40), left(rodar.t(p_b, 'horario'), 120),
      rodar.n(p_b, 'lat')::float8, rodar.n(p_b, 'lng')::float8, coalesce(rodar.b(p_b, 'h24'), false), coalesce(rodar.b(p_b, 'destacado'), false), coalesce(rodar.b(p_b, 'activo'), true), coalesce(rodar.n(p_b, 'orden')::int, 0))
    returning id into lid;
  else
    update rodar.guia_lugares set nombre = left(nom, 120), categoria = cat, direccion = left(rodar.t(p_b, 'direccion'), 160), descripcion = left(rodar.t(p_b, 'descripcion'), 400),
      telefono = left(rodar.t(p_b, 'telefono'), 40), horario = left(rodar.t(p_b, 'horario'), 120), lat = rodar.n(p_b, 'lat')::float8, lng = rodar.n(p_b, 'lng')::float8,
      h24 = coalesce(rodar.b(p_b, 'h24'), false), destacado = coalesce(rodar.b(p_b, 'destacado'), false), activo = coalesce(rodar.b(p_b, 'activo'), true), orden = coalesce(rodar.n(p_b, 'orden')::int, 0)
    where id = lid;
    if not found then raise exception 'Lugar no encontrado'; end if;
  end if;
  return jsonb_build_object('ok', true, 'id', lid);
end $function$;

create or replace function public.r_guia_lugar_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.need(p_token, 'admin');
begin
  delete from rodar.guia_lugares where id = coalesce((p_q ->> 'id')::bigint, rodar.n(p_b, 'id')::bigint);
  return '{"ok":true}';
end $function$;

-- ---------- portal de comercios: sus propias promos ----------
create or replace function public.r_dlv_com_anuncios(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.dlv_negocio_usuarios := rodar.dlv_comercio(p_token);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'tipo', a.tipo, 'texto', a.texto, 'emoji', a.emoji, 'color', a.color, 'imagen', a.imagen,
      'desde', a.desde, 'hasta', a.hasta, 'codigo', a.codigo, 'cta', a.cta, 'estado', a.estado, 'nota', a.nota,
      'vigente', (a.desde is null or a.desde <= rodar.hoy()) and (a.hasta is null or a.hasta >= rodar.hoy())) order by a.creado desc)
    from rodar.anuncios a where a.negocio_id = u.negocio_id), '[]'::jsonb);
end $function$;

-- Crear o modificar una promo propia: siempre queda pendiente de aprobación de la central
create or replace function public.r_dlv_com_anuncio_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.dlv_negocio_usuarios := rodar.dlv_comercio(p_token); d jsonb; aid bigint := rodar.n(p_b, 'id')::bigint; n rodar.dlv_negocios;
begin
  select * into n from rodar.dlv_negocios where id = u.negocio_id;
  d := rodar.anuncio_datos(p_b || jsonb_build_object('tipo', case when rodar.t(p_b, 'tipo') in ('promo', 'comercio', 'evento') then rodar.t(p_b, 'tipo') else 'promo' end,
    'anunciante', n.nombre, 'link', null, 'destino', n.direccion, 'tel', null));
  if aid is null then
    if (select count(*) from rodar.anuncios where negocio_id = n.id and estado in ('pendiente', 'publicado')) >= 10 then raise exception 'Tenés muchas promociones activas o en revisión. Pausá o eliminá alguna.'; end if;
    insert into rodar.anuncios(titulo, tipo, texto, anunciante, negocio_id, emoji, color, imagen, desde, hasta, codigo, destino, cta, estado)
    values (d ->> 'titulo', d ->> 'tipo', d ->> 'texto', n.nombre, n.id, d ->> 'emoji', d ->> 'color', d ->> 'imagen', (d ->> 'desde')::date, (d ->> 'hasta')::date,
      d ->> 'codigo', d ->> 'destino', d ->> 'cta', 'pendiente') returning id into aid;
  else
    update rodar.anuncios set titulo = d ->> 'titulo', tipo = d ->> 'tipo', texto = d ->> 'texto', emoji = d ->> 'emoji', color = d ->> 'color', imagen = d ->> 'imagen',
      desde = (d ->> 'desde')::date, hasta = (d ->> 'hasta')::date, codigo = d ->> 'codigo', cta = d ->> 'cta', estado = 'pendiente', actualizado = rodar.ahora()
    where id = aid and negocio_id = n.id;
    if not found then raise exception 'Promoción no encontrada'; end if;
  end if;
  perform rodar.emit('panel', 'aviso', jsonb_build_object('texto', n.nombre || ' cargó una promoción para revisar: ' || (d ->> 'titulo')));
  return jsonb_build_object('ok', true, 'id', aid, 'estado', 'pendiente');
end $function$;

create or replace function public.r_dlv_com_anuncio_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.dlv_negocio_usuarios := rodar.dlv_comercio(p_token);
begin
  delete from rodar.anuncios where id = coalesce((p_q ->> 'id')::bigint, rodar.n(p_b, 'id')::bigint) and negocio_id = u.negocio_id;
  if not found then raise exception 'Promoción no encontrada'; end if;
  return '{"ok":true}';
end $function$;

grant execute on function public.r_pub_guia(text, jsonb, jsonb), public.r_pub_anuncios(text, jsonb, jsonb), public.r_pub_anuncio_solicitud(text, jsonb, jsonb),
  public.r_anuncios(text, jsonb, jsonb), public.r_anuncio_guardar(text, jsonb, jsonb), public.r_anuncio_estado(text, jsonb, jsonb), public.r_anuncio_borrar(text, jsonb, jsonb),
  public.r_guia_lugares(text, jsonb, jsonb), public.r_guia_lugar_guardar(text, jsonb, jsonb), public.r_guia_lugar_borrar(text, jsonb, jsonb),
  public.r_dlv_com_anuncios(text, jsonb, jsonb), public.r_dlv_com_anuncio_guardar(text, jsonb, jsonb), public.r_dlv_com_anuncio_borrar(text, jsonb, jsonb) to anon, authenticated;

-- ---------- contenido inicial (solo si está vacío) ----------
insert into rodar.guia_lugares(nombre, categoria, direccion, descripcion, telefono, h24, destacado, orden)
select * from (values
  ('Terminal de Ómnibus', 'transporte', 'Av. Belgrano 557', 'Micros a Paraná, Concordia, Villaguay, Buenos Aires y más.', null::text, false, true, 1),
  ('Hospital Justo José de Urquiza', 'salud', null, 'Hospital público de Federal. Guardia.', null, true, true, 2),
  ('Hospital Colonia Dr. Raúl Camino', 'salud', null, 'Hospital provincial de salud mental.', null, false, false, 3),
  ('Municipalidad de Federal', 'tramites', 'Antelo 505', 'Palacio Municipal.', null, false, true, 4),
  ('SENASA – Oficina Federal', 'tramites', 'Donovan y Anderson', 'Funciona en la Sociedad Rural.', '03454421191', false, false, 5),
  ('Plaza principal', 'turismo', null, 'El corazón de la ciudad, rodeada de edificios públicos.', null, false, true, 6),
  ('Parroquia Santa Rosa de Lima', 'turismo', null, 'Templo principal de Federal, frente a la plaza.', null, false, false, 7),
  ('Vieja Estación del Ferrocarril', 'turismo', null, 'Edificio histórico del ferrocarril.', null, false, false, 8),
  ('Predio de la Fiesta Nacional del Chamamé', 'turismo', null, 'Sede de la fiesta más tradicional de Federal.', null, false, false, 9)
) v(nombre, categoria, direccion, descripcion, telefono, h24, destacado, orden)
where not exists (select 1 from rodar.guia_lugares);

insert into rodar.anuncios(titulo, tipo, texto, anunciante, emoji, color, desde, destacado, link, cta, estado, orden)
select * from (values
  ('Remis TOQUE! Moto', 'novedad', 'Viajes rápidos en moto por la ciudad. Pedilo desde la app eligiendo «Moto».', 'Remises TOQUE!', '🛵', 'linear-gradient(135deg,#0b4fa8,#1fae5b)', rodar.hoy(), true, 'pasajero.html?servicio=moto', 'Pedir moto', 'pausado', 1),
  ('Delivery TOQUE!', 'novedad', 'Pedí a los comercios de Federal o mandá un paquete puerta a puerta.', 'Remises TOQUE!', '📦', 'linear-gradient(135deg,#178a48,#0b4fa8)', rodar.hoy(), true, 'delivery.html', 'Pedir delivery', 'publicado', 2),
  ('Nueva guía de Federal', 'novedad', 'Encontrá hospital, terminal, trámites y comercios, y pedí tu remís directo hasta ahí.', 'Remises TOQUE!', '🗺️', 'linear-gradient(135deg,#083a7c,#0b4fa8)', rodar.hoy(), true, 'guia.html', 'Abrir la guía', 'publicado', 3)
) v(titulo, tipo, texto, anunciante, emoji, color, desde, destacado, link, cta, estado, orden)
where not exists (select 1 from rodar.anuncios);
