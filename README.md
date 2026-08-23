# TiltSip — fase visual 0.1.0

TiltSip es una experiencia web móvil original que simula un vaso con líquido. Esta primera fase implementa únicamente la base visual y controles manuales; todavía no utiliza los sensores de orientación del teléfono.

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

### Opción rápida

Abra `index.html` directamente con un navegador moderno. La selección de bebida y los controles manuales funcionan sin conexión.

### Opción recomendada: servidor local

Desde la carpeta `tilt-sip`, ejecute uno de estos comandos:

```bash
python -m http.server 8000
```

En Windows, si `python` no funciona, pruebe:

```bash
py -m http.server 8000
```

Después visite `http://localhost:8000` en el navegador.

## Qué está implementado

- Pantalla inicial con selección entre Beer y Cola.
- Vaso responsive, creado con HTML y CSS y optimizado para orientación vertical.
- Líquidos visualmente distintos, con espuma y burbujas configurables.
- Recorte estricto del líquido y la espuma dentro del vaso.
- Botones para volver a la selección y recargar el vaso.
- Panel de controles manuales para nivel, inclinación lateral e inclinación hacia la boca.
- Reinicio del nivel y de las inclinaciones al cambiar de bebida.
- Objeto central `DRINKS` con colores, espuma y cantidad de burbujas de cada bebida.
- Altura basada en `100dvh`, áreas seguras de iPhone y bloqueo del desplazamiento accidental.
- Modo diagnóstico con versión `0.1.0`.

## Modo diagnóstico

Seleccione una bebida y pulse **Manual controls**. También puede abrir la página con `?debug=1` para mostrar el panel automáticamente, por ejemplo:

```text
http://localhost:8000/?debug=1
```

## Controles de esta fase

- **Fill level:** cambia el porcentaje visible entre 0 % y 100 %.
- **Side tilt:** inclina la superficie del líquido entre −18° y 18°.
- **Tilt to mouth:** eleva y profundiza visualmente la superficie para simular el giro del vaso hacia la boca.
- **Refill:** lleva el vaso a 100 % y devuelve ambas inclinaciones a 0°.

## Compatibilidad prevista

- Safari en iPhone.
- Chrome en Android.
- Navegadores modernos de escritorio.

Las rutas `./styles.css` y `./app.js` son relativas para que el proyecto funcione al publicarse bajo una ruta como `/tilt-sip/` en GitHub Pages.

## Fuera del alcance de la fase 1

No se ha implementado acceso a sensores, audio ni vaciado automático. Esas capacidades pertenecen a fases posteriores.
