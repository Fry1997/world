(() => {
  "use strict";
  if (window.__NEARER_PREMIUM_GLOBE_STARTED) return;

  const d3 = window.NEARER_D3;
  const gameData = window.NEARER_GAME_DATA;
  const geoData = window.NEARER_COUNTRIES_GEOJSON;
  const oldCanvas = document.querySelector("canvas.globe-canvas");
  const stage = oldCanvas?.closest(".globe-stage");
  if (!d3 || !gameData || !geoData || !oldCanvas || !stage) return;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!context) return;
  canvas.id = oldCanvas.id;
  canvas.className = oldCanvas.className;
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.premiumRenderer = "true";
  oldCanvas.replaceWith(canvas);

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
  const initialRotation = [-12, -13, 0];
  let rotation = [...initialRotation];
  let zoom = 1;
  let gesture = null;
  let queued = false;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastRatio = 0;
  let stateSignature = "";

  const pathname = location.pathname;
  const kind = pathname.includes("/together/duel/") ? "duel"
    : pathname.includes("/together/cooperative/") ? "cooperative"
    : pathname.includes("/together/race/") ? "race"
    : "solo";

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch { return null; }
  }

  function localDateKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function view() {
    if (kind === "solo") {
      const saved = readJson("nearer-game-v1") || {};
      const mode = document.querySelector(".mode-button.is-active")?.dataset.mode || saved.mode || "daily";
      const current = mode === "random" ? saved.randomGame : saved.dailyGames?.[localDateKey()];
      return {
        guesses: current?.guesses || [],
        opponentGuesses: [],
        homeCode: null,
        answerCode: current?.secretCode || null,
        finished: Boolean(current?.complete)
      };
    }
    if (kind === "cooperative") {
      const state = readJson("nearer-cooperative-relay-v1");
      return {
        guesses: state?.guesses || [], opponentGuesses: [], homeCode: null,
        answerCode: state?.targetCode || null, finished: state?.status === "finished"
      };
    }
    if (kind === "race") {
      const state = readJson("nearer-pass-race-v2");
      const player = state?.players?.[state.currentPlayer || 0];
      return {
        guesses: player?.guesses || [], opponentGuesses: [], homeCode: null,
        answerCode: state?.targetCode || null,
        finished: Boolean(player?.solvedAt !== null && player?.solvedAt !== undefined)
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

  function rgb(hex) {
    const value = hex.replace("#", "");
    return [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
  }

  function mix(a, b, amount) {
    const first = rgb(a); const second = rgb(b);
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
      opponent: "#7892a7",
      home: "#f0d6c7",
      homeStroke: "#ee7459"
    };
  }

  function ratio() {
    const mobile = matchMedia("(max-width:820px)").matches;
    return Math.min(devicePixelRatio || 1, mobile ? 2.35 : 2);
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const pixelRatio = ratio();
    if (width !== lastWidth || height !== lastHeight || Math.abs(pixelRatio - lastRatio) > .01) {
      lastWidth = width; lastHeight = height; lastRatio = pixelRatio;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    return { width, height };
  }

  function visible(coordinate) {
    return d3.geoDistance([-rotation[0], -rotation[1]], coordinate) <= Math.PI / 2 + .015;
  }

  function drawPath(feature, fill, stroke, width = 1, options = {}) {
    context.save();
    context.globalAlpha = options.alpha ?? 1;
    context.beginPath();
    path(feature);
    if (fill) { context.fillStyle = fill; context.fill("evenodd"); }
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = width;
      context.setLineDash(options.dash || []);
      if (options.glow) {
        context.shadowColor = options.glow;
        context.shadowBlur = options.blur || 10;
      }
      context.stroke();
    }
    context.restore();
  }

  function drawSphere(width, height, radius, p) {
    const x = width / 2, y = height / 2;
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = p.oceanBottom;
    context.shadowColor = "rgba(0,5,10,.68)";
    context.shadowBlur = 30;
    context.shadowOffsetY = 17;
    context.fill();
    context.restore();

    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.clip();
    const ocean = context.createRadialGradient(x + radius * .28, y - radius * .33, radius * .03, x, y, radius * 1.12);
    ocean.addColorStop(0, p.oceanTop);
    ocean.addColorStop(.48, p.oceanMid);
    ocean.addColorStop(1, p.oceanBottom);
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
    if (document.hidden || !stage.isConnected) return;
    const { width, height } = resize();
    const p = palette();
    const radius = Math.min(width, height) * .43 * zoom;
    projection.translate([width / 2, height / 2]).scale(radius).rotate(rotation).precision(.38);
    drawSphere(width, height, radius, p);

    context.save();
    context.beginPath(); path(graticule);
    context.strokeStyle = p.grid; context.lineWidth = .62; context.stroke();
    context.restore();

    const landGradient = context.createLinearGradient(width * .18, height * .12, width * .78, height * .9);
    landGradient.addColorStop(0, p.landTop);
    landGradient.addColorStop(.54, p.landMid);
    landGradient.addColorStop(1, p.landBottom);
    drawPath(collection, landGradient, p.border, .7);

    const current = view();
    const own = current.guesses || [];
    const opponent = current.opponentGuesses || [];
    const latestCode = own.at(-1)?.code || null;

    if (kind === "duel" && current.revealsComplete) {
      for (const guess of opponent) {
        const feature = featureByCode.get(guess.code);
        if (!feature || feature.geometry.type === "Point") continue;
        drawPath(feature, p.opponent, "rgba(222,234,241,.72)", 1.15, { alpha: .58 });
      }

      const home = featureByCode.get(current.homeCode);
      if (home) {
        if (home.geometry.type === "Point") drawPoint(home, p.home, true, p.homeStroke);
        else drawPath(home, "rgba(240,214,199,.34)", p.homeStroke, 2.8, { glow: "rgba(238,116,89,.55)", blur: 12 });

        const best = bestGuess(opponent);
        const centroid = home.geometry.type === "Point" ? home.geometry.coordinates : d3.geoCentroid(home);
        if (best && centroid && best.distance <= 3219) {
          const radiusDegrees = Math.max(.8, best.distance / 111.195);
          const circle = d3.geoCircle().center(centroid).radius(radiusDegrees).precision(2)();
          drawPath(circle, "rgba(120,146,167,.055)", "rgba(151,177,196,.78)", 1.8, { dash: [7, 6] });
        }
      }
    }

    for (const guess of own) {
      const feature = featureByCode.get(guess.code);
      if (!feature || feature.geometry.type === "Point") continue;
      const latest = guess.code === latestCode;
      drawPath(feature, heatColour(guess.distance), latest ? "#fff3dc" : "rgba(255,247,232,.76)", latest ? 2.35 : 1.12, latest ? { glow: "rgba(233,173,78,.55)", blur: 10 } : {});
    }

    if (current.finished && current.answerCode) {
      const answer = featureByCode.get(current.answerCode);
      if (answer && answer.geometry.type !== "Point") drawPath(answer, "#4ea985", "#fff7eb", 2.7, { glow: "rgba(94,184,149,.48)", blur: 12 });
    }

    for (const feature of points) {
      const code = feature.properties.code;
      const ownGuess = own.find(item => item.code === code);
      const opponentGuess = opponent.find(item => item.code === code);
      if (opponentGuess && kind === "duel") drawPoint(feature, p.opponent, false, "rgba(230,240,246,.78)");
      if (ownGuess) drawPoint(feature, heatColour(ownGuess.distance), code === latestCode);
      if (current.finished && current.answerCode === code) drawPoint(feature, "#4ea985", true);
    }

    const x = width / 2, y = height / 2;
    context.save();
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.clip();
    const light = context.createRadialGradient(x + radius * .5, y - radius * .48, 0, x + radius * .28, y - radius * .24, radius * 1.22);
    light.addColorStop(0, "rgba(255,249,225,.18)");
    light.addColorStop(.28, "rgba(255,248,228,.055)");
    light.addColorStop(.68, "rgba(3,13,22,.03)");
    light.addColorStop(1, "rgba(0,4,8,.34)");
    context.fillStyle = light;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    context.restore();

    context.save();
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2);
    context.strokeStyle = p.rim; context.lineWidth = 1.45; context.stroke();
    context.beginPath(); context.arc(x, y, radius - .6, -1.28, .26);
    context.strokeStyle = "rgba(225,244,255,.44)"; context.lineWidth = 2.1;
    context.shadowColor = "rgba(177,222,246,.36)"; context.shadowBlur = 12; context.stroke();
    context.restore();
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(draw);
  }

  function clampZoom(value) { return Math.max(.72, Math.min(4.8, value)); }
  function pointerDistance(values) { const [a, b] = values; return Math.hypot(a.x - b.x, a.y - b.y); }

  stage.addEventListener("pointerdown", event => {
    if (event.target.closest("button")) return;
    stage.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) gesture = { type: "rotate", x: event.clientX, y: event.clientY, rotation: [...rotation] };
    else if (pointers.size === 2) gesture = { type: "pinch", distance: pointerDistance([...pointers.values()]), zoom };
  });

  stage.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const distance = pointerDistance([...pointers.values()].slice(0, 2));
      if (gesture.type !== "pinch") gesture = { type: "pinch", distance, zoom };
      if (gesture.distance > 0) zoom = clampZoom(gesture.zoom * distance / gesture.distance);
      queue(); return;
    }
    if (gesture.type === "rotate") {
      const rect = stage.getBoundingClientRect();
      const sensitivity = 180 / Math.max(300, Math.min(rect.width, rect.height) * zoom);
      rotation = [gesture.rotation[0] + (event.clientX - gesture.x) * sensitivity, Math.max(-82, Math.min(82, gesture.rotation[1] - (event.clientY - gesture.y) * sensitivity)), 0];
      queue();
    }
  });

  const finish = event => {
    pointers.delete(event.pointerId);
    if (!pointers.size) gesture = null;
    queue();
  };
  stage.addEventListener("pointerup", finish);
  stage.addEventListener("pointercancel", finish);
  stage.addEventListener("wheel", event => { event.preventDefault(); zoom = clampZoom(zoom * Math.exp(-event.deltaY * .0012)); queue(); }, { passive: false });

  document.getElementById("globeZoomIn")?.addEventListener("click", () => { zoom = clampZoom(zoom * 1.25); queue(); });
  document.getElementById("globeZoomOut")?.addEventListener("click", () => { zoom = clampZoom(zoom / 1.25); queue(); });
  document.getElementById("globeReset")?.addEventListener("click", () => { rotation = [...initialRotation]; zoom = 1; queue(); });

  new ResizeObserver(queue).observe(stage);
  const observerTargets = [document.querySelector(".guess-history"), document.querySelector(".mode-scoreboard"), document.querySelector(".race-scoreboard"), document.querySelector(".feedback-panel")].filter(Boolean);
  observerTargets.forEach(target => new MutationObserver(queue).observe(target, { childList: true, subtree: true, characterData: true }));
  document.addEventListener("click", () => setTimeout(queue, 70), true);
  window.addEventListener("storage", queue);
  window.addEventListener("pageshow", queue);

  setInterval(() => {
    const current = view();
    const signature = JSON.stringify([current.guesses, current.opponentGuesses, current.homeCode, current.answerCode, current.finished]);
    if (signature !== stateSignature) { stateSignature = signature; queue(); }
  }, 450);

  window.__NEARER_PREMIUM_GLOBE_STARTED = true;
  queue();
})();
