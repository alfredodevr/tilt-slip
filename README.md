# TiltSip 2.0.0-rc.2

TiltSip es una simulación móvil original de un vaso que conserva volumen y se
vacía al inclinarlo lateralmente. Esta revisión continúa como **release
candidate**: la física, la interfaz, el renderer y el motor de audio por muestras
están implementados, pero faltan grabaciones humanas licenciadas y pruebas en
teléfonos físicos.

No se ha publicado esta revisión.

## Estado real

- Física a ±85°: implementada y probada automáticamente.
- Beer y Cola: mismo motor; cambian únicamente geometría y configuración visual.
- Renderer híbrido: polígonos SVG físicos + texturas originales + caras de vidrio
  transparentes.
- Audio: motor sample-only implementado; actualmente silencioso porque no hay
  muestras humanas con licencia verificada.
- iPhone Safari físico: pendiente.
- Android Chrome físico: pendiente.
- Escucha humana de bubbling, sipping y chugging: pendiente.
- Versión final 2.0.0: bloqueada hasta completar esas pruebas.

## Archivos principales

```text
tilt-sip/
├── index.html
├── styles.css
├── app.js
├── config.js
├── physics.js
├── README.md
├── assets/
│   ├── audio/
│   │   └── README.md
│   └── visual/
│       ├── beer-glass.webp
│       ├── cola-glass.webp
│       ├── beer-liquid-material.webp
│       ├── cola-liquid-material.webp
│       ├── README.md
│       └── source/
├── tests/
│   ├── physics.test.mjs
│   ├── app.test.mjs
│   ├── static.test.mjs
│   └── visual-matrix.mjs
└── test-evidence/
    └── rc2-renderer/
```

La aplicación publicada sigue siendo HTML, CSS y JavaScript puro. No usa React,
TypeScript, npm en el navegador, backend, base de datos ni dependencias externas.

## Cómo abrirla

La forma más fiel de probar módulos ES y rutas relativas es servir la carpeta
localmente:

```bash
cd tilt-sip
python3 -m http.server 8000
```

Después abra `http://localhost:8000/`.

También puede intentar abrir `index.html` directamente, pero algunos navegadores
restringen imports ES bajo `file://`. Esa restricción no existe en GitHub Pages.

## Uso básico

1. Elija **Beer** o **Cola**.
2. En computador, abra **Diagnostics** y utilice **Fill level** y **Side tilt**.
3. En un teléfono, pulse **Enable Motion**.
4. Si aparece un permiso, concédalo.
5. Mantenga el teléfono vertical y pulse **Calibrate**.
6. Incline el teléfono lateralmente. El líquido solo se vacía cuando el volumen
   supera la capacidad física del vaso en ese ángulo.
7. Pulse **Refill** para regenerar espuma y volver al 100 %.
8. **Mute** cancela toda fuente y todo scheduler de audio.

No existe lógica funcional de “tilt to mouth”. Beta se muestra únicamente como
diagnóstico; gamma relativa a la calibración controla la inclinación lateral.

## Física: sensor ±85° → física ±90°

El sensor y el slider manual se limitan a ±85°. La física usa un ángulo interno
de ±90°:

```text
normalizedTilt = clamp(clampedSideTilt / 85, -1, 1)
physicsAngle   = normalizedTilt * 90
```

| Sensor visible | Normalizado | Ángulo físico interno |
|---:|---:|---:|
| 0° | 0.000 | 0° |
| 42.5° | 0.500 | 45° |
| 65° | 0.765 | 68.8° |
| 78° | 0.918 | 82.6° |
| 85° | 1.000 | 90° |
| -85° | -1.000 | -90° |

A partir de aproximadamente 84.5° se activa la saturación al máximo. La salida
del máximo usa histéresis hasta aproximadamente 83.75°, evitando saltos. Por
tanto:

- ±78° ya no es el máximo y no tiene obligación de vaciar completamente;
- ±85° sí produce capacidad prácticamente cero;
- `capacityFraction`, la gravedad, la superficie, la espuma y el caudal usan
  `physicsAngle`;
- el umbral sonoro de chugging usa `abs(clampedSideTilt)`, no el ángulo físico.

La superficie se obtiene recortando el polígono convexo de la cavidad por un
semiplano. El umbral se resuelve por área, así que el área renderizada equivale al
nivel almacenado. El derrame integra `flowRate * deltaTime` y nunca cruza la
capacidad del ángulo sostenido.

## Sensor y permiso

La solicitud se realiza únicamente dentro del click directo de **Enable
Motion**:

- si `DeviceOrientationEvent` no existe, permanece el modo manual;
- si `requestPermission` es función, se espera `granted` antes de registrar
  el listener;
- si no existe ese método, el listener se registra directamente;
- eventos con beta o gamma nulos/no numéricos se ignoran;
- el listener tiene guardia contra duplicados;
- tras cinco segundos sin datos se muestra una ayuda y el modo manual continúa.

La calibración recoge varias lecturas de gamma durante unos 550 ms y calcula una
media circular. El suavizado de entrada depende de `deltaTime` y la animación
usa un único bucle `requestAnimationFrame`.

## Arquitectura visual

Orden de composición:

1. sombra ambiental;
2. cara trasera del vidrio;
3. polígono físico del líquido;
4. textura, transmisión, profundidad y bordes internos;
5. burbujas sumergidas;
6. menisco;
7. capas húmeda, cuerpo y celdas de espuma;
8. cara frontal del vidrio;
9. borde y base;
10. reflejos y condensación.

El líquido usa su polígono como `clipPath` real. Las capas de espuma usan el
polígono de banda física como máscara; sus celdas se posicionan sobre el segmento
de superficie para romper el contorno uniforme sin separarse del líquido. Toda la
cavidad está recortada por el vaso.

Los cuatro assets WebP y sus fuentes PNG fueron creados específicamente para
TiltSip con la herramienta integrada de generación de imágenes. No proceden de
iBeer, Coca-Cola ni otra aplicación o marca. La procedencia y los prompts
descriptivos están documentados en
[`assets/visual/README.md`](./assets/visual/README.md).

### Capturas de revisión

Estas son capturas deterministas del renderer, creadas con las mismas geometrías,
texturas, máscaras y configuraciones que la aplicación. Sirven para revisar
composición; no son capturas de un teléfono físico.

- [Beer — hoja 100/75/50/20 %](./test-evidence/rc2-renderer/beer-contact-sheet.png)
- [Cola — hoja 100/75/50/20 %](./test-evidence/rc2-renderer/cola-contact-sheet.png)
- [Beer estrecho 320 × 720, asa completa](./test-evidence/rc2-renderer/beer-narrow-320x720-handle.png)

Capturas individuales:

- [Beer 100 % · 0°](./test-evidence/rc2-renderer/beer-100pct-0deg.png)
- [Beer 75 % · 35°](./test-evidence/rc2-renderer/beer-75pct-35deg.png)
- [Beer 50 % · 60°](./test-evidence/rc2-renderer/beer-50pct-60deg.png)
- [Beer 20 % · 80°](./test-evidence/rc2-renderer/beer-20pct-80deg.png)
- [Cola 100 % · 0°](./test-evidence/rc2-renderer/cola-100pct-0deg.png)
- [Cola 75 % · 35°](./test-evidence/rc2-renderer/cola-75pct-35deg.png)
- [Cola 50 % · 60°](./test-evidence/rc2-renderer/cola-50pct-60deg.png)
- [Cola 20 % · 80°](./test-evidence/rc2-renderer/cola-20pct-80deg.png)

## Audio: motor listo, muestras pendientes

El código no crea osciladores, ruido blanco, zumbidos ni loops continuos. Solo
puede reproducir buffers locales configurados en `AUDIO_ASSETS`.

Reglas implementadas:

- el `AudioContext` se crea/reanuda dentro del click directo inicial;
- no se reproduce nada antes de una interacción;
- sipping y chugging requieren `overflow > epsilon` y `flowRate > 0`;
- exactamente 65° permanece en sipping;
- chugging entra por encima de aproximadamente 66° y sale por debajo de 63°;
- una muestra humana nunca se superpone con otra;
- no se repite inmediatamente el mismo archivo;
- `playbackRate` varía entre 0.97 y 1.03;
- bubbling entra a ≤4° y sale al superar 7°;
- el scheduler usa un intervalo exponencial con λ = 4 / 5.5 eventos/s;
- Mute, vacío, background, Refill y cambio de bebida cancelan timers y fuentes.

`AUDIO_ASSETS` está deliberadamente vacío. Diagnostics muestra
`silent — licensed recordings pending`. No se aprueban bubbling, sipping,
chugging ni refill por calidad perceptual. Los requisitos de grabación y licencia
están en [`assets/audio/README.md`](./assets/audio/README.md).

## Pruebas automáticas

Ejecute:

```bash
node tests/physics.test.mjs
node tests/app.test.mjs
node tests/static.test.mjs
node tests/visual-matrix.mjs test-evidence/rc2-renderer
```

Último resultado local de esta RC:

- física y matriz sostenida/progresiva: **25 422 aserciones PASS**;
- aplicación, permiso, calibración, interfaz y estados: **90 aserciones PASS**;
- auditoría estática: **178 aserciones PASS**;
- matriz visual: **9 SVG generados y 9 PNG revisados**.

La matriz física cubre Beer y Cola, niveles 100, 80, 60, 40, 20 y 5 %, ambos
signos y ángulos 0, 10, 20, 30, 45, 60, 65, 70, 75, 78, 80 y 85°. Cada caso
comprueba conservación de área, recorte dentro de la cavidad, superficie, espuma,
capacidad, derrame sostenido y terminación. También se recorren ángulos
progresivos hasta ±85°.

## Auditoría de publicación

| Área | Estado | Evidencia o límite |
|---|---|---|
| Conservación de volumen | PASS | Matriz geométrica por área |
| Contacto con el borde | PASS | `capacityAtAngle` en ambos signos |
| Detención en capacidad | PASS | Derrame sostenido de toda la matriz |
| Vaciado total a ±85° | PASS | Física y aplicación manual |
| Ausencia de huecos artificiales | PASS | Polígono convexo recortado; capturas |
| Apariencia de líquido | PASS | Capturas deterministas revisadas |
| Apariencia de espuma | PASS | Banda física multicapa y celdas revisadas |
| Jarra Beer / highball Cola | PASS | Assets originales y capturas |
| Scheduler de burbujas | PASS | Poisson, histéresis y limpieza |
| Burbujeo audible real | PENDING MANUAL | Faltan cinco muestras licenciadas |
| Sipping humano | PENDING MANUAL | Faltan tres muestras licenciadas |
| Chugging humano | PENDING MANUAL | Faltan tres muestras licenciadas |
| Transición 65° | PASS | 65 sipping; histéresis 66/63 |
| Mute | PASS | Cancela timers, fuentes y ganancia |
| Refill visual | PASS | 100 %, nueva espuma, sin crear DOM por frame |
| Refill audible | PENDING MANUAL | Muestra opcional pendiente |
| Segundo plano | PASS | Cancela y suspende AudioContext |
| Safari iPhone físico | PENDING MANUAL | No ejecutado |
| Chrome Android físico | PENDING MANUAL | No ejecutado |
| GitHub Pages publicado | PENDING MANUAL | Rutas verificadas; no se publicó |
| FPS/memoria en móviles | PENDING MANUAL | Estructura acotada; falta perfil físico |
| Errores de consola | PASS | Harness automatizado; consola móvil pendiente |

## Prueba manual pendiente — iPhone Safari

1. Publicar temporalmente la RC mediante HTTPS.
2. Abrirla directamente en Safari con orientación vertical.
3. Confirmar que no aparece permiso al cargar.
4. Elegir Beer y pulsar **Enable Motion** una vez.
5. Aceptar el permiso y comprobar un solo listener en Diagnostics.
6. Mantener el teléfono vertical, pulsar **Calibrate** y esperar `ready`.
7. Confirmar beta/gamma cambiantes y gamma base estable.
8. Probar 0°, ambos lados, 65°, cerca de 84.5° y el máximo visible 85°.
9. Verificar que solo el derrame reduce el nivel y que un ángulo sostenido termina
   en `capacityFraction`.
10. Vaciar a ±85°, usar Refill, cambiar Beer/Cola y repetir.
11. Probar Mute, bloqueo de pantalla/cambio de pestaña y retorno.
12. Con grabaciones licenciadas instaladas, escuchar al menos cinco minutos:
    burbujas no mecánicas, sipping humano, chugging humano y transición sin loops.

## Prueba manual pendiente — Android Chrome

1. Abrir la misma URL HTTPS en Chrome, en vertical.
2. Confirmar que `requestPermission` ausente se diagnostica como
   `not-required` y el listener se registra después del click.
3. Calibrar y repetir la matriz lateral en ambos signos.
4. Confirmar saturación máxima visible en 85°, vacío, Refill y cambio de bebida.
5. Probar denegación/ausencia de datos si el dispositivo lo permite; el modo
   manual debe seguir completo.
6. Probar Mute, background/foreground y estabilidad durante varios minutos.
7. Con muestras instaladas, realizar la misma escucha perceptual que en iPhone.

No se debe cambiar la versión a 2.0.0 ni publicar hasta completar ambas pruebas
físicas y aprobar los audios por escucha humana.

## GitHub Pages cuando sea autorizado

1. Suba el repositorio a GitHub.
2. Abra **Settings → Pages**.
3. Seleccione **Deploy from a branch**.
4. Elija la rama y la carpeta raíz `/`.
5. Espere la URL HTTPS y ejecute las dos pruebas móviles anteriores.

Todas las rutas de producción son relativas (`./styles.css`, `./app.js`,
`./config.js`, `./physics.js` y `./assets/...`), por lo que funcionan bajo
una ruta como `/tilt-sip/`.
