(() => {
  "use strict";

  if (window.__NEARER_EXPERIENCE7_STARTED) return;

  const root = document.documentElement;
  const body = document.body;
  body.classList.add("experience-seven");
  root.dataset.nearerExperience = "7";

  const isiPhone = /iPhone|iPod/.test(navigator.userAgent) || (
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1 && matchMedia("(max-width: 820px)").matches
  );
  body.classList.toggle("is-iphone", isiPhone);

  if (!document.querySelector(".nearer-safe-area-shield")) {
    const shield = document.createElement("div");
    shield.className = "nearer-safe-area-shield";
    shield.setAttribute("aria-hidden", "true");
    document.body.prepend(shield);
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const themeButton = document.getElementById("themeButton");

  const moon = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.4 15.6A8.5 8.5 0 0 1 8.4 3.6 8.5 8.5 0 1 0 20.4 15.6Z"/></svg>';
  const sun = '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>';

  const syncThemeChrome = () => {
    const dark = root.dataset.theme === "dark";
    if (themeMeta) themeMeta.content = dark ? "#07111b" : "#102535";
    if (themeButton) {
      themeButton.innerHTML = dark ? sun : moon;
      themeButton.setAttribute("aria-label", dark ? "Use light appearance" : "Use dark appearance");
    }
  };

  syncThemeChrome();
  new MutationObserver(syncThemeChrome).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  const setViewportHeight = () => {
    const height = window.visualViewport?.height || window.innerHeight;
    root.style.setProperty("--nearer-viewport-height", `${Math.round(height)}px`);
  };
  setViewportHeight();
  window.visualViewport?.addEventListener("resize", setViewportHeight, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(setViewportHeight, 120), { passive: true });

  window.__NEARER_EXPERIENCE7_STARTED = true;
})();
