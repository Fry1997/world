(() => {
  "use strict";
  if (window.__NEARER_PLATFORM_STARTED) return;

  const THEME_KEY = "nearer-together-theme";
  const savedTheme = localStorage.getItem(THEME_KEY) || localStorage.getItem("nearer-race-theme");
  if (!document.documentElement.dataset.theme) {
    document.documentElement.dataset.theme = savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }

  const themeButton = document.getElementById("themeButton");
  themeButton?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
  });

  const query = new URLSearchParams(location.search);
  if (location.pathname.endsWith("/world/") || location.pathname.endsWith("/world/index.html")) {
    const requested = query.get("mode");
    if (requested === "random") {
      const activate = () => {
        const button = document.querySelector('.mode-button[data-mode="random"]');
        if (!button) return false;
        button.click();
        return true;
      };
      if (!activate()) {
        let attempts = 0;
        const timer = setInterval(() => {
          attempts += 1;
          if (activate() || attempts > 80) clearInterval(timer);
        }, 50);
      }
    }
  }

  window.__NEARER_PLATFORM_STARTED = true;
})();