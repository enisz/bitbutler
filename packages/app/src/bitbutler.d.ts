import type {
  BitButlerAPI,
  BitButlerHttpMethod,
  BitButlerQbRequest,
  BitButlerQbTorrentsAddPayload,
  BitButlerServerIdPayload,
  MenuClickPayload,
  SelectedTorrentInput,
  TorrentParsePayload,
} from '@bitbutler/shared';

export type {
  BitButlerAPI,
  BitButlerHttpMethod,
  BitButlerQbRequest,
  BitButlerQbTorrentsAddPayload,
  BitButlerServerIdPayload,
  MenuClickPayload,
  SelectedTorrentInput,
  TorrentParsePayload,
};

declare global {
  interface Window {
    bitbutler: BitButlerAPI;
  }
}
