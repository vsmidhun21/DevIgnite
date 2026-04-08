// vite.preload.config.mjs
// Vite config for the Electron PRELOAD script.
// Preload only uses 'electron' (contextBridge, ipcRenderer) — no bundling needed.

import { defineConfig }  from 'vite';
import { builtinModules } from 'module';

export default defineConfig({
  build: {
    outDir: '.vite/build',
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ],
      output: {
        format: 'cjs',
      },
    },
  },
});
