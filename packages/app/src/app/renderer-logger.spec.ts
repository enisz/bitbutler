import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initRendererLogger } from './renderer-logger';

type ConsoleFn = (...args: unknown[]) => void;
const consoleOf = () => console as unknown as Record<string, ConsoleFn>;

describe('initRendererLogger', () => {
  let original: Record<string, ConsoleFn>;
  let originals: Record<string, Mock<ConsoleFn>>;
  let write: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    original = {
      log: console.log,
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    write = vi.spyOn(window.bitbutler.log, 'write');
    originals = {};
    for (const m of Object.keys(original)) {
      originals[m] = vi.fn<ConsoleFn>();
      consoleOf()[m] = originals[m];
    }
    initRendererLogger();
  });

  afterEach(() => {
    Object.assign(console, original);
    write.mockRestore();
  });

  const lastEntry = () => write.mock.calls.at(-1)![0] as Record<string, unknown>;

  it.each([
    ['log', 'debug'],
    ['debug', 'debug'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
  ])('maps console.%s to level %s', (method, level) => {
    consoleOf()[method]('hello');
    expect(lastEntry()).toMatchObject({ level, message: 'hello' });
  });

  it('joins primitives and keeps null/undefined readable', () => {
    console.info('a', 1, true, null, undefined);
    expect(lastEntry()['message']).toBe('a 1 true null undefined');
  });

  it('renders Errors as their stack', () => {
    const err = new Error('boom');
    console.error('failed:', err);
    expect(lastEntry()['message']).toContain('failed: ');
    expect(lastEntry()['message']).toContain('Error: boom');
  });

  it('renders objects as JSON instead of [object]', () => {
    console.info('state', { a: 1, b: [2] });
    expect(lastEntry()['message']).toBe('state {"a":1,"b":[2]}');
  });

  it('survives circular objects', () => {
    const o: Record<string, unknown> = { name: 'x' };
    o['self'] = o;
    expect(() => console.info('c', o)).not.toThrow();
    expect(lastEntry()['message']).toContain('[Circular]');
  });

  it('survives BigInt and functions', () => {
    expect(() => console.info('n', 10n, () => 1)).not.toThrow();
    expect(lastEntry()['message']).toContain('10');
  });

  it('sends the caller location of the console call', () => {
    console.info('where');
    expect(String(lastEntry()['filename'])).toContain('renderer-logger.spec');
    expect(lastEntry()['line']).toEqual(expect.any(Number));
    expect(lastEntry()['column']).toEqual(expect.any(Number));
    expect(lastEntry()).not.toHaveProperty('context');
  });

  it('still calls the original console method with the same arguments', () => {
    console.info('forwarded', 1);
    expect(originals['info']).toHaveBeenCalledWith('forwarded', 1);
  });
});
