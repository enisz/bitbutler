import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockWriteLog = vi.hoisted(() => vi.fn());
const mockGetLogDirectory = vi.hoisted(() => vi.fn(() => '/fake/logs'));
const mockResolveOriginalLocation = vi.hoisted(() => vi.fn());
const mockOpenPath = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  },
  shell: { openPath: mockOpenPath },
}));
vi.mock('../logger.js', () => ({
  writeLog: mockWriteLog,
  getLogDirectory: mockGetLogDirectory,
}));
vi.mock('../source-map-resolver.js', () => ({
  resolveOriginalLocation: mockResolveOriginalLocation,
}));

describe('log IPC handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
    vi.clearAllMocks();
    mockResolveOriginalLocation.mockReturnValue(null);
    mockGetLogDirectory.mockReturnValue('/fake/logs');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function register() {
    const { registerLogIpcHandlers } = await import('./log.js');
    registerLogIpcHandlers();
  }

  describe('log:write', () => {
    it('writes a renderer entry through writeLog', async () => {
      await register();

      ipcHandlers.get('log:write')!(null, {
        level: 'error',
        message: 'Unhandled command',
        filename: 'app.js',
        line: 12,
        column: 3,
      });

      expect(mockWriteLog).toHaveBeenCalledWith(
        'renderer',
        'error',
        'Unhandled command',
        'app.js',
        12,
      );
    });

    it('prefers the source-map-resolved location', async () => {
      mockResolveOriginalLocation.mockReturnValue({
        filename: 'packages/app/src/a.ts',
        line: 9,
      });
      await register();

      ipcHandlers.get('log:write')!(null, {
        level: 'info',
        message: 'x',
        filename: 'main.js',
        line: 1,
        column: 2,
      });

      expect(mockResolveOriginalLocation).toHaveBeenCalledWith('main.js', 1, 2, 'app');
      expect(mockWriteLog).toHaveBeenCalledWith(
        'renderer',
        'info',
        'x',
        'packages/app/src/a.ts',
        9,
      );
    });

    it('accepts entries without a location', async () => {
      await register();

      ipcHandlers.get('log:write')!(null, { level: 'warn', message: 'no loc' });

      expect(mockWriteLog).toHaveBeenCalledWith('renderer', 'warn', 'no loc', null, null);
    });

    it('caps very long messages instead of dropping them', async () => {
      await register();

      ipcHandlers.get('log:write')!(null, { level: 'info', message: 'a'.repeat(50000) });

      const message = mockWriteLog.mock.calls[0][2] as string;
      expect(message).toHaveLength(20000);
    });

    it.each([
      ['unknown level', { level: 'trace', message: 'x' }],
      ['missing message', { level: 'info' }],
      ['empty message', { level: 'info', message: '' }],
      ['non-object payload', 'nope'],
      ['null payload', null],
    ])('ignores an invalid entry (%s)', async (_label, payload) => {
      await register();

      ipcHandlers.get('log:write')!(null, payload);

      expect(mockWriteLog).not.toHaveBeenCalled();
    });
  });

  describe('log:open-folder', () => {
    it('opens the log directory and reports success', async () => {
      mockOpenPath.mockResolvedValue('');
      await register();

      const result = await ipcHandlers.get('log:open-folder')!(null);

      expect(mockOpenPath).toHaveBeenCalledWith('/fake/logs');
      expect(result).toEqual({ ok: true });
    });

    it('reports the error string when the folder cannot be opened', async () => {
      mockOpenPath.mockResolvedValue('Failed to open path');
      await register();

      const result = await ipcHandlers.get('log:open-folder')!(null);

      expect(result).toEqual({ ok: false, error: 'Failed to open path' });
    });
  });

  it('no longer registers the list, clear and export channels', async () => {
    await register();
    expect(ipcHandlers.has('log:list')).toBe(false);
    expect(ipcHandlers.has('log:clear')).toBe(false);
    expect(ipcHandlers.has('log:export')).toBe(false);
  });
});
