import precisionCollection from "./generated/precision-countries.json";

const criticalMicrostates = ["VAT", "MCO", "SMR", "LIE", "AND", "LUX"];
let precisionPromise = null;

export async function preparePrecisionGeometry() {
  if (window.__NEARER_PRECISION_GEOMETRY) return window.__NEARER_PRECISION_GEOMETRY;

  precisionPromise ||= Promise.resolve().then(() => {
    const existing = window.NEARER_COUNTRIES_GEOJSON;
    const gameData = window.NEARER_GAME_DATA;
    if (!existing?.features?.length || !gameData?.countries?.length) {
      throw new Error("Precision country geometry requires the Nearer geography runtime.");
    }

    const precisionByCode = new Map(
      (precisionCollection.features || []).map(feature => [feature.properties.code, feature])
    );
    const areaByCode = new Map(
      gameData.countries.map(country => [country.code, Number(country.area || 0)])
    );
    let precisionCount = 0;
    let detailedCount = 0;
    let pointFallbackCount = 0;

    const features = existing.features.map(previous => {
      const precision = precisionByCode.get(previous.properties.code);
      const feature = precision
        ? {
            type: "Feature",
            properties: {
              ...previous.properties,
              ...precision.properties,
              approximate: false,
              detailScale: "10m"
            },
            geometry: precision.geometry
          }
        : previous;

      if (precision) precisionCount += 1;
      if (feature.geometry.type === "Point") pointFallbackCount += 1;
      else detailedCount += 1;
      return feature;
    }).sort((a, b) => {
      const areaA = areaByCode.get(a.properties.code) || Number.POSITIVE_INFINITY;
      const areaB = areaByCode.get(b.properties.code) || Number.POSITIVE_INFINITY;
      return areaA - areaB;
    });

    const featureByCode = new Map(features.map(feature => [feature.properties.code, feature]));
    const unresolvedMicrostates = criticalMicrostates.filter(
      code => featureByCode.get(code)?.geometry.type === "Point"
    );
    const detail = {
      source: "Natural Earth 1:50m base with a compact 1:10m precision layer",
      detailedCount,
      precisionCount,
      pointFallbackCount,
      unresolvedMicrostates,
      runtimeBytes: JSON.stringify(precisionCollection).length
    };

    window.NEARER_COUNTRIES_GEOJSON = { type: "FeatureCollection", features };
    window.__NEARER_PRECISION_GEOMETRY = detail;
    window.__NEARER_DETAILED_GEOMETRY = detail;
    window.__NEARER_MASTERY_DETAILED_GEOMETRY = detail;
    return detail;
  });

  return precisionPromise;
}
