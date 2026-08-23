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
      top: "#e7b54a",
      middle: "#b96813",
      bottom: "#613006",
      edge: "#432004",
      transmitted: "rgba(255, 202, 89, 0.42)",
      highlight: "rgba(255, 230, 157, 0.24)",
      bubble: "rgba(255, 239, 187, 0.7)"
    }),
    foam: Object.freeze({
      color: "#f4ead5",
      shadow: "#cbb994",
      thickness: 11,
      cells: 13,
      cellMin: 2.2,
      cellMax: 6.4
    }),
    bubbles: Object.freeze({
      count: 14,
      minimumSize: 1.1,
      maximumSize: 2.9,
      minimumSpeed: 4.8,
      maximumSpeed: 8.2
    }),
    audio: Object.freeze({
      ambientMinimumMs: 5200,
      ambientMaximumMs: 9600,
      bubblePitch: 520,
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
      top: "#5d2118",
      middle: "#24100c",
      bottom: "#090605",
      edge: "#050303",
      transmitted: "rgba(190, 63, 37, 0.36)",
      highlight: "rgba(235, 99, 64, 0.16)",
      bubble: "rgba(226, 150, 107, 0.62)"
    }),
    foam: Object.freeze({
      color: "#c9a17b",
      shadow: "#8c6548",
      thickness: 6.5,
      cells: 9,
      cellMin: 1.8,
      cellMax: 4.5
    }),
    bubbles: Object.freeze({
      count: 18,
      minimumSize: 1.3,
      maximumSize: 3.4,
      minimumSpeed: 2.4,
      maximumSpeed: 4.7
    }),
    audio: Object.freeze({
      ambientMinimumMs: 3800,
      ambientMaximumMs: 7200,
      bubblePitch: 610,
      spillPitch: 155,
      spillVolume: 0.034
    })
  })
});
