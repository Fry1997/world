import detailedWorldUrl from "world-atlas/countries-50m.json?url";
import "./mastery-detailed-geometry.css";

const normalise = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

let detailPromise = null;

function namesFor(country) {
  return [country.name, ...(country.aliases || [])].map(normalise).filter(Boolean);
}

export async function prepareDetailedMasteryGeometry() {
  if (window.__NEARER_MASTERY_DETAILED_GEOMETRY) return;

  detailPromise ||= (async () => {
    const gameData = window.NEARER_GAME_DATA;
    const existing = window.NEARER_COUNTRIES_GEOJSON;
    const topoFeature = window.NEARER_TOPO_FEATURE;
    if (!gameData || !existing || typeof topoFeature !== "function") {
      throw new Error("Detailed Regional Mastery geometry requires the Nearer geography runtime.");
    }

    const response = await fetch(detailedWorldUrl, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Could not load detailed country geometry (${response.status}).`);
    const topology = await response.json();
    const sourceFeatures = topoFeature(topology, topology.objects.countries).features;
    const sourceByNumeric = new Map();
    const sourceByName = new Map();

    for (const feature of sourceFeatures) {
      if (feature.id !== undefined && feature.id !== null && feature.id !== "") {
        sourceByNumeric.set(String(feature.id).padStart(3, "0"), feature);
      }
      const sourceName = normalise(feature.properties?.name);
      if (sourceName) sourceByName.set(sourceName, feature);
    }

    const existingByCode = new Map(existing.features.map(feature => [feature.properties.code, feature]));
    let detailedCount = 0;
    let pointFallbackCount = 0;

    const features = gameData.countries.map(country => {
      let source = country.numeric
        ? sourceByNumeric.get(String(country.numeric).padStart(3, "0"))
        : null;

      if (!source) {
        for (const name of namesFor(country)) {
          source = sourceByName.get(name);
          if (source) break;
        }
      }

      const previous = existingByCode.get(country.code);
      const geometry = source?.geometry || previous?.geometry || { type: "Point", coordinates: country.fallback };
      const approximate = geometry.type === "Point";
      if (approximate) pointFallbackCount += 1;
      else detailedCount += 1;

      return {
        type: "Feature",
        properties: {
          code: country.code,
          name: country.name,
          continent: country.continent,
          approximate,
          detailScale: source ? "detailed" : previous?.properties?.detailScale || "fallback"
        },
        geometry
      };
    });

    window.NEARER_COUNTRIES_GEOJSON = { type: "FeatureCollection", features };
    window.__NEARER_MASTERY_DETAILED_GEOMETRY = {
      source: "world-atlas countries-50m",
      detailedCount,
      pointFallbackCount
    };
  })();

  await detailPromise;
}

export function installDetailedMasteryControls() {
  const stage = document.getElementById("masteryGlobeStage");
  const hint = stage?.querySelector(".mastery-globe-hint");
  const zoomIn = document.getElementById("masteryZoomIn");
  const zoomOut = document.getElementById("masteryZoomOut");
  if (!stage || !zoomIn || !zoomOut) return;

  stage.dataset.detailedGeometry = "true";
  if (hint) hint.textContent = "Drag to move · pinch or use + to zoom right in · tap the exact country";
  zoomIn.title = "Zoom further into the map";
  zoomOut.title = "Zoom out";

  const badge = document.createElement("div");
  badge.className = "mastery-map-detail-badge";
  badge.setAttribute("aria-hidden", "true");
  badge.innerHTML = "<span>Detailed borders</span><small>Deep zoom</small>";
  stage.append(badge);
}
