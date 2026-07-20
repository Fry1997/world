import precisionWorldUrl from "./generated/small-country-precision.geojson?url";

const criticalMicrostates = ["VAT", "MCO", "SMR", "LIE", "AND", "LUX", "MNE"];
let precisionPromise = null;

export async function preparePrecisionGeometry() {
  if (window.__NEARER_PRECISION_GEOMETRY) return window.__NEARER_PRECISION_GEOMETRY;

  precisionPromise ||= (async () => {
    const gameData = window.NEARER_GAME_DATA;
    const existing = window.NEARER_COUNTRIES_GEOJSON;
    if (!gameData || !existing) {
      throw new Error("Precision country geometry requires the Nearer geography runtime.");
    }

    const response = await fetch(precisionWorldUrl, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Could not load compact precision geometry (${response.status}).`);
    const precisionCollection = await response.json();
    const precisionByCode = new Map(
      (precisionCollection.features || []).map(feature => [feature.properties.code, feature])
    );
    const existingByCode = new Map(existing.features.map(feature => [feature.properties.code, feature]));
    let detailedCount = 0;
    let pointFallbackCount = 0;
    let precisionCount = 0;

    const features = gameData.countries.map(country => {
      const precision = precisionByCode.get(country.code);
      const previous = existingByCode.get(country.code);
      const geometry = precision?.geometry || previous?.geometry || { type: "Point", coordinates: country.fallback };
      const approximate = geometry.type === "Point";
      if (precision?.geometry) precisionCount += 1;
      if (approximate) pointFallbackCount += 1;
      else detailedCount += 1;

      return {
        type: "Feature",
        properties: {
          code: country.code,
          name: country.name,
          continent: country.continent,
          approximate,
          detailScale: precision ? "10m" : previous?.properties?.detailScale || "50m"
        },
        geometry
      };
    });

    const featureByCode = new Map(features.map(feature => [feature.properties.code, feature]));
    const unresolvedMicrostates = criticalMicrostates.filter(code => featureByCode.get(code)?.geometry.type === "Point");
    const detail = {
      source: "Natural Earth 1:10m small-country overlay on the 1:50m world",
      detailedCount,
      precisionCount,
      pointFallbackCount,
      unresolvedMicrostates
    };

    window.NEARER_COUNTRIES_GEOJSON = { type: "FeatureCollection", features };
    window.__NEARER_PRECISION_GEOMETRY = detail;
    window.__NEARER_DETAILED_GEOMETRY = detail;
    window.__NEARER_MASTERY_DETAILED_GEOMETRY = detail;
    return detail;
  })();

  return precisionPromise;
}
