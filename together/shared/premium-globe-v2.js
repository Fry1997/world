(() => {
  "use strict";
  if (window.__NEARER_PREMIUM_GLOBE_V2_STARTED) return;

  const d3 = window.NEARER_D3;
  const gameData = window.NEARER_GAME_DATA;
  const geoData = window.NEARER_COUNTRIES_GEOJSON;
  const panel = document.querySelector(".map-panel");
  if (!d3 || !gameData || !geoData || !panel) return;

  const pathname = location.pathname;
  const kind = pathname.includes("/together/duel/") ? "duel"
    : pathname.includes("/together/cooperative/") ? "cooperative"
      : pathname.includes("/together/race/") ? "race"
        : "solo";

  function ensureSoloMarkup() {
    if (panel.querySelector(".globe-stage canvas.globe-canvas")) return;
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
      <div class="globe-stage" id="globeStage" role="application" tabindex="0" aria-label="Interactive 3D globe showing submitted guesses. Drag to rotate and pinch or scroll to zoom.">
        <canvas id="globeCanvas" class="globe-svg globe-canvas" aria-hidden="true"></canvas>
        <div class="globe-zoom" aria-label="Zoom controls">
          <button id="globeZoomIn" type="button" aria-label="Zoom in">+</button>
          <button id="globeZoomOut" type="button" aria-label="Zoom out">−</button>
        </div>
        <div class="globe-hint">Submitted guesses only · drag to rotate</div>
      </div>`;
  }

  if (kind === "solo") ensureSoloMarkup();

  const oldCanvas = panel.querySelector("canvas.globe-canvas");
  const stage = oldCanvas?.closest(".globe-stage");
  if (!oldCanvas || !stage) return;

  const canvas = document.createElement("canvas");
  canvas.id = oldCanvas.id || "globeCanvas";
  canvas.className = oldCanvas.className || "globe-svg globe-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.premiumRenderer = "v2";
  canvas.style.touchAction = "none";
  oldCanvas.replaceWith(canvas);
  stage.style.touchAction = "none";

  const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!context) return;

  const countryByCode = new Map(gameData.countries.map(country => [country.code, country]));
  const features = geoData.features.filter(feature => countryByCode.has(feature.properties.code));
  const featureByCode = new Map(features.map(feature => [feature.properties.code, feature]));
  const polygons = features.filter(feature => feature.geometry.type !== "Point");
  const points = features.filter(feature => feature.geometry.type === "Point");
  const collection = { type: "FeatureCollection", features: polygons };
  const projection = d3.geoOrthographic().clipAngle(90).precision(.38);
  const path = d3.geoPath(projection, context);
  const graticule = d3.geoGraticule10();
  const pointers = new Map();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const mobileQuery = matchMedia("(max-width: 820px)");
  const initialRotation = [-12, -13, 0];

  let rotation = [...initialRotation];
  let zoom = 1;
  let gesture = null;
  let queued = false;
  let interacting = false;
  let expanded = false;
  let viewAnimation = 0;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastRatio = 0;
  let lastRenderKey = "";
  let currentView = null;
  let stateSignature = "";
  let latestFocusedCode = null;
  let gradientCache = null;

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch { return null; }
  }

  function localDateKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function readView() {
    if (kind === "solo") {
      const saved = readJson("nearer-game-v1") || {};
      const mode = document.querySelector(".mode-button.is-active")?.dataset.mode || saved.mode || "daily";
      const current = mode === "random" ? saved.randomGame : saved.dailyGames?.[localDateKey()];
      return {
        guesses: current?.guesses || [], opponentGuesses: [], homeCode: null,
        answerCode: current?.secretCode || null, finished: Boolean(current?.complete), revealsComplete: false
      };
    }
    if (kind === "cooperative") {
      const state = readJson("nearer-cooperative-relay-v1");
      return {
        guesses: state?.guesses || [], opponentGuesses: [], homeCode: null,
        answerCode: state?.targetCode || null, finished: state?.status === "finished", revealsComplete: false
      };
    }
    if (kind === "race") {
      const state = readJson("nearer-pass-race-v2");
      const player = state?.players?.[state.currentPlayer || 0];
      return {
        guesses: player?.guesses || [], opponentGuesses: [], homeCode: null,
        answerCode: state?.targetCode || null,
        finished: Boolean(player?.solvedAt !== null && player?.solvedAt !== undefined), revealsComplete: false
      };
    }
    const state = readJson("nearer-hidden-country-duel-v1");
    const current = Number(state?.currentPlayer) || 0;
    const player = state?.players?.[current];
    const opponent = state?.players?.[1 - current];
    return {
      guesses: player?.guesses || [],
      opponentGuesses: opponent?.guesses || [],
      homeCode: state?.targets?.[current] || null,
      answerCode: state?.targets?.[1 - current] || null,
      finished: Boolean(player?.solvedAt !== null && player?.solvedAt !== undefined),
      revealsComplete: Boolean(state?.revealsComplete)
    };
  }

  function signature(view) {
    const simplify = guesses => (guesses || []).map(guess => [guess.code, guess.distance, guess.order]);
    return JSON.stringify([
      simplify(view.guesses), simplify(view.opponentGuesses), view.homeCode,
      view.answerCode, view.finished, view.revealsComplete
    ]);
  }

  function rgb(hex) {
    const value = hex.replace("#", "");
    return [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
  }

  function mix(a, b, amount) {
    const first = rgb(a);
    const second = rgb(b);
    const channel = index => Math.round(first[index] + (second[index] - first[index]) * amount);
    return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
  }

  function heatColour(distance) {
    const closeness = 1 - Math.min(Math.max(distance || 0, 0), 9000) / 9000;
    const eased = Math.pow(closeness, .72);
    if (eased < .58) return mix("#54748d", "#c37458", eased / .58);
    return mix("#c37458", "#e7ad4e", (eased - .58) / .42);
  }

  function palette() {
    return {
      oceanTop: "#315a74",
      oceanMid: "#12364f",
      oceanBottom: "#020d16",
      landTop: "#f2ebdf",
      landMid: "#e5dccf",
      landBottom: "#bfb8ad",
      border: "rgba(31,45,55,.52)",
      grid: "rgba(212,235,247,.085)",
      rim: "rgba(222,240,250,.34)",
      opponent: "#4d5053",
      opponentStroke: "rgba(245,241,234,.68)",
      home: "#f0d6c7",
      homeStroke: "#ee7459"
    };
  }

  function fastFrame() {
    return interacting || Boolean(viewAnimation);
  }

  function renderRatio() {
    const device = devicePixelRatio || 1;
    if (fastFrame()) return Math.min(device, mobileQuery.matches ? 1.3 : 1.5);
    return Math.min(device, mobileQuery.matches ? 2.35 : 2);
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const pixelRatio = renderRatio();
    if (width !== lastWidth || height !== lastHeight || Math.abs(pixelRatio - lastRatio) > .01) {
      lastWidth = width;
      lastHeight = height;
      lastRatio = pixelRatio;
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      gradientCache = null;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = fastFrame() ? "medium" : "high";
    return { width, height, pixelRatio };
  }

  function visible(coordinate) {
    return d3.geoDistance([-rotation[0], -rotation[1]], coordinate) <= Math.PI / 2 + .015;
  }

  function drawPath(feature, fill, stroke, width = 1, options = {}) {
    context.save();
    context.globalAlpha = options.alpha ?? 1;
    context.beginPath();
    path(feature);
    if (fill) {
      context.fillStyle = fill;
      context.fill("evenodd");
    }
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = width;
      context.setLineDash(options.dash || []);
      if (options.glow && !fastFrame()) {
        context.shadowColor = options.glow;
        context.shadowBlur = options.blur || 10;
      }
      context.stroke();
    }
    context.restore();
  }

  function gradients(width, height, radius, p) {
    const key = `${width}:${height}:${radius.toFixed(2)}:${lastRatio}`;
    if (gradientCache?.key === key) return gradientCache;

    const x = width / 2;
    const y = height / 2;
    const ocean = context.createRadialGradient(x + radius * .28, y - radius * .33, radius * .03, x, y, radius * 1.12);
    ocean.addColorStop(0, p.oceanTop);
    ocean.addColorStop(.48, p.oceanMid);
    ocean.addColorStop(1, p.oceanBottom);

    const land = context.createLinearGradient(width * .18, height * .12, width * .78, height * .9);
    land.addColorStop(0, p.landTop);
    land.addColorStop(.54, p.landMid);
    land.addColorStop(1, p.landBottom);

    const light = context.createRadialGradient(x + radius * .5, y - radius * .48, 0, x + radius * .28, y - radius * .24, radius * 1.22);
    light.addColorStop(0, "rgba(255,249,225,.18)");
    light.addColorStop(.28, "rgba(255,248,228,.055)");
    light.addColorStop(.68, "rgba(3,13,22,.03)");
    light.addColorStop(1, "rgba(0,4,8,.34)");

    gradientCache = { key, ocean, land, light };
    return gradientCache;
  }

  function drawSphere(width, height, radius, p, ocean) {
    const x = width / 2;
    const y = height / 2;
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = p.oceanBottom;
    if (!fastFrame()) {
      context.shadowColor = "rgba(0,5,10,.68)";
      context.shadowBlur = 30;
      context.shadowOffsetY = 17;
    }
    context.fill();
    context.restore();

    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = ocean;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    context.restore();
  }

  function drawPoint(feature, colour, latest, stroke = "#fff6ec") {
    const coordinate = feature.geometry.coordinates;
    if (!visible(coordinate)) return;
    const point = projection(coordinate);
    if (!point) return;
    context.save();
    context.beginPath();
    context.arc(point[0], point[1], latest ? 5.4 : 4.3, 0, Math.PI * 2);
    context.fillStyle = colour;
    context.fill();
    context.strokeStyle = stroke;
    context.lineWidth = latest ? 2.2 : 1.4;
    context.stroke();
    context.restore();
  }

  function bestGuess(guesses) {
    return guesses?.length ? [...guesses].sort((a, b) => a.distance - b.distance || a.order - b.order)[0] : null;
  }

  function draw() {
    queued = false;
    if (document.hidden || !stage.isConnected || !currentView) return;
    const { width, height } = resize();
    const p = palette();
    const radius = Math.min(width, height) * .43 * zoom;
    projection.translate([width / 2, height / 2]).scale(radius).rotate(rotation).precision(fastFrame() ? .82 : .38);
    window.__NEARER_GLOBE_PROJECTION = projection;
    const cached = gradients(width, height, radius, p);
    drawSphere(width, height, radius, p, cached.ocean);

    context.save();
    context.beginPath();
    path(graticule);
    context.strokeStyle = p.grid;
    context.lineWidth = fastFrame() ? .45 : .62;
    context.stroke();
    context.restore();

    drawPath(collection, cached.land, p.border, fastFrame() ? .52 : .7);

    const own = currentView.guesses || [];
    const opponent = currentView.opponentGuesses || [];
    const latestCode = own.at(-1)?.code || null;

    if (kind === "duel" && currentView.revealsComplete) {
      for (const guess of opponent) {
        const feature = featureByCode.get(guess.code);
        if (!feature || feature.geometry.type === "Point") continue;
        drawPath(feature, p.opponent, p.opponentStroke, 1.2, { alpha: .82, dash: [4, 2] });
      }

      const home = featureByCode.get(currentView.homeCode);
      if (home) {
        if (home.geometry.type === "Point") drawPoint(home, p.home, true, p.homeStroke);
        else drawPath(home, "rgba(240,214,199,.34)", p.homeStroke, 2.8, { glow: "rgba(238,116,89,.55)", blur: 12 });

        const best = bestGuess(opponent);
        const centroid = home.geometry.type === "Point" ? home.geometry.coordinates : d3.geoCentroid(home);
        if (best && centroid && best.distance <= 3219) {
          const radiusDegrees = Math.max(.8, best.distance / 111.195);
          const circle = d3.geoCircle().center(centroid).radius(radiusDegrees).precision(2)();
          drawPath(circle, "rgba(77,80,83,.07)", "rgba(192,194,194,.78)", 1.8, { dash: [7, 6] });
        }
      }
    }

    for (const guess of own) {
      const feature = featureByCode.get(guess.code);
      if (!feature || feature.geometry.type === "Point") continue;
      const latest = guess.code === latestCode;
      drawPath(
        feature,
        heatColour(guess.distance),
        latest ? "#fff3dc" : "rgba(255,247,232,.76)",
        latest ? 2.35 : 1.12,
        latest ? { glow: "rgba(233,173,78,.55)", blur: 10 } : {}
      );
    }

    if (currentView.finished && currentView.answerCode) {
      const answer = featureByCode.get(currentView.answerCode);
      if (answer && answer.geometry.type !== "Point") {
        drawPath(answer, "#4ea985", "#fff7eb", 2.7, { glow: "rgba(94,184,149,.48)", blur: 12 });
      }
    }

    for (const feature of points) {
      const code = feature.properties.code;
      const ownGuess = own.find(item => item.code === code);
      const opponentGuess = opponent.find(item => item.code === code);
      if (opponentGuess && kind === "duel") drawPoint(feature, p.opponent, false, p.opponentStroke);
      if (ownGuess) drawPoint(feature, heatColour(ownGuess.distance), code === latestCode);
      if (currentView.finished && currentView.answerCode === code) drawPoint(feature, "#4ea985", true);
    }

    const x = width / 2;
    const y = height / 2;
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = cached.light;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    context.restore();

    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.strokeStyle = p.rim;
    context.lineWidth = 1.45;
    context.stroke();
    if (!fastFrame() && radius > .6) {
      context.beginPath();
      context.arc(x, y, radius - .6, -1.28, .26);
      context.strokeStyle = "rgba(225,244,255,.44)";
      context.lineWidth = 2.1;
      context.shadowColor = "rgba(177,222,246,.36)";
      context.shadowBlur = 12;
      context.stroke();
    }
    context.restore();

    lastRenderKey = `${stateSignature}:${rotation.join(",")}:${zoom}:${lastRatio}`;
  }

  function queue() {
    if (document.hidden || queued) return;
    queued = true;
    requestAnimationFrame(draw);
  }

  function syncState(force = false) {
    const next = readView();
    const nextSignature = signature(next);
    if (force || nextSignature !== stateSignature) {
      currentView = next;
      stateSignature = nextSignature;
      queue();
      return true;
    }
    return false;
  }

  function setInteracting(value) {
    if (interacting === value) return;
    interacting = value;
    resize();
    queue();
  }

  function angleDifference(from, to) {
    return ((to - from + 540) % 360) - 180;
  }

  function animateTo(targetRotation, targetZoom = zoom, duration = 760) {
    cancelAnimationFrame(viewAnimation);
    if (reducedMotion.matches) {
      rotation = [...targetRotation];
      zoom = targetZoom;
      queue();
      return;
    }
    const startRotation = [...rotation];
    const startZoom = zoom;
    const start = performance.now();
    const frame = now => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      rotation = startRotation.map((value, index) => value + angleDifference(value, targetRotation[index]) * eased);
      zoom = startZoom + (targetZoom - startZoom) * eased;
      queue();
      if (progress < 1) viewAnimation = requestAnimationFrame(frame);
      else viewAnimation = 0;
    };
    viewAnimation = requestAnimationFrame(frame);
  }

  function focusFeature(feature, targetZoom = 1.35) {
    if (!feature) return;
    const centroid = feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature);
    if (!centroid || centroid.some(value => !Number.isFinite(value))) return;
    latestFocusedCode = feature.properties.code;
    animateTo([-centroid[0], -centroid[1], 0], targetZoom);
  }

  function updateFocusControl() {
    const button = document.getElementById("globeFocus");
    if (!button) return;
    const best = bestGuess(currentView?.guesses || []);
    button.disabled = !best;
    button.title = best ? `Focus ${countryByCode.get(best.code)?.name || "closest guess"}` : "Focus closest guess";
  }

  function clientPoint(event) {
    return { x: event.clientX, y: event.clientY };
  }

  function pointerDistance() {
    const values = [...pointers.values()];
    if (values.length < 2) return 0;
    return Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y);
  }

  stage.addEventListener("pointerdown", event => {
    stage.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, clientPoint(event));
    setInteracting(true);
    gesture = {
      x: event.clientX,
      y: event.clientY,
      rotation: [...rotation],
      zoom,
      distance: pointerDistance(),
      moved: false
    };
  });

  stage.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, clientPoint(event));
    if (pointers.size > 1) {
      const distance = pointerDistance();
      if (gesture.distance > 0) zoom = Math.max(.8, Math.min(2.25, gesture.zoom * distance / gesture.distance));
      gesture.moved = true;
      queue();
      return;
    }
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) gesture.moved = true;
    rotation = [gesture.rotation[0] + dx * .22, Math.max(-78, Math.min(78, gesture.rotation[1] - dy * .18)), 0];
    queue();
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);
    if (!pointers.size) {
      gesture = null;
      setInteracting(false);
    }
  }

  stage.addEventListener("pointerup", releasePointer);
  stage.addEventListener("pointercancel", releasePointer);
  stage.addEventListener("lostpointercapture", releasePointer);
  stage.addEventListener("wheel", event => {
    event.preventDefault();
    zoom = Math.max(.8, Math.min(2.25, zoom * Math.exp(-event.deltaY * .0012)));
    setInteracting(true);
    clearTimeout(stage._wheelTimer);
    stage._wheelTimer = setTimeout(() => setInteracting(false), 140);
    queue();
  }, { passive: false });

  stage.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") rotation[0] -= 8;
    if (event.key === "ArrowRight") rotation[0] += 8;
    if (event.key === "ArrowUp") rotation[1] = Math.min(78, rotation[1] + 6);
    if (event.key === "ArrowDown") rotation[1] = Math.max(-78, rotation[1] - 6);
    if (event.key === "+" || event.key === "=") zoom = Math.min(2.25, zoom * 1.12);
    if (event.key === "-") zoom = Math.max(.8, zoom / 1.12);
    queue();
  });

  document.getElementById("globeZoomIn")?.addEventListener("click", () => {
    zoom = Math.min(2.25, zoom * 1.17);
    queue();
  });
  document.getElementById("globeZoomOut")?.addEventListener("click", () => {
    zoom = Math.max(.8, zoom / 1.17);
    queue();
  });
  document.getElementById("globeReset")?.addEventListener("click", () => animateTo([...initialRotation], 1));
  document.getElementById("globeFocus")?.addEventListener("click", () => {
    const best = bestGuess(currentView?.guesses || []);
    if (best) focusFeature(featureByCode.get(best.code));
  });
  document.getElementById("globeExpand")?.addEventListener("click", () => {
    expanded = !expanded;
    stage.classList.toggle("is-expanded", expanded);
    document.body.classList.toggle("globe-is-expanded", expanded);
    queue();
  });

  new ResizeObserver(() => queue()).observe(stage);
  new MutationObserver(() => {
    syncState();
    updateFocusControl();
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });

  addEventListener("storage", event => {
    if (!event.key || event.key.startsWith("nearer-")) {
      syncState();
      updateFocusControl();
    }
  });
  addEventListener("pageshow", () => {
    syncState(true);
    updateFocusControl();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      syncState(true);
      updateFocusControl();
    }
  });

  syncState(true);
  updateFocusControl();
  queue();
  window.__NEARER_PREMIUM_GLOBE_V2_STARTED = true;
})();
