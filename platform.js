(() => {
  "use strict";
  if (window.__NEARER_PLATFORM_STARTED) return;

  const path = location.pathname.replace(/\/index\.html$/, "/");
  const rootPath = path.endsWith("/world/");
  const THEME_KEY = "nearer-together-theme";
  const savedTheme = localStorage.getItem(THEME_KEY) || localStorage.getItem("nearer-race-theme");

  if (!document.documentElement.dataset.theme) {
    document.documentElement.dataset.theme = savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }

  if (!rootPath) {
    const themeButton = document.getElementById("themeButton");
    themeButton?.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
    });
  }

  function activateMode(mode) {
    const button = document.querySelector(`.platform-tabs .mode-button[data-mode="${mode}"]`);
    button?.click();
    document.querySelector("main")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function syncDockState(dock) {
    const dailyActive = document.querySelector('.platform-tabs .mode-button[data-mode="daily"]')?.classList.contains("is-active");
    dock.querySelectorAll("[data-platform-mode]").forEach(button => {
      const active = button.dataset.platformMode === (dailyActive ? "daily" : "random");
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  function addMobileDock() {
    const dock = document.createElement("nav");
    dock.className = "platform-mobile-dock";
    dock.setAttribute("aria-label", "Nearer sections");
    dock.innerHTML = `
      <button type="button" data-platform-mode="daily" aria-label="Play today's country">
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg><span>Today</span>
      </button>
      <button type="button" data-platform-mode="random" aria-label="Play a random country">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h3c4 0 5 10 9 10h4"/><path d="m17 14 3 3-3 3M4 17h3c1.5 0 2.6-1.4 3.6-3M14 7c.7 0 1.4-.2 2-.7L20 3"/><path d="m17 3 3 3-3 3"/></svg><span>Random</span>
      </button>
      <a href="mastery/" aria-label="Open Regional Mastery">
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M4.7 9h14.6M4.7 15h14.6M12 4c2.1 2.2 3.2 4.9 3.2 8S14.1 17.8 12 20M12 4c-2.1 2.2-3.2 4.9-3.2 8s1.1 5.8 3.2 8"/></svg><span>Mastery</span><i>New</i>
      </a>
      <a href="together/" aria-label="Open Together games">
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.5"/><path d="M3 20c.4-4 2.1-6 5-6s4.6 2 5 6M13 15c3.7-.7 6.2 1 7 5"/></svg><span>Together</span>
      </a>`;

    dock.querySelectorAll("[data-platform-mode]").forEach(button => {
      button.addEventListener("click", () => activateMode(button.dataset.platformMode));
    });
    document.body.append(dock);
    syncDockState(dock);

    const tabs = document.querySelector(".platform-tabs");
    if (tabs) new MutationObserver(() => syncDockState(dock)).observe(tabs, { attributes: true, subtree: true, attributeFilter: ["class"] });
  }

  function addLaunchpad() {
    const main = document.querySelector("main");
    if (!main || document.querySelector(".platform-launchpad")) return;

    const launchpad = document.createElement("section");
    launchpad.className = "platform-launchpad";
    launchpad.setAttribute("aria-labelledby", "masteryLaunchTitle");
    launchpad.innerHTML = `
      <div class="platform-launch-visual" aria-hidden="true">
        <span class="platform-orbit platform-orbit-one"></span>
        <span class="platform-orbit platform-orbit-two"></span>
        <span class="platform-orbit-core">N</span>
        <i style="--angle:18deg"></i><i style="--angle:78deg"></i><i style="--angle:138deg"></i>
        <i style="--angle:198deg"></i><i style="--angle:258deg"></i><i style="--angle:318deg"></i>
      </div>
      <div class="platform-launch-copy">
        <div class="platform-launch-label"><span>NEW MODE</span><strong>Regional Mastery</strong></div>
        <h2 id="masteryLaunchTitle">Learn the world, not only the answer.</h2>
        <p>Nearer names a country. You place it on the globe, build strength by region and revisit the locations that need another look.</p>
        <div class="platform-launch-features" aria-label="Regional Mastery features">
          <span>6 regions</span><span>Practice + Test</span><span>Smart review</span>
        </div>
      </div>
      <a class="platform-launch-action" href="mastery/"><span>Explore Mastery</span><b aria-hidden="true">→</b></a>`;
    main.prepend(launchpad);
  }

  const query = new URLSearchParams(location.search);
  if (rootPath) {
    addLaunchpad();
    addMobileDock();

    if (query.get("mode") === "random") {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        const button = document.querySelector('.mode-button[data-mode="random"]');
        const ready = Boolean(window.__NEARER_CANVAS_GLOBE_STARTED || window.__NEARER_PREMIUM_GLOBE_STARTED);
        if (button && ready) {
          button.click();
          clearInterval(timer);
        } else if (attempts > 120) clearInterval(timer);
      }, 50);
    }
  }

  window.__NEARER_PLATFORM_STARTED = true;
})();
