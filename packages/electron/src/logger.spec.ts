import { type BrowserWindow } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRun = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: { getPath: () => '/fake' },
}));

vi.mock('./db.js', () => ({
  default: {
    prepare: () => ({ run: mockRun }),
  },
}));

describe('initLogger', () => {
  let originalConsole: Record<string, (...args: unknown[]) => void>;

  beforeEach(() => {
    vi.resetModules();
    mockRun.mockReset();
    originalConsole = {
      log: console.log,
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    Object.assign(console, originalConsole);
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  it.each([
    ['log', 'debug'],
    ['debug', 'debug'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
  ])(
    'inserts a "main" row at level "%s" for console.%s and preserves terminal output',
    async (method, expectedLevel) => {
      const spy = vi.fn();
      (console as unknown as Record<string, unknown>)[method] = spy;
      const { initLogger } = await import('./logger.js');
      initLogger();

      (console as unknown as Record<string, (...args: unknown[]) => void>)[method]('hello', 42);

      expect(spy).toHaveBeenCalledWith('hello', 42);
      expect(mockRun).toHaveBeenCalledWith(expect.any(Number), 'main', expectedLevel, 'hello 42');
    },
  );

  it('inserts a "main" "error" row on uncaught exceptions and rethrows', async () => {
    const { initLogger } = await import('./logger.js');
    initLogger();
    const error = new Error('boom');

    expect(() => process.emit('uncaughtException', error)).toThrow('boom');

    expect(mockRun).toHaveBeenCalledWith(
      expect.any(Number),
      'main',
      'error',
      expect.stringContaining('Uncaught exception:'),
    );
  });

  it('inserts a "main" "error" row on unhandled rejections without throwing', async () => {
    const { initLogger } = await import('./logger.js');
    initLogger();

    expect(() =>
      process.emit('unhandledRejection', new Error('nope'), Promise.resolve()),
    ).not.toThrow();

    expect(mockRun).toHaveBeenCalledWith(
      expect.any(Number),
      'main',
      'error',
      expect.stringContaining('Unhandled rejection:'),
    );
  });
});

describe('hookRenderer', () => {
  let consoleMessageHandler: (details: {
    level: string;
    message: string;
    lineNumber: number;
    sourceId: string;
  }) => void;
  let mockWindow: { webContents: { on: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    vi.resetModules();
    mockRun.mockReset();
    mockWindow = {
      webContents: {
        on: vi.fn((event: string, handler: typeof consoleMessageHandler) => {
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
  ])('inserts a "renderer" row mapping level "%s" to "%s"', async (level, expectedLevel) => {
    const { hookRenderer } = await import('./logger.js');
    hookRenderer(mockWindow as unknown as BrowserWindow);

    consoleMessageHandler({ level, message: 'test message', lineNumber: 10, sourceId: 'app.js' });

    expect(mockRun).toHaveBeenCalledWith(
      expect.any(Number),
      'renderer',
      expectedLevel,
      'test message (app.js:10)',
    );
  });
});
