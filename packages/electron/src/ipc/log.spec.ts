import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockInsertLog = vi.hoisted(() => vi.fn());
const mockResolveOriginalLocation = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  },
}));

vi.mock('../logger.js', () => ({
  insertLog: mockInsertLog,
}));

vi.mock('../source-map-resolver.js', () => ({
  resolveOriginalLocation: mockResolveOriginalLocation,
}));

describe('log IPC handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
    mockResolveOriginalLocation.mockReset();
    mockResolveOriginalLocation.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function registerAndGetHandler() {
    const { registerLogIpcHandlers } = await import('./log.js');
    registerLogIpcHandlers();
    return ipcHandlers.get('log:write')!;
  }

  it('inserts a fully populated renderer log entry', async () => {
    const handler = await registerAndGetHandler();

    handler(null, {
      level: 'error',
      message: 'Unhandled command',
      context: '[{"type":"UI_ADD_TORRENT"}]',
      filename: 'http://localhost:4200/main.js',
      line: 471,
    });

    expect(mockInsertLog).toHaveBeenCalledWith(
      'renderer',
      'error',
      'Unhandled command',
      '[{"type":"UI_ADD_TORRENT"}]',
      'http://localhost:4200/main.js',
      471,
    );
  });

  it('defaults missing optional fields to null', async () => {
    const handler = await registerAndGetHandler();

    handler(null, { level: 'info', message: 'hello' });

    expect(mockInsertLog).toHaveBeenCalledWith('renderer', 'info', 'hello', null, null, null);
  });

  it('drops an entry with an invalid level', async () => {
    const handler = await registerAndGetHandler();

    handler(null, { level: 'verbose', message: 'hello' });

    expect(mockInsertLog).not.toHaveBeenCalled();
  });

  it('drops an entry with a missing message', async () => {
    const handler = await registerAndGetHandler();

    handler(null, { level: 'info' });

    expect(mockInsertLog).not.toHaveBeenCalled();
  });

  it('drops a malformed (non-object) entry', async () => {
    const handler = await registerAndGetHandler();

    handler(null, 'not an object');

    expect(mockInsertLog).not.toHaveBeenCalled();
  });

  it('resolves the original TypeScript location via source maps when a column is given', async () => {
    const handler = await registerAndGetHandler();
    mockResolveOriginalLocation.mockReturnValue({
      filename: 'packages/app/src/app/services/updater.service.ts',
      line: 42,
    });

    handler(null, {
      level: 'error',
      message: 'Unhandled command',
      filename: 'http://localhost:4200/main.js',
      line: 471,
      column: 12,
    });

    expect(mockResolveOriginalLocation).toHaveBeenCalledWith(
      'http://localhost:4200/main.js',
      471,
      12,
      'app',
    );
    expect(mockInsertLog).toHaveBeenCalledWith(
      'renderer',
      'error',
      'Unhandled command',
      null,
      'packages/app/src/app/services/updater.service.ts',
      42,
    );
  });

  it('does not attempt resolution when no column is given', async () => {
    const handler = await registerAndGetHandler();

    handler(null, {
      level: 'error',
      message: 'Unhandled command',
      filename: 'http://localhost:4200/main.js',
      line: 471,
    });

    expect(mockResolveOriginalLocation).not.toHaveBeenCalled();
    expect(mockInsertLog).toHaveBeenCalledWith(
      'renderer',
      'error',
      'Unhandled command',
      null,
      'http://localhost:4200/main.js',
      471,
    );
  });

  it('falls back to the compiled location when resolution finds no source map', async () => {
    const handler = await registerAndGetHandler();
    mockResolveOriginalLocation.mockReturnValue(null);

    handler(null, {
      level: 'error',
      message: 'Unhandled command',
      filename: 'http://localhost:4200/main.js',
      line: 471,
      column: 12,
    });

    expect(mockInsertLog).toHaveBeenCalledWith(
      'renderer',
      'error',
      'Unhandled command',
      null,
      'http://localhost:4200/main.js',
      471,
    );
  });

  it('truncates an overly long message, context and filename', async () => {
    const handler = await registerAndGetHandler();

    handler(null, {
      level: 'debug',
      message: 'a'.repeat(3000),
      context: 'b'.repeat(30000),
      filename: 'c'.repeat(1000),
      line: 1.5,
    });

    const [, , message, context, filename, line] = mockInsertLog.mock.calls[0];
    expect(message).toHaveLength(2000);
    expect(context).toHaveLength(20000);
    expect(filename).toHaveLength(500);
    expect(line).toBeNull();
  });
});
