"use strict";

const EARTH_NM = 3440.06479;

function normalizeBearing(bearing) {
  return ((Number(bearing) % 360) + 360) % 360;
}

function angularDifference(a, b) {
  return Math.abs(((normalizeBearing(a) - normalizeBearing(b) + 540) % 360) - 180);
}

function distanceBetween(loc1, loc2) {
  const meanLatitude = ((loc1[0] + loc2[0]) / 2) * Math.PI / 180;
  const x = (loc2[1] - loc1[1]) * Math.PI / 180 * Math.cos(meanLatitude);
  const y = (loc2[0] - loc1[0]) * Math.PI / 180;
  return EARTH_NM * Math.hypot(x, y);
}

function courseBetween(loc1, loc2) {
  const meanLatitude = ((loc1[0] + loc2[0]) / 2) * Math.PI / 180;
  const x = EARTH_NM * (loc2[1] - loc1[1]) * Math.PI / 180 * Math.cos(meanLatitude);
  const y = EARTH_NM * (loc2[0] - loc1[0]) * Math.PI / 180;
  return normalizeBearing(Math.atan2(x, y) * 180 / Math.PI);
}

function projectDistance(start, distanceNm, bearing) {
  const b = normalizeBearing(bearing) * Math.PI / 180;
  const d = distanceNm / EARTH_NM;
  const startLatitude = start[0] * Math.PI / 180;
  const startLongitude = start[1] * Math.PI / 180;

  const latitude = Math.asin(
    Math.sin(startLatitude) * Math.cos(d) +
    Math.cos(startLatitude) * Math.sin(d) * Math.cos(b)
  );
  const longitude = startLongitude + Math.atan2(
    Math.sin(b) * Math.sin(d) * Math.cos(startLatitude),
    Math.cos(d) - Math.sin(startLatitude) * Math.sin(latitude)
  );

  return [latitude * 180 / Math.PI, longitude * 180 / Math.PI];
}

function toLocalPoint(location, origin) {
  const meanLatitude = ((location[0] + origin[0]) / 2) * Math.PI / 180;
  return {
    x: EARTH_NM * (location[1] - origin[1]) * Math.PI / 180 * Math.cos(meanLatitude),
    y: EARTH_NM * (location[0] - origin[0]) * Math.PI / 180
  };
}

function fromLocalPoint(point, origin) {
  const latitude = origin[0] + (point.y / EARTH_NM) * 180 / Math.PI;
  const meanLatitude = ((latitude + origin[0]) / 2) * Math.PI / 180;
  const longitude = origin[1] + (point.x / (EARTH_NM * Math.cos(meanLatitude))) * 180 / Math.PI;
  return [latitude, longitude];
}

function circularSummary(values) {
  if (!values.length) return null;

  let sumSin = 0;
  let sumCos = 0;
  for (const value of values) {
    const radians = normalizeBearing(value) * Math.PI / 180;
    sumSin += Math.sin(radians);
    sumCos += Math.cos(radians);
  }

  const mean = normalizeBearing(Math.atan2(sumSin, sumCos) * 180 / Math.PI);
  const deviations = values.map(value => angularDifference(value, mean));
  const rmsSpread = Math.sqrt(
    deviations.reduce((total, value) => total + value * value, 0) / deviations.length
  );

  return {
    mean,
    rmsSpread,
    maxSpread: Math.max(...deviations),
    count: values.length
  };
}

function compassHeadingFromOrientation(alpha, beta, gamma) {
  if (![alpha, beta, gamma].every(Number.isFinite)) return null;

  const degreesToRadians = Math.PI / 180;
  const x = beta * degreesToRadians;
  const y = gamma * degreesToRadians;
  const z = alpha * degreesToRadians;
  const cX = Math.cos(x);
  const cY = Math.cos(y);
  const cZ = Math.cos(z);
  const sX = Math.sin(x);
  const sY = Math.sin(y);
  const sZ = Math.sin(z);
  const vectorX = -cZ * sY - sZ * sX * cY;
  const vectorY = -sZ * sY + cZ * sX * cY;

  if (Math.abs(vectorX) < 1e-12 && Math.abs(vectorY) < 1e-12) return null;
  return normalizeBearing(Math.atan2(vectorX, vectorY) * 180 / Math.PI);
}

function bestCrossingAngle(sightings) {
  let best = 0;
  for (let i = 0; i < sightings.length; i += 1) {
    for (let j = i + 1; j < sightings.length; j += 1) {
      const difference = angularDifference(sightings[i].bearingTrue, sightings[j].bearingTrue);
      const acuteDifference = Math.min(difference, 180 - difference);
      best = Math.max(best, acuteDifference);
    }
  }
  return best;
}

function qualityForSolution(crossingAngle, rmsResidualMetres, forwardCount, sightingCount) {
  if (forwardCount !== sightingCount || crossingAngle < 10 || rmsResidualMetres > 150) {
    return "POOR";
  }
  if (crossingAngle < 25 || rmsResidualMetres > 60) {
    return "FAIR";
  }
  return "GOOD";
}

function solveBearingSightings(sightings) {
  if (!Array.isArray(sightings) || sightings.length < 2) {
    return { ok: false, reason: "At least two sightings are required." };
  }

  const validSightings = sightings.filter(sighting =>
    Array.isArray(sighting.location) &&
    sighting.location.length === 2 &&
    sighting.location.every(Number.isFinite) &&
    Number.isFinite(sighting.bearingTrue)
  );

  if (validSightings.length < 2) {
    return { ok: false, reason: "At least two valid sightings are required." };
  }

  const origin = [
    validSightings.reduce((sum, sighting) => sum + sighting.location[0], 0) / validSightings.length,
    validSightings.reduce((sum, sighting) => sum + sighting.location[1], 0) / validSightings.length
  ];

  let a11 = 0;
  let a12 = 0;
  let a22 = 0;
  let b1 = 0;
  let b2 = 0;
  const equations = [];

  for (const sighting of validSightings) {
    const point = toLocalPoint(sighting.location, origin);
    const radians = normalizeBearing(sighting.bearingTrue) * Math.PI / 180;
    const normalX = Math.cos(radians);
    const normalY = -Math.sin(radians);
    const lineConstant = normalX * point.x + normalY * point.y;
    const accuracy = Number.isFinite(sighting.gpsAccuracy) ? Math.max(sighting.gpsAccuracy, 3) : 10;
    const weight = 1 / (accuracy * accuracy);

    a11 += weight * normalX * normalX;
    a12 += weight * normalX * normalY;
    a22 += weight * normalY * normalY;
    b1 += weight * normalX * lineConstant;
    b2 += weight * normalY * lineConstant;
    equations.push({ point, normalX, normalY, lineConstant, radians });
  }

  const determinant = a11 * a22 - a12 * a12;
  if (Math.abs(determinant) < 1e-12) {
    return { ok: false, reason: "The sighting bearings are effectively parallel." };
  }

  const solutionPoint = {
    x: (b1 * a22 - b2 * a12) / determinant,
    y: (a11 * b2 - a12 * b1) / determinant
  };

  const residualsNm = equations.map(equation =>
    equation.normalX * solutionPoint.x +
    equation.normalY * solutionPoint.y -
    equation.lineConstant
  );
  const rmsResidualMetres = Math.sqrt(
    residualsNm.reduce((sum, residual) => sum + residual * residual, 0) / residualsNm.length
  ) * 1852;
  const maximumResidualMetres = Math.max(...residualsNm.map(value => Math.abs(value))) * 1852;
  const forwardCount = equations.filter(equation => {
    const directionX = Math.sin(equation.radians);
    const directionY = Math.cos(equation.radians);
    return (
      (solutionPoint.x - equation.point.x) * directionX +
      (solutionPoint.y - equation.point.y) * directionY
    ) >= 0;
  }).length;
  const crossingAngle = bestCrossingAngle(validSightings);

  return {
    ok: true,
    location: fromLocalPoint(solutionPoint, origin),
    crossingAngle,
    rmsResidualMetres,
    maximumResidualMetres,
    forwardCount,
    sightingCount: validSightings.length,
    quality: qualityForSolution(
      crossingAngle,
      rmsResidualMetres,
      forwardCount,
      validSightings.length
    )
  };
}

function watchLocation(success, failure) {
  if (!navigator.geolocation) {
    failure(new Error("Geolocation is not supported by this browser."));
    return null;
  }

  return navigator.geolocation.watchPosition(success, failure, {
    enableHighAccuracy: true,
    timeout: 7000,
    maximumAge: 0
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    EARTH_NM,
    normalizeBearing,
    angularDifference,
    distanceBetween,
    courseBetween,
    projectDistance,
    circularSummary,
    compassHeadingFromOrientation,
    solveBearingSightings
  };
}
