import { initialiseGameRuntime } from './game-runtime.js';
import { installDetailedMasteryControls, prepareDetailedMasteryGeometry } from './mastery-detailed-geometry.js';

function showFailure(error) {
  console.error(error);
  const loading = document.getElementById('masteryLoading');
  if (loading) loading.textContent = 'Regional Mastery could not start. Please reload the page.';
}

async function start() {
  await initialiseGameRuntime();
  await prepareDetailedMasteryGeometry();
  await import('./generated/mastery-runtime.js');

  if (!window.__NEARER_MASTERY_STARTED) {
    throw new Error('Regional Mastery did not initialise.');
  }

  installDetailedMasteryControls();
  document.documentElement.classList.add('nearer-runtime-ready');
}

start().catch(showFailure);
