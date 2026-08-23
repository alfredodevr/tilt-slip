# TiltSip 0.3.0 — bebida por inclinación

TiltSip es una experiencia web móvil original que simula un vaso con líquido. Conserva la interfaz visual y el diagnóstico de sensores de las fases anteriores, y ahora conecta `DeviceOrientationEvent` con la simulación después de una calibración explícita.

La aplicación está pensada principalmente para un teléfono en orientación vertical. El modo manual continúa disponible en computador y también funciona como alternativa cuando el sensor no existe, el permiso se niega o no llegan datos.

## Archivos

```text
tilt-sip/
├── index.html
├── styles.css
├── app.js
└── README.md
```

Solo usa HTML, CSS y JavaScript puro. No necesita React, npm, backend, base de datos ni dependencias externas. Las rutas `./styles.css` y `./app.js` son relativas y funcionan bajo `/tilt-sip/` en GitHub Pages.

## Cómo abrirlo en un computador

Puede abrir `index.html` directamente. Para probarlo con un servidor local, abra una terminal en la carpeta `tilt-sip` y ejecute:

```bash
python3 -m http.server 8000
```

En Windows también puede usar:

```bash
py -m http.server 8000
```

Después visite `http://localhost:8000`. En computador, use **Controls & diagnostics** para cambiar Fill level, Side tilt y Tilt to mouth. Los sensores pueden no estar disponibles sobre HTTP, pero el modo manual no depende de ellos.

## Qué implementa la versión 0.3.0

- Mantiene Beer y Cola, con colores, espuma y burbujas definidos en el objeto central `DRINKS`.
- Mantiene el líquido y la espuma recortados dentro del vaso.
- Solicita el permiso de orientación solamente al pulsar **Enable Motion**.
- Conserva la detección por funcionalidad y el aviso de cinco segundos cuando no llegan eventos válidos.
- Muestra “Hold your phone upright and tap Calibrate” antes de calibrar.
- Recoge lecturas válidas durante unos 550 ms y calcula las referencias de beta y gamma mediante un promedio angular.
- Normaliza las diferencias angulares y limita valores extremos.
- Usa beta respecto a la referencia para detectar la inclinación hacia la boca.
- Usa gamma respecto a la referencia para inclinar la superficie sin consumir líquido.
- Suaviza el movimiento visual y procesa la simulación con `requestAnimationFrame`.
- Calcula el vaciado con `deltaTime`, independientemente de la frecuencia de la pantalla.
- Empieza a beber al superar 18°; una inclinación leve consume despacio y una profunda consume hasta 0.20 del vaso por segundo.
- Un vaso al 100 % tarda aproximadamente 5 segundos en vaciarse con una inclinación profunda sostenida.
- Limita siempre el nivel interno al intervalo de `0` a `1`.
- Detiene el estado de consumo al enderezar el teléfono y muestra **Empty — tap Refill** al llegar a cero.
- Anima **Refill** hasta el 100 % y vuelve a mostrar Calibrate cuando aún no existe una calibración válida.
- Permite activar **Invert drinking direction** si el signo de beta es contrario en un dispositivo.
- Mantiene todos los controles manuales; mover cualquiera de ellos pasa la simulación a modo manual. Pulse **Recalibrate** para volver al sensor.
- Muestra la versión `0.3.0` en diagnóstico.

TiltSip no genera audio en esta fase. Al quedar vacío cancela explícitamente el estado `drinking`. Tampoco usa magnetómetro, geolocalización, cámara ni micrófono, y no recopila ni envía datos.

## Flujo de permiso y calibración

1. Seleccione Beer o Cola.
2. Pulse **Enable Motion**. El permiso nunca se solicita al cargar la página.
3. Si el navegador exige `DeviceOrientationEvent.requestPermission()`, TiltSip lo llama directamente dentro de ese click y registra el listener solamente si devuelve `granted`.
4. Si el método no existe, registra directamente el listener. Si la API no existe o el permiso falla, mantiene el modo manual.
5. Sostenga el teléfono vertical, quieto y en la posición natural desde la que va a beber.
6. Pulse **Calibrate** y manténgalo quieto durante aproximadamente medio segundo.
7. Cuando el estado sea `ready`, acerque el borde superior del teléfono hacia la boca. Enderécelo para detener el consumo.
8. Si el nivel no baja en la dirección esperada, active **Invert drinking direction** en el panel y vuelva a probar. Puede pulsar **Recalibrate** cuando cambie su postura.

## Diagnóstico

Abra **Controls & diagnostics** o añada `?debug=1` a la dirección. El panel muestra:

- protocolo HTTPS o no;
- disponibilidad de la API;
- permiso;
- beta y gamma actuales;
- hora y número de eventos;
- beta base y gamma base;
- inclinación calculada hacia la boca;
- inclinación lateral calculada;
- nivel actual entre `0.000` y `1.000`;
- estado `calibrating`, `ready`, `drinking` o `empty`;
- control **Invert drinking direction**;
- versión `0.3.0`.

**Copy diagnostics** copia todos esos valores en texto.

## Prueba exacta en computador

1. Abra `http://localhost:8000/?debug=1`.
2. Elija Beer y confirme que el nivel inicial sea `0.820`; vuelva y elija Cola para confirmar `0.780` y un aspecto claramente diferente.
3. Mueva **Fill level** hasta 0 y 100. Confirme que el líquido no sale del vaso y que la espuma acompaña a la superficie.
4. Mueva **Side tilt** de -18° a 18° y **Tilt to mouth** de 0° a 60°.
5. Pulse **Refill** desde un nivel bajo y compruebe que el llenado se anima hasta `1.000`.
6. Pulse **Enable Motion**. Si el computador no ofrece la API o no entrega datos, confirme el mensaje útil y que todos los controles manuales continúan funcionando.
7. Pulse **Copy diagnostics** y pegue el texto en un editor.
8. Abra la consola y confirme que no aparecen errores.

## Prueba exacta en iPhone con Safari

1. Publique el proyecto en GitHub Pages y abra la dirección `https://...` directamente en Safari, con el iPhone en vertical.
2. Elija Beer y pulse **Enable Motion**.
3. En el diálogo de iOS, pulse **Allow**. Confirme `Permission: granted`.
4. Mantenga el iPhone vertical y quieto; pulse **Calibrate** y espere a que el estado pase de `calibrating` a `ready`.
5. Confirme que beta base y gamma base tienen valores y que, estando vertical, el nivel no baja.
6. Incline solo a izquierda y derecha. Confirme que cambia Side tilt y se inclina la superficie, pero el nivel permanece igual.
7. Acerque gradualmente el borde superior del iPhone hacia la boca. Confirme `drinking` y que el nivel baja más rápido con una inclinación profunda.
8. Enderece el iPhone. Confirme que el estado vuelve inmediatamente a `ready` y el nivel deja de bajar.
9. Mantenga una inclinación profunda: desde el 100 %, el vaciado debe tardar aproximadamente entre 4 y 7 segundos.
10. Al llegar a cero, confirme `empty` y el mensaje **Empty — tap Refill**.
11. Pulse **Refill** y confirme la animación hasta `1.000`. Si aparece la instrucción de calibración, sostenga el iPhone vertical y vuelva a calibrar.
12. Si el vaso solo bebe al inclinarlo en la dirección contraria, active **Invert drinking direction**.
13. Vuelva a Drinks, cambie a Cola y repita calibración, inclinación y Refill.
14. Mueva un control manual para activar la alternativa manual; pulse **Recalibrate** para volver al sensor.
15. Repita negando el permiso. Confirme que no se registra el listener, no se bloquea la aplicación y el modo manual funciona.
16. Pulse **Copy diagnostics** y compruebe el texto copiado.

## Prueba exacta en Android con Chrome

1. Publique el proyecto en GitHub Pages y abra la dirección `https://...` directamente en Chrome, con el teléfono en vertical.
2. Elija Cola y pulse **Enable Motion**.
3. Si Chrome solicita permiso, acéptelo. Si no necesita ese método, confirme `Permission: not-required` y que beta/gamma cambian.
4. Mantenga el teléfono vertical y quieto; pulse **Calibrate** hasta obtener el estado `ready` y referencias base numéricas.
5. Déjelo vertical durante varios segundos y confirme que el nivel no baja.
6. Incline solo a izquierda y derecha. Confirme que la superficie responde y el nivel no cambia.
7. Incline el borde superior hacia la boca, primero poco y luego más. Confirme que el consumo comienza sobre el umbral y se acelera con una inclinación profunda.
8. Enderece el teléfono y confirme que el nivel se detiene inmediatamente.
9. Compruebe un vaciado profundo desde 100 %: debe durar aproximadamente entre 4 y 7 segundos.
10. Confirme `empty`, **Empty — tap Refill** y Refill animado hasta `1.000`.
11. Pruebe **Invert drinking direction** si el signo es contrario.
12. Cambie entre Beer y Cola y confirme que ambos siguen funcionando.
13. Mueva los tres controles manuales y confirme que siguen siendo una alternativa completa.
14. Bloquee el permiso o pruebe un dispositivo sin datos: después de cinco segundos debe aparecer el aviso y el modo manual debe seguir funcionando.
15. Pulse **Copy diagnostics** y revise que incluya bases, inclinaciones, nivel, estado y versión.

Estas listas describen las pruebas que debe realizar en dispositivos físicos; no sustituyen una comprobación real en su modelo concreto de iPhone o Android.
