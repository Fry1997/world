import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = process.cwd();

export default defineConfig({
  appType: 'mpa',
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'baseline-widely-available',
    cssCodeSplit: true,
    sourcemap: false,
    rolldownOptions: {
      input: {
        atlas: resolve(root, 'atlas/index.html')
      }
    }
  }
});
