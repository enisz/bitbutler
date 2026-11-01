import { QB_METHODS } from '@bitbutler/shared';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const exposed = vi.hoisted(() => new Map<string, unknown>());
const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn((key: string, api: unknown) => exposed.set(key, api)),
  },
  ipcRenderer: {
    invoke: mockInvoke,
    on: vi.fn(),
    send: vi.fn(),
    removeListener: vi.fn(),
  },
}));

type Qb = Record<string, unknown>;

describe('preload qb bridge', () => {
  let qb: Qb;

  beforeAll(async () => {
    await import('./preload.js');
    qb = (exposed.get('bitbutler') as { qb: Qb }).qb;
  });

  it('exposes exactly the bridge methods as group.method functions', () => {
    const names = Object.entries(qb)
      .filter(([, v]) => v !== null && typeof v === 'object')
      .flatMap(([group, methods]) =>
        Object.entries(methods as Record<string, unknown>).map(([method, fn]) => {
          expect(typeof fn).toBe('function');
          return `${group}.${method}`;
        }),
      );
    expect(new Set(names)).toEqual(new Set(QB_METHODS));
    expect(names).toHaveLength(QB_METHODS.length);
  });

  it('forwards a call over the single qb:call channel', async () => {
    mockInvoke.mockResolvedValue({ ok: true, data: undefined });
    const torrents = qb.torrents as Record<string, (...args: unknown[]) => Promise<unknown>>;
    await expect(torrents.stop('srv-1', ['h1'])).resolves.toEqual({ ok: true, data: undefined });
    expect(mockInvoke).toHaveBeenCalledWith('qb:call', 'torrents.stop', ['srv-1', ['h1']]);
  });

  it('no longer exposes the legacy qb members', () => {
    for (const name of ['login', 'logout', 'hasCookie', 'request', 'torrentsAdd']) {
      expect(qb[name]).toBeUndefined();
    }
  });
});
