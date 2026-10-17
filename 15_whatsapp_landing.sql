-- ===================== WhatsApp en el panel + página principal editable =====================

-- ---- Mensajes: estado de envío (para WhatsApp real) ----
alter table rodar.chat_msg add column if not exists estado text default 'ok';   -- ok | enviando | error
alter table rodar.chat_msg add column if not exists error text;
alter table rodar.chat_msg add column if not exists wa_id text;

-- Paso 1 del envío a WhatsApp: guarda el mensaje del operador como "enviando" y devuelve el teléfono.
-- Lo llama la función de Supabase "whatsapp" con la sesión del operador.
create or replace function public.r_wa_preparar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador'); c rodar.chat_conv; mid bigint; tx text := trim(coalesce(p_b ->> 'texto', ''));
begin
  select * into c from rodar.chat_conv where id = rodar.n(p_b, 'conv_id')::bigint;
  if not found then raise exception 'La conversación no existe'; end if;
  if c.canal <> 'whatsapp' then raise exception 'La conversación no es de WhatsApp'; end if;
  if tx = '' then raise exception 'Escribí un mensaje'; end if;
  if length(tx) > 4000 then raise exception 'El mensaje es demasiado largo'; end if;
  insert into rodar.chat_msg(conv_id, de, texto, fecha, estado) values (c.id, 'operador', tx, rodar.ahora(), 'enviando') returning id into mid;
  update rodar.chat_conv set actualizado = rodar.ahora() where id = c.id;
  perform rodar.emit('panel', 'chat', jsonb_build_object('conv', c.id));
  return jsonb_build_object('msg_id', mid, 'telefono', c.telefono);
end $$;

-- Paso 2: resultado del envío (ok o error devuelto por WhatsApp)
create or replace function public.r_wa_resultado(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare cid bigint; ok boolean := rodar.b(p_b, 'ok');
begin
  perform rodar.need(p_token, 'operador');
  update rodar.chat_msg set estado = case when ok then 'ok' else 'error' end, error = case when ok then null else left(coalesce(p_b ->> 'error', 'No se pudo enviar'), 400) end, wa_id = p_b ->> 'wa_id'
    where id = rodar.n(p_b, 'msg_id')::bigint and de = 'operador' returning conv_id into cid;
  if cid is not null then perform rodar.emit('panel', 'chat', jsonb_build_object('conv', cid)); end if;
  return '{"ok":true}';
end $$;

-- ---- Página principal editable ----
-- Se guarda en rodar.config con la clave 'landing': { whatsapp, whatsapp_texto, telefono, secciones: [...] }.
-- Si no hay nada guardado, la página usa su contenido original.
create or replace function public.r_pub_landing(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  return coalesce(nullif(rodar.cfg('landing', 'null'::jsonb), 'null'::jsonb), 'null'::jsonb);
end $$;

create or replace function public.r_landing(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'admin');
  return coalesce(nullif(rodar.cfg('landing', 'null'::jsonb), 'null'::jsonb), 'null'::jsonb);
end $$;

create or replace function public.r_landing_guardar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin');
begin
  if rodar.b(p_b, 'restaurar') then
    delete from rodar.config where clave = 'landing';
    perform rodar.accion(u, 'landing_restaurada', null, 'Página principal restaurada al contenido original');
    return '{"ok":true}';
  end if;
  if jsonb_typeof(p_b -> 'secciones') <> 'array' then raise exception 'Datos de la página inválidos'; end if;
  if jsonb_array_length(p_b -> 'secciones') > 40 then raise exception 'Demasiadas secciones (máximo 40)'; end if;
  if length(p_b::text) > 6000000 then raise exception 'El contenido es demasiado grande. Usá imágenes más livianas.'; end if;
  perform rodar.cfg_set('landing', p_b);
  perform rodar.accion(u, 'landing_guardada', null, 'Se modificó la página principal');
  return '{"ok":true}';
end $$;

-- r_pub_config ahora también devuelve el WhatsApp de la página principal
create or replace function public.r_pub_config(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare e jsonb := rodar.cfg('empresa', '{}'); l jsonb := coalesce(nullif(rodar.cfg('landing', 'null'::jsonb), 'null'::jsonb), '{}'::jsonb);
begin
  return jsonb_build_object('nombre', e ->> 'nombre', 'lat', e -> 'lat', 'lng', e -> 'lng', 'telefono', coalesce(nullif(l ->> 'telefono', ''), e ->> 'telefono'), 'localidad', e ->> 'localidad', 'provincia', e ->> 'provincia',
    'whatsapp', l ->> 'whatsapp', 'whatsapp_texto', l ->> 'whatsapp_texto',
    'medios', rodar.lista('select codigo, nombre from rodar.medios_pago where habilitado and codigo not in (''cuenta_corriente'') order by orden'));
end $$;

notify pgrst, 'reload schema';
