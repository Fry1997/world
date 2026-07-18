(() => {
  "use strict";

  const core = window.NEARER_TOGETHER_CORE;
  if (!core) throw new Error("Nearer Together core is unavailable.");

  const STORAGE_KEY = "nearer-cooperative-relay-v1";
  const THEME_KEY = "nearer-together-theme";
  const {
    gameData, countries, countryByCode, escapeHtml, displayDistance,
    heatColour, closest, createAutocomplete, createGlobe
  } = core;

  const elements = {
    setupView: document.getElementById("setupView"),
    gameView: document.getElementById("gameView"),
    playerCount: document.getElementById("playerCount"),
    playerNameFields: document.getElementById("playerNameFields"),
    start: document.getElementById("startGameButton"),
    resume: document.getElementById("resumeGameButton"),
    quit: document.getElementById("quitGameButton"),
    unit: document.getElementById("unitButton"),
    theme: document.getElementById("themeButton"),
    turnEyebrow: document.getElementById("turnEyebrow"),
    turnTitle: document.getElementById("turnTitle"),
    turnCopy: document.getElementById("turnCopy"),
    scoreboard: document.getElementById("scoreboard"),
    input: document.getElementById("countryInput"),
    clear: document.getElementById("clearInputButton"),
    suggestions: document.getElementById("suggestions"),
    guess: document.getElementById("makeGuessButton"),
    endTurn: document.getElementById("endTurnButton"),
    feedback: document.getElementById("feedbackPanel"),
    history: document.getElementById("guessHistory"),
    historyEmpty: document.getElementById("historyEmpty"),
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
    toast: document.getElementById("toast"),
    loading: document.getElementById("modeLoading"),
    stage: document.getElementById("globeStage"),
    canvas: document.getElementById("globeCanvas"),
    globeStatus: document.getElementById("globeStatus"),
    reset: document.getElementById("globeReset"),
    zoomIn: document.getElementById("globeZoomIn"),
    zoomOut: document.getElementById("globeZoomOut"),
    chip: document.getElementById("guessedCountryChip")
  };

  let state = null;
  let preferredUnits = "km";
  let passLocked = true;
  let toastTimer = 0;

  function cleanName(value, fallback) {
    return String(value || "").trim().slice(0, 20) || fallback;
  }

  function randomTarget() {
    return countries[Math.floor(Math.random() * countries.length)].code;
  }

  function createState(names, targetCode = randomTarget()) {
    return {
      version: 1,
      mode: "cooperative-relay",
      status: "active",
      units: preferredUnits,
      targetCode,
      currentPlayer: 0,
      round: 1,
      pendingTurn: null,
      players: names.map(name => ({ name })),
      guesses: [],
      result: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

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
    elements.resume.classList.toggle("is-hidden", !saved || saved.status !== "active");
  }

  function units() {
    return state?.units || preferredUnits;
  }

  function distanceText(value) {
    return displayDistance(value, units());
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

  function currentPlayer() {
    return state.players[state.currentPlayer];
  }

  function contributionCount(index) {
    return state.guesses.filter(guess => guess.playerIndex === index).length;
  }

  function bestContribution(index) {
    return closest(state.guesses.filter(guess => guess.playerIndex === index));
  }

  function renderScoreboard() {
    elements.scoreboard.innerHTML = state.players.map((player, index) => {
      const active = state.status === "active" && state.currentPlayer === index;
      const count = contributionCount(index);
      const best = bestContribution(index);
      const playerGuesses = state.guesses.filter(guess => guess.playerIndex === index);
      return `
        <article class="mode-player-card ${active ? "is-active" : ""}">
          <div class="mode-player-card-top"><strong>${escapeHtml(player.name)}</strong>${active ? '<span class="mode-turn-badge">TURN</span>' : ""}</div>
          <div class="mode-player-metrics"><span>Moves<b>${count}</b></span><span>Best clue<b>${distanceText(best?.distance ?? null)}</b></span></div>
          <div class="mode-player-detail">${count ? `Last contributed in round ${playerGuesses.at(-1).round}` : "Waiting to contribute"}</div>
        </article>`;
    }).join("");
  }

  function renderHistory() {
    elements.guessCount.textContent = String(state.guesses.length);
    elements.historyEmpty.classList.toggle("is-hidden", state.guesses.length > 0);
    elements.history.innerHTML = [...state.guesses].reverse().map(guess => `
      <li class="guess-row ${guess.order === state.guesses.length ? "is-latest" : ""}">
        <span class="guess-rank">${guess.order}</span>
        <span class="guess-swatch" style="background:${heatColour(guess.distance)}"></span>
        <span class="guess-country"><strong>${escapeHtml(guess.name)}</strong><small>${escapeHtml(state.players[guess.playerIndex].name)} · round ${guess.round}</small></span>
        <strong class="guess-distance">${distanceText(guess.distance)}</strong>
      </li>`).join("");
  }

  function renderReviewFeedback() {
    const latest = state.guesses.at(-1);
    const previous = state.guesses.at(-2);
    if (!latest) return;
    if (latest.distance === 0) {
      setFeedback("success", `${latest.name} found.`, "Take in the result, then press End turn to complete the team relay.");
    } else if (!previous) {
      setFeedback("", `${distanceText(latest.distance)} away.`, "The team's first signal is locked in. Study it, then end the turn when ready.");
    } else if (latest.distance < previous.distance) {
      setFeedback("warmer", `${distanceText(latest.distance)} away.`, `The team moved ${distanceText(previous.distance - latest.distance)} closer. End the turn when ready.`);
    } else if (latest.distance > previous.distance) {
      setFeedback("colder", `${distanceText(latest.distance)} away.`, `The team moved ${distanceText(latest.distance - previous.distance)} farther away. End the turn when ready.`);
    } else {
      setFeedback("", `${distanceText(latest.distance)} away.`, "That is the same distance as the previous team guess. End the turn when ready.");
    }
  }

  function renderTurn() {
    const player = currentPlayer();
    const reviewing = Boolean(state.pendingTurn);
    const teamBest = closest(state.guesses);
    elements.turnEyebrow.textContent = `ROUND ${state.round} · ${player.name.toUpperCase()}`;
    elements.turnTitle.textContent = reviewing ? `${player.name}, review the team's result.` : `${player.name}, choose the next move.`;
    elements.turnCopy.textContent = reviewing
      ? "Take your time with the globe and clue before handing the shared route to the next player."
      : teamBest ? `The team's closest signal is ${distanceText(teamBest.distance)}.` : "You are starting the shared clue trail.";
    elements.globeStatus.textContent = state.guesses.length ? `${state.guesses.length} shared signal${state.guesses.length === 1 ? "" : "s"} mapped` : "Shared globe ready";
    elements.unit.textContent = units().toUpperCase();
    elements.guess.classList.toggle("is-hidden", reviewing);
    elements.endTurn.classList.toggle("is-hidden", !reviewing);
    autocomplete.setDisabled(reviewing);
    renderScoreboard();
    renderHistory();
    if (reviewing) renderReviewFeedback();
    else {
      autocomplete.reset();
      setFeedback("", "Build on the team's last clue.", state.guesses.length ? "Discuss the map, then choose one country for this turn." : "Your first guess will set the direction for everyone.");
    }
    globe.queueRender();
  }

  function showPassScreen(firstTurn = false) {
    passLocked = true;
    const player = currentPlayer();
    const teamBest = closest(state.guesses);
    elements.passEyebrow.textContent = firstTurn ? "RELAY READY" : "PASS THE PHONE";
    elements.passTitle.textContent = firstTurn ? `${player.name}, start the relay` : `Pass to ${player.name}`;
    elements.passCopy.textContent = firstTurn ? "The shared globe will appear when you begin." : "The full clue trail stays visible for the next player.";
    elements.beginTurn.textContent = `Start ${player.name}'s turn`;
    elements.passStandings.innerHTML = `
      <div class="pass-standing cooperative-team-summary"><span>Team guesses</span><strong>${state.guesses.length}</strong></div>
      <div class="pass-standing cooperative-team-summary"><span>Closest signal</span><strong>${distanceText(teamBest?.distance ?? null)}</strong></div>`;
    elements.passScreen.classList.remove("is-hidden");
    document.body.style.overflow = "hidden";
  }

  function hidePassScreen() {
    passLocked = false;
    elements.passScreen.classList.add("is-hidden");
    document.body.style.overflow = "";
    renderTurn();
    if (!state.pendingTurn) setTimeout(() => autocomplete.focus(), 80);
  }

  function finishGame() {
    const latest = state.guesses.at(-1);
    const target = countryByCode.get(state.targetCode);
    state.status = "finished";
    state.pendingTurn = null;
    state.result = { playerIndex: latest.playerIndex, guesses: state.guesses.length, round: state.round };
    state.updatedAt = Date.now();
    persist();

    const finder = state.players[latest.playerIndex];
    elements.resultTitle.textContent = `${target.name} found.`;
    elements.resultSummary.textContent = `${finder.name} completed the relay after ${state.guesses.length} combined guess${state.guesses.length === 1 ? "" : "es"}.`;
    elements.resultStats.innerHTML = state.players.map((player, index) => {
      const count = contributionCount(index);
      const best = bestContribution(index);
      return `<div class="mode-result-stat"><span>${escapeHtml(player.name)}</span><strong>${count} move${count === 1 ? "" : "s"} · ${distanceText(best?.distance ?? null)}</strong></div>`;
    }).join("");
    renderScoreboard();
    globe.queueRender();
    elements.result.showModal();
  }

  function advanceAfterTurn() {
    if (!state?.pendingTurn) return;
    const correct = state.pendingTurn.wasCorrect;
    state.pendingTurn = null;
    if (correct) {
      finishGame();
      return;
    }
    if (state.currentPlayer === state.players.length - 1) {
      state.currentPlayer = 0;
      state.round += 1;
    } else {
      state.currentPlayer += 1;
    }
    state.updatedAt = Date.now();
    persist();
    showPassScreen();
  }

  function submitGuess(country) {
    if (passLocked || state.pendingTurn) return;
    if (state.guesses.some(guess => guess.code === country.code)) {
      setFeedback("colder", "Already in the team trail.", `${country.name} has already been tried by the team.`);
      return;
    }
    const distance = gameData.distance(country.code, state.targetCode);
    const guess = {
      code: country.code,
      name: country.name,
      distance,
      playerIndex: state.currentPlayer,
      order: state.guesses.length + 1,
      round: state.round,
      createdAt: Date.now()
    };
    state.guesses.push(guess);
    state.pendingTurn = { wasCorrect: distance === 0 };
    state.updatedAt = Date.now();
    persist();
    renderTurn();
    globe.focusCountry(country.code, Math.max(1.12, Math.min(globe.zoom(), 1.48)), 420);
  }

  function renderPlayerFields(count) {
    const existing = [...elements.playerNameFields.querySelectorAll("input")].map(input => input.value);
    elements.playerNameFields.innerHTML = Array.from({ length: count }, (_, index) => `
      <label><span>Player ${index + 1}</span><input maxlength="20" value="${escapeHtml(existing[index] || `Player ${index + 1}`)}" autocomplete="off"></label>`).join("");
  }

  function collectNames() {
    return [...elements.playerNameFields.querySelectorAll("input")].map((input, index) => cleanName(input.value, `Player ${index + 1}`));
  }

  function startGame(names) {
    state = createState(names);
    persist();
    elements.setupView.classList.add("is-hidden");
    elements.gameView.classList.remove("is-hidden");
    showPassScreen(true);
  }

  function resumeGame() {
    const saved = savedState();
    if (!saved || saved.status !== "active") return;
    state = saved;
    preferredUnits = state.units || preferredUnits;
    elements.setupView.classList.add("is-hidden");
    elements.gameView.classList.remove("is-hidden");
    showPassScreen(true);
  }

  function backToSetup(clear = false) {
    if (clear) {
      state = null;
      persist();
    }
    if (elements.result.open) elements.result.close();
    elements.gameView.classList.add("is-hidden");
    elements.setupView.classList.remove("is-hidden");
    document.body.style.overflow = "";
    const saved = savedState();
    elements.resume.classList.toggle("is-hidden", !saved || saved.status !== "active");
    renderPlayerFields(Number(elements.playerCount.value));
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    globe.queueRender();
  }

  function initialiseTheme() {
    const saved = localStorage.getItem(THEME_KEY) || localStorage.getItem("nearer-race-theme");
    document.documentElement.dataset.theme = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }

  const globe = createGlobe({
    stage: elements.stage,
    canvas: elements.canvas,
    resetButton: elements.reset,
    zoomInButton: elements.zoomIn,
    zoomOutButton: elements.zoomOut,
    chip: elements.chip,
    getView: () => ({
      guesses: state?.guesses || [],
      finished: state?.status === "finished",
      answerCode: state?.targetCode || null
    })
  });

  const autocomplete = createAutocomplete({
    input: elements.input,
    clearButton: elements.clear,
    suggestions: elements.suggestions,
    submitButton: elements.guess,
    onSubmit: submitGuess,
    onFeedback: (title, copy, kind = "") => setFeedback(kind, title, copy),
    isDisabled: () => passLocked || Boolean(state?.pendingTurn)
  });

  elements.playerCount.addEventListener("change", () => renderPlayerFields(Number(elements.playerCount.value)));
  elements.start.addEventListener("click", () => startGame(collectNames()));
  elements.resume.addEventListener("click", resumeGame);
  elements.beginTurn.addEventListener("click", hidePassScreen);
  elements.endTurn.addEventListener("click", advanceAfterTurn);
  elements.unit.addEventListener("click", () => {
    preferredUnits = units() === "km" ? "mi" : "km";
    if (state) {
      state.units = preferredUnits;
      persist();
      renderTurn();
    } else elements.unit.textContent = preferredUnits.toUpperCase();
  });
  elements.theme.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  elements.quit.addEventListener("click", () => {
    if (confirm("End this relay and clear its saved progress?")) backToSetup(true);
  });
  elements.rematch.addEventListener("click", () => {
    const names = state.players.map(player => player.name);
    elements.result.close();
    startGame(names);
  });
  elements.closeResult.addEventListener("click", () => backToSetup(true));

  initialiseTheme();
  renderPlayerFields(2);
  const saved = savedState();
  elements.resume.classList.toggle("is-hidden", !saved || saved.status !== "active");
  elements.unit.textContent = preferredUnits.toUpperCase();
  elements.loading.classList.add("is-hidden");
  window.__NEARER_COOPERATIVE_STARTED = true;
})();
