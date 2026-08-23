"use strict";

import { DRINKS, GLASS_GEOMETRIES } from "./config.js";
import {
  capacityAtAngle,
  clamp,
  foamBandPolygon,
  gravityFromAngle,
  polygonToPath,
  stepSpill,
  surfaceSegment,
  thresholdForAreaFraction
} from "./physics.js";

const APP_VERSION = "2.0.0";
const SENSOR_TIMEOUT_MS = 5000;
const CALIBRATION_DURATION_MS = 550;
const MIN_CALIBRATION_SAMPLES = 4;
const MAX_SIDE_DEGREES = 90;
const SMOOTHING_RESPONSE = 16;
const REFILL_RATE = 1.35;
const DIAGNOSTIC_INTERVAL_MS = 100;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const simulationState = {
  drinkKey: null,
  fillLevel: 0,
  capacityFraction: 1,
  overflowAmount: 0,
  flowRate: 0,
  lowerLip: "level",
  physicsStatus: "ready",
  isRefilling: false,
  diagnosticsOpen: false,
  effectGeneration: 0,
  animationFrameId: null,
  lastFrameTime: null,
  lastDiagnosticsFrame: 0
};

const sensorState = {
  protocol: "Not HTTPS",
  apiAvailable: false,
  permission: "not-requested",
  beta: null,
  gamma: null,
  gammaBase: null,
  rawSideTilt: 0,
  filteredSideTilt: 0,
  clampedSideTilt: 0,
  lastEvent: null,
  eventCount: 0,
  listenerRegistered: false,
  timeoutId: null,
  calibrated: false,
  calibrating: false,
  calibrationSamples: [],
  calibrationTimerId: null,
  inputMode: "manual"
};

const audioState = {
  context: null,
  masterGain: null,
  noiseBuffer: null,
  activeSources: new Set(),
  ambientTimerId: null,
  nextSpillEventAt: 0,
  eventSequence: 0,
  interacted: false,
  muted: false,
  unavailable: false
};

const renderCache = {
  cssVariables: new Map(),
  geometryKey: "",
  glassKey: ""
};

const elements = {
  app: document.querySelector("#app"),
  chooserScreen: document.querySelector("#chooserScreen"),
  drinkScreen: document.querySelector("#drinkScreen"),
  drinkCards: document.querySelectorAll("[data-drink]"),
  currentDrinkName: document.querySelector("#currentDrinkName"),
  glassWrap: document.querySelector("#glassWrap"),
  glassSvg: document.querySelector("#glassSvg"),
  glassHandleGroup: document.querySelector("#glassHandleGroup"),
  glassHandleOuter: document.querySelector("#glassHandleOuter"),
  glassHandleInner: document.querySelector("#glassHandleInner"),
  glassOuterPath: document.querySelector("#glassOuterPath"),
  glassWallOverlay: document.querySelector("#glassWallOverlay"),
  cavityClipPath: document.querySelector("#cavityClipPath"),
  cavityOutline: document.querySelector("#cavityOutline"),
  liquidShape: document.querySelector("#liquidShape"),
  liquidLight: document.querySelector("#liquidLight"),
  liquidClipPath: document.querySelector("#liquidClipPath"),
  foamShape: document.querySelector("#foamShape"),
  foamCells: document.querySelector("#foamCells"),
  meniscusPath: document.querySelector("#meniscusPath"),
  bubbles: document.querySelector("#bubbles"),
  glassReflectionPrimary: document.querySelector("#glassReflectionPrimary"),
  glassReflectionSecondary: document.querySelector("#glassReflectionSecondary"),
  glassReflectionEdge: document.querySelector("#glassReflectionEdge"),
  glassRimOuter: document.querySelector("#glassRimOuter"),
  glassRimInner: document.querySelector("#glassRimInner"),
  glassBase: document.querySelector("#glassBase"),
  fillReadout: document.querySelector("#fillReadout"),
  levelLabel: document.querySelector("#levelLabel"),
  fillControl: document.querySelector("#fillControl"),
  fillOutput: document.querySelector("#fillOutput"),
  sideTiltControl: document.querySelector("#sideTiltControl"),
  sideTiltOutput: document.querySelector("#sideTiltOutput"),
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
  gammaBaseValue: document.querySelector("#gammaBaseValue"),
  lastEventValue: document.querySelector("#lastEventValue"),
  eventCountValue: document.querySelector("#eventCountValue"),
  sideTiltRawValue: document.querySelector("#sideTiltRawValue"),
  sideTiltFilteredValue: document.querySelector("#sideTiltFilteredValue"),
  sideTiltClampedValue: document.querySelector("#sideTiltClampedValue"),
  currentFillValue: document.querySelector("#currentFillValue"),
  capacityValue: document.querySelector("#capacityValue"),
  overflowValue: document.querySelector("#overflowValue"),
  flowRateValue: document.querySelector("#flowRateValue"),
  lowerLipValue: document.querySelector("#lowerLipValue"),
  physicsStateValue: document.querySelector("#physicsStateValue"),
  audioStateValue: document.querySelector("#audioStateValue"),
  appVersionValue: document.querySelector("#appVersionValue"),
  versionLabel: document.querySelector(".version-label"),
  liveStatus: document.querySelector("#liveStatus")
};

const debugRequested = new URLSearchParams(window.location.search).get("debug") === "1";
const prefersReducedMotion = typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

function currentFrameTime() {
  return window.performance && typeof window.performance.now === "function"
    ? window.performance.now()
    : Date.now();
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

function setCssVariable(name, value) {
  if (renderCache.cssVariables.get(name) === value) return;
  renderCache.cssVariables.set(name, value);
  elements.app.style.setProperty(name, value);
}

function createSvgElement(tagName) {
  return document.createElementNS(SVG_NAMESPACE, tagName);
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
  setTextContent(elements.motionMessage, message);
  elements.motionMessage.dataset.tone = tone;
}

function currentDrink() {
  return DRINKS[simulationState.drinkKey] || null;
}

function currentGeometry() {
  const drink = currentDrink();
  return drink ? GLASS_GEOMETRIES[drink.glassKey] : null;
}

// Glass configuration and SVG rendering
function applyDrinkTheme(drink) {
  setCssVariable("--accent", drink.accent);
  setCssVariable("--accent-rgb", drink.accentRgb);
  setCssVariable("--liquid-top", drink.colors.top);
  setCssVariable("--liquid-middle", drink.colors.middle);
  setCssVariable("--liquid-bottom", drink.colors.bottom);
  setCssVariable("--liquid-edge", drink.colors.edge);
  setCssVariable("--liquid-transmitted", drink.colors.transmitted);
  setCssVariable("--liquid-highlight", drink.colors.highlight);
  setCssVariable("--foam-color", drink.foam.color);
  setCssVariable("--foam-shadow", drink.foam.shadow);
  setCssVariable("--bubble-color", drink.colors.bubble);
}

function setEllipseGeometry(element, ellipse) {
  setAttributeValue(element, "cx", String(ellipse.cx));
  setAttributeValue(element, "cy", String(ellipse.cy));
  setAttributeValue(element, "rx", String(ellipse.rx));
  setAttributeValue(element, "ry", String(ellipse.ry));
}

function applyGlassGeometry(drink, geometry) {
  if (renderCache.glassKey === drink.glassKey) return;
  renderCache.glassKey = drink.glassKey;
  renderCache.geometryKey = "";

  const cavityPath = polygonToPath(geometry.cavity);
  setAttributeValue(elements.glassSvg, "viewBox", geometry.viewBox);
  setAttributeValue(elements.cavityClipPath, "d", cavityPath);
  setAttributeValue(elements.cavityOutline, "d", cavityPath);
  setAttributeValue(elements.glassOuterPath, "d", geometry.outerPath);
  setAttributeValue(elements.glassWallOverlay, "d", geometry.wallOverlayPath);

  elements.glassHandleGroup.hidden = !geometry.handlePath;
  setAttributeValue(elements.glassHandleOuter, "d", geometry.handlePath);
  setAttributeValue(elements.glassHandleInner, "d", geometry.handlePath);

  setEllipseGeometry(elements.glassRimOuter, geometry.rim);
  setEllipseGeometry(elements.glassRimInner, {
    cx: geometry.rim.cx,
    cy: geometry.rim.cy + 1,
    rx: geometry.rim.innerRx,
    ry: geometry.rim.innerRy
  });
  setEllipseGeometry(elements.glassBase, geometry.base);

  const reflectionElements = [
    elements.glassReflectionPrimary,
    elements.glassReflectionSecondary,
    elements.glassReflectionEdge
  ];
  reflectionElements.forEach((element, index) => {
    setAttributeValue(element, "d", geometry.reflections[index] || "");
  });
}

function createBubbles(drink, geometry, seedOffset) {
  const fragment = document.createDocumentFragment();
  elements.bubbles.replaceChildren();

  const minimumX = Math.min(...geometry.cavity.map((point) => point.x));
  const maximumX = Math.max(...geometry.cavity.map((point) => point.x));
  const maximumY = Math.max(...geometry.cavity.map((point) => point.y));

  for (let index = 0; index < drink.bubbles.count; index += 1) {
    const bubble = createSvgElement("circle");
    const seed = seedOffset + index * 11;
    const radius = drink.bubbles.minimumSize
      + seededFraction(seed) * (drink.bubbles.maximumSize - drink.bubbles.minimumSize);
    const speed = drink.bubbles.minimumSpeed
      + seededFraction(seed + 3)
        * (drink.bubbles.maximumSpeed - drink.bubbles.minimumSpeed);

    bubble.classList.add("bubble");
    bubble.setAttribute("cx", (minimumX + 18 + seededFraction(seed + 1) * (maximumX - minimumX - 36)).toFixed(2));
    bubble.setAttribute("cy", (maximumY - 22 - seededFraction(seed + 2) * 300).toFixed(2));
    bubble.setAttribute("r", radius.toFixed(2));
    bubble.style.setProperty("--bubble-speed", `${speed.toFixed(2)}s`);
    bubble.style.setProperty("--bubble-delay", `${(-seededFraction(seed + 4) * speed).toFixed(2)}s`);
    bubble.style.setProperty("--bubble-drift", `${(-9 + seededFraction(seed + 5) * 18).toFixed(2)}px`);
    fragment.appendChild(bubble);
  }

  elements.bubbles.appendChild(fragment);
}

function createFoamCells(drink, seedOffset) {
  const fragment = document.createDocumentFragment();
  elements.foamCells.replaceChildren();

  for (let index = 0; index < drink.foam.cells; index += 1) {
    const cell = createSvgElement("circle");
    const seed = seedOffset + index * 7;
    const radius = drink.foam.cellMin
      + seededFraction(seed) * (drink.foam.cellMax - drink.foam.cellMin);

    cell.classList.add("foam-cell");
    cell.dataset.position = (0.04 + seededFraction(seed + 1) * 0.92).toFixed(4);
    cell.dataset.depth = (0.18 + seededFraction(seed + 2) * 0.66).toFixed(4);
    cell.setAttribute("r", radius.toFixed(2));
    cell.style.setProperty("--foam-cell-opacity", (0.55 + seededFraction(seed + 3) * 0.38).toFixed(2));
    fragment.appendChild(cell);
  }

  elements.foamCells.appendChild(fragment);
}

function regenerateDrinkEffects() {
  const drink = currentDrink();
  const geometry = currentGeometry();
  if (!drink || !geometry) return;

  simulationState.effectGeneration += 1;
  const drinkSeed = simulationState.drinkKey === "beer" ? 170 : 410;
  const generationSeed = simulationState.effectGeneration * 1000;
  createBubbles(drink, geometry, drinkSeed + generationSeed);
  createFoamCells(drink, drinkSeed + generationSeed + 500);
}

function positionFoamCells(segment, gravity, thickness) {
  const cells = elements.foamCells.children;
  if (!segment) {
    elements.foamCells.setAttribute("visibility", "hidden");
    return;
  }

  elements.foamCells.removeAttribute("visibility");
  const deltaX = segment.end.x - segment.start.x;
  const deltaY = segment.end.y - segment.start.y;

  Array.from(cells).forEach((cell) => {
    const position = Number.parseFloat(cell.dataset.position);
    const depth = Number.parseFloat(cell.dataset.depth) * thickness;
    const centerX = segment.start.x + deltaX * position + gravity.x * depth;
    const centerY = segment.start.y + deltaY * position + gravity.y * depth;
    setAttributeValue(cell, "cx", centerX.toFixed(2));
    setAttributeValue(cell, "cy", centerY.toFixed(2));
  });
}

function updateCapacityForCurrentAngle() {
  const geometry = currentGeometry();
  if (!geometry) return null;

  const capacity = capacityAtAngle(
    geometry.cavity,
    geometry.rimLeft,
    geometry.rimRight,
    sensorState.clampedSideTilt
  );
  simulationState.capacityFraction = capacity.capacityFraction;
  simulationState.lowerLip = capacity.lowerLip;
  simulationState.overflowAmount = Math.max(
    0,
    simulationState.fillLevel - capacity.capacityFraction
  );
  return capacity;
}

function renderLiquidGeometry(force = false) {
  const drink = currentDrink();
  const geometry = currentGeometry();
  if (!drink || !geometry) return;

  const angle = sensorState.clampedSideTilt;
  const geometryKey = [
    simulationState.drinkKey,
    simulationState.fillLevel.toFixed(5),
    angle.toFixed(3),
    simulationState.effectGeneration
  ].join("|");
  if (!force && geometryKey === renderCache.geometryKey) return;
  renderCache.geometryKey = geometryKey;

  const gravity = gravityFromAngle(angle);
  const liquid = thresholdForAreaFraction(
    geometry.cavity,
    gravity,
    simulationState.fillLevel
  );
  const liquidPath = polygonToPath(liquid.polygon);
  const foamThickness = drink.foam.thickness * (0.72 + simulationState.fillLevel * 0.28);
  const foamPolygon = simulationState.fillLevel > 0.001
    ? foamBandPolygon(geometry.cavity, gravity, liquid.threshold, foamThickness)
    : [];
  const segment = simulationState.fillLevel > 0.001
    ? surfaceSegment(geometry.cavity, gravity, liquid.threshold)
    : null;

  setAttributeValue(elements.liquidShape, "d", liquidPath);
  setAttributeValue(elements.liquidLight, "d", liquidPath);
  setAttributeValue(elements.liquidClipPath, "d", liquidPath);
  setAttributeValue(elements.foamShape, "d", polygonToPath(foamPolygon));
  setAttributeValue(
    elements.meniscusPath,
    "d",
    segment
      ? `M${segment.start.x.toFixed(2)} ${segment.start.y.toFixed(2)} L${segment.end.x.toFixed(2)} ${segment.end.y.toFixed(2)}`
      : ""
  );
  positionFoamCells(segment, gravity, foamThickness);

  setCssVariable("--bubble-rise-x", `${(-gravity.x * 410).toFixed(2)}px`);
  setCssVariable("--bubble-rise-y", `${(-gravity.y * 410).toFixed(2)}px`);
}

function syncControls() {
  const fillPercent = Math.round(simulationState.fillLevel * 100);
  const manualAngle = Math.round(sensorState.clampedSideTilt);
  setControlValue(elements.fillControl, String(fillPercent));
  setControlValue(elements.sideTiltControl, String(manualAngle));
  setControlValue(elements.fillOutput, `${fillPercent}%`);
  setControlValue(elements.sideTiltOutput, `${manualAngle}°`);
}

function renderInterface(syncManualControls = true) {
  const drink = currentDrink();
  if (!drink) return;

  const fillPercent = Math.round(simulationState.fillLevel * 100);
  let levelLabel = "remaining";
  if (simulationState.physicsStatus === "empty") levelLabel = "empty";
  if (simulationState.physicsStatus === "spilling") levelLabel = "spilling";
  if (simulationState.physicsStatus === "refilling") levelLabel = "refilling";

  setTextContent(elements.fillReadout, `${fillPercent}%`);
  setTextContent(elements.levelLabel, levelLabel);
  setControlValue(elements.fillControl, String(fillPercent));
  setControlValue(elements.fillOutput, `${fillPercent}%`);
  setAttributeValue(
    elements.glassWrap,
    "aria-label",
    `A glass of ${drink.name.toLowerCase()}, ${fillPercent} percent full`
  );
  elements.app.dataset.physicsState = simulationState.physicsStatus;

  if (syncManualControls) syncControls();
}

// Event-based Web Audio
function updateSoundButton() {
  if (audioState.unavailable) {
    elements.soundButton.disabled = true;
    setTextContent(elements.soundButtonLabel, "No audio");
    setAttributeValue(elements.soundButton, "aria-label", "Audio unavailable");
    return;
  }

  elements.soundButton.disabled = false;
  setAttributeValue(elements.soundButton, "aria-pressed", String(audioState.muted));
  setAttributeValue(
    elements.soundButton,
    "aria-label",
    audioState.muted ? "Unmute sound" : "Mute sound"
  );
  setTextContent(elements.soundButtonLabel, audioState.muted ? "Unmute" : "Mute");
  setTextContent(elements.soundIcon, audioState.muted ? "×" : "♪");
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
    masterGain.gain.value = 0;
    masterGain.connect(context.destination);

    audioState.context = context;
    audioState.masterGain = masterGain;
    audioState.noiseBuffer = createNoiseBuffer(context);
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

function audioCanPlay() {
  return Boolean(
    audioState.interacted
    && !audioState.muted
    && audioState.context
    && audioState.context.state === "running"
    && document.visibilityState !== "hidden"
  );
}

function setMasterVolume(value) {
  const context = audioState.context;
  const gain = audioState.masterGain;
  if (!context || !gain) return;
  const now = context.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(value, now);
}

function trackAudioSource(source) {
  audioState.activeSources.add(source);
  source.addEventListener("ended", () => {
    audioState.activeSources.delete(source);
    try {
      source.disconnect();
    } catch {
      // A stopped source may already be disconnected by the browser.
    }
  }, { once: true });
}

function stopActiveAudioEvents() {
  audioState.activeSources.forEach((source) => {
    try {
      source.stop();
    } catch {
      // The source may have ended between scheduling and cancellation.
    }
    try {
      source.disconnect();
    } catch {
      // Disconnection is best effort.
    }
  });
  audioState.activeSources.clear();
  audioState.nextSpillEventAt = 0;
}

function cancelAmbientBubble() {
  if (audioState.ambientTimerId === null) return;
  window.clearTimeout(audioState.ambientTimerId);
  audioState.ambientTimerId = null;
}

function playNoiseBurst({ duration, frequency, filterType, volume }) {
  if (!audioCanPlay() || !audioState.noiseBuffer) return;

  const context = audioState.context;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const now = context.currentTime;
  const safeDuration = clamp(duration, 0.04, 0.45);

  source.buffer = audioState.noiseBuffer;
  source.loop = false;
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + safeDuration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioState.masterGain);
  trackAudioSource(source);
  source.start(now, seededFraction(audioState.eventSequence + 9) * 0.5, safeDuration);
  source.stop(now + safeDuration + 0.01);
}

function playToneBurst({ frequency, endFrequency, duration, volume, type = "sine" }) {
  if (!audioCanPlay()) return;

  const context = audioState.context;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  const safeDuration = clamp(duration, 0.04, 0.35);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + safeDuration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + safeDuration);
  oscillator.connect(gain);
  gain.connect(audioState.masterGain);
  trackAudioSource(oscillator);
  oscillator.start(now);
  oscillator.stop(now + safeDuration + 0.01);
}

function playAmbientBubble() {
  const drink = currentDrink();
  if (!drink || simulationState.physicsStatus !== "ready" || simulationState.fillLevel <= 0) return;
  audioState.eventSequence += 1;
  const variation = 0.9 + seededFraction(audioState.eventSequence + 17) * 0.2;
  playToneBurst({
    frequency: drink.audio.bubblePitch * variation,
    endFrequency: drink.audio.bubblePitch * variation * 1.24,
    duration: 0.055 + seededFraction(audioState.eventSequence + 21) * 0.045,
    volume: simulationState.drinkKey === "cola" ? 0.018 : 0.014,
    type: "sine"
  });
}

function scheduleAmbientBubble() {
  const drink = currentDrink();
  if (
    !drink
    || audioState.ambientTimerId !== null
    || !audioCanPlay()
    || simulationState.physicsStatus !== "ready"
    || simulationState.fillLevel <= 0
  ) {
    return;
  }

  const span = drink.audio.ambientMaximumMs - drink.audio.ambientMinimumMs;
  const delay = drink.audio.ambientMinimumMs
    + seededFraction(audioState.eventSequence + 31) * span;
  audioState.ambientTimerId = window.setTimeout(() => {
    audioState.ambientTimerId = null;
    playAmbientBubble();
    scheduleAmbientBubble();
  }, delay);
}

function playSpillEvent(flowRate) {
  const drink = currentDrink();
  if (!drink || !audioCanPlay()) return;
  audioState.eventSequence += 1;
  const intensity = clamp(flowRate / 0.2, 0, 1);
  const variation = 0.88 + seededFraction(audioState.eventSequence + 43) * 0.25;

  playNoiseBurst({
    duration: 0.08 + intensity * 0.12,
    frequency: drink.audio.spillPitch * (3.6 + variation),
    filterType: "bandpass",
    volume: drink.audio.spillVolume * (0.55 + intensity * 0.45)
  });

  if (audioState.eventSequence % 3 === 0) {
    playToneBurst({
      frequency: drink.audio.spillPitch * variation,
      endFrequency: drink.audio.spillPitch * variation * 0.72,
      duration: 0.11 + intensity * 0.06,
      volume: 0.018 + intensity * 0.014,
      type: "triangle"
    });
  }
}

function playRefillEvent() {
  const drink = currentDrink();
  if (!drink) return;
  audioState.eventSequence += 1;
  playNoiseBurst({
    duration: 0.32,
    frequency: simulationState.drinkKey === "cola" ? 720 : 980,
    filterType: "bandpass",
    volume: 0.032
  });
  playToneBurst({
    frequency: drink.audio.spillPitch * 1.25,
    endFrequency: drink.audio.spillPitch * 1.7,
    duration: 0.19,
    volume: 0.022,
    type: "sine"
  });
}

function playEmptyEvent() {
  const drink = currentDrink();
  if (!drink) return;
  audioState.eventSequence += 1;
  playToneBurst({
    frequency: drink.audio.spillPitch,
    endFrequency: drink.audio.spillPitch * 0.58,
    duration: 0.18,
    volume: 0.026,
    type: "triangle"
  });
}

function audioDiagnosticState() {
  if (audioState.unavailable) return "unavailable";
  if (!audioState.interacted) return "not-started";
  if (audioState.muted) return "muted";
  if (!audioState.context || audioState.context.state !== "running") return "suspended";
  if (simulationState.physicsStatus === "spilling") return "spill-events";
  if (simulationState.physicsStatus === "refilling") return "refill-event";
  if (audioState.ambientTimerId !== null) return "ambient-wait";
  return "silent";
}

function syncAudioScheduling(previousStatus = simulationState.physicsStatus) {
  if (
    (previousStatus === "spilling" && simulationState.physicsStatus !== "spilling")
    || (previousStatus === "refilling" && simulationState.physicsStatus !== "refilling")
  ) {
    stopActiveAudioEvents();
  }

  if (!audioCanPlay() || simulationState.physicsStatus !== "ready") {
    cancelAmbientBubble();
  } else {
    scheduleAmbientBubble();
  }
}

function resumeAudioContext() {
  const context = audioState.context;
  if (!context || context.state === "closed") return;

  if (context.state === "running") {
    setMasterVolume(audioState.muted ? 0 : 0.72);
    syncAudioScheduling();
    return;
  }

  try {
    const resumeResult = context.resume();
    if (resumeResult && typeof resumeResult.then === "function") {
      void resumeResult.then(() => {
        setMasterVolume(audioState.muted ? 0 : 0.72);
        syncAudioScheduling();
      }).catch(() => {});
    }
  } catch {
    // Motion and manual simulation remain available without sound.
  }
}

function enableAudioFromUserGesture() {
  audioState.interacted = true;
  if (!createAudioEngine()) return;
  resumeAudioContext();
}

function toggleMute() {
  audioState.muted = !audioState.muted;
  updateSoundButton();

  if (audioState.muted) {
    cancelAmbientBubble();
    stopActiveAudioEvents();
    setMasterVolume(0);
  } else if (audioState.interacted) {
    resumeAudioContext();
  }

  setTextContent(elements.liveStatus, audioState.muted ? "Sound muted." : "Sound unmuted.");
  renderDiagnostics();
}

function handleVisibilityChange() {
  const hidden = document.visibilityState === "hidden";
  elements.app.classList.toggle("is-background", hidden);

  if (hidden) {
    cancelAmbientBubble();
    stopActiveAudioEvents();
    setMasterVolume(0);
    if (audioState.context) {
      try {
        const suspendResult = audioState.context.suspend();
        if (suspendResult && typeof suspendResult.catch === "function") {
          void suspendResult.catch(() => {});
        }
      } catch {
        // Browsers may have suspended the context already.
      }
    }
    return;
  }

  if (audioState.interacted && !audioState.muted) resumeAudioContext();
}

// Simulation loop and state transitions
function setPhysicsStatus(status) {
  const previousStatus = simulationState.physicsStatus;
  if (previousStatus === status) return;
  simulationState.physicsStatus = status;
  syncAudioScheduling(previousStatus);

  if (status === "spilling") {
    setMotionMessage("Spilling… Hold this angle or tilt farther to continue.", "success");
  } else if (status === "ready" && previousStatus === "spilling") {
    setMotionMessage("Flow stopped at this angle. Tilt farther to keep drinking.", "success");
  } else if (status === "refilling") {
    setMotionMessage("Refilling…", "success");
  } else if (status === "empty") {
    setMotionMessage("Empty — tap Refill", "warning");
  }
}

function handleEmptyGlass() {
  const wasEmpty = simulationState.physicsStatus === "empty" && simulationState.fillLevel === 0;
  simulationState.fillLevel = 0;
  simulationState.isRefilling = false;
  simulationState.capacityFraction = clamp(simulationState.capacityFraction, 0, 1);
  simulationState.overflowAmount = 0;
  simulationState.flowRate = 0;
  setPhysicsStatus("empty");
  cancelAmbientBubble();
  stopActiveAudioEvents();

  if (!wasEmpty && simulationState.drinkKey) {
    playEmptyEvent();
    setTextContent(elements.liveStatus, `${currentDrink().name} is empty. Tap Refill.`);
  }
}

function updateFilteredSideTilt(deltaTime) {
  if (sensorState.inputMode === "manual") {
    sensorState.filteredSideTilt = sensorState.rawSideTilt;
  } else {
    const smoothing = prefersReducedMotion
      ? 1
      : 1 - Math.exp(-SMOOTHING_RESPONSE * deltaTime);
    sensorState.filteredSideTilt += (
      sensorState.rawSideTilt - sensorState.filteredSideTilt
    ) * smoothing;
  }
  sensorState.clampedSideTilt = clamp(
    sensorState.filteredSideTilt,
    -MAX_SIDE_DEGREES,
    MAX_SIDE_DEGREES
  );
}

function scheduleSpillAudio(timestamp) {
  if (simulationState.physicsStatus !== "spilling" || !audioCanPlay()) return;
  if (timestamp < audioState.nextSpillEventAt) return;

  playSpillEvent(simulationState.flowRate);
  const intensity = clamp(simulationState.flowRate / 0.2, 0, 1);
  const randomness = seededFraction(audioState.eventSequence + 57);
  audioState.nextSpillEventAt = timestamp + 260 + (1 - intensity) * 250 + randomness * 190;
}

function startAnimationLoop() {
  if (!simulationState.drinkKey || simulationState.animationFrameId !== null) return;
  simulationState.lastFrameTime = null;
  simulationState.animationFrameId = window.requestAnimationFrame(animateSimulation);
}

function shouldContinueAnimation() {
  if (simulationState.isRefilling) return true;
  if (sensorState.inputMode === "motion" && sensorState.calibrated) {
    return simulationState.physicsStatus !== "empty";
  }
  return simulationState.physicsStatus === "spilling";
}

function animateSimulation(timestamp) {
  simulationState.animationFrameId = null;
  if (!simulationState.drinkKey) {
    simulationState.lastFrameTime = null;
    return;
  }

  const elapsed = simulationState.lastFrameTime === null
    ? 1 / 60
    : (timestamp - simulationState.lastFrameTime) / 1000;
  const deltaTime = clamp(elapsed, 0, 0.05);
  simulationState.lastFrameTime = timestamp;

  updateFilteredSideTilt(deltaTime);
  updateCapacityForCurrentAngle();

  if (simulationState.isRefilling) {
    simulationState.fillLevel = clamp(
      simulationState.fillLevel + REFILL_RATE * deltaTime,
      0,
      1
    );
    simulationState.overflowAmount = Math.max(
      0,
      simulationState.fillLevel - simulationState.capacityFraction
    );

    if (simulationState.fillLevel >= 1) {
      simulationState.fillLevel = 1;
      simulationState.isRefilling = false;
      simulationState.flowRate = 0;
      setPhysicsStatus("ready");
      setMotionMessage(
        sensorState.inputMode === "motion" && sensorState.calibrated
          ? "Refilled. Tilt sideways until the surface reaches the rim."
          : "Refilled. Manual side tilt is ready.",
        "success"
      );
      setTextContent(elements.liveStatus, `${currentDrink().name} refilled to 100 percent.`);
    }
  } else if (simulationState.fillLevel > 0) {
    const spill = stepSpill({
      fillLevel: simulationState.fillLevel,
      capacityFraction: simulationState.capacityFraction,
      angleDegrees: sensorState.clampedSideTilt,
      deltaTime,
      wasSpilling: simulationState.physicsStatus === "spilling"
    });
    simulationState.fillLevel = spill.fillLevel;
    simulationState.overflowAmount = spill.overflowAmount;
    simulationState.flowRate = spill.flowRate;

    if (spill.spilling) setPhysicsStatus("spilling");
    else if (simulationState.physicsStatus === "spilling") setPhysicsStatus("ready");
  }

  if (simulationState.fillLevel <= 0.000001) handleEmptyGlass();

  renderLiquidGeometry();
  renderInterface(false);
  scheduleSpillAudio(timestamp);

  if (
    simulationState.diagnosticsOpen
    && timestamp - simulationState.lastDiagnosticsFrame >= DIAGNOSTIC_INTERVAL_MS
  ) {
    renderDiagnostics();
    simulationState.lastDiagnosticsFrame = timestamp;
  }

  if (shouldContinueAnimation()) {
    simulationState.animationFrameId = window.requestAnimationFrame(animateSimulation);
  } else {
    simulationState.lastFrameTime = null;
    if (simulationState.diagnosticsOpen) {
      renderDiagnostics();
      simulationState.lastDiagnosticsFrame = timestamp;
    }
  }
}

function activateManualMode() {
  sensorState.inputMode = "manual";
  sensorState.calibrated = false;
  sensorState.calibrating = false;
  if (sensorState.calibrationTimerId !== null) {
    window.clearTimeout(sensorState.calibrationTimerId);
    sensorState.calibrationTimerId = null;
  }
  updateCalibrationUi();
}

function setManualSideTilt(angle) {
  activateManualMode();
  sensorState.rawSideTilt = clamp(angle, -MAX_SIDE_DEGREES, MAX_SIDE_DEGREES);
  sensorState.filteredSideTilt = sensorState.rawSideTilt;
  sensorState.clampedSideTilt = sensorState.rawSideTilt;
  updateCapacityForCurrentAngle();
  renderLiquidGeometry(true);
  renderInterface();
  renderDiagnostics();
  startAnimationLoop();
}

function refillGlass() {
  if (sensorState.calibrationTimerId !== null) {
    window.clearTimeout(sensorState.calibrationTimerId);
    sensorState.calibrationTimerId = null;
    sensorState.calibrationSamples = [];
    sensorState.calibrating = false;
  }

  if (sensorState.inputMode === "manual") {
    sensorState.rawSideTilt = 0;
    sensorState.filteredSideTilt = 0;
    sensorState.clampedSideTilt = 0;
  }

  simulationState.isRefilling = !prefersReducedMotion && simulationState.fillLevel < 1;
  simulationState.flowRate = 0;
  regenerateDrinkEffects();
  updateCapacityForCurrentAngle();
  stopActiveAudioEvents();
  cancelAmbientBubble();

  if (simulationState.isRefilling) {
    setPhysicsStatus("refilling");
    playRefillEvent();
  } else {
    simulationState.fillLevel = 1;
    setPhysicsStatus("ready");
    setMotionMessage("The glass is full.", "success");
  }

  renderLiquidGeometry(true);
  renderInterface();
  renderDiagnostics();
  startAnimationLoop();
}

function selectDrink(drinkKey) {
  const drink = DRINKS[drinkKey];
  const geometry = drink ? GLASS_GEOMETRIES[drink.glassKey] : null;
  if (!drink || !geometry) return;

  cancelAmbientBubble();
  stopActiveAudioEvents();
  simulationState.drinkKey = drinkKey;
  simulationState.fillLevel = drink.initialFill;
  simulationState.isRefilling = false;
  simulationState.flowRate = 0;
  simulationState.physicsStatus = "ready";
  sensorState.rawSideTilt = 0;
  sensorState.filteredSideTilt = 0;
  sensorState.clampedSideTilt = 0;
  if (!sensorState.calibrated) sensorState.inputMode = "manual";

  elements.app.dataset.drink = drinkKey;
  setTextContent(elements.currentDrinkName, drink.name);
  applyDrinkTheme(drink);
  applyGlassGeometry(drink, geometry);
  regenerateDrinkEffects();
  updateCapacityForCurrentAngle();
  renderLiquidGeometry(true);
  renderInterface();
  renderDiagnostics();
  setDiagnostics(debugRequested);

  elements.chooserScreen.hidden = true;
  elements.drinkScreen.hidden = false;
  updateCalibrationUi();
  syncAudioScheduling();
  startAnimationLoop();
  elements.backButton.focus({ preventScroll: true });
}

function returnToChooser() {
  setDiagnostics(false);
  elements.drinkScreen.hidden = true;
  elements.chooserScreen.hidden = false;
  simulationState.drinkKey = null;
  simulationState.isRefilling = false;
  simulationState.lastFrameTime = null;
  cancelAmbientBubble();
  stopActiveAudioEvents();

  if (simulationState.animationFrameId !== null) {
    window.cancelAnimationFrame(simulationState.animationFrameId);
    simulationState.animationFrameId = null;
  }

  if (sensorState.calibrationTimerId !== null) {
    window.clearTimeout(sensorState.calibrationTimerId);
    sensorState.calibrationTimerId = null;
    sensorState.calibrationSamples = [];
    sensorState.calibrating = false;
    updateCalibrationUi();
  }

  elements.drinkCards[0].focus({ preventScroll: true });
}

// Sensor access and calibration
function updateCalibrationUi(message = "") {
  elements.calibrationCard.hidden = !sensorState.listenerRegistered;
  if (!sensorState.listenerRegistered) return;

  if (sensorState.calibrating) {
    setTextContent(elements.calibrationPrompt, message || "Keep your phone upright and still…");
    setTextContent(elements.calibrateButton, "Calibrating…");
    elements.calibrateButton.disabled = true;
    return;
  }

  setTextContent(
    elements.calibrationPrompt,
    message || (
      sensorState.calibrated
        ? "Calibrated. Tilt sideways until the liquid reaches a rim."
        : "Hold your phone upright and tap Calibrate"
    )
  );
  setTextContent(elements.calibrateButton, sensorState.calibrated ? "Recalibrate" : "Calibrate");
  elements.calibrateButton.disabled = false;
}

function finishCalibration() {
  sensorState.calibrationTimerId = null;
  const samples = sensorState.calibrationSamples;
  sensorState.calibrationSamples = [];
  sensorState.calibrating = false;

  if (samples.length < MIN_CALIBRATION_SAMPLES) {
    sensorState.calibrated = false;
    sensorState.inputMode = "manual";
    updateCalibrationUi("Not enough readings. Keep the phone upright and try again.");
    setMotionMessage(
      "Calibration needs more valid readings. Manual controls remain fully functional.",
      "warning"
    );
    renderDiagnostics();
    return;
  }

  sensorState.gammaBase = circularMeanDegrees(samples);
  sensorState.calibrated = true;
  sensorState.inputMode = "motion";
  sensorState.rawSideTilt = 0;
  sensorState.filteredSideTilt = 0;
  sensorState.clampedSideTilt = 0;
  updateCapacityForCurrentAngle();
  setPhysicsStatus(simulationState.fillLevel <= 0 ? "empty" : "ready");
  updateCalibrationUi();
  setMotionMessage("Calibrated. Tilt sideways until the surface reaches a rim.", "success");
  setTextContent(elements.liveStatus, "Side tilt calibrated and ready.");
  renderLiquidGeometry(true);
  renderInterface();
  renderDiagnostics();
  startAnimationLoop();
}

function beginCalibration() {
  if (!sensorState.listenerRegistered) {
    setMotionMessage("Enable Motion before calibrating.", "warning");
    return;
  }

  if (sensorState.calibrationTimerId !== null) {
    window.clearTimeout(sensorState.calibrationTimerId);
  }

  sensorState.calibrated = false;
  sensorState.calibrating = true;
  sensorState.calibrationSamples = [];
  sensorState.rawSideTilt = 0;
  sensorState.filteredSideTilt = 0;
  sensorState.clampedSideTilt = 0;
  updateCalibrationUi();
  setMotionMessage("Calibrating… Keep your phone upright and still.", "neutral");
  renderDiagnostics();
  sensorState.calibrationTimerId = window.setTimeout(
    finishCalibration,
    CALIBRATION_DURATION_MS
  );
}

function handleDeviceOrientation(event) {
  if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;

  sensorState.beta = event.beta;
  sensorState.gamma = event.gamma;
  sensorState.lastEvent = new Date();
  sensorState.eventCount += 1;

  if (sensorState.calibrating) sensorState.calibrationSamples.push(event.gamma);
  if (sensorState.calibrated) {
    sensorState.rawSideTilt = normalizeAngleDifference(event.gamma, sensorState.gammaBase);
    startAnimationLoop();
  }

  if (sensorState.timeoutId !== null) {
    window.clearTimeout(sensorState.timeoutId);
    sensorState.timeoutId = null;
  }

  if (sensorState.eventCount === 1 && !sensorState.calibrating) {
    setMotionMessage("Motion data received. Hold your phone upright and tap Calibrate.", "success");
  }

  const timestamp = currentFrameTime();
  if (
    simulationState.diagnosticsOpen
    && timestamp - simulationState.lastDiagnosticsFrame >= DIAGNOSTIC_INTERVAL_MS
  ) {
    renderDiagnostics();
    simulationState.lastDiagnosticsFrame = timestamp;
  }
}

function startSensorTimeout() {
  if (sensorState.timeoutId !== null) window.clearTimeout(sensorState.timeoutId);
  const startingEventCount = sensorState.eventCount;
  sensorState.timeoutId = window.setTimeout(() => {
    sensorState.timeoutId = null;
    if (sensorState.eventCount === startingEventCount) {
      setMotionMessage(
        "No orientation data arrived within 5 seconds. Keep using manual controls and verify HTTPS and sensor settings.",
        "warning"
      );
    }
  }, SENSOR_TIMEOUT_MS);
}

function registerOrientationListener() {
  if (sensorState.listenerRegistered) return;
  window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true });
  sensorState.listenerRegistered = true;
  updateCalibrationUi("Hold your phone upright and tap Calibrate");
  setMotionMessage("Motion enabled. Hold your phone upright, then tap Calibrate.", "neutral");
  startSensorTimeout();
}

// Diagnostics and interface events
function renderDiagnostics() {
  setTextContent(elements.protocolValue, sensorState.protocol);
  setTextContent(elements.apiValue, sensorState.apiAvailable ? "available" : "unavailable");
  setTextContent(elements.permissionValue, sensorState.permission);
  elements.permissionValue.dataset.status = sensorState.permission;
  setTextContent(elements.betaValue, formatAngle(sensorState.beta));
  setTextContent(elements.gammaValue, formatAngle(sensorState.gamma));
  setTextContent(elements.gammaBaseValue, formatAngle(sensorState.gammaBase));
  setTextContent(elements.lastEventValue, formatEventTime(sensorState.lastEvent));
  setTextContent(elements.eventCountValue, String(sensorState.eventCount));
  setTextContent(elements.sideTiltRawValue, formatAngle(sensorState.rawSideTilt));
  setTextContent(elements.sideTiltFilteredValue, formatAngle(sensorState.filteredSideTilt));
  setTextContent(elements.sideTiltClampedValue, formatAngle(sensorState.clampedSideTilt));
  setTextContent(elements.currentFillValue, simulationState.fillLevel.toFixed(3));
  setTextContent(elements.capacityValue, simulationState.capacityFraction.toFixed(3));
  setTextContent(elements.overflowValue, simulationState.overflowAmount.toFixed(3));
  setTextContent(elements.flowRateValue, `${simulationState.flowRate.toFixed(3)}/s`);
  setTextContent(elements.lowerLipValue, simulationState.lowerLip);
  setTextContent(elements.physicsStateValue, simulationState.physicsStatus);
  setTextContent(elements.audioStateValue, audioDiagnosticState());
  setTextContent(elements.appVersionValue, APP_VERSION);
  setAttributeValue(
    elements.enableMotionButton,
    "aria-pressed",
    String(sensorState.listenerRegistered)
  );
}

function setDiagnostics(open) {
  simulationState.diagnosticsOpen = open;
  elements.diagnosticPanel.hidden = !open;
  setAttributeValue(elements.controlsButton, "aria-expanded", String(open));
  elements.drinkScreen.classList.toggle("controls-open", open);
  if (open) {
    renderDiagnostics();
    simulationState.lastDiagnosticsFrame = currentFrameTime();
  }
}

function diagnosticsText() {
  return [
    "TiltSip side-tilt diagnostics",
    `App version: ${APP_VERSION}`,
    `Protocol: ${sensorState.protocol}`,
    `API: ${sensorState.apiAvailable ? "available" : "unavailable"}`,
    `Permission: ${sensorState.permission}`,
    `Beta raw: ${formatAngle(sensorState.beta)}`,
    `Gamma raw: ${formatAngle(sensorState.gamma)}`,
    `Gamma base: ${formatAngle(sensorState.gammaBase)}`,
    `Last event: ${formatEventTime(sensorState.lastEvent)}`,
    `Events received: ${sensorState.eventCount}`,
    `Side tilt raw: ${formatAngle(sensorState.rawSideTilt)}`,
    `Side tilt filtered: ${formatAngle(sensorState.filteredSideTilt)}`,
    `Side tilt clamped: ${formatAngle(sensorState.clampedSideTilt)}`,
    `Current fill: ${simulationState.fillLevel.toFixed(3)}`,
    `Capacity at current angle: ${simulationState.capacityFraction.toFixed(3)}`,
    `Overflow amount: ${simulationState.overflowAmount.toFixed(3)}`,
    `Flow rate: ${simulationState.flowRate.toFixed(3)}/s`,
    `Lower lip: ${simulationState.lowerLip}`,
    `Physics state: ${simulationState.physicsStatus}`,
    `Audio state: ${audioDiagnosticState()}`
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
    setTextContent(elements.copyDiagnosticsButton, "Copied");
    setTextContent(elements.liveStatus, "Diagnostics copied.");
  } catch {
    setTextContent(elements.copyDiagnosticsButton, "Copy failed");
    setTextContent(elements.liveStatus, "Diagnostics could not be copied automatically.");
    setMotionMessage("Copy failed. Every diagnostic value remains visible in this panel.", "warning");
  }
}

function bindEvents() {
  elements.drinkCards.forEach((card) => {
    card.addEventListener("click", () => selectDrink(card.dataset.drink));
  });
  elements.backButton.addEventListener("click", returnToChooser);
  elements.refillButtons.forEach((button) => button.addEventListener("click", refillGlass));
  elements.soundButton.addEventListener("click", toggleMute);
  elements.controlsButton.addEventListener("click", () => {
    setDiagnostics(!simulationState.diagnosticsOpen);
  });
  elements.copyDiagnosticsButton.addEventListener("click", () => {
    void copyDiagnostics();
  });
  elements.calibrateButton.addEventListener("click", beginCalibration);

  elements.fillControl.addEventListener("input", (event) => {
    activateManualMode();
    simulationState.isRefilling = false;
    simulationState.fillLevel = clamp(readNumber(event.currentTarget) / 100, 0, 1);
    simulationState.flowRate = 0;
    updateCapacityForCurrentAngle();
    if (simulationState.fillLevel <= 0) handleEmptyGlass();
    else setPhysicsStatus("ready");
    renderLiquidGeometry(true);
    renderInterface();
    renderDiagnostics();
    startAnimationLoop();
  });

  elements.sideTiltControl.addEventListener("input", (event) => {
    setManualSideTilt(readNumber(event.currentTarget));
  });

  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Permission remains inside this click handler to preserve transient user activation.
  elements.enableMotionButton.addEventListener("click", async () => {
    try {
      const OrientationEvent = window.DeviceOrientationEvent;
      const permissionPromise = (
        typeof OrientationEvent !== "undefined"
        && OrientationEvent !== null
        && !sensorState.listenerRegistered
        && typeof OrientationEvent.requestPermission === "function"
      )
        ? OrientationEvent.requestPermission()
        : null;

      // Audio is created or resumed inside this same direct click.
      enableAudioFromUserGesture();

      if (typeof OrientationEvent === "undefined" || OrientationEvent === null) {
        sensorState.apiAvailable = false;
        sensorState.permission = "not-required";
        setMotionMessage(
          "Orientation is unavailable. Manual fill and side tilt remain fully functional.",
          "warning"
        );
        renderDiagnostics();
        return;
      }

      sensorState.apiAvailable = true;
      if (sensorState.listenerRegistered) {
        setMotionMessage(
          sensorState.calibrated
            ? "Motion is enabled and calibrated. Recalibrate if the upright position changes."
            : "Motion is enabled. Hold your phone upright and tap Calibrate.",
          sensorState.eventCount > 0 ? "success" : "warning"
        );
        updateCalibrationUi();
        renderDiagnostics();
        return;
      }

      if (permissionPromise) {
        const permissionResult = await permissionPromise;
        if (permissionResult !== "granted") {
          sensorState.permission = "denied";
          setMotionMessage(
            "Motion permission was denied. Manual fill and side tilt remain fully functional.",
            "warning"
          );
          renderDiagnostics();
          return;
        }
        sensorState.permission = "granted";
        registerOrientationListener();
        renderDiagnostics();
        return;
      }

      sensorState.permission = "not-required";
      registerOrientationListener();
      renderDiagnostics();
    } catch {
      sensorState.permission = "error";
      setMotionMessage(
        "Motion could not be enabled. Manual controls remain functional; verify HTTPS and sensor permission.",
        "error"
      );
      renderDiagnostics();
    }
  });
}

function initialize() {
  sensorState.protocol = window.location.protocol === "https:" ? "HTTPS" : "Not HTTPS";
  sensorState.apiAvailable = typeof window.DeviceOrientationEvent !== "undefined"
    && window.DeviceOrientationEvent !== null;
  setTextContent(elements.versionLabel, `v${APP_VERSION}`);
  setTextContent(elements.appVersionValue, APP_VERSION);
  updateSoundButton();
  renderDiagnostics();
  bindEvents();
}

initialize();
