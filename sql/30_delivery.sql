-- ===================== Delivery (clon del módulo Delivery de CabGo) =====================
-- Negocios, categorías, menú, pedidos, envíos express y directos, comisiones, saldos de comercios,
-- portal de comercios y pedido web de clientes. Se puede volver a correr: no borra datos.

-- ---------- tablas ----------
create table if not exists rodar.dlv_categorias (
  id bigserial primary key, nombre text not null, descripcion text, icono text, orden int default 0,
  demo boolean default false, creado timestamp default now());

create table if not exists rodar.dlv_negocios (
  id bigserial primary key, nombre text not null, telefono text, email text, categoria_id bigint references rodar.dlv_categorias(id) on delete set null,
  direccion text, localidad text, lat double precision, lng double precision,
  cuit text, banco text, cuenta text, tipo_cuenta text, cedula_rep text,
  estado text not null default 'activo', descripcion text, logo text, portada text,
  horario jsonb, radio_km numeric, pedido_minimo numeric, tiempo_prep int default 20, retiro_local boolean default true,
  comision_pct numeric, comision_rep_pct numeric, calendario_pago text default 'ninguno',
  servicios_negocio jsonb, servicios_cliente jsonb, orden int default 0, destacado boolean default false,
  cambio_pendiente jsonb, demo boolean default false, creado timestamp default now());

create table if not exists rodar.dlv_negocio_usuarios (
  id bigserial primary key, negocio_id bigint not null references rodar.dlv_negocios(id) on delete cascade,
  nombre text, email text not null, telefono text, rol text default 'propietario', password_hash text,
  habilitado boolean default true, creado timestamp default now());
create unique index if not exists dlv_negocio_usuarios_email on rodar.dlv_negocio_usuarios(lower(email));

create table if not exists rodar.dlv_sesiones (
  token text primary key, usuario_id bigint references rodar.dlv_negocio_usuarios(id) on delete cascade,
  inicio timestamp default now(), ultimo timestamp, activa boolean default true);

create table if not exists rodar.dlv_menu_categorias (
  id bigserial primary key, negocio_id bigint not null references rodar.dlv_negocios(id) on delete cascade,
  nombre text not null, orden int default 0);

create table if not exists rodar.dlv_productos (
  id bigserial primary key, negocio_id bigint not null references rodar.dlv_negocios(id) on delete cascade,
  menu_cat_id bigint references rodar.dlv_menu_categorias(id) on delete set null,
  nombre text not null, descripcion text, precio numeric not null default 0, precio_promo numeric, imagen text,
  disponible boolean default true, orden int default 0,
  aprobado boolean default true, cambio jsonb, creado timestamp default now());

create table if not exists rodar.dlv_pedidos (
  id bigserial primary key, codigo text unique, negocio_id bigint references rodar.dlv_negocios(id) on delete set null,
  tipo text not null default 'app',              -- app | express | directo
  tipo_entrega text default 'entrega',          -- entrega | retiro
  cobro text default 'entregar_cobrar',         -- solo_entrega | entregar_cobrar (express)
  cliente_id bigint, cliente_nombre text, cliente_tel text,
  recogida_dir text, recogida_lat double precision, recogida_lng double precision,
  entrega_dir text, entrega_ref text, entrega_lat double precision, entrega_lng double precision,
  items jsonb default '[]', subtotal numeric default 0, envio numeric default 0, service_fee numeric default 0,
  propina numeric default 0, descuento numeric default 0, saldo_usado numeric default 0, total numeric default 0,
  paga_con numeric, medio_pago text default 'efectivo', pagado boolean default false, comprobante text,
  metros numeric, minutos numeric, tiempo_recoleccion int,
  estado text not null default 'pendiente', viaje_id bigint, movil_id bigint, conductor_id bigint,
  codigo_recoleccion text, codigo_entrega text, codigo_devolucion text, devolucion_pendiente boolean default false,
  comision_negocio numeric default 0, comision_repartidor numeric default 0, recompensa numeric default 0, cashback numeric default 0,
  efectivo_recibido boolean default false, motivo_cancelacion text, cancelado_por text, notas text,
  buscando_desde timestamp, avisado boolean default false, historial jsonb default '[]',
  creado timestamp default now(), confirmado_at timestamp, listo_at timestamp, recogido_at timestamp,
  entregado_at timestamp, cancelado_at timestamp, demo boolean default false);
create index if not exists dlv_pedidos_estado on rodar.dlv_pedidos(estado);
create index if not exists dlv_pedidos_viaje on rodar.dlv_pedidos(viaje_id);
create index if not exists dlv_pedidos_negocio on rodar.dlv_pedidos(negocio_id, creado desc);

create table if not exists rodar.dlv_movimientos (
  id bigserial primary key, negocio_id bigint not null references rodar.dlv_negocios(id) on delete cascade,
  fecha timestamp default now(), tipo text, monto numeric not null, pedido_id bigint, detalle text, usuario text);

create table if not exists rodar.dlv_billetera (
  cliente_id bigint primary key, saldo numeric not null default 0, actualizado timestamp default now());

-- ---------- configuración ----------
create or replace function rodar.dlv_cfg_def() returns jsonb language sql immutable as $$ select '{
 "modo_catalogo":"marketplace","negocio_marca_id":null,
 "comision_negocio":10,"comision_repartidor":10,"recompensa_prepay":0,"cashback":0,"pagar_con_saldo":false,"comision_express":false,
 "tarifa_base":800,"tarifa_km":400,"tarifa_min":0,"tarifa_minima":0,
 "b2b_fija":null,"b2b_sin_fee":false,
 "directo_activo":false,"directo_texto":"","directo_por_distancia":false,"directo_base":800,"directo_km":400,"directo_minima":0,"directo_fija":null,"directo_sin_fee":false,
 "fee_modo":"porcentaje","fee_valor":0,"fee_base":"productos","peajes":false,"tarifa_zona":false,
 "propina_tipo":"porcentaje","propina_opciones":[5,10,15],
 "radio_km":5,"aviso_sin_tomar":0,"cancelar_sin_repartidor":null,"minimo_tramos":[],
 "retiro_local":true,"aprob_negocio":false,"aprob_menu":false,"pagos_comercios":false,"carga_masiva":true,"solicitar_repartidor":true,
 "chat_soporte":true,"zonas_busqueda":false,
 "aprobar_transferencias":false,"aviso_comprobante":false,"foto_recoleccion":false,"foto_entrega":false,"codigo_recoleccion":true,
 "comercio_efectivo":false,"comercio_seguimiento":false,"comanda_desglose":false,"devolucion_codigo":false,"gps_recoger":false,
 "codigo_cliente":false,"imagenes_completas":false,
 "cancel_cliente_antes":true,"cancel_cliente_despues":false,"cancel_repartidor":false,"cancel_comercio":false,"cancel_solo_admin":true,
 "cancel_motivo":true,"cancel_reembolso":false,"cancel_recogido":"nadie","adeudo_recogido":false,"cobrar_al_aceptar":false,
 "comercio_login":true,"reversa_tarjeta":false,
 "servicios_negocio":["entrega"],"servicios_cliente":["entrega"],"remision_recarga":false
}'::jsonb $$;
create or replace function rodar.dlv_cfg() returns jsonb language sql stable as $$
  select rodar.dlv_cfg_def() || coalesce(rodar.cfg('delivery'), '{}'::jsonb) $$;
create or replace function rodar.dlv_num(c jsonb, k text, def numeric default 0) returns numeric language sql immutable as $$
  select coalesce(rodar.n(c, k), def) $$;

-- ---------- utilidades ----------
create or replace function rodar.dlv_codigo() returns text language sql volatile as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)) $$;
create or replace function rodar.dlv_pin() returns text language sql volatile as $$
  select (1000 + floor(random() * 9000))::int::text $$;
create or replace function rodar.dlv_saldo(p_negocio bigint) returns numeric language sql stable as $$
  select coalesce(sum(monto), 0) from rodar.dlv_movimientos where negocio_id = p_negocio $$;
create or replace function rodar.dlv_hist(p_id bigint, p_texto text) returns void language sql as $$
  update rodar.dlv_pedidos set historial = coalesce(historial, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('fecha', rodar.ahora(), 'texto', p_texto)) where id = p_id $$;
-- horario {"1":["09:00","23:00"], ...} (0 = domingo). Sin horario = siempre abierto.
create or replace function rodar.dlv_abierto(h jsonb) returns boolean language plpgsql stable as $$
declare d text := extract(dow from rodar.ahora())::int::text; r jsonb; ahora time := rodar.ahora()::time;
begin
  if h is null or h = '{}'::jsonb then return true; end if;
  r := h -> d;
  if r is null or jsonb_typeof(r) <> 'array' or jsonb_array_length(r) < 2 then return false; end if;
  if (r->>0)::time <= (r->>1)::time then return ahora between (r->>0)::time and (r->>1)::time; end if;
  return ahora >= (r->>0)::time or ahora <= (r->>1)::time; -- pasa la medianoche
end $$;

-- costo de envío: base + km + minutos con piso. p_tipo: app | express | directo
create or replace function rodar.dlv_envio(p_metros numeric, p_minutos numeric, p_tipo text) returns numeric language plpgsql stable as $$
declare c jsonb := rodar.dlv_cfg(); km numeric := greatest(0, coalesce(p_metros, 0)) / 1000; v numeric;
begin
  if p_tipo = 'express' and rodar.n(c, 'b2b_fija') is not null then
    v := rodar.n(c, 'b2b_fija');
  elsif p_tipo = 'directo' then
    if rodar.b(c, 'directo_por_distancia') then
      v := rodar.dlv_num(c, 'directo_base') + rodar.dlv_num(c, 'directo_km') * km;
      return round(greatest(v, rodar.dlv_num(c, 'directo_minima')));
    elsif rodar.n(c, 'directo_fija') is not null then v := rodar.n(c, 'directo_fija');
    else v := rodar.dlv_num(c, 'tarifa_base') + rodar.dlv_num(c, 'tarifa_km') * km + rodar.dlv_num(c, 'tarifa_min') * coalesce(p_minutos, 0);
    end if;
  else
    v := rodar.dlv_num(c, 'tarifa_base') + rodar.dlv_num(c, 'tarifa_km') * km + rodar.dlv_num(c, 'tarifa_min') * coalesce(p_minutos, 0);
  end if;
  return round(greatest(v, rodar.dlv_num(c, 'tarifa_minima')));
end $$;

create or replace function rodar.dlv_fee(p_subtotal numeric, p_envio numeric, p_tipo text) returns numeric language plpgsql stable as $$
declare c jsonb := rodar.dlv_cfg(); base numeric;
begin
  if (p_tipo = 'express' and rodar.b(c, 'b2b_sin_fee')) or (p_tipo = 'directo' and rodar.b(c, 'directo_sin_fee')) then return 0; end if;
  if c->>'fee_modo' = 'fijo' then return round(rodar.dlv_num(c, 'fee_valor')); end if;
  base := coalesce(p_subtotal, 0) + case when c->>'fee_base' = 'productos_envio' then coalesce(p_envio, 0) else 0 end;
  return round(base * rodar.dlv_num(c, 'fee_valor') / 100);
end $$;

-- pedido mínimo por distancia (tramos [{"desde_km":0,"minimo":0}, ...]); rige el mayor entre tramo y negocio
create or replace function rodar.dlv_minimo(p_negocio rodar.dlv_negocios, p_metros numeric) returns numeric language plpgsql stable as $$
declare c jsonb := rodar.dlv_cfg(); t jsonb; m numeric := 0; km numeric := coalesce(p_metros, 0) / 1000;
begin
  for t in select * from jsonb_array_elements(coalesce(c->'minimo_tramos', '[]'::jsonb)) order by (value->>'desde_km')::numeric loop
    if (t->>'desde_km')::numeric <= km then m := coalesce((t->>'minimo')::numeric, 0); end if;
  end loop;
  return greatest(m, coalesce(p_negocio.pedido_minimo, 0));
end $$;

-- distancia estimada por calles cuando el navegador no mandó la ruta (línea recta × 1,3)
create or replace function rodar.dlv_metros(a float8, b float8, c float8, d float8) returns numeric language sql immutable as $$
  select round((coalesce(rodar.dist(a, b, c, d), 0) * 1.3)::numeric) $$;

-- arma ítems desde la base (precio real, sólo productos disponibles y aprobados del negocio)
create or replace function rodar.dlv_items(p_negocio bigint, p_items jsonb) returns jsonb language plpgsql stable as $$
declare it jsonb; p rodar.dlv_productos; out jsonb := '[]'; q int; pr numeric;
begin
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    q := greatest(1, coalesce((it->>'cantidad')::int, 1));
    if it->>'producto_id' is not null then
      select * into p from rodar.dlv_productos where id = (it->>'producto_id')::bigint and negocio_id = p_negocio;
      if not found then raise exception 'Un producto del pedido ya no existe'; end if;
      if not p.disponible or not p.aprobado then raise exception '"%" no está disponible', p.nombre; end if;
      pr := coalesce(nullif(p.precio_promo, 0), p.precio);
      out := out || jsonb_build_array(jsonb_build_object('producto_id', p.id, 'nombre', p.nombre, 'precio', pr, 'cantidad', q, 'notas', it->>'notas', 'subtotal', pr * q));
    else -- ítem libre (pedido cargado a mano)
      pr := coalesce((it->>'precio')::numeric, 0);
      out := out || jsonb_build_array(jsonb_build_object('nombre', coalesce(it->>'nombre', 'Ítem'), 'precio', pr, 'cantidad', q, 'notas', it->>'notas', 'subtotal', pr * q));
    end if;
  end loop;
  return out;
end $$;

-- ---------- cotización ----------
-- d: negocio_id, items, entrega_lat/lng, recogida_lat/lng (directo), metros, minutos, tipo, tipo_entrega, propina, propina_pct, monto (express)
create or replace function rodar.dlv_cotizar(d jsonb) returns jsonb language plpgsql stable as $$
declare c jsonb := rodar.dlv_cfg(); n rodar.dlv_negocios; tipo text := coalesce(rodar.t(d, 'tipo'), 'app'); te text := coalesce(rodar.t(d, 'tipo_entrega'), 'entrega');
  items jsonb := '[]'; sub numeric := 0; env numeric := 0; fee numeric := 0; pro numeric := 0; met numeric := rodar.n(d, 'metros'); mins numeric := rodar.n(d, 'minutos');
  olat float8; olng float8; dlat float8 := (d->>'entrega_lat')::float8; dlng float8 := (d->>'entrega_lng')::float8; minimo numeric := 0; radio numeric; avisos jsonb := '[]';
begin
  if tipo <> 'directo' then
    select * into n from rodar.dlv_negocios where id = rodar.n(d, 'negocio_id');
    if not found then raise exception 'Elegí un negocio'; end if;
    olat := n.lat; olng := n.lng;
  else
    olat := (d->>'recogida_lat')::float8; olng := (d->>'recogida_lng')::float8;
  end if;
  if tipo = 'app' then
    items := rodar.dlv_items(n.id, d->'items');
    select coalesce(sum((x->>'subtotal')::numeric), 0) into sub from jsonb_array_elements(items) x;
  elsif tipo = 'express' then sub := coalesce(rodar.n(d, 'monto'), 0);
  end if;
  if te = 'entrega' then
    if met is null and olat is not null and dlat is not null then met := rodar.dlv_metros(olat, olng, dlat, dlng); end if;
    if mins is null and met is not null then mins := round(met / 1000 * 2.4); end if;
    env := rodar.dlv_envio(met, mins, tipo);
    if tipo = 'app' then
      radio := coalesce(n.radio_km, rodar.n(c, 'radio_km'));
      if radio is not null and radio > 0 and met is not null and met / 1.3 > radio * 1000 then
        avisos := avisos || to_jsonb('La dirección está fuera del radio de entrega del negocio (' || radio || ' km)'); end if;
      minimo := rodar.dlv_minimo(n, met);
    end if;
  elsif tipo = 'app' then minimo := coalesce(n.pedido_minimo, 0);
  end if;
  if tipo <> 'express' then fee := rodar.dlv_fee(sub, env, tipo); end if;
  pro := coalesce(rodar.n(d, 'propina'), round(sub * coalesce(rodar.n(d, 'propina_pct'), 0) / 100), 0);
  if tipo = 'app' and minimo > 0 and sub < minimo then avisos := avisos || to_jsonb('El pedido mínimo es $' || minimo); end if;
  return jsonb_build_object('items', items, 'subtotal', sub, 'envio', env, 'service_fee', fee, 'propina', pro,
    'total', sub + env + fee + pro, 'metros', met, 'minutos', mins, 'minimo', minimo, 'avisos', avisos);
end $$;

-- ---------- creación de pedidos ----------
-- d: además de lo de cotizar: cliente_nombre, cliente_tel, entrega_dir, entrega_ref, recogida_dir, notas, medio_pago, paga_con,
--    cobro (express), tiempo_recoleccion, envio_manual, cliente_id, usar_saldo
create or replace function rodar.dlv_crear(d jsonb, p_origen text) returns rodar.dlv_pedidos language plpgsql as $$
declare c jsonb := rodar.dlv_cfg(); q jsonb := rodar.dlv_cotizar(d); n rodar.dlv_negocios; p rodar.dlv_pedidos; tipo text := coalesce(rodar.t(d, 'tipo'), 'app');
  env numeric := coalesce(rodar.n(d, 'envio_manual'), (q->>'envio')::numeric); cod text; v_saldo numeric := 0; usar numeric := 0; tot numeric; cli bigint := rodar.n(d, 'cliente_id');
begin
  if tipo = 'app' and jsonb_array_length(q->'avisos') > 0 then raise exception '%', q->'avisos'->>0; end if;
  if tipo = 'app' and jsonb_array_length(q->'items') = 0 then raise exception 'El pedido no tiene productos'; end if;
  if rodar.t(d, 'tipo_entrega') is distinct from 'retiro' and rodar.t(d, 'entrega_dir') is null then raise exception 'Ingresá la dirección de entrega'; end if;
  if tipo <> 'directo' then
    select * into n from rodar.dlv_negocios where id = rodar.n(d, 'negocio_id');
    if n.estado <> 'activo' and p_origen = 'cliente' then raise exception 'El negocio no está recibiendo pedidos'; end if;
    if p_origen = 'cliente' and not rodar.dlv_abierto(n.horario) then raise exception 'El negocio está cerrado en este momento'; end if;
  end if;
  tot := (q->>'subtotal')::numeric + env + (q->>'service_fee')::numeric + (q->>'propina')::numeric;
  if cli is not null and rodar.b(d, 'usar_saldo') and rodar.b(c, 'pagar_con_saldo') then
    select coalesce(saldo, 0) into v_saldo from rodar.dlv_billetera where cliente_id = cli;
    usar := least(coalesce(v_saldo, 0), tot);
    if usar > 0 then update rodar.dlv_billetera set saldo = saldo - usar, actualizado = rodar.ahora() where cliente_id = cli; end if;
  end if;
  loop cod := rodar.dlv_codigo(); exit when not exists (select 1 from rodar.dlv_pedidos where codigo = cod); end loop;
  insert into rodar.dlv_pedidos(codigo, negocio_id, tipo, tipo_entrega, cobro, cliente_id, cliente_nombre, cliente_tel,
    recogida_dir, recogida_lat, recogida_lng, entrega_dir, entrega_ref, entrega_lat, entrega_lng,
    items, subtotal, envio, service_fee, propina, saldo_usado, total, paga_con, medio_pago, metros, minutos, tiempo_recoleccion,
    estado, codigo_recoleccion, codigo_entrega, notas, creado, confirmado_at)
  values (cod, n.id, tipo, coalesce(rodar.t(d, 'tipo_entrega'), 'entrega'), coalesce(rodar.t(d, 'cobro'), 'entregar_cobrar'), cli,
    rodar.t(d, 'cliente_nombre'), rodar.t(d, 'cliente_tel'),
    coalesce(rodar.t(d, 'recogida_dir'), n.direccion), coalesce((d->>'recogida_lat')::float8, n.lat), coalesce((d->>'recogida_lng')::float8, n.lng),
    rodar.t(d, 'entrega_dir'), rodar.t(d, 'entrega_ref'), (d->>'entrega_lat')::float8, (d->>'entrega_lng')::float8,
    q->'items', (q->>'subtotal')::numeric, env, (q->>'service_fee')::numeric, (q->>'propina')::numeric, usar, tot - usar,
    rodar.n(d, 'paga_con'), coalesce(rodar.t(d, 'medio_pago'), 'efectivo'), (q->>'metros')::numeric, (q->>'minutos')::numeric,
    coalesce(rodar.n(d, 'tiempo_recoleccion')::int, n.tiempo_prep),
    case when tipo = 'app' then 'pendiente' else 'confirmado' end,
    case when rodar.b(c, 'codigo_recoleccion') then rodar.dlv_pin() end, case when rodar.b(c, 'codigo_cliente') then rodar.dlv_pin() end,
    rodar.t(d, 'notas'), rodar.ahora(), case when tipo <> 'app' then rodar.ahora() end)
  returning * into p;
  perform rodar.dlv_hist(p.id, 'Pedido creado (' || p_origen || ')');
  -- express y directos piden repartidor enseguida
  if tipo in ('express', 'directo') and p.tipo_entrega = 'entrega' then perform rodar.dlv_pedir_repartidor(p.id); end if;
  perform rodar.emit('panel', 'dlv_pedido', jsonb_build_object('id', p.id, 'estado', p.estado));
  if tipo = 'app' then perform rodar.emit('panel', 'aviso', jsonb_build_object('texto', 'Nuevo pedido de delivery #' || p.codigo || coalesce(' · ' || n.nombre, ''))); end if;
  select * into p from rodar.dlv_pedidos where id = p.id;
  return p;
end $$;

-- ---------- repartidor: el pedido se despacha como un viaje de la central ----------
create or replace function rodar.dlv_pedir_repartidor(p_id bigint) returns void language plpgsql as $$
declare p rodar.dlv_pedidos; n rodar.dlv_negocios; ids bigint[]; nulo rodar.usuarios; cobrar numeric; txt text;
begin
  select * into p from rodar.dlv_pedidos where id = p_id for update;
  if p.tipo_entrega = 'retiro' then raise exception 'El pedido es para retirar en el local'; end if;
  if p.viaje_id is not null and exists (select 1 from rodar.viajes where id = p.viaje_id and estado not in ('anulado', 'finalizado')) then return; end if;
  select * into n from rodar.dlv_negocios where id = p.negocio_id;
  cobrar := case when p.tipo = 'express' and p.cobro = 'solo_entrega' then 0
                 when p.pagado or p.medio_pago in ('tarjeta', 'billetera', 'transferencia', 'b2b', 'vale') then 0 else p.total end;
  txt := 'DELIVERY #' || p.codigo || coalesce(' · ' || n.nombre, '') ||
         case when cobrar > 0 then ' · COBRAR $' || round(cobrar) else ' · YA PAGADO' end ||
         coalesce(' · Paga con $' || round(p.paga_con), '') ||
         coalesce(' · Cód. retiro ' || p.codigo_recoleccion, '') ||
         coalesce(' · Entregar a ' || p.cliente_nombre, '') || coalesce(' (' || p.cliente_tel || ')', '') || coalesce(' · ' || p.entrega_ref, '') || coalesce(' · ' || p.notas, '');
  ids := rodar.crear_viaje(jsonb_build_object(
    'canal', 'web', 'origen_tipo', 'delivery', 'telefono', null, 'alias', coalesce(n.nombre, 'Envío directo'),
    'origen_dir', p.recogida_dir, 'origen_lat', p.recogida_lat, 'origen_lng', p.recogida_lng,
    'destino_dir', p.entrega_dir, 'destino_lat', p.entrega_lat, 'destino_lng', p.entrega_lng, 'destino_ref', p.entrega_ref,
    'datos_movil', txt, 'monto_fijo', p.envio, 'medio_pago', 'efectivo', 'pin_requerido', false), nulo);
  update rodar.dlv_pedidos set viaje_id = ids[1], buscando_desde = rodar.ahora(), avisado = false where id = p_id;
  perform rodar.dlv_hist(p_id, 'Buscando repartidor (viaje #' || ids[1] || ')');
  begin perform rodar.procesar(); exception when others then null; end;
end $$;

-- ---------- liquidación al entregar ----------
create or replace function rodar.dlv_liquidar(p_id bigint) returns void language plpgsql as $$
declare c jsonb := rodar.dlv_cfg(); p rodar.dlv_pedidos; n rodar.dlv_negocios; pct numeric; com numeric := 0; rep numeric := 0; cb numeric := 0; neto numeric;
begin
  select * into p from rodar.dlv_pedidos where id = p_id;
  if p.negocio_id is not null then
    select * into n from rodar.dlv_negocios where id = p.negocio_id;
    pct := coalesce(n.comision_pct, rodar.dlv_num(c, 'comision_negocio'));
    if p.tipo = 'app' or (p.tipo = 'express' and rodar.b(c, 'comision_express')) then com := round(p.subtotal * pct / 100); end if;
    if p.tipo = 'express' and p.cobro = 'solo_entrega' then
      neto := -(p.envio + com); -- el comercio cobró al cliente: adeuda el envío (y la comisión si corresponde)
    else
      neto := p.subtotal - com;  -- el repartidor/plataforma cobró: se le debe el subtotal menos la comisión
    end if;
    insert into rodar.dlv_movimientos(negocio_id, fecha, tipo, monto, pedido_id, detalle)
    values (n.id, rodar.ahora(), 'pedido', neto, p.id, 'Pedido #' || p.codigo || case when com > 0 then ' (comisión $' || com || ')' else '' end);
  end if;
  rep := round(p.envio * coalesce(n.comision_rep_pct, rodar.dlv_num(c, 'comision_repartidor')) / 100);
  if p.cliente_id is not null and rodar.dlv_num(c, 'cashback') > 0 and p.subtotal > 0 then
    cb := round(p.subtotal * rodar.dlv_num(c, 'cashback') / 100);
    insert into rodar.dlv_billetera(cliente_id, saldo) values (p.cliente_id, cb)
    on conflict (cliente_id) do update set saldo = rodar.dlv_billetera.saldo + excluded.saldo, actualizado = rodar.ahora();
  end if;
  update rodar.dlv_pedidos set comision_negocio = com, comision_repartidor = rep, cashback = cb where id = p_id;
end $$;

-- cambio de estado central (todas las pantallas pasan por acá)
create or replace function rodar.dlv_estado(p_id bigint, p_estado text, p_quien text, p_motivo text default null) returns void language plpgsql as $$
declare p rodar.dlv_pedidos; c jsonb := rodar.dlv_cfg();
begin
  select * into p from rodar.dlv_pedidos where id = p_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if p.estado in ('entregado', 'cancelado') and p_estado <> p.estado then raise exception 'El pedido ya está %', p.estado; end if;
  if p_estado = 'cancelado' then
    if rodar.b(c, 'cancel_motivo') and p_motivo is null and p_quien <> 'sistema' then raise exception 'Indicá el motivo de la cancelación'; end if;
    if p.saldo_usado > 0 and p.cliente_id is not null then
      update rodar.dlv_billetera set saldo = saldo + p.saldo_usado where cliente_id = p.cliente_id;
    end if;
    update rodar.dlv_pedidos set estado = 'cancelado', cancelado_at = rodar.ahora(), motivo_cancelacion = p_motivo, cancelado_por = p_quien,
      devolucion_pendiente = (p.recogido_at is not null and rodar.b(c, 'devolucion_codigo')),
      codigo_devolucion = case when p.recogido_at is not null and rodar.b(c, 'devolucion_codigo') then rodar.dlv_pin() end
    where id = p_id;
    if p.viaje_id is not null then -- después de marcar cancelado, para que el disparador del viaje no lo toque
      update rodar.viajes set estado = 'anulado', anulado_at = rodar.ahora(), motivo_anulacion = 'Pedido de delivery cancelado'
      where id = p.viaje_id and estado in ('pendiente', 'ofrecido', 'confirmado', 'reserva');
    end if;
  else
    update rodar.dlv_pedidos set estado = p_estado,
      confirmado_at = case when p_estado = 'confirmado' then coalesce(confirmado_at, rodar.ahora()) else confirmado_at end,
      listo_at = case when p_estado = 'listo' then rodar.ahora() else listo_at end,
      recogido_at = case when p_estado in ('recogido', 'en_camino') then coalesce(recogido_at, rodar.ahora()) else recogido_at end,
      entregado_at = case when p_estado = 'entregado' then rodar.ahora() else entregado_at end,
      motivo_cancelacion = case when p_estado = 'cancelacion_solicitada' then p_motivo else motivo_cancelacion end
    where id = p_id;
    if p_estado = 'entregado' then perform rodar.dlv_liquidar(p_id); end if;
  end if;
  perform rodar.dlv_hist(p_id, initcap(replace(p_estado, '_', ' ')) || ' · ' || p_quien || coalesce(' · ' || p_motivo, ''));
  perform rodar.emit('panel', 'dlv_pedido', jsonb_build_object('id', p_id, 'estado', p_estado));
  perform rodar.emit('dlv-' || p_id, 'estado', jsonb_build_object('id', p_id, 'estado', p_estado));
end $$;

-- el viaje del repartidor mueve el pedido
create or replace function rodar.dlv_trg_viaje() returns trigger language plpgsql as $$
declare p rodar.dlv_pedidos;
begin
  if new.estado is not distinct from old.estado and new.movil_id is not distinct from old.movil_id then return new; end if;
  select * into p from rodar.dlv_pedidos where viaje_id = new.id;
  if not found or p.estado in ('entregado', 'cancelado') then return new; end if;
  if new.movil_id is not null and new.movil_id is distinct from p.movil_id then
    update rodar.dlv_pedidos set movil_id = new.movil_id, conductor_id = new.conductor_id where id = p.id;
    perform rodar.dlv_hist(p.id, 'Repartidor asignado: móvil ' || coalesce((select numero::text from rodar.moviles where id = new.movil_id), '?'));
  end if;
  if new.estado = 'en_curso' and old.estado is distinct from 'en_curso' then perform rodar.dlv_estado(p.id, 'en_camino', 'repartidor');
  elsif new.estado = 'finalizado' then perform rodar.dlv_estado(p.id, 'entregado', 'repartidor');
  elsif new.estado = 'anulado' then
    update rodar.dlv_pedidos set viaje_id = null, movil_id = null, conductor_id = null, buscando_desde = null where id = p.id;
    perform rodar.dlv_hist(p.id, 'El viaje del repartidor se anuló; el pedido quedó sin repartidor');
  end if;
  return new;
end $$;
create or replace trigger dlv_viaje after update on rodar.viajes for each row execute function rodar.dlv_trg_viaje();

-- ciclo: avisa pedidos sin tomar y cancela los que superan el tiempo (pg_cron cada 30 s y al consultar)
create or replace function rodar.dlv_ciclo() returns void language plpgsql as $$
declare c jsonb := rodar.dlv_cfg(); r record; av numeric := rodar.n(c, 'aviso_sin_tomar'); ca numeric := rodar.n(c, 'cancelar_sin_repartidor');
begin
  for r in select p.* from rodar.dlv_pedidos p left join rodar.viajes v on v.id = p.viaje_id
    where p.estado not in ('entregado', 'cancelado') and p.buscando_desde is not null and (v.id is null or v.estado in ('pendiente', 'ofrecido')) loop
    if ca > 0 and r.buscando_desde < rodar.ahora() - make_interval(mins => ca::int) and not r.pagado and r.medio_pago = 'efectivo' then
      perform rodar.dlv_estado(r.id, 'cancelado', 'sistema', 'Ningún repartidor tomó el pedido');
    elsif av > 0 and not r.avisado and r.buscando_desde < rodar.ahora() - make_interval(mins => av::int) then
      update rodar.dlv_pedidos set avisado = true where id = r.id;
      perform rodar.emit('panel', 'aviso', jsonb_build_object('texto', 'Pedido #' || r.codigo || ': ningún repartidor lo tomó todavía'));
    end if;
  end loop;
end $$;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'rodar-delivery';
    perform cron.schedule('rodar-delivery', '30 seconds', 'select rodar.dlv_ciclo()');
  end if;
exception when others then null; end $$;

-- ---------- vistas jsonb ----------
create or replace function rodar.dlv_negocio_json(n rodar.dlv_negocios) returns jsonb language sql stable as $$
  select to_jsonb(n) - 'cambio_pendiente' || jsonb_build_object(
    'categoria', (select nombre from rodar.dlv_categorias where id = n.categoria_id),
    'saldo', rodar.dlv_saldo(n.id), 'abierto', rodar.dlv_abierto(n.horario),
    'pedidos', (select count(*) from rodar.dlv_pedidos where negocio_id = n.id),
    'productos', (select count(*) from rodar.dlv_productos where negocio_id = n.id),
    'tiene_cambio', n.cambio_pendiente is not null) $$;

create or replace function rodar.dlv_pedido_json(p rodar.dlv_pedidos) returns jsonb language sql stable as $$
  select to_jsonb(p) || jsonb_build_object(
    'negocio', (select nombre from rodar.dlv_negocios where id = p.negocio_id),
    'negocio_tel', (select telefono from rodar.dlv_negocios where id = p.negocio_id),
    'movil_numero', (select numero from rodar.moviles where id = p.movil_id),
    'movil_lat', (select lat from rodar.moviles where id = p.movil_id), 'movil_lng', (select lng from rodar.moviles where id = p.movil_id),
    'conductor', (select trim(nombre || ' ' || coalesce(apellido, '')) from rodar.usuarios where id = p.conductor_id),
    'viaje_estado', (select estado from rodar.viajes where id = p.viaje_id), 'k', rodar.firma(p.id)) $$;

-- =================== API administración (panel) ===================
create or replace function public.r_dlv_config(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin', 'gestion', 'operador');
  return jsonb_build_object('config', rodar.dlv_cfg(), 'negocios', rodar.lista('select id, nombre from rodar.dlv_negocios order by nombre'),
    'pendientes_menu', (select count(*) from rodar.dlv_productos where not aprobado or cambio is not null),
    'pendientes_negocio', (select count(*) from rodar.dlv_negocios where cambio_pendiente is not null)); end $$;

create or replace function public.r_dlv_config_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); k text; limpio jsonb := '{}';
begin
  for k in select jsonb_object_keys(rodar.dlv_cfg_def()) loop if p_b ? k then limpio := limpio || jsonb_build_object(k, p_b->k); end if; end loop;
  perform rodar.cfg_set('delivery', coalesce(rodar.cfg('delivery'), '{}'::jsonb) || limpio);
  perform rodar.accion(u, 'Delivery', 'Configuración', 'Guardó la configuración de delivery');
  return jsonb_build_object('ok', true, 'config', rodar.dlv_cfg()); end $$;

create or replace function public.r_dlv_categorias(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.usuario(p_token);
  return rodar.lista('select c.*, (select count(*) from rodar.dlv_negocios n where n.categoria_id = c.id) negocios from rodar.dlv_categorias c order by orden, nombre'); end $$;

create or replace function public.r_dlv_categoria_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); nid bigint;
begin
  if rodar.t(p_b, 'nombre') is null then raise exception 'Ingresá el nombre de la categoría'; end if;
  if rodar.n(p_b, 'id') is not null then
    update rodar.dlv_categorias set nombre = rodar.t(p_b, 'nombre'), descripcion = rodar.t(p_b, 'descripcion'),
      icono = case when p_b ? 'icono' then rodar.t(p_b, 'icono') else icono end, orden = coalesce(rodar.n(p_b, 'orden')::int, orden) where id = rodar.n(p_b, 'id') returning id into nid;
  else
    insert into rodar.dlv_categorias(nombre, descripcion, icono, orden) values (rodar.t(p_b, 'nombre'), rodar.t(p_b, 'descripcion'), rodar.t(p_b, 'icono'), coalesce(rodar.n(p_b, 'orden')::int, 0)) returning id into nid;
  end if;
  perform rodar.accion(u, 'Delivery', 'Categoría ' || rodar.t(p_b, 'nombre'), 'Guardó la categoría');
  return jsonb_build_object('ok', true, 'id', nid); end $$;

create or replace function public.r_dlv_categoria_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); delete from rodar.dlv_categorias where id = (p_q->>'id')::bigint; return '{"ok":true}'; end $$;

create or replace function public.r_dlv_negocios(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare f text := '%' || coalesce(rodar.t(p_q, 'buscar'), '') || '%'; r jsonb; tot int; sf text := rodar.t(p_q, 'saldo');
  off int := coalesce(rodar.n(p_q, 'offset'), 0)::int; lim int := coalesce(rodar.n(p_q, 'limite'), 1000)::int;
begin perform rodar.need(p_token, 'admin', 'gestion', 'operador');
  select count(*), coalesce(jsonb_agg(j order by orden, nombre) filter (where rn > off and rn <= off + lim), '[]') into tot, r
  from (select x.*, row_number() over (order by orden, nombre) rn from (
      select n.orden, n.nombre, rodar.dlv_negocio_json(n) - 'horario' j, rodar.dlv_saldo(n.id) sal from rodar.dlv_negocios n
      where (rodar.t(p_q, 'estado') is null or n.estado = rodar.t(p_q, 'estado'))
        and (n.nombre ilike f or coalesce(n.email, '') ilike f or coalesce(n.telefono, '') ilike f)
        and (rodar.t(p_q, 'categoria') is null or n.categoria_id = rodar.n(p_q, 'categoria'))) x
    where sf is null or (sf = 'positivo' and sal > 0) or (sf = 'negativo' and sal < 0) or (sf = 'cero' and sal = 0)) y;
  return jsonb_build_object('filas', r, 'total', tot,
    'demo', exists (select 1 from rodar.dlv_negocios where demo), 'hay', exists (select 1 from rodar.dlv_negocios)); end $$;

create or replace function public.r_dlv_negocio(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare n rodar.dlv_negocios; id_ bigint := (p_q->>'id')::bigint;
begin perform rodar.need(p_token, 'admin', 'gestion', 'operador');
  select * into n from rodar.dlv_negocios where id = id_; if not found then raise exception 'Negocio no encontrado'; end if;
  return rodar.dlv_negocio_json(n) || jsonb_build_object('cambio_pendiente', n.cambio_pendiente,
    'usuarios', rodar.lista('select id, nombre, email, telefono, rol, habilitado, creado from rodar.dlv_negocio_usuarios where negocio_id = ' || id_ || ' order by id'),
    'menu', rodar.lista('select * from rodar.dlv_menu_categorias where negocio_id = ' || id_ || ' order by orden, nombre'),
    'items', rodar.lista('select * from rodar.dlv_productos where negocio_id = ' || id_ || ' order by orden, nombre'),
    'movimientos', rodar.lista('select * from rodar.dlv_movimientos where negocio_id = ' || id_ || ' order by fecha desc limit 200'),
    'stats', (select jsonb_build_object('pedidos', count(*), 'entregados', count(*) filter (where estado = 'entregado'),
       'cancelados', count(*) filter (where estado = 'cancelado'), 'ventas', coalesce(sum(subtotal) filter (where estado = 'entregado'), 0),
       'comisiones', coalesce(sum(comision_negocio) filter (where estado = 'entregado'), 0)) from rodar.dlv_pedidos where negocio_id = id_)); end $$;

create or replace function public.r_dlv_negocio_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); c jsonb := rodar.dlv_cfg(); nid bigint := rodar.n(p_b, 'id'); x rodar.dlv_negocios;
begin
  if rodar.t(p_b, 'nombre') is null then raise exception 'Ingresá el nombre del negocio'; end if;
  if nid is null then
    if rodar.t(p_b, 'telefono') is null then raise exception 'Ingresá el teléfono'; end if;
    if rodar.t(p_b, 'email') is null then raise exception 'Ingresá el email'; end if;
    insert into rodar.dlv_negocios(nombre, telefono, email, retiro_local, servicios_negocio, servicios_cliente, estado)
    values (rodar.t(p_b, 'nombre'), rodar.t(p_b, 'telefono'), rodar.t(p_b, 'email'), rodar.b(c, 'retiro_local'), c->'servicios_negocio', c->'servicios_cliente', 'activo') returning id into nid;
    perform rodar.accion(u, 'Delivery', 'Negocio ' || rodar.t(p_b, 'nombre'), 'Creó el negocio');
  end if;
  select * into x from rodar.dlv_negocios where id = nid;
  update rodar.dlv_negocios set
    nombre = rodar.t(p_b, 'nombre'), telefono = coalesce(rodar.t(p_b, 'telefono'), telefono), email = coalesce(rodar.t(p_b, 'email'), email),
    categoria_id = case when p_b ? 'categoria_id' then rodar.n(p_b, 'categoria_id')::bigint else categoria_id end,
    direccion = case when p_b ? 'direccion' then rodar.t(p_b, 'direccion') else direccion end,
    localidad = case when p_b ? 'localidad' then rodar.t(p_b, 'localidad') else localidad end,
    lat = case when p_b ? 'lat' then (p_b->>'lat')::float8 else lat end, lng = case when p_b ? 'lng' then (p_b->>'lng')::float8 else lng end,
    cuit = case when p_b ? 'cuit' then rodar.t(p_b, 'cuit') else cuit end, banco = case when p_b ? 'banco' then rodar.t(p_b, 'banco') else banco end,
    cuenta = case when p_b ? 'cuenta' then rodar.t(p_b, 'cuenta') else cuenta end, tipo_cuenta = case when p_b ? 'tipo_cuenta' then rodar.t(p_b, 'tipo_cuenta') else tipo_cuenta end,
    cedula_rep = case when p_b ? 'cedula_rep' then rodar.t(p_b, 'cedula_rep') else cedula_rep end,
    descripcion = case when p_b ? 'descripcion' then rodar.t(p_b, 'descripcion') else descripcion end,
    logo = case when p_b ? 'logo' then rodar.t(p_b, 'logo') else logo end, portada = case when p_b ? 'portada' then rodar.t(p_b, 'portada') else portada end,
    horario = case when p_b ? 'horario' then nullif(p_b->'horario', 'null'::jsonb) else horario end,
    radio_km = case when p_b ? 'radio_km' then rodar.n(p_b, 'radio_km') else radio_km end,
    pedido_minimo = case when p_b ? 'pedido_minimo' then rodar.n(p_b, 'pedido_minimo') else pedido_minimo end,
    tiempo_prep = case when p_b ? 'tiempo_prep' then coalesce(rodar.n(p_b, 'tiempo_prep')::int, 20) else tiempo_prep end,
    retiro_local = case when p_b ? 'retiro_local' then rodar.b(p_b, 'retiro_local') else retiro_local end,
    comision_pct = case when p_b ? 'comision_pct' then rodar.n(p_b, 'comision_pct') else comision_pct end,
    comision_rep_pct = case when p_b ? 'comision_rep_pct' then rodar.n(p_b, 'comision_rep_pct') else comision_rep_pct end,
    calendario_pago = case when p_b ? 'calendario_pago' then coalesce(rodar.t(p_b, 'calendario_pago'), 'ninguno') else calendario_pago end,
    servicios_negocio = case when p_b ? 'servicios_negocio' then p_b->'servicios_negocio' else servicios_negocio end,
    servicios_cliente = case when p_b ? 'servicios_cliente' then p_b->'servicios_cliente' else servicios_cliente end,
    destacado = case when p_b ? 'destacado' then rodar.b(p_b, 'destacado') else destacado end,
    orden = case when p_b ? 'orden' then coalesce(rodar.n(p_b, 'orden')::int, 0) else orden end
  where id = nid;
  return jsonb_build_object('ok', true, 'id', nid); end $$;

create or replace function public.r_dlv_negocio_estado(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); n rodar.dlv_negocios;
begin
  if rodar.t(p_b, 'estado') not in ('pendiente', 'activo', 'suspendido', 'cerrado') then raise exception 'Estado inválido'; end if;
  update rodar.dlv_negocios set estado = rodar.t(p_b, 'estado') where id = rodar.n(p_b, 'id') returning * into n;
  perform rodar.accion(u, 'Delivery', 'Negocio ' || n.nombre, 'Cambió el estado a ' || n.estado);
  return '{"ok":true}'; end $$;

create or replace function public.r_dlv_negocio_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); n rodar.dlv_negocios;
begin
  select * into n from rodar.dlv_negocios where id = (p_q->>'id')::bigint;
  if exists (select 1 from rodar.dlv_pedidos where negocio_id = n.id and estado not in ('entregado', 'cancelado')) then raise exception 'El negocio tiene pedidos en curso'; end if;
  delete from rodar.dlv_negocios where id = n.id;
  perform rodar.accion(u, 'Delivery', 'Negocio ' || n.nombre, 'Eliminó el negocio');
  return '{"ok":true}'; end $$;

-- aprobar / rechazar cambios de perfil pedidos por el comercio
create or replace function public.r_dlv_negocio_cambio(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); n rodar.dlv_negocios;
begin
  select * into n from rodar.dlv_negocios where id = rodar.n(p_b, 'id');
  if n.cambio_pendiente is null then raise exception 'No hay cambios pendientes'; end if;
  if rodar.b(p_b, 'aprobar') then perform public.r_dlv_negocio_guardar(p_token, '{}', n.cambio_pendiente || jsonb_build_object('id', n.id, 'nombre', coalesce(n.cambio_pendiente->>'nombre', n.nombre))); end if;
  update rodar.dlv_negocios set cambio_pendiente = null where id = n.id;
  return '{"ok":true}'; end $$;

create or replace function public.r_dlv_negocios_importar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); f jsonb; cat bigint; nuevos int := 0; act int := 0; nid bigint;
begin
  for f in select * from jsonb_array_elements(coalesce(p_b->'filas', '[]'::jsonb)) loop
    if rodar.t(f, 'nombre') is null then continue; end if;
    cat := null;
    if rodar.t(f, 'categoria') is not null then
      select id into cat from rodar.dlv_categorias where lower(nombre) = lower(rodar.t(f, 'categoria'));
      if cat is null then insert into rodar.dlv_categorias(nombre) values (rodar.t(f, 'categoria')) returning id into cat; end if;
    end if;
    select id into nid from rodar.dlv_negocios where lower(nombre) = lower(rodar.t(f, 'nombre')) limit 1;
    if nid is null then
      insert into rodar.dlv_negocios(nombre, estado) values (rodar.t(f, 'nombre'), coalesce(rodar.t(f, 'estado'), 'activo')) returning id into nid; nuevos := nuevos + 1;
    else act := act + 1; end if;
    update rodar.dlv_negocios set telefono = coalesce(rodar.t(f, 'telefono'), telefono), email = coalesce(rodar.t(f, 'email'), email),
      direccion = coalesce(rodar.t(f, 'direccion'), direccion), localidad = coalesce(rodar.t(f, 'localidad'), localidad),
      lat = coalesce((nullif(f->>'lat', ''))::float8, lat), lng = coalesce((nullif(f->>'lng', ''))::float8, lng),
      cuit = coalesce(rodar.t(f, 'cuit'), cuit), categoria_id = coalesce(cat, categoria_id),
      pedido_minimo = coalesce(rodar.n(f, 'pedido_minimo'), pedido_minimo), comision_pct = coalesce(rodar.n(f, 'comision_pct'), comision_pct)
    where id = nid;
  end loop;
  perform rodar.accion(u, 'Delivery', 'Importación', nuevos || ' negocios nuevos, ' || act || ' actualizados');
  return jsonb_build_object('nuevos', nuevos, 'actualizados', act); end $$;

create or replace function public.r_dlv_usuario_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); nid bigint := rodar.n(p_b, 'id');
begin
  if rodar.t(p_b, 'email') is null then raise exception 'Ingresá el email'; end if;
  begin
    if nid is null then
      if rodar.t(p_b, 'password') is null then raise exception 'Ingresá una contraseña para el portal del comercio'; end if;
      insert into rodar.dlv_negocio_usuarios(negocio_id, nombre, email, telefono, rol, password_hash, habilitado)
      values (rodar.n(p_b, 'negocio_id'), rodar.t(p_b, 'nombre'), lower(rodar.t(p_b, 'email')), rodar.t(p_b, 'telefono'), coalesce(rodar.t(p_b, 'rol'), 'propietario'), rodar.hash(rodar.t(p_b, 'password')), true) returning id into nid;
    else
      update rodar.dlv_negocio_usuarios set nombre = rodar.t(p_b, 'nombre'), email = lower(rodar.t(p_b, 'email')), telefono = rodar.t(p_b, 'telefono'),
        rol = coalesce(rodar.t(p_b, 'rol'), rol), habilitado = case when p_b ? 'habilitado' then rodar.b(p_b, 'habilitado') else habilitado end,
        password_hash = case when rodar.t(p_b, 'password') is not null then rodar.hash(rodar.t(p_b, 'password')) else password_hash end where id = nid;
    end if;
  exception when unique_violation then raise exception 'Ya existe un usuario de comercio con ese email'; end;
  return jsonb_build_object('ok', true, 'id', nid); end $$;

create or replace function public.r_dlv_usuario_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); delete from rodar.dlv_negocio_usuarios where id = (p_q->>'id')::bigint; return '{"ok":true}'; end $$;

create or replace function public.r_dlv_menucat_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare nid bigint := rodar.n(p_b, 'id');
begin perform rodar.need(p_token, 'admin');
  if rodar.t(p_b, 'nombre') is null then raise exception 'Ingresá el nombre'; end if;
  if nid is null then insert into rodar.dlv_menu_categorias(negocio_id, nombre, orden) values (rodar.n(p_b, 'negocio_id'), rodar.t(p_b, 'nombre'), coalesce(rodar.n(p_b, 'orden')::int, 0)) returning id into nid;
  else update rodar.dlv_menu_categorias set nombre = rodar.t(p_b, 'nombre'), orden = coalesce(rodar.n(p_b, 'orden')::int, orden) where id = nid; end if;
  return jsonb_build_object('ok', true, 'id', nid); end $$;

create or replace function public.r_dlv_menucat_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); delete from rodar.dlv_menu_categorias where id = (p_q->>'id')::bigint; return '{"ok":true}'; end $$;

create or replace function rodar.dlv_producto_set(p_b jsonb, p_directo boolean) returns bigint language plpgsql as $$
declare nid bigint := rodar.n(p_b, 'id'); campos jsonb;
begin
  if rodar.t(p_b, 'nombre') is null then raise exception 'Ingresá el nombre del producto'; end if;
  campos := jsonb_build_object('nombre', rodar.t(p_b, 'nombre'), 'descripcion', rodar.t(p_b, 'descripcion'), 'precio', coalesce(rodar.n(p_b, 'precio'), 0),
    'precio_promo', rodar.n(p_b, 'precio_promo'), 'menu_cat_id', rodar.n(p_b, 'menu_cat_id'), 'disponible', case when p_b ? 'disponible' then rodar.b(p_b, 'disponible') else true end,
    'orden', coalesce(rodar.n(p_b, 'orden'), 0)) || case when p_b ? 'imagen' then jsonb_build_object('imagen', rodar.t(p_b, 'imagen')) else '{}' end;
  if nid is null then
    insert into rodar.dlv_productos(negocio_id, nombre, precio, aprobado) values (rodar.n(p_b, 'negocio_id'), campos->>'nombre', (campos->>'precio')::numeric, p_directo) returning id into nid;
    p_directo := true; -- un producto nuevo se carga entero y queda sin aprobar hasta que el admin lo revise
  elsif not p_directo then
    update rodar.dlv_productos set cambio = campos where id = nid; return nid;
  end if;
  update rodar.dlv_productos set nombre = campos->>'nombre', descripcion = campos->>'descripcion', precio = (campos->>'precio')::numeric,
    precio_promo = (campos->>'precio_promo')::numeric, menu_cat_id = (campos->>'menu_cat_id')::bigint, disponible = (campos->>'disponible')::boolean,
    orden = (campos->>'orden')::int, imagen = case when campos ? 'imagen' then campos->>'imagen' else imagen end where id = nid;
  return nid;
end $$;

create or replace function public.r_dlv_producto_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); return jsonb_build_object('ok', true, 'id', rodar.dlv_producto_set(p_b, true)); end $$;

create or replace function public.r_dlv_producto_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); delete from rodar.dlv_productos where id = (p_q->>'id')::bigint; return '{"ok":true}'; end $$;

-- productos importados en bloque (Excel/CSV) para un negocio
create or replace function public.r_dlv_productos_importar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare f jsonb; neg bigint := rodar.n(p_b, 'negocio_id'); mc bigint; k int := 0;
begin perform rodar.need(p_token, 'admin');
  for f in select * from jsonb_array_elements(coalesce(p_b->'filas', '[]'::jsonb)) loop
    if rodar.t(f, 'nombre') is null then continue; end if;
    mc := null;
    if rodar.t(f, 'categoria') is not null then
      select id into mc from rodar.dlv_menu_categorias where negocio_id = neg and lower(nombre) = lower(rodar.t(f, 'categoria'));
      if mc is null then insert into rodar.dlv_menu_categorias(negocio_id, nombre) values (neg, rodar.t(f, 'categoria')) returning id into mc; end if;
    end if;
    insert into rodar.dlv_productos(negocio_id, menu_cat_id, nombre, descripcion, precio, precio_promo)
    values (neg, mc, rodar.t(f, 'nombre'), rodar.t(f, 'descripcion'), coalesce(rodar.n(f, 'precio'), 0), rodar.n(f, 'precio_promo'));
    k := k + 1;
  end loop;
  return jsonb_build_object('importados', k); end $$;

create or replace function public.r_dlv_cambios(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin');
  return jsonb_build_object(
    'productos', rodar.lista('select p.id, p.negocio_id, n.nombre negocio, p.nombre, p.precio, p.descripcion, p.imagen, p.aprobado, p.cambio, p.creado from rodar.dlv_productos p join rodar.dlv_negocios n on n.id = p.negocio_id where not p.aprobado or p.cambio is not null order by p.creado'),
    'negocios', rodar.lista('select id, nombre, cambio_pendiente from rodar.dlv_negocios where cambio_pendiente is not null order by nombre')); end $$;

create or replace function public.r_dlv_cambio_resolver(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); p rodar.dlv_productos; ok boolean := rodar.b(p_b, 'aprobar');
begin
  select * into p from rodar.dlv_productos where id = rodar.n(p_b, 'id');
  if p.cambio is not null and p.cambio ? 'borrar' then
    if ok then delete from rodar.dlv_productos where id = p.id; else update rodar.dlv_productos set cambio = null where id = p.id; end if;
  elsif p.cambio is not null then
    if ok then perform rodar.dlv_producto_set(p.cambio || jsonb_build_object('id', p.id), true); end if;
    update rodar.dlv_productos set cambio = null where id = p.id;
  elsif not p.aprobado then
    if ok then update rodar.dlv_productos set aprobado = true where id = p.id; else delete from rodar.dlv_productos where id = p.id; end if;
  end if;
  perform rodar.accion(u, 'Delivery', 'Producto ' || p.nombre, case when ok then 'Aprobó' else 'Rechazó' end || ' un cambio de menú');
  return '{"ok":true}'; end $$;

create or replace function public.r_dlv_movimiento(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin', 'gestion'); m numeric := rodar.n(p_b, 'monto'); tipo text := coalesce(rodar.t(p_b, 'tipo'), 'ajuste');
begin
  if m is null or m = 0 then raise exception 'Ingresá un monto'; end if;
  if tipo = 'pago' then m := -abs(m); end if; -- pago al comercio: baja lo que se le debe
  insert into rodar.dlv_movimientos(negocio_id, fecha, tipo, monto, detalle, usuario) values (rodar.n(p_b, 'negocio_id'), rodar.ahora(), tipo, m, rodar.t(p_b, 'detalle'), rodar.nombre(u));
  perform rodar.accion(u, 'Delivery', 'Negocio #' || rodar.n(p_b, 'negocio_id'), initcap(tipo) || ' de saldo $' || m);
  return jsonb_build_object('ok', true, 'saldo', rodar.dlv_saldo(rodar.n(p_b, 'negocio_id')::bigint)); end $$;

create or replace function public.r_dlv_pagos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin', 'gestion');
  return rodar.lista('select n.id, n.nombre, n.calendario_pago, n.banco, n.cuenta, n.tipo_cuenta, n.cuit, rodar.dlv_saldo(n.id) saldo,
    (select max(fecha) from rodar.dlv_movimientos m where m.negocio_id = n.id and m.tipo = ''pago'') ultimo_pago
    from rodar.dlv_negocios n order by rodar.dlv_saldo(n.id) desc, n.nombre'); end $$;

create or replace function public.r_dlv_pedidos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare r jsonb; tot int; b text := '%' || coalesce(rodar.t(p_q, 'buscar'), '') || '%';
begin perform rodar.need(p_token, 'admin', 'gestion', 'operador');
  perform rodar.dlv_ciclo();
  select count(*), coalesce(jsonb_agg(rodar.dlv_pedido_json(x.p) - 'historial' order by (x.p).creado desc) filter (where rn > coalesce(rodar.n(p_q, 'offset'), 0) and rn <= coalesce(rodar.n(p_q, 'offset'), 0) + coalesce(rodar.n(p_q, 'limite'), 25)), '[]')
  into tot, r from (select p, row_number() over (order by p.creado desc) rn from rodar.dlv_pedidos p
    where (rodar.t(p_q, 'estado') is null or p.estado = rodar.t(p_q, 'estado'))
      and (rodar.t(p_q, 'negocio') is null or p.negocio_id = rodar.n(p_q, 'negocio'))
      and (rodar.t(p_q, 'medio') is null or p.medio_pago = rodar.t(p_q, 'medio'))
      and (rodar.t(p_q, 'tipo') is null or p.tipo = rodar.t(p_q, 'tipo'))
      and (rodar.t(p_q, 'desde') is null or p.creado::date >= (p_q->>'desde')::date)
      and (rodar.t(p_q, 'hasta') is null or p.creado::date <= (p_q->>'hasta')::date)
      and (p.codigo ilike b or coalesce(p.cliente_nombre, '') ilike b or coalesce(p.cliente_tel, '') ilike b)) x;
  return jsonb_build_object('filas', r, 'total', tot,
    'activos', (select count(*) from rodar.dlv_pedidos where estado not in ('entregado', 'cancelado')),
    'hoy', (select jsonb_build_object('pedidos', count(*), 'entregados', count(*) filter (where estado = 'entregado'), 'ventas', coalesce(sum(total) filter (where estado = 'entregado'), 0))
            from rodar.dlv_pedidos where creado::date = rodar.hoy())); end $$;

create or replace function public.r_dlv_pedido(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare p rodar.dlv_pedidos;
begin perform rodar.need(p_token, 'admin', 'gestion', 'operador');
  select * into p from rodar.dlv_pedidos where id = (p_q->>'id')::bigint; if not found then raise exception 'Pedido no encontrado'; end if;
  return rodar.dlv_pedido_json(p); end $$;

create or replace function public.r_dlv_cotizar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin', 'operador'); return rodar.dlv_cotizar(p_b); end $$;

create or replace function public.r_dlv_pedido_crear(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin', 'operador'); p rodar.dlv_pedidos;
begin
  p := rodar.dlv_crear(p_b || jsonb_build_object('tipo', coalesce(rodar.t(p_b, 'tipo'), 'express')), 'panel · ' || rodar.nombre(u));
  perform rodar.accion(u, 'Delivery', 'Pedido #' || p.codigo, 'Creó un pedido ' || p.tipo);
  return rodar.dlv_pedido_json(p); end $$;

-- acciones del panel sobre un pedido
create or replace function public.r_dlv_pedido_accion(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin', 'operador'); p rodar.dlv_pedidos; a text := rodar.t(p_b, 'accion'); quien text := 'panel · ' || rodar.nombre(u);
begin
  select * into p from rodar.dlv_pedidos where id = rodar.n(p_b, 'id'); if not found then raise exception 'Pedido no encontrado'; end if;
  if a in ('confirmado', 'preparando', 'listo', 'recogido', 'en_camino', 'entregado', 'cancelado') then
    perform rodar.dlv_estado(p.id, a, quien, rodar.t(p_b, 'motivo'));
    if a = 'listo' and p.tipo_entrega = 'entrega' and p.viaje_id is null and rodar.b(p_b, 'con_repartidor') then perform rodar.dlv_pedir_repartidor(p.id); end if;
  elsif a = 'repartidor' then perform rodar.dlv_pedir_repartidor(p.id);
  elsif a = 'quitar_repartidor' then
    update rodar.viajes set estado = 'anulado', anulado_at = rodar.ahora(), motivo_anulacion = 'Repartidor quitado desde delivery' where id = p.viaje_id and estado not in ('finalizado', 'anulado');
  elsif a = 'efectivo' then
    update rodar.dlv_pedidos set efectivo_recibido = not efectivo_recibido where id = p.id;
    perform rodar.dlv_hist(p.id, case when p.efectivo_recibido then 'Efectivo recibido revertido' else 'Efectivo recibido' end || ' · ' || quien);
  elsif a = 'pagado' then
    update rodar.dlv_pedidos set pagado = not pagado where id = p.id; perform rodar.dlv_hist(p.id, 'Pago ' || case when p.pagado then 'desmarcado' else 'aprobado' end || ' · ' || quien);
  elsif a = 'devuelto' then
    update rodar.dlv_pedidos set devolucion_pendiente = false where id = p.id; perform rodar.dlv_hist(p.id, 'Mercadería devuelta · ' || quien);
  else raise exception 'Acción desconocida'; end if;
  select * into p from rodar.dlv_pedidos where id = p.id;
  return rodar.dlv_pedido_json(p); end $$;

-- contenido de demo
create or replace function public.r_dlv_demo(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); e jsonb := rodar.cfg('empresa'); la float8 := coalesce((e->>'lat')::float8, -30.9465); ln float8 := coalesce((e->>'lng')::float8, -58.7834);
  c1 bigint; c2 bigint; c3 bigint; n1 bigint; n2 bigint; n3 bigint; m bigint;
begin
  if rodar.t(p_b, 'accion') = 'borrar' then
    delete from rodar.dlv_pedidos where demo or negocio_id in (select id from rodar.dlv_negocios where demo);
    delete from rodar.dlv_negocios where demo; delete from rodar.dlv_categorias where demo;
    return '{"ok":true}';
  end if;
  if exists (select 1 from rodar.dlv_negocios where demo) then raise exception 'El contenido de demo ya está cargado'; end if;
  insert into rodar.dlv_categorias(nombre, descripcion, orden, demo) values ('Restaurantes', 'Comida casera, minutas y parrilla', 1, true) returning id into c1;
  insert into rodar.dlv_categorias(nombre, descripcion, orden, demo) values ('Pizzerías', 'Pizzas, empanadas y calzones', 2, true) returning id into c2;
  insert into rodar.dlv_categorias(nombre, descripcion, orden, demo) values ('Farmacias y kioscos', 'Lo que necesitás, rápido', 3, true) returning id into c3;
  insert into rodar.dlv_negocios(nombre, telefono, email, categoria_id, direccion, lat, lng, estado, descripcion, tiempo_prep, pedido_minimo, demo)
    values ('La Esquina (demo)', '3454000001', 'esquina@demo.com', c1, 'San Martín 100', la + .002, ln + .001, 'activo', 'Minutas, milanesas y platos del día', 25, 3000, true) returning id into n1;
  insert into rodar.dlv_negocios(nombre, telefono, email, categoria_id, direccion, lat, lng, estado, descripcion, tiempo_prep, demo)
    values ('Pizzería Don Toto (demo)', '3454000002', 'toto@demo.com', c2, 'Urquiza 250', la - .003, ln + .002, 'activo', 'Pizzas a la piedra y empanadas', 30, true) returning id into n2;
  insert into rodar.dlv_negocios(nombre, telefono, email, categoria_id, direccion, lat, lng, estado, descripcion, tiempo_prep, demo)
    values ('Kiosco 24 (demo)', '3454000003', 'kiosco@demo.com', c3, 'Belgrano 80', la + .001, ln - .003, 'activo', 'Bebidas, golosinas y almacén', 10, true) returning id into n3;
  insert into rodar.dlv_menu_categorias(negocio_id, nombre, orden) values (n1, 'Platos', 1) returning id into m;
  insert into rodar.dlv_productos(negocio_id, menu_cat_id, nombre, descripcion, precio, orden) values
    (n1, m, 'Milanesa con papas fritas', 'Milanesa de carne con guarnición', 7500, 1), (n1, m, 'Suprema napolitana', 'Con jamón, queso y salsa', 8200, 2), (n1, m, 'Hamburguesa completa', 'Con lechuga, tomate, huevo y papas', 6900, 3);
  insert into rodar.dlv_menu_categorias(negocio_id, nombre, orden) values (n1, 'Bebidas', 2) returning id into m;
  insert into rodar.dlv_productos(negocio_id, menu_cat_id, nombre, precio) values (n1, m, 'Gaseosa 1,5 L', 2500), (n1, m, 'Agua saborizada', 1800);
  insert into rodar.dlv_menu_categorias(negocio_id, nombre, orden) values (n2, 'Pizzas', 1) returning id into m;
  insert into rodar.dlv_productos(negocio_id, menu_cat_id, nombre, descripcion, precio, precio_promo) values
    (n2, m, 'Muzzarella', 'Grande, 8 porciones', 7000, null), (n2, m, 'Especial', 'Jamón, morrones y huevo', 8500, 7900), (n2, m, 'Fugazzeta', 'Cebolla y mucho queso', 8000, null);
  insert into rodar.dlv_menu_categorias(negocio_id, nombre, orden) values (n2, 'Empanadas', 2) returning id into m;
  insert into rodar.dlv_productos(negocio_id, menu_cat_id, nombre, precio) values (n2, m, 'Docena de empanadas', 9600), (n2, m, 'Media docena', 5000);
  insert into rodar.dlv_menu_categorias(negocio_id, nombre, orden) values (n3, 'Almacén', 1) returning id into m;
  insert into rodar.dlv_productos(negocio_id, menu_cat_id, nombre, precio) values (n3, m, 'Cerveza 1 L', 2800), (n3, m, 'Alfajor triple', 900), (n3, m, 'Hielo 2 kg', 1500), (n3, m, 'Papas fritas 150 g', 1900);
  perform rodar.accion(u, 'Delivery', 'Demo', 'Cargó contenido de demo');
  return '{"ok":true}'; end $$;

-- =================== API pública (pedido web del cliente) ===================
create or replace function rodar.dlv_cliente_opc(p_token text) returns rodar.clientes language plpgsql as $$
declare c rodar.clientes;
begin
  if p_token is null then return null; end if;
  begin c := rodar.cliente_sesion(p_token); exception when others then return null; end;
  return c;
end $$;

create or replace function public.r_dlv_pub_inicio(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c jsonb := rodar.dlv_cfg(); cli rodar.clientes := rodar.dlv_cliente_opc(p_token);
begin
  return jsonb_build_object(
    'config', jsonb_build_object('modo_catalogo', c->'modo_catalogo', 'negocio_marca_id', c->'negocio_marca_id', 'directo_activo', c->'directo_activo',
      'directo_texto', c->'directo_texto', 'directo_por_distancia', c->'directo_por_distancia', 'propina_tipo', c->'propina_tipo', 'propina_opciones', c->'propina_opciones',
      'imagenes_completas', c->'imagenes_completas', 'pagar_con_saldo', c->'pagar_con_saldo', 'codigo_cliente', c->'codigo_cliente',
      'cancel_cliente_antes', c->'cancel_cliente_antes', 'cancel_cliente_despues', c->'cancel_cliente_despues', 'cancel_motivo', c->'cancel_motivo'),
    'empresa', rodar.cfg('empresa'),
    'cliente', case when cli.id is not null then jsonb_build_object('id', cli.id, 'nombre', cli.alias, 'telefono', cli.telefono,
       'saldo', coalesce((select saldo from rodar.dlv_billetera where cliente_id = cli.id), 0)) end,
    'categorias', rodar.lista('select c.id, c.nombre, c.descripcion, c.icono from rodar.dlv_categorias c where exists (select 1 from rodar.dlv_negocios n where n.categoria_id = c.id and n.estado = ''activo'') order by orden, nombre'),
    'negocios', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'nombre', n.nombre, 'descripcion', n.descripcion, 'logo', n.logo, 'portada', n.portada,
        'categoria_id', n.categoria_id, 'direccion', n.direccion, 'lat', n.lat, 'lng', n.lng, 'tiempo_prep', n.tiempo_prep, 'pedido_minimo', n.pedido_minimo,
        'retiro_local', n.retiro_local, 'abierto', rodar.dlv_abierto(n.horario), 'destacado', n.destacado) order by rodar.dlv_abierto(n.horario) desc, n.destacado desc, n.orden, n.nombre), '[]')
      from rodar.dlv_negocios n where n.estado = 'activo')); end $$;

create or replace function public.r_dlv_pub_negocio(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare n rodar.dlv_negocios; id_ bigint := (p_q->>'id')::bigint;
begin
  select * into n from rodar.dlv_negocios where id = id_ and estado = 'activo'; if not found then raise exception 'Negocio no disponible'; end if;
  return jsonb_build_object('id', n.id, 'nombre', n.nombre, 'descripcion', n.descripcion, 'logo', n.logo, 'portada', n.portada, 'direccion', n.direccion,
    'telefono', n.telefono, 'lat', n.lat, 'lng', n.lng, 'tiempo_prep', n.tiempo_prep, 'pedido_minimo', n.pedido_minimo, 'retiro_local', n.retiro_local,
    'abierto', rodar.dlv_abierto(n.horario), 'horario', n.horario,
    'menu', rodar.lista('select id, nombre from rodar.dlv_menu_categorias where negocio_id = ' || id_ || ' order by orden, nombre'),
    'productos', rodar.lista('select id, menu_cat_id, nombre, descripcion, precio, precio_promo, imagen from rodar.dlv_productos where negocio_id = ' || id_ || ' and disponible and aprobado order by orden, nombre')); end $$;

create or replace function public.r_dlv_pub_cotizar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c jsonb := rodar.dlv_cfg();
begin
  if rodar.t(p_b, 'tipo') = 'directo' and not rodar.b(c, 'directo_activo') then raise exception 'Los envíos directos no están habilitados'; end if;
  return rodar.dlv_cotizar(p_b || jsonb_build_object('tipo', coalesce(rodar.t(p_b, 'tipo'), 'app'))); end $$;

create or replace function public.r_dlv_pub_pedido(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c jsonb := rodar.dlv_cfg(); cli rodar.clientes := rodar.dlv_cliente_opc(p_token); p rodar.dlv_pedidos; tipo text := coalesce(rodar.t(p_b, 'tipo'), 'app'); d jsonb;
begin
  if tipo not in ('app', 'directo') then raise exception 'Tipo de pedido inválido'; end if;
  if tipo = 'directo' and not rodar.b(c, 'directo_activo') then raise exception 'Los envíos directos no están habilitados'; end if;
  if rodar.t(p_b, 'cliente_nombre') is null or rodar.t(p_b, 'cliente_tel') is null then raise exception 'Ingresá tu nombre y teléfono'; end if;
  if rodar.t(p_b, 'medio_pago') not in ('efectivo', 'transferencia') then raise exception 'Elegí efectivo o transferencia'; end if;
  d := (p_b - 'envio_manual' - 'cliente_id' - 'cobro') || jsonb_build_object('tipo', tipo, 'cliente_id', cli.id);
  if tipo = 'directo' and rodar.t(p_b, 'recogida_dir') is null then raise exception 'Ingresá dónde retirar el paquete'; end if;
  p := rodar.dlv_crear(d, 'cliente');
  return jsonb_build_object('id', p.id, 'k', rodar.firma(p.id), 'codigo', p.codigo); end $$;

create or replace function public.r_dlv_pub_seguir(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c jsonb := rodar.dlv_cfg(); p rodar.dlv_pedidos; j jsonb;
begin
  select * into p from rodar.dlv_pedidos where id = (p_q->>'id')::bigint;
  if not found or rodar.firma(p.id) <> coalesce(p_q->>'k', '') then raise exception 'Pedido no encontrado'; end if;
  j := rodar.dlv_pedido_json(p);
  return jsonb_build_object('id', p.id, 'codigo', p.codigo, 'estado', p.estado, 'tipo', p.tipo, 'tipo_entrega', p.tipo_entrega, 'negocio', j->'negocio', 'negocio_tel', j->'negocio_tel',
    'items', p.items, 'subtotal', p.subtotal, 'envio', p.envio, 'service_fee', p.service_fee, 'propina', p.propina, 'saldo_usado', p.saldo_usado, 'total', p.total,
    'medio_pago', p.medio_pago, 'entrega_dir', p.entrega_dir, 'recogida_dir', p.recogida_dir, 'creado', p.creado, 'historial', p.historial,
    'codigo_entrega', p.codigo_entrega, 'motivo_cancelacion', p.motivo_cancelacion,
    'entrega_lat', p.entrega_lat, 'entrega_lng', p.entrega_lng, 'recogida_lat', p.recogida_lat, 'recogida_lng', p.recogida_lng,
    'repartidor', case when p.movil_id is not null and p.estado not in ('entregado', 'cancelado') then jsonb_build_object('movil', j->'movil_numero', 'nombre', j->'conductor', 'lat', j->'movil_lat', 'lng', j->'movil_lng') end,
    'puede_cancelar', p.estado not in ('entregado', 'cancelado', 'cancelacion_solicitada', 'recogido', 'en_camino') and
       ((p.estado = 'pendiente' and rodar.b(c, 'cancel_cliente_antes')) or p.estado <> 'pendiente'),
    'cancela_directo', coalesce((p.estado = 'pendiente' and rodar.b(c, 'cancel_cliente_antes')) or (p.estado <> 'pendiente' and rodar.b(c, 'cancel_cliente_despues'))
      or (rodar.n(c, 'cancelar_sin_repartidor') > 0 and p.buscando_desde < rodar.ahora() - make_interval(mins => rodar.n(c, 'cancelar_sin_repartidor')::int) and p.movil_id is null), false)); end $$;

create or replace function public.r_dlv_pub_cancelar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare s jsonb := public.r_dlv_pub_seguir(p_token, p_q, p_b); id_ bigint := (p_q->>'id')::bigint;
begin
  if not (s->>'puede_cancelar')::boolean then raise exception 'Este pedido ya no se puede cancelar'; end if;
  if (s->>'cancela_directo')::boolean then perform rodar.dlv_estado(id_, 'cancelado', 'cliente', coalesce(rodar.t(p_b, 'motivo'), 'Cancelado por el cliente'));
  else perform rodar.dlv_estado(id_, 'cancelacion_solicitada', 'cliente', coalesce(rodar.t(p_b, 'motivo'), 'El cliente pidió cancelar')); end if;
  return '{"ok":true}'; end $$;

-- =================== API portal de comercios ===================
create or replace function rodar.dlv_comercio(p_token text) returns rodar.dlv_negocio_usuarios language plpgsql as $$
declare s rodar.dlv_sesiones; u rodar.dlv_negocio_usuarios;
begin
  select * into s from rodar.dlv_sesiones where token = p_token and activa; if not found then raise exception 'SESION_VENCIDA'; end if;
  select * into u from rodar.dlv_negocio_usuarios where id = s.usuario_id and habilitado; if not found then raise exception 'SESION_VENCIDA'; end if;
  update rodar.dlv_sesiones set ultimo = rodar.ahora() where token = p_token;
  return u;
end $$;

create or replace function public.r_dlv_com_login(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.dlv_negocio_usuarios; tk text;
begin
  if not rodar.b(rodar.dlv_cfg(), 'comercio_login') then raise exception 'El ingreso de comercios está deshabilitado'; end if;
  select * into u from rodar.dlv_negocio_usuarios where lower(email) = lower(rodar.t(p_b, 'email')) and habilitado;
  if not found or u.password_hash is null or not rodar.verificar(coalesce(rodar.t(p_b, 'password'), ''), u.password_hash) then raise exception 'El email o la contraseña no coinciden'; end if;
  tk := rodar.token(); insert into rodar.dlv_sesiones(token, usuario_id, ultimo) values (tk, u.id, rodar.ahora());
  return jsonb_build_object('token', tk); end $$;

create or replace function public.r_dlv_com_logout(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin update rodar.dlv_sesiones set activa = false where token = p_token; return '{"ok":true}'; end $$;

create or replace function public.r_dlv_com_inicio(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.dlv_negocio_usuarios := rodar.dlv_comercio(p_token); n rodar.dlv_negocios; c jsonb := rodar.dlv_cfg();
begin
  select * into n from rodar.dlv_negocios where id = u.negocio_id;
  return jsonb_build_object('usuario', jsonb_build_object('nombre', u.nombre, 'email', u.email, 'rol', u.rol),
    'negocio', rodar.dlv_negocio_json(n), 'cambio_pendiente', n.cambio_pendiente,
    'config', jsonb_build_object('solicitar_repartidor', c->'solicitar_repartidor', 'comercio_efectivo', c->'comercio_efectivo', 'comercio_seguimiento', c->'comercio_seguimiento',
       'cancel_comercio', c->'cancel_comercio', 'cancel_motivo', c->'cancel_motivo', 'aprob_menu', c->'aprob_menu', 'aprob_negocio', c->'aprob_negocio',
       'codigo_recoleccion', c->'codigo_recoleccion', 'comanda_desglose', c->'comanda_desglose', 'devolucion_codigo', c->'devolucion_codigo', 'carga_masiva', c->'carga_masiva'),
    'empresa', rodar.cfg('empresa'),
    'pedidos', (select coalesce(jsonb_agg(rodar.dlv_pedido_json(p) - 'historial' order by p.creado desc), '[]') from (select * from rodar.dlv_pedidos
       where negocio_id = n.id and (estado not in ('entregado', 'cancelado') or creado > rodar.ahora() - interval '2 days') order by creado desc limit 100) p),
    'menu', rodar.lista('select * from rodar.dlv_menu_categorias where negocio_id = ' || n.id || ' order by orden, nombre'),
    'productos', rodar.lista('select * from rodar.dlv_productos where negocio_id = ' || n.id || ' order by orden, nombre'),
    'movimientos', rodar.lista('select fecha, tipo, monto, detalle from rodar.dlv_movimientos where negocio_id = ' || n.id || ' order by fecha desc limit 50')); end $$;

create or replace function public.r_dlv_com_accion(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.dlv_negocio_usuarios := rodar.dlv_comercio(p_token); c jsonb := rodar.dlv_cfg(); p rodar.dlv_pedidos; a text := rodar.t(p_b, 'accion'); quien text := 'comercio · ' || coalesce(u.nombre, u.email);
begin
  select * into p from rodar.dlv_pedidos where id = rodar.n(p_b, 'id') and negocio_id = u.negocio_id; if not found then raise exception 'Pedido no encontrado'; end if;
  if a = 'aceptar' then perform rodar.dlv_estado(p.id, 'confirmado', quien);
  elsif a = 'rechazar' then perform rodar.dlv_estado(p.id, 'cancelado', quien, coalesce(rodar.t(p_b, 'motivo'), 'Rechazado por el comercio'));
  elsif a in ('preparando', 'listo') then
    if a = 'listo' and rodar.b(c, 'aprobar_transferencias') and p.medio_pago = 'transferencia' and not p.pagado then raise exception 'Falta aprobar el comprobante de la transferencia'; end if;
    perform rodar.dlv_estado(p.id, a, quien);
    if a = 'listo' and p.tipo_entrega = 'entrega' and p.viaje_id is null then perform rodar.dlv_pedir_repartidor(p.id); end if;
  elsif a = 'entregado' and p.tipo_entrega = 'retiro' then perform rodar.dlv_estado(p.id, 'entregado', quien);
  elsif a = 'cancelar' then
    if rodar.b(c, 'cancel_comercio') or p.estado in ('pendiente', 'confirmado') then perform rodar.dlv_estado(p.id, 'cancelado', quien, rodar.t(p_b, 'motivo'));
    else perform rodar.dlv_estado(p.id, 'cancelacion_solicitada', quien, rodar.t(p_b, 'motivo')); end if;
  elsif a = 'efectivo' then
    if not rodar.b(c, 'comercio_efectivo') then raise exception 'No habilitado'; end if;
    if p.efectivo_recibido then raise exception 'Ya figura como recibido'; end if;
    update rodar.dlv_pedidos set efectivo_recibido = true where id = p.id; perform rodar.dlv_hist(p.id, 'Efectivo recibido · ' || quien);
  elsif a = 'pagado' then
    update rodar.dlv_pedidos set pagado = true where id = p.id; perform rodar.dlv_hist(p.id, 'Transferencia aprobada · ' || quien);
  elsif a = 'devuelto' then
    if p.codigo_devolucion is not null and p.codigo_devolucion <> coalesce(rodar.t(p_b, 'codigo'), '') then raise exception 'El código de devolución no coincide'; end if;
    update rodar.dlv_pedidos set devolucion_pendiente = false where id = p.id; perform rodar.dlv_hist(p.id, 'Mercadería devuelta · ' || quien);
  else raise exception 'Acción desconocida'; end if;
  select * into p from rodar.dlv_pedidos where id = p.id;
  return rodar.dlv_pedido_json(p); end $$;

create or replace function public.r_dlv_com_express(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.dlv_negocio_usuarios := rodar.dlv_comercio(p_token); p rodar.dlv_pedidos;
begin
  if not rodar.b(rodar.dlv_cfg(), 'solicitar_repartidor') then raise exception 'Solicitar repartidor no está habilitado'; end if;
  if rodar.t(p_q, 'cotizar') is not null then return rodar.dlv_cotizar(p_b || jsonb_build_object('tipo', 'express', 'negocio_id', u.negocio_id)); end if;
  p := rodar.dlv_crear((p_b - 'envio_manual') || jsonb_build_object('tipo', 'express', 'negocio_id', u.negocio_id), 'comercio · ' || coalesce(u.nombre, u.email));
  return rodar.dlv_pedido_json(p); end $$;

create or replace function public.r_dlv_com_producto(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.dlv_negocio_usuarios := rodar.dlv_comercio(p_token); aprob boolean := rodar.b(rodar.dlv_cfg(), 'aprob_menu'); pid bigint := rodar.n(p_b, 'id');
begin
  if pid is not null and not exists (select 1 from rodar.dlv_productos where id = pid and negocio_id = u.negocio_id) then raise exception 'Producto no encontrado'; end if;
  if rodar.t(p_b, 'accion') = 'disponible' then -- la disponibilidad no requiere aprobación
    update rodar.dlv_productos set disponible = not disponible where id = pid; return '{"ok":true}';
  elsif rodar.t(p_b, 'accion') = 'borrar' then
    if aprob then update rodar.dlv_productos set cambio = '{"borrar":true}' where id = pid; else delete from rodar.dlv_productos where id = pid; end if;
    return jsonb_build_object('ok', true, 'pendiente', aprob);
  elsif rodar.t(p_b, 'accion') = 'categoria' then
    if rodar.n(p_b, 'cat_id') is null then insert into rodar.dlv_menu_categorias(negocio_id, nombre) values (u.negocio_id, rodar.t(p_b, 'nombre'));
    else update rodar.dlv_menu_categorias set nombre = rodar.t(p_b, 'nombre') where id = rodar.n(p_b, 'cat_id') and negocio_id = u.negocio_id; end if;
    return '{"ok":true}';
  end if;
  perform rodar.dlv_producto_set(p_b || jsonb_build_object('negocio_id', u.negocio_id), not aprob);
  return jsonb_build_object('ok', true, 'pendiente', aprob); end $$;

create or replace function public.r_dlv_com_perfil(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.dlv_negocio_usuarios := rodar.dlv_comercio(p_token); n rodar.dlv_negocios; d jsonb;
begin
  if rodar.t(p_b, 'password') is not null then
    if not rodar.verificar(coalesce(rodar.t(p_b, 'actual'), ''), u.password_hash) then raise exception 'La contraseña actual no coincide'; end if;
    update rodar.dlv_negocio_usuarios set password_hash = rodar.hash(rodar.t(p_b, 'password')) where id = u.id; return '{"ok":true}';
  end if;
  select * into n from rodar.dlv_negocios where id = u.negocio_id;
  d := jsonb_strip_nulls(jsonb_build_object('nombre', rodar.t(p_b, 'nombre'), 'telefono', rodar.t(p_b, 'telefono'), 'descripcion', rodar.t(p_b, 'descripcion'),
       'direccion', rodar.t(p_b, 'direccion'), 'tiempo_prep', rodar.n(p_b, 'tiempo_prep'), 'pedido_minimo', rodar.n(p_b, 'pedido_minimo'), 'logo', rodar.t(p_b, 'logo'),
       'horario', case when p_b ? 'horario' then p_b->'horario' end, 'retiro_local', case when p_b ? 'retiro_local' then p_b->'retiro_local' end));
  if rodar.b(rodar.dlv_cfg(), 'aprob_negocio') then update rodar.dlv_negocios set cambio_pendiente = d where id = n.id; return jsonb_build_object('ok', true, 'pendiente', true); end if;
  perform public.r_dlv_negocio_guardar_int(d || jsonb_build_object('id', n.id, 'nombre', coalesce(d->>'nombre', n.nombre)));
  return jsonb_build_object('ok', true, 'pendiente', false); end $$;

-- guardado interno (sin sesión de admin) usado por el portal del comercio
create or replace function public.r_dlv_negocio_guardar_int(p_b jsonb) returns void
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  update rodar.dlv_negocios set nombre = coalesce(rodar.t(p_b, 'nombre'), nombre), telefono = coalesce(rodar.t(p_b, 'telefono'), telefono),
    descripcion = coalesce(rodar.t(p_b, 'descripcion'), descripcion), direccion = coalesce(rodar.t(p_b, 'direccion'), direccion),
    tiempo_prep = coalesce(rodar.n(p_b, 'tiempo_prep')::int, tiempo_prep), pedido_minimo = coalesce(rodar.n(p_b, 'pedido_minimo'), pedido_minimo),
    logo = coalesce(rodar.t(p_b, 'logo'), logo), horario = case when p_b ? 'horario' then nullif(p_b->'horario', 'null'::jsonb) else horario end,
    retiro_local = case when p_b ? 'retiro_local' then rodar.b(p_b, 'retiro_local') else retiro_local end
  where id = rodar.n(p_b, 'id');
end $$;
revoke execute on function public.r_dlv_negocio_guardar_int(jsonb) from public, anon, authenticated;
-- los cambios aprobados por el admin también usan los campos del comercio
