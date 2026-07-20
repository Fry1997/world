const pendingKey = "nearer-time-trial-pending-v1";
const stateKey = "nearer-time-trial-v1";

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; }
  catch { return fallback; }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function queueCompetitionResult(runId, result) {
  const pending = read(pendingKey, {});
  pending[runId] = { runId, result, queuedAt: new Date().toISOString() };
  write(pendingKey, pending);
}

export function queuedCompetitionResults() {
  return Object.values(read(pendingKey, {}));
}

export function clearCompetitionResult(runId) {
  const pending = read(pendingKey, {});
  delete pending[runId];
  write(pendingKey, pending);
}

export function markCompetitionVerified(dateKey, serverResult) {
  const state = read(stateKey, { days: {}, stats: {} });
  const day = state.days?.[dateKey];
  if (!day?.ranked) return;
  const patch = {
    verified: true,
    durationMs: serverResult.durationMs,
    timeRemainingMs: serverResult.timeRemainingMs,
    verifiedAt: new Date().toISOString()
  };
  day.ranked = { ...day.ranked, ...patch };
  if (day.best?.clientRunId === day.ranked.clientRunId) day.best = { ...day.best, ...patch };
  write(stateKey, state);
}
