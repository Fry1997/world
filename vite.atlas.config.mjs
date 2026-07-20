import { resolve } from 'node:path';
import baseConfig from './vite.config.mjs';

const existingBuild = baseConfig.build || {};
const existingOptions = existingBuild.rolldownOptions || {};
const existingInput = existingOptions.input || {};

const stableAtlasGlobePlugin = {
  name: 'nearer-stable-atlas-globe',
  enforce: 'pre',
  resolveId(source, importer) {
    if (source === './atlas-globe.js' && importer?.endsWith('/src/atlas.js')) {
      return resolve(process.cwd(), 'src/generated/atlas-globe.js');
    }
    return null;
  }
};

export default {
  ...baseConfig,
  plugins: [...(baseConfig.plugins || []), stableAtlasGlobePlugin],
  build: {
    ...existingBuild,
    rolldownOptions: {
      ...existingOptions,
      input: {
        ...existingInput,
        atlas: resolve(process.cwd(), 'atlas/index.html')
      }
    }
  }
};
