(() => {
  "use strict";

  const STORAGE_KEY = "nearer-hidden-country-duel-v1";
  const core = window.NEARER_TOGETHER_CORE;
  const d3 = window.NEARER_D3;
  const geoData = window.NEARER_COUNTRIES_GEOJSON;
  if (!core || !d3 || !geoData) return;

  const card = document.querySelector(".mode-pressure-card");
  if (!card) return;

  const featureByCode = new Map(geoData.features.map(feature => [feature.properties.code, feature]));
  const polygonCollection = { type: "FeatureCollection", features: geoData.features.filter(feature => feature.geometry.type !== "Point") };
  const radar = document.createElement("div");
  radar.className = "pressure-radar";
  radar.innerHTML = '<canvas aria-hidden="true"></canvas><div class="pressure-radar-empty">The pressure radius appears after your opponent records their first signal.</div><div class="pressure-radar-label is-hidden"><span>Approximate pressure radius</span><strong></strong></div>';
  const key = document.createElement("div");
  key.className = "pressure-key";
  key.innerHTML = '<span>The ring shrinks as their best guess gets closer.</span><strong>Border-distance signal</strong>';
  const metrics = card.querySelector(".pressure-metric");
  card.insertBefore(radar, metrics || null);
  if (metrics) card.insertBefore(key, metrics); else card.append(key);

  const canvas = radar.querySelector("canvas");
  const context = canvas.getContext("2d", { alpha: true });
  const empty = radar.querySelector(".pressure-radar-empty");
  const label = radar.querySelector(".pressure-radar-label");
  const labelValue = label.querySelector("strong");
  let lastWidth = 0;
  let lastHeight = 0;
  let queued = false;

  function readState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
    catch { return null; }
  }

  function closest(guesses) {
    return guesses?.length ? [...guesses].sort((a, b) => a.distance - b.distance || a.order - b.order)[0] : null;
  }

  function displayDistance(km, units) {
    if (km === 0) return "Found";
    return units === "mi" ? `${Math.round(km * .621371).toLocaleString()} mi` : `${Math.round(km).toLocaleString()} km`;
  }

  function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function threat(distance) {
    if (distance === null || distance === undefined) return "none";
    if (distance <= 200) return "critical";
    if (distance <= 805) return "danger";
    if (distance <= 1609) return "closing";
    return "searching";
  }

  function colours() {
    const css = getComputedStyle(document.documentElement);
    const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    return {
      ocean: get("--globe-ocean", "#537a92"),
      oceanShadow: get("--globe-ocean-shadow", "#29495f"),
      land: get("--globe-land", "#d8d7ce"),
      border: get("--globe-border", "rgba(23,39,49,.34)"),
      grid: get("--globe-grid", "rgba(255,255,255,.16)"),
      ink: get("--ink", "#111820")
    };
  }

  function resize() {
    const rect = radar.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    if (width !== lastWidth || height !== lastHeight) {
      lastWidth = width;
      lastHeight = height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height };
  }

  function drawPath(path, feature, fill, stroke, width = 1, dash = []) {
    context.save();
    context.beginPath();
    path(feature);
    if (fill) { context.fillStyle = fill; context.fill("evenodd"); }
    if (stroke) { context.strokeStyle = stroke; context.lineWidth = width; context.setLineDash(dash); context.stroke(); }
    context.restore();
  }

  function render() {
    queued = false;
    const state = readState();
    const { width, height } = resize();
    const palette = colours();
    if (!state?.revealsComplete || !state.players?.length || !state.targets?.length) {
      empty.classList.remove("is-hidden");
      label.classList.add("is-hidden");
      card.dataset.threat = "none";
      return;
    }

    const current = state.currentPlayer || 0;
    const defendedCode = state.targets[current];
    const defended = featureByCode.get(defendedCode);
    const opponent = state.players[1 - current];
    const best = closest(opponent?.guesses || []);
    const centroid = defended?.geometry?.type === "Point" ? defended.geometry.coordinates : defended ? d3.geoCentroid(defended) : null;
    if (!defended || !centroid) return;

    const projection = d3.geoOrthographic().clipAngle(90).precision(.5).translate([width / 2, height * .47]).scale(Math.min(width, height) * .43).rotate([-centroid[0], -centroid[1], 0]);
    const path = d3.geoPath(projection, context);
    context.save();
    context.beginPath();
    context.arc(width / 2, height * .47, projection.scale(), 0, Math.PI * 2);
    context.fillStyle = palette.oceanShadow;
    context.fill();
    context.clip();
    context.fillStyle = palette.ocean;
    context.fillRect(0, 0, width, height);
    context.restore();
    drawPath(path, d3.geoGraticule10(), null, palette.grid, .65);
    drawPath(path, polygonCollection, palette.land, palette.border, .55);
    drawPath(path, defended, "#d8a432", "#fff", 2.2);

    const level = threat(best?.distance);
    card.dataset.threat = level;
    if (!best) {
      setText(empty, `${opponent?.name || "Your opponent"} has not recorded a signal towards your country yet.`);
      empty.classList.remove("is-hidden");
      label.classList.add("is-hidden");
      return;
    }

    empty.classList.add("is-hidden");
    label.classList.remove("is-hidden");
    setText(labelValue, `${displayDistance(best.distance, state.units)} around ${core.countryByCode.get(defendedCode)?.name || "your country"}`);

    if (best.distance > 3219) {
      setText(empty, "Their closest guess is still outside the 2,000-mile pressure view.");
      empty.classList.remove("is-hidden");
      empty.style.background = "linear-gradient(180deg,transparent,rgba(0,0,0,.08))";
      return;
    }
    empty.style.background = "";

    const radiusDegrees = Math.max(.8, best.distance / 111.195);
    const circle = d3.geoCircle().center(centroid).radius(radiusDegrees).precision(2)();
    const ringColour = level === "critical" ? "#d33d4d" : level === "danger" ? "#dc6b36" : level === "closing" ? "#d99a2b" : "#4d8bd1";
    drawPath(path, circle, `${ringColour}22`, ringColour, level === "critical" ? 3 : 2.1, [7, 5]);

    const point = projection(centroid);
    if (point) {
      context.save();
      context.beginPath();
      context.arc(point[0], point[1], 5, 0, Math.PI * 2);
      context.fillStyle = "#fff";
      context.fill();
      context.strokeStyle = ringColour;
      context.lineWidth = 2.5;
      context.stroke();
      context.restore();
    }
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(render);
  }

  new ResizeObserver(queue).observe(radar);
  const observer = new MutationObserver(queue);
  observer.observe(card, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  window.addEventListener("storage", queue);
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", queue);
  document.getElementById("themeButton")?.addEventListener("click", () => setTimeout(queue));
  queue();
  window.__NEARER_DUEL_PRESSURE_STARTED = true;
})();
