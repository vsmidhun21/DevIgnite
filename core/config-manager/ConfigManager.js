// core/config-manager/ConfigManager.js
// Manages per-environment configuration overrides stored in SQLite.
// Provides merged config: defaults ← project settings ← env override.

import { getDb } from '../db/database.js';

// const { getDb } = require('../db/database');

export class ConfigManager {
  constructor(dbPath) {
    this.db = getDb(dbPath);

    this._stmts = {
      getEnv:    this.db.prepare('SELECT * FROM environments WHERE project_id=? AND name=?'),
      listEnvs:  this.db.prepare('SELECT * FROM environments WHERE project_id=?'),
      upsertEnv: this.db.prepare(`
        INSERT INTO environments (project_id, name, command, port, env_vars)
        VALUES (@project_id, @name, @command, @port, @env_vars)
        ON CONFLICT(project_id, name) DO UPDATE SET
          command  = excluded.command,
          port     = excluded.port,
          env_vars = excluded.env_vars
      `),
    };
  }

  /**
   * Get the merged configuration for a project in a given environment.
   * Returns the project base config merged with environment-specific overrides.
   *
   * @param {Project} project
   * @param {string} envName - 'dev' | 'staging' | 'prod'
   * @returns {MergedConfig}
   */
  getMergedConfig(project, envName) {
    const envRow = this._stmts.getEnv.get(project.id, envName);

    return {
      command:  envRow?.command  || project.command,
      port:     envRow?.port     || project.port,
      env_vars: envRow?.env_vars || '{}',
      env:      envName,
    };
  }

  /**
   * List all environment configs for a project.
   * @param {number} projectId
   * @returns {EnvironmentConfig[]}
   */
  listEnvs(projectId) {
    return this._stmts.listEnvs.all(projectId);
  }

  /**
   * Save/update environment-specific overrides.
   * @param {number} projectId
   * @param {string} envName
   * @param {{ command?: string, port?: number, env_vars?: Record<string,string> }} overrides
   */
  setEnvConfig(projectId, envName, overrides) {
    this._stmts.upsertEnv.run({
      project_id: projectId,
      name:       envName,
      command:    overrides.command  ?? null,
      port:       overrides.port     ?? null,
      env_vars:   typeof overrides.env_vars === 'object'
                    ? JSON.stringify(overrides.env_vars)
                    : (overrides.env_vars ?? '{}'),
    });
  }

  /**
   * Parse the env_vars JSON string from the DB into a plain object.
   * @param {string} envVarsJson
   * @returns {Record<string,string>}
   */
  parseEnvVars(envVarsJson) {
    try {
      return JSON.parse(envVarsJson || '{}');
    } catch {
      return {};
    }
  }
}

// module.exports = ConfigManager;
