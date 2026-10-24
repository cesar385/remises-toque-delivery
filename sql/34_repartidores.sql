-- ===================== Portal de repartidores (repartidor.html) =====================
-- Si el DNI ya es de un conductor de la central, se vincula esa misma cuenta (pide su contraseña actual): una sola cuenta, dos móviles.
-- Un repartidor se anota solo (moto o auto + datos + documentos), la central lo aprueba y desde el portal ve sus ganancias,
-- sus entregas y maneja su vehículo. Los pedidos en vivo se reciben en conductor.html (misma cuenta y mismo móvil).
-- Por dentro, cada repartidor es un usuario con rol 'conductor' + un móvil propio (moto o auto): así entra al despacho de siempre.
-- Se puede volver a correr: no borra datos. Tiene que correr después de 33_rubros_vehiculo.sql.

create table if not exists rodar.dlv_repartidores (
  usuario_id bigint primary key references rodar.usuarios(id) on delete cascade,
  movil_id bigint references rodar.moviles(id) on delete set null,
  estado text not null default 'pendiente',        -- pendiente | aprobado | rechazado | suspendido
  motivo text, creado timestamp default rodar.ahora(), resuelto_at timestamp, resuelto_por text
);

-- ---------- registro (público) ----------
create or replace function public.r_rep_registro(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare doc text := regexp_replace(coalesce(rodar.t(p_b, 'documento'), ''), '[^0-9A-Za-z]', '', 'g'); veh text := coalesce(rodar.t(p_b, 'vehiculo'), '');
  pw text := coalesce(p_b ->> 'password', ''); uid bigint; mid bigint; num int; ex rodar.usuarios; vinc boolean := false; docs_n jsonb := case when jsonb_typeof(p_b -> 'docs') = 'array' then p_b -> 'docs' else '[]'::jsonb end;
begin
  if rodar.t(p_b, 'nombre') is null or rodar.t(p_b, 'apellido') is null then raise exception 'Ingresá tu nombre y apellido'; end if;
  if length(doc) < 6 then raise exception 'Ingresá tu DNI'; end if;
  if rodar.t(p_b, 'telefono') is null then raise exception 'Ingresá tu teléfono'; end if;
  if veh not in ('moto', 'auto') then raise exception 'Elegí si repartís en moto o en auto'; end if;
  if rodar.t(p_b, 'patente') is null then raise exception 'Ingresá la patente de tu vehículo'; end if;
  if jsonb_array_length(docs_n) > 8 then raise exception 'Demasiados documentos'; end if;
  if (select count(*) from rodar.limite_pedidos where clave = 'rep:' || doc and ts > now() - interval '10 minutes') >= 5 then raise exception 'Demasiados intentos, probá en unos minutos'; end if;
  insert into rodar.limite_pedidos(clave) values ('rep:' || doc);
  select * into ex from rodar.usuarios where documento = doc or usuario = doc;
  if found then
    -- el DNI ya tiene cuenta (por ejemplo, es conductor de la central): se vincula la MISMA cuenta si demuestra que es suya con su contraseña actual
    if exists (select 1 from rodar.dlv_repartidores where usuario_id = ex.id) then raise exception 'Ya estás anotado como repartidor. Ingresá con tu DNI y contraseña.'; end if;
    if not rodar.verificar(pw, ex.password_hash) then raise exception 'Ese DNI ya tiene una cuenta en la central. Para vincularla escribí tu contraseña actual (la que usás en la app de conductores).'; end if;
    if not ex.habilitado then raise exception 'Tu cuenta está deshabilitada. Contactá a la central.'; end if;
    uid := ex.id; vinc := true;
    update rodar.usuarios set roles = case when 'conductor' = any(string_to_array(roles, ',')) then roles else roles || ',conductor' end,
      telefono = coalesce(telefono, rodar.t(p_b, 'telefono')), email = coalesce(email, rodar.t(p_b, 'email')), cbu = coalesce(cbu, rodar.t(p_b, 'cbu')), alias_bancario = coalesce(alias_bancario, rodar.t(p_b, 'alias')),
      docs = case when jsonb_array_length(docs_n) > 0 then (coalesce(nullif(usuarios.docs, ''), '[]')::jsonb || docs_n)::text else usuarios.docs end where id = uid;
  else
    if length(pw) < 6 then raise exception 'La contraseña tiene que tener al menos 6 caracteres'; end if;
    insert into rodar.usuarios(documento, usuario, nombre, apellido, email, telefono, cbu, alias_bancario, password_hash, roles, habilitado, docs)
    values (doc, doc, rodar.t(p_b, 'nombre'), rodar.t(p_b, 'apellido'), rodar.t(p_b, 'email'), rodar.t(p_b, 'telefono'), rodar.t(p_b, 'cbu'), rodar.t(p_b, 'alias'), rodar.hash(pw), 'conductor', true, docs_n::text)
    returning id into uid;
  end if;
  select coalesce(max(numero), 0) + 1 into num from rodar.moviles;
  insert into rodar.moviles(numero, patente, marca, modelo, color, titular_id, tarifador, habilitado, tipo_vehiculo, plan_id, docs)
  values (num, upper(rodar.t(p_b, 'patente')), rodar.t(p_b, 'marca'), rodar.t(p_b, 'modelo'), rodar.t(p_b, 'color'), uid, true, false, veh, (select id from rodar.planes order by id limit 1), docs_n::text)
  returning id into mid;
  insert into rodar.movil_conductores(movil_id, usuario_id) values (mid, uid);
  insert into rodar.dlv_repartidores(usuario_id, movil_id) values (uid, mid);
  perform rodar.emit('panel', 'aviso', jsonb_build_object('texto', 'Nuevo repartidor para aprobar: ' || coalesce(ex.nombre, rodar.t(p_b, 'nombre')) || ' ' || coalesce(ex.apellido, rodar.t(p_b, 'apellido')) || ' (' || veh || ')' || case when vinc then ' · ya es conductor de la central' else '' end));
  return jsonb_build_object('ok', true, 'vinculado', vinc); end $$;

-- ---------- login ----------
create or replace function public.r_rep_login(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios; tk text; us text := trim(coalesce(p_b ->> 'usuario', ''));
begin
  select * into u from rodar.usuarios where (usuario = us or documento = us) and habilitado and exists (select 1 from rodar.dlv_repartidores r where r.usuario_id = usuarios.id);
  if not found or not rodar.verificar(coalesce(p_b ->> 'password', ''), u.password_hash) then raise exception 'DNI o contraseña incorrectos'; end if;
  tk := rodar.token();
  insert into rodar.sesiones(token, usuario_id, tipo, inicio, ultimo) values (tk, u.id, 'repartidor', rodar.ahora(), rodar.ahora());
  return jsonb_build_object('token', tk); end $$;

create or replace function rodar.rep_sesion(p_token text) returns rodar.dlv_repartidores language plpgsql as $$
declare u rodar.usuarios := rodar.usuario(p_token); r rodar.dlv_repartidores;
begin
  select * into r from rodar.dlv_repartidores where usuario_id = u.id;
  if not found then raise exception 'SESION_VENCIDA'; end if;
  return r; end $$;

create or replace function public.r_rep_salir(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language sql security definer set search_path = rodar, public, extensions as $$
  update rodar.sesiones set activa = false where token = p_token and tipo = 'repartidor' returning '{"ok":true}'::jsonb $$;

-- ---------- ganancias de un repartidor: lo que cobra por cada entrega = envío + propina - lo que retiene la central ----------
create or replace function rodar.rep_ganado(p rodar.dlv_pedidos) returns numeric language sql immutable as $$
  select greatest(0, coalesce(p.envio, 0) + coalesce(p.propina, 0) - coalesce(p.comision_repartidor, 0)) $$;

create or replace function rodar.rep_resumen(p_uid bigint) returns jsonb language sql stable as $$
  with e as (select p.*, rodar.rep_ganado(p) g from rodar.dlv_pedidos p where p.conductor_id = p_uid and p.estado = 'entregado' and p.tipo_entrega = 'entrega')
  select jsonb_build_object(
    'hoy',    jsonb_build_object('entregas', count(*) filter (where entregado_at::date = rodar.ahora()::date), 'ganado', coalesce(sum(g) filter (where entregado_at::date = rodar.ahora()::date), 0)),
    'semana', jsonb_build_object('entregas', count(*) filter (where entregado_at >= date_trunc('week', rodar.ahora())), 'ganado', coalesce(sum(g) filter (where entregado_at >= date_trunc('week', rodar.ahora())), 0)),
    'mes',    jsonb_build_object('entregas', count(*) filter (where entregado_at >= date_trunc('month', rodar.ahora())), 'ganado', coalesce(sum(g) filter (where entregado_at >= date_trunc('month', rodar.ahora())), 0)),
    'total',  jsonb_build_object('entregas', count(*), 'ganado', coalesce(sum(g), 0))) from e $$;

-- ---------- pantalla principal ----------
create or replace function public.r_rep_inicio(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); r rodar.dlv_repartidores := rodar.rep_sesion(p_token); m rodar.moviles;
begin
  select * into m from rodar.moviles where id = r.movil_id;
  return jsonb_build_object(
    'repartidor', jsonb_build_object('estado', r.estado, 'motivo', r.motivo, 'nombre', u.nombre, 'apellido', u.apellido, 'documento', u.documento, 'telefono', u.telefono,
      'email', u.email, 'cbu', u.cbu, 'alias', u.alias_bancario, 'docs', coalesce(u.docs, '[]')::jsonb, 'desde', r.creado),
    'movil', case when m.id is null then null else jsonb_build_object('numero', m.numero, 'patente', m.patente, 'marca', m.marca, 'modelo', m.modelo, 'color', m.color,
      'tipo_vehiculo', m.tipo_vehiculo, 'estado', m.estado, 'habilitado', m.habilitado, 'cuenta', rodar.estado_cuenta(m)) end,
    'resumen', rodar.rep_resumen(u.id),
    'en_curso', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'codigo', p.codigo, 'estado', p.estado, 'negocio', (select nombre from rodar.dlv_negocios where id = p.negocio_id),
        'recogida_dir', p.recogida_dir, 'entrega_dir', p.entrega_dir, 'cliente', p.cliente_nombre, 'ganancia', rodar.rep_ganado(p), 'cobrar', case when p.pagado or p.medio_pago <> 'efectivo' then 0 else p.total end) order by p.id)
      from rodar.dlv_pedidos p where p.conductor_id = u.id and p.estado not in ('entregado', 'cancelado') and p.tipo_entrega = 'entrega'), '[]'),
    'entregas', coalesce((select jsonb_agg(x) from (select jsonb_build_object('id', p.id, 'codigo', p.codigo, 'fecha', p.entregado_at, 'negocio', coalesce((select nombre from rodar.dlv_negocios where id = p.negocio_id), 'Envío directo'),
        'entrega_dir', p.entrega_dir, 'ganancia', rodar.rep_ganado(p), 'propina', p.propina, 'medio_pago', p.medio_pago) x
      from rodar.dlv_pedidos p where p.conductor_id = u.id and p.estado = 'entregado' and p.tipo_entrega = 'entrega' order by p.entregado_at desc nulls last limit 60) t), '[]')); end $$;

-- ---------- datos personales y vehículo ----------
create or replace function public.r_rep_perfil(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); r rodar.dlv_repartidores := rodar.rep_sesion(p_token); veh text := rodar.t(p_b, 'vehiculo'); m rodar.moviles;
begin
  if p_b ? 'password' then
    if not rodar.verificar(coalesce(p_b ->> 'actual', ''), u.password_hash) then raise exception 'La contraseña actual no es correcta'; end if;
    if length(coalesce(p_b ->> 'password', '')) < 6 then raise exception 'La contraseña nueva tiene que tener al menos 6 caracteres'; end if;
    update rodar.usuarios set password_hash = rodar.hash(p_b ->> 'password') where id = u.id;
    return jsonb_build_object('ok', true);
  end if;
  update rodar.usuarios set telefono = coalesce(rodar.t(p_b, 'telefono'), telefono), email = coalesce(rodar.t(p_b, 'email'), email),
    cbu = case when p_b ? 'cbu' then rodar.t(p_b, 'cbu') else cbu end, alias_bancario = case when p_b ? 'alias' then rodar.t(p_b, 'alias') else alias_bancario end,
    docs = case when jsonb_typeof(p_b -> 'docs') = 'array' and jsonb_array_length(p_b -> 'docs') <= 8 then (p_b -> 'docs')::text else docs end where id = u.id;
  select * into m from rodar.moviles where id = r.movil_id;
  if found then
    if veh is not null and veh not in ('moto', 'auto') then raise exception 'Elegí moto o auto'; end if;
    if veh is not null and veh <> m.tipo_vehiculo and m.estado not in ('desconectado', 'fuera_servicio') then raise exception 'Desconectate de la app de reparto antes de cambiar de vehículo'; end if;
    update rodar.moviles set tipo_vehiculo = coalesce(veh, tipo_vehiculo), patente = coalesce(upper(rodar.t(p_b, 'patente')), patente), marca = coalesce(rodar.t(p_b, 'marca'), marca),
      modelo = coalesce(rodar.t(p_b, 'modelo'), modelo), color = coalesce(rodar.t(p_b, 'color'), color),
      docs = case when jsonb_typeof(p_b -> 'docs') = 'array' and jsonb_array_length(p_b -> 'docs') <= 8 then (p_b -> 'docs')::text else docs end where id = m.id;
    perform rodar.emitir_movil(m.id);
  end if;
  return jsonb_build_object('ok', true); end $$;

-- ---------- central: aprobar / rechazar / suspender ----------
create or replace function public.r_rep_lista(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin', 'operador', 'gestion');
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.usuario_id, 'estado', r.estado, 'motivo', r.motivo, 'creado', r.creado, 'nombre', us.nombre, 'apellido', us.apellido, 'documento', us.documento,
      'telefono', us.telefono, 'email', us.email, 'cbu', us.cbu, 'alias', us.alias_bancario, 'docs', coalesce(us.docs, '[]')::jsonb, 'movil_id', m.id, 'movil', m.numero, 'vehiculo', m.tipo_vehiculo, 'patente', m.patente,
      'marca', m.marca, 'modelo', m.modelo, 'color', m.color, 'movil_estado', m.estado, 'resumen', rodar.rep_resumen(r.usuario_id),
      'otros_moviles', coalesce((select jsonb_agg(x.numero order by x.numero) from rodar.movil_conductores mc join rodar.moviles x on x.id = mc.movil_id where mc.usuario_id = r.usuario_id and x.id <> coalesce(r.movil_id, 0)), '[]'))
      order by case r.estado when 'pendiente' then 0 else 1 end, r.creado desc)
    from rodar.dlv_repartidores r join rodar.usuarios us on us.id = r.usuario_id left join rodar.moviles m on m.id = r.movil_id
    where coalesce(rodar.t(p_q, 'estado'), '') in ('', r.estado)), '[]'); end $$;

create or replace function public.r_rep_resolver(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin', 'operador'); r rodar.dlv_repartidores; a text := rodar.t(p_b, 'accion'); nuevo text;
begin
  select * into r from rodar.dlv_repartidores where usuario_id = rodar.n(p_b, 'id')::bigint for update;
  if not found then raise exception 'Repartidor no encontrado'; end if;
  nuevo := case a when 'aprobar' then 'aprobado' when 'reactivar' then 'aprobado' when 'rechazar' then 'rechazado' when 'suspender' then 'suspendido' end;
  if nuevo is null then raise exception 'Acción desconocida'; end if;
  if nuevo in ('rechazado', 'suspendido') and rodar.t(p_b, 'motivo') is null then raise exception 'Indicá el motivo'; end if;
  update rodar.dlv_repartidores set estado = nuevo, motivo = case when nuevo = 'aprobado' then null else rodar.t(p_b, 'motivo') end, resuelto_at = rodar.ahora(), resuelto_por = rodar.nombre(u) where usuario_id = r.usuario_id;
  if r.movil_id is not null then
    update rodar.moviles set habilitado = (nuevo = 'aprobado'), estado = case when nuevo <> 'aprobado' then 'desconectado' else estado end where id = r.movil_id;
    if nuevo <> 'aprobado' then update rodar.sesiones set activa = false where usuario_id = r.usuario_id and tipo <> 'repartidor'; end if;
    perform rodar.historial_movil(r.movil_id, case when nuevo = 'aprobado' then 'alta' else 'baja' end, rodar.nombre(u), 'Repartidor ' || nuevo || coalesce(' · ' || rodar.t(p_b, 'motivo'), ''));
    perform rodar.emitir_movil(r.movil_id);
  end if;
  perform rodar.accion(u, 'Repartidores', 'Usuario #' || r.usuario_id, 'Repartidor ' || nuevo);
  return jsonb_build_object('ok', true, 'estado', nuevo); end $$;

grant execute on function public.r_rep_registro(text, jsonb, jsonb), public.r_rep_login(text, jsonb, jsonb), public.r_rep_salir(text, jsonb, jsonb), public.r_rep_inicio(text, jsonb, jsonb),
  public.r_rep_perfil(text, jsonb, jsonb), public.r_rep_lista(text, jsonb, jsonb), public.r_rep_resolver(text, jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
