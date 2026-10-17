-- ===================== Eliminar móvil y reiniciar el sistema =====================

-- Elimina un móvil (solo admin). Se rechaza si tiene un viaje en curso u ofrecido.
-- Los viajes ya terminados quedan en el historial.
create or replace function public.r_movil_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); mid bigint := rodar.n(p_q, 'id')::bigint; m rodar.moviles;
begin
  select * into m from rodar.moviles where id = mid;
  if not found then raise exception 'El móvil no existe'; end if;
  if exists(select 1 from rodar.viajes where movil_id = mid and estado in ('ofrecido', 'confirmado', 'en_curso')) then
    raise exception 'El móvil % tiene un viaje en curso. Esperá a que termine o anulalo antes de eliminarlo.', m.numero;
  end if;
  update rodar.sesiones set activa = false where movil_id = mid;
  delete from rodar.movil_conductores where movil_id = mid;
  delete from rodar.penalizaciones where movil_id = mid;
  delete from rodar.cuenta_movimientos where movil_id = mid;
  delete from rodar.negativos where movil_id = mid;
  delete from rodar.mp_saldo_mov where movil_id = mid;
  delete from rodar.posiciones where movil_id = mid;
  delete from rodar.sim_estado where movil_id = mid;
  delete from rodar.moviles where id = mid;
  perform rodar.accion(u, 'movil_eliminado', m.numero::text, 'Se eliminó el móvil ' || m.numero || coalesce(' (' || m.patente || ')', ''));
  perform rodar.emit('panel', 'movil_baja', jsonb_build_object('id', mid, 'numero', m.numero));
  return jsonb_build_object('ok', true);
end $$;

-- Deja el sistema en cero. Solo admin, con su contraseña y la frase de confirmación.
-- Se borran: viajes, clientes, móviles, usuarios (menos el admin que lo ejecuta), cuentas, chats, soporte, reportes,
-- informes, zonas, paradas, zonas peligrosas, corporativos, solicitudes de conductores y direcciones aprendidas.
-- Se conservan: datos de la empresa, tarifas, planes, módulos, canales, medios de pago, feriados y la cuenta del admin.
create or replace function public.r_sistema_reiniciar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); t text;
  tablas text[] := array['viajes', 'clientes', 'cliente_domicilios', 'negativos', 'sesiones_clientes', 'moviles', 'movil_conductores',
    'penalizaciones', 'cuenta_movimientos', 'mp_pagos', 'mp_saldo_mov', 'solicitudes_conductor', 'acciones_usuarios', 'eventos_moviles',
    'moviles_historial', 'posiciones', 'soporte_conv', 'soporte_msg', 'chat_conv', 'chat_msg', 'reportes', 'reporte_historial',
    'novedades_vistas', 'conexion_diaria', 'mensajes_flota', 'limite_pedidos', 'sim_estado', 'direcciones_conocidas', 'docs_generados',
    'zonas', 'zonas_peligrosas', 'corporativos'];
begin
  if not rodar.verificar(coalesce(p_b ->> 'password', ''), u.password_hash) then raise exception 'La contraseña no es correcta'; end if;
  if upper(trim(coalesce(p_b ->> 'confirmacion', ''))) <> 'BORRAR TODO' then raise exception 'Escribí BORRAR TODO para confirmar'; end if;
  foreach t in array tablas loop
    if to_regclass('rodar.' || t) is not null then execute format('truncate table rodar.%I restart identity cascade', t); end if;
  end loop;
  delete from rodar.sesiones where usuario_id <> u.id;
  delete from rodar.usuarios where id <> u.id;
  update rodar.usuarios set corporativo_id = null where id = u.id;
  perform rodar.cfg_set('simulador', '{"flota":false,"demanda":false}');
  perform rodar.accion(u, 'sistema_reiniciado', null, 'Se borraron todos los datos y el sistema quedó en cero');
  return jsonb_build_object('ok', true);
end $$;

notify pgrst, 'reload schema';
