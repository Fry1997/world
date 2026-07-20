export const ACHIEVEMENTS = [
  ["first_find", "First Contact", "Find your first hidden country.", "◎", "Play", 1],
  ["five_games", "Getting Your Bearings", "Complete five Nearer games.", "◇", "Play", 5],
  ["twenty_five_games", "Seasoned Navigator", "Complete twenty-five Nearer games.", "✦", "Play", 25],
  ["hundred_games", "World Traveller", "Complete one hundred Nearer games.", "✧", "Play", 100],
  ["ten_wins", "Reliable Compass", "Find ten hidden countries.", "⌖", "Play", 10],
  ["daily_streak_3", "Three-Day Signal", "Win the Daily Challenge three days in a row.", "◉", "Daily", 3],
  ["daily_streak_7", "Week on the Map", "Win the Daily Challenge seven days in a row.", "◈", "Daily", 7],
  ["mastery_started", "Student of the World", "Study your first country in Regional Mastery.", "◆", "Mastery", 1],
  ["mastery_first", "Location Locked", "Raise one country to mastered strength.", "⬡", "Mastery", 1],
  ["mastery_ten", "Regional Recall", "Master ten countries.", "⬢", "Mastery", 10],
  ["mastery_fifty", "Map Memory", "Master fifty countries.", "✺", "Mastery", 50],
  ["all_regions_started", "Six Corners of the World", "Begin learning in every Regional Mastery path.", "✹", "Mastery", 6]
].map(([key, name, description, icon, category, threshold]) => ({ key, name, description, icon, category, threshold }));

export const REGIONS = {
  europe: "Europe",
  africa: "Africa",
  asia: "Asia",
  north_america: "North America",
  south_america: "South America",
  oceania: "Oceania"
};

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null") || {}; }
  catch { return {}; }
}

function strength(record = {}) {
  const correct = Number(record.correct || 0);
  const first = Number(record.firstCorrect || 0);
  const misses = Number(record.misses || 0);
  return Math.max(0, Math.min(100, Math.round(first * 34 + Math.max(0, correct - first) * 18 - misses * 7)));
}

export function getProgressSnapshot() {
  const solo = read("nearer-game-v1");
  const mastery = read("nearer-mastery-v1");
  const countries = Object.values(mastery.countries || {});
  const played = Number(solo.stats?.played || 0);
  const wins = Number(solo.stats?.wins || 0);
  const answered = Number(mastery.totals?.answered || 0);
  const firstCorrect = Number(mastery.totals?.firstCorrect || 0);
  const regions = Object.entries(mastery.regions || {}).map(([key, record]) => ({
    key,
    sessions: Number(record?.sessions || 0),
    best: Number(record?.best || 0)
  }));

  return {
    played,
    wins,
    winRate: played ? Math.round(wins / played * 100) : 0,
    streak: Number(solo.stats?.streak || 0),
    studied: countries.filter(record => Number(record?.attempts || 0) > 0).length,
    mastered: countries.filter(record => strength(record) >= 70).length,
    sessions: Number(mastery.totals?.sessions || 0),
    firstTryAccuracy: answered ? Math.round(firstCorrect / answered * 100) : 0,
    regions,
    dailyGames: Object.entries(solo.dailyGames || {})
      .map(([date, game]) => ({ date, complete: Boolean(game?.complete), guesses: Number(game?.guesses?.length || 0) }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
  };
}

export function getAchievementValues(data) {
  return {
    first_find: data.wins,
    five_games: data.played,
    twenty_five_games: data.played,
    hundred_games: data.played,
    ten_wins: data.wins,
    daily_streak_3: data.streak,
    daily_streak_7: data.streak,
    mastery_started: data.studied,
    mastery_first: data.mastered,
    mastery_ten: data.mastered,
    mastery_fifty: data.mastered,
    all_regions_started: data.regions.filter(region => region.sessions > 0).length
  };
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function dateLabel(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date);
}
