import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as app from './app.js';

const mockQbCall = vi.fn();

vi.mock('./client.js', () => ({ qbCall: (...args: unknown[]) => mockQbCall(...args) }));

describe('app, log and sync domain', () => {
  beforeEach(() => {
    mockQbCall.mockReset();
    mockQbCall.mockResolvedValue(undefined);
  });

  it.each([
    ['preferences', () => app.preferences('s'), { method: 'GET', path: '/api/v2/app/preferences' }],
    [
      'setPreferences',
      () => app.setPreferences('s', { a: 1 } as never),
      { method: 'POST', path: '/api/v2/app/setPreferences', form: { json: '{"a":1}' } },
    ],
    [
      'logMain defaults',
      () => app.logMain('s'),
      { method: 'GET', path: '/api/v2/log/main', query: {} },
    ],
    [
      'logMain options',
      () => app.logMain('s', { normal: true, last_known_id: 5 }),
      { method: 'GET', path: '/api/v2/log/main', query: { normal: true, last_known_id: 5 } },
    ],
    [
      'logPeers defaults',
      () => app.logPeers('s'),
      { method: 'GET', path: '/api/v2/log/peers', query: {} },
    ],
    [
      'logPeers options',
      () => app.logPeers('s', { last_known_id: 3 }),
      { method: 'GET', path: '/api/v2/log/peers', query: { last_known_id: 3 } },
    ],
    [
      'maindata',
      () => app.maindata('s', 7),
      { method: 'GET', path: '/api/v2/sync/maindata', query: { rid: 7 } },
    ],
    [
      'torrentPeers',
      () => app.torrentPeers('s', 'h', 4),
      { method: 'GET', path: '/api/v2/sync/torrentPeers', query: { hash: 'h', rid: 4 } },
    ],
    [
      'torrentPeers default rid',
      () => app.torrentPeers('s', 'h'),
      { method: 'GET', path: '/api/v2/sync/torrentPeers', query: { hash: 'h', rid: 0 } },
    ],
  ])('%s sends the expected request', async (_name, call, expected) => {
    await call();
    expect(mockQbCall).toHaveBeenCalledWith('s', expected);
  });
});
