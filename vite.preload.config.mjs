// vite.preload.config.mjs — Preload script Vite config
import { defineConfig } from 'vite';
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
