(() => {
  "use strict";
  const VERSION = "20260719-platform4";
  const tailFiles = Array.from({ length: 9 }, (_, index) => `chunks/runtime-tail-${String(index + 1).padStart(2, "0")}.js?v=${VERSION}`);
  const masteryFile = `mastery/mastery.js?v=${VERSION}`;

  const preloadScript = source => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "script";
    link.href = source;
    document.head.appendChild(link);
  };

  const loadScript = source => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = source;
    script.async = false;
    script.onload = () => { script.remove(); resolve(); };
    script.onerror = () => reject(new Error(`Could not load ${source}`));
    document.head.appendChild(script);
  });

  const fail = error => {
    console.error(error);
    const loading = document.getElementById("masteryLoading");
    if (loading) loading.textContent = "Regional Mastery could not start. Please reload the page.";
  };

  const start = async () => {
    [...tailFiles, masteryFile].forEach(preloadScript);
    for (const file of tailFiles) await loadScript(file);
    const rawSource = window.NEARER_RUNTIME_SOURCE || "";
    const marker = "const COUNTRY_METADATA =";
    if (!rawSource.includes(marker)) throw new Error("Nearer game data has an unexpected format.");
    const source = rawSource.replace(
      marker,
      "window.NEARER_D3 = d3;\nwindow.NEARER_TOPO_FEATURE = topoFeature;\nwindow.NEARER_WORLD_TOPOLOGY = world;\nconst COUNTRY_METADATA ="
    );
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
      await import(url);
      if (!window.NEARER_GAME_DATA || !window.NEARER_COUNTRIES_GEOJSON || !window.NEARER_D3) {
        throw new Error("Regional Mastery data did not initialise.");
      }
      await loadScript(masteryFile);
      if (!window.__NEARER_MASTERY_STARTED) throw new Error("Regional Mastery did not initialise.");
      document.documentElement.classList.add("nearer-runtime-ready");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  start().catch(fail);
})();
