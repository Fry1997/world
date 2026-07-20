import { prepareDetailedGeometry } from './detailed-geometry.js';

let runtimePromise = null;

export async function initialiseGameRuntime() {
  if (!window.NEARER_GAME_DATA || !window.NEARER_COUNTRIES_GEOJSON || !window.NEARER_D3) {
    runtimePromise ||= import('virtual:nearer-runtime');
    await runtimePromise;
  }

  if (!window.NEARER_GAME_DATA || !window.NEARER_COUNTRIES_GEOJSON || !window.NEARER_D3) {
    throw new Error('Nearer game data did not initialise.');
  }

  await prepareDetailedGeometry();
}
