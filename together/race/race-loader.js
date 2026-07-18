(() => {
  "use strict";

  const VERSION = "20260718-race2";
  const tailFiles = Array.from({ length: 9 }, (_, index) =>
    `chunks/runtime-tail-${String(index + 1).padStart(2, "0")}.js?v=${VERSION}`
  );

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
    const loading = document.getElementById("raceLoading");
    if (loading) loading.textContent = "Same Target Race could not start. Please reload the page.";
  };

  const start = async () => {
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
      await loadScript(`together/race/race.js?v=${VERSION}`);
      if (!window.__NEARER_RACE_V2_STARTED) throw new Error("The race game did not initialise.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  start().catch(fail);
})();
