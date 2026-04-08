// vite.main.config.mjs
// Vite config for the Electron MAIN process.
//
// Key decisions:
//  - output format: CJS (CommonJS) — our core/ modules use require()
//  - better-sqlite3 is EXTERNAL: it has native .node bindings that can't be bundled
//  - electron and all Node built-ins are external (provided at runtime by Electron)
//  - core/ and shared/ ARE bundled into .vite/build/main.js (pure JS, no issues)
//    This eliminates all path-resolution problems in dev vs prod.

import { defineConfig } from 'vite';
import { builtinModules } from 'module';

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        // Native module — must stay external, unpacked from asar by auto-unpack-natives
        'better-sqlite3',

        // Electron itself
        'electron',

        // All Node.js built-in modules (both plain and node: prefix)
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ],
      output: {
        // CommonJS format — required because our core/ files use require()
        format: 'cjs',
      },
    },
  },
});
