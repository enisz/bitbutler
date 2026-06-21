import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.hoisted(() => vi.fn());
const mockRun = vi.hoisted(() => vi.fn(() => ({ changes: 1 })));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  },
  safeStorage: {
    decryptString: vi.fn((buf: Buffer) => buf.toString()),
    isEncryptionAvailable: vi.fn(() => true),
  },
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
}));

vi.mock('../db.js', () => ({
  default: {
    prepare: () => ({ get: mockGet, all: vi.fn(() => []), run: mockRun }),
    transaction: vi.fn((fn: (arg: unknown) => unknown) => fn),
  },
}));

vi.mock('../menu.js', () => ({ rebuildMenu: vi.fn() }));
vi.mock('../tray.js', () => ({ rebuildTrayMenu: vi.fn() }));

describe('isActiveState', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function setup() {
    return import('./export.js');
  }

  it('returns false for pausedDL', async () => {
    const { isActiveState } = await setup();
    expect(isActiveState('pausedDL')).toBe(false);
  });

  it('returns false for pausedUP', async () => {
    const { isActiveState } = await setup();
    expect(isActiveState('pausedUP')).toBe(false);
  });

  it('returns false for stoppedDL (qBittorrent 5+)', async () => {
    const { isActiveState } = await setup();
    expect(isActiveState('stoppedDL')).toBe(false);
  });

  it('returns false for stoppedUP (qBittorrent 5+)', async () => {
    const { isActiveState } = await setup();
    expect(isActiveState('stoppedUP')).toBe(false);
  });

  it('returns true for downloading', async () => {
    const { isActiveState } = await setup();
    expect(isActiveState('downloading')).toBe(true);
  });

  it('returns true for seeding', async () => {
    const { isActiveState } = await setup();
    expect(isActiveState('seeding')).toBe(true);
  });

  it('returns true for stalledDL', async () => {
    const { isActiveState } = await setup();
    expect(isActiveState('stalledDL')).toBe(true);
  });

  it('returns false for undefined', async () => {
    const { isActiveState } = await setup();
    expect(isActiveState(undefined)).toBe(false);
  });
});

describe('applyPathMappings', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function setup() {
    return import('./export.js');
  }

  it('replaces matching prefix', async () => {
    const { applyPathMappings } = await setup();
    const result = applyPathMappings('/media/downloads/linux', [
      { from: '/media/downloads', to: '/mnt/nas' },
    ]);
    expect(result).toBe('/mnt/nas/linux');
  });

  it('returns original path when no rule matches', async () => {
    const { applyPathMappings } = await setup();
    const result = applyPathMappings('/home/user/torrents', [
      { from: '/media/downloads', to: '/mnt/nas' },
    ]);
    expect(result).toBe('/home/user/torrents');
  });

  it('applies first matching rule only', async () => {
    const { applyPathMappings } = await setup();
    const result = applyPathMappings('/media/downloads/movies', [
      { from: '/media/downloads', to: '/mnt/nas' },
      { from: '/media', to: '/storage' },
    ]);
    expect(result).toBe('/mnt/nas/movies');
  });

  it('ignores rules with empty from', async () => {
    const { applyPathMappings } = await setup();
    const result = applyPathMappings('/media/downloads', [
      { from: '', to: '/mnt/nas' },
      { from: '/media/downloads', to: '/mnt/data' },
    ]);
    expect(result).toBe('/mnt/data');
  });

  it('returns original path with empty mappings array', async () => {
    const { applyPathMappings } = await setup();
    expect(applyPathMappings('/media/downloads', [])).toBe('/media/downloads');
  });
});

describe('resolveFullMode', () => {
  const mockGetExportAvailable = vi.hoisted(() => vi.fn());
  const mockQbRequestProbe = vi.hoisted(() => vi.fn());

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('./server.js', () => ({ getExportAvailable: mockGetExportAvailable }));
    vi.doMock('./qbittorrent.js', () => ({ qbRequest: mockQbRequestProbe }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('./server.js');
    vi.doUnmock('./qbittorrent.js');
  });

  async function setup() {
    return import('./export.js');
  }

  it('returns true without probing when cached value is 1', async () => {
    mockGetExportAvailable.mockReturnValue(1);
    const { resolveFullMode } = await setup();
    expect(await resolveFullMode('server-1')).toBe(true);
    expect(mockQbRequestProbe).not.toHaveBeenCalled();
  });

  it('returns false without probing when cached value is 0', async () => {
    mockGetExportAvailable.mockReturnValue(0);
    const { resolveFullMode } = await setup();
    expect(await resolveFullMode('server-1')).toBe(false);
    expect(mockQbRequestProbe).not.toHaveBeenCalled();
  });

  it('probes live when cached value is null', async () => {
    mockGetExportAvailable.mockReturnValue(null);
    mockQbRequestProbe.mockResolvedValue(Buffer.from(''));
    const { resolveFullMode } = await setup();
    expect(await resolveFullMode('server-1')).toBe(true);
    expect(mockQbRequestProbe).toHaveBeenCalled();
  });
});

describe('export:check-availability IPC handler', () => {
  const ipcHandlersCheck = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
  const mockQbRequestAvail = vi.hoisted(() => vi.fn());

  beforeEach(() => {
    vi.resetModules();
    ipcHandlersCheck.clear();
    vi.doMock('electron', () => ({
      ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
          ipcHandlersCheck.set(channel, handler);
        }),
        on: vi.fn(),
      },
      dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
    }));
    vi.doMock('./qbittorrent.js', () => ({ qbRequest: mockQbRequestAvail }));
    vi.doMock('./server.js', () => ({ getExportAvailable: vi.fn() }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('electron');
    vi.doUnmock('./qbittorrent.js');
    vi.doUnmock('./server.js');
  });

  it('returns { available: true } when the probe succeeds', async () => {
    mockQbRequestAvail.mockResolvedValue(Buffer.from(''));
    const { registerExportIpcHandlers } = await import('./export.js');
    registerExportIpcHandlers();
    const handler = ipcHandlersCheck.get('export:check-availability')!;
    expect(await handler(null, { serverId: 'server-1' })).toEqual({ available: true });
  });

  it('returns { available: false } when the probe gets a 404', async () => {
    mockQbRequestAvail.mockRejectedValue(JSON.stringify({ status: 404 }));
    const { registerExportIpcHandlers } = await import('./export.js');
    registerExportIpcHandlers();
    const handler = ipcHandlersCheck.get('export:check-availability')!;
    expect(await handler(null, { serverId: 'server-1' })).toEqual({ available: false });
  });
});

describe('export:save-torrent-files IPC handler', () => {
  const ipcHandlersSave = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
  const mockShowSaveDialog = vi.hoisted(() => vi.fn());
  const mockShowOpenDialog = vi.hoisted(() => vi.fn());
  const mockQbRequestSave = vi.hoisted(() => vi.fn());
  const mockWriteFile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

  beforeEach(() => {
    vi.resetModules();
    ipcHandlersSave.clear();
    vi.doMock('electron', () => ({
      ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
          ipcHandlersSave.set(channel, handler);
        }),
        on: vi.fn(),
      },
      dialog: { showSaveDialog: mockShowSaveDialog, showOpenDialog: mockShowOpenDialog },
    }));
    vi.doMock('./qbittorrent.js', () => ({ qbRequest: mockQbRequestSave }));
    vi.doMock('./server.js', () => ({ getExportAvailable: vi.fn() }));
    vi.doMock('node:fs', () => ({
      default: { promises: { writeFile: mockWriteFile } },
      promises: { writeFile: mockWriteFile },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('electron');
    vi.doUnmock('./qbittorrent.js');
    vi.doUnmock('./server.js');
    vi.doUnmock('node:fs');
  });

  async function getHandler() {
    const { registerExportIpcHandlers } = await import('./export.js');
    registerExportIpcHandlers();
    return ipcHandlersSave.get('export:save-torrent-files')!;
  }

  it('returns cancelled when there are no items', async () => {
    const handler = await getHandler();
    const result = await handler(null, { serverId: 'server-1', items: [] });
    expect(result).toEqual({ cancelled: true, savedPaths: [], failed: [] });
  });

  it('shows a save dialog for a single item and writes the buffer', async () => {
    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/My Torrent.torrent' });
    mockQbRequestSave.mockResolvedValue(Buffer.from('torrent-bytes'));
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [{ hash: 'abc', name: 'My Torrent' }],
    });
    expect(mockShowSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: 'My Torrent.torrent' }),
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/My Torrent.torrent',
      Buffer.from('torrent-bytes'),
    );
    expect(result).toEqual({
      cancelled: false,
      savedPaths: ['/tmp/My Torrent.torrent'],
      failed: [],
    });
  });

  it('returns cancelled when the single-item save dialog is cancelled', async () => {
    mockShowSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [{ hash: 'abc', name: 'My Torrent' }],
    });
    expect(result).toEqual({ cancelled: true, savedPaths: [], failed: [] });
    expect(mockQbRequestSave).not.toHaveBeenCalled();
  });

  it('shows a directory picker for multiple items and writes one file per item', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/out'] });
    mockQbRequestSave.mockResolvedValue(Buffer.from('bytes'));
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [
        { hash: 'aaa', name: 'First' },
        { hash: 'bbb', name: 'Second' },
      ],
    });
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('First.torrent'),
      Buffer.from('bytes'),
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('Second.torrent'),
      Buffer.from('bytes'),
    );
    expect(result.cancelled).toBe(false);
    expect(result.savedPaths).toHaveLength(2);
  });

  it('disambiguates a filename collision by appending the hash', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/out'] });
    mockQbRequestSave.mockResolvedValue(Buffer.from('bytes'));
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [
        { hash: 'aaaaaaaa11', name: 'Same Name' },
        { hash: 'bbbbbbbb22', name: 'Same Name' },
      ],
    });
    expect(result.savedPaths.some((p: string) => p.includes('bbbbbbbb'))).toBe(true);
  });

  it('collects per-item failures without aborting the batch', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/out'] });
    mockQbRequestSave
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(Buffer.from('bytes'));
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [
        { hash: 'aaa', name: 'Fails' },
        { hash: 'bbb', name: 'Succeeds' },
      ],
    });
    expect(result.failed).toEqual([{ hash: 'aaa', name: 'Fails', error: 'network error' }]);
    expect(result.savedPaths).toHaveLength(1);
  });

  it('returns cancelled when the directory picker is cancelled', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [
        { hash: 'aaa', name: 'A' },
        { hash: 'bbb', name: 'B' },
      ],
    });
    expect(result).toEqual({ cancelled: true, savedPaths: [], failed: [] });
  });
});

describe('collectCategoriesAndTags', () => {
  const mockQbRequest = vi.hoisted(() => vi.fn());

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('./qbittorrent.js', () => ({ qbRequest: mockQbRequest }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('./qbittorrent.js');
  });

  async function setup() {
    return import('./export.js');
  }

  it('returns categories and tags fetched from the server', async () => {
    mockQbRequest.mockImplementation(({ path }: { path: string }) => {
      if (path === '/api/v2/torrents/categories') {
        return Promise.resolve({ Movies: { name: 'Movies', savePath: '/data/movies' } });
      }
      if (path === '/api/v2/torrents/tags') {
        return Promise.resolve(['linux', 'documentary']);
      }
      throw new Error(`unexpected path ${path}`);
    });

    const { collectCategoriesAndTags } = await setup();
    const result = await collectCategoriesAndTags('server-1');

    expect(result.categories).toEqual({ Movies: { name: 'Movies', savePath: '/data/movies' } });
    expect(result.tags).toEqual(['linux', 'documentary']);
  });

  it('returns empty collections when the server has none', async () => {
    mockQbRequest.mockImplementation(({ path }: { path: string }) => {
      if (path === '/api/v2/torrents/categories') return Promise.resolve({});
      if (path === '/api/v2/torrents/tags') return Promise.resolve([]);
      throw new Error(`unexpected path ${path}`);
    });

    const { collectCategoriesAndTags } = await setup();
    const result = await collectCategoriesAndTags('server-1');

    expect(result.categories).toEqual({});
    expect(result.tags).toEqual([]);
  });
});

describe('filterAssignedCategories', () => {
  it('keeps only categories assigned to at least one entry', async () => {
    const { filterAssignedCategories } = await import('./export.js');

    const categories = {
      Movies: { name: 'Movies', savePath: '/data/movies' },
      Music: { name: 'Music', savePath: '/data/music' },
    };
    const entries = [
      { hash: 'a', name: 'a', failed: false, category: 'Movies' },
      { hash: 'b', name: 'b', failed: false, category: '' },
    ];

    expect(filterAssignedCategories(categories, entries)).toEqual({
      Movies: { name: 'Movies', savePath: '/data/movies' },
    });
  });
});

describe('filterAssignedTags', () => {
  it('keeps only tags assigned to at least one entry', async () => {
    const { filterAssignedTags } = await import('./export.js');

    const tags = ['linux', 'documentary', 'unused'];
    const entries = [
      { hash: 'a', name: 'a', failed: false, tags: ['linux'] },
      { hash: 'b', name: 'b', failed: false, tags: ['documentary', 'linux'] },
    ];

    expect(filterAssignedTags(tags, entries)).toEqual(['linux', 'documentary']);
  });
});

describe('restoreCategoriesAndTags', () => {
  const mockQbRequestRestore = vi.hoisted(() => vi.fn());

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('./qbittorrent.js', () => ({ qbRequest: mockQbRequestRestore }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('./qbittorrent.js');
  });

  async function setup() {
    return import('./export.js');
  }

  it('does nothing when both restoreCategories and restoreTags are false', async () => {
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/data/movies' } }, tags: ['linux'] },
      false,
      false,
      [],
      false,
    );
    expect(mockQbRequestRestore).not.toHaveBeenCalled();
  });

  it('creates tags via createTags when restoreTags is true', async () => {
    mockQbRequestRestore.mockResolvedValue(undefined);
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: {}, tags: ['linux', 'docs'] },
      false,
      true,
      [],
      false,
    );

    expect(mockQbRequestRestore).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'server-1',
        method: 'POST',
        path: '/api/v2/torrents/createTags',
        form: { tags: 'linux,docs' },
      }),
    );
  });

  it('creates a category that does not exist on the target server', async () => {
    mockQbRequestRestore.mockImplementation(({ path }: { path: string }) => {
      if (path === '/api/v2/torrents/categories') return Promise.resolve({});
      return Promise.resolve(undefined);
    });
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/data/movies' } }, tags: [] },
      true,
      false,
      [],
      false,
    );

    expect(mockQbRequestRestore).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/api/v2/torrents/createCategory',
        form: { category: 'Movies', savePath: '/data/movies' },
      }),
    );
  });

  it('leaves an existing category untouched when overwriteCategories is false', async () => {
    mockQbRequestRestore.mockImplementation(({ path }: { path: string }) => {
      if (path === '/api/v2/torrents/categories') {
        return Promise.resolve({ Movies: { name: 'Movies', savePath: '/old/movies' } });
      }
      return Promise.resolve(undefined);
    });
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/data/movies' } }, tags: [] },
      true,
      false,
      [],
      false,
    );

    expect(mockQbRequestRestore).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/v2/torrents/editCategory' }),
    );
    expect(mockQbRequestRestore).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/v2/torrents/createCategory' }),
    );
  });

  it('edits an existing category via editCategory when overwriteCategories is true', async () => {
    mockQbRequestRestore.mockImplementation(({ path }: { path: string }) => {
      if (path === '/api/v2/torrents/categories') {
        return Promise.resolve({ Movies: { name: 'Movies', savePath: '/old/movies' } });
      }
      return Promise.resolve(undefined);
    });
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/data/movies' } }, tags: [] },
      true,
      false,
      [],
      true,
    );

    expect(mockQbRequestRestore).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/api/v2/torrents/editCategory',
        form: { category: 'Movies', savePath: '/data/movies' },
      }),
    );
  });

  it('applies categoryPathMappings before creating a category', async () => {
    mockQbRequestRestore.mockImplementation(({ path }: { path: string }) => {
      if (path === '/api/v2/torrents/categories') return Promise.resolve({});
      return Promise.resolve(undefined);
    });
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/old/movies' } }, tags: [] },
      true,
      false,
      [{ from: '/old', to: '/data' }],
      false,
    );

    expect(mockQbRequestRestore).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/v2/torrents/createCategory',
        form: { category: 'Movies', savePath: '/data/movies' },
      }),
    );
  });
});
