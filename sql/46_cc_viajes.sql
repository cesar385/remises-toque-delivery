-- ===================== Viajes a cuenta corriente: siempre con empresa, y visibles desde que se registran =====================

-- 1) Un viaje a cuenta corriente tiene que tener una empresa activa (operador, pasajero en modo empresa, app de empresas)
do $$
declare d text; a text := $q$select * into c from rodar.canales where codigo = canal;$q$;
begin
  d := pg_get_functiondef('rodar.crear_viaje(jsonb,rodar.usuarios)'::regprocedure);
  if position('elegí la empresa' in d) = 0 then
    if position(a in d) = 0 then raise exception 'crear_viaje cambió'; end if;
    execute replace(d, a, $q$if coalesce(rodar.t(d, 'medio_pago'), '') = 'cuenta_corriente' then
    if rodar.n(d, 'corporativo_id') is null then raise exception 'Para cobrar a cuenta corriente elegí la empresa (cliente corporativo).'; end if;
    if not exists(select 1 from rodar.corporativos where id = rodar.n(d, 'corporativo_id')::bigint and estado = 'activa') then raise exception 'La empresa elegida no está activa.'; end if;
  end if;
  $q$ || a);
  end if;
end $$;

-- pasajero en modo empresa sin empresa asociada: mensaje claro
do $$
declare d text; a text := $q$ids := rodar.crear_viaje(p_b || jsonb_build_object('telefono', tel,$q$;
begin
  d := pg_get_functiondef('public.r_pub_viaje(text,jsonb,jsonb)'::regprocedure);
  if position('no está asociado a ninguna empresa' in d) = 0 then
    if position(a in d) = 0 then raise exception 'r_pub_viaje cambió'; end if;
    execute replace(d, a, $q$if medio = 'cuenta_corriente' and corp is null then raise exception 'Tu usuario no está asociado a ninguna empresa, así que no podés pedir a cuenta corriente. Pedile a la central que te asigne a tu empresa.'; end if;
  $q$ || a);
  end if;
end $$;

-- operador: guarda también el centro de costo
do $$
declare d text; a text := $q$return jsonb_build_object('ids', to_jsonb(ids));$q$;
begin
  d := pg_get_functiondef('public.r_viaje_crear(text,jsonb,jsonb)'::regprocedure);
  if position('centro_costo' in d) = 0 then
    if position(a in d) = 0 then raise exception 'r_viaje_crear cambió'; end if;
    execute replace(d, a, $q$if rodar.t(p_b, 'centro_costo') is not null and rodar.n(p_b, 'corporativo_id') is not null then
    execute 'up' || 'date rodar.viajes set centro_costo = $2 where id = any($1)' using ids, rodar.t(p_b, 'centro_costo');
  end if;
  $q$ || a);
  end if;
end $$;

-- 2) Cuenta corriente: viajes en curso / reservados (todavía no facturados) de cada empresa
create or replace function rodar.corp_en_curso(p_corp bigint) returns jsonb language sql stable set search_path = rodar, public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'estado', v.estado, 'creado', v.creado, 'programado', v.programado, 'pasajero', coalesce(p.nombre, v.alias), 'telefono', v.telefono,
      'centro_costo', v.centro_costo, 'origen', v.origen_dir, 'destino', v.destino_dir, 'movil', m.numero, 'estimado', v.monto_estimado) order by coalesce(v.programado, v.creado)), '[]')
  from rodar.viajes v left join rodar.corp_pasajeros p on p.id = v.corp_pasajero_id left join rodar.moviles m on m.id = v.movil_id
  where v.corporativo_id = p_corp and v.estado in ('reserva', 'pendiente', 'ofrecido', 'confirmado', 'en_curso') $$;

create or replace function public.r_corp_cuentas(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare ini timestamp := date_trunc('month', rodar.ahora());
begin
  perform rodar.need(p_token, 'gestion');
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'cuit', c.cuit, 'estado', c.estado, 'contacto', c.contacto, 'telefono', c.telefono,
      'saldo', rodar.corp_saldo(c.id),
      'viajes_mes', (select count(*) from rodar.viajes v where v.corporativo_id = c.id and v.estado = 'finalizado' and coalesce(v.fin_at, v.creado) >= ini),
      'monto_mes', (select coalesce(sum(v.monto), 0) from rodar.viajes v where v.corporativo_id = c.id and v.estado = 'finalizado' and coalesce(v.fin_at, v.creado) >= ini),
      'en_curso', (select count(*) from rodar.viajes v where v.corporativo_id = c.id and v.estado in ('reserva', 'pendiente', 'ofrecido', 'confirmado', 'en_curso')),
      'ultimo_pago', (select jsonb_build_object('fecha', m.fecha, 'monto', -m.monto) from rodar.corp_movimientos m where m.corporativo_id = c.id and m.tipo = 'pago' and not m.anulado order by m.fecha desc limit 1),
      'ultima_liq', (select jsonb_build_object('numero', l.numero, 'desde', l.desde, 'hasta', l.hasta, 'monto', l.monto) from rodar.corp_liquidaciones l where l.corporativo_id = c.id and not l.anulada order by l.hasta desc, l.id desc limit 1))
    order by rodar.corp_saldo(c.id) desc, c.nombre) from rodar.corporativos c), '[]');
end $$;

do $$
declare d text; a text := $q$'movimientos', movs,$q$;
begin
  d := pg_get_functiondef('rodar.corp_cuenta_detalle(bigint,date,date)'::regprocedure);
  if position('corp_en_curso' in d) = 0 then
    if position(a in d) = 0 then raise exception 'corp_cuenta_detalle cambió'; end if;
    execute replace(d, a, $q$'movimientos', movs, 'en_curso', rodar.corp_en_curso(p_corp),$q$);
  end if;
end $$;

-- 3) Viajes a cuenta corriente que quedaron sin empresa (anteriores a este control): se listan y se asignan
create or replace function public.r_cc_sin_empresa(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'gestion');
begin
  if rodar.n(p_b, 'viaje_id') is not null then
    if u.id is null or not rodar.tiene(u, 'admin', 'gestion') then raise exception 'Sin permiso'; end if;
    if not exists(select 1 from rodar.corporativos where id = rodar.n(p_b, 'corporativo_id')::bigint) then raise exception 'Elegí la empresa'; end if;
    execute 'up' || 'date rodar.viajes set corporativo_id = $2, medio_pago = ''cuenta_corriente'', centro_costo = coalesce($3, centro_costo) where id = $1 and corporativo_id is null' using rodar.n(p_b, 'viaje_id')::bigint, rodar.n(p_b, 'corporativo_id')::bigint, rodar.t(p_b, 'centro_costo');
    perform rodar.accion(u, 'viaje_cc_asignado', null, 'Viaje #' || (p_b ->> 'viaje_id') || ' asignado a la cuenta corriente de ' || (select nombre from rodar.corporativos where id = rodar.n(p_b, 'corporativo_id')::bigint));
    return '{"ok":true}';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'estado', v.estado, 'fecha', coalesce(v.fin_at, v.creado), 'alias', v.alias, 'telefono', v.telefono, 'canal', v.canal,
      'origen', v.origen_dir, 'destino', v.destino_dir, 'monto', coalesce(v.monto, v.monto_estimado)) order by v.id desc)
    from rodar.viajes v where v.medio_pago = 'cuenta_corriente' and v.corporativo_id is null and v.estado <> 'anulado'), '[]');
end $$;

-- 4) Informe de clientes corporativos: también cuenta los viajes en curso y los lista en el detalle
create or replace function public.r_inf_corporativos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare d date := coalesce(rodar.t(p_q, 'desde')::date, date_trunc('month', rodar.ahora())::date); h date := coalesce(rodar.t(p_q, 'hasta')::date, rodar.hoy());
  cid bigint := rodar.n(p_q, 'empresa')::bigint; r jsonb;
begin
  perform rodar.need(p_token, 'gestion');
  r := jsonb_build_object('desde', d, 'hasta', h,
    'empresas', coalesce((select jsonb_agg(x order by (x ->> 'monto')::numeric desc, x ->> 'nombre') from (
      select jsonb_build_object('id', c.id, 'nombre', c.nombre, 'cuit', c.cuit, 'estado', c.estado, 'contacto', c.contacto, 'telefono', c.telefono,
        'viajes', count(v.id) filter (where v.estado = 'finalizado'),
        'cancelados', count(v.id) filter (where v.estado = 'anulado'),
        'en_curso', (select count(*) from rodar.viajes x where x.corporativo_id = c.id and x.estado in ('reserva', 'pendiente', 'ofrecido', 'confirmado', 'en_curso')),
        'km', coalesce(round(sum(v.km) filter (where v.estado = 'finalizado'), 1), 0),
        'monto', coalesce(sum(v.monto) filter (where v.estado = 'finalizado'), 0),
        'pasajeros', count(distinct coalesce(v.corp_pasajero_id::text, v.telefono)) filter (where v.estado = 'finalizado'),
        'pagos', (select coalesce(-sum(m.monto), 0) from rodar.corp_movimientos m where m.corporativo_id = c.id and not m.anulado and m.tipo = 'pago' and m.fecha >= d and m.fecha < h + 1),
        'saldo', rodar.corp_saldo(c.id)) x
      from rodar.corporativos c left join rodar.viajes v on v.corporativo_id = c.id and coalesce(v.fin_at, v.creado) >= d and coalesce(v.fin_at, v.creado) < h + 1
      where cid is null or c.id = cid group by c.id) z), '[]'),
    'sin_empresa', (select count(*) from rodar.viajes v where v.medio_pago = 'cuenta_corriente' and v.corporativo_id is null and v.estado <> 'anulado'));
  if cid is not null then
    r := r || jsonb_build_object(
      'viajes', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'fecha', coalesce(v.fin_at, v.programado, v.creado), 'estado', v.estado, 'pasajero', coalesce(p.nombre, v.alias), 'telefono', v.telefono,
          'centro_costo', v.centro_costo, 'origen', v.origen_dir, 'destino', v.destino_dir, 'movil', m.numero, 'km', v.km, 'monto', v.monto, 'estimado', v.monto_estimado) order by coalesce(v.fin_at, v.programado, v.creado))
        from rodar.viajes v left join rodar.corp_pasajeros p on p.id = v.corp_pasajero_id left join rodar.moviles m on m.id = v.movil_id
        where v.corporativo_id = cid and ((v.estado in ('finalizado', 'anulado') and coalesce(v.fin_at, v.creado) >= d and coalesce(v.fin_at, v.creado) < h + 1)
          or v.estado in ('reserva', 'pendiente', 'ofrecido', 'confirmado', 'en_curso'))), '[]'),
      'por_centro', coalesce((select jsonb_agg(jsonb_build_object('centro', centro, 'viajes', n, 'monto', mt) order by mt desc) from (
          select coalesce(nullif(v.centro_costo, ''), 'Sin centro de costo') centro, count(*) n, coalesce(sum(v.monto), 0) mt
          from rodar.viajes v where v.corporativo_id = cid and v.estado = 'finalizado' and coalesce(v.fin_at, v.creado) >= d and coalesce(v.fin_at, v.creado) < h + 1 group by 1) z), '[]'));
  end if;
  return r;
end $$;

grant execute on function public.r_corp_cuentas(text, jsonb, jsonb), public.r_cc_sin_empresa(text, jsonb, jsonb), public.r_inf_corporativos(text, jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
