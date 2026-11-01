import type { Torrent } from '@bitbutler/shared';

export { QbTorrentContentPriority } from '@bitbutler/shared';
export type {
  Maindata,
  QbCategory,
  QbPeerId,
  QbServerState,
  QbTorrentContent,
  QbTorrentPeer,
  QbTorrentPeersResponse,
  Torrent,
  TorrentState,
} from '@bitbutler/shared';

export type TorrentDelta = Partial<Torrent> & { hash: string };
export type TorrentMap = Map<string, Torrent>;
