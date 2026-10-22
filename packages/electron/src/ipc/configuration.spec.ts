import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerConfigurationIpcHandlers } from './configuration.js';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockSaveDialog = vi.hoisted(() => vi.fn());
const mockOpenDialog = vi.hoisted(() => vi.fn());
const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockBuild = vi.hoisted(() => vi.fn());
const mockParse = vi.hoisted(() => vi.fn());
const mockDescribe = vi.hoisted(() => vi.fn());
const mockApply = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  },
  dialog: { showSaveDialog: mockSaveDialog, showOpenDialog: mockOpenDialog },
}));
vi.mock('node:fs', () => ({
  default: { promises: { readFile: mockReadFile, writeFile: mockWriteFile } },
}));
vi.mock('../configuration.js', () => ({
  buildConfiguration: mockBuild,
  parseConfiguration: mockParse,
  describeConfiguration: mockDescribe,
}));
vi.mock('../configuration-apply.js', () => ({ applyConfiguration: mockApply }));

const invoke = (channel: string, payload?: unknown): unknown =>
  ipcHandlers.get(channel)!({}, payload);

beforeEach(() => {
  vi.clearAllMocks();
  ipcHandlers.clear();
  registerConfigurationIpcHandlers();
});

describe('config:export', () => {
  it('writes the built configuration to the chosen path', async () => {
    const built = { version: 1, exported_at: 1, settings: {}, servers: {} };
    mockBuild.mockReturnValue(built);
    mockSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/out.bbc' });

    const result = await invoke('config:export');

    const options = mockSaveDialog.mock.calls[0][0];
    expect(options.defaultPath).toMatch(/^bitbutler-\d{4}-\d{2}-\d{2}\.bbc$/);
    expect(options.filters).toEqual([{ name: 'BitButler Configuration', extensions: ['bbc'] }]);
    expect(mockWriteFile).toHaveBeenCalledWith('/tmp/out.bbc', JSON.stringify(built, null, 2));
    expect(result).toEqual({ canceled: false, path: '/tmp/out.bbc' });
  });

  it('returns canceled and writes nothing when the dialog is cancelled', async () => {
    mockSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });

    expect(await invoke('config:export')).toEqual({ canceled: true });
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});

describe('config:open-picker', () => {
  it('returns the picked path', async () => {
    mockOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/in.bbc'] });

    expect(await invoke('config:open-picker')).toBe('/tmp/in.bbc');
    expect(mockOpenDialog.mock.calls[0][0].filters).toEqual([
      { name: 'BitButler Configuration', extensions: ['bbc'] },
    ]);
  });

  it('returns undefined when nothing was picked', async () => {
    mockOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    expect(await invoke('config:open-picker')).toBeUndefined();
  });
});

describe('config:read', () => {
  it('returns the description of the parsed file', async () => {
    mockReadFile.mockResolvedValue('raw');
    mockParse.mockReturnValue({ parsed: true });
    mockDescribe.mockReturnValue({ version: 1 });

    expect(await invoke('config:read', { path: '/tmp/in.bbc' })).toEqual({ version: 1 });
    expect(mockReadFile).toHaveBeenCalledWith('/tmp/in.bbc', 'utf8');
    expect(mockParse).toHaveBeenCalledWith('raw');
    expect(mockDescribe).toHaveBeenCalledWith({ parsed: true });
  });

  it('rejects with the parse error message', async () => {
    mockReadFile.mockResolvedValue('raw');
    mockParse.mockImplementation(() => {
      throw new Error('Invalid configuration file.');
    });

    await expect(invoke('config:read', { path: '/tmp/in.bbc' })).rejects.toThrow(
      'Invalid configuration file.',
    );
  });

  it('rejects a payload without a path', async () => {
    await expect(invoke('config:read', {})).rejects.toThrow();
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});

describe('path hardening', () => {
  it.each(['config:read', 'config:import'])(
    '%s rejects a path without the .bbc extension',
    async (channel) => {
      const payload = { path: '/etc/passwd', applySettings: true, serverIds: [] };

      await expect(invoke(channel, payload)).rejects.toThrow(/\.bbc/);
      expect(mockReadFile).not.toHaveBeenCalled();
    },
  );
});

describe('config:import', () => {
  it('re-reads and parses the file, then applies the selection', async () => {
    mockReadFile.mockResolvedValue('raw');
    mockParse.mockReturnValue({ parsed: true });
    mockApply.mockReturnValue({ settings: true, servers: 1 });

    const result = await invoke('config:import', {
      path: '/tmp/in.bbc',
      applySettings: true,
      serverIds: ['s1'],
    });

    expect(mockApply).toHaveBeenCalledWith(
      { parsed: true },
      { applySettings: true, serverIds: ['s1'] },
    );
    expect(result).toEqual({ settings: true, servers: 1 });
  });

  it.each([
    ['a missing path', { applySettings: true, serverIds: [] }],
    ['a non-boolean applySettings', { path: '/x', applySettings: 'yes', serverIds: [] }],
    ['non-array serverIds', { path: '/x', applySettings: true, serverIds: 's1' }],
    ['non-string serverIds', { path: '/x', applySettings: true, serverIds: [1] }],
  ])('rejects %s without applying', async (_name, payload) => {
    await expect(invoke('config:import', payload)).rejects.toThrow();
    expect(mockApply).not.toHaveBeenCalled();
  });
});
