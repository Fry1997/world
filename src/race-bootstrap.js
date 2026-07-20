import { initialiseGameRuntime } from './game-runtime.js';
import { loadRaceEnhancements } from './together-enhancements.js';

function showFailure(error) {
  console.error(error);
  const loading = document.getElementById('raceLoading');
  if (loading) loading.textContent = 'Same Target Race could not start. Please reload the page.';
}

async function start() {
  await initialiseGameRuntime();
  await import('virtual:nearer-race');

  if (!window.__NEARER_RACE_V2_STARTED) {
    throw new Error('Same Target Race did not initialise.');
  }

  await loadRaceEnhancements();
  document.documentElement.classList.add('nearer-runtime-ready');
}

start().catch(showFailure);
