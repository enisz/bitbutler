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

  it('re-logs in and retries once after a 401', async () => {
    mockRequest.mockRejectedValueOnce(http(401)).mockResolvedValueOnce('ok');
    mockRelogin.mockResolvedValueOnce(undefined);
    expect(await qbCall('s1', { path: '/x' })).toBe('ok');
    expect(mockRelogin).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('does not re-log in when the cookie is missing (the session was ended)', async () => {
    mockRequest.mockRejectedValue(new Error('Not logged in (missing cookie).'));
    await expect(qbCall('s1', { path: '/x' })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(mockRelogin).not.toHaveBeenCalled();
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('reports UNREACHABLE when the re-login cannot reach the server', async () => {
    mockRequest.mockRejectedValueOnce(http(403));
    mockRelogin.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(qbCall('s1', { path: '/x' })).rejects.toMatchObject({
      code: 'UNREACHABLE',
      message: 'fetch failed',
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('keeps the original UNAUTHENTICATED error when the re-login is rejected by the server', async () => {
    mockRequest.mockRejectedValueOnce(http(403));
    mockRelogin.mockRejectedValueOnce(http(401));
    await expect(qbCall('s1', { path: '/x' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 403,
    });
  });

  it('shares one re-login between concurrent calls for the same server', async () => {
    let releaseRelogin: () => void = () => {};
    mockRelogin.mockImplementation(
      () => new Promise<void>((resolve) => (releaseRelogin = resolve)),
    );
    let failures = 2;
    mockRequest.mockImplementation(async () => {
      if (failures > 0) {
        failures--;
        throw http(403);
      }
      return 'ok';
    });

    const a = qbCall('s1', { path: '/a' });
    const b = qbCall('s1', { path: '/b' });
    await vi.waitFor(() => expect(mockRelogin).toHaveBeenCalled());
    // Let both calls reach the re-login before it settles.
    await new Promise((r) => setTimeout(r, 0));
    releaseRelogin();

    expect(await Promise.all([a, b])).toEqual(['ok', 'ok']);
    expect(mockRelogin).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledTimes(4);
  });

  it('starts a fresh re-login once the previous one has settled', async () => {
    mockRequest
      .mockRejectedValueOnce(http(403))
      .mockResolvedValueOnce('one')
      .mockRejectedValueOnce(http(403))
      .mockResolvedValueOnce('two');
    mockRelogin.mockResolvedValue(undefined);
    expect(await qbCall('s1', { path: '/x' })).toBe('one');
    expect(await qbCall('s1', { path: '/x' })).toBe('two');
    expect(mockRelogin).toHaveBeenCalledTimes(2);
  });
});
