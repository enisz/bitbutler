import { type BrowserWindow } from 'electron';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogInfo = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn<() => boolean>(() => false));
const mockStatSync = vi.hoisted(() => vi.fn<() => { size: number }>(() => ({ size: 0 })));
const mockRenameSync = vi.hoisted(() => vi.fn());
const mockUnlinkSync = vi.hoisted(() => vi.fn());

let capturedFormat: ((params: { message: { date: Date; data: unknown[] } }) => unknown[]) | null =
  null;

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/fake/logs') },
}));

vi.mock('electron-log/main', () => ({
  default: {
    transports: {
      console: { level: false as false },
      file: {
        resolvePathFn: null,
        maxSize: 0,
        archiveLogFn: null,
        get format() {
          return capturedFormat;
        },
        set format(fn) {
          capturedFormat = fn;
        },
      },
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
    archiveLog(join('/fake/logs', 'bitbutler.log'));
    expect(mockRenameSync).toHaveBeenCalledWith(
      join('/fake/logs', 'bitbutler.log'),
      join('/fake/logs', 'bitbutler.old.0.log'),
    );
  });

  it('shifts .old.0 to .old.1 before writing new .old.0', async () => {
    mockExistsSync.mockImplementation(
      (p: string) => p === join('/fake/logs', 'bitbutler.old.0.log'),
    );
    const { archiveLog } = await import('./logger.js');
    archiveLog(join('/fake/logs', 'bitbutler.log'));
    expect(mockRenameSync).toHaveBeenCalledWith(
      join('/fake/logs', 'bitbutler.old.0.log'),
      join('/fake/logs', 'bitbutler.old.1.log'),
    );
    expect(mockRenameSync).toHaveBeenCalledWith(
      join('/fake/logs', 'bitbutler.log'),
      join('/fake/logs', 'bitbutler.old.0.log'),
    );
  });

  it('deletes .old.2.log when all 3 archive slots are full', async () => {
    mockExistsSync.mockReturnValue(true);
    const { archiveLog } = await import('./logger.js');
    archiveLog(join('/fake/logs', 'bitbutler.log'));
    expect(mockUnlinkSync).toHaveBeenCalledWith(join('/fake/logs', 'bitbutler.old.2.log'));
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
    ['debug', 'debug'],
    ['info', 'info'],
    ['warning', 'warn'],
    ['error', 'error'],
  ])('maps string level "%s" to log level "%s"', async (level, expectedLevel) => {
    const { hookRenderer } = await import('./logger.js');
    hookRenderer(mockWindow as unknown as BrowserWindow);
    consoleMessageHandler({ level, message: 'test message', lineNumber: 10, sourceId: 'app.js' });
    expect(mockLogInfo).toHaveBeenCalledWith(
      `[renderer] [${expectedLevel}] test message (app.js:10)`,
    );
  });
});

describe('initLogger format callback', () => {
  beforeEach(() => {
    vi.resetModules();
    capturedFormat = null;
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('produces a correctly formatted log line', async () => {
    const { initLogger } = await import('./logger.js');
    initLogger();
    expect(capturedFormat).not.toBeNull();
    const date = new Date(2026, 5, 27, 10, 23, 45, 123);
    const result = capturedFormat!({ message: { date, data: ['[main] [info] hello'] } });
    expect(result).toEqual(['[2026-06-27 10:23:45.123] [main] [info] hello']);
  });
});
