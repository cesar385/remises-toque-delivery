# Remises TOQUE! · Central de despacho

Sistema para centrales de remises y taxis que corre **sin servidor propio**:

- **GitHub Pages** publica la página (gratis).
- **Supabase** guarda los datos, ejecuta la lógica de despacho y avisa los cambios en tiempo real (tiene plan gratis).

Incluye tres aplicaciones:

| Dirección | Para quién |
|---|---|
| `index.html` | Pantalla principal (landing) con accesos a pasajeros, conductores, empresas y operadores |
| `panel.html` | Panel de la central: operadores, administración e informes |
| `conductor.html` | App de conductores (se usa desde el celular) |
| `pasajero.html` | Pedido web de pasajeros con seguimiento del viaje |
| `ingresar.html` | Portal con los tres ingresos (operadores, conductores y pasajeros). Cada perfil tiene su propia pantalla de ingreso |

---

## Puesta en marcha (unos 15 minutos)

### 1. Crear la base de datos en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta gratuita.
2. Tocá **New project**. Elegí un nombre, una contraseña para la base (guardala) y la región **South America (São Paulo)**. Esperá a que termine de crearse.
3. En el menú de la izquierda abrí **SQL Editor** → **New query**.
4. Abrí el archivo `supabase/rodar.sql` de este proyecto, copiá **todo** su contenido, pegalo en el editor y tocá **Run**. Tarda unos segundos: crea las tablas, las funciones y los datos de ejemplo.
5. **Recomendado:** activá el ciclo automático. Andá a **Database → Extensions**, buscá **pg_cron** y activalo. Después volvé al SQL Editor y corré de nuevo todo `supabase/rodar.sql`. Volver a correrlo no borra nada.
   - Con pg_cron, el despacho, el vencimiento de ofertas y los cobros de cuotas funcionan aunque nadie tenga el panel abierto.
   - Sin pg_cron también funciona, pero solo mientras haya un panel o una app de conductor abierta.
6. Andá a **Project Settings → API** y copiá dos datos:
   - **Project URL**, por ejemplo `https://abcd1234.supabase.co`.
   - **anon public key**, una clave larga que empieza con `eyJ…`.

### 2. Publicar la página en GitHub

1. Entrá a [github.com](https://github.com), creá una cuenta si no tenés y tocá **New repository**.
   - Ponele un nombre, por ejemplo `central`, y dejalo **Public**: GitHub Pages es gratis en repositorios públicos.
2. En el repositorio nuevo tocá **Add file → Upload files**. Arrastrá **todo el contenido** de esta carpeta (los archivos y las carpetas `css`, `js`, `vendor`, `supabase`, `sql`, `tools`) y tocá **Commit changes**.
3. Abrí el archivo **`config.js`** en GitHub, tocá el lápiz (editar) y reemplazá los dos datos:
   ```js
   window.RODAR_CONFIG = {
     supabaseUrl: 'https://abcd1234.supabase.co',
     supabaseKey: 'eyJ…tu clave anon…',
   };
   ```
   Tocá **Commit changes**. La clave *anon* se puede publicar: la seguridad está en la base, que solo acepta sesiones válidas y no expone las tablas.
4. Andá a **Settings → Pages**. En *Source* elegí **Deploy from a branch**, rama **main**, carpeta **/ (root)**, y tocá **Save**.
5. En uno o dos minutos aparece la dirección, del tipo `https://TU-USUARIO.github.io/central/`.

### 3. Primer ingreso

Entrá a la dirección con **admin / admin123**.

Los datos de ejemplo son inventados. Usuarios de prueba:

| Usuario | Clave | Rol |
|---|---|---|
| `operador` | `operador123` | Operador |
| `contable` | `contable123` | Gestión / contable |
| `titular1` … `titular4` | `titular123` | Titular de móviles |
| `conductor1` … `conductor14` | `conductor123` | Conductor (en `conductor.html`) |
| `empresa` | `empresa123` | Cliente corporativo (en el pedido web, botón *Empresas*) |

**Antes de operar de verdad:**

1. **Cambiá las claves.** Este repositorio es público y las claves de ejemplo también: cambiá la de `admin` (menú de usuario → *Cambiar contraseña*) y deshabilitá o cambiá los usuarios de ejemplo.
2. **Apagá el simulador** en *Administración → Configuración y demo*.
3. **Cargá tu empresa** en *Administración → Documentación reguladora → Datos de la empresa*: nombre, CUIT, dirección y **latitud/longitud** del centro de tu ciudad.
4. **Configurá la operación:** cargá tus zonas y paradas, tarifas, planes, móviles y usuarios.
5. **Pasale a cada conductor** la dirección de `conductor.html`. En el celular puede usar *Agregar a pantalla de inicio* y queda como una app.

---

## Eliminar móviles y dejar el sistema en cero

- **Eliminar un móvil:** *Administración → Móviles* → botón ⋮ de la fila → **Eliminar**. No se puede si tiene un viaje en curso. Los viajes ya hechos quedan en el historial.
- **Borrar todo:** *Administración → Configuración y demo → Zona de peligro*. Pide escribir `BORRAR TODO` y tu contraseña. Borra viajes, clientes, móviles, usuarios (menos el tuyo), cuentas, chats, soporte, reportes, zonas, paradas y empresas. Conserva datos de la empresa, tarifas, planes, módulos, canales, medios de pago, feriados y tu usuario, y apaga el simulador.
- **Importante:** estas dos funciones son SQL nuevo (`sql/13_borrado.sql`, ya incluido en `supabase/rodar.sql`). Volvé a correr **todo** `supabase/rodar.sql` en el SQL Editor de Supabase; no borra datos.

## Cómo funciona por dentro

- `supabase/rodar.sql` es la instalación completa. Se genera con `python3 tools/build_sql.py` a partir de los archivos de `sql/`.
- Las tablas están en el esquema `rodar`, que **no** se expone por internet. La página solo puede llamar funciones `r_…` que validan la sesión y los permisos de cada usuario. Las contraseñas se guardan con bcrypt.
- Despacho: primero se ofrece el viaje al primer móvil en la cola de la parada de la zona y, si no hay, al libre más cercano. Quedan afuera los móviles penalizados, los que están en los negativos del cliente, los bloqueados por deuda y los que no tienen saldo. Las ofertas tienen tiempo límite y hay modo "a oferta".
- Tiempo real: se usa Supabase Realtime (broadcast). Si no estuviera disponible, el mapa, la app de conductores y el seguimiento del pasajero se actualizan solos cada 5 segundos.
- Direcciones y mapas: OpenStreetMap/Nominatim. Clima para la tarifa dinámica: Open-Meteo.

## Integraciones

- **Cargas de saldo:** en *Medios de pago* cargá tu **link de pago de Mercado Pago** o tu **alias**. El conductor o titular pide la carga, paga, y vos la confirmás en *Cargas de saldo MP*; se acredita sola en *Cuentas*. La verificación automática con la API de Mercado Pago necesita un servidor (por ejemplo una Edge Function de Supabase) y no está incluida, porque el token de Mercado Pago es secreto y no puede ir en la página.
- **WhatsApp, Telegram e Instagram:** el proveedor o bot tiene que enviar los mensajes a
  `POST https://TU-PROYECTO.supabase.co/rest/v1/rpc/webhook_chat`
  con el header `apikey: <clave anon>` y el cuerpo `{"token":"…","telefono":"…","texto":"…","canal":"whatsapp"}`. El token está en *Configuración y demo*.
- **Identificador de llamadas:** `…/rpc/webhook_llamada` con `{"token":"…","linea":1,"telefono":"…"}`.

## Límites del plan gratuito y recomendaciones

- **Pausa por inactividad:** Supabase pausa los proyectos gratuitos que no tienen actividad durante un tiempo. Se reactivan desde su panel. Revisá los límites vigentes del plan gratuito (tamaño de base, conexiones y mensajes de tiempo real) en su web.
- **Copias de seguridad:** hacé copias periódicas desde Supabase (*Database → Backups*, o exportando las tablas).
- **HTTPS:** GitHub Pages ya usa HTTPS, que es necesario para el GPS y el micrófono (radio) en los celulares.

## Problemas comunes

- **"Falta conectar la base de datos":** falta completar `config.js`, o todavía no se publicó el cambio. Esperá un minuto y recargá.
- **"Sin conexión con el servidor":** revisá la URL de `config.js` y que el proyecto de Supabase no esté pausado.
- **Error al correr el SQL:** asegurate de pegar el archivo **completo** y correrlo como está.
- **El mapa no muestra calles:** las calles vienen de OpenStreetMap y necesitan internet.

## Plan con cuota diaria

*Administración → Planes → Nuevo* (o editá el plan **Cuota diaria** que ya viene creado): periodicidad **Diaria**, monto fijo = lo que paga el móvil por día y **hora de cobro**. Cada día se descuenta la cuota de su cuenta. Estados:

| Estado | Cuándo |
|---|---|
| Al día | Saldo mayor o igual al saldo mínimo del plan |
| Debajo del mínimo | Saldo menor al mínimo, pero dentro de la tolerancia: sigue recibiendo viajes |
| Bloqueado por deuda | La deuda superó la tolerancia (horas de tolerancia ÷ 24 = cuotas de gracia): no recibe viajes hasta cargar saldo. Una prórroga lo evita |
| Inhabilitado / fuera de servicio | Móvil deshabilitado |
| Habilitado sin plan | Sin plan o con "Sin abono" |

Asigná el plan a cada móvil desde *Cuentas → cambiar plan*. Los pagos se cargan en *Cuentas* o por *Cargas de saldo MP*. Requiere correr de nuevo `supabase/rodar.sql` (incluye `sql/14_plan_diario.sql`).

## WhatsApp en el panel (recibir y responder)

Admin y operadores atienden WhatsApp desde **Operador → Chat & Telefonía**: los mensajes de los clientes llegan a la bandeja y las respuestas salen por WhatsApp. Usa la **API oficial de WhatsApp Business (Cloud API de Meta)**. El token de Meta es secreto, por eso el envío pasa por una función de Supabase (`supabase/functions/whatsapp`) y no por la página.

**Lo que necesitás:** una cuenta de Meta for Developers con una app de WhatsApp, un número de teléfono dado de alta en WhatsApp Business (no puede estar usándose en la app común de WhatsApp) y las credenciales de la API.

1. En [developers.facebook.com](https://developers.facebook.com) creá una app → agregá el producto **WhatsApp**. Anotá el **Phone number ID** y generá un **token permanente** (usuario del sistema con permiso `whatsapp_business_messaging`).
2. Instalá la CLI de Supabase y, desde esta carpeta, vinculá tu proyecto: `supabase login` y `supabase link --project-ref TU-REF`.
3. Cargá los secretos (el token de integración está en *Administración → Configuración y demo → Integraciones*):
   ```
   supabase secrets set WA_ACCESS_TOKEN=... WA_PHONE_ID=... WA_VERIFY_TOKEN=elegí-una-clave RODAR_WEBHOOK_TOKEN=...
   ```
   Opcional: `WA_APP_SECRET` (secreto de la app de Meta, valida que los mensajes vengan de Meta) y `WA_PAIS` (por defecto `549`, Argentina).
4. Publicá la función **sin verificación JWT** (Meta no manda ese encabezado): `supabase functions deploy whatsapp --no-verify-jwt`.
5. En Meta → WhatsApp → Configuración → Webhook: URL `https://TU-PROYECTO.supabase.co/functions/v1/whatsapp`, token de verificación = tu `WA_VERIFY_TOKEN`, y suscribite al campo **messages**.
6. Escribile al número desde otro celular: el mensaje aparece en el chat del panel. Respondé desde el panel.

**Cosas a saber:**
- WhatsApp solo permite texto libre dentro de las **24 horas posteriores al último mensaje del cliente**. Fuera de esa ventana el envío falla y el panel marca el mensaje como "⚠ no enviado" con el motivo. Para escribir primero hacen falta plantillas aprobadas por Meta (no incluidas).
- Si la función no está instalada, el mensaje queda guardado en el panel marcado como no enviado; no se pierde ni se muestra como enviado.
- Los teléfonos de Argentina se guardan sin el `549` (3454123456) para coincidir con la ficha del cliente.
- Meta cobra por conversación según su tarifa vigente; revisá su lista de precios.

## Página principal editable

*Administración → Página principal* (solo admin): agregar, editar, duplicar, reordenar, **ocultar** y eliminar secciones de la página de inicio (portada, texto con imagen/foto, tarjetas, banner), elegir cuáles aparecen en el menú de arriba y cambiar el **número de WhatsApp** del botón verde de la página. "Ver página" abre el resultado; "Restaurar original" vuelve al contenido de fábrica. Los enlaces aceptan páginas del sitio (`pasajero.html`), anclas (`#ayuda`) y `https://…`.

El cambio del número en esta pantalla modifica lo que ven los clientes. La línea con la que el panel envía y recibe (paso anterior) se cambia con las credenciales de Meta.

## Distancia de los viajes

Al finalizar un viaje, el servidor compara los metros que midió la app con el recorrido que registró el GPS en el servidor y con la distancia en línea recta (×1,15) al destino, y cobra según la **mayor**. Evita que un viaje quede en la tarifa mínima cuando el celular tuvo la pantalla apagada o la app en segundo plano.

## Pagar base (Mercado Pago y cobro automático)
- En la app del conductor y en el panel, el botón se llama **Pagar base**. Muestra el saldo, el estado, la deuda y un monto sugerido, y abre Mercado Pago.
- **Cobro automático de la base:** creá un plan con periodicidad *Diaria* (Finanzas → Tipos de abonos). Cada día se descuenta la cuota de la cuenta del móvil sin que nadie haga nada; si la cuenta queda por debajo del límite del plan, el móvil se bloquea hasta pagar.
- **Billeteras (Mercado Pago, Ualá, Naranja X, Personal Pay u otra):** en *Administración → Medios de pago → Billeteras para cargas de saldo* elegís cuáles ofrece la app del conductor y cargás el alias/CVU de la central para cada una. Si hay más de una habilitada, el conductor elige con cuál paga.

  | Billetera | Cómo se cobra | Se acredita |
  |---|---|---|
  | Mercado Pago ⚡ | Checkout de Mercado Pago (API) | Sola |
  | Ualá ⚡ | Ualá Bis API v2 | Sola |
  | Naranja X, Personal Pay, otra billetera | Transferencia al alias/CVU de la central (sirve cualquier billetera o app bancaria: las transferencias son interoperables) | La central la confirma en *Finanzas → Pagos de base* |

  Naranja X y Personal Pay no publican (a octubre de 2026) una API abierta para comercios; si te dan credenciales, se suman con un adaptador nuevo en `supabase/functions/_shared/adaptadores.ts` (ver más abajo).
- **Instalar el cobro automático (Mercado Pago y Ualá):**
  1. Correr de nuevo `supabase/rodar.sql` (incluye `sql/31_pagos_proveedores.sql`; no borra datos).
  2. `supabase functions deploy pagos --no-verify-jwt`
  3. Secretos comunes: `supabase secrets set RODAR_WEBHOOK_TOKEN=<el de Configuración y demo> SITE_URL=https://TU-USUARIO.github.io/central/`
  4. Mercado Pago: `supabase secrets set MP_ACCESS_TOKEN=<access token de producción>`
  5. Ualá: `supabase secrets set UALA_USER=... UALA_CLIENT_ID=... UALA_CLIENT_SECRET=...` (credenciales de Ualá Bis → API). Para probar en su entorno de pruebas agregá `UALA_ENV=stage` y `UALA_AUTH_URL=<dirección de auth de pruebas que figura en su documentación>`.
  6. Opcional: si tenés pagos de Mercado Pago creados antes de este cambio y todavía pendientes, desplegá también `supabase functions deploy mercadopago --no-verify-jwt` (reenvía los avisos viejos a la lógica nueva).

  El proveedor avisa a la función cuando se aprueba el pago; la función **vuelve a consultarlo al proveedor con tus credenciales** y recién ahí lo acredita, una sola vez y solo si el monto coincide. Sin la función instalada, o sin credenciales de ese proveedor, la billetera funciona como transferencia con confirmación manual.
- **Sumar otro proveedor con API:** en `supabase/functions/_shared/adaptadores.ts` escribí un adaptador (`crear` y `verificar`), registralo en `crearAdaptadores()`, agregalo al catálogo de `sql/31_pagos_proveedores.sql` (`rodar.pagos_catalogo()`, con `"api": true`) y corré `deno test supabase/functions/_shared/`.
- **Ualá:** monto mínimo $25; solo se acredita cuando la orden figura como *APPROVED* (en *PROCESSED* el desembolso está pendiente y se espera). Ualá no firma sus avisos: por eso se verifica la orden con tus credenciales antes de acreditar. La API v1 de Ualá Bis se depreca el 31/12/2026; esta integración usa la v2.
- La lógica de acreditación (SQL) y los adaptadores están probados con pruebas automáticas, pero **no contra Mercado Pago ni Ualá reales**: probá cada billetera primero con un monto chico (en Ualá, mínimo $25).

## Radio y segundo plano
- Cuando habla un móvil, la central ve **"Móvil N · nombre"**; cuando habla la central, el conductor ve **"Central · operador"**.
- La app del conductor pide mantener la pantalla encendida, reproduce un audio silencioso, usa notificaciones y avisa si el navegador la suspende. **Una página web no puede forzarse a correr en segundo plano**: en Android funciona mejor instalándola en la pantalla de inicio y desactivando el ahorro de batería para el navegador; en iPhone es limitado. Para garantía total hace falta una app nativa.

## Novedades (octubre 2026)

- **Eliminar viajes (solo administrador):** en *Viajes* → menú ⋮ de la fila → **Eliminar viaje**. No se puede si el viaje está ofrecido, confirmado o en curso (primero anulalo o finalizalo). Los movimientos de cuenta del móvil no se modifican.
- **App del conductor:** al finalizar un viaje (sobre todo el de calle) aparece una pantalla grande con el total que debe abonar el pasajero; queda hasta tocar *Ya cobré*. El recorrido se dibuja en el mapa: ruta al pasajero, tramo recorrido y ruta al destino.
- **Radio en segundo plano:** un solo audio silencioso mantiene la app activa y la radio suena con un reproductor ya desbloqueado.
- **Pasajero con cuenta:** *Mis viajes* muestra el móvil, patente, color y conductor mientras el viaje está en curso, y avisa cuando se asigna el móvil.
- Estos cambios incluyen SQL nuevo (`sql/20_mejoras_viajes.sql`, ya incluido en `supabase/rodar.sql`). Volvé a correr **todo** `supabase/rodar.sql` en el SQL Editor de Supabase; no borra datos.

### Segunda tanda

- **Billetera virtual del conductor:** menú de la app del conductor → *Mi billetera virtual* (Mercado Pago, Ualá, Naranja X, Brubank, Personal Pay u otra, con alias o CVU).
- **Borrar todo el sistema:** ahora conserva las zonas y paradas. Para borrarlas hay que tildar *Borrar también las zonas y paradas* al confirmar.
- **Ingreso:** las pantallas de conductor y de pasajero ya no ofrecen *Soy operador*. Las empresas tienen su propia pantalla (`pasajero.html#/empresas`), con tarjeta aparte en `ingresar.html` y en el menú de la portada.
- **Cerrar sesión:** botón *Salir* siempre visible en la barra superior de la app del pasajero y de la del conductor.
- **¿A dónde vas?** es obligatorio al pedir (también se controla en el servidor). Se quitó el aviso de la altura bajo *¿Dónde te buscamos?* y los emojis decorativos de las apps de pasajero y conductor.
- SQL nuevo, en este orden: `sql/20_mejoras_viajes.sql`, `sql/21_billetera_reinicio.sql`, `sql/22_destino_obligatorio.sql` (todos incluidos en `supabase/rodar.sql`; se pueden volver a correr sin problema).

### Tercera tanda

- **Ticket:** un solo diseño, con logo, para el panel (*Descargar ticket PDF*), la app del conductor y el comprobante del pasajero. Se arma en `ticketHtml()` de `js/backend.js`.
- **Distancias:** se muestran redondeadas a un decimal en toda la app (1.47 km pasa a 1.5 km) mediante `km1()`. El precio no cambia: se sigue calculando con los metros reales.
- No hay SQL nuevo en esta tanda.

## Conductor: datos propios y modo activo
- **Mi perfil** (app del conductor): el conductor edita su nombre, apellido, teléfono, email y datos de recupero. El DNI y los datos del auto los cambia la central; el alias y la billetera se cargan en *Mi billetera virtual*. Requiere `sql/23_perfil_conductor.sql` (ya incluido en `supabase/rodar.sql`).
- El **audio de radio** y el **modo activo (segundo plano)** ya no están en el menú: quedan siempre encendidos.

## Rubros (no solo comida) y vehículo del reparto (moto / auto)

Aplicar `sql/33_rubros_vehiculo.sql` (ya incluido en `supabase/rodar.sql`; se puede correr más de una vez).

- **Rubros:** en *Delivery → Categorías* cada rubro tiene un **tipo**: *Comida* (se prepara) o *Productos* (farmacia, kiosco, ferretería, mercado… se arma). El tipo cambia los textos: "Armando" en vez de "Preparando" (comercio, avisos y seguimiento del cliente). La demo suma una ferretería.
- **Vehículo:** el negocio decide si el reparto es en **moto, auto o cualquiera**. Prioridad: lo que elige para ese pedido > el defecto del negocio (*Mi negocio* / ajustes en el panel) > el del rubro > cualquiera. Se cambia mientras el pedido no tenga repartidor asignado ni oferta en curso.
- **Despacho:** cada móvil tiene *Tipo de vehículo* (auto por defecto; se carga en *Móviles → Modificar*). Si el viaje pide moto o auto, solo se le ofrece a móviles de ese tipo (`rodar.elegible`). **Ojo:** los móviles existentes quedan como *auto*; marcá como *moto* los que correspondan.

## Portal de repartidores (`repartidor.html`)

Aplicar `sql/34_repartidores.sql` (ya incluido en `supabase/rodar.sql`; se puede correr más de una vez).

- **Registro:** el repartidor se anota solo en `repartidor.html` → *Quiero repartir*: moto o auto, DNI, teléfono, patente, alias/CBU y fotos de documentos. Queda **por aprobar**; la central recibe un aviso.
- **Aprobación:** *Delivery → Repartidores* (panel): ver datos y documentos, **aprobar / rechazar / suspender / reactivar** (rechazar y suspender piden motivo, que el repartidor ve). Al aprobar se habilita su móvil; al suspender se desconecta.
- **Por dentro** cada repartidor es un usuario `conductor` con un móvil propio (con su tipo moto/auto), así entra al despacho de siempre: los pedidos en vivo se reciben en `conductor.html` con el mismo DNI y contraseña.
- **En el portal:** ganancias (hoy, semana, mes, total), pedidos en curso con cuánto cobrar, historial de entregas, cambio de vehículo/patente/documentos, alias y contraseña. Ganancia por entrega = envío + propina − comisión del repartidor.
- Un móvil nuevo necesita saldo/plan para recibir pedidos (como cualquier móvil): si no lo tiene, el portal lo avisa.
