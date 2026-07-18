(() => {
  "use strict";

  const VERSION = "20260718-globe2";
  const appSource = window.NEARER_APP_SOURCE || "";
  const tailFiles = Array.from({ length: 9 }, (_, index) =>
    `chunks/runtime-tail-${String(index + 1).padStart(2, "0")}.js?v=${VERSION}`
  );

  // Prevent the retired flat SVG patch from starting, even if an older cached
  // copy of index.html still contains its script tags.
  window.__NEARER_SVG_PATCH_STARTED = true;

  const showFailure = error => {
    console.error(error);
    const panel = document.querySelector(".map-panel");
    if (panel) {
      panel.innerHTML = `
        <div style="min-height:360px;display:grid;place-items:center;padding:2rem;text-align:center;border:1px solid rgba(196,74,49,.3);border-radius:24px;background:rgba(196,74,49,.08);font-family:system-ui,sans-serif">
          <div>
            <strong style="display:block;font-size:1.1rem;margin-bottom:.5rem">The globe could not start.</strong>
            <span style="color:#6b7280">Please reload the page. The retired flat map will not be shown as a substitute.</span>
          </div>
        </div>`;
      return;
    }
    document.body.innerHTML = "<p style=\"padding:2rem;font-family:system-ui\">The game could not load. Please refresh and check your connection.</p>";
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
      await loadScript(`globe.js?v=${VERSION}`);

      if (!window.__NEARER_REAL_GLOBE_STARTED || !document.getElementById("globeStage")) {
        throw new Error("The 3D globe script loaded but did not initialise.");
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  start().catch(showFailure);
})();
