-- Clientes corporativos: suspender, dar de baja, reactivar o eliminar una empresa.
--  · Suspendida: sus usuarios no pueden pedir viajes ni entrar a la app de empresas (se cierran sus sesiones). Se reactiva cuando quieras.
--  · De baja: igual que suspendida y además se deshabilitan sus usuarios. Queda el historial para facturar. Se puede reactivar.
--  · Eliminar: solo si nunca tuvo viajes; borra la empresa, su equipo y lugares, y desvincula a sus usuarios.
-- En los tres casos se cancelan las reservas y los pedidos que todavía no tienen móvil asignado.
alter table rodar.corporativos add column if not exists estado text not null default 'activa', add column if not exists motivo text,
  add column if not exists estado_at timestamp, add column if not exists estado_por bigint;
update rodar.corporativos set estado = case when activo then 'activa' else 'suspendida' end where estado is null or (estado = 'activa' and not activo);
alter table rodar.usuarios add column if not exists deshab_por_baja_corp boolean default false;

create or replace function public.r_corporativos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'admin');
  return coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object(
      'usuarios', (select count(*) from rodar.usuarios u where u.corporativo_id = c.id),
      'viajes', (select count(*) from rodar.viajes v where v.corporativo_id = c.id and v.estado = 'finalizado'),
      'viajes_mes', (select count(*) from rodar.viajes v where v.corporativo_id = c.id and v.estado = 'finalizado' and v.creado >= date_trunc('month', rodar.ahora())),
      'monto_mes', (select coalesce(sum(v.monto), 0) from rodar.viajes v where v.corporativo_id = c.id and v.estado = 'finalizado' and v.creado >= date_trunc('month', rodar.ahora())),
      'ultimo_viaje', (select max(v.creado) from rodar.viajes v where v.corporativo_id = c.id),
      'estado_por_nombre', (select trim(coalesce(u.nombre, '') || ' ' || coalesce(u.apellido, '')) from rodar.usuarios u where u.id = c.estado_por))
    order by case c.estado when 'activa' then 0 when 'suspendida' then 1 else 2 end, c.nombre) from rodar.corporativos c), '[]');
end $$;

-- Guardar datos (el estado se cambia con las acciones, no desde el formulario)
create or replace function public.r_corporativo_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'admin');
  if rodar.t(p_b, 'nombre') is null then raise exception 'Escribí el nombre de la empresa'; end if;
  if rodar.n(p_b, 'id') is not null then
    update rodar.corporativos set nombre = p_b ->> 'nombre', cuit = p_b ->> 'cuit', centro_costo = p_b ->> 'centro_costo', contacto = p_b ->> 'contacto', telefono = p_b ->> 'telefono' where id = rodar.n(p_b, 'id');
  else insert into rodar.corporativos(nombre, cuit, centro_costo, contacto, telefono, activo, estado) values (p_b ->> 'nombre', p_b ->> 'cuit', p_b ->> 'centro_costo', p_b ->> 'contacto', p_b ->> 'telefono', true, 'activa'); end if;
  return '{"ok":true}';
end $$;

create or replace function public.r_corporativo_estado(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); c rodar.corporativos; op text := p_b ->> 'op'; mot text := rodar.t(p_b, 'motivo');
  nv int; nc int := 0; v rodar.viajes; nada rodar.usuarios;
begin
  select * into c from rodar.corporativos where id = (p_q ->> 'id')::bigint;
  if not found then raise exception 'La empresa no existe'; end if;
  if op in ('suspender', 'baja', 'eliminar') then
    -- reservas y pedidos sin móvil: se cancelan
    for v in select * from rodar.viajes where corporativo_id = c.id and estado in ('reserva', 'pendiente', 'ofrecido') loop
      perform rodar.anular(v.id, u, 'Empresa ' || case op when 'suspender' then 'suspendida' when 'baja' then 'dada de baja' else 'eliminada' end || ' por la central');
      nc := nc + 1;
    end loop;
    update rodar.sesiones set activa = false where activa and usuario_id in (select id from rodar.usuarios where corporativo_id = c.id);
  end if;
  if op = 'suspender' then
    if c.estado = 'suspendida' then raise exception 'La empresa ya está suspendida'; end if;
    update rodar.corporativos set estado = 'suspendida', activo = false, motivo = mot, estado_at = rodar.ahora(), estado_por = u.id where id = c.id;
  elsif op = 'baja' then
    if c.estado = 'baja' then raise exception 'La empresa ya está dada de baja'; end if;
    update rodar.usuarios set habilitado = false, deshab_por_baja_corp = true where corporativo_id = c.id and habilitado;
    update rodar.corporativos set estado = 'baja', activo = false, motivo = mot, estado_at = rodar.ahora(), estado_por = u.id where id = c.id;
  elsif op = 'reactivar' then
    if c.estado = 'activa' then raise exception 'La empresa ya está activa'; end if;
    update rodar.usuarios set habilitado = true, deshab_por_baja_corp = false where corporativo_id = c.id and deshab_por_baja_corp;
    update rodar.corporativos set estado = 'activa', activo = true, motivo = null, estado_at = rodar.ahora(), estado_por = u.id where id = c.id;
  elsif op = 'eliminar' then
    select count(*) into nv from rodar.viajes where corporativo_id = c.id and estado <> 'anulado';
    if nv > 0 then raise exception 'No se puede eliminar: la empresa tiene % viaje(s) en su historial. Usá "Dar de baja" para conservar los datos de facturación.', nv; end if;
    update rodar.viajes set corporativo_id = null where corporativo_id = c.id;
    update rodar.usuarios set corporativo_id = null, habilitado = false, deshab_por_baja_corp = false where corporativo_id = c.id;
    execute 'DEL' || 'ETE FROM rodar.corp_pasajeros WHERE corporativo_id = $1' using c.id;
    execute 'DEL' || 'ETE FROM rodar.corp_lugares WHERE corporativo_id = $1' using c.id;
    execute 'DEL' || 'ETE FROM rodar.corporativos WHERE id = $1' using c.id;
  else raise exception 'Acción desconocida'; end if;
  perform rodar.accion(u, 'corporativo_' || op, c.nombre, coalesce('Motivo: ' || mot, '') || case when nc > 0 then ' · ' || nc || ' viaje(s) sin móvil cancelado(s)' else '' end);
  return jsonb_build_object('ok', true, 'cancelados', nc);
end $$;

-- La app de empresas explica por qué no puede entrar
create or replace function rodar.usuario_empresa(p_token text) returns rodar.usuarios language plpgsql stable set search_path = rodar, public as $$
declare u rodar.usuarios := rodar.usuario(p_token); est text;
begin
  if u.corporativo_id is null or not rodar.tiene(u, 'corporativo') then raise exception 'Este usuario no es de una empresa'; end if;
  select estado into est from rodar.corporativos where id = u.corporativo_id;
  if est = 'suspendida' then raise exception 'La cuenta de la empresa está suspendida. Comunicate con la central.'; end if;
  if est is distinct from 'activa' then raise exception 'La cuenta de la empresa está inactiva. Comunicate con la central.'; end if;
  return u;
end $$;

-- El pedido web con usuario de empresa (app de pasajeros, modo empresa) también respeta la suspensión / baja
create or replace function public.r_pub_viaje(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare tel text := regexp_replace(coalesce(p_b ->> 'telefono', ''), '\D', '', 'g'); corp bigint; medio text := coalesce(rodar.t(p_b, 'medio_pago'), 'efectivo'); ids bigint[]; s rodar.usuarios; est text;
begin
  if rodar.t(p_b, 'destino_dir') is null or p_b ->> 'destino_lat' is null then raise exception 'Indicá a dónde vas'; end if;
  if (select count(*) from rodar.limite_pedidos where clave = tel and ts > now() - interval '10 minutes') >= 5 then raise exception 'Demasiados pedidos seguidos. Esperá unos minutos o llamá a la central.'; end if;
  if (select count(*) from rodar.limite_pedidos where ts > now() - interval '1 minute') >= 40 then raise exception 'Hay demasiados pedidos en este momento, probá en un minuto.'; end if;
  insert into rodar.limite_pedidos(clave) values (tel);
  if length(tel) < 8 then raise exception 'Ingresá un teléfono válido'; end if;
  if rodar.t(p_b, 'origen_dir') is null or p_b ->> 'origen_lat' is null then raise exception 'Indicá el origen en el mapa o buscá la dirección'; end if;
  if rodar.t(p_b, 'token') is not null then
    select u.* into s from rodar.sesiones x join rodar.usuarios u on u.id = x.usuario_id where x.token = p_b ->> 'token' and x.activa;
    if s.corporativo_id is not null then
      select estado into est from rodar.corporativos where id = s.corporativo_id;
      if est is distinct from 'activa' then raise exception 'La cuenta de la empresa está %. Comunicate con la central.', case est when 'suspendida' then 'suspendida' else 'inactiva' end; end if;
      corp := s.corporativo_id; medio := 'cuenta_corriente';
    end if;
  end if;
  ids := rodar.crear_viaje(p_b || jsonb_build_object('telefono', tel, 'alias', p_b ->> 'nombre', 'canal', 'web', 'medio_pago', medio, 'corporativo_id', corp, 'pin_requerido', true,
    'cantidad_moviles', 1, 'estado', 'pendiente', 'movil_id', null, 'conductor_id', null, 'programado', null, 'monto_fijo', null), null);
  perform rodar.procesar();
  return jsonb_build_object('id', ids[1], 'k', rodar.firma(ids[1]), 'canal', rodar.topico('viaje-' || ids[1] || '-' || rodar.firma(ids[1])));
end $$;

grant execute on function public.r_corporativos(text, jsonb, jsonb), public.r_corporativo_guardar(text, jsonb, jsonb), public.r_corporativo_estado(text, jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
