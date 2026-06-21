import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const ipcOnHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockGet = vi.hoisted(() => vi.fn());
const mockAll = vi.hoisted(() => vi.fn(() => []));
const mockRun = vi.hoisted(() => vi.fn(() => ({ changes: 1 })));
const mockEncryptString = vi.hoisted(() => vi.fn((s: string) => Buffer.from(s)));
const mockRebuildMenu = vi.hoisted(() => vi.fn());
const mockRebuildTrayMenu = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: { getPath: () => '/fake' },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcOnHandlers.set(channel, handler);
    }),
    emit: vi.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: mockEncryptString,
  },
}));

vi.mock('../db.js', () => ({
  default: {
    prepare: () => ({ get: mockGet, all: mockAll, run: mockRun }),
    transaction: vi.fn((fn: (arg: unknown) => unknown) => fn),
  },
}));

vi.mock('../menu.js', () => ({ rebuildMenu: mockRebuildMenu }));
vi.mock('../tray.js', () => ({ rebuildTrayMenu: mockRebuildTrayMenu }));

describe('getActiveServerId / setActiveServerId', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
    ipcOnHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null initially', async () => {
    const { getActiveServerId } = await import('./server.js');
    expect(getActiveServerId()).toBeNull();
  });

  it('stores and returns the set id', async () => {
    const { getActiveServerId, setActiveServerId } = await import('./server.js');
    setActiveServerId('srv-1');
    expect(getActiveServerId()).toBe('srv-1');
  });

  it('accepts null to clear the active server', async () => {
    const { getActiveServerId, setActiveServerId } = await import('./server.js');
    setActiveServerId('srv-1');
    setActiveServerId(null);
    expect(getActiveServerId()).toBeNull();
  });
});

describe('serverList', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no servers in db', async () => {
    mockAll.mockReturnValue([]);
    const { serverList } = await import('./server.js');
    expect(serverList()).toEqual([]);
  });

  it('maps ServerRow fields to ServerRecord correctly', async () => {
    mockAll.mockReturnValue([
      {
        id: 'abc',
        name: 'Local',
        host: 'localhost',
        protocol: 'http',
        port: 8080,
        username: 'admin',
        auto_login: 1,
        created_at: '2024-01-01T00:00:00.000Z',
        has_password: 1,
      },
    ]);
    const { serverList } = await import('./server.js');
    expect(serverList()[0]).toEqual({
      id: 'abc',
      name: 'Local',
      host: 'localhost',
      protocol: 'http',
      port: 8080,
      username: 'admin',
      auto_login: true,
      created_at: '2024-01-01T00:00:00.000Z',
      has_password: true,
    });
  });

  it('converts auto_login=0 to false', async () => {
    mockAll.mockReturnValue([
      {
        id: 'x',
        name: 'R',
        host: '10.0.0.1',
        protocol: 'https',
        port: 443,
        username: 'u',
        auto_login: 0,
        created_at: '2024-06-01T00:00:00.000Z',
        has_password: 1,
      },
    ]);
    const { serverList } = await import('./server.js');
    expect(serverList()[0].auto_login).toBe(false);
  });

  it('returns multiple servers', async () => {
    mockAll.mockReturnValue([
      {
        id: 'a',
        name: 'A',
        host: 'a.local',
        protocol: 'http',
        port: 80,
        username: '',
        auto_login: 0,
        created_at: '',
        has_password: 0,
      },
      {
        id: 'b',
        name: 'B',
        host: 'b.local',
        protocol: 'http',
        port: 80,
        username: '',
        auto_login: 0,
        created_at: '',
        has_password: 0,
      },
    ]);
    const { serverList } = await import('./server.js');
    expect(serverList()).toHaveLength(2);
  });
});

describe('server:add IPC handler – validation', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function getAddHandler() {
    const { registerServerIpcHandlers } = await import('./server.js');
    registerServerIpcHandlers();
    return ipcHandlers.get('server:add')!;
  }

  it('returns { id } on success', async () => {
    const handler = await getAddHandler();
    const result = (await handler(null, {
      name: 'Local',
      host: 'localhost',
      port: 8080,
      username: 'admin',
      password: 'secret',
      protocol: 'http',
    })) as { id: string };
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
  });

  it('encrypts the password before storing', async () => {
    const handler = await getAddHandler();
    await handler(null, {
      name: 'L',
      host: 'localhost',
      port: 8080,
      username: 'u',
      password: 'pass',
      protocol: 'http',
    });
    expect(mockEncryptString).toHaveBeenCalledWith('pass');
  });

  it('calls rebuildMenu after successful add', async () => {
    const handler = await getAddHandler();
    await handler(null, {
      name: 'L',
      host: 'localhost',
      port: 8080,
      username: 'u',
      password: 'p',
      protocol: 'http',
    });
    expect(mockRebuildMenu).toHaveBeenCalled();
  });

  it('sets protocol to https when useHttps=true', async () => {
    const handler = await getAddHandler();
    const result = (await handler(null, {
      name: 'S',
      host: 'myserver.com',
      port: 443,
      username: 'admin',
      password: 'secret',
      useHttps: true,
    })) as { id: string };
    expect(result).toHaveProperty('id');
  });

  it('throws when name is empty', async () => {
    const handler = await getAddHandler();
    await expect(
      handler(null, {
        name: '',
        host: 'localhost',
        port: 8080,
        username: 'u',
        password: 'p',
        protocol: 'http',
      }),
    ).rejects.toThrow("Field 'name' is required.");
  });

  it('throws when host is empty', async () => {
    const handler = await getAddHandler();
    await expect(
      handler(null, {
        name: 'L',
        host: '',
        port: 8080,
        username: 'u',
        password: 'p',
        protocol: 'http',
      }),
    ).rejects.toThrow("Field 'host' is required.");
  });

  it('throws when host contains a protocol prefix', async () => {
    const handler = await getAddHandler();
    await expect(
      handler(null, {
        name: 'L',
        host: 'http://localhost',
        port: 8080,
        username: 'u',
        password: 'p',
        protocol: 'http',
      }),
    ).rejects.toThrow("Field 'host' must be a host only");
  });

  it('throws when host contains a path separator', async () => {
    const handler = await getAddHandler();
    await expect(
      handler(null, {
        name: 'L',
        host: 'localhost/path',
        port: 8080,
        username: 'u',
        password: 'p',
        protocol: 'http',
      }),
    ).rejects.toThrow("Field 'host' must be a host only");
  });

  it('throws when port is out of range', async () => {
    const handler = await getAddHandler();
    await expect(
      handler(null, {
        name: 'L',
        host: 'localhost',
        port: 99999,
        username: 'u',
        password: 'p',
        protocol: 'http',
      }),
    ).rejects.toThrow("Field 'port' must be an integer");
  });

  it('throws when port is 0', async () => {
    const handler = await getAddHandler();
    await expect(
      handler(null, {
        name: 'L',
        host: 'localhost',
        port: 0,
        username: 'u',
        password: 'p',
        protocol: 'http',
      }),
    ).rejects.toThrow("Field 'port' must be an integer");
  });

  it('succeeds with empty password (stores null)', async () => {
    const handler = await getAddHandler();
    const result = (await handler(null, {
      name: 'L',
      host: 'localhost',
      port: 8080,
      username: 'u',
      password: '',
      protocol: 'http',
    })) as { id: string };
    expect(typeof result.id).toBe('string');
    expect(mockEncryptString).not.toHaveBeenCalled();
  });

  it('succeeds without password field (stores null)', async () => {
    const handler = await getAddHandler();
    const result = (await handler(null, {
      name: 'L',
      host: 'localhost',
      port: 8080,
      username: 'u',
      protocol: 'http',
    })) as { id: string };
    expect(typeof result.id).toBe('string');
    expect(mockEncryptString).not.toHaveBeenCalled();
  });

  it('succeeds with empty username', async () => {
    const handler = await getAddHandler();
    const result = (await handler(null, {
      name: 'L',
      host: 'localhost',
      port: 8080,
      username: '',
      password: 'secret',
      protocol: 'http',
    })) as { id: string };
    expect(typeof result.id).toBe('string');
  });

  it('throws when safeStorage encryption is unavailable', async () => {
    const electronMock = (await import('electron')) as any;
    electronMock.safeStorage.isEncryptionAvailable.mockReturnValueOnce(false);
    const handler = await getAddHandler();
    await expect(
      handler(null, {
        name: 'L',
        host: 'localhost',
        port: 8080,
        username: 'u',
        password: 'pass',
        protocol: 'http',
      }),
    ).rejects.toThrow('Encryption is not available');
  });

  it('throws a user-friendly message on duplicate host', async () => {
    mockRun.mockImplementationOnce(() => {
      throw new Error('UNIQUE constraint failed: servers.host');
    });
    const handler = await getAddHandler();
    await expect(
      handler(null, {
        name: 'L',
        host: 'localhost',
        port: 8080,
        username: 'u',
        password: 'p',
        protocol: 'http',
      }),
    ).rejects.toThrow('A server with the same host already exists.');
  });

  it('throws a generic db error message for unknown db errors', async () => {
    mockRun.mockImplementationOnce(() => {
      throw new Error('some unexpected db problem');
    });
    const handler = await getAddHandler();
    await expect(
      handler(null, {
        name: 'L',
        host: 'localhost',
        port: 8080,
        username: 'u',
        password: 'p',
        protocol: 'http',
      }),
    ).rejects.toThrow('Database error:');
  });

  it('throws when payload is not an object', async () => {
    const handler = await getAddHandler();
    await expect(handler(null, null)).rejects.toThrow('Invalid server payload.');
  });
});

describe('server:delete IPC handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function getDeleteHandler() {
    const { registerServerIpcHandlers } = await import('./server.js');
    registerServerIpcHandlers();
    return ipcHandlers.get('server:delete')!;
  }

  it('returns { deleted: true } when a row was changed', async () => {
    mockRun.mockReturnValue({ changes: 1 });
    const handler = await getDeleteHandler();
    expect(await handler(null, { id: 'srv-1' })).toEqual({ deleted: true });
  });

  it('returns { deleted: false } when no rows changed', async () => {
    mockRun.mockReturnValue({ changes: 0 });
    const handler = await getDeleteHandler();
    expect(await handler(null, { id: 'nonexistent' })).toEqual({ deleted: false });
  });

  it('calls rebuildMenu when a row was deleted', async () => {
    mockRun.mockReturnValue({ changes: 1 });
    const handler = await getDeleteHandler();
    await handler(null, { id: 'srv-1' });
    expect(mockRebuildMenu).toHaveBeenCalled();
  });

  it('does not call rebuildMenu when nothing was deleted', async () => {
    mockRun.mockReturnValue({ changes: 0 });
    const handler = await getDeleteHandler();
    await handler(null, { id: 'nonexistent' });
    expect(mockRebuildMenu).not.toHaveBeenCalled();
  });

  it('throws when id is missing', async () => {
    const handler = await getDeleteHandler();
    await expect(handler(null, {})).rejects.toThrow("Field 'id' is required.");
  });
});

describe('server:getById IPC handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function getHandler() {
    const { registerServerIpcHandlers } = await import('./server.js');
    registerServerIpcHandlers();
    return ipcHandlers.get('server:getById')!;
  }

  it('returns null when server not found', async () => {
    mockGet.mockReturnValue(undefined);
    const handler = await getHandler();
    expect(await handler(null, { id: 'missing' })).toBeNull();
  });

  it('returns the mapped record when found', async () => {
    mockGet.mockReturnValue({
      id: 'srv-1',
      name: 'Test',
      host: 'localhost',
      protocol: 'http',
      port: 8080,
      username: 'admin',
      auto_login: 0,
      created_at: '2024-01-01T00:00:00.000Z',
      has_password: 1,
    });
    const handler = await getHandler();
    const result = (await handler(null, { id: 'srv-1' })) as { name: string };
    expect(result.name).toBe('Test');
  });

  it('throws when id is missing', async () => {
    const handler = await getHandler();
    await expect(handler(null, {})).rejects.toThrow("Field 'id' is required.");
  });
});

describe('server:getByHost IPC handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function getHandler() {
    const { registerServerIpcHandlers } = await import('./server.js');
    registerServerIpcHandlers();
    return ipcHandlers.get('server:getByHost')!;
  }

  it('returns null when no server matches the host', async () => {
    mockGet.mockReturnValue(undefined);
    const handler = await getHandler();
    expect(await handler(null, { host: 'unknown.local' })).toBeNull();
  });

  it('returns the mapped record when host is found', async () => {
    mockGet.mockReturnValue({
      id: 'srv-2',
      name: 'Remote',
      host: 'remote.local',
      protocol: 'https',
      port: 443,
      username: 'user',
      auto_login: 0,
      created_at: '',
      has_password: 1,
    });
    const handler = await getHandler();
    const result = (await handler(null, { host: 'remote.local' })) as { id: string };
    expect(result.id).toBe('srv-2');
  });

  it('throws when host has a protocol prefix', async () => {
    const handler = await getHandler();
    await expect(handler(null, { host: 'https://remote.local' })).rejects.toThrow(
      "Field 'host' must be a host only",
    );
  });
});

describe('server:update IPC handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function getHandler() {
    const { registerServerIpcHandlers } = await import('./server.js');
    registerServerIpcHandlers();
    return ipcHandlers.get('server:update')!;
  }

  it('returns { updated: true } when row was changed', async () => {
    mockRun.mockReturnValue({ changes: 1 });
    const handler = await getHandler();
    const result = await handler(null, { id: 'srv-1', changes: { name: 'New Name' } });
    expect(result).toEqual({ updated: true });
  });

  it('returns { updated: false } when no rows matched', async () => {
    mockRun.mockReturnValue({ changes: 0 });
    const handler = await getHandler();
    const result = await handler(null, { id: 'nonexistent', changes: { name: 'X' } });
    expect(result).toEqual({ updated: false });
  });

  it('throws when no changes provided', async () => {
    const handler = await getHandler();
    await expect(handler(null, { id: 'srv-1' })).rejects.toThrow('No changes provided.');
  });

  it('throws when id is missing', async () => {
    const handler = await getHandler();
    await expect(handler(null, { changes: { name: 'X' } })).rejects.toThrow(
      "Field 'id' is required.",
    );
  });
});

describe('server:set-active IPC event handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
    ipcOnHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates activeServerId and rebuilds menus when id changes', async () => {
    const { registerServerIpcHandlers, getActiveServerId } = await import('./server.js');
    registerServerIpcHandlers();
    const handler = ipcOnHandlers.get('server:set-active')!;
    handler(null, 'srv-new');
    expect(getActiveServerId()).toBe('srv-new');
    expect(mockRebuildMenu).toHaveBeenCalled();
    expect(mockRebuildTrayMenu).toHaveBeenCalled();
  });

  it('does not rebuild menus when id has not changed', async () => {
    const { registerServerIpcHandlers, setActiveServerId } = await import('./server.js');
    setActiveServerId('same-id');
    registerServerIpcHandlers();
    const handler = ipcOnHandlers.get('server:set-active')!;
    handler(null, 'same-id');
    expect(mockRebuildMenu).not.toHaveBeenCalled();
    expect(mockRebuildTrayMenu).not.toHaveBeenCalled();
  });
});

describe('serverList export_available mapping', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes through export_available = 1 unchanged', async () => {
    mockAll.mockReturnValue([
      {
        id: 'abc',
        name: 'Local',
        host: 'localhost',
        protocol: 'http',
        port: 8080,
        username: 'admin',
        auto_login: 1,
        created_at: '2024-01-01T00:00:00.000Z',
        has_password: 1,
        export_available: 1,
      },
    ]);
    const { serverList } = await import('./server.js');
    expect(serverList()[0].export_available).toBe(1);
  });

  it('passes through export_available = null unchanged', async () => {
    mockAll.mockReturnValue([
      {
        id: 'abc',
        name: 'Local',
        host: 'localhost',
        protocol: 'http',
        port: 8080,
        username: 'admin',
        auto_login: 1,
        created_at: '2024-01-01T00:00:00.000Z',
        has_password: 1,
        export_available: null,
      },
    ]);
    const { serverList } = await import('./server.js');
    expect(serverList()[0].export_available).toBeNull();
  });
});

describe('getExportAvailable', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the cached value for a known server', async () => {
    mockGet.mockReturnValue({
      id: 'srv-1',
      name: 'Test',
      host: 'localhost',
      protocol: 'http',
      port: 8080,
      username: 'admin',
      auto_login: 0,
      created_at: '',
      has_password: 1,
      export_available: 1,
    });
    const { getExportAvailable } = await import('./server.js');
    expect(getExportAvailable('srv-1')).toBe(1);
  });

  it('returns null when the server is not found', async () => {
    mockGet.mockReturnValue(undefined);
    const { getExportAvailable } = await import('./server.js');
    expect(getExportAvailable('missing')).toBeNull();
  });
});

describe('setExportAvailable', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('runs an UPDATE with the given id and value', async () => {
    const { setExportAvailable } = await import('./server.js');
    setExportAvailable('srv-1', 1);
    expect(mockRun).toHaveBeenCalledWith(1, 'srv-1');
  });
});

describe('server:set-export-available IPC handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function getHandler() {
    const { registerServerIpcHandlers } = await import('./server.js');
    registerServerIpcHandlers();
    return ipcHandlers.get('server:set-export-available')!;
  }

  it('returns { updated: true } and writes the value', async () => {
    const handler = await getHandler();
    const result = await handler(null, { id: 'srv-1', value: 1 });
    expect(result).toEqual({ updated: true });
    expect(mockRun).toHaveBeenCalledWith(1, 'srv-1');
  });

  it('throws when value is not 0 or 1', async () => {
    const handler = await getHandler();
    await expect(handler(null, { id: 'srv-1', value: 2 })).rejects.toThrow(
      "Field 'value' must be 0 or 1.",
    );
  });

  it('throws when id is missing', async () => {
    const handler = await getHandler();
    await expect(handler(null, { value: 1 })).rejects.toThrow("Field 'id' is required.");
  });
});
