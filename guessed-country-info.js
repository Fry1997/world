(() => {
  "use strict";

  const VERSION = "20260718-canvas3";
  const STORAGE_KEY = "nearer-game-v1";
  const d3 = window.NEARER_D3;
  const gameData = window.NEARER_GAME_DATA;
  const geoData = window.NEARER_COUNTRIES_GEOJSON;
  const projection = window.__NEARER_GLOBE_PROJECTION;
  const stage = document.getElementById("globeStage");

  if (!d3 || !gameData || !geoData || !projection || !stage) {
    console.error("Nearer guessed-country identification could not start.");
    return;
  }

  const countryByCode = new Map(gameData.countries.map(country => [country.code, country]));
  const featureByCode = new Map(
    geoData.features
      .filter(feature => countryByCode.has(feature.properties.code))
      .map(feature => [feature.properties.code, feature])
  );

  const style = document.createElement("style");
  style.dataset.nearerGuessedCountryInfo = VERSION;
  style.textContent = `
    .globe-guess-info {
      position: absolute;
      z-index: 7;
      top: 14px;
      left: 50%;
      min-width: 170px;
      max-width: calc(100% - 110px);
      transform: translateX(-50%);
      padding: 9px 40px 10px 13px;
      border: 1px solid color-mix(in srgb, var(--line-strong) 82%, transparent);
      border-radius: 13px;
      background: color-mix(in srgb, var(--panel-strong) 94%, transparent);
      color: var(--ink);
      box-shadow: 0 12px 32px rgba(16, 24, 32, .17);
      backdrop-filter: blur(12px);
      pointer-events: auto;
    }
    .globe-guess-info.is-hidden { display: none; }
    .globe-guess-info span,
    .globe-guess-info strong { display: block; }
    .globe-guess-info span {
      color: var(--ink-soft);
      font-size: .64rem;
      font-weight: 650;
      letter-spacing: .05em;
      text-transform: uppercase;
    }
    .globe-guess-info strong { margin-top: 2px; font-size: .86rem; }
    .globe-guess-info button {
      position: absolute;
      top: 50%;
      right: 8px;
      width: 27px;
      height: 27px;
      transform: translateY(-50%);
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--ink-soft);
      font-size: 1.1rem;
      cursor: pointer;
    }
    .globe-guess-info button:hover { background: var(--accent-soft); color: var(--ink); }
  `;
  document.head.appendChild(style);

  const info = document.createElement("div");
  info.id = "globeGuessInfo";
  info.className = "globe-guess-info is-hidden";
  info.setAttribute("role", "status");
  info.setAttribute("aria-live", "polite");
  info.innerHTML = `
    <span>Already guessed</span>
    <strong id="globeGuessInfoName"></strong>
    <button type="button" aria-label="Close country name">×</button>
  `;
  stage.appendChild(info);

  const nameNode = info.querySelector("strong");
  const closeButton = info.querySelector("button");
  const hint = stage.querySelector(".globe-hint");
  if (hint) hint.textContent = "Tap coloured guesses for names · drag to rotate";

  function preferences() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {};
    } catch {
      return {};
    }
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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

  function hideInfo() {
    info.classList.add("is-hidden");
    nameNode.textContent = "";
  }

  function showInfo(guess) {
    const country = countryByCode.get(guess.code);
    if (!country) return;
    nameNode.textContent = country.name;
    info.classList.remove("is-hidden");
  }

  function centreCoordinate() {
    const rotation = projection.rotate();
    return [-rotation[0], -rotation[1]];
  }

  function isVisible(coordinate) {
    return d3.geoDistance(centreCoordinate(), coordinate) <= Math.PI / 2 + 0.015;
  }

  function guessedCountryAt(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const point = [clientX - rect.left, clientY - rect.top];
    const translate = projection.translate();
    const radius = projection.scale();

    if (Math.hypot(point[0] - translate[0], point[1] - translate[1]) > radius) {
      return null;
    }

    const guesses = [...(currentState().guesses || [])].reverse();

    for (const guess of guesses) {
      const feature = featureByCode.get(guess.code);
      if (!feature || feature.geometry.type !== "Point") continue;
      const coordinate = feature.geometry.coordinates;
      if (!isVisible(coordinate)) continue;
      const projected = projection(coordinate);
      if (projected && Math.hypot(projected[0] - point[0], projected[1] - point[1]) <= 16) {
        return guess;
      }
    }

    const coordinate = projection.invert(point);
    if (!coordinate) return null;

    for (const guess of guesses) {
      const feature = featureByCode.get(guess.code);
      if (!feature || feature.geometry.type === "Point") continue;
      if (d3.geoContains(feature, coordinate)) return guess;
    }

    return null;
  }

  function revealAt(clientX, clientY) {
    const guess = guessedCountryAt(clientX, clientY);
    if (guess) showInfo(guess);
    else hideInfo();
  }

  const activePointers = new Map();
  let tapCandidate = null;

  stage.addEventListener("pointerdown", event => {
    if (event.target.closest("button")) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size === 1) {
      tapCandidate = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        moved: false
      };
    } else {
      tapCandidate = null;
    }
  });

  stage.addEventListener("pointermove", event => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size > 1) {
      tapCandidate = null;
      return;
    }
    if (!tapCandidate || tapCandidate.pointerId !== event.pointerId) return;
    tapCandidate.clientX = event.clientX;
    tapCandidate.clientY = event.clientY;
    if (Math.hypot(event.clientX - tapCandidate.startX, event.clientY - tapCandidate.startY) > 8) {
      tapCandidate.moved = true;
    }
  });

  const finishPointer = event => {
    const tap = tapCandidate &&
      tapCandidate.pointerId === event.pointerId &&
      !tapCandidate.moved &&
      activePointers.size === 1
      ? { x: tapCandidate.clientX, y: tapCandidate.clientY }
      : null;

    activePointers.delete(event.pointerId);
    if (!activePointers.size && tap) revealAt(tap.x, tap.y);
    tapCandidate = null;
  };

  stage.addEventListener("pointerup", finishPointer);
  stage.addEventListener("pointercancel", event => {
    activePointers.delete(event.pointerId);
    tapCandidate = null;
  });

  closeButton.addEventListener("click", hideInfo);

  document.addEventListener("click", event => {
    if (
      event.target.closest(
        ".mode-button, #themeButton, #newGameButton, #guessButton"
      )
    ) {
      hideInfo();
    }
  }, true);

  window.addEventListener("storage", hideInfo);

  stage.setAttribute(
    "aria-label",
    "Interactive 3D globe showing submitted guesses. Drag to rotate and pinch or scroll to zoom. Tap a coloured guessed country to see its name; unguessed countries remain anonymous."
  );

  window.__NEARER_GUESSED_COUNTRY_INFO_STARTED = true;
})();
