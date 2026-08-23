"use strict";

const VERSION = "0.3.0";
const SENSOR_TIMEOUT_MS = 5000;
const CALIBRATION_DURATION_MS = 550;
const MIN_CALIBRATION_SAMPLES = 4;
const DRINK_THRESHOLD_DEGREES = 18;
const MAX_MOUTH_DEGREES = 70;
const MAX_SIDE_DEGREES = 55;
const MIN_DRINK_RATE = 0.06;
const MAX_DRINK_RATE = 0.2;
const REFILL_RATE = 1.8;
const SMOOTHING_RESPONSE = 14;

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
  level: 0,
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
  timeoutId: null,
  betaBase: null,
  gammaBase: null,
  calibrated: false,
  calibrationSamples: [],
  calibrationTimerId: null,
  calculatedMouth: 0,
  calculatedSide: 0,
  smoothedMouth: 0,
  smoothedSide: 0,
  invertDirection: false,
  inputMode: "manual",
  simulationStatus: "ready",
  isRefilling: false,
  animationFrameId: null,
  lastFrameTime: null
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
  levelLabel: document.querySelector("#levelLabel"),
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
  calibrationCard: document.querySelector("#calibrationCard"),
  calibrationPrompt: document.querySelector("#calibrationPrompt"),
  calibrateButton: document.querySelector("#calibrateButton"),
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
  betaBaseValue: document.querySelector("#betaBaseValue"),
  gammaBaseValue: document.querySelector("#gammaBaseValue"),
  calculatedMouthValue: document.querySelector("#calculatedMouthValue"),
  calculatedSideValue: document.querySelector("#calculatedSideValue"),
  currentLevelValue: document.querySelector("#currentLevelValue"),
  simulationStateValue: document.querySelector("#simulationStateValue"),
  invertDirectionControl: document.querySelector("#invertDirectionControl"),
  versionLabel: document.querySelector(".version-label"),
  liveStatus: document.querySelector("#liveStatus")
};

const debugRequested = new URLSearchParams(window.location.search).get("debug") === "1";

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeAngleDifference(value, reference) {
  let difference = (value - reference) % 360;
  if (difference > 180) difference -= 360;
  if (difference < -180) difference += 360;
  return difference;
}

function circularMeanDegrees(values) {
  const totals = values.reduce(
    (sum, value) => {
      const radians = value * Math.PI / 180;
      sum.sine += Math.sin(radians);
      sum.cosine += Math.cos(radians);
      return sum;
    },
    { sine: 0, cosine: 0 }
  );

  return Math.atan2(totals.sine, totals.cosine) * 180 / Math.PI;
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
  const fillPercent = Math.round(state.level * 100);
  elements.fillControl.value = String(fillPercent);
  elements.sideTiltControl.value = String(state.sideTilt);
  elements.mouthTiltControl.value = String(state.mouthTilt);
  elements.fillOutput.value = `${fillPercent}%`;
  elements.sideTiltOutput.value = `${state.sideTilt}°`;
  elements.mouthTiltOutput.value = `${state.mouthTilt}°`;
}

function renderLiquid(syncManualControls = true) {
  const usingMotion = motionState.inputMode === "motion" && motionState.calibrated;
  const sideTilt = usingMotion
    ? clamp(-motionState.smoothedSide * 18 / MAX_SIDE_DEGREES, -18, 18)
    : state.sideTilt;
  const mouthTilt = usingMotion ? clamp(motionState.smoothedMouth, 0, 60) : state.mouthTilt;
  const fillPercent = Math.round(state.level * 100);
  const visibleLevel = clamp(100 - state.level * 100 - mouthTilt * 0.12, -8, 100);
  const surfaceDepth = 0.58 + mouthTilt * 0.011;
  const glassPitch = mouthTilt * 0.08;

  setCssVariable("--liquid-level", `${visibleLevel.toFixed(2)}%`);
  setCssVariable("--liquid-angle", `${sideTilt.toFixed(2)}deg`);
  setCssVariable("--surface-depth", surfaceDepth.toFixed(2));
  setCssVariable("--glass-pitch", `${glassPitch.toFixed(2)}deg`);

  elements.liquid.classList.toggle("is-empty", state.level <= 0);
  elements.fillReadout.textContent = `${fillPercent}%`;
  elements.levelLabel.textContent = state.level <= 0 ? "empty" : "full";
  elements.fillControl.value = String(fillPercent);
  elements.fillOutput.value = `${fillPercent}%`;
  elements.glassWrap.setAttribute(
    "aria-label",
    `A glass of ${DRINKS[state.drinkKey].name.toLowerCase()}, ${fillPercent} percent full`
  );

  if (syncManualControls) syncControls();
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
  state.level = drink.initialFill / 100;
  state.sideTilt = 0;
  state.mouthTilt = 0;
  motionState.isRefilling = false;
  setSimulationStatus("ready");

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
  updateCalibrationUi();
  startAnimationLoop();
  elements.backButton.focus({ preventScroll: true });
}

function returnToChooser() {
  setDiagnostics(false);
  elements.drinkScreen.hidden = true;
  elements.chooserScreen.hidden = false;
  state.drinkKey = null;
  motionState.isRefilling = false;
  motionState.lastFrameTime = null;

  if (motionState.animationFrameId !== null) {
    window.cancelAnimationFrame(motionState.animationFrameId);
    motionState.animationFrameId = null;
  }

  if (motionState.calibrationTimerId !== null) {
    window.clearTimeout(motionState.calibrationTimerId);
    motionState.calibrationTimerId = null;
    motionState.calibrationSamples = [];
    setSimulationStatus("ready");
    updateCalibrationUi();
  }

  elements.drinkCards[0].focus({ preventScroll: true });
}

function refillGlass() {
  if (motionState.calibrationTimerId !== null) {
    window.clearTimeout(motionState.calibrationTimerId);
    motionState.calibrationTimerId = null;
    motionState.calibrationSamples = [];
    motionState.calibrated = false;
    motionState.inputMode = "manual";
  }

  state.sideTilt = 0;
  state.mouthTilt = 0;
  motionState.isRefilling = state.level < 1;
  setSimulationStatus("ready");

  if (motionState.isRefilling) {
    setMotionMessage("Refilling…", "success");
  } else {
    state.level = 1;
    setMotionMessage("The glass is full.", "success");
  }

  if (motionState.listenerRegistered && !motionState.calibrated) {
    updateCalibrationUi("Hold your phone upright and tap Calibrate");
  }

  renderLiquid();
  renderMotionDiagnostics();
  startAnimationLoop();
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

function setSimulationStatus(status) {
  motionState.simulationStatus = status;
}

function updateCalibrationUi(message = "") {
  elements.calibrationCard.hidden = !motionState.listenerRegistered;
  if (!motionState.listenerRegistered) return;

  if (motionState.simulationStatus === "calibrating") {
    elements.calibrationPrompt.textContent = message || "Keep your phone upright and still…";
    elements.calibrateButton.textContent = "Calibrating…";
    elements.calibrateButton.disabled = true;
    return;
  }

  elements.calibrationPrompt.textContent = message || (
    motionState.calibrated
      ? "Calibrated. Tilt the top edge toward your mouth."
      : "Hold your phone upright and tap Calibrate"
  );
  elements.calibrateButton.textContent = motionState.calibrated ? "Recalibrate" : "Calibrate";
  elements.calibrateButton.disabled = false;
}

function updateCalculatedAngles() {
  if (
    !motionState.calibrated
    || !Number.isFinite(motionState.beta)
    || !Number.isFinite(motionState.gamma)
  ) {
    motionState.calculatedMouth = 0;
    motionState.calculatedSide = 0;
    return;
  }

  const betaDifference = normalizeAngleDifference(motionState.beta, motionState.betaBase);
  const gammaDifference = normalizeAngleDifference(motionState.gamma, motionState.gammaBase);
  const drinkingDirection = motionState.invertDirection ? 1 : -1;

  motionState.calculatedMouth = clamp(
    betaDifference * drinkingDirection,
    0,
    MAX_MOUTH_DEGREES
  );
  motionState.calculatedSide = clamp(gammaDifference, -MAX_SIDE_DEGREES, MAX_SIDE_DEGREES);
}

function stopDrinkingSound() {
  // Version 0.3.0 has no audio source; this keeps the empty-state stop explicit.
}

function handleEmptyGlass() {
  const wasAlreadyEmpty = motionState.simulationStatus === "empty" && state.level === 0;
  state.level = 0;
  motionState.isRefilling = false;
  setSimulationStatus("empty");
  stopDrinkingSound();
  setMotionMessage("Empty — tap Refill", "warning");

  if (!wasAlreadyEmpty && state.drinkKey) {
    elements.liveStatus.textContent = `${DRINKS[state.drinkKey].name} is empty. Tap Refill.`;
  }
}

function startAnimationLoop() {
  if (!state.drinkKey || motionState.animationFrameId !== null) return;
  motionState.lastFrameTime = null;
  motionState.animationFrameId = window.requestAnimationFrame(animateSimulation);
}

function animateSimulation(timestamp) {
  motionState.animationFrameId = null;

  if (!state.drinkKey) {
    motionState.lastFrameTime = null;
    return;
  }

  const elapsed = motionState.lastFrameTime === null
    ? 1 / 60
    : (timestamp - motionState.lastFrameTime) / 1000;
  const deltaTime = clamp(elapsed, 0, 0.05);
  motionState.lastFrameTime = timestamp;

  updateCalculatedAngles();

  const smoothing = 1 - Math.exp(-SMOOTHING_RESPONSE * deltaTime);
  motionState.smoothedMouth += (
    motionState.calculatedMouth - motionState.smoothedMouth
  ) * smoothing;
  motionState.smoothedSide += (
    motionState.calculatedSide - motionState.smoothedSide
  ) * smoothing;

  if (motionState.isRefilling) {
    state.level = clamp(state.level + REFILL_RATE * deltaTime, 0, 1);

    if (state.level >= 1) {
      state.level = 1;
      motionState.isRefilling = false;
      setSimulationStatus("ready");
      setMotionMessage(
        motionState.calibrated
          ? "Refilled. Tilt the top edge toward your mouth to drink."
          : "Refilled. Manual controls are ready; calibrate motion when available.",
        "success"
      );
      elements.liveStatus.textContent = `${DRINKS[state.drinkKey].name} refilled to 100 percent.`;
    }
  } else if (
    motionState.inputMode === "motion"
    && motionState.calibrated
    && state.level > 0
  ) {
    const isDrinking = motionState.calculatedMouth > DRINK_THRESHOLD_DEGREES;

    if (isDrinking) {
      const intensity = clamp(
        (motionState.calculatedMouth - DRINK_THRESHOLD_DEGREES)
          / (MAX_MOUTH_DEGREES - DRINK_THRESHOLD_DEGREES),
        0,
        1
      );
      const drinkRate = MIN_DRINK_RATE + (MAX_DRINK_RATE - MIN_DRINK_RATE) * intensity;
      state.level = clamp(state.level - drinkRate * deltaTime, 0, 1);

      if (motionState.simulationStatus !== "drinking") {
        setSimulationStatus("drinking");
        setMotionMessage("Drinking… Straighten your phone to stop.", "success");
      }
    } else if (motionState.simulationStatus === "drinking") {
      setSimulationStatus("ready");
      stopDrinkingSound();
      setMotionMessage("Ready. Tilt the top edge toward your mouth to drink.", "success");
    }
  }

  if (
    state.level <= 0
    && motionState.simulationStatus !== "calibrating"
    && motionState.simulationStatus !== "empty"
  ) {
    handleEmptyGlass();
  }

  renderLiquid(false);
  renderMotionDiagnostics();

  if (
    motionState.isRefilling
    || (motionState.inputMode === "motion" && motionState.calibrated)
  ) {
    motionState.animationFrameId = window.requestAnimationFrame(animateSimulation);
  } else {
    motionState.lastFrameTime = null;
  }
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
  elements.betaBaseValue.textContent = formatAngle(motionState.betaBase);
  elements.gammaBaseValue.textContent = formatAngle(motionState.gammaBase);
  elements.calculatedMouthValue.textContent = formatAngle(motionState.calculatedMouth);
  elements.calculatedSideValue.textContent = formatAngle(motionState.calculatedSide);
  elements.currentLevelValue.textContent = state.level.toFixed(3);
  elements.simulationStateValue.textContent = motionState.simulationStatus;
  elements.enableMotionButton.setAttribute("aria-pressed", String(motionState.listenerRegistered));
}

function handleDeviceOrientation(event) {
  if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;

  motionState.beta = event.beta;
  motionState.gamma = event.gamma;
  motionState.lastEvent = new Date();
  motionState.eventCount += 1;

  if (motionState.simulationStatus === "calibrating") {
    motionState.calibrationSamples.push({ beta: event.beta, gamma: event.gamma });
  }

  if (motionState.timeoutId !== null) {
    window.clearTimeout(motionState.timeoutId);
    motionState.timeoutId = null;
  }

  if (motionState.eventCount === 1 && motionState.simulationStatus !== "calibrating") {
    setMotionMessage("Motion data received. Hold your phone upright and tap Calibrate.", "success");
  }

  renderMotionDiagnostics();
}

function finishCalibration() {
  motionState.calibrationTimerId = null;
  const samples = motionState.calibrationSamples;
  motionState.calibrationSamples = [];

  if (samples.length < MIN_CALIBRATION_SAMPLES) {
    motionState.calibrated = false;
    motionState.inputMode = "manual";
    setSimulationStatus(state.level <= 0 ? "empty" : "ready");
    updateCalibrationUi("Not enough sensor readings. Keep the phone upright and try again.");
    if (state.level <= 0) {
      handleEmptyGlass();
    } else {
      setMotionMessage(
        "Calibration needs more valid readings. Manual controls remain fully functional.",
        "warning"
      );
    }
    renderMotionDiagnostics();
    return;
  }

  motionState.betaBase = circularMeanDegrees(samples.map((sample) => sample.beta));
  motionState.gammaBase = circularMeanDegrees(samples.map((sample) => sample.gamma));
  motionState.calibrated = true;
  motionState.inputMode = "motion";
  motionState.calculatedMouth = 0;
  motionState.calculatedSide = 0;
  motionState.smoothedMouth = 0;
  motionState.smoothedSide = 0;
  setSimulationStatus(state.level <= 0 ? "empty" : "ready");
  updateCalibrationUi();

  if (state.level <= 0) {
    handleEmptyGlass();
  } else {
    setMotionMessage("Calibrated. Tilt the top edge toward your mouth to drink.", "success");
    elements.liveStatus.textContent = "Motion calibrated and ready.";
  }

  renderLiquid();
  renderMotionDiagnostics();
  startAnimationLoop();
}

function beginCalibration() {
  if (!motionState.listenerRegistered) {
    setMotionMessage("Enable Motion before calibrating.", "warning");
    return;
  }

  if (motionState.calibrationTimerId !== null) {
    window.clearTimeout(motionState.calibrationTimerId);
  }

  motionState.calibrated = false;
  motionState.calibrationSamples = [];
  motionState.calculatedMouth = 0;
  motionState.calculatedSide = 0;
  motionState.smoothedMouth = 0;
  motionState.smoothedSide = 0;
  setSimulationStatus("calibrating");
  updateCalibrationUi();
  setMotionMessage("Calibrating… Keep your phone upright and still.", "neutral");
  renderMotionDiagnostics();

  motionState.calibrationTimerId = window.setTimeout(
    finishCalibration,
    CALIBRATION_DURATION_MS
  );
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
  updateCalibrationUi("Hold your phone upright and tap Calibrate");
  setMotionMessage("Motion enabled. Hold your phone upright, then tap Calibrate.", "neutral");
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
    `Events received: ${motionState.eventCount}`,
    `Beta base: ${formatAngle(motionState.betaBase)}`,
    `Gamma base: ${formatAngle(motionState.gammaBase)}`,
    `Tilt to mouth: ${formatAngle(motionState.calculatedMouth)}`,
    `Side tilt: ${formatAngle(motionState.calculatedSide)}`,
    `Current level: ${state.level.toFixed(3)}`,
    `State: ${motionState.simulationStatus}`,
    `Invert drinking direction: ${motionState.invertDirection ? "yes" : "no"}`
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

function activateManualMode() {
  motionState.inputMode = "manual";
  motionState.isRefilling = false;

  if (state.level <= 0) {
    handleEmptyGlass();
  } else {
    setSimulationStatus("ready");
    setMotionMessage(
      motionState.calibrated
        ? "Manual controls are active. Tap Recalibrate to return to motion."
        : "Manual controls are active and fully functional.",
      "neutral"
    );
  }

  renderMotionDiagnostics();
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
  elements.calibrateButton.addEventListener("click", beginCalibration);
  elements.invertDirectionControl.addEventListener("change", (event) => {
    motionState.invertDirection = event.currentTarget.checked;
    motionState.calculatedMouth = 0;
    motionState.smoothedMouth = 0;

    if (motionState.calibrated) {
      if (state.level <= 0) {
        handleEmptyGlass();
      } else {
        setSimulationStatus("ready");
        setMotionMessage(
          "Drinking direction inverted. Keep the phone upright or recalibrate if needed.",
          "neutral"
        );
      }
    }

    renderMotionDiagnostics();
  });

  elements.fillControl.addEventListener("input", (event) => {
    state.level = clamp(readNumber(event.currentTarget) / 100, 0, 1);
    activateManualMode();
    renderLiquid();
  });

  elements.sideTiltControl.addEventListener("input", (event) => {
    state.sideTilt = readNumber(event.currentTarget);
    activateManualMode();
    renderLiquid();
  });

  elements.mouthTiltControl.addEventListener("input", (event) => {
    state.mouthTilt = readNumber(event.currentTarget);
    activateManualMode();
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
          motionState.calibrated
            ? "Motion is enabled and calibrated. Tap Recalibrate whenever the upright position changes."
            : "Motion is enabled. Hold your phone upright and tap Calibrate.",
          motionState.eventCount > 0 ? "success" : "warning"
        );
        updateCalibrationUi();
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
