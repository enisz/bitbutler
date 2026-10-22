import type { BbcFile, BbcServer } from '@bitbutler/shared';
import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyConfiguration } from './configuration-apply.js';
import db from './db.js';

const mockRebuildMenu = vi.hoisted(() => vi.fn());
const cookieJar = vi.hoisted(() => new Map<string, unknown>());

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
    CREATE UNIQUE INDEX uq_servers_auto_login ON servers(auto_login) WHERE auto_login = 1;
    CREATE TABLE settings (id TEXT PRIMARY KEY, json TEXT NOT NULL);
  `);
  return { default: memory };
});
vi.mock('./menu.js', () => ({ rebuildMenu: mockRebuildMenu }));
vi.mock('./ipc/qbittorrent.js', () => ({ getCookieJar: () => cookieJar }));

const conn = db as unknown as Database.Database;

function addServer(id: string, extra: Record<string, unknown> = {}): void {
  conn
    .prepare(
      `INSERT INTO servers VALUES (@id, @name, @host, @protocol, @port, @username, @password,
        @auto_login, @created_at, @export_available, @webapi_version, @qb_version)`,
    )
    .run({
      id,
      name: `local-${id}`,
      host: `local-${id}.example`,
      protocol: 'http',
      port: 8080,
      username: 'keep-user',
      password: Buffer.from('keep-pass'),
      auto_login: 0,
      created_at: '2020-01-01T00:00:00.000Z',
      export_available: 1,
      webapi_version: '2.9.3',
      qb_version: 'v4.6.0',
      ...extra,
    });
}

function addSetting(id: string, value: unknown): void {
  conn.prepare('INSERT INTO settings (id, json) VALUES (?, ?)').run(id, JSON.stringify(value));
}

function setting(id: string): unknown {
  const row = conn.prepare('SELECT json FROM settings WHERE id = ?').get(id) as
    | { json: string }
    | undefined;
  return row ? JSON.parse(row.json) : undefined;
}

function server(id: string): Record<string, unknown> | undefined {
  return conn.prepare('SELECT * FROM servers WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
}

function fileServer(id: string, extra: Partial<BbcServer> = {}): BbcServer {
  return {
    id,
    name: `file-${id}`,
    host: `file-${id}.example`,
    protocol: 'https',
    port: 443,
    auto_login: false,
    created_at: '2026-02-02T00:00:00.000Z',
    settings: {},
    ...extra,
  };
}

function file(servers: BbcServer[] = [], settings: Record<string, unknown> = {}): BbcFile {
  return {
    version: 1,
    exported_at: 1,
    settings,
    servers: Object.fromEntries(servers.map((s) => [s.id, s])),
  };
}

beforeEach(() => {
  conn.exec('DELETE FROM servers; DELETE FROM settings;');
  cookieJar.clear();
  mockRebuildMenu.mockClear();
});

describe('applyConfiguration settings', () => {
  it('overwrites settings rows by id and leaves other rows', () => {
    addSetting('GeneralSettingsService', { language: 'us' });
    addSetting('StatusBarSettingsService', { visible: true });

    const result = applyConfiguration(file([], { GeneralSettingsService: { language: 'hu' } }), {
      applySettings: true,
      serverIds: [],
    });

    expect(setting('GeneralSettingsService')).toEqual({ language: 'hu' });
    expect(setting('StatusBarSettingsService')).toEqual({ visible: true });
    expect(result).toEqual({ settings: true, servers: 0 });
  });

  it('writes no settings rows when applySettings is false', () => {
    const result = applyConfiguration(file([], { GeneralSettingsService: { language: 'hu' } }), {
      applySettings: false,
      serverIds: [],
    });

    expect(setting('GeneralSettingsService')).toBeUndefined();
    expect(result.settings).toBe(false);
  });
});

describe('applyConfiguration servers', () => {
  it('inserts a new server with empty username, NULL password and the file created_at', () => {
    const result = applyConfiguration(file([fileServer('n1')]), {
      applySettings: false,
      serverIds: ['n1'],
    });

    expect(server('n1')).toMatchObject({
      name: 'file-n1',
      host: 'file-n1.example',
      protocol: 'https',
      port: 443,
      username: '',
      password: null,
      auto_login: 0,
      created_at: '2026-02-02T00:00:00.000Z',
    });
    expect(result.servers).toBe(1);
  });

  it('keeps username and password of an existing server when the connection target is unchanged', () => {
    addServer('e1', { host: 'same.example', protocol: 'https', port: 443 });

    applyConfiguration(
      file([fileServer('e1', { host: 'same.example', auto_login: true, name: 'renamed' })]),
      { applySettings: false, serverIds: ['e1'] },
    );

    const row = server('e1')!;
    expect(row).toMatchObject({
      name: 'renamed',
      auto_login: 1,
      username: 'keep-user',
      created_at: '2020-01-01T00:00:00.000Z',
    });
    expect((row['password'] as Buffer).toString()).toBe('keep-pass');
  });

  it('clears username and password when the file points the server at a different host', () => {
    addServer('e1');

    applyConfiguration(file([fileServer('e1')]), { applySettings: false, serverIds: ['e1'] });

    expect(server('e1')).toMatchObject({
      host: 'file-e1.example',
      port: 443,
      protocol: 'https',
      username: '',
      password: null,
    });
  });

  it('writes server settings as <Service>.<id> for selected servers only', () => {
    addServer('e2');
    addSetting('ServerSettingsService.e2', { old: true });
    const settings = { ServerSettingsService: { n: 1 }, AddTorrentSettingsService: { m: 2 } };

    applyConfiguration(file([fileServer('n1', { settings }), fileServer('n2', { settings })]), {
      applySettings: false,
      serverIds: ['n1'],
    });

    expect(setting('ServerSettingsService.n1')).toEqual({ n: 1 });
    expect(setting('AddTorrentSettingsService.n1')).toEqual({ m: 2 });
    expect(setting('ServerSettingsService.n2')).toBeUndefined();
    expect(setting('ServerSettingsService.e2')).toEqual({ old: true });
  });

  it('keeps local settings rows of a selected server that has none in the file', () => {
    addServer('e1');
    addSetting('ServerSettingsService.e1', { local: true });

    applyConfiguration(file([fileServer('e1')]), { applySettings: false, serverIds: ['e1'] });

    expect(setting('ServerSettingsService.e1')).toEqual({ local: true });
  });

  it('resets detected connection info and drops the cookie when the connection changed', () => {
    addServer('e1');
    cookieJar.set('e1', 'cookie');

    applyConfiguration(file([fileServer('e1')]), { applySettings: false, serverIds: ['e1'] });

    expect(server('e1')).toMatchObject({
      export_available: null,
      webapi_version: null,
      qb_version: null,
    });
    expect(cookieJar.has('e1')).toBe(false);
  });

  it('keeps detected connection info when host, port and protocol are unchanged', () => {
    addServer('e1', { host: 'same.example', protocol: 'https', port: 443 });
    cookieJar.set('e1', 'cookie');

    applyConfiguration(file([fileServer('e1', { host: 'same.example' })]), {
      applySettings: false,
      serverIds: ['e1'],
    });

    expect(server('e1')).toMatchObject({ export_available: 1, webapi_version: '2.9.3' });
    expect(cookieJar.has('e1')).toBe(true);
  });
});

describe('applyConfiguration auto_login', () => {
  it('clears the flag on every other local server when an imported one has it', () => {
    addServer('local', { auto_login: 1 });

    applyConfiguration(file([fileServer('n1', { auto_login: true })]), {
      applySettings: false,
      serverIds: ['n1'],
    });

    expect(server('local')!['auto_login']).toBe(0);
    expect(server('n1')!['auto_login']).toBe(1);
  });

  it('leaves the local auto_login server alone when no imported one has the flag', () => {
    addServer('local', { auto_login: 1 });

    applyConfiguration(file([fileServer('n1')]), { applySettings: false, serverIds: ['n1'] });

    expect(server('local')!['auto_login']).toBe(1);
  });

  it('keeps the flag only on the first of two selected auto_login servers', () => {
    applyConfiguration(
      file([fileServer('a', { auto_login: true }), fileServer('b', { auto_login: true })]),
      { applySettings: false, serverIds: ['b', 'a'] },
    );

    expect(server('a')!['auto_login']).toBe(1);
    expect(server('b')!['auto_login']).toBe(0);
  });
});

describe('applyConfiguration failure and side effects', () => {
  it('throws before any write when a serverId is not in the file', () => {
    expect(() =>
      applyConfiguration(file([fileServer('n1')], { GeneralSettingsService: { a: 1 } }), {
        applySettings: true,
        serverIds: ['n1', 'missing'],
      }),
    ).toThrow(/missing/);

    expect(server('n1')).toBeUndefined();
    expect(setting('GeneralSettingsService')).toBeUndefined();
  });

  it('rolls everything back when a write fails midway', () => {
    addServer('first');
    conn.exec(`CREATE TRIGGER boom BEFORE INSERT ON servers WHEN NEW.id = 'bad'
      BEGIN SELECT RAISE(ABORT, 'boom'); END;`);

    expect(() =>
      applyConfiguration(
        file([fileServer('first'), fileServer('bad')], { GeneralSettingsService: { a: 1 } }),
        { applySettings: true, serverIds: ['first', 'bad'] },
      ),
    ).toThrow(/boom/);

    expect(server('first')!['name']).toBe('local-first');
    expect(setting('GeneralSettingsService')).toBeUndefined();
    expect(mockRebuildMenu).not.toHaveBeenCalled();
    conn.exec('DROP TRIGGER boom');
  });

  it('rebuilds the menu once after success', () => {
    applyConfiguration(file([fileServer('n1')]), { applySettings: false, serverIds: ['n1'] });

    expect(mockRebuildMenu).toHaveBeenCalledTimes(1);
  });
});
