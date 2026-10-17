-- Orden de puesta en servicio y turnos (mañana / tarde / noche) en el mapa.
alter table rodar.moviles add column if not exists en_servicio_desde timestamp;

create or replace function rodar.trg_en_servicio() returns trigger language plpgsql as $t$
begin
  if new.estado in ('desconectado', 'fuera_servicio') then new.en_servicio_desde := null;
  elsif old.estado in ('desconectado', 'fuera_servicio') or new.en_servicio_desde is null then new.en_servicio_desde := coalesce(new.en_servicio_desde, rodar.ahora());
  end if;
  return new;
end $t$;
drop trigger if exists en_servicio on rodar.moviles;
create trigger en_servicio before update of estado on rodar.moviles for each row when (new.estado is distinct from old.estado) execute function rodar.trg_en_servicio();
-- Móviles que ya están en servicio al instalar: se toma la última señal como referencia.
update rodar.moviles set en_servicio_desde = coalesce(ultima_senal, rodar.ahora()) where estado not in ('desconectado', 'fuera_servicio') and en_servicio_desde is null;

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
    'sin_saldo', (ec ->> 'sin_saldo')::boolean, 'bloqueado', (ec ->> 'bloqueado')::boolean, 'penalizado', pen, 'zona', z.nombre, 'habilitado', m.habilitado, 'simulado', m.simulado, 'en_servicio_desde', m.en_servicio_desde);
end $$;
