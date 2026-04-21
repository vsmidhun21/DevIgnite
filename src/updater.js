import { app, ipcMain, net } from 'electron';
import fs from 'fs';
import path from 'path';
// import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
// import { Readable } from 'stream';

const REPO_API = 'https://api.github.com/repos/vsmidhun21/DevIgnite/releases/latest';
const SKIP_COUNTER_KEY = 'update_skip_counter';
const SKIP_THRESHOLD = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function compareSemver(a, b) {
  // Returns > 0 if b > a  (b is newer)
  const parse = (str) => str.replace(/^v/, '').split('.').map(Number);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (bMaj !== aMaj) return bMaj - aMaj;
  if (bMin !== aMin) return bMin - aMin;
  return bPat - aPat;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, method: 'GET' });
    req.setHeader('User-Agent', 'DevIgnite-App');
    req.setHeader('Accept', 'application/vnd.github.v3+json');
    let raw = '';
    req.on('response', (res) => {
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Skip Counter (persisted in app userData) ──────────────────────────────────

function getSkipCounterPath() {
  return path.join(app.getPath('userData'), 'update_state.json');
}

function loadUpdateState() {
  try {
    const raw = fs.readFileSync(getSkipCounterPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { skip_counter: 0, skipped_version: null };
  }
}

function saveUpdateState(state) {
  try {
    fs.writeFileSync(getSkipCounterPath(), JSON.stringify(state), 'utf8');
  } catch { }
}

// ── Main Export ────────────────────────────────────────────────────────────────

export class Updater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this._downloadAbort = null;
    this._registerHandlers();
  }

  // Called once after window is created
  async checkForUpdates() {
    try {
      const release = await fetchJson(REPO_API);
      const latestTag = release.tag_name;           // e.g. "v2.1.0"
      const currentTag = `v${app.getVersion()}`;    // e.g. "v2.0.5"

      if (compareSemver(currentTag, latestTag) <= 0) return; // no update

      // Find .exe asset
      const asset = (release.assets || []).find(a => a.name.endsWith('.exe'));
      if (!asset) return;

      const state = loadUpdateState();

      // If user previously clicked "Later" for THIS version, count launches
      if (state.skipped_version === latestTag) {
        if (state.skip_counter < SKIP_THRESHOLD) {
          state.skip_counter += 1;
          saveUpdateState(state);
          return; // skip this launch
        }
        // Threshold reached — show again and reset counter
        state.skip_counter = 0;
        saveUpdateState(state);
      }

      // Notify renderer
      this.mainWindow?.webContents.send('updater:available', {
        currentVersion: currentTag,
        latestVersion: latestTag,
        downloadUrl: asset.browser_download_url,
        releaseNotes: release.name || latestTag,
      });
    } catch (err) {
      // Fail silently
      console.warn('[Updater] Check failed:', err.message);
    }
  }

  _registerHandlers() {
    // User clicked "Later"
    ipcMain.on('updater:later', (_, { version }) => {
      const state = loadUpdateState();
      state.skipped_version = version;
      state.skip_counter = 0;
      saveUpdateState(state);
    });

    // User clicked "Update Now" — start streaming download
    ipcMain.handle('updater:download', async (_, { downloadUrl, version }) => {
      const tempDir = app.getPath('temp');
      const fileName = `DevIgniteSetup-${version}.exe`;
      const destPath = path.join(tempDir, fileName);

      // Remove stale file if present
      try { fs.unlinkSync(destPath); } catch { }

      const send = (payload) => this.mainWindow?.webContents.send('updater:progress', payload);

      try {
        send({ status: 'downloading', percent: 0 });

        // Use Node https for streaming (net.request doesn't stream body easily)
        const { default: https } = await import('https');

        await new Promise((resolve, reject) => {
          const followRedirect = (url, depth = 0) => {
            if (depth > 5) return reject(new Error('Too many redirects'));
            const req = https.get(url, { headers: { 'User-Agent': 'DevIgnite-App' } }, (res) => {
              if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
                return followRedirect(res.headers.location, depth + 1);
              }
              if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
              }

              const total = parseInt(res.headers['content-length'] || '0', 10);
              let downloaded = 0;
              const out = createWriteStream(destPath);

              res.on('data', (chunk) => {
                downloaded += chunk.length;
                const percent = total > 0 ? Math.round((downloaded / total) * 100) : -1;
                send({ status: 'downloading', percent, downloaded, total });
              });

              res.pipe(out);
              out.on('finish', resolve);
              out.on('error', reject);
              res.on('error', reject);
            });
            req.on('error', reject);
          };
          followRedirect(downloadUrl);
        });

        send({ status: 'downloaded', percent: 100 });

        return { ok: true, filePath: destPath };
      } catch (err) {
        send({ status: 'error', message: err.message });
        return { ok: false, error: err.message };
      }
    });

    // Execute installer and quit
    ipcMain.on('updater:install', async (_, { filePath }) => {
      try {
        const { spawn } = await import('child_process');
        spawn(filePath, ['--silent', '--update'], {
          detached: true,
          stdio: 'ignore',
          shell: false,
        }).unref();

        setTimeout(() => app.quit(), 500);
      } catch (err) {
        this.mainWindow?.webContents.send('updater:progress', {
          status: 'error',
          message: `Failed to launch installer: ${err.message}`,
        });
      }
    });
  }
}
