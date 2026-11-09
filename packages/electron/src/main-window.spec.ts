import { afterEach, describe, expect, it, vi } from 'vitest';

const mockApp = vi.hoisted(() => ({ isPackaged: false, getAppPath: () => '/app' }));

const mockShellOpenExternal = vi.hoisted(() => vi.fn());
const mockOnHeadersReceived = vi.hoisted(() => vi.fn());
const mockWindowOpenHandler = vi.hoisted(() => vi.fn());

const mockWebContents = vi.hoisted(() => ({
  on: vi.fn(),
  once: vi.fn(),
  send: vi.fn(),
  setWindowOpenHandler: mockWindowOpenHandler,
}));

// Vitest 4 invokes a mock's implementation through `Reflect.construct` when the mock is called with
// `new`, so the implementation has to be a `function` (arrow functions are not constructable).
const MockBrowserWindow = vi.hoisted(() =>
  vi.fn().mockImplementation(function () {
    return {
      webContents: mockWebContents,
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      on: vi.fn(),
      isMaximized: vi.fn(() => false),
      isMinimized: vi.fn(() => false),
      isVisible: vi.fn(() => true),
      isFullScreen: vi.fn(() => false),
      isDestroyed: vi.fn(() => false),
      getSize: vi.fn(() => [600, 750]),
    };
  }),
);

vi.mock('electron', () => ({
  BrowserWindow: MockBrowserWindow,
  app: mockApp,
  session: { defaultSession: { webRequest: { onHeadersReceived: mockOnHeadersReceived } } },
  shell: { openExternal: mockShellOpenExternal },
}));

vi.mock('node:fs', () => ({
  default: { existsSync: () => false },
  existsSync: () => false,
}));

describe('createMainWindow', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockApp.isPackaged = false;
  });

  it('opens links clicked with target=_blank in the OS default browser instead of a new Electron window', async () => {
    const { createMainWindow } = await import('./main-window.js');
    createMainWindow();

    expect(mockWindowOpenHandler).toHaveBeenCalledTimes(1);
    const handler = mockWindowOpenHandler.mock.calls[0][0];

    const result = handler({ url: 'https://github.com/enisz/bitbutler/pull/55' });

    expect(mockShellOpenExternal).toHaveBeenCalledWith(
      'https://github.com/enisz/bitbutler/pull/55',
    );
    expect(result).toEqual({ action: 'deny' });
  });

  it('denies non-http(s) schemes without invoking shell.openExternal', async () => {
    const { createMainWindow } = await import('./main-window.js');
    createMainWindow();

    const handler = mockWindowOpenHandler.mock.calls[0][0];
    const result = handler({ url: 'file:///etc/passwd' });

    expect(mockShellOpenExternal).not.toHaveBeenCalled();
    expect(result).toEqual({ action: 'deny' });
  });

  describe('dev window mode (BB_WINDOW_MODE)', () => {
    const createdOptions = async () => {
      const { createMainWindow } = await import('./main-window.js');
      createMainWindow();
      return MockBrowserWindow.mock.calls[0][0];
    };

    it('defaults to the normal desktop window when the variable is not set', async () => {
      const { getWindowMode } = await import('./main-window.js');
      expect(getWindowMode()).toBe('desktop');
      expect(await createdOptions()).toEqual(
        expect.objectContaining({ resizable: true, maximizable: true }),
      );
    });

    it('creates a fixed phone-sized window in phone mode', async () => {
      vi.stubEnv('BB_WINDOW_MODE', 'phone');
      const { getWindowMode } = await import('./main-window.js');
      expect(getWindowMode()).toBe('phone');
      expect(await createdOptions()).toEqual(
        expect.objectContaining({
          width: 390,
          height: 640,
          useContentSize: true,
          resizable: false,
          maximizable: false,
          fullscreenable: false,
        }),
      );
    });

    it('creates a fixed tablet-sized window in tablet mode', async () => {
      vi.stubEnv('BB_WINDOW_MODE', 'tablet');
      expect(await createdOptions()).toEqual(
        expect.objectContaining({
          width: 900,
          height: 640,
          useContentSize: true,
          resizable: false,
        }),
      );
    });

    it('treats an unknown value as desktop', async () => {
      vi.stubEnv('BB_WINDOW_MODE', 'watch');
      const { getWindowMode } = await import('./main-window.js');
      expect(getWindowMode()).toBe('desktop');
    });

    it('ignores the variable in a packaged app', async () => {
      mockApp.isPackaged = true;
      vi.stubEnv('BB_WINDOW_MODE', 'phone');
      const { getWindowMode } = await import('./main-window.js');
      expect(getWindowMode()).toBe('desktop');
    });
  });

  it('denies malformed URLs without throwing', async () => {
    const { createMainWindow } = await import('./main-window.js');
    createMainWindow();

    const handler = mockWindowOpenHandler.mock.calls[0][0];
    const result = handler({ url: 'not-a-url' });

    expect(mockShellOpenExternal).not.toHaveBeenCalled();
    expect(result).toEqual({ action: 'deny' });
  });
});
