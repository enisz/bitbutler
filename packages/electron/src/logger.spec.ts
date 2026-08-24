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
      expect(mockRun).toHaveBeenCalledWith(
        expect.any(Number),
        'main',
        expectedLevel,
        'hello 42',
        null,
        expect.stringContaining('logger.spec.ts'),
        expect.any(Number),
      );
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
      null,
      null,
      null,
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
      null,
      null,
      null,
    );
  });

  it('does not throw and writes to stderr when the DB insert fails', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockRun.mockImplementation(() => {
      throw new Error('disk full');
    });
    const spy = vi.fn();
    (console as unknown as Record<string, unknown>).error = spy;
    const { initLogger } = await import('./logger.js');
    initLogger();

    expect(() =>
      (console as unknown as Record<string, (...args: unknown[]) => void>).error('oops'),
    ).not.toThrow();

    expect(spy).toHaveBeenCalledWith('oops');
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('[logger] failed to write log row: disk full'),
    );

    stderrSpy.mockRestore();
  });
});
