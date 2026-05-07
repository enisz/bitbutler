import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '/fake',
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    statSync: vi.fn(),
    promises: {
      readFile: vi.fn(() => Promise.resolve(Buffer.from(''))),
      unlink: vi.fn(() => Promise.resolve()),
    },
  },
}));

vi.mock('../torrents/parse-torrent.js', () => ({
  draftFromPathBuffer: vi.fn(),
  parseTorrentBufferToDraft: vi.fn(),
}));

type MockWindow = {
  maximize: ReturnType<typeof vi.fn>;
  unmaximize: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  setFullScreen: ReturnType<typeof vi.fn>;
  isMaximized: ReturnType<typeof vi.fn>;
  isFullScreen: ReturnType<typeof vi.fn>;
  isMinimized: ReturnType<typeof vi.fn>;
  isDestroyed: ReturnType<typeof vi.fn>;
  webContents: {
    send: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
    getURL: ReturnType<typeof vi.fn>;
  };
};

function createMockWindow(): MockWindow {
  return {
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    setSize: vi.fn(),
    setFullScreen: vi.fn(),
    isMaximized: vi.fn(() => false),
    isFullScreen: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    isDestroyed: vi.fn(() => false),
    webContents: {
      send: vi.fn(),
      on: vi.fn(),
      isDestroyed: vi.fn(() => false),
      getURL: vi.fn(() => 'http://localhost:4200'),
    },
  };
}

describe('window IPC handlers', () => {
  let mockWindow: MockWindow;

  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
    mockWindow = createMockWindow();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function setup() {
    const { registerWindowIpcHandlers } = await import('./window.js');
    registerWindowIpcHandlers(mockWindow as unknown as Electron.BrowserWindow);
    return ipcHandlers;
  }

  describe('window:maximize', () => {
    it('calls maximize on the window', async () => {
      const handlers = await setup();
      await handlers.get('window:maximize')!(null);
      expect(mockWindow.maximize).toHaveBeenCalled();
    });
  });

  describe('window:unmaximize', () => {
    it('calls unmaximize on the window', async () => {
      const handlers = await setup();
      await handlers.get('window:unmaximize')!(null);
      expect(mockWindow.unmaximize).toHaveBeenCalled();
    });
  });

  describe('window:toggle-maximize', () => {
    it('calls maximize when window is not maximized', async () => {
      mockWindow.isMaximized.mockReturnValue(false);
      const handlers = await setup();
      await handlers.get('window:toggle-maximize')!(null);
      expect(mockWindow.maximize).toHaveBeenCalled();
      expect(mockWindow.unmaximize).not.toHaveBeenCalled();
    });

    it('calls unmaximize when window is currently maximized', async () => {
      mockWindow.isMaximized.mockReturnValue(true);
      const handlers = await setup();
      await handlers.get('window:toggle-maximize')!(null);
      expect(mockWindow.unmaximize).toHaveBeenCalled();
      expect(mockWindow.maximize).not.toHaveBeenCalled();
    });
  });

  describe('window:set-size', () => {
    it('calls setSize with the given dimensions', async () => {
      const handlers = await setup();
      await handlers.get('window:set-size')!(null, 800, 600);
      expect(mockWindow.setSize).toHaveBeenCalledWith(800, 600, true);
    });

    it('clamps width below 200 up to 200', async () => {
      const handlers = await setup();
      await handlers.get('window:set-size')!(null, 50, 600);
      expect(mockWindow.setSize).toHaveBeenCalledWith(200, 600, true);
    });

    it('clamps height below 200 up to 200', async () => {
      const handlers = await setup();
      await handlers.get('window:set-size')!(null, 800, 100);
      expect(mockWindow.setSize).toHaveBeenCalledWith(800, 200, true);
    });

    it('clamps both dimensions when both are too small', async () => {
      const handlers = await setup();
      await handlers.get('window:set-size')!(null, 10, 10);
      expect(mockWindow.setSize).toHaveBeenCalledWith(200, 200, true);
    });

    it('ignores non-finite width', async () => {
      const handlers = await setup();
      await handlers.get('window:set-size')!(null, NaN, 600);
      expect(mockWindow.setSize).not.toHaveBeenCalled();
    });

    it('ignores non-finite height', async () => {
      const handlers = await setup();
      await handlers.get('window:set-size')!(null, 800, Infinity);
      expect(mockWindow.setSize).not.toHaveBeenCalled();
    });

    it('exits fullscreen before resizing if window is fullscreen', async () => {
      mockWindow.isFullScreen.mockReturnValue(true);
      const handlers = await setup();
      await handlers.get('window:set-size')!(null, 800, 600);
      expect(mockWindow.setFullScreen).toHaveBeenCalledWith(false);
      expect(mockWindow.setSize).toHaveBeenCalled();
    });

    it('unmaximizes before resizing if window is maximized', async () => {
      mockWindow.isMaximized.mockReturnValue(true);
      const handlers = await setup();
      await handlers.get('window:set-size')!(null, 800, 600);
      expect(mockWindow.unmaximize).toHaveBeenCalled();
      expect(mockWindow.setSize).toHaveBeenCalled();
    });
  });

  describe('window:open-files:drain', () => {
    it('returns empty array when no pending files', async () => {
      const handlers = await setup();
      const result = await handlers.get('window:open-files:drain')!();
      expect(result).toEqual([]);
    });
  });

  describe('window:open-files:set-enabled', () => {
    it('returns { enabled: true } when enabled is true', async () => {
      const handlers = await setup();
      const result = await handlers.get('window:open-files:set-enabled')!(null, true);
      expect(result).toEqual({ enabled: true });
    });

    it('returns { enabled: false } when enabled is false', async () => {
      const handlers = await setup();
      const result = await handlers.get('window:open-files:set-enabled')!(null, false);
      expect(result).toEqual({ enabled: false });
    });
  });

  describe('window:open-files:simulate', () => {
    it('returns { ok: true, count: 0 } for an empty paths array', async () => {
      const handlers = await setup();
      const result = await handlers.get('window:open-files:simulate')!(null, { paths: [] });
      expect(result).toEqual({ ok: true, count: 0 });
    });

    it('filters out non-.torrent extensions', async () => {
      const handlers = await setup();
      const result = (await handlers.get('window:open-files:simulate')!(null, {
        paths: ['/a/file.txt', '/b/other.mp4'],
      })) as { count: number };
      expect(result.count).toBe(0);
    });

    it('counts .torrent files correctly', async () => {
      const handlers = await setup();
      const result = (await handlers.get('window:open-files:simulate')!(null, {
        paths: ['/a/movie.torrent', '/b/music.torrent'],
      })) as { count: number };
      expect(result.count).toBe(2);
    });
  });
});
