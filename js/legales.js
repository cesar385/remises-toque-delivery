// Documentos legales que se arman con los datos reales de la empresa (Administración → Datos de la empresa)
// y con la configuración vigente (cancelaciones, cargos de la plataforma). Se muestran en terminos.html.
// Formato: "## Título", "- viñeta", párrafos y enlaces [texto](pagina.html).
(function () {
  const ACTUALIZADO = '2026-10-25';
  const pct = n => String(Math.round(+n * 100) / 100).replace('.', ',') + ' %';
  const minTxt = m => { m = +m || 0; if (m >= 60) { const h = Math.floor(m / 60), r = m % 60; return h + (h === 1 ? ' hora' : ' horas') + (r ? ' ' + r + ' min' : ''); } return m + ' minutos'; };

  // Quién es el responsable (con lo que esté cargado; nada inventado)
  const responsable = e => [
    `- Responsable: ${e.razon_social || e.nombre || 'Remises TOQUE!'}${e.nombre && e.razon_social && e.nombre !== e.razon_social ? ` ("${e.nombre}")` : ''}.`,
    e.cuit ? `- CUIT: ${e.cuit}.` : '',
    e.direccion || e.localidad ? `- Domicilio: ${[e.direccion, e.localidad, e.provincia].filter(Boolean).join(', ')}, Argentina.` : '',
    e.email ? `- Email: ${e.email}.` : '',
    e.telefono ? `- Teléfono: ${e.telefono}.` : '',
  ].filter(Boolean).join('\n');

  const privacidad = e => `## 1. Quién es responsable de tus datos
${responsable(e)}
- Esta política explica qué datos personales usamos cuando pedís un remís, manejás un móvil, usás la app de empresas o nos escribís, y qué podés hacer con ellos. Se aplica la Ley 25.326 de Protección de Datos Personales.

## 2. Qué datos usamos
- Pasajeros: nombre, celular, email, contraseña (guardada cifrada, nadie puede leerla), direcciones de origen y destino, lugares guardados, historial de viajes, calificaciones, forma de pago elegida y los mensajes que nos mandás al Centro de ayuda, por WhatsApp o por Telegram.
- Ubicación del pasajero: solo si la permitís, para sugerir la dirección de origen. Podés escribir la dirección a mano.
- Conductores: nombre, DNI, teléfono, licencia, documentación del vehículo, ubicación del móvil mientras está en servicio, viajes realizados, cobros y saldo de la cuenta. Si vinculás Mercado Pago, guardamos solo la autorización para cobrar en tu cuenta (cifrada), nunca tu contraseña.
- Empresas con cuenta corriente: razón social, CUIT, personas de contacto, pasajeros autorizados y centros de costo.
- Datos técnicos: tipo de celular o navegador para enviarte notificaciones, y registros de seguridad (inicios de sesión, intentos fallidos).
- No pedimos DNI ni fecha de nacimiento a los pasajeros. No guardamos datos de tarjetas: los pagos con Mercado Pago se hacen en su plataforma.

## 3. Para qué los usamos
- Prestar el servicio: recibir el pedido, asignar el móvil, mostrar el recorrido, calcular el precio, cobrar y entregar el comprobante.
- Seguridad de pasajeros y conductores: PIN de viaje, seguimiento del móvil y botón de emergencia.
- Atender consultas, reclamos y objetos olvidados.
- Cumplir obligaciones legales, contables e impositivas.
- No usamos tus datos para publicidad de terceros, no los vendemos y no armamos perfiles para venderte otros productos.

## 4. Base legal
- Tu consentimiento, que das al crear la cuenta o al enviar un formulario, y que podés retirar cuando quieras.
- La prestación del servicio que nos pedís.
- Las obligaciones que nos imponen las leyes.

## 5. Con quién los compartimos
- Con el conductor asignado: tu nombre, tu celular y las direcciones del viaje, solo para realizarlo.
- Con el pasajero: el nombre del conductor, el número de móvil, el vehículo, la patente y su ubicación durante el viaje.
- Con la empresa que paga el viaje, si viajás a cuenta corriente: fecha, recorrido, importe y centro de costo.
- Con proveedores que usamos para funcionar, y solo en lo necesario:
- Supabase (base de datos y servidores) y Netlify (alojamiento de la página).
- Mercado Pago (cobros), si elegís pagar por ese medio.
- Google Maps Platform, OpenStreetMap / Nominatim y Georef de datos.gob.ar (búsqueda de direcciones); OpenFreeMap (mapas); OpenRouteService y OSRM (recorridos por calles); Open-Meteo (clima de la ciudad, sin datos tuyos).
- Cloudflare Turnstile (verificación anti-robots al crear la cuenta).
- WhatsApp (Meta) y Telegram, solo si nos escribís por esos medios.
- Algunos de estos proveedores tienen servidores fuera de Argentina. Solo les damos lo necesario para cada tarea.
- Con autoridades, cuando una ley o una orden judicial lo exige.

## 6. Cuánto tiempo los guardamos
- Mientras tengas la cuenta.
- Si eliminás la cuenta, borramos tus lugares guardados, tu sesión, tus notificaciones y tus datos de contacto, y los viajes quedan sin tu nombre ni tu teléfono.
- Los registros de viajes y cobros se conservan, sin datos que te identifiquen, por el plazo que exigen las normas contables e impositivas.

## 7. Seguridad
- La conexión con la app y la página va cifrada (HTTPS).
- Las contraseñas se guardan cifradas y cada persona solo ve lo que su función necesita.
- Los datos sensibles de integraciones (por ejemplo, Mercado Pago) se guardan cifrados.

## 8. Tus derechos
- Podés pedir el acceso, la rectificación, la actualización o la supresión de tus datos, y retirar tu consentimiento.
- Desde la app: Mi perfil → Mis datos para corregirlos, y Mi perfil → Eliminar mi cuenta para borrarla.
- Sin necesidad de cuenta: [Solicitudes, bajas y arrepentimiento](baja.html). Te damos un código de seguimiento al enviarla.
- Respondemos los pedidos de acceso dentro de los 10 días corridos y los de rectificación o supresión dentro de los 5 días hábiles.
- El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley 25.326.
- La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales. [www.argentina.gob.ar/aaip](https://www.argentina.gob.ar/aaip)

## 9. Menores de edad
- Para crear una cuenta hay que ser mayor de 18 años. No juntamos a sabiendas datos de menores.
- Un menor puede viajar si un adulto responsable pide el viaje desde su cuenta, por teléfono o por WhatsApp.
- Si sos madre, padre o tutor y creés que un menor nos dio sus datos, pedí que los borremos desde [esta página](baja.html).

## 10. Notificaciones y mensajes
- Solo te enviamos avisos del servicio (móvil en camino, llegada, fin del viaje) y respuestas a tus consultas. No enviamos publicidad.
- Podés desactivar las notificaciones desde Mi perfil o desde la configuración del celular.

## 11. Cookies y almacenamiento
El detalle está en la [Política de cookies](terminos.html?para=cookies).

## 12. Cambios
Si cambiamos esta política, publicamos la nueva versión en esta página con su fecha. Si el cambio es importante, te avisamos en la app.`;

  const cookies = e => `## 1. Qué usamos
- La página y las apps guardan algunos datos en tu propio navegador o celular (almacenamiento local) para funcionar: tu sesión iniciada, tus preferencias, los últimos lugares que usaste, el viaje en curso y tu elección sobre este aviso.
- No usamos cookies de publicidad ni de seguimiento, ni herramientas de estadísticas de terceros.

## 2. Almacenamiento necesario
- Sesión: para que no tengas que ingresar cada vez.
- Viaje en curso y comprobante pendiente: para no perder el seguimiento si cerrás la app.
- Preferencias: nombre y celular del último pedido, forma de pago y lugares recientes.
- Copia de la página en el celular (service worker): para que la app cargue más rápido.
- Estos datos no se comparten con nadie y se borran al cerrar sesión o al borrar los datos del navegador.

## 3. Servicios de terceros
- Verificación anti-robots (Cloudflare Turnstile): se carga al crear una cuenta. Puede usar cookies de seguridad propias.
- Búsqueda de direcciones (Google Maps): se carga al buscar una dirección. Google puede usar cookies propias según su política.
- Videos de la página principal (YouTube, Vimeo, Google Drive o Facebook): solo se cargan si aceptás el contenido de terceros o tocás el video.
- Mercado Pago: al pagar se abre su sitio, que tiene su propia política de cookies.

## 4. Cómo elegir
- La primera vez que entrás te preguntamos si aceptás el contenido de terceros. "Solo necesarias" y "Aceptar todas" tienen el mismo lugar y tamaño: elegí la que prefieras.
- Podés cambiar tu elección cuando quieras desde "Preferencias de cookies", al pie de la página.
- También podés borrar los datos guardados desde la configuración de tu navegador.

## 5. Contacto
${responsable(e)}`;

  const reembolsos = (e, r, d) => {
    const c = r || {};
    const ult = [c.ultimo_modo !== 'penalizacion' && +c.pct_ultimo > 0 ? `se cobra el ${c.pct_ultimo} % del precio estimado` : '', c.ultimo_modo !== 'cargo' && +c.dias_penalizacion > 0 ? `no vas a poder hacer reservas durante ${c.dias_penalizacion} ${+c.dias_penalizacion === 1 ? 'día' : 'días'}` : ''].filter(Boolean).join(' y ') || 'no tiene cargo';
    const cp = d.cargo && d.cargo.activo ? d.cargo : null;
    return `## 1. Viajes para ahora
- Mientras no haya un móvil asignado, cancelás sin cargo desde la pantalla de seguimiento.
${+c.pct_asignado > 0 ? `- Si un móvil ya aceptó tu viaje y va a buscarte, cancelar tiene un cargo del ${c.pct_asignado} % del precio estimado. Antes de confirmar la cancelación la app te muestra el importe exacto.` : '- Cancelar no tiene cargo.'}
- Si el móvil llega y no te presentás dentro del tiempo de espera, puede aplicarse ese mismo cargo.

## 2. Reservas
- Hasta ${minTxt(c.sin_cargo_min)} antes del horario: sin cargo.
${+c.sin_cargo_min > +c.tardio_min ? `- Entre ${minTxt(c.sin_cargo_min)} y ${minTxt(c.tardio_min)} antes: ${+c.pct_tardio > 0 ? `se cobra el ${c.pct_tardio} % del precio estimado` : 'sin cargo'}.` : ''}
- Con menos de ${minTxt(c.tardio_min)} o si no te presentás: ${ult}.
- La app te muestra estas condiciones antes de reservar y el importe exacto antes de cancelar.

## 3. Cómo se cobran los cargos de cancelación
- No se debitan de ninguna tarjeta: se suman al total de tu próximo viaje y figuran por separado en el comprobante.
- Si creés que un cargo no corresponde, reclamalo desde el Centro de ayuda y lo revisamos con el registro del viaje.

## 4. Cargos de la plataforma
${cp ? `- A cada viaje se suma un cargo de la plataforma de aproximadamente el ${pct(cp.pct / (100 - cp.pct) * 100)} del valor del viaje. Es igual para cualquier medio de pago y no se aplica a los viajes a cuenta corriente de empresas.
- Lo ves incluido en el precio estimado antes de pedir y por separado en el comprobante.` : '- Hoy no se cobra cargo de la plataforma. Si se activa, se muestra en el precio estimado antes de pedir y por separado en el comprobante.'}
- No hay otros cargos: lo que pagás es lo que figura en el comprobante.

## 5. Reembolsos
- Si te cobramos de más, por un error del importe o por un cobro repetido, te devolvemos la diferencia por el mismo medio de pago. Si pagaste en efectivo, te la devolvemos en la central o por transferencia.
- Los pagos con Mercado Pago se devuelven desde Mercado Pago a la misma cuenta o tarjeta; el plazo para verlo depende de tu banco o de Mercado Pago.
- Para pedirlo, escribinos desde el Centro de ayuda dentro de los 30 días del viaje, indicando el número de viaje o la fecha y la hora.
- Te respondemos con el resultado de la revisión y, si corresponde, hacemos la devolución dentro de los 10 días hábiles.

## 6. Derecho de arrepentimiento
- Podés revocar la contratación de un servicio que todavía no se prestó (por ejemplo, una reserva) dentro de los 10 días corridos de contratado, sin costo, avisando al menos 24 horas antes del horario reservado. Usá el [Botón de arrepentimiento](baja.html?tipo=arrepentimiento): no hace falta tener cuenta y te damos un código de identificación.
- Un viaje ya realizado no se puede revocar, porque el servicio ya se prestó.

## 7. Contacto
${responsable(e)}
- Como consumidor tenés los derechos de la Ley 24.240. También podés hacer tu reclamo en la Ventanilla Única Federal: [Defensa de las y los Consumidores. Para reclamos ingrese aquí](https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario).`;
  };

  const DOCS = {
    privacidad: { titulo: 'Política de privacidad', armar: (e) => privacidad(e) },
    cookies: { titulo: 'Política de cookies', armar: (e) => cookies(e) },
    reembolsos: { titulo: 'Cancelaciones y reembolsos', armar: (e, r, d) => reembolsos(e, r, d) },
  };
  // datos: { empresa: respuesta de /api/pub/config, reservas: /api/pub/reservas }
  const doc = (tipo, datos = {}) => {
    const D = DOCS[tipo]; if (!D) return null;
    const e = datos.empresa || {};
    return { titulo: D.titulo, actualizado: ACTUALIZADO, texto: D.armar(e, datos.reservas, e) };
  };
  window.RODAR_LEGALES = { doc, TIPOS: Object.keys(DOCS) };
})();
