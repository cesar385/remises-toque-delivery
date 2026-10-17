-- ===================== API: sesión, perfil, novedades, reportes, catálogos =====================
-- Todas las funciones públicas tienen la misma firma: (p_token, p_q = parámetros de consulta, p_b = cuerpo)

create or replace function public.r_login(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios; tk text; us text := trim(coalesce(p_b ->> 'usuario', ''));
begin
  select * into u from rodar.usuarios where (usuario = us or documento = us) and habilitado;
  if not found or not rodar.verificar(coalesce(p_b ->> 'password', ''), u.password_hash) then raise exception 'Usuario o contraseña incorrectos'; end if;
  tk := rodar.token();
  insert into rodar.sesiones(token, usuario_id, tipo, movil_id, inicio, ultimo, ip) values (tk, u.id, coalesce(rodar.t(p_b, 'tipo'), 'web'), rodar.n(p_b, 'movil')::bigint, rodar.ahora(), rodar.ahora(), rodar.t(p_b, 'dispositivo'));
  if coalesce(rodar.t(p_b, 'tipo'), 'web') = 'web' then perform rodar.accion(u, 'login_web', u.documento, 'Ingreso al panel'); end if;
  return jsonb_build_object('token', tk, 'usuario', jsonb_build_object('id', u.id, 'nombre', u.nombre, 'apellido', u.apellido, 'documento', u.documento, 'roles', string_to_array(u.roles, ','), 'foto', u.foto));
end $$;

create or replace function public.r_logout(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin update rodar.sesiones set activa = false where token = p_token; return '{"ok":true}'; end $$;

create or replace function public.r_me(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token);
begin
  return to_jsonb(u) - 'password_hash' || jsonb_build_object('roles', string_to_array(u.roles, ','),
    'moviles', rodar.lista(format('select id, numero from rodar.moviles where titular_id = %s or id in (select movil_id from rodar.movil_conductores where usuario_id = %s) order by numero', u.id, u.id)),
    'empresa', rodar.cfg('empresa'), 'canal', rodar.topico(''),
    'reportesAbiertos', (select count(*) from rodar.reportes where usuario_id = u.id and estado <> 'cerrado'));
end $$;

create or replace function public.r_me_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token);
begin
  if rodar.t(p_b, 'usuario') is not null and exists(select 1 from rodar.usuarios where usuario = rodar.t(p_b, 'usuario') and id <> u.id) then raise exception 'Ese usuario ya existe'; end if;
  update rodar.usuarios set nombre = coalesce(rodar.t(p_b, 'nombre'), nombre), apellido = coalesce(p_b ->> 'apellido', apellido), email = rodar.t(p_b, 'email'), telefono = rodar.t(p_b, 'telefono'),
    email_recupero = rodar.t(p_b, 'email_recupero'), tel_recupero = rodar.t(p_b, 'tel_recupero'), cbu = rodar.t(p_b, 'cbu'), alias_bancario = rodar.t(p_b, 'alias_bancario'),
    usuario = coalesce(rodar.t(p_b, 'usuario'), usuario), foto = coalesce(rodar.t(p_b, 'foto'), foto) where id = u.id;
  return '{"ok":true}';
end $$;

create or replace function public.r_me_password(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token);
begin
  if not rodar.verificar(coalesce(p_b ->> 'actual', ''), u.password_hash) then raise exception 'La contraseña actual no es correcta'; end if;
  if length(coalesce(p_b ->> 'nueva', '')) < 6 then raise exception 'La nueva contraseña debe tener al menos 6 caracteres'; end if;
  update rodar.usuarios set password_hash = rodar.hash(p_b ->> 'nueva') where id = u.id;
  perform rodar.accion(u, 'password_change_self', u.documento, null);
  return '{"ok":true}';
end $$;

-- Novedades
create or replace function public.r_novedades(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token);
begin
  return rodar.lista(format('select n.*, exists(select 1 from rodar.novedades_vistas v where v.usuario_id = %s and v.novedad_id = n.id) vista from rodar.novedades n order by fecha desc, id desc', u.id));
end $$;
create or replace function public.r_novedad_vista(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token);
begin insert into rodar.novedades_vistas values (u.id, (p_q ->> 'id')::bigint) on conflict do nothing; return '{"ok":true}'; end $$;
create or replace function public.r_novedad_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin');
begin
  if rodar.n(p_b, 'id') is not null then
    update rodar.novedades set seccion = p_b ->> 'seccion', etiqueta = p_b ->> 'etiqueta', titulo = p_b ->> 'titulo', cuerpo = p_b ->> 'cuerpo', fecha = coalesce(rodar.t(p_b, 'fecha')::date, rodar.hoy()), alerta = rodar.t(p_b, 'alerta') where id = rodar.n(p_b, 'id');
  else
    insert into rodar.novedades(seccion, etiqueta, titulo, cuerpo, fecha, alerta) values (coalesce(rodar.t(p_b, 'seccion'), 'semana'), p_b ->> 'etiqueta', p_b ->> 'titulo', p_b ->> 'cuerpo', coalesce(rodar.t(p_b, 'fecha')::date, rodar.hoy()), rodar.t(p_b, 'alerta'));
  end if;
  return '{"ok":true}';
end $$;
create or replace function public.r_novedad_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); delete from rodar.novedades where id = (p_q ->> 'id')::bigint; return '{"ok":true}'; end $$;

-- Reportes de fallas
create or replace function public.r_reportes(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); todos boolean;
begin
  todos := rodar.tiene(u, 'admin') and coalesce(p_q ->> 'todos', '') = '1';
  return rodar.lista(format($q$select r.*, trim(u.nombre || ' ' || coalesce(u.apellido, '')) usuario from rodar.reportes r join rodar.usuarios u on u.id = r.usuario_id
    where (%L::boolean or r.usuario_id = %s) and (%L <> 'abiertos' or r.estado <> 'cerrado') and (%L <> 'cerrados' or r.estado = 'cerrado') order by r.id desc$q$,
    todos, u.id, coalesce(p_q ->> 'estado', ''), coalesce(p_q ->> 'estado', '')));
end $$;
create or replace function public.r_reporte(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); r rodar.reportes;
begin
  select * into r from rodar.reportes where id = (p_q ->> 'id')::bigint;
  if not found or (r.usuario_id <> u.id and not rodar.tiene(u, 'admin')) then raise exception 'No encontrado'; end if;
  return to_jsonb(r) || jsonb_build_object('historial', rodar.lista('select * from rodar.reporte_historial where reporte_id = ' || r.id || ' order by id'));
end $$;
create or replace function public.r_reporte_crear(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); nid bigint;
begin
  if rodar.t(p_b, 'titulo') is null then raise exception 'Indicá un título'; end if;
  insert into rodar.reportes(usuario_id, titulo, descripcion, pantalla, fecha) values (u.id, p_b ->> 'titulo', p_b ->> 'descripcion', p_b ->> 'pantalla', rodar.ahora()) returning id into nid;
  insert into rodar.reporte_historial(reporte_id, de, texto, estado, fecha) values (nid, u.nombre, 'Reporte creado', 'abierto', rodar.ahora());
  return jsonb_build_object('id', nid);
end $$;
create or replace function public.r_reporte_responder(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.usuario(p_token); r rodar.reportes; est text;
begin
  select * into r from rodar.reportes where id = (p_q ->> 'id')::bigint;
  if not found or (r.usuario_id <> u.id and not rodar.tiene(u, 'admin')) then raise exception 'No encontrado'; end if;
  est := case when rodar.tiene(u, 'admin') and rodar.t(p_b, 'estado') is not null then p_b ->> 'estado' else r.estado end;
  update rodar.reportes set estado = est where id = r.id;
  insert into rodar.reporte_historial(reporte_id, de, texto, estado, fecha) values (r.id, u.nombre, coalesce(p_b ->> 'texto', ''), est, rodar.ahora());
  return '{"ok":true}';
end $$;

-- Catálogos
create or replace function public.r_catalogos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.usuario(p_token);
  return jsonb_build_object(
    'zonas', rodar.lista('select id, nombre, color, poligono, parada_lat, parada_lng, es_parada from rodar.zonas order by orden'),
    'canales', rodar.lista('select * from rodar.canales order by orden'),
    'medios', rodar.lista('select * from rodar.medios_pago order by orden'),
    'moviles', rodar.lista('select id, numero, patente from rodar.moviles order by numero'),
    'planes', rodar.lista('select id, descripcion from rodar.planes order by id'),
    'corporativos', rodar.lista('select * from rodar.corporativos where activo'),
    'peligrosas', rodar.lista('select * from rodar.zonas_peligrosas'),
    'empresa', rodar.cfg('empresa'));
end $$;

-- Estado general (pie del mapa) + ejecuta el ciclo de despacho
create or replace function public.r_estado(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare h timestamp := rodar.hoy(); t rodar.tarifas;
begin
  perform rodar.usuario(p_token);
  perform rodar.procesar(); perform rodar.ciclo_lento();
  t := rodar.tarifa_vigente();
  return jsonb_build_object('servidor', rodar.ahora(), 'clima', coalesce(rodar.cfg('clima'), '{"temp":null,"desc":"—","lluvia":false}'), 'indice', rodar.indice_zona(null, t), 'tarifa', t.nombre,
    'total', (select count(*) from rodar.viajes where creado >= h), 'reales', (select count(*) from rodar.viajes where creado >= h and estado = 'finalizado'),
    'reservas', (select count(*) from rodar.viajes where estado = 'reserva'), 'canales', (select count(*) from rodar.viajes where creado >= h and canal <> 'movil'),
    'recibidos', (select count(*) from rodar.viajes where creado >= h and estado in ('pendiente', 'ofrecido')),
    'conectados', (select count(*) from rodar.moviles where estado <> 'desconectado'));
end $$;

-- Ciclo ("latido") llamado periódicamente por el panel y la app de conductores
create or replace function public.r_tick(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.usuario(p_token); perform rodar.procesar(); perform rodar.ciclo_lento(); return '{"ok":true}'; end $$;

-- El navegador del panel informa el clima (Open-Meteo) para el índice dinámico
create or replace function public.r_clima(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.usuario(p_token); perform rodar.cfg_set('clima', jsonb_build_object('temp', p_b -> 'temp', 'desc', p_b -> 'desc', 'lluvia', rodar.b(p_b, 'lluvia'))); return '{"ok":true}'; end $$;

-- Simulador y configuración
create or replace function public.r_simulador(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.usuario(p_token); return rodar.cfg('simulador', '{"flota":true,"demanda":true}'); end $$;
create or replace function public.r_simulador_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare v jsonb := jsonb_build_object('flota', rodar.b(p_b, 'flota'), 'demanda', rodar.b(p_b, 'demanda')); vv rodar.viajes;
begin
  perform rodar.need(p_token, 'admin');
  perform pg_advisory_xact_lock(434343); -- espera a que termine el ciclo del simulador en curso
  perform rodar.cfg_set('simulador', v);
  if not rodar.b(p_b, 'flota') then
    -- los viajes que tenían móviles simulados vuelven al despacho (o se cierran si estaban en curso)
    perform pg_advisory_xact_lock(424242); -- y que no se esté despachando en este momento
    update rodar.moviles set estado = 'desconectado', conductor_id = null, parada_id = null where simulado and estado not in ('confirmado', 'con_pasajero');
    for vv in select x.* from rodar.viajes x join rodar.moviles m on m.id = x.movil_id where m.simulado and x.estado in ('ofrecido', 'confirmado', 'en_curso') loop
      begin
        if vv.estado = 'en_curso' then perform rodar.finalizar(vv.id, 1500, 0, null); else perform rodar.reasignar(vv.id); end if;
      exception when others then null; end;
    end loop;
    update rodar.moviles set estado = 'desconectado', conductor_id = null, parada_id = null where simulado;
    update rodar.sim_estado set dlat = null, dlng = null, metros = 0, espera = 0, decide_at = null, hacia_parada = null where movil_id is not null;
  end if;
  return v;
end $$;
create or replace function public.r_config_webhook(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); return jsonb_build_object('token', rodar.cfg('webhook_token') #>> '{}'); end $$;
create or replace function public.r_config_dispatch(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.usuario(p_token); return rodar.cfg('dispatch', '{}'); end $$;
create or replace function public.r_config_dispatch_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin perform rodar.need(p_token, 'admin'); perform rodar.cfg_set('dispatch', rodar.cfg('dispatch', '{}') || p_b); return '{"ok":true}'; end $$;
