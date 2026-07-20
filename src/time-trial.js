import "./time-trial.css";
import "./time-trial-table.css";
import { bindFriendChallengeShare, challengeFromLocation, renderFriendChallengeInvitation } from "./time-trial-challenge.js";
import { countrySearch, dailySequence, localDateKey, rankedAvailable, readTimeTrialState, saveResult } from "./time-trial-data.js";
import { createTimeTrialGlobe } from "./time-trial-globe.js";
import { clearCompetitionResult, markCompetitionVerified, queueCompetitionResult, queuedCompetitionResults } from "./time-trial-recovery.js";
import { loadCompetitionTable, loadFriendChallenge, startCompetition, submitCompetition } from "./time-trial-service.js";
import { showCompetitionTable, showVerificationStatus } from "./time-trial-table.js";
import { launchMarkup, lobbyMarkup, renderGuessState, resultMarkup, runningMarkup, updateRunning } from "./time-trial-view.js";

const DURATION_MS = 180000;
let launch;
let dialog;
let globe;
let timer;
let search;
let countries;
let run = null;
let friendChallengeState = null;

function currentDay() {
  return readTimeTrialState().days?.[localDateKey()] || null;
}

function updateLaunch() {
  if (launch) launch.innerHTML = launchMarkup(currentDay());
  launch?.querySelector("[data-time-trial-open]")?.addEventListener("click", openLobby);
}

function addLaunch() {
  if (document.querySelector(".nearer-time-trial-launch")) return;
  const heading = document.querySelector(".game-heading");
  if (!heading) return;
  launch = document.createElement("section");
  launch.className = "nearer-time-trial-launch";
  launch.setAttribute("aria-label", "Daily Time Trial");
  heading.insertAdjacentElement("afterend", launch);
  updateLaunch();
}

function createDialog() {
  dialog = document.createElement("dialog");
  dialog.id = "nearerTimeTrialDialog";
  dialog.className = "nearer-time-trial-dialog";
  dialog.addEventListener("cancel", event => {
    if (run?.status === "running") event.preventDefault();
  });
  dialog.addEventListener("click", event => {
    if (event.target === dialog && run?.status !== "running") dialog.close();
  });
  document.body.append(dialog);
}

function bindClose() {
  dialog.querySelectorAll("[data-time-trial-close]").forEach(button => button.addEventListener("click", () => dialog.close()));
}

function bindStarts() {
  dialog.querySelectorAll("[data-time-trial-start]").forEach(button => button.addEventListener("click", () => startRun(button.dataset.timeTrialStart === "ranked", button)));
}

function configureAccountAccess() {
  const button = dialog.querySelector('[data-time-trial-start="ranked"]');
  if (!button || window.NEARER_CLOUD?.session) return;
  button.removeAttribute("data-time-trial-start");
  button.textContent = "Sign in for ranked attempt";
  button.addEventListener("click", () => {
    dialog.close();
    window.NEARER_CLOUD?.open?.();
  });
}

function renderInvitation() {
  if (!friendChallengeState) return;
  renderFriendChallengeInvitation(dialog, friendChallengeState, {
    start: event => startRun(true, event.currentTarget),
    signIn: () => {
      dialog.close();
      window.NEARER_CLOUD?.open?.();
    }
  });
}

async function reloadInvitation() {
  if (!friendChallengeState?.id) return;
  try {
    const challenge = await loadFriendChallenge(friendChallengeState.id);
    friendChallengeState = challenge
      ? { id: friendChallengeState.id, challenge }
      : { id: friendChallengeState.id, error: "This challenge is no longer available." };
  } catch (error) {
    friendChallengeState = { id: friendChallengeState.id, error: error.message || "This challenge could not be loaded." };
  }
  renderInvitation();
}

async function refreshTable(message = "") {
  if (!window.NEARER_CLOUD?.session) {
    showCompetitionTable(dialog, [], "Sign in to view today's verified results.");
    return;
  }
  try {
    showCompetitionTable(dialog, await loadCompetitionTable(localDateKey()));
  } catch (error) {
    showCompetitionTable(dialog, [], message || error.message || "Today's results are temporarily unavailable.");
  }
}

function openLobby() {
  run = null;
  const state = readTimeTrialState();
  dialog.innerHTML = lobbyMarkup({ rankedAvailable: rankedAvailable(), today: currentDay(), stats: state.stats || {} });
  bindClose();
  configureAccountAccess();
  bindStarts();
  dialog.showModal();
  renderInvitation();
  refreshTable();
}

function showSuggestions(input) {
  if (!run || run.status !== "running") return;
  const panel = dialog.querySelector("[data-time-trial-suggestions]");
  const suggestions = search.suggest(input.value, new Set(run.currentGuesses.map(guess => guess.code)));
  panel.innerHTML = suggestions.map(country => `<button type="button" data-country-code="${country.code}"><strong>${country.name}</strong><span>${country.code}</span></button>`).join("");
  panel.hidden = !suggestions.length;
  panel.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    input.value = countries.find(country => country.code === button.dataset.countryCode)?.name || "";
    panel.hidden = true;
    input.focus();
  }));
}

function feedbackFor(distance, previous) {
  if (previous === null) return `${distance.toLocaleString()} km from the hidden country.`;
  const change = Math.abs(distance - previous);
  if (distance < previous) return `Closer by ${change.toLocaleString()} km · ${distance.toLocaleString()} km away.`;
  if (distance > previous) return `Farther by ${change.toLocaleString()} km · ${distance.toLocaleString()} km away.`;
  return `The signal is unchanged at ${distance.toLocaleString()} km.`;
}

function submitGuess(event) {
  event.preventDefault();
  if (!run || run.status !== "running") return;
  const input = dialog.querySelector("#timeTrialInput");
  const panel = dialog.querySelector("[data-time-trial-suggestions]");
  const country = search.exact(input.value);
  if (!country) {
    renderGuessState(dialog, run.currentGuesses, "Choose a country from the suggestions.");
    return;
  }
  if (run.currentGuesses.some(guess => guess.code === country.code)) {
    renderGuessState(dialog, run.currentGuesses, `${country.name} is already in this signal.`);
    return;
  }

  const target = run.sequence[run.index];
  if (!target) {
    finishRun();
    return;
  }
  const previous = run.currentGuesses.at(-1)?.distance ?? null;
  const distance = window.NEARER_GAME_DATA.distance(country.code, target.code);
  const guess = { code: country.code, name: country.name, distance, order: run.currentGuesses.length + 1 };
  run.currentGuesses.push(guess);
  run.totalGuesses += 1;
  run.closestDistance = Math.min(run.closestDistance, distance);
  input.value = "";
  panel.hidden = true;
  globe.setGuesses(run.currentGuesses);
  globe.focusCode(country.code);

  if (country.code === target.code) {
    const solvedIn = Math.max(0, performance.now() - run.countryStartedAt);
    run.solved.push({ code: target.code, name: target.name, guesses: run.currentGuesses.length, durationMs: Math.round(solvedIn) });
    run.found += 1;
    run.index += 1;
    run.currentGuesses = [];
    run.countryStartedAt = performance.now();
    run.closestDistance = Infinity;
    if (run.index >= run.sequence.length) {
      finishRun();
      return;
    }
    renderGuessState(dialog, [], `${target.name} found · country ${run.found + 1} is now hiding.`);
    globe.setGuesses([]);
    input.focus();
  } else {
    renderGuessState(dialog, run.currentGuesses, feedbackFor(distance, previous));
  }
  updateRunning(dialog, run);
}

function tick() {
  if (!run || run.status !== "running") return;
  run.remaining = Math.max(0, run.endsAt - performance.now());
  updateRunning(dialog, run);
  if (run.remaining <= 0) finishRun();
}

function bindRunning() {
  const input = dialog.querySelector("#timeTrialInput");
  dialog.querySelector("[data-time-trial-form]")?.addEventListener("submit", submitGuess);
  input?.addEventListener("input", () => showSuggestions(input));
  input?.addEventListener("keydown", event => {
    if (event.key === "Escape") dialog.querySelector("[data-time-trial-suggestions]").hidden = true;
  });
  dialog.querySelector("[data-time-trial-end]")?.addEventListener("click", finishRun);
  input?.focus();
}

async function startRun(ranked, sourceButton = null) {
  clearInterval(timer);
  globe?.destroy();
  const dateKey = localDateKey();
  if (ranked && !rankedAvailable(dateKey)) ranked = false;
  let competition = null;
  let remaining = DURATION_MS;

  if (ranked) {
    sourceButton && (sourceButton.disabled = true);
    sourceButton && (sourceButton.textContent = "Preparing ranked run…");
    try {
      competition = await startCompetition(dateKey);
      remaining = Math.max(0, Math.min(DURATION_MS, Date.parse(competition.endsAt) - Date.now()));
      if (remaining <= 0) throw new Error("Today's ranked attempt has expired.");
    } catch (error) {
      sourceButton && (sourceButton.disabled = false);
      sourceButton && (sourceButton.textContent = "Begin ranked attempt");
      const message = dialog.querySelector(".nearer-time-trial-used") || document.createElement("p");
      message.className = "nearer-time-trial-used";
      message.textContent = error.message || "The ranked run could not start.";
      dialog.querySelector(".nearer-time-trial-lobby aside")?.append(message);
      return;
    }
  }

  run = {
    status: "running",
    ranked,
    serverRunId: competition?.runId || null,
    dateKey,
    sequence: dailySequence(countries, dateKey),
    index: 0,
    found: 0,
    totalGuesses: 0,
    currentGuesses: [],
    solved: [],
    closestDistance: Infinity,
    remaining,
    startedAt: performance.now() - (DURATION_MS - remaining),
    countryStartedAt: performance.now(),
    endsAt: performance.now() + remaining
  };
  dialog.innerHTML = runningMarkup({ ranked, remaining, found: 0, guesses: 0 });
  globe = createTimeTrialGlobe(dialog.querySelector("[data-time-trial-globe]"), window.NEARER_GAME_DATA, window.NEARER_COUNTRIES_GEOJSON, window.NEARER_D3);
  bindRunning();
  timer = setInterval(tick, 100);
  tick();
}

async function finishRun() {
  if (!run || run.status !== "running") return;
  clearInterval(timer);
  run.remaining = Math.max(0, run.endsAt - performance.now());
  run.status = "finishing";
  globe?.destroy();
  const result = {
    clientRunId: crypto.randomUUID?.() || `time-trial-${Date.now()}`,
    dateKey: run.dateKey,
    ranked: run.ranked,
    found: run.found,
    guesses: run.totalGuesses,
    durationMs: Math.round(DURATION_MS - run.remaining),
    timeRemainingMs: Math.round(run.remaining),
    fastestSolveMs: run.solved.length ? Math.min(...run.solved.map(country => country.durationMs)) : null,
    closestDistance: Number.isFinite(run.closestDistance) ? run.closestDistance : Infinity,
    solved: run.solved,
    completedAt: new Date().toISOString()
  };
  let serverResult = null;
  let submissionError = null;
  const state = saveResult(result);

  if (run.ranked && run.serverRunId) {
    queueCompetitionResult(run.serverRunId, result);
    try {
      serverResult = await submitCompetition(run.serverRunId, result);
      clearCompetitionResult(run.serverRunId);
      markCompetitionVerified(result.dateKey, serverResult);
      result.verified = true;
      result.durationMs = serverResult.durationMs;
      result.timeRemainingMs = serverResult.timeRemainingMs;
    } catch (error) {
      submissionError = error;
    }
  }

  run.status = "finished";
  dialog.innerHTML = resultMarkup(result, state);
  bindClose();
  configureAccountAccess();
  bindStarts();
  bindFriendChallengeShare(dialog);
  updateLaunch();
  if (run.ranked) showVerificationStatus(dialog, Boolean(serverResult), submissionError?.message || "");
  if (serverResult?.leaderboard) showCompetitionTable(dialog, serverResult.leaderboard);
  else refreshTable(submissionError?.message || "");
  if (friendChallengeState) reloadInvitation();
  window.dispatchEvent(new CustomEvent("nearer:time-trial-result", { detail: result }));
}

async function retryQueuedResults() {
  if (!window.NEARER_CLOUD?.session) return;
  for (const item of queuedCompetitionResults()) {
    try {
      const serverResult = await submitCompetition(item.runId, item.result);
      clearCompetitionResult(item.runId);
      markCompetitionVerified(item.result.dateKey, serverResult);
    } catch (error) {
      if (/already submitted/i.test(error.message || "")) clearCompetitionResult(item.runId);
    }
  }
}

async function waitForRuntime() {
  const started = performance.now();
  while (!window.NEARER_GAME_DATA || !window.NEARER_COUNTRIES_GEOJSON || !window.NEARER_D3) {
    if (performance.now() - started > 15000) throw new Error("Daily Time Trial could not access the Nearer game data.");
    await new Promise(resolve => setTimeout(resolve, 60));
  }
}

async function initialise() {
  if (!document.querySelector(".game-heading")) return;
  await waitForRuntime();
  countries = window.NEARER_GAME_DATA.countries;
  search = countrySearch(countries);
  createDialog();
  addLaunch();
  retryQueuedResults();
  friendChallengeState = await challengeFromLocation();
  if (friendChallengeState) openLobby();
  window.NEARER_TIME_TRIAL = { open: openLobby, startPractice: () => { openLobby(); startRun(false); } };
}

initialise().catch(error => console.error("Nearer time trial:", error));
