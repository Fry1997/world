(() => {
  "use strict";
  if (window.__NEARER_PLATFORM_STARTED) return;

  const rootPath = location.pathname.endsWith("/world/") || location.pathname.endsWith("/world/index.html");
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

  const query = new URLSearchParams(location.search);
  if (rootPath && query.get("mode") === "random") {
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

  window.__NEARER_PLATFORM_STARTED = true;
})();