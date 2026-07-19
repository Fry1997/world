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
    if (!fastFrame()) {
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

  function clampZoom(value) {
    return Math.max(.72, Math.min(4.8, value));
  }

  function pointerDistance(values) {
    const [a, b] = values;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function centroidFor(code) {
    const feature = featureByCode.get(code);
    if (!feature) return null;
    if (feature.geometry.type === "Point") return feature.geometry.coordinates;
    const centroid = d3.geoCentroid(feature);
    return Number.isFinite(centroid[0]) && Number.isFinite(centroid[1]) ? centroid : null;
  }

  function shortestLongitude(from, to) {
    let delta = to - from;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return from + delta;
  }

  function stopAnimation() {
    if (!viewAnimation) return;
    cancelAnimationFrame(viewAnimation);
    viewAnimation = 0;
  }

  function animateView(targetRotation, targetZoom, duration = 460) {
    stopAnimation();
    const adjustedTarget = [
      shortestLongitude(rotation[0], targetRotation[0]),
      Math.max(-82, Math.min(82, targetRotation[1])),
      0
    ];
    const finalZoom = clampZoom(targetZoom);
    if (reducedMotion.matches || duration <= 0) {
      rotation = adjustedTarget;
      zoom = finalZoom;
      queue();
      return;
    }

    const startRotation = [...rotation];
    const startZoom = zoom;
    const started = performance.now();
    const ease = value => 1 - Math.pow(1 - value, 3);
    const tick = now => {
      const progress = Math.min(1, (now - started) / duration);
      const value = ease(progress);
      rotation = [
        startRotation[0] + (adjustedTarget[0] - startRotation[0]) * value,
        startRotation[1] + (adjustedTarget[1] - startRotation[1]) * value,
        0
      ];
      zoom = startZoom + (finalZoom - startZoom) * value;
      queue();
      if (progress < 1) viewAnimation = requestAnimationFrame(tick);
      else {
        viewAnimation = 0;
        gradientCache = null;
        queue();
      }
    };
    viewAnimation = requestAnimationFrame(tick);
  }

  function focusCountry(code, targetZoom, duration = 460) {
    const centroid = centroidFor(code);
    if (!centroid) return;
    const feature = featureByCode.get(code);
    const zoomLevel = targetZoom || (feature?.geometry.type === "Point" ? 2.35 : 1.62);
    animateView([-centroid[0], -centroid[1], 0], zoomLevel, duration);
  }

  function hideGuessInfo() {
    document.getElementById("globeGuessInfo")?.classList.add("is-hidden");
    document.getElementById("guessedCountryChip")?.classList.add("is-hidden");
  }

  function showGuessInfo(guess) {
    if (!guess) {
      hideGuessInfo();
      return;
    }
    const country = countryByCode.get(guess.code);
    if (!country) {
      hideGuessInfo();
      return;
    }
    const target = document.getElementById("globeGuessInfo") || document.getElementById("guessedCountryChip");
    const name = target?.querySelector("strong");
    if (name) name.textContent = country.name;
    target?.classList.remove("is-hidden");
  }

  function guessedAt(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const point = [clientX - rect.left, clientY - rect.top];
    const translate = projection.translate();
    const radius = projection.scale();
    if (Math.hypot(point[0] - translate[0], point[1] - translate[1]) > radius) return null;
    const guesses = [...(currentView?.guesses || [])].reverse();
    for (const guess of guesses) {
      const feature = featureByCode.get(guess.code);
      if (!feature || feature.geometry.type !== "Point") continue;
      const coordinate = feature.geometry.coordinates;
      if (!visible(coordinate)) continue;
      const projected = projection(coordinate);
      if (projected && Math.hypot(projected[0] - point[0], projected[1] - point[1]) <= 16) return guess;
    }
    const coordinate = projection.invert(point);
    if (!coordinate) return null;
    return guesses.find(guess => {
      const feature = featureByCode.get(guess.code);
      return feature && feature.geometry.type !== "Point" && d3.geoContains(feature, coordinate);
    }) || null;
  }

  function consumePointer(event) {
    if (event.target.closest("button")) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }

  stage.addEventListener("pointerdown", event => {
    if (!consumePointer(event)) return;
    stopAnimation();
    interacting = true;
    stage.classList.add("is-globe-dragging");
    stage.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      gesture = { type: "rotate", x: event.clientX, y: event.clientY, rotation: [...rotation], moved: false };
    } else if (pointers.size === 2) {
      gesture = { type: "pinch", distance: pointerDistance([...pointers.values()]), zoom, moved: true };
    }
    queue();
  }, { capture: true, passive: false });

  stage.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId) || !gesture || !consumePointer(event)) return;
    const samples = event.getCoalescedEvents?.() || [event];
    const latest = samples.at(-1) || event;
    pointers.set(event.pointerId, { x: latest.clientX, y: latest.clientY });
    if (pointers.size >= 2) {
      const distance = pointerDistance([...pointers.values()].slice(0, 2));
      if (gesture.type !== "pinch") gesture = { type: "pinch", distance, zoom, moved: true };
      if (gesture.distance > 0) zoom = clampZoom(gesture.zoom * distance / gesture.distance);
      gesture.moved = true;
      gradientCache = null;
      queue();
      return;
    }
    if (gesture.type === "rotate") {
      const dx = latest.clientX - gesture.x;
      const dy = latest.clientY - gesture.y;
      if (Math.hypot(dx, dy) > 5) gesture.moved = true;
      const rect = stage.getBoundingClientRect();
      const sensitivity = 180 / Math.max(300, Math.min(rect.width, rect.height) * zoom);
      rotation = [
        gesture.rotation[0] + dx * sensitivity,
        Math.max(-82, Math.min(82, gesture.rotation[1] - dy * sensitivity)),
        0
      ];
      queue();
    }
  }, { capture: true, passive: false });

  const finishPointer = event => {
    if (!pointers.has(event.pointerId) || !consumePointer(event)) return;
    const tap = pointers.size === 1 && gesture?.type === "rotate" && !gesture.moved
      ? { x: event.clientX, y: event.clientY }
      : null;
    pointers.delete(event.pointerId);
    if (!pointers.size) {
      interacting = false;
      stage.classList.remove("is-globe-dragging");
      gesture = null;
      gradientCache = null;
      if (tap) showGuessInfo(guessedAt(tap.x, tap.y));
    }
    queue();
  };

  stage.addEventListener("pointerup", finishPointer, { capture: true, passive: false });
  stage.addEventListener("pointercancel", event => {
    if (!pointers.has(event.pointerId) || !consumePointer(event)) return;
    pointers.delete(event.pointerId);
    if (!pointers.size) {
      interacting = false;
      stage.classList.remove("is-globe-dragging");
      gesture = null;
      gradientCache = null;
    }
    queue();
  }, { capture: true, passive: false });

  stage.addEventListener("wheel", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    stopAnimation();
    zoom = clampZoom(zoom * Math.exp(-event.deltaY * .0012));
    gradientCache = null;
    queue();
  }, { capture: true, passive: false });

  stage.addEventListener("dblclick", event => {
    event.preventDefault();
    stopAnimation();
    zoom = clampZoom(zoom * 1.35);
    gradientCache = null;
    queue();
  });

  stage.addEventListener("keydown", event => {
    const amount = 8 / zoom;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowLeft") rotation[0] -= amount;
    if (event.key === "ArrowRight") rotation[0] += amount;
    if (event.key === "ArrowUp") rotation[1] = Math.min(82, rotation[1] + amount);
    if (event.key === "ArrowDown") rotation[1] = Math.max(-82, rotation[1] - amount);
    if (event.key === "+" || event.key === "=") zoom = clampZoom(zoom * 1.2);
    if (event.key === "-") zoom = clampZoom(zoom / 1.2);
    if (event.key === "Escape" && expanded) toggleExpanded();
    gradientCache = null;
    queue();
  });

  function centreHome() {
    const feature = featureByCode.get(currentView?.homeCode);
    if (!feature) {
      animateView(initialRotation, 1, 420);
      return;
    }
    const coordinate = feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature);
    animateView([-coordinate[0], -coordinate[1], 0], Math.max(1.18, Math.min(zoom, 1.5)), 420);
  }

  function reset() {
    if (kind === "duel") centreHome();
    else animateView(initialRotation, 1, 420);
  }

  function toggleExpanded() {
    expanded = !expanded;
    panel.classList.toggle("is-globe-expanded", expanded);
    document.body.classList.toggle("globe-expanded", expanded);
    const button = document.getElementById("globeExpand");
    button?.classList.toggle("is-active", expanded);
    button?.setAttribute("aria-label", expanded ? "Close expanded globe" : "Expand globe");
    gradientCache = null;
    setTimeout(queue, 40);
  }

  const captureButton = (button, action) => button?.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    action();
  }, true);

  captureButton(document.getElementById("globeZoomIn"), () => {
    zoom = clampZoom(zoom * 1.25);
    gradientCache = null;
    queue();
  });
  captureButton(document.getElementById("globeZoomOut"), () => {
    zoom = clampZoom(zoom / 1.25);
    gradientCache = null;
    queue();
  });
  captureButton(document.getElementById("globeReset"), reset);
  captureButton(document.getElementById("globeExpand"), toggleExpanded);
  captureButton(document.getElementById("globeFocus"), () => {
    const best = bestGuess(currentView?.guesses || []);
    if (best) focusCountry(best.code, 1.72, 440);
  });

  function refreshState({ focus = true } = {}) {
    const next = readView();
    const nextSignature = signature(next);
    const changed = nextSignature !== stateSignature;
    const previousLatest = currentView?.guesses?.at(-1)?.code || null;
    currentView = next;
    stateSignature = nextSignature;

    const best = bestGuess(next.guesses || []);
    const focusButton = document.getElementById("globeFocus");
    if (focusButton) focusButton.disabled = !best;

    const status = document.getElementById("globeStatus");
    if (status) {
      if (next.finished && next.answerCode) {
        status.textContent = `${countryByCode.get(next.answerCode)?.name || "Country"} located`;
      } else if (next.guesses?.length) {
        status.textContent = `${next.guesses.length} signal${next.guesses.length === 1 ? "" : "s"} mapped · rotate to explore`;
      } else {
        status.textContent = kind === "cooperative" ? "Shared globe ready" : "Rotate the globe to explore";
      }
    }

    if (changed) queue();
    if (!focus) return;

    const latest = next.guesses?.at(-1)?.code || null;
    const target = next.finished && next.answerCode ? next.answerCode : latest;
    if (target && (target !== latestFocusedCode || latest !== previousLatest)) {
      latestFocusedCode = target;
      focusCountry(target, next.finished ? undefined : Math.max(1.14, Math.min(zoom, 1.48)), next.finished ? 620 : 420);
    }
  }

  const resizeObserver = new ResizeObserver(() => {
    gradientCache = null;
    queue();
  });
  resizeObserver.observe(stage);

  const observerTargets = [
    document.querySelector(".guess-history"),
    document.querySelector(".mode-scoreboard"),
    document.querySelector(".race-scoreboard"),
    document.querySelector(".feedback-panel")
  ].filter(Boolean);
  observerTargets.forEach(target => new MutationObserver(() => refreshState({ focus: true }))
    .observe(target, { childList: true, subtree: true, characterData: true }));

  document.addEventListener("click", event => {
    if (event.target.closest("button, .mode-button")) setTimeout(() => refreshState({ focus: true }), 40);
  }, true);
  window.addEventListener("storage", () => refreshState({ focus: false }));
  window.addEventListener("pageshow", () => refreshState({ focus: false }));
  window.addEventListener("nearer:statechange", () => refreshState({ focus: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopAnimation();
      return;
    }
    refreshState({ focus: false });
    queue();
  });

  currentView = readView();
  stateSignature = signature(currentView);
  refreshState({ focus: false });
  window.NEARER_PREMIUM_GLOBE = { queue, centreHome, reset, focusCountry, refresh: refreshState };
  window.__NEARER_REAL_GLOBE_STARTED = true;
  window.__NEARER_CANVAS_GLOBE_STARTED = true;
  window.__NEARER_PREMIUM_GLOBE_STARTED = true;
  window.__NEARER_PREMIUM_GLOBE_V2_STARTED = true;
  queue();
})();
