function freezePoints(points) {
  return Object.freeze(points.map((point) => Object.freeze(point)));
}

function freezeBox(box) {
  return Object.freeze(box);
}

export const GLASS_GEOMETRIES = Object.freeze({
  beer: Object.freeze({
    viewBox: "0 0 430 620",
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
    photoHref: "./assets/visual/beer-glass.webp",
    photoBox: freezeBox({ x: 92, y: 24, width: 330, height: 558 }),
    materialBox: freezeBox({ x: 76, y: 48, width: 214, height: 510 }),
    shadow: freezeBox({ cx: 193, cy: 579, rx: 150, ry: 20 }),
    rim: Object.freeze({ cx: 180, cy: 49, rx: 112, ry: 16, innerRx: 101, innerRy: 10 }),
    base: Object.freeze({ cx: 180, cy: 565, rx: 82, ry: 11 }),
    reflections: Object.freeze([
      "M107 98 C101 206 104 410 114 496",
      "M139 82 C134 178 136 306 140 382",
      "M255 108 C261 236 260 385 253 487"
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
    photoHref: "./assets/visual/cola-glass.webp",
    photoBox: freezeBox({ x: 70, y: 28, width: 220, height: 548 }),
    materialBox: freezeBox({ x: 88, y: 48, width: 184, height: 512 }),
    shadow: freezeBox({ cx: 180, cy: 579, rx: 106, ry: 16 }),
    rim: Object.freeze({ cx: 180, cy: 49, rx: 102, ry: 15, innerRx: 92, innerRy: 9 }),
    base: Object.freeze({ cx: 180, cy: 565, rx: 70, ry: 10 }),
    reflections: Object.freeze([
      "M113 98 C108 210 111 411 121 500",
      "M141 79 C137 176 139 312 143 397",
      "M249 112 C254 241 252 392 245 493"
    ])
  })
});

// Local sample slots are intentionally empty until recordings with verified
// performer consent and redistribution rights are supplied.
export const AUDIO_ASSETS = Object.freeze({
  bubble: Object.freeze([]),
  sipping: Object.freeze([]),
  chugging: Object.freeze([]),
  refill: Object.freeze([])
});

export const DRINKS = Object.freeze({
  beer: Object.freeze({
    name: "Beer",
    glassKey: "beer",
    initialFill: 0.82,
    accent: "#d9a441",
    accentRgb: "217, 164, 65",
    colors: Object.freeze({
      top: "#eab342",
      middle: "#a6530b",
      bottom: "#3a1802",
      edge: "#210c01",
      transmitted: "rgba(255, 207, 77, 0.58)",
      highlight: "rgba(255, 230, 145, 0.22)",
      bubble: "rgba(255, 239, 179, 0.68)"
    }),
    foam: Object.freeze({
      color: "#f4ead8",
      shadow: "#a88759",
      wet: "rgba(188, 145, 88, 0.64)",
      highlight: "rgba(255, 253, 245, 0.9)",
      thickness: 25,
      cells: 46,
      cellMin: 0.55,
      cellMax: 6.8
    }),
    bubbles: Object.freeze({
      count: 32,
      minimumSize: 0.42,
      maximumSize: 2.45,
      minimumSpeed: 4.9,
      maximumSpeed: 10.6
    }),
    material: Object.freeze({
      textureHref: "./assets/visual/beer-liquid-material.webp",
      textureOpacity: 0.42,
      textureCount: 22,
      condensationCount: 16
    })
  }),
  cola: Object.freeze({
    name: "Cola",
    glassKey: "cola",
    initialFill: 0.78,
    accent: "#b95f46",
    accentRgb: "185, 95, 70",
    colors: Object.freeze({
      top: "#642113",
      middle: "#1e0906",
      bottom: "#070302",
      edge: "#010101",
      transmitted: "rgba(226, 73, 31, 0.44)",
      highlight: "rgba(238, 107, 62, 0.16)",
      bubble: "rgba(235, 159, 105, 0.66)"
    }),
    foam: Object.freeze({
      color: "#c99e75",
      shadow: "#68432f",
      wet: "rgba(112, 63, 42, 0.74)",
      highlight: "rgba(231, 198, 164, 0.76)",
      thickness: 12,
      cells: 34,
      cellMin: 0.42,
      cellMax: 4.4
    }),
    bubbles: Object.freeze({
      count: 38,
      minimumSize: 0.38,
      maximumSize: 2.7,
      minimumSpeed: 2.25,
      maximumSpeed: 5.4
    }),
    material: Object.freeze({
      textureHref: "./assets/visual/cola-liquid-material.webp",
      textureOpacity: 0.36,
      textureCount: 18,
      condensationCount: 13
    })
  })
});
