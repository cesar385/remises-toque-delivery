-- ===================== Licencia del sistema (venta a otras remiserías) =====================
-- Cada remisería cliente tiene su propio proyecto de Supabase. Esta parte lo conecta con tu
-- central de clientes (supabase/central.sql): cada 10 minutos le pregunta el estado de su
-- suscripción y actúa en consecuencia:
--   prueba / activo → funciona normal
--   moroso          → funciona, y el panel muestra un aviso con la fecha de suspensión
--   suspendido/baja → la página y las apps dejan de funcionar y muestran el motivo
-- También aplica el tope de móviles del plan contratado.
--
-- Si la tabla rodar.licencia está vacía (tu propia remisería), no se controla nada.
-- Para conectar un cliente, el panel de superadministrador genera el SQL con sus datos.

-- pg_net hace los pedidos HTTP a la central (en Supabase viene disponible; acá se activa)
do $$ begin create extension if not exists pg_net; exception when others then null; end $$;

create table if not exists rodar.licencia (
  id int primary key default 1 check (id = 1),
  central_url text not null,          -- https://xxxx.supabase.co de la central
  central_anon text not null,         -- clave anon de la central
  slug text not null,                 -- identificador del cliente en la central
  token text not null,                -- clave secreta del cliente
  estado text not null default 'activo',
  plan text,
  max_moviles int,
  vence date,
  suspende date,
  mensaje text,
  pago_url text,                      -- link de Mercado Pago para pagar la suscripción
  verificada timestamptz,             -- última respuesta de la central
  pedido bigint                       -- último pedido HTTP enviado (pg_net)
);
alter table rodar.licencia enable row level security;
alter table rodar.licencia add column if not exists pago_url text;

-- Estado actual: 'propia' si no hay licencia configurada
create or replace function rodar.licencia_estado() returns text language sql stable
set search_path = rodar, pg_temp as $$
  select coalesce((select estado from rodar.licencia where id = 1), 'propia') $$;

-- Cantidad de móviles reales (sin los del simulador)
create or replace function rodar.licencia_moviles() returns int language sql stable
set search_path = rodar, pg_temp as $$
  select count(*)::int from rodar.moviles where not coalesce(simulado, false) $$;

-- ---------- tope de móviles del plan ----------
create or replace function rodar.licencia_tope_moviles() returns trigger language plpgsql
set search_path = rodar, pg_temp as $$
declare l rodar.licencia;
begin
  if coalesce(new.simulado, false) then return new; end if;
  select * into l from rodar.licencia where id = 1;
  if found and l.max_moviles is not null and rodar.licencia_moviles() >= l.max_moviles then
    raise exception 'Tu plan % permite hasta % móviles. Para sumar más, pedí un cambio de plan.', coalesce(l.plan, ''), l.max_moviles;
  end if;
  return new;
end $$;
drop trigger if exists licencia_tope_moviles on rodar.moviles;
create trigger licencia_tope_moviles before insert on rodar.moviles
  for each row execute function rodar.licencia_tope_moviles();

-- ---------- consulta a la central ----------
-- 1) procesa la respuesta del pedido anterior, 2) envía un pedido nuevo.
-- Usa pg_net (pedidos HTTP desde la base). Si la central no responde, se mantiene el último estado.
create or replace function rodar.licencia_sincronizar() returns jsonb language plpgsql
security definer set search_path = rodar, extensions, pg_temp as $$
declare l rodar.licencia; r record; j jsonb;
begin
  select * into l from rodar.licencia where id = 1 for update;
  if not found then return jsonb_build_object('estado', 'propia'); end if;

  if l.pedido is not null then
    begin
      select status_code, content into r from net._http_response where id = l.pedido;
      if found and r.status_code = 200 then
        j := r.content::jsonb;
        if j ? 'estado' then
          update rodar.licencia set
            estado = case when j->>'estado' = 'desconocido' then 'suspendido' else j->>'estado' end,
            plan = j->>'plan',
            max_moviles = nullif(j->>'max_moviles','')::int,
            vence = nullif(j->>'vence','')::date,
            suspende = nullif(j->>'suspende','')::date,
            mensaje = j->>'mensaje',
            pago_url = j->>'pago_url',
            verificada = now()
          where id = 1;
        end if;
      end if;
    exception when others then null;   -- respuesta ilegible: se reintenta en el próximo ciclo
    end;
  end if;

  update rodar.licencia set pedido = net.http_post(
      url := rtrim(l.central_url, '/') || '/rest/v1/rpc/saas_licencia',
      body := jsonb_build_object('p_slug', l.slug, 'p_token', l.token, 'p_moviles', rodar.licencia_moviles()),
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', l.central_anon, 'Authorization', 'Bearer ' || l.central_anon),
      timeout_milliseconds := 8000)
  where id = 1;

  select * into l from rodar.licencia where id = 1;
  return jsonb_build_object('estado', l.estado, 'verificada', l.verificada);
end $$;
revoke all on function rodar.licencia_sincronizar() from public, anon, authenticated;

-- Ciclo automático cada 10 minutos (si pg_cron está activado)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('rodar-licencia', '*/10 * * * *', 'select rodar.licencia_sincronizar()');
  end if;
exception when others then null;
end $$;

-- ---------- bloqueo de la API cuando el servicio está suspendido ----------
-- PostgREST llama a esta función antes de cada pedido. Si la licencia está suspendida o dada de baja,
-- corta el pedido con LICENCIA_SUSPENDIDA (las páginas muestran el motivo). Deja pasar la consulta
-- del propio estado (r_licencia) y la central de clientes (saas_*), por si está en el mismo proyecto.
create or replace function public.rodar_pre_request() returns void language plpgsql stable
security definer set search_path = rodar, pg_temp as $$
declare e text; ruta text;
begin
  select estado into e from rodar.licencia where id = 1;
  if e is null or e not in ('suspendido', 'baja') then return; end if;
  ruta := coalesce(current_setting('request.path', true), '');
  if ruta like '%/rpc/r_licencia' or ruta like '%/rpc/saas\_%' then return; end if;
  raise exception 'LICENCIA_SUSPENDIDA';
end $$;
grant execute on function public.rodar_pre_request() to anon, authenticated, service_role;

do $$
begin
  execute 'alter role authenticator set pgrst.db_pre_request to ''public.rodar_pre_request''';
  notify pgrst, 'reload config';
exception when others then
  raise notice 'No se pudo activar el bloqueo por licencia (pgrst.db_pre_request): %', sqlerrm;
end $$;

-- ---------- estado para las páginas ----------
create or replace function public.r_licencia(p_token text default null, p_q jsonb default '{}', p_b jsonb default '{}') returns jsonb
language sql stable security definer set search_path = rodar, pg_temp as $$
  select case when l.id is null then jsonb_build_object('estado', 'propia')
    else jsonb_build_object('estado', l.estado, 'plan', l.plan, 'max_moviles', l.max_moviles, 'moviles', rodar.licencia_moviles(),
                            'vence', l.vence, 'suspende', l.suspende, 'mensaje', l.mensaje, 'verificada', l.verificada,
                            'pago_url', l.pago_url) end
  from (select 1) x left join rodar.licencia l on l.id = 1 $$;
grant execute on function public.r_licencia(text, jsonb, jsonb) to anon, authenticated;
