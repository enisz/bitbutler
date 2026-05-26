// e2e/globalTeardown.ts
import { deleteTorrent, getSid, stopContainer } from './helpers/qbittorrent';

export default async function globalTeardown(): Promise<void> {
  const hash = process.env['FIXTURE_HASH'];
  if (hash) {
    try {
      const sid = await getSid();
      await deleteTorrent(sid, hash);
    } catch {
      // best-effort cleanup; container is about to be removed anyway
    }
  }
  stopContainer();
}
