-- Mensaje claro cuando un usuario sin empresa intenta entrar a la app de empresas
do $$
declare d text; a text := $q$raise exception 'Este usuario no es de una empresa';$q$;
begin
  d := pg_get_functiondef('rodar.usuario_empresa(text)'::regprocedure);
  if position(a in d) > 0 then
    execute replace(d, a, $q$raise exception 'Tu usuario no está asociado a ninguna empresa. Pedile a la central que te cree un usuario de empresa.';$q$);
  end if;
end $$;
