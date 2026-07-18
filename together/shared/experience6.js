(() => {
  "use strict";

  const body = document.body;
  body.classList.add("experience-six");
  document.documentElement.dataset.nearerExperience = "6";

  const heading = document.querySelector(".game-heading");
  const help = document.getElementById("helpButton");
  if (heading && help) {
    help.classList.add("heading-help");
    heading.appendChild(help);
  }

  const streak = document.getElementById("streakStat");
  const syncStreak = () => {
    if (!streak) return;
    const value = Number.parseInt(streak.textContent || "0", 10);
    streak.classList.toggle("is-burning", value >= 2);
  };
  if (streak) {
    new MutationObserver(syncStreak).observe(streak, { childList: true, characterData: true, subtree: true });
    syncStreak();
  }

  window.__NEARER_EXPERIENCE6_STARTED = true;
})();
