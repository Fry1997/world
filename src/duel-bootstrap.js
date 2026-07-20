import { initialiseGameRuntime } from './game-runtime.js';
import { loadModeEnhancements } from './together-enhancements.js';

function showFailure(error) {
  console.error(error);
  const loading = document.getElementById('modeLoading');
  if (loading) loading.textContent = 'Hidden Country Duel could not start. Please reload the page.';
}

async function start() {
  await initialiseGameRuntime();
  await import('../together/shared/together-core.js');
  if (!window.NEARER_TOGETHER_CORE) throw new Error('Together core did not initialise.');

  await import('../together/duel/duel.js');
  if (!window.__NEARER_DUEL_STARTED) throw new Error('Hidden Country Duel did not initialise.');

  await loadModeEnhancements({ duelPressure: true });
  document.documentElement.classList.add('nearer-runtime-ready');
}

start().catch(showFailure);
