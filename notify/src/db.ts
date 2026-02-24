import Database from 'better-sqlite3'
import { config } from './config.js'

let db: Database.Database

export function initDb(): Database.Database {
  db = new Database(config.dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_tokens (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      fid              INTEGER NOT NULL DEFAULT 0,
      token            TEXT NOT NULL UNIQUE,
      notification_url TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'active'
                       CHECK(status IN ('active','disabled','removed')),
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tokens_status
      ON notification_tokens(status);
    CREATE INDEX IF NOT EXISTS idx_tokens_token
      ON notification_tokens(token);
  `)
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.')
  return db
}
