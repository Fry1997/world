(() => {
  "use strict";
  if (window.__NEARER_EXPERIENCE8_STARTED) return;

  const root = document.documentElement;
  const body = document.body;
  body.classList.add("experience-eight");
  root.dataset.nearerExperience = "8";
  document.querySelectorAll(".nearer-safe-area-shield").forEach(node => node.remove());

  const pathname = location.pathname;
  const isDuel = pathname.includes("/together/duel/");
  const STORAGE_KEY = "nearer-hidden-country-duel-v1";
  const countryByCode = new Map((window.NEARER_GAME_DATA?.countries || []).map(country => [country.code, country]));

  let homeReference = null;
  if (isDuel) {
    const panel = document.querySelector(".mode-map-panel");
    const hint = panel?.querySelector(".globe-hint");
    if (hint) hint.textContent = "Gold: your route · steel: opponent route · coral: your country";
    if (panel && !panel.querySelector(".duel-home-reference")) {
      homeReference = document.createElement("section");
      homeReference.className = "duel-home-reference";
      homeReference.setAttribute("aria-live", "polite");
      homeReference.innerHTML = `
        <div class="duel-home-copy"><span>Your defended country</span><strong>Private until your turn begins</strong></div>
        <div class="duel-route-legend" aria-label="Globe route key">
          <span class="home"><i></i>Home</span><span class="you"><i></i>Your guesses</span><span class="opponent"><i></i>Opponent guesses</span>
        </div>`;
      panel.insertBefore(homeReference, panel.firstChild);
    } else {
      homeReference = panel?.querySelector(".duel-home-reference") || null;
    }
  }

  function readDuel() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
    catch { return null; }
  }

  function privacyScreenOpen() {
    const pass = document.getElementById("passScreen");
    const secret = document.getElementById("secretScreen");
    return Boolean((pass && !pass.classList.contains("is-hidden")) || (secret && !secret.classList.contains("is-hidden")));
  }

  function syncDuelReference() {
    if (!homeReference) return;
    const state = readDuel();
    const concealed = privacyScreenOpen() || !state?.revealsComplete || state.status !== "active";
    homeReference.classList.toggle("is-concealed", concealed);
    if (concealed) return;
    const current = Number(state.currentPlayer) || 0;
    const country = countryByCode.get(state.targets?.[current]);
    const name = country?.name || "Your country";
    const copy = homeReference.querySelector(".duel-home-copy strong");
    if (copy && copy.textContent !== name) copy.textContent = name;
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const syncThemeChrome = () => {
    if (!themeMeta) return;
    themeMeta.content = root.dataset.theme === "dark" ? "#030a11" : "#0b2232";
  };

  syncThemeChrome();
  syncDuelReference();
  new MutationObserver(() => {
    syncThemeChrome();
    syncDuelReference();
  }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  const privacyNodes = [document.getElementById("passScreen"), document.getElementById("secretScreen")].filter(Boolean);
  privacyNodes.forEach(node => new MutationObserver(syncDuelReference).observe(node, { attributes: true, attributeFilter: ["class"] }));

  document.addEventListener("click", () => setTimeout(syncDuelReference, 40), true);
  window.addEventListener("storage", syncDuelReference);
  window.addEventListener("pageshow", syncDuelReference);

  window.__NEARER_EXPERIENCE8_STARTED = true;
})();
