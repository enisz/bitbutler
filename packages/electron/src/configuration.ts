import type { BbcFile, BbcMetadata, BbcServer, ServerProtocol } from '@bitbutler/shared';
import db from './db.js';
import { requireNonEmptyHost, requirePort, requireString } from './server-validation.js';

export const BBC_VERSION = 1;

interface ServerExportRow {
  id: string;
  name: string;
  host: string;
  protocol: string;
  port: number;
  auto_login: number;
  created_at: string;
}

const stmtServers = db.prepare<[], ServerExportRow>(`
  SELECT id, name, host, protocol, port, auto_login, created_at
  FROM servers
  ORDER BY datetime(created_at) ASC, id ASC
`);

const stmtSettings = db.prepare<[], { id: string; json: string }>(`
  SELECT id, json FROM settings ORDER BY id ASC
`);

const stmtServerIds = db.prepare<[], { id: string }>(`SELECT id FROM servers`);

// Server-scoped settings rows are named <Service>.<serverId>.
const SERVER_SCOPED_ID = /^(.+)\.([^.]+)$/;

export function buildConfiguration(): BbcFile {
  const servers: Record<string, BbcServer> = {};
  for (const row of stmtServers.all()) {
    servers[row.id] = {
      id: row.id,
      name: row.name,
      host: row.host,
      protocol: row.protocol as ServerProtocol,
      port: row.port,
      auto_login: row.auto_login === 1,
      created_at: row.created_at,
      settings: {},
    };
  }

  const settings: Record<string, unknown> = {};
  for (const row of stmtSettings.all()) {
    let value: unknown;
    try {
      value = JSON.parse(row.json);
    } catch {
      continue;
    }

    const scoped = SERVER_SCOPED_ID.exec(row.id);
    if (scoped && Object.hasOwn(servers, scoped[2])) {
      servers[scoped[2]].settings[scoped[1]] = value;
    } else if (!row.id.includes('.')) {
      // Dotted ids that match no server (empty or deleted server id) are leftovers, not settings.
      settings[row.id] = value;
    }
  }

  return { version: BBC_VERSION, exported_at: Date.now(), settings, servers };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBlobs(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainObject(value)) throw new Error(`Invalid configuration file: ${label} is malformed.`);
  const out: Record<string, unknown> = {};
  for (const [key, blob] of Object.entries(value)) {
    if (key === '__proto__' || key === '' || key.includes('.')) {
      throw new Error(`Invalid configuration file: ${label} has an invalid key '${key}'.`);
    }
    if (!isPlainObject(blob)) {
      throw new Error(`Invalid configuration file: '${key}' in ${label} is not an object.`);
    }
    out[key] = blob;
  }
  return out;
}

function parseServer(key: string, value: unknown): BbcServer {
  if (!isPlainObject(value)) throw new Error('Invalid configuration file: a server is malformed.');

  const id = requireString(value['id'], 'id');
  if (id !== key || id.includes('.') || id === '__proto__') {
    throw new Error(`Invalid configuration file: server id '${key}' is invalid.`);
  }
  if (value['protocol'] !== 'http' && value['protocol'] !== 'https') {
    throw new Error(`Invalid configuration file: server '${id}' has an invalid protocol.`);
  }
  if (typeof value['auto_login'] !== 'boolean') {
    throw new Error(`Invalid configuration file: server '${id}' has an invalid auto_login.`);
  }

  return {
    id,
    name: requireString(value['name'], 'name'),
    host: requireNonEmptyHost(value['host'], 'host'),
    protocol: value['protocol'],
    port: requirePort(value['port'], 'port'),
    auto_login: value['auto_login'],
    created_at: requireString(value['created_at'], 'created_at'),
    settings: parseBlobs(value['settings'], `settings of server '${id}'`),
  };
}

export function parseConfiguration(raw: string): BbcFile {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    throw new Error('Invalid configuration file: not valid JSON.');
  }
  if (!isPlainObject(doc)) throw new Error('Invalid configuration file.');

  const version = doc['version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('Invalid configuration file: missing or invalid version.');
  }
  if (version > BBC_VERSION) {
    throw new Error(
      `This configuration file was made by a newer version of BitButler (file version ${version}).`,
    );
  }

  const exportedAt = doc['exported_at'];
  if (typeof exportedAt !== 'number' || !Number.isFinite(exportedAt)) {
    throw new Error('Invalid configuration file: missing or invalid exported_at.');
  }

  if (!isPlainObject(doc['servers'])) {
    throw new Error('Invalid configuration file: servers is malformed.');
  }
  const servers: Record<string, BbcServer> = {};
  for (const [key, value] of Object.entries(doc['servers'])) {
    servers[key] = parseServer(key, value);
  }

  return {
    version,
    exported_at: exportedAt,
    settings: parseBlobs(doc['settings'], 'settings'),
    servers,
  };
}

export function describeConfiguration(file: BbcFile): BbcMetadata {
  const local = new Set(stmtServerIds.all().map((row) => row.id));
  return {
    version: file.version,
    exportedAt: file.exported_at,
    hasSettings: Object.keys(file.settings).length > 0,
    servers: Object.values(file.servers).map((server) => ({
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      exists: local.has(server.id),
    })),
  };
}
