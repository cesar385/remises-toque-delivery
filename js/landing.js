// Página principal: contenido original, dibujado de secciones y utilidades (lo usan index.html y el editor del panel).
(function () {
  const DEFAULT = {
    whatsapp: '', whatsapp_texto: 'Hola, quiero pedir un remís', telefono: '', pie: '',
    secciones: [
      { id: 'inicio', tipo: 'hero', visible: true, menu: '', titulo: 'Tu remís', destacado: 'a un click', texto: 'Pedí tu viaje desde el celular, seguilo en tiempo real y pagá como prefieras. ¿Querés manejar? Sumate a nuestra flota.',
        boton: { t: 'Pedí tu remís', u: 'pasajero.html' }, boton2: { t: 'Quiero ser conductor', u: 'conductor.html#alta' } },
      { id: 'pasajeros', tipo: 'texto', visible: true, menu: 'Pasajero', titulo: 'Conectá tu próximo viaje con TOQUE! Pasajero', texto: 'Elegí de dónde salís y a dónde vas. El sistema ofrece el viaje al móvil más cercano y te avisa cuando está en camino.',
        bullets: [], boton: { t: 'Pedir un viaje', u: 'pasajero.html' }, boton2: { t: 'Crear mi cuenta', u: 'pasajero.html#/crear' }, visual: 'celular', emoji: '', imagen: '', lado: 'der', fondo: 'blanco' },
      { id: 'como', tipo: 'tarjetas', visible: true, menu: '', titulo: '¿Cómo querés usar TOQUE!?', texto: 'Cada perfil tiene su propia pantalla de ingreso.', fondo: 'gris', items: [
        { emoji: '🙂', titulo: 'Pasajero', texto: 'Pedí un viaje, guardá tus lugares y mirá tus viajes anteriores.', cta: 'Pedir o ingresar →', url: 'pasajero.html' },
        { emoji: '🚕', titulo: 'Conductor', texto: 'Recibí viajes, cambiá tu estado y controlá tu cuenta desde el celular.', cta: 'Ingresar →', url: 'conductor.html' },
        { emoji: '🏢', titulo: 'Empresa', texto: 'Viajes a cuenta corriente para tu equipo, con ingreso de empresas.', cta: 'Ingreso empresas →', url: 'empresa.html' },
        { emoji: '🎧', titulo: 'Operador', texto: 'Central de despacho, mapa, informes y administración de la flota.', cta: 'Ingresar →', url: 'panel.html#/login' }] },
      { id: 'conductores', tipo: 'texto', visible: true, menu: 'Conductor', titulo: 'Manejá con TOQUE! Conductor', texto: 'Sumate a la flota y recibí viajes en tu celular, sin radio ni llamadas.',
        bullets: ['Los viajes te llegan como oferta: aceptás o rechazás con un toque.', 'Cola por parada: el primero en llegar es el primero en recibir viajes.', 'Consultá tu saldo y movimientos, y pedí cargas por Mercado Pago o transferencia.', 'Soporte directo con la central desde la app.'],
        boton: { t: 'Registrate como conductor', u: 'conductor.html#alta' }, boton2: { t: '', u: '' }, visual: 'emoji', emoji: '🚕', imagen: '', lado: 'izq', fondo: 'blanco' },
      { id: 'empresas', tipo: 'texto', visible: true, menu: 'Empresas', titulo: 'Viajes para tu empresa', texto: 'Si tu empresa tiene cuenta corriente, tus viajes quedan a su cargo y con centro de costo.',
        bullets: ['Ingreso propio para empresas desde el pedido web.', 'Seguimiento de cada viaje en tiempo real.', 'Pedí a la central si necesitás alta de cuenta.'],
        boton: { t: 'Ingreso para empresas', u: 'empresa.html' }, boton2: { t: '', u: '' }, visual: 'emoji', emoji: '🏢', imagen: '', lado: 'der', fondo: 'gris' },
      { id: 'proximamente', tipo: 'tarjetas', visible: true, menu: 'Próximamente', titulo: 'Próximamente en TOQUE!', texto: 'Muy pronto, nuevos servicios con la misma app y la misma central de siempre.', fondo: '', items: [
        { emoji: '🏍️', titulo: 'Remis TOQUE! Moto', texto: 'Viajes ágiles en moto, ideales para cuando vas solo y querés llegar rápido.', cta: 'Próximamente', url: '' },
        { emoji: '🛵', titulo: 'Delivery TOQUE!', texto: 'Envíos, compras y encomiendas llevados de puerta a puerta por nuestros repartidores.', cta: 'Próximamente', url: '' }] },
      { id: 'seguridad', tipo: 'banner', visible: true, menu: 'Seguridad', emoji: '🛡️', titulo: 'En TOQUE!, tu seguridad es nuestra prioridad', texto: 'Seguimiento del viaje en tiempo real, datos del móvil y del conductor antes de subir y botón de emergencia en la app del conductor.',
        boton: { t: 'Saber más', u: '#ayuda' } },
      { id: 'ayuda', tipo: 'tarjetas', visible: true, menu: 'Ayuda', titulo: 'Todo lo que necesitás saber', texto: '', fondo: 'gris', items: [
        { emoji: 'ℹ️', titulo: 'Sobre nosotros', texto: 'Por qué nació Remises TOQUE! y qué problema busca resolver.', cta: 'Saber más →', url: 'nosotros.html' },
        { emoji: '📘', titulo: 'Manual del pasajero', texto: 'Paso a paso: crear tu cuenta, pedir tu remís y seguir el viaje.', cta: 'Leer el manual →', url: 'manual-pasajero.html' },
        { emoji: '💬', titulo: 'Centro de ayuda', texto: 'Consultas, reclamos y objetos olvidados: escribinos y te respondemos.', cta: 'Ir a ayuda →', url: 'ayuda.html' }] },
    ],
    // Página "Sobre nosotros" (nosotros.html), editable desde Administración → Página principal
    nosotros: {
      titulo: 'Sobre nosotros', bajada: 'Por qué nació Remises TOQUE! y qué problema busca resolver.',
      bloques: [
        { emoji: '🌱', titulo: '¿Por qué nació?', texto: 'Remises TOQUE! nació en Federal, Entre Ríos, para que pedir un remís sea tan simple como tocar un botón. Queríamos sumar la tecnología de las grandes ciudades a una remisería de nuestra ciudad, sin perder el trato cercano de siempre.' },
        { emoji: '📞', titulo: 'El problema', texto: 'Pedir un remís dependía de una llamada: líneas ocupadas, demoras para conseguir un móvil y la incertidumbre de no saber cuándo llega ni cuánto va a costar el viaje.' },
        { emoji: '🚕', titulo: 'Nuestra solución', texto: 'Una central que asigna cada viaje al móvil más cercano, el seguimiento del remís en el mapa en tiempo real, el precio estimado antes de viajar y un comprobante de cada viaje.' },
        { emoji: '🤝', titulo: 'Para todos', texto: 'Pasajeros que viajan más tranquilos, conductores que reciben más viajes desde el celular y una central que organiza mejor la flota.' },
      ],
      cierre: '¿Necesitás un remís? Pedilo ahora desde el celular.',
    },
    // Página "Términos y condiciones" (terminos.html), editable desde Administración → Página principal.
    // Formato del texto: "## Título" para cada sección, "- " para viñetas y una línea en blanco entre párrafos.
    terminos: {
      titulo: 'Términos y condiciones para pasajeros', actualizado: '2026-10-18',
      texto: `## 1. Aceptación de los términos
Estos Términos y condiciones regulan el uso de la app de pasajeros, la página web y los demás canales (WhatsApp y teléfono) de Remises TOQUE!, remisería de la ciudad de Federal, Entre Ríos.
Al crear una cuenta, pedir un viaje o usar la app aceptás estos términos. Si no estás de acuerdo, no uses el servicio.

## 2. Definiciones
- Remises TOQUE! o "la central": la remisería que organiza el servicio, recibe los pedidos y asigna los móviles.
- Pasajero o usuario: la persona que pide o realiza un viaje.
- Conductor: la persona habilitada por la central para manejar un móvil y realizar los viajes.
- Móvil: el vehículo habilitado que realiza el viaje.
- App: la app de pasajeros, la página web y los demás medios digitales de Remises TOQUE!.

## 3. El servicio
- Remises TOQUE! presta el servicio de transporte de pasajeros en remís con móviles y conductores habilitados.
- La app sirve para pedir viajes, reservarlos, seguir el móvil en el mapa, pagar y recibir el comprobante.
- La disponibilidad de móviles depende del horario, la demanda y las condiciones del tránsito y del clima. No podemos garantizar un móvil en todo momento.
- Los tiempos de llegada y los precios estimados que muestra la app son orientativos.

## 4. Requisitos y cuenta
- Para crear una cuenta tenés que ser mayor de 18 años y cargar datos reales: nombre, celular y email.
- La cuenta es personal. Sos responsable de cuidar tu contraseña y de los pedidos que se hagan desde ella.
- Si sospechás que alguien usa tu cuenta, avisanos de inmediato desde el Centro de ayuda.
- Las empresas con cuenta corriente pueden pedir viajes para su personal según lo acordado con la central.

## 5. Pedidos y reservas
- Al pedir un viaje indicás la dirección de origen y la de destino. Revisá que sean correctas: un dato equivocado puede generar demoras o cargos.
- Podés reservar viajes para más tarde. La central confirma la reserva y asigna un móvil antes del horario.
- Te avisamos cuando el móvil está en camino y cuando llega a la puerta.
- Al subir, dale al conductor el PIN de seguridad que aparece en tu app. El viaje empieza recién cuando el conductor confirma el PIN.

## 6. Tarifas
- El precio se calcula con la tabla de tarifas vigente en la central, según la distancia recorrida y el tiempo de espera.
- Los viajes fuera de la ciudad o de larga distancia pueden tener una tarifa por kilómetro diferente.
- En horarios nocturnos, feriados o días de alta demanda la central puede aplicar recargos, que se informan en la app antes de confirmar el pedido.
- Peajes, estacionamientos u otros gastos pedidos por el pasajero se suman al importe del viaje.
- El importe final figura en el comprobante al terminar el viaje.

## 7. Pagos
- Podés pagar en efectivo, por transferencia o con Mercado Pago, según los medios habilitados.
- Los pagos con Mercado Pago se hacen en la plataforma de Mercado Pago, sujetos a sus propios términos. Remises TOQUE! no guarda los datos de tus tarjetas.
- El comprobante que entrega la app no es válido como factura. Si necesitás factura, pedila en la central.
- Si hay un error en el cobro, avisanos desde el Centro de ayuda dentro de los 30 días del viaje.

## 8. Cancelaciones y esperas
- Podés cancelar el viaje desde la app durante el tiempo que se muestra en la pantalla de seguimiento. Pasado ese tiempo, tenés que comunicarte con la central.
- Si el móvil llega y el pasajero no se presenta dentro del tiempo de tolerancia, el conductor puede retirarse y la central puede cobrar un cargo por el traslado.
- El tiempo de espera a pedido del pasajero se cobra según la tarifa vigente.
- Las cancelaciones repetidas o los pedidos falsos pueden causar la suspensión de la cuenta.

## 9. Seguridad
- Antes de subir, verificá que el número de móvil, la patente y el nombre del conductor coincidan con los que muestra la app.
- Usá el PIN de seguridad y compartí el seguimiento del viaje con alguien de confianza si lo necesitás.
- El cinturón de seguridad es obligatorio para todos los ocupantes.
- Ante una emergencia, comunicate con el 911 y avisá a la central.

## 10. Normas de conducta
- Tratá con respeto al conductor y a la central. No se toleran agresiones, discriminación ni acoso.
- No se permite fumar, consumir alcohol o sustancias ni comer dentro del móvil sin autorización del conductor.
- No se pueden transportar objetos peligrosos, ilegales o que superen la capacidad del vehículo.
- La cantidad de pasajeros no puede superar la permitida para el vehículo.
- El conductor puede negarse a iniciar o continuar un viaje si se pone en riesgo su seguridad, la de terceros o la del vehículo.

## 11. Daños y limpieza
El pasajero es responsable de los daños que cause al vehículo y de la suciedad fuera de lo normal. La central puede cobrar el costo de la reparación o de la limpieza, informándolo con su detalle.

## 12. Menores, mascotas y equipaje
- Los menores de 14 años tienen que viajar acompañados por un adulto. Para niños pequeños se recomienda llevar la silla de seguridad correspondiente.
- Las mascotas pueden viajar en transportadora o con correa, consultando antes con la central. Los perros de asistencia viajan siempre.
- El equipaje tiene que entrar en el baúl o en el espacio disponible del vehículo.

## 13. Objetos olvidados
Revisá tus pertenencias antes de bajar. Si olvidaste algo, avisanos desde el Centro de ayuda: haremos lo posible por recuperarlo, pero no somos responsables por objetos perdidos.

## 14. Calificaciones
Después de cada viaje podés calificar al conductor. Las calificaciones nos ayudan a mejorar el servicio y tienen que ser honestas y respetuosas.

## 15. Ubicación y notificaciones
- La app usa la ubicación de tu celular para sugerir la dirección de origen y para que el conductor te encuentre. Podés escribir la dirección a mano si no querés compartir tu ubicación.
- Te enviamos notificaciones sobre el estado del viaje. Podés desactivarlas desde la configuración del celular.

## 16. Datos personales
- Usamos tus datos (nombre, celular, email, direcciones, historial de viajes y ubicación durante el viaje) solo para prestar el servicio, comunicarnos con vos, atender reclamos y mejorar la atención.
- El conductor asignado ve tu nombre, tu teléfono y las direcciones del viaje solo para realizarlo.
- No vendemos tus datos. Solo los compartimos cuando la ley o una autoridad competente lo exigen.
- Podés pedir el acceso, la corrección o la eliminación de tus datos desde el Centro de ayuda, según la Ley 25.326 de Protección de Datos Personales. La Agencia de Acceso a la Información Pública es la autoridad de control.

## 17. Responsabilidad
- Remises TOQUE! responde por el servicio de transporte según las leyes vigentes y cuenta con los seguros exigidos para el transporte de pasajeros.
- No somos responsables por demoras o fallas causadas por el tránsito, el clima, cortes de servicios de internet o telefonía, ni por casos fortuitos o de fuerza mayor.
- La app puede tener interrupciones por mantenimiento o fallas técnicas. Cuando pase, podés pedir tu remís por teléfono o WhatsApp.

## 18. Suspensión de la cuenta
Podemos suspender o dar de baja cuentas que incumplan estos términos, hagan pedidos falsos, agredan a conductores u operadores, o usen el servicio con fines ilegales. También podés pedir la baja de tu cuenta cuando quieras desde el Centro de ayuda.

## 19. Consultas y reclamos
Podés hacer consultas y reclamos desde el Centro de ayuda de la app o la página. Te respondemos a la brevedad. Como consumidor tenés los derechos que establece la Ley 24.240 de Defensa del Consumidor.

## 20. Cambios en estos términos
Podemos actualizar estos términos. La versión vigente es la publicada en esta página, con su fecha de actualización. Si el cambio es importante, te lo avisamos en la app.

## 21. Ley aplicable
Estos términos se rigen por las leyes de la República Argentina. Ante cualquier conflicto serán competentes los tribunales correspondientes al domicilio del pasajero, según la Ley de Defensa del Consumidor.`,
    },
    // Términos para conductores (terminos.html?para=conductores)
    terminos_cond: {
      titulo: 'Términos y condiciones para conductores', actualizado: '2026-10-18',
      texto: `## 1. Aceptación de los términos
Estos Términos y condiciones regulan el uso de la app de conductores de Remises TOQUE!, remisería de la ciudad de Federal, Entre Ríos.
Al ingresar a la app o enviar una solicitud para ser conductor aceptás estos términos, además de las condiciones que acuerdes por escrito con la central.

## 2. Relación con la central
- El conductor o el titular del móvil se adhiere a Remises TOQUE! para recibir viajes de la central, según el plan elegido (por ejemplo: día de base, abono mensual o porcentaje por viaje).
- La app es una herramienta de trabajo para recibir viajes, navegar, cobrar y comunicarse con la central.
- Las condiciones particulares (plan, montos, horarios y obligaciones) se informan en la app y se acuerdan con la central.

## 3. Requisitos para manejar
- Ser mayor de 21 años y tener licencia de conducir profesional vigente para la categoría que corresponda.
- Contar con la habilitación municipal de remís, la revisión técnica (VTV/RTO) y el seguro obligatorio con cobertura para pasajeros transportados, todo vigente.
- Presentar el certificado de antecedentes penales y la documentación que pida la central.
- Mantener la documentación al día y avisar cualquier vencimiento, multa grave o suspensión de la licencia. La central puede pedirla en cualquier momento.

## 4. Cuenta y uso personal
- El usuario y la contraseña son personales: no se pueden prestar ni compartir.
- Solo puede manejar el conductor registrado y en el móvil asignado.
- El conductor es responsable de lo que se haga desde su sesión.

## 5. Ubicación y uso de la app
- Mientras estás en servicio, la app comparte la ubicación del móvil con la central, también con la pantalla apagada o en segundo plano. Así se asignan los viajes al móvil más cercano y se cuida la seguridad de conductores y pasajeros.
- Al pasar a "Fuera de servicio" o cerrar la sesión, la app deja de enviar la ubicación.
- La app registra los recorridos de los viajes para calcular las tarifas y atender reclamos.
- No manipules el celular mientras manejás. Usá un soporte y la radio solo cuando sea seguro.

## 6. Ofertas y asignación de viajes
- La central ofrece cada viaje al móvil disponible más cercano o al primero de la parada. Tenés un tiempo limitado para aceptarlo.
- Los rechazos o las ofertas no respondidas en forma repetida pueden generar penalizaciones temporales, según las reglas de la central.
- Una vez aceptado el viaje, tenés que ir a buscar al pasajero sin demoras injustificadas. Si no podés realizarlo, avisá de inmediato a la central.

## 7. Realización del viaje
- Al llegar, marcá "Llegué" en la app. Pedile al pasajero el PIN de seguridad y confirmalo para iniciar el viaje.
- Usá el recorrido más conveniente, salvo que el pasajero pida otro.
- Al terminar, finalizá el viaje en la app: el importe se calcula con la tarifa de la central.
- No se pueden cobrar importes distintos a los de la app, ni recargos que la central no haya autorizado.
- Entregá el comprobante del viaje si el pasajero lo pide.

## 8. Viajes de calle
Los viajes que tomes en la calle o en la parada tienen que registrarse en la app como viaje de calle, para que queden en el historial y se cobren con la tarifa vigente.

## 9. Cobros y medios de pago
- El pasajero puede pagar en efectivo, por transferencia o con Mercado Pago, según los medios habilitados.
- Si vinculás tu cuenta de Mercado Pago, los pagos de los pasajeros entran directo a tu cuenta y, en ese mismo pago, la central puede descontar lo que el móvil debe de base o de cargos, con el tope informado en la app. Mercado Pago aplica sus propias comisiones y condiciones.
- Si no vinculaste tu cuenta, los pagos con Mercado Pago entran a la cuenta de la central y se rinden según lo acordado.
- Cada conductor o titular es responsable de sus obligaciones impositivas y previsionales por sus ingresos.

## 10. Plan, base y cuenta del móvil
- La base o la cuota del plan se carga en la cuenta del móvil según la periodicidad del plan. En el plan de día de base, se carga a las 00:01 y se puede pagar hasta las 23:59 de ese mismo día.
- Podés pagarla en efectivo en la central, por transferencia, con Mercado Pago o descontada de tus cobros con Mercado Pago.
- Si la deuda supera el límite del plan, el móvil queda bloqueado y no recibe viajes hasta que se pague. La central puede otorgar una prórroga.
- En "Mi billetera" ves el saldo y todos los movimientos de la cuenta.

## 11. Calificaciones y calidad
- Los pasajeros califican cada viaje. Las calificaciones bajas en forma repetida, los reclamos o las faltas de conducta pueden llevar a una advertencia, una suspensión o la baja.
- Mantené el vehículo limpio, en buen estado mecánico y con la identificación del móvil visible.

## 12. Conducta y seguridad
- Tratá con respeto a pasajeros, operadores y compañeros. No se toleran agresiones, discriminación ni acoso.
- Está prohibido manejar bajo los efectos del alcohol o de cualquier sustancia, y fumar dentro del vehículo.
- Respetá las normas de tránsito, las velocidades máximas y el uso del cinturón de seguridad.
- Podés negarte a llevar a un pasajero que ponga en riesgo tu seguridad, la de terceros o la del vehículo, avisando a la central.
- Ante una emergencia usá el botón de emergencia de la app y llamá al 911.

## 13. Incidentes, objetos olvidados y reclamos
- Avisá de inmediato a la central cualquier accidente, incidente o daño ocurrido durante un viaje.
- Si un pasajero olvida un objeto, entregalo en la central lo antes posible.
- Los reclamos de pasajeros se analizan con el registro del viaje y el descargo del conductor.

## 14. Datos personales
- La central usa tus datos (identidad, contacto, documentación, vehículo, ubicación en servicio, viajes y cobros) para gestionar el servicio, la seguridad, la facturación y los reclamos.
- Al pasajero solo se le muestran tu nombre, el número de móvil, el vehículo, la patente y tu ubicación durante el viaje.
- Podés pedir el acceso, la corrección o la eliminación de tus datos según la Ley 25.326 de Protección de Datos Personales, salvo los que la central deba conservar por ley.

## 15. Suspensión y baja
La central puede suspender o dar de baja la cuenta del conductor si incumple estos términos o las condiciones acordadas, si su documentación está vencida, si hay deudas sin pagar o por razones de seguridad. El conductor puede pedir la baja cuando quiera, después de saldar la cuenta del móvil.

## 16. Responsabilidad
- El conductor y el titular son responsables por el estado del vehículo, la documentación y el cumplimiento de las normas de tránsito.
- La app puede tener interrupciones por mantenimiento, fallas técnicas o falta de conexión. En esos casos seguí las indicaciones de la central por radio o teléfono.

## 17. Cambios en estos términos
La central puede actualizar estos términos. La versión vigente es la publicada en esta página, con su fecha de actualización. Los cambios importantes se avisan en la app.

## 18. Ley aplicable
Estos términos se rigen por las leyes de la República Argentina. Ante cualquier conflicto serán competentes los tribunales ordinarios de la provincia de Entre Ríos.`,
    },
  };

  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Solo enlaces seguros: páginas del sitio, anclas, http(s), mailto, tel y WhatsApp.
  function url(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^(https?:\/\/|mailto:|tel:)/i.test(u) || /^[\w\-./]+\.html?(#.*)?$/i.test(u) || /^#[\w\-/]*$/.test(u) || /^[\w\-./]*#\/?[\w\-/?=&]*$/.test(u)) return u;
    return '';
  }
  const dataImg = s => (/^(data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s"'<>]+)$/i.test(String(s || '')) ? s : '');
  const slug = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seccion';
  // Los botones de "empresas" guardados con el enlace viejo (ingreso de pasajeros) van al ingreso de empresas.
  const emp = (u, t) => { const x = String(u || '').trim();
    if (/^pasajero\.html#\/empresas$/.test(x) || (/empresa/i.test(t || '') && /^pasajero\.html#\/ingresar$/.test(x))) return 'empresa.html'; // las empresas entran a su app
    if (/ayuda|reclamo/i.test(t || '') && /^pasajero\.html$/.test(x)) return 'ayuda.html';
    if (/sobre nosotros/i.test(t || '') && /^#/.test(x)) return 'nosotros.html'; // "Saber más" de Sobre nosotros abre su página // "Ir a ayuda" abre el formulario de soporte / reclamos
    return u; };
  const btn = (b, cls) => (b && b.t && url(emp(b.u, b.t)) ? `<a class="btn ${cls || ''}" href="${esc(url(emp(b.u, b.t)))}">${esc(b.t)}</a>` : '');

  function visual(s) {
    if (s.visual === 'celular') return `<div class="cel" aria-hidden="true"><div class="barra">Pedí tu remís</div><div class="mapa"><div class="pin"></div></div><div class="campo">Origen<b>San Martín 450</b></div><div class="campo">Destino<b>Terminal de ómnibus</b></div><div class="ok">Pedir ahora</div></div>`;
    if (s.visual === 'imagen' && dataImg(s.imagen)) return `<img class="foto-img" src="${esc(dataImg(s.imagen))}" alt="${esc(s.titulo)}" loading="lazy">`;
    if (s.visual === 'ninguno') return '';
    return `<div class="foto" aria-hidden="true">${esc(s.emoji || '🚕')}</div>`;
  }

  // Videos: YouTube, Vimeo, Google Drive, Facebook o un archivo .mp4/.webm con dirección https
  function video(u) {
    u = String(u || '').trim(); let m;
    if ((m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i))) return { src: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0', vertical: /shorts\//i.test(u) };
    if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i))) return { src: 'https://player.vimeo.com/video/' + m[1] };
    if ((m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]{20,})/i))) return { src: 'https://drive.google.com/file/d/' + m[1] + '/preview' };
    if (/^https:\/\/(www\.|m\.)?(facebook\.com|fb\.watch)\//i.test(u)) return { src: 'https://www.facebook.com/plugins/video.php?show_text=false&href=' + encodeURIComponent(u) };
    if (/^https:\/\/[^\s"'<>]+\.(mp4|webm|mov|m4v)(\?[^\s"'<>]*)?$/i.test(u)) return { archivo: u };
    return null;
  }
  // Consentimiento para contenido de terceros (aviso de cookies): 'todas' | 'necesarias'
  const tercerosOk = () => { try { return localStorage.getItem('rodar_cookies') === 'todas'; } catch { return false; } };
  const origenVideo = src => /youtube/.test(src) ? 'YouTube' : /vimeo/.test(src) ? 'Vimeo' : /drive\.google/.test(src) ? 'Google Drive' : /facebook/.test(src) ? 'Facebook' : 'otro sitio';
  const iframeVideo = (src, tit) => `<iframe src="${esc(src)}" title="${esc(tit || 'Video')}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  function videoHtml(v) {
    const x = video(v.url); if (!x) return '';
    const cap = v.titulo ? `<figcaption>${esc(v.titulo)}</figcaption>` : '';
    // Archivos de video propios: se reproducen solos, sin sonido y en bucle (como un GIF)
    const media = x.archivo ? `<video src="${esc(x.archivo)}" autoplay muted loop playsinline preload="metadata" disablepictureinpicture disableremoteplayback aria-label="${esc(v.titulo || 'Video')}"></video>`
      : tercerosOk() ? iframeVideo(x.src, v.titulo)
      // sin aceptar el contenido de terceros: el video se carga recién al tocarlo (ver js/pie-legal.js)
      : `<button type="button" class="vid-ok" data-src="${esc(x.src)}" data-tit="${esc(v.titulo || 'Video')}"><span>▶</span><b>Ver video</b><small>Se carga desde ${esc(origenVideo(x.src))}, que puede usar cookies propias.</small></button>`;
    return `<figure class="vid${x.vertical ? ' vert' : ''}"><div class="mar">${media}</div>${cap}</figure>`;
  }

  // Videos agregados a cualquier sección (se muestran debajo de su contenido)
  function extraVideos(s, desde) { const vs = (s.videos || []).slice(desde || 0).map(videoHtml).filter(Boolean); return vs.length ? `<div class="videos${vs.length === 1 ? ' uno' : ''}">${vs.join('')}</div>` : ''; }

  // Redes sociales de la empresa (se cargan en Administración → Página principal). Íconos: Simple Icons (CC0).
  const REDES = [
    { k: 'facebook', n: 'Facebook', base: 'https://www.facebook.com' + '/', d: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z' },
    { k: 'instagram', n: 'Instagram', base: 'https://www.instagram.com' + '/', d: 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077' },
    { k: 'tiktok', n: 'TikTok', base: 'https://www.tiktok.com/@' + '', d: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z' },
    { k: 'x', n: 'X (Twitter)', base: 'https://www.x.com' + '/', d: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z' },
    { k: 'youtube', n: 'YouTube', base: 'https://www.youtube.com/@' + '', d: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
    { k: 'linkedin', n: 'LinkedIn', base: 'https://www.linkedin.com/company' + '/', d: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
  ];
  // Acepta el enlace completo o solo el usuario (@remisestoque)
  function redUrl(r, v) {
    v = String(v || '').trim(); if (!v) return '';
    if (/^https:\/\/[^\s"'<>]+$/i.test(v)) return v;
    if (/^(www\.)?[a-z0-9-]+\.[a-z]{2,}\/[^\s"'<>]*$/i.test(v)) return 'https://' + v.replace(/^\/+/, '');
    const u = v.replace(/^@/, '').replace(/[^\w.\-]/g, ''); return u ? r.base + u : '';
  }
  function redesHtml(c) {
    const rs = (c && c.redes) || {}, items = REDES.map(r => ({ r, u: redUrl(r, rs[r.k]) })).filter(x => x.u);
    if (!items.length) return '';
    return `<div class="redes"><span>Seguinos</span><div class="ri">${items.map(({ r, u }) => `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="${esc(r.n)}" title="${esc(r.n)}"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="${r.d}"/></svg></a>`).join('')}</div></div>`;
  }

  function seccion(s) {
    const id = esc(s.id || slug(s.titulo));
    if (s.tipo === 'hero') return `<section class="hero" id="${id}" style="padding:0"><div class="w"><div><h1>${esc(s.titulo)} <em>${esc(s.destacado)}</em></h1><p>${esc(s.texto)}</p><div class="acc">${btn(s.boton)}${btn(s.boton2, 'sec')}</div></div><img class="logo" src="img/logo-blanco.png" alt="Remises TOQUE!"></div>${extraVideos(s) ? `<div class="w hero-vid">${extraVideos(s)}</div>` : ''}</section>`;
    if (s.tipo === 'tarjetas') return `<section class="${s.fondo === 'gris' ? 'gris' : ''}" id="${id}"><div class="w"><h2>${esc(s.titulo)}</h2>${s.texto ? `<p class="lead">${esc(s.texto)}</p>` : ''}<div class="cards">${(s.items || []).map(i => {
      const u = url(emp(i.url, i.titulo + ' ' + i.cta)); const foto = dataImg(i.imagen); const inner = `${foto ? `<img class="fcard" src="${esc(foto)}" alt="${esc(i.titulo)}" loading="lazy">` : `<span class="ico">${esc(i.emoji)}</span>`}<b>${esc(i.titulo)}</b><span class="d">${esc(i.texto)}</span>${i.cta ? `<span class="mas">${esc(i.cta)}</span>` : ''}`;
      return u ? `<a class="card" href="${esc(u)}">${inner}</a>` : `<div class="card">${inner}</div>`; }).join('')}</div>${extraVideos(s)}</div></section>`;
    if (s.tipo === 'videos') { const vs = (s.videos || []).map(videoHtml).filter(Boolean); if (!vs.length) return '';
      return `<section class="${s.fondo === 'gris' ? 'gris' : ''}" id="${id}"><div class="w"><h2>${esc(s.titulo)}</h2>${s.texto ? `<p class="lead">${esc(s.texto)}</p>` : ''}<div class="videos${vs.length === 1 ? ' uno' : ''}">${vs.join('')}</div></div></section>`; }
    if (s.tipo === 'banner') return `<section id="${id}"><div class="w"><div class="seg"><div class="e">${esc(s.emoji)}</div><div><h2>${esc(s.titulo)}</h2><p>${esc(s.texto)}</p></div>${btn(s.boton)}</div>${extraVideos(s)}</div></section>`;
    // texto + imagen
    const conVideo = s.visual === 'video' && (s.videos || []).length && video(s.videos[0].url);
    const vis = conVideo ? videoHtml(s.videos[0]) : visual(s); const bul = (s.bullets || []).filter(Boolean); const ev = extraVideos(s, conVideo ? 1 : 0);
    const txt = `<div><h2>${esc(s.titulo)}</h2>${s.texto ? `<p class="lead">${esc(s.texto)}</p>` : ''}${bul.length ? `<ul class="lista">${bul.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}${btn(s.boton)}${btn(s.boton2, 'sec') ? ' ' + btn(s.boton2, 'sec') : ''}</div>`;
    return `<section class="${s.fondo === 'gris' ? 'gris' : ''}" id="${id}"><div class="w ${vis ? 'dos' : ''} ${s.lado === 'izq' ? 'inv' : ''}">${txt}${vis}</div>${ev ? `<div class="w">${ev}</div>` : ''}</section>`;
  }

  // Une lo guardado con los valores por defecto (por si faltan campos)
  function normalizar(cfg) {
    const c = cfg && Array.isArray(cfg.secciones) ? cfg : DEFAULT;
    const n = c.nosotros && typeof c.nosotros === 'object' ? c.nosotros : {}, d = DEFAULT.nosotros;
    const nosotros = { titulo: n.titulo || d.titulo, bajada: n.bajada ?? d.bajada, bloques: Array.isArray(n.bloques) && n.bloques.length ? n.bloques : d.bloques, cierre: n.cierre ?? d.cierre };
    const redes = {}; REDES.forEach(r => { const v = c.redes && c.redes[r.k]; if (v) redes[r.k] = String(v).trim(); });
    const tm = c.terminos && typeof c.terminos === 'object' ? c.terminos : {}, dt = DEFAULT.terminos;
    const tyc = (x, d) => { x = x && typeof x === 'object' ? x : {}; const propio = String(x.texto || '').trim(); return { titulo: (propio && x.titulo) || d.titulo, actualizado: (propio && x.actualizado) || d.actualizado, texto: propio ? x.texto : d.texto }; };
    // Si quedó guardada la versión corta anterior (12 secciones), se usa la nueva completa
    const terminos = tyc(String(tm.texto || '').includes('## 12. Contacto') ? {} : tm, dt), terminos_cond = tyc(c.terminos_cond, DEFAULT.terminos_cond);
    return { whatsapp: c.whatsapp || '', whatsapp_texto: c.whatsapp_texto || DEFAULT.whatsapp_texto, telefono: c.telefono || '', pie: c.pie || '', secciones: c.secciones, nosotros, redes, terminos, terminos_cond };
  }
  const soloDigitos = n => String(n || '').replace(/\D/g, '');
  const waLink = (num, texto) => { const d = soloDigitos(num); return d ? `https://wa.me/${d}${texto ? '?text=' + encodeURIComponent(texto) : ''}` : ''; };

  // Texto simple a HTML: "## " títulos (con índice), "- " viñetas, párrafos separados por línea en blanco. Todo se escapa.
  // Enlaces en los textos: [texto](pagina.html) o [texto](https://…)
  const enlaces = h => h.replace(/\[([^\]]+)\]\(((?:https:\/\/|[\w\-]+\.html)[^)\s"<>]*)\)/g, (m, t, u) => `<a href="${u}"${/^https:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`);
  function textoHtml(t) {
    const out = [], toc = []; let ul = null, n = 0;
    const cerrar = () => { if (ul) { out.push('<ul>' + ul.join('') + '</ul>'); ul = null; } };
    String(t || '').split('\n').forEach(l => { const x = l.trim();
      if (!x) return cerrar();
      if (/^##\s+/.test(x)) { cerrar(); const tt = x.replace(/^##\s+/, ''), id = 't' + (++n); toc.push(`<a href="#${id}">${esc(tt)}</a>`); out.push(`<h2 id="${id}">${esc(tt)}</h2>`); return; }
      if (/^[-•]\s+/.test(x)) { (ul = ul || []).push('<li>' + enlaces(esc(x.replace(/^[-•]\s+/, ''))) + '</li>'); return; }
      cerrar(); out.push('<p>' + enlaces(esc(x)) + '</p>'); });
    cerrar(); return { html: out.join(''), toc };
  }
  window.RODAR_LANDING = { textoHtml, iframeVideo, DEFAULT, esc, url, dataImg, slug, seccion, video, REDES, redUrl, redesHtml, normalizar, waLink, soloDigitos,
    clonarDefault: () => JSON.parse(JSON.stringify(DEFAULT)) };
})();
