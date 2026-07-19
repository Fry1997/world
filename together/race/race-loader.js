(() => {
  "use strict";

  const VERSION = "20260719-platform4";
  const tailFiles = Array.from({ length: 9 }, (_, index) =>
    `chunks/runtime-tail-${String(index + 1).padStart(2, "0")}.js?v=${VERSION}`
  );
  const raceFiles = Array.from({ length: 6 }, (_, index) =>
    `together/race/chunks/race-${String(index + 1).padStart(2, "0")}.js?v=${VERSION}`
  );
  const hdFile = `together/shared/hd-canvas-preflight.js?v=${VERSION}`;
  const styleFiles = ["polish.css", "prestige.css", "experience.css", "experience2.css", "experience3.css", "experience4.css", "experience5.css", "experience6.css", "experience7.css", "experience7-multiplayer.css"].map(file => `together/shared/${file}?v=${VERSION}`);
  const enhancementFiles = [
    hdFile,
    `together/shared/polish-ui.js?v=${VERSION}`,
    `together/shared/experience4.js?v=${VERSION}`,
    `together/shared/experience5.js?v=${VERSION}`,
    `together/shared/experience6.js?v=${VERSION}`,
    `together/shared/experience7.js?v=${VERSION}`
  ];

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
  const preloadScript = source => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "script";
    link.href = source;
    document.head.appendChild(link);
  };

  const fail = error => {
    console.error(error);
    const loading = document.getElementById("raceLoading");
    if (loading) loading.textContent = "Same Target Race could not start. Please reload the page.";
  };

  const start = async () => {
    styleFiles.forEach(loadStyle);
    [...tailFiles, ...raceFiles, ...enhancementFiles].forEach(preloadScript);
    for (const file of tailFiles) await loadScript(file);
    const rawSource = window.NEARER_RUNTIME_SOURCE || "";
    const marker = "const COUNTRY_METADATA =";
    if (!rawSource.includes(marker)) throw new Error("Nearer game data has an unexpected format.");

    const source = rawSource.replace(marker, "window.NEARER_D3 = d3;\nconst COUNTRY_METADATA =");
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
      await import(url);
      if (!window.NEARER_GAME_DATA || !window.NEARER_COUNTRIES_GEOJSON || !window.NEARER_D3) {
        throw new Error("Nearer game data did not initialise.");
      }

      await loadScript(hdFile);
      if (!window.__NEARER_HD_CANVAS_PREFLIGHT) throw new Error("The HD globe canvas layer did not initialise.");

      window.NEARER_RACE_SOURCE = "";
      for (const file of raceFiles) await loadScript(file);
      const raceSource = window.NEARER_RACE_SOURCE || "";
      if (!raceSource.includes("window.__NEARER_RACE_V2_STARTED = true")) {
        throw new Error("Same Target Race source chunks are incomplete.");
      }
      (0, eval)(raceSource);
      if (!window.__NEARER_RACE_V2_STARTED) throw new Error("The race game did not initialise.");
      await loadScript(`together/shared/polish-ui.js?v=${VERSION}`);
      await loadScript(`together/shared/experience4.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE4_STARTED) throw new Error("The compact visual experience layer did not initialise.");
      await loadScript(`together/shared/experience5.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE5_STARTED) throw new Error("The width-normalised visual layer did not initialise.");
      await loadScript(`together/shared/experience6.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE6_STARTED) throw new Error("The elevated visual layer did not initialise.");
      await loadScript(`together/shared/experience7.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE7_STARTED) throw new Error("The final responsive visual layer did not initialise.");
      document.documentElement.classList.add("nearer-runtime-ready");
    } finally {
      URL.revokeObjectURL(url);
      delete window.NEARER_RACE_SOURCE;
    }
  };

  start().catch(fail);
})();
