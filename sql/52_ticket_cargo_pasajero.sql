-- El pasajero ve "Cargos de la plataforma" en su comprobante (historial y seguimiento)
do $$
declare d text; a text := 'v.calificacion, v.inicio_at, v.fin_at, v.motivo_anulacion,';
begin
  d := pg_get_functiondef('public.r_cli_viajes(text,jsonb,jsonb)'::regprocedure);
  if position('cargo_plataforma' in d) = 0 then
    if position(a in d) = 0 then raise exception 'r_cli_viajes cambió'; end if;
    execute replace(d, a, a || ' v.cargo_plataforma,');
  end if;
  d := pg_get_functiondef('rodar.publico_pasajero(bigint)'::regprocedure);
  a := $q$'monto', coalesce(v.monto, v.monto_estimado),$q$;
  if position('cargo_plataforma' in d) = 0 then
    if position(a in d) = 0 then raise exception 'publico_pasajero cambió'; end if;
    execute replace(d, a, a || $q$ 'cargo_plataforma', v.cargo_plataforma,$q$);
  end if;
end $$;
