import type {
  BitButlerAPI,
  BitButlerHttpMethod,
  BitButlerQbRequest,
  BitButlerQbTorrentsAddPayload,
  BitButlerServerIdPayload,
  BitButlerSyncStreamPayload,
  BitButlerSyncStreamResponse,
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
  BitButlerSyncStreamPayload,
  BitButlerSyncStreamResponse,
  MenuClickPayload,
  SelectedTorrentInput,
  TorrentParsePayload,
};

declare global {
  interface Window {
    bitbutler: BitButlerAPI;
  }
}
