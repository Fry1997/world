(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  body.classList.add("experience-six");
  root.dataset.nearerExperience = "6";

  const applyGlobePalette = () => {
    const dark = root.dataset.theme === "dark";
    const palette = dark ? {
      "--globe-ocean-highlight": "#345b75",
      "--globe-ocean": "#12354e",
      "--globe-ocean-shadow": "#06131f",
      "--globe-land": "#e8e1d4",
      "--globe-border": "rgba(26, 38, 48, .44)",
      "--globe-grid": "rgba(255, 255, 255, .08)",
      "--globe-rim": "rgba(220, 239, 250, .28)"
    } : {
      "--globe-ocean-highlight": "#42667c",
      "--globe-ocean": "#173a52",
      "--globe-ocean-shadow": "#071724",
      "--globe-land": "#e7e2d7",
      "--globe-border": "rgba(20, 31, 39, .42)",
      "--globe-grid": "rgba(255, 255, 255, .09)",
      "--globe-rim": "rgba(241, 248, 252, .36)"
    };

    for (const [name, value] of Object.entries(palette)) root.style.setProperty(name, value);
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  };

  applyGlobePalette();
  new MutationObserver(applyGlobePalette).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  const heading = document.querySelector(".game-heading");
  const help = document.getElementById("helpButton");
  if (heading && help) {
    help.classList.add("heading-help");
    heading.appendChild(help);
  }

  window.__NEARER_EXPERIENCE6_STARTED = true;
})();
