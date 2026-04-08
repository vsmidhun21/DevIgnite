// forge.config.js
// Electron Forge configuration for Dev Project Launcher
// Handles: Windows installer, native modules (better-sqlite3), asar packaging

const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    name: 'Dev Project Launcher',
    executableName: 'DevProjectLauncher',
    icon: './assets/icon.png',   // Forge adds .ico/.icns automatically
    asar: true,
    prune: true,
    ignore: (file) => {
      if (!file) return false;
      const keep = file.startsWith('/.vite') || (file.startsWith('/node_modules'));
      return !keep;
    }
  },

  rebuildConfig: {
    // Rebuild native modules (better-sqlite3) for the target Electron version
    // Run automatically by `electron-forge make`
    force: true,
  },

  makers: [
    // ── Windows: Squirrel installer (.exe setup + auto-updater support) ──────
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'DevProjectLauncher',
        setupExe: 'DevProjectLauncherSetup.exe',
        setupIcon: './assets/icon.ico',
        // Creates Start Menu shortcut
        shortcutFolderName: 'Dev Project Launcher',
      },
    },
    // ── Mac (zip for distribution) ────────────────────────────────────────────
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],

  plugins: [
    // ── Vite plugin: compiles main, preload, and renderer ─────────────────────
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload.cjs',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },

    // ── Auto-unpack-natives: ensures .node files are outside asar ─────────────
    // Works alongside packagerConfig.asar.unpack above
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },

    // ── Fuses: security hardening at package time ─────────────────────────────
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
