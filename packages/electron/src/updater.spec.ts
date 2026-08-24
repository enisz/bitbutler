import { CancellationError, CancellationToken } from 'builder-util-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const updaterListeners = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockAutoUpdater = vi.hoisted(() => ({
  autoDownload: true,
  autoInstallOnAppQuit: true,
  on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
    updaterListeners.set(event, handler);
  }),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn().mockResolvedValue(undefined),
  quitAndInstall: vi.fn(),
}));
const mockExistsSync = vi.hoisted(() => vi.fn());
const mockSend = vi.hoisted(() => vi.fn());
const mockGetMainWindow = vi.hoisted(() => vi.fn(() => ({ webContents: { send: mockSend } })));
const mockAppIsPackaged = vi.hoisted(() => ({ value: true }));

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mockAppIsPackaged.value;
    },
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  },
}));
vi.mock('electron-updater', () => ({ default: { autoUpdater: mockAutoUpdater } }));
vi.mock('node:fs', () => ({ existsSync: mockExistsSync }));
vi.mock('./main.js', () => ({ getMainWindow: mockGetMainWindow }));
vi.mock('./i18n.js', () => ({ t: (key: string) => key }));

describe('updater IPC handlers', () => {
  const originalPlatform = process.platform;
  const originalExecPath = process.execPath;
  const originalAppimageEnv = process.env.APPIMAGE;

  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
    updaterListeners.clear();
    mockAppIsPackaged.value = true;
    Object.defineProperty(process, 'execPath', {
      value: 'C:/Program Files/BitButler/BitButler.exe',
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    Object.defineProperty(process, 'execPath', { value: originalExecPath, configurable: true });
    if (originalAppimageEnv === undefined) {
      delete process.env.APPIMAGE;
    } else {
      process.env.APPIMAGE = originalAppimageEnv;
    }
  });

  async function registerAndGetHandlers() {
    const { registerUpdaterIpcHandlers } = await import('./updater.js');
    registerUpdaterIpcHandlers();
    return ipcHandlers;
  }

  it('forces autoDownload and autoInstallOnAppQuit off', async () => {
    await registerAndGetHandlers();
    expect(mockAutoUpdater.autoDownload).toBe(false);
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(false);
  });

  describe('updater:get-capability', () => {
    it('is unsupported when the app is not packaged (dev mode)', async () => {
      mockAppIsPackaged.value = false;
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('updater:get-capability')!(null)).toEqual({ supported: false });
    });

    it('is supported on Windows when the NSIS uninstaller exists next to the executable', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExistsSync.mockReturnValue(true);
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('updater:get-capability')!(null)).toEqual({ supported: true });
      expect(mockExistsSync).toHaveBeenCalledWith(
        'C:\\Program Files\\BitButler\\Uninstall BitButler.exe',
      );
    });

    it('is unsupported on Windows when the NSIS uninstaller is missing (portable/zip)', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockExistsSync.mockReturnValue(false);
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('updater:get-capability')!(null)).toEqual({ supported: false });
    });

    it('is supported on Linux when APPIMAGE is set', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      process.env.APPIMAGE = '/tmp/BitButler.AppImage';
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('updater:get-capability')!(null)).toEqual({ supported: true });
    });

    it('is unsupported on Linux when APPIMAGE is unset (deb/rpm/snap/tar.gz)', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      delete process.env.APPIMAGE;
      const handlers = await registerAndGetHandlers();
      expect(await handlers.get('updater:get-capability')!(null)).toEqual({ supported: false });
    });
  });

  describe('updater:update-now', () => {
    it('calls autoUpdater.checkForUpdates()', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined);
      const handlers = await registerAndGetHandlers();
      await handlers.get('updater:update-now')!(null);
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled();
    });

    it('sends a sanitized error event when checkForUpdates() rejects', async () => {
      mockAutoUpdater.checkForUpdates.mockRejectedValue(new Error('offline'));
      const handlers = await registerAndGetHandlers();
      await handlers.get('updater:update-now')!(null);
      expect(mockSend).toHaveBeenCalledWith('updater:event', {
        status: 'error',
        message: 'offline',
      });
    });
  });

  describe('updater:cancel-download', () => {
    it('cancels the in-flight download token', async () => {
      const handlers = await registerAndGetHandlers();
      updaterListeners.get('update-available')!();
      const token = mockAutoUpdater.downloadUpdate.mock.calls[0][0] as CancellationToken;
      expect(token.cancelled).toBe(false);

      await handlers.get('updater:cancel-download')!(null);

      expect(token.cancelled).toBe(true);
    });

    it('does nothing when there is no download in progress', async () => {
      const handlers = await registerAndGetHandlers();
      await expect(handlers.get('updater:cancel-download')!(null)).resolves.toBeUndefined();
    });
  });

  describe('autoUpdater event forwarding', () => {
    it('forwards checking-for-update as a checking event', async () => {
      await registerAndGetHandlers();
      updaterListeners.get('checking-for-update')!();
      expect(mockSend).toHaveBeenCalledWith('updater:event', { status: 'checking' });
    });

    it('starts the download with a fresh cancellation token when update-available fires', async () => {
      await registerAndGetHandlers();
      updaterListeners.get('update-available')!();
      expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalledWith(expect.any(CancellationToken));
    });

    it('swallows a CancellationError from downloadUpdate without logging it', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAutoUpdater.downloadUpdate.mockRejectedValueOnce(new CancellationError());
      await registerAndGetHandlers();
      updaterListeners.get('update-available')!();
      await vi.waitFor(() => expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalled());

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('logs a non-cancellation error from downloadUpdate', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const downloadError = new Error('network down');
      mockAutoUpdater.downloadUpdate.mockRejectedValueOnce(downloadError);
      await registerAndGetHandlers();
      updaterListeners.get('update-available')!();
      await vi.waitFor(() => expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalled());

      expect(consoleErrorSpy).toHaveBeenCalledWith('Download failed:', downloadError);
      consoleErrorSpy.mockRestore();
    });

    it('sends an idle event when update-cancelled fires', async () => {
      await registerAndGetHandlers();
      updaterListeners.get('update-cancelled')!();
      expect(mockSend).toHaveBeenCalledWith('updater:event', { status: 'idle' });
    });

    it('sends a friendly error when update-not-available fires', async () => {
      await registerAndGetHandlers();
      updaterListeners.get('update-not-available')!();
      expect(mockSend).toHaveBeenCalledWith('updater:event', {
        status: 'error',
        message: 'components.modals.update-available.status.no-update-available',
      });
    });

    it('forwards download-progress as a downloading event', async () => {
      await registerAndGetHandlers();
      updaterListeners.get('download-progress')!({ percent: 42.5, transferred: 1000, total: 2000 });
      expect(mockSend).toHaveBeenCalledWith('updater:event', {
        status: 'downloading',
        percent: 42.5,
        transferred: 1000,
        total: 2000,
      });
    });

    it('sends a downloaded event then quits and installs after a delay', async () => {
      vi.useFakeTimers();
      await registerAndGetHandlers();
      updaterListeners.get('update-downloaded')!();
      expect(mockSend).toHaveBeenCalledWith('updater:event', { status: 'downloaded' });
      expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1200);
      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true);
      vi.useRealTimers();
    });

    it('forwards a raw Error from the error event as a sanitized message', async () => {
      await registerAndGetHandlers();
      updaterListeners.get('error')!(new Error('network down'));
      expect(mockSend).toHaveBeenCalledWith('updater:event', {
        status: 'error',
        message: 'network down',
      });
    });

    it('stringifies a non-Error value from the error event', async () => {
      await registerAndGetHandlers();
      updaterListeners.get('error')!('boom');
      expect(mockSend).toHaveBeenCalledWith('updater:event', { status: 'error', message: 'boom' });
    });

    it('does nothing when there is no main window to send to', async () => {
      mockGetMainWindow.mockReturnValueOnce(null);
      await registerAndGetHandlers();
      expect(() => updaterListeners.get('checking-for-update')!()).not.toThrow();
    });
  });
});
