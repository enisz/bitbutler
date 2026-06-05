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
