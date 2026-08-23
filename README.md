# TiltSip 2.0.0-rc.1

TiltSip es una simulación web móvil original de un vaso que se inclina y derrama.
Beer y Cola comparten un motor geométrico 2D: el líquido conserva su área, la
superficie permanece perpendicular a la gravedad y el flujo comienza únicamente
cuando el volumen supera la capacidad retenible del ángulo actual.

Esta entrega es una **release candidate**, no la versión 2.0.0 final. La física,
la interfaz, el renderer y la máquina de estados de audio tienen pruebas
determinísticas. Siguen pendientes la validación en iPhone/Android físicos y las
muestras humanas originales o redistribuibles exigidas para certificar el audio
final.

## Tecnología y archivos

La aplicación de producción usa solo HTML, CSS y JavaScript moderno. No tiene
frameworks, backend, npm en producción ni recursos remotos.

```text
tilt-sip/
├── index.html
├── styles.css
├── app.js
├── config.js
├── physics.js
├── README.md
├── assets/
│   └── audio/
│       └── README.md             # inventario, procedencia y limitación actual
├── test-evidence/
│   └── acceptance/
│       ├── beer-acceptance.svg
│       ├── beer-acceptance.png
│       ├── cola-acceptance.svg
│       └── cola-acceptance.png
└── tests/
    ├── physics.test.mjs
    ├── app.test.mjs
    ├── static.test.mjs
    └── visual-matrix.mjs
```

Las rutas de producción son relativas (`./styles.css`, `./app.js`,
`./config.js` y `./physics.js`). Por eso la aplicación funciona publicada bajo
`/tilt-sip/` en GitHub Pages. `tests/` y `test-evidence/` no se cargan desde
`index.html`.

## Abrirlo en un computador

Como `app.js` usa módulos ES, la forma fiable de probar el proyecto es servir la
carpeta localmente:

```bash
python3 -m http.server 8000
```

En Windows también puede usar:

```bash
py -m http.server 8000
```

Abra `http://localhost:8000/`. El modo manual funciona en localhost. Los sensores
de un teléfono deben probarse desde la URL HTTPS de GitHub Pages.

## Mapeo angular: sensor ±78° → física ±90°

La lectura accesible y el ángulo interno son variables distintas:

```text
rawSideTilt       = gamma relativa a la calibración
clampedSideTilt   = clamp(rawSideTilt filtrada, -78, +78)
normalizedTilt    = clamp(clampedSideTilt / 78, -1, 1)
physicsAngle      = normalizedTilt × 90°
physicsRadians    = normalizedTilt × π/2
```

Ejemplos:

| Lectura visible | Normalizada | Ángulo físico |
|---:|---:|---:|
| 0° | 0 | 0° |
| 39° | 0.5 | 45° |
| 65° | 0.8333 | 75° |
| 78° | 1 | 90° |
| -78° | -1 | -90° |

El slider y el sensor se limitan a ±78°. La gravedad, `capacityFraction`, el
polígono renderizado y el caudal usan `physicsAngle`. La interfaz nunca presenta
90° como lectura real; Diagnostics lo muestra únicamente bajo **Physics angle**.

Al superar aproximadamente 77.5° se satura a 78°. La salida del máximo tiene un
umbral inferior, evitando parpadeo cuando el sensor oscila cerca del límite. De
esta forma no es necesario alcanzar 80° o 90° físicamente y ±78° puede vaciar el
vaso por completo.

## Motor geométrico

Cada vaso configura un polígono convexo interior `P`, `rimLeft`, `rimRight` y una
geometría exterior. El asa de Beer queda detrás y fuera de `P`, por lo que nunca
puede contener líquido.

Para el ángulo físico `theta`:

```text
g = (sin(theta), cos(theta))
q(p) = dot(p, g)
liquidPolygon = P ∩ { p | q(p) >= h }
```

El motor encuentra `h` por búsqueda binaria hasta que el área del polígono
coincide con `fillLevel × area(P)`. Usa shoelace para el área y clipping de
semiplano para la intersección. No rota un rectángulo, no usa `tan(theta)` y no
crea huecos triangulares artificiales.

La capacidad retenible se calcula con el borde inferior:

```text
lipThreshold = max(dot(rimLeft, g), dot(rimRight, g))
capacityPolygon = P ∩ { p | dot(p, g) >= lipThreshold }
capacityFraction = area(capacityPolygon) / area(P)
```

Solo existe flujo si el nivel supera `capacityFraction + epsilon`. La integración
usa `requestAnimationFrame`, `deltaTime` limitado y una histéresis pequeña. Un
ángulo fijo derrama hasta su capacidad y se detiene; inclinar más vuelve a iniciar
el flujo. El nivel nunca sale de `[0, 1]`.

## Renderer visual

La física es la única fuente de la forma. El mismo polígono actualiza el líquido,
su clip y la superficie; las capas de material solo cambian su apariencia:

1. base de color y transmisión;
2. gradiente de profundidad;
3. oscurecimiento periférico;
4. luz interna cálida o rojiza;
5. textura procedural fina y no repetitiva;
6. microburbujas de tamaños, opacidades y profundidades distintas;
7. menisco con sombra húmeda;
8. espuma inferior húmeda, cuerpo y superficie;
9. vidrio, borde, base, reflejos asimétricos y asa independiente;
10. condensación estática y sombra de contacto.

Beer configura una jarra gruesa con asa, ámbar translúcido, 26 burbujas animadas,
34 celdas de espuma y reflejo cálido. Cola configura un highball cónico, marrón
oscuro con transmisión rojiza, 30 burbujas más rápidas y espuma beige más fina.
Ambas bebidas comparten toda la lógica; solo cambian datos del objeto `DRINKS` y
la geometría seleccionada.

Los elementos se generan al elegir bebida o usar Refill, no en cada evento del
sensor. Cada frame solo cambia atributos geométricos indispensables. Los clips de
cavidad y líquido contienen líquido, espuma y burbujas. `prefers-reduced-motion`
detiene la animación repetitiva y hace Refill inmediato.

## Capturas de aceptación

El generador determinístico cubre por bebida:

- 100 % a 0°;
- 80 % a ±30°;
- 60 % a ±50°;
- 40 % a ±65°;
- 20 % a ±72°;
- 5 % a ±78°.

Capturas incluidas:

- [Beer — 11 estados](./test-evidence/acceptance/beer-acceptance.png)
- [Cola — 11 estados](./test-evidence/acceptance/cola-acceptance.png)

Los SVG equivalentes se incluyen para revisar los vectores a resolución
independiente. Un punto verde significa que ese volumen cabe al ángulo mostrado;
un punto ámbar significa que el estado inicial debe derramar progresivamente.

Estas capturas se rasterizaron e inspeccionaron en el entorno de desarrollo. No
sustituyen una revisión visual en Safari/Chrome móviles ni certifican por sí solas
fotorealismo perceptual en una pantalla física.

## Sensores y calibración

- **Enable Motion** no solicita permiso al cargar.
- Si `DeviceOrientationEvent` no existe, queda activo el modo manual.
- Si `requestPermission` existe, se invoca directamente desde el click; el
  listener solo se registra tras obtener `granted`.
- Si el método no existe, el listener se registra directamente.
- Eventos cuyo `beta` o `gamma` no sean números finitos se ignoran.
- Tras cinco segundos sin datos aparece un aviso útil y el modo manual sigue
  completo.
- **Calibrate** toma varias lecturas de `gamma` durante unos 550 ms y obtiene una
  media angular estable.
- `gamma` relativa controla la inclinación lateral. `beta` es solo diagnóstico.
- El filtrado exponencial depende de `deltaTime`; la saturación garantiza que una
  lectura sostenida cerca del máximo llegue a 78°.

Diagnostics muestra protocolo, API, permiso, beta/gamma, gamma base, eventos,
lectura cruda, filtrada y limitada, normalización, ángulo físico, nivel,
capacidad, overflow, caudal, borde, estado físico, estado de audio y versión.
**Copy diagnostics** copia esos datos.

## Audio: máquina de estados y limitación actual

El `AudioContext` se crea o reanuda únicamente dentro del click directo de
**Enable Motion**. No se reproduce nada antes de una interacción.

Estados implementados:

- `empty`: silencio;
- `idle-bubbling`: microeventos irregulares cerca de vertical y con más de 5 %;
- `tilted-no-flow`: silencio de consumo;
- `sipping`: solo con `overflow > epsilon`, `flowRate > 0` y hasta el umbral de
  consumo normal;
- `chugging`: solo con flujo real; entra por encima de 66° y permanece hasta bajar
  de 63°;
- `refilling`: evento breve limitado a la animación;
- `muted`: fuentes y timers cancelados de inmediato.

Beer usa intervalos ambientales más largos y tono algo más grave. Cola programa
grupos más frecuentes y agudos. No se usan loops, osciladores sostenidos ni ruido
continuo. Cambiar bebida, silenciar, vaciar o pasar a segundo plano cancela los
schedulers y AudioNodes activos.

### Procedencia y licencia

- **Assets visuales de producción:** ninguno. Todo el material se genera con SVG,
  CSS y JavaScript originales del proyecto.
- **Assets de audio binarios:** ninguno.
- **Motor Web Audio:** código procedural original de TiltSip, sin dependencia de
  terceros.
- **Referencia visual adjunta:** utilizada solo para observar cualidades generales
  del material; no se copia, distribuye ni incorpora al proyecto.

La procedencia también está en [`assets/audio/README.md`](./assets/audio/README.md).
Las muestras humanas de sipping/chugging siguen pendientes. El fallback
procedural permite verificar estados y cancelación, pero **no se presenta como
audio humano final ni se declara validado perceptualmente**.

## Pruebas automatizadas ejecutadas

Node.js solo se usa para la auditoría; no forma parte de la web publicada.

```bash
node --check app.js
node --check config.js
node --check physics.js
node tests/physics.test.mjs
node tests/app.test.mjs
node tests/static.test.mjs
node tests/visual-matrix.mjs test-evidence/acceptance
```

Resultado de esta release candidate:

- física y geometría: **4.166 aserciones aprobadas**;
- aplicación, sensor simulado y audio: **83 aserciones aprobadas**;
- auditoría estática, rutas, permisos y seguridad: **150 aserciones aprobadas**;
- capturas: **22 estados generados** — 11 Beer y 11 Cola.

Las pruebas cubren mapeo 0/39/65/±78, clamp, histéresis del máximo, conservación
de área, simetría, capacidad, vaciado independiente de FPS, listener único,
permiso directo, ausencia de API, permiso negado, valores nulos, timeout,
calibración, modos de audio, histéresis 63°/66°, Mute, background, Refill y cambio
de bebida.

## Prueba manual en computador

1. Sirva la carpeta y abra `http://localhost:8000/?debug=1` con la consola visible.
2. Confirme que no aparece permiso ni sonido al cargar.
3. Elija Beer y revise jarra, asa fuera de la cavidad, profundidad, espuma y
   burbujas variadas.
4. Use Fill level con `100, 80, 60, 40, 20 y 5 %` y Side tilt con `0, ±30, ±50,
   ±65, ±72 y ±78°` según la matriz de aceptación.
5. Compruebe que Diagnostics muestra 39° → 45° físico, 65° → 75° físico y 78° →
   90° físico, sin que el slider muestre más de 78°.
6. Mantenga un ángulo con overflow: debe vaciar solo hasta `capacity`, parar nivel
   y audio, y mostrar `tilted-no-flow`.
7. Aumente el ángulo y confirme que el flujo se reanuda. A ±78° debe poder llegar
   a vacío y mostrar **Empty — tap Refill**.
8. Repita con Cola y confirme espuma más fina, burbuja más activa, transmisión
   rojiza y ausencia de asa.
9. Pulse Enable Motion. Si el computador no entrega orientación, espere cinco
   segundos y confirme que el aviso no bloquea los sliders.
10. Pruebe Refill, Mute/Unmute, Diagnostics, Copy diagnostics, cambio de bebida,
    segundo plano y reduced motion.
11. Confirme que no hay errores no capturados en la consola.

## Prueba auditiva manual pendiente

La automatización verifica estados, tiempos y ausencia de loops, pero no puede
certificar percepción humana. Con altavoces físicos y, cuando existan, muestras
licenciadas:

1. Beer recta durante 20 s: burbujeo bajo, irregular y sin zumbido.
2. Cola recta durante 20 s: algo más activa que Beer.
3. Inclinación sin contacto: ningún sonido humano.
4. Flujo por debajo del umbral alto: `sipping`.
5. Cruces repetidos 63°–67°: transición estable, sin parpadeo.
6. Flujo alto: `chugging`; 78° sigue siendo el máximo.
7. Ángulo fijo hasta `capacity`: el consumo se detiene; inclinar más lo reanuda.
8. Vaso vacío, Mute y segundo plano: silencio inmediato.
9. Cambio Beer/Cola: ninguna superposición.
10. Refill: sonido solo durante la recarga.

## Prueba física pendiente — iPhone Safari

Estas comprobaciones **no se declaran realizadas**:

1. Publique en GitHub Pages y abra la URL HTTPS en Safari con el iPhone vertical.
2. Elija una bebida, pulse Enable Motion y acepte el permiso.
3. Confirme en Diagnostics que el listener aparece después de `granted` y que
   beta/gamma reciben datos.
4. Mantenga el teléfono vertical y quieto, pulse Calibrate y espere `ready`.
5. Compruebe ambos signos, dirección intuitiva, suavidad y saturación estable en
   aproximadamente 77.5°–78° sin exigir 80°/90° reales.
6. Verifique que un ángulo fijo se detiene en `capacity` y uno mayor reanuda el
   flujo; a ±78° debe vaciar completamente.
7. Revise clipping, espuma, asa, nitidez Retina, rendimiento, safe areas, notch o
   Dynamic Island y controles accesibles con el pulgar.
8. Ejecute la lista auditiva, Refill, Mute, background y cambio Beer/Cola.
9. Repita negando el permiso y bloqueando datos: el modo manual debe seguir
   operativo.
10. Revise la consola remota y copie Diagnostics ante cualquier incidencia.

## Prueba física pendiente — Android Chrome

Estas comprobaciones **no se declaran realizadas**:

1. Abra la URL HTTPS en Chrome con el teléfono vertical.
2. Pulse Enable Motion; acepte si aparece permiso o confirme `not-required`.
3. Calibre y compruebe gamma relativa real, ambos signos, filtro y saturación a
   ±78°.
4. Valide contacto con el borde, parada en `capacity`, reanudación al inclinar más
   y vaciado total sin alcanzar 80°/90° físicos.
5. Revise renderer, clip, asa de Beer, highball de Cola, rendimiento, densidad de
   píxeles, safe areas y controles.
6. Ejecute la lista auditiva completa y pruebe Refill, Mute, background, cambio de
   bebida y reduced motion.
7. Niegue o bloquee el sensor y confirme el aviso y el modo manual completo.
8. Revise la consola remota y copie Diagnostics.

## Publicación en GitHub Pages

1. Cree un repositorio, por ejemplo `tilt-sip`.
2. Copie los archivos del proyecto a su raíz conservando las rutas relativas.
3. Haga commit y push a `main`.
4. En GitHub abra **Settings → Pages**.
5. Seleccione **Deploy from a branch**, rama `main`, carpeta `/(root)`.
6. Abra `https://USUARIO.github.io/tilt-sip/` y ejecute ambas listas físicas.

TiltSip no usa magnetómetro, orientación absoluta, geolocalización, cámara ni
micrófono. No recopila ni envía datos.

## Criterio para retirar `rc.1`

No se debe etiquetar como 2.0.0 final hasta completar y documentar:

- permiso, calibración, ±78° y rendimiento en iPhone Safari físico;
- permiso/not-required, ±78° y rendimiento en Android Chrome físico;
- escucha humana con muestras originales o de licencia redistribuible;
- ausencia de clicks, clipping, solapamiento y sonidos artificiales molestos;
- revisión perceptual del material del vidrio, líquido y espuma en pantallas
  físicas de alta densidad.
