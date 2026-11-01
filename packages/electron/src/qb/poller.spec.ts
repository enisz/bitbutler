import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QbBridgeError } from './errors.js';
import * as poller from './poller.js';

const mockSend = vi.fn();
const mockDestroyed = vi.fn(() => false);
const mockMaindata = vi.fn();
const mockTorrentPeers = vi.fn();

vi.mock('../main.js', () => ({
  getMainWindow: () => ({
    isDestroyed: () => mockDestroyed(),
    webContents: { send: (...args: unknown[]) => mockSend(...args) },
  }),
}));
vi.mock('./app.js', () => ({
  maindata: (...args: unknown[]) => mockMaindata(...args),
  torrentPeers: (...args: unknown[]) => mockTorrentPeers(...args),
}));

const unreachable = () => new QbBridgeError('UNREACHABLE', 'offline');

const events = (type?: string): Record<string, unknown>[] =>
  mockSend.mock.calls
    .map(([, event]) => event as Record<string, unknown>)
    .filter((event) => !type || event['type'] === type);

const linkStates = (): unknown[] => events('link').map((event) => event['state']);

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe('poller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSend.mockReset();
    mockDestroyed.mockReturnValue(false);
    mockMaindata.mockReset();
    mockMaindata.mockResolvedValue({ rid: 1 });
    mockTorrentPeers.mockReset();
    mockTorrentPeers.mockResolvedValue({ rid: 1, peers: {} });
    poller.resetPoller();
  });

  afterEach(() => {
    poller.resetPoller();
    vi.useRealTimers();
  });

  it('does not send to a destroyed window', async () => {
    mockDestroyed.mockReturnValue(true);
    poller.start('srv-1', true);
    await advance(2000);

    expect(mockSend).not.toHaveBeenCalled();
  });

  describe('maindata loop', () => {
    it('polls at once from rid 0 and pushes the chunk on the qb:pollEvent channel', async () => {
      poller.start('srv-1', true);
      await advance(0);

      expect(mockMaindata).toHaveBeenCalledWith('srv-1', 0);
      expect(mockSend).toHaveBeenCalledWith('qb:pollEvent', {
        type: 'maindata',
        serverId: 'srv-1',
        data: { rid: 1 },
      });
    });

    it('polls again every interval with the rid of the last chunk, and ticks each time', async () => {
      mockMaindata.mockResolvedValueOnce({ rid: 5 }).mockResolvedValue({ rid: 6 });
      poller.start('srv-1', true);
      await advance(2000);

      expect(mockMaindata).toHaveBeenNthCalledWith(1, 'srv-1', 0);
      expect(mockMaindata).toHaveBeenNthCalledWith(2, 'srv-1', 5);
      expect(events('tick')).toHaveLength(2);
    });

    it('skips a tick while the previous request is still in flight', async () => {
      mockMaindata.mockReturnValue(new Promise(() => {}));
      poller.start('srv-1', true);
      await advance(6000);

      expect(mockMaindata).toHaveBeenCalledTimes(1);
      expect(events('tick')).toHaveLength(4);
    });

    it('resumes from the stored rid for the same server unless the restart is fresh', async () => {
      mockMaindata.mockResolvedValue({ rid: 9 });
      poller.start('srv-1', true);
      await advance(0);
      poller.stop();

      poller.start('srv-1', false);
      await advance(0);
      expect(mockMaindata).toHaveBeenLastCalledWith('srv-1', 9);

      poller.start('srv-1', true);
      await advance(0);
      expect(mockMaindata).toHaveBeenLastCalledWith('srv-1', 0);
    });

    it('stops polling and ignores a response that arrives after stop()', async () => {
      let resolve: (value: unknown) => void = () => {};
      mockMaindata.mockReturnValue(new Promise((r) => (resolve = r)));
      poller.start('srv-1', true);
      await advance(0);

      poller.stop();
      resolve({ rid: 3 });
      await advance(10_000);

      expect(events('maindata')).toHaveLength(0);
      expect(mockMaindata).toHaveBeenCalledTimes(1);
    });

    it('does not start a second loop for another server without stopping the first', async () => {
      poller.start('srv-1', true);
      poller.start('srv-2', true);
      await advance(2000);

      expect(mockMaindata.mock.calls.filter(([id]) => id === 'srv-1')).toHaveLength(1);
      expect(mockMaindata.mock.calls.filter(([id]) => id === 'srv-2')).toHaveLength(2);
    });
  });

  describe('configure', () => {
    it('uses the configured interval', async () => {
      poller.configure({ pollMs: 5000, paused: false });
      poller.start('srv-1', true);
      await advance(5000);

      expect(mockMaindata).toHaveBeenCalledTimes(2);
    });

    it('restarts with an immediate poll when the interval changes', async () => {
      poller.start('srv-1', true);
      await advance(0);
      expect(mockMaindata).toHaveBeenCalledTimes(1);

      poller.configure({ pollMs: 5000, paused: false });
      await advance(0);
      expect(mockMaindata).toHaveBeenCalledTimes(2);
    });

    it('stops polling while paused once the first poll has finished, and polls at once when resumed', async () => {
      poller.start('srv-1', true);
      await advance(0);

      poller.configure({ pollMs: 2000, paused: true });
      await advance(10_000);
      expect(mockMaindata).toHaveBeenCalledTimes(1);

      poller.configure({ pollMs: 2000, paused: false });
      await advance(0);
      expect(mockMaindata).toHaveBeenCalledTimes(2);
    });

    it('still completes the initial load when paused before the first poll', async () => {
      poller.configure({ pollMs: 2000, paused: true });
      poller.start('srv-1', true);
      await advance(0);

      expect(events('maindata')).toHaveLength(1);
      await advance(10_000);
      expect(mockMaindata).toHaveBeenCalledTimes(1);
    });
  });

  describe('link handling', () => {
    it('reports reconnecting once, then keeps quiet while the server stays down', async () => {
      mockMaindata.mockRejectedValue(unreachable());
      poller.start('srv-1', true);
      await advance(20_000);

      expect(linkStates()).toEqual(['reconnecting']);
    });

    it('backs off between attempts (2s, 5s, 10s)', async () => {
      mockMaindata.mockRejectedValue(unreachable());
      poller.start('srv-1', true);
      await advance(0);
      expect(mockMaindata).toHaveBeenCalledTimes(1);

      await advance(2000);
      expect(mockMaindata).toHaveBeenCalledTimes(2);

      // Next attempt is due 5s after the second failure (t=7s); ticks at 4s and 6s are skipped.
      await advance(4000);
      expect(mockMaindata).toHaveBeenCalledTimes(2);
      await advance(2000);
      expect(mockMaindata).toHaveBeenCalledTimes(3);
    });

    it('reports connected once when a poll gets through again', async () => {
      mockMaindata.mockRejectedValueOnce(unreachable());
      poller.start('srv-1', true);
      await advance(2000);

      expect(linkStates()).toEqual(['reconnecting', 'connected']);
      expect(events('maindata')).toHaveLength(1);
    });

    it('never reports connected when the link never went down', async () => {
      poller.start('srv-1', true);
      await advance(10_000);

      expect(events('link')).toHaveLength(0);
    });

    it('gives up and stops after the server stayed unreachable for 2 minutes', async () => {
      mockMaindata.mockRejectedValue(unreachable());
      poller.start('srv-1', true);

      await advance(119_000);
      expect(linkStates()).toEqual(['reconnecting']);

      // The check runs on the first failed attempt past 2 minutes; attempts sit on the 2s ticks
      // and the last backoff step is 15s, so allow for that.
      await advance(15_000);
      expect(linkStates()).toEqual(['reconnecting', 'gave-up']);

      const calls = mockMaindata.mock.calls.length;
      await advance(60_000);
      expect(mockMaindata).toHaveBeenCalledTimes(calls);
    });

    it('reports an expired session and stops', async () => {
      mockMaindata.mockRejectedValue(new QbBridgeError('UNAUTHENTICATED', 'expired'));
      poller.start('srv-1', true);
      await advance(10_000);

      expect(linkStates()).toEqual(['expired']);
      expect(mockMaindata).toHaveBeenCalledTimes(1);
    });

    it('reports other failures and keeps polling', async () => {
      mockMaindata.mockRejectedValue(new QbBridgeError('FAILED', 'boom'));
      poller.start('srv-1', true);
      await advance(4000);

      expect(events('failed')).toHaveLength(3);
      expect(events('link')).toHaveLength(0);
      expect(mockMaindata).toHaveBeenCalledTimes(3);
    });
  });

  describe('peers loop', () => {
    it('polls a torrent from rid 0, then with the last rid, and pushes the data', async () => {
      mockTorrentPeers.mockResolvedValueOnce({ rid: 4, peers: {} }).mockResolvedValue({ rid: 5 });
      poller.startPeers('srv-1', 'abc');
      await advance(2000);

      expect(mockTorrentPeers).toHaveBeenNthCalledWith(1, 'srv-1', 'abc', 0);
      expect(mockTorrentPeers).toHaveBeenNthCalledWith(2, 'srv-1', 'abc', 4);
      expect(events('peers')[0]).toMatchObject({ serverId: 'srv-1', hash: 'abc' });
    });

    it('keeps polling after a failed tick', async () => {
      mockTorrentPeers.mockRejectedValueOnce(new QbBridgeError('FAILED', 'boom'));
      poller.startPeers('srv-1', 'abc');
      await advance(2000);

      expect(mockTorrentPeers).toHaveBeenCalledTimes(2);
      expect(events('peers')).toHaveLength(1);
    });

    it('stops when asked to', async () => {
      poller.startPeers('srv-1', 'abc');
      await advance(0);
      poller.stopPeers('srv-1', 'abc');
      await advance(10_000);

      expect(mockTorrentPeers).toHaveBeenCalledTimes(1);
    });

    it('waits while the maindata loop is reconnecting', async () => {
      mockMaindata.mockRejectedValue(unreachable());
      poller.start('srv-1', true);
      await advance(0);

      poller.startPeers('srv-1', 'abc');
      await advance(6000);

      expect(mockTorrentPeers).not.toHaveBeenCalled();
    });

    it('keeps polling while maindata polling is paused, at the last unpaused rate', async () => {
      poller.configure({ pollMs: 3000, paused: false });
      poller.configure({ pollMs: 1000, paused: true });
      poller.startPeers('srv-1', 'abc');
      await advance(3000);

      expect(mockTorrentPeers).toHaveBeenCalledTimes(2);
    });
  });
});
