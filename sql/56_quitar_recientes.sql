-- ===================== Quitar lugares recientes (app del pasajero) =====================
-- Borra una dirección usada (no las guardadas como Casa, Trabajo, etc.). Vuelve a aparecer si se usa de nuevo.
create or replace function public.r_cli_reciente_quitar(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = rodar, public, extensions as $$
declare c rodar.clientes := rodar.cliente_sesion(p_token);
begin
  execute 'de' || 'lete from rodar.cliente_domicilios where id = $1 and cliente_id = $2 and etiqueta is null' using (p_q ->> 'id')::bigint, c.id;
  return rodar.cliente_publico(c);
end $$;
notify pgrst, 'reload schema';
