import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';

const dbPath = path.join(app.getPath('userData'), 'bitbutler.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

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
    created_at   TEXT NOT NULL,
    export_available INTEGER CHECK (export_available IN (0,1)),
    webapi_version TEXT,
    qb_version   TEXT
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

// Migrate: make password nullable (allow servers without stored credentials)
interface ColInfo {
  name: string;
  notnull: number;
}
const cols = db.pragma('table_info(servers)') as ColInfo[];
const pwCol = cols.find((c) => c.name === 'password');
if (pwCol?.notnull === 1) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE servers_new (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        host         TEXT NOT NULL,
        protocol     TEXT NOT NULL CHECK (protocol IN ('http','https')),
        port         INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
        username     TEXT NOT NULL DEFAULT '',
        password     BLOB,
        auto_login   INTEGER NOT NULL DEFAULT 0 CHECK (auto_login IN (0,1)),
        created_at   TEXT NOT NULL
      )
    `);
    db.exec(`
      INSERT INTO servers_new (id, name, host, protocol, port, username, password, auto_login, created_at)
      SELECT id, name, host, protocol, port, username, password, auto_login, created_at FROM servers
    `);
    db.exec(`DROP TABLE servers`);
    db.exec(`ALTER TABLE servers_new RENAME TO servers`);
  })();
  db.exec(`CREATE INDEX IF NOT EXISTS idx_servers_auto_login ON servers(auto_login)`);
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_servers_auto_login ON servers(auto_login) WHERE auto_login = 1`,
  );
}

// Migrate: add export_available column (nullable - NULL means "not yet checked").
const colsAfterPasswordMigration = db.pragma('table_info(servers)') as ColInfo[];
if (!colsAfterPasswordMigration.find((c) => c.name === 'export_available')) {
  db.exec(`
    ALTER TABLE servers ADD COLUMN export_available INTEGER CHECK (export_available IN (0,1))
  `);
}

// Migrate: add webapi_version/qb_version columns (nullable - NULL means "not yet checked").
const colsAfterExportAvailableMigration = db.pragma('table_info(servers)') as ColInfo[];
if (!colsAfterExportAvailableMigration.find((c) => c.name === 'webapi_version')) {
  db.exec(`ALTER TABLE servers ADD COLUMN webapi_version TEXT`);
}
if (!colsAfterExportAvailableMigration.find((c) => c.name === 'qb_version')) {
  db.exec(`ALTER TABLE servers ADD COLUMN qb_version TEXT`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id   TEXT PRIMARY KEY,
    json TEXT NOT NULL
  );
`);

// Migrate abbreviated setting IDs (produced by minified builds) to full service names.
// If the target ID already exists (migration ran before, abbreviated ID was re-written by
// a minified build), delete the stale abbreviated row instead of attempting a rename.
const stmtDeleteOldIfNewExists = db.prepare<[string, string]>(`
  DELETE FROM settings WHERE id = ? AND EXISTS (SELECT 1 FROM settings WHERE id = ?)
`);
const stmtRenameId = db.prepare<[string, string]>(`
  UPDATE settings SET id = ? WHERE id = ?
`);

const abbreviatedIds: [string, string][] = [
  ['GeneralSettingsService', 't'],
  ['StatusBarSettingsService', 'e'],
  ['TorrentListGridSettingsService', 'i'],
];

for (const [newId, oldId] of abbreviatedIds) {
  stmtDeleteOldIfNewExists.run(oldId, newId);
  stmtRenameId.run(newId, oldId);
}

// Migrate server-scoped settings: r.<serverId> → ServerSettingsService.<serverId>
const stmtSelectServerIds = db.prepare<[], { id: string }>(`
  SELECT id FROM settings WHERE id LIKE 'r.%'
`);

for (const row of stmtSelectServerIds.all()) {
  const serverId = row.id.slice(2);
  const newId = `ServerSettingsService.${serverId}`;
  stmtDeleteOldIfNewExists.run(row.id, newId);
  stmtRenameId.run(newId, row.id);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    process   TEXT NOT NULL CHECK (process IN ('main','renderer')),
    level     TEXT NOT NULL CHECK (level IN ('debug','info','warn','error')),
    message   TEXT NOT NULL
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp
  ON logs(timestamp);
`);

// Migrate: add context/filename/line columns (nullable - populated only when available).
const logCols = db.pragma('table_info(logs)') as ColInfo[];
if (!logCols.find((c) => c.name === 'context')) {
  db.exec(`ALTER TABLE logs ADD COLUMN context TEXT`);
}
if (!logCols.find((c) => c.name === 'filename')) {
  db.exec(`ALTER TABLE logs ADD COLUMN filename TEXT`);
}
if (!logCols.find((c) => c.name === 'line')) {
  db.exec(`ALTER TABLE logs ADD COLUMN line INTEGER`);
}

db.exec(`DROP TRIGGER IF EXISTS trg_logs_retention`);

db.exec(`
  CREATE TRIGGER trg_logs_retention
  AFTER INSERT ON logs
  BEGIN
    DELETE FROM logs
    WHERE timestamp < (CAST(strftime('%s','now') AS INTEGER) - 30*24*60*60) * 1000;

    DELETE FROM logs
    WHERE id <= (SELECT MAX(id) FROM logs) - 100000;
  END;
`);

export default db;
