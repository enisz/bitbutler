import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toQbError } from '../qb/errors.js';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const ipcOnHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockIpcMainEmit = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());
const mockRun = vi.hoisted(() => vi.fn(() => ({ changes: 1 })));
const mockRebuildMenu = vi.hoisted(() => vi.fn());
const mockRebuildTrayMenu = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());
const mockRefreshServerInfo = vi.hoisted(() => vi.fn());
const mockClearTorrentRunCache = vi.hoisted(() => vi.fn());

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

vi.mock('../qb/server-info.js', () => ({ refreshServerInfo: mockRefreshServerInfo }));
vi.mock('../qb/torrents.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../qb/torrents.js')>()),
  clearTorrentRunCache: mockClearTorrentRunCache,
}));
vi.mock('../menu.js', () => ({ rebuildMenu: mockRebuildMenu }));
vi.mock('../tray.js', () => ({ rebuildTrayMenu: mockRebuildTrayMenu }));

describe('getCookieJar', () => {
  beforeEach(() => {
    vi.resetModules();
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

describe('hasCookieFor', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('is false when no cookie is stored', async () => {
    const { hasCookieFor } = await import('./qbittorrent.js');
    expect(hasCookieFor('srv-1')).toBe(false);
  });

  it('is true when a cookie exists for that server', async () => {
    const { hasCookieFor, getCookieJar } = await import('./qbittorrent.js');
    getCookieJar().set('srv-1', 'SID=abc123');
    expect(hasCookieFor('srv-1')).toBe(true);
  });

  it('is false for a different server id', async () => {
    const { hasCookieFor, getCookieJar } = await import('./qbittorrent.js');
    getCookieJar().set('srv-1', 'SID=abc123');
    expect(hasCookieFor('srv-2')).toBe(false);
  });
});

describe('logoutServer', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function setup() {
    const { logoutServer, getCookieJar } = await import('./qbittorrent.js');
    const { setActiveServerId } = await import('./server.js');
    return { logoutServer, getCookieJar, setActiveServerId };
  }

  it('returns { loggedOut: true }', async () => {
    const { logoutServer } = await setup();
    expect(logoutServer('srv-1')).toEqual({ loggedOut: true });
  });

  it('removes only the target server cookie, leaving other servers logged in', async () => {
    const { logoutServer, getCookieJar } = await setup();
    getCookieJar().set('srv-1', 'SID=abc');
    getCookieJar().set('srv-2', 'SID=def');
    logoutServer('srv-1');
    expect(getCookieJar().has('srv-1')).toBe(false);
    expect(getCookieJar().has('srv-2')).toBe(true);
  });

  it('emits server:set-active with null when the logged-out server was the active one', async () => {
    const { logoutServer, setActiveServerId } = await setup();
    setActiveServerId('srv-1');
    logoutServer('srv-1');
    expect(mockIpcMainEmit).toHaveBeenCalledWith('server:set-active', null, null);
  });

  it('does not touch the active server when a different server logs out', async () => {
    const { logoutServer, setActiveServerId } = await setup();
    setActiveServerId('srv-2');
    logoutServer('srv-1');
    expect(mockIpcMainEmit).not.toHaveBeenCalledWith('server:set-active', null, null);
  });

  it('forgets the start/stop endpoint choice for that server', async () => {
    const { logoutServer } = await setup();
    logoutServer('srv-1');
    expect(mockClearTorrentRunCache).toHaveBeenCalledWith('srv-1');
  });

  it('calls rebuildMenu and rebuildTrayMenu', async () => {
    const { logoutServer } = await setup();
    logoutServer('srv-1');
    expect(mockRebuildMenu).toHaveBeenCalled();
    expect(mockRebuildTrayMenu).toHaveBeenCalled();
  });
});

describe('loginServer', () => {
  beforeEach(() => {
    vi.resetModules();
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
    const { loginServer, getCookieJar } = await import('./qbittorrent.js');
    return { handler: loginServer, getCookieJar };
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
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { handler, getCookieJar } = await setup();
    await expect(handler('srv-1')).resolves.toEqual({ loggedIn: true });
    expect(getCookieJar().get('srv-1')).toBe('SID=abc123');
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Logged in to server srv-1'));
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
    await expect(handler('srv-1')).resolves.toEqual({ loggedIn: true });
    expect(getCookieJar().get('srv-1')).toBe('QBT_SID_8080=tok204');
  });

  describe('server info probe', () => {
    const okResponse = {
      ok: true,
      status: 200,
      text: () => Promise.resolve('Ok.'),
      headers: { getSetCookie: () => ['SID=abc123; HttpOnly'], get: () => null },
    };

    it('probes the server after a successful login when info is missing', async () => {
      mockGet.mockReturnValue({ ...fakeServerRow, export_available: null });
      mockFetch.mockResolvedValue(okResponse);
      mockRefreshServerInfo.mockResolvedValue({});
      const { handler } = await setup();
      await handler('srv-1');
      expect(mockRefreshServerInfo).toHaveBeenCalledWith('srv-1');
    });

    it('makes no extra requests when all three values are stored', async () => {
      mockGet.mockReturnValue({
        ...fakeServerRow,
        export_available: 1,
        webapi_version: '2.11.2',
        qb_version: 'v5.0.1',
      });
      mockFetch.mockResolvedValue(okResponse);
      const { handler } = await setup();
      await handler('srv-1');
      expect(mockRefreshServerInfo).not.toHaveBeenCalled();
    });

    it('still logs in and logs the error when the probe rejects', async () => {
      mockGet.mockReturnValue({ ...fakeServerRow, export_available: null });
      mockFetch.mockResolvedValue(okResponse);
      mockRefreshServerInfo.mockRejectedValue(new Error('probe boom'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { handler } = await setup();
      await expect(handler('srv-1')).resolves.toEqual({ loggedIn: true });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Server info probe failed for server srv-1'),
        expect.any(Error),
      );
    });
  });

  it('rejects a 200 Fails. with the friendly message, mapped to FAILED', async () => {
    mockGet.mockReturnValue(fakeServerRow);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('Fails.'),
      headers: { getSetCookie: () => [], get: () => null },
    });
    const { handler } = await setup();
    const err = await handler('srv-1').catch((e: unknown) => e);
    const mapped = toQbError(err, { login: true });
    expect(mapped.code).toBe('FAILED');
    expect(mapped.message).toBe('Login failed. Check username/password and WebUI settings.');
  });

  it('rejects a 403 (IP ban) as an HTTP error that maps to FORBIDDEN with the ban text', async () => {
    const banText =
      'Your IP address has been banned after too many failed authentication attempts.';
    mockGet.mockReturnValue(fakeServerRow);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve(banText),
      headers: { getSetCookie: () => [], get: () => null },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { handler } = await setup();
    const err = await handler('srv-1').catch((e: unknown) => e);
    expect(JSON.parse(err as string)).toMatchObject({
      name: 'QbHttpError',
      status: 403,
      path: '/api/v2/auth/login',
    });
    const mapped = toQbError(err, { login: true });
    expect(mapped.code).toBe('FORBIDDEN');
    expect(mapped.message).toBe(banText);
  });

  it('throws on qBittorrent 5+ bad credentials (401) with the friendly message', async () => {
    mockGet.mockReturnValue(fakeServerRow);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Unauthorized'),
      headers: { getSetCookie: () => [], get: () => null },
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { handler } = await setup();
    const err = await handler('srv-1').catch((e: unknown) => e);
    const mapped = toQbError(err, { login: true });
    expect(mapped.code).toBe('UNAUTHENTICATED');
    expect(mapped.message).toBe('Login failed. Check username/password and WebUI settings.');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Login failed for server srv-1'));
  });

  it('maps a 5xx on login to UNREACHABLE', async () => {
    mockGet.mockReturnValue(fakeServerRow);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: () => Promise.resolve(''),
      headers: { getSetCookie: () => [], get: () => null },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { handler } = await setup();
    const err = await handler('srv-1').catch((e: unknown) => e);
    const mapped = toQbError(err, { login: true });
    expect(mapped.code).toBe('UNREACHABLE');
    expect(mapped.message).toBe('Service Unavailable');
  });

  it('returns FORBIDDEN from the qb:call bridge for a banned login (end to end)', async () => {
    const banText =
      'Your IP address has been banned after too many failed authentication attempts.';
    mockGet.mockReturnValue(fakeServerRow);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve(banText),
      headers: { getSetCookie: () => [], get: () => null },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { registerQbBridgeHandlers } = await import('../qb/bridge.js');
    registerQbBridgeHandlers();
    const call = ipcHandlers.get('qb:call')!;
    expect(await call(null, 'auth.login', ['srv-1', 'u', 'p'])).toEqual({
      ok: false,
      code: 'FORBIDDEN',
      message: banText,
    });
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
    await expect(handler('srv-1')).rejects.toThrow('SID cookie was not returned');
  });

  it('throws when server is not found', async () => {
    mockGet.mockReturnValue(undefined);
    const { handler } = await setup();
    await expect(handler('missing')).rejects.toThrow('Server not found');
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
    await handler('srv-1');
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
    await handler('srv-1', 'runtime-user', 'runtime-pass');
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
    await handler('srv-1');
    const body = mockFetch.mock.calls[0][1].body.toString();
    expect(body).toContain('password=');
  });
});

describe('qbRequest', () => {
  beforeEach(() => {
    vi.resetModules();
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
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { qbRequest, getCookieJar } = await import('./qbittorrent.js');
    getCookieJar().set('srv-1', 'SID=tok');
    await expect(qbRequest({ id: 'srv-1', path: '/api/v2/test' })).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('GET /api/v2/test failed'));
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

describe('plain auth functions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('loginServer resolves { loggedIn: true } and stores the cookie', async () => {
    mockGet.mockReturnValue({
      id: 'srv-1',
      name: 'Test',
      host: 'localhost',
      protocol: 'http',
      port: 8080,
      username: 'admin',
      password: Buffer.from('secret'),
      auto_login: 0,
      created_at: '',
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('Ok.'),
      headers: { getSetCookie: () => ['SID=abc123; HttpOnly'], get: () => null },
    });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { loginServer, getCookieJar } = await import('./qbittorrent.js');
    await expect(loginServer('srv-1')).resolves.toEqual({ loggedIn: true });
    expect(getCookieJar().get('srv-1')).toBe('SID=abc123');
    expect(mockIpcMainEmit).toHaveBeenCalledWith('server:set-active', null, 'srv-1');
    expect(mockRebuildMenu).toHaveBeenCalled();
    expect(mockRebuildTrayMenu).toHaveBeenCalled();
  });

  it('logoutServer clears the cookie and returns { loggedOut: true }', async () => {
    const { logoutServer, getCookieJar } = await import('./qbittorrent.js');
    getCookieJar().set('srv-1', 'SID=abc');
    expect(logoutServer('srv-1')).toEqual({ loggedOut: true });
    expect(getCookieJar().has('srv-1')).toBe(false);
  });

  it('hasCookieFor reflects the cookie jar', async () => {
    const { hasCookieFor, getCookieJar } = await import('./qbittorrent.js');
    expect(hasCookieFor('srv-1')).toBe(false);
    getCookieJar().set('srv-1', 'SID=abc');
    expect(hasCookieFor('srv-1')).toBe(true);
    expect(hasCookieFor('srv-2')).toBe(false);
  });
});
