import { afterEach, describe, expect, it, vi } from 'vitest';

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
  app: { isPackaged: false, getAppPath: () => '/app' },
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

  it('denies malformed URLs without throwing', async () => {
    const { createMainWindow } = await import('./main-window.js');
    createMainWindow();

    const handler = mockWindowOpenHandler.mock.calls[0][0];
    const result = handler({ url: 'not-a-url' });

    expect(mockShellOpenExternal).not.toHaveBeenCalled();
    expect(result).toEqual({ action: 'deny' });
  });
});
