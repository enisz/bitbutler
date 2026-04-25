import { ShareLimitValue } from '../components/share-limit/share-limit';
import { TransferRateLimitValue } from '../components/transfer-rate-limit/transfer-rate-limit';

export type RootFolderMode = 'unset' | 'true' | 'false';

export type AddTorrentSettings = {
  savepath: string | null;
  paused: boolean;
  category: string | null;
  tags: string | null;
  root_folder: RootFolderMode;
  skip_checking: boolean;
  sequentialDownload: boolean;
  firstLastPiecePrio: boolean;
  autoTMM: boolean;
  transferRateLimits: TransferRateLimitValue | null;
  shareLimits: ShareLimitValue | null;
};

export const DEFAULT_ADD_TORRENT_SETTINGS: AddTorrentSettings = {
  savepath: null,
  paused: false,
  category: null,
  tags: null,
  root_folder: 'unset',
  skip_checking: false,
  sequentialDownload: false,
  firstLastPiecePrio: false,
  autoTMM: false,
  transferRateLimits: null,
  shareLimits: null,
};
