import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

const dbPath = path.join(app.getPath('userData'), 'bitbutler.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS servers (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    host         TEXT NOT NULL,
    protocol     TEXT NOT NULL CHECK (protocol IN ('http','https')),
    port         INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
    username     TEXT NOT NULL,
    password     BLOB NOT NULL,
    auto_login   INTEGER NOT NULL DEFAULT 0 CHECK (auto_login IN (0,1)),
    created_at   TEXT NOT NULL
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_servers_auto_login
  ON servers(auto_login);
`);

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS uq_servers_auto_login
  ON servers(auto_login)
  WHERE auto_login = 1;
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id   TEXT PRIMARY KEY,
    json TEXT NOT NULL
  );
`);

export default db;
