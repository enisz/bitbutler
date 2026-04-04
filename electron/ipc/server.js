import crypto from 'crypto';
import { ipcMain, safeStorage } from 'electron';
import db from '../db.js';
import { rebuildMenu } from '../menu.js';

let activeServerId = null;

export const getActiveServerId = () => activeServerId;
export const setActiveServerId = (id) => {
  activeServerId = id;
};

/**
 * IPC handlers:
 * - server:list
 * - server:add
 * - server:delete
 * - server:getById
 * - server:getByHost
 */

export function registerServerIpcHandlers() {
  ipcMain.handle('server:list', async () => serverList());
  ipcMain.handle('server:add', async (_event, server) => serverAdd(server));
  ipcMain.handle('server:update', async (_event, payload) => serverUpdate(payload));
  ipcMain.handle('server:delete', async (_event, payload) => serverDelete(payload));
  ipcMain.handle('server:getById', async (_event, payload) => serverGetById(payload));
  ipcMain.handle('server:getByHost', async (_event, payload) => serverGetByHost(payload));

  ipcMain.on('server:set-active', (_event, id) => {
    if (activeServerId !== id) {
      activeServerId = id;
      rebuildMenu();
    }
  });
}

const stmtList = db.prepare(`
  SELECT
    id, name, host, protocol, port, username,
    auto_login,
    created_at,
    1 as has_password
  FROM servers
  ORDER BY datetime(created_at) DESC
`);

const stmtGetById = db.prepare(`
  SELECT
    id, name, host, protocol, port, username,
    auto_login,
    created_at,
    1 as has_password
  FROM servers
  WHERE id = ?
`);

const stmtGetByHost = db.prepare(`
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

const stmtDelete = db.prepare(`DELETE FROM servers WHERE id = ?`);
const stmtUnsetAutoLogin = db.prepare(`UPDATE servers SET auto_login = 0 WHERE auto_login = 1`);
const stmtSetAutoLogin = db.prepare(`UPDATE servers SET auto_login = 1 WHERE id = ?`);

const txInsertWithAutoLogin = db.transaction((row) => {
  if (row.auto_login === 1) stmtUnsetAutoLogin.run();
  stmtInsert.run(row);
});

export function serverList() {
  return stmtList.all();
}

function serverGetById(payload) {
  const id = requireString(payload?.id, 'id');
  return stmtGetById.get(id) ?? null;
}

function serverGetByHost(payload) {
  const host = requireNonEmptyHost(payload?.host, 'host');
  return stmtGetByHost.get(host) ?? null;
}

function serverDelete(payload) {
  const id = requireString(payload?.id, 'id');
  const info = stmtDelete.run(id);
  const deleted = info.changes > 0;
  if (deleted) {
    rebuildMenu();
  }
  return { deleted };
}

function serverAdd(server) {
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
    const msg = toUserDbError(err);
    throw new Error(msg);
  }
}

function serverUpdate(payload) {
  const id = requireString(payload?.id, 'id');
  const changes = payload?.changes;

  if (!changes || typeof changes !== 'object') {
    throw new Error('No changes provided.');
  }

  const normalized = normalizeUpdate(changes);

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
    if (row.auto_login === 1) {
      stmtUnsetAutoLogin.run();
    }

    const info = stmtUpdate.run(row);
    return info.changes > 0;
  });

  try {
    const updated = tx();
    if (updated) {
      rebuildMenu();
    }
    return { updated };
  } catch (err) {
    throw new Error(toUserDbError(err));
  }
}

function normalizeNewServer(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid server payload.');
  }

  const name = requireString(input.name, 'name');
  const host = requireNonEmptyHost(input.host, 'host');

  const protocol = input.protocol === 'https' || input.useHttps === true ? 'https' : 'http';

  const port = requirePort(input.port, 'port');

  const username = requireString(input.username ?? '', 'username');

  const password = requirePasswordString(input.password, 'password');

  const auto_login = Boolean(input.auto_login ?? input.autoLogin ?? false);

  const id = input.id ? requireString(input.id, 'id') : undefined;

  return { id, name, host, protocol, port, username, password, auto_login };
}

function normalizeUpdate(input) {
  const out = {};

  if ('name' in input) out.name = requireString(input.name, 'name');
  if ('host' in input) out.host = requireNonEmptyHost(input.host, 'host');

  if ('protocol' in input || 'useHttps' in input) {
    out.protocol = input.protocol === 'https' || input.useHttps === true ? 'https' : 'http';
  }

  if ('port' in input) out.port = requirePort(input.port, 'port');
  if ('username' in input) out.username = requireString(input.username, 'username');

  if ('password' in input) {
    out.password = encryptPassword(input.password);
  }

  if ('auto_login' in input || 'autoLogin' in input) {
    out.auto_login = Boolean(input.auto_login ?? input.autoLogin);
  }

  return out;
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Field '${field}' is required.`);
  }
  return value.trim();
}

function requireNonEmptyHost(value, field) {
  const host = requireString(value, field);
  if (host.includes('://') || host.includes('/') || host.includes(' ')) {
    throw new Error(`Field '${field}' must be a host only (no protocol/path).`);
  }
  return host;
}

function requirePort(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Field '${field}' must be an integer between 1 and 65535.`);
  }
  return n;
}

function requireBlob(value, field) {
  if (!value) throw new Error(`Field '${field}' is required.`);

  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);

  if (typeof value === 'string') {
    try {
      return Buffer.from(value, 'base64');
    } catch {}
  }

  throw new Error(`Field '${field}' must be a Buffer/Uint8Array (or base64 string).`);
}

function toUserDbError(err) {
  const msg = String(err?.message ?? err);

  if (msg.includes('UNIQUE') && msg.includes('servers.host')) {
    return 'A server with the same host already exists.';
  }

  if (msg.includes('uq_servers_auto_login')) {
    return 'Only one server can be set for auto-login.';
  }

  return `Database error: ${msg}`;
}

function encryptPassword(plain) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system (safeStorage).');
  }
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error("Field 'password' is required.");
  }
  return safeStorage.encryptString(plain);
}

function requirePasswordString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Field '${field}' is required.`);
  }
  return value;
}
