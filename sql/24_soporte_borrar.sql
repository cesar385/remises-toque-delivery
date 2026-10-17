-- ===================== Soporte / Reclamos: eliminar conversaciones =====================
-- Elimina una conversación con todos sus mensajes (operador o admin).
create or replace function public.r_soporte_borrar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador'); cid bigint := (p_q ->> 'id')::bigint; c rodar.soporte_conv;
begin
  select * into c from rodar.soporte_conv where id = cid;
  if not found then raise exception 'La conversación no existe'; end if;
  delete from rodar.soporte_msg where conv_id = cid;
  delete from rodar.soporte_conv where id = cid;
  perform rodar.accion(u, 'soporte_eliminado', cid::text, 'Se eliminó la conversación de soporte #' || cid || ' (' || coalesce(c.asunto, '') || ')');
  perform rodar.emit('panel', 'soporte', jsonb_build_object('conv', cid, 'borrada', true));
  return jsonb_build_object('ok', true);
end $$;

-- Elimina de una vez todas las conversaciones cerradas.
create or replace function public.r_soporte_borrar_cerradas(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'operador'); n int;
begin
  delete from rodar.soporte_msg where conv_id in (select id from rodar.soporte_conv where cerrada);
  delete from rodar.soporte_conv where cerrada;
  get diagnostics n = row_count;
  if n > 0 then perform rodar.accion(u, 'soporte_eliminado', null, 'Se eliminaron ' || n || ' conversaciones de soporte cerradas'); end if;
  perform rodar.emit('panel', 'soporte', jsonb_build_object('borradas', n));
  return jsonb_build_object('ok', true, 'borradas', n);
end $$;

grant execute on function public.r_soporte_borrar(text, jsonb, jsonb), public.r_soporte_borrar_cerradas(text, jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
