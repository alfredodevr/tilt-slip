"use strict";

const VERSION = "0.2.0";
const SENSOR_TIMEOUT_MS = 5000;

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

const motionState = {
  protocol: "Not HTTPS",
  apiAvailable: false,
  permission: "not-requested",
  beta: null,
  gamma: null,
  lastEvent: null,
  eventCount: 0,
  listenerRegistered: false,
  timeoutId: null
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
  enableMotionButton: document.querySelector("#enableMotionButton"),
  motionMessage: document.querySelector("#motionMessage"),
  diagnosticPanel: document.querySelector("#diagnosticPanel"),
  copyDiagnosticsButton: document.querySelector("#copyDiagnosticsButton"),
  protocolValue: document.querySelector("#protocolValue"),
  apiValue: document.querySelector("#apiValue"),
  permissionValue: document.querySelector("#permissionValue"),
  betaValue: document.querySelector("#betaValue"),
  gammaValue: document.querySelector("#gammaValue"),
  lastEventValue: document.querySelector("#lastEventValue"),
  eventCountValue: document.querySelector("#eventCountValue"),
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
  renderMotionDiagnostics();
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

function formatAngle(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}°` : "—";
}

function formatEventTime(date) {
  if (!(date instanceof Date)) return "—";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function setMotionMessage(message, tone = "neutral") {
  elements.motionMessage.textContent = message;
  elements.motionMessage.dataset.tone = tone;
}

function renderMotionDiagnostics() {
  elements.protocolValue.textContent = motionState.protocol;
  elements.apiValue.textContent = motionState.apiAvailable ? "available" : "unavailable";
  elements.permissionValue.textContent = motionState.permission;
  elements.permissionValue.dataset.status = motionState.permission;
  elements.betaValue.textContent = formatAngle(motionState.beta);
  elements.gammaValue.textContent = formatAngle(motionState.gamma);
  elements.lastEventValue.textContent = formatEventTime(motionState.lastEvent);
  elements.eventCountValue.textContent = String(motionState.eventCount);
  elements.enableMotionButton.setAttribute("aria-pressed", String(motionState.listenerRegistered));
}

function handleDeviceOrientation(event) {
  if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;

  motionState.beta = event.beta;
  motionState.gamma = event.gamma;
  motionState.lastEvent = new Date();
  motionState.eventCount += 1;

  if (motionState.timeoutId !== null) {
    window.clearTimeout(motionState.timeoutId);
    motionState.timeoutId = null;
  }

  if (motionState.eventCount === 1) {
    setMotionMessage("Motion data received. Sensor values are diagnostic only.", "success");
  }

  renderMotionDiagnostics();
}

function startSensorTimeout() {
  if (motionState.timeoutId !== null) {
    window.clearTimeout(motionState.timeoutId);
  }

  const startingEventCount = motionState.eventCount;
  motionState.timeoutId = window.setTimeout(() => {
    motionState.timeoutId = null;

    if (motionState.eventCount === startingEventCount) {
      setMotionMessage(
        "No orientation data arrived within 5 seconds. Keep using manual controls and verify HTTPS and device sensor settings.",
        "warning"
      );
    }
  }, SENSOR_TIMEOUT_MS);
}

function registerOrientationListener() {
  if (motionState.listenerRegistered) return;

  window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true });
  motionState.listenerRegistered = true;
  setMotionMessage("Motion enabled. Waiting up to 5 seconds for orientation data…", "neutral");
  startSensorTimeout();
}

function diagnosticsText() {
  return [
    "TiltSip motion diagnostics",
    `Version: ${VERSION}`,
    `Protocol: ${motionState.protocol}`,
    `API: ${motionState.apiAvailable ? "available" : "unavailable"}`,
    `Permission: ${motionState.permission}`,
    `Beta: ${formatAngle(motionState.beta)}`,
    `Gamma: ${formatAngle(motionState.gamma)}`,
    `Last event: ${formatEventTime(motionState.lastEvent)}`,
    `Events received: ${motionState.eventCount}`
  ].join("\n");
}

function fallbackCopy(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  const copied = document.execCommand("copy");
  textArea.remove();

  if (!copied) throw new Error("Copy command was rejected.");
}

async function copyDiagnostics() {
  try {
    const text = diagnosticsText();

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }

    elements.copyDiagnosticsButton.textContent = "Copied";
    elements.liveStatus.textContent = "Motion diagnostics copied.";
  } catch (error) {
    elements.copyDiagnosticsButton.textContent = "Copy failed";
    elements.liveStatus.textContent = "Motion diagnostics could not be copied automatically.";
    setMotionMessage("Copy failed. You can still read every diagnostic value in this panel.", "warning");
  }
}

function bindEvents() {
  elements.drinkCards.forEach((card) => {
    card.addEventListener("click", () => selectDrink(card.dataset.drink));
  });

  elements.backButton.addEventListener("click", returnToChooser);
  elements.refillButton.addEventListener("click", refillGlass);
  elements.controlsButton.addEventListener("click", () => setDiagnostics(!state.diagnosticsOpen));
  elements.copyDiagnosticsButton.addEventListener("click", () => {
    void copyDiagnostics();
  });

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

  // Permission remains inside this click handler to preserve transient user activation.
  elements.enableMotionButton.addEventListener("click", async () => {
    try {
      const OrientationEvent = window.DeviceOrientationEvent;

      if (typeof OrientationEvent === "undefined") {
        motionState.apiAvailable = false;
        motionState.permission = "not-required";
        setMotionMessage(
          "Orientation is unavailable on this device or browser. Manual controls remain fully functional.",
          "warning"
        );
        renderMotionDiagnostics();
        setDiagnostics(true);
        return;
      }

      motionState.apiAvailable = true;

      if (motionState.listenerRegistered) {
        setMotionMessage(
          motionState.eventCount > 0
            ? "Motion is already enabled. Sensor values are diagnostic only."
            : "Motion is enabled but no valid data has arrived yet. Manual controls remain available.",
          motionState.eventCount > 0 ? "success" : "warning"
        );
        renderMotionDiagnostics();
        setDiagnostics(true);
        return;
      }

      if (typeof OrientationEvent.requestPermission === "function") {
        const permissionResult = await OrientationEvent.requestPermission();

        if (permissionResult !== "granted") {
          motionState.permission = "denied";
          setMotionMessage(
            "Motion permission was denied. You can continue with every manual control or change the site permission and try again.",
            "warning"
          );
          renderMotionDiagnostics();
          setDiagnostics(true);
          return;
        }

        motionState.permission = "granted";
        registerOrientationListener();
        renderMotionDiagnostics();
        setDiagnostics(true);
        return;
      }

      motionState.permission = "not-required";
      registerOrientationListener();
      renderMotionDiagnostics();
      setDiagnostics(true);
    } catch (error) {
      motionState.permission = "error";
      setMotionMessage(
        "Motion could not be enabled. Manual controls remain fully functional; verify HTTPS and the site sensor permission.",
        "error"
      );
      renderMotionDiagnostics();
      setDiagnostics(true);
    }
  });
}

function initialize() {
  motionState.protocol = window.location.protocol === "https:" ? "HTTPS" : "Not HTTPS";
  motionState.apiAvailable = typeof window.DeviceOrientationEvent !== "undefined";
  elements.versionLabel.textContent = `v${VERSION}`;
  renderMotionDiagnostics();
  bindEvents();
}

initialize();
