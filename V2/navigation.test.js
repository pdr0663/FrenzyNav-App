"use strict";

const assert = require("node:assert/strict");
const {
  normalizeBearing,
  angularDifference,
  distanceBetween,
  courseBetween,
  projectDistance,
  circularSummary,
  compassHeadingFromOrientation,
  solveBearingSightings
} = require("./location.js");

function approximately(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} ± ${tolerance}, received ${actual}`
  );
}

assert.equal(normalizeBearing(360), 0);
assert.equal(normalizeBearing(-1), 359);
assert.equal(normalizeBearing(721), 1);
assert.equal(angularDifference(359, 1), 2);

approximately(distanceBetween([0, 0], [1, 0]), 60.04, 0.1, "one latitude degree");
approximately(courseBetween([0, 0], [1, 0]), 0, 0.001, "north course");
approximately(courseBetween([0, 0], [0, 1]), 90, 0.001, "east course");
approximately(courseBetween([0, 0], [-1, 0]), 180, 0.001, "south course");
approximately(courseBetween([0, 0], [0, -1]), 270, 0.001, "west course");

const projected = projectDistance([-34, 151], 2, 45);
approximately(distanceBetween([-34, 151], projected), 2, 0.002, "projected distance");
approximately(courseBetween([-34, 151], projected), 45, 0.02, "projected course");

const circular = circularSummary([359, 0, 1]);
approximately(angularDifference(circular.mean, 0), 0, 0.001, "circular mean");
assert.ok(circular.rmsSpread < 1);

approximately(compassHeadingFromOrientation(0, 90, 0), 0, 0.001, "orientation north");
approximately(compassHeadingFromOrientation(90, 90, 0), 270, 0.001, "orientation west");

const target = [-34.0, 151.2];
const observerWest = [-34.0, 151.18];
const observerSouth = [-34.02, 151.2];
const observerSouthWest = [-34.015, 151.185];
const exactSightings = [observerWest, observerSouth, observerSouthWest].map(
  (location, index) => ({
    location,
    bearingTrue: courseBetween(location, target),
    gpsAccuracy: 5 + index
  })
);
const exactSolution = solveBearingSightings(exactSightings);
assert.equal(exactSolution.ok, true);
approximately(exactSolution.location[0], target[0], 0.000002, "solution latitude");
approximately(exactSolution.location[1], target[1], 0.000002, "solution longitude");
assert.equal(exactSolution.quality, "GOOD");
assert.equal(exactSolution.forwardCount, exactSightings.length);

const noisySightings = exactSightings.map((sighting, index) => ({
  ...sighting,
  bearingTrue: normalizeBearing(sighting.bearingTrue + [-1, 0.5, 1][index])
}));
const noisySolution = solveBearingSightings(noisySightings);
assert.equal(noisySolution.ok, true);
assert.ok(distanceBetween(noisySolution.location, target) < 0.08);

const parallelSolution = solveBearingSightings([
  { location: [-34, 151.1], bearingTrue: 0 },
  { location: [-34, 151.2], bearingTrue: 0 }
]);
assert.equal(parallelSolution.ok, false);

console.log("V2 navigation tests passed.");
