-- ===================== Mapa más ágil y cambios de estado al instante =====================
-- 1) Datos livianos para el mapa del panel: ubicación, estado, conductor y parada (se consulta cada 2,5 s; el resto cada 6 s).
create or replace function public.r_mapa_pos(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
begin
  perform rodar.need(p_token, 'operador');
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'lat', m.lat, 'lng', m.lng, 'rumbo', m.rumbo, 'velocidad', m.velocidad, 'estado', m.estado,
    'ultima_senal', to_char(m.ultima_senal, 'YYYY-MM-DD HH24:MI:SS'), 'conductor_id', m.conductor_id,
    'conductor', nullif(trim(coalesce(u.nombre, '') || ' ' || coalesce(u.apellido, '')), ''), 'parada_id', m.parada_id, 'parada_ingreso', m.parada_ingreso))
    from rodar.moviles m left join rodar.usuarios u on u.id = m.conductor_id where m.habilitado), '[]');
end $$;

-- 2) Cuando la central cambia el estado de un móvil: avisa a la app del conductor y devuelve el móvil actualizado al panel
create or replace function public.r_movil_estado(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
#variable_conflict use_variable
declare u rodar.usuarios := rodar.need(p_token, 'operador'); id bigint := (p_q ->> 'id')::bigint; m rodar.moviles;
begin
  perform rodar.set_estado_movil(id, p_b ->> 'estado', rodar.n(p_b, 'parada_id')::bigint, true);
  if p_b ->> 'estado' = 'fuera_servicio' then perform rodar.evento_movil(id, 'fuera_servicio', null, 'Puesto fuera de servicio por ' || u.nombre); end if;
  select * into m from rodar.moviles where moviles.id = id;
  perform rodar.emit('movil-' || id, 'estado', jsonb_build_object('estado', m.estado, 'por', 'central'));
  return jsonb_build_object('ok', true, 'movil', rodar.movil_publico(m));
end $$;
notify pgrst, 'reload schema';
