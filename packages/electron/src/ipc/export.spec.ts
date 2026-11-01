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

const qb = vi.hoisted(() => ({
  tags: vi.fn(),
  createTags: vi.fn(),
  categories: vi.fn(),
  createCategory: vi.fn(),
  editCategory: vi.fn(),
  setCategory: vi.fn(),
  addTags: vi.fn(),
  removeAllTags: vi.fn(),
  infoByHashes: vi.fn(),
  files: vi.fn(),
  setLocation: vi.fn(),
  renameFile: vi.fn(),
  filePrio: vi.fn(),
  setShareLimits: vi.fn(),
  setUploadLimit: vi.fn(),
  setDownloadLimit: vi.fn(),
  exportTorrentFile: vi.fn(),
  addTorrent: vi.fn(),
  setSuperSeeding: vi.fn(),
  start: vi.fn(),
  resolveFullMode: vi.fn(),
  refreshServerInfo: vi.fn(),
}));

beforeEach(() => {
  Object.values(qb).forEach((fn) => fn.mockReset().mockResolvedValue(undefined));
});

vi.mock('../qb/labels.js', () => ({
  tags: qb.tags,
  createTags: qb.createTags,
  categories: qb.categories,
  createCategory: qb.createCategory,
  editCategory: qb.editCategory,
  setCategory: qb.setCategory,
  addTags: qb.addTags,
  removeAllTags: qb.removeAllTags,
}));
vi.mock('../qb/torrent-details.js', () => ({
  infoByHashes: qb.infoByHashes,
  files: qb.files,
  setLocation: qb.setLocation,
  renameFile: qb.renameFile,
  filePrio: qb.filePrio,
  setShareLimits: qb.setShareLimits,
  setUploadLimit: qb.setUploadLimit,
  setDownloadLimit: qb.setDownloadLimit,
  exportTorrentFile: qb.exportTorrentFile,
  addTorrent: qb.addTorrent,
}));
vi.mock('../qb/torrents.js', () => ({ start: qb.start, setSuperSeeding: qb.setSuperSeeding }));
vi.mock('../qb/server-info.js', () => ({
  resolveFullMode: qb.resolveFullMode,
  refreshServerInfo: qb.refreshServerInfo,
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

describe('export:save-torrent-files IPC handler', () => {
  const ipcHandlersSave = new Map<string, (...args: unknown[]) => unknown>();
  const mockShowSaveDialog = vi.fn();
  const mockShowOpenDialog = vi.fn();
  const mockWriteFile = vi.fn().mockResolvedValue(undefined);

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
    vi.doMock('node:fs', () => ({
      default: { promises: { writeFile: mockWriteFile } },
      promises: { writeFile: mockWriteFile },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
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
    qb.exportTorrentFile.mockResolvedValue(Buffer.from('torrent-bytes'));
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [{ hash: 'abc', name: 'My Torrent' }],
    });
    expect(mockShowSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: 'My Torrent.torrent' }),
    );
    expect(qb.exportTorrentFile).toHaveBeenCalledWith('server-1', 'abc');
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
    expect(qb.exportTorrentFile).not.toHaveBeenCalled();
  });

  it('shows a directory picker for multiple items and writes one file per item', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/out'] });
    qb.exportTorrentFile.mockResolvedValue(Buffer.from('bytes'));
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [
        { hash: 'aaa', name: 'First' },
        { hash: 'bbb', name: 'Second' },
      ],
    });
    expect(qb.exportTorrentFile).toHaveBeenCalledWith('server-1', 'aaa');
    expect(qb.exportTorrentFile).toHaveBeenCalledWith('server-1', 'bbb');
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
    qb.exportTorrentFile.mockResolvedValue(Buffer.from('bytes'));
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
    qb.exportTorrentFile
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

  it('produces a friendly error message for a qBittorrent HTTP failure', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/out'] });
    const { QbBridgeError } = await import('../qb/errors.js');
    qb.exportTorrentFile.mockRejectedValueOnce(new QbBridgeError('NOT_FOUND', 'Not Found', 404));
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [
        { hash: 'aaa', name: 'Fails' },
        { hash: 'bbb', name: 'Succeeds' },
      ],
    });
    expect(result.failed).toEqual([{ hash: 'aaa', name: 'Fails', error: '404 Not Found' }]);
  });
});

describe('collectCategoriesAndTags', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function setup() {
    return import('./export.js');
  }

  it('returns categories and tags fetched from the server', async () => {
    qb.categories.mockResolvedValue({ Movies: { name: 'Movies', savePath: '/data/movies' } });
    qb.tags.mockResolvedValue(['linux', 'documentary']);

    const { collectCategoriesAndTags } = await setup();
    const result = await collectCategoriesAndTags('server-1');

    expect(qb.categories).toHaveBeenCalledWith('server-1');
    expect(qb.tags).toHaveBeenCalledWith('server-1');
    expect(result.categories).toEqual({ Movies: { name: 'Movies', savePath: '/data/movies' } });
    expect(result.tags).toEqual(['linux', 'documentary']);
  });

  it('returns empty collections when the server has none', async () => {
    qb.categories.mockResolvedValue({});
    qb.tags.mockResolvedValue([]);

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

describe('partitionImportEntries', () => {
  async function setup() {
    return import('./export.js');
  }

  it('keeps entries whose hash is not in skipHashes in toProcess', async () => {
    const { partitionImportEntries } = await setup();
    const torrents = [
      { hash: 'aaa', name: 'A', failed: false },
      { hash: 'bbb', name: 'B', failed: false },
    ];
    const result = partitionImportEntries(torrents as any, ['bbb']);
    expect(result.toProcess).toEqual([{ hash: 'aaa', name: 'A', failed: false }]);
    expect(result.alreadyExisted).toEqual([{ hash: 'bbb', name: 'B', failed: false }]);
  });

  it('matches hashes case-insensitively', async () => {
    const { partitionImportEntries } = await setup();
    const torrents = [{ hash: 'ABCDEF', name: 'A', failed: false }];
    const result = partitionImportEntries(torrents as any, ['abcdef']);
    expect(result.toProcess).toEqual([]);
    expect(result.alreadyExisted).toEqual(torrents);
  });

  it('returns everything in toProcess when skipHashes is empty', async () => {
    const { partitionImportEntries } = await setup();
    const torrents = [{ hash: 'aaa', name: 'A', failed: false }];
    const result = partitionImportEntries(torrents as any, []);
    expect(result.toProcess).toEqual(torrents);
    expect(result.alreadyExisted).toEqual([]);
  });
});

describe('runImport', () => {
  const mockZipGetEntry = vi.fn();

  function fakeEvent() {
    return { sender: { isDestroyed: () => false, send: vi.fn() } };
  }

  function metadataEntry(torrents: unknown[], exportMode: 'full' | 'legacy' = 'legacy') {
    const metadata = {
      version: 1,
      exported_at: 0,
      source_server: 'srv',
      export_mode: exportMode,
      torrents,
    };
    return { getData: () => ({ toString: () => JSON.stringify(metadata) }) };
  }

  function basePayload(overrides: Record<string, unknown> = {}) {
    return {
      serverId: 'server-1',
      bbePath: '/tmp/archive.bbe',
      restoreFields: [],
      startMode: 'paused',
      pathMappings: [],
      restoreCategories: false,
      restoreTags: false,
      categoryPathMappings: [],
      overwriteCategories: false,
      skipHashes: [],
      ...overrides,
    };
  }

  function archive(torrents: unknown[]) {
    mockZipGetEntry.mockImplementation((name: string) =>
      name === 'metadata.json' ? metadataEntry(torrents) : undefined,
    );
  }

  const existing = (extra: Record<string, unknown> = {}) => ({
    hash: 'aaa',
    name: 'Existing',
    failed: false,
    magnet_link: 'magnet:?xt=aaa',
    ...extra,
  });

  beforeEach(() => {
    vi.resetModules();
    mockZipGetEntry.mockReset();
    qb.addTorrent.mockResolvedValue('Ok.');
    qb.infoByHashes.mockResolvedValue([{ hash: 'aaa' }]);
    qb.files.mockResolvedValue([]);
    vi.doMock('electron', () => ({
      ipcMain: { handle: vi.fn(), on: vi.fn() },
      dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
    }));
    vi.doMock('adm-zip', () => ({
      // Vitest 4 invokes a mock's implementation through `Reflect.construct` when the mock is
      // called with `new`, so the implementation has to be a `function` (arrows are not
      // constructable).
      default: vi.fn().mockImplementation(function () {
        return { getEntry: mockZipGetEntry };
      }),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('electron');
    vi.doUnmock('adm-zip');
  });

  async function setup() {
    return import('./export.js');
  }

  it('skips entries whose hash is in skipHashes without calling qBittorrent for them', async () => {
    archive([
      { hash: 'aaa', name: 'Already Here', failed: false, magnet_link: 'magnet:?xt=aaa' },
      { hash: 'bbb', name: 'Already Here Too', failed: false, magnet_link: 'magnet:?xt=bbb' },
    ]);

    const { runImport } = await setup();
    const event = fakeEvent();
    await runImport(event as any, basePayload({ skipHashes: ['aaa', 'bbb'] }) as any);

    expect(qb.addTorrent).not.toHaveBeenCalled();
    expect(qb.infoByHashes).not.toHaveBeenCalled();
    expect(event.sender.send).toHaveBeenCalledWith('import:done', {
      total: 0,
      failed: 0,
      alreadyExisted: 2,
    });
  });

  it('processes non-skipped entries normally while leaving skipped ones untouched', async () => {
    archive([
      { hash: 'aaa', name: 'Already Here', failed: false, magnet_link: 'magnet:?xt=aaa' },
      { hash: 'bbb', name: 'New Torrent', failed: false, magnet_link: 'magnet:?xt=bbb' },
    ]);

    const { runImport } = await setup();
    const event = fakeEvent();
    await runImport(event as any, basePayload({ skipHashes: ['aaa'] }) as any);

    expect(qb.addTorrent).toHaveBeenCalledTimes(1);
    expect(qb.addTorrent).toHaveBeenCalledWith('server-1', {
      urls: ['magnet:?xt=bbb'],
      torrents: [],
      options: { paused: 'true' },
    });
    expect(event.sender.send).toHaveBeenCalledWith('import:progress', {
      current: 1,
      total: 1,
      name: 'New Torrent',
      hash: 'bbb',
      success: true,
    });
    expect(event.sender.send).toHaveBeenCalledWith('import:done', {
      total: 1,
      failed: 0,
      alreadyExisted: 1,
    });
  });

  it('adds a full-mode entry from the archived .torrent file', async () => {
    mockZipGetEntry.mockImplementation((name: string) => {
      if (name === 'metadata.json') {
        return metadataEntry([{ hash: 'aaa', name: 'Full', failed: false }], 'full');
      }
      if (name === 'torrents/aaa.torrent') return { getData: () => Buffer.from([1, 2, 3]) };
      return undefined;
    });

    const { runImport } = await setup();
    const event = fakeEvent();
    await runImport(event as any, basePayload() as any);

    expect(qb.addTorrent).toHaveBeenCalledWith('server-1', {
      torrents: [{ name: 'aaa.torrent', bytes: [1, 2, 3] }],
      options: { paused: 'true' },
    });
  });

  it('reports success: false and increments failed when addTorrent throws', async () => {
    archive([{ hash: 'ccc', name: 'Broken', failed: false, magnet_link: 'magnet:?xt=ccc' }]);
    qb.addTorrent.mockRejectedValue(new Error('qb request failed'));

    const { runImport } = await setup();
    const event = fakeEvent();
    await runImport(event as any, basePayload() as any);

    expect(event.sender.send).toHaveBeenCalledWith('import:progress', {
      current: 1,
      total: 1,
      name: 'Broken',
      hash: 'ccc',
      success: false,
    });
    expect(event.sender.send).toHaveBeenCalledWith('import:done', {
      total: 1,
      failed: 1,
      alreadyExisted: 0,
    });
  });

  it('reapplies save_path via setLocation so overwriting a duplicate updates its path', async () => {
    archive([existing({ save_path: '/original/path' })]);

    const { runImport } = await setup();
    await runImport(
      fakeEvent() as any,
      basePayload({ restoreFields: ['save_path'], pathMappings: [] }) as any,
    );

    expect(qb.infoByHashes).toHaveBeenCalledWith('server-1', ['aaa']);
    expect(qb.setLocation).toHaveBeenCalledWith('server-1', ['aaa'], '/original/path');
  }, 10000);

  it('reapplies category via setCategory so overwriting a duplicate updates its category', async () => {
    archive([existing({ category: 'Movies' })]);

    const { runImport } = await setup();
    await runImport(fakeEvent() as any, basePayload({ restoreFields: ['categories'] }) as any);

    expect(qb.setCategory).toHaveBeenCalledWith('server-1', ['aaa'], 'Movies');
  }, 10000);

  it('reapplies tags via removeAllTags+addTags so overwriting a duplicate updates its tags', async () => {
    archive([existing({ tags: ['linux', 'documentary'] })]);

    const { runImport } = await setup();
    await runImport(fakeEvent() as any, basePayload({ restoreFields: ['tags'] }) as any);

    expect(qb.removeAllTags).toHaveBeenCalledWith('server-1', ['aaa']);
    expect(qb.addTags).toHaveBeenCalledWith('server-1', ['aaa'], ['linux', 'documentary']);
  }, 10000);

  it('removes all tags without calling addTags when the archived entry has no tags', async () => {
    archive([existing({ tags: [] })]);

    const { runImport } = await setup();
    await runImport(fakeEvent() as any, basePayload({ restoreFields: ['tags'] }) as any);

    expect(qb.removeAllTags).toHaveBeenCalledWith('server-1', ['aaa']);
    expect(qb.addTags).not.toHaveBeenCalled();
  }, 10000);

  it('renames files and restores priorities grouped by priority', async () => {
    archive([
      existing({
        files: [
          { index: 0, name: 'new/a.mkv', priority: 1 },
          { index: 1, name: 'b.mkv', priority: 0 },
          { index: 2, name: 'c.mkv', priority: 1 },
        ],
      }),
    ]);
    qb.files.mockResolvedValue([
      { index: 0, name: 'a.mkv', priority: 1 },
      { index: 1, name: 'b.mkv', priority: 1 },
      { index: 2, name: 'c.mkv', priority: 1 },
    ]);

    const { runImport } = await setup();
    await runImport(
      fakeEvent() as any,
      basePayload({ restoreFields: ['renames', 'priorities'] }) as any,
    );

    expect(qb.files).toHaveBeenCalledWith('server-1', 'aaa');
    expect(qb.renameFile).toHaveBeenCalledTimes(1);
    expect(qb.renameFile).toHaveBeenCalledWith('server-1', 'aaa', 'a.mkv', 'new/a.mkv');
    expect(qb.filePrio).toHaveBeenCalledWith('server-1', 'aaa', [0, 2], 1);
    expect(qb.filePrio).toHaveBeenCalledWith('server-1', 'aaa', [1], 0);
  }, 10000);

  it('restores per-torrent limits, share limits and super seeding', async () => {
    archive([
      existing({
        up_limit: 100,
        dl_limit: 200,
        ratio_limit: 2,
        seeding_time_limit: 30,
        inactive_seeding_time_limit: 40,
        super_seeding: true,
      }),
    ]);

    const { runImport } = await setup();
    await runImport(
      fakeEvent() as any,
      basePayload({ restoreFields: ['speed_limits', 'share_limits', 'super_seeding'] }) as any,
    );

    expect(qb.setUploadLimit).toHaveBeenCalledWith('server-1', 100, ['aaa']);
    expect(qb.setDownloadLimit).toHaveBeenCalledWith('server-1', 200, ['aaa']);
    expect(qb.setShareLimits).toHaveBeenCalledWith('server-1', ['aaa'], 2, 30, 40);
    expect(qb.setSuperSeeding).toHaveBeenCalledWith('server-1', ['aaa'], true);
  }, 10000);

  it('keeps going when a non-critical restore call fails', async () => {
    archive([existing({ up_limit: 100, category: 'Movies' })]);
    qb.setCategory.mockRejectedValue(new Error('boom'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { runImport } = await setup();
    await runImport(
      fakeEvent() as any,
      basePayload({ restoreFields: ['categories', 'speed_limits'] }) as any,
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to restore category'),
      expect.any(Error),
    );
    expect(qb.setUploadLimit).toHaveBeenCalledWith('server-1', 100, ['aaa']);
  }, 10000);

  it.each([
    ['all', 'stopped', true],
    ['all', 'downloading', true],
    ['active', 'downloading', true],
    ['active', 'stoppedDL', false],
    ['paused', 'downloading', false],
  ])(
    'startMode %s with state %s resumes: %s',
    async (startMode, state, resumes) => {
      archive([existing({ state })]);

      const { runImport } = await setup();
      await runImport(fakeEvent() as any, basePayload({ startMode }) as any);

      if (resumes) expect(qb.start).toHaveBeenCalledWith('server-1', ['aaa']);
      else expect(qb.start).not.toHaveBeenCalled();
    },
    10000,
  );
});

describe('restoreCategoriesAndTags', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('electron', () => ({
      ipcMain: { handle: vi.fn(), on: vi.fn() },
      dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('electron');
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
    expect(qb.createTags).not.toHaveBeenCalled();
    expect(qb.categories).not.toHaveBeenCalled();
  });

  it('creates tags via createTags when restoreTags is true', async () => {
    qb.createTags.mockResolvedValue(undefined);
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: {}, tags: ['linux', 'docs'] },
      false,
      true,
      [],
      false,
    );

    expect(qb.createTags).toHaveBeenCalledWith('server-1', ['linux', 'docs']);
  });

  it('logs a warning and does not throw when createTags fails', async () => {
    qb.createTags.mockRejectedValue(new Error('network error'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { restoreCategoriesAndTags } = await setup();
    await expect(
      restoreCategoriesAndTags(
        'server-1',
        { categories: {}, tags: ['linux'] },
        false,
        true,
        [],
        false,
      ),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to restore tags'),
      expect.any(Error),
    );
  });

  it('creates a category that does not exist on the target server', async () => {
    qb.categories.mockResolvedValue({});
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/data/movies' } }, tags: [] },
      true,
      false,
      [],
      false,
    );

    expect(qb.createCategory).toHaveBeenCalledWith('server-1', 'Movies', '/data/movies');
  });

  it('treats a failed categories lookup as an empty server', async () => {
    qb.categories.mockRejectedValue(new Error('nope'));
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/data/movies' } }, tags: [] },
      true,
      false,
      [],
      false,
    );

    expect(qb.createCategory).toHaveBeenCalledWith('server-1', 'Movies', '/data/movies');
  });

  it('leaves an existing category untouched when overwriteCategories is false', async () => {
    qb.categories.mockResolvedValue({ Movies: { name: 'Movies', savePath: '/old/movies' } });
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/data/movies' } }, tags: [] },
      true,
      false,
      [],
      false,
    );

    expect(qb.editCategory).not.toHaveBeenCalled();
    expect(qb.createCategory).not.toHaveBeenCalled();
  });

  it('edits an existing category via editCategory when overwriteCategories is true', async () => {
    qb.categories.mockResolvedValue({ Movies: { name: 'Movies', savePath: '/old/movies' } });
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/data/movies' } }, tags: [] },
      true,
      false,
      [],
      true,
    );

    expect(qb.editCategory).toHaveBeenCalledWith('server-1', 'Movies', '/data/movies');
  });

  it('applies categoryPathMappings before creating a category', async () => {
    qb.categories.mockResolvedValue({});
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/old/movies' } }, tags: [] },
      true,
      false,
      [{ from: '/old', to: '/data' }],
      false,
    );

    expect(qb.createCategory).toHaveBeenCalledWith('server-1', 'Movies', '/data/movies');
  });
});
