-- "Quiero ser conductor": documentación obligatoria (DNI frente y dorso, licencia; cédula y seguro si tiene vehículo propio).
-- El certificado de antecedentes penales es opcional.
create or replace function public.r_solicitud_conductor(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
#variable_conflict use_variable
declare tipos text[]; sin_auto boolean; falta text[] := '{}'; req text;
begin
  if rodar.t(p_b, 'nombre') is null or rodar.t(p_b, 'dni') is null or rodar.t(p_b, 'telefono') is null then raise exception 'Completá nombre, DNI y teléfono'; end if;
  select coalesce(array_agg(x ->> 'tipo') filter (where coalesce(x ->> 'archivo', '') <> ''), '{}'), bool_or(x ->> 'tipo' = 'Sin vehículo propio')
    into tipos, sin_auto from jsonb_array_elements(coalesce(p_b -> 'docs', '[]')) x;
  foreach req in array array['DNI (frente)', 'DNI (dorso)', 'Licencia de conducir'] || case when coalesce(sin_auto, false) then '{}'::text[] else array['Cédula del vehículo', 'Seguro del vehículo'] end loop
    if not req = any(tipos) then falta := falta || req; end if;
  end loop;
  if array_length(falta, 1) > 0 then raise exception 'Falta cargar: %', array_to_string(falta, ', '); end if;
  if (select count(*) from rodar.solicitudes_conductor where fecha > rodar.ahora() - interval '1 hour') > 30 then raise exception 'Demasiadas solicitudes, probá más tarde'; end if;
  insert into rodar.solicitudes_conductor(nombre, apellido, dni, telefono, email, patente, marca, modelo, anio, origen, docs, fecha)
  values (p_b ->> 'nombre', p_b ->> 'apellido', p_b ->> 'dni', p_b ->> 'telefono', p_b ->> 'email', p_b ->> 'patente', p_b ->> 'marca', p_b ->> 'modelo', rodar.n(p_b, 'anio')::int, coalesce(rodar.t(p_b, 'origen'), 'web'), coalesce((p_b -> 'docs')::text, '[]'), rodar.ahora());
  perform rodar.emit('panel', 'aviso', jsonb_build_object('texto', 'Nueva solicitud de alta de conductor: ' || (p_b ->> 'nombre') || ' ' || coalesce(p_b ->> 'apellido', '')));
  return '{"ok":true}';
end $$;
notify pgrst, 'reload schema';
