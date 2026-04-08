// vite.renderer.config.mjs
// Vite config for the React RENDERER process.

import { defineConfig } from 'vite';
import react            from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // No special externals needed — renderer is a normal browser environment.
  // Node APIs are accessed only via window.launcher (exposed by preload).
});
