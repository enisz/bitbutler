import { FormControl, FormGroup } from '@angular/forms';
import { ShareLimitValue } from '../components/share-limit/share-limit';
import { TransferLimitValue } from '../components/transfer-limit/transfer-limit';

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
  transferRateLimits: TransferLimitValue | null;
  shareLimits: ShareLimitValue | null;
  folder: string | null;
  recursive: boolean;
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
  shareLimits: { ratioLimit: -2, seedingTimeLimit: -2, inactiveSeedingTimeLimit: -2 },
  folder: null,
  recursive: false,
};

export type AddTorrentFormGroup = FormGroup<{
  fileGroup: FormGroup<{
    file: FormControl<string>;
    rename: FormControl<string | null>;
  }>;
  linkGroup: FormGroup<{
    magnetLinks: FormControl<string>;
    rename: FormControl<string | null>;
  }>;
  folderGroup: FormGroup<{
    folder: FormControl<string>;
    recursive: FormControl<boolean>;
  }>;
  savepath: FormControl<string | null>;
  paused: FormControl<boolean>;
  category: FormControl<string | null>;
  root_folder: FormControl<RootFolderMode>;
  tags: FormControl<string[] | null>;
  skip_checking: FormControl<boolean>;
  sequentialDownload: FormControl<boolean>;
  firstLastPiecePrio: FormControl<boolean>;
  transferRateLimits: FormControl<TransferLimitValue | null>;
  shareLimits: FormControl<ShareLimitValue | null>;
  autoTMM: FormControl<boolean>;
}>;
