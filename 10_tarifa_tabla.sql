-- Tarifa por tabla (precio por kilómetro recorrido y por minutos de espera), en lugar de bajada + fichas.
alter table rodar.tarifas add column if not exists tabla jsonb;

create or replace function rodar.precio_tabla_km(tabla jsonb, metros numeric) returns numeric language plpgsql immutable set search_path = rodar, public, extensions as $$
declare u int := floor(greatest(0, coalesce(metros, 0)) / 100); p numeric; lu int; lp numeric;
cada int := greatest(1, coalesce((tabla -> 'extra' ->> 'cada_m')::int, 400) / 100); monto numeric := coalesce((tabla -> 'extra' ->> 'monto')::numeric, 0);
begin
if jsonb_array_length(coalesce(tabla -> 'km', '[]')) = 0 then return 0; end if;
select round((e ->> 0)::numeric * 10)::int, (e ->> 1)::numeric into lu, lp from jsonb_array_elements(tabla -> 'km') e order by (e ->> 0)::numeric desc limit 1;
if u > lu then return lp + ceil((u - lu)::numeric / cada) * monto; end if;
select (e ->> 1)::numeric into p from jsonb_array_elements(tabla -> 'km') e where round((e ->> 0)::numeric * 10) <= u order by (e ->> 0)::numeric desc limit 1;
if p is null then select (e ->> 1)::numeric into p from jsonb_array_elements(tabla -> 'km') e order by (e ->> 0)::numeric limit 1; end if;
return p;
end $$;

create or replace function rodar.precio_tabla_espera(tabla jsonb, seg numeric) returns numeric language plpgsql immutable set search_path = rodar, public, extensions as $$
declare mi int := floor(greatest(0, coalesce(seg, 0)) / 60); p numeric; lm int; lp numeric;
cada int := greatest(1, coalesce((tabla -> 'espera_extra' ->> 'cada_min')::int, 5)); monto numeric := coalesce((tabla -> 'espera_extra' ->> 'monto')::numeric, 0);
begin
if jsonb_array_length(coalesce(tabla -> 'espera', '[]')) = 0 then return 0; end if;
select (e ->> 0)::int, (e ->> 1)::numeric into lm, lp from jsonb_array_elements(tabla -> 'espera') e order by (e ->> 0)::int desc limit 1;
if mi > lm then return lp + floor((mi - lm)::numeric / cada) * monto; end if;
select (e ->> 1)::numeric into p from jsonb_array_elements(tabla -> 'espera') e where (e ->> 0)::int <= mi order by (e ->> 0)::int desc limit 1;
return coalesce(p, 0);
end $$;

create or replace function rodar.calcular_monto(t rodar.tarifas, metros numeric, espera_seg numeric, indice numeric default 1) returns numeric language plpgsql immutable set search_path = rodar, public, extensions as $$
declare m numeric; red int; fd int; fe int := 0;
begin
if t.id is null then return 0; end if;
if jsonb_array_length(coalesce(t.tabla -> 'km', '[]')) > 0 then
return round((rodar.precio_tabla_km(t.tabla, greatest(0, coalesce(metros, 0) - coalesce(t.cortesia_mts, 0)))
+ case when t.con_espera then rodar.precio_tabla_espera(t.tabla, greatest(0, coalesce(espera_seg, 0) - coalesce(t.cortesia_min, 0) * 60)) else 0 end) * coalesce(indice, 1));
end if;
red := greatest(1, coalesce(t.redondeo_mts, 100));
m := greatest(0, coalesce(metros, 0) - coalesce(t.cortesia_mts, 0));
m := ceil(m / red) * red;
fd := floor(m / greatest(1, coalesce(t.ficha_mts, 100)));
if t.con_espera then fe := floor(greatest(0, coalesce(espera_seg, 0) - coalesce(t.cortesia_min, 0) * 60) / greatest(1, coalesce(t.espera_seg, 60))); end if;
return round((coalesce(t.bajada, 0) + (fd + fe) * coalesce(t.precio_ficha, 0)) * coalesce(indice, 1));
end $$;

-- guardar la tabla desde la pantalla de Tarifas
create or replace function public.r_tarifa_tabla(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare tb jsonb := p_b -> 'tabla';
begin
perform rodar.need(p_token, 'admin');
if tb is not null and jsonb_typeof(tb) <> 'object' then raise exception 'Tabla inválida'; end if;
update rodar.tarifas set tabla = case when jsonb_array_length(coalesce(tb -> 'km', '[]')) > 0 then tb end,
bajada = coalesce((tb -> 'km' -> 0 ->> 1)::numeric, bajada) where id = (p_q ->> 'id')::bigint;
perform rodar.emit('flota', 'tarifas', '{}');
return '{"ok":true}';
end $$;
grant execute on function public.r_tarifa_tabla(text, jsonb, jsonb) to anon, authenticated;

-- Tarifa de la remisería (tabla de la foto): todos los días, todo el día. Las demás quedan desactivadas.
do $$ declare tb jsonb := '{"km":[[1.0,4500],[1.1,5000],[1.2,5000],[1.3,5000],[1.4,5000],[1.5,5000],[1.6,5500],[1.7,5500],[1.8,5500],[1.9,5500],[2.0,6000],[2.1,6000],[2.2,6000],[2.3,6500],[2.4,6500],[2.5,6500],[2.6,7000],[2.7,7000],[2.8,7000],[2.9,7000],[3.0,8000],[3.1,8000],[3.2,8000],[3.3,8500],[3.4,8500],[3.5,8500],[3.6,9000],[3.7,9000],[3.8,9000],[3.9,9000],[4.0,9500],[4.1,9500],[4.2,9500],[4.3,9500],[4.4,10000],[4.5,10000],[4.6,10000],[4.7,10000],[4.8,10500],[4.9,10500],[5.0,10500],[5.1,10500],[5.2,11000],[5.3,11000],[5.4,11000],[5.5,11000],[5.6,11500],[5.7,11500],[5.8,11500],[5.9,11500],[6.0,12000],[6.1,12000],[6.2,12000],[6.3,12000],[6.4,12500],[6.5,12500],[6.6,12500],[6.7,12500],[6.8,13000],[6.9,13000],[7.0,13000],[7.1,13000],[7.2,13500],[7.3,13500],[7.4,13500],[7.5,13500],[7.6,14000],[7.7,14000],[7.8,14000],[7.9,14000],[8.0,15000],[8.1,15000],[8.2,15000],[8.3,15000],[8.4,15500],[8.5,15500],[8.6,15500],[8.7,15500],[8.8,16000],[8.9,16000],[9.0,16000],[9.1,16000],[9.2,16500],[9.3,16500],[9.4,16500],[9.5,16500],[9.6,17000],[9.7,17000],[9.8,17000],[9.9,17000]],"extra":{"cada_m":400,"monto":500},"espera":[[5,1500],[10,2500],[15,2500],[20,3000],[25,3500],[30,4000],[35,4500],[40,5000],[45,5500],[50,6000],[55,6500],[60,7000]],"espera_extra":{"cada_min":5,"monto":500}}'::jsonb; tid bigint;
begin
select id into tid from rodar.tarifas where nombre = 'Tarifa por km (tabla)';
if tid is null then
insert into rodar.tarifas(orden, nombre, tipo, activa, bajada, precio_ficha, con_espera, cortesia_mts, cortesia_min, dias, feriado, hora_desde, hora_hasta, tabla)
values (1, 'Tarifa por km (tabla)', 'fija', true, 4500, 0, true, 0, 0, '[1,2,3,4,5,6,0]', true, '00:00', '23:59', tb) returning id into tid;
update rodar.tarifas set activa = false where id <> tid;
else
update rodar.tarifas set tabla = tb, bajada = 4500 where id = tid;
end if;
end $$;
notify pgrst, 'reload schema';
