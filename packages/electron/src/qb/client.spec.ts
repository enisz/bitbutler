import { beforeEach, describe, expect, it, vi } from 'vitest';
import { qbCall } from './client.js';
import { QbBridgeError } from './errors.js';

const mockRequest = vi.hoisted(() => vi.fn());
const mockRelogin = vi.hoisted(() => vi.fn());

vi.mock('../ipc/qbittorrent.js', () => ({ qbRequest: mockRequest, qbRelogin: mockRelogin }));

const http = (status: number): string =>
  JSON.stringify({ name: 'QbHttpError', status, statusText: 'x', body: '', path: '/p' });

describe('qbCall', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRelogin.mockReset();
  });

  it('returns the value on success', async () => {
    mockRequest.mockResolvedValueOnce({ a: 1 });
    expect(await qbCall('s1', { path: '/x' })).toEqual({ a: 1 });
    expect(mockRequest).toHaveBeenCalledWith({ path: '/x', id: 's1' });
  });

  it('re-logs in and retries once after a 403', async () => {
    mockRequest.mockRejectedValueOnce(http(403)).mockResolvedValueOnce('ok');
    mockRelogin.mockResolvedValueOnce(undefined);
    expect(await qbCall('s1', { path: '/x' })).toBe('ok');
    expect(mockRelogin).toHaveBeenCalledTimes(1);
    expect(mockRelogin).toHaveBeenCalledWith('s1');
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('throws UNAUTHENTICATED when re-login fails', async () => {
    mockRequest.mockRejectedValueOnce(http(403));
    mockRelogin.mockRejectedValueOnce(new Error('bad creds'));
    const p = qbCall('s1', { path: '/x' });
    await expect(p).rejects.toBeInstanceOf(QbBridgeError);
    await expect(p).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('does not loop on a second 403', async () => {
    mockRequest.mockRejectedValue(http(403));
    mockRelogin.mockResolvedValue(undefined);
    await expect(qbCall('s1', { path: '/x' })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(mockRelogin).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 500', async () => {
    mockRequest.mockRejectedValue(http(500));
    await expect(qbCall('s1', { path: '/x' })).rejects.toMatchObject({ code: 'UNREACHABLE' });
    expect(mockRelogin).not.toHaveBeenCalled();
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});
