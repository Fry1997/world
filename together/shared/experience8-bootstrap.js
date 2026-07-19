(() => {
  "use strict";
  if (window.__NEARER_EXPERIENCE8_BOOTSTRAP) return;
  window.__NEARER_EXPERIENCE8_BOOTSTRAP = true;
  const VERSION = "20260719-experience8";
  const load = source => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = source;
    script.async = false;
    script.onload = () => { script.remove(); resolve(); };
    script.onerror = () => reject(new Error(`Could not load ${source}`));
    document.head.appendChild(script);
  });
  let attempts = 0;
  const start = async () => {
    attempts += 1;
    if (!window.NEARER_GAME_DATA || !window.NEARER_COUNTRIES_GEOJSON || !window.NEARER_D3 || !document.querySelector("canvas.globe-canvas")) {
      if (attempts < 120) setTimeout(start, 50);
      return;
    }
    await load(`together/shared/premium-globe.js?v=${VERSION}`);
    await load(`together/shared/experience8.js?v=${VERSION}`);
  };
  start().catch(console.error);
})();
