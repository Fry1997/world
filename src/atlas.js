import { initialiseGameRuntime } from './game-runtime.js';
import { renderAtlasShell } from './atlas-markup.js';
import {
  createAtlasModel,
  formatArea,
  formatCoordinates,
  masteryStrength,
  normalise,
  readAtlasState,
  readMasteryState,
  sizeBand,
  writeAtlasState
} from './atlas-data.js';
import { createAtlasGlobe } from './atlas-globe.js';

function showFailure(error) {
  console.error(error);
  const loading = document.getElementById('atlasLoading');
  if (loading) loading.textContent = 'Nearer Atlas could not open. Please reload the page.';
}

function distanceLabel(distance) {
  if (distance === 0) return 'Shares a border';
  if (distance < 10) return `${distance} km away`;
  return `${Math.round(distance).toLocaleString()} km away`;
}

function escaped(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function start() {
  await initialiseGameRuntime();
  const root = document.getElementById('atlasApp');
  if (!root) throw new Error('The Atlas page shell is missing.');
  renderAtlasShell(root);

  const d3 = window.NEARER_D3;
  const gameData = window.NEARER_GAME_DATA;
  const geoData = window.NEARER_COUNTRIES_GEOJSON;
  const model = createAtlasModel(gameData, geoData, d3);
  const atlasState = readAtlasState();
  let masteryState = readMasteryState();
  let activeTrail = 'smallest';
  let selectedCode = null;

  const elements = {
    loading: document.getElementById('atlasLoading'),
    toast: document.getElementById('atlasToast'),
    search: document.getElementById('atlasSearch'),
    clear: document.getElementById('atlasSearchClear'),
    suggestions: document.getElementById('atlasSuggestions'),
    random: document.getElementById('atlasRandomButton'),
    share: document.getElementById('atlasShareButton'),
    empty: document.getElementById('atlasProfileEmpty'),
    content: document.getElementById('atlasProfileContent'),
    continent: document.getElementById('atlasCountryContinent'),
    name: document.getElementById('atlasCountryName'),
    code: document.getElementById('atlasCountryCode'),
    summary: document.getElementById('atlasCountrySummary'),
    area: document.getElementById('atlasCountryArea'),
    comparison: document.getElementById('atlasAreaComparison'),
    rank: document.getElementById('atlasCountryRank'),
    size: document.getElementById('atlasSizeBand'),
    coordinates: document.getElementById('atlasCountryCoordinates'),
    mastery: document.getElementById('atlasCountryMastery'),
    masteryCopy: document.getElementById('atlasMasteryCopy'),
    nearby: document.getElementById('atlasNearbyCountries'),
    favourite: document.getElementById('atlasFavouriteButton'),
    masteryLink: document.getElementById('atlasMasteryLink'),
    copy: document.getElementById('atlasCopyLinkButton'),
    trailTabs: document.getElementById('atlasTrailTabs'),
    trail: document.getElementById('atlasTrail'),
    filter: document.getElementById('atlasContinentFilter'),
    index: document.getElementById('atlasCountryIndex')
  };

  function showToast(message) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    clearTimeout(elements.toast._timer);
    elements.toast._timer = setTimeout(() => elements.toast.classList.remove('is-visible'), 2200);
  }

  function countryButton(country, extra = '') {
    return `<button type="button" data-atlas-country="${country.code}"><span>${escaped(country.name)}</span><small>${escaped(extra || country.continent || 'World')}</small></button>`;
  }

  function trailCountries() {
    if (activeTrail === 'largest') return model.areaRank.slice(0, 12);
    if (activeTrail === 'favourites') return atlasState.favourites.map(code => model.countryByCode.get(code)).filter(Boolean);
    if (activeTrail === 'recent') return atlasState.recent.map(code => model.countryByCode.get(code)).filter(Boolean);
    return [...model.countries].filter(country => country.area > 0).sort((a, b) => a.area - b.area).slice(0, 12);
  }

  function renderTrail() {
    const countries = trailCountries();
    elements.trail.innerHTML = countries.length
      ? countries.map(country => countryButton(country, formatArea(country.area))).join('')
      : `<div class="atlas-trail-empty"><strong>${activeTrail === 'favourites' ? 'No saved countries yet.' : 'No recent places yet.'}</strong><span>Open a country and ${activeTrail === 'favourites' ? 'tap Save' : 'it will appear here'}.</span></div>`;
  }

  function renderIndex() {
    const filter = elements.filter.value;
    const countries = filter === 'all' ? model.countries : model.countries.filter(country => country.continent === filter);
    elements.index.innerHTML = countries.map(country => {
      const saved = atlasState.favourites.includes(country.code) ? '<i aria-label="Saved">★</i>' : '';
      return `<button type="button" data-atlas-country="${country.code}"><span><b>${escaped(country.name)}</b><small>${escaped(country.continent || 'World')}</small></span><em>${country.code}</em>${saved}</button>`;
    }).join('');
  }

  for (const continent of model.continents) {
    const option = document.createElement('option');
    option.value = continent;
    option.textContent = continent;
    elements.filter.append(option);
  }

  function updateFavouriteButton(country) {
    const saved = atlasState.favourites.includes(country.code);
    elements.favourite.setAttribute('aria-pressed', String(saved));
    elements.favourite.querySelector('span').textContent = saved ? '★' : '☆';
    elements.favourite.querySelector('b').textContent = saved ? 'Saved' : 'Save';
  }

  function masteryFor(code) {
    masteryState = readMasteryState();
    const record = masteryState.countries?.[code] || null;
    if (!record || !(record.attempts > 0)) return { label: 'New', copy: 'Not studied yet', strength: 0 };
    const strength = masteryStrength(record);
    return {
      label: `${strength}%`,
      copy: strength >= 70 ? 'Mastered strength' : strength >= 35 ? 'Building strength' : 'Needs another look',
      strength
    };
  }

  function updateUrl(code, replace = true) {
    const url = new URL(location.href);
    if (code) url.searchParams.set('country', code);
    else url.searchParams.delete('country');
    history[replace ? 'replaceState' : 'pushState']({ country: code }, '', url);
  }

  function renderNearby(country) {
    const nearby = model.nearestCountries(country.code, 6);
    elements.nearby.innerHTML = nearby.map(item => `
      <button type="button" data-atlas-country="${item.country.code}">
        <span><strong>${escaped(item.country.name)}</strong><small>${escaped(item.country.continent || 'World')}</small></span>
        <b>${distanceLabel(item.distance)}</b>
      </button>`).join('');
  }

  function selectCountry(code, options = {}) {
    const country = model.countryByCode.get(code);
    if (!country) return;
    selectedCode = code;
    const similar = model.similarCountry(country);
    const coordinate = model.coordinateFor(code);
    const rank = model.rankByCode.get(code);
    const knowledge = masteryFor(code);
    const band = sizeBand(country.area);
    const comparison = similar ? `Similar in area to ${similar.name}` : 'Mapped land area';

    atlasState.recent = [code, ...atlasState.recent.filter(item => item !== code)].slice(0, 20);
    writeAtlasState(atlasState);
    elements.empty.classList.add('is-hidden');
    elements.content.classList.remove('is-hidden');
    elements.continent.textContent = String(country.continent || 'World').toUpperCase();
    elements.name.textContent = country.name;
    elements.code.textContent = country.code;
    elements.summary.textContent = `${country.name} is a ${band.toLowerCase()} in ${country.continent || 'the world'}. This Atlas entry connects its real mapped border, scale and nearest geographic relationships.`;
    elements.area.textContent = formatArea(country.area);
    elements.comparison.textContent = comparison;
    elements.rank.textContent = rank ? `#${rank} of ${model.countries.length}` : '—';
    elements.size.textContent = band;
    elements.coordinates.textContent = formatCoordinates(coordinate);
    elements.mastery.textContent = knowledge.label;
    elements.masteryCopy.textContent = knowledge.copy;
    elements.masteryLink.textContent = `Learn ${country.continent || 'this region'}`;
    elements.masteryLink.href = '/mastery/';
    elements.share.disabled = false;
    updateFavouriteButton(country);
    renderNearby(country);
    renderTrail();
    renderIndex();
    globe.setSelected(code, { focus: options.focus !== false, zoom: options.zoom });
    if (options.updateUrl !== false) updateUrl(code, options.replaceUrl !== false);
  }

  const globe = createAtlasGlobe({ d3, model, onSelect: (code, options) => selectCountry(code, { ...options, replaceUrl: false }) });

  function toggleFavourite() {
    if (!selectedCode) return;
    const exists = atlasState.favourites.includes(selectedCode);
    atlasState.favourites = exists
      ? atlasState.favourites.filter(code => code !== selectedCode)
      : [selectedCode, ...atlasState.favourites];
    writeAtlasState(atlasState);
    updateFavouriteButton(model.countryByCode.get(selectedCode));
    renderTrail();
    renderIndex();
    showToast(exists ? 'Removed from saved countries.' : 'Saved to your Atlas.');
  }

  function renderSuggestions() {
    const matches = model.search(elements.search.value, 8);
    elements.suggestions.innerHTML = matches.map(country => `
      <button type="button" role="option" data-atlas-country="${country.code}"><span>${escaped(country.name)}</span><small>${country.code} · ${escaped(country.continent || 'World')}</small></button>`).join('');
    const visible = Boolean(elements.search.value.trim() && matches.length);
    elements.suggestions.classList.toggle('is-hidden', !visible);
    elements.search.setAttribute('aria-expanded', String(visible));
  }

  async function shareCurrent(copyOnly = false) {
    if (!selectedCode) return;
    const country = model.countryByCode.get(selectedCode);
    const url = new URL('/atlas/', location.origin);
    url.searchParams.set('country', selectedCode);
    const share = { title: `${country.name} · Nearer Atlas`, text: `Open ${country.name} in Nearer Atlas.`, url: url.href };
    if (!copyOnly && navigator.share) {
      try { await navigator.share(share); return; }
      catch (error) { if (error?.name === 'AbortError') return; }
    }
    await navigator.clipboard.writeText(url.href);
    showToast('Atlas link copied.');
  }

  root.addEventListener('click', event => {
    const countryButton = event.target.closest('[data-atlas-country]');
    if (countryButton) {
      selectCountry(countryButton.dataset.atlasCountry, { replaceUrl: false });
      countryButton.blur();
      return;
    }
    const trailButton = event.target.closest('[data-atlas-trail]');
    if (trailButton) {
      activeTrail = trailButton.dataset.atlasTrail;
      elements.trailTabs.querySelectorAll('button').forEach(button => button.classList.toggle('is-active', button === trailButton));
      renderTrail();
    }
  });

  elements.search.addEventListener('input', renderSuggestions);
  elements.search.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const country = model.search(elements.search.value, 1)[0];
    if (country) {
      event.preventDefault();
      elements.suggestions.classList.add('is-hidden');
      selectCountry(country.code, { replaceUrl: false });
    }
  });
  elements.search.addEventListener('blur', () => setTimeout(() => elements.suggestions.classList.add('is-hidden'), 120));
  elements.clear.addEventListener('click', () => { elements.search.value = ''; renderSuggestions(); elements.search.focus(); });
  elements.filter.addEventListener('change', renderIndex);
  elements.favourite.addEventListener('click', toggleFavourite);
  elements.random.addEventListener('click', () => {
    const country = model.countries[Math.floor(Math.random() * model.countries.length)];
    selectCountry(country.code, { replaceUrl: false });
  });
  elements.share.addEventListener('click', () => shareCurrent(false));
  elements.copy.addEventListener('click', () => shareCurrent(true));
  addEventListener('popstate', () => {
    const code = new URLSearchParams(location.search).get('country');
    if (code && model.countryByCode.has(code)) selectCountry(code, { updateUrl: false });
  });
  addEventListener('storage', event => {
    if (event.key === 'nearer-mastery-v1' && selectedCode) selectCountry(selectedCode, { focus: false, updateUrl: false });
  });

  renderTrail();
  renderIndex();
  const requested = new URLSearchParams(location.search).get('country');
  if (requested && model.countryByCode.has(requested)) selectCountry(requested, { updateUrl: false });
  elements.loading.classList.add('is-hidden');
  document.documentElement.classList.add('nearer-runtime-ready');
  window.__NEARER_ATLAS_STARTED = true;
}

start().catch(showFailure);
