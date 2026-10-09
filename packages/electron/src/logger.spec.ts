import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakes = vi.hoisted(() => {
  const make = () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    transports: {
      file: {
        fileName: 'main.log',
        maxSize: 0,
        archiveLogFn: undefined as unknown,
        getFile: vi.fn(() => ({ path: '/fake/logs/main.log' })),
      },
      console: { level: 'silly' as unknown },
      ipc: { level: 'silly' as unknown },
    },
  });
  const rendererLog = make();
  const mainLog = { ...make(), create: vi.fn(() => rendererLog) };
  return { mainLog, rendererLog };
});
const mockResolveOriginalLocation = vi.hoisted(() => vi.fn());

vi.mock('electron-log/main', () => ({ default: fakes.mainLog }));
vi.mock('./source-map-resolver.js', () => ({
  resolveOriginalLocation: mockResolveOriginalLocation,
}));

type ConsoleFn = (...args: unknown[]) => void;
const consoleOf = () => console as unknown as Record<string, ConsoleFn>;

describe('logger', () => {
  let originalConsole: Record<string, ConsoleFn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockResolveOriginalLocation.mockReturnValue(null);
    originalConsole = {
      log: console.log,
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  describe('configuration', () => {
    it('configures the main and renderer file transports', async () => {
      await import('./logger.js');

      expect(fakes.mainLog.create).toHaveBeenCalledWith({ logId: 'renderer' });
      expect(fakes.mainLog.transports.file.fileName).toBe('main.log');
      expect(fakes.rendererLog.transports.file.fileName).toBe('renderer.log');
      for (const l of [fakes.mainLog, fakes.rendererLog]) {
        expect(l.transports.file.maxSize).toBe(5 * 1024 * 1024);
        expect(typeof l.transports.file.archiveLogFn).toBe('function');
        expect(l.transports.console.level).toBe(false);
        expect(l.transports.ipc.level).toBe(false);
      }
    });

    it('crops the file instead of wiping it when rotation fails', async () => {
      const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      await import('./logger.js');
      const archive = fakes.mainLog.transports.file.archiveLogFn as (file: unknown) => void;
      const file = {
        path: '/nonexistent-dir/main.log',
        toString: () => '/nonexistent-dir/main.log',
        crop: vi.fn(),
        clear: vi.fn(),
      };

      archive(file);

      expect(file.crop).toHaveBeenCalledWith(256 * 1024);
      expect(file.clear).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining('[logger] failed to rotate'));
      stderr.mockRestore();
    });

    it('getLogDirectory returns the directory of the main log file', async () => {
      const { getLogDirectory } = await import('./logger.js');
      expect(getLogDirectory().replace(/\\/g, '/')).toBe('/fake/logs');
    });
  });

  describe('writeLog', () => {
    it('writes main entries to the main logger with a [file:line] prefix', async () => {
      const { writeLog } = await import('./logger.js');
      writeLog('main', 'warn', 'hello', 'packages/electron/src/a.ts', 7);
      expect(fakes.mainLog.warn).toHaveBeenCalledWith('[packages/electron/src/a.ts:7] hello');
      expect(fakes.rendererLog.warn).not.toHaveBeenCalled();
    });

    it('writes renderer entries to the renderer logger', async () => {
      const { writeLog } = await import('./logger.js');
      writeLog('renderer', 'error', 'boom', 'packages/app/src/b.ts', 3);
      expect(fakes.rendererLog.error).toHaveBeenCalledWith('[packages/app/src/b.ts:3] boom');
      expect(fakes.mainLog.error).not.toHaveBeenCalled();
    });

    it('omits the prefix when there is no location', async () => {
      const { writeLog } = await import('./logger.js');
      writeLog('main', 'info', 'plain');
      expect(fakes.mainLog.info).toHaveBeenCalledWith('plain');
    });

    it('omits the line when only a filename is known', async () => {
      const { writeLog } = await import('./logger.js');
      writeLog('main', 'info', 'x', 'a.ts', null);
      expect(fakes.mainLog.info).toHaveBeenCalledWith('[a.ts] x');
    });

    it('does not throw and reports to stderr when the logger throws', async () => {
      const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      fakes.mainLog.error.mockImplementation(() => {
        throw new Error('disk full');
      });
      const { writeLog } = await import('./logger.js');

      expect(() => writeLog('main', 'error', 'oops')).not.toThrow();

      expect(stderr).toHaveBeenCalledWith(
        expect.stringContaining('[logger] failed to write log: disk full'),
      );
      stderr.mockRestore();
      fakes.mainLog.error.mockReset();
    });
  });

  describe('initLogger', () => {
    it.each([
      ['log', 'debug'],
      ['debug', 'debug'],
      ['info', 'info'],
      ['warn', 'warn'],
      ['error', 'error'],
    ])('writes console.%s as "%s" and preserves terminal output', async (method, level) => {
      const spy = vi.fn();
      consoleOf()[method] = spy;
      const { initLogger } = await import('./logger.js');
      initLogger();

      consoleOf()[method]('hello', 42);

      expect(spy).toHaveBeenCalledWith('hello', 42);
      expect(
        (fakes.mainLog as unknown as Record<string, ReturnType<typeof vi.fn>>)[level],
      ).toHaveBeenCalledWith(expect.stringMatching(/^\[.*logger\.spec\.ts:\d+\] hello 42$/));
    });

    it('uses the source-map-resolved location when available', async () => {
      mockResolveOriginalLocation.mockReturnValue({
        filename: 'packages/electron/src/logger.ts',
        line: 42,
      });
      const { initLogger } = await import('./logger.js');
      initLogger();

      console.info('hello');

      expect(fakes.mainLog.info).toHaveBeenCalledWith('[packages/electron/src/logger.ts:42] hello');
    });

    it('renders objects with util.format instead of [object Object]', async () => {
      const { initLogger } = await import('./logger.js');
      initLogger();

      console.info('state', { a: 1 });

      expect(fakes.mainLog.info).toHaveBeenCalledWith(expect.stringContaining('state { a: 1 }'));
    });

    it('logs uncaught exceptions with the stack and rethrows', async () => {
      const { initLogger } = await import('./logger.js');
      initLogger();

      expect(() => process.emit('uncaughtException', new Error('boom'))).toThrow('boom');

      expect(fakes.mainLog.error).toHaveBeenCalledWith(
        expect.stringContaining('Uncaught exception: Error: boom'),
      );
    });

    it('logs unhandled rejections without throwing', async () => {
      const { initLogger } = await import('./logger.js');
      initLogger();

      expect(() =>
        process.emit('unhandledRejection', new Error('nope'), Promise.resolve()),
      ).not.toThrow();

      expect(fakes.mainLog.error).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled rejection: Error: nope'),
      );
    });
  });
});
