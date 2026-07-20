import { prepareDetailedGeometry as prepareBaseDetailedGeometry } from './detailed-geometry.js';
import { orientCountryFeatures } from './country-geometry-orientation.js';

export async function prepareDetailedGeometry() {
  const detail = await prepareBaseDetailedGeometry();
  const d3 = window.NEARER_D3;
  const collection = window.NEARER_COUNTRIES_GEOJSON;
  if (!collection?.features?.length || typeof d3?.geoArea !== 'function') return detail;

  const features = orientCountryFeatures(collection.features, d3);
  const windingCorrectionCount = features.filter(feature => feature.properties?.windingCorrected).length;
  window.NEARER_COUNTRIES_GEOJSON = { type: 'FeatureCollection', features };
  window.__NEARER_DETAILED_GEOMETRY = { ...detail, windingCorrectionCount };
  return window.__NEARER_DETAILED_GEOMETRY;
}
