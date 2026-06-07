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
