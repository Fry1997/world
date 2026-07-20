import "./time-trial.css";
import { countrySearch, dailySequence, localDateKey, rankedAvailable, readTimeTrialState, saveResult } from "./time-trial-data.js";
import { createTimeTrialGlobe } from "./time-trial-globe.js";
import { launchMarkup, lobbyMarkup, renderGuessState, resultMarkup, runningMarkup, updateRunning } from "./time-trial-view.js";

const DURATION_MS = 180000;
let launch;
let dialog;
let globe;
let timer;
let search;
let countries;
let run = null;

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
  dialog.querySelectorAll("[data-time-trial-start]").forEach(button => button.addEventListener("click", () => startRun(button.dataset.timeTrialStart === "ranked")));
}

function openLobby() {
  run = null;
  const state = readTimeTrialState();
  dialog.innerHTML = lobbyMarkup({ rankedAvailable: rankedAvailable(), today: currentDay(), stats: state.stats || {} });
  bindClose();
  bindStarts();
  dialog.showModal();
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

function startRun(ranked) {
  clearInterval(timer);
  globe?.destroy();
  const dateKey = localDateKey();
  if (ranked && !rankedAvailable(dateKey)) ranked = false;
  run = {
    status: "running",
    ranked,
    dateKey,
    sequence: dailySequence(countries, dateKey),
    index: 0,
    found: 0,
    totalGuesses: 0,
    currentGuesses: [],
    solved: [],
    closestDistance: Infinity,
    remaining: DURATION_MS,
    startedAt: performance.now(),
    countryStartedAt: performance.now(),
    endsAt: performance.now() + DURATION_MS
  };
  dialog.innerHTML = runningMarkup({ ranked, remaining: DURATION_MS, found: 0, guesses: 0 });
  globe = createTimeTrialGlobe(dialog.querySelector("[data-time-trial-globe]"), window.NEARER_GAME_DATA, window.NEARER_COUNTRIES_GEOJSON, window.NEARER_D3);
  bindRunning();
  timer = setInterval(tick, 100);
  tick();
}

function finishRun() {
  if (!run || run.status !== "running") return;
  clearInterval(timer);
  tick();
  run.status = "finished";
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
  const state = saveResult(result);
  dialog.innerHTML = resultMarkup(result, state);
  bindClose();
  bindStarts();
  updateLaunch();
  window.dispatchEvent(new CustomEvent("nearer:time-trial-result", { detail: result }));
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
  window.NEARER_TIME_TRIAL = { open: openLobby, startPractice: () => { openLobby(); startRun(false); } };
}

initialise().catch(error => console.error("Nearer time trial:", error));
