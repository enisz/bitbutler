import type { NewServer, ServerRecord } from '@bitbutler/shared';
import crypto from 'crypto';
import { ipcMain, safeStorage } from 'electron';
import db from '../db.js';
import { rebuildMenu } from '../menu.js';
import { rebuildTrayMenu } from '../tray.js';

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

  ipcMain.on('server:set-active', (_event, id: string | null) => {
    if (activeServerId === id) return;
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
}

const stmtList = db.prepare<[], ServerRow>(`
  SELECT
    id, name, host, protocol, port, username,
    auto_login,
    created_at,
    1 as has_password
  FROM servers
  ORDER BY datetime(created_at) DESC
`);

const stmtGetById = db.prepare<[string], ServerRow>(`
  SELECT
    id, name, host, protocol, port, username,
    auto_login,
    created_at,
    1 as has_password
  FROM servers
  WHERE id = ?
`);

const stmtGetByHost = db.prepare<[string], ServerRow>(`
  SELECT
    id, name, host, protocol, port, username,
    auto_login,
    created_at,
    1 as has_password
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

const stmtDelete = db.prepare<[string]>(`DELETE FROM servers WHERE id = ?`);
const stmtUnsetAutoLogin = db.prepare(`UPDATE servers SET auto_login = 0 WHERE auto_login = 1`);
const stmtSetAutoLogin = db.prepare<[string]>(`UPDATE servers SET auto_login = 1 WHERE id = ?`);

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

function serverDelete(payload: unknown): { deleted: boolean } {
  const id = requireString((payload as Record<string, unknown>)?.id, 'id');
  const info = stmtDelete.run(id);
  const deleted = info.changes > 0;
  if (deleted) rebuildMenu();
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

  const normalized = normalizeUpdate(changes as Record<string, unknown>);

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
    const info = stmtUpdate.run(row);
    return info.changes > 0;
  });

  try {
    const updated = tx();
    if (updated) rebuildMenu();
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
  const username = requireString(i['username'] ?? '', 'username');
  const password = requirePasswordString(i['password'], 'password');
  const auto_login = Boolean(i['auto_login'] ?? i['autoLogin'] ?? false);
  const id = i['id'] ? requireString(i['id'], 'id') : undefined;

  return { id, name, host, protocol, port, username, password, auto_login };
}

function normalizeUpdate(
  input: Record<string, unknown>,
): Partial<NewServer> & { password?: Buffer } {
  const out: Record<string, unknown> = {};

  if ('name' in input) out['name'] = requireString(input['name'], 'name');
  if ('host' in input) out['host'] = requireNonEmptyHost(input['host'], 'host');

  if ('protocol' in input || 'useHttps' in input) {
    out['protocol'] =
      input['protocol'] === 'https' || input['useHttps'] === true ? 'https' : 'http';
  }

  if ('port' in input) out['port'] = requirePort(input['port'], 'port');
  if ('username' in input) out['username'] = requireString(input['username'], 'username');
  if ('password' in input) out['password'] = encryptPassword(input['password'] as string);

  if ('auto_login' in input || 'autoLogin' in input) {
    out['auto_login'] = Boolean(input['auto_login'] ?? input['autoLogin']);
  }

  return out as Partial<NewServer> & { password?: Buffer };
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

function encryptPassword(plain: unknown): Buffer {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system (safeStorage).');
  }
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error("Field 'password' is required.");
  }
  return safeStorage.encryptString(plain);
}

function requirePasswordString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Field '${field}' is required.`);
  }
  return value;
}
