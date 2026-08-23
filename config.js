function freezePoints(points) {
  return Object.freeze(points.map((point) => Object.freeze(point)));
}

export const GLASS_GEOMETRIES = Object.freeze({
  beer: Object.freeze({
    viewBox: "0 0 380 620",
    cavity: freezePoints([
      { x: 86, y: 58 },
      { x: 274, y: 58 },
      { x: 271, y: 435 },
      { x: 264, y: 510 },
      { x: 255, y: 548 },
      { x: 105, y: 548 },
      { x: 96, y: 510 },
      { x: 89, y: 435 }
    ]),
    rimLeft: Object.freeze({ x: 86, y: 58 }),
    rimRight: Object.freeze({ x: 274, y: 58 }),
    outerPath: "M68 43 C88 35 272 35 292 43 L284 448 C282 510 274 550 260 568 C225 575 135 575 100 568 C86 550 78 510 76 448 Z",
    wallOverlayPath: "M76 48 C99 57 261 57 284 48 L277 444 C274 507 267 539 255 557 C220 563 140 563 105 557 C93 539 86 507 83 444 Z",
    handlePath: "M286 150 C347 145 357 180 355 264 C353 361 331 427 278 435",
    rim: Object.freeze({ cx: 180, cy: 49, rx: 112, ry: 16, innerRx: 101, innerRy: 10 }),
    base: Object.freeze({ cx: 180, cy: 565, rx: 82, ry: 11 }),
    reflections: Object.freeze([
      "M105 92 C99 205 102 416 113 507",
      "M134 76 C128 176 130 314 134 390",
      "M257 102 C265 245 263 390 254 510"
    ])
  }),
  cola: Object.freeze({
    viewBox: "0 0 380 620",
    cavity: freezePoints([
      { x: 96, y: 58 },
      { x: 264, y: 58 },
      { x: 258, y: 410 },
      { x: 247, y: 550 },
      { x: 113, y: 550 },
      { x: 102, y: 410 }
    ]),
    rimLeft: Object.freeze({ x: 96, y: 58 }),
    rimRight: Object.freeze({ x: 264, y: 58 }),
    outerPath: "M79 44 C101 35 259 35 281 44 L271 414 C267 484 259 539 249 568 C217 575 143 575 111 568 C101 539 93 484 89 414 Z",
    wallOverlayPath: "M88 49 C108 57 252 57 272 49 L264 410 C260 482 253 529 244 557 C214 563 146 563 116 557 C107 529 100 482 96 410 Z",
    handlePath: "",
    rim: Object.freeze({ cx: 180, cy: 49, rx: 102, ry: 15, innerRx: 92, innerRy: 9 }),
    base: Object.freeze({ cx: 180, cy: 565, rx: 70, ry: 10 }),
    reflections: Object.freeze([
      "M112 91 C107 205 110 414 120 510",
      "M139 74 C135 170 137 318 141 405",
      "M251 108 C256 240 254 395 246 502"
    ])
  })
});

export const DRINKS = Object.freeze({
  beer: Object.freeze({
    name: "Beer",
    glassKey: "beer",
    initialFill: 0.82,
    accent: "#d9a441",
    accentRgb: "217, 164, 65",
    colors: Object.freeze({
      top: "#f1cc62",
      middle: "#b96b12",
      bottom: "#4f2604",
      edge: "#2d1402",
      transmitted: "rgba(255, 218, 116, 0.52)",
      highlight: "rgba(255, 235, 167, 0.32)",
      bubble: "rgba(255, 244, 204, 0.76)"
    }),
    foam: Object.freeze({
      color: "#f7f0df",
      shadow: "#b89f73",
      wet: "rgba(219, 190, 139, 0.68)",
      highlight: "rgba(255, 253, 245, 0.92)",
      thickness: 22,
      cells: 34,
      cellMin: 0.9,
      cellMax: 7.1
    }),
    bubbles: Object.freeze({
      count: 26,
      minimumSize: 0.65,
      maximumSize: 2.7,
      minimumSpeed: 4.6,
      maximumSpeed: 9.4
    }),
    material: Object.freeze({
      textureCount: 30,
      condensationCount: 13
    }),
    audio: Object.freeze({
      ambientMinimumMs: 3800,
      ambientMaximumMs: 7200,
      bubblePitch: 470,
      spillPitch: 185,
      spillVolume: 0.038
    })
  }),
  cola: Object.freeze({
    name: "Cola",
    glassKey: "cola",
    initialFill: 0.78,
    accent: "#b95f46",
    accentRgb: "185, 95, 70",
    colors: Object.freeze({
      top: "#6b271a",
      middle: "#27100b",
      bottom: "#0b0604",
      edge: "#030202",
      transmitted: "rgba(218, 74, 40, 0.4)",
      highlight: "rgba(241, 112, 72, 0.2)",
      bubble: "rgba(236, 166, 120, 0.68)"
    }),
    foam: Object.freeze({
      color: "#d1aa82",
      shadow: "#77513a",
      wet: "rgba(133, 82, 55, 0.72)",
      highlight: "rgba(233, 204, 175, 0.78)",
      thickness: 10,
      cells: 24,
      cellMin: 0.8,
      cellMax: 4.8
    }),
    bubbles: Object.freeze({
      count: 30,
      minimumSize: 0.7,
      maximumSize: 3.2,
      minimumSpeed: 2.2,
      maximumSpeed: 5.1
    }),
    material: Object.freeze({
      textureCount: 26,
      condensationCount: 10
    }),
    audio: Object.freeze({
      ambientMinimumMs: 2600,
      ambientMaximumMs: 5200,
      bubblePitch: 630,
      spillPitch: 155,
      spillVolume: 0.034
    })
  })
});
