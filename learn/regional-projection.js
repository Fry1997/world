(() => {
  "use strict";
  if (window.__NEARER_REGIONAL_PROJECTION_STARTED) return;

  const baseD3 = window.NEARER_D3;
  const gameData = window.NEARER_GAME_DATA;
  if (!baseD3 || !gameData || typeof baseD3.geoNaturalEarth1 !== "function") return;

  const countryByCode = new Map(gameData.countries.map(country => [country.code, country]));
  const views = {
    Europe: { rotate: [-15, -54, 0], points: [[-25, 34], [45, 73]] },
    Africa: { rotate: [-20, 0, 0], points: [[-28, -40], [65, 40]] },
    Asia: { rotate: [-95, -38, 0], points: [[25, -12], [150, 82]] },
    "North America": { rotate: [105, -45, 0], points: [[-175, 5], [-50, 85]] },
    "South America": { rotate: [60, 20, 0], points: [[-90, -60], [-30, 16]] },
    Oceania: { rotate: [-160, 15, 0], points: [[100, -50], [-130, 20]] }
  };

  function regionFor(object) {
    if (object?.type !== "FeatureCollection" || !object.features?.length) return null;
    const regions = new Set(
      object.features
        .map(feature => countryByCode.get(feature.properties?.code)?.continent)
        .filter(Boolean)
    );
    return regions.size === 1 ? [...regions][0] : null;
  }

  function regionalProjection() {
    const projection = baseD3.geoNaturalEarth1();
    const fitExtent = projection.fitExtent.bind(projection);
    projection.fitExtent = (extent, object) => {
      const region = regionFor(object);
      const view = views[region];
      if (!view) return fitExtent(extent, object);
      projection.rotate(view.rotate);
      fitExtent(extent, { type: "MultiPoint", coordinates: view.points });
      return projection;
    };
    return projection;
  }

  window.NEARER_D3 = { ...baseD3, geoNaturalEarth1: regionalProjection };
  window.__NEARER_REGIONAL_PROJECTION_STARTED = true;
})();
