const STORAGE_KEY = "nearer-time-trial-v1";

export function localDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function normalise(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function random(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function dailySequence(countries, dateKey = localDateKey()) {
  const output = [...countries];
  const next = random(hash(`nearer-time-trial:${dateKey}:v1`));
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

export function countrySearch(countries) {
  const entries = [];
  for (const country of countries) {
    const values = [country.name, country.code, ...(country.aliases || [])];
    for (const value of values) entries.push({ key: normalise(value), country });
  }
  return {
    exact(value) {
      const key = normalise(value);
      return entries.find(entry => entry.key === key)?.country || null;
    },
    suggest(value, excluded = new Set()) {
      const key = normalise(value);
      if (!key) return [];
      const seen = new Set();
      return entries
        .filter(entry => !excluded.has(entry.country.code) && entry.key.includes(key))
        .sort((a, b) => Number(!a.key.startsWith(key)) - Number(!b.key.startsWith(key)) || a.country.name.localeCompare(b.country.name))
        .filter(entry => !seen.has(entry.country.code) && seen.add(entry.country.code))
        .slice(0, 7)
        .map(entry => entry.country);
    }
  };
}

export function readTimeTrialState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || { days: {}, stats: {} };
  } catch {
    return { days: {}, stats: {} };
  }
}

export function rankedAvailable(dateKey = localDateKey()) {
  return !readTimeTrialState().days?.[dateKey]?.ranked;
}

function previousDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return localDateKey(date);
}

export function saveResult(result) {
  const state = readTimeTrialState();
  state.days ||= {};
  state.stats ||= {};
  const existing = state.days[result.dateKey] || {};
  const better = !existing.best || result.found > existing.best.found || (result.found === existing.best.found && result.guesses < existing.best.guesses);
  state.days[result.dateKey] = {
    ...existing,
    ranked: existing.ranked || (result.ranked ? result : null),
    best: better ? result : existing.best
  };
  state.stats.played = Number(state.stats.played || 0) + 1;
  state.stats.best = Math.max(Number(state.stats.best || 0), result.found);
  if (result.ranked) {
    const last = state.stats.lastRanked;
    state.stats.streak = last === previousDateKey(result.dateKey) ? Number(state.stats.streak || 0) + 1 : 1;
    state.stats.lastRanked = result.dateKey;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function formatClock(milliseconds) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
