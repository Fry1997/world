(() => {
  "use strict";
  if (window.__NEARER_EXPERIENCE9_STARTED) return;

  document.body.classList.add("experience-nine");
  document.documentElement.dataset.nearerExperience = "9";

  const moveDuelReference = () => {
    if (!location.pathname.includes("/together/duel/")) return true;
    const panel = document.querySelector(".mode-map-panel");
    const reference = document.querySelector(".duel-home-reference");
    const playColumn = panel?.closest(".mode-play-column");
    if (!panel || !reference || !playColumn) return false;
    if (reference.parentElement !== playColumn || reference.nextElementSibling !== panel) {
      playColumn.insertBefore(reference, panel);
    }
    return true;
  };

  if (!moveDuelReference()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (moveDuelReference() || attempts > 120) clearInterval(timer);
    }, 50);
  }

  const observer = new MutationObserver(moveDuelReference);
  observer.observe(document.body, { childList: true, subtree: true });

  window.__NEARER_EXPERIENCE9_STARTED = true;
})();
