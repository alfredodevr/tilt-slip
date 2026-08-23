const GEOMETRY_EPSILON = 1e-7;
const AREA_SEARCH_STEPS = 52;

export const SENSOR_TILT_LIMIT = 78;
export const SENSOR_MAX_ENTER = 77.5;
export const SENSOR_MAX_EXIT = 76.75;

export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function clampSensorTiltWithHysteresis(
  value,
  latchedSign = 0,
  maximum = SENSOR_TILT_LIMIT,
  enterThreshold = SENSOR_MAX_ENTER,
  exitThreshold = SENSOR_MAX_EXIT
) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const sign = Math.sign(safeValue);
  let nextLatch = latchedSign;

  if (nextLatch !== 0 && (sign !== nextLatch || Math.abs(safeValue) < exitThreshold)) {
    nextLatch = 0;
  }
  if (nextLatch === 0 && Math.abs(safeValue) >= enterThreshold) {
    nextLatch = sign || 1;
  }

  return {
    clampedTilt: nextLatch === 0
      ? clamp(safeValue, -maximum, maximum)
      : nextLatch * maximum,
    latchedSign: nextLatch
  };
}

export function sensorTiltToPhysicsAngle(sensorTilt, maximum = SENSOR_TILT_LIMIT) {
  const normalizedTilt = clamp(sensorTilt / maximum, -1, 1);
  return {
    normalizedTilt,
    physicsAngle: normalizedTilt * 90,
    physicsAngleRadians: normalizedTilt * Math.PI / 2
  };
}

export function dot(point, vector) {
  return point.x * vector.x + point.y * vector.y;
}

export function gravityFromAngle(angleDegrees) {
  const radians = clamp(angleDegrees, -90, 90) * Math.PI / 180;
  return {
    x: Math.sin(radians),
    y: Math.cos(radians)
  };
}

export function polygonArea(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return 0;

  let twiceSignedArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    twiceSignedArea += current.x * next.y - next.x * current.y;
  }

  const area = Math.abs(twiceSignedArea) * 0.5;
  return Number.isFinite(area) ? area : 0;
}

function pointsNearlyEqual(first, second, epsilon = GEOMETRY_EPSILON) {
  return Math.abs(first.x - second.x) <= epsilon
    && Math.abs(first.y - second.y) <= epsilon;
}

function pushUnique(points, point) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  if (points.length === 0 || !pointsNearlyEqual(points[points.length - 1], point)) {
    points.push(point);
  }
}

function edgeIntersection(start, end, startDistance, endDistance) {
  const denominator = startDistance - endDistance;
  const ratio = Math.abs(denominator) <= GEOMETRY_EPSILON
    ? 0.5
    : clamp(startDistance / denominator, 0, 1);

  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio
  };
}

export function clipPolygonHalfPlane(polygon, vector, threshold) {
  if (!Array.isArray(polygon) || polygon.length < 3) return [];

  const clipped = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const startDistance = dot(start, vector) - threshold;
    const endDistance = dot(end, vector) - threshold;
    const startInside = startDistance >= -GEOMETRY_EPSILON;
    const endInside = endDistance >= -GEOMETRY_EPSILON;

    if (startInside && endInside) {
      pushUnique(clipped, { x: end.x, y: end.y });
    } else if (startInside && !endInside) {
      pushUnique(clipped, edgeIntersection(start, end, startDistance, endDistance));
    } else if (!startInside && endInside) {
      pushUnique(clipped, edgeIntersection(start, end, startDistance, endDistance));
      pushUnique(clipped, { x: end.x, y: end.y });
    }
  }

  if (clipped.length > 1 && pointsNearlyEqual(clipped[0], clipped[clipped.length - 1])) {
    clipped.pop();
  }

  return clipped.length >= 3 ? clipped : [];
}

export function projectionRange(polygon, vector) {
  let minimum = Infinity;
  let maximum = -Infinity;

  polygon.forEach((point) => {
    const projection = dot(point, vector);
    minimum = Math.min(minimum, projection);
    maximum = Math.max(maximum, projection);
  });

  return { minimum, maximum };
}

export function thresholdForAreaFraction(polygon, vector, fillLevel) {
  const targetFraction = clamp(fillLevel, 0, 1);
  const totalArea = polygonArea(polygon);
  const range = projectionRange(polygon, vector);

  if (totalArea <= GEOMETRY_EPSILON || !Number.isFinite(range.minimum + range.maximum)) {
    return { threshold: 0, polygon: [], areaFraction: 0 };
  }

  if (targetFraction <= GEOMETRY_EPSILON) {
    return { threshold: range.maximum, polygon: [], areaFraction: 0 };
  }

  if (targetFraction >= 1 - GEOMETRY_EPSILON) {
    return {
      threshold: range.minimum,
      polygon: polygon.map((point) => ({ ...point })),
      areaFraction: 1
    };
  }

  const targetArea = targetFraction * totalArea;
  let lower = range.minimum;
  let upper = range.maximum;

  for (let iteration = 0; iteration < AREA_SEARCH_STEPS; iteration += 1) {
    const midpoint = (lower + upper) * 0.5;
    const candidate = clipPolygonHalfPlane(polygon, vector, midpoint);
    const candidateArea = polygonArea(candidate);

    if (candidateArea > targetArea) lower = midpoint;
    else upper = midpoint;
  }

  const threshold = (lower + upper) * 0.5;
  const liquidPolygon = clipPolygonHalfPlane(polygon, vector, threshold);
  return {
    threshold,
    polygon: liquidPolygon,
    areaFraction: clamp(polygonArea(liquidPolygon) / totalArea, 0, 1)
  };
}

export function capacityAtAngle(polygon, rimLeft, rimRight, angleDegrees) {
  const gravity = gravityFromAngle(angleDegrees);
  const leftProjection = dot(rimLeft, gravity);
  const rightProjection = dot(rimRight, gravity);
  const lipThreshold = Math.max(leftProjection, rightProjection);
  const capacityPolygon = clipPolygonHalfPlane(polygon, gravity, lipThreshold);
  const totalArea = polygonArea(polygon);
  const capacityFraction = totalArea <= GEOMETRY_EPSILON
    ? 0
    : clamp(polygonArea(capacityPolygon) / totalArea, 0, 1);

  let lowerLip = "level";
  if (leftProjection > rightProjection + GEOMETRY_EPSILON) lowerLip = "left";
  if (rightProjection > leftProjection + GEOMETRY_EPSILON) lowerLip = "right";

  return {
    gravity,
    lipThreshold,
    capacityPolygon,
    capacityFraction,
    lowerLip
  };
}

function uniqueIntersections(points) {
  return points.filter((point, index) => (
    points.findIndex((candidate) => pointsNearlyEqual(candidate, point, 1e-5)) === index
  ));
}

export function surfaceSegment(polygon, vector, threshold) {
  const intersections = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const startDistance = dot(start, vector) - threshold;
    const endDistance = dot(end, vector) - threshold;

    if (Math.abs(startDistance) <= 1e-5) intersections.push({ ...start });
    if (startDistance * endDistance < -GEOMETRY_EPSILON) {
      intersections.push(edgeIntersection(start, end, startDistance, endDistance));
    }
  }

  const unique = uniqueIntersections(intersections);
  if (unique.length < 2) return null;

  let first = unique[0];
  let second = unique[1];
  let greatestDistance = 0;

  for (let leftIndex = 0; leftIndex < unique.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < unique.length; rightIndex += 1) {
      const deltaX = unique[rightIndex].x - unique[leftIndex].x;
      const deltaY = unique[rightIndex].y - unique[leftIndex].y;
      const distance = deltaX * deltaX + deltaY * deltaY;
      if (distance > greatestDistance) {
        greatestDistance = distance;
        first = unique[leftIndex];
        second = unique[rightIndex];
      }
    }
  }

  return { start: first, end: second };
}

export function foamBandPolygon(polygon, vector, threshold, thickness) {
  if (thickness <= GEOMETRY_EPSILON) return [];
  const belowSurface = clipPolygonHalfPlane(polygon, vector, threshold);
  return clipPolygonHalfPlane(
    belowSurface,
    { x: -vector.x, y: -vector.y },
    -(threshold + thickness)
  );
}

export function polygonToPath(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return "";
  const commands = polygon.map((point, index) => (
    `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  ));
  return `${commands.join(" ")} Z`;
}

export function pointInConvexPolygon(point, polygon, epsilon = 1e-5) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let sign = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const cross = (end.x - start.x) * (point.y - start.y)
      - (end.y - start.y) * (point.x - start.x);
    if (Math.abs(cross) <= epsilon) continue;
    const currentSign = Math.sign(cross);
    if (sign === 0) sign = currentSign;
    else if (sign !== currentSign) return false;
  }

  return true;
}

export function computeFlowRate(overflowAmount, capacityFraction, angleDegrees) {
  if (overflowAmount <= 0) return 0;
  const angleStrength = clamp(Math.abs(angleDegrees) / 90, 0, 1);
  const availableRange = Math.max(0.08, 1 - capacityFraction);
  const excessStrength = clamp(overflowAmount / availableRange, 0, 1);
  return 0.035 + 0.165 * (
    angleStrength * 0.58 + Math.sqrt(excessStrength) * 0.42
  );
}

export function stepSpill({
  fillLevel,
  capacityFraction,
  angleDegrees,
  deltaTime,
  wasSpilling = false,
  enterEpsilon = 0.0015,
  exitEpsilon = 0.00035
}) {
  const safeFill = clamp(fillLevel, 0, 1);
  const safeCapacity = clamp(capacityFraction, 0, 1);
  const overflowAmount = Math.max(0, safeFill - safeCapacity);
  const shouldSpill = wasSpilling
    ? overflowAmount > exitEpsilon
    : overflowAmount > enterEpsilon;

  if (!shouldSpill || deltaTime <= 0) {
    return {
      fillLevel: safeFill,
      overflowAmount,
      flowRate: 0,
      spilling: false
    };
  }

  const flowRate = computeFlowRate(overflowAmount, safeCapacity, angleDegrees);
  const nextFill = Math.max(
    safeCapacity,
    safeFill - flowRate * clamp(deltaTime, 0, 0.05)
  );
  const remainingOverflow = Math.max(0, nextFill - safeCapacity);
  const stillSpilling = remainingOverflow > exitEpsilon;

  return {
    fillLevel: stillSpilling ? nextFill : safeCapacity,
    overflowAmount: stillSpilling ? remainingOverflow : 0,
    flowRate: stillSpilling ? flowRate : 0,
    spilling: stillSpilling
  };
}
