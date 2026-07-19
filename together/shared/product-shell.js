(() => {
  "use strict";
  if (window.__NEARER_PRODUCT_SHELL_STARTED) return;
  window.__NEARER_PRODUCT_SHELL_STARTED = true;

  const MASTERY_KEY = "nearer-mastery-v1";
  const THEME_KEY = "nearer-together-theme";

  function masteryState() {
    try { return JSON.parse(localStorage.getItem(MASTERY_KEY) || "null") || {}; }
    catch { return {}; }
  }

  function masteryCount() {
    const countries = masteryState().countries || {};
    return Object.values(countries).filter(item => (item.correct || 0) > 0).length;
  }

  function updateBadges() {
    const count = masteryCount();
    document.querySelectorAll("[data-mastery-count]").forEach(node => {
      node.textContent = String(count);
      node.hidden = count < 1;
    });
  }

  function applyRequestedSoloMode() {
    if (!/^\/?world\/?$/.test(location.pathname) && !location.pathname.endsWith("/world/")) return;
    const requested = new URLSearchParams(location.search).get("mode");
    if (!requested || !["daily", "random"].includes(requested)) return;
    try {
      const saved = JSON.parse(localStorage.getItem("nearer-game-v1") || "null") || {};
      saved.mode = requested;
      localStorage.setItem("nearer-game-v1", JSON.stringify(saved));
    } catch {}
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const button = document.querySelector(`.mode-button[data-mode="${requested}"]`);
      if (button && !button.classList.contains("is-active")) button.click();
      if (button?.classList.contains("is-active") || attempts > 250) {
        clearInterval(timer);
        if (button?.classList.contains("is-active")) history.replaceState({}, "", location.pathname);
      }
    }, 40);
  }

  function initialiseStaticTheme() {
    if (!document.body.classList.contains("product-static-page")) return;
    const saved = localStorage.getItem(THEME_KEY);
    document.documentElement.dataset.theme = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const button = document.getElementById("themeButton");
    button?.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
    });
  }

  function injectMasteryPulse() {
    if (!document.body.classList.contains("nearer-solo-home")) return;
    const heading = document.querySelector(".game-heading");
    if (!heading || document.querySelector(".mastery-pulse")) return;
    const count = masteryCount();
    if (!count) return;
    const regions = masteryState().regions || {};
    const sessions = Object.values(regions).reduce((sum, region) => sum + (region.sessions || 0), 0);
    const pulse = document.createElement("aside");
    pulse.className = "mastery-pulse";
    pulse.innerHTML = `
      <span class="mastery-pulse-mark" aria-hidden="true">◇</span>
      <div><strong>${count} countries placed in Mastery</strong><span>${sessions} completed session${sessions === 1 ? "" : "s"} · your learning progress is saved on this browser</span></div>
      <a href="learn/">Continue learning →</a>`;
    heading.after(pulse);
  }

  initialiseStaticTheme();
  updateBadges();
  applyRequestedSoloMode();
  setTimeout(injectMasteryPulse, 100);
  window.addEventListener("storage", () => { updateBadges(); injectMasteryPulse(); });
})();
