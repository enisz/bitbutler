import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getWebapiVersion, refreshServerInfo, resolveFullMode } from './server-info.js';

const mockQbCall = vi.hoisted(() => vi.fn());
const mockQbRequest = vi.hoisted(() => vi.fn());
const mockGetExportAvailable = vi.hoisted(() => vi.fn());
const mockGetConnectionInfo = vi.hoisted(() => vi.fn());
const mockSetConnectionInfo = vi.hoisted(() => vi.fn());

vi.mock('./client.js', () => ({ qbCall: mockQbCall }));
vi.mock('../ipc/qbittorrent.js', () => ({ qbRequest: mockQbRequest }));
vi.mock('../ipc/server.js', () => ({
  getExportAvailable: mockGetExportAvailable,
  getConnectionInfo: mockGetConnectionInfo,
  setConnectionInfo: mockSetConnectionInfo,
}));

describe('getWebapiVersion', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns the stored value', () => {
    mockGetConnectionInfo.mockReturnValue({ webapiVersion: '2.11.2' });
    expect(getWebapiVersion('s1')).toBe('2.11.2');
  });

  it('returns null when nothing is stored', () => {
    mockGetConnectionInfo.mockReturnValue({ webapiVersion: null });
    expect(getWebapiVersion('s1')).toBeNull();
  });
});

describe('resolveFullMode', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns true without probing when cached value is 1', async () => {
    mockGetExportAvailable.mockReturnValue(1);
    expect(await resolveFullMode('s1')).toBe(true);
    expect(mockQbRequest).not.toHaveBeenCalled();
  });

  it('returns false without probing when cached value is 0', async () => {
    mockGetExportAvailable.mockReturnValue(0);
    expect(await resolveFullMode('s1')).toBe(false);
    expect(mockQbRequest).not.toHaveBeenCalled();
  });

  it('probes live when cached value is null', async () => {
    mockGetExportAvailable.mockReturnValue(null);
    mockQbRequest.mockResolvedValue(Buffer.from(''));
    expect(await resolveFullMode('s1')).toBe(true);
    expect(mockQbRequest).toHaveBeenCalled();
  });

  it('is false when the probe returns 404', async () => {
    mockGetExportAvailable.mockReturnValue(null);
    mockQbRequest.mockRejectedValue(JSON.stringify({ status: 404 }));
    expect(await resolveFullMode('s1')).toBe(false);
  });

  it('is true when the probe fails with another HTTP status', async () => {
    mockGetExportAvailable.mockReturnValue(null);
    mockQbRequest.mockRejectedValue(JSON.stringify({ status: 500 }));
    expect(await resolveFullMode('s1')).toBe(true);
  });

  it('is false when the probe fails with a non-HTTP error', async () => {
    mockGetExportAvailable.mockReturnValue(null);
    mockQbRequest.mockRejectedValue('network down');
    expect(await resolveFullMode('s1')).toBe(false);
  });
});

describe('refreshServerInfo', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockQbCall.mockImplementation(async (_id: string, { path }: { path: string }) =>
      path.endsWith('webapiVersion') ? ' 2.11.2\n' : ' v5.0.1 ',
    );
  });

  it('trims versions, persists with exportAvailable 1 and returns the info', async () => {
    mockGetExportAvailable.mockReturnValue(1);
    expect(await refreshServerInfo('s1')).toEqual({
      webapiVersion: '2.11.2',
      qbVersion: 'v5.0.1',
      isFullMode: true,
    });
    expect(mockSetConnectionInfo).toHaveBeenCalledWith('s1', {
      exportAvailable: 1,
      webapiVersion: '2.11.2',
      qbVersion: 'v5.0.1',
    });
  });

  it('persists exportAvailable 0 when full mode is unavailable', async () => {
    mockGetExportAvailable.mockReturnValue(0);
    expect((await refreshServerInfo('s1')).isFullMode).toBe(false);
    expect(mockSetConnectionInfo).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ exportAvailable: 0 }),
    );
  });

  it('persists nothing when a version request fails', async () => {
    mockGetExportAvailable.mockReturnValue(1);
    mockQbCall.mockRejectedValue(new Error('boom'));
    await expect(refreshServerInfo('s1')).rejects.toThrow('boom');
    expect(mockSetConnectionInfo).not.toHaveBeenCalled();
  });
});
