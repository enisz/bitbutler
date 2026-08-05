import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const ipcOnHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockIpcMainEmit = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());
const mockRun = vi.hoisted(() => vi.fn(() => ({ changes: 1 })));
const mockRebuildMenu = vi.hoisted(() => vi.fn());
const mockRebuildTrayMenu = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcOnHandlers.set(channel, handler);
    }),
    emit: mockIpcMainEmit,
  },
  safeStorage: {
    decryptString: vi.fn((buf: Buffer) => buf.toString()),
    isEncryptionAvailable: vi.fn(() => true),
  },
}));

vi.mock('../db.js', () => ({
  default: {
    prepare: () => ({ get: mockGet, all: vi.fn(() => []), run: mockRun }),
    transaction: vi.fn((fn: (arg: unknown) => unknown) => fn),
  },
}));

vi.mock('../menu.js', () => ({ rebuildMenu: mockRebuildMenu }));
vi.mock('../tray.js', () => ({ rebuildTrayMenu: mockRebuildTrayMenu }));

describe('getCookieJar', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a Map instance', async () => {
    const { getCookieJar } = await import('./qbittorrent.js');
    expect(getCookieJar()).toBeInstanceOf(Map);
  });

  it('starts empty on fresh module load', async () => {
    const { getCookieJar } = await import('./qbittorrent.js');
    expect(getCookieJar().size).toBe(0);
  });
});

describe('qb:has-cookie IPC handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function setup() {
    const { registerQbIpcHandlers, getCookieJar } = await import('./qbittorrent.js');
    registerQbIpcHandlers();
    return { handler: ipcHandlers.get('qb:has-cookie')!, getCookieJar };
  }

  it('returns { hasCookie: false } when no cookie is stored', async () => {
    const { handler } = await setup();
    expect(await handler(null, { id: 'srv-1' })).toEqual({ hasCookie: false });
  });

  it('returns { hasCookie: true } when a cookie exists for that server', async () => {
    const { handler, getCookieJar } = await setup();
    getCookieJar().set('srv-1', 'SID=abc123');
    expect(await handler(null, { id: 'srv-1' })).toEqual({ hasCookie: true });
  });

  it('returns { hasCookie: false } for a different server id', async () => {
    const { handler, getCookieJar } = await setup();
    getCookieJar().set('srv-1', 'SID=abc123');
    expect(await handler(null, { id: 'srv-2' })).toEqual({ hasCookie: false });
  });

  it('throws when id is missing', async () => {
    const { handler } = await setup();
    await expect(handler(null, {})).rejects.toThrow("Field 'id' is required.");
  });

  it('throws when id is empty', async () => {
    const { handler } = await setup();
    await expect(handler(null, { id: '' })).rejects.toThrow("Field 'id' is required.");
  });
});

describe('qb:logout IPC handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function setup() {
    const { registerQbIpcHandlers, getCookieJar } = await import('./qbittorrent.js');
    const { setActiveServerId } = await import('./server.js');
    registerQbIpcHandlers();
    return { handler: ipcHandlers.get('qb:logout')!, getCookieJar, setActiveServerId };
  }

  it('returns { loggedOut: true }', async () => {
    const { handler } = await setup();
    expect(await handler(null, { id: 'srv-1' })).toEqual({ loggedOut: true });
  });

  it('throws when id is missing', async () => {
    const { handler } = await setup();
    await expect(handler(null, {})).rejects.toThrow("Field 'id' is required.");
  });

  it('removes only the target server cookie, leaving other servers logged in', async () => {
    const { handler, getCookieJar } = await setup();
    getCookieJar().set('srv-1', 'SID=abc');
    getCookieJar().set('srv-2', 'SID=def');
    await handler(null, { id: 'srv-1' });
    expect(getCookieJar().has('srv-1')).toBe(false);
    expect(getCookieJar().has('srv-2')).toBe(true);
  });

  it('emits server:set-active with null when the logged-out server was the active one', async () => {
    const { handler, setActiveServerId } = await setup();
    setActiveServerId('srv-1');
    await handler(null, { id: 'srv-1' });
    expect(mockIpcMainEmit).toHaveBeenCalledWith('server:set-active', null, null);
  });

  it('does not touch the active server when a different server logs out', async () => {
    const { handler, setActiveServerId } = await setup();
    setActiveServerId('srv-2');
    await handler(null, { id: 'srv-1' });
    expect(mockIpcMainEmit).not.toHaveBeenCalledWith('server:set-active', null, null);
  });

  it('calls rebuildMenu and rebuildTrayMenu', async () => {
    const { handler } = await setup();
    await handler(null, { id: 'srv-1' });
    expect(mockRebuildMenu).toHaveBeenCalled();
    expect(mockRebuildTrayMenu).toHaveBeenCalled();
  });
});

describe('qb:login IPC handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  const fakeServerRow = {
    id: 'srv-1',
    name: 'Test',
    host: 'localhost',
    protocol: 'http',
    port: 8080,
    username: 'admin',
    password: Buffer.from('secret'),
    auto_login: 0,
    created_at: '',
  };

  async function setup() {
    const { registerQbIpcHandlers, getCookieJar } = await import('./qbittorrent.js');
    registerQbIpcHandlers();
    return { handler: ipcHandlers.get('qb:login')!, getCookieJar };
  }

  it('succeeds with qBittorrent <5 response (200 + Ok. + SID cookie)', async () => {
    mockGet.mockReturnValue(fakeServerRow);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('Ok.'),
      headers: {
        getSetCookie: () => ['SID=abc123; HttpOnly'],
        get: () => null,
      },
    });
    const { handler, getCookieJar } = await setup();
    await expect(handler(null, { id: 'srv-1' })).resolves.toEqual({ loggedIn: true });
    expect(getCookieJar().get('srv-1')).toBe('SID=abc123');
  });

  it('succeeds with qBittorrent 5+ response (204 + QBT_SID_port cookie)', async () => {
    mockGet.mockReturnValue(fakeServerRow);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      text: () => Promise.resolve(''),
      headers: {
        getSetCookie: () => ['QBT_SID_8080=tok204; HttpOnly; SameSite=Strict'],
        get: () => null,
      },
    });
    const { handler, getCookieJar } = await setup();
    await expect(handler(null, { id: 'srv-1' })).resolves.toEqual({ loggedIn: true });
    expect(getCookieJar().get('srv-1')).toBe('QBT_SID_8080=tok204');
  });

  it('throws on qBittorrent <5 bad credentials (200 + Fails.)', async () => {
    mockGet.mockReturnValue(fakeServerRow);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('Fails.'),
      headers: { getSetCookie: () => [], get: () => null },
    });
    const { handler } = await setup();
    await expect(handler(null, { id: 'srv-1' })).rejects.toThrow('Login failed');
  });

  it('throws on qBittorrent 5+ bad credentials (401)', async () => {
    mockGet.mockReturnValue(fakeServerRow);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
      headers: { getSetCookie: () => [], get: () => null },
    });
    const { handler } = await setup();
    await expect(handler(null, { id: 'srv-1' })).rejects.toThrow('Login failed');
  });

  it('throws when login succeeds but no session cookie is returned', async () => {
    mockGet.mockReturnValue(fakeServerRow);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('Ok.'),
      headers: { getSetCookie: () => [], get: () => null },
    });
    const { handler } = await setup();
    await expect(handler(null, { id: 'srv-1' })).rejects.toThrow('SID cookie was not returned');
  });

  it('throws when server is not found', async () => {
    mockGet.mockReturnValue(undefined);
    const { handler } = await setup();
    await expect(handler(null, { id: 'missing' })).rejects.toThrow('Server not found');
  });

  it('uses stored credentials when no runtime credentials provided', async () => {
    mockGet.mockReturnValue({
      id: 'srv-1',
      name: 'Local',
      host: 'localhost',
      protocol: 'http',
      port: 8080,
      username: 'admin',
      password: Buffer.from('stored-pass'),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'Ok.',
      headers: { get: () => 'SID=abc123', getSetCookie: undefined },
    });
    globalThis.fetch = mockFetch;
    const { handler } = await setup();
    await handler(null, { id: 'srv-1' });
    const body = mockFetch.mock.calls[0][1].body.toString();
    expect(body).toContain('username=admin');
    expect(body).toContain('password=stored-pass');
  });

  it('uses runtime username and password when provided', async () => {
    mockGet.mockReturnValue({
      id: 'srv-1',
      name: 'Local',
      host: 'localhost',
      protocol: 'http',
      port: 8080,
      username: 'admin',
      password: Buffer.from('stored-pass'),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'Ok.',
      headers: { get: () => 'SID=abc123', getSetCookie: undefined },
    });
    globalThis.fetch = mockFetch;
    const { handler } = await setup();
    await handler(null, { id: 'srv-1', username: 'runtime-user', password: 'runtime-pass' });
    const body = mockFetch.mock.calls[0][1].body.toString();
    expect(body).toContain('username=runtime-user');
    expect(body).toContain('password=runtime-pass');
  });

  it('uses empty password when server has null password and no runtime password', async () => {
    mockGet.mockReturnValue({
      id: 'srv-1',
      name: 'Local',
      host: 'localhost',
      protocol: 'http',
      port: 8080,
      username: 'admin',
      password: null,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'Ok.',
      headers: { get: () => 'SID=abc123', getSetCookie: undefined },
    });
    globalThis.fetch = mockFetch;
    const { handler } = await setup();
    await handler(null, { id: 'srv-1' });
    const body = mockFetch.mock.calls[0][1].body.toString();
    expect(body).toContain('password=');
  });
});

describe('qbRequest', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  const fakeServer = {
    id: 'srv-1',
    name: 'Test',
    host: 'localhost',
    protocol: 'http',
    port: 8080,
    username: 'admin',
    password: Buffer.from('secret'),
    auto_login: 0,
    created_at: '',
  };

  function mockOkResponse(body: string, contentType?: string) {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(body),
      headers: {
        get: (h: string) => (contentType && h === 'content-type' ? contentType : null),
      },
    });
  }

  it('throws when id is empty', async () => {
    const { qbRequest } = await import('./qbittorrent.js');
    await expect(qbRequest({ id: '', path: '/api/v2/test' })).rejects.toThrow(
      "Field 'id' is required.",
    );
  });

  it('throws when path is empty', async () => {
    const { qbRequest } = await import('./qbittorrent.js');
    await expect(qbRequest({ id: 'srv-1', path: '' })).rejects.toThrow("Field 'path' is required.");
  });

  it('throws when the server is not found in db', async () => {
    mockGet.mockReturnValue(undefined);
    const { qbRequest } = await import('./qbittorrent.js');
    await expect(qbRequest({ id: 'missing', path: '/api/v2/test' })).rejects.toThrow(
      'Server not found.',
    );
  });

  it('throws when not logged in (no cookie)', async () => {
    mockGet.mockReturnValue(fakeServer);
    const { qbRequest } = await import('./qbittorrent.js');
    await expect(qbRequest({ id: 'srv-1', path: '/api/v2/test' })).rejects.toThrow('Not logged in');
  });

  it('makes a GET request to the correct URL', async () => {
    mockGet.mockReturnValue(fakeServer);
    mockOkResponse('ok');
    const { qbRequest, getCookieJar } = await import('./qbittorrent.js');
    getCookieJar().set('srv-1', 'SID=mytoken');
    await qbRequest({ id: 'srv-1', path: '/api/v2/test' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v2/test',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sends the SID cookie in the request headers', async () => {
    mockGet.mockReturnValue(fakeServer);
    mockOkResponse('ok');
    const { qbRequest, getCookieJar } = await import('./qbittorrent.js');
    getCookieJar().set('srv-1', 'SID=mytoken');
    await qbRequest({ id: 'srv-1', path: '/api/v2/test' });
    const [, fetchInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((fetchInit.headers as Record<string, string>)['Cookie']).toBe('SID=mytoken');
  });

  it('returns plain text when content-type is not JSON', async () => {
    mockGet.mockReturnValue(fakeServer);
    mockOkResponse('plain text response');
    const { qbRequest, getCookieJar } = await import('./qbittorrent.js');
    getCookieJar().set('srv-1', 'SID=tok');
    const result = await qbRequest({ id: 'srv-1', path: '/api/v2/test' });
    expect(result).toBe('plain text response');
  });

  it('parses and returns JSON when content-type is application/json', async () => {
    mockGet.mockReturnValue(fakeServer);
    mockOkResponse(JSON.stringify({ data: 42 }), 'application/json');
    const { qbRequest, getCookieJar } = await import('./qbittorrent.js');
    getCookieJar().set('srv-1', 'SID=tok');
    const result = await qbRequest({ id: 'srv-1', path: '/api/v2/test' });
    expect(result).toEqual({ data: 42 });
  });

  it('appends query parameters to the URL', async () => {
    mockGet.mockReturnValue(fakeServer);
    mockOkResponse('ok');
    const { qbRequest, getCookieJar } = await import('./qbittorrent.js');
    getCookieJar().set('srv-1', 'SID=tok');
    await qbRequest({ id: 'srv-1', path: '/api/v2/test', query: { rid: 5 } });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('rid=5');
  });

  it('throws a serialized error object on non-ok response', async () => {
    mockGet.mockReturnValue(fakeServer);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve('Access denied'),
      headers: { get: () => null },
    });
    const { qbRequest, getCookieJar } = await import('./qbittorrent.js');
    getCookieJar().set('srv-1', 'SID=tok');
    await expect(qbRequest({ id: 'srv-1', path: '/api/v2/test' })).rejects.toThrow();
  });

  it('builds a form-encoded body when form is provided', async () => {
    mockGet.mockReturnValue(fakeServer);
    mockOkResponse('ok');
    const { qbRequest, getCookieJar } = await import('./qbittorrent.js');
    getCookieJar().set('srv-1', 'SID=tok');
    await qbRequest({
      id: 'srv-1',
      path: '/api/v2/torrents/pause',
      method: 'POST',
      form: { hashes: 'abc' },
    });
    const [, fetchInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((fetchInit.headers as Record<string, string>)['Content-Type']).toContain(
      'application/x-www-form-urlencoded',
    );
  });
});

describe('qb:sync-maindata-stream IPC handler', () => {
  const fakeServer = {
    id: 'srv-1',
    name: 'Test',
    host: 'localhost',
    protocol: 'http',
    port: 8080,
    username: 'admin',
    password: Buffer.from('secret'),
    auto_login: 0,
    created_at: '',
  };

  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
    ipcOnHandlers.clear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  function mockMaindataResponse(torrents: Record<string, unknown>) {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(JSON.stringify({ torrents })),
      headers: { get: (h: string) => (h === 'content-type' ? 'application/json' : null) },
    });
  }

  function createMockEvent(senderId: number) {
    return {
      reply: vi.fn(),
      sender: { id: senderId, isDestroyed: vi.fn(() => false) },
    } as unknown as Electron.IpcMainEvent & {
      reply: ReturnType<typeof vi.fn>;
      sender: { id: number; isDestroyed: ReturnType<typeof vi.fn> };
    };
  }

  async function setup() {
    const { registerQbIpcHandlers, getCookieJar } = await import('./qbittorrent.js');
    registerQbIpcHandlers();
    getCookieJar().set('srv-1', 'SID=mytoken');
    return ipcOnHandlers.get('qb:sync-maindata-stream')!;
  }

  it('replies with metadata, chunk and done for a normal stream', async () => {
    mockGet.mockReturnValue(fakeServer);
    mockMaindataResponse({ h1: { name: 'one' }, h2: { name: 'two' } });
    const handler = await setup();
    const event = createMockEvent(1);

    await handler(event, { id: 'srv-1' });

    const types = event.reply.mock.calls.map((c: unknown[]) => (c[1] as { type: string }).type);
    expect(types).toEqual(['metadata', 'chunk', 'done']);
  });

  it('does not call event.reply once the sender is destroyed', async () => {
    mockGet.mockReturnValue(fakeServer);
    const event = createMockEvent(1);
    mockFetch.mockImplementation(() => {
      event.sender.isDestroyed.mockReturnValue(true);
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(JSON.stringify({ torrents: { h1: {} } })),
        headers: { get: (h: string) => (h === 'content-type' ? 'application/json' : null) },
      });
    });
    const handler = await setup();

    await handler(event, { id: 'srv-1' });

    expect(event.reply).not.toHaveBeenCalled();
  });

  it('supersedes an in-flight stream when a new one starts for the same sender', async () => {
    mockGet.mockReturnValue(fakeServer);
    const handler = await setup();
    const event = createMockEvent(1);

    let resolveFirst!: (v: unknown) => void;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const firstStream = handler(event, { id: 'srv-1' });

    mockMaindataResponse({ h1: {} });
    await handler(event, { id: 'srv-1' });

    resolveFirst({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(JSON.stringify({ torrents: { stale: {} } })),
      headers: { get: (h: string) => (h === 'content-type' ? 'application/json' : null) },
    });
    await firstStream;

    const dataForStale = event.reply.mock.calls.filter(
      (c: unknown[]) => (c[1] as { data?: { stale?: unknown } }).data?.stale !== undefined,
    );
    expect(dataForStale).toHaveLength(0);
  });
});
