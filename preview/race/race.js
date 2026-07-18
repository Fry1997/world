(() => {
  "use strict";

  const STORAGE_KEY = "nearer-pass-race-v1";
  const THEME_KEY = "nearer-race-theme";
  const d3 = window.NEARER_D3;
  const gameData = window.NEARER_GAME_DATA;
  const geoData = window.NEARER_COUNTRIES_GEOJSON;

  if (!d3 || !gameData || !geoData) return;

  const countries = [...gameData.countries].sort((a, b) => a.name.localeCompare(b.name));
  const countryByCode = new Map(countries.map(country => [country.code, country]));
  const featureByCode = new Map(geoData.features.map(feature => [feature.properties.code, feature]));
  const polygonFeatures = geoData.features.filter(feature => feature.geometry.type !== "Point");
  const pointFeatures = geoData.features.filter(feature => feature.geometry.type === "Point");
  const polygonCollection = { type: "FeatureCollection", features: polygonFeatures };

  const elements = {
    setupView: document.getElementById("setupView"),
    gameView: document.getElementById("gameView"),
    playerOneName: document.getElementById("playerOneName"),
    playerTwoName: document.getElementById("playerTwoName"),
    start: document.getElementById("startRaceButton"),
    resume: document.getElementById("resumeRaceButton"),
    quit: document.getElementById("quitRaceButton"),
    unit: document.getElementById("unitButton"),
    theme: document.getElementById("themeButton"),
    turnEyebrow: document.getElementById("turnEyebrow"),
    turnTitle: document.getElementById("turnTitle"),
    turnCopy: document.getElementById("turnCopy"),
    scoreboard: document.getElementById("scoreboard"),
    input: document.getElementById("countryInput"),
    clear: document.getElementById("clearInputButton"),
    suggestions: document.getElementById("raceSuggestions"),
    guess: document.getElementById("makeGuessButton"),
    feedback: document.getElementById("raceFeedback"),
    history: document.getElementById("raceGuessHistory"),
    historyEmpty: document.getElementById("historyEmpty"),
    historyHeading: document.getElementById("historyHeading"),
    guessCount: document.getElementById("guessCount"),
    passScreen: document.getElementById("passScreen"),
    passEyebrow: document.getElementById("passEyebrow"),
    passTitle: document.getElementById("passTitle"),
    passCopy: document.getElementById("passCopy"),
    passStandings: document.getElementById("passStandings"),
    beginTurn: document.getElementById("beginTurnButton"),
    result: document.getElementById("resultDialog"),
    resultTitle: document.getElementById("resultTitle"),
    resultSummary: document.getElementById("resultSummary"),
    resultStats: document.getElementById("resultStats"),
    rematch: document.getElementById("rematchButton"),
    closeResult: document.getElementById("closeResultButton"),
    toast: document.getElementById("raceToast"),
    loading: document.getElementById("raceLoading"),
    stage: document.getElementById("raceGlobeStage"),
    canvas: document.getElementById("raceGlobeCanvas"),
    globeStatus: document.getElementById("globeStatus"),
    reset: document.getElementById("globeReset"),
    zoomIn: document.getElementById("globeZoomIn"),
    zoomOut: document.getElementById("globeZoomOut"),
    chip: document.getElementById("guessedCountryChip")
  };

  const normalise = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  const aliases = countries.flatMap(country =>
    [country.name, country.code, ...(country.aliases || [])]
      .map(name => ({ country, key: normalise(name) }))
  );
  const exactCountry = new Map(aliases.map(item => [item.key, item.country]));

  let state = null;
  let selectedCountry = null;
  let activeSuggestion = -1;
  let pendingTypo = null;
  let toastTimer = 0;
  let preferredUnits = "km";
  let turnLocked = true;

  function savedState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return value?.version === 1 ? value : null;
    } catch {
      return null;
    }
  }

  function persist() {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
    const saved = savedState();
    elements.resume.classList.toggle("is-hidden", !saved?.status || saved.status === "finished");
  }

  function createPlayer(name) {
    return { name, guesses: [], solvedAt: null };
  }

  function cleanName(value, fallback) {
    return String(value || "").trim().slice(0, 20) || fallback;
  }

  function randomTarget() {
    return countries[Math.floor(Math.random() * countries.length)].code;
  }

  function createState(names, targetCode = randomTarget()) {
    return {
      version: 1,
      mode: "same-target-race",
      status: "active",
      units: preferredUnits,
      targetCode,
      currentPlayer: 0,
      round: 1,
      pendingWinner: null,
      winner: null,
      result: null,
      players: [createPlayer(names[0]), createPlayer(names[1])],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function currentPlayer() {
    return state.players[state.currentPlayer];
  }

  function opponentPlayer() {
    return state.players[1 - state.currentPlayer];
  }

  function closest(player) {
    if (!player.guesses.length) return null;
    return [...player.guesses].sort((a, b) => a.distance - b.distance || a.order - b.order)[0];
  }

  function trend(player) {
    const guesses = player.guesses;
    if (guesses.length < 2) return null;
    const previous = guesses.at(-2).distance;
    const latest = guesses.at(-1).distance;
    return { delta: previous - latest, latest };
  }

  function displayDistance(km) {
    if (km === null || km === undefined) return "No signal";
    if (km === 0) return "Found";
    if (state?.units === "mi") return `${Math.round(km * 0.621371).toLocaleString()} mi`;
    return `${Math.round(km).toLocaleString()} km`;
  }

  function heatColour(distance) {
    const closeness = 1 - Math.min(distance, 9000) / 9000;
    const eased = Math.pow(closeness, 0.72);
    const dark = document.documentElement.dataset.theme === "dark";
    return `hsl(${(218 - eased * 210).toFixed(0)} ${(58 + eased * 28).toFixed(0)}% ${(dark ? 45 + eased * 9 : 57 - eased * 5).toFixed(0)}%)`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
  }

  function setFeedback(kind, title, copy) {
    elements.feedback.className = `feedback-panel ${kind ? `is-${kind}` : "is-empty"}`;
    elements.feedback.querySelector("strong").textContent = title;
    elements.feedback.querySelector("p").textContent = copy;
  }

  function playerMetric(player, index) {
    const best = closest(player);
    const movement = trend(player);
    let trendCopy = "No movement yet";
    if (movement) {
      if (movement.delta > 0) trendCopy = `Last turn closed by ${displayDistance(movement.delta)}`;
      else if (movement.delta < 0) trendCopy = `Last turn moved ${displayDistance(Math.abs(movement.delta))} farther away`;
      else trendCopy = "Last turn stayed the same distance";
    } else if (player.guesses.length) {
      trendCopy = "First signal recorded";
    }

    return `
      <article class="race-player-card ${state.currentPlayer === index && state.status === "active" ? "is-active" : ""}">
        <div class="race-player-card-top"><strong>${escapeHtml(player.name)}</strong>${state.currentPlayer === index && state.status === "active" ? '<span class="race-turn-badge">TURN</span>' : ""}</div>
        <div class="race-player-metrics">
          <span>Guesses<b>${player.guesses.length}</b></span>
          <span>Closest<b>${displayDistance(best?.distance ?? null)}</b></span>
        </div>
        <div class="race-trend">${trendCopy}</div>
      </article>`;
  }

  function renderScoreboard() {
    elements.scoreboard.innerHTML = state.players.map(playerMetric).join("");
  }

  function renderHistory() {
    const player = currentPlayer();
    const sorted = [...player.guesses].sort((a, b) => a.distance - b.distance || a.order - b.order);
    elements.historyHeading.textContent = `${player.name}'s guesses`;
    elements.guessCount.textContent = String(player.guesses.length);
    elements.historyEmpty.classList.toggle("is-hidden", sorted.length > 0);
    elements.history.innerHTML = sorted.map((guess, index) => `
      <li class="guess-row ${guess.order === player.guesses.length ? "is-latest" : ""}">
        <span class="guess-rank">${index + 1}</span>
        <span class="guess-swatch" style="background:${heatColour(guess.distance)}"></span>
        <span class="guess-country"><strong>${escapeHtml(guess.name)}</strong><small>Round ${guess.round} · guess ${guess.order}</small></span>
        <strong class="guess-distance">${displayDistance(guess.distance)}</strong>
      </li>`).join("");
  }

  function renderTurn() {
    const player = currentPlayer();
    const opponent = opponentPlayer();
    const opponentBest = closest(opponent);
    elements.turnEyebrow.textContent = `ROUND ${state.round} · ${player.name.toUpperCase()}`;
    elements.turnTitle.textContent = `${player.name}, make your guess.`;
    elements.turnCopy.textContent = opponentBest
      ? `${opponent.name} is currently within ${displayDistance(opponentBest.distance)} of the target.`
      : `${opponent.name} has not recorded a signal yet.`;
    elements.globeStatus.textContent = player.guesses.length
      ? `${player.guesses.length} private signal${player.guesses.length === 1 ? "" : "s"} mapped`
      : "Rotate the globe to explore";
    elements.unit.textContent = state.units.toUpperCase();
    renderScoreboard();
    renderHistory();
    resetInput();
    setFeedback("", "Your turn is private.", "The other player can see your closest distance, but not the countries you try.");
    globe.queueRender();
  }

  function resetInput() {
    selectedCountry = null;
    pendingTypo = null;
    activeSuggestion = -1;
    elements.input.value = "";
    elements.clear.classList.add("is-hidden");
    hideSuggestions();
  }

  function showPassScreen(firstTurn = false) {
    turnLocked = true;
    const player = currentPlayer();
    const opponent = opponentPlayer();
    elements.passEyebrow.textContent = firstTurn ? "RACE READY" : "PASS THE PHONE";
    elements.passTitle.textContent = firstTurn ? `${player.name}, get ready` : `Pass to ${player.name}`;
    elements.passCopy.textContent = firstTurn
      ? "Your private globe will appear when you begin."
      : `${opponent.name}'s route has been hidden.`;
    elements.beginTurn.textContent = `Start ${player.name}'s turn`;
    elements.passStandings.innerHTML = state.players.map(playerItem => {
      const best = closest(playerItem);
      return `<div class="pass-standing"><span>${escapeHtml(playerItem.name)}</span><strong>${playerItem.guesses.length} guesses · ${displayDistance(best?.distance ?? null)}</strong></div>`;
    }).join("");
    elements.passScreen.classList.remove("is-hidden");
    document.body.style.overflow = "hidden";
  }

  function hidePassScreen() {
    turnLocked = false;
    elements.passScreen.classList.add("is-hidden");
    document.body.style.overflow = "";
    renderTurn();
    setTimeout(() => elements.input.focus(), 80);
  }

  function startRace(names) {
    state = createState(names);
    persist();
    elements.setupView.classList.add("is-hidden");
    elements.gameView.classList.remove("is-hidden");
    showPassScreen(true);
  }

  function resumeRace() {
    const saved = savedState();
    if (!saved || saved.status !== "active") return;
    state = saved;
    preferredUnits = state.units || preferredUnits;
    elements.setupView.classList.add("is-hidden");
    elements.gameView.classList.remove("is-hidden");
    showPassScreen(true);
  }

  function finishRace(result) {
    state.status = "finished";
    state.result = result;
    state.winner = result.type === "win" ? result.winner : null;
    state.updatedAt = Date.now();
    persist();

    const target = countryByCode.get(state.targetCode);
    const [first, second] = state.players;
    if (result.type === "draw") {
      elements.resultTitle.textContent = "It is a draw.";
      elements.resultSummary.textContent = `You both found ${target.name} in ${first.guesses.length} guesses.`;
    } else {
      const winner = state.players[result.winner];
      const other = state.players[1 - result.winner];
      elements.resultTitle.textContent = `${winner.name} wins.`;
      elements.resultSummary.textContent = `${winner.name} found ${target.name} in ${winner.guesses.length} guesses. ${other.name}'s closest signal was ${displayDistance(closest(other)?.distance ?? null)}.`;
    }
    elements.resultStats.innerHTML = state.players.map(player => `
      <div class="race-result-stat"><span>${escapeHtml(player.name)}</span><strong>${player.guesses.length} guesses · ${displayDistance(closest(player)?.distance ?? null)}</strong></div>`).join("");
    globe.queueRender();
    elements.result.showModal();
  }

  function advanceAfterGuess(playerIndex, wasCorrect) {
    if (playerIndex === 0) {
      if (wasCorrect) state.pendingWinner = 0;
      state.currentPlayer = 1;
      persist();
      showPassScreen();
      return;
    }

    if (wasCorrect && state.pendingWinner === 0) {
      finishRace({ type: "draw" });
      return;
    }
    if (wasCorrect) {
      finishRace({ type: "win", winner: 1 });
      return;
    }
    if (state.pendingWinner === 0) {
      finishRace({ type: "win", winner: 0 });
      return;
    }

    state.round += 1;
    state.currentPlayer = 0;
    persist();
    showPassScreen();
  }

  function submitGuess(country) {
    if (turnLocked) return;
    turnLocked = true;
    const playerIndex = state.currentPlayer;
    const player = state.players[playerIndex];
    if (player.guesses.some(guess => guess.code === country.code)) {
      setFeedback("colder", "Already tried.", `${country.name} is already on your private route.`);
      turnLocked = false;
      return;
    }

    const distance = gameData.distance(country.code, state.targetCode);
    const previous = player.guesses.at(-1);
    const guess = {
      code: country.code,
      name: country.name,
      distance,
      order: player.guesses.length + 1,
      round: state.round,
      createdAt: Date.now()
    };
    player.guesses.push(guess);
    if (distance === 0) player.solvedAt = player.guesses.length;
    state.updatedAt = Date.now();
    persist();

    if (distance === 0) {
      setFeedback("success", `${country.name} found.`, playerIndex === 0 ? "Player 2 now receives the equalising turn." : "The race is complete.");
    } else if (!previous) {
      setFeedback("", `${displayDistance(distance)} away.`, "Your first signal is locked in.");
    } else if (distance < previous.distance) {
      setFeedback("warmer", `${displayDistance(distance)} away.`, `You moved ${displayDistance(previous.distance - distance)} closer.`);
    } else if (distance > previous.distance) {
      setFeedback("colder", `${displayDistance(distance)} away.`, `You moved ${displayDistance(distance - previous.distance)} farther away.`);
    } else {
      setFeedback("", `${displayDistance(distance)} away.`, "That is the same distance as your previous guess.");
    }

    renderScoreboard();
    renderHistory();
    globe.focusCountry(country.code, Math.max(1.12, Math.min(globe.zoom(), 1.48)), 420);
    setTimeout(() => advanceAfterGuess(playerIndex, distance === 0), 1000);
  }

  function damerauLevenshtein(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let row = 0; row <= a.length; row += 1) matrix[row][0] = row;
    for (let column = 0; column <= b.length; column += 1) matrix[0][column] = column;
    for (let row = 1; row <= a.length; row += 1) {
      for (let column = 1; column <= b.length; column += 1) {
        const cost = a[row - 1] === b[column - 1] ? 0 : 1;
        matrix[row][column] = Math.min(
          matrix[row - 1][column] + 1,
          matrix[row][column - 1] + 1,
          matrix[row - 1][column - 1] + cost
        );
        if (row > 1 && column > 1 && a[row - 1] === b[column - 2] && a[row - 2] === b[column - 1]) {
          matrix[row][column] = Math.min(matrix[row][column], matrix[row - 2][column - 2] + 1);
        }
      }
    }
    return matrix[a.length][b.length];
  }

  function nearestCountry(value) {
    const query = normalise(value);
    if (query.length < 3) return null;
    let best = null;
    for (const item of aliases) {
      const distance = damerauLevenshtein(query, item.key);
      const longest = Math.max(query.length, item.key.length);
      const similarity = longest ? 1 - distance / longest : 1;
      if (!best || similarity > best.similarity || (similarity === best.similarity && distance < best.distance)) {
        best = { country: item.country, distance, similarity };
      }
    }
    const maximumDistance = query.length <= 6 ? 2 : query.length <= 11 ? 3 : 4;
    return best && best.distance <= maximumDistance && best.similarity >= .68 ? best.country : null;
  }

  function matchingCountries(value) {
    const query = normalise(value);
    if (!query) return [];
    const scores = new Map();
    for (const item of aliases) {
      let score = Infinity;
      if (item.key === query) score = 0;
      else if (item.key.startsWith(query)) score = 1 + item.key.length / 100;
      else if (item.key.includes(query)) score = 3 + item.key.indexOf(query) / 100;
      if (score < Infinity && (!scores.has(item.country.code) || score < scores.get(item.country.code).score)) {
        scores.set(item.country.code, { country: item.country, score });
      }
    }
    return [...scores.values()].sort((a, b) => a.score - b.score || a.country.name.localeCompare(b.country.name)).slice(0, 6).map(item => item.country);
  }

  function renderSuggestions() {
    const matches = matchingCountries(elements.input.value);
    activeSuggestion = -1;
    if (!matches.length) {
      hideSuggestions();
      return;
    }
    elements.suggestions.innerHTML = matches.map((country, index) => `
      <button class="suggestion-button" type="button" role="option" data-code="${country.code}" data-index="${index}">
        <span>${escapeHtml(country.name)}</span><small>${country.code}</small>
      </button>`).join("");
    elements.suggestions.classList.remove("is-hidden");
    elements.input.setAttribute("aria-expanded", "true");
  }

  function hideSuggestions() {
    elements.suggestions.classList.add("is-hidden");
    elements.suggestions.innerHTML = "";
    elements.input.setAttribute("aria-expanded", "false");
  }

  function chooseCountry(country) {
    selectedCountry = country;
    pendingTypo = null;
    elements.input.value = country.name;
    elements.clear.classList.remove("is-hidden");
    hideSuggestions();
  }

  function attemptGuess() {
    if (turnLocked) return;
    const query = normalise(elements.input.value);
    const exact = selectedCountry || exactCountry.get(query);
    if (exact) {
      submitGuess(exact);
      resetInput();
      return;
    }
    const suggestion = nearestCountry(query);
    if (suggestion && pendingTypo?.code === suggestion.code) {
      submitGuess(suggestion);
      resetInput();
      return;
    }
    if (suggestion) {
      pendingTypo = suggestion;
      elements.input.value = suggestion.name;
      setFeedback("", `Did you mean ${suggestion.name}?`, "Press Make guess again to confirm, or keep typing.");
      return;
    }
    setFeedback("colder", "Country not recognised.", "Choose a country from the suggestions before submitting.");
  }

  function moveSuggestion(direction) {
    const buttons = [...elements.suggestions.querySelectorAll("button")];
    if (!buttons.length) return;
    activeSuggestion = (activeSuggestion + direction + buttons.length) % buttons.length;
    buttons.forEach((button, index) => button.classList.toggle("is-active", index === activeSuggestion));
    buttons[activeSuggestion].scrollIntoView({ block: "nearest" });
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    globe.queueRender();
  }

  function initialiseTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    document.documentElement.dataset.theme = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }

  function backToSetup(clear = false) {
    if (clear) {
      state = null;
      persist();
    }
    elements.result.close();
    elements.gameView.classList.add("is-hidden");
    elements.setupView.classList.remove("is-hidden");
    document.body.style.overflow = "";
    const saved = savedState();
    elements.resume.classList.toggle("is-hidden", !saved || saved.status !== "active");
  }

  const globe = (() => {
    const context = elements.canvas.getContext("2d", { alpha: true, desynchronized: true });
    const projection = d3.geoOrthographic().clipAngle(90).precision(.45);
    const path = d3.geoPath(projection, context);
    const graticule = d3.geoGraticule10();
    const initialRotation = [-12, -13, 0];
    const pointers = new Map();
    let rotation = [...initialRotation];
    let currentZoom = 1;
    let renderQueued = false;
    let animation = 0;
    let gesture = null;
    let lastWidth = 0;
    let lastHeight = 0;
    let lastRatio = 0;
    let tap = null;

    function colours() {
      const css = getComputedStyle(document.documentElement);
      const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
      return {
        oceanHighlight: get("--globe-ocean-highlight", "#88abc0"),
        ocean: get("--globe-ocean", "#537a92"),
        oceanShadow: get("--globe-ocean-shadow", "#29495f"),
        land: get("--globe-land", "#d8d7ce"),
        border: get("--globe-border", "rgba(23,39,49,.34)"),
        grid: get("--globe-grid", "rgba(255,255,255,.16)"),
        rim: get("--globe-rim", "rgba(224,242,250,.82)"),
        ink: get("--ink", "#111820")
      };
    }

    function ratio() {
      return Math.min(window.devicePixelRatio || 1, matchMedia("(max-width:680px)").matches ? 1.25 : 1.6);
    }

    function resize(rect) {
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const pixelRatio = ratio();
      if (width !== lastWidth || height !== lastHeight || Math.abs(pixelRatio - lastRatio) > .01) {
        lastWidth = width;
        lastHeight = height;
        lastRatio = pixelRatio;
        elements.canvas.width = Math.round(width * pixelRatio);
        elements.canvas.height = Math.round(height * pixelRatio);
        elements.canvas.style.width = `${width}px`;
        elements.canvas.style.height = `${height}px`;
      }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      return { width, height };
    }

    function interacting() {
      return pointers.size > 0 || Boolean(animation);
    }

    function drawPath(feature, fill, stroke, width, shadow = false) {
      context.save();
      context.beginPath();
      path(feature);
      if (fill) {
        context.fillStyle = fill;
        context.fill("evenodd");
      }
      if (stroke) {
        context.strokeStyle = stroke;
        context.lineWidth = width;
        if (shadow && !interacting()) {
          context.shadowColor = "rgba(255,255,255,.72)";
          context.shadowBlur = 4;
        }
        context.stroke();
      }
      context.restore();
    }

    function visible(coordinate) {
      return d3.geoDistance([-rotation[0], -rotation[1]], coordinate) <= Math.PI / 2 + .015;
    }

    function drawPoint(feature, colour, latest, answer, theme) {
      const coordinate = feature.geometry.coordinates;
      if (!visible(coordinate)) return;
      const point = projection(coordinate);
      if (!point) return;
      context.save();
      context.beginPath();
      context.arc(point[0], point[1], latest || answer ? 5 : 4, 0, Math.PI * 2);
      context.fillStyle = colour;
      context.fill();
      context.strokeStyle = latest || answer ? "#fff" : theme.ink;
      context.lineWidth = latest || answer ? 2.2 : 1.15;
      context.stroke();
      context.restore();
    }

    function draw() {
      renderQueued = false;
      if (!state || elements.gameView.classList.contains("is-hidden") || document.hidden) return;
      const rect = elements.stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const { width, height } = resize(rect);
      const theme = colours();
      const radius = Math.min(width, height) * .43 * currentZoom;
      projection.translate([width / 2, height / 2]).scale(radius).rotate(rotation).precision(interacting() ? 1.15 : .45);

      context.save();
      context.beginPath();
      context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      context.fillStyle = theme.oceanShadow;
      if (!interacting()) {
        context.shadowColor = "rgba(8,19,29,.28)";
        context.shadowBlur = 22;
        context.shadowOffsetY = 13;
      }
      context.fill();
      context.restore();

      context.save();
      context.beginPath();
      context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      context.clip();
      const gradient = context.createRadialGradient(width / 2 - radius * .34, height / 2 - radius * .3, radius * .05, width / 2, height / 2, radius * 1.05);
      gradient.addColorStop(0, theme.oceanHighlight);
      gradient.addColorStop(.58, theme.ocean);
      gradient.addColorStop(1, theme.oceanShadow);
      context.fillStyle = gradient;
      context.fillRect(width / 2 - radius, height / 2 - radius, radius * 2, radius * 2);
      context.restore();

      context.save();
      context.beginPath();
      path(graticule);
      context.strokeStyle = theme.grid;
      context.lineWidth = interacting() ? .45 : .7;
      context.stroke();
      context.restore();

      drawPath(polygonCollection, theme.land, theme.border, interacting() ? .45 : .68);

      const player = state.players[state.currentPlayer];
      const latestCode = player.guesses.at(-1)?.code || null;
      for (const guess of player.guesses) {
        const feature = featureByCode.get(guess.code);
        if (!feature || feature.geometry.type === "Point") continue;
        const latest = guess.code === latestCode;
        drawPath(feature, heatColour(guess.distance), latest ? theme.ink : "rgba(255,255,255,.78)", latest ? 2.25 : 1.15, latest);
      }

      if (state.status === "finished") {
        const answer = featureByCode.get(state.targetCode);
        if (answer?.geometry.type !== "Point") drawPath(answer, "#16845b", "#fff", 2.6, true);
      }

      for (const feature of pointFeatures) {
        const code = feature.properties.code;
        const guess = player.guesses.find(item => item.code === code);
        const answer = state.status === "finished" && state.targetCode === code;
        if (!guess && !answer) continue;
        drawPoint(feature, answer ? "#16845b" : heatColour(guess.distance), code === latestCode, answer, theme);
      }

      context.save();
      context.beginPath();
      context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      context.strokeStyle = theme.rim;
      context.lineWidth = 1.4;
      context.stroke();
      context.restore();
    }

    function queueRender() {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(draw);
    }

    function stopAnimation() {
      if (animation) cancelAnimationFrame(animation);
      animation = 0;
    }

    function centroid(code) {
      const feature = featureByCode.get(code);
      if (!feature) return null;
      return feature.geometry.type === "Point" ? feature.geometry.coordinates : d3.geoCentroid(feature);
    }

    function shortest(from, to) {
      let delta = to - from;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      return from + delta;
    }

    function focusCountry(code, targetZoom = 1.45, duration = 420) {
      const coordinate = centroid(code);
      if (!coordinate) return;
      stopAnimation();
      const target = [shortest(rotation[0], -coordinate[0]), Math.max(-82, Math.min(82, -coordinate[1])), 0];
      const startRotation = [...rotation];
      const startZoom = currentZoom;
      const start = performance.now();
      const tick = now => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        rotation = startRotation.map((value, index) => value + (target[index] - value) * eased);
        currentZoom = startZoom + (targetZoom - startZoom) * eased;
        queueRender();
        if (progress < 1) animation = requestAnimationFrame(tick);
        else animation = 0;
      };
      animation = requestAnimationFrame(tick);
    }

    function pointerDistance(values) {
      return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
    }

    elements.stage.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      stopAnimation();
      elements.stage.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        gesture = { type: "rotate", startX: event.clientX, startY: event.clientY, rotation: [...rotation] };
        tap = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      } else {
        gesture = { type: "pinch", distance: pointerDistance([...pointers.values()]), zoom: currentZoom };
        tap = null;
      }
    });

    elements.stage.addEventListener("pointermove", event => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!gesture) return;
      if (pointers.size >= 2) {
        const distance = pointerDistance([...pointers.values()].slice(0, 2));
        if (gesture.type !== "pinch") gesture = { type: "pinch", distance, zoom: currentZoom };
        currentZoom = Math.max(.72, Math.min(4.8, gesture.zoom * distance / gesture.distance));
        tap = null;
        queueRender();
        return;
      }
      if (gesture.type === "rotate") {
        const dx = event.clientX - gesture.startX;
        const dy = event.clientY - gesture.startY;
        if (tap && Math.hypot(dx, dy) > 8) tap.moved = true;
        const rect = elements.stage.getBoundingClientRect();
        const sensitivity = 180 / Math.max(300, Math.min(rect.width, rect.height) * currentZoom);
        rotation = [gesture.rotation[0] + dx * sensitivity, Math.max(-82, Math.min(82, gesture.rotation[1] - dy * sensitivity)), 0];
        queueRender();
      }
    });

    function guessedAt(clientX, clientY) {
      const rect = elements.stage.getBoundingClientRect();
      const point = [clientX - rect.left, clientY - rect.top];
      const translate = projection.translate();
      if (Math.hypot(point[0] - translate[0], point[1] - translate[1]) > projection.scale()) return null;
      const guesses = [...state.players[state.currentPlayer].guesses].reverse();
      for (const guess of guesses) {
        const feature = featureByCode.get(guess.code);
        if (feature?.geometry.type !== "Point") continue;
        const projected = projection(feature.geometry.coordinates);
        if (projected && visible(feature.geometry.coordinates) && Math.hypot(projected[0] - point[0], projected[1] - point[1]) <= 16) return guess;
      }
      const coordinate = projection.invert(point);
      if (!coordinate) return null;
      return guesses.find(guess => {
        const feature = featureByCode.get(guess.code);
        return feature && feature.geometry.type !== "Point" && d3.geoContains(feature, coordinate);
      }) || null;
    }

    function finishPointer(event) {
      const candidate = tap && tap.id === event.pointerId && !tap.moved && pointers.size === 1 ? { ...tap } : null;
      pointers.delete(event.pointerId);
      if (pointers.size === 1) {
        const remaining = [...pointers.values()][0];
        gesture = { type: "rotate", startX: remaining.x, startY: remaining.y, rotation: [...rotation] };
      } else if (!pointers.size) {
        gesture = null;
        if (candidate) {
          const guess = guessedAt(candidate.x, candidate.y);
          elements.chip.classList.toggle("is-hidden", !guess);
          elements.chip.querySelector("strong").textContent = guess?.name || "";
        }
      }
      tap = null;
      queueRender();
    }

    elements.stage.addEventListener("pointerup", finishPointer);
    elements.stage.addEventListener("pointercancel", finishPointer);
    elements.stage.addEventListener("wheel", event => {
      event.preventDefault();
      stopAnimation();
      currentZoom = Math.max(.72, Math.min(4.8, currentZoom * Math.exp(-event.deltaY * .0012)));
      queueRender();
    }, { passive: false });
    elements.zoomIn.addEventListener("click", () => { currentZoom = Math.min(4.8, currentZoom * 1.25); queueRender(); });
    elements.zoomOut.addEventListener("click", () => { currentZoom = Math.max(.72, currentZoom / 1.25); queueRender(); });
    elements.reset.addEventListener("click", () => { rotation = [...initialRotation]; currentZoom = 1; elements.chip.classList.add("is-hidden"); queueRender(); });
    new ResizeObserver(queueRender).observe(elements.stage);

    return { queueRender, focusCountry, zoom: () => currentZoom };
  })();

  elements.start.addEventListener("click", () => startRace([
    cleanName(elements.playerOneName.value, "Player 1"),
    cleanName(elements.playerTwoName.value, "Player 2")
  ]));
  elements.resume.addEventListener("click", resumeRace);
  elements.beginTurn.addEventListener("click", hidePassScreen);
  elements.guess.addEventListener("click", attemptGuess);
  elements.input.addEventListener("input", () => {
    selectedCountry = null;
    pendingTypo = null;
    elements.clear.classList.toggle("is-hidden", !elements.input.value);
    renderSuggestions();
  });
  elements.input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") { event.preventDefault(); moveSuggestion(1); }
    if (event.key === "ArrowUp") { event.preventDefault(); moveSuggestion(-1); }
    if (event.key === "Enter") {
      event.preventDefault();
      const buttons = [...elements.suggestions.querySelectorAll("button")];
      if (activeSuggestion >= 0 && buttons[activeSuggestion]) buttons[activeSuggestion].click();
      else attemptGuess();
    }
    if (event.key === "Escape") hideSuggestions();
  });
  elements.suggestions.addEventListener("click", event => {
    const button = event.target.closest("button[data-code]");
    if (button) chooseCountry(countryByCode.get(button.dataset.code));
  });
  elements.clear.addEventListener("click", () => { resetInput(); elements.input.focus(); });
  document.addEventListener("click", event => {
    if (!event.target.closest(".search-area")) hideSuggestions();
  });
  elements.unit.addEventListener("click", () => {
    preferredUnits = preferredUnits === "km" ? "mi" : "km";
    elements.unit.textContent = preferredUnits.toUpperCase();
    if (state) {
      state.units = preferredUnits;
      persist();
      renderTurn();
    }
  });
  elements.theme.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  elements.quit.addEventListener("click", () => {
    if (confirm("End this race and return to setup?")) backToSetup(true);
  });
  elements.rematch.addEventListener("click", () => {
    const names = state.players.map(player => player.name);
    state = createState(names);
    persist();
    elements.result.close();
    showPassScreen(true);
  });
  elements.closeResult.addEventListener("click", () => backToSetup(true));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) globe.queueRender(); });

  initialiseTheme();
  preferredUnits = savedState()?.units || "km";
  elements.unit.textContent = preferredUnits.toUpperCase();
  const saved = savedState();
  elements.resume.classList.toggle("is-hidden", !saved || saved.status !== "active");
  elements.loading.classList.add("is-hidden");
  window.__NEARER_RACE_STARTED = true;
})();
