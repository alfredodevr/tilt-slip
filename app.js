"use strict";

const VERSION = "0.1.0";

const DRINKS = Object.freeze({
  beer: Object.freeze({
    name: "Beer",
    initialFill: 82,
    accent: "#ffc54a",
    accentRgb: "255, 197, 74",
    colors: Object.freeze({
      top: "#f8c74f",
      middle: "#dc8b13",
      bottom: "#8c4504",
      glow: "rgba(255, 214, 104, 0.68)",
      bubble: "rgba(255, 248, 212, 0.72)"
    }),
    foam: Object.freeze({
      color: "#fff9e8",
      shadow: "#dbc99f",
      height: 40,
      cells: 14
    }),
    bubbleCount: 24
  }),
  cola: Object.freeze({
    name: "Cola",
    initialFill: 78,
    accent: "#ef7658",
    accentRgb: "239, 118, 88",
    colors: Object.freeze({
      top: "#7c2d20",
      middle: "#35130e",
      bottom: "#090605",
      glow: "rgba(208, 72, 42, 0.55)",
      bubble: "rgba(237, 176, 128, 0.68)"
    }),
    foam: Object.freeze({
      color: "#d9b790",
      shadow: "#9d7653",
      height: 32,
      cells: 11
    }),
    bubbleCount: 34
  })
});

const state = {
  drinkKey: null,
  fill: 0,
  sideTilt: 0,
  mouthTilt: 0,
  diagnosticsOpen: false
};

const elements = {
  app: document.querySelector("#app"),
  chooserScreen: document.querySelector("#chooserScreen"),
  drinkScreen: document.querySelector("#drinkScreen"),
  drinkCards: document.querySelectorAll("[data-drink]"),
  currentDrinkName: document.querySelector("#currentDrinkName"),
  glassWrap: document.querySelector("#glassWrap"),
  liquid: document.querySelector("#liquid"),
  bubbles: document.querySelector("#bubbles"),
  foam: document.querySelector("#foam"),
  fillReadout: document.querySelector("#fillReadout"),
  fillControl: document.querySelector("#fillControl"),
  fillOutput: document.querySelector("#fillOutput"),
  sideTiltControl: document.querySelector("#sideTiltControl"),
  sideTiltOutput: document.querySelector("#sideTiltOutput"),
  mouthTiltControl: document.querySelector("#mouthTiltControl"),
  mouthTiltOutput: document.querySelector("#mouthTiltOutput"),
  backButton: document.querySelector("#backButton"),
  refillButton: document.querySelector("#refillButton"),
  controlsButton: document.querySelector("#controlsButton"),
  diagnosticPanel: document.querySelector("#diagnosticPanel"),
  versionLabel: document.querySelector(".version-label"),
  liveStatus: document.querySelector("#liveStatus")
};

const debugRequested = new URLSearchParams(window.location.search).get("debug") === "1";

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function seededFraction(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function setCssVariable(name, value) {
  elements.app.style.setProperty(name, value);
}

function applyDrinkTheme(drink) {
  setCssVariable("--accent", drink.accent);
  setCssVariable("--accent-rgb", drink.accentRgb);
  setCssVariable("--liquid-top", drink.colors.top);
  setCssVariable("--liquid-middle", drink.colors.middle);
  setCssVariable("--liquid-bottom", drink.colors.bottom);
  setCssVariable("--liquid-glow", drink.colors.glow);
  setCssVariable("--bubble-color", drink.colors.bubble);
  setCssVariable("--foam-color", drink.foam.color);
  setCssVariable("--foam-shadow", drink.foam.shadow);
  setCssVariable("--foam-height", `${drink.foam.height}px`);
}

function createBubbles(count, seedOffset) {
  const fragment = document.createDocumentFragment();
  elements.bubbles.replaceChildren();

  for (let index = 0; index < count; index += 1) {
    const bubble = document.createElement("span");
    const seed = seedOffset + index * 7;
    const size = 3 + seededFraction(seed) * 7;

    bubble.className = "bubble";
    bubble.style.setProperty("--bubble-left", `${8 + seededFraction(seed + 1) * 84}%`);
    bubble.style.setProperty("--bubble-start", `${seededFraction(seed + 2) * 62}%`);
    bubble.style.setProperty("--bubble-size", `${size.toFixed(1)}px`);
    bubble.style.setProperty("--bubble-speed", `${3.5 + seededFraction(seed + 3) * 4.5}s`);
    bubble.style.setProperty("--bubble-delay", `${-seededFraction(seed + 4) * 8}s`);
    bubble.style.setProperty("--bubble-drift", `${-16 + seededFraction(seed + 5) * 32}px`);
    fragment.appendChild(bubble);
  }

  elements.bubbles.appendChild(fragment);
}

function createFoamCells(count, seedOffset) {
  const fragment = document.createDocumentFragment();
  elements.foam.replaceChildren();

  for (let index = 0; index < count; index += 1) {
    const cell = document.createElement("span");
    const seed = seedOffset + index * 5;
    const size = 8 + seededFraction(seed) * 18;

    cell.className = "foam-cell";
    cell.style.setProperty("--foam-x", `${3 + seededFraction(seed + 1) * 90}%`);
    cell.style.setProperty("--foam-y", `${-15 + seededFraction(seed + 2) * 55}%`);
    cell.style.setProperty("--foam-size", `${size.toFixed(1)}px`);
    fragment.appendChild(cell);
  }

  elements.foam.appendChild(fragment);
}

function syncControls() {
  elements.fillControl.value = String(state.fill);
  elements.sideTiltControl.value = String(state.sideTilt);
  elements.mouthTiltControl.value = String(state.mouthTilt);
  elements.fillOutput.value = `${state.fill}%`;
  elements.sideTiltOutput.value = `${state.sideTilt}°`;
  elements.mouthTiltOutput.value = `${state.mouthTilt}°`;
}

function renderLiquid() {
  const visibleLevel = clamp(100 - state.fill - state.mouthTilt * 0.12, -8, 100);
  const surfaceDepth = 0.58 + state.mouthTilt * 0.011;
  const glassPitch = state.mouthTilt * 0.08;

  setCssVariable("--liquid-level", `${visibleLevel.toFixed(2)}%`);
  setCssVariable("--liquid-angle", `${state.sideTilt}deg`);
  setCssVariable("--surface-depth", surfaceDepth.toFixed(2));
  setCssVariable("--glass-pitch", `${glassPitch.toFixed(2)}deg`);

  elements.liquid.classList.toggle("is-empty", state.fill === 0);
  elements.fillReadout.textContent = `${state.fill}%`;
  elements.glassWrap.setAttribute(
    "aria-label",
    `A glass of ${DRINKS[state.drinkKey].name.toLowerCase()}, ${state.fill} percent full`
  );
  syncControls();
}

function setDiagnostics(open) {
  state.diagnosticsOpen = open;
  elements.diagnosticPanel.hidden = !open;
  elements.controlsButton.setAttribute("aria-expanded", String(open));
  elements.drinkScreen.classList.toggle("controls-open", open);
}

function selectDrink(drinkKey) {
  const drink = DRINKS[drinkKey];
  if (!drink) return;

  state.drinkKey = drinkKey;
  state.fill = drink.initialFill;
  state.sideTilt = 0;
  state.mouthTilt = 0;

  elements.app.dataset.drink = drinkKey;
  elements.currentDrinkName.textContent = drink.name;
  applyDrinkTheme(drink);
  createBubbles(drink.bubbleCount, drinkKey === "beer" ? 100 : 300);
  createFoamCells(drink.foam.cells, drinkKey === "beer" ? 500 : 700);
  renderLiquid();
  setDiagnostics(debugRequested);

  elements.chooserScreen.hidden = true;
  elements.drinkScreen.hidden = false;
  elements.backButton.focus({ preventScroll: true });
}

function returnToChooser() {
  setDiagnostics(false);
  elements.drinkScreen.hidden = true;
  elements.chooserScreen.hidden = false;
  state.drinkKey = null;
  elements.drinkCards[0].focus({ preventScroll: true });
}

function refillGlass() {
  state.fill = 100;
  state.sideTilt = 0;
  state.mouthTilt = 0;
  renderLiquid();
  elements.liveStatus.textContent = `${DRINKS[state.drinkKey].name} refilled to 100 percent.`;
}

function readNumber(input) {
  return Number.parseFloat(input.value);
}

function bindEvents() {
  elements.drinkCards.forEach((card) => {
    card.addEventListener("click", () => selectDrink(card.dataset.drink));
  });

  elements.backButton.addEventListener("click", returnToChooser);
  elements.refillButton.addEventListener("click", refillGlass);
  elements.controlsButton.addEventListener("click", () => setDiagnostics(!state.diagnosticsOpen));

  elements.fillControl.addEventListener("input", (event) => {
    state.fill = readNumber(event.currentTarget);
    renderLiquid();
  });

  elements.sideTiltControl.addEventListener("input", (event) => {
    state.sideTilt = readNumber(event.currentTarget);
    renderLiquid();
  });

  elements.mouthTiltControl.addEventListener("input", (event) => {
    state.mouthTilt = readNumber(event.currentTarget);
    renderLiquid();
  });
}

function initialize() {
  elements.versionLabel.textContent = `v${VERSION}`;
  bindEvents();
}

initialize();
