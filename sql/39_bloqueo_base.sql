-- Móvil BLOQUEADO por deuda de base: el conductor no puede ponerse Libre, entrar a parada, hacer viajes de calle
-- ni tomar/postularse a pedidos hasta pagar. (estado_cuenta da "gris" cuando está fuera de servicio, por eso
-- acá se calcula como si estuviera Libre: así también se avisa al que está fuera de servicio.)
create or replace function rodar.bloqueo_base(m rodar.moviles) returns jsonb language plpgsql stable set search_path = rodar, public as $$
declare x rodar.moviles := m; ec jsonb;
begin
  x.estado := 'disponible'; x.habilitado := true;
  ec := rodar.estado_cuenta(x);
  return jsonb_build_object('bloqueado', coalesce((ec ->> 'bloqueado')::boolean, false), 'saldo', (ec ->> 'saldo')::numeric,
    'deuda', greatest(0, -coalesce((ec ->> 'saldo')::numeric, 0)), 'texto', ec ->> 'texto');
end $$;

create or replace function rodar.exigir_base_paga(m rodar.moviles) returns void language plpgsql stable set search_path = rodar, public as $$
begin
  if (rodar.bloqueo_base(m) ->> 'bloqueado')::boolean then
    raise exception 'BASE IMPAGA: tu móvil está bloqueado por deuda. Pagá la base para poder ponerte Libre, tomar pedidos o hacer viajes de calle.';
  end if;
end $$;

create or replace function public.r_cond_set_estado(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.usuario(p_token); m rodar.moviles := rodar.movil_sesion(p_token); e text := p_b ->> 'estado';
begin
  if e not in ('disponible', 'fuera_servicio', 'en_parada', 'emergencia') then raise exception 'Estado inválido'; end if;
  if m.estado in ('confirmado', 'con_pasajero') and e <> 'emergencia' then raise exception 'Tenés un viaje en curso'; end if;
  if e in ('disponible', 'en_parada') then perform rodar.exigir_base_paga(m); end if;
  perform rodar.set_estado_movil(m.id, e, rodar.n(p_b, 'parada_id')::bigint, false);
  if e = 'fuera_servicio' then perform rodar.evento_movil(m.id, 'fuera_servicio', null, 'Fuera de servicio'); end if;
  if e = 'emergencia' then
    perform rodar.evento_movil(m.id, 'emergencia', null, 'BOTÓN DE EMERGENCIA');
    insert into rodar.posiciones(movil_id, ts, lat, lng, estado) values (m.id, rodar.ahora(), m.lat, m.lng, 'emergencia');
    perform rodar.emit('panel', 'emergencia', jsonb_build_object('movil', m.numero, 'lat', m.lat, 'lng', m.lng, 'conductor', rodar.nombre(u)));
  end if;
  perform rodar.procesar();
  return '{"ok":true}';
end $$;

create or replace function public.r_cond_calle(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.usuario(p_token); m rodar.moviles := rodar.movil_sesion(p_token); ids bigint[]; p text;
begin
  if m.estado not in ('disponible', 'en_parada') then raise exception 'Tenés que estar Libre o en Parada'; end if;
  perform rodar.exigir_base_paga(m);
  ids := rodar.crear_viaje(jsonb_build_object('origen_dir', coalesce(rodar.t(p_b, 'origen_dir'), 'Viaje de calle'), 'origen_lat', m.lat, 'origen_lng', m.lng, 'destino_dir', p_b ->> 'destino_dir',
    'destino_lat', p_b -> 'destino_lat', 'destino_lng', p_b -> 'destino_lng', 'canal', 'movil', 'origen_tipo', 'calle', 'alias', 'CALLE', 'estado', 'pendiente', 'movil_id', m.id, 'conductor_id', u.id, 'pin_requerido', false), null);
  if m.estado = 'en_parada' then update rodar.viajes set parada_id = m.parada_id where id = ids[1]; end if;
  perform rodar.aceptar(ids[1], m.id);
  select pin into p from rodar.viajes where id = ids[1];
  perform rodar.iniciar(ids[1], p);
  return rodar.viaje_detalle(ids[1]);
end $$;

create or replace function public.r_cond_viaje(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.usuario(p_token); m rodar.moviles := rodar.movil_sesion(p_token); vid bigint := (p_q ->> 'id')::bigint; op text := p_q ->> 'op';
begin
  if op in ('aceptar', 'postular') then perform rodar.exigir_base_paga(m); perform rodar.aceptar(vid, m.id);
  elsif op = 'rechazar' then perform rodar.rechazar(vid, m.id); perform rodar.procesar();
  elsif op = 'llegue' then perform rodar.llegada(vid);
  elsif op = 'iniciar' then perform rodar.iniciar(vid, p_b ->> 'pin');
  elsif op = 'finalizar' then
    return rodar.finalizar(vid, coalesce(rodar.n(p_b, 'metros'), 0), coalesce(rodar.n(p_b, 'esperaSeg'), 0), rodar.n(p_b, 'monto'), (p_b ->> 'lat')::float8, (p_b ->> 'lng')::float8, rodar.t(p_b, 'destino_dir'));
  elsif op = 'cancelar' then perform rodar.anular(vid, u, 'Cancelado por el conductor: ' || coalesce(p_b ->> 'motivo', ''));
  else raise exception 'Operación desconocida'; end if;
  return rodar.viaje_detalle(vid);
end $$;

-- La app recibe el bloqueo calculado aunque esté fuera de servicio
create or replace function public.r_cond_estado(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.usuario(p_token); m rodar.moviles := rodar.movil_sesion(p_token); vid bigint; t rodar.tarifas;
begin
  perform rodar.procesar();
  select id into vid from rodar.viajes where movil_id = m.id and estado in ('ofrecido', 'confirmado', 'en_curso') order by id desc limit 1;
  t := rodar.tarifa_vigente();
  return jsonb_build_object('movil', rodar.movil_publico(m), 'conductor', jsonb_build_object('nombre', u.nombre, 'apellido', u.apellido, 'documento', u.documento),
    'viaje', case when vid is not null then rodar.viaje_detalle(vid) end,
    'paradas', coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'nombre', z.nombre, 'lat', z.parada_lat, 'lng', z.parada_lng,
        'cola', coalesce((select jsonb_agg(x.numero order by x.parada_ingreso) from rodar.moviles x where x.estado = 'en_parada' and x.parada_id = z.id), '[]')) order by z.orden) from rodar.zonas z where z.es_parada), '[]'),
    'tarifa', case when t.id is null then null else to_jsonb(t) end, 'saldo', rodar.saldo(m.id), 'cuenta', rodar.estado_cuenta(m), 'bloqueo_base', rodar.bloqueo_base(m),
    'zonas', rodar.lista('select * from rodar.zonas order by orden'), 'peligrosas', rodar.lista('select * from rodar.zonas_peligrosas'),
    'empresa', rodar.cfg('empresa'), 'mensajes', rodar.lista('select * from rodar.mensajes_flota order by id desc limit 5'), 'canal', rodar.topico(''),
    'abiertas', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'origen_dir', v.origen_dir, 'zona', z.nombre, 'destino_dir', v.destino_dir) order by v.id)
      from rodar.viajes v left join rodar.zonas z on z.id = v.zona_id where v.estado = 'pendiente' and v.a_oferta and rodar.elegible(m, v)), '[]'));
end $$;

grant execute on function public.r_cond_set_estado(text, jsonb, jsonb), public.r_cond_calle(text, jsonb, jsonb), public.r_cond_viaje(text, jsonb, jsonb), public.r_cond_estado(text, jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
