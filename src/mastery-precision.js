import "./mastery-precision.css";

const REGION_VIEWS = {
  europe: { name: "Europe", centre: [14, 52], zoom: 1.65 },
  africa: { name: "Africa", centre: [18, 2], zoom: 1.18 },
  asia: { name: "Asia", centre: [88, 34], zoom: 1.02 },
  "north-america": { name: "North America", centre: [-98, 35], zoom: 1.18 },
  "south-america": { name: "South America", centre: [-61, -17], zoom: 1.25 },
  oceania: { name: "Oceania", centre: [151, -18], zoom: 1.15 }
};

const SESSION_KEY = "nearer-mastery-session-v1";
const DETAIL_ZOOM = 3.2;
const MAX_ZOOM = 4.5;
const MIN_ZOOM = 0.78;

function clampZoom(value) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function safeSession() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return value?.version === 1 ? value : null;
  } catch {
    return null;
  }
}

function pointerDistance(values) {
  const [first, second] = values;
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function installMasteryPrecision() {
  if (window.__NEARER_MASTERY_PRECISION_INSTALLED) return;
  window.__NEARER_MASTERY_PRECISION_INSTALLED = true;

  const d3 = window.NEARER_D3;
  const gameData = window.NEARER_GAME_DATA;
  const geoData = window.NEARER_COUNTRIES_GEOJSON;
  const stage = document.getElementById("masteryGlobeStage");
  const canvas = document.getElementById("masteryGlobeCanvas");
  const zoomIn = document.getElementById("masteryZoomIn");
  const zoomOut = document.getElementById("masteryZoomOut");
  const reset = document.getElementById("resetMasteryGlobe");
  const regionLabel = document.getElementById("currentRegionLabel");
  const reveal = document.getElementById("revealCountryButton");
  const hint = stage?.querySelector(".mastery-globe-hint");

  if (!d3 || !gameData || !geoData || !stage || !canvas || !zoomIn || !zoomOut || !reset) return;

  const countryByCode = new Map(gameData.countries.map(country => [country.code, country]));
  const featureByCode = new Map(geoData.features.map(feature => [feature.properties.code, feature]));
  const polygonFeatures = geoData.features.filter(feature => feature.geometry.type !== "Point" && countryByCode.has(feature.properties.code));
  const pointFeatures = geoData.features.filter(feature => feature.geometry.type === "Point" && countryByCode.has(feature.properties.code));
  const projection = d3.geoOrthographic().clipAngle(90).precision(.45);
  const path = d3.geoPath(projection);
  const state = {
    regionId: "europe",
    rotation: [-14, -52, 0],
    zoom: REGION_VIEWS.europe.zoom,
    pointers: new Map(),
    interaction: null,
    synthetic: false,
    noteTimer: 0
  };

  function regionIdFromLabel() {
    const label = String(regionLabel?.textContent || "").trim().toLowerCase();
    return Object.entries(REGION_VIEWS).find(([, region]) => region.name.toLowerCase() === label)?.[0] || safeSession()?.regionId || state.regionId;
  }

  function setRegion(regionId = regionIdFromLabel()) {
    const region = REGION_VIEWS[regionId];
    if (!region) return;
    state.regionId = regionId;
    state.rotation = [-region.centre[0], -region.centre[1], 0];
    state.zoom = region.zoom;
    updateZoomLabel();
  }

  function configureProjection() {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    projection
      .translate([width / 2, height / 2])
      .scale(Math.min(width, height) * .425 * state.zoom)
      .rotate(state.rotation)
      .precision(.45);
    return rect;
  }

  function featureCoordinate(feature) {
    if (!feature) return null;
    return feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature);
  }

  function visible(coordinate) {
    return coordinate && d3.geoDistance([-state.rotation[0], -state.rotation[1]], coordinate) <= Math.PI / 2 + .015;
  }

  function metricsFor(feature) {
    if (!feature) return null;
    const rect = configureProjection();
    const coordinate = featureCoordinate(feature);
    if (!visible(coordinate)) return { visible: false, feature, rect };
    const centroid = projection(coordinate);
    if (!centroid) return { visible: false, feature, rect };
    let width = 0;
    let height = 0;
    if (feature.geometry.type !== "Point") {
      const bounds = path.bounds(feature);
      if (Number.isFinite(bounds[0][0]) && Number.isFinite(bounds[1][0])) {
        width = Math.max(0, bounds[1][0] - bounds[0][0]);
        height = Math.max(0, bounds[1][1] - bounds[0][1]);
      }
    }
    const size = Math.max(width, height);
    return {
      visible: true,
      feature,
      rect,
      point: [centroid[0] + rect.left, centroid[1] + rect.top],
      width,
      height,
      size,
      small: feature.geometry.type === "Point" || size < 34
    };
  }

  function currentTargetMetrics() {
    const code = safeSession()?.current;
    return code ? metricsFor(featureByCode.get(code)) : null;
  }

  function featureAt(clientX, clientY) {
    const rect = configureProjection();
    const local = [clientX - rect.left, clientY - rect.top];
    const translate = projection.translate();
    if (Math.hypot(local[0] - translate[0], local[1] - translate[1]) > projection.scale()) return null;

    for (const feature of pointFeatures) {
      const coordinate = feature.geometry.coordinates;
      if (!visible(coordinate)) continue;
      const projected = projection(coordinate);
      if (projected && Math.hypot(projected[0] - local[0], projected[1] - local[1]) <= 18) return feature;
    }

    const coordinate = projection.invert(local);
    if (!coordinate) return null;
    return polygonFeatures.find(feature => d3.geoContains(feature, coordinate)) || null;
  }

  function targetAssist(event) {
    const target = currentTargetMetrics();
    if (!target?.visible || !target.small) return null;
    const touch = event.pointerType === "touch" || matchMedia("(pointer:coarse)").matches;
    const baseRadius = target.feature.geometry.type === "Point" ? (touch ? 30 : 22) : (touch ? 25 : 18);
    const radius = Math.max(baseRadius, Math.min(touch ? 34 : 26, 40 - target.size * .45));
    const distance = Math.hypot(event.clientX - target.point[0], event.clientY - target.point[1]);
    if (distance <= radius) return { type: "target", target, radius };

    const tapped = featureAt(event.clientX, event.clientY);
    const tappedMetrics = metricsFor(tapped);
    const crowdedRadius = radius + (touch ? 34 : 24);
    if (
      state.zoom < DETAIL_ZOOM
      && distance <= crowdedRadius
      && (tappedMetrics?.small || target.feature.geometry.type === "Point" || target.size < 20)
    ) {
      return { type: "precision", target, tapped: tappedMetrics };
    }
    if (state.zoom < 2.65 && tappedMetrics?.small) return { type: "precision", target, tapped: tappedMetrics };
    return null;
  }

  function proxyPointerEvent(event, clientX, clientY) {
    return new Proxy(event, {
      get(target, property) {
        if (property === "clientX") return clientX;
        if (property === "clientY") return clientY;
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      }
    });
  }

  function dispatchSyntheticMove(pointerId, x, y, pointerType) {
    if (typeof PointerEvent !== "function") return;
    stage.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType,
      clientX: x,
      clientY: y,
      buttons: 1
    }));
  }

  function dispatchAssistedUp(event, point) {
    if (typeof PointerEvent !== "function") return false;
    state.synthetic = true;
    try {
      stage.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        clientX: point[0],
        clientY: point[1],
        button: event.button,
        buttons: 0
      }));
      return true;
    } finally {
      state.synthetic = false;
    }
  }

  function showNote(message) {
    let note = stage.querySelector(".mastery-precision-note");
    if (!note) {
      note = document.createElement("div");
      note.className = "mastery-precision-note";
      note.setAttribute("role", "status");
      note.setAttribute("aria-live", "polite");
      stage.append(note);
    }
    note.textContent = message;
    note.classList.add("is-visible");
    clearTimeout(state.noteTimer);
    state.noteTimer = setTimeout(() => note.classList.remove("is-visible"), 2800);
  }

  function updateZoomLabel() {
    const button = stage.querySelector("[data-mastery-detail-zoom]");
    if (!button) return;
    button.querySelector("span").textContent = state.zoom >= DETAIL_ZOOM ? "Detail view" : "Detail zoom";
    button.querySelector("small").textContent = `${state.zoom.toFixed(1)}×`;
    button.classList.toggle("is-active", state.zoom >= DETAIL_ZOOM);
  }

  function zoomToDetail(message = "Detail zoom is ready. Tap the country again.") {
    let guard = 0;
    while (state.zoom < DETAIL_ZOOM && guard < 6) {
      zoomIn.click();
      guard += 1;
    }
    updateZoomLabel();
    showNote(message);
  }

  function addControls() {
    if (!stage.querySelector("[data-mastery-detail-zoom]")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mastery-precision-zoom";
      button.dataset.masteryDetailZoom = "";
      button.innerHTML = "<span>Detail zoom</span><small>1.0×</small>";
      button.addEventListener("click", () => zoomToDetail("Detail zoom is on. Pinch or use + to go closer."));
      stage.append(button);
    }
    if (hint) hint.textContent = "Drag to rotate · pinch or use + to zoom · small taps are protected";
    updateZoomLabel();
  }

  function hideNeutralMicrostateDots() {
    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!context || context.__nearerNeutralPointPatch) return;
    context.__nearerNeutralPointPatch = true;
    const originalArc = context.arc.bind(context);
    const originalFill = context.fill.bind(context);
    const originalStroke = context.stroke.bind(context);
    let suppress = false;

    context.arc = function patchedArc(x, y, radius, startAngle, endAngle, counterclockwise) {
      suppress = Math.abs(radius - 3.8) < .02;
      if (!suppress) originalArc(x, y, radius, startAngle, endAngle, counterclockwise);
    };
    context.fill = function patchedFill(...args) {
      if (!suppress) return originalFill(...args);
    };
    context.stroke = function patchedStroke(...args) {
      if (!suppress) return originalStroke(...args);
      suppress = false;
    };
  }

  function updateRegionFromSession() {
    setRegion(safeSession()?.regionId || regionIdFromLabel());
  }

  stage.addEventListener("pointerdown", event => {
    if (state.synthetic || event.target.closest("button")) return;
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.pointers.size === 1) {
      state.interaction = { type: "rotate", x: event.clientX, y: event.clientY, rotation: [...state.rotation], moved: false };
    } else {
      state.interaction = {
        type: "pinch",
        distance: pointerDistance([...state.pointers.values()].slice(0, 2)),
        zoom: state.zoom,
        moved: true
      };
    }
  }, true);

  stage.addEventListener("pointermove", event => {
    if (state.synthetic || !state.pointers.has(event.pointerId) || !state.interaction) return;
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.pointers.size >= 2) {
      const distance = pointerDistance([...state.pointers.values()].slice(0, 2));
      if (state.interaction.type !== "pinch") state.interaction = { type: "pinch", distance, zoom: state.zoom, moved: true };
      if (state.interaction.distance > 0) state.zoom = clampZoom(state.interaction.zoom * distance / state.interaction.distance);
      state.interaction.moved = true;
      updateZoomLabel();
      return;
    }
    const dx = event.clientX - state.interaction.x;
    const dy = event.clientY - state.interaction.y;
    if (Math.hypot(dx, dy) > 5) state.interaction.moved = true;
    const rect = stage.getBoundingClientRect();
    const sensitivity = 180 / Math.max(300, Math.min(rect.width, rect.height) * state.zoom);
    state.rotation = [
      state.interaction.rotation[0] + dx * sensitivity,
      Math.max(-82, Math.min(82, state.interaction.rotation[1] - dy * sensitivity)),
      0
    ];
  }, true);

  stage.addEventListener("pointerup", event => {
    if (state.synthetic || !state.pointers.has(event.pointerId)) return;
    const tap = state.pointers.size === 1 && state.interaction?.type === "rotate" && !state.interaction.moved;
    if (tap) {
      const assist = targetAssist(event);
      if (assist?.type === "target" && dispatchAssistedUp(event, assist.target.point)) {
        state.pointers.delete(event.pointerId);
        state.interaction = null;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (assist?.type === "precision") {
        state.synthetic = true;
        try {
          dispatchSyntheticMove(event.pointerId, event.clientX + 7, event.clientY, event.pointerType);
          dispatchSyntheticMove(event.pointerId, event.clientX, event.clientY, event.pointerType);
        } finally {
          state.synthetic = false;
        }
        setTimeout(() => zoomToDetail("Crowded area — zoomed in without recording a miss."), 0);
      }
    }
    state.pointers.delete(event.pointerId);
    if (!state.pointers.size) state.interaction = null;
  }, true);

  stage.addEventListener("pointercancel", event => {
    state.pointers.delete(event.pointerId);
    if (!state.pointers.size) state.interaction = null;
  }, true);

  stage.addEventListener("wheel", event => {
    state.zoom = clampZoom(state.zoom * Math.exp(-event.deltaY * .0012));
    updateZoomLabel();
  }, true);

  zoomIn.addEventListener("click", () => {
    state.zoom = clampZoom(state.zoom * 1.25);
    updateZoomLabel();
  }, true);
  zoomOut.addEventListener("click", () => {
    state.zoom = clampZoom(state.zoom / 1.25);
    updateZoomLabel();
  }, true);
  reset.addEventListener("click", () => setTimeout(updateRegionFromSession, 0), true);
  reveal?.addEventListener("click", () => {
    const target = currentTargetMetrics();
    if (!target?.visible) return;
    const coordinate = featureCoordinate(target.feature);
    state.rotation = [-coordinate[0], -coordinate[1], 0];
    state.zoom = Math.max(1.4, Math.min(2.2, state.zoom));
    updateZoomLabel();
  }, true);

  document.getElementById("regionGrid")?.addEventListener("click", event => {
    const button = event.target.closest("button[data-region]");
    if (button) setTimeout(() => setRegion(button.dataset.region), 0);
  }, true);
  document.getElementById("continueMasteryButton")?.addEventListener("click", () => setTimeout(updateRegionFromSession, 0), true);
  document.getElementById("reviewWeakButton")?.addEventListener("click", () => setTimeout(updateRegionFromSession, 0), true);

  if (regionLabel) new MutationObserver(updateRegionFromSession).observe(regionLabel, { childList: true, characterData: true, subtree: true });
  hideNeutralMicrostateDots();
  addControls();
  updateRegionFromSession();

  window.NEARER_MASTERY_PRECISION = {
    zoomToDetail,
    targetMetrics: currentTargetMetrics,
    get state() {
      return { zoom: state.zoom, rotation: [...state.rotation], regionId: state.regionId };
    }
  };
}
