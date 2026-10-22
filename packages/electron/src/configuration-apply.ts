import type { BbcFile, BbcImportResult } from '@bitbutler/shared';
import db from './db.js';
import { getCookieJar } from './ipc/qbittorrent.js';
import { rebuildMenu } from './menu.js';

interface ExistingServer {
  host: string;
  port: number;
  protocol: string;
}

const stmtExisting = db.prepare<[string], ExistingServer>(
  `SELECT host, port, protocol FROM servers WHERE id = ?`,
);

const stmtUpsertSetting = db.prepare<[string, string]>(`
  INSERT INTO settings (id, json) VALUES (?, ?)
  ON CONFLICT(id) DO UPDATE SET json = excluded.json
`);

const stmtUnsetAutoLogin = db.prepare(`UPDATE servers SET auto_login = 0 WHERE auto_login = 1`);

const stmtUpdateServer = db.prepare(`
  UPDATE servers SET
    name = @name, host = @host, protocol = @protocol, port = @port, auto_login = @auto_login
  WHERE id = @id
`);

// A server that is pointed somewhere else must not carry its old credentials along.
const stmtResetConnection = db.prepare<[string]>(`
  UPDATE servers SET
    export_available = NULL, webapi_version = NULL, qb_version = NULL,
    username = '', password = NULL
  WHERE id = ?
`);

// Imported servers carry no credentials: empty username, NULL password.
const stmtInsertServer = db.prepare(`
  INSERT INTO servers (id, name, host, protocol, port, username, password, auto_login, created_at)
  VALUES (@id, @name, @host, @protocol, @port, '', NULL, @auto_login, @created_at)
`);

export function applyConfiguration(
  file: BbcFile,
  selection: { applySettings: boolean; serverIds: string[] },
): BbcImportResult {
  for (const id of selection.serverIds) {
    if (!Object.hasOwn(file.servers, id)) throw new Error(`Server ${id} is not in the file.`);
  }
  const wanted = new Set(selection.serverIds);
  const selected = Object.values(file.servers).filter((server) => wanted.has(server.id));
  const droppedCookies: string[] = [];

  const tx = db.transaction(() => {
    // Only one server may auto-login: the first selected one in file order.
    const autoLoginId = selected.find((server) => server.auto_login)?.id;
    if (autoLoginId) stmtUnsetAutoLogin.run();

    if (selection.applySettings) {
      for (const [id, blob] of Object.entries(file.settings)) {
        stmtUpsertSetting.run(id, JSON.stringify(blob));
      }
    }

    for (const server of selected) {
      const row = {
        id: server.id,
        name: server.name,
        host: server.host,
        protocol: server.protocol,
        port: server.port,
        auto_login: server.id === autoLoginId ? 1 : 0,
        created_at: server.created_at,
      };

      const existing = stmtExisting.get(server.id);
      if (existing) {
        stmtUpdateServer.run(row);
        if (
          existing.host !== server.host ||
          existing.port !== server.port ||
          existing.protocol !== server.protocol
        ) {
          stmtResetConnection.run(server.id);
          droppedCookies.push(server.id);
        }
      } else {
        stmtInsertServer.run(row);
      }

      for (const [service, blob] of Object.entries(server.settings)) {
        stmtUpsertSetting.run(`${service}.${server.id}`, JSON.stringify(blob));
      }
    }
  });

  tx();

  const cookieJar = getCookieJar();
  for (const id of droppedCookies) cookieJar.delete(id);
  rebuildMenu();

  return { settings: selection.applySettings, servers: selected.length };
}
