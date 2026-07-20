import { initialiseGameRuntime } from './game-runtime.js';
import { loadRaceEnhancements } from './together-enhancements.js';

function showFailure(error) {
  console.error(error);
  const loading = document.getElementById('raceLoading');
  if (loading) loading.textContent = 'Same Target Race could not start. Please reload the page.';
}

async function start() {
  await initialiseGameRuntime();

  const source = window.NEARER_RACE_SOURCE || '';
  if (!source.includes('window.__NEARER_RACE_V2_STARTED = true')) {
    throw new Error('Same Target Race source chunks are incomplete.');
  }

  (0, eval)(source);
  delete window.NEARER_RACE_SOURCE;

  if (!window.__NEARER_RACE_V2_STARTED) {
    throw new Error('Same Target Race did not initialise.');
  }

  await loadRaceEnhancements();
  document.documentElement.classList.add('nearer-runtime-ready');
}

start().catch(showFailure);
