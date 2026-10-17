-- ===================== Notificaciones push para el pasajero =====================
-- Avisa al pasajero con cuenta (celular bloqueado o app cerrada): remís en camino, remís en la puerta, viaje terminado o cancelado.
alter table rodar.push_subs add column if not exists cliente_id bigint;
alter table rodar.push_subs add column if not exists app text default 'conductor';
create index if not exists ix_push_subs_cliente on rodar.push_subs(cliente_id) where activa;

create or replace function rodar.push_subs_cliente(p_cliente bigint) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', p.endpoint, 'p256dh', p.p256dh, 'auth', p.auth)), '[]'::jsonb)
  from rodar.push_subs p join rodar.sesiones_clientes s on s.token = p.token and s.activa
  where p.activa and p.cliente_id = p_cliente
$$;

create or replace function rodar.push_pasajero(p_viaje bigint) returns void language plpgsql as $$
declare v rodar.viajes; m rodar.moviles; msg jsonb; clave text; url text; movil text;
begin
  select * into v from rodar.viajes where id = p_viaje;
  if v.id is null or v.cliente_id is null then return; end if;
  if not exists(select 1 from rodar.push_subs where cliente_id = v.cliente_id and activa) then return; end if;
  select * into m from rodar.moviles where id = v.movil_id;
  movil := case when m.id is not null then 'Móvil ' || m.numero || coalesce(' · ' || nullif(trim(coalesce(m.marca, '') || ' ' || coalesce(m.modelo, '') || ' ' || coalesce(m.color, '')), ''), '') || coalesce(' · ' || m.patente, '') else '' end;
  url := 'pasajero.html#/seguimiento/' || v.id || '?k=' || rodar.firma(v.id);
  if v.estado = 'confirmado' and v.llegada_at is not null then
    clave := 'pas-' || v.id || '-llego';
    msg := jsonb_build_object('titulo', '📍 Tu remís llegó', 'cuerpo', movil || E'\nTe está esperando en ' || coalesce(v.origen_dir, 'la dirección indicada'), 'fijo', true, 'ttl', 900);
  elsif v.estado = 'confirmado' then
    clave := 'pas-' || v.id || '-camino';
    msg := jsonb_build_object('titulo', '🚕 Tu remís está en camino', 'cuerpo', movil || E'\nTocá para seguirlo en el mapa', 'ttl', 1800);
  elsif v.estado = 'finalizado' then
    clave := 'pas-' || v.id || '-fin';
    msg := jsonb_build_object('titulo', '✅ ¡Llegaste!', 'cuerpo', case when coalesce(v.monto, 0) > 0 then 'Total: $ ' || replace(to_char(round(v.monto), 'FM999G999G999'), ',', '.') || '. ' else '' end || '¡Gracias por viajar con nosotros!', 'ttl', 3600);
  elsif v.estado = 'anulado' then
    clave := 'pas-' || v.id || '-anulado';
    msg := jsonb_build_object('titulo', 'Viaje cancelado', 'cuerpo', 'Tu viaje #' || v.id || ' fue cancelado. Si lo necesitás, pedí otro desde la app.', 'ttl', 3600);
  else
    return;
  end if;
  msg := msg || jsonb_build_object('tipo', 'pasajero', 'url', url, 'tag', 'rodar-viaje-' || v.id, 'viaje', v.id);
  perform rodar.push_enviar(rodar.push_subs_cliente(v.cliente_id), msg, clave);
exception when others then null;
end $$;

-- El emisor del tiempo real también avisa al pasajero cuando cambia su viaje
create or replace function rodar.emit(p_topic text, p_evento text, p_payload jsonb) returns void language plpgsql as $$
begin
  begin
    perform realtime.send(coalesce(p_payload, '{}'::jsonb), p_evento, rodar.topico(p_topic), false);
  exception when others then null; -- sin Realtime disponible: se ignora (los clientes también consultan periódicamente)
  end;
  if p_evento in ('oferta', 'oferta_abierta', 'oferta_cancelada', 'asignado', 'mensaje', 'mensaje_flota') then
    perform rodar.push_evento(p_topic, p_evento, p_payload);
  elsif p_evento = 'viaje' and p_topic like 'viaje-%' then
    perform rodar.push_pasajero(nullif(substring(p_topic from '^viaje-(\d+)-'), '')::bigint);
  end if;
end $$;

-- App del pasajero: clave pública y alta de la suscripción de este celular
create or replace function public.r_cli_push(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token); s jsonb := p_b -> 'sub'; k jsonb := rodar.cfg('push', '{}');
begin
  if s is null then return jsonb_build_object('publica', k ->> 'publica'); end if;
  if coalesce(s ->> 'endpoint', '') !~ '^https://' or coalesce(s #>> '{keys,p256dh}', '') = '' or coalesce(s #>> '{keys,auth}', '') = '' then raise exception 'Suscripción inválida'; end if;
  insert into rodar.push_subs(endpoint, p256dh, auth, token, movil_id, usuario_id, cliente_id, app, ua, activa, creado, actualizado)
  values (s ->> 'endpoint', s #>> '{keys,p256dh}', s #>> '{keys,auth}', p_token, null, null, c.id, 'pasajero', left(p_b ->> 'ua', 300), true, rodar.ahora(), rodar.ahora())
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, token = excluded.token, movil_id = null, usuario_id = null,
    cliente_id = excluded.cliente_id, app = 'pasajero', ua = excluded.ua, activa = true, actualizado = excluded.actualizado;
  return jsonb_build_object('ok', true);
end $$;

-- La app del conductor marca su suscripción como de conductor (el mismo celular puede usar las dos)
create or replace function public.r_cond_push(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare m rodar.moviles := rodar.movil_sesion(p_token); u rodar.usuarios := rodar.usuario(p_token); s jsonb := p_b -> 'sub'; c jsonb := rodar.cfg('push', '{}');
begin
  if s is null then return jsonb_build_object('publica', c ->> 'publica'); end if;
  if coalesce(s ->> 'endpoint', '') !~ '^https://' or coalesce(s #>> '{keys,p256dh}', '') = '' or coalesce(s #>> '{keys,auth}', '') = '' then raise exception 'Suscripción inválida'; end if;
  insert into rodar.push_subs(endpoint, p256dh, auth, token, movil_id, usuario_id, cliente_id, app, ua, activa, creado, actualizado)
  values (s ->> 'endpoint', s #>> '{keys,p256dh}', s #>> '{keys,auth}', p_token, m.id, u.id, null, 'conductor', left(p_b ->> 'ua', 300), true, rodar.ahora(), rodar.ahora())
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, token = excluded.token, movil_id = excluded.movil_id,
    usuario_id = excluded.usuario_id, cliente_id = null, app = 'conductor', ua = excluded.ua, activa = true, actualizado = excluded.actualizado;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.r_cli_push(text, jsonb, jsonb), public.r_cond_push(text, jsonb, jsonb) to anon, authenticated;
alter function rodar.push_pasajero(bigint) set search_path = rodar, public, extensions;
alter function rodar.emit(text, text, jsonb) set search_path = rodar, public, extensions;
notify pgrst, 'reload schema';
