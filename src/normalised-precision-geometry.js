import { preparePrecisionGeometry as prepareBasePrecisionGeometry } from './precision-geometry.js';
import { normaliseCountryCollection } from './country-geometry-normalisation.js';

export async function preparePrecisionGeometry() {
  const detail = await prepareBasePrecisionGeometry();
  const d3 = window.NEARER_D3;
  const collection = window.NEARER_COUNTRIES_GEOJSON;
  if (!collection?.features?.length || typeof d3?.geoArea !== 'function') return detail;

  const normalised = normaliseCountryCollection(collection, d3);
  const nextDetail = { ...detail, d3WindingNormalised: normalised.correctedCount };
  window.NEARER_COUNTRIES_GEOJSON = normalised.collection;
  window.__NEARER_PRECISION_GEOMETRY = nextDetail;
  window.__NEARER_DETAILED_GEOMETRY = nextDetail;
  window.__NEARER_MASTERY_DETAILED_GEOMETRY = nextDetail;
  return nextDetail;
}
