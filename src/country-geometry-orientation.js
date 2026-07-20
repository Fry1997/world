const HEMISPHERE_AREA = Math.PI * 2;

function reverseRing(ring) {
  return Array.isArray(ring) ? [...ring].reverse() : ring;
}

function reverseGeometry(geometry) {
  if (!geometry) return geometry;
  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(reverseRing)
    };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(polygon => polygon.map(reverseRing))
    };
  }
  return geometry;
}

export function orientCountryFeature(feature, d3) {
  if (!feature?.geometry || feature.geometry.type === 'Point' || typeof d3?.geoArea !== 'function') {
    return feature;
  }

  const area = d3.geoArea(feature);
  if (!Number.isFinite(area) || area <= HEMISPHERE_AREA) return feature;

  const corrected = {
    ...feature,
    properties: {
      ...feature.properties,
      windingCorrected: true
    },
    geometry: reverseGeometry(feature.geometry)
  };

  return d3.geoArea(corrected) < area ? corrected : feature;
}

export function orientCountryFeatures(features, d3) {
  return features.map(feature => orientCountryFeature(feature, d3));
}
