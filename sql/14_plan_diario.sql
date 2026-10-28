-- ===================== Plan con cuota diaria =====================
-- El móvil paga un monto por día para poder trabajar. Cada día, a la "hora de cobro" del plan, se descuenta la cuota de su cuenta.
-- Estados de la cuenta (rodar.estado_cuenta):
--   Al día                  saldo ≥ saldo mínimo del plan
--   Debajo del mínimo       saldo < mínimo del plan, pero todavía dentro de la tolerancia (sigue recibiendo viajes)
--   Bloqueado por deuda     la deuda superó la tolerancia: no recibe viajes. Tolerancia = días completos de "Horas de tolerancia" (48 h = 2 cuotas)
--   Inhabilitado / fuera de servicio   y   Habilitado sin plan: igual que antes.
-- Una prórroga vigente sigue evitando el bloqueo.

create or replace function rodar.estado_cuenta(m rodar.moviles) returns jsonb language plpgsql stable as $$
declare p rodar.planes; s numeric; lim numeric; pr boolean; color text := 'verde'; texto text := 'Al día'; diaria boolean;
begin
  select * into p from rodar.planes where id = m.plan_id;
  s := rodar.saldo(m.id);
  lim := coalesce((rodar.cfg('dispatch') ->> 'deuda_bloqueo')::numeric, -5000);
  pr := m.prorroga_hasta is not null and m.prorroga_hasta > rodar.ahora();
  diaria := p.id is not null and not p.sistema and p.periodicidad = 'diaria' and coalesce(p.monto_fijo, 0) > 0;
  if not m.habilitado or m.estado = 'fuera_servicio' then color := 'gris'; texto := 'Inhabilitado / fuera de servicio';
  elsif p.id is null or p.sistema then color := 'azul'; texto := 'Habilitado sin plan';
  elsif diaria and s < -(p.monto_fijo * floor(coalesce(p.horas_bloqueo, 0) / 24.0)) and not pr then color := 'rojo'; texto := 'Bloqueado por deuda';
  elsif not diaria and s <= lim and not pr then color := 'rojo'; texto := 'Bloqueado por deuda';
  elsif s < coalesce(p.minimo, 0) then color := 'amarillo'; texto := 'Debajo del mínimo'; end if;
  return jsonb_build_object('saldo', s, 'color', color, 'texto', texto, 'plan', case when p.id is null then null else to_jsonb(p) end,
    'prorroga', case when pr then m.prorroga_hasta end, 'bloqueado', color = 'rojo',
    'sin_saldo', p.id is not null and p.modo_pago = 'prepago' and p.modo_cobro <> 'fijo' and s <= 0 and not p.sistema);
end $$;

-- Cobro de cuotas, ahora también diario. La cuota diaria se cobra una vez por día a partir de la hora de cobro
-- (si el sistema no corrió justo en esa hora, se cobra apenas vuelve a correr ese mismo día).
create or replace function rodar.ciclo_cuotas() returns void language plpgsql as $$
declare p rodar.planes; m rodar.moviles; d timestamp := rodar.ahora(); toca boolean; periodo text; sv numeric; n int;
begin
  for p in select * from rodar.planes where not sistema and monto_fijo > 0 loop
    if p.periodicidad = 'diaria' then
      if extract(hour from d)::int < p.hora_cobro then continue; end if;
    elsif extract(hour from d)::int <> p.hora_cobro then continue; end if;
    toca := false;
    if p.periodicidad = 'diaria' then toca := true; periodo := d::date::text; end if;
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
      perform rodar.cfg_set('tipo1_pend_' || m.id, to_jsonb(coalesce(p.tipo1, false)));
      perform rodar.emitir_movil(m.id);
      n := n + 1;
    end loop;
    insert into rodar.acciones_usuarios(fecha, actor, tipo, afectado, detalle) values (d, 'sistema', 'cobro_cuotas', p.descripcion, n || ' móviles');
  end loop;
end $$;

-- Plan de ejemplo (solo si no existe). Editá el monto en Administración → Planes. No afecta a ningún móvil hasta que se lo asignes.
insert into rodar.planes(descripcion, modo_pago, modo_cobro, monto_fijo, periodicidad, hora_cobro, horas_bloqueo, minimo)
select 'Cuota diaria', 'prepago', 'fijo', 5000, 'diaria', 0, 48, 0
where not exists (select 1 from rodar.planes where descripcion = 'Cuota diaria' and not sistema);

notify pgrst, 'reload schema';
