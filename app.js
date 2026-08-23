"use strict";

const VERSION = "1.0.0";
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
      reflection: "rgba(255, 238, 174, 0.24)",
      opacity: 0.9,
      bubble: "rgba(255, 248, 212, 0.72)"
    }),
    foam: Object.freeze({
      color: "#fff9e8",
      shadow: "#dbc99f",
      height: 42,
      cells: 15,
      shrink: 0.14
    }),
    bubbles: Object.freeze({
      count: 18,
      minimumSize: 1.4,
      maximumSize: 4.2,
      minimumSpeed: 4.2,
      maximumSpeed: 7
    })
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
      reflection: "rgba(239, 92, 60, 0.2)",
      opacity: 0.96,
      bubble: "rgba(237, 176, 128, 0.68)"
    }),
    foam: Object.freeze({
      color: "#d9b790",
      shadow: "#9d7653",
      height: 27,
      cells: 10,
      shrink: 0.1
    }),
    bubbles: Object.freeze({
      count: 22,
      minimumSize: 1.8,
      maximumSize: 4.8,
      minimumSpeed: 1.8,
      maximumSpeed: 3.5
    })
  })
});

const state = {
  drinkKey: null,
  level: 0,
  sideTilt: 0,
  mouthTilt: 0,
  diagnosticsOpen: false,
  effectGeneration: 0
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
  lastFrameTime: null,
  lastDiagnosticsFrame: 0
};

const audioState = {
  context: null,
  masterGain: null,
  gasGain: null,
  drinkingGain: null,
  sources: [],
  interacted: false,
  enabled: false,
  muted: false,
  unavailable: false,
  masterTarget: null,
  gasTarget: null,
  drinkingTarget: null
};

const renderCache = {
  cssVariables: new Map()
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
  refillButtons: document.querySelectorAll("[data-refill]"),
  controlsButton: document.querySelector("#controlsButton"),
  enableMotionButton: document.querySelector("#enableMotionButton"),
  soundButton: document.querySelector("#soundButton"),
  soundIcon: document.querySelector("#soundIcon"),
  soundButtonLabel: document.querySelector("#soundButtonLabel"),
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
const prefersReducedMotion = typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  if (renderCache.cssVariables.get(name) === value) return;
  renderCache.cssVariables.set(name, value);
  elements.app.style.setProperty(name, value);
}

function setTextContent(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function setControlValue(element, value) {
  if (element.value !== value) element.value = value;
}

function setAttributeValue(element, name, value) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function currentFrameTime() {
  return window.performance && typeof window.performance.now === "function"
    ? window.performance.now()
    : Date.now();
}

function updateSoundButton() {
  if (audioState.unavailable) {
    elements.soundButton.disabled = true;
    elements.soundButtonLabel.textContent = "No audio";
    elements.soundButton.setAttribute("aria-label", "Audio unavailable");
    return;
  }

  elements.soundButton.disabled = false;
  elements.soundButton.setAttribute("aria-pressed", String(audioState.muted));
  elements.soundButton.setAttribute(
    "aria-label",
    audioState.muted ? "Unmute sound" : "Mute sound"
  );
  elements.soundButtonLabel.textContent = audioState.muted ? "Unmute" : "Mute";
  elements.soundIcon.textContent = audioState.muted ? "×" : "♪";
}

function createNoiseBuffer(context) {
  const sampleRate = context.sampleRate || 44100;
  const buffer = context.createBuffer(1, sampleRate, sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 48271;

  for (let index = 0; index < samples.length; index += 1) {
    seed = seed * 16807 % 2147483647;
    samples[index] = seed / 1073741823.5 - 1;
  }

  return buffer;
}

function createLoopingNoise(context, buffer, type, frequency, gainNode) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();

  source.buffer = buffer;
  source.loop = true;
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = 0.7;
  source.connect(filter);
  filter.connect(gainNode);
  source.start();

  return source;
}

function createAudioEngine() {
  if (audioState.context) return true;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (typeof AudioContextClass !== "function") {
    audioState.unavailable = true;
    updateSoundButton();
    return false;
  }

  let context = null;

  try {
    context = new AudioContextClass();
    const masterGain = context.createGain();
    const gasGain = context.createGain();
    const drinkingGain = context.createGain();
    const noiseBuffer = createNoiseBuffer(context);

    masterGain.gain.value = 0;
    gasGain.gain.value = 0;
    drinkingGain.gain.value = 0;
    gasGain.connect(masterGain);
    drinkingGain.connect(masterGain);
    masterGain.connect(context.destination);

    const gasSource = createLoopingNoise(context, noiseBuffer, "highpass", 2600, gasGain);
    const drinkingSource = createLoopingNoise(context, noiseBuffer, "bandpass", 850, drinkingGain);

    audioState.context = context;
    audioState.masterGain = masterGain;
    audioState.gasGain = gasGain;
    audioState.drinkingGain = drinkingGain;
    audioState.sources = [gasSource, drinkingSource];
    audioState.enabled = true;
    updateSoundButton();
    return true;
  } catch {
    if (context && typeof context.close === "function") {
      void context.close().catch(() => {});
    }
    audioState.unavailable = true;
    updateSoundButton();
    return false;
  }
}

function setAudioGain(gainNode, targetKey, target, duration = 0.08) {
  const context = audioState.context;
  if (!context || !gainNode || Math.abs((audioState[targetKey] ?? -1) - target) < 0.001) {
    return;
  }

  audioState[targetKey] = target;
  const now = context.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(target, now + duration);
}

function audioCanPlay() {
  return Boolean(
    audioState.interacted
    && audioState.enabled
    && !audioState.muted
    && audioState.context
    && audioState.context.state === "running"
    && document.visibilityState !== "hidden"
  );
}

function syncAudioForState() {
  if (!audioState.context) return;

  const audible = audioCanPlay();
  const hasDrink = Boolean(state.drinkKey && state.level > 0);
  const gasStrength = state.drinkKey === "cola" ? 0.018 : 0.014;
  const gasLevel = clamp((state.level - 0.45) / 0.55, 0, 1);
  const gasTarget = audible
    && hasDrink
    && motionState.simulationStatus === "ready"
    && !motionState.isRefilling
    ? gasStrength * (0.55 + gasLevel * 0.45)
    : 0;
  const drinkingTarget = audible
    && hasDrink
    && motionState.simulationStatus === "drinking"
    ? 0.055
    : 0;

  setAudioGain(audioState.masterGain, "masterTarget", audible ? 0.7 : 0, 0.06);
  setAudioGain(audioState.gasGain, "gasTarget", gasTarget, 0.12);
  setAudioGain(audioState.drinkingGain, "drinkingTarget", drinkingTarget, 0.05);
}

function resumeAudioContext() {
  const context = audioState.context;
  if (!context || context.state === "closed") return;

  if (context.state === "running") {
    syncAudioForState();
    return;
  }

  try {
    const resumeResult = context.resume();
    if (resumeResult && typeof resumeResult.then === "function") {
      void resumeResult.then(syncAudioForState).catch(() => {});
    }
  } catch {
    // Sound is optional; motion and manual controls remain available.
  }
}

function enableAudioFromUserGesture() {
  audioState.interacted = true;
  if (!createAudioEngine()) return;
  resumeAudioContext();
}

function playAudioCue(type) {
  if (!audioCanPlay()) return;

  const context = audioState.context;
  const oscillator = context.createOscillator();
  const cueGain = context.createGain();
  const now = context.currentTime;
  const isRefill = type === "refill";

  oscillator.type = isRefill ? "sine" : "triangle";
  oscillator.frequency.setValueAtTime(isRefill ? 280 : 190, now);
  oscillator.frequency.exponentialRampToValueAtTime(isRefill ? 520 : 92, now + 0.18);
  cueGain.gain.setValueAtTime(0.0001, now);
  cueGain.gain.exponentialRampToValueAtTime(isRefill ? 0.055 : 0.045, now + 0.025);
  cueGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  oscillator.connect(cueGain);
  cueGain.connect(audioState.masterGain);
  oscillator.start(now);
  oscillator.stop(now + 0.21);
  oscillator.addEventListener("ended", () => {
    oscillator.disconnect();
    cueGain.disconnect();
  }, { once: true });
}

function toggleMute() {
  audioState.muted = !audioState.muted;
  updateSoundButton();

  if (!audioState.muted && audioState.interacted) {
    resumeAudioContext();
  } else {
    syncAudioForState();
  }

  elements.liveStatus.textContent = audioState.muted ? "Sound muted." : "Sound unmuted.";
}

function handleVisibilityChange() {
  const hidden = document.visibilityState === "hidden";
  elements.app.classList.toggle("is-background", hidden);

  if (hidden && audioState.context) {
    setAudioGain(audioState.masterGain, "masterTarget", 0, 0.01);
    try {
      const suspendResult = audioState.context.suspend();
      if (suspendResult && typeof suspendResult.catch === "function") {
        void suspendResult.catch(() => {});
      }
    } catch {
      // Browsers may already have suspended the context.
    }
    return;
  }

  if (!hidden && audioState.interacted && !audioState.muted) {
    resumeAudioContext();
  }
}

function applyDrinkTheme(drink) {
  setCssVariable("--accent", drink.accent);
  setCssVariable("--accent-rgb", drink.accentRgb);
  setCssVariable("--liquid-top", drink.colors.top);
  setCssVariable("--liquid-middle", drink.colors.middle);
  setCssVariable("--liquid-bottom", drink.colors.bottom);
  setCssVariable("--liquid-glow", drink.colors.glow);
  setCssVariable("--liquid-reflection", drink.colors.reflection);
  setCssVariable("--liquid-opacity", String(drink.colors.opacity));
  setCssVariable("--bubble-color", drink.colors.bubble);
  setCssVariable("--foam-color", drink.foam.color);
  setCssVariable("--foam-shadow", drink.foam.shadow);
  setCssVariable("--foam-height", `${drink.foam.height}px`);
}

function createBubbles(drink, seedOffset) {
  const fragment = document.createDocumentFragment();
  elements.bubbles.replaceChildren();

  for (let index = 0; index < drink.bubbles.count; index += 1) {
    const bubble = document.createElement("span");
    const seed = seedOffset + index * 7;
    const size = drink.bubbles.minimumSize
      + seededFraction(seed) * (drink.bubbles.maximumSize - drink.bubbles.minimumSize);
    const speed = drink.bubbles.minimumSpeed
      + seededFraction(seed + 3)
        * (drink.bubbles.maximumSpeed - drink.bubbles.minimumSpeed);

    bubble.className = "bubble";
    bubble.style.setProperty("--bubble-left", `${8 + seededFraction(seed + 1) * 84}%`);
    bubble.style.setProperty("--bubble-start", `${seededFraction(seed + 2) * 62}%`);
    bubble.style.setProperty("--bubble-size", `${size.toFixed(1)}px`);
    bubble.style.setProperty("--bubble-speed", `${speed.toFixed(2)}s`);
    bubble.style.setProperty("--bubble-delay", `${-seededFraction(seed + 4) * speed}s`);
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
    cell.style.setProperty("--foam-stretch", (0.78 + seededFraction(seed + 3) * 0.55).toFixed(2));
    cell.style.setProperty("--foam-cell-opacity", (0.72 + seededFraction(seed + 4) * 0.28).toFixed(2));
    fragment.appendChild(cell);
  }

  elements.foam.appendChild(fragment);
}

function regenerateDrinkEffects() {
  const drink = DRINKS[state.drinkKey];
  if (!drink) return;

  state.effectGeneration += 1;
  const drinkSeed = state.drinkKey === "beer" ? 100 : 300;
  const generationSeed = state.effectGeneration * 1000;
  createBubbles(drink, drinkSeed + generationSeed);
  createFoamCells(drink.foam.cells, drinkSeed + generationSeed + 400);
}

function syncControls() {
  const fillPercent = Math.round(state.level * 100);
  setControlValue(elements.fillControl, String(fillPercent));
  setControlValue(elements.sideTiltControl, String(state.sideTilt));
  setControlValue(elements.mouthTiltControl, String(state.mouthTilt));
  setControlValue(elements.fillOutput, `${fillPercent}%`);
  setControlValue(elements.sideTiltOutput, `${state.sideTilt}°`);
  setControlValue(elements.mouthTiltOutput, `${state.mouthTilt}°`);
}

function renderLiquid(syncManualControls = true) {
  const usingMotion = motionState.inputMode === "motion" && motionState.calibrated;
  const drink = DRINKS[state.drinkKey];
  const sideTilt = usingMotion
    ? clamp(-motionState.smoothedSide * 18 / MAX_SIDE_DEGREES, -18, 18)
    : state.sideTilt;
  const mouthTilt = usingMotion ? clamp(motionState.smoothedMouth, 0, 60) : state.mouthTilt;
  const fillPercent = Math.round(state.level * 100);
  const visibleLevel = clamp(100 - state.level * 100 - mouthTilt * 0.12, -8, 100);
  const surfaceDepth = 0.58 + mouthTilt * 0.011;
  const glassPitch = mouthTilt * 0.08;
  const foamScale = clamp(1 - (1 - state.level) * drink.foam.shrink, 0.78, 1);
  const foamOpacity = state.level <= 0 ? 0 : clamp(0.64 + state.level * 0.36, 0, 1);

  setCssVariable("--liquid-level", `${visibleLevel.toFixed(2)}%`);
  setCssVariable("--liquid-angle", `${sideTilt.toFixed(2)}deg`);
  setCssVariable("--surface-depth", surfaceDepth.toFixed(2));
  setCssVariable("--glass-pitch", `${glassPitch.toFixed(2)}deg`);
  setCssVariable("--foam-scale", foamScale.toFixed(3));
  setCssVariable("--foam-opacity", foamOpacity.toFixed(3));

  const isEmpty = state.level <= 0;
  if (elements.liquid.classList.contains("is-empty") !== isEmpty) {
    elements.liquid.classList.toggle("is-empty", isEmpty);
  }
  setTextContent(elements.fillReadout, `${fillPercent}%`);
  setTextContent(elements.levelLabel, isEmpty ? "empty" : "full");
  setControlValue(elements.fillControl, String(fillPercent));
  setControlValue(elements.fillOutput, `${fillPercent}%`);
  setAttributeValue(
    elements.glassWrap,
    "aria-label",
    `A glass of ${DRINKS[state.drinkKey].name.toLowerCase()}, ${fillPercent} percent full`
  );

  if (syncManualControls) syncControls();
  syncAudioForState();
}

function setDiagnostics(open) {
  state.diagnosticsOpen = open;
  elements.diagnosticPanel.hidden = !open;
  elements.controlsButton.setAttribute("aria-expanded", String(open));
  elements.drinkScreen.classList.toggle("controls-open", open);

  if (open) {
    renderMotionDiagnostics();
    motionState.lastDiagnosticsFrame = currentFrameTime();
  }
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
  regenerateDrinkEffects();
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
  setSimulationStatus("ready");
  syncAudioForState();

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
  motionState.isRefilling = !prefersReducedMotion && state.level < 1;
  regenerateDrinkEffects();
  setSimulationStatus("ready");

  if (prefersReducedMotion) state.level = 1;
  playAudioCue("refill");

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
  syncAudioForState();
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
  setAudioGain(audioState.drinkingGain, "drinkingTarget", 0, 0.035);
}

function handleEmptyGlass() {
  const wasAlreadyEmpty = motionState.simulationStatus === "empty" && state.level === 0;
  state.level = 0;
  motionState.isRefilling = false;
  setSimulationStatus("empty");
  stopDrinkingSound();
  setMotionMessage("Empty — tap Refill", "warning");

  if (state.diagnosticsOpen) {
    renderMotionDiagnostics();
    motionState.lastDiagnosticsFrame = currentFrameTime();
  }

  if (!wasAlreadyEmpty && state.drinkKey) {
    playAudioCue("empty");
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

  const smoothing = prefersReducedMotion
    ? 1
    : 1 - Math.exp(-SMOOTHING_RESPONSE * deltaTime);
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
  if (state.diagnosticsOpen && timestamp - motionState.lastDiagnosticsFrame >= 100) {
    renderMotionDiagnostics();
    motionState.lastDiagnosticsFrame = timestamp;
  }

  if (
    motionState.isRefilling
    || (
      motionState.inputMode === "motion"
      && motionState.calibrated
      && motionState.simulationStatus !== "empty"
    )
  ) {
    motionState.animationFrameId = window.requestAnimationFrame(animateSimulation);
  } else {
    motionState.lastFrameTime = null;
  }
}

function renderMotionDiagnostics() {
  setTextContent(elements.protocolValue, motionState.protocol);
  setTextContent(elements.apiValue, motionState.apiAvailable ? "available" : "unavailable");
  setTextContent(elements.permissionValue, motionState.permission);
  elements.permissionValue.dataset.status = motionState.permission;
  setTextContent(elements.betaValue, formatAngle(motionState.beta));
  setTextContent(elements.gammaValue, formatAngle(motionState.gamma));
  setTextContent(elements.lastEventValue, formatEventTime(motionState.lastEvent));
  setTextContent(elements.eventCountValue, String(motionState.eventCount));
  setTextContent(elements.betaBaseValue, formatAngle(motionState.betaBase));
  setTextContent(elements.gammaBaseValue, formatAngle(motionState.gammaBase));
  setTextContent(elements.calculatedMouthValue, formatAngle(motionState.calculatedMouth));
  setTextContent(elements.calculatedSideValue, formatAngle(motionState.calculatedSide));
  setTextContent(elements.currentLevelValue, state.level.toFixed(3));
  setTextContent(elements.simulationStateValue, motionState.simulationStatus);
  setAttributeValue(
    elements.enableMotionButton,
    "aria-pressed",
    String(motionState.listenerRegistered)
  );
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

  updateCalculatedAngles();
  const timestamp = currentFrameTime();
  if (state.diagnosticsOpen && timestamp - motionState.lastDiagnosticsFrame >= 100) {
    renderMotionDiagnostics();
    motionState.lastDiagnosticsFrame = timestamp;
  }
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
  const soundStatus = audioState.unavailable
    ? "unavailable"
    : audioState.muted
      ? "muted"
      : audioState.interacted
        ? "on"
        : "not-started";

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
    `Invert drinking direction: ${motionState.invertDirection ? "yes" : "no"}`,
    `Sound: ${soundStatus}`
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
  } catch {
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
  elements.refillButtons.forEach((button) => {
    button.addEventListener("click", refillGlass);
  });
  elements.soundButton.addEventListener("click", toggleMute);
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

  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Permission remains inside this click handler to preserve transient user activation.
  elements.enableMotionButton.addEventListener("click", async () => {
    try {
      const OrientationEvent = window.DeviceOrientationEvent;
      const permissionPromise = (
        typeof OrientationEvent !== "undefined"
        && OrientationEvent !== null
        && !motionState.listenerRegistered
        && typeof OrientationEvent.requestPermission === "function"
      )
        ? OrientationEvent.requestPermission()
        : null;

      // Audio creation and resume stay inside the same direct user gesture.
      enableAudioFromUserGesture();

      if (typeof OrientationEvent === "undefined" || OrientationEvent === null) {
        motionState.apiAvailable = false;
        motionState.permission = "not-required";
        setMotionMessage(
          "Orientation is unavailable on this device or browser. Manual controls remain fully functional.",
          "warning"
        );
        renderMotionDiagnostics();
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
        return;
      }

      if (permissionPromise) {
        const permissionResult = await permissionPromise;

        if (permissionResult !== "granted") {
          motionState.permission = "denied";
          setMotionMessage(
            "Motion permission was denied. You can continue with every manual control or change the site permission and try again.",
            "warning"
          );
          renderMotionDiagnostics();
          return;
        }

        motionState.permission = "granted";
        registerOrientationListener();
        renderMotionDiagnostics();
        return;
      }

      motionState.permission = "not-required";
      registerOrientationListener();
      renderMotionDiagnostics();
    } catch {
      motionState.permission = "error";
      setMotionMessage(
        "Motion could not be enabled. Manual controls remain fully functional; verify HTTPS and the site sensor permission.",
        "error"
      );
      renderMotionDiagnostics();
    }
  });
}

function initialize() {
  motionState.protocol = window.location.protocol === "https:" ? "HTTPS" : "Not HTTPS";
  motionState.apiAvailable = typeof window.DeviceOrientationEvent !== "undefined"
    && window.DeviceOrientationEvent !== null;
  elements.versionLabel.textContent = `v${VERSION}`;
  updateSoundButton();
  renderMotionDiagnostics();
  bindEvents();
}

initialize();
