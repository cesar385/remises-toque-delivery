-- ===================== Rubros (no solo comida) y vehículo requerido (moto / auto) =====================
-- 1) RUBROS: cada categoría de delivery tiene un TIPO: 'comida' (se "prepara") o 'productos' (farmacia, kiosco, ferretería, mercado,
--    mascotas, regalos...: se "arma"). El tipo cambia el vocabulario de los avisos y de las pantallas del cliente y del comercio.
--    Las categorías ya eran configurables (Delivery → Categorías): ahora también se elige el tipo y el vehículo por defecto.
-- 2) VEHÍCULO: el negocio indica si el repartidor tiene que ir en moto, en auto o en cualquiera. Orden de prioridad:
--    lo que elige el negocio para ese pedido  >  el vehículo por defecto del negocio  >  el de su rubro  >  cualquiera.
--    Cada móvil tiene un tipo de vehículo (auto por defecto) y solo se le ofrecen los pedidos que le corresponden (ver rodar.elegible).
-- Este archivo redefine (create or replace) funciones de 03_core, 58_delivery y 60_delivery_integrado: tiene que correr después de ellos.
-- Se puede volver a correr: no borra datos.

-- ---------- columnas ----------
alter table rodar.dlv_categorias add column if not exists tipo text default 'comida';        -- comida | productos
alter table rodar.dlv_categorias add column if not exists vehiculo_defecto text;             -- null (cualquiera) | moto | auto | cualquiera
alter table rodar.dlv_negocios   add column if not exists vehiculo_defecto text;             -- null = el de su rubro
alter table rodar.dlv_pedidos    add column if not exists vehiculo text;                     -- moto | auto | cualquiera (null = cualquiera)
alter table rodar.moviles        add column if not exists tipo_vehiculo text default 'auto'; -- auto | moto
alter table rodar.viajes         add column if not exists vehiculo_req text;                 -- null = cualquier móvil

-- ---------- vocabulario por tipo de rubro ----------
create or replace function rodar.dlv_vocab(p_tipo text) returns jsonb language sql immutable as $$
  select case when p_tipo = 'productos' then
    '{"tipo":"productos","prep":"Armando","prep_largo":"Armando tu pedido","prep_boton":"📦 Armando","prep_tiempo":"Tiempo de armado (min)","catalogo":"Catálogo","verbo":"armando"}'::jsonb
  else
    '{"tipo":"comida","prep":"Preparando","prep_largo":"En preparación","prep_boton":"🍳 Preparando","prep_tiempo":"Tiempo de preparación (min)","catalogo":"Menú","verbo":"preparando"}'::jsonb
  end $$;

create or replace function rodar.dlv_rubro_tipo(p_negocio bigint) returns text language sql stable as $$
  select coalesce((select c.tipo from rodar.dlv_negocios n join rodar.dlv_categorias c on c.id = n.categoria_id where n.id = p_negocio), 'comida') $$;

-- vehículo por defecto de un negocio: el suyo, si no el de su rubro, si no cualquiera
create or replace function rodar.dlv_vehiculo_neg(p_negocio bigint) returns text language sql stable as $$
  select coalesce((select coalesce(nullif(n.vehiculo_defecto, ''), nullif(c.vehiculo_defecto, ''))
                   from rodar.dlv_negocios n left join rodar.dlv_categorias c on c.id = n.categoria_id where n.id = p_negocio), 'cualquiera') $$;

-- cada pedido nuevo nace con el vehículo por defecto de su negocio (el negocio lo puede cambiar después)
create or replace function rodar.dlv_trg_vehiculo() returns trigger language plpgsql as $$
begin
  if new.vehiculo is null then new.vehiculo := rodar.dlv_vehiculo_neg(new.negocio_id); end if;
  return new;
end $$;
create or replace trigger dlv_vehiculo before insert on rodar.dlv_pedidos for each row execute function rodar.dlv_trg_vehiculo();


-- ---------- despacho: solo se le ofrece el viaje a móviles del vehículo pedido (copia de 03_core.sql + 1 línea) ----------

create or replace function rodar.elegible(m rodar.moviles, v rodar.viajes) returns boolean language plpgsql stable as $$
declare ec jsonb;
begin
  if not m.habilitado or m.estado not in ('disponible', 'en_parada') or m.conductor_id is null then return false; end if;
  -- delivery: el negocio puede exigir moto o auto (NULL = cualquiera)
  if v.vehiculo_req is not null and v.vehiculo_req <> coalesce(m.tipo_vehiculo, 'auto') then return false; end if;
  if m.id = any(coalesce(v.rechazos, '{}')) then return false; end if;
  if v.cliente_id is not null and exists(select 1 from rodar.negativos where cliente_id = v.cliente_id and movil_id = m.id) then return false; end if;
  if exists(select 1 from rodar.viajes where movil_id = m.id and estado in ('ofrecido', 'confirmado', 'en_curso')) then return false; end if;
  if exists(select 1 from rodar.penalizaciones where movil_id = m.id and hasta > rodar.ahora()) then return false; end if;
  ec := rodar.estado_cuenta(m);
  return not (ec ->> 'bloqueado')::boolean and not (ec ->> 'sin_saldo')::boolean;
end $$;


-- ---------- JSON de negocio y de pedido: ahora incluyen rubro y vehículo ----------

create or replace function rodar.dlv_negocio_json(n rodar.dlv_negocios) returns jsonb language sql stable as $$
  select to_jsonb(n) - 'cambio_pendiente' || jsonb_build_object(
    'categoria', (select nombre from rodar.dlv_categorias where id = n.categoria_id),
    'saldo', rodar.dlv_saldo(n.id), 'abierto', rodar.dlv_abierto(n.horario),
    'pedidos', (select count(*) from rodar.dlv_pedidos where negocio_id = n.id),
    'productos', (select count(*) from rodar.dlv_productos where negocio_id = n.id),
    'tiene_cambio', n.cambio_pendiente is not null,
    'rubro_tipo', rodar.dlv_rubro_tipo(n.id), 'vocab', rodar.dlv_vocab(rodar.dlv_rubro_tipo(n.id)), 'vehiculo_efectivo', rodar.dlv_vehiculo_neg(n.id)) $$;

create or replace function rodar.dlv_pedido_json(p rodar.dlv_pedidos) returns jsonb language sql stable as $$
  select to_jsonb(p) || jsonb_build_object(
    'negocio', (select nombre from rodar.dlv_negocios where id = p.negocio_id),
    'negocio_tel', (select telefono from rodar.dlv_negocios where id = p.negocio_id),
    'movil_numero', (select numero from rodar.moviles where id = p.movil_id),
    'movil_lat', (select lat from rodar.moviles where id = p.movil_id), 'movil_lng', (select lng from rodar.moviles where id = p.movil_id),
    'conductor', (select trim(nombre || ' ' || coalesce(apellido, '')) from rodar.usuarios where id = p.conductor_id),
    'viaje_estado', (select estado from rodar.viajes where id = p.viaje_id), 'k', rodar.firma(p.id),
    'rubro_tipo', rodar.dlv_rubro_tipo(p.negocio_id)) $$;


-- ---------- pedir repartidor (copia de 60_delivery_integrado.sql): el viaje hereda el vehículo del pedido ----------

create or replace function rodar.dlv_pedir_repartidor(p_id bigint) returns void language plpgsql as $$
declare p rodar.dlv_pedidos; n rodar.dlv_negocios; ids bigint[]; nulo rodar.usuarios; cobrar numeric; txt text; prepago boolean;
begin
  select * into p from rodar.dlv_pedidos where id = p_id for update;
  if p.tipo_entrega = 'retiro' then raise exception 'El pedido es para retirar en el local'; end if;
  if p.viaje_id is not null and exists (select 1 from rodar.viajes where id = p.viaje_id and estado not in ('anulado', 'finalizado')) then return; end if;
  select * into n from rodar.dlv_negocios where id = p.negocio_id;
  prepago := p.medio_pago = 'online' and p.pagado;
  cobrar := case when p.tipo = 'express' and p.cobro = 'solo_entrega' then 0
                 when p.pagado or p.medio_pago in ('tarjeta', 'billetera', 'transferencia', 'b2b', 'vale', 'online') then 0 else p.total end;
  txt := 'DELIVERY #' || p.codigo || coalesce(' · ' || n.nombre, '') ||
         case when cobrar > 0 then ' · COBRAR $' || round(cobrar) else ' · YA PAGADO' end ||
         coalesce(' · Paga con $' || round(p.paga_con), '') ||
         coalesce(' · Cód. retiro ' || p.codigo_recoleccion, '') ||
         coalesce(' · Entregar a ' || p.cliente_nombre, '') || coalesce(' (' || p.cliente_tel || ')', '') || coalesce(' · ' || p.entrega_ref, '') || coalesce(' · ' || p.notas, '');
  ids := rodar.crear_viaje(jsonb_build_object(
    'canal', 'web', 'origen_tipo', 'delivery', 'telefono', null, 'alias', coalesce(n.nombre, 'Envío directo'),
    'origen_dir', p.recogida_dir, 'origen_lat', p.recogida_lat, 'origen_lng', p.recogida_lng,
    'destino_dir', p.entrega_dir, 'destino_lat', p.entrega_lat, 'destino_lng', p.entrega_lng, 'destino_ref', p.entrega_ref,
    'datos_movil', txt, 'monto_fijo', p.envio,
    'medio_pago', case when prepago then 'mercadopago' else 'efectivo' end, -- 'mercadopago' = cobrado por la central: el envío queda "a rendir" al móvil
    'pin_requerido', false), nulo);
  -- el viaje hereda el vehículo que pidió el negocio: solo se le ofrece a móviles de ese tipo (ver rodar.elegible)
  update rodar.viajes set vehiculo_req = case when p.vehiculo in ('moto', 'auto') then p.vehiculo end where id = ids[1];
  update rodar.dlv_pedidos set viaje_id = ids[1], buscando_desde = rodar.ahora(), avisado = false where id = p_id;
  perform rodar.dlv_hist(p_id, 'Buscando repartidor (viaje #' || ids[1] || ')');
  begin perform rodar.procesar(); exception when others then null; end;
end $$;


-- ---------- aviso "preparando" según el rubro (copia de 60_delivery_integrado.sql) ----------

create or replace function rodar.dlv_avisar(p_id bigint, p_ev text) returns void language plpgsql as $$
declare p rodar.dlv_pedidos; n rodar.dlv_negocios; titulo text; cuerpo text; subs jsonb; nom text; mv text;
begin
  select * into p from rodar.dlv_pedidos where id = p_id; if not found then return; end if;
  perform rodar.dlv_ping(p_id, p_ev);
  select * into n from rodar.dlv_negocios where id = p.negocio_id; nom := coalesce(n.nombre, 'El comercio');
  if p_ev = 'pagado' then titulo := '💳 Recibimos tu pago'; cuerpo := 'Pedido #' || p.codigo || ' por $' || round(p.total) || '. Ahora lo confirma ' || nom || '.';
  elsif p_ev = 'confirmado' then titulo := '✅ Tu pedido fue aceptado'; cuerpo := nom || ' recibió tu pedido #' || p.codigo || '.';
  elsif p_ev = 'preparando' then
    if rodar.dlv_rubro_tipo(p.negocio_id) = 'productos' then titulo := '📦 Están armando tu pedido'; cuerpo := nom || ' está reuniendo tus productos.';
    else titulo := '👨‍🍳 Están preparando tu pedido'; cuerpo := nom || ' ya lo está armando.'; end if;
  elsif p_ev = 'listo' then titulo := '📦 Tu pedido está listo';
    cuerpo := case when p.tipo_entrega = 'retiro' then 'Pasá a retirarlo por ' || nom || '.' else 'Estamos buscando un repartidor.' end;
  elsif p_ev = 'asignado' then
    select 'Móvil ' || m.numero || coalesce(' · ' || nullif(trim(coalesce(u.nombre, '') || ' ' || coalesce(u.apellido, '')), ''), '') into mv
      from rodar.moviles m left join rodar.usuarios u on u.id = p.conductor_id where m.id = p.movil_id;
    titulo := '🛵 Ya tenés repartidor'; cuerpo := coalesce(mv, 'Un repartidor') || ' lleva tu pedido.';
  elsif p_ev in ('en_camino', 'recogido') then titulo := '🛵 Tu pedido va en camino';
    cuerpo := 'Tocá para seguirlo en el mapa.' || coalesce(E'\nCódigo para el repartidor: ' || p.codigo_entrega, '');
  elsif p_ev = 'entregado' then titulo := '🎉 ¡Pedido entregado!'; cuerpo := 'Gracias por pedir en ' || nom || '.';
  elsif p_ev = 'cancelado' then titulo := 'Pedido cancelado'; cuerpo := coalesce(p.motivo_cancelacion, 'Tu pedido #' || p.codigo || ' fue cancelado.') || case when coalesce(p.reembolso, 0) > 0 then ' Te devolvemos $' || round(p.reembolso) || '.' else '' end;
  else return; end if;
  subs := rodar.dlv_subs(p_id);
  perform rodar.push_enviar(subs, jsonb_build_object('titulo', titulo, 'cuerpo', cuerpo, 'tipo', 'pasajero', 'ttl', 3600, 'tag', 'dlv-' || p.id,
    'url', 'delivery.html#/seguir/' || p.id || '/' || rodar.firma(p.id)), 'dlv-' || p.id || '-' || p_ev);
exception when others then null; -- un aviso que falla nunca frena el pedido
end $$;


-- ---------- seguimiento del cliente: rubro, vocabulario y vehículo (copia de 60_delivery_integrado.sql) ----------

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
    'rubro_tipo', rodar.dlv_rubro_tipo(p.negocio_id), 'vocab', rodar.dlv_vocab(rodar.dlv_rubro_tipo(p.negocio_id)), 'vehiculo', coalesce(p.vehiculo, 'cualquiera'),
    'entrega_lat', p.entrega_lat, 'entrega_lng', p.entrega_lng, 'recogida_lat', p.recogida_lat, 'recogida_lng', p.recogida_lng,
    'pago', jsonb_build_object('online', p.medio_pago = 'online', 'pagado', p.pagado, 'vence', p.pago_vence, 'reembolso', coalesce(p.reembolso, 0),
       'pendiente', p.medio_pago = 'online' and not p.pagado and p.estado = 'pendiente' and p.pago_vence >= rodar.ahora()),
    'canal', 'dlv-' || p.id || '-' || rodar.firma(p.id),
    'repartidor', case when p.movil_id is not null and p.estado not in ('entregado', 'cancelado') then jsonb_build_object('movil', j->'movil_numero', 'nombre', j->'conductor', 'lat', j->'movil_lat', 'lng', j->'movil_lng') end,
    'puede_cancelar', p.estado not in ('entregado', 'cancelado', 'cancelacion_solicitada', 'recogido', 'en_camino') and
       ((p.estado = 'pendiente' and rodar.b(c, 'cancel_cliente_antes')) or p.estado <> 'pendiente'),
    'cancela_directo', coalesce((p.estado = 'pendiente' and rodar.b(c, 'cancel_cliente_antes')) or (p.estado <> 'pendiente' and rodar.b(c, 'cancel_cliente_despues'))
      or (rodar.n(c, 'cancelar_sin_repartidor') > 0 and p.buscando_desde < rodar.ahora() - make_interval(mins => rodar.n(c, 'cancelar_sin_repartidor')::int) and p.movil_id is null), false)); end $$;


-- ---------- categorías: tipo de rubro y vehículo por defecto (copia de 58_delivery.sql) ----------

create or replace function public.r_dlv_categoria_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); nid bigint;
  v_tipo text := coalesce(nullif(rodar.t(p_b, 'tipo'), ''), 'comida'); v_veh text := nullif(rodar.t(p_b, 'vehiculo_defecto'), '');
begin
  if rodar.t(p_b, 'nombre') is null then raise exception 'Ingresá el nombre de la categoría'; end if;
  if v_tipo not in ('comida', 'productos') then raise exception 'Tipo de rubro inválido'; end if;
  if v_veh is not null and v_veh not in ('moto', 'auto', 'cualquiera') then raise exception 'Vehículo inválido'; end if;
  if rodar.n(p_b, 'id') is not null then
    update rodar.dlv_categorias set nombre = rodar.t(p_b, 'nombre'), descripcion = rodar.t(p_b, 'descripcion'),
      icono = case when p_b ? 'icono' then rodar.t(p_b, 'icono') else icono end, orden = coalesce(rodar.n(p_b, 'orden')::int, orden),
      tipo = case when p_b ? 'tipo' then v_tipo else tipo end, vehiculo_defecto = case when p_b ? 'vehiculo_defecto' then v_veh else vehiculo_defecto end where id = rodar.n(p_b, 'id') returning id into nid;
  else
    insert into rodar.dlv_categorias(nombre, descripcion, icono, orden, tipo, vehiculo_defecto) values (rodar.t(p_b, 'nombre'), rodar.t(p_b, 'descripcion'), rodar.t(p_b, 'icono'), coalesce(rodar.n(p_b, 'orden')::int, 0), v_tipo, v_veh) returning id into nid;
  end if;
  perform rodar.accion(u, 'Delivery', 'Categoría ' || rodar.t(p_b, 'nombre'), 'Guardó la categoría');
  return jsonb_build_object('ok', true, 'id', nid); end $$;


-- ---------- demo: suma rubros que no son comida (copia de 58_delivery.sql) ----------

create or replace function public.r_dlv_demo(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); e jsonb := rodar.cfg('empresa'); la float8 := coalesce((e->>'lat')::float8, -30.9465); ln float8 := coalesce((e->>'lng')::float8, -58.7834);
  c1 bigint; c2 bigint; c3 bigint; c4 bigint; n1 bigint; n2 bigint; n3 bigint; n4 bigint; m bigint;
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
  update rodar.dlv_categorias set tipo = 'productos' where id = c3; -- no es comida: "armando" en vez de "preparando"
  insert into rodar.dlv_categorias(nombre, descripcion, orden, demo, tipo, vehiculo_defecto) values ('Ferretería y hogar', 'Herramientas, pinturas y artículos para la casa (se entregan en auto)', 4, true, 'productos', 'auto') returning id into c4;
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
  insert into rodar.dlv_negocios(nombre, telefono, email, categoria_id, direccion, lat, lng, estado, descripcion, tiempo_prep, demo)
    values ('Ferretería El Tornillo (demo)', '3454000004', 'tornillo@demo.com', c4, 'Mitre 410', la - .002, ln - .002, 'activo', 'Herramientas, pinturas y todo para el hogar', 15, true) returning id into n4;
  insert into rodar.dlv_menu_categorias(negocio_id, nombre, orden) values (n4, 'Herramientas', 1) returning id into m;
  insert into rodar.dlv_productos(negocio_id, menu_cat_id, nombre, descripcion, precio, orden) values
    (n4, m, 'Taladro percutor 650 W', 'Con maletín y 6 mechas', 58000, 1), (n4, m, 'Juego de destornilladores x10', 'Punta imantada', 12500, 2), (n4, m, 'Escalera de aluminio 5 escalones', 'Plegable', 46000, 3);
  insert into rodar.dlv_menu_categorias(negocio_id, nombre, orden) values (n4, 'Pinturas', 2) returning id into m;
  insert into rodar.dlv_productos(negocio_id, menu_cat_id, nombre, precio) values (n4, m, 'Látex interior blanco 20 L', 64000), (n4, m, 'Rodillo + bandeja', 7800);
  perform rodar.accion(u, 'Delivery', 'Demo', 'Cargó contenido de demo');
  return '{"ok":true}'; end $$;


-- ---------- cambiar el vehículo de un pedido ----------
-- Se puede mientras el pedido no tenga repartidor: antes de pedirlo, o con el viaje todavía sin ofrecer.
create or replace function rodar.dlv_set_vehiculo(p_id bigint, p_veh text, p_quien text) returns void language plpgsql as $$
declare p rodar.dlv_pedidos; vs text;
begin
  if p_veh not in ('moto', 'auto', 'cualquiera') then raise exception 'Elegí moto, auto o cualquiera'; end if;
  select * into p from rodar.dlv_pedidos where id = p_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if p.tipo_entrega = 'retiro' then raise exception 'El pedido es para retirar en el local'; end if;
  if p.estado in ('entregado', 'cancelado', 'cancelacion_solicitada', 'recogido', 'en_camino') then raise exception 'El pedido ya no admite cambios de vehículo'; end if;
  if p.viaje_id is not null then
    select estado into vs from rodar.viajes where id = p.viaje_id;
    if vs = 'ofrecido' then raise exception 'Ya se le ofreció el pedido a un repartidor: esperá su respuesta'; end if;
    if vs in ('confirmado', 'en_curso') then raise exception 'El pedido ya tiene repartidor asignado'; end if;
  end if;
  if coalesce(p.vehiculo, 'cualquiera') = p_veh then return; end if;
  update rodar.dlv_pedidos set vehiculo = p_veh where id = p.id;
  perform rodar.dlv_hist(p.id, 'Vehículo requerido: ' || p_veh || ' · ' || p_quien);
  if vs in ('pendiente', 'reserva') then
    update rodar.viajes set vehiculo_req = case when p_veh in ('moto', 'auto') then p_veh end where id = p.viaje_id;
    begin perform rodar.procesar(); exception when others then null; end; -- vuelve a buscar con el vehículo nuevo
  end if;
end $$;

-- panel (admin / operador)
create or replace function public.r_dlv_pedido_vehiculo(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin', 'operador'); p rodar.dlv_pedidos;
begin
  perform rodar.dlv_set_vehiculo(rodar.n(p_b, 'id')::bigint, coalesce(rodar.t(p_b, 'vehiculo'), ''), 'panel · ' || rodar.nombre(u));
  select * into p from rodar.dlv_pedidos where id = rodar.n(p_b, 'id');
  return rodar.dlv_pedido_json(p); end $$;

-- portal del comercio: vehículo de un pedido (p_b.id + p_b.vehiculo) y/o vehículo por defecto del negocio (p_b.defecto: moto | auto | cualquiera | '' = el de mi rubro)
create or replace function public.r_dlv_com_vehiculo(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.dlv_negocio_usuarios := rodar.dlv_comercio(p_token); p rodar.dlv_pedidos; d text;
begin
  if p_b ? 'defecto' then
    d := nullif(rodar.t(p_b, 'defecto'), '');
    if d is not null and d not in ('moto', 'auto', 'cualquiera') then raise exception 'Elegí moto, auto o cualquiera'; end if;
    update rodar.dlv_negocios set vehiculo_defecto = d where id = u.negocio_id;
  end if;
  if p_b ? 'id' then
    select * into p from rodar.dlv_pedidos where id = rodar.n(p_b, 'id') and negocio_id = u.negocio_id;
    if not found then raise exception 'Pedido no encontrado'; end if;
    perform rodar.dlv_set_vehiculo(p.id, coalesce(rodar.t(p_b, 'vehiculo'), ''), 'comercio · ' || coalesce(u.nombre, u.email));
    select * into p from rodar.dlv_pedidos where id = p.id;
    return rodar.dlv_pedido_json(p);
  end if;
  return jsonb_build_object('ok', true, 'vehiculo_efectivo', rodar.dlv_vehiculo_neg(u.negocio_id)); end $$;

-- panel: vehículo por defecto de un negocio ('' = el de su rubro)
create or replace function public.r_dlv_negocio_vehiculo(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); d text := nullif(rodar.t(p_b, 'vehiculo'), '');
begin
  if d is not null and d not in ('moto', 'auto', 'cualquiera') then raise exception 'Elegí moto, auto o cualquiera'; end if;
  update rodar.dlv_negocios set vehiculo_defecto = d where id = rodar.n(p_b, 'id');
  if not found then raise exception 'Negocio no encontrado'; end if;
  perform rodar.accion(u, 'Delivery', 'Negocio #' || rodar.n(p_b, 'id'), 'Vehículo por defecto: ' || coalesce(d, 'el de su rubro'));
  return jsonb_build_object('ok', true, 'vehiculo_efectivo', rodar.dlv_vehiculo_neg(rodar.n(p_b, 'id')::bigint)); end $$;

-- panel: tipo de vehículo de un móvil (auto | moto)
create or replace function public.r_movil_tipo(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); t text := coalesce(rodar.t(p_b, 'tipo'), ''); vid bigint := coalesce((p_q ->> 'id')::bigint, rodar.n(p_b, 'id')::bigint);
begin
  if t not in ('auto', 'moto') then raise exception 'El vehículo tiene que ser auto o moto'; end if;
  update rodar.moviles set tipo_vehiculo = t where id = vid;
  if not found then raise exception 'Móvil no encontrado'; end if;
  perform rodar.historial_movil(vid, 'vehiculo', rodar.nombre(u), 'Tipo de vehículo: ' || t);
  perform rodar.emitir_movil(vid);
  return jsonb_build_object('ok', true); end $$;

grant execute on function public.r_dlv_pedido_vehiculo(text, jsonb, jsonb), public.r_dlv_com_vehiculo(text, jsonb, jsonb),
  public.r_dlv_negocio_vehiculo(text, jsonb, jsonb), public.r_movil_tipo(text, jsonb, jsonb), public.r_dlv_categoria_guardar(text, jsonb, jsonb),
  public.r_dlv_pub_seguir(text, jsonb, jsonb), public.r_dlv_demo(text, jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
