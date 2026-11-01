import type {
  BitButlerAPI,
  BitButlerQbTorrentsAddPayload,
  MenuClickPayload,
  SelectedTorrentInput,
  TorrentParsePayload,
} from '@bitbutler/shared';

export type {
  BitButlerAPI,
  BitButlerQbTorrentsAddPayload,
  MenuClickPayload,
  SelectedTorrentInput,
  TorrentParsePayload,
};

declare global {
  interface Window {
    bitbutler: BitButlerAPI;
  }
}
