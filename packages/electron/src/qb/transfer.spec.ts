import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as transfer from './transfer.js';

const mockQbCall = vi.fn();

vi.mock('./client.js', () => ({ qbCall: (...args: unknown[]) => mockQbCall(...args) }));

describe('transfer domain', () => {
  beforeEach(() => {
    mockQbCall.mockReset();
    mockQbCall.mockResolvedValue(undefined);
  });

  it.each([
    ['downloadLimit', () => transfer.downloadLimit('s'), 'GET', 'downloadLimit', undefined],
    ['uploadLimit', () => transfer.uploadLimit('s'), 'GET', 'uploadLimit', undefined],
    [
      'setDownloadLimit',
      () => transfer.setDownloadLimit('s', 1024),
      'POST',
      'setDownloadLimit',
      { limit: '1024' },
    ],
    [
      'setUploadLimit',
      () => transfer.setUploadLimit('s', 0),
      'POST',
      'setUploadLimit',
      { limit: '0' },
    ],
    [
      'toggleSpeedLimitsMode',
      () => transfer.toggleSpeedLimitsMode('s'),
      'POST',
      'toggleSpeedLimitsMode',
      undefined,
    ],
  ])('%s sends the expected request', async (_name, call, method, endpoint, form) => {
    await call();
    const expected: Record<string, unknown> = {
      method,
      path: `/api/v2/transfer/${endpoint}`,
    };
    if (form) expected['form'] = form;
    expect(mockQbCall).toHaveBeenCalledWith('s', expected);
  });

  it('returns the numeric limits as received', async () => {
    mockQbCall.mockResolvedValue(2048);
    expect(await transfer.downloadLimit('s')).toBe(2048);
    expect(await transfer.uploadLimit('s')).toBe(2048);
  });

  it.each([
    [1, true],
    [0, false],
    ['1', true],
  ])('speedLimitsMode maps %s to %s', async (raw, expected) => {
    mockQbCall.mockResolvedValue(raw);
    expect(await transfer.speedLimitsMode('s')).toBe(expected);
    expect(mockQbCall).toHaveBeenCalledWith('s', {
      method: 'GET',
      path: '/api/v2/transfer/speedLimitsMode',
    });
  });
});
