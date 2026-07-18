(() => {
  "use strict";

  const path = location.pathname;
  const isTogether = path.includes("/together/") && !path.endsWith("/together/");
  const mode = path.includes("/cooperative/") ? "relay" : path.includes("/duel/") ? "duel" : path.includes("/race/") ? "race" : "solo";
  const body = document.body;

  body.classList.add(isTogether ? "together-experience" : "solo-experience", `mode-${mode}`, "experience-four");
  body.classList.remove("composer-active", "keyboard-open", "composer-scroll-locked", "country-input-focused");
  body.style.top = "";
  document.documentElement.dataset.nearerExperience = "4";

  document.querySelectorAll(".globe-hint").forEach(hint => {
    hint.textContent = "Drag to rotate · pinch to zoom";
  });

  const count = document.getElementById("guessCount");
  const history = document.getElementById("guessHistory") || document.getElementById("raceGuessHistory");

  const syncProgress = () => {
    const numericCount = Number.parseInt(count?.textContent || "0", 10);
    const hasHistory = Boolean(history?.children?.length);
    body.classList.toggle("has-game-progress", numericCount > 0 || hasHistory);
  };

  if (count) new MutationObserver(syncProgress).observe(count, { childList: true, characterData: true, subtree: true });
  if (history) new MutationObserver(syncProgress).observe(history, { childList: true, subtree: true });

  syncProgress();
  window.__NEARER_EXPERIENCE4_STARTED = true;
})();
