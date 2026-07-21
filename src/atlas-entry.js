import './atlas-styles.js';
import { initialiseGameRuntime } from './game-runtime.js';
import { preparePrecisionGeometry } from './normalised-precision-geometry.js';

await initialiseGameRuntime();
await preparePrecisionGeometry();
await import('./atlas.js');
