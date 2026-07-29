"use strict";

const UPDATE_INTERVAL_MS = 1000;
const WING_MARK_ANGLE = 45;
const STORAGE_KEYS = {
  settings: "FrenzyNavV2.Settings",
  topMark: "FrenzyNavV2.TopMark",
  bottomMark: "FrenzyNavV2.BottomMark",
  sightings: "FrenzyNavV2.TopMarkSightings"
};

const stats = {
  time: null,
  locationRaw: null,
  locationAccuracy: null,
  location: null,
  locationQueue: [],
  speed: null,
  courseTrue: null,
  targetMark: null,
  targetDistance: null,
  targetCourseTrue: null,
  locationError: null,
  settings: {
    bearingMode: "true",
    declination: 0
  },
  sightings: [],
  sightingSolution: null,
  compass: {
    listening: false,
    permission: "not-requested",
    samples: [],
    headingMagnetic: null,
    spread: null,
    accuracy: null,
    tiltOkay: true,
    message: "Compass not started"
  },
  marks: {
    "Top Mark": { temporary: true, status: "disabled", location: null },
    "Wing Mark Port": { temporary: true, status: "disabled", location: null },
    "Wing Mark Stbd": { temporary: true, status: "disabled", location: null },
    "Bottom Mark": { temporary: true, status: "disabled", location: null },
    "Ramsgate": {
      status: "enabled",
      location: [-(33 + 59.193 / 60), 151 + 9.229 / 60]
    },
    "Brighton": {
      status: "enabled",
      location: [-(33 + 57.768 / 60), 151 + 9.694 / 60]
    },
    "Airport": {
      status: "enabled",
      location: [-(33 + 58.576 / 60), 151 + 11.330 / 60]
    },
    "Kurnell": {
      status: "enabled",
      location: [-(34 + 0.130 / 60), 151 + 12.128 / 60]
    },
    "Quibray": {
      status: "enabled",
      location: [-(34 + 0.137 / 60), 151 + 11.005 / 60]
    },
    "Outer Towra": {
      status: "enabled",
      location: [-(33 + 59.434 / 60), 151 + 9.791 / 60]
    },
    "Taylor Bar": {
      status: "enabled",
      location: [-(33 + 59.474 / 60), 151 + 9.426 / 60]
    },
    "Middle Spit": {
      status: "enabled",
      location: [-34.00973, 151.1325]
    },
    "Captain Cook": {
      status: "enabled",
      location: [-(33 + 59.9 / 60), 151 + 13.1 / 60]
    },
    "Waverider": {
      status: "enabled",
      location: [-(34 + 2.43 / 60), 151 + 15.18 / 60]
    }
  }
};

async function startUp() {
  console.log("FRENZY NAV V2");

  try {
    const [savedSettings, topMark, bottomMark, savedSightings] = await Promise.all([
      localforage.getItem(STORAGE_KEYS.settings),
      localforage.getItem(STORAGE_KEYS.topMark),
      localforage.getItem(STORAGE_KEYS.bottomMark),
      localforage.getItem(STORAGE_KEYS.sightings)
    ]);

    if (savedSettings) {
      stats.settings.bearingMode =
        savedSettings.bearingMode === "magnetic" ? "magnetic" : "true";
      stats.settings.declination = Number.isFinite(savedSettings.declination)
        ? savedSettings.declination
        : 0;
    }
    restoreMark("Top Mark", topMark);
    restoreMark("Bottom Mark", bottomMark);
    stats.sightings = Array.isArray(savedSightings) ? savedSightings : [];
  } catch (error) {
    console.error("Unable to restore V2 data.", error);
  }

  updateMarkButtons();
  computeWingMarks();
  updateBearingModeUI();
  renderSightings();
  watchLocation(updatePosition, handleLocationError);
  window.setInterval(updateUI, UPDATE_INTERVAL_MS);
  updateUI();
}

function restoreMark(markName, location) {
  if (
    Array.isArray(location) &&
    location.length === 2 &&
    location.every(Number.isFinite)
  ) {
    stats.marks[markName].location = location;
    stats.marks[markName].status = "enabled";
  }
}

function updatePosition(position) {
  const timestamp = Number.isFinite(position.timestamp) ? position.timestamp : Date.now();
  const newPosition = [position.coords.latitude, position.coords.longitude];
  stats.locationRaw = newPosition;
  stats.locationAccuracy = Number.isFinite(position.coords.accuracy)
    ? position.coords.accuracy
    : null;
  stats.locationError = null;
  stats.locationQueue.push(newPosition);
  if (stats.locationQueue.length > 3) stats.locationQueue.shift();

  const weights = stats.locationQueue.length === 1
    ? [1]
    : stats.locationQueue.length === 2
      ? [0.35, 0.65]
      : [0.10, 0.25, 0.65];
  const location = [0, 0];
  for (let i = 0; i < stats.locationQueue.length; i += 1) {
    location[0] += stats.locationQueue[i][0] * weights[i];
    location[1] += stats.locationQueue[i][1] * weights[i];
  }

  if (stats.location && stats.time !== null && timestamp > stats.time) {
    const elapsedHours = (timestamp - stats.time) / 3600000;
    stats.speed = distanceBetween(stats.location, location) / elapsedHours;
    if (distanceBetween(stats.location, location) > 0.0005) {
      stats.courseTrue = courseBetween(stats.location, location);
    }
  }

  stats.location = location;
  stats.time = timestamp;
  updateTargetNavigation();
}

function handleLocationError(error) {
  stats.locationError = error && error.message ? error.message : "GPS position unavailable";
  console.error("Geolocation error:", stats.locationError);
}

function updateTargetNavigation() {
  if (!stats.targetMark || !stats.location) return;
  const targetLocation = stats.marks[stats.targetMark].location;
  if (!targetLocation) return;
  stats.targetDistance = distanceBetween(stats.location, targetLocation);
  stats.targetCourseTrue = courseBetween(stats.location, targetLocation);
}

function bearingToTrue(bearingInSelectedMode) {
  if (stats.settings.bearingMode === "magnetic") {
    return normalizeBearing(bearingInSelectedMode + stats.settings.declination);
  }
  return normalizeBearing(bearingInSelectedMode);
}

function trueToSelectedBearing(trueBearing) {
  if (stats.settings.bearingMode === "magnetic") {
    return normalizeBearing(trueBearing - stats.settings.declination);
  }
  return normalizeBearing(trueBearing);
}

function phoneMagneticToSelectedBearing(magneticBearing) {
  if (stats.settings.bearingMode === "magnetic") {
    return normalizeBearing(magneticBearing);
  }
  return normalizeBearing(magneticBearing + stats.settings.declination);
}

function phoneMagneticToTrueBearing(magneticBearing) {
  return normalizeBearing(magneticBearing + stats.settings.declination);
}

function formatDistance(value) {
  if (!Number.isFinite(value) || value > 99.9 || value < 0) return "-.--";
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function formatBearing(value) {
  if (!Number.isFinite(value)) return "---";
  return String(Math.round(normalizeBearing(value)) % 360).padStart(3, "0");
}

function updateUI() {
  document.getElementById("curSpeed").textContent = formatDistance(stats.speed);
  document.getElementById("curCourse").textContent =
    formatBearing(Number.isFinite(stats.courseTrue)
      ? trueToSelectedBearing(stats.courseTrue)
      : null);
  document.getElementById("nxtDistance").textContent = formatDistance(stats.targetDistance);
  document.getElementById("nxtCourse").textContent =
    formatBearing(Number.isFinite(stats.targetCourseTrue)
      ? trueToSelectedBearing(stats.targetCourseTrue)
      : null);

  const gpsStatus = document.getElementById("gpsStatus");
  if (stats.locationError) {
    gpsStatus.textContent = `GPS: ${stats.locationError}`;
    gpsStatus.className = "status error";
  } else if (stats.locationRaw) {
    const accuracyText = Number.isFinite(stats.locationAccuracy)
      ? ` ±${Math.round(stats.locationAccuracy)}m`
      : "";
    gpsStatus.textContent = `GPS READY${accuracyText}`;
    gpsStatus.className = "status ready";
  } else {
    gpsStatus.textContent = "WAITING FOR GPS";
    gpsStatus.className = "status warning";
  }

  updateCompassPanel();
}

function updateBearingModeUI() {
  const suffix = stats.settings.bearingMode === "magnetic" ? "MAG" : "TRUE";
  document.getElementById("courseLabel").textContent = `COG (${suffix})`;
  document.getElementById("nextCourseLabel").textContent = `NEXT BRG (${suffix})`;
  document.getElementById("modeBanner").textContent =
    stats.settings.bearingMode === "magnetic"
      ? `ALL BEARINGS MAGNETIC · ${formatDeclination(stats.settings.declination)}`
      : "ALL BEARINGS TRUE";
}

function formatDeclination(value) {
  const direction = value < 0 ? "W" : "E";
  return `${Math.abs(value).toFixed(1)}° ${direction}`;
}

function markButtonClicked(markName) {
  if (stats.targetMark) {
    document.getElementById(stats.targetMark).className =
      stats.marks[stats.targetMark].status;
  }

  if (stats.marks[markName].status === "enabled") {
    stats.targetMark = markName;
    document.getElementById(markName).className = "target";
    updateTargetNavigation();
  } else {
    stats.targetMark = null;
    stats.targetDistance = null;
    stats.targetCourseTrue = null;
  }
  updateUI();
}

function updateMarkButtons() {
  for (const [markName, mark] of Object.entries(stats.marks)) {
    const button = document.getElementById(markName);
    if (button) button.className = mark.status;
  }
}

async function pingMark(markName) {
  if (!stats.locationRaw) {
    showMessage("A valid GPS position is required before setting a mark.");
    return;
  }

  stats.marks[markName].location = [...stats.locationRaw];
  enableMark(markName);
  await saveMark(markName);
  computeWingMarks();
  closeDialog("markDialog");
}

async function saveMark(markName) {
  const key = markName === "Top Mark" ? STORAGE_KEYS.topMark : STORAGE_KEYS.bottomMark;
  try {
    await localforage.setItem(key, stats.marks[markName].location);
  } catch (error) {
    console.error(`Unable to save ${markName}.`, error);
    showMessage(`${markName} is set for this session but could not be saved.`);
  }
}

async function clearMark(markName) {
  stats.marks[markName].location = null;
  disableMark(markName);
  const key = markName === "Top Mark" ? STORAGE_KEYS.topMark : STORAGE_KEYS.bottomMark;
  try {
    await localforage.removeItem(key);
  } catch (error) {
    console.error(`Unable to remove ${markName}.`, error);
  }

  clearWingMarks();
  if (stats.targetMark === markName) {
    stats.targetMark = null;
    stats.targetDistance = null;
    stats.targetCourseTrue = null;
  }
  closeDialog("markDialog");
  updateUI();
}

function enableMark(markName) {
  stats.marks[markName].status = "enabled";
  const button = document.getElementById(markName);
  if (button) button.className = "enabled";
}

function disableMark(markName) {
  stats.marks[markName].status = "disabled";
  const button = document.getElementById(markName);
  if (button) button.className = "disabled";
}

function clearWingMarks() {
  for (const markName of ["Wing Mark Port", "Wing Mark Stbd"]) {
    stats.marks[markName].location = null;
    disableMark(markName);
  }
}

function computeWingMarks() {
  const top = stats.marks["Top Mark"].location;
  const bottom = stats.marks["Bottom Mark"].location;
  if (!top || !bottom || distanceBetween(top, bottom) < 0.001) {
    clearWingMarks();
    return;
  }

  const courseLength = distanceBetween(bottom, top);
  const centreCourse = courseBetween(bottom, top);
  const wingDistance = Math.SQRT1_2 * courseLength;
  stats.marks["Wing Mark Port"].location = projectDistance(
    bottom,
    wingDistance,
    centreCourse - WING_MARK_ANGLE
  );
  stats.marks["Wing Mark Stbd"].location = projectDistance(
    bottom,
    wingDistance,
    centreCourse + WING_MARK_ANGLE
  );
  enableMark("Wing Mark Port");
  enableMark("Wing Mark Stbd");
}

function openMarkDialog() {
  document.getElementById("markDialog").showModal();
}

function openSettings() {
  document.getElementById("bearingMode").value = stats.settings.bearingMode;
  document.getElementById("declinationMagnitude").value =
    Math.abs(stats.settings.declination).toFixed(1);
  document.getElementById("declinationDirection").value =
    stats.settings.declination < 0 ? "west" : "east";
  document.getElementById("settingsDialog").showModal();
}

async function saveSettings() {
  const magnitude = Number(document.getElementById("declinationMagnitude").value);
  if (!Number.isFinite(magnitude) || magnitude < 0 || magnitude > 30) {
    showMessage("Enter a magnetic declination between 0° and 30°.");
    return;
  }

  const direction = document.getElementById("declinationDirection").value;
  stats.settings.bearingMode =
    document.getElementById("bearingMode").value === "magnetic" ? "magnetic" : "true";
  stats.settings.declination = magnitude * (direction === "west" ? -1 : 1);

  try {
    await localforage.setItem(STORAGE_KEYS.settings, stats.settings);
  } catch (error) {
    console.error("Unable to save settings.", error);
    showMessage("Settings are active but could not be saved.");
  }

  updateBearingModeUI();
  updateUI();
  renderSightings();
  closeDialog("settingsDialog");
}

function openDeclinationCalculator() {
  window.open(
    "https://www.ngdc.noaa.gov/geomag/calculators/magcalc.shtml#declination",
    "_blank",
    "noopener"
  );
}

function openSightings() {
  renderSightings();
  document.getElementById("sightingDialog").showModal();
}

function handleOrientation(event) {
  let heading = null;
  let tiltOkay = true;

  if (Number.isFinite(event.webkitCompassHeading)) {
    heading = normalizeBearing(event.webkitCompassHeading);
    stats.compass.accuracy = Number.isFinite(event.webkitCompassAccuracy)
      ? Math.abs(event.webkitCompassAccuracy)
      : null;
  } else if (
    event.absolute === true &&
    Number.isFinite(event.alpha) &&
    Number.isFinite(event.beta) &&
    Number.isFinite(event.gamma)
  ) {
    const screenAngle = screen.orientation && Number.isFinite(screen.orientation.angle)
      ? screen.orientation.angle
      : Number(window.orientation) || 0;
    tiltOkay = Math.abs(event.beta) <= 35 && Math.abs(event.gamma) <= 35;
    heading = normalizeBearing(360 - event.alpha + screenAngle);
    stats.compass.accuracy = null;
  }

  if (!Number.isFinite(heading)) return;
  const now = Date.now();
  stats.compass.samples.push({ value: heading, time: now });
  stats.compass.samples = stats.compass.samples.filter(sample => now - sample.time <= 2000);
  const summary = circularSummary(stats.compass.samples.map(sample => sample.value));
  stats.compass.headingMagnetic = summary.mean;
  stats.compass.spread = summary.rmsSpread;
  stats.compass.tiltOkay = tiltOkay;
  stats.compass.message = "Compass ready";
  updateCompassPanel();
}

async function startCompass() {
  stats.compass.samples = [];
  stats.compass.headingMagnetic = null;
  stats.compass.spread = null;

  try {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const permission = await DeviceOrientationEvent.requestPermission();
      stats.compass.permission = permission;
      if (permission !== "granted") {
        stats.compass.message = "Compass permission denied";
        updateCompassPanel();
        return;
      }
    } else {
      stats.compass.permission = "granted";
    }

    if (!stats.compass.listening) {
      window.addEventListener("deviceorientationabsolute", handleOrientation, true);
      window.addEventListener("deviceorientation", handleOrientation, true);
      window.addEventListener("compassneedscalibration", () => {
        stats.compass.message = "Compass needs calibration";
        updateCompassPanel();
      });
      stats.compass.listening = true;
    }
    stats.compass.message = "Point the phone's top edge at the mark";
  } catch (error) {
    stats.compass.permission = "denied";
    stats.compass.message = "Compass unavailable";
    console.error("Unable to start compass.", error);
  }
  updateCompassPanel();
}

function compassStatus() {
  if (!Number.isFinite(stats.compass.headingMagnetic)) {
    return { label: stats.compass.message, className: "warning", canCapture: false };
  }
  if (!stats.compass.tiltOkay) {
    return { label: "Hold phone approximately flat", className: "warning", canCapture: false };
  }
  if (stats.compass.samples.length < 5) {
    return { label: "Hold steady…", className: "warning", canCapture: false };
  }
  if (stats.compass.spread > 5) {
    return {
      label: `UNSTABLE ±${stats.compass.spread.toFixed(1)}°`,
      className: "error",
      canCapture: false
    };
  }
  if (
    Number.isFinite(stats.compass.accuracy) &&
    stats.compass.accuracy > 15
  ) {
    return {
      label: `POOR SENSOR ACCURACY ±${stats.compass.accuracy.toFixed(0)}°`,
      className: "error",
      canCapture: false
    };
  }
  const accuracy = Number.isFinite(stats.compass.accuracy)
    ? ` · sensor ±${stats.compass.accuracy.toFixed(0)}°`
    : "";
  return {
    label: `STABLE ±${stats.compass.spread.toFixed(1)}°${accuracy}`,
    className: "ready",
    canCapture: Boolean(stats.locationRaw)
  };
}

function updateCompassPanel() {
  const headingElement = document.getElementById("liveCompassHeading");
  if (!headingElement) return;

  const selectedHeading = Number.isFinite(stats.compass.headingMagnetic)
    ? phoneMagneticToSelectedBearing(stats.compass.headingMagnetic)
    : null;
  headingElement.textContent = formatBearing(selectedHeading);
  const status = compassStatus();
  const statusElement = document.getElementById("compassStatus");
  statusElement.textContent = status.label;
  statusElement.className = `status ${status.className}`;
  document.getElementById("capturePhoneSighting").disabled = !status.canCapture;
}

async function capturePhoneSighting() {
  const status = compassStatus();
  if (!status.canCapture || !stats.locationRaw) {
    showMessage("Wait for a stable compass heading and valid GPS position.");
    return;
  }

  const summary = circularSummary(stats.compass.samples.map(sample => sample.value));
  const bearingTrue = phoneMagneticToTrueBearing(summary.mean);
  stats.sightings.push({
    id: Date.now(),
    source: "phone",
    location: [...stats.locationRaw],
    gpsAccuracy: stats.locationAccuracy,
    bearingEntered: phoneMagneticToSelectedBearing(summary.mean),
    bearingTrue,
    compassSpread: summary.rmsSpread,
    compassAccuracy: stats.compass.accuracy,
    bearingMode: stats.settings.bearingMode,
    declination: stats.settings.declination,
    timestamp: new Date().toISOString()
  });
  await persistSightings();
  stats.compass.samples = [];
  calculateSightingSolution();
  renderSightings();
}

async function captureManualSighting() {
  const enteredBearing = Number(document.getElementById("manualBearing").value);
  if (!Number.isFinite(enteredBearing) || enteredBearing < 0 || enteredBearing >= 360) {
    showMessage("Enter a bearing from 0° up to 359.9°.");
    return;
  }
  if (!stats.locationRaw) {
    showMessage("A valid GPS position is required to capture the manual sighting.");
    return;
  }

  stats.sightings.push({
    id: Date.now(),
    source: "manual",
    location: [...stats.locationRaw],
    gpsAccuracy: stats.locationAccuracy,
    bearingEntered: normalizeBearing(enteredBearing),
    bearingTrue: bearingToTrue(enteredBearing),
    bearingMode: stats.settings.bearingMode,
    declination: stats.settings.declination,
    timestamp: new Date().toISOString()
  });
  document.getElementById("manualBearing").value = "";
  await persistSightings();
  calculateSightingSolution();
  renderSightings();
}

async function removeSighting(id) {
  stats.sightings = stats.sightings.filter(sighting => sighting.id !== id);
  await persistSightings();
  calculateSightingSolution();
  renderSightings();
}

async function clearSightings() {
  stats.sightings = [];
  stats.sightingSolution = null;
  await persistSightings();
  renderSightings();
}

async function persistSightings() {
  try {
    await localforage.setItem(STORAGE_KEYS.sightings, stats.sightings);
  } catch (error) {
    console.error("Unable to save sightings.", error);
    showMessage("Sightings are active for this session but could not be saved.");
  }
}

function calculateSightingSolution() {
  stats.sightingSolution = solveBearingSightings(stats.sightings);
  return stats.sightingSolution;
}

async function acceptSightingSolution() {
  const solution = calculateSightingSolution();
  if (!solution.ok) {
    showMessage(solution.reason);
    return;
  }
  if (solution.quality === "POOR") {
    showMessage("The sighting geometry is poor. Add a better-separated sighting before accepting.");
    return;
  }

  stats.marks["Top Mark"].location = [...solution.location];
  enableMark("Top Mark");
  await saveMark("Top Mark");
  computeWingMarks();
  closeDialog("sightingDialog");
  closeDialog("markDialog");
}

function renderSightings() {
  const list = document.getElementById("sightingList");
  if (!list) return;
  document.getElementById("sightingMode").textContent =
    `CURRENT MODE: ${stats.settings.bearingMode.toUpperCase()}`;

  if (!stats.sightings.length) {
    list.innerHTML = '<div class="empty-state">No sightings captured</div>';
  } else {
    list.innerHTML = stats.sightings.map((sighting, index) => {
      const source = sighting.source === "phone" ? "PHONE" : "MANUAL";
      const bearing = formatBearing(trueToSelectedBearing(sighting.bearingTrue));
      const accuracy = Number.isFinite(sighting.gpsAccuracy)
        ? `GPS ±${Math.round(sighting.gpsAccuracy)}m`
        : "GPS accuracy unknown";
      return `
        <div class="sighting-row">
          <span>${index + 1}. ${source} ${bearing}° · ${accuracy}</span>
          <button type="button" class="small danger" onclick="removeSighting(${sighting.id})">REMOVE</button>
        </div>`;
    }).join("");
  }

  const solutionElement = document.getElementById("solutionSummary");
  const acceptButton = document.getElementById("acceptSolution");
  if (stats.sightings.length < 2) {
    stats.sightingSolution = null;
    solutionElement.textContent = "Capture at least two well-separated sightings.";
    solutionElement.className = "solution neutral";
    acceptButton.disabled = true;
    return;
  }

  const solution = calculateSightingSolution();
  if (!solution.ok) {
    solutionElement.textContent = solution.reason;
    solutionElement.className = "solution poor";
    acceptButton.disabled = true;
    return;
  }

  solutionElement.innerHTML = `
    <strong>${solution.quality}</strong> · crossing ${solution.crossingAngle.toFixed(0)}° ·
    residual ${solution.rmsResidualMetres.toFixed(0)}m<br>
    ${solution.location[0].toFixed(6)}, ${solution.location[1].toFixed(6)}
  `;
  solutionElement.className = `solution ${solution.quality.toLowerCase()}`;
  acceptButton.disabled = solution.quality === "POOR";
}

function closeDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (dialog && dialog.open) dialog.close();
}

function showMessage(message) {
  document.getElementById("messageText").textContent = message;
  document.getElementById("messageDialog").showModal();
}

window.startUp = startUp;
window.markButtonClicked = markButtonClicked;
window.openMarkDialog = openMarkDialog;
window.openSettings = openSettings;
window.saveSettings = saveSettings;
window.openDeclinationCalculator = openDeclinationCalculator;
window.pingMark = pingMark;
window.clearMark = clearMark;
window.openSightings = openSightings;
window.startCompass = startCompass;
window.capturePhoneSighting = capturePhoneSighting;
window.captureManualSighting = captureManualSighting;
window.removeSighting = removeSighting;
window.clearSightings = clearSightings;
window.acceptSightingSolution = acceptSightingSolution;
window.closeDialog = closeDialog;
