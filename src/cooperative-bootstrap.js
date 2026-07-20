import { initialiseGameRuntime } from './game-runtime.js';
import { loadModeEnhancements } from './together-enhancements.js';

function showFailure(error) {
  console.error(error);
  const loading = document.getElementById('modeLoading');
  if (loading) loading.textContent = 'Cooperative Relay could not start. Please reload the page.';
}

async function start() {
  await initialiseGameRuntime();
  await import('../together/shared/together-core.js');
  if (!window.NEARER_TOGETHER_CORE) throw new Error('Together core did not initialise.');

  await import('../together/cooperative/cooperative.js');
  if (!window.__NEARER_COOPERATIVE_STARTED) throw new Error('Cooperative Relay did not initialise.');

  await loadModeEnhancements();
  document.documentElement.classList.add('nearer-runtime-ready');
}

start().catch(showFailure);
