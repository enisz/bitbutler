import { afterEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockReaddir = vi.hoisted(() => vi.fn());

vi.mock('node:fs', () => ({
  default: {
    promises: {
      readdir: mockReaddir,
      readFile: vi.fn(),
    },
  },
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  },
}));

function dirent(name: string, isDir: boolean) {
  return { name, isDirectory: () => isDir, isFile: () => !isDir };
}

describe('torrent:scan-folder', () => {
  afterEach(() => {
    vi.clearAllMocks();
    ipcHandlers.clear();
  });

  async function registerAndGetHandlers() {
    const { registerTorrentIpcHandlers } = await import('./torrent.js');
    registerTorrentIpcHandlers();
    return ipcHandlers;
  }

  it('returns .torrent files in the top-level directory only when recursive is false', async () => {
    mockReaddir.mockResolvedValueOnce([
      dirent('a.torrent', false),
      dirent('notes.txt', false),
      dirent('subfolder', true),
    ]);

    const handlers = await registerAndGetHandlers();
    const result = (await handlers.get('torrent:scan-folder')!(null, {
      path: '/downloads',
      recursive: false,
    })) as { path: string; relativePath: string }[];

    expect(result).toEqual([{ path: '/downloads/a.torrent', relativePath: 'a.torrent' }]);
    expect(mockReaddir).toHaveBeenCalledTimes(1);
  });

  it('recurses into subdirectories when recursive is true', async () => {
    mockReaddir
      .mockResolvedValueOnce([dirent('top.torrent', false), dirent('nested', true)])
      .mockResolvedValueOnce([dirent('inner.torrent', false)]);

    const handlers = await registerAndGetHandlers();
    const result = (await handlers.get('torrent:scan-folder')!(null, {
      path: '/downloads',
      recursive: true,
    })) as { path: string; relativePath: string }[];

    expect(result).toEqual([
      { path: '/downloads/top.torrent', relativePath: 'top.torrent' },
      { path: '/downloads/nested/inner.torrent', relativePath: 'nested/inner.torrent' },
    ]);
  });

  it('does not recurse into subdirectories when recursive is false', async () => {
    mockReaddir.mockResolvedValueOnce([dirent('top.torrent', false), dirent('nested', true)]);

    const handlers = await registerAndGetHandlers();
    const result = (await handlers.get('torrent:scan-folder')!(null, {
      path: '/downloads',
      recursive: false,
    })) as { path: string; relativePath: string }[];

    expect(result).toEqual([{ path: '/downloads/top.torrent', relativePath: 'top.torrent' }]);
    expect(mockReaddir).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when no path is provided', async () => {
    const handlers = await registerAndGetHandlers();
    const result = await handlers.get('torrent:scan-folder')!(null, { path: '', recursive: false });
    expect(result).toEqual([]);
  });

  it('propagates a readdir rejection (e.g. folder does not exist)', async () => {
    mockReaddir.mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

    const handlers = await registerAndGetHandlers();
    await expect(
      handlers.get('torrent:scan-folder')!(null, { path: '/missing', recursive: false }),
    ).rejects.toThrow('ENOENT');
  });
});
