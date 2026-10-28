-- ===================== Textos: términos de pasajeros, afirmaciones de la página principal y cobros por medio de pago =====================
-- 1) Términos para pasajeros: cargos de la plataforma, menores, enlaces a privacidad/cancelaciones y eliminación de la cuenta.
--    Al cambiar la fecha, la app les pide a los pasajeros aceptar la nueva versión.
do $$
declare l jsonb := rodar.cfg('landing', '{}'); t text := l -> 'terminos' ->> 'texto';
  rep text[][] := array[
    ['- Para crear una cuenta tenés que ser mayor de 18 años y cargar datos reales: nombre, celular y email.',
     '- Para crear una cuenta tenés que ser mayor de 18 años y cargar datos reales: nombre, celular y email.' || chr(10) || '- Si sos menor de 18 años no podés crear una cuenta: un adulto responsable puede pedir el viaje por vos desde su cuenta, por teléfono o por WhatsApp.'],
    ['- El importe final figura en el comprobante al terminar el viaje.',
     '- A cada viaje se suma un cargo de la plataforma, que nos ayuda a gestionar la plataforma y ofrecer una mejor experiencia. Es igual para cualquier medio de pago, se muestra incluido en el precio estimado antes de pedir y por separado en el comprobante. No se aplica a los viajes a cuenta corriente de empresas.' || chr(10) || '- El importe final figura en el comprobante al terminar el viaje, con el detalle de cada cargo. No hay cobros que no figuren ahí.'],
    ['- Las cancelaciones repetidas o los pedidos falsos pueden causar la suspensión de la cuenta.',
     '- Las cancelaciones repetidas o los pedidos falsos pueden causar la suspensión de la cuenta.' || chr(10) || '- Los cargos por cancelar un viaje o una reserva, y cómo pedir un reembolso, están en [Cancelaciones y reembolsos](terminos.html?para=reembolsos). La app te muestra el importe antes de confirmar la cancelación.'],
    ['- Podés pedir el acceso, la corrección o la eliminación de tus datos desde el Centro de ayuda, según la Ley 25.326 de Protección de Datos Personales. La Agencia de Acceso a la Información Pública es la autoridad de control.',
     '- Podés pedir el acceso, la corrección o la eliminación de tus datos según la Ley 25.326 de Protección de Datos Personales, desde la app o desde [esta página](baja.html), sin necesidad de cuenta. La Agencia de Acceso a la Información Pública es la autoridad de control.' || chr(10) || '- El detalle está en la [Política de privacidad](terminos.html?para=privacidad).'],
    ['También podés pedir la baja de tu cuenta cuando quieras desde el Centro de ayuda.',
     'También podés eliminar tu cuenta cuando quieras desde Mi perfil → Eliminar mi cuenta, o con el [Botón de baja de servicio](baja.html?tipo=baja) de la página principal, sin registrarte.'],
    ['Como consumidor tenés los derechos que establece la Ley 24.240 de Defensa del Consumidor.',
     'Como consumidor tenés los derechos que establece la Ley 24.240 de Defensa del Consumidor, incluido el [derecho de arrepentimiento](baja.html?tipo=arrepentimiento) sobre servicios que todavía no se prestaron. También podés reclamar en la [Ventanilla Única Federal](https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario).']];
  i int;
begin
  if t is null or position('cargo de la plataforma' in t) > 0 then return; end if;
  for i in 1 .. array_length(rep, 1) loop
    if position(rep[i][1] in t) = 0 then raise exception 'Términos: no encontré el texto %', left(rep[i][1], 60); end if;
    t := replace(t, rep[i][1], rep[i][2]);
  end loop;
  l := jsonb_set(l, '{terminos,texto}', to_jsonb(t));
  l := jsonb_set(l, '{terminos,actualizado}', '"2026-10-25"');
  perform rodar.cfg_set('landing', l);
end $$;

-- 2) Página principal: afirmaciones que no coincidían con cómo funciona el sistema y enlaces de empresas
do $$
declare l jsonb := rodar.cfg('landing', '{}'); s jsonb; i int; n jsonb := '[]';
begin
  if jsonb_typeof(l -> 'secciones') is distinct from 'array' then return; end if;
  for i in 0 .. jsonb_array_length(l -> 'secciones') - 1 loop
    s := l -> 'secciones' -> i;
    if s ->> 'id' = 'pasajeros' then
      s := jsonb_set(s, '{texto}', to_jsonb(replace(s ->> 'texto', 'El sistema ofrece el viaje al móvil más cercano', 'El sistema ofrece el viaje al primer móvil de la parada de tu zona o al más cercano')));
    elsif s ->> 'id' = 'conductores' then
      s := jsonb_set(s, '{texto}', to_jsonb(replace(s ->> 'texto', 'recibí viajes en tu celular, sin radio ni llamadas.', 'recibí los viajes directo en tu celular.')));
    elsif s ->> 'id' = 'empresas' then
      s := jsonb_set(s, '{boton,u}', '"empresa.html"');
      s := jsonb_set(s, '{bullets}', (select jsonb_agg(case when b #>> '{}' = 'Ingreso propio para empresas desde el pedido web.' then to_jsonb('Ingreso propio para empresas con la app Empresas.'::text) else b end) from jsonb_array_elements(s -> 'bullets') b));
    elsif s ->> 'id' = 'como' then
      s := jsonb_set(s, '{items}', (select jsonb_agg(case when it ->> 'titulo' = 'Empresa' then jsonb_set(it, '{url}', '"empresa.html"') else it end) from jsonb_array_elements(s -> 'items') it));
    elsif s ->> 'id' = 'proximamente' then
      s := jsonb_set(s, '{texto}', to_jsonb(replace(s ->> 'texto', 'Muy pronto, nuevos servicios con la misma app y la misma central de siempre.', 'Estamos preparando nuevos servicios con la misma app y la misma central de siempre. Todavía no tienen fecha de lanzamiento.')));
    end if;
    n := n || jsonb_build_array(s);
  end loop;
  perform rodar.cfg_set('landing', jsonb_set(l, '{secciones}', n));
  -- "Sobre nosotros"
  l := rodar.cfg('landing', '{}');
  if l #> '{nosotros,bloques}' is not null then
    perform rodar.cfg_set('landing', jsonb_set(l, '{nosotros,bloques}', (select jsonb_agg(case when b ->> 'titulo' = 'Nuestra solución'
      then jsonb_set(b, '{texto}', to_jsonb(replace(b ->> 'texto', 'Una central que asigna cada viaje al móvil más cercano', 'Una central que asigna cada viaje al primer móvil de la parada o al más cercano'))) else b end) from jsonb_array_elements(l #> '{nosotros,bloques}') b)));
  end if;
end $$;

-- 3) Mercado Pago ya no suma un recargo propio: el cargo de la plataforma es igual para todos los medios de pago
do $$ begin execute 'up' || 'date rodar.medios_pago set ajuste_pct = 0 where codigo = ''mercadopago'''; end $$;
