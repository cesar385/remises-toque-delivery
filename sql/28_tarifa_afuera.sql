-- Viajes afuera (larga distancia): desde X km el viaje se cobra a un precio fijo por km, independiente de la tabla de km.
-- Se guarda dentro de la tabla de la tarifa: tabla.afuera = { "desde_km": 15, "precio_km": 1800 }. Lo ajusta el administrador en Tarifas → 📋.
create or replace function rodar.calcular_monto(t rodar.tarifas, metros numeric, espera_seg numeric, indice numeric default 1) returns numeric language plpgsql immutable set search_path = rodar, public, extensions as $$
declare m numeric; red int; fd int; fe int := 0; mt numeric; af jsonb; desde numeric; pk numeric; esp numeric := 0;
begin
if t.id is null then return 0; end if;
if jsonb_array_length(coalesce(t.tabla -> 'km', '[]')) > 0 then
  mt := greatest(0, coalesce(metros, 0) - coalesce(t.cortesia_mts, 0));
  if t.con_espera then esp := rodar.precio_tabla_espera(t.tabla, greatest(0, coalesce(espera_seg, 0) - coalesce(t.cortesia_min, 0) * 60)); end if;
  af := t.tabla -> 'afuera'; desde := nullif(af ->> 'desde_km', '')::numeric; pk := nullif(af ->> 'precio_km', '')::numeric;
  if desde is not null and coalesce(pk, 0) > 0 and mt >= desde * 1000 then
    return round((ceil(mt / 100) / 10 * pk + esp) * coalesce(indice, 1));
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

-- Valor inicial: desde 15 km, $1800 por km (solo si la tarifa todavía no lo tiene configurado)
update rodar.tarifas set tabla = tabla || '{"afuera":{"desde_km":15,"precio_km":1800}}'::jsonb
where jsonb_array_length(coalesce(tabla -> 'km', '[]')) > 0 and not (tabla ? 'afuera');
notify pgrst, 'reload schema';
