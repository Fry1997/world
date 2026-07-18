(() => {
  let appSource = window.NEARER_APP_SOURCE || "";
  const tailFiles = Array.from({ length: 9 }, (_, index) =>
    `chunks/runtime-tail-${String(index + 1).padStart(2, "0")}.js`
  );
  const patchAppSource = source => source
    .replaceAll(
      'filter: ["==", ["geometry-type"], "Polygon"],',
      'filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],'
    )
    .replace(
      '"circle-opacity": ["case", ["get", "guessed"], 0.95, 0.72],',
      '"circle-opacity": ["case", ["get", "guessed"], 0.95, ["get", "answer"], 0.95, 0],'
    )
    .replace(
      'pmtilesProtocol = new pmtilesLib.Protocol();\n        maplibreLib.addProtocol("pmtiles", pmtilesProtocol.tile);',
      'pmtilesProtocol = new pmtilesLib.Protocol();\n        if (pmtilesLib.PMTiles) pmtilesProtocol.add(new pmtilesLib.PMTiles(PMTILES_URL));\n        maplibreLib.addProtocol("pmtiles", pmtilesProtocol.tile);'
    )
    .replace(
      'center: WORLD_VIEW.center,\n        zoom: window.innerWidth < 680 ? 0.75 : WORLD_VIEW.zoom,',
      'center: WORLD_VIEW.center,\n        zoom: window.innerWidth < 680 ? 0.9 : 1.35,\n        projection: { type: "globe" },'
    )
    .replace(
      'map.on("load", addGameMapLayers);',
      'map.on("load", () => {\n        map.resize();\n        if (typeof map.setFog === "function") map.setFog({ color: preferences.theme === "dark" ? "#10171c" : "#e8ebe8", "horizon-blend": 0.08 });\n        addGameMapLayers();\n        window.setTimeout(() => map.resize(), 100);\n      });'
    );
  const fail = error => {
    console.error(error);
    document.body.innerHTML = "<p style=\"padding:2rem;font-family:system-ui\">The game could not load. Please refresh and check your connection.</p>";
  };
  const loadScript = source => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = source;
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = () => reject(new Error(`Could not load ${source}`));
    document.head.appendChild(script);
  });
  const start = async () => {
    for (const file of tailFiles) await loadScript(file);
    const source = window.NEARER_RUNTIME_SOURCE || "";
    appSource = patchAppSource(appSource);
    if (!source || !appSource) throw new Error("Nearer source chunks are missing.");
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
      await import(url);
      (0, eval)(appSource);
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  start().catch(fail);
})();
