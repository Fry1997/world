(() => {
  "use strict";

  const core = window.NEARER_TOGETHER_CORE;
  if (!core) throw new Error("Nearer Together core is unavailable.");

  const STORAGE_KEY = "nearer-hidden-country-duel-v1";
  const THEME_KEY = "nearer-together-theme";
  const {
    gameData, countries, countryByCode, escapeHtml, displayDistance,
    heatColour, closest, trend, createAutocomplete, createGlobe
  } = core;

  const elements = {
    setupView: document.getElementById("setupView"),
    gameView: document.getElementById("gameView"),
    playerOneName: document.getElementById("playerOneName"),
    playerTwoName: document.getElementById("playerTwoName"),
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
    historyHeading: document.getElementById("historyHeading"),
    guessCount: document.getElementById("guessCount"),
    pressureTitle: document.getElementById("pressureTitle"),
    pressureCopy: document.getElementById("pressureCopy"),
    pressureLatest: document.getElementById("pressureLatest"),
    pressureClosest: document.getElementById("pressureClosest"),
    secretScreen: document.getElementById("secretScreen"),
    secretEyebrow: document.getElementById("secretEyebrow"),
    secretTitle: document.getElementById("secretTitle"),
    secretCopy: document.getElementById("secretCopy"),
    secretCountry: document.getElementById("secretCountry"),
    secretAction: document.getElementById("secretActionButton"),
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
    targetReveal: document.getElementById("targetReveal"),
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
  let secretVisible = false;
  let toastTimer = 0;

  function cleanName(value, fallback) {
    return String(value || "").trim().slice(0, 20) || fallback;
  }

  function randomTargets() {
    const first = countries[Math.floor(Math.random() * countries.length)].code;
    let second = first;
    while (second === first) second = countries[Math.floor(Math.random() * countries.length)].code;
    return [first, second];
  }

  function createState(names, targets = randomTargets()) {
    return {
      version: 1,
      mode: "hidden-country-duel",
      status: "active",
      units: preferredUnits,
      targets,
      revealStep: 0,
      revealsComplete: false,
      currentPlayer: 0,
      round: 1,
      pendingWinner: null,
      pendingTurn: null,
      winner: null,
      result: null,
      players: names.map(name => ({ name, guesses: [], solvedAt: null })),
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

  function opponentIndex(index = state.currentPlayer) {
    return 1 - index;
  }

  function opponentPlayer() {
    return state.players[opponentIndex()];
  }

  function huntedTargetCode(index = state.currentPlayer) {
    return state.targets[opponentIndex(index)];
  }

  function defendedTargetCode(index = state.currentPlayer) {
    return state.targets[index];
  }

  function playerMetric(player, index) {
    const best = closest(player.guesses);
    const active = state.status === "active" && state.currentPlayer === index;
    const solved = player.solvedAt !== null;
    const badge = active ? '<span class="mode-turn-badge">TURN</span>' : solved ? '<span class="mode-found-badge">FOUND</span>' : "";
    const movement = trend(player.guesses);
    let detail = "No hunt started";
    if (solved) detail = "Opponent's country found";
    else if (movement?.delta > 0) detail = `Last move closed by ${distanceText(movement.delta)}`;
    else if (movement?.delta < 0) detail = `Last move went ${distanceText(Math.abs(movement.delta))} farther`;
    else if (player.guesses.length) detail = "Signal recorded";
    return `
      <article class="mode-player-card ${active ? "is-active" : ""} ${solved ? "is-solved" : ""}">
        <div class="mode-player-card-top"><strong>${escapeHtml(player.name)}</strong>${badge}</div>
        <div class="mode-player-metrics"><span>Guesses<b>${player.guesses.length}</b></span><span>Closest<b>${distanceText(best?.distance ?? null)}</b></span></div>
        <div class="mode-player-detail">${detail}</div>
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
        <strong class="guess-distance">${distanceText(guess.distance)}</strong>
      </li>`).join("");
  }

  function renderPressure() {
    const opponent = opponentPlayer();
    const guesses = opponent.guesses;
    const latest = guesses.at(-1);
    const best = closest(guesses);
    const movement = trend(guesses);
    elements.pressureLatest.textContent = distanceText(latest?.distance ?? null);
    elements.pressureClosest.textContent = distanceText(best?.distance ?? null);
    if (!latest) {
      elements.pressureTitle.textContent = "No threat yet.";
      elements.pressureCopy.textContent = `${opponent.name} has not made a guess towards your country.`;
      return;
    }
    if (latest.distance === 0) {
      elements.pressureTitle.textContent = "Your country has been found.";
      elements.pressureCopy.textContent = `${opponent.name} reached your hidden country this round.`;
      return;
    }
    elements.pressureTitle.textContent = `${opponent.name} is ${distanceText(latest.distance)} from you.`;
    if (!movement) elements.pressureCopy.textContent = "That is their first signal towards your country.";
    else if (movement.delta > 0) elements.pressureCopy.textContent = `Their last move closed by ${distanceText(movement.delta)}. They are getting nearer.`;
    else if (movement.delta < 0) elements.pressureCopy.textContent = `Their last move went ${distanceText(Math.abs(movement.delta))} farther away.`;
    else elements.pressureCopy.textContent = "Their last move stayed the same distance away.";
  }

  function renderReviewFeedback() {
    const player = currentPlayer();
    const latest = player.guesses.at(-1);
    const previous = player.guesses.at(-2);
    if (!latest) return;
    if (latest.distance === 0) {
      setFeedback("success", `${latest.name} found.`, state.currentPlayer === 0 ? "Player 2 still receives the equalising turn. Press End turn when ready." : "Press End turn to complete the duel.");
    } else if (!previous) {
      setFeedback("", `${distanceText(latest.distance)} away.`, "Your first signal is locked in. Study it, then end your turn when ready.");
    } else if (latest.distance < previous.distance) {
      setFeedback("warmer", `${distanceText(latest.distance)} away.`, `You moved ${distanceText(previous.distance - latest.distance)} closer. End your turn when ready.`);
    } else if (latest.distance > previous.distance) {
      setFeedback("colder", `${distanceText(latest.distance)} away.`, `You moved ${distanceText(latest.distance - previous.distance)} farther away. End your turn when ready.`);
    } else {
      setFeedback("", `${distanceText(latest.distance)} away.`, "That is the same distance as your previous guess. End your turn when ready.");
    }
  }

  function renderTurn() {
    const player = currentPlayer();
    const opponent = opponentPlayer();
    const reviewing = Boolean(state.pendingTurn);
    elements.turnEyebrow.textContent = `ROUND ${state.round} · ${player.name.toUpperCase()}`;
    elements.turnTitle.textContent = reviewing ? `${player.name}, review your attack.` : `${player.name}, hunt ${opponent.name}'s country.`;
    elements.turnCopy.textContent = reviewing ? "Take your time with the result. End the turn only when you are ready to hide your route." : `Your own country is ${countryByCode.get(defendedTargetCode()).name}. ${opponent.name} cannot see it.`;
    elements.globeStatus.textContent = player.guesses.length ? `${player.guesses.length} private signal${player.guesses.length === 1 ? "" : "s"} mapped` : "Your private hunt is ready";
    elements.unit.textContent = units().toUpperCase();
    elements.guess.classList.toggle("is-hidden", reviewing);
    elements.endTurn.classList.toggle("is-hidden", !reviewing);
    autocomplete.setDisabled(reviewing);
    renderScoreboard();
    renderPressure();
    renderHistory();
    if (reviewing) renderReviewFeedback();
    else {
      autocomplete.reset();
      setFeedback("", "Your turn is private.", `${opponent.name} can see how close you get, but never the countries you try.`);
    }
    globe.queueRender();
  }

  function showSecretScreen() {
    passLocked = true;
    secretVisible = false;
    const index = Math.min(state.revealStep, 1);
    const player = state.players[index];
    elements.secretEyebrow.textContent = `PRIVATE COUNTRY · PLAYER ${index + 1}`;
    elements.secretTitle.textContent = `${player.name}, look at the screen`;
    elements.secretCopy.textContent = `Make sure ${state.players[1 - index].name} cannot see.`;
    elements.secretCountry.textContent = "";
    elements.secretCountry.classList.add("is-hidden");
    elements.secretAction.textContent = "Reveal my country";
    elements.secretScreen.classList.remove("is-hidden");
    document.body.style.overflow = "hidden";
  }

  function handleSecretAction() {
    const index = Math.min(state.revealStep, 1);
    if (!secretVisible) {
      secretVisible = true;
      elements.secretCountry.textContent = countryByCode.get(state.targets[index]).name;
      elements.secretCountry.classList.remove("is-hidden");
      elements.secretCopy.textContent = "Remember this country. Your opponent will try to find it.";
      elements.secretAction.textContent = index === 0 ? `Hide and pass to ${state.players[1].name}` : "Hide and begin duel";
      return;
    }

    secretVisible = false;
    elements.secretCountry.classList.add("is-hidden");
    state.revealStep += 1;
    state.updatedAt = Date.now();
    if (state.revealStep < 2) {
      persist();
      showSecretScreen();
      return;
    }
    state.revealsComplete = true;
    state.currentPlayer = 0;
    persist();
    elements.secretScreen.classList.add("is-hidden");
    elements.gameView.classList.remove("is-hidden");
    showPassScreen(true);
  }

  function showPassScreen(firstTurn = false) {
    passLocked = true;
    const player = currentPlayer();
    const previous = opponentPlayer();
    elements.passEyebrow.textContent = firstTurn ? "DUEL READY" : "PASS THE PHONE";
    elements.passTitle.textContent = firstTurn ? `${player.name}, prepare to hunt` : `Pass to ${player.name}`;
    elements.passCopy.textContent = firstTurn ? "Your private globe will appear when you begin." : `${previous.name}'s route and exact guesses have been hidden.`;
    elements.beginTurn.textContent = `Start ${player.name}'s turn`;
    elements.passStandings.innerHTML = state.players.map(playerItem => {
      const best = closest(playerItem.guesses);
      return `<div class="pass-standing"><span>${escapeHtml(playerItem.name)}</span><strong>${playerItem.guesses.length} guesses · ${playerItem.solvedAt !== null ? "Found" : distanceText(best?.distance ?? null)}</strong></div>`;
    }).join("");
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

  function finishGame(result) {
    state.status = "finished";
    state.result = result;
    state.winner = result.type === "win" ? result.winner : null;
    state.pendingTurn = null;
    state.updatedAt = Date.now();
    persist();

    const firstTarget = countryByCode.get(state.targets[0]);
    const secondTarget = countryByCode.get(state.targets[1]);
    if (result.type === "draw") {
      elements.resultTitle.textContent = "It is a draw.";
      elements.resultSummary.textContent = `${state.players[0].name} found ${secondTarget.name} and ${state.players[1].name} found ${firstTarget.name} in round ${state.round}.`;
    } else {
      const winner = state.players[result.winner];
      const foundTarget = countryByCode.get(huntedTargetCode(result.winner));
      elements.resultTitle.textContent = `${winner.name} wins.`;
      elements.resultSummary.textContent = `${winner.name} found ${foundTarget.name} in ${winner.guesses.length} guesses.`;
    }
    elements.resultStats.innerHTML = state.players.map(player => `<div class="mode-result-stat"><span>${escapeHtml(player.name)}</span><strong>${player.guesses.length} guesses · ${distanceText(closest(player.guesses)?.distance ?? null)}</strong></div>`).join("");
    elements.targetReveal.innerHTML = `
      <div class="duel-target-item"><span>${escapeHtml(state.players[0].name)} defended</span><strong>${escapeHtml(firstTarget.name)}</strong></div>
      <div class="duel-target-item"><span>${escapeHtml(state.players[1].name)} defended</span><strong>${escapeHtml(secondTarget.name)}</strong></div>`;
    renderScoreboard();
    globe.queueRender();
    elements.result.showModal();
  }

  function advanceAfterTurn() {
    if (!state?.pendingTurn) return;
    const playerIndex = state.currentPlayer;
    const correct = state.pendingTurn.wasCorrect;
    state.pendingTurn = null;

    if (playerIndex === 0) {
      if (correct) state.pendingWinner = 0;
      state.currentPlayer = 1;
      state.updatedAt = Date.now();
      persist();
      showPassScreen();
      return;
    }

    if (correct && state.pendingWinner === 0) {
      finishGame({ type: "draw" });
      return;
    }
    if (correct) {
      finishGame({ type: "win", winner: 1 });
      return;
    }
    if (state.pendingWinner === 0) {
      finishGame({ type: "win", winner: 0 });
      return;
    }

    state.round += 1;
    state.currentPlayer = 0;
    state.updatedAt = Date.now();
    persist();
    showPassScreen();
  }

  function submitGuess(country) {
    if (passLocked || state.pendingTurn) return;
    const player = currentPlayer();
    if (player.guesses.some(guess => guess.code === country.code)) {
      setFeedback("colder", "Already tried.", `${country.name} is already on your private route.`);
      return;
    }
    const distance = gameData.distance(country.code, huntedTargetCode());
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
    state.pendingTurn = { wasCorrect: distance === 0 };
    state.updatedAt = Date.now();
    persist();
    renderTurn();
    globe.focusCountry(country.code, Math.max(1.12, Math.min(globe.zoom(), 1.48)), 420);
  }

  function startGame(names) {
    state = createState(names);
    persist();
    elements.setupView.classList.add("is-hidden");
    elements.gameView.classList.add("is-hidden");
    showSecretScreen();
  }

  function resumeGame() {
    const saved = savedState();
    if (!saved || saved.status !== "active") return;
    state = saved;
    preferredUnits = state.units || preferredUnits;
    elements.setupView.classList.add("is-hidden");
    if (!state.revealsComplete) {
      elements.gameView.classList.add("is-hidden");
      showSecretScreen();
    } else {
      elements.gameView.classList.remove("is-hidden");
      showPassScreen(true);
    }
  }

  function backToSetup(clear = false) {
    if (clear) {
      state = null;
      persist();
    }
    if (elements.result.open) elements.result.close();
    elements.secretScreen.classList.add("is-hidden");
    elements.passScreen.classList.add("is-hidden");
    elements.gameView.classList.add("is-hidden");
    elements.setupView.classList.remove("is-hidden");
    document.body.style.overflow = "";
    const saved = savedState();
    elements.resume.classList.toggle("is-hidden", !saved || saved.status !== "active");
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
    getView: () => {
      const player = state?.players?.[state.currentPlayer];
      return {
        guesses: player?.guesses || [],
        finished: Boolean(player?.solvedAt !== null && player?.solvedAt !== undefined),
        answerCode: state ? huntedTargetCode() : null
      };
    }
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

  elements.start.addEventListener("click", () => startGame([
    cleanName(elements.playerOneName.value, "Player 1"),
    cleanName(elements.playerTwoName.value, "Player 2")
  ]));
  elements.resume.addEventListener("click", resumeGame);
  elements.secretAction.addEventListener("click", handleSecretAction);
  elements.beginTurn.addEventListener("click", hidePassScreen);
  elements.endTurn.addEventListener("click", advanceAfterTurn);
  elements.unit.addEventListener("click", () => {
    preferredUnits = units() === "km" ? "mi" : "km";
    if (state) {
      state.units = preferredUnits;
      persist();
      if (state.revealsComplete) renderTurn();
    } else elements.unit.textContent = preferredUnits.toUpperCase();
  });
  elements.theme.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  elements.quit.addEventListener("click", () => {
    if (confirm("End this duel and clear its saved progress?")) backToSetup(true);
  });
  elements.rematch.addEventListener("click", () => {
    const names = state.players.map(player => player.name);
    elements.result.close();
    startGame(names);
  });
  elements.closeResult.addEventListener("click", () => backToSetup(true));

  initialiseTheme();
  const saved = savedState();
  elements.resume.classList.toggle("is-hidden", !saved || saved.status !== "active");
  elements.unit.textContent = preferredUnits.toUpperCase();
  elements.loading.classList.add("is-hidden");
  window.__NEARER_DUEL_STARTED = true;
})();
