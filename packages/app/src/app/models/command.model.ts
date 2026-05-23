import type { SelectedTorrentInput } from '@bitbutler/shared';
import { SettingsTabId } from '../pages/settings/settings.interface';
import { UpdateCheckResponse } from './electron.model';
import { TorrentDraft } from './torrent-draft.model';
import { Torrent } from './torrent.model';

export type { SelectedTorrentInput };

export type LimitTargetType = 'global' | 'torrent';

export type UiCommand =
  | { type: 'UI_SERVER_EDITOR_OPEN'; id?: string }
  | { type: 'UI_TORRENT_DELETE_REQUEST'; defaultRemoveFiles?: boolean }
  | { type: 'UI_OPEN_SETTINGS'; tabToOpen?: SettingsTabId }
  | { type: 'UI_OPEN_QB_SETTINGS' }
  | { type: 'UI_OPEN_TORRENT_DETAILS'; hash: string }
  | {
      type: 'UI_ADD_TORRENT';
      draft?: TorrentDraft;
      selected?: SelectedTorrentInput;
      mode?: 'file' | 'link';
    }
  | { type: 'UI_OPEN_ABOUT' }
  | { type: 'UI_SET_TORRENT_LOCATION'; torrent: Torrent }
  | { type: 'UI_RENAME_TORRENT'; torrent: Torrent }
  | { type: 'UI_LIMIT_TRANSFER'; target: LimitTargetType; hashes?: string[] }
  | { type: 'UI_LIMIT_SHARE'; target?: LimitTargetType; hashes?: string[] }
  | { type: 'UI_SET_TORRENT_TAGS'; torrent: Torrent }
  | { type: 'UI_SET_TORRENT_CATEGORY'; torrent: Torrent }
  | { type: 'UI_OPEN_DESTINATION'; remotePath: string | null; hash: string }
  | { type: 'UI_UPDATE_AVAILABLE'; update: UpdateCheckResponse }
  | { type: 'UI_RENAME_FILES'; hash: string }
  | { type: 'UI_TORRENT_PIN_TOP' }
  | { type: 'UI_TORRENT_PIN_BOTTOM' }
  | { type: 'UI_TORRENT_UNPIN' }
  | { type: 'UI_MANAGE_TAGS' }
  | { type: 'UI_MANAGE_CATEGORIES' }
  | { type: 'UI_MANAGE_SERVERS' }
  | { type: 'UI_SERVER_SWITCH'; id: string };

export type TorrentCommand =
  | { type: 'TORRENT_DELETE_CONFIRM'; removeFiles: boolean }
  | { type: 'TORRENT_DELETED'; hash: string }
  | { type: 'TORRENT_PAUSE' }
  | { type: 'TORRENT_RESUME' }
  | { type: 'TORRENT_RESUME_ALL' }
  | { type: 'TORRENT_PAUSE_ALL' }
  | { type: 'TORRENT_RECHECK' }
  | { type: 'TORRENT_REANNOUNCE' }
  | { type: 'TORRENT_FORCE_RESUME' }
  | { type: 'TORRENT_SUPER_SEEDING'; status: boolean }
  | { type: 'TORRENT_AUTO_TMM'; status: boolean }
  | { type: 'QUEUE_MOVE_TOP' }
  | { type: 'QUEUE_MOVE_UP' }
  | { type: 'QUEUE_MOVE_DOWN' }
  | { type: 'QUEUE_MOVE_BOTTOM' };

export type MenuCommand = { type: 'MENU_FILE_LOGOUT' };

export type ServerCommand =
  | { type: 'SERVER_ADDED'; id: string }
  | { type: 'SERVER_DELETED'; id: string }
  | { type: 'SERVER_UPDATED'; id: string };

export type TransferLimitCommand = { type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' };

export type UpdateCommand = { type: 'UPDATE_CHECK_FOR_UPDATE' };

export type AppCommand =
  | UiCommand
  | TorrentCommand
  | MenuCommand
  | TransferLimitCommand
  | ServerCommand
  | UpdateCommand;
