-- ===================== Billetera virtual del conductor y borrado total que conserva zonas y paradas =====================

-- Billetera virtual propia del conductor (alias o CVU/CBU donde recibe pagos).
alter table rodar.usuarios add column if not exists billetera_tipo text;
alter table rodar.usuarios add column if not exists billetera_alias text;

-- Sin datos en el cuerpo devuelve la billetera guardada; con "alias" la guarda (alias vacío = quitarla).
create or replace function public.r_cond_billetera(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); al text; tp text;
begin
  if p_b ? 'alias' then
    al := regexp_replace(trim(coalesce(p_b ->> 'alias', '')), '^@', '');
    tp := nullif(trim(coalesce(p_b ->> 'tipo', '')), '');
    if al = '' then
      update rodar.usuarios set billetera_tipo = null, billetera_alias = null where id = u.id;
    else
      if al !~ '^[A-Za-z0-9._-]{6,40}$' and al !~ '^[0-9]{22}$' then
        raise exception 'El alias debe tener entre 6 y 40 caracteres (letras, números, punto o guion), o ser un CVU/CBU de 22 dígitos';
      end if;
      if tp is not null and tp not in ('mercadopago', 'uala', 'naranja_x', 'brubank', 'personal_pay', 'otra') then raise exception 'Billetera no válida'; end if;
      update rodar.usuarios set billetera_tipo = coalesce(tp, 'otra'), billetera_alias = al where id = u.id;
    end if;
    select * into u from rodar.usuarios where id = u.id;
  end if;
  return jsonb_build_object('tipo', u.billetera_tipo, 'alias', u.billetera_alias);
end $$;
grant execute on function public.r_cond_billetera(text, jsonb, jsonb) to anon, authenticated;

-- Borrar todo el sistema: ahora se conservan las zonas y paradas, salvo que el administrador pida borrarlas (zonas = 'borrar').
create or replace function public.r_sistema_reiniciar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin'); t text; borrar_zonas boolean := lower(coalesce(p_b ->> 'zonas', 'conservar')) = 'borrar';
  tablas text[] := array['viajes', 'clientes', 'cliente_domicilios', 'negativos', 'sesiones_clientes', 'moviles', 'movil_conductores',
    'penalizaciones', 'cuenta_movimientos', 'mp_pagos', 'mp_saldo_mov', 'solicitudes_conductor', 'acciones_usuarios', 'eventos_moviles',
    'moviles_historial', 'posiciones', 'soporte_conv', 'soporte_msg', 'chat_conv', 'chat_msg', 'reportes', 'reporte_historial',
    'novedades_vistas', 'conexion_diaria', 'mensajes_flota', 'limite_pedidos', 'sim_estado', 'direcciones_conocidas', 'docs_generados',
    'corporativos'];
begin
  if not rodar.verificar(coalesce(p_b ->> 'password', ''), u.password_hash) then raise exception 'La contraseña no es correcta'; end if;
  if upper(trim(coalesce(p_b ->> 'confirmacion', ''))) <> 'BORRAR TODO' then raise exception 'Escribí BORRAR TODO para confirmar'; end if;
  if borrar_zonas then tablas := tablas || array['zonas', 'zonas_peligrosas']; end if;
  foreach t in array tablas loop
    if to_regclass('rodar.' || t) is not null then execute format('truncate table rodar.%I restart identity cascade', t); end if;
  end loop;
  delete from rodar.sesiones where usuario_id <> u.id;
  delete from rodar.usuarios where id <> u.id;
  update rodar.usuarios set corporativo_id = null where id = u.id;
  perform rodar.cfg_set('simulador', '{"flota":false,"demanda":false}');
  perform rodar.accion(u, 'sistema_reiniciado', null, case when borrar_zonas then 'Se borraron todos los datos, incluidas las zonas y paradas' else 'Se borraron todos los datos (se conservaron zonas y paradas)' end);
  return jsonb_build_object('ok', true, 'zonas_borradas', borrar_zonas);
end $$;

notify pgrst, 'reload schema';
