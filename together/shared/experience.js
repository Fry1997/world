(() => {
  "use strict";

  const path = location.pathname;
  const isTogether = path.includes("/together/") && !path.endsWith("/together/");
  const mode = path.includes("/cooperative/") ? "relay" : path.includes("/duel/") ? "duel" : path.includes("/race/") ? "race" : "solo";
  const body = document.body;

  body.classList.add(isTogether ? "together-experience" : "solo-experience", `mode-${mode}`, "experience-two");
  document.documentElement.dataset.nearerExperience = "2";

  const input = document.getElementById("countryInput");
  const panel = document.querySelector(".race-guess-panel,.mode-guess-panel,.guess-panel");
  const submit = document.getElementById("makeGuessButton") || document.getElementById("guessButton");
  const endTurn = document.getElementById("endTurnButton");
  const title = document.getElementById("turnTitle") || document.getElementById("gameTitle");
  const viewport = window.visualViewport;
  const mobileQuery = matchMedia("(max-width: 820px)");

  if (!input || !panel || !submit) {
    window.__NEARER_EXPERIENCE2_STARTED = true;
    return;
  }

  let active = false;
  let locked = false;
  let savedScrollY = 0;
  let blurTimer = 0;
  let releaseTimer = 0;

  let context = panel.querySelector(".mobile-composer-context");
  if (!context) {
    context = document.createElement("div");
    context.className = "mobile-composer-context";
    context.innerHTML = '<span>YOUR GUESS</span><strong></strong>';
    panel.prepend(context);
  }

  const updateContext = () => {
    const strong = context.querySelector("strong");
    const text = title?.textContent?.trim() || (isTogether ? "Choose the next country" : "Find the hidden country");
    if (strong && strong.textContent !== text) strong.textContent = text;
  };

  const keyboardOffset = () => {
    if (!viewport) return 0;
    return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
  };

  const keyboardOpen = () => {
    if (!active || !mobileQuery.matches || document.activeElement !== input) return false;
    if (!viewport) return true;
    return keyboardOffset() > 90 || viewport.height < window.innerHeight * .84;
  };

  const syncViewport = () => {
    const offset = keyboardOffset();
    const height = viewport?.height || window.innerHeight;
    const top = viewport?.offsetTop || 0;
    document.documentElement.style.setProperty("--keyboard-offset", `${offset}px`);
    document.documentElement.style.setProperty("--visual-viewport-height", `${Math.round(height)}px`);
    document.documentElement.style.setProperty("--visual-viewport-top", `${Math.round(top)}px`);
    body.classList.toggle("keyboard-open", keyboardOpen());
  };

  const lockDocument = () => {
    if (locked || !mobileQuery.matches) return;
    savedScrollY = window.scrollY;
    body.style.top = `-${savedScrollY}px`;
    body.classList.add("composer-scroll-locked");
    locked = true;
  };

  const activate = () => {
    if (!mobileQuery.matches || active) return;
    clearTimeout(blurTimer);
    clearTimeout(releaseTimer);
    active = true;
    lockDocument();
    body.classList.add("composer-active");
    updateContext();
    syncViewport();
    requestAnimationFrame(syncViewport);
    setTimeout(syncViewport, 120);
    setTimeout(syncViewport, 320);
  };

  const release = () => {
    if (!active && !locked) return;
    clearTimeout(blurTimer);
    clearTimeout(releaseTimer);
    active = false;
    body.classList.remove("composer-active", "keyboard-open", "composer-scroll-locked");
    body.style.top = "";
    const restoreY = savedScrollY;
    locked = false;
    requestAnimationFrame(() => window.scrollTo(0, restoreY));
    syncViewport();
  };

  const queueReleaseAfterAction = () => {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(release, 120);
  };

  panel.addEventListener("pointerdown", event => {
    if (!mobileQuery.matches) return;
    if (event.target.closest(".search-area,.search-control,#countryInput,.suggestions")) activate();
  }, { capture: true });
  panel.addEventListener("touchstart", event => {
    if (!mobileQuery.matches) return;
    if (event.target.closest(".search-area,.search-control,#countryInput,.suggestions")) activate();
  }, { capture: true, passive: true });

  input.addEventListener("focus", activate);
  input.addEventListener("blur", () => {
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      const hasValue = input.value.trim().length > 0;
      const focusInside = panel.contains(document.activeElement);
      if (active && (hasValue || focusInside)) {
        body.classList.remove("keyboard-open");
        syncViewport();
        return;
      }
      release();
    }, 160);
  });

  submit.addEventListener("click", queueReleaseAfterAction);
  endTurn?.addEventListener("click", release);
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      input.blur();
      release();
    }
  });

  document.addEventListener("pointerdown", event => {
    if (!active || keyboardOpen()) return;
    if (panel.contains(event.target)) return;
    if (!input.value.trim()) release();
  });

  viewport?.addEventListener("resize", syncViewport);
  viewport?.addEventListener("scroll", syncViewport);
  window.addEventListener("resize", syncViewport);
  window.addEventListener("orientationchange", () => setTimeout(syncViewport, 250));
  window.addEventListener("pagehide", () => {
    body.classList.remove("composer-active", "keyboard-open", "composer-scroll-locked");
    body.style.top = "";
  });

  if (title) new MutationObserver(updateContext).observe(title, { childList: true, characterData: true, subtree: true });
  updateContext();
  syncViewport();
  window.__NEARER_EXPERIENCE2_STARTED = true;
})();