-- ===================== Mejoras de delivery: tiempo estimado, tablero del operador y ganancias de repartidores =====================
-- Se puede volver a correr. Tiene que correr después de 33_rubros_vehiculo.sql y 34_repartidores.sql.

-- ---------- tiempo estimado de llegada (minutos) ----------
-- En camino: distancia del repartidor al destino. Antes: lo que falta de preparación + el viaje (+ espera si todavía no hay repartidor).
create or replace function rodar.dlv_eta(p rodar.dlv_pedidos) returns int language plpgsql stable as $$
declare neg rodar.dlv_negocios; mv rodar.moviles; vel numeric := case when p.vehiculo = 'moto' then 28 else 24 end; km numeric; resto numeric; prep numeric;
begin
  if p.estado in ('entregado', 'cancelado', 'cancelacion_solicitada') or p.tipo_entrega = 'retiro' then return null; end if;
  if p.estado in ('recogido', 'en_camino') then
    select * into mv from rodar.moviles where id = p.movil_id;
    km := coalesce(rodar.dist(mv.lat, mv.lng, p.entrega_lat, p.entrega_lng), rodar.dist(p.recogida_lat, p.recogida_lng, p.entrega_lat, p.entrega_lng), 2000) / 1000 * 1.3;
    return greatest(2, ceil(km / vel * 60) + 2)::int;
  end if;
  select * into neg from rodar.dlv_negocios where id = p.negocio_id;
  prep := coalesce(neg.tiempo_prep, 20);
  resto := case when p.estado = 'pendiente' then prep + 3
    else greatest(0, prep - coalesce(extract(epoch from (rodar.ahora() - coalesce(p.confirmado_at, p.creado))) / 60, 0)) end;
  km := coalesce(rodar.dist(p.recogida_lat, p.recogida_lng, p.entrega_lat, p.entrega_lng), 2000) / 1000 * 1.3;
  return ceil(resto + km / vel * 60 + 4 + case when p.movil_id is null then 5 else 0 end)::int; end $$;

-- ---------- seguimiento del cliente: + tiempo estimado, negocio (para "pedir de nuevo") y si se está buscando repartidor ----------
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
    'negocio_id', p.negocio_id, 'eta_min', rodar.dlv_eta(p), 'buscando_repartidor', p.movil_id is null and p.buscando_desde is not null and p.estado not in ('entregado', 'cancelado'),
    'rubro_tipo', rodar.dlv_rubro_tipo(p.negocio_id), 'vocab', rodar.dlv_vocab(rodar.dlv_rubro_tipo(p.negocio_id)), 'vehiculo', coalesce(p.vehiculo, 'cualquiera'),
    'entrega_lat', p.entrega_lat, 'entrega_lng', p.entrega_lng, 'recogida_lat', p.recogida_lat, 'recogida_lng', p.recogida_lng,
    'pago', jsonb_build_object('online', p.medio_pago = 'online', 'pagado', p.pagado, 'vence', p.pago_vence, 'reembolso', coalesce(p.reembolso, 0),
       'pendiente', p.medio_pago = 'online' and not p.pagado and p.estado = 'pendiente' and p.pago_vence >= rodar.ahora()),
    'canal', 'dlv-' || p.id || '-' || rodar.firma(p.id),
    'repartidor', case when p.movil_id is not null and p.estado not in ('entregado', 'cancelado') then jsonb_build_object('movil', j->'movil_numero', 'nombre', j->'conductor', 'lat', j->'movil_lat', 'lng', j->'movil_lng', 'vehiculo', (select tipo_vehiculo from rodar.moviles where id = p.movil_id)) end,
    'puede_cancelar', p.estado not in ('entregado', 'cancelado', 'cancelacion_solicitada', 'recogido', 'en_camino') and
       ((p.estado = 'pendiente' and rodar.b(c, 'cancel_cliente_antes')) or p.estado <> 'pendiente'),
    'cancela_directo', coalesce((p.estado = 'pendiente' and rodar.b(c, 'cancel_cliente_antes')) or (p.estado <> 'pendiente' and rodar.b(c, 'cancel_cliente_despues'))
      or (rodar.n(c, 'cancelar_sin_repartidor') > 0 and p.buscando_desde < rodar.ahora() - make_interval(mins => rodar.n(c, 'cancelar_sin_repartidor')::int) and p.movil_id is null), false)); end $$;

-- ---------- tablero del operador: pedidos activos con demoras ----------
create or replace function public.r_dlv_tablero(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c jsonb := rodar.dlv_cfg();
begin
  perform rodar.need(p_token, 'admin', 'gestion', 'operador');
  perform rodar.dlv_ciclo();
  return jsonb_build_object(
    'pedidos', coalesce((select jsonb_agg(rodar.dlv_pedido_json(p) - 'historial' || jsonb_build_object(
        'edad_min', floor(extract(epoch from (rodar.ahora() - p.creado)) / 60),
        'en_estado_min', floor(extract(epoch from (rodar.ahora() - coalesce(case p.estado when 'confirmado' then p.confirmado_at when 'listo' then p.listo_at when 'recogido' then p.recogido_at when 'en_camino' then p.recogido_at end, p.creado))) / 60),
        'busca_min', case when p.movil_id is null and p.buscando_desde is not null then floor(extract(epoch from (rodar.ahora() - p.buscando_desde)) / 60) end,
        'tiempo_prep', (select tiempo_prep from rodar.dlv_negocios where id = p.negocio_id),
        'eta_min', rodar.dlv_eta(p), 'vehiculo_movil', (select tipo_vehiculo from rodar.moviles where id = p.movil_id)) order by p.creado)
      from rodar.dlv_pedidos p where p.estado not in ('entregado', 'cancelado') and not (p.medio_pago = 'online' and not p.pagado and p.estado = 'pendiente')), '[]'),
    'hoy', (select jsonb_build_object('pedidos', count(*), 'entregados', count(*) filter (where estado = 'entregado'), 'cancelados', count(*) filter (where estado = 'cancelado'),
        'facturado', coalesce(sum(total) filter (where estado = 'entregado'), 0)) from rodar.dlv_pedidos where creado::date = rodar.ahora()::date),
    'repartidores', jsonb_build_object('conectados', (select count(*) from rodar.moviles m join rodar.dlv_repartidores r on r.movil_id = m.id where m.estado in ('disponible', 'en_parada', 'confirmado', 'con_pasajero')),
        'libres', (select count(*) from rodar.moviles m join rodar.dlv_repartidores r on r.movil_id = m.id where m.estado in ('disponible', 'en_parada'))),
    'alertas', jsonb_build_object('sin_aceptar', coalesce(rodar.n(c, 'alerta_sin_aceptar'), 5), 'sin_repartidor', coalesce(nullif(rodar.n(c, 'aviso_sin_tomar'), 0), 5), 'demora_extra', 10)); end $$;

-- ---------- ganancias de un repartidor (central) ----------
create or replace function public.r_rep_ganancias(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare uid bigint := rodar.n(p_q, 'id')::bigint; d date := coalesce((nullif(p_q ->> 'desde', ''))::date, (rodar.ahora() - interval '30 days')::date); h date := coalesce((nullif(p_q ->> 'hasta', ''))::date, rodar.ahora()::date);
begin
  perform rodar.need(p_token, 'admin', 'gestion', 'operador');
  if not exists (select 1 from rodar.dlv_repartidores where usuario_id = uid) then raise exception 'Repartidor no encontrado'; end if;
  return jsonb_build_object('desde', d, 'hasta', h, 'resumen', rodar.rep_resumen(uid),
    'periodo', (select jsonb_build_object('entregas', count(*), 'envios', coalesce(sum(envio), 0), 'propinas', coalesce(sum(propina), 0), 'comision', coalesce(sum(comision_repartidor), 0), 'ganado', coalesce(sum(rodar.rep_ganado(p)), 0))
      from rodar.dlv_pedidos p where conductor_id = uid and estado = 'entregado' and tipo_entrega = 'entrega' and entregado_at::date between d and h),
    'entregas', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'codigo', p.codigo, 'fecha', p.entregado_at, 'negocio', coalesce((select nombre from rodar.dlv_negocios where id = p.negocio_id), 'Envío directo'),
        'cliente', p.cliente_nombre, 'entrega_dir', p.entrega_dir, 'envio', p.envio, 'propina', p.propina, 'comision', p.comision_repartidor, 'ganancia', rodar.rep_ganado(p), 'medio_pago', p.medio_pago) order by p.entregado_at desc)
      from (select * from rodar.dlv_pedidos where conductor_id = uid and estado = 'entregado' and tipo_entrega = 'entrega' and entregado_at::date between d and h order by entregado_at desc limit 500) p), '[]')); end $$;

grant execute on function public.r_dlv_pub_seguir(text, jsonb, jsonb), public.r_dlv_tablero(text, jsonb, jsonb), public.r_rep_ganancias(text, jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
