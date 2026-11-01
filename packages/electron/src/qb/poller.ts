import type { QbPollConfig, QbPollEvent } from '@bitbutler/shared';
import { getMainWindow } from '../main.js';
import { maindata, torrentPeers } from './app.js';
import { QbBridgeError } from './errors.js';

// Delay before the next attempt after the 1st, 2nd, 3rd... failed poll; the last value repeats.
const RECONNECT_BACKOFF_MS = [2000, 5000, 10000, 15000];
// How long the server may stay unreachable before the loop gives up.
const RECONNECT_GRACE_MS = 2 * 60 * 1000;

interface MaindataLoop {
  serverId: string;
  rid: number;
  timer: ReturnType<typeof setInterval> | null;
  inFlight: boolean;
  loadedOnce: boolean;
  failedPolls: number;
  firstFailureAt: number;
  nextAttemptAt: number;
}

interface PeersLoop {
  serverId: string;
  hash: string;
  rid: number;
  timer: ReturnType<typeof setInterval> | null;
  inFlight: boolean;
}

let config: QbPollConfig = { pollMs: 2000, paused: false };
// Peers keep polling while paused (only the maindata loop is throttled), at the last unpaused rate.
let peersMs = config.pollMs;

let loop: MaindataLoop | null = null;
// The sync cursor survives a stop, so coming back to the same server asks only for what changed.
const ridByServer = new Map<string, number>();
const peersLoops = new Map<string, PeersLoop>();

function emit(event: QbPollEvent): void {
  const window = getMainWindow();
  if (window && !window.isDestroyed()) window.webContents.send('qb:pollEvent', event);
}

const peersKey = (serverId: string, hash: string): string => `${serverId}:${hash}`;

function isReconnecting(): boolean {
  return (loop?.failedPolls ?? 0) > 0;
}

function clearLoopTimer(target: { timer: ReturnType<typeof setInterval> | null }): void {
  if (target.timer) clearInterval(target.timer);
  target.timer = null;
}

export function start(serverId: string, fresh: boolean): void {
  stop();
  if (fresh) ridByServer.delete(serverId);
  loop = {
    serverId,
    rid: ridByServer.get(serverId) ?? 0,
    timer: null,
    inFlight: false,
    loadedOnce: false,
    failedPolls: 0,
    firstFailureAt: 0,
    nextAttemptAt: 0,
  };
  schedule(loop);
}

export function stop(): void {
  if (loop) clearLoopTimer(loop);
  loop = null;
}

export function configure(next: QbPollConfig): void {
  const changed = next.pollMs !== config.pollMs || next.paused !== config.paused;
  const peersChanged = !next.paused && next.pollMs !== peersMs;
  config = { ...next };
  if (!next.paused) peersMs = next.pollMs;

  if (changed && loop) schedule(loop);
  if (peersChanged) for (const peers of peersLoops.values()) schedulePeers(peers);
}

export function startPeers(serverId: string, hash: string): void {
  stopPeers(serverId, hash);
  const peers: PeersLoop = { serverId, hash, rid: 0, timer: null, inFlight: false };
  peersLoops.set(peersKey(serverId, hash), peers);
  schedulePeers(peers);
}

export function stopPeers(serverId: string, hash: string): void {
  const key = peersKey(serverId, hash);
  const peers = peersLoops.get(key);
  if (peers) clearLoopTimer(peers);
  peersLoops.delete(key);
}

// Runs one poll now, then one per interval. Pausing throttles routine polling but must never block
// the initial load, so a paused loop keeps going until its first poll has finished.
function schedule(target: MaindataLoop): void {
  clearLoopTimer(target);
  if (config.paused && target.loadedOnce) return;
  tick(target);
  target.timer = setInterval(() => tick(target), config.pollMs);
}

function tick(target: MaindataLoop): void {
  if (loop !== target) return;
  emit({ type: 'tick' });
  // Ticks inside a backoff delay, or while a request is still in flight, are skipped.
  if (target.inFlight || Date.now() < target.nextAttemptAt) return;
  void poll(target);
}

async function poll(target: MaindataLoop): Promise<void> {
  target.inFlight = true;
  try {
    const data = await maindata(target.serverId, target.rid);
    if (loop !== target) return;
    if (typeof data?.rid === 'number') {
      target.rid = data.rid;
      ridByServer.set(target.serverId, data.rid);
    }
    markLoaded(target);
    emit({ type: 'maindata', serverId: target.serverId, data });
    if (target.failedPolls > 0) {
      target.failedPolls = 0;
      target.firstFailureAt = 0;
      target.nextAttemptAt = 0;
      emit({ type: 'link', serverId: target.serverId, state: 'connected' });
    }
  } catch (error) {
    if (loop !== target) return;
    markLoaded(target);
    handleFailure(target, error);
  } finally {
    target.inFlight = false;
  }
}

// A paused loop only runs until its first poll has finished.
function markLoaded(target: MaindataLoop): void {
  target.loadedOnce = true;
  if (config.paused) clearLoopTimer(target);
}

function handleFailure(target: MaindataLoop, error: unknown): void {
  const code = error instanceof QbBridgeError ? error.code : 'FAILED';
  const { serverId } = target;

  if (code === 'UNAUTHENTICATED') {
    console.warn('[BitButler][poller] Session expired, stopping the poll loop.');
    emit({ type: 'link', serverId, state: 'expired' });
    stop();
    return;
  }

  if (code !== 'UNREACHABLE') {
    console.error('[BitButler][poller] Poll failed.', error);
    emit({ type: 'failed', serverId });
    return;
  }

  const now = Date.now();
  target.failedPolls++;
  if (target.failedPolls === 1) {
    target.firstFailureAt = now;
    emit({ type: 'link', serverId, state: 'reconnecting' });
  }

  if (now - target.firstFailureAt >= RECONNECT_GRACE_MS) {
    console.warn('[BitButler][poller] Giving up: server unreachable past the grace period.');
    emit({ type: 'link', serverId, state: 'gave-up' });
    stop();
    return;
  }

  const delays = RECONNECT_BACKOFF_MS;
  target.nextAttemptAt = now + delays[Math.min(target.failedPolls, delays.length) - 1];
}

function schedulePeers(target: PeersLoop): void {
  clearLoopTimer(target);
  void pollPeers(target);
  target.timer = setInterval(() => void pollPeers(target), peersMs);
}

async function pollPeers(target: PeersLoop): Promise<void> {
  // The maindata loop owns reconnecting; peers just wait for it to report the link is back.
  if (target.inFlight || isReconnecting()) return;
  target.inFlight = true;
  try {
    const data = await torrentPeers(target.serverId, target.hash, target.rid);
    if (peersLoops.get(peersKey(target.serverId, target.hash)) !== target) return;
    if (typeof data?.rid === 'number') target.rid = data.rid;
    emit({ type: 'peers', serverId: target.serverId, hash: target.hash, data });
  } catch (error) {
    console.error(`[BitButler][poller] Peers poll failed for ${target.hash}.`, error);
  } finally {
    target.inFlight = false;
  }
}

/** Stops every loop and forgets all state; for tests. */
export function resetPoller(): void {
  stop();
  for (const peers of peersLoops.values()) clearLoopTimer(peers);
  peersLoops.clear();
  ridByServer.clear();
  config = { pollMs: 2000, paused: false };
  peersMs = config.pollMs;
}
