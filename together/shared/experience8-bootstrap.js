(() => {
  "use strict";
  if (window.__NEARER_EXPERIENCE8_BOOTSTRAP) return;
  window.__NEARER_EXPERIENCE8_BOOTSTRAP = true;

  const VERSION = "20260719-platform4";
  const load = source => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = source;
    script.async = false;
    script.onload = () => { script.remove(); resolve(); };
    script.onerror = () => reject(new Error(`Could not load ${source}`));
    document.head.appendChild(script);
  });
  const loadStyle = source => {
    if (Array.from(document.styleSheets).some(sheet => sheet.href?.includes(source.split("?")[0]))) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = source;
    link.dataset.nearerExperience8Final = "true";
    document.head.appendChild(link);
  };

  loadStyle(`platform.css?v=${VERSION}`);
  loadStyle(`performance.css?v=${VERSION}`);
  if (!window.__NEARER_PLATFORM_STARTED) load(`platform.js?v=${VERSION}`).catch(console.error);

  let attempts = 0;
  const start = async () => {
    attempts += 1;
    if (!window.NEARER_GAME_DATA || !window.NEARER_COUNTRIES_GEOJSON || !window.NEARER_D3 || !document.querySelector("canvas.globe-canvas")) {
      if (attempts < 120) setTimeout(start, 50);
      return;
    }

    loadStyle(`together/shared/experience8.css?v=${VERSION}`);
    loadStyle(`together/shared/experience9.css?v=${VERSION}`);
    loadStyle(`together/shared/experience10.css?v=${VERSION}`);

    if (!window.__NEARER_PREMIUM_GLOBE_V2_STARTED) {
      await load(`together/shared/premium-globe-v2.js?v=${VERSION}`);
    }
    if (!window.__NEARER_EXPERIENCE8_STARTED) {
      await load(`together/shared/experience8.js?v=${VERSION}`);
    }
    if (!window.__NEARER_EXPERIENCE9_STARTED) {
      await load(`together/shared/experience9.js?v=${VERSION}`);
    }
    if (!window.__NEARER_EXPERIENCE10_STARTED) {
      await load(`together/shared/experience10.js?v=${VERSION}`);
    }
  };

  start().catch(console.error);
})();
