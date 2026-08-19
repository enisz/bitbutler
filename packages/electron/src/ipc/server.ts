import type { NewServer, ServerRecord } from '@bitbutler/shared';
import { ipcMain, safeStorage } from 'electron';
import crypto from 'node:crypto';
import db from '../db.js';
import { rebuildMenu } from '../menu.js';
import { rebuildTrayMenu } from '../tray.js';
import { getCookieJar } from './qbittorrent.js';

let activeServerId: string | null = null;

export const getActiveServerId = (): string | null => activeServerId;
export const setActiveServerId = (id: string | null): void => {
  activeServerId = id;
};

export function registerServerIpcHandlers(): void {
  ipcMain.handle('server:list', async () => serverList());
  ipcMain.handle('server:add', async (_event, server: unknown) => serverAdd(server));
  ipcMain.handle('server:update', async (_event, payload: unknown) => serverUpdate(payload));
  ipcMain.handle('server:delete', async (_event, payload: unknown) => serverDelete(payload));
  ipcMain.handle('server:getById', async (_event, payload: unknown) => serverGetById(payload));
  ipcMain.handle('server:getByHost', async (_event, payload: unknown) => serverGetByHost(payload));
  ipcMain.handle('server:set-connection-info', async (_event, payload: unknown) =>
    serverSetConnectionInfo(payload),
  );

  ipcMain.on('server:set-active', (_event, id: string | null) => {
    activeServerId = id;
    rebuildMenu();
    rebuildTrayMenu();
  });
}

interface ServerRow {
  id: string;
  name: string;
  host: string;
  protocol: string;
  port: number;
  username: string;
  password: Buffer;
  auto_login: number;
  created_at: string;
  has_password: number;
  export_available: number | null;
  webapi_version: string | null;
  qb_version: string | null;
}

const stmtList = db.prepare<[], ServerRow>(`
  SELECT
    id, name, host, protocol, port, username,
    auto_login,
    export_available,
    webapi_version,
    qb_version,
    created_at,
    CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END as has_password
  FROM servers
  ORDER BY datetime(created_at) DESC
`);

const stmtGetById = db.prepare<[string], ServerRow>(`
  SELECT
    id, name, host, protocol, port, username,
    auto_login,
    export_available,
    webapi_version,
    qb_version,
    created_at,
    CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END as has_password
  FROM servers
  WHERE id = ?
`);

const stmtGetByHost = db.prepare<[string], ServerRow>(`
  SELECT
    id, name, host, protocol, port, username,
    auto_login,
    export_available,
    webapi_version,
    qb_version,
    created_at,
    CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END as has_password
  FROM servers
  WHERE host = ?
`);

const stmtInsert = db.prepare(`
  INSERT INTO servers (
    id, name, host, protocol, port, username, password, auto_login, created_at
  ) VALUES (
    @id, @name, @host, @protocol, @port, @username, @password, @auto_login, @created_at
  )
`);

const stmtUpdate = db.prepare(`
  UPDATE servers SET
    name = COALESCE(@name, name),
    host = COALESCE(@host, host),
    protocol = COALESCE(@protocol, protocol),
    port = COALESCE(@port, port),
    username = COALESCE(@username, username),
    password = COALESCE(@password, password),
    auto_login = COALESCE(@auto_login, auto_login)
  WHERE id = @id
`);

const stmtUpdateWithPassword = db.prepare(`
  UPDATE servers SET
    name = COALESCE(@name, name),
    host = COALESCE(@host, host),
    protocol = COALESCE(@protocol, protocol),
    port = COALESCE(@port, port),
    username = COALESCE(@username, username),
    password = @password,
    auto_login = COALESCE(@auto_login, auto_login)
  WHERE id = @id
`);

const stmtDelete = db.prepare<[string]>(`DELETE FROM servers WHERE id = ?`);
const stmtUnsetAutoLogin = db.prepare(`UPDATE servers SET auto_login = 0 WHERE auto_login = 1`);
const stmtSetAutoLogin = db.prepare<[string]>(`UPDATE servers SET auto_login = 1 WHERE id = ?`);
const stmtSetConnectionInfo = db.prepare<[number, string, string, string]>(`
  UPDATE servers SET export_available = ?, webapi_version = ?, qb_version = ? WHERE id = ?
`);
const stmtResetConnectionInfo = db.prepare<[string]>(`
  UPDATE servers SET export_available = NULL, webapi_version = NULL, qb_version = NULL WHERE id = ?
`);

const txInsertWithAutoLogin = db.transaction((row: Record<string, unknown>) => {
  if (row['auto_login'] === 1) stmtUnsetAutoLogin.run();
  stmtInsert.run(row);
});

function rowToRecord(row: ServerRow): ServerRecord {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    protocol: row.protocol as ServerRecord['protocol'],
    port: row.port,
    username: row.username,
    auto_login: row.auto_login === 1,
    created_at: row.created_at,
    has_password: row.has_password === 1,
    export_available: row.export_available as 0 | 1 | null,
    webapi_version: row.webapi_version,
    qb_version: row.qb_version,
  };
}

export function serverList(): ServerRecord[] {
  return stmtList.all().map(rowToRecord);
}

function serverGetById(payload: unknown): ServerRecord | null {
  const id = requireString((payload as Record<string, unknown>)?.id, 'id');
  const row = stmtGetById.get(id);
  return row ? rowToRecord(row) : null;
}

function serverGetByHost(payload: unknown): ServerRecord | null {
  const host = requireNonEmptyHost((payload as Record<string, unknown>)?.host, 'host');
  const row = stmtGetByHost.get(host);
  return row ? rowToRecord(row) : null;
}

export function getExportAvailable(id: string): 0 | 1 | null {
  const row = stmtGetById.get(id);
  return row ? (row.export_available as 0 | 1 | null) : null;
}

export function setConnectionInfo(
  id: string,
  info: { exportAvailable: 0 | 1; webapiVersion: string; qbVersion: string },
): void {
  stmtSetConnectionInfo.run(info.exportAvailable, info.webapiVersion, info.qbVersion, id);
}

function serverSetConnectionInfo(payload: unknown): { updated: boolean } {
  const p = payload as Record<string, unknown>;
  const id = requireString(p?.id, 'id');
  const exportAvailable = p?.exportAvailable;
  if (exportAvailable !== 0 && exportAvailable !== 1) {
    throw new Error("Field 'exportAvailable' must be 0 or 1.");
  }
  const webapiVersion = requireString(p?.webapiVersion, 'webapiVersion');
  const qbVersion = requireString(p?.qbVersion, 'qbVersion');
  setConnectionInfo(id, { exportAvailable, webapiVersion, qbVersion });
  return { updated: true };
}

function serverDelete(payload: unknown): { deleted: boolean } {
  const id = requireString((payload as Record<string, unknown>)?.id, 'id');
  const info = stmtDelete.run(id);
  const deleted = info.changes > 0;
  if (deleted) {
    console.info(`[BitButler][server] Deleted server ${id}.`);
    getCookieJar().delete(id);
    rebuildMenu();
  }
  return { deleted };
}

function serverAdd(server: unknown): { id: string } {
  const normalized = normalizeNewServer(server);

  const row = {
    id: normalized.id ?? crypto.randomUUID(),
    name: normalized.name,
    host: normalized.host,
    protocol: normalized.protocol,
    port: normalized.port,
    username: normalized.username,
    password: encryptPassword(normalized.password),
    auto_login: normalized.auto_login ? 1 : 0,
    created_at: new Date().toISOString(),
  };

  try {
    txInsertWithAutoLogin(row);
    console.info(`[BitButler][server] Added server ${row.id} (${row.host}).`);
    rebuildMenu();
    return { id: row.id };
  } catch (err) {
    throw new Error(toUserDbError(err));
  }
}

function serverUpdate(payload: unknown): { updated: boolean } {
  const p = payload as Record<string, unknown>;
  const id = requireString(p?.id, 'id');
  const changes = p?.changes;

  if (!changes || typeof changes !== 'object') {
    throw new Error('No changes provided.');
  }

  const changesObj = changes as Record<string, unknown>;
  const hasExplicitPassword = 'password' in changesObj;
  const connectionChanged =
    'host' in changesObj ||
    'port' in changesObj ||
    'protocol' in changesObj ||
    'useHttps' in changesObj;
  const normalized = normalizeUpdate(changesObj);

  const row = {
    id,
    name: normalized.name,
    host: normalized.host,
    protocol: normalized.protocol,
    port: normalized.port,
    username: normalized.username,
    password: normalized.password,
    auto_login: normalized.auto_login === undefined ? undefined : normalized.auto_login ? 1 : 0,
  };

  const tx = db.transaction(() => {
    if (row.auto_login === 1) stmtUnsetAutoLogin.run();
    const stmt = hasExplicitPassword ? stmtUpdateWithPassword : stmtUpdate;
    const info = stmt.run(row);
    if (connectionChanged) stmtResetConnectionInfo.run(id);
    return info.changes > 0;
  });

  try {
    const updated = tx();
    if (updated) {
      console.info(`[BitButler][server] Updated server ${id}.`);
      rebuildMenu();
    }
    return { updated };
  } catch (err) {
    throw new Error(toUserDbError(err));
  }
}

function normalizeNewServer(input: unknown): NewServer & { id?: string } {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid server payload.');
  }

  const i = input as Record<string, unknown>;

  const name = requireString(i['name'], 'name');
  const host = requireNonEmptyHost(i['host'], 'host');
  const protocol =
    i['protocol'] === 'https' || i['useHttps'] === true ? ('https' as const) : ('http' as const);
  const port = requirePort(i['port'], 'port');
  const username = typeof i['username'] === 'string' ? i['username'] : '';
  const password = typeof i['password'] === 'string' ? i['password'] : '';
  const auto_login = Boolean(i['auto_login'] ?? i['autoLogin'] ?? false);
  const id = i['id'] ? requireString(i['id'], 'id') : undefined;

  return { id, name, host, protocol, port, username, password, auto_login };
}

function normalizeUpdate(
  input: Record<string, unknown>,
): Partial<NewServer> & { password?: Buffer | null } {
  const out: Record<string, unknown> = {};

  if ('name' in input) out['name'] = requireString(input['name'], 'name');
  if ('host' in input) out['host'] = requireNonEmptyHost(input['host'], 'host');

  if ('protocol' in input || 'useHttps' in input) {
    out['protocol'] =
      input['protocol'] === 'https' || input['useHttps'] === true ? 'https' : 'http';
  }

  if ('port' in input) out['port'] = requirePort(input['port'], 'port');
  if ('username' in input)
    out['username'] = typeof input['username'] === 'string' ? input['username'] : '';
  if ('password' in input) out['password'] = encryptPassword(input['password'] as string);

  if ('auto_login' in input || 'autoLogin' in input) {
    out['auto_login'] = Boolean(input['auto_login'] ?? input['autoLogin']);
  }

  return out as Partial<NewServer> & { password?: Buffer | null };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Field '${field}' is required.`);
  }
  return value.trim();
}

function requireNonEmptyHost(value: unknown, field: string): string {
  const host = requireString(value, field);
  if (host.includes('://') || host.includes('/') || host.includes(' ')) {
    throw new Error(`Field '${field}' must be a host only (no protocol/path).`);
  }
  return host;
}

function requirePort(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Field '${field}' must be an integer between 1 and 65535.`);
  }
  return n;
}

function toUserDbError(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);

  if (msg.includes('UNIQUE') && msg.includes('servers.host')) {
    return 'A server with the same host already exists.';
  }

  if (msg.includes('uq_servers_auto_login')) {
    return 'Only one server can be set for auto-login.';
  }

  return `Database error: ${msg}`;
}

function encryptPassword(plain: unknown): Buffer | null {
  if (!plain || (typeof plain === 'string' && plain.length === 0)) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    console.error('[BitButler][server] Cannot save password: OS encryption is unavailable.');
    throw new Error('Encryption is not available on this system (safeStorage).');
  }
  return safeStorage.encryptString(plain as string);
}
