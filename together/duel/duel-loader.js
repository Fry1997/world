(() => {
  "use strict";
  const VERSION = "20260719-experience10";
  const tailFiles = Array.from({ length: 9 }, (_, index) => `chunks/runtime-tail-${String(index + 1).padStart(2, "0")}.js?v=${VERSION}`);
  const loadScript = source => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = source;
    script.async = false;
    script.onload = () => { script.remove(); resolve(); };
    script.onerror = () => reject(new Error(`Could not load ${source}`));
    document.head.appendChild(script);
  });
  const loadStyle = source => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = source;
    document.head.appendChild(link);
  };
  const fail = error => {
    console.error(error);
    const loading = document.getElementById("modeLoading");
    if (loading) loading.textContent = "Hidden Country Duel could not start. Please reload the page.";
  };
  const start = async () => {
    loadStyle(`together/shared/polish.css?v=${VERSION}`);
    loadStyle(`together/shared/prestige.css?v=${VERSION}`);
    loadStyle(`together/shared/experience.css?v=${VERSION}`);
    loadStyle(`together/shared/experience2.css?v=${VERSION}`);
    loadStyle(`together/shared/experience3.css?v=${VERSION}`);
    loadStyle(`together/shared/experience4.css?v=${VERSION}`);
    loadStyle(`together/shared/experience5.css?v=${VERSION}`);
    loadStyle(`together/shared/experience6.css?v=${VERSION}`);
    loadStyle(`together/shared/experience7.css?v=${VERSION}`);
    loadStyle(`together/shared/experience7-multiplayer.css?v=${VERSION}`);
    loadStyle(`together/shared/experience8.css?v=${VERSION}`);
    loadStyle(`together/shared/experience9.css?v=${VERSION}`);
    loadStyle(`together/shared/experience10.css?v=${VERSION}`);
    for (const file of tailFiles) await loadScript(file);
    const rawSource = window.NEARER_RUNTIME_SOURCE || "";
    const marker = "const COUNTRY_METADATA =";
    if (!rawSource.includes(marker)) throw new Error("Nearer game data has an unexpected format.");
    const source = rawSource.replace(marker, "window.NEARER_D3 = d3;\nconst COUNTRY_METADATA =");
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
      await import(url);
      if (!window.NEARER_GAME_DATA || !window.NEARER_COUNTRIES_GEOJSON || !window.NEARER_D3) throw new Error("Nearer game data did not initialise.");
      await loadScript(`together/shared/hd-canvas-preflight.js?v=${VERSION}`);
      if (!window.__NEARER_HD_CANVAS_PREFLIGHT) throw new Error("The HD globe canvas layer did not initialise.");
      await loadScript(`together/shared/together-core.js?v=${VERSION}`);
      if (!window.NEARER_TOGETHER_CORE) throw new Error("Together core did not initialise.");
      await loadScript(`together/duel/duel.js?v=${VERSION}`);
      if (!window.__NEARER_DUEL_STARTED) throw new Error("Hidden Country Duel did not initialise.");
      await loadScript(`together/shared/polish-ui.js?v=${VERSION}`);
      await loadScript(`together/duel/duel-pressure.js?v=${VERSION}`);
      await loadScript(`together/shared/experience4.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE4_STARTED) throw new Error("The compact visual experience layer did not initialise.");
      await loadScript(`together/shared/experience5.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE5_STARTED) throw new Error("The width-normalised visual layer did not initialise.");
      await loadScript(`together/shared/experience6.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE6_STARTED) throw new Error("The elevated visual layer did not initialise.");
      await loadScript(`together/shared/experience7.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE7_STARTED) throw new Error("The final responsive visual layer did not initialise.");
      await loadScript(`together/shared/premium-globe.js?v=${VERSION}`);
      if (!window.__NEARER_PREMIUM_GLOBE_STARTED) throw new Error("The dimensional globe renderer did not initialise.");
      await loadScript(`together/shared/experience8.js?v=${VERSION}`);
      await loadScript(`together/shared/experience9.js?v=${VERSION}`);
      await loadScript(`together/shared/experience10.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE10_STARTED) throw new Error("The final stabilisation layer did not initialise.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  start().catch(fail);
})();
