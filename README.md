# TiltSip 1.0.0 — versión auditada

TiltSip es una experiencia web móvil original que simula beber de un vaso. La versión 1.0.0 reúne la selección Beer/Cola, el modo manual, el permiso y diagnóstico de orientación, la calibración, el consumo por inclinación, el acabado visual y los sonidos originales generados en el navegador.

La experiencia principal está optimizada para un teléfono en orientación vertical. El modo manual sigue funcionando en computador y cuando el sensor no existe, el permiso se niega o no llegan datos.

## Archivos

```text
tilt-sip/
├── index.html
├── styles.css
├── app.js
└── README.md
```

Solo usa HTML, CSS y JavaScript puro. No contiene imágenes, sonidos descargados, librerías ni dependencias externas. Las rutas `./styles.css` y `./app.js` son relativas para funcionar bajo `/tilt-sip/` en GitHub Pages.

## Cómo abrirlo en un computador

Puede abrir `index.html` directamente. Para probarlo mediante un servidor local, abra una terminal en la carpeta `tilt-sip` y ejecute:

```bash
python3 -m http.server 8000
```

En Windows también puede usar:

```bash
py -m http.server 8000
```

Después visite `http://localhost:8000`. Los sensores pueden no entregar datos sobre HTTP, pero Beer, Cola, Refill, sonido y los controles manuales no dependen del sensor.

## Comportamiento conservado

- Permiso de `DeviceOrientationEvent` solicitado solamente desde el click de **Enable Motion**.
- Listener registrado únicamente después de `granted` cuando el navegador exige permiso.
- Eventos con beta o gamma inválidos ignorados.
- Aviso después de cinco segundos sin datos y modo manual siempre disponible.
- Calibración de varias lecturas durante aproximadamente 550 ms.
- Diferencias angulares normalizadas y limitadas.
- Beta controla la inclinación hacia la boca; gamma inclina visualmente la superficie.
- Suavizado y consumo procesados con `requestAnimationFrame` y `deltaTime`.
- Umbral de 18° y vaciado profundo de aproximadamente cinco segundos desde 100 %.
- Nivel limitado entre `0` y `1`, espuma unida a la superficie y mensaje **Empty — tap Refill**.
- **Invert drinking direction**, diagnóstico copiable y cambio funcional entre Beer y Cola.

## Acabado visual

El objeto central `DRINKS` continúa controlando los efectos sin duplicar la simulación:

- **Beer:** ámbar semitransparente, reflejo cálido, espuma blanca más alta e irregular y 18 burbujas finas de movimiento tranquilo.
- **Cola:** marrón casi negro, brillo rojizo, espuma beige más delgada y 22 burbujas pequeñas más rápidas.
- Las burbujas se crean con elementos HTML y CSS, quedan recortadas dentro del líquido y desaparecen al superar la superficie o cuando el vaso está vacío.
- La espuma disminuye ligeramente con el nivel.
- Cada pulsación de **Refill** recrea burbujas y espuma con una distribución nueva.
- El vidrio incorpora reflejos laterales y diagonales sutiles.
- Si el sistema tiene `prefers-reduced-motion: reduce`, las burbujas quedan estáticas, las transiciones se reducen y Refill se completa sin animación prolongada.

El máximo es de 22 burbujas animadas, lo que limita el trabajo gráfico en teléfonos.

## Sonido original con Web Audio API

No existen archivos de audio. TiltSip genera ruido y tonos directamente mediante Web Audio API:

- gas suave cuando queda suficiente bebida y el estado es `ready`;
- ruido filtrado de sorbo o vertido durante `drinking`;
- tono corto descendente al quedar vacío;
- tono corto ascendente al pulsar Refill;
- botón visible **Mute/Unmute**.

El `AudioContext` se crea o reanuda directamente desde **Enable Motion**. Antes de esa interacción no se crea el motor de audio ni se reproduce sonido. Si la página pasa a segundo plano, el contexto se suspende y las burbujas se pausan; al regresar puede reanudarse únicamente si ya hubo una interacción y el sonido no está silenciado.

El sonido es complementario: si Web Audio no está disponible o falla, los sensores y controles manuales siguen funcionando.

## Interfaz y diagnóstico

Enable Motion, Refill, Mute y Diagnostics están agrupados en la parte inferior para poder alcanzarlos con el pulgar. También se conserva el Refill superior.

El panel de diagnóstico permanece oculto por defecto. Ábralo con **Diagnostics** o añada `?debug=1` a la dirección:

```text
http://localhost:8000/?debug=1
```

Muestra protocolo, API, permiso, beta, gamma, hora y cantidad de eventos, referencias base, inclinaciones calculadas, nivel, estado, dirección invertida y versión `1.0.0`. **Copy diagnostics** también incluye el estado del sonido.

## Prueba exacta en computador

1. Abra `http://localhost:8000` y confirme que el panel diagnóstico esté oculto.
2. Elija Beer. Confirme líquido ámbar transparente, espuma blanca irregular y burbujas finas.
3. Vuelva y elija Cola. Confirme líquido casi negro con reflejo rojo, espuma beige más delgada y burbujas más rápidas.
4. Pulse **Enable Motion**. Aunque el computador no tenga datos de orientación, debe comenzar el audio y el modo manual debe continuar disponible.
5. Pulse **Mute** y **Unmute**; el sonido debe apagarse y regresar sin afectar el vaso.
6. Abra **Diagnostics** y mueva Fill level, Side tilt y Tilt to mouth.
7. Lleve Fill level a cero. Confirme que desaparecen líquido, espuma y burbujas, aparece `empty` y suena una señal corta si el audio está activo.
8. Pulse el Refill inferior. Confirme llenado hasta `1.000`, señal corta y una distribución nueva de espuma y burbujas.
9. Cambie entre Beer y Cola y repita Refill.
10. Pulse **Copy diagnostics** y revise que muestre versión `1.0.0` y estado del sonido.
11. Cambie el sistema a “reducir movimiento”, recargue la página y confirme burbujas estáticas y Refill inmediato.
12. Abra la consola y confirme que no aparecen errores.

## Prueba exacta en iPhone con Safari

1. Publique el proyecto en GitHub Pages y abra la URL `https://...` directamente en Safari, con el iPhone vertical.
2. Elija Beer y pulse **Enable Motion**. Acepte el permiso de movimiento.
3. Confirme que el diagnóstico no se abre automáticamente y que el sonido suave comienza solamente después del click.
4. Mantenga el iPhone vertical y quieto; pulse **Calibrate** y espere `calibrating → ready`.
5. Déjelo vertical varios segundos: el nivel no debe bajar.
6. Incline solo a izquierda y derecha: la superficie debe responder sin consumir.
7. Acerque el borde superior hacia la boca: debe aparecer `drinking`, sonar el vertido y bajar el nivel.
8. Enderece el iPhone: el consumo y el sonido de vertido deben detenerse inmediatamente.
9. Mantenga una inclinación profunda desde 100 %: debe vaciarse aproximadamente en 4–7 segundos.
10. Confirme el tono final, `empty` y **Empty — tap Refill**.
11. Pulse Refill: confirme tono corto, llenado al 100 % y espuma nueva.
12. Pruebe Mute/Unmute durante `ready` y `drinking`.
13. Envíe Safari al segundo plano: el sonido debe detenerse. Regrese y confirme que no hubo reproducción mientras estaba oculto.
14. Cambie a Cola y repita calibración, inclinación lateral, consumo, vacío y Refill.
15. Si el signo es contrario, active **Invert drinking direction**.
16. Repita negando el permiso: debe aparecer el mensaje útil y el modo manual debe seguir completamente funcional.

## Prueba exacta en Android con Chrome

1. Abra la URL HTTPS de GitHub Pages directamente en Chrome, con el teléfono vertical.
2. Elija Cola y pulse **Enable Motion**. Acepte el permiso si aparece; si no se necesita, confirme `not-required`.
3. Confirme que no había sonido antes del click y que el panel diagnóstico sigue cerrado.
4. Calibre con el teléfono vertical y quieto hasta obtener `ready` y referencias base.
5. Compruebe que la vertical no consume y que la inclinación exclusivamente lateral solo mueve la superficie.
6. Incline el borde superior hacia la boca: deben activarse `drinking`, el sonido de vertido y el consumo gradual.
7. Enderece el teléfono y confirme la detención inmediata del consumo y del sonido.
8. Compruebe un vaciado profundo en aproximadamente 4–7 segundos, la señal de vacío y el mensaje final.
9. Pulse Refill y confirme espuma/burbujas nuevas, señal corta y nivel `1.000`.
10. Pruebe Mute/Unmute, segundo plano y regreso a la página.
11. Cambie entre Beer y Cola y confirme sus diferencias visuales.
12. Pruebe **Invert drinking direction** si fuera necesario.
13. Bloquee el sensor o espere sin datos: después de cinco segundos debe aparecer el aviso y el modo manual debe continuar funcionando.
14. Abra Diagnostics, copie el diagnóstico y revise nivel, estado, referencias, sonido y versión.

No se usan magnetómetro, orientación absoluta, geolocalización, cámara ni micrófono. La aplicación no recopila ni envía datos.

## Auditoría final 1.0.0

La auditoría de código se completó sin añadir funciones. Las correcciones se limitaron a problemas verificables:

- el panel diagnóstico deja de modificar el DOM con cada evento del sensor cuando está oculto y se limita aproximadamente a 10 actualizaciones por segundo cuando está visible;
- las variables CSS, textos, valores de controles y atributos no se vuelven a escribir cuando su valor no cambió;
- el diagnóstico actualiza inmediatamente el estado `empty`, incluso si el último fotograma cae entre dos intervalos del panel;
- las medidas con `dvh` tienen respaldo con `vh` para navegadores que no entienden unidades dinámicas;
- el mensaje de movimiento se anuncia como estado y el botón Calibrate queda relacionado con su instrucción;
- se retiraron referencias internas y parámetros de error que no se utilizaban.

Se comprobaron sintaxis, estructura HTML, rutas relativas, ausencia de recursos externos y credenciales, recorte del vaso, configuración compartida de Beer/Cola, permiso directo desde click, escenarios `granted`, `denied`, `not-required`, `error` y API ausente, valores inválidos, espera de cinco segundos sin eventos, listener único, calibración con múltiples muestras, normalización, suavizado, `requestAnimationFrame`, `deltaTime`, dirección invertida, inclinación lateral sin consumo, detención al enderezar, vaciado profundo, Refill, copia de diagnóstico, modo manual, mute, suspensión en segundo plano y reducción de movimiento. El conjunto automatizado contiene 136 comprobaciones y no produjo errores sin capturar.

## Lista final de pruebas antes de publicar

### Completadas en la auditoría de código

- [x] `app.js` tiene sintaxis válida y no contiene referencias conocidas sin uso.
- [x] `index.html` no tiene identificadores duplicados y todos los elementos consultados por JavaScript existen.
- [x] `./styles.css` y `./app.js` funcionan como rutas relativas bajo `/tilt-sip/`.
- [x] No se cargan recursos HTTP/HTTPS externos ni existen patrones de claves o secretos.
- [x] El permiso se invoca dentro del click de Enable Motion, antes del primer `await` y sin temporizador.
- [x] El listener se registra después de `granted`, o directamente cuando `requestPermission` no existe, y nunca se duplica.
- [x] API ausente, permiso denegado, valores `null` o no numéricos y ausencia de eventos conservan el modo manual.
- [x] Calibración, normalización, suavizado, límites, `requestAnimationFrame` y consumo con `deltaTime` pasan la simulación.
- [x] Inclinación lateral aislada no consume; enderezar detiene el consumo; una inclinación profunda sostenida vacía gradualmente.
- [x] Beer y Cola usan la misma lógica mediante `DRINKS` y respetan su configuración visual.
- [x] Líquido, espuma y burbujas permanecen recortados dentro del vaso según la estructura y las reglas CSS.
- [x] El audio solo se crea después de Enable Motion; mute y suspensión al ocultar la página pasan la simulación.
- [x] El diagnóstico oculto no recibe escrituras por cada evento y el visible queda limitado aproximadamente a 10 Hz.
- [x] Existen `100vh`/`100dvh`, `safe-area-inset`, bloqueo del desplazamiento y reglas de `prefers-reduced-motion`.

### Pendientes en dispositivos físicos

Estas pruebas no se declaran completadas porque requieren hardware real:

- [ ] **iPhone Safari:** confirmar el cuadro de permiso del sistema, lecturas beta/gamma reales, signo de la inclinación, safe areas con notch/Dynamic Island y audio por altavoz.
- [ ] **iPhone Safari:** confirmar que una inclinación profunda sostenida tarda entre 4 y 7 segundos con la cadencia real del dispositivo y que volver a vertical detiene el consumo.
- [ ] **Android Chrome:** confirmar si el dispositivo informa `not-required` o solicita permiso, lecturas beta/gamma reales, dirección de consumo y audio por altavoz.
- [ ] **Android Chrome:** confirmar safe areas, tamaño en orientación vertical, suspensión al cambiar de aplicación y vaciado en 4–7 segundos con hardware real.
- [ ] En ambos: negar o bloquear el sensor desde los ajustes del navegador, esperar cinco segundos y verificar visualmente que todos los controles manuales siguen disponibles.

La versión `1.0.0` indica que el código pasó la auditoría estática y simulada. No implica que las pruebas físicas anteriores ya se hayan realizado.
