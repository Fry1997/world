(() => {
  "use strict";

  const VERSION = "20260718-globe1";
  const STORAGE_KEY = "nearer-game-v1";
  const d3 = window.NEARER_D3;
  const gameData = window.NEARER_GAME_DATA;
  const geoData = window.NEARER_COUNTRIES_GEOJSON;

  if (!d3 || !gameData || !geoData) {
    console.error("Nearer globe could not start: map data is unavailable.");
    return;
  }

  window.__NEARER_SVG_PATCH_STARTED = true;
  window.__NEARER_REAL_GLOBE_STARTED = true;

  if (!document.querySelector('link[data-nearer-globe]')) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = `globe.css?v=${VERSION}`;
    stylesheet.dataset.nearerGlobe = VERSION;
    document.head.appendChild(stylesheet);
  }

  const panel = document.querySelector(".map-panel");
  const countryInput = document.getElementById("countryInput");
  if (!panel || !countryInput) return;

  panel.innerHTML = `
    <div class="globe-toolbar">
      <div class="globe-status-group">
        <span class="signal-dot" aria-hidden="true"></span>
        <span id="globeStatus">Rotate the globe to explore</span>
      </div>
      <div class="globe-toolbar-right">
        <div class="globe-key" aria-label="Map colour key"><span>Far</span><i></i><span>Near</span></div>
        <div class="globe-actions" aria-label="Globe controls">
          <button id="globeFocus" class="globe-action" type="button" aria-label="Focus closest guess" title="Focus closest guess" disabled>
            <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
          </button>
          <button id="globeReset" class="globe-action" type="button" aria-label="Reset globe" title="Reset globe">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/></svg>
          </button>
          <button id="globeExpand" class="globe-action" type="button" aria-label="Expand globe" title="Expand globe">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="globe-stage" id="globeStage" role="application" tabindex="0" aria-label="Interactive 3D globe. Drag to rotate, pinch or scroll to zoom, and select a visible country.">
      <svg id="globeSvg" class="globe-svg" aria-hidden="true">
        <defs>
          <radialGradient id="globeOceanGradient" cx="34%" cy="27%" r="76%">
            <stop offset="0%" stop-color="var(--globe-ocean-highlight)"/>
            <stop offset="58%" stop-color="var(--globe-ocean)"/>
            <stop offset="100%" stop-color="var(--globe-ocean-shadow)"/>
          </radialGradient>
          <filter id="globeShadow" x="-35%" y="-35%" width="170%" height="180%">
            <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#08131d" flood-opacity=".30"/>
          </filter>
          <filter id="countryGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#ffffff" flood-opacity=".75"/>
          </filter>
        </defs>
        <g id="globeRoot">
          <path id="globeAtmosphere" class="globe-atmosphere"></path>
          <path id="globeOcean" class="globe-ocean" filter="url(#globeShadow)"></path>
          <path id="globeGraticule" class="globe-graticule"></path>
          <g id="globeCountries"></g>
          <g id="globePoints"></g>
          <path id="globeRim" class="globe-rim"></path>
        </g>
      </svg>
      <div class="globe-zoom" aria-label="Zoom controls">
        <button id="globeZoomIn" type="button" aria-label="Zoom in">+</button>
        <button id="globeZoomOut" type="button" aria-label="Zoom out">−</button>
      </div>
      <div class="globe-hint">Drag to rotate · pinch to zoom</div>
      <div id="globeTooltip" class="globe-tooltip is-hidden" role="tooltip"></div>
      <div id="globeSelection" class="globe-selection is-hidden" aria-live="polite">
        <button id="globeSelectionClose" class="globe-selection-close" type="button" aria-label="Close selection">×</button>
        <div><strong id="globeSelectionName">Country</strong><span id="globeSelectionMeta">Use this as your next guess</span></div>
        <button id="globeSelectionUse" class="globe-selection-use" type="button">Use as guess</button>
      </div>
    </div>`;

  const elements = {
    stage: document.getElementById("globeStage"),
    svg: document.getElementById("globeSvg"),
    atmosphere: document.getElementById("globeAtmosphere"),
    ocean: document.getElementById("globeOcean"),
    graticule: document.getElementById("globeGraticule"),
    countries: document.getElementById("globeCountries"),
    points: document.getElementById("globePoints"),
    rim: document.getElementById("globeRim"),
    status: document.getElementById("globeStatus"),
    focus: document.getElementById("globeFocus"),
    reset: document.getElementById("globeReset"),
    expand: document.getElementById("globeExpand"),
    zoomIn: document.getElementById("globeZoomIn"),
    zoomOut: document.getElementById("globeZoomOut"),
    tooltip: document.getElementById("globeTooltip"),
    selection: document.getElementById("globeSelection"),
    selectionName: document.getElementById("globeSelectionName"),
    selectionMeta: document.getElementById("globeSelectionMeta"),
    selectionUse: document.getElementById("globeSelectionUse"),
    selectionClose: document.getElementById("globeSelectionClose")
  };

  const countries = [...gameData.countries].sort((a, b) => a.name.localeCompare(b.name));
  const countryByCode = new Map(countries.map(country => [country.code, country]));
  const features = geoData.features.filter(feature => countryByCode.has(feature.properties.code));
  const featureByCode = new Map(features.map(feature => [feature.properties.code, feature]));
  const polygonFeatures = features.filter(feature => feature.geometry.type !== "Point");
  const pointFeatures = features.filter(feature => feature.geometry.type === "Point");
  const countryNodes = new Map();
  const pointNodes = new Map();

  const projection = d3.geoOrthographic().clipAngle(90).precision(0.25);
  const path = d3.geoPath(projection);
  const sphere = { type: "Sphere" };
  const graticule = d3.geoGraticule10();
  const initialRotation = [-12, -13, 0];
  let rotation = [...initialRotation];
  let zoom = 1;
  let selectedCode = null;
  let expanded = false;
  let latestRenderedCode = null;
  let animationFrame = 0;
  let renderQueued = false;
  let suppressClickUntil = 0;
  const pointers = new Map();
  let gesture = null;

  function createSvgElement(name, className) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    if (className) node.setAttribute("class", className);
    return node;
  }

  polygonFeatures.forEach(feature => {
    const code = feature.properties.code;
    const node = createSvgElement("path", "globe-country");
    node.dataset.code = code;
    node.setAttribute("vector-effect", "non-scaling-stroke");
    elements.countries.appendChild(node);
    countryNodes.set(code, node);
  });

  pointFeatures.forEach(feature => {
    const code = feature.properties.code;
    const node = createSvgElement("g", "globe-country-point");
    node.dataset.code = code;
    const halo = createSvgElement("circle", "globe-point-halo");
    const dot = createSvgElement("circle", "globe-point-dot");
    halo.setAttribute("r", "8");
    dot.setAttribute("r", "2.8");
    node.append(halo, dot);
    elements.points.appendChild(node);
    pointNodes.set(code, node);
  });

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function preferences() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {}; }
    catch { return {}; }
  }

  function currentState() {
    const saved = preferences();
    const mode = document.querySelector(".mode-button.is-active")?.dataset.mode || saved.mode || "daily";
    if (mode === "random") return saved.randomGame || { mode, guesses: [], complete: false, secretCode: null };
    const key = localDateKey();
    return saved.dailyGames?.[key] || { mode, dateKey: key, guesses: [], complete: false, secretCode: null };
  }

  function formatDistance(kilometres) {
    const unit = document.getElementById("unitButton")?.textContent?.trim().toLowerCase() === "mi" ? "mi" : "km";
    const value = unit === "km" ? kilometres : kilometres * 0.621371;
    const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
    return `${new Intl.NumberFormat().format(rounded)} ${unit}`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
  }

  function heatColour(distance) {
    const closeness = 1 - Math.min(distance, 9000) / 9000;
    const eased = Math.pow(closeness, 0.72);
    const dark = document.documentElement.dataset.theme === "dark";
    return `hsl(${(218 - eased * 210).toFixed(0)} ${(58 + eased * 28).toFixed(0)}% ${(dark ? 45 + eased * 9 : 57 - eased * 5).toFixed(0)}%)`;
  }

  function centroidFor(code) {
    const feature = featureByCode.get(code);
    if (!feature) return null;
    if (feature.geometry.type === "Point") return feature.geometry.coordinates;
    const centroid = d3.geoCentroid(feature);
    return Number.isFinite(centroid[0]) && Number.isFinite(centroid[1]) ? centroid : null;
  }

  function centreCoordinate() {
    return [-rotation[0], -rotation[1]];
  }

  function isVisible(coordinate) {
    return d3.geoDistance(centreCoordinate(), coordinate) <= Math.PI / 2 + 0.015;
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function render() {
    const rect = elements.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const baseScale = Math.min(width, height) * 0.43;
    const scale = baseScale * zoom;

    elements.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    projection.translate([width / 2, height / 2]).scale(scale).rotate(rotation);

    const spherePath = path(sphere) || "";
    elements.atmosphere.setAttribute("d", spherePath);
    elements.ocean.setAttribute("d", spherePath);
    elements.rim.setAttribute("d", spherePath);
    elements.graticule.setAttribute("d", path(graticule) || "");

    polygonFeatures.forEach(feature => {
      const node = countryNodes.get(feature.properties.code);
      node.setAttribute("d", path(feature) || "");
    });

    const state = currentState();
    const guessed = new Map((state.guesses || []).map(guess => [guess.code, guess]));
    const latestCode = state.guesses?.at(-1)?.code;

    pointFeatures.forEach(feature => {
      const code = feature.properties.code;
      const node = pointNodes.get(code);
      const coordinate = feature.geometry.coordinates;
      const projected = projection(coordinate);
      const guess = guessed.get(code);
      const important = Boolean(guess || selectedCode === code || (state.complete && state.secretCode === code));
      const visible = projected && isVisible(coordinate) && (zoom >= 1.35 || important);
      node.classList.toggle("is-hidden", !visible);
      if (visible) node.setAttribute("transform", `translate(${projected[0].toFixed(2)} ${projected[1].toFixed(2)})`);
    });

    [...countryNodes, ...pointNodes].forEach(([code, node]) => {
      const guess = guessed.get(code);
      const answer = Boolean(state.complete && state.secretCode === code);
      node.classList.toggle("is-guessed", Boolean(guess));
      node.classList.toggle("is-latest", code === latestCode);
      node.classList.toggle("is-selected", code === selectedCode);
      node.classList.toggle("is-answer", answer);
      node.style.setProperty("--country-fill", answer ? "#16845b" : guess ? heatColour(guess.distance) : "");
    });
  }

  function refresh() {
    const state = currentState();
    const guesses = state.guesses || [];
    const best = guesses.length ? [...guesses].sort((a, b) => a.distance - b.distance || a.order - b.order)[0] : null;
    const latest = guesses.at(-1)?.code || null;
    elements.focus.disabled = !best;

    if (state.complete && state.secretCode) {
      elements.status.textContent = `${countryByCode.get(state.secretCode)?.name || "Country"} located`;
    } else if (guesses.length) {
      elements.status.textContent = `${guesses.length} signal${guesses.length === 1 ? "" : "s"} mapped · rotate to explore`;
    } else {
      elements.status.textContent = "Rotate the globe to explore";
    }

    if (selectedCode) updateSelection();
    queueRender();

    if (latest && latest !== latestRenderedCode) {
      latestRenderedCode = latest;
      focusCountry(latest, Math.max(1.18, Math.min(zoom, 1.55)), 700);
    }
  }

  function shortestLongitude(from, to) {
    let delta = to - from;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return from + delta;
  }

  function animateView(targetRotation, targetZoom, duration = 650) {
    cancelAnimationFrame(animationFrame);
    const startRotation = [...rotation];
    const startZoom = zoom;
    const adjustedTarget = [shortestLongitude(startRotation[0], targetRotation[0]), targetRotation[1], 0];
    const started = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);

    const tick = now => {
      const progress = Math.min(1, (now - started) / duration);
      const value = ease(progress);
      rotation = [
        startRotation[0] + (adjustedTarget[0] - startRotation[0]) * value,
        startRotation[1] + (adjustedTarget[1] - startRotation[1]) * value,
        0
      ];
      zoom = startZoom + (targetZoom - startZoom) * value;
      queueRender();
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
  }

  function focusCountry(code, targetZoom = 1.7, duration = 650) {
    const centroid = centroidFor(code);
    if (!centroid) return;
    animateView([-centroid[0], -centroid[1], 0], Math.max(0.72, Math.min(4.5, targetZoom)), duration);
  }

  function selectCountry(code) {
    if (!countryByCode.has(code)) return;
    selectedCode = code;
    updateSelection();
    elements.selection.classList.remove("is-hidden");
    queueRender();
  }

  function updateSelection() {
    const country = countryByCode.get(selectedCode);
    const state = currentState();
    if (!country) return;
    const guess = (state.guesses || []).find(item => item.code === selectedCode);
    elements.selectionName.textContent = country.name;
    elements.selectionMeta.textContent = guess ? `Already guessed · ${formatDistance(guess.distance)} away` : state.complete ? "This game is complete" : "Use this as your next guess";
    elements.selectionUse.disabled = Boolean(guess || state.complete);
  }

  function clearSelection() {
    selectedCode = null;
    elements.selection.classList.add("is-hidden");
    queueRender();
  }

  function useSelection() {
    if (!selectedCode) return;
    const country = countryByCode.get(selectedCode);
    const state = currentState();
    if (!country || state.complete || (state.guesses || []).some(item => item.code === selectedCode)) return;
    countryInput.value = country.name;
    countryInput.dispatchEvent(new Event("input", { bubbles: true }));
    clearSelection();
    countryInput.scrollIntoView({ behavior: "smooth", block: "center" });
    countryInput.focus();
  }

  function countryFromTarget(target) {
    const node = target.closest?.("[data-code]");
    return node?.dataset?.code || null;
  }

  function showTooltip(code, clientX, clientY) {
    if (matchMedia("(hover: none)").matches) return;
    const country = countryByCode.get(code);
    if (!country) return;
    const guess = (currentState().guesses || []).find(item => item.code === code);
    elements.tooltip.innerHTML = `<strong>${escapeHtml(country.name)}</strong><span>${guess ? `${escapeHtml(formatDistance(guess.distance))} away` : "Click to select"}</span>`;
    const rect = elements.stage.getBoundingClientRect();
    elements.tooltip.style.left = `${Math.max(12, Math.min(rect.width - 190, clientX - rect.left + 14))}px`;
    elements.tooltip.style.top = `${Math.max(12, Math.min(rect.height - 70, clientY - rect.top + 14))}px`;
    elements.tooltip.classList.remove("is-hidden");
  }

  function hideTooltip() {
    elements.tooltip.classList.add("is-hidden");
  }

  function clampZoom(value) {
    return Math.max(0.72, Math.min(4.8, value));
  }

  function pointerDistance(values) {
    const [a, b] = values;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  elements.stage.addEventListener("pointerdown", event => {
    if (event.target.closest("button")) return;
    elements.stage.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    hideTooltip();
    cancelAnimationFrame(animationFrame);

    if (pointers.size === 1) {
      gesture = { type: "rotate", startX: event.clientX, startY: event.clientY, rotation: [...rotation], moved: false };
    } else if (pointers.size === 2) {
      gesture = { type: "pinch", distance: pointerDistance([...pointers.values()]), zoom };
    }
  });

  elements.stage.addEventListener("pointermove", event => {
    const code = countryFromTarget(event.target);
    if (!pointers.has(event.pointerId)) {
      if (code) showTooltip(code, event.clientX, event.clientY); else hideTooltip();
      return;
    }

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!gesture) return;

    if (pointers.size >= 2) {
      const distance = pointerDistance([...pointers.values()].slice(0, 2));
      if (gesture.type !== "pinch") gesture = { type: "pinch", distance, zoom };
      if (gesture.distance > 0) zoom = clampZoom(gesture.zoom * distance / gesture.distance);
      suppressClickUntil = performance.now() + 250;
      queueRender();
      return;
    }

    if (gesture.type === "rotate") {
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      if (Math.hypot(dx, dy) > 5) gesture.moved = true;
      const rect = elements.stage.getBoundingClientRect();
      const sensitivity = 180 / Math.max(300, Math.min(rect.width, rect.height) * zoom);
      rotation = [gesture.rotation[0] + dx * sensitivity, Math.max(-82, Math.min(82, gesture.rotation[1] - dy * sensitivity)), 0];
      if (gesture.moved) suppressClickUntil = performance.now() + 250;
      queueRender();
    }
  });

  const finishPointer = event => {
    pointers.delete(event.pointerId);
    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      gesture = { type: "rotate", startX: remaining.x, startY: remaining.y, rotation: [...rotation], moved: true };
    } else if (!pointers.size) {
      gesture = null;
    }
  };
  elements.stage.addEventListener("pointerup", finishPointer);
  elements.stage.addEventListener("pointercancel", finishPointer);

  elements.stage.addEventListener("click", event => {
    if (performance.now() < suppressClickUntil) return;
    const code = countryFromTarget(event.target);
    if (code) selectCountry(code);
  });

  elements.stage.addEventListener("wheel", event => {
    event.preventDefault();
    zoom = clampZoom(zoom * Math.exp(-event.deltaY * 0.00125));
    queueRender();
  }, { passive: false });

  elements.stage.addEventListener("dblclick", event => {
    event.preventDefault();
    zoom = clampZoom(zoom * 1.45);
    queueRender();
  });

  elements.zoomIn.addEventListener("click", () => { zoom = clampZoom(zoom * 1.28); queueRender(); });
  elements.zoomOut.addEventListener("click", () => { zoom = clampZoom(zoom / 1.28); queueRender(); });
  elements.reset.addEventListener("click", () => animateView(initialRotation, 1, 650));
  elements.focus.addEventListener("click", () => {
    const guesses = currentState().guesses || [];
    const best = guesses.length ? [...guesses].sort((a, b) => a.distance - b.distance || a.order - b.order)[0] : null;
    if (best) focusCountry(best.code, 1.85);
  });
  elements.selectionClose.addEventListener("click", clearSelection);
  elements.selectionUse.addEventListener("click", useSelection);

  elements.expand.addEventListener("click", () => {
    expanded = !expanded;
    panel.classList.toggle("is-globe-expanded", expanded);
    document.body.classList.toggle("globe-expanded", expanded);
    elements.expand.classList.toggle("is-active", expanded);
    elements.expand.setAttribute("aria-label", expanded ? "Close expanded globe" : "Expand globe");
    setTimeout(queueRender, 80);
  });

  elements.stage.addEventListener("keydown", event => {
    const amount = 8 / zoom;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowLeft") rotation[0] -= amount;
    if (event.key === "ArrowRight") rotation[0] += amount;
    if (event.key === "ArrowUp") rotation[1] = Math.min(82, rotation[1] + amount);
    if (event.key === "ArrowDown") rotation[1] = Math.max(-82, rotation[1] - amount);
    if (event.key === "+" || event.key === "=") zoom = clampZoom(zoom * 1.2);
    if (event.key === "-") zoom = clampZoom(zoom / 1.2);
    queueRender();
  });

  const resizeObserver = new ResizeObserver(queueRender);
  resizeObserver.observe(elements.stage);

  const history = document.getElementById("guessHistory");
  if (history) new MutationObserver(refresh).observe(history, { childList: true, subtree: true });
  document.addEventListener("click", event => {
    if (event.target.closest(".mode-button, #unitButton, #themeButton, #newGameButton, #guessButton")) setTimeout(refresh, 60);
  }, true);

  setInterval(refresh, 1000);
  refresh();
  queueRender();
})();
