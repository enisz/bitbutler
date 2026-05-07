import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
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
    on: vi.fn(),
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
    registerQbIpcHandlers();
    return { handler: ipcHandlers.get('qb:logout')!, getCookieJar };
  }

  it('returns { loggedOut: true }', async () => {
    const { handler } = await setup();
    expect(await handler(null, {})).toEqual({ loggedOut: true });
  });

  it('clears all entries from the cookie jar', async () => {
    const { handler, getCookieJar } = await setup();
    getCookieJar().set('srv-1', 'SID=abc');
    getCookieJar().set('srv-2', 'SID=def');
    await handler(null, {});
    expect(getCookieJar().size).toBe(0);
  });

  it('emits server:set-active with null to clear the active server', async () => {
    const { handler } = await setup();
    await handler(null, {});
    expect(mockIpcMainEmit).toHaveBeenCalledWith('server:set-active', null, null);
  });

  it('calls rebuildMenu and rebuildTrayMenu', async () => {
    const { handler } = await setup();
    await handler(null, {});
    expect(mockRebuildMenu).toHaveBeenCalled();
    expect(mockRebuildTrayMenu).toHaveBeenCalled();
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
