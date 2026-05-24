// e2e/globalTeardown.ts
import { stopContainer } from './helpers/qbittorrent';

export default async function globalTeardown(): Promise<void> {
  stopContainer();
}
