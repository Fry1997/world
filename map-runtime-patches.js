(() => {
  const source = window.NEARER_APP_SOURCE;
  if (!source) return;

  window.NEARER_APP_SOURCE = source
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
})();
