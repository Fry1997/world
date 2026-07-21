import { prepareDetailedGeometry as prepareBaseDetailedGeometry } from './detailed-geometry.js';
import { normaliseCountryCollection } from './country-geometry-normalisation.js';

export async function prepareDetailedGeometry() {
  const detail = await prepareBaseDetailedGeometry();
  const d3 = window.NEARER_D3;
  const collection = window.NEARER_COUNTRIES_GEOJSON;
  if (!collection?.features?.length || typeof d3?.geoArea !== 'function') return detail;

  const normalised = normaliseCountryCollection(collection, d3);
  window.NEARER_COUNTRIES_GEOJSON = normalised.collection;
  window.__NEARER_DETAILED_GEOMETRY = {
    ...detail,
    d3WindingNormalised: normalised.correctedCount
  };
  return window.__NEARER_DETAILED_GEOMETRY;
}
