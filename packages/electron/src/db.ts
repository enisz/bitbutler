import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';

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
    created_at   TEXT NOT NULL,
    export_available INTEGER CHECK (export_available IN (0,1))
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
    db.exec(`INSERT INTO servers_new SELECT * FROM servers`);
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

export default db;
