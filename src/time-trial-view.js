import { formatClock } from "./time-trial-data.js";

export function launchMarkup(today) {
  const score = today?.ranked?.found;
  return `<div class="nearer-time-trial-launch-copy"><span class="nearer-time-trial-kicker">DAILY TIME TRIAL</span><strong>${score === undefined ? "How many countries can you find in three minutes?" : `Today's score · ${score} countr${score === 1 ? "y" : "ies"}`}</strong><small>Same sequence for everyone · one ranked attempt</small></div><div class="nearer-time-trial-launch-clock" aria-hidden="true"><b>3:00</b><i></i></div><button type="button" class="primary-button" data-time-trial-open>${score === undefined ? "Start challenge" : "View or practise"}</button>`;
}

export function lobbyMarkup({ rankedAvailable, today, stats }) {
  const ranked = today?.ranked;
  return `<div class="nearer-time-trial-shell"><header class="nearer-time-trial-header"><div><span>N</span><div><p>DAILY TIME TRIAL</p><strong>Three minutes. One world.</strong></div></div><button type="button" data-time-trial-close aria-label="Close">×</button></header><main class="nearer-time-trial-lobby"><section><p class="eyebrow">TODAY'S SHARED SEQUENCE</p><h1>Find as many hidden countries as the clock allows.</h1><p>Every player receives the same sequence. Solve one country and the next begins immediately. Your score is countries found; fewer guesses and more time remaining break ties.</p><div class="nearer-time-trial-rules"><article><span>01</span><strong>Three-minute clock</strong><p>The timer never pauses between countries.</p></article><article><span>02</span><strong>Distance feedback</strong><p>Each guess shows border-to-border distance.</p></article><article><span>03</span><strong>One ranked run</strong><p>Practice remains available afterwards.</p></article></div></section><aside><div class="nearer-time-trial-dial"><strong>${ranked?.found ?? "3:00"}</strong><span>${ranked ? "countries today" : "on the clock"}</span></div><div class="nearer-time-trial-lifetime"><div><span>Best</span><strong>${stats?.best || 0}</strong></div><div><span>Daily streak</span><strong>${stats?.streak || 0}</strong></div><div><span>Runs</span><strong>${stats?.played || 0}</strong></div></div><button type="button" class="primary-button" data-time-trial-start="${rankedAvailable ? "ranked" : "practice"}">${rankedAvailable ? "Begin ranked attempt" : "Start practice run"}</button>${rankedAvailable ? `<button type="button" class="nearer-time-trial-practice" data-time-trial-start="practice">Practise first</button>` : `<p class="nearer-time-trial-used">Ranked attempt complete for today.</p>`}</aside></main></div>`;
}

export function runningMarkup({ ranked, remaining, found, guesses }) {
  return `<div class="nearer-time-trial-shell is-running"><header class="nearer-time-trial-header"><div><span>N</span><div><p>${ranked ? "RANKED DAILY RUN" : "PRACTICE RUN"}</p><strong>Keep moving.</strong></div></div><button type="button" data-time-trial-end>End run</button></header><div class="nearer-time-trial-scorebar"><div><span>Time</span><strong data-time-trial-clock>${formatClock(remaining)}</strong></div><div><span>Countries</span><strong data-time-trial-found>${found}</strong></div><div><span>Total guesses</span><strong data-time-trial-guesses>${guesses}</strong></div><div class="nearer-time-trial-pulse"><i></i><span>Sequence live</span></div></div><main class="nearer-time-trial-game"><section class="nearer-time-trial-globe-card"><canvas data-time-trial-globe aria-label="Interactive world globe showing submitted guesses"></canvas><div class="nearer-time-trial-globe-key"><span>Far</span><i></i><span>Near</span></div><small>Submitted guesses only · drag to rotate</small></section><section class="nearer-time-trial-play"><div class="nearer-time-trial-target"><p class="eyebrow">COUNTRY ${found + 1}</p><h1>A country is hiding.</h1><p data-time-trial-feedback>Your first guess sets the signal.</p></div><form data-time-trial-form><label for="timeTrialInput">Guess a country</label><div class="nearer-time-trial-input"><input id="timeTrialInput" name="country" autocomplete="off" spellcheck="false" placeholder="Start typing a country…"><button type="submit" class="primary-button">Guess</button></div><div class="nearer-time-trial-suggestions" data-time-trial-suggestions hidden></div></form><section class="nearer-time-trial-closest"><span>Closest this country</span><strong data-time-trial-closest>No signal yet</strong></section><ol class="nearer-time-trial-history" data-time-trial-history><li class="is-empty">Guesses appear here, nearest first.</li></ol></section></main></div>`;
}

export function resultMarkup(result, state) {
  const fastest = result.fastestSolveMs === null ? "—" : `${(result.fastestSolveMs / 1000).toFixed(1)}s`;
  const solved = result.solved.length ? result.solved.map((country, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><strong>${country.name}</strong><small>${country.guesses} guess${country.guesses === 1 ? "" : "es"}</small></li>`).join("") : `<li class="is-empty">No countries found this run.</li>`;
  return `<div class="nearer-time-trial-shell"><header class="nearer-time-trial-header"><div><span>N</span><div><p>${result.ranked ? "DAILY RESULT" : "PRACTICE RESULT"}</p><strong>Run complete.</strong></div></div><button type="button" data-time-trial-close aria-label="Close">×</button></header><main class="nearer-time-trial-results"><section class="nearer-time-trial-result-hero"><div><p class="eyebrow">COUNTRIES FOUND</p><h1>${result.found}</h1><p>${result.ranked ? "Your ranked result is locked in for today." : "Practice complete. Your ranked daily result is unchanged."}</p></div><div class="nearer-time-trial-result-ring"><span>${formatClock(result.timeRemainingMs)}</span><small>remaining</small></div></section><section class="nearer-time-trial-result-stats"><article><span>Total guesses</span><strong>${result.guesses}</strong></article><article><span>Fastest solve</span><strong>${fastest}</strong></article><article><span>Closest final lead</span><strong>${Number.isFinite(result.closestDistance) ? `${result.closestDistance.toLocaleString()} km` : "—"}</strong></article><article><span>Daily streak</span><strong>${state.stats?.streak || 0}</strong></article></section><section class="nearer-time-trial-recap"><div><p class="eyebrow">SEQUENCE RECAP</p><h2>The countries you cleared</h2></div><ol>${solved}</ol></section><div class="nearer-time-trial-result-actions"><button type="button" class="primary-button" data-time-trial-start="practice">Run a practice</button><button type="button" class="secondary-button" data-time-trial-close>Return to Nearer</button></div></main></div>`;
}

export function updateRunning(dialog, state) {
  const clock = dialog.querySelector("[data-time-trial-clock]");
  const found = dialog.querySelector("[data-time-trial-found]");
  const guesses = dialog.querySelector("[data-time-trial-guesses]");
  if (clock) clock.textContent = formatClock(state.remaining);
  if (found) found.textContent = state.found;
  if (guesses) guesses.textContent = state.totalGuesses;
  dialog.classList.toggle("is-time-low", state.remaining <= 30000);
}

export function renderGuessState(dialog, guesses, feedback) {
  const sorted = [...guesses].sort((a, b) => a.distance - b.distance || a.order - b.order);
  const closest = sorted[0];
  const closestNode = dialog.querySelector("[data-time-trial-closest]");
  const feedbackNode = dialog.querySelector("[data-time-trial-feedback]");
  const history = dialog.querySelector("[data-time-trial-history]");
  if (closestNode) closestNode.textContent = closest ? `${closest.name} · ${closest.distance.toLocaleString()} km` : "No signal yet";
  if (feedbackNode) feedbackNode.textContent = feedback || "Your first guess sets the signal.";
  if (history) history.innerHTML = sorted.length ? sorted.map((guess, index) => `<li><span>${index + 1}</span><strong>${guess.name}</strong><small>${guess.distance.toLocaleString()} km</small></li>`).join("") : `<li class="is-empty">Guesses appear here, nearest first.</li>`;
}
