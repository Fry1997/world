(() => {
  "use strict";
  if (window.__NEARER_EXPERIENCE8_STARTED) return;

  const root = document.documentElement;
  const body = document.body;
  body.classList.add("experience-eight");
  root.dataset.nearerExperience = "8";
  document.querySelectorAll(".nearer-safe-area-shield").forEach(node => node.remove());

  if (!document.querySelector("style[data-nearer-experience8-contrast]")) {
    const style = document.createElement("style");
    style.dataset.nearerExperience8Contrast = "true";
    style.textContent = `
      body.experience-eight .mode-setup-card input,
      body.experience-eight .mode-setup-card select,
      body.experience-eight .setup-card input,
      body.experience-eight .setup-card select,
      body.experience-eight .player-name-grid input {
        background:#f9f4ee !important;
        color:#14202a !important;
        border-color:rgba(29,43,54,.2) !important;
      }
      body.experience-eight .mode-setup-card option,
      body.experience-eight .setup-card option { color:#14202a; background:#fffaf4; }
      body.experience-eight .guess-swatch { filter:saturate(.62) brightness(.94); }
    `;
    document.head.appendChild(style);
  }

  const pathname = location.pathname;
  const isDuel = pathname.includes("/together/duel/");
  const STORAGE_KEY = "nearer-hidden-country-duel-v1";
  const countryByCode = new Map((window.NEARER_GAME_DATA?.countries || []).map(country => [country.code, country]));

  let homeReference = null;
  let duelFeedback = null;
  if (isDuel) {
    const panel = document.querySelector(".mode-map-panel");
    const hint = panel?.querySelector(".globe-hint");
    duelFeedback = document.getElementById("feedbackPanel");
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

  function syncDuelLanguage() {
    if (!duelFeedback) return;
    const copy = duelFeedback.querySelector("p");
    if (!copy) return;
    if (/never the countries|never which country/i.test(copy.textContent)) {
      copy.textContent = "Your completed route appears in muted steel on your opponent's globe; your defended country remains private to you.";
    }
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
  syncDuelLanguage();
  new MutationObserver(() => {
    syncThemeChrome();
    syncDuelReference();
  }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  const privacyNodes = [document.getElementById("passScreen"), document.getElementById("secretScreen")].filter(Boolean);
  privacyNodes.forEach(node => new MutationObserver(syncDuelReference).observe(node, { attributes: true, attributeFilter: ["class"] }));
  if (duelFeedback) new MutationObserver(syncDuelLanguage).observe(duelFeedback, { childList: true, subtree: true, characterData: true });

  document.addEventListener("click", () => setTimeout(() => { syncDuelReference(); syncDuelLanguage(); }, 40), true);
  window.addEventListener("storage", syncDuelReference);
  window.addEventListener("pageshow", () => { syncDuelReference(); syncDuelLanguage(); });

  window.__NEARER_EXPERIENCE8_STARTED = true;
})();
