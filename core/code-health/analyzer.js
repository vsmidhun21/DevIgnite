import path from 'path';
import fs from 'fs';

export class Analyzer {
  constructor(projectPath, entryFiles = []) {
    this.projectPath = projectPath;
    // Default common entry files
    this.entryFiles = new Set(
      entryFiles.length > 0 
        ? entryFiles.map(e => path.resolve(projectPath, e).replace(/\\/g, '/'))
        : [
            path.resolve(projectPath, 'src/index.js').replace(/\\/g, '/'),
            path.resolve(projectPath, 'src/main.js').replace(/\\/g, '/'),
            path.resolve(projectPath, 'src/main.jsx').replace(/\\/g, '/'),
            path.resolve(projectPath, 'src/main.ts').replace(/\\/g, '/'),
            path.resolve(projectPath, 'src/main.tsx').replace(/\\/g, '/'),
            path.resolve(projectPath, 'src/App.jsx').replace(/\\/g, '/'),
            path.resolve(projectPath, 'index.js').replace(/\\/g, '/'),
            path.resolve(projectPath, 'main.js').replace(/\\/g, '/'),
          ]
    );
    this.files = new Map();
    this.dependencyGraph = new Map();
  }

  addFileData(filePath, parsedData) {
    if (!parsedData) return;
    this.files.set(filePath, parsedData);
  }

  resolveImportPath(baseFile, importSource) {
    if (!importSource.startsWith('.')) return null; // Node module or alias (too complex to resolve aliases without tsconfig/webpack)
    
    const dir = path.dirname(baseFile);
    let resolved = path.resolve(dir, importSource).replace(/\\/g, '/');
    
    // Extensions to try
    const exts = ['.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx', '/index.ts', '/index.tsx'];
    
    if (this.files.has(resolved)) return resolved;
    
    for (const ext of exts) {
      if (this.files.has(resolved + ext)) return resolved + ext;
    }
    
    return null;
  }

  analyze() {
    const results = {
      unusedFiles: [],
      unusedFunctions: [],
      unusedVariables: [],
      unusedImports: []
    };

    const importedFiles = new Set();

    // 1. Resolve imports and build graph
    for (const [filePath, data] of this.files.entries()) {
      const { extracted } = data;
      
      extracted.imports.forEach(imp => {
        const targetPath = this.resolveImportPath(filePath, imp.source);
        if (targetPath) {
          importedFiles.add(targetPath);
        }
      });
    }

    // 2. Find unused files
    for (const filePath of this.files.keys()) {
      if (!importedFiles.has(filePath) && !this.entryFiles.has(filePath)) {
        // Double check if it's not a common config file
        if (!filePath.match(/vite\.config|webpack|setupTests|jest|tailwind|postcss|\.test\.|\.spec\./)) {
          results.unusedFiles.push({
            file: filePath,
            confidence: 'Medium', // Might be used dynamically or as an entry we missed
            codeSnippet: `// File not imported anywhere: ${path.basename(filePath)}`
          });
        }
      }
    }

    // 3. Find unused code inside each file
    for (const [filePath, data] of this.files.entries()) {
      const { extracted } = data;
      const used = extracted.usedIdentifiers;
      
      // We assume exported things might be used elsewhere if the file is imported.
      // But if it's a completely unused file, its exports are also dead.
      // Let's focus on internal dead code: functions/variables not exported AND not used.
      
      const exportedNames = new Set(extracted.exports.map(e => e.name));

      extracted.functions.forEach(fn => {
        if (!used.has(fn.name) && !exportedNames.has(fn.name) && fn.name !== 'default') {
          results.unusedFunctions.push({
            file: filePath,
            name: fn.name,
            loc: fn.loc,
            codeSnippet: fn.code || `function ${fn.name}() {...}`,
            confidence: 'High'
          });
        }
      });

      extracted.variables.forEach(v => {
        if (!used.has(v.name) && !exportedNames.has(v.name)) {
          // React heuristics: ignore unused React imports or basic hooks if needed, but we do standard checks
          results.unusedVariables.push({
            file: filePath,
            name: v.name,
            loc: v.loc,
            codeSnippet: v.code || `const ${v.name} = ...`,
            confidence: 'High'
          });
        }
      });

      extracted.imports.forEach(imp => {
        if (!used.has(imp.name) && imp.name !== 'React') {
          results.unusedImports.push({
            file: filePath,
            name: imp.name,
            loc: imp.loc,
            codeSnippet: `import ${imp.name} from '${imp.source}'`,
            confidence: 'High'
          });
        }
      });
    }

    return results;
  }
}
