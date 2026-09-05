import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const ipcOnHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockAxiosGet = vi.hoisted(() => vi.fn());
const mockShellOpenExternal = vi.hoisted(() => vi.fn());
const mockShellOpenPath = vi.hoisted(() => vi.fn(() => Promise.resolve('')));
const mockShellShowItemInFolder = vi.hoisted(() => vi.fn());
const mockDialogShowOpenDialog = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ filePaths: [] as string[] })),
);
const mockAppGetVersion = vi.hoisted(() => vi.fn(() => '1.0.0'));
const mockAppQuit = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: mockAppGetVersion,
    quit: mockAppQuit,
  },
  shell: {
    openExternal: mockShellOpenExternal,
    openPath: mockShellOpenPath,
    showItemInFolder: mockShellShowItemInFolder,
  },
  dialog: {
    showOpenDialog: mockDialogShowOpenDialog,
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcOnHandlers.set(channel, handler);
    }),
  },
}));

vi.mock('axios', () => ({
  default: { get: mockAxiosGet },
}));

describe('electron IPC handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
    ipcOnHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function registerAndGetHandlers() {
    const { registerElectronIpcHandlers } = await import('./electron.js');
    registerElectronIpcHandlers();
    return ipcHandlers;
  }

  async function registerAndGetOnHandlers() {
    const { registerElectronIpcHandlers } = await import('./electron.js');
    registerElectronIpcHandlers();
    return ipcOnHandlers;
  }

  describe('electron:quit', () => {
    it('calls app.quit()', async () => {
      const handlers = await registerAndGetOnHandlers();
      handlers.get('electron:quit')!(null);
      expect(mockAppQuit).toHaveBeenCalled();
    });
  });

  describe('electron:is-dev', () => {
    it('returns true when app is not packaged', async () => {
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('electron:is-dev')!(null)).toBe(true);
    });

    it('returns false when app is packaged', async () => {
      const electronMock = (await import('electron')) as any;
      electronMock.app.isPackaged = true;
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('electron:is-dev')!(null)).toBe(false);
      electronMock.app.isPackaged = false;
    });
  });

  describe('electron:get-platform', () => {
    it('returns the current process platform', async () => {
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('electron:get-platform')!(null)).toBe(process.platform);
    });
  });

  describe('electron:open-external-url', () => {
    it('calls shell.openExternal with the given URL', async () => {
      const handlers = await registerAndGetHandlers();
      await handlers.get('electron:open-external-url')!(null, 'https://example.com');
      expect(mockShellOpenExternal).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('electron:open-path', () => {
    it('calls shell.openPath with the given path', async () => {
      const handlers = await registerAndGetHandlers();
      await handlers.get('electron:open-path')!(null, '/some/file.txt');
      expect(mockShellOpenPath).toHaveBeenCalledWith('/some/file.txt');
    });
  });

  describe('electron:show-item-in-folder', () => {
    it('calls shell.showItemInFolder with the given path', async () => {
      const handlers = await registerAndGetHandlers();
      await handlers.get('electron:show-item-in-folder')!(null, '/some/file.txt');
      expect(mockShellShowItemInFolder).toHaveBeenCalledWith('/some/file.txt');
    });
  });

  describe('electron:show-open-dialog', () => {
    it('returns undefined when no folder is selected', async () => {
      mockDialogShowOpenDialog.mockResolvedValue({ filePaths: [] });
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('electron:show-open-dialog')!(null)).toBeUndefined();
    });

    it('returns the selected folder path', async () => {
      mockDialogShowOpenDialog.mockResolvedValue({ filePaths: ['/selected/folder'] });
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('electron:show-open-dialog')!(null)).toBe('/selected/folder');
    });

    it('passes defaultPath through to dialog.showOpenDialog when provided', async () => {
      mockDialogShowOpenDialog.mockResolvedValue({ filePaths: ['/selected/folder'] });
      const handlers = await registerAndGetHandlers();
      await handlers.get('electron:show-open-dialog')!(null, '/downloads');
      expect(mockDialogShowOpenDialog).toHaveBeenCalledWith({
        properties: ['openDirectory'],
        defaultPath: '/downloads',
      });
    });

    it('omits defaultPath from the dialog options when not provided', async () => {
      mockDialogShowOpenDialog.mockResolvedValue({ filePaths: [] });
      const handlers = await registerAndGetHandlers();
      await handlers.get('electron:show-open-dialog')!(null);
      expect(mockDialogShowOpenDialog).toHaveBeenCalledWith({ properties: ['openDirectory'] });
    });
  });

  describe('electron:check-for-update', () => {
    it('returns { updateAvailable: false, currentVersion } when no releases exist', async () => {
      mockAppGetVersion.mockReturnValue('1.0.0');
      mockAxiosGet.mockResolvedValue({ data: [] });
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('electron:check-for-update')!(null)).toEqual({
        updateAvailable: false,
        currentVersion: '1.0.0',
      });
    });

    it('returns { updateAvailable: false, error } on network failure', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Network error'));
      const handlers = await registerAndGetHandlers();
      const result = (await handlers.get('electron:check-for-update')!(null)) as any;
      expect(result.updateAvailable).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('returns { updateAvailable: true, releases } when newer version exists', async () => {
      mockAppGetVersion.mockReturnValue('1.0.0');
      mockAxiosGet.mockResolvedValue({
        data: [
          {
            tag_name: 'v2.0.0',
            draft: false,
            prerelease: false,
            published_at: '2024-06-01T00:00:00Z',
          },
        ],
      });
      const handlers = await registerAndGetHandlers();
      const result = (await handlers.get('electron:check-for-update')!(null)) as any;
      expect(result.updateAvailable).toBe(true);
      expect(result.currentVersion).toBe('1.0.0');
      expect(result.releases).toHaveLength(1);
      expect(result.releases[0].tag_name).toBe('v2.0.0');
    });

    it('filters out draft releases', async () => {
      mockAppGetVersion.mockReturnValue('1.0.0');
      mockAxiosGet.mockResolvedValue({
        data: [
          {
            tag_name: 'v2.0.0',
            draft: true,
            prerelease: false,
            published_at: '2024-06-01T00:00:00Z',
          },
        ],
      });
      const handlers = await registerAndGetHandlers();
      const result = (await handlers.get('electron:check-for-update')!(null)) as any;
      expect(result.updateAvailable).toBe(false);
    });

    it('filters out prerelease releases', async () => {
      mockAppGetVersion.mockReturnValue('1.0.0');
      mockAxiosGet.mockResolvedValue({
        data: [
          {
            tag_name: 'v2.0.0-beta.1',
            draft: false,
            prerelease: true,
            published_at: '2024-06-01T00:00:00Z',
          },
        ],
      });
      const handlers = await registerAndGetHandlers();
      const result = (await handlers.get('electron:check-for-update')!(null)) as any;
      expect(result.updateAvailable).toBe(false);
    });

    it('filters out releases that are not newer than current version', async () => {
      mockAppGetVersion.mockReturnValue('2.0.0');
      mockAxiosGet.mockResolvedValue({
        data: [
          {
            tag_name: 'v1.5.0',
            draft: false,
            prerelease: false,
            published_at: '2024-01-01T00:00:00Z',
          },
          {
            tag_name: 'v2.0.0',
            draft: false,
            prerelease: false,
            published_at: '2024-06-01T00:00:00Z',
          },
        ],
      });
      const handlers = await registerAndGetHandlers();
      const result = (await handlers.get('electron:check-for-update')!(null)) as any;
      expect(result.updateAvailable).toBe(false);
    });

    it('ignores releases with invalid semver tags', async () => {
      mockAppGetVersion.mockReturnValue('1.0.0');
      mockAxiosGet.mockResolvedValue({
        data: [
          {
            tag_name: 'not-a-version',
            draft: false,
            prerelease: false,
            published_at: '2024-06-01T00:00:00Z',
          },
        ],
      });
      const handlers = await registerAndGetHandlers();
      const result = (await handlers.get('electron:check-for-update')!(null)) as any;
      expect(result.updateAvailable).toBe(false);
    });

    it('returns multiple filtered releases sorted by date descending', async () => {
      mockAppGetVersion.mockReturnValue('1.0.0');
      mockAxiosGet.mockResolvedValue({
        data: [
          {
            tag_name: 'v2.0.0',
            draft: false,
            prerelease: false,
            published_at: '2024-01-01T00:00:00Z',
          },
          {
            tag_name: 'v3.0.0',
            draft: false,
            prerelease: false,
            published_at: '2024-06-01T00:00:00Z',
          },
        ],
      });
      const handlers = await registerAndGetHandlers();
      const result = (await handlers.get('electron:check-for-update')!(null)) as any;
      expect(result.updateAvailable).toBe(true);
      expect(result.releases[0].tag_name).toBe('v3.0.0');
    });
  });
});
