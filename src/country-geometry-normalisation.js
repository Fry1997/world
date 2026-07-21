const HEMISPHERE_AREA = Math.PI * 2;

function reversePolygonCoordinates(coordinates) {
  return coordinates.map(ring => [...ring].reverse());
}

function polygonNeedsReversing(coordinates, d3) {
  const polygon = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } };
  return d3.geoArea(polygon) > HEMISPHERE_AREA;
}

export function normaliseCountryFeature(feature, d3) {
  if (!feature?.geometry || feature.geometry.type === 'Point' || typeof d3?.geoArea !== 'function') {
    return feature;
  }

  let geometry = feature.geometry;
  let corrected = false;

  if (geometry.type === 'Polygon' && polygonNeedsReversing(geometry.coordinates, d3)) {
    geometry = { ...geometry, coordinates: reversePolygonCoordinates(geometry.coordinates) };
    corrected = true;
  }

  if (geometry.type === 'MultiPolygon') {
    const coordinates = geometry.coordinates.map(polygon => {
      if (!polygonNeedsReversing(polygon, d3)) return polygon;
      corrected = true;
      return reversePolygonCoordinates(polygon);
    });
    if (corrected) geometry = { ...geometry, coordinates };
  }

  if (!corrected) return feature;
  return {
    ...feature,
    properties: { ...feature.properties, d3WindingNormalised: true },
    geometry
  };
}

export function normaliseCountryCollection(collection, d3) {
  const features = collection.features.map(feature => normaliseCountryFeature(feature, d3));
  return {
    collection: { type: 'FeatureCollection', features },
    correctedCount: features.filter(feature => feature.properties?.d3WindingNormalised).length
  };
}
