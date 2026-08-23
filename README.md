# TiltSip — sensores y diagnóstico 0.2.0

TiltSip es una experiencia web móvil original que simula un vaso con líquido. La fase 1 visual continúa completa y la fase 2 añade acceso opcional al sensor de orientación, diagnóstico de `beta` y `gamma`, y manejo seguro de permisos.

Los datos del sensor todavía no cambian el nivel ni la inclinación del líquido. En esta versión son exclusivamente diagnósticos.

## Archivos del proyecto

```text
tilt-sip/
├── index.html
├── styles.css
├── app.js
└── README.md
```

El proyecto usa exclusivamente HTML, CSS y JavaScript puro. No necesita React, npm, backend, base de datos ni dependencias externas.

## Cómo abrirlo

### Modo manual en computador

Puede abrir `index.html` directamente. Para una prueba más parecida a GitHub Pages, abra una terminal dentro de la carpeta `tilt-sip` y ejecute:

```bash
python -m http.server 8000
```

En Windows, si `python` no funciona, pruebe:

```bash
py -m http.server 8000
```

Después visite `http://localhost:8000`.

La selección Beer/Cola, el nivel, las inclinaciones manuales y Refill deben funcionar aunque el computador no tenga sensores compatibles.

### Sensores en un teléfono

Para probar sensores en un dispositivo físico, publique el proyecto mediante GitHub Pages y abra su dirección `https://...` directamente en Safari o Chrome. Los sensores modernos están restringidos a contextos seguros; abrir el archivo directamente o usar una dirección HTTP de la red local puede dejar la API sin datos.

## Qué conserva de la fase 1

- Selección entre Beer y Cola.
- Vaso responsive con líquido, espuma y burbujas configurables.
- Recorte estricto del líquido y la espuma dentro del vaso.
- Botones Drinks y Refill.
- Controles manuales para nivel, inclinación lateral e inclinación hacia la boca.
- Reinicio del nivel y de las inclinaciones al cambiar de bebida.
- Objeto central `DRINKS` con colores, espuma y cantidad de burbujas.
- `100dvh`, áreas seguras de iPhone y bloqueo del desplazamiento de la página.

## Qué añade la fase 2

- Botón visible **Enable Motion** después de escoger una bebida.
- Solicitud de permiso ejecutada directamente desde el click del botón.
- Detección por funcionalidad de `DeviceOrientationEvent` y `requestPermission`.
- Registro del listener solamente después de obtener `granted`, cuando el navegador exige permiso.
- Registro directo del listener cuando `requestPermission` no existe.
- Rechazo silencioso de eventos cuyo `beta` o `gamma` sea `null`, `NaN` o no numérico.
- Espera de cinco segundos para detectar ausencia de datos y recomendar el modo manual.
- Panel con protocolo, disponibilidad de API, permiso, beta, gamma, último evento, contador y versión.
- Botón **Copy diagnostics**.
- Versión `0.2.0`.

## Flujo del permiso

El permiso nunca se solicita al cargar la página ni al escoger una bebida. Solo se intenta después de pulsar **Enable Motion**:

1. Si `DeviceOrientationEvent` no existe, se informa que el sensor no está disponible y el modo manual sigue funcionando.
2. Si existe `DeviceOrientationEvent.requestPermission`, se solicita el permiso y solo se registra el listener cuando el resultado es `granted`.
3. Si `requestPermission` no existe, el listener se registra directamente y el panel muestra `not-required`.
4. Si el usuario niega el permiso o ocurre un error, no se registra el listener y la aplicación conserva todos los controles manuales.
5. Si no llega un evento válido durante cinco segundos, aparece un mensaje útil sin bloquear la aplicación.

## Panel de diagnóstico

Seleccione una bebida y pulse **Controls & diagnostics**. También puede abrir la página con `?debug=1` para mostrar el panel automáticamente:

```text
http://localhost:8000/?debug=1
```

El panel muestra:

- **Protocol:** `HTTPS` o `Not HTTPS`.
- **API:** `available` o `unavailable`.
- **Permission:** `not-requested`, `granted`, `denied`, `not-required` o `error`.
- **Beta:** inclinación frontal/trasera reportada por el navegador.
- **Gamma:** inclinación lateral reportada por el navegador.
- **Last event:** hora del último evento válido.
- **Events received:** cantidad de eventos válidos procesados.
- **Version:** `0.2.0`.

## Prueba manual: iPhone con Safari

1. Publique TiltSip en GitHub Pages y confirme que la dirección comience por `https://`.
2. Abra esa dirección directamente en Safari, no dentro de la vista interna de otra aplicación.
3. Seleccione Beer o Cola.
4. Pulse **Enable Motion** una sola vez.
5. Cuando Safari solicite acceso a movimiento y orientación, pulse **Allow**.
6. Confirme en el panel:
   - `Protocol: HTTPS`;
   - `API: available`;
   - `Permission: granted`;
   - beta y gamma cambian al inclinar el iPhone;
   - el contador aumenta y aparece la hora del último evento.
7. Pulse **Copy diagnostics** y pegue el resultado en Notas para comprobar la copia.
8. Mueva los tres controles manuales y confirme que siguen funcionando independientemente del sensor.
9. Repita la prueba negando el permiso: debe aparecer el mensaje de modo manual y el vaso debe continuar funcionando.

## Prueba manual: Android con Chrome

1. Publique TiltSip en GitHub Pages y abra la dirección `https://` directamente en Chrome.
2. Seleccione Beer o Cola.
3. Pulse **Enable Motion**.
4. Si Chrome muestra una solicitud de permiso, pulse **Allow**. En versiones que no requieren ese método, el panel mostrará `not-required` y registrará el listener directamente.
5. Incline el teléfono hacia delante, atrás, izquierda y derecha.
6. Confirme que beta, gamma, la hora y el contador cambian.
7. Espere cinco segundos sin recibir datos en un dispositivo sin sensor o con acceso bloqueado: debe aparecer la recomendación de seguir con controles manuales.
8. Pulse **Copy diagnostics** y compruebe el texto copiado.
9. Confirme que Fill level, Side tilt, Tilt to mouth y Refill siguen funcionando.

## Privacidad y alcance

TiltSip 0.2.0 usa únicamente eventos relativos de orientación. No solicita orientación absoluta ni acceso al magnetómetro. Tampoco usa geolocalización, cámara, micrófono ni recopila o envía datos.

Las rutas `./styles.css` y `./app.js` continúan siendo relativas para funcionar bajo `/tilt-sip/` en GitHub Pages.

## Fuera del alcance de la fase 2

El sensor no modifica el vaso, no consume líquido y no activa sonidos. La conexión entre orientación y simulación de bebida pertenece a una fase posterior.
