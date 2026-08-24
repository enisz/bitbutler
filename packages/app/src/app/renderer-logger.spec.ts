import { initRendererLogger } from './renderer-logger';

describe('initRendererLogger', () => {
  let originalConsole: Record<string, (...args: unknown[]) => void>;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalConsole = {
      log: console.log,
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    writeSpy = vi.spyOn(window.bitbutler.log, 'write').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
  });

  it.each([
    ['debug', 'debug'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
  ])('forwards console.%s as level "%s" and preserves terminal output', (method, expectedLevel) => {
    const spy = vi.fn();
    (console as unknown as Record<string, unknown>)[method] = spy;
    initRendererLogger();

    (console as unknown as Record<string, (...args: unknown[]) => void>)[method]('hello', 42);

    expect(spy).toHaveBeenCalledWith('hello', 42);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ level: expectedLevel, message: 'hello 42' }),
    );
  });

  it('serializes an object argument into context and keeps the message readable', () => {
    initRendererLogger();
    const command = { type: 'UI_ADD_TORRENT' };
    console.error('CommandHandler', 'start', 'Unhandled command', command);

    expect(writeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: 'CommandHandler start Unhandled command [object]',
        context: JSON.stringify([command]),
      }),
    );
  });

  it('serializes an Error argument with its stack in the context', () => {
    initRendererLogger();
    const error = new Error('boom');
    console.error('failed', error);

    const entry = writeSpy.mock.calls[0][0] as { message: string; context: string | null };
    expect(entry.message).toBe('failed Error: boom');
    expect(JSON.parse(entry.context!)).toEqual([
      { name: 'Error', message: 'boom', stack: error.stack },
    ]);
  });

  it('captures the caller filename and line number', () => {
    initRendererLogger();
    console.info('hello');

    const entry = writeSpy.mock.calls[0][0] as { filename: string | null; line: number | null };
    expect(entry.filename).toContain('renderer-logger.spec.ts');
    expect(entry.line).toBeGreaterThan(0);
  });

  it('reports null context when no structured arguments are passed', () => {
    initRendererLogger();
    console.info('just a string', 1, true, null, undefined);

    const entry = writeSpy.mock.calls[0][0] as { context: string | null };
    expect(entry.context).toBeNull();
  });
});
