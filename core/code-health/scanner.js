import fg from 'fast-glob';
import path from 'path';
import fs from 'fs';

export class Scanner {
  static async scanFiles(projectPath, scope) {
    const defaultIgnore = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/out/**'];
    
    // Check for .devignite-ignore
    let customIgnore = [];
    const ignorePath = path.join(projectPath, '.devignite-ignore');
    if (fs.existsSync(ignorePath)) {
      const content = fs.readFileSync(ignorePath, 'utf8');
      customIgnore = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
      customIgnore = customIgnore.map(pattern => `**/${pattern}/**`);
    }

    const pattern = scope === 'full' ? '**/*.{js,jsx,ts,tsx}' : `${scope}/**/*.{js,jsx,ts,tsx}`;
    
    const entries = await fg([pattern], {
      cwd: projectPath,
      ignore: [...defaultIgnore, ...customIgnore],
      absolute: true
    });

    return entries.map(e => e.replace(/\\/g, '/'));
  }
}
