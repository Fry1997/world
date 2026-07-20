import { resolve } from 'node:path';
import baseConfig from './vite.config.mjs';

const existingBuild = baseConfig.build || {};
const existingOptions = existingBuild.rolldownOptions || {};
const existingInput = existingOptions.input || {};

export default {
  ...baseConfig,
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
