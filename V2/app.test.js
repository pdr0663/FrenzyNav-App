"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const navigation = require("./location.js");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML element IDs must be unique");

function makeElement(id) {
  return {
    id,
    className: "",
    textContent: "",
    innerHTML: "",
    value: "",
    disabled: false,
    open: false,
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    }
  };
}

const elements = new Map(ids.map(id => [id, makeElement(id)]));
const storage = new Map();
let positionCallback = null;
let positionFailure = null;

const context = vm.createContext({
  console,
  Date,
  Math,
  Number,
  Promise,
  setTimeout,
  clearTimeout,
  screen: { orientation: { angle: 0 } },
  navigator: {
    geolocation: {
      watchPosition(success, failure) {
        positionCallback = success;
        positionFailure = failure;
        return 1;
      }
    }
  },
  document: {
    getElementById(id) {
      assert.ok(elements.has(id), `Missing mocked element ${id}`);
      return elements.get(id);
    }
  },
  localforage: {
    async getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    async setItem(key, value) {
      storage.set(key, structuredClone(value));
      return value;
    },
    async removeItem(key) {
      storage.delete(key);
    }
  }
});

context.window = {
  orientation: 0,
  setInterval() {
    return 1;
  },
  addEventListener() {},
  open() {},
  ...context
};

vm.runInContext(
  fs.readFileSync(path.join(__dirname, "location.js"), "utf8"),
  context,
  { filename: "location.js" }
);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "app.js"), "utf8"),
  context,
  { filename: "app.js" }
);

(async () => {
  await context.window.startUp();
  assert.equal(typeof positionCallback, "function");
  assert.equal(typeof positionFailure, "function");
  assert.equal(elements.get("modeBanner").textContent, "ALL BEARINGS TRUE");

  elements.get("bearingMode").value = "magnetic";
  elements.get("declinationMagnitude").value = "12.5";
  elements.get("declinationDirection").value = "east";
  await context.window.saveSettings();
  assert.equal(
    elements.get("modeBanner").textContent,
    "ALL BEARINGS MAGNETIC · 12.5° E"
  );

  const target = [-34.0, 151.2];
  const observers = [
    [-34.0, 151.18],
    [-34.02, 151.2]
  ];

  for (let index = 0; index < observers.length; index += 1) {
    const observer = observers[index];
    positionCallback({
      timestamp: 1000 + index * 10000,
      coords: {
        latitude: observer[0],
        longitude: observer[1],
        accuracy: 5
      }
    });
    const magneticBearing = navigation.normalizeBearing(
      navigation.courseBetween(observer, target) - 12.5
    );
    elements.get("manualBearing").value = magneticBearing.toFixed(2);
    await context.window.captureManualSighting();
  }

  assert.equal(elements.get("sightingMode").textContent, "CURRENT MODE: MAGNETIC");
  assert.equal(elements.get("acceptSolution").disabled, false);
  assert.match(elements.get("solutionSummary").innerHTML, /GOOD/);

  await context.window.acceptSightingSolution();
  assert.ok(storage.has("FrenzyNavV2.TopMark"));
  const savedTopMark = storage.get("FrenzyNavV2.TopMark");
  assert.ok(navigation.distanceBetween(savedTopMark, target) < 0.002);
  assert.equal(elements.get("Top Mark").className, "enabled");

  const originalStorageKeys = [...storage.keys()].filter(key => !key.startsWith("FrenzyNavV2."));
  assert.deepEqual(originalStorageKeys, []);

  console.log("V2 application workflow tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
