// vite.main.config.mjs — Main process Vite config
import { defineConfig }   from 'vite';
import { builtinModules } from 'module';

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'better-sqlite3',
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
