# TiltSip 2.0.0

TiltSip es una simulación web móvil original de un vaso que se inclina y derrama. Beer y Cola comparten un motor geométrico 2D: el líquido conserva su área, su superficie permanece perpendicular a la gravedad y el flujo comienza únicamente cuando alcanza el borde inferior del vaso.

La experiencia está diseñada principalmente para teléfonos en orientación vertical. En un computador, o cuando el sensor no está disponible, se puede usar toda la simulación con los controles manuales.

## Tecnología y archivos

TiltSip usa solo HTML, CSS y JavaScript moderno, sin frameworks, backend, paquetes de producción ni recursos externos.

```text
tilt-sip/
├── index.html               # estructura accesible y sistema SVG
├── styles.css               # interfaz, vidrio, espuma y animaciones
├── app.js                   # estado, sensores, render, audio e interfaz
├── config.js                # bebidas y geometrías de los vasos
├── physics.js               # funciones geométricas y física puras
├── README.md
└── tests/
    ├── physics.test.mjs     # propiedades geométricas y vaciado
    ├── app.test.mjs         # regresión de interfaz, sensor y audio
    ├── static.test.mjs      # rutas, permisos, accesibilidad y seguridad
    └── visual-matrix.mjs    # matriz SVG de 180 combinaciones
```

Las rutas de producción son relativas (`./styles.css`, `./app.js`, `./config.js` y `./physics.js`), por lo que funcionan en GitHub Pages bajo `/tilt-sip/`. Los scripts de `tests/` no se cargan en producción.

## Cómo ejecutarlo en un computador

Como `app.js` usa módulos ES, algunos navegadores bloquean la apertura directa mediante `file://`. La forma fiable de abrir `index.html` es iniciar un servidor local desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
```

En Windows también puede usar:

```bash
py -m http.server 8000
```

Abra `http://localhost:8000/`. El modo manual funciona sobre HTTP local; para sensores de un teléfono se recomienda la URL HTTPS de GitHub Pages.

## Física 2D

Cada vaso define un polígono convexo interior `P`, dos puntos abiertos (`rimLeft` y `rimRight`) y una geometría exterior independiente. El asa de Beer está fuera de `P` y nunca puede contener líquido.

Para un ángulo lateral `theta`, limitado a `[-90°, 90°]`, el motor usa:

```text
g = (sin(theta), cos(theta))
q(p) = dot(p, g)
líquido = P ∩ { p | q(p) >= h }
```

`h` se obtiene mediante búsqueda binaria hasta que el área del polígono resultante coincide con `fillLevel × area(P)`. El área se calcula con la fórmula shoelace y la intersección con Sutherland–Hodgman. No se rota un rectángulo y no se usa `tan(theta)`.

La capacidad retenible se calcula así:

```text
lipThreshold = max(dot(rimLeft, g), dot(rimRight, g))
capacityPolygon = P ∩ { p | dot(p, g) >= lipThreshold }
capacityFraction = area(capacityPolygon) / area(P)
```

Solo hay flujo si `fillLevel > capacityFraction + epsilon`. El vaciado usa `requestAnimationFrame` y `deltaTime`, nunca cruza por debajo de la capacidad del ángulo actual y se detiene al alcanzarla. Para seguir derramando hay que inclinar más. A `±90°`, la capacidad se aproxima a cero y un vaso lleno tarda aproximadamente entre cinco y ocho segundos simulados en vaciarse.

La espuma es una franja geométrica sobre la misma superficie libre. Líquido, espuma, celdas y burbujas quedan recortados por la cavidad SVG; las burbujas también se recortan por el polígono líquido.

## Sensor y calibración

- **Enable Motion** no solicita permiso al cargar la página.
- Si `DeviceOrientationEvent` no existe, se conserva el modo manual.
- Si `DeviceOrientationEvent.requestPermission` existe, se invoca directamente dentro del click y el listener solo se registra después de recibir `granted`.
- Si el método no existe, el listener se registra directamente.
- Eventos con `beta` o `gamma` nulos o no numéricos se ignoran.
- Tras cinco segundos sin una lectura válida aparece un aviso; el modo manual no se bloquea.
- **Calibrate** recoge varias lecturas de `gamma` durante unos 550 ms y calcula una media angular estable para definir la vertical como `0°` relativo.
- `gamma` controla exclusivamente el side tilt; `beta` aparece solo como dato crudo de diagnóstico.
- El ángulo se normaliza, suaviza con respuesta dependiente de `deltaTime` y limita a `±90°`.

## Diseño y sonido

- **Beer:** jarra de vidrio grueso con asa exterior, base visible, ámbar con bordes oscuros, espuma marfil y 14 microburbujas.
- **Cola:** vaso highball ligeramente cónico, marrón muy oscuro con transmisión rojiza, espuma beige fina y 18 burbujas algo más activas.
- Ambos usan el mismo render y la misma física; solo cambia la configuración de geometría, apariencia, espuma, burbujas y audio.
- `prefers-reduced-motion` detiene las burbujas animadas, reduce transiciones y hace Refill inmediato.

El sonido se genera localmente con Web Audio API y no usa archivos descargados. El `AudioContext` solo se crea o reanuda desde el click de **Enable Motion**. No existen loops sostenidos:

- en reposo hay silencio casi todo el tiempo y una burbuja breve ocasional;
- el side tilt sin contacto con el borde no produce sonido de vertido;
- durante un derrame real se programan ráfagas breves e intermitentes;
- Refill y Empty producen eventos cortos;
- Mute cancela fuentes y temporizadores inmediatamente;
- al ocultar la página se cancelan los eventos y se suspende el contexto.

## Diagnóstico

El panel está oculto por defecto. Ábralo con **Diagnostics** o use `?debug=1`, por ejemplo:

```text
http://localhost:8000/?debug=1
```

Muestra protocolo, API, permiso, beta crudo, gamma crudo y base, hora y cantidad de eventos, side tilt crudo/filtrado/limitado, nivel, capacidad, exceso, caudal, borde inferior, estado físico, audio y versión. **Copy diagnostics** copia los mismos datos.

El modo manual incluye **Fill level** y **Side tilt** de `-90°` a `+90°`; Refill, Mute y Diagnostics siguen disponibles.

## Pruebas automatizadas

Requieren una versión reciente de Node.js únicamente para ejecutar los tests; Node no forma parte de la aplicación publicada.

```bash
node --check app.js
node --check config.js
node --check physics.js
node tests/physics.test.mjs
node tests/app.test.mjs
node tests/static.test.mjs
node tests/visual-matrix.mjs
```

Resultados de la auditoría 2.0.0:

- física y geometría: **3.700 aserciones aprobadas**;
- regresión de aplicación, sensor simulado y audio: **51 aserciones aprobadas**;
- auditoría estática: **115 aserciones aprobadas**;
- matriz visual generada: **180 estados** — Beer y Cola, seis niveles y quince ángulos por bebida.

La matriz usa niveles `99, 80, 60, 40, 20 y 5 %` y ángulos `0, ±10, ±20, ±30, ±45, ±60, ±75 y ±90°`. Se revisó la imagen rasterizada resultante para confirmar continuidad del polígono, recorte, orientación de superficie, espuma unida y simetría. Los puntos verdes indican volumen retenible; los ámbar indican que ese estado inicial supera la capacidad y debe derramar progresivamente.

## Prueba manual en computador

1. Inicie el servidor local y abra `http://localhost:8000/` con la consola visible.
2. Confirme que Diagnostics está cerrado y no se solicita permiso automáticamente.
3. Elija Beer: debe verse una jarra ámbar con asa exterior, espuma marfil y microburbujas.
4. Abra Diagnostics. Lleve Fill level a `99 %` y Side tilt sucesivamente a `0, ±10, ±20, ±30, ±45, ±60, ±75 y ±90°`.
5. Compruebe que el fondo siempre permanece lleno del lado de la gravedad, sin huecos triangulares; espuma y superficie deben coincidir y nada debe salir de la cavidad.
6. En un ángulo con contacto, confirme que `spilling` baja gradualmente hasta `capacity`, vuelve a `ready` y se detiene aunque el slider no cambie.
7. Aumente la inclinación: el flujo debe reanudarse. Redúzcala: el nivel no debe aumentar.
8. Desde `100 %`, use `±90°`: el vaso debe vaciarse progresivamente en unos cinco a ocho segundos y mostrar **Empty — tap Refill**.
9. Pulse Refill: en modo manual el ángulo vuelve a `0°`, el nivel llega a `100 %` y se regeneran espuma y burbujas.
10. Repita todo con Cola y confirme el vaso alto, líquido oscuro rojizo, espuma más fina y ausencia de asa.
11. Pulse Enable Motion. Si el computador no entrega orientación, espere cinco segundos y confirme el aviso sin perder controles manuales.
12. Pruebe Mute/Unmute, Copy diagnostics, cambio de bebida y `prefers-reduced-motion`.
13. Cambie de pestaña durante audio, regrese y confirme que no quedó sonido continuo.
14. Confirme que la consola no muestra errores no capturados.

## Prueba manual pendiente — iPhone Safari

Estas comprobaciones requieren un iPhone físico y **no se declaran completadas**:

1. Publique en GitHub Pages y abra la URL HTTPS directamente en Safari con el teléfono vertical.
2. Elija Beer y pulse Enable Motion; acepte el cuadro de permiso de movimiento.
3. Compruebe que el listener comienza después de `granted` y que beta/gamma cambian en Diagnostics.
4. Mantenga el teléfono vertical y quieto, pulse Calibrate y espere el estado `ready`.
5. Sin inclinar, confirme que el nivel no baja. Incline solo lateralmente y verifique que la superficie sigue la dirección correcta.
6. Compruebe que no hay derrame ni sonido antes del contacto con el borde.
7. Mantenga un ángulo fijo con contacto: debe vaciar solo hasta `capacity` y detener flujo y audio.
8. Incline progresivamente más hasta `±90°`; confirme simetría, caudal progresivo y vaciado total aproximado de cinco a ocho segundos desde lleno.
9. Confirme que no aparecen huecos, líquido en el asa ni espuma fuera del vaso, incluida la zona de notch/Dynamic Island.
10. Pruebe Refill, Mute, segundo plano, retorno, cambio Beer/Cola y reducción de movimiento.
11. Repita negando el permiso y bloqueando los datos: el modo manual debe seguir operativo y aparecer el aviso de cinco segundos.
12. Copie Diagnostics y adjúntelo a cualquier incidencia.

## Prueba manual pendiente — Android Chrome

Estas comprobaciones requieren un Android físico y **no se declaran completadas**:

1. Abra la URL HTTPS de GitHub Pages en Chrome con el teléfono vertical.
2. Elija Cola y pulse Enable Motion. Acepte el permiso si Chrome lo solicita; si no, confirme `not-required`.
3. Calibre en vertical y compruebe cambios reales de gamma, side tilt limitado a `±90°` y beta solo informativo.
4. Verifique ausencia de flujo/sonido antes del borde y vaciado gradual únicamente después del contacto.
5. Mantenga un ángulo fijo hasta que llegue a `capacity`; confirme parada de nivel y audio. Incline más y confirme que se reanudan.
6. Pruebe ambos signos y el vaciado completo desde lleno en unos cinco a ocho segundos.
7. Compruebe recorte, espuma, asa de Beer, vaso de Cola, safe areas y controles accesibles con el pulgar.
8. Pruebe Refill, Mute, segundo plano, retorno, cambio de bebida y reducción de movimiento.
9. Bloquee o niegue el sensor y confirme el mensaje útil y el modo manual completo.
10. Revise la consola remota de Chrome y copie Diagnostics.

## Publicación en GitHub Pages

1. Cree un repositorio llamado, por ejemplo, `tilt-sip`.
2. Copie `index.html`, `styles.css`, `app.js`, `config.js`, `physics.js` y `README.md` a la raíz. Puede incluir `tests/`; no se carga en producción.
3. Confirme que no cambió ninguna ruta relativa.
4. Haga commit y push a la rama `main`.
5. En GitHub abra **Settings → Pages**.
6. En **Build and deployment**, elija **Deploy from a branch**, rama `main` y carpeta `/(root)`.
7. Guarde y espere la URL `https://USUARIO.github.io/tilt-sip/`.
8. Abra esa URL HTTPS en los teléfonos y ejecute las listas anteriores.

No se usan magnetómetro, orientación absoluta, geolocalización, cámara ni micrófono. TiltSip no recopila ni envía datos.

## Lista final antes de publicar

### Completado en código y simulación determinística

- [x] Copia de seguridad Git de la versión 1.0.0 creada antes de editar.
- [x] Tilt to mouth, su slider, umbrales e inversión eliminados.
- [x] Beta no controla superficie, consumo ni audio.
- [x] Polígono de cavidad, clip SVG, shoelace, semiplano y búsqueda binaria implementados.
- [x] Área renderizada conserva el fill level dentro de tolerancia y nunca genera NaN/Infinity.
- [x] Capacidad `0° ≈ 1`, `±90° ≈ 0`, simetría y monotonicidad aprobadas.
- [x] Un ángulo fijo vacía hasta su capacidad; una inclinación mayor reanuda el flujo.
- [x] Nivel limitado a `[0,1]`, independiente de FPS y sin aumento al enderezar.
- [x] Matriz Beer/Cola de 180 estados generada e inspeccionada.
- [x] Espuma y burbujas recortadas; asa de Beer fuera de la cavidad.
- [x] Audio de eventos sin loops, con Mute, suspensión y temporizadores limitados.
- [x] Permiso directo desde click, fallback sin método, API ausente, denegación, datos nulos y timeout simulados.
- [x] Rutas relativas, `100dvh`, safe areas, bloqueo de scroll, accesibilidad básica y reduced motion auditados.
- [x] Sin recursos remotos, dependencias de producción, secretos ni listeners de orientación duplicados.

### Pendiente de hardware real

- [ ] Permiso y lecturas reales en iPhone Safari.
- [ ] Permiso o `not-required` y lecturas reales en Android Chrome.
- [ ] Dirección perceptual del side tilt y calibración con diferentes modelos de teléfono.
- [ ] Rendimiento SVG, altavoz, notch/safe areas y vaciado cronometrado en ambos sistemas.
- [ ] Consola remota sin errores durante una sesión física completa.

La etiqueta `2.0.0` acredita las pruebas estáticas, matemáticas y simuladas descritas; no equivale a una validación en teléfonos físicos.
