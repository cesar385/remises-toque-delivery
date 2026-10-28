-- Ticket / comprobante: datos completos del móvil (N°, marca, modelo, año, color, patente, licencia) y del conductor.
-- El DNI del conductor solo va en el ticket del panel y de la app del conductor (r_ticket), no en el del pasajero.
do $$
declare d text;
begin
  d := pg_get_functiondef('rodar.viaje_detalle(bigint)'::regprocedure);
  if position('movil_licencia' in d) = 0 then
    if position($q$'movil_color', m.color,$q$ in d) = 0 then raise exception 'viaje_detalle cambió'; end if;
    execute replace(d, $q$'movil_color', m.color,$q$, $q$'movil_color', m.color, 'movil_anio', m.anio, 'movil_licencia', m.licencia,$q$);
  end if;
  d := pg_get_functiondef('public.r_ticket(text,jsonb,jsonb)'::regprocedure);
  if position('conductor_documento' in d) = 0 then
    if position($q$jsonb_build_object('empresa', rodar.cfg('empresa'))$q$ in d) = 0 then raise exception 'r_ticket cambió'; end if;
    execute replace(d, $q$jsonb_build_object('empresa', rodar.cfg('empresa'))$q$,
      $q$jsonb_build_object('empresa', rodar.cfg('empresa'), 'conductor_documento', (select documento from rodar.usuarios where id = v.conductor_id))$q$);
  end if;
  d := pg_get_functiondef('public.r_cli_viajes(text,jsonb,jsonb)'::regprocedure);
  if position('movil_licencia' in d) = 0 then
    if position('m.color movil_color,' in d) = 0 then raise exception 'r_cli_viajes cambió'; end if;
    execute replace(d, 'm.color movil_color,', 'm.color movil_color, m.marca movil_marca, m.modelo movil_modelo, m.anio movil_anio, m.licencia movil_licencia,');
  end if;
end $$;
