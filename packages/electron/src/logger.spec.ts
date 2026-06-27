import { type BrowserWindow } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogInfo = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn<() => boolean>(() => false));
const mockStatSync = vi.hoisted(() => vi.fn<() => { size: number }>(() => ({ size: 0 })));
const mockRenameSync = vi.hoisted(() => vi.fn());
const mockUnlinkSync = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/fake/logs') },
}));

vi.mock('electron-log/main', () => ({
  default: {
    transports: {
      console: { level: false as false },
      file: { resolvePathFn: null, maxSize: 0, archiveLog: null, format: null },
    },
    info: mockLogInfo,
  },
}));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  statSync: mockStatSync,
  renameSync: mockRenameSync,
  unlinkSync: mockUnlinkSync,
}));

describe('formatTimestamp', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('formats a date as YYYY-MM-DD HH:mm:ss.SSS using local time', async () => {
    const { formatTimestamp } = await import('./logger.js');
    const date = new Date(2026, 5, 27, 10, 23, 45, 123);
    expect(formatTimestamp(date)).toBe('2026-06-27 10:23:45.123');
  });

  it('pads single-digit month, day, hour, minute, second, and millisecond values', async () => {
    const { formatTimestamp } = await import('./logger.js');
    const date = new Date(2026, 0, 5, 9, 3, 7, 42);
    expect(formatTimestamp(date)).toBe('2026-01-05 09:03:07.042');
  });
});

describe('archiveLog', () => {
  beforeEach(() => {
    vi.resetModules();
    mockExistsSync.mockReturnValue(false);
    mockRenameSync.mockReset();
    mockUnlinkSync.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('moves the current log to .old.0.log when no archives exist', async () => {
    const { archiveLog } = await import('./logger.js');
    archiveLog('/fake/logs/bitbutler.log');
    expect(mockRenameSync).toHaveBeenCalledWith(
      '/fake/logs/bitbutler.log',
      '/fake/logs/bitbutler.old.0.log',
    );
  });

  it('shifts .old.0 to .old.1 before writing new .old.0', async () => {
    mockExistsSync.mockImplementation((p: string) => p === '/fake/logs/bitbutler.old.0.log');
    const { archiveLog } = await import('./logger.js');
    archiveLog('/fake/logs/bitbutler.log');
    expect(mockRenameSync).toHaveBeenCalledWith(
      '/fake/logs/bitbutler.old.0.log',
      '/fake/logs/bitbutler.old.1.log',
    );
    expect(mockRenameSync).toHaveBeenCalledWith(
      '/fake/logs/bitbutler.log',
      '/fake/logs/bitbutler.old.0.log',
    );
  });

  it('deletes .old.2.log when all 3 archive slots are full', async () => {
    mockExistsSync.mockReturnValue(true);
    const { archiveLog } = await import('./logger.js');
    archiveLog('/fake/logs/bitbutler.log');
    expect(mockUnlinkSync).toHaveBeenCalledWith('/fake/logs/bitbutler.old.2.log');
  });
});

describe('hookRenderer', () => {
  let consoleMessageHandler: (...args: unknown[]) => void;
  let mockWindow: { webContents: { on: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    vi.resetModules();
    mockLogInfo.mockReset();
    mockWindow = {
      webContents: {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'console-message') consoleMessageHandler = handler;
        }),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('attaches a console-message listener to webContents', async () => {
    const { hookRenderer } = await import('./logger.js');
    hookRenderer(mockWindow as unknown as BrowserWindow);
    expect(mockWindow.webContents.on).toHaveBeenCalledWith('console-message', expect.any(Function));
  });

  it.each([
    [0, 'debug'],
    [1, 'info'],
    [2, 'warn'],
    [3, 'error'],
  ])('maps numeric level %i to string "%s"', async (level, expectedLevel) => {
    const { hookRenderer } = await import('./logger.js');
    hookRenderer(mockWindow as unknown as BrowserWindow);
    consoleMessageHandler({}, level, 'test message', 10, 'app.js');
    expect(mockLogInfo).toHaveBeenCalledWith(
      `[renderer] [${expectedLevel}] test message (app.js:10)`,
    );
  });

  it('falls back to "debug" for an unrecognised numeric level', async () => {
    const { hookRenderer } = await import('./logger.js');
    hookRenderer(mockWindow as unknown as BrowserWindow);
    consoleMessageHandler({}, 99, 'unknown', 1, 'x.js');
    expect(mockLogInfo).toHaveBeenCalledWith('[renderer] [debug] unknown (x.js:1)');
  });
});
