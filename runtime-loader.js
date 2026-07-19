(() => {
  "use strict";

  const VERSION = "20260719-platform4";
  const appSource = window.NEARER_APP_SOURCE || "";
  const tailFiles = Array.from({ length: 9 }, (_, index) =>
    `chunks/runtime-tail-${String(index + 1).padStart(2, "0")}.js?v=${VERSION}`
  );
  const enhancementFiles = [
    `together/shared/premium-globe-v2.js?v=${VERSION}`,
    `guess-rules.js?v=${VERSION}`,
    `together/shared/experience4.js?v=${VERSION}`,
    `together/shared/experience5.js?v=${VERSION}`,
    `together/shared/experience6.js?v=${VERSION}`,
    `together/shared/experience7.js?v=${VERSION}`,
    `guessed-country-info.js?v=${VERSION}`,
    `together/shared/experience8.js?v=${VERSION}`,
    `together/shared/experience9.js?v=${VERSION}`,
    `together/shared/experience10.js?v=${VERSION}`
  ];

  window.__NEARER_SVG_PATCH_STARTED = true;

  const showFailure = error => {
    console.error(error);
    const panel = document.querySelector(".map-panel");
    if (panel) {
      panel.innerHTML = `
        <div style="min-height:360px;display:grid;place-items:center;padding:2rem;text-align:center;border:1px solid rgba(196,74,49,.3);border-radius:24px;background:rgba(196,74,49,.08);font-family:system-ui,sans-serif">
          <div>
            <strong style="display:block;font-size:1.1rem;margin-bottom:.5rem">The globe could not start.</strong>
            <span style="color:#6b7280">Please reload the page.</span>
          </div>
        </div>`;
      return;
    }
    document.body.innerHTML = "<p style=\"padding:2rem;font-family:system-ui\">The game could not load. Please refresh and check your connection.</p>";
  };

  const preloadScript = source => {
    if (document.querySelector(`link[rel="preload"][href="${source}"]`)) return;
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
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = () => reject(new Error(`Could not load ${source}`));
    document.head.appendChild(script);
  });

  const start = async () => {
    [...tailFiles, ...enhancementFiles].forEach(preloadScript);
    for (const file of tailFiles) await loadScript(file);

    const rawSource = window.NEARER_RUNTIME_SOURCE || "";
    if (!rawSource || !appSource) throw new Error("Nearer source chunks are missing.");

    const marker = "const COUNTRY_METADATA =";
    if (!rawSource.includes(marker)) throw new Error("Nearer runtime has an unexpected format.");

    const source = rawSource.replace(
      marker,
      "window.NEARER_D3 = d3;\nwindow.NEARER_TOPO_FEATURE = topoFeature;\nwindow.NEARER_WORLD_TOPOLOGY = world;\nconst COUNTRY_METADATA ="
    );

    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
      await import(url);
      const safeAppSource = appSource.replace("initializeMap();", "");
      (0, eval)(safeAppSource);

      const importedD3 = window.NEARER_D3;
      const originalOrthographic = importedD3?.geoOrthographic;
      if (typeof originalOrthographic !== "function") {
        throw new Error("The globe projection factory is unavailable.");
      }

      window.NEARER_D3 = {
        ...importedD3,
        geoOrthographic: (...args) => {
          const projection = originalOrthographic(...args);
          window.__NEARER_GLOBE_PROJECTION = projection;
          return projection;
        }
      };

      await loadScript(`together/shared/premium-globe-v2.js?v=${VERSION}`);
      if (!window.__NEARER_PREMIUM_GLOBE_V2_STARTED || !document.getElementById("globeCanvas")) {
        throw new Error("The adaptive globe renderer did not initialise.");
      }

      await loadScript(`guess-rules.js?v=${VERSION}`);
      if (!document.querySelector("style[data-nearer-guess-rules]")) {
        throw new Error("The name-only guessing rules did not initialise.");
      }

      await loadScript(`together/shared/experience4.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE4_STARTED) throw new Error("The compact visual experience layer did not initialise.");
      await loadScript(`together/shared/experience5.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE5_STARTED) throw new Error("The width-normalised visual layer did not initialise.");
      await loadScript(`together/shared/experience6.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE6_STARTED) throw new Error("The elevated visual layer did not initialise.");
      await loadScript(`together/shared/experience7.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE7_STARTED) throw new Error("The final responsive visual layer did not initialise.");

      await loadScript(`guessed-country-info.js?v=${VERSION}`);
      if (!window.__NEARER_GUESSED_COUNTRY_INFO_STARTED) {
        throw new Error("Guessed-country identification did not initialise.");
      }

      await loadScript(`together/shared/experience8.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE8_STARTED) throw new Error("The contrast refinement layer did not initialise.");
      await loadScript(`together/shared/experience9.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE9_STARTED) throw new Error("The globe overlay correction layer did not initialise.");
      await loadScript(`together/shared/experience10.js?v=${VERSION}`);
      if (!window.__NEARER_EXPERIENCE10_STARTED) throw new Error("The final stabilisation layer did not initialise.");

      document.documentElement.classList.add("nearer-runtime-ready");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  start().catch(showFailure);
})();
