const { FusesPlugin }    = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    name:           'DevIgnite',
    executableName: 'DevIgnite',
    icon:           './assets/icon',
    asar: true,
    prune: true,
    ignore: (file) => {
      if (!file) return false;
      const keep = file.startsWith('/.vite') || (file.startsWith('/node_modules'));
      return !keep;
    }
  },
  rebuildConfig: { force: true },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'DevIgnite', setupExe: 'DevIgniteSetup.exe',
        setupIcon: './assets/icon.ico', shortcutFolderName: 'DevIgnite',
      },
    },
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          { entry: 'src/main.js',    config: 'vite.main.config.mjs',    target: 'main'    },
          { entry: 'src/preload.js', config: 'vite.preload.config.mjs', target: 'preload' },
        ],
        renderer: [{ name: 'main_window', config: 'vite.renderer.config.mjs' }],
      },
    },
    { name: '@electron-forge/plugin-auto-unpack-natives', config: {} },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]:                            false,
      [FuseV1Options.EnableCookieEncryption]:               true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]:        false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]:                  true,
    }),
  ],
};
