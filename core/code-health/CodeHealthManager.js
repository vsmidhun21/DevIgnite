import path from 'path';
import { Scanner } from './scanner.js';
import { Parser } from './parser.js';
import { Analyzer } from './analyzer.js';

export class CodeHealthManager {
  constructor(projectManager) {
    this.projectManager = projectManager;
    this.progressCallback = null;
  }

  setProgressCallback(cb) {
    this.progressCallback = cb;
  }

  _emitProgress(projectId, stage, progress, message) {
    if (this.progressCallback) {
      this.progressCallback(projectId, { stage, progress, message });
    }
  }

  async analyze(projectId, options = {}) {
    const project = this.projectManager?.getById(projectId);
    if (!project) throw new Error('Project not found');

    const projectPath = project.path;
    const scope = options.scope || 'full';
    
    this._emitProgress(projectId, 'SCANNING', 10, 'Scanning project files...');
    const files = await Scanner.scanFiles(projectPath, scope);
    
    if (files.length === 0) {
      this._emitProgress(projectId, 'DONE', 100, 'No files found');
      return { summary: { totalScanned: 0, totalIssues: 0 }, issues: {} };
    }

    const analyzer = new Analyzer(projectPath, options.entryFiles || []);
    let parsedCount = 0;

    this._emitProgress(projectId, 'PARSING', 20, `Parsing 0 / ${files.length} files...`);

    for (const file of files) {
      // Allow async yielding to not block main thread heavily
      await new Promise(r => setTimeout(r, 0)); 
      
      const parsedData = Parser.parseFile(file);
      if (parsedData) {
        analyzer.addFileData(file, parsedData);
      }
      parsedCount++;
      
      if (parsedCount % 10 === 0 || parsedCount === files.length) {
        const percent = 20 + Math.floor((parsedCount / files.length) * 50);
        this._emitProgress(projectId, 'PARSING', percent, `Parsing ${parsedCount} / ${files.length} files...`);
      }
    }

    this._emitProgress(projectId, 'ANALYZING', 80, 'Building dependency graph and detecting dead code...');
    await new Promise(r => setTimeout(r, 0));

    const results = analyzer.analyze();

    const summary = {
      totalScanned: files.length,
      totalIssues: results.unusedFiles.length + results.unusedFunctions.length + results.unusedVariables.length + results.unusedImports.length
    };

    this._emitProgress(projectId, 'DONE', 100, 'Analysis complete');

    return {
      summary,
      issues: results
    };
  }
}
