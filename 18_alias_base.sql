-- Alias de Mercado Pago al que los móviles transfieren la base (si la central no puso otro).
do $$ begin
  perform rodar.cfg_set('mp', coalesce(rodar.cfg('mp', '{}'), '{}'::jsonb) || jsonb_build_object('alias_cobro', 'danderfertcesar.mp')
    ) where coalesce(rodar.cfg('mp', '{}') ->> 'alias_cobro', '') = '';
end $$;
