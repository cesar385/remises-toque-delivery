# App Android del conductor (TOQUE! Conductor)

App Android que abre `https://remisestoque.com/conductor.html` y agrega lo que el navegador no puede hacer:

- **GPS en segundo plano** con el celular bloqueado (servicio con aviso fijo "En servicio").
- **Notificaciones del sistema** de viajes ofrecidos, asignaciones y mensajes de la central.
- Pide quedar **sin restricción de batería** y la tecla Atrás minimiza en lugar de cerrar.

Como la app carga la página publicada, cualquier cambio que subas al sitio ya aparece en la app sin reinstalarla.

## Cómo se compila

No hace falta instalar nada: GitHub lo compila solo (pestaña **Actions → App Android**) cada vez que se sube un cambio a esta carpeta, o a mano con **Run workflow**.
El APK queda para descargar en:

https://github.com/cesar385/rodar-central/releases/latest/download/toque-conductor.apk

## Firma (una sola vez)

Para que cada versión nueva se instale encima de la anterior, todas se firman con la misma clave, guardada como secreto de GitHub (no se sube al repositorio):

1. En GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
2. Nombre: `KEYSTORE_B64`. Valor: todo el contenido del archivo `KEYSTORE_B64.txt`.
3. Guardá también `toque-conductor.keystore` en un lugar seguro (es la misma clave).

Si falta el secreto, la app se compila igual con una firma temporal (para actualizarla habrá que desinstalar la anterior).

## Cambiar la dirección del sitio

Editá `server.url` en `capacitor.config.json` (y los enlaces de `www/`).
