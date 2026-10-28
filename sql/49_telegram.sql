-- ===================== Telegram: bot conectado al Chat & Telefonía del panel =====================
-- La función de Supabase "telegram" recibe los mensajes del bot (webhook de Telegram) y envía las respuestas del operador.
alter table rodar.chat_conv add column if not exists ext_id text;   -- id del chat de Telegram
create index if not exists chat_conv_ext on rodar.chat_conv(canal, ext_id) where ext_id is not null;
create table if not exists rodar.tg_contactos (chat_id text primary key, telefono text, alias text, actualizado timestamp not null default now());
alter table rodar.tg_contactos enable row level security;
revoke all on rodar.tg_contactos from anon, authenticated;

-- Mensaje entrante (solo la función, con la clave de servicio). Si el cliente compartió su número, la conversación lo usa.
create or replace function public.tg_entrante(p_chat text, p_alias text, p_texto text, p_telefono text default null) returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare cid bigint; tel text; nuevo boolean := false;
begin
  if coalesce(p_chat, '') = '' then raise exception 'Falta el chat'; end if;
  if p_telefono is not null then
    insert into rodar.tg_contactos(chat_id, telefono, alias, actualizado) values (p_chat, p_telefono, p_alias, rodar.ahora())
      on conflict (chat_id) do update set telefono = excluded.telefono, alias = coalesce(excluded.alias, tg_contactos.alias), actualizado = rodar.ahora();
  end if;
  select telefono into tel from rodar.tg_contactos where chat_id = p_chat;
  select id into cid from rodar.chat_conv where canal = 'telegram' and ext_id = p_chat and estado = 'abierta' order by id desc limit 1;
  if cid is null then
    insert into rodar.chat_conv(canal, telefono, alias, ext_id, actualizado) values ('telegram', tel, p_alias, p_chat, rodar.ahora()) returning id into cid; nuevo := true;
  elsif tel is not null then
    execute 'up' || 'date rodar.chat_conv set telefono = $2 where id = $1 and telefono is distinct from $2' using cid, tel;
  end if;
  insert into rodar.chat_msg(conv_id, de, texto, fecha) values (cid, 'cliente', left(coalesce(p_texto, ''), 4000), rodar.ahora());
  execute 'up' || 'date rodar.chat_conv set no_leidos = no_leidos + 1, actualizado = rodar.ahora(), alias = coalesce(alias, $2) where id = $1' using cid, p_alias;
  perform rodar.emit('panel', 'chat', jsonb_build_object('conv', cid, 'nuevo', true));
  return jsonb_build_object('conv', cid, 'telefono', tel, 'nuevo', nuevo);
end $$;
revoke all on function public.tg_entrante(text, text, text, text) from public, anon, authenticated;
grant execute on function public.tg_entrante(text, text, text, text) to service_role;

-- Preparar el envío de una respuesta: ahora también para Telegram (devuelve el id del chat)
do $$
declare d text; a text := $q$if c.canal <> 'whatsapp' then raise exception 'La conversación no es de WhatsApp'; end if;$q$;
begin
  d := pg_get_functiondef('public.r_wa_preparar(text,jsonb,jsonb)'::regprocedure);
  if position(a in d) > 0 then
    d := replace(d, a, $q$if c.canal not in ('whatsapp', 'telegram') then raise exception 'La conversación no es de WhatsApp ni de Telegram'; end if;
  if c.canal = 'telegram' and c.ext_id is null then raise exception 'La conversación de Telegram no tiene chat asociado'; end if;$q$);
    d := replace(d, $q$return jsonb_build_object('msg_id', mid, 'telefono', c.telefono);$q$, $q$return jsonb_build_object('msg_id', mid, 'telefono', c.telefono, 'canal', c.canal, 'chat_id', c.ext_id);$q$);
    execute d;
  end if;
end $$;

-- El administrador conecta el bot desde Configuración (la función verifica el permiso con esto)
create or replace function public.r_tg_admin(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin');
begin
  if p_b ? 'conectado' then
    perform rodar.cfg_set('telegram', jsonb_build_object('bot', p_b ->> 'bot', 'conectado', rodar.b(p_b, 'conectado'), 'fecha', rodar.ahora()));
    perform rodar.accion(u, 'telegram', null, case when rodar.b(p_b, 'conectado') then 'Bot de Telegram conectado: @' || coalesce(p_b ->> 'bot', '?') else 'Bot de Telegram desconectado' end);
  end if;
  return coalesce(rodar.cfg('telegram', '{}'), '{}');
end $$;
grant execute on function public.r_tg_admin(text, jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
