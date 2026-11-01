import { qbRelogin, qbRequest } from '../ipc/qbittorrent.js';
import { toQbError } from './errors.js';

export type QbCallInput = Omit<Parameters<typeof qbRequest>[0], 'id'>;

export async function qbCall<T = unknown>(serverId: string, input: QbCallInput): Promise<T> {
  const request = (): Promise<unknown> => qbRequest({ ...input, id: serverId });

  try {
    return (await request()) as T;
  } catch (err) {
    const first = toQbError(err);
    if (first.code !== 'UNAUTHENTICATED') throw first;

    try {
      await qbRelogin(serverId);
    } catch {
      throw first;
    }

    try {
      return (await request()) as T;
    } catch (retryErr) {
      throw toQbError(retryErr);
    }
  }
}
