(() => {
  "use strict";

  const path = location.pathname;
  const mode = path.includes("/cooperative/") ? "relay" : path.includes("/duel/") ? "duel" : path.includes("/race/") ? "race" : null;
  if (!mode) return;

  document.body.classList.add("together-experience", `mode-${mode}`);
  document.documentElement.dataset.togetherMode = mode;

  const input = document.getElementById("countryInput");
  const panel = document.querySelector(".race-guess-panel,.mode-guess-panel");
  const turnTitle = document.getElementById("turnTitle");
  const viewport = window.visualViewport;
  const mobileQuery = matchMedia("(max-width: 820px)");
  let blurTimer = 0;

  if (!input || !panel) return;

  const context = document.createElement("div");
  context.className = "mobile-composer-context";
  context.innerHTML = '<span>YOUR GUESS</span><strong></strong>';
  panel.prepend(context);

  const updateContext = () => {
    const title = turnTitle?.textContent?.trim() || "Choose the next country";
    const value = context.querySelector("strong");
    if (value && value.textContent !== title) value.textContent = title;
  };

  function keyboardOffset() {
    if (!viewport) return 0;
    return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
  }

  function keyboardIsOpen() {
    if (!mobileQuery.matches || document.activeElement !== input) return false;
    if (!viewport) return true;
    return keyboardOffset() > 100 || viewport.height < window.innerHeight * .82;
  }

  function syncViewport() {
    const offset = keyboardOffset();
    const height = viewport?.height || window.innerHeight;
    const top = viewport?.offsetTop || 0;
    document.documentElement.style.setProperty("--keyboard-offset", `${offset}px`);
    document.documentElement.style.setProperty("--visual-viewport-height", `${Math.round(height)}px`);
    document.documentElement.style.setProperty("--visual-viewport-top", `${Math.round(top)}px`);
    document.body.classList.toggle("keyboard-open", keyboardIsOpen());
  }

  function enterComposer() {
    clearTimeout(blurTimer);
    document.body.classList.add("composer-focused");
    updateContext();
    syncViewport();
    requestAnimationFrame(() => {
      syncViewport();
      if (!viewport) panel.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    setTimeout(syncViewport, 120);
    setTimeout(syncViewport, 320);
  }

  function leaveComposer() {
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      if (document.activeElement === input || panel.contains(document.activeElement)) return;
      document.body.classList.remove("composer-focused", "keyboard-open");
      syncViewport();
    }, 120);
  }

  input.addEventListener("focus", enterComposer);
  input.addEventListener("blur", leaveComposer);
  viewport?.addEventListener("resize", syncViewport);
  viewport?.addEventListener("scroll", syncViewport);
  window.addEventListener("resize", syncViewport);
  window.addEventListener("orientationchange", () => setTimeout(syncViewport, 250));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncViewport(); });

  const titleObserver = new MutationObserver(updateContext);
  if (turnTitle) titleObserver.observe(turnTitle, { childList: true, characterData: true, subtree: true });

  updateContext();
  syncViewport();
  window.__NEARER_TOGETHER_EXPERIENCE_STARTED = true;
})();
