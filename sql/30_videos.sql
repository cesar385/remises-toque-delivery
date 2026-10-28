-- Videos de la página principal subidos desde el panel (Supabase Storage, bucket público "videos", hasta 50 MB por archivo).
-- La subida la autoriza la Edge Function "subir-video", que verifica con esta función que quien sube sea administrador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.r_video_permiso(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare u rodar.usuarios := rodar.need(p_token, 'admin');
begin
  perform rodar.accion(u, 'video_subido', null, 'Subió un video para la página principal: ' || coalesce(left(p_b ->> 'nombre', 120), ''));
  return jsonb_build_object('ok', true, 'usuario', u.id);
end $$;
grant execute on function public.r_video_permiso(text, jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
