(() => {
  "use strict";
  const VERSION = "20260719-mastery1";
  const tailFiles = Array.from({ length: 9 }, (_, index) => `chunks/runtime-tail-${String(index + 1).padStart(2, "0")}.js?v=${VERSION}`);

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
    if (loading) loading.innerHTML = "<strong>Regional Mastery could not start.</strong><span>Please reload the page.</span>";
  };

  const start = async () => {
    for (const file of tailFiles) await loadScript(file);
    const rawSource = window.NEARER_RUNTIME_SOURCE || "";
    const marker = "const COUNTRY_METADATA =";
    if (!rawSource.includes(marker)) throw new Error("Nearer country data has an unexpected format.");
    const source = rawSource.replace(marker, "window.NEARER_D3 = d3;\nconst COUNTRY_METADATA =");
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
      await import(url);
      if (!window.NEARER_GAME_DATA || !window.NEARER_COUNTRIES_GEOJSON || !window.NEARER_D3) {
        throw new Error("Nearer country data did not initialise.");
      }
      await loadScript(`learn/regional-projection.js?v=${VERSION}`);
      if (!window.__NEARER_REGIONAL_PROJECTION_STARTED) throw new Error("Regional map framing did not initialise.");
      await loadScript(`learn/learn.js?v=${VERSION}`);
      if (!window.__NEARER_MASTERY_STARTED) throw new Error("Regional Mastery did not initialise.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  start().catch(fail);
})();
