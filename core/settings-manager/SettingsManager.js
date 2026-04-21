// core/settings-manager/SettingsManager.js
import { getDb } from '../db/database.js';

export class SettingsManager {
  constructor(dbPath) {
    this.db = getDb(dbPath);
    this._stmts = {
      get: this.db.prepare('SELECT * FROM app_settings WHERE id = 1'),
      incrementLaunch: this.db.prepare(`
        UPDATE app_settings 
        SET launch_count = launch_count + 1, 
            session_count_since_later = session_count_since_later + 1,
            updated_at = datetime('now')
        WHERE id = 1
      `),
      incrementProjectLaunch: this.db.prepare(`
        UPDATE app_settings 
        SET project_launch_count = project_launch_count + 1,
            updated_at = datetime('now')
        WHERE id = 1
      `),
      updateStatus: this.db.prepare(`
        UPDATE app_settings 
        SET sponsorship_status = ?, 
            last_shown_at = datetime('now'),
            session_count_since_later = 0,
            updated_at = datetime('now')
        WHERE id = 1
      `)
    };
  }

  getSettings() {
    return this._stmts.get.get();
  }

  incrementLaunchCount() {
    return this._stmts.incrementLaunch.run();
  }

  incrementProjectLaunchCount() {
    return this._stmts.incrementProjectLaunch.run();
  }

  updateSponsorshipStatus(status) {
    return this._stmts.updateStatus.run(status);
  }

  getCustomTags() {
    const settings = this.getSettings();
    try {
      return (settings?.custom_tags && JSON.parse(settings.custom_tags)) || [];
    } catch {
      return [];
    }
  }

  addCustomTag(tag) {
    if (!tag?.trim()) return;
    const tags = this.getCustomTags();
    if (!tags.includes(tag)) {
      tags.push(tag);
      const stmt = this.db.prepare(`UPDATE app_settings SET custom_tags = ? WHERE id = 1`);
      stmt.run(JSON.stringify(tags));
    }
  }

  removeCustomTag(tag) {
    const tags = this.getCustomTags();
    const idx = tags.indexOf(tag);
    if (idx > -1) {
      tags.splice(idx, 1);
      const stmt = this.db.prepare(`UPDATE app_settings SET custom_tags = ? WHERE id = 1`);
      stmt.run(JSON.stringify(tags));
    }
  }
}
