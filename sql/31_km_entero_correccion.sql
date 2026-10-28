-- Viajes afuera: se cobra por km entero hacia arriba (26,1 a 27,0 km = 27 km).
-- Corrección del GPS: porcentaje ajustable (tabla.correccion_pct, inicial +4,5%) que se suma a la distancia medida al finalizar.
create or replace function rodar.calcular_monto(t rodar.tarifas, metros numeric, espera_seg numeric, indice numeric default 1) returns numeric language plpgsql immutable set search_path = rodar, public, extensions as $$
declare m numeric; red int; fd int; fe int := 0; mt numeric; af jsonb; desde numeric; pk numeric; esp numeric := 0;
begin
if t.id is null then return 0; end if;
if jsonb_array_length(coalesce(t.tabla -> 'km', '[]')) > 0 then
  mt := greatest(0, coalesce(metros, 0) - coalesce(t.cortesia_mts, 0));
  if t.con_espera then esp := rodar.precio_tabla_espera(t.tabla, greatest(0, coalesce(espera_seg, 0) - coalesce(t.cortesia_min, 0) * 60)); end if;
  af := t.tabla -> 'afuera'; desde := nullif(af ->> 'desde_km', '')::numeric; pk := nullif(af ->> 'precio_km', '')::numeric;
  if desde is not null and coalesce(pk, 0) > 0 and mt >= desde * 1000 then
    return round((ceil(mt / 1000) * pk + esp) * coalesce(indice, 1)); -- km entero hacia arriba
  end if;
  return round((rodar.precio_tabla_km(t.tabla, mt) + esp) * coalesce(indice, 1));
end if;
red := greatest(1, coalesce(t.redondeo_mts, 100));
m := greatest(0, coalesce(metros, 0) - coalesce(t.cortesia_mts, 0));
m := ceil(m / red) * red;
fd := floor(m / greatest(1, coalesce(t.ficha_mts, 100)));
if t.con_espera then fe := floor(greatest(0, coalesce(espera_seg, 0) - coalesce(t.cortesia_min, 0) * 60) / greatest(1, coalesce(t.espera_seg, 60))); end if;
return round((coalesce(t.bajada, 0) + (fd + fe) * coalesce(t.precio_ficha, 0)) * coalesce(indice, 1));
end $$;


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
    -- corrección del GPS (el GPS del celular mide algo menos que el odómetro); se ajusta en Tarifas → 📋
    metros := metros * (1 + greatest(-20, least(30, coalesce(nullif(t.tabla ->> 'correccion_pct', '')::numeric, 0))) / 100);
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


update rodar.tarifas set tabla = tabla || '{"correccion_pct":4.5}'::jsonb
where jsonb_array_length(coalesce(tabla -> 'km', '[]')) > 0 and not (tabla ? 'correccion_pct');
notify pgrst, 'reload schema';
