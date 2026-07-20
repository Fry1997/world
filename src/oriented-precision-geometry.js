import { preparePrecisionGeometry as prepareBasePrecisionGeometry } from './precision-geometry.js';
import { orientCountryFeatures } from './country-geometry-orientation.js';

export async function preparePrecisionGeometry() {
  const detail = await prepareBasePrecisionGeometry();
  const d3 = window.NEARER_D3;
  const collection = window.NEARER_COUNTRIES_GEOJSON;
  if (!collection?.features?.length || typeof d3?.geoArea !== 'function') return detail;

  const features = orientCountryFeatures(collection.features, d3);
  const windingCorrectionCount = features.filter(feature => feature.properties?.windingCorrected).length;
  const nextDetail = { ...detail, windingCorrectionCount };
  window.NEARER_COUNTRIES_GEOJSON = { type: 'FeatureCollection', features };
  window.__NEARER_PRECISION_GEOMETRY = nextDetail;
  window.__NEARER_DETAILED_GEOMETRY = nextDetail;
  window.__NEARER_MASTERY_DETAILED_GEOMETRY = nextDetail;
  return nextDetail;
}
