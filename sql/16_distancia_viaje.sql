-- ===================== Distancia del viaje más confiable =====================
-- Problema: el tarifador de la app suma los metros del GPS del celular. Si el celular tiene la pantalla apagada o la app en segundo plano,
-- el GPS "salta" y la app descartaba esos tramos: un viaje de ~3 km terminaba cobrando la tarifa mínima.
-- Solución: al finalizar, el servidor calcula la distancia con las posiciones que el móvil fue enviando durante el viaje
-- y con la distancia en línea recta (x1,15) origen → destino, y cobra la MAYOR entre eso y lo que midió la app.

-- Suma de tramos entre posiciones registradas. Ignora el ruido del GPS parado (< 15 m) y los saltos imposibles (> 150 km/h).
create or replace function rodar.metros_recorridos(p_movil bigint, p_desde timestamp, p_hasta timestamp) returns numeric language sql stable as $$
  select coalesce(sum(d), 0)::numeric from (
    select rodar.dist(lag(lat) over w, lag(lng) over w, lat, lng) d, extract(epoch from ts - lag(ts) over w) dt
    from rodar.posiciones where movil_id = p_movil and ts between p_desde and p_hasta window w as (order by ts)
  ) x where d >= 15 and (dt is null or dt <= 0 or d <= dt * 41.7) $$;

create or replace function rodar.finalizar(p_viaje bigint, p_metros numeric, p_espera numeric, p_monto numeric, dlat float8 default null, dlng float8 default null, ddir text default null) returns jsonb language plpgsql as $$
declare v rodar.viajes; t rodar.tarifas; c rodar.canales; total numeric := p_monto; mins numeric; mp jsonb; tasa numeric; dias int; vf rodar.viajes; metros numeric := p_metros; mpos numeric; recta numeric; sim boolean;
begin
  select * into v from rodar.viajes where id = p_viaje;
  if not found or v.estado not in ('en_curso', 'confirmado') then raise exception 'El viaje no está en curso'; end if;
  select * into t from rodar.tarifas where id = v.tarifa_id;
  if t.id is null then t := rodar.tarifa_vigente(); end if;
  select * into c from rodar.canales where codigo = v.canal;
  -- Distancia: la app suma los metros del GPS del celular, pero si el celular estuvo en segundo plano o con la pantalla apagada
  -- pierde tramos y el viaje queda en la tarifa mínima. Se compara con el recorrido que registró el servidor y con la distancia en
  -- línea recta hasta el destino, y se cobra la mayor.
  select coalesce(simulado, false) into sim from rodar.moviles where id = v.movil_id;
  if p_metros is not null and not coalesce(sim, false) and v.inicio_at is not null then
    mpos := rodar.metros_recorridos(v.movil_id, v.inicio_at - interval '20 seconds', rodar.ahora());
    recta := case when v.origen_lat is not null and coalesce(dlat, v.destino_lat) is not null then rodar.dist(v.origen_lat, v.origen_lng, coalesce(dlat, v.destino_lat), coalesce(dlng, v.destino_lng)) * 1.15 end;
    metros := greatest(p_metros, coalesce(mpos, 0), coalesce(recta, 0));
  end if;
  if total is null then
    if c.cobro_modo = 'fijo' and v.monto_estimado is not null then total := v.monto_estimado;
    elsif c.cobro_modo = 'pagado' then total := 0;
    else total := rodar.calcular_monto(t, coalesce(metros, 0), coalesce(p_espera, 0), coalesce(v.indice, 1)); end if;
  end if;
  mins := round(extract(epoch from (rodar.ahora() - coalesce(v.inicio_at, rodar.ahora()))) / 60.0, 1);
  update rodar.viajes set estado = 'finalizado', fin_at = rodar.ahora(), monto = total, km = case when metros is not null then round(metros / 1000, 2) else km end,
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

notify pgrst, 'reload schema';
