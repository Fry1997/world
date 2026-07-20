const ATLAS_KEY = 'nearer-atlas-v1';
const MASTERY_KEY = 'nearer-mastery-v1';

export const normalise = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

export function readAtlasState() {
  try {
    const value = JSON.parse(localStorage.getItem(ATLAS_KEY) || 'null') || {};
    return {
      version: 1,
      favourites: Array.isArray(value.favourites) ? value.favourites : [],
      recent: Array.isArray(value.recent) ? value.recent : []
    };
  } catch {
    return { version: 1, favourites: [], recent: [] };
  }
}

export function writeAtlasState(state) {
  localStorage.setItem(ATLAS_KEY, JSON.stringify({
    version: 1,
    favourites: [...new Set(state.favourites)].slice(0, 60),
    recent: [...new Set(state.recent)].slice(0, 20)
  }));
}

export function readMasteryState() {
  try { return JSON.parse(localStorage.getItem(MASTERY_KEY) || 'null') || {}; }
  catch { return {}; }
}

export function masteryStrength(record = {}) {
  const seen = record.correct || 0;
  const first = record.firstCorrect || 0;
  const misses = record.misses || 0;
  return Math.max(0, Math.min(100, Math.round(first * 34 + Math.max(0, seen - first) * 18 - misses * 7)));
}

export function formatArea(area) {
  const value = Number(area) || 0;
  if (value < 1) return '<1 km²';
  return `${Math.round(value).toLocaleString()} km²`;
}

export function sizeBand(area) {
  const value = Number(area) || 0;
  if (value < 1_000) return 'Microstate';
  if (value < 10_000) return 'Very small country';
  if (value < 100_000) return 'Small country';
  if (value < 500_000) return 'Mid-sized country';
  if (value < 2_000_000) return 'Large country';
  return 'Continental-scale country';
}

export function formatCoordinates(coordinate) {
  if (!coordinate) return '—';
  const [longitude, latitude] = coordinate;
  const lat = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat} · ${lon}`;
}

export function createAtlasModel(gameData, geoData, d3) {
  const countries = [...gameData.countries].sort((a, b) => a.name.localeCompare(b.name));
  const countryByCode = new Map(countries.map(country => [country.code, country]));
  const countryByName = new Map();
  for (const country of countries) {
    for (const name of [country.name, country.code, country.numeric, ...(country.aliases || [])]) {
      const key = normalise(name);
      if (key) countryByName.set(key, country);
    }
  }

  const features = geoData.features.filter(feature => countryByCode.has(feature.properties.code));
  const featureByCode = new Map(features.map(feature => [feature.properties.code, feature]));
  const polygons = features.filter(feature => feature.geometry.type !== 'Point');
  const points = features.filter(feature => feature.geometry.type === 'Point');
  const precisionPolygons = polygons.filter(feature => feature.properties.detailScale === '10m');
  const basePolygons = polygons.filter(feature => feature.properties.detailScale !== '10m');
  const hitPolygons = [...polygons].sort((a, b) => {
    const areaA = Number(countryByCode.get(a.properties.code)?.area) || Number.POSITIVE_INFINITY;
    const areaB = Number(countryByCode.get(b.properties.code)?.area) || Number.POSITIVE_INFINITY;
    return areaA - areaB;
  });
  const areaRank = [...countries].sort((a, b) => (b.area || 0) - (a.area || 0));
  const rankByCode = new Map(areaRank.map((country, index) => [country.code, index + 1]));
  const continents = [...new Set(countries.map(country => country.continent || 'Other'))].sort();

  function coordinateFor(code) {
    const feature = featureByCode.get(code);
    if (!feature) return null;
    return feature.geometry.type === 'Point' ? feature.geometry.coordinates : d3.geoCentroid(feature);
  }

  function similarCountry(country) {
    return countries
      .filter(item => item.code !== country.code && item.area > 0)
      .sort((a, b) => Math.abs(Math.log((a.area || 1) / (country.area || 1))) - Math.abs(Math.log((b.area || 1) / (country.area || 1))))[0] || null;
  }

  function nearestCountries(code, limit = 6) {
    return countries
      .filter(country => country.code !== code)
      .map(country => ({ country, distance: gameData.distance(code, country.code) }))
      .sort((a, b) => a.distance - b.distance || a.country.name.localeCompare(b.country.name))
      .slice(0, limit);
  }

  function search(query, limit = 8) {
    const key = normalise(query);
    if (!key) return [];
    const scored = [];
    for (const country of countries) {
      const names = [country.name, country.code, ...(country.aliases || [])].map(normalise);
      let score = Infinity;
      for (const name of names) {
        if (name === key) score = Math.min(score, 0);
        else if (name.startsWith(key)) score = Math.min(score, 1 + name.length / 100);
        else if (name.includes(key)) score = Math.min(score, 2 + name.indexOf(key) / 100);
      }
      if (Number.isFinite(score)) scored.push({ country, score });
    }
    return scored.sort((a, b) => a.score - b.score || a.country.name.localeCompare(b.country.name)).slice(0, limit).map(item => item.country);
  }

  return {
    countries,
    countryByCode,
    countryByName,
    features,
    featureByCode,
    polygons,
    basePolygons,
    precisionPolygons,
    hitPolygons,
    points,
    worldCollection: { type: 'FeatureCollection', features: basePolygons },
    continents,
    areaRank,
    rankByCode,
    coordinateFor,
    similarCountry,
    nearestCountries,
    search
  };
}
