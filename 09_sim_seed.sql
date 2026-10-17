-- ===================== Simulador (modo demo) =====================
create table if not exists rodar.sim_estado (
  movil_id bigint primary key, obj_lat float8, obj_lng float8, espera float8 default 0, metros float8 default 0,
  decide_at timestamptz, hacia_parada bigint, dlat float8, dlng float8
);

create or replace function rodar.azar(a float8, b float8) returns float8 language sql volatile as $$ select a + random() * (b - a) $$;
create or replace function rodar.calle_azar() returns text language sql volatile as $$
  select (array['San Martín','Belgrano','Urquiza','Mitre','Sarmiento','Rivadavia','25 de Mayo','Moreno','Alberdi','Pellegrini','Italia','España','Entre Ríos','Corrientes','Güemes','Las Heras','Laprida','Colón','Brown','Pringles'])[1 + floor(random() * 20)::int]
    || ' ' || (50 + floor(random() * 1850))::int $$;

-- avanza (lat,lng) hacia (dlat,dlng) 'metros'; devuelve [lat, lng, llegó]
create or replace function rodar.avanzar(lat float8, lng float8, dlat float8, dlng float8, metros float8) returns float8[] language plpgsql immutable as $$
declare d float8 := rodar.dist(lat, lng, dlat, dlng); f float8;
begin
  if d is null or d <= metros then return array[dlat, dlng, 1]; end if;
  f := metros / d;
  return array[lat + (dlat - lat) * f, lng + (dlng - lng) * f, 0];
end $$;

create or replace function rodar.sim_tick() returns void language plpgsql as $$
declare conf jsonb := rodar.cfg('simulador', '{"flota":true,"demanda":true}'); e jsonb := rodar.cfg('empresa', '{}'); clat float8 := (e ->> 'lat')::float8; clng float8 := (e ->> 'lng')::float8;
  ult timestamptz := (rodar.cfg('sim_ultimo') #>> '{}')::timestamptz; dt float8; m rodar.moviles; st rodar.sim_estado; v rodar.viajes; r float8[]; paso float8; z rodar.zonas; ids bigint[]; cli record; n int;
begin
  if not coalesce((conf ->> 'flota')::boolean, false) and not coalesce((conf ->> 'demanda')::boolean, false) then return; end if;
  if ult is not null and now() - ult < interval '1800 milliseconds' then return; end if;
  if not pg_try_advisory_xact_lock(434343) then return; end if;
  perform rodar.cfg_set('sim_ultimo', to_jsonb(now()));
  dt := least(10, greatest(1, coalesce(extract(epoch from now() - ult), 2)));

  if coalesce((conf ->> 'flota')::boolean, false) then
    -- arranque: conecta hasta 9 móviles simulados
    select count(*) into n from rodar.moviles where simulado and estado <> 'desconectado';
    if n = 0 then
      update rodar.moviles x set conductor_id = (select usuario_id from rodar.movil_conductores where movil_id = x.id order by usuario_id limit 1), estado = 'disponible'
        where x.id in (select id from rodar.moviles where simulado and habilitado and estado = 'desconectado' order by numero limit 9);
    end if;
    for m in select * from rodar.moviles where simulado and estado not in ('desconectado', 'fuera_servicio') loop
      select * into st from rodar.sim_estado where movil_id = m.id;
      if not found then
        insert into rodar.sim_estado(movil_id, obj_lat, obj_lng) values (m.id, clat + rodar.azar(-0.014, 0.014), clng + rodar.azar(-0.017, 0.017)) returning * into st;
      end if;
      if m.lat is null then update rodar.moviles set lat = clat + rodar.azar(-0.01, 0.01), lng = clng + rodar.azar(-0.01, 0.01) where id = m.id returning * into m; end if;
      select * into v from rodar.viajes where movil_id = m.id and estado in ('ofrecido', 'confirmado', 'en_curso') order by id desc limit 1;
      paso := 22 * dt;
      if v.id is not null and v.estado = 'ofrecido' then
        if st.decide_at is null then update rodar.sim_estado set decide_at = now() + make_interval(secs => rodar.azar(2.5, 7)) where movil_id = m.id;
        elsif now() > st.decide_at then
          update rodar.sim_estado set decide_at = null where movil_id = m.id;
          begin if random() < 0.9 then perform rodar.aceptar(v.id, m.id); else perform rodar.rechazar(v.id, m.id); end if; exception when others then null; end;
        end if;
        continue;
      elsif v.id is not null and v.estado = 'confirmado' then
        r := rodar.avanzar(m.lat, m.lng, coalesce(v.origen_lat, m.lat), coalesce(v.origen_lng, m.lng), paso);
        if r[3] = 0 then perform rodar.posicion(m.id, r[1], r[2], paso / dt * 3.6, null, true);
        else
          if v.llegada_at is null then perform rodar.llegada(v.id); end if;
          update rodar.sim_estado set espera = espera + dt where movil_id = m.id returning * into st;
          if st.espera > 12 then
            update rodar.sim_estado set espera = 0, metros = 0, dlat = coalesce(v.destino_lat, clat + rodar.azar(-0.014, 0.014)), dlng = coalesce(v.destino_lng, clng + rodar.azar(-0.017, 0.017)) where movil_id = m.id;
            begin perform rodar.iniciar(v.id, v.pin); exception when others then null; end;
          end if;
        end if;
      elsif v.id is not null and v.estado = 'en_curso' then
        if st.dlat is null then update rodar.sim_estado set dlat = coalesce(v.destino_lat, clat + rodar.azar(-0.014, 0.014)), dlng = coalesce(v.destino_lng, clng + rodar.azar(-0.017, 0.017)) where movil_id = m.id returning * into st; end if;
        r := rodar.avanzar(m.lat, m.lng, st.dlat, st.dlng, paso);
        update rodar.sim_estado set metros = metros + coalesce(rodar.dist(m.lat, m.lng, r[1], r[2]), 0) where movil_id = m.id returning * into st;
        perform rodar.posicion(m.id, r[1], r[2], paso / dt * 3.6, null, true);
        if r[3] = 1 then
          begin perform rodar.finalizar(v.id, (st.metros * 1.15)::numeric, rodar.azar(0, 150)::numeric, null, r[1], r[2], coalesce(v.destino_dir, rodar.calle_azar())); exception when others then null; end;
          update rodar.sim_estado set dlat = null, dlng = null, metros = 0, obj_lat = clat + rodar.azar(-0.014, 0.014), obj_lng = clng + rodar.azar(-0.017, 0.017) where movil_id = m.id;
        end if;
      elsif m.estado = 'en_parada' then
        if random() < 0.004 * dt then perform rodar.set_estado_movil(m.id, 'disponible'); end if;
        perform rodar.posicion(m.id, m.lat, m.lng, 0, null, true);
      elsif m.estado = 'disponible' then
        if st.hacia_parada is null and random() < 0.01 * dt then
          select * into z from rodar.zonas where es_parada and parada_lat is not null order by random() limit 1;
          if z.id is not null then update rodar.sim_estado set hacia_parada = z.id, obj_lat = z.parada_lat + rodar.azar(-0.0003, 0.0003), obj_lng = z.parada_lng + rodar.azar(-0.0003, 0.0003) where movil_id = m.id returning * into st; end if;
        end if;
        r := rodar.avanzar(m.lat, m.lng, st.obj_lat, st.obj_lng, paso * 0.6);
        perform rodar.posicion(m.id, r[1], r[2], paso * 0.6 / dt * 3.6, null, true);
        if r[3] = 1 then
          if st.hacia_parada is not null then begin perform rodar.set_estado_movil(m.id, 'en_parada', st.hacia_parada); exception when others then null; end; end if;
          update rodar.sim_estado set hacia_parada = null, obj_lat = clat + rodar.azar(-0.014, 0.014), obj_lng = clng + rodar.azar(-0.017, 0.017) where movil_id = m.id;
        end if;
        if random() < 0.0015 * dt then
          begin
            ids := rodar.crear_viaje(jsonb_build_object('origen_dir', rodar.calle_azar(), 'origen_lat', r[1], 'origen_lng', r[2], 'canal', 'movil', 'origen_tipo', 'calle', 'alias', 'CALLE', 'movil_id', m.id, 'conductor_id', m.conductor_id, 'pin_requerido', false), null);
            perform rodar.aceptar(ids[1], m.id);
          exception when others then null; end;
        end if;
      end if;
    end loop;
  end if;

  if coalesce((conf ->> 'demanda')::boolean, false) and random() < 0.035 * dt then
    select c.telefono, c.alias, d.direccion, d.lat, d.lng into cli from rodar.clientes c join rodar.cliente_domicilios d on d.cliente_id = c.id where not c.bloqueado and c.baja_at is null order by random() limit 1;
    if found then
      begin
        perform rodar.crear_viaje(jsonb_build_object('telefono', cli.telefono, 'alias', cli.alias, 'origen_dir', cli.direccion, 'origen_loc', e ->> 'localidad', 'origen_prov', e ->> 'provincia', 'origen_lat', cli.lat, 'origen_lng', cli.lng,
          'destino_dir', case when random() < 0.5 then rodar.calle_azar() end, 'destino_lat', case when random() < 0.5 then clat + rodar.azar(-0.014, 0.014) end, 'destino_lng', clng + rodar.azar(-0.017, 0.017),
          'canal', (array['centralita','centralita','whatsapp','aplicacion','web','telegram'])[1 + floor(random() * 6)::int], 'medio_pago', case when random() < 0.15 then 'mercadopago' else 'efectivo' end), null);
      exception when others then null; end;
    end if;
  end if;
end $$;

-- el destino sin lat no tiene que tener lng: limpieza
create or replace function rodar.ciclo_cron() returns void language plpgsql as $$
begin perform rodar.procesar(); perform rodar.ciclo_lento(); perform rodar.sim_tick(); end $$;

-- sobreescribe r_tick / r_estado para incluir el simulador
create or replace function public.r_tick(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.usuario(p_token); perform rodar.ciclo_cron(); return '{"ok":true}'; end $$;

-- ===================== Datos de ejemplo (solo si la base está vacía) =====================
create or replace function rodar.seed() returns void language plpgsql as $$
declare clat float8 := -30.9545; clng float8 := -58.7835; nombres text[] := array['Lucas','Martín','Sofía','Valentina','Joaquín','Camila','Federico','Rocío','Nicolás','Agustina','Tomás','Julieta','Gonzalo','Paula','Ramiro','Lorena','Hernán','Mariela','Sergio','Daniela'];
  apellidos text[] := array['Benítez','Romero','Acosta','Medina','Herrera','Ruiz','Sosa','Ferreyra','Godoy','Ríos','Vera','Ojeda','Molina','Correa','Paz','Luna','Aguirre','Ledesma','Cabrera','Ponce'];
  tit bigint[] := '{}'; cond bigint[] := '{}'; nid bigint; i int; d int; k int; cant int; mv rodar.moviles; t0 timestamp; ta timestamp; ti timestamp; tf timestamp; cli record; metros float8; anul boolean; calle boolean;
  dlat float8; dlng float8; t rodar.tarifas; monto numeric; mins float8; dia date; cnd bigint; lat float8; lng float8; est text; tt timestamp; objlat float8; objlng float8; r float8[]; sal numeric; vid bigint;
begin
  if exists(select 1 from rodar.usuarios) then return; end if;
  perform rodar.cfg_set('secreto', to_jsonb(encode(extensions.gen_random_bytes(16), 'hex')));
  perform rodar.cfg_set('webhook_token', to_jsonb(encode(extensions.gen_random_bytes(12), 'hex')));
  perform rodar.cfg_set('empresa', jsonb_build_object('nombre', 'Remises TOQUE!', 'razon_social', 'Remises Demo S.R.L.', 'cuit', '30-00000000-0', 'direccion', 'San Martín 100', 'localidad', 'Federal',
    'provincia', 'Entre Ríos', 'telefono', '3454 000000', 'email', 'central@demo.local', 'lat', clat, 'lng', clng, 'tipo_servicio', 'Remis', 'quien_factura', 'La empresa', 'firmante', 'Titular',
    'firmante_nombre', 'Responsable Demo', 'apps_ios', true, 'pagos_electronicos', true, 'boton_emergencia', true, 'descripcion', 'Servicio de remis con despacho centralizado y seguimiento en tiempo real.'));
  perform rodar.cfg_set('mp', '{"absorbe":"central","tasas":{"inmediata":6.29,"d10":4.39,"d18":3.39,"d35":1.79},"plazo":"inmediata","link_pago":"","alias_cobro":""}');
  perform rodar.cfg_set('dispatch', '{"timeout_oferta_seg":20,"radio_busqueda_m":6000,"max_intentos":5,"deuda_bloqueo":-5000}');
  perform rodar.cfg_set('simulador', '{"flota":true,"demanda":true}');

  insert into rodar.usuarios(documento, usuario, nombre, apellido, email, telefono, password_hash, roles) values
    ('1000', 'admin', 'Admin', 'Central', 'admin@demo.local', '3454000001', rodar.hash('admin123'), 'admin,operador,gestion'),
    ('1001', 'operador', 'Laura', 'Operadora', 'operador@demo.local', '3454000002', rodar.hash('operador123'), 'operador'),
    ('1002', 'contable', 'Carlos', 'Contable', 'contable@demo.local', '3454000003', rodar.hash('contable123'), 'gestion');
  for i in 0 .. 3 loop
    insert into rodar.usuarios(documento, usuario, nombre, apellido, telefono, password_hash, roles) values ((20000000 + i * 1111)::text, 'titular' || (i + 1), nombres[i + 1], apellidos[i + 1], '345450' || (1000 + i),
      rodar.hash('titular123'), case when i = 0 then 'titular,conductor' else 'titular' end) returning id into nid;
    tit := tit || nid;
  end loop;
  cond := array[tit[1]];
  for i in 0 .. 13 loop
    insert into rodar.usuarios(documento, usuario, nombre, apellido, telefono, password_hash, roles) values ((30000000 + i * 1373)::text, 'conductor' || (i + 1), nombres[(i + 4) % 20 + 1], apellidos[(i + 6) % 20 + 1],
      '345460' || (1000 + i), rodar.hash('conductor123'), 'conductor') returning id into nid;
    cond := cond || nid;
  end loop;
  insert into rodar.corporativos(nombre, cuit, centro_costo, contacto, telefono) values ('Cooperativa Agrícola Demo', '30-11111111-1', 'Administración', 'Mesa de entradas', '3454111111');
  insert into rodar.usuarios(documento, usuario, nombre, apellido, email, telefono, password_hash, roles, corporativo_id) values ('40000000', 'empresa', 'Usuario', 'Corporativo', 'corp@demo.local', '3454111112', rodar.hash('empresa123'), 'corporativo', 1);

  insert into rodar.planes(descripcion, modo_pago, modo_cobro, monto_fijo, periodicidad, sistema) values ('Sin abono', 'prepago', 'fijo', 0, 'mensual', true);
  insert into rodar.planes(descripcion, modo_pago, modo_cobro, tipo1, vencer_saldo, monto_fijo, monto_viaje, periodicidad, dia_mes, minimo) values ('Abono mensual + viaje', 'prepago', 'fijo_viaje', true, true, 27000, 1350, 'mensual', 1, 5000);
  insert into rodar.planes(descripcion, modo_pago, modo_cobro, monto_fijo, periodicidad, dia_semana) values ('Semanal fijo', 'pospago', 'fijo', 9000, 'semanal', 1);
  insert into rodar.planes(descripcion, modo_pago, modo_cobro, pct_viaje, periodicidad, minimo) values ('Porcentaje por viaje 10%', 'prepago', 'porcentaje', 10, 'mensual', 3000);

  insert into rodar.zonas(nombre, poligono, color, parada_lat, parada_lng, orden) values
    ('Centro', '[[-30.960,-58.792],[-30.960,-58.775],[-30.949,-58.775],[-30.949,-58.792]]', '#1f8a8a', -30.9545, -58.7835, 1),
    ('Norte', '[[-30.949,-58.800],[-30.949,-58.765],[-30.935,-58.765],[-30.935,-58.800]]', '#2f6fd6', -30.943, -58.782, 2),
    ('Sur', '[[-30.975,-58.800],[-30.975,-58.765],[-30.960,-58.765],[-30.960,-58.800]]', '#d6782f', -30.967, -58.783, 3),
    ('Este', '[[-30.960,-58.775],[-30.960,-58.758],[-30.949,-58.758],[-30.949,-58.775]]', '#8a2fd6', -30.9545, -58.767, 4),
    ('Oeste', '[[-30.960,-58.810],[-30.960,-58.792],[-30.949,-58.792],[-30.949,-58.810]]', '#2fa04a', -30.9545, -58.801, 5),
    ('Terminal', '[[-30.9515,-58.7800],[-30.9515,-58.7760],[-30.9490,-58.7760],[-30.9490,-58.7800]]', '#c0392b', -30.9502, -58.778, 6);
  insert into rodar.zonas_peligrosas(nombre, poligono, creado) values ('Descampado sur (ejemplo)', '[[-30.978,-58.790],[-30.978,-58.780],[-30.974,-58.780],[-30.974,-58.790]]', rodar.ahora());

  for i in 1 .. 12 loop
    insert into rodar.moviles(numero, patente, licencia, marca, modelo, anio, color, titular_id, plan_id, estado, lat, lng, simulado)
    values (i, 'A' || chr(65 + i) || lpad((100 + i * 7)::text, 3, '0') || 'X' || chr(70 + i % 10), 'L-' || (500 + i),
      (array['Chevrolet','Fiat','Toyota','Renault','Volkswagen','Peugeot'])[i % 6 + 1], (array['Prisma','Cronos','Etios','Logan','Voyage','208'])[i % 6 + 1], 2015 + i % 9,
      (array['Blanco','Gris','Negro','Rojo'])[i % 4 + 1], tit[i % 4 + 1], case when i % 3 = 0 then 3 else 2 end, 'desconectado', clat + rodar.azar(-0.01, 0.01), clng + rodar.azar(-0.012, 0.012), true)
    returning id into nid;
    insert into rodar.movil_conductores values (nid, cond[(i - 1) % array_length(cond, 1) + 1]);
    if i % 4 = 0 then insert into rodar.movil_conductores values (nid, cond[(i + 5) % array_length(cond, 1) + 1]) on conflict do nothing; end if;
  end loop;

  insert into rodar.tarifas(orden, nombre, tipo, bajada, con_espera, espera_seg, precio_ficha, cortesia_mts, cortesia_min, dias, hora_desde, hora_hasta) values (1, 'Diurna', 'fija', 2800, true, 60, 140, 0, 2, '[1,2,3,4,5,6]', '06:00', '21:59');
  insert into rodar.tarifas(orden, nombre, tipo, bajada, con_espera, espera_seg, precio_ficha, cortesia_min, dias, feriado, hora_desde, hora_hasta, suba_max) values (2, 'Nocturna / domingos', 'dinamica', 3300, true, 60, 165, 2, '[0,1,2,3,4,5,6]', true, '22:00', '05:59', 25);
  insert into rodar.tarifas(orden, nombre, tipo, bajada, con_espera, espera_seg, precio_ficha, dias, hora_desde, hora_hasta) values (3, 'Domingo y feriado', 'fija', 3300, true, 60, 165, '[0]', '06:00', '21:59');

  insert into rodar.canales(codigo, nombre, orden, exigir_pin) values ('whatsapp','WhatsApp',0,false),('instagram','Instagram',1,false),('facebook','Facebook',2,false),('telegram','Telegram',3,false),
    ('aplicacion','Aplicación pasajero',4,true),('web','Pedido web',5,false),('operador','Operador',6,false),('movil','Móvil (calle)',7,false),('centralita','Centralita telefónica',8,false);
  insert into rodar.medios_pago(codigo, nombre, orden, habilitado) values ('efectivo','Efectivo',0,true),('mercadopago','Mercado Pago',1,true),('transferencia','Transferencia',2,true),
    ('cuenta_corriente','Cuenta corriente (corporativo)',3,true),('tarjeta','Tarjeta (posnet del móvil)',4,false),('vale','Vale / voucher',5,false);
  insert into rodar.feriados(fecha, descripcion) values ('2026-01-01','Año Nuevo'),('2026-02-16','Carnaval'),('2026-02-17','Carnaval'),('2026-03-24','Día de la Memoria'),('2026-04-02','Malvinas'),
    ('2026-04-03','Viernes Santo'),('2026-05-01','Día del Trabajador'),('2026-05-25','Revolución de Mayo'),('2026-06-17','Paso a la Inmortalidad de Güemes'),('2026-06-20','Día de la Bandera'),
    ('2026-07-09','Independencia'),('2026-08-17','Paso a la Inmortalidad de San Martín'),('2026-10-12','Diversidad Cultural'),('2026-11-23','Soberanía Nacional'),('2026-12-08','Inmaculada Concepción'),('2026-12-25','Navidad');
  insert into rodar.modulos(codigo, nombre, descripcion, precio, unidad, obligatorio, activo_prox) values
    ('flota','Pack móviles','Gestión de flota, app de conductores y despacho.',1500,'móvil',true,true),('corporativo','Clientes corporativos','Empresas, centros de costo, viajes y facturación corporativa.',15000,'mes',false,true),
    ('operadores','Pantalla para operadores','Mapa en tiempo real, radio, telefonía, anulación e informes.',20000,'mes',false,true),('chat','Chat multicanal','WhatsApp / Telegram / web en una sola bandeja.',12000,'mes',false,true),
    ('telefonia','Puestos de telefonía','Puestos con identificador de llamadas.',8000,'puesto',false,true),('app_pasajero','App pasajero con marca propia','Publicación de la app de pasajeros con tu marca.',25000,'mes',false,true);
  insert into rodar.novedades(seccion, etiqueta, titulo, cuerpo, fecha, alerta) values
    ('destacado','NUEVO','App de conductores web','Los conductores ingresan desde conductor.html con su usuario o DNI. Incluye PIN de abordaje, viaje de calle, paradas, radio PTT y ticket del viaje.', rodar.hoy() - 4, null),
    ('destacado','NUEVO','Pedido web de pasajeros','Compartí el enlace pasajero.html: el pasajero pide el viaje, ve el móvil asignado y el PIN de seguridad.', rodar.hoy() - 8, null),
    ('destacado','AVISO','Aviso de viaje por WhatsApp','Desde el mapa, en cada viaje, podés copiar un mensaje de "móvil asignado" con el link de seguimiento.', rodar.hoy() - 13, 'Evitá enviar muchos mensajes idénticos seguidos: personalizá el texto.'),
    ('semana','MEJORA','Tarifa dinámica con techo','El índice sube de a 5% según demanda, móviles libres y clima, sin pasar la suba máxima configurada.', rodar.hoy() - 5, null),
    ('semana','MEJORA','Recorrido histórico con reproducción','Reproducí el recorrido de un móvil con velocidades 0.5x a 4x y exportalo en CSV.', rodar.hoy() - 6, null),
    ('archivo','GUÍA','Cómo cargar un feriado','Administración → Días feriados → Nuevo.', rodar.hoy() - 70, null);

  for i in 0 .. 119 loop
    insert into rodar.clientes(telefono, alias, creado) values ('3454' || (400000 + i * 37), case when i % 7 = 0 then 'EVENTUAL' else nombres[1 + floor(random() * 20)::int] || ' ' || apellidos[1 + floor(random() * 20)::int] end, rodar.ahora()) returning id into nid;
    insert into rodar.cliente_domicilios(cliente_id, direccion, localidad, provincia, lat, lng, ultimo_uso) values (nid, rodar.calle_azar(), 'Federal', 'Entre Ríos', clat + rodar.azar(-0.017, 0.017), clng + rodar.azar(-0.02, 0.02), rodar.ahora());
  end loop;
  update rodar.clientes set bloqueado = true, motivo_bloqueo = 'No se presentó 3 veces', bloqueado_por = 1, bloqueado_at = rodar.ahora() - interval '3 days' where id in (5, 17);

  select * into t from rodar.tarifas where id = 1;
  for d in reverse 45 .. 0 loop
    dia := rodar.hoy() - d;
    cant := floor(rodar.azar(18, 40));
    insert into rodar.conexion_diaria(usuario_id, fecha, segundos, cargados, tipo) values (2, dia, floor(rodar.azar(6, 8) * 3600), floor(cant * 0.6), 'web'), (1, dia, floor(rodar.azar(2, 5) * 3600), floor(cant * 0.3), 'web') on conflict do nothing;
    insert into rodar.conexion_diaria(usuario_id, fecha, segundos, tipo) select distinct usuario_id, dia, floor(rodar.azar(3, 10) * 3600), 'app' from rodar.movil_conductores where random() < 0.8 on conflict do nothing;
    for k in 1 .. cant loop
      if d = 0 and k > 6 then exit; end if;
      t0 := dia + make_interval(hours => floor(rodar.azar(6, 24))::int, mins => floor(rodar.azar(0, 60))::int);
      if t0 > rodar.ahora() then continue; end if;
      select c.id, c.telefono, d2.direccion, d2.lat, d2.lng into cli from rodar.clientes c join rodar.cliente_domicilios d2 on d2.cliente_id = c.id order by random() limit 1;
      select * into mv from rodar.moviles order by random() limit 1;
      select usuario_id into cnd from rodar.movil_conductores where movil_id = mv.id limit 1;
      calle := random() < 0.15; anul := random() < 0.06;
      dlat := clat + rodar.azar(-0.017, 0.017); dlng := clng + rodar.azar(-0.02, 0.02);
      metros := rodar.dist(cli.lat, cli.lng, dlat, dlng) * 1.3;
      ta := t0 + make_interval(secs => rodar.azar(20, 120)); ti := ta + make_interval(mins => rodar.azar(3, 9)::int);
      mins := metros / 1000 / 28 * 60 + rodar.azar(1, 4); tf := ti + make_interval(secs => mins * 60);
      monto := rodar.calcular_monto(t, metros::numeric, rodar.azar(0, 200)::numeric, 1);
      insert into rodar.viajes(cliente_id, telefono, alias, origen_dir, origen_loc, origen_prov, origen_lat, origen_lng, destino_dir, destino_lat, destino_lng, canal, origen_tipo, estado,
        movil_id, conductor_id, operador_id, zona_id, creado, asignado_at, inicio_at, fin_at, monto, km, minutos, medio_pago, calificacion, anulado_at, motivo_anulacion, pin)
      values (case when calle then null else cli.id end, case when calle then null else cli.telefono end, case when calle then 'CALLE' end, cli.direccion, 'Federal', 'Entre Ríos', cli.lat, cli.lng,
        rodar.calle_azar(), dlat, dlng, case when calle then 'movil' else (array['centralita','centralita','centralita','whatsapp','whatsapp','aplicacion','web','operador','telegram'])[1 + floor(random() * 9)::int] end,
        case when calle then 'calle' else 'central' end, case when anul then 'anulado' else 'finalizado' end, mv.id, cnd, case when calle then null else (array[1, 2, 2])[1 + floor(random() * 3)::int] end,
        (rodar.zona_de(cli.lat, cli.lng)).id, t0, ta, case when anul then null else ti end, case when anul then null else tf end, case when anul then null else monto end,
        case when anul then null else round((metros / 1000)::numeric, 2) end, case when anul then null else round(mins::numeric, 1) end,
        case when random() < 0.12 then 'mercadopago' else 'efectivo' end, case when not anul and random() < 0.5 then floor(rodar.azar(3, 6))::int end,
        case when anul then ta end, case when anul then (array['Cliente canceló','No se presentó','Duplicado'])[1 + floor(random() * 3)::int] end, (1000 + floor(random() * 9000))::int::text)
      returning id into vid;
      if not anul then
        insert into rodar.eventos_moviles(fecha, movil_id, movil_numero, tipo, ref, detalle) values (t0, mv.id, mv.numero, 'ofrecido', '#' || vid, 'Viaje ofrecido'), (ta, mv.id, mv.numero, 'aceptado', '#' || vid, 'Viaje aceptado');
        if mv.plan_id = 2 then insert into rodar.cuenta_movimientos(movil_id, fecha, tipo, monto, detalle, viaje_id) values (mv.id, tf, 'viaje', -1350, 'Viaje #' || vid, vid); end if;
        if (select medio_pago from rodar.viajes where id = vid) = 'mercadopago' then
          insert into rodar.mp_pagos(tipo, movil_id, viaje_id, monto, comision, estado, acreditado, medio, liberacion, mp_id, fecha, rendido)
          values ('viaje', mv.id, vid, monto, round(monto * 0.0339, 2), 'pagado', true, (array['account_money','credit_card','debit_card'])[1 + floor(random() * 3)::int], (tf + interval '18 days')::date, (9000000000 + vid)::text, tf, d > 20);
        end if;
      end if;
    end loop;
    if extract(day from dia) = 1 then
      insert into rodar.cuenta_movimientos(movil_id, fecha, tipo, monto, detalle)
        select id, dia, 'cuota', -27000, 'Cuota mensual' from rodar.moviles where plan_id = 2 union all
        select id, dia + interval '10 hours', 'pago', 27000, 'Pago en efectivo' from rodar.moviles where plan_id = 2 union all
        select id, dia + interval '10 hours 1 second', 'saldo_viajes', 27000, 'Saldo para viajes (tipo 1)' from rodar.moviles where plan_id = 2 union all
        select id, dia, 'cuota', -36000, 'Cuotas semanales' from rodar.moviles where plan_id = 3 union all
        select id, dia + interval '12 hours', 'pago', 36000, 'Pago transferencia' from rodar.moviles where plan_id = 3;
    end if;
  end loop;
  for mv in select * from rodar.moviles loop
    sal := rodar.saldo(mv.id); monto := round(rodar.azar(2000, 30000)::numeric, -2);
    if sal < monto then insert into rodar.cuenta_movimientos(movil_id, fecha, tipo, monto, detalle) values (mv.id, rodar.ahora() - interval '1 day', 'pago', monto - sal, 'Pagos acumulados (datos de ejemplo)'); end if;
  end loop;
  insert into rodar.cuenta_movimientos(movil_id, fecha, tipo, monto, detalle) values (7, rodar.ahora(), 'ajuste', -60000, 'Deuda de ejemplo');
  insert into rodar.penalizaciones(movil_id, hasta, usuario_id, motivo, creado) values (11, rodar.ahora() + interval '2 hours', 1, 'Rechazó 3 viajes seguidos', rodar.ahora());
  insert into rodar.negativos(cliente_id, movil_id, usuario_id, creado) values (3, 2, 1, rodar.ahora());
  insert into rodar.solicitudes_conductor(nombre, apellido, dni, telefono, email, patente, marca, modelo, anio, origen, docs, fecha) values ('Esteban', 'Quiroga', '35123456', '3454999000', 'esteban@ejemplo.local', 'AE123ZZ', 'Fiat', 'Cronos', 2021, 'web', '[{"tipo":"Licencia","archivo":null},{"tipo":"Seguro","archivo":null}]', rodar.ahora());
  insert into rodar.soporte_conv(tipo, movil_id, asunto, no_leidos, actualizado) values ('movil', 3, 'Consulta app conductor', 1, rodar.ahora()) returning id into nid;
  insert into rodar.soporte_msg(conv_id, de, texto, fecha) values (nid, 'movil', 'Hola, no me aparece la parada Terminal en el menú.', rodar.ahora());
  insert into rodar.soporte_conv(tipo, cliente_tel, cliente_alias, asunto, no_leidos, actualizado) values ('cliente', '3454400037', 'Pasajero demo', 'Consulta app pasajero', 1, rodar.ahora()) returning id into nid;
  insert into rodar.soporte_msg(conv_id, de, texto, fecha) values (nid, 'cliente', 'Me cobraron de más el viaje de ayer, ¿pueden revisar?', rodar.ahora());
  insert into rodar.chat_conv(canal, telefono, alias, no_leidos, actualizado) values ('whatsapp', '3454400074', 'Marta', 1, rodar.ahora()) returning id into nid;
  insert into rodar.chat_msg(conv_id, de, texto, fecha) values (nid, 'cliente', 'Hola! necesito un remis a Belgrano 845 por favor', rodar.ahora());
  insert into rodar.autoridades(nombre, cargo, organismo, direccion, email) values ('[Plantilla] Director/a de Tránsito', 'Director/a', 'Dirección de Tránsito Municipal', 'Palacio Municipal', 'transito@municipio.local');
  insert into rodar.acciones_usuarios(fecha, actor_id, actor, tipo, afectado, detalle) values (rodar.ahora(), 1, 'Admin Central', 'cliente_bloqueo', '3454400185', 'No se presentó 3 veces');
  -- recorridos de las últimas 6 horas para 6 móviles
  for mv in select * from rodar.moviles where numero <= 6 loop
    lat := mv.lat; lng := mv.lng; tt := rodar.ahora() - interval '6 hours'; est := 'disponible';
    objlat := clat + rodar.azar(-0.015, 0.015); objlng := clng + rodar.azar(-0.018, 0.018);
    while tt < rodar.ahora() loop
      r := rodar.avanzar(lat, lng, objlat, objlng, 120); lat := r[1]; lng := r[2];
      if r[3] = 1 then objlat := clat + rodar.azar(-0.015, 0.015); objlng := clng + rodar.azar(-0.018, 0.018); est := (array['disponible','con_pasajero','confirmado','en_parada'])[1 + floor(random() * 4)::int]; end if;
      insert into rodar.posiciones(movil_id, ts, lat, lng, estado, velocidad) values (mv.id, tt, lat, lng, est, case when est = 'en_parada' then 0 else rodar.azar(15, 45) end);
      tt := tt + interval '15 seconds';
    end loop;
  end loop;
end $$;

select rodar.seed();

-- ===================== Permisos =====================
do $$ begin
  if exists(select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema rodar from anon, authenticated';
    execute 'revoke all on all tables in schema rodar from anon, authenticated';
    execute 'revoke execute on all functions in schema rodar from public, anon, authenticated';
  end if;
end $$;
revoke execute on all functions in schema rodar from public;

-- Tiempo máximo por consulta para la API (Supabase trae 3 s para anon; los informes grandes pueden necesitar más)
do $$ begin
  if exists(select 1 from pg_roles where rolname = 'anon') then execute 'alter role anon set statement_timeout = ''20s'''; end if;
exception when others then raise notice 'No se pudo ajustar statement_timeout: %', sqlerrm; end $$;
notify pgrst, 'reload schema';

-- ===================== Ciclo automático con pg_cron (opcional pero recomendado) =====================
do $$ begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then raise notice 'pg_cron no está disponible: activalo en Database → Extensions (o Integrations → Cron) y volvé a correr este bloque.'; end;
  if exists(select 1 from pg_extension where extname = 'pg_cron') then
    begin perform cron.unschedule('rodar-ciclo'); exception when others then null; end;
    perform cron.schedule('rodar-ciclo', '5 seconds', 'select rodar.ciclo_cron()');
  end if;
exception when others then raise notice 'No se pudo programar el ciclo con pg_cron: %. El sistema igual funciona mientras haya un panel o una app abierta.', sqlerrm;
end $$;
