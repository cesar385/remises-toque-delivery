-- ===================== Remis TOQUE! Moto: viajes de pasajeros en moto =====================
-- Se apoya en lo que ya existía para delivery (61_rubros_vehiculo.sql):
--   * rodar.moviles.tipo_vehiculo  ('auto' | 'moto')
--   * rodar.viajes.vehiculo_req    (NULL = cualquiera)  y  rodar.elegible() que lo respeta.
-- Agrega:
--   1) Configuración "moto" (activar/desactivar, nombre, % del precio del remís, mínima, texto para el pasajero).
--   2) Precio de moto = precio de remís × pct / 100 (con mínima), más el cargo de plataforma si está activo.
--   3) Una moto NO recibe viajes de remís común (sí recibe los de moto y los de delivery).
--   4) El pasajero (web/app) y el operador pueden pedir "vehiculo": "moto".
--   5) Las solicitudes de alta de conductor guardan si son de auto o de moto, y al precargar el móvil se crea con ese tipo.
-- Se puede volver a correr: no borra datos.

-- ---------- 1) configuración ----------
insert into rodar.config(clave, valor) values ('moto', '{"activo":false,"nombre":"Remis TOQUE! Moto","pct":70,"minima":1500,"texto":"Viaje rápido en moto · 1 pasajero · casco para vos"}')
on conflict (clave) do nothing;

create or replace function rodar.moto_cfg() returns jsonb language sql stable set search_path to 'rodar', 'public', 'extensions' as $$
  select '{"activo":false,"nombre":"Remis TOQUE! Moto","pct":70,"minima":1500,"texto":"Viaje rápido en moto · 1 pasajero · casco para vos"}'::jsonb
         || coalesce(nullif(rodar.cfg('moto', '{}'::jsonb), 'null'::jsonb), '{}'::jsonb) $$;

create or replace function rodar.moto_activo() returns boolean language sql stable set search_path to 'rodar', 'public', 'extensions' as $$
  select coalesce((rodar.moto_cfg() ->> 'activo')::boolean, false) $$;

-- motos conectadas y libres ahora
create or replace function rodar.motos_libres() returns int language sql stable set search_path to 'rodar', 'public', 'extensions' as $$
  select count(*)::int from rodar.moviles
  where habilitado and coalesce(tipo_vehiculo, 'auto') = 'moto' and estado in ('disponible', 'en_parada') and conductor_id is not null $$;

-- ---------- 2) precio ----------
-- Recibe el resultado de rodar.estimar() (precio de remís) y lo convierte a precio de moto.
create or replace function rodar.estimar_moto(e jsonb, p_medio text) returns jsonb language plpgsql stable set search_path to 'rodar', 'public', 'extensions' as $$
declare c jsonb := rodar.moto_cfg();
  pct numeric := least(200, greatest(1, coalesce(nullif(c ->> 'pct', '')::numeric, 70)));
  mn numeric := greatest(0, coalesce(nullif(c ->> 'minima', '')::numeric, 0));
  b numeric; cp numeric; baj numeric;
begin
  if e is null then return null; end if;
  baj := round(coalesce((e ->> 'bajada')::numeric, 0) * pct / 100);
  if e ->> 'base' is null then
    return e || jsonb_build_object('vehiculo', 'moto', 'bajada', baj, 'tarifa', coalesce(c ->> 'nombre', 'Moto'));
  end if;
  b := greatest(round((e ->> 'base')::numeric * pct / 100), mn);
  cp := rodar.cargo_plataforma(b, p_medio);
  return e || jsonb_build_object('vehiculo', 'moto', 'base', b, 'cargo_plataforma', cp, 'monto', b + cp, 'bajada', baj, 'tarifa', coalesce(c ->> 'nombre', 'Moto'));
end $$;

-- Aplica el servicio pedido a viajes recién creados (antes de despachar). Si no es moto, no hace nada.
create or replace function rodar.aplicar_vehiculo(ids bigint[], d jsonb) returns void language plpgsql set search_path to 'rodar', 'public', 'extensions' as $$
#variable_conflict use_variable
declare v rodar.viajes; e jsonb; nid bigint;
begin
  if coalesce(rodar.t(d, 'vehiculo'), '') <> 'moto' then return; end if;
  if not rodar.moto_activo() then raise exception 'El servicio en moto no está disponible en este momento'; end if;
  foreach nid in array coalesce(ids, '{}') loop
    select * into v from rodar.viajes where id = nid;
    e := rodar.estimar_moto(rodar.estimar(v.origen_lat, v.origen_lng, v.destino_lat, v.destino_lng, v.canal, v.medio_pago, rodar.n(d, 'metros_ruta')::float8), v.medio_pago);
    update rodar.viajes set vehiculo_req = 'moto',
      monto_estimado = case when rodar.n(d, 'monto_fijo') is null and e ->> 'monto' is not null then (e ->> 'monto')::numeric else monto_estimado end
    where id = nid;
    perform rodar.emitir_viaje(nid);
  end loop;
end $$;

-- ---------- 3) despacho ----------
-- Igual que la versión vigente + una línea: una moto no recibe viajes de remís común.
create or replace function rodar.elegible(m rodar.moviles, v rodar.viajes) returns boolean language plpgsql stable as $$
#variable_conflict use_variable
declare ec jsonb;
begin
  if not m.habilitado or m.estado not in ('disponible', 'en_parada') or m.conductor_id is null then return false; end if;
  -- delivery o moto: el viaje puede exigir moto o auto (NULL = cualquiera)
  if v.vehiculo_req is not null and v.vehiculo_req <> coalesce(m.tipo_vehiculo, 'auto') then return false; end if;
  -- Remis TOQUE! Moto: una moto solo toma viajes de moto o pedidos de delivery, nunca un remís común
  if v.vehiculo_req is null and coalesce(m.tipo_vehiculo, 'auto') = 'moto' and coalesce(v.origen_tipo, '') <> 'delivery' then return false; end if;
  if m.id = any(coalesce(v.rechazos, '{}')) then return false; end if;
  if v.cliente_id is not null and exists(select 1 from rodar.negativos where cliente_id = v.cliente_id and movil_id = m.id) then return false; end if;
  if exists(select 1 from rodar.viajes where movil_id = m.id and estado in ('ofrecido', 'confirmado', 'en_curso')) then return false; end if;
  if exists(select 1 from rodar.penalizaciones where movil_id = m.id and hasta > rodar.ahora()) then return false; end if;
  ec := rodar.estado_cuenta(m);
  return not (ec ->> 'bloqueado')::boolean and not (ec ->> 'sin_saldo')::boolean;
end $$;

-- ---------- 4) API pública y del operador ----------
-- config pública: igual que antes + bloque "moto"
create or replace function public.r_pub_config(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare e jsonb := rodar.cfg('empresa', '{}'); l jsonb := coalesce(nullif(rodar.cfg('landing', 'null'::jsonb), 'null'::jsonb), '{}'::jsonb); mc jsonb := rodar.moto_cfg();
begin
  return jsonb_build_object('nombre', e ->> 'nombre', 'lat', e -> 'lat', 'lng', e -> 'lng', 'telefono', coalesce(nullif(l ->> 'telefono', ''), e ->> 'telefono'), 'localidad', e ->> 'localidad', 'provincia', e ->> 'provincia',
    'whatsapp', l ->> 'whatsapp', 'whatsapp_texto', l ->> 'whatsapp_texto',
    'razon_social', e ->> 'razon_social', 'cuit', e ->> 'cuit', 'direccion', e ->> 'direccion', 'email', e ->> 'email',
    'cargo', jsonb_build_object('activo', coalesce((rodar.cfg('mp', '{}') ->> 'cargo_activo')::boolean, false), 'pct', coalesce(nullif(rodar.cfg('mp', '{}') ->> 'cargo_pct', '')::numeric, 7.99)),
    'medios', rodar.lista('select codigo, nombre from rodar.medios_pago where habilitado and codigo not in (''cuenta_corriente'') order by orden'),
    'moto', jsonb_build_object('activo', rodar.moto_activo(), 'nombre', mc ->> 'nombre', 'texto', mc ->> 'texto',
      'pct', coalesce(nullif(mc ->> 'pct', '')::numeric, 70), 'minima', coalesce(nullif(mc ->> 'minima', '')::numeric, 0),
      'libres', case when rodar.moto_activo() then rodar.motos_libres() else 0 end));
end $function$;

create or replace function public.r_pub_estimar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare e jsonb;
begin
  if p_b ->> 'origen_lat' is null then return 'null'; end if;
  e := rodar.estimar((p_b ->> 'origen_lat')::float8, (p_b ->> 'origen_lng')::float8, (p_b ->> 'destino_lat')::float8, (p_b ->> 'destino_lng')::float8, 'web', rodar.t(p_b, 'medio_pago'), rodar.n(p_b, 'metros_ruta')::float8);
  if rodar.t(p_b, 'vehiculo') = 'moto' and rodar.moto_activo() then e := rodar.estimar_moto(e, rodar.t(p_b, 'medio_pago')); end if;
  return e;
end $function$;

-- estimar del panel (operador): mismo agregado
create or replace function public.r_estimar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare e jsonb;
begin
  perform rodar.usuario(p_token);
  e := rodar.estimar((p_b ->> 'origen_lat')::float8, (p_b ->> 'origen_lng')::float8, (p_b ->> 'destino_lat')::float8, (p_b ->> 'destino_lng')::float8, rodar.t(p_b, 'canal'), rodar.t(p_b, 'medio_pago'), rodar.n(p_b, 'metros_ruta')::float8);
  if rodar.t(p_b, 'vehiculo') = 'moto' then e := rodar.estimar_moto(e, rodar.t(p_b, 'medio_pago')); end if;
  return e;
end $function$;

-- pedido web del pasajero: igual que antes + aplicar_vehiculo antes de despachar
create or replace function public.r_pub_viaje(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare tel text := regexp_replace(coalesce(p_b ->> 'telefono', ''), '\D', '', 'g'); corp bigint; medio text := coalesce(rodar.t(p_b, 'medio_pago'), 'efectivo'); ids bigint[]; s rodar.usuarios; est text;
begin
  if rodar.t(p_b, 'destino_dir') is null or p_b ->> 'destino_lat' is null then raise exception 'Indicá a dónde vas'; end if;
  if rodar.t(p_b, 'vehiculo') = 'moto' and not rodar.moto_activo() then raise exception 'El servicio en moto no está disponible en este momento'; end if;
  if (select count(*) from rodar.limite_pedidos where clave = tel and ts > now() - interval '10 minutes') >= 5 then raise exception 'Demasiados pedidos seguidos. Esperá unos minutos o llamá a la central.'; end if;
  if (select count(*) from rodar.limite_pedidos where ts > now() - interval '1 minute') >= 40 then raise exception 'Hay demasiados pedidos en este momento, probá en un minuto.'; end if;
  if not exists(select 1 from rodar.sesiones x where x.token = p_b ->> 'token' and x.activa) then perform rodar.exigir_captcha(p_b, 'pedido'); end if;
  insert into rodar.limite_pedidos(clave) values (tel);
  if length(tel) < 8 then raise exception 'Ingresá un teléfono válido'; end if;
  if rodar.t(p_b, 'origen_dir') is null or p_b ->> 'origen_lat' is null then raise exception 'Indicá el origen en el mapa o buscá la dirección'; end if;
  if rodar.t(p_b, 'token') is not null then
    select u.* into s from rodar.sesiones x join rodar.usuarios u on u.id = x.usuario_id where x.token = p_b ->> 'token' and x.activa;
    if s.corporativo_id is not null then
      select estado into est from rodar.corporativos where id = s.corporativo_id;
      if est is distinct from 'activa' then raise exception 'La cuenta de la empresa está %. Comunicate con la central.', case est when 'suspendida' then 'suspendida' else 'inactiva' end; end if;
      corp := s.corporativo_id; medio := 'cuenta_corriente';
    end if;
  end if;
  if medio = 'cuenta_corriente' and corp is null then raise exception 'Tu usuario no está asociado a ninguna empresa, así que no podés pedir a cuenta corriente. Pedile a la central que te asigne a tu empresa.'; end if;
  ids := rodar.crear_viaje(p_b || jsonb_build_object('telefono', tel, 'alias', p_b ->> 'nombre', 'canal', 'web', 'medio_pago', medio, 'corporativo_id', corp, 'pin_requerido', true,
    'cantidad_moviles', 1, 'estado', 'pendiente', 'movil_id', null, 'conductor_id', null, 'programado', null, 'monto_fijo', null), null);
  perform rodar.aplicar_vehiculo(ids, p_b);
  perform rodar.procesar();
  return jsonb_build_object('id', ids[1], 'k', rodar.firma(ids[1]), 'canal', rodar.topico('viaje-' || ids[1] || '-' || rodar.firma(ids[1])));
end $function$;

-- pedido cargado por el operador: igual que antes + aplicar_vehiculo antes de despachar
create or replace function public.r_viaje_crear(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.need(p_token, 'operador'); zp text; ids bigint[] := '{}'; f text;
begin
  if rodar.t(p_b, 'origen_dir') is null then raise exception 'Ingresá la dirección de origen'; end if;
  if p_b ->> 'origen_lat' is not null then
    zp := rodar.peligrosa((p_b ->> 'origen_lat')::float8, (p_b ->> 'origen_lng')::float8);
    if zp is not null and not rodar.b(p_b, 'confirmar_peligrosa') then raise exception 'PELIGROSA:El origen está en una zona peligrosa (%). ¿Confirmás igual?', zp; end if;
  end if;
  if jsonb_typeof(p_b -> 'repetir') = 'object' and jsonb_array_length(coalesce(p_b -> 'repetir' -> 'fechas', '[]')) > 0 then
    for f in select jsonb_array_elements_text(p_b -> 'repetir' -> 'fechas') loop
      ids := ids || rodar.crear_viaje(p_b || jsonb_build_object('programado', f || ' ' || (p_b -> 'repetir' ->> 'hora') || ':00'), u);
    end loop;
  else
    ids := rodar.crear_viaje(p_b, u);
  end if;
  perform rodar.aplicar_vehiculo(ids, p_b);
  perform rodar.procesar();
  if rodar.t(p_b, 'centro_costo') is not null and rodar.n(p_b, 'corporativo_id') is not null then
    execute 'up' || 'date rodar.viajes set centro_costo = $2 where id = any($1)' using ids, rodar.t(p_b, 'centro_costo');
  end if;
  if rodar.n(p_b, 'conv_id') is not null and exists(select 1 from rodar.chat_conv where id = rodar.n(p_b, 'conv_id')::bigint) then
    execute 'up' || 'date rodar.viajes set chat_conv_id = $2 where id = any($1)' using ids, rodar.n(p_b, 'conv_id')::bigint;
  end if;
  return jsonb_build_object('ids', to_jsonb(ids));
end $function$;

-- configuración de moto desde el panel (solo administración)
create or replace function public.r_moto_cfg(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.need(p_token, 'admin');
begin
  return rodar.moto_cfg() || jsonb_build_object('libres', rodar.motos_libres(),
    'motos', (select count(*) from rodar.moviles where coalesce(tipo_vehiculo, 'auto') = 'moto'),
    'habilitadas', (select count(*) from rodar.moviles where coalesce(tipo_vehiculo, 'auto') = 'moto' and habilitado));
end $function$;

create or replace function public.r_moto_cfg_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.need(p_token, 'admin'); v jsonb; pct numeric := rodar.n(p_b, 'pct'); mn numeric := rodar.n(p_b, 'minima');
begin
  if pct is null or pct < 1 or pct > 200 then raise exception 'El porcentaje tiene que estar entre 1 y 200'; end if;
  if mn is not null and mn < 0 then raise exception 'La tarifa mínima no puede ser negativa'; end if;
  v := jsonb_build_object('activo', coalesce(rodar.b(p_b, 'activo'), false), 'nombre', coalesce(rodar.t(p_b, 'nombre'), 'Remis TOQUE! Moto'),
    'pct', pct, 'minima', coalesce(mn, 0), 'texto', coalesce(rodar.t(p_b, 'texto'), ''));
  insert into rodar.config(clave, valor) values ('moto', v) on conflict (clave) do update set valor = excluded.valor;
  perform rodar.accion(u, 'config_moto', null, v::text);
  return v;
end $function$;

-- ---------- 5) alta de conductores: auto o moto ----------
alter table rodar.solicitudes_conductor add column if not exists tipo_vehiculo text default 'auto';

create or replace function public.r_solicitud_conductor(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare tipos text[]; sin_auto boolean; falta text[] := '{}'; req text; veh text := case when rodar.t(p_b, 'tipo_vehiculo') = 'moto' then 'moto' else 'auto' end;
begin
  if jsonb_typeof(coalesce(p_b -> 'docs', '[]')) <> 'array' or jsonb_array_length(coalesce(p_b -> 'docs', '[]')) > 12 then raise exception 'Demasiados archivos'; end if;
  perform rodar.validar_archivo(x ->> 'archivo', 2700000) from jsonb_array_elements(coalesce(p_b -> 'docs', '[]')) x;
  if rodar.t(p_b, 'nombre') is null or rodar.t(p_b, 'dni') is null or rodar.t(p_b, 'telefono') is null then raise exception 'Completá nombre, DNI y teléfono'; end if;
  select coalesce(array_agg(x ->> 'tipo') filter (where coalesce(x ->> 'archivo', '') <> ''), '{}'), bool_or(x ->> 'tipo' = 'Sin vehículo propio')
    into tipos, sin_auto from jsonb_array_elements(coalesce(p_b -> 'docs', '[]')) x;
  foreach req in array array['DNI (frente)', 'DNI (dorso)', 'Licencia de conducir'] || case when coalesce(sin_auto, false) then '{}'::text[] else array['Cédula del vehículo', 'Seguro del vehículo'] end loop
    if not req = any(tipos) then falta := falta || req; end if;
  end loop;
  if array_length(falta, 1) > 0 then raise exception 'Falta cargar: %', array_to_string(falta, ', '); end if;
  if (select count(*) from rodar.solicitudes_conductor where fecha > rodar.ahora() - interval '1 hour') > 30 then raise exception 'Demasiadas solicitudes, probá más tarde'; end if;
  insert into rodar.solicitudes_conductor(nombre, apellido, dni, telefono, email, patente, marca, modelo, anio, origen, docs, fecha, tipo_vehiculo)
  values (p_b ->> 'nombre', p_b ->> 'apellido', p_b ->> 'dni', p_b ->> 'telefono', p_b ->> 'email', p_b ->> 'patente', p_b ->> 'marca', p_b ->> 'modelo', rodar.n(p_b, 'anio')::int, coalesce(rodar.t(p_b, 'origen'), 'web'), coalesce((p_b -> 'docs')::text, '[]'), rodar.ahora(), veh);
  perform rodar.emit('panel', 'aviso', jsonb_build_object('texto', 'Nueva solicitud de alta de conductor' || case when veh = 'moto' then ' (moto)' else '' end || ': ' || (p_b ->> 'nombre') || ' ' || coalesce(p_b ->> 'apellido', '')));
  return '{"ok":true}';
end $function$;

create or replace function public.r_solicitud_accion(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path to 'rodar', 'public', 'extensions' as $function$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.need(p_token, 'admin'); s rodar.solicitudes_conductor; uid bigint; mid bigint; acc text := p_q ->> 'accion';
begin
  select * into s from rodar.solicitudes_conductor where id = (p_q ->> 'id')::bigint;
  if acc = 'observar' then update rodar.solicitudes_conductor set estado = 'observada', observacion = p_b ->> 'observacion' where id = s.id;
  elsif acc = 'rechazar' then update rodar.solicitudes_conductor set estado = 'rechazada', observacion = p_b ->> 'observacion' where id = s.id;
  elsif acc = 'precargar' then
    select id into uid from rodar.usuarios where documento = s.dni;
    if uid is null then
      insert into rodar.usuarios(documento, nombre, apellido, email, telefono, password_hash, roles, docs)
      values (s.dni, s.nombre, coalesce(s.apellido, ''), s.email, s.telefono, rodar.hash(right(s.dni, 6)), 'conductor', s.docs) returning id into uid;
    end if;
    if rodar.n(p_b, 'numero') is not null then
      select id into mid from rodar.moviles where numero = rodar.n(p_b, 'numero');
      if mid is null then
        insert into rodar.moviles(numero, patente, marca, modelo, anio, plan_id, habilitado, tipo_vehiculo)
        values (rodar.n(p_b, 'numero')::int, s.patente, s.marca, s.modelo, s.anio, (select id from rodar.planes where sistema limit 1), false, coalesce(s.tipo_vehiculo, 'auto')) returning id into mid;
        perform rodar.historial_movil(mid, 'alta', rodar.nombre(u), 'Precargado desde solicitud (inhabilitado)' || case when s.tipo_vehiculo = 'moto' then ' · moto' else '' end);
      end if;
      insert into rodar.movil_conductores values (mid, uid) on conflict do nothing;
    end if;
    update rodar.solicitudes_conductor set estado = 'precargada' where id = s.id;
    perform rodar.accion(u, 'solicitud_precargada', s.dni, 'Clave inicial: últimos 6 del DNI');
  end if;
  return '{"ok":true}';
end $function$;

grant execute on function public.r_moto_cfg(text, jsonb, jsonb), public.r_moto_cfg_guardar(text, jsonb, jsonb) to anon, authenticated;

-- ---------- 6) cierre del viaje: precio de moto ----------
create or replace function rodar.monto_moto(p_total numeric) returns numeric language sql stable set search_path to 'rodar', 'public', 'extensions' as $$
  select case when p_total is null then null else greatest(
    round(p_total * least(200, greatest(1, coalesce(nullif(rodar.moto_cfg() ->> 'pct', '')::numeric, 70))) / 100),
    greatest(0, coalesce(nullif(rodar.moto_cfg() ->> 'minima', '')::numeric, 0))) end $$;

-- rodar.finalizar calcula el monto con la tarifa del remís: se agrega la conversión a moto en ese punto
do $$
declare def text := pg_get_functiondef('rodar.finalizar'::regproc);
  viejo text := 'else total := rodar.calcular_monto(t, coalesce(metros, 0), coalesce(p_espera, 0), coalesce(v.indice, 1)); end if;';
  nuevo text := 'else total := rodar.calcular_monto(t, coalesce(metros, 0), coalesce(p_espera, 0), coalesce(v.indice, 1)); if v.vehiculo_req = ''moto'' then total := rodar.monto_moto(total); end if; end if;';
begin
  if position('rodar.monto_moto' in def) > 0 then return; end if;
  if position(viejo in def) = 0 then raise exception 'No encontré el cálculo de tarifa en rodar.finalizar'; end if;
  execute replace(def, viejo, nuevo);
end $$;

-- rodar.elegible con search_path fijo (aviso de seguridad de Supabase)
alter function rodar.elegible(rodar.moviles, rodar.viajes) set search_path to 'rodar', 'public', 'extensions';
