import { execSync } from 'child_process';
import fs   from 'fs';
import path from 'path';
import os   from 'os';

const WIN = process.platform === 'win32';
const MAC = process.platform === 'darwin';

const IDE_DEFS = [
  {
    id: 'vscode', name: 'VS Code',
    which: ['code'],
    winPaths: [
      path.join(process.env.LOCALAPPDATA||'', 'Programs', 'Microsoft VS Code', 'Code.exe'),
      'C:\\Program Files\\Microsoft VS Code\\Code.exe',
    ],
    macPaths: ['/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'],
    linuxPaths: ['/usr/bin/code', '/usr/local/bin/code'],
    cmd: (p) => `code "${p}"`,
  },
  {
    id: 'cursor', name: 'Cursor',
    which: ['cursor'],
    winPaths: [path.join(process.env.LOCALAPPDATA||'', 'Programs', 'cursor', 'Cursor.exe')],
    macPaths: ['/Applications/Cursor.app/Contents/Resources/app/bin/cursor'],
    linuxPaths: ['/usr/bin/cursor'],
    cmd: (p) => `cursor "${p}"`,
  },
  {
    id: 'windsurf', name: 'Windsurf',
    which: ['windsurf'],
    winPaths: [path.join(process.env.LOCALAPPDATA||'', 'Programs', 'Windsurf', 'Windsurf.exe')],
    macPaths: ['/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf'],
    linuxPaths: ['/usr/bin/windsurf'],
    cmd: (p) => `windsurf "${p}"`,
  },
  {
    id: 'zed', name: 'Zed',
    which: ['zed'],
    winPaths: [],
    macPaths: ['/Applications/Zed.app/Contents/MacOS/zed', path.join(os.homedir(), '.local', 'bin', 'zed')],
    linuxPaths: ['/usr/bin/zed', path.join(os.homedir(), '.local', 'bin', 'zed')],
    cmd: (p) => `zed "${p}"`,
  },
  {
    id: 'intellij', name: 'IntelliJ IDEA',
    which: ['idea64', 'idea'],
    winPaths: () => scanJetBrains('IntelliJ'),
    macPaths: ['/Applications/IntelliJ IDEA.app/Contents/MacOS/idea', '/Applications/IntelliJ IDEA CE.app/Contents/MacOS/idea'],
    linuxPaths: ['/usr/local/bin/idea'],
    cmd: (p, exe) => exe ? `"${exe}" "${p}"` : `idea "${p}"`,
  },
  {
    id: 'pycharm', name: 'PyCharm',
    which: ['pycharm64', 'charm', 'pycharm'],
    winPaths: () => scanJetBrains('PyCharm'),
    macPaths: ['/Applications/PyCharm.app/Contents/MacOS/pycharm', '/Applications/PyCharm CE.app/Contents/MacOS/pycharm'],
    linuxPaths: ['/usr/local/bin/pycharm'],
    cmd: (p, exe) => exe ? `"${exe}" "${p}"` : `charm "${p}"`,
  },
  {
    id: 'webstorm', name: 'WebStorm',
    which: ['webstorm64', 'webstorm'],
    winPaths: () => scanJetBrains('WebStorm'),
    macPaths: ['/Applications/WebStorm.app/Contents/MacOS/webstorm'],
    linuxPaths: ['/usr/local/bin/webstorm'],
    cmd: (p, exe) => exe ? `"${exe}" "${p}"` : `webstorm "${p}"`,
  },
  {
    id: 'rider', name: 'Rider',
    which: ['rider64', 'rider'],
    winPaths: () => scanJetBrains('Rider'),
    macPaths: ['/Applications/Rider.app/Contents/MacOS/rider'],
    linuxPaths: [],
    cmd: (p, exe) => exe ? `"${exe}" "${p}"` : `rider "${p}"`,
  },
  {
    id: 'clion', name: 'CLion',
    which: ['clion64', 'clion'],
    winPaths: () => scanJetBrains('CLion'),
    macPaths: ['/Applications/CLion.app/Contents/MacOS/clion'],
    linuxPaths: [],
    cmd: (p, exe) => exe ? `"${exe}" "${p}"` : `clion "${p}"`,
  },
  {
    id: 'sublime', name: 'Sublime Text',
    which: ['subl'],
    winPaths: ['C:\\Program Files\\Sublime Text\\sublime_text.exe', 'C:\\Program Files\\Sublime Text 3\\sublime_text.exe'],
    macPaths: ['/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl'],
    linuxPaths: ['/usr/bin/subl'],
    cmd: (p) => `subl "${p}"`,
  },
  {
    id: 'notepadpp', name: 'Notepad++',
    which: [],
    winPaths: ['C:\\Program Files\\Notepad++\\notepad++.exe', 'C:\\Program Files (x86)\\Notepad++\\notepad++.exe'],
    macPaths: [], linuxPaths: [],
    cmd: (p, exe) => `"${exe}" "${p}"`,
  },
  {
    id: 'vim', name: 'Vim',
    which: ['nvim', 'vim'],
    winPaths: ['C:\\Program Files\\Neovim\\bin\\nvim.exe', 'C:\\Program Files\\Vim\\vim90\\vim.exe'],
    macPaths: ['/usr/bin/vim', '/usr/local/bin/nvim'],
    linuxPaths: ['/usr/bin/nvim', '/usr/bin/vim'],
    cmd: (p) => `vim "${p}"`,
  },
];

export class IdeDetector {
  detect() {
    const results = [];
    for (const def of IDE_DEFS) {
      const exe = this._find(def);
      if (exe) {
        results.push({
          id: def.id, name: def.name, execPath: exe, available: true,
          buildCmd: (projectPath) => def.cmd(projectPath, exe),
        });
      }
    }
    return results;
  }

  buildLaunchCmd(ideId, customPath, projectPath) {
    if (customPath && fs.existsSync(customPath)) {
      return `"${customPath}" "${projectPath}"`;
    }
    const def = IDE_DEFS.find(d => d.id === ideId);
    if (!def) return null;
    const exe = this._find(def);
    if (!exe) {
      // Fallback: try to run the which name directly
      const whichName = (def.which || [])[0];
      return whichName ? `${whichName} "${projectPath}"` : null;
    }
    return def.cmd(projectPath, exe);
  }

  _find(def) {
    for (const bin of def.which || []) {
      try {
        const found = execSync(WIN ? `where ${bin}` : `which ${bin}`, { stdio: 'pipe', timeout: 2000 })
          .toString().trim().split('\n')[0].trim();
        if (found && fs.existsSync(found)) return found;
      } catch {}
    }
    const pp = WIN ? def.winPaths : MAC ? def.macPaths : def.linuxPaths;
    const paths = typeof pp === 'function' ? pp() : (pp || []);
    for (const p of paths) {
      if (p && fs.existsSync(p)) return p;
    }
    return null;
  }
}

function scanJetBrains(product) {
  const bases = [
    'C:\\Program Files\\JetBrains',
    'C:\\Program Files (x86)\\JetBrains',
    path.join(os.homedir(), 'AppData', 'Local', 'JetBrains'),
  ];
  const results = [];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    try {
      for (const dir of fs.readdirSync(base)) {
        if (!dir.toLowerCase().includes(product.toLowerCase())) continue;
        const binDir = path.join(base, dir, 'bin');
        for (const f of fs.existsSync(binDir) ? fs.readdirSync(binDir) : []) {
          if (f.endsWith('.exe') && !f.includes('fsnotifier')) results.push(path.join(binDir, f));
        }
      }
    } catch {}
  }
  return results;
}
