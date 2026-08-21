import type { HostPlatform, UpdateCheckResponse } from './models/electron.model.js';
import type { NewServer, ServerRecord } from './models/server.model.js';
import type { TorrentDraft, TorrentDraftSource } from './models/torrent-draft.model.js';
import type { WindowState } from './models/window.model.js';
import type { UpdateCapability, UpdaterEvent } from './models/updater.model.js';

export type BitButlerServerIdPayload = { id: string };
export type BitButlerQbLoginPayload = { id: string; username?: string; password?: string };

export type BitButlerHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type SelectedTorrentInput =
  | { name: string; path: string }
  | { name: string; bytes: number[] };

export type BitButlerQbTorrentsAddPayload = {
  id: string;
  torrents: SelectedTorrentInput[];
  urls?: string[];
  options?: Record<string, unknown>;
};

export interface BitButlerQbRequest<TBody = unknown> {
  id: string;
  path: string;
  method?: BitButlerHttpMethod;
  query?: Record<string, string | number | boolean>;
  body?: TBody;
  headers?: Record<string, string>;
}

export interface BitButlerSyncStreamPayload {
  id: string;
  rid?: number;
  chunkSize?: number;
  delayMs?: number;
  sortBy?: string;
  sortDesc?: boolean;
}

export type BitButlerSyncStreamResponse =
  | { type: 'metadata'; data: Record<string, unknown>; total: number }
  | { type: 'chunk'; data: Record<string, unknown>; progress: number; total: number }
  | { type: 'done' }
  | { type: 'error'; error: string };

export type MenuClickPayload = { action: string; ts: number; serverId?: string };

export type TorrentParsePayload = {
  source?: TorrentDraftSource;
  path?: string;
  originalName?: string;
  bytes?: number[];
};

export type ExportScope = 'all' | 'filtered' | 'selected';
export type ExportCategoryScope = 'all' | 'assigned';
export type ExportTagScope = 'all' | 'assigned';
export type ExportMode = 'full' | 'legacy';
export type ImportStartMode = 'paused' | 'active' | 'all';

export type ImportRestoreField =
  | 'save_path'
  | 'categories'
  | 'tags'
  | 'speed_limits'
  | 'share_limits'
  | 'renames'
  | 'priorities'
  | 'auto_tmm'
  | 'sequential_download'
  | 'super_seeding'
  | 'first_last_piece_prio';

export interface ExportStartPayload {
  serverId: string;
  serverName: string;
  scope: ExportScope;
  categoryScope: ExportCategoryScope;
  tagScope: ExportTagScope;
  hashes: string[];
  destDir: string;
  filename: string;
}

export interface ExportProgressEvent {
  current: number;
  total: number;
  name: string;
  skipped: number;
}

export interface ImportProgressEvent {
  current: number;
  total: number;
  name: string;
  hash: string;
  success: boolean;
}

export interface ExportDoneEvent {
  path: string;
  total: number;
  skipped: number;
  categories: number;
  tags: number;
  fileSize: number;
}

export interface ExportTorrentFileItem {
  hash: string;
  name: string;
}

export interface ExportTorrentFilesResult {
  cancelled: boolean;
  savedPaths: string[];
  failed: { hash: string; name: string; error: string }[];
}

export interface BbeTorrentFile {
  index: number;
  name: string;
  priority: number;
}

export interface BbeTorrentEntry {
  hash: string;
  name: string;
  failed: boolean;
  error?: string;
  save_path?: string;
  category?: string;
  tags?: string[];
  up_limit?: number;
  dl_limit?: number;
  auto_tmm?: boolean;
  ratio_limit?: number;
  seeding_time_limit?: number;
  inactive_seeding_time_limit?: number;
  super_seeding?: boolean;
  sequential_download?: boolean;
  first_last_piece_prio?: boolean;
  magnet_link?: string;
  state?: string;
  files?: BbeTorrentFile[];
}

export interface BbeMetadata {
  version: number;
  exported_at: number;
  source_server: string;
  source_server_name?: string;
  export_mode: ExportMode;
  torrents: BbeTorrentEntry[];
  categories?: Record<string, { name: string; savePath: string }>;
  tags?: string[];
}

export interface BbePathMapping {
  from: string;
  to: string;
}

export interface BbeServerInfo {
  webapiVersion: string;
  qbVersion: string;
  isFullMode: boolean;
}

export interface ImportStartPayload {
  serverId: string;
  bbePath: string;
  restoreFields: ImportRestoreField[];
  startMode: ImportStartMode;
  pathMappings: BbePathMapping[];
  restoreCategories: boolean;
  restoreTags: boolean;
  categoryPathMappings: BbePathMapping[];
  overwriteCategories: boolean;
  skipHashes: string[];
}

export interface BitButlerAPI {
  electron: {
    isDev(): Promise<boolean>;
    openExternalUrl(url: string): Promise<void>;
    showOpenDialog(defaultPath?: string): Promise<string>;
    openPath(path: string): Promise<string>;
    showItemInFolder(path: string): Promise<void>;
    getPlatform(): Promise<HostPlatform>;
    checkForUpdate(): Promise<UpdateCheckResponse>;
    setLoginItem(settings: { openAtLogin: boolean }): Promise<void>;
    getDownloadsPath(): Promise<string>;
  };

  updater: {
    getCapability(): Promise<UpdateCapability>;
    updateNow(): Promise<void>;
    onEvent(callback: (event: UpdaterEvent) => void): () => void;
  };

  server: {
    list(): Promise<ServerRecord[]>;
    add(server: NewServer): Promise<{ id: string }>;
    update(payload: { id: string; changes: Partial<NewServer> }): Promise<{ updated: boolean }>;
    delete(payload: { id: string }): Promise<{ deleted: boolean }>;
    getById(payload: { id: string }): Promise<ServerRecord | null>;
    getByHost(payload: { host: string }): Promise<ServerRecord | null>;
    setConnectionInfo(payload: {
      id: string;
      exportAvailable: 0 | 1;
      webapiVersion: string;
      qbVersion: string;
    }): Promise<{ updated: boolean }>;
    setActive(id: string | null): void;
  };

  qb: {
    login(payload: BitButlerQbLoginPayload): Promise<{ loggedIn: boolean }>;
    logout(payload: BitButlerServerIdPayload): Promise<{ loggedOut: boolean }>;
    hasCookie(payload: BitButlerServerIdPayload): Promise<{ hasCookie: boolean }>;
    request<TResponse = unknown, TBody = unknown>(
      payload: BitButlerQbRequest<TBody>,
    ): Promise<TResponse>;
    torrentsAdd(payload: BitButlerQbTorrentsAddPayload): Promise<unknown>;
    startSyncStream(payload: BitButlerSyncStreamPayload): void;
    onSyncChunk(callback: (payload: BitButlerSyncStreamResponse) => void): () => void;
  };

  window: {
    maximize(): Promise<void>;
    unmaximize(): Promise<void>;
    toggleMaximize(): Promise<void>;
    setSize(width: number, height: number): Promise<void>;
    onStateChange: (handler: (payload: WindowState) => void) => () => void;
    setOpenFilesEnabled(enabled: boolean): Promise<{ enabled: boolean }>;
    onOpenFiles(callback: (paths: string[]) => void): () => void;
    drainOpenFiles(): Promise<string[]>;
    onTorrentDrafts(callback: (drafts: TorrentDraft[]) => void): () => void;
    drainOpenTorrents(): Promise<TorrentDraft[]>;
    onOpenBbe(callback: (path: string) => void): () => void;
    drainOpenBbe(): Promise<string[]>;
    simulateOpenFiles(path: string[]): Promise<TorrentDraft[]>;
  };

  torrent: {
    parse(payload: TorrentParsePayload): Promise<TorrentDraft>;
    deleteFile(payload: { path: string }): Promise<{ ok: boolean; error?: string }>;
    scanFolder(payload: {
      path: string;
      recursive: boolean;
    }): Promise<{ path: string; relativePath: string }[]>;
  };

  menu: {
    onClick: (handler: (payload: MenuClickPayload) => void) => () => void;
  };

  notification: {
    show(payload: {
      title: string;
      body?: string;
      options?: { silent?: boolean };
    }): Promise<{ ok: boolean; shown?: boolean; error?: string }>;
  };

  settings: {
    get(payload: { id: string }): Promise<unknown>;
    upsert(payload: { id: string; value: unknown }): Promise<{ ok: true }>;
    delete(payload: { id: string }): Promise<{ ok: true }>;
  };

  i18n: {
    languageChanged(lang: string): void;
  };

  export: {
    start(payload: ExportStartPayload): void;
    cancel(): void;
    openBbePicker(): Promise<string | undefined>;
    readBbe(payload: { path: string }): Promise<BbeMetadata>;
    getServerInfo(serverId: string): Promise<BbeServerInfo>;
    saveTorrentFiles(payload: {
      serverId: string;
      items: ExportTorrentFileItem[];
    }): Promise<ExportTorrentFilesResult>;
    importStart(payload: ImportStartPayload): void;
    importCancel(): void;
    onProgress(cb: (e: ExportProgressEvent) => void): () => void;
    onDone(cb: (e: ExportDoneEvent) => void): () => void;
    onError(cb: (e: { message: string }) => void): () => void;
    onImportProgress(cb: (e: ImportProgressEvent) => void): () => void;
    onImportDone(
      cb: (e: { total: number; failed: number; alreadyExisted: number }) => void,
    ): () => void;
    onImportError(cb: (e: { message: string }) => void): () => void;
  };
}
