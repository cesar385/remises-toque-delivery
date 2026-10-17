-- ===================== Núcleo: tarifas, cuentas, despacho =====================

create or replace function rodar.es_feriado(d date default null) returns boolean language sql stable as $$
  select exists(select 1 from rodar.feriados where fecha = coalesce(d, rodar.hoy())) $$;

create or replace function rodar.tarifa_vigente(p_ts timestamp default null) returns rodar.tarifas language plpgsql stable as $$
declare t rodar.tarifas; ts timestamp := coalesce(p_ts, rodar.ahora()); hm text; dow int; fer boolean;
begin
  hm := to_char(ts, 'HH24:MI'); dow := extract(dow from ts)::int; fer := rodar.es_feriado(ts::date);
  if fer then
    select * into t from rodar.tarifas where activa and feriado and
      (case when hora_desde <= hora_hasta then hm between hora_desde and hora_hasta else hm >= hora_desde or hm <= hora_hasta end)
      order by orden limit 1;
    if found then return t; end if;
  end if;
  select * into t from rodar.tarifas where activa and (dias::jsonb @> to_jsonb(dow)) and
    (case when hora_desde <= hora_hasta then hm between hora_desde and hora_hasta else hm >= hora_desde or hm <= hora_hasta end)
    order by orden limit 1;
  if not found then select * into t from rodar.tarifas where activa order by orden limit 1; end if;
  return t;
end $$;

create or replace function rodar.calcular_monto(t rodar.tarifas, metros numeric, espera_seg numeric, indice numeric default 1) returns numeric language plpgsql immutable as $$
declare m numeric; red int; fd int; fe int := 0;
begin
  if t.id is null then return 0; end if;
  red := greatest(1, coalesce(t.redondeo_mts, 100));
  m := greatest(0, coalesce(metros, 0) - coalesce(t.cortesia_mts, 0));
  m := ceil(m / red) * red;
  fd := floor(m / greatest(1, coalesce(t.ficha_mts, 100)));
  if t.con_espera then fe := floor(greatest(0, coalesce(espera_seg, 0) - coalesce(t.cortesia_min, 0) * 60) / greatest(1, coalesce(t.espera_seg, 60))); end if;
  return round((coalesce(t.bajada, 0) + (fd + fe) * coalesce(t.precio_ficha, 0)) * coalesce(indice, 1));
end $$;

create or replace function rodar.indice_zona(p_zona bigint, t rodar.tarifas) returns jsonb language plpgsql stable as $$
declare demanda int; libres int; habitual numeric; pasos int := 0; ind numeric; lluvia boolean;
begin
  if t.id is null or t.tipo <> 'dinamica' then return jsonb_build_object('indice', 1, 'modo', 'Fija', 'pasos', 0); end if;
  select count(*) into demanda from rodar.viajes where creado >= rodar.ahora() - interval '15 minutes' and (p_zona is null or zona_id = p_zona);
  select count(*) into libres from rodar.moviles where estado in ('disponible', 'en_parada');
  select greatest(1, count(*) / 30.0 / 96) into habitual from rodar.viajes where creado >= rodar.ahora() - interval '30 days' and (p_zona is null or zona_id = p_zona);
  lluvia := coalesce((rodar.cfg('clima') ->> 'lluvia')::boolean, false);
  if demanda > habitual * 1.5 then pasos := pasos + 1; end if;
  if demanda > habitual * 2.5 then pasos := pasos + 1; end if;
  if libres <= 2 then pasos := pasos + 1; end if;
  if libres = 0 then pasos := pasos + 1; end if;
  if lluvia then pasos := pasos + 1; end if;
  ind := least(1 + pasos * 0.05, 1 + coalesce(t.suba_max, 0) / 100);
  return jsonb_build_object('indice', round(ind, 2), 'modo', 'Dinámica', 'pasos', pasos, 'demanda', demanda, 'libres', libres);
end $$;

create or replace function rodar.estimar(olat float8, olng float8, dlat float8, dlng float8, p_canal text, p_medio text) returns jsonb language plpgsql stable as $$
declare t rodar.tarifas; z rodar.zonas; ind numeric; metros numeric := 0; monto numeric; c rodar.canales; mp rodar.medios_pago; aj int := 0;
begin
  t := rodar.tarifa_vigente();
  if t.id is null or olat is null then return null; end if;
  z := rodar.zona_de(olat, olng);
  ind := (rodar.indice_zona(z.id, t) ->> 'indice')::numeric;
  if dlat is not null then metros := rodar.dist(olat, olng, dlat, dlng) * 1.3; end if;
  monto := rodar.calcular_monto(t, metros, 0, ind);
  select * into c from rodar.canales where codigo = p_canal;
  select * into mp from rodar.medios_pago where codigo = p_medio;
  if c.promo then aj := aj + c.ajuste_pct; end if;
  if coalesce(mp.ajuste_pct, 0) <> 0 and (c.codigo is null or not c.promo or mp.aplica_promo) then aj := aj + mp.ajuste_pct; end if;
  monto := round(monto * (1 + aj / 100.0));
  return jsonb_build_object('monto', case when dlat is null then null else monto end, 'bajada', round(t.bajada * ind), 'km', round(metros / 1000, 2),
    'tarifa', t.nombre, 'tarifa_id', t.id, 'indice', ind, 'ajuste', aj, 'cobro', coalesce(c.cobro_modo, 'tarifado'));
end $$;

-- ---------- cuentas ----------
create or replace function rodar.saldo(p_movil bigint) returns numeric language sql stable as $$
  select coalesce(sum(monto), 0) from rodar.cuenta_movimientos where movil_id = p_movil $$;
create or replace function rodar.estado_cuenta(m rodar.moviles) returns jsonb language plpgsql stable as $$
declare p rodar.planes; s numeric; lim numeric; pr boolean; color text := 'verde'; texto text := 'Al día';
begin
  select * into p from rodar.planes where id = m.plan_id;
  s := rodar.saldo(m.id);
  lim := coalesce((rodar.cfg('dispatch') ->> 'deuda_bloqueo')::numeric, -5000);
  pr := m.prorroga_hasta is not null and m.prorroga_hasta > rodar.ahora();
  if not m.habilitado or m.estado = 'fuera_servicio' then color := 'gris'; texto := 'Inhabilitado / fuera de servicio';
  elsif p.id is null or p.sistema then color := 'azul'; texto := 'Habilitado sin plan';
  elsif s <= lim and not pr then color := 'rojo'; texto := 'Bloqueado por deuda';
  elsif s < coalesce(p.minimo, 0) then color := 'amarillo'; texto := 'Debajo del mínimo'; end if;
  return jsonb_build_object('saldo', s, 'color', color, 'texto', texto, 'plan', case when p.id is null then null else to_jsonb(p) end,
    'prorroga', case when pr then m.prorroga_hasta end, 'bloqueado', color = 'rojo',
    'sin_saldo', p.id is not null and p.modo_pago = 'prepago' and p.modo_cobro <> 'fijo' and s <= 0 and not p.sistema);
end $$;
create or replace function rodar.movimiento(p_movil bigint, p_tipo text, p_monto numeric, p_detalle text, p_usuario bigint, p_viaje bigint) returns void language sql as $$
  insert into rodar.cuenta_movimientos(movil_id, fecha, tipo, monto, detalle, usuario_id, viaje_id) values (p_movil, rodar.ahora(), p_tipo, p_monto, p_detalle, p_usuario, p_viaje) $$;
create or replace function rodar.registrar_pago(p_movil bigint, p_monto numeric, p_detalle text, p_usuario bigint, p_tipo text default 'pago') returns void language plpgsql as $$
declare m rodar.moviles; p rodar.planes;
begin
  perform rodar.movimiento(p_movil, p_tipo, p_monto, p_detalle, p_usuario, null);
  select * into m from rodar.moviles where id = p_movil;
  select * into p from rodar.planes where id = m.plan_id;
  if p.tipo1 and coalesce((rodar.cfg('tipo1_pend_' || p_movil) #>> '{}')::boolean, false) and rodar.saldo(p_movil) >= 0 then
    perform rodar.movimiento(p_movil, 'saldo_viajes', p.monto_fijo, 'Saldo para viajes incluido en la cuota (tipo 1)', null, null);
    perform rodar.cfg_set('tipo1_pend_' || p_movil, 'false');
  end if;
end $$;
create or replace function rodar.cobrar_viaje(v rodar.viajes) returns void language plpgsql as $$
declare m rodar.moviles; p rodar.planes; c numeric := 0;
begin
  select * into m from rodar.moviles where id = v.movil_id;
  select * into p from rodar.planes where id = m.plan_id;
  if p.id is null or p.sistema then return; end if;
  if p.modo_cobro in ('fijo_viaje', 'por_viaje') then c := p.monto_viaje; end if;
  if p.modo_cobro = 'porcentaje' then c := round(coalesce(v.monto, 0) * p.pct_viaje / 100); end if;
  if c > 0 then perform rodar.movimiento(m.id, 'viaje', -c, 'Viaje #' || v.id, null, v.id); end if;
end $$;
create or replace function rodar.ciclo_cuotas() returns void language plpgsql as $$
declare p rodar.planes; m rodar.moviles; d timestamp := rodar.ahora(); toca boolean; periodo text; sv numeric; n int;
begin
  for p in select * from rodar.planes where not sistema and monto_fijo > 0 loop
    if extract(hour from d)::int <> p.hora_cobro then continue; end if;
    toca := false;
    if p.periodicidad = 'semanal' and extract(dow from d)::int = p.dia_semana then toca := true; periodo := d::date::text; end if;
    if p.periodicidad = 'mensual' and extract(day from d)::int = p.dia_mes then toca := true; periodo := to_char(d, 'YYYY-MM'); end if;
    if p.periodicidad = 'quincenal' and extract(day from d)::int in (p.dia_mes, p.dia_mes + 15) then toca := true; periodo := d::date::text; end if;
    if not toca or rodar.cfg('cobro_plan_' || p.id) #>> '{}' = periodo then continue; end if;
    perform rodar.cfg_set('cobro_plan_' || p.id, to_jsonb(periodo));
    n := 0;
    for m in select * from rodar.moviles where plan_id = p.id and habilitado loop
      if p.tipo1 and p.vencer_saldo then
        select coalesce(sum(monto), 0) into sv from rodar.cuenta_movimientos where movil_id = m.id and tipo in ('saldo_viajes', 'viaje') and fecha >= d - interval '31 days';
        if sv > 0 then perform rodar.movimiento(m.id, 'vencimiento', -sv, 'Vence saldo prepago del período', null, null); end if;
      end if;
      perform rodar.movimiento(m.id, 'cuota', -p.monto_fijo, 'Cuota ' || p.descripcion || ' ' || periodo, null, null);
      perform rodar.cfg_set('tipo1_pend_' || m.id, to_jsonb(p.tipo1));
      n := n + 1;
    end loop;
    insert into rodar.acciones_usuarios(fecha, actor, tipo, afectado, detalle) values (d, 'sistema', 'cobro_cuotas', p.descripcion, n || ' móviles');
  end loop;
end $$;

-- ---------- representación pública ----------
create or replace function rodar.movil_publico(m rodar.moviles) returns jsonb language plpgsql stable as $$
declare cond text; ec jsonb; pen jsonb; z rodar.zonas;
begin
  select trim(nombre || ' ' || coalesce(apellido, '')) into cond from rodar.usuarios where id = m.conductor_id;
  ec := rodar.estado_cuenta(m);
  select jsonb_build_object('hasta', hasta, 'motivo', motivo) into pen from rodar.penalizaciones where movil_id = m.id and hasta > rodar.ahora() order by hasta desc limit 1;
  z := rodar.zona_de(m.lat, m.lng);
  return jsonb_build_object('id', m.id, 'numero', m.numero, 'patente', m.patente, 'marca', m.marca, 'modelo', m.modelo, 'color', m.color,
    'estado', m.estado, 'lat', m.lat, 'lng', m.lng, 'rumbo', m.rumbo, 'velocidad', m.velocidad, 'parada_id', m.parada_id, 'parada_ingreso', m.parada_ingreso,
    'ultima_senal', m.ultima_senal, 'conductor', cond, 'conductor_id', m.conductor_id, 'cuenta', ec ->> 'color', 'saldo', (ec ->> 'saldo')::numeric,
    'sin_saldo', (ec ->> 'sin_saldo')::boolean, 'bloqueado', (ec ->> 'bloqueado')::boolean, 'penalizado', pen, 'zona', z.nombre, 'habilitado', m.habilitado, 'simulado', m.simulado);
end $$;
create or replace function rodar.emitir_movil(p_id bigint) returns void language plpgsql as $$
declare m rodar.moviles;
begin
  select * into m from rodar.moviles where id = p_id;
  if found then perform rodar.emit('panel', 'movil', rodar.movil_publico(m)); end if;
end $$;

create or replace function rodar.viaje_detalle(p_id bigint) returns jsonb language sql stable as $$
  select to_jsonb(v) - 'rechazos' - 'oferta_expira' || jsonb_build_object('movil_numero', m.numero, 'movil_patente', m.patente, 'movil_marca', m.marca, 'movil_modelo', m.modelo, 'movil_color', m.color,
    'conductor', trim(u.nombre || ' ' || coalesce(u.apellido, '')), 'operador', trim(o.nombre || ' ' || coalesce(o.apellido, '')), 'zona', z.nombre)
  from rodar.viajes v left join rodar.moviles m on m.id = v.movil_id left join rodar.usuarios u on u.id = v.conductor_id
  left join rodar.usuarios o on o.id = v.operador_id left join rodar.zonas z on z.id = v.zona_id where v.id = p_id $$;

create or replace function rodar.publico_pasajero(p_id bigint) returns jsonb language sql stable as $$
  select jsonb_build_object('id', v.id, 'estado', v.estado, 'movil_numero', m.numero,
    'movil', nullif(trim(coalesce(m.marca, '') || ' ' || coalesce(m.modelo, '') || ' ' || coalesce(m.color, '')), ''), 'patente', m.patente,
    'conductor', trim(u.nombre || ' ' || coalesce(u.apellido, '')), 'pin', case when v.pin_requerido then v.pin end, 'monto', coalesce(v.monto, v.monto_estimado),
    'origen', v.origen_dir, 'destino', v.destino_dir, 'lat', m.lat, 'lng', m.lng, 'origen_lat', v.origen_lat, 'origen_lng', v.origen_lng,
    'destino_lat', v.destino_lat, 'destino_lng', v.destino_lng, 'calificacion', v.calificacion)
  from rodar.viajes v left join rodar.moviles m on m.id = v.movil_id left join rodar.usuarios u on u.id = v.conductor_id where v.id = p_id $$;

create or replace function rodar.emitir_viaje(p_id bigint) returns void language plpgsql as $$
declare d jsonb;
begin
  d := rodar.viaje_detalle(p_id);
  if d is null then return; end if;
  perform rodar.emit('panel', 'viaje', d);
  if d ->> 'movil_id' is not null then perform rodar.emit('movil-' || (d ->> 'movil_id'), 'viaje', jsonb_build_object('id', p_id, 'estado', d ->> 'estado')); end if;
  perform rodar.emit('viaje-' || p_id || '-' || rodar.firma(p_id), 'viaje', rodar.publico_pasajero(p_id));
end $$;

-- ---------- despacho ----------
create or replace function rodar.crear_viaje(d jsonb, op rodar.usuarios) returns bigint[] language plpgsql as $$
declare canal text := coalesce(rodar.t(d, 'canal'), 'centralita'); c rodar.canales; cli rodar.clientes; z rodar.zonas; est jsonb;
  pin_req boolean; cant int; grupo text; ids bigint[] := '{}'; nid bigint; i int; tel text := rodar.t(d, 'telefono'); dom_id bigint;
  olat float8 := (d ->> 'origen_lat')::float8; olng float8 := (d ->> 'origen_lng')::float8; prog timestamp := rodar.ts(d, 'programado');
begin
  select * into c from rodar.canales where codigo = canal;
  if tel is not null then
    select * into cli from rodar.clientes where telefono = tel;
    if not found then
      insert into rodar.clientes(telefono, alias, creado) values (tel, rodar.t(d, 'alias'), rodar.ahora()) returning * into cli;
    elsif rodar.t(d, 'alias') is not null and rodar.t(d, 'alias') is distinct from cli.alias then
      update rodar.clientes set alias = rodar.t(d, 'alias') where id = cli.id;
    end if;
    if cli.bloqueado then raise exception 'El cliente está bloqueado en el sistema: %', coalesce(cli.motivo_bloqueo, ''); end if;
    if cli.baja_at is not null then update rodar.clientes set baja_at = null where id = cli.id; end if;
    if rodar.t(d, 'origen_dir') is not null then
      select id into dom_id from rodar.cliente_domicilios where cliente_id = cli.id and direccion = rodar.t(d, 'origen_dir');
      if dom_id is not null then
        update rodar.cliente_domicilios set usos = usos + 1, ultimo_uso = rodar.ahora(), lat = coalesce(olat, lat), lng = coalesce(olng, lng), referencias = coalesce(rodar.t(d, 'origen_ref'), referencias) where id = dom_id;
      else
        insert into rodar.cliente_domicilios(cliente_id, direccion, localidad, provincia, referencias, lat, lng, ultimo_uso)
        values (cli.id, rodar.t(d, 'origen_dir'), rodar.t(d, 'origen_loc'), rodar.t(d, 'origen_prov'), rodar.t(d, 'origen_ref'), olat, olng, rodar.ahora());
      end if;
    end if;
  end if;
  z := rodar.zona_de(olat, olng);
  if olat is not null then est := rodar.estimar(olat, olng, (d ->> 'destino_lat')::float8, (d ->> 'destino_lng')::float8, canal, rodar.t(d, 'medio_pago')); end if;
  pin_req := case when d ? 'pin_requerido' and jsonb_typeof(d -> 'pin_requerido') <> 'null' then rodar.b(d, 'pin_requerido') else coalesce(c.exigir_pin, false) end;
  cant := greatest(1, least(5, coalesce(rodar.n(d, 'cantidad_moviles'), 1)::int));
  if cant > 1 then grupo := 'G' || extract(epoch from now())::bigint; end if;
  for i in 1 .. cant loop
    insert into rodar.viajes(cliente_id, telefono, alias, origen_dir, origen_loc, origen_prov, origen_ref, origen_lat, origen_lng,
      destino_dir, destino_loc, destino_prov, destino_ref, destino_lat, destino_lng, datos_movil, canal, origen_tipo, estado, operador_id, zona_id,
      creado, programado, monto_estimado, medio_pago, a_oferta, pin, pin_requerido, cantidad_moviles, corporativo_id, tarifa_id, indice, grupo, movil_id, conductor_id)
    values (cli.id, tel, coalesce(rodar.t(d, 'alias'), cli.alias), rodar.t(d, 'origen_dir'), rodar.t(d, 'origen_loc'), rodar.t(d, 'origen_prov'), rodar.t(d, 'origen_ref'), olat, olng,
      rodar.t(d, 'destino_dir'), rodar.t(d, 'destino_loc'), rodar.t(d, 'destino_prov'), rodar.t(d, 'destino_ref'), (d ->> 'destino_lat')::float8, (d ->> 'destino_lng')::float8,
      rodar.t(d, 'datos_movil'), canal, coalesce(rodar.t(d, 'origen_tipo'), 'central'), case when prog is not null then 'reserva' else coalesce(rodar.t(d, 'estado'), 'pendiente') end,
      op.id, z.id, rodar.ahora(), prog, coalesce(rodar.n(d, 'monto_fijo'), (est ->> 'monto')::numeric), coalesce(rodar.t(d, 'medio_pago'), 'efectivo'),
      rodar.b(d, 'a_oferta'), (1000 + floor(random() * 9000))::int::text, pin_req, cant, (rodar.n(d, 'corporativo_id'))::bigint,
      (est ->> 'tarifa_id')::bigint, coalesce((est ->> 'indice')::numeric, 1), grupo, (rodar.n(d, 'movil_id'))::bigint, (rodar.n(d, 'conductor_id'))::bigint)
    returning id into nid;
    ids := ids || nid;
  end loop;
  if op.id is not null then
    insert into rodar.conexion_diaria(usuario_id, fecha, segundos, cargados, tipo) values (op.id, rodar.hoy(), 0, cant, 'web')
    on conflict (usuario_id, fecha, tipo) do update set cargados = rodar.conexion_diaria.cargados + excluded.cargados;
  end if;
  foreach nid in array ids loop perform rodar.emitir_viaje(nid); end loop;
  return ids;
end $$;

create or replace function rodar.elegible(m rodar.moviles, v rodar.viajes) returns boolean language plpgsql stable as $$
declare ec jsonb;
begin
  if not m.habilitado or m.estado not in ('disponible', 'en_parada') or m.conductor_id is null then return false; end if;
  if m.id = any(coalesce(v.rechazos, '{}')) then return false; end if;
  if v.cliente_id is not null and exists(select 1 from rodar.negativos where cliente_id = v.cliente_id and movil_id = m.id) then return false; end if;
  if exists(select 1 from rodar.viajes where movil_id = m.id and estado in ('ofrecido', 'confirmado', 'en_curso')) then return false; end if;
  if exists(select 1 from rodar.penalizaciones where movil_id = m.id and hasta > rodar.ahora()) then return false; end if;
  ec := rodar.estado_cuenta(m);
  return not (ec ->> 'bloqueado')::boolean and not (ec ->> 'sin_saldo')::boolean;
end $$;

create or replace function rodar.candidato(v rodar.viajes) returns rodar.moviles language plpgsql stable as $$
declare m rodar.moviles; radio float8 := coalesce((rodar.cfg('dispatch') ->> 'radio_busqueda_m')::float8, 6000);
begin
  if v.zona_id is not null then
    select * into m from rodar.moviles x where x.estado = 'en_parada' and x.parada_id = v.zona_id and rodar.elegible(x, v) order by x.parada_ingreso limit 1;
    if found then return m; end if;
  end if;
  select * into m from rodar.moviles x where rodar.elegible(x, v)
    and (v.origen_lat is null or coalesce(rodar.dist(x.lat, x.lng, v.origen_lat, v.origen_lng), 1e9) <= radio)
    order by coalesce(rodar.dist(x.lat, x.lng, v.origen_lat, v.origen_lng), 1e9) limit 1;
  return m;
end $$;

create or replace function rodar.ofrecer(v rodar.viajes, m rodar.moviles) returns void language plpgsql as $$
declare t int := coalesce((rodar.cfg('dispatch') ->> 'timeout_oferta_seg')::int, 20);
begin
  update rodar.viajes set estado = 'ofrecido', movil_id = m.id, conductor_id = m.conductor_id, intentos = intentos + 1, oferta_expira = now() + make_interval(secs => t) where id = v.id;
  perform rodar.evento_movil(m.id, 'ofrecido', '#' || v.id, 'Viaje ofrecido');
  perform rodar.emit('movil-' || m.id, 'oferta', rodar.viaje_detalle(v.id) || jsonb_build_object('segundos', t));
  perform rodar.emitir_viaje(v.id);
end $$;

create or replace function rodar.aceptar(p_viaje bigint, p_movil bigint, p_manual boolean default false, u rodar.usuarios default null) returns void language plpgsql as $$
declare v rodar.viajes; m rodar.moviles;
begin
  select * into v from rodar.viajes where id = p_viaje for update;
  if not found or v.estado in ('finalizado', 'anulado', 'en_curso') then raise exception 'El viaje ya no está disponible'; end if;
  if v.estado = 'confirmado' and v.movil_id <> p_movil then raise exception 'El viaje ya fue tomado por otro móvil'; end if;
  select * into m from rodar.moviles where id = p_movil;
  update rodar.viajes set estado = 'confirmado', movil_id = p_movil, conductor_id = m.conductor_id, asignado_at = rodar.ahora(), a_oferta = false, oferta_expira = null where id = p_viaje;
  update rodar.moviles set estado = 'confirmado', parada_id = null, parada_ingreso = null where id = p_movil;
  perform rodar.evento_movil(p_movil, case when p_manual then 'asignado_manual' else 'aceptado' end, '#' || p_viaje,
    case when p_manual then 'Asignado por ' || coalesce(u.nombre, 'operador') else 'Viaje aceptado' end);
  perform rodar.emitir_viaje(p_viaje); perform rodar.emitir_movil(p_movil);
  perform rodar.emit('flota', 'oferta_tomada', jsonb_build_object('viajeId', p_viaje));
end $$;

create or replace function rodar.rechazar(p_viaje bigint, p_movil bigint, p_motivo text default 'rechazado_movil') returns void language plpgsql as $$
declare v rodar.viajes;
begin
  select * into v from rodar.viajes where id = p_viaje;
  if not found or v.movil_id is distinct from p_movil or v.estado <> 'ofrecido' then return; end if;
  update rodar.viajes set estado = 'pendiente', movil_id = null, conductor_id = null, rechazos = array_append(rechazos, p_movil), oferta_expira = null where id = p_viaje;
  perform rodar.evento_movil(p_movil, p_motivo, '#' || p_viaje, case when p_motivo = 'timeout' then 'No respondió a tiempo' else 'Rechazó el viaje' end);
  perform rodar.emitir_viaje(p_viaje);
  perform rodar.emit('movil-' || p_movil, 'oferta_cancelada', jsonb_build_object('viajeId', p_viaje));
end $$;

-- Ciclo de despacho: se ejecuta con cada operación relevante, desde el panel/app (tick) y con pg_cron si está activo
create or replace function rodar.procesar() returns void language plpgsql as $$
declare v rodar.viajes; m rodar.moviles; maxi int := coalesce((rodar.cfg('dispatch') ->> 'max_intentos')::int, 5); n int;
begin
  if not pg_try_advisory_xact_lock(424242) then return; end if;
  update rodar.viajes set estado = 'pendiente' where estado = 'reserva' and programado <= rodar.ahora() + interval '10 minutes';
  get diagnostics n = row_count;
  if n > 0 then perform rodar.emit('panel', 'refrescar_viajes', '{}'); end if;
  for v in select * from rodar.viajes where estado = 'ofrecido' and oferta_expira < now() loop
    perform rodar.rechazar(v.id, v.movil_id, 'timeout');
  end loop;
  for v in select * from rodar.viajes where estado = 'pendiente' and not a_oferta and intentos < maxi order by creado loop
    m := rodar.candidato(v);
    if m.id is not null then perform rodar.ofrecer(v, m); end if;
  end loop;
  for v in select * from rodar.viajes where estado = 'pendiente' and a_oferta loop
    for m in select * from rodar.moviles x where rodar.elegible(x, v) loop
      perform rodar.emit('movil-' || m.id, 'oferta_abierta', rodar.viaje_detalle(v.id));
    end loop;
  end loop;
end $$;

create or replace function rodar.ciclo_lento() returns void language plpgsql as $$
declare c rodar.clientes; ult timestamp := (rodar.cfg('ultimo_ciclo_lento') #>> '{}')::timestamp;
begin
  if ult is not null and ult > rodar.ahora() - interval '55 seconds' then return; end if;
  perform rodar.cfg_set('ultimo_ciclo_lento', to_jsonb(rodar.ahora()));
  perform rodar.ciclo_cuotas();
  -- horas de conexión: suma 60s a las sesiones con actividad reciente
  insert into rodar.conexion_diaria(usuario_id, fecha, segundos, tipo)
    select distinct usuario_id, rodar.hoy(), 60, tipo from rodar.sesiones where activa and ultimo >= rodar.ahora() - interval '2 minutes'
  on conflict (usuario_id, fecha, tipo) do update set segundos = rodar.conexion_diaria.segundos + 60;
  insert into rodar.conexion_diaria(usuario_id, fecha, segundos, tipo)
    select distinct conductor_id, rodar.hoy(), 60, 'app' from rodar.moviles where simulado and conductor_id is not null and estado <> 'desconectado'
      and ultima_senal >= rodar.ahora() - interval '2 minutes'
  on conflict (usuario_id, fecha, tipo) do update set segundos = rodar.conexion_diaria.segundos + 60;
  for c in select * from rodar.clientes where baja_at is not null and baja_at <= rodar.ahora() - interval '7 days' loop
    update rodar.viajes set cliente_id = null where cliente_id = c.id;
    delete from rodar.clientes where id = c.id;
    insert into rodar.acciones_usuarios(fecha, actor, tipo, afectado, detalle) values (rodar.ahora(), 'sistema', 'cliente_purge_cron', c.telefono, 'Borrado físico tras 7 días');
  end loop;
  delete from rodar.posiciones where ts < rodar.ahora() - interval '120 days';
  delete from rodar.limite_pedidos where ts < now() - interval '1 hour';
end $$;

create or replace function rodar.llegada(p_viaje bigint) returns void language plpgsql as $$
begin update rodar.viajes set llegada_at = rodar.ahora() where id = p_viaje; perform rodar.emitir_viaje(p_viaje); end $$;

create or replace function rodar.iniciar(p_viaje bigint, p_pin text) returns void language plpgsql as $$
declare v rodar.viajes;
begin
  select * into v from rodar.viajes where id = p_viaje;
  if not found or v.estado <> 'confirmado' then raise exception 'El viaje no está confirmado'; end if;
  if v.pin_requerido and coalesce(p_pin, '') <> v.pin then raise exception 'PIN incorrecto'; end if;
  update rodar.viajes set estado = 'en_curso', inicio_at = rodar.ahora() where id = p_viaje;
  update rodar.moviles set estado = 'con_pasajero' where id = v.movil_id;
  perform rodar.emitir_viaje(p_viaje); perform rodar.emitir_movil(v.movil_id);
end $$;

create or replace function rodar.finalizar(p_viaje bigint, p_metros numeric, p_espera numeric, p_monto numeric, dlat float8 default null, dlng float8 default null, ddir text default null) returns jsonb language plpgsql as $$
declare v rodar.viajes; t rodar.tarifas; c rodar.canales; total numeric := p_monto; mins numeric; mp jsonb; tasa numeric; dias int; vf rodar.viajes;
begin
  select * into v from rodar.viajes where id = p_viaje;
  if not found or v.estado not in ('en_curso', 'confirmado') then raise exception 'El viaje no está en curso'; end if;
  select * into t from rodar.tarifas where id = v.tarifa_id;
  if t.id is null then t := rodar.tarifa_vigente(); end if;
  select * into c from rodar.canales where codigo = v.canal;
  if total is null then
    if c.cobro_modo = 'fijo' and v.monto_estimado is not null then total := v.monto_estimado;
    elsif c.cobro_modo = 'pagado' then total := 0;
    else total := rodar.calcular_monto(t, coalesce(p_metros, 0), coalesce(p_espera, 0), coalesce(v.indice, 1)); end if;
  end if;
  mins := round(extract(epoch from (rodar.ahora() - coalesce(v.inicio_at, rodar.ahora()))) / 60.0, 1);
  update rodar.viajes set estado = 'finalizado', fin_at = rodar.ahora(), monto = total, km = case when p_metros is not null then round(p_metros / 1000, 2) else km end,
    minutos = mins, espera_min = round(coalesce(p_espera, 0) / 60.0, 1), destino_lat = coalesce(destino_lat, dlat), destino_lng = coalesce(destino_lng, dlng), destino_dir = coalesce(destino_dir, ddir)
    where id = p_viaje returning * into vf;
  update rodar.moviles set estado = 'disponible' where id = v.movil_id;
  perform rodar.cobrar_viaje(vf);
  if vf.medio_pago = 'mercadopago' then
    mp := rodar.cfg('mp', '{}');
    tasa := coalesce((mp -> 'tasas' ->> coalesce(mp ->> 'plazo', 'inmediata'))::numeric, 0);
    dias := case coalesce(mp ->> 'plazo', 'inmediata') when 'd10' then 10 when 'd18' then 18 when 'd35' then 35 else 0 end;
    insert into rodar.mp_pagos(tipo, movil_id, viaje_id, monto, comision, estado, acreditado, liberacion, fecha)
    values ('viaje', vf.movil_id, vf.id, total, round(total * tasa / 100, 2), 'pendiente', false, rodar.hoy() + dias, rodar.ahora());
  end if;
  perform rodar.emitir_viaje(p_viaje); perform rodar.emitir_movil(v.movil_id);
  return rodar.viaje_detalle(p_viaje);
end $$;

create or replace function rodar.anular(p_viaje bigint, u rodar.usuarios, p_motivo text) returns void language plpgsql as $$
declare v rodar.viajes;
begin
  select * into v from rodar.viajes where id = p_viaje;
  if not found or v.estado in ('finalizado', 'anulado') then raise exception 'No se puede anular'; end if;
  update rodar.viajes set estado = 'anulado', anulado_at = rodar.ahora(), oferta_expira = null,
    motivo_anulacion = coalesce(nullif(p_motivo, ''), case when u.id is not null then 'Anulado por ' || u.nombre else 'Anulado' end) where id = p_viaje;
  if v.movil_id is not null and v.estado in ('confirmado', 'en_curso', 'ofrecido') then
    update rodar.moviles set estado = 'disponible' where id = v.movil_id and estado in ('confirmado', 'con_pasajero');
    perform rodar.emit('movil-' || v.movil_id, 'oferta_cancelada', jsonb_build_object('viajeId', p_viaje));
    perform rodar.emitir_movil(v.movil_id);
  end if;
  perform rodar.emitir_viaje(p_viaje);
end $$;

create or replace function rodar.reasignar(p_viaje bigint) returns void language plpgsql as $$
declare v rodar.viajes;
begin
  select * into v from rodar.viajes where id = p_viaje;
  if not found or v.estado not in ('ofrecido', 'confirmado', 'pendiente') then raise exception 'No se puede reenviar'; end if;
  if v.movil_id is not null then
    update rodar.moviles set estado = 'disponible' where id = v.movil_id and estado = 'confirmado';
    perform rodar.emit('movil-' || v.movil_id, 'oferta_cancelada', jsonb_build_object('viajeId', p_viaje));
    perform rodar.emitir_movil(v.movil_id);
  end if;
  update rodar.viajes set estado = 'pendiente', movil_id = null, conductor_id = null, intentos = 0, oferta_expira = null,
    rechazos = case when v.movil_id is not null then array_append(rechazos, v.movil_id) else rechazos end where id = p_viaje;
  perform rodar.emitir_viaje(p_viaje);
  perform rodar.procesar();
end $$;

create or replace function rodar.set_estado_movil(p_id bigint, p_estado text, p_parada bigint default null, p_operador boolean default false) returns void language plpgsql as $$
declare m rodar.moviles; z rodar.zonas;
begin
  select * into m from rodar.moviles where id = p_id;
  if not found then return; end if;
  if p_estado = 'en_parada' then
    if p_parada is not null then select * into z from rodar.zonas where id = p_parada; else z := rodar.zona_de(m.lat, m.lng); end if;
    if z.id is null then raise exception 'No estás dentro de una zona con parada'; end if;
    update rodar.moviles set estado = 'en_parada', parada_id = z.id, parada_ingreso = rodar.ahora() where id = p_id;
    perform rodar.evento_movil(p_id, 'qta_parada', z.nombre, 'Ingresó a la parada ' || z.nombre);
  else
    if m.estado = 'en_parada' then perform rodar.evento_movil(p_id, case when p_operador then 'salida_parada_operador' else 'salida_parada' end, null, 'Salió de la parada'); end if;
    update rodar.moviles set estado = p_estado, parada_id = null, parada_ingreso = null where id = p_id;
  end if;
  perform rodar.emitir_movil(p_id);
end $$;

create or replace function rodar.posicion(p_id bigint, p_lat float8, p_lng float8, p_vel float8, p_rumbo float8, p_registrar boolean default true) returns void language plpgsql as $$
declare m rodar.moviles; ult timestamp;
begin
  update rodar.moviles set lat = p_lat, lng = p_lng, velocidad = p_vel, rumbo = coalesce(p_rumbo, rumbo), ultima_senal = rodar.ahora() where id = p_id returning * into m;
  if p_registrar then
    select max(ts) into ult from rodar.posiciones where movil_id = p_id;
    if ult is null or ult < rodar.ahora() - interval '14 seconds' then
      insert into rodar.posiciones(movil_id, ts, lat, lng, estado, velocidad) values (p_id, rodar.ahora(), p_lat, p_lng, m.estado, coalesce(p_vel, 0));
    end if;
  end if;
end $$;
