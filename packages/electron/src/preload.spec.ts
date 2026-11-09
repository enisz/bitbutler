import { QB_METHODS } from '@bitbutler/shared';
import { ipcRenderer } from 'electron';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const exposed = vi.hoisted(() => new Map<string, unknown>());
const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn((key: string, api: unknown) => exposed.set(key, api)),
  },
  ipcRenderer: {
    invoke: mockInvoke,
    sendSync: vi.fn(() => 'mobile'),
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

  it('delivers poll events from the qb:pollEvent channel until unsubscribed', () => {
    const { qbPoll } = exposed.get('bitbutler') as {
      qbPoll: { onEvent: (callback: (event: unknown) => void) => () => void };
    };
    const callback = vi.fn();

    const unsubscribe = qbPoll.onEvent(callback);
    const [, handler] = vi
      .mocked(ipcRenderer.on)
      .mock.calls.find(([channel]) => channel === 'qb:pollEvent') as [
      string,
      (event: unknown, payload: unknown) => void,
    ];
    handler({}, { type: 'tick' });
    expect(callback).toHaveBeenCalledWith({ type: 'tick' });

    unsubscribe();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('qb:pollEvent', handler);
  });
});

describe('preload appPlatform', () => {
  it('exposes appPlatform from the main process synchronously', async () => {
    await import('./preload.js');
    const api = exposed.get('bitbutler') as { appPlatform: string };
    expect(api.appPlatform).toBe('mobile');
    expect(ipcRenderer.sendSync).toHaveBeenCalledWith('electron:get-app-platform');
  });
});
