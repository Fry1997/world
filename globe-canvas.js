(() => {
  "use strict";

  const VERSION = "20260718-canvas2";
  const STORAGE_KEY = "nearer-game-v1";
  const d3 = window.NEARER_D3;
  const gameData = window.NEARER_GAME_DATA;
  const geoData = window.NEARER_COUNTRIES_GEOJSON;

  if (!d3 || !gameData || !geoData) {
    console.error("Nearer Canvas globe could not start: map data is unavailable.");
    return;
  }

  const panel = document.querySelector(".map-panel");
  const countryInput = document.getElementById("countryInput");
  if (!panel || !countryInput) return;

  window.__NEARER_REAL_GLOBE_STARTED = true;
  window.__NEARER_CANVAS_GLOBE_STARTED = true;

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
    <div class="globe-stage" id="globeStage" role="application" tabindex="0"
      aria-label="Interactive 3D globe showing submitted guesses. Drag to rotate and pinch or scroll to zoom. Countries cannot be selected from the globe.">
      <canvas id="globeCanvas" class="globe-svg globe-canvas" aria-hidden="true"></canvas>
      <div class="globe-zoom" aria-label="Zoom controls">
        <button id="globeZoomIn" type="button" aria-label="Zoom in">+</button>
        <button id="globeZoomOut" type="button" aria-label="Zoom out">−</button>
      </div>
      <div class="globe-hint">Submitted guesses only · drag to rotate</div>
    </div>`;

  const elements = {
    stage: document.getElementById("globeStage"),
    canvas: document.getElementById("globeCanvas"),
    status: document.getElementById("globeStatus"),
    focus: document.getElementById("globeFocus"),
    reset: document.getElementById("globeReset"),
    expand: document.getElementById("globeExpand"),
    zoomIn: document.getElementById("globeZoomIn"),
    zoomOut: document.getElementById("globeZoomOut")
  };

  const context = elements.canvas.getContext("2d", {
    alpha: true,
    desynchronized: true
  });
  if (!context) {
    console.error("Nearer Canvas globe could not start: Canvas 2D is unavailable.");
    return;
  }

  const countries = [...gameData.countries].sort((a, b) => a.name.localeCompare(b.name));
  const countryByCode = new Map(countries.map(country => [country.code, country]));
  const features = geoData.features.filter(feature => countryByCode.has(feature.properties.code));
  const featureByCode = new Map(features.map(feature => [feature.properties.code, feature]));
  const polygonFeatures = features.filter(feature => feature.geometry.type !== "Point");
  const pointFeatures = features.filter(feature => feature.geometry.type === "Point");
  const polygonCollection = { type: "FeatureCollection", features: polygonFeatures };

  function visitCoordinates(value, callback) {
    if (Array.isArray(value) && typeof value[0] === "number") {
      callback(value);
      return;
    }
    if (Array.isArray(value)) value.forEach(item => visitCoordinates(item, callback));
  }

  const polygonMeta = polygonFeatures.map(feature => {
    const centroid = d3.geoCentroid(feature);
    let angularRadius = 0;
    visitCoordinates(feature.geometry.coordinates, coordinate => {
      angularRadius = Math.max(angularRadius, d3.geoDistance(centroid, coordinate));
    });
    return {
      feature,
      code: feature.properties.code,
      centroid,
      angularRadius: Math.min(Math.PI, angularRadius + 0.035)
    };
  });
  const polygonMetaByCode = new Map(polygonMeta.map(meta => [meta.code, meta]));

  const projection = d3.geoOrthographic()
    .clipAngle(90)
    .precision(0.45);
  const path = d3.geoPath(projection, context);
  const graticule = d3.geoGraticule10();
  const initialRotation = [-12, -13, 0];
  const pointers = new Map();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  let rotation = [...initialRotation];
  let zoom = 1;
  let expanded = false;
  let renderQueued = false;
  let needsRenderWhenVisible = false;
  let viewAnimation = 0;
  let gesture = null;
  let latestRenderedCode = null;
  let lastCssWidth = 0;
  let lastCssHeight = 0;
  let lastPixelRatio = 0;
  let lastFrameTime = 0;
  let refineTimer = 0;
  let wheelTimer = 0;
  let displayScaleBaseZoom = null;
  let renderCache = null;

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function preferences() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {};
    } catch {
      return {};
    }
  }

  function currentState() {
    const saved = preferences();
    const mode = document.querySelector(".mode-button.is-active")?.dataset.mode || saved.mode || "daily";
    if (mode === "random") {
      return saved.randomGame || { mode, guesses: [], complete: false, secretCode: null };
    }
    const key = localDateKey();
    return saved.dailyGames?.[key] || {
      mode,
      dateKey: key,
      guesses: [],
      complete: false,
      secretCode: null
    };
  }

  function heatColour(distance, dark = document.documentElement.dataset.theme === "dark") {
    const closeness = 1 - Math.min(distance, 9000) / 9000;
    const eased = Math.pow(closeness, 0.72);
    return `hsl(${(218 - eased * 210).toFixed(0)} ${(58 + eased * 28).toFixed(0)}% ${(dark ? 45 + eased * 9 : 57 - eased * 5).toFixed(0)}%)`;
  }

  function cssVariable(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  function themeColours() {
    return {
      oceanHighlight: cssVariable("--globe-ocean-highlight", "#88abc0"),
      ocean: cssVariable("--globe-ocean", "#537a92"),
      oceanShadow: cssVariable("--globe-ocean-shadow", "#29495f"),
      land: cssVariable("--globe-land", "#d8d7ce"),
      border: cssVariable("--globe-border", "rgba(23, 39, 49, .34)"),
      grid: cssVariable("--globe-grid", "rgba(255, 255, 255, .16)"),
      rim: cssVariable("--globe-rim", "rgba(224, 242, 250, .82)"),
      accent: cssVariable("--accent", "#d85335"),
      ink: cssVariable("--ink", "#111820")
    };
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

  function pixelRatio() {
    const mobile = matchMedia("(max-width: 680px)").matches;
    return Math.min(window.devicePixelRatio || 1, mobile ? 1.1 : 1.45);
  }

  function syncCanvasSize(rect) {
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const ratio = pixelRatio();

    if (
      width !== lastCssWidth ||
      height !== lastCssHeight ||
      Math.abs(ratio - lastPixelRatio) > 0.01
    ) {
      lastCssWidth = width;
      lastCssHeight = height;
      lastPixelRatio = ratio;
      elements.canvas.width = Math.max(1, Math.round(width * ratio));
      elements.canvas.height = Math.max(1, Math.round(height * ratio));
      elements.canvas.style.width = `${width}px`;
      elements.canvas.style.height = `${height}px`;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    return { width, height, ratio };
  }

  function isInteracting() {
    return pointers.size > 0 || Boolean(viewAnimation) || displayScaleBaseZoom !== null;
  }

  function scheduleRefine() {
    clearTimeout(refineTimer);
    refineTimer = setTimeout(() => {
      refineTimer = 0;
      queueRender({ force: true });
    }, 110);
  }

  function setDisplayScale(baseZoom) {
    displayScaleBaseZoom = baseZoom;
    elements.canvas.style.transformOrigin = "50% 50%";
    elements.canvas.style.willChange = "transform";
  }

  function updateDisplayScale() {
    if (displayScaleBaseZoom === null) return;
    const scale = zoom / displayScaleBaseZoom;
    elements.canvas.style.transform = `scale(${scale})`;
  }

  function clearDisplayScale({ render = true } = {}) {
    if (displayScaleBaseZoom === null) return;
    displayScaleBaseZoom = null;
    elements.canvas.style.transform = "";
    elements.canvas.style.willChange = "";
    if (render) queueRender({ force: true });
  }

  function buildRenderCache() {
    const state = currentState();
    const colours = themeColours();
    const dark = document.documentElement.dataset.theme === "dark";
    const guesses = (state.guesses || []).map(guess => ({
      ...guess,
      feature: featureByCode.get(guess.code),
      colour: heatColour(guess.distance, dark)
    }));
    return {
      state,
      colours,
      guesses,
      guessByCode: new Map(guesses.map(guess => [guess.code, guess])),
      latestCode: guesses.at(-1)?.code || null
    };
  }

  function visiblePolygonCollection(width, height, radius) {
    if (zoom < 1.35) return polygonCollection;
    const halfDiagonal = Math.hypot(width / 2, height / 2);
    const viewRadius = Math.asin(Math.min(1, halfDiagonal / Math.max(1, radius)));
    const centre = centreCoordinate();
    const visible = polygonMeta
      .filter(meta => d3.geoDistance(centre, meta.centroid) <= viewRadius + meta.angularRadius + 0.08)
      .map(meta => meta.feature);
    return { type: "FeatureCollection", features: visible };
  }

  function isPolygonVisible(code, width, height, radius) {
    if (zoom < 1.35) return true;
    const meta = polygonMetaByCode.get(code);
    if (!meta) return true;
    const halfDiagonal = Math.hypot(width / 2, height / 2);
    const viewRadius = Math.asin(Math.min(1, halfDiagonal / Math.max(1, radius)));
    return d3.geoDistance(centreCoordinate(), meta.centroid) <= viewRadius + meta.angularRadius + 0.08;
  }

  function drawSphere(width, height, radius, colours) {
    const centerX = width / 2;
    const centerY = height / 2;

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = colours.oceanShadow;
    if (!isInteracting()) {
      context.shadowColor = "rgba(8, 19, 29, .28)";
      context.shadowBlur = 22;
      context.shadowOffsetY = 13;
    }
    context.fill();
    context.restore();

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.clip();

    if (isInteracting()) {
      context.fillStyle = colours.ocean;
    } else {
      const gradient = context.createRadialGradient(
        centerX - radius * 0.34,
        centerY - radius * 0.30,
        radius * 0.05,
        centerX,
        centerY,
        radius * 1.05
      );
      gradient.addColorStop(0, colours.oceanHighlight);
      gradient.addColorStop(0.58, colours.ocean);
      gradient.addColorStop(1, colours.oceanShadow);
      context.fillStyle = gradient;
    }
    context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
    context.restore();
  }

  function drawPath(feature, fill, stroke, lineWidth, shadow = false) {
    context.save();
    context.beginPath();
    path(feature);
    if (fill) {
      context.fillStyle = fill;
      context.fill("evenodd");
    }
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = lineWidth;
      if (shadow && !isInteracting()) {
        context.shadowColor = "rgba(255, 255, 255, .72)";
        context.shadowBlur = 4;
      }
      context.stroke();
    }
    context.restore();
  }

  function drawPointMarker(feature, colour, isLatest, isAnswer, colours) {
    const coordinate = feature.geometry.coordinates;
    if (!isVisible(coordinate)) return;
    const projected = projection(coordinate);
    if (!projected) return;

    const [x, y] = projected;
    context.save();
    context.beginPath();
    context.arc(x, y, isLatest || isAnswer ? 5 : 4, 0, Math.PI * 2);
    context.fillStyle = colour;
    context.fill();
    context.strokeStyle = isLatest || isAnswer ? "#ffffff" : colours.ink;
    context.lineWidth = isLatest || isAnswer ? 2.2 : 1.15;
    context.stroke();
    context.restore();
  }

  function draw(timestamp = performance.now()) {
    renderQueued = false;
    if (document.hidden) {
      needsRenderWhenVisible = true;
      return;
    }

    const moving = isInteracting();
    const targetInterval = moving && zoom > 1.8 ? 32 : moving ? 22 : 0;
    if (targetInterval && timestamp - lastFrameTime < targetInterval) {
      renderQueued = true;
      requestAnimationFrame(draw);
      return;
    }
    lastFrameTime = timestamp;

    const rect = elements.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const { width, height } = syncCanvasSize(rect);
    renderCache ||= buildRenderCache();
    const { state, colours, guesses, guessByCode, latestCode } = renderCache;
    const radius = Math.min(width, height) * 0.43 * zoom;
    const zoomFactor = Math.max(1, zoom);
    const precision = moving
      ? Math.min(7, 1.65 + zoomFactor * 0.95)
      : Math.min(2.2, 0.48 + zoomFactor * 0.18);

    projection
      .translate([width / 2, height / 2])
      .scale(radius)
      .rotate(rotation)
      .precision(precision);

    drawSphere(width, height, radius, colours);

    if (!(moving && zoom > 1.45)) {
      context.save();
      context.beginPath();
      path(graticule);
      context.strokeStyle = colours.grid;
      context.lineWidth = moving ? 0.4 : 0.7;
      context.stroke();
      context.restore();
    }

    const land = visiblePolygonCollection(width, height, radius);
    drawPath(
      land,
      colours.land,
      moving && zoom > 1.35 ? null : colours.border,
      moving ? 0.4 : 0.68
    );

    for (const guess of guesses) {
      const feature = guess.feature;
      if (!feature || feature.geometry.type === "Point") continue;
      if (!isPolygonVisible(guess.code, width, height, radius)) continue;
      const latest = guess.code === latestCode;
      drawPath(
        feature,
        guess.colour,
        latest ? colours.ink : "rgba(255,255,255,.78)",
        latest ? (moving ? 1.45 : 2.25) : (moving ? 0.8 : 1.15),
        latest
      );
    }

    if (state.complete && state.secretCode) {
      const answer = featureByCode.get(state.secretCode);
      if (
        answer &&
        answer.geometry.type !== "Point" &&
        isPolygonVisible(state.secretCode, width, height, radius)
      ) {
        drawPath(answer, "#16845b", "#ffffff", moving ? 1.7 : 2.6, true);
      }
    }

    for (const feature of pointFeatures) {
      const code = feature.properties.code;
      const guess = guessByCode.get(code);
      const answer = Boolean(state.complete && state.secretCode === code);
      if (!guess && !answer) continue;
      drawPointMarker(
        feature,
        answer ? "#16845b" : guess.colour,
        code === latestCode,
        answer,
        colours
      );
    }

    context.save();
    context.beginPath();
    context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    context.strokeStyle = colours.rim;
    context.lineWidth = moving ? 0.9 : 1.4;
    context.stroke();
    context.restore();

    if (moving) scheduleRefine();
  }

  function queueRender({ force = false } = {}) {
    if (document.hidden) {
      needsRenderWhenVisible = true;
      return;
    }
    if (force) lastFrameTime = 0;
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(draw);
  }

  function shortestLongitude(from, to) {
    let delta = to - from;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return from + delta;
  }

  function clampZoom(value) {
    return Math.max(0.72, Math.min(4.8, value));
  }

  function stopAnimation() {
    if (viewAnimation) {
      cancelAnimationFrame(viewAnimation);
      viewAnimation = 0;
    }
    clearTimeout(wheelTimer);
    wheelTimer = 0;
  }

  function animateView(targetRotation, targetZoom, duration = 480) {
    stopAnimation();

    const finalZoom = clampZoom(targetZoom);
    const adjustedTarget = [
      shortestLongitude(rotation[0], targetRotation[0]),
      Math.max(-82, Math.min(82, targetRotation[1])),
      0
    ];

    if (reducedMotion.matches || duration <= 0) {
      rotation = adjustedTarget;
      zoom = finalZoom;
      queueRender();
      return;
    }

    const startRotation = [...rotation];
    const startZoom = zoom;
    const started = performance.now();
    const ease = value => 1 - Math.pow(1 - value, 3);

    const tick = now => {
      if (document.hidden) {
        viewAnimation = 0;
        return;
      }

      const progress = Math.min(1, (now - started) / duration);
      const value = ease(progress);
      rotation = [
        startRotation[0] + (adjustedTarget[0] - startRotation[0]) * value,
        startRotation[1] + (adjustedTarget[1] - startRotation[1]) * value,
        0
      ];
      zoom = startZoom + (finalZoom - startZoom) * value;
      queueRender();

      if (progress < 1) {
        viewAnimation = requestAnimationFrame(tick);
      } else {
        viewAnimation = 0;
        queueRender();
      }
    };

    viewAnimation = requestAnimationFrame(tick);
  }

  function focusCountry(code, targetZoom = 1.6, duration = 480) {
    const centroid = centroidFor(code);
    if (!centroid) return;
    animateView([-centroid[0], -centroid[1], 0], targetZoom, duration);
  }

  function refresh({ focusLatest = true } = {}) {
    renderCache = buildRenderCache();
    const { state, guesses, latestCode: latest } = renderCache;
    const best = guesses.length
      ? [...guesses].sort((a, b) => a.distance - b.distance || a.order - b.order)[0]
      : null;

    elements.focus.disabled = !best;

    if (state.complete && state.secretCode) {
      elements.status.textContent = `${countryByCode.get(state.secretCode)?.name || "Country"} located`;
    } else if (guesses.length) {
      elements.status.textContent = `${guesses.length} signal${guesses.length === 1 ? "" : "s"} mapped · rotate to explore`;
    } else {
      elements.status.textContent = "Rotate the globe to explore";
    }

    queueRender();

    if (focusLatest && latest && latest !== latestRenderedCode) {
      latestRenderedCode = latest;
      focusCountry(latest, Math.max(1.14, Math.min(zoom, 1.48)), 420);
    } else {
      latestRenderedCode = latest;
    }
  }

  function pointerDistance(values) {
    const [a, b] = values;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  elements.stage.addEventListener("pointerdown", event => {
    if (event.target.closest("button")) return;
    stopAnimation();
    clearDisplayScale({ render: false });
    elements.stage.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1) {
      gesture = {
        type: "rotate",
        startX: event.clientX,
        startY: event.clientY,
        rotation: [...rotation]
      };
    } else if (pointers.size === 2) {
      gesture = {
        type: "pinch",
        distance: pointerDistance([...pointers.values()]),
        zoom
      };
      setDisplayScale(zoom);
    }
  });

  elements.stage.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!gesture) return;

    if (pointers.size >= 2) {
      const distance = pointerDistance([...pointers.values()].slice(0, 2));
      if (gesture.type !== "pinch") {
        gesture = { type: "pinch", distance, zoom };
        setDisplayScale(zoom);
      }
      if (gesture.distance > 0) {
        zoom = clampZoom(gesture.zoom * distance / gesture.distance);
      }
      updateDisplayScale();
      return;
    }

    if (gesture.type === "rotate") {
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      const rect = elements.stage.getBoundingClientRect();
      const sensitivity = 180 / Math.max(300, Math.min(rect.width, rect.height) * zoom);
      rotation = [
        gesture.rotation[0] + dx * sensitivity,
        Math.max(-82, Math.min(82, gesture.rotation[1] - dy * sensitivity)),
        0
      ];
      queueRender();
    }
  });

  const finishPointer = event => {
    pointers.delete(event.pointerId);
    const wasPinching = gesture?.type === "pinch" || displayScaleBaseZoom !== null;
    if (wasPinching) clearDisplayScale({ render: false });
    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      gesture = {
        type: "rotate",
        startX: remaining.x,
        startY: remaining.y,
        rotation: [...rotation]
      };
      queueRender({ force: true });
    } else if (!pointers.size) {
      gesture = null;
      queueRender({ force: true });
    }
  };

  elements.stage.addEventListener("pointerup", finishPointer);
  elements.stage.addEventListener("pointercancel", finishPointer);

  elements.stage.addEventListener("wheel", event => {
    event.preventDefault();
    stopAnimation();
    if (displayScaleBaseZoom === null) setDisplayScale(zoom);
    zoom = clampZoom(zoom * Math.exp(-event.deltaY * 0.0012));
    updateDisplayScale();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      wheelTimer = 0;
      clearDisplayScale({ render: true });
    }, 85);
  }, { passive: false });

  elements.stage.addEventListener("dblclick", event => {
    event.preventDefault();
    stopAnimation();
    clearDisplayScale({ render: false });
    zoom = clampZoom(zoom * 1.4);
    queueRender({ force: true });
  });

  elements.zoomIn.addEventListener("click", () => {
    stopAnimation();
    clearDisplayScale({ render: false });
    zoom = clampZoom(zoom * 1.25);
    queueRender({ force: true });
  });

  elements.zoomOut.addEventListener("click", () => {
    stopAnimation();
    clearDisplayScale({ render: false });
    zoom = clampZoom(zoom / 1.25);
    queueRender({ force: true });
  });

  elements.reset.addEventListener("click", () => {
    animateView(initialRotation, 1, 420);
  });

  elements.focus.addEventListener("click", () => {
    const guesses = currentState().guesses || [];
    const best = guesses.length
      ? [...guesses].sort((a, b) => a.distance - b.distance || a.order - b.order)[0]
      : null;
    if (best) focusCountry(best.code, 1.72, 440);
  });

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
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
    }
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
  if (history) {
    new MutationObserver(() => refresh({ focusLatest: true }))
      .observe(history, { childList: true, subtree: true });
  }

  document.addEventListener("click", event => {
    if (
      event.target.closest(
        ".mode-button, #unitButton, #themeButton, #newGameButton, #guessButton"
      )
    ) {
      setTimeout(() => refresh({ focusLatest: true }), 70);
    }
  }, true);

  window.addEventListener("storage", () => refresh({ focusLatest: false }));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopAnimation();
      clearDisplayScale({ render: false });
      return;
    }
    if (needsRenderWhenVisible) {
      needsRenderWhenVisible = false;
      queueRender();
    }
    refresh({ focusLatest: false });
  });

  window.__NEARER_GLOBE_REFRESH = refresh;

  refresh({ focusLatest: false });
  queueRender();
})();
