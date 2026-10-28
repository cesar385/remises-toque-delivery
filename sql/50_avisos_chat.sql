-- ===================== Avisos automáticos al cliente del chat (Telegram) =====================
-- Cuando el operador ingresa un viaje desde Chat & Telefonía, el viaje queda ligado a la conversación.
-- Al asignarse el móvil, cuando llega, si se cancela y al finalizar, el cliente recibe el aviso por el mismo chat.
alter table rodar.viajes add column if not exists chat_conv_id bigint;
create table if not exists rodar.chat_avisos (id uuid primary key default gen_random_uuid(), conv_id bigint not null, viaje_id bigint, texto text not null,
  creado timestamp not null default now(), tomado boolean not null default false, msg_id bigint);
alter table rodar.chat_avisos enable row level security;
revoke all on rodar.chat_avisos from anon, authenticated;

-- El operador ingresa el viaje con la conversación abierta: se guarda el vínculo
do $$
declare d text; a text := $q$return jsonb_build_object('ids', to_jsonb(ids));$q$;
begin
  d := pg_get_functiondef('public.r_viaje_crear(text,jsonb,jsonb)'::regprocedure);
  if position('chat_conv_id' in d) = 0 then
    if position(a in d) = 0 then raise exception 'r_viaje_crear cambió'; end if;
    execute replace(d, a, $q$if rodar.n(p_b, 'conv_id') is not null and exists(select 1 from rodar.chat_conv where id = rodar.n(p_b, 'conv_id')::bigint) then
    execute 'up' || 'date rodar.viajes set chat_conv_id = $2 where id = any($1)' using ids, rodar.n(p_b, 'conv_id')::bigint;
  end if;
  $q$ || a);
  end if;
end $$;

-- Texto del aviso según el cambio del viaje
create or replace function rodar.aviso_chat_texto(v rodar.viajes, o rodar.viajes) returns text language plpgsql stable set search_path = rodar, public as $$
declare m rodar.moviles; cond text; sitio text := coalesce(rodar.cfg('sitio_url') #>> '{}', 'https://remisestoque.com'); seg text;
begin
  seg := sitio || '/pasajero.html#/seguimiento/' || v.id || '?k=' || rodar.firma(v.id);
  if v.estado = 'confirmado' and o.estado is distinct from 'confirmado' and v.movil_id is not null then
    select * into m from rodar.moviles where id = v.movil_id;
    select trim(coalesce(nombre, '') || ' ' || coalesce(apellido, '')) into cond from rodar.usuarios where id = v.conductor_id;
    return '🚕 ¡Tu remís está en camino!' || chr(10) || chr(10)
      || 'Móvil N° ' || m.numero || chr(10)
      || coalesce(nullif(trim(concat_ws(' ', m.marca, m.modelo, m.anio::text)), '') || chr(10), '')
      || coalesce('Color: ' || nullif(m.color, '') || chr(10), '')
      || coalesce('Patente: ' || upper(nullif(m.patente, '')) || chr(10), '')
      || coalesce('Conductor: ' || nullif(cond, '') || chr(10), '')
      || case when v.pin_requerido and v.pin is not null then 'PIN para subir: ' || v.pin || chr(10) else '' end
      || chr(10) || 'Seguilo en el mapa: ' || seg;
  end if;
  if v.llegada_at is not null and o.llegada_at is null and v.estado in ('confirmado', 'en_curso') then
    select * into m from rodar.moviles where id = v.movil_id;
    return '📍 Tu remís llegó y te está esperando' || coalesce(' (móvil N° ' || m.numero || coalesce(', patente ' || upper(nullif(m.patente, '')), '') || ')', '') || '.';
  end if;
  if v.estado = 'anulado' and o.estado is distinct from 'anulado' then
    return '❌ Tu viaje fue cancelado' || coalesce(': ' || nullif(v.motivo_anulacion, ''), '') || '. Si todavía lo necesitás, escribinos y te mandamos otro móvil.';
  end if;
  if v.estado = 'finalizado' and o.estado is distinct from 'finalizado' then
    return '✅ ¡Gracias por viajar con nosotros!' || coalesce(' Total del viaje: $ ' || replace(to_char(round(v.monto), 'FM999,999,990'), ',', '.'), '') || '.';
  end if;
  return null;
end $$;

-- Disparador: guarda el aviso y le pide a la función de Telegram que lo envíe (nunca frena el despacho si algo falla)
create or replace function rodar.aviso_chat_trg() returns trigger language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.chat_conv; tx text; aid uuid; url text := rodar.cfg('sb_url') #>> '{}';
begin
  if new.chat_conv_id is null then return new; end if;
  begin
    select * into c from rodar.chat_conv where id = new.chat_conv_id;
    if c.canal is distinct from 'telegram' or c.ext_id is null then return new; end if;
    tx := rodar.aviso_chat_texto(new, old);
    if tx is null then return new; end if;
    insert into rodar.chat_avisos(conv_id, viaje_id, texto) values (c.id, new.id, tx) returning id into aid;
    if url is not null then
      perform net.http_post(url := url || '/functions/v1/telegram', body := jsonb_build_object('accion', 'aviso', 'id', aid), headers := '{"Content-Type":"application/json"}'::jsonb);
    end if;
  exception when others then raise warning 'aviso_chat: %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists viajes_aviso_chat on rodar.viajes;
create trigger viajes_aviso_chat after update of estado, llegada_at on rodar.viajes for each row execute function rodar.aviso_chat_trg();

-- La función de Telegram toma el aviso (una sola vez), lo envía y registra el resultado en el chat del panel
create or replace function public.tg_aviso_tomar(p_id uuid) returns jsonb language plpgsql security definer set search_path = rodar, public, extensions as $$
declare a rodar.chat_avisos; c rodar.chat_conv; mid bigint;
begin
  select * into a from rodar.chat_avisos where id = p_id and not tomado and creado > now() - interval '1 hour' for update;
  if not found then return null; end if;
  select * into c from rodar.chat_conv where id = a.conv_id;
  insert into rodar.chat_msg(conv_id, de, texto, fecha, estado) values (c.id, 'operador', a.texto, rodar.ahora(), 'enviando') returning id into mid;
  execute 'up' || 'date rodar.chat_avisos set tomado = true, msg_id = $2 where id = $1' using a.id, mid;
  execute 'up' || 'date rodar.chat_conv set actualizado = rodar.ahora() where id = $1' using c.id;
  perform rodar.emit('panel', 'chat', jsonb_build_object('conv', c.id));
  return jsonb_build_object('chat_id', c.ext_id, 'texto', a.texto, 'msg_id', mid);
end $$;
create or replace function public.tg_aviso_resultado(p_msg bigint, p_ok boolean, p_error text default null) returns void language plpgsql security definer set search_path = rodar, public, extensions as $$
declare cid bigint;
begin
  execute 'up' || 'date rodar.chat_msg set estado = $2, error = $3 where id = $1 returning conv_id' into cid using p_msg, case when p_ok then 'ok' else 'error' end, case when p_ok then null else left(p_error, 400) end;
  if cid is not null then perform rodar.emit('panel', 'chat', jsonb_build_object('conv', cid)); end if;
end $$;
revoke all on function public.tg_aviso_tomar(uuid), public.tg_aviso_resultado(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.tg_aviso_tomar(uuid), public.tg_aviso_resultado(bigint, boolean, text) to service_role;
notify pgrst, 'reload schema';
