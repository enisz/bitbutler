import type { BbcFile } from '@bitbutler/shared';
import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildConfiguration, describeConfiguration, parseConfiguration } from './configuration.js';
import db from './db.js';

vi.mock('./db.js', async () => {
  const BetterSqlite = (await import('better-sqlite3')).default;
  const memory = new BetterSqlite(':memory:');
  memory.exec(`
    CREATE TABLE servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      protocol TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT NOT NULL DEFAULT '',
      password BLOB,
      auto_login INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      export_available INTEGER,
      webapi_version TEXT,
      qb_version TEXT
    );
    CREATE TABLE settings (id TEXT PRIMARY KEY, json TEXT NOT NULL);
  `);
  return { default: memory };
});

const conn = db as unknown as Database.Database;

function addServer(id: string, extra: Record<string, unknown> = {}): void {
  const row = {
    id,
    name: `name-${id}`,
    host: `host-${id}`,
    protocol: 'http',
    port: 8080,
    username: 'secret-user',
    password: Buffer.from('secret-pass'),
    auto_login: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    export_available: 1,
    webapi_version: '2.9.3',
    qb_version: 'v4.6.0',
    ...extra,
  };
  conn
    .prepare(
      `INSERT INTO servers VALUES (@id, @name, @host, @protocol, @port, @username, @password,
        @auto_login, @created_at, @export_available, @webapi_version, @qb_version)`,
    )
    .run(row);
}

function addSetting(id: string, value: unknown): void {
  conn.prepare('INSERT INTO settings (id, json) VALUES (?, ?)').run(id, JSON.stringify(value));
}

function validFile(): BbcFile {
  return {
    version: 1,
    exported_at: 1,
    settings: { GeneralSettingsService: { a: 1 } },
    servers: {
      s1: {
        id: 's1',
        name: 'One',
        host: 'one.example',
        protocol: 'https',
        port: 443,
        auto_login: false,
        created_at: '2026-01-01T00:00:00.000Z',
        settings: { ServerSettingsService: { b: 2 } },
      },
    },
  };
}

function withServer(patch: Record<string, unknown>): string {
  const file = validFile();
  Object.assign(file.servers['s1'], patch);
  return JSON.stringify(file);
}

beforeEach(() => {
  conn.exec('DELETE FROM servers; DELETE FROM settings;');
});

describe('buildConfiguration', () => {
  it('puts non-server rows under settings', () => {
    addSetting('GeneralSettingsService', { language: 'hu' });
    addSetting('StatusBarSettingsService', { visible: true });

    const file = buildConfiguration();

    expect(file.settings).toEqual({
      GeneralSettingsService: { language: 'hu' },
      StatusBarSettingsService: { visible: true },
    });
  });

  it('nests <Service>.<serverId> rows under that server', () => {
    addServer('s1');
    addSetting('ServerSettingsService.s1', { x: 1 });
    addSetting('AddTorrentSettingsService.s1', { y: 2 });

    const file = buildConfiguration();

    expect(file.servers['s1'].settings).toEqual({
      ServerSettingsService: { x: 1 },
      AddTorrentSettingsService: { y: 2 },
    });
    expect(Object.keys(file.settings)).toEqual([]);
  });

  it('skips settings rows of deleted servers', () => {
    addServer('s1');
    addSetting('ServerSettingsService.ghost', { x: 1 });

    expect(JSON.stringify(buildConfiguration())).not.toContain('ghost');
  });

  it('skips dotted settings rows that belong to no server and still round-trips', () => {
    addServer('s1');
    addSetting('GeneralSettingsService', { a: 1 });
    addSetting('ServerSettingsService.', { orphan: true });
    addSetting('AddTorrentSettingsService.', { orphan: true });
    addSetting('ServerSettingsService.ghost', { orphan: true });

    const file = buildConfiguration();

    expect(Object.keys(file.settings)).toEqual(['GeneralSettingsService']);
    expect(parseConfiguration(JSON.stringify(file))).toEqual(file);
  });

  it('never emits credentials or detected connection info', () => {
    addServer('s1', { auto_login: 1 });

    const file = buildConfiguration();
    const text = JSON.stringify(file);

    expect(Object.keys(file.servers['s1'])).toEqual([
      'id',
      'name',
      'host',
      'protocol',
      'port',
      'auto_login',
      'created_at',
      'settings',
    ]);
    expect(file.servers['s1'].auto_login).toBe(true);
    expect(text).not.toContain('secret-user');
    expect(text).not.toContain('secret-pass');
    expect(text).not.toContain('2.9.3');
  });

  it('with no servers returns an empty servers object and the current version', () => {
    const file = buildConfiguration();

    expect(file.servers).toEqual({});
    expect(file.version).toBe(1);
    expect(typeof file.exported_at).toBe('number');
  });
});

describe('parseConfiguration', () => {
  it('returns the file for a valid document', () => {
    addServer('s1');
    addSetting('GeneralSettingsService', { a: 1 });
    addSetting('ServerSettingsService.s1', { b: 2 });
    const built = buildConfiguration();

    expect(parseConfiguration(JSON.stringify(built))).toEqual(built);
  });

  it.each([
    ['not json', 'nope'],
    ['an array', '[]'],
    ['null', 'null'],
  ])('rejects %s', (_name, raw) => {
    expect(() => parseConfiguration(raw)).toThrow();
  });

  it.each([
    ['missing', undefined],
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['a string', '1'],
  ])('rejects a %s version', (_name, version) => {
    const file = { ...validFile(), version };
    expect(() => parseConfiguration(JSON.stringify(file))).toThrow();
  });

  it('rejects a newer version with a message that says so', () => {
    const file = { ...validFile(), version: 2 };
    expect(() => parseConfiguration(JSON.stringify(file))).toThrow(/newer/i);
  });

  it('rejects servers given as an array', () => {
    const file = { ...validFile(), servers: [] };
    expect(() => parseConfiguration(JSON.stringify(file))).toThrow();
  });

  it.each([
    ['port 0', { port: 0 }],
    ['port 70000', { port: 70000 }],
    ['an empty name', { name: '' }],
    ['a host with a slash', { host: 'a/b' }],
    ['an unknown protocol', { protocol: 'ftp' }],
    ['a non-boolean auto_login', { auto_login: 'yes' }],
    ['a non-object settings value', { settings: 'x' }],
    ['a null settings blob', { settings: { ServerSettingsService: null } }],
    ['an id with a dot', { id: 's.1' }],
    ['an id that differs from its key', { id: 'other' }],
  ])('rejects a server with %s', (_name, patch) => {
    expect(() => parseConfiguration(withServer(patch))).toThrow();
  });

  it('rejects a top-level settings key containing a dot', () => {
    const file = validFile();
    file.settings['ServerSettingsService.s1'] = { x: 1 };
    expect(() => parseConfiguration(JSON.stringify(file))).toThrow();
  });

  it('rejects a null top-level settings blob', () => {
    const file = validFile();
    file.settings['GeneralSettingsService'] = null;
    expect(() => parseConfiguration(JSON.stringify(file))).toThrow();
  });

  it('rejects __proto__ keys without polluting Object.prototype', () => {
    const raw = `{"version":1,"exported_at":1,"servers":{},"settings":{"__proto__":{"polluted":true}}}`;

    expect(() => parseConfiguration(raw)).toThrow();
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('describeConfiguration', () => {
  it('marks servers that already exist locally', () => {
    addServer('s1');
    const file = validFile();
    file.servers['s2'] = { ...file.servers['s1'], id: 's2', name: 'Two' };

    const meta = describeConfiguration(file);

    expect(meta.servers).toEqual([
      { id: 's1', name: 'One', host: 'one.example', port: 443, exists: true },
      { id: 's2', name: 'Two', host: 'one.example', port: 443, exists: false },
    ]);
  });

  it('reports version, exported time and whether settings are present', () => {
    const file = validFile();

    expect(describeConfiguration(file)).toMatchObject({
      version: 1,
      exportedAt: 1,
      hasSettings: true,
    });
    expect(describeConfiguration({ ...file, settings: {} }).hasSettings).toBe(false);
  });
});
