-- Viajes de la empresa: datos del móvil y medio de pago para el ticket (app de empresas y "Mi empresa" en la web del pasajero)
do $$
declare d text; a text := $q$'movil_numero', m.numero,$q$;
begin
  d := pg_get_functiondef('rodar.viaje_empresa(rodar.viajes)'::regprocedure);
  if position('movil_marca' in d) = 0 then
    if position(a in d) = 0 then raise exception 'viaje_empresa cambió'; end if;
    execute replace(d, a, $q$'movil_numero', m.numero, 'medio_pago', coalesce(v.medio_pago, 'cuenta_corriente'), 'movil_marca', m.marca, 'movil_modelo', m.modelo, 'movil_anio', m.anio, 'movil_color', m.color, 'monto_estimado', v.monto_estimado,$q$);
  end if;
end $$;
