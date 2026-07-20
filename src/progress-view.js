import { ACHIEVEMENTS, REGIONS, dateLabel, escapeHtml, getAchievementValues } from "./progress-data.js";

function session() {
  return window.NEARER_CLOUD?.session || null;
}

function playerName() {
  const email = session()?.user?.email || "";
  return email ? email.split("@")[0] : "Explorer";
}

function regionCards(data) {
  return Object.entries(REGIONS).map(([key, name]) => {
    const record = data.regions.find(region => region.key === key) || { sessions: 0, best: 0 };
    const percentage = Math.max(0, Math.min(100, record.best));
    return `<article class="nearer-progress-region"><div><span>${name}</span><strong>${percentage}%</strong></div><i><b style="width:${percentage}%"></b></i><small>${record.sessions ? `${record.sessions} session${record.sessions === 1 ? "" : "s"}` : "Not started"}</small></article>`;
  }).join("");
}

function recentDaily(data) {
  if (!data.dailyGames.length) return `<li class="is-empty">Complete a Daily Challenge and it will appear here.</li>`;
  return data.dailyGames.map(game => `<li><span>${dateLabel(game.date)}</span><strong>${game.complete ? "Found" : "In progress"}</strong><small>${game.guesses} guess${game.guesses === 1 ? "" : "es"}</small></li>`).join("");
}

function achievementCards(data) {
  const values = getAchievementValues(data);
  return ACHIEVEMENTS.map(item => {
    const progress = Number(values[item.key] || 0);
    const unlocked = progress >= item.threshold;
    const percentage = Math.min(100, Math.round(progress / item.threshold * 100));
    return `<article class="nearer-progress-achievement ${unlocked ? "is-unlocked" : ""}"><span class="nearer-progress-achievement-icon">${escapeHtml(item.icon)}</span><div><span class="nearer-progress-achievement-category">${item.category}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><i><b style="width:${percentage}%"></b></i><small>${unlocked ? "Unlocked" : `${Math.min(progress, item.threshold)}/${item.threshold}`}</small></div></article>`;
  }).join("");
}

function overview(data) {
  const signedIn = Boolean(session());
  const masteryUrl = new URL("mastery/", new URL("./", document.baseURI)).href;
  return `<section class="nearer-progress-hero"><div><p class="eyebrow">YOUR NEARER JOURNEY</p><h1>${escapeHtml(playerName())}, see the world taking shape.</h1><p>${signedIn ? "Your Daily, Random and Mastery progress is protected across signed-in devices." : "This progress is currently saved on this device. Sign in to protect it and continue elsewhere."}</p></div><div class="nearer-progress-orbit" aria-hidden="true"><span>${data.mastered}</span><small>mastered</small></div></section>
    <section class="nearer-progress-stat-grid" aria-label="Nearer statistics"><article><span>Games played</span><strong>${data.played}</strong></article><article><span>Countries found</span><strong>${data.wins}</strong></article><article><span>Win rate</span><strong>${data.winRate}%</strong></article><article><span>Daily streak</span><strong>${data.streak}</strong></article><article><span>Countries studied</span><strong>${data.studied}</strong></article><article><span>Mastery sessions</span><strong>${data.sessions}</strong></article><article><span>First-try accuracy</span><strong>${data.firstTryAccuracy}%</strong></article><article><span>Countries mastered</span><strong>${data.mastered}</strong></article></section>
    <div class="nearer-progress-columns"><section class="nearer-progress-card"><div class="nearer-progress-heading"><div><p class="eyebrow">REGIONAL MASTERY</p><h2>Strength by region</h2></div><a href="${masteryUrl}">Continue learning →</a></div><div class="nearer-progress-region-grid">${regionCards(data)}</div></section><section class="nearer-progress-card"><div class="nearer-progress-heading"><div><p class="eyebrow">DAILY SIGNAL</p><h2>Recent challenges</h2></div></div><ol class="nearer-progress-recent">${recentDaily(data)}</ol></section></div>`;
}

function achievements(data) {
  const values = getAchievementValues(data);
  const unlocked = ACHIEVEMENTS.filter(item => Number(values[item.key] || 0) >= item.threshold).length;
  return `<section class="nearer-progress-collection-head"><div><p class="eyebrow">ACHIEVEMENT COLLECTION</p><h1>Milestones worth mapping.</h1><p>Every achievement reflects real play, daily consistency or growing geographic knowledge.</p></div><strong>${unlocked}<small>unlocked</small></strong></section><section class="nearer-progress-achievement-grid">${achievementCards(data)}</section>`;
}

export function renderProgress(dialog, data) {
  const signedIn = Boolean(session());
  const tab = dialog.dataset.tab || "overview";
  const values = getAchievementValues(data);
  const unlocked = ACHIEVEMENTS.filter(item => Number(values[item.key] || 0) >= item.threshold).length;
  dialog.innerHTML = `<div class="nearer-progress-shell"><header class="nearer-progress-header"><div><span>N</span><div><strong>NEARER</strong><small>Progress passport</small></div></div><button type="button" data-progress-close aria-label="Close progress">×</button></header><nav class="nearer-progress-tabs" aria-label="Progress sections"><button type="button" data-progress-tab="overview" class="${tab === "overview" ? "is-active" : ""}">Overview</button><button type="button" data-progress-tab="achievements" class="${tab === "achievements" ? "is-active" : ""}">Achievements <span>${unlocked}/${ACHIEVEMENTS.length}</span></button></nav><main class="nearer-progress-content">${tab === "achievements" ? achievements(data) : overview(data)}</main><footer class="nearer-progress-footer"><div><strong>${signedIn ? "Cloud progress active" : "Saved on this device"}</strong><span>${signedIn ? escapeHtml(session().user.email || "Signed in") : "Sign in to sync Daily, Random and Mastery progress."}</span></div><div><button type="button" class="secondary-button" data-progress-account>${signedIn ? "Account settings" : "Sign in"}</button>${signedIn ? `<button type="button" class="primary-button" data-progress-sync>Sync now</button>` : ""}</div></footer></div>`;
}
