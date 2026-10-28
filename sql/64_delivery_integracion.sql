-- ===================== 64 · Integración delivery ↔ remises: casos que quedaban sueltos =====================
-- 1) Si se cancela el pedido (o se anula el viaje) con un repartidor ya asignado, el móvil vuelve a quedar libre.
-- 2) Si el repartidor rechaza, no responde o suelta el viaje, el pedido deja de mostrarlo asignado y vuelve a "buscando".
-- 3) Si el viaje se anuló sin que nadie cancelara el pedido, se pide otro repartidor (hasta 3 veces) y se avisa a la central.
-- 4) Si el despacho agotó los intentos, el ciclo del delivery vuelve a ofrecer el pedido cada 2 minutos.
alter table rodar.dlv_pedidos add column if not exists reofrecido_at timestamp;
alter table rodar.dlv_pedidos add column if not exists reintentos_rep int not null default 0;

create or replace function rodar.dlv_trg_viaje() returns trigger language plpgsql as $$
declare p rodar.dlv_pedidos;
begin
  if new.estado is not distinct from old.estado and new.movil_id is not distinct from old.movil_id then return new; end if;
  select * into p from rodar.dlv_pedidos where viaje_id = new.id;
  if not found then return new; end if;
  -- (1) el viaje se anuló con un móvil asignado: liberarlo aunque el pedido ya esté cancelado
  if new.estado = 'anulado' and old.estado is distinct from 'anulado' and old.movil_id is not null then
    update rodar.moviles set estado = 'disponible' where id = old.movil_id and estado in ('confirmado', 'con_pasajero');
    perform rodar.emit('movil-' || old.movil_id, 'oferta_cancelada', jsonb_build_object('viajeId', new.id));
    perform rodar.emitir_movil(old.movil_id);
  end if;
  if p.estado in ('entregado', 'cancelado') then return new; end if;
  if new.movil_id is not null and new.movil_id is distinct from p.movil_id then
    update rodar.dlv_pedidos set movil_id = new.movil_id, conductor_id = new.conductor_id where id = p.id;
    perform rodar.dlv_hist(p.id, 'Repartidor asignado: móvil ' || coalesce((select numero::text from rodar.moviles where id = new.movil_id), '?'));
  end if;
  -- (2) el repartidor soltó o rechazó: el viaje volvió a "pendiente" sin móvil
  if new.estado = 'pendiente' and new.movil_id is null and p.movil_id is not null then
    update rodar.dlv_pedidos set movil_id = null, conductor_id = null, buscando_desde = coalesce(buscando_desde, rodar.ahora()), avisado = false where id = p.id;
    perform rodar.dlv_hist(p.id, 'El repartidor no tomó el pedido; se busca otro');
  end if;
  if new.estado = 'en_curso' and old.estado is distinct from 'en_curso' then perform rodar.dlv_estado(p.id, 'en_camino', 'repartidor');
  elsif new.estado = 'finalizado' then perform rodar.dlv_estado(p.id, 'entregado', 'repartidor');
  elsif new.estado = 'anulado' then
    update rodar.dlv_pedidos set viaje_id = null, movil_id = null, conductor_id = null, buscando_desde = null where id = p.id;
    perform rodar.dlv_hist(p.id, 'El viaje del repartidor se anuló; el pedido quedó sin repartidor');
    -- (3) nadie canceló el pedido: se vuelve a pedir repartidor, y si ya se intentó varias veces se avisa a la central
    if p.tipo_entrega <> 'retiro' and p.estado in ('pendiente', 'confirmado', 'preparando', 'listo') then
      if p.reintentos_rep < 3 and p.estado <> 'pendiente' then
        update rodar.dlv_pedidos set reintentos_rep = reintentos_rep + 1 where id = p.id;
        begin perform rodar.dlv_pedir_repartidor(p.id); exception when others then null; end;
      else
        perform rodar.emit('panel', 'aviso', jsonb_build_object('texto', 'Pedido #' || p.codigo || ': se anuló el viaje del repartidor y no tiene reparto. Asignalo a mano.'));
      end if;
    end if;
  end if;
  return new;
end $$;

-- (4) el ciclo del delivery: lo de antes + volver a ofrecer los pedidos que agotaron los intentos del despacho
do $$ begin
  if to_regprocedure('rodar.dlv_ciclo_base()') is not null then drop function rodar.dlv_ciclo_base(); end if;
  alter function rodar.dlv_ciclo() rename to dlv_ciclo_base;
end $$;

create or replace function rodar.dlv_reofrecer() returns void language plpgsql as $$
declare maxi int := coalesce((rodar.cfg('dispatch') ->> 'max_intentos')::int, 5); r record; n int := 0;
begin
  for r in select p.id, v.id vid from rodar.dlv_pedidos p join rodar.viajes v on v.id = p.viaje_id
    where p.estado not in ('entregado', 'cancelado') and v.estado = 'pendiente' and v.intentos >= maxi
      and (p.reofrecido_at is null or p.reofrecido_at < rodar.ahora() - interval '2 minutes') loop
    update rodar.viajes set intentos = 0, rechazos = '{}' where id = r.vid;
    update rodar.dlv_pedidos set reofrecido_at = rodar.ahora() where id = r.id;
    n := n + 1;
  end loop;
  if n > 0 then begin perform rodar.procesar(); exception when others then null; end; end if;
end $$;

create or replace function rodar.dlv_ciclo() returns void language plpgsql as $$
begin
  perform rodar.dlv_ciclo_base();
  perform rodar.dlv_reofrecer();
end $$;
