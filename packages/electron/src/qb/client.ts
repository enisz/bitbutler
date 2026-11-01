import { qbRelogin, qbRequest } from '../ipc/qbittorrent.js';
import { toQbError } from './errors.js';

export type QbCallInput = Omit<Parameters<typeof qbRequest>[0], 'id'>;

// One in-flight re-login per server, so concurrent 401/403s share a single login request.
const inFlightRelogins = new Map<string, Promise<void>>();

function reloginOnce(serverId: string): Promise<void> {
  const pending = inFlightRelogins.get(serverId);
  if (pending) return pending;
  const relogin = Promise.resolve()
    .then(() => qbRelogin(serverId))
    .finally(() => inFlightRelogins.delete(serverId));
  inFlightRelogins.set(serverId, relogin);
  return relogin;
}

export async function qbCall<T = unknown>(serverId: string, input: QbCallInput): Promise<T> {
  const request = (): Promise<unknown> => qbRequest({ ...input, id: serverId });

  try {
    return (await request()) as T;
  } catch (err) {
    const first = toQbError(err);
    if (first.code !== 'UNAUTHENTICATED') throw first;
    // No session at all (e.g. the user logged out): logging in again would silently revive it.
    if (first.reason === 'missing-cookie') throw first;

    try {
      await reloginOnce(serverId);
    } catch (reloginErr) {
      const relogin = toQbError(reloginErr);
      // A transient outage is not an expired session.
      throw relogin.code === 'UNREACHABLE' ? relogin : first;
    }

    try {
      return (await request()) as T;
    } catch (retryErr) {
      throw toQbError(retryErr);
    }
  }
}
