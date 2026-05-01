import type { HostPlatform, UpdateCheckResponse } from './models/electron.model.js';
import type { NewServer, ServerRecord } from './models/server.model.js';
import type { TorrentDraft, TorrentDraftSource } from './models/torrent-draft.model.js';
import type { WindowState } from './models/window.model.js';

export type BitButlerServerIdPayload = { id: string };

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

export interface BitButlerAPI {
  electron: {
    isDev(): Promise<boolean>;
    openExternalUrl(url: string): Promise<void>;
    showOpenDialog(): Promise<string>;
    openPath(path: string): Promise<string>;
    showItemInFolder(path: string): Promise<void>;
    getPlatform(): Promise<HostPlatform>;
    checkForUpdate(): Promise<UpdateCheckResponse>;
  };

  server: {
    list(): Promise<ServerRecord[]>;
    add(server: NewServer): Promise<{ id: string }>;
    update(payload: { id: string; changes: Partial<NewServer> }): Promise<{ updated: boolean }>;
    delete(payload: { id: string }): Promise<{ deleted: boolean }>;
    getById(payload: { id: string }): Promise<ServerRecord | null>;
    getByHost(payload: { host: string }): Promise<ServerRecord | null>;
    setActive(id: string | null): void;
  };

  qb: {
    login(payload: BitButlerServerIdPayload): Promise<{ loggedIn: boolean }>;
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
    simulateOpenFiles(path: string[]): Promise<TorrentDraft[]>;
  };

  torrent: {
    parse(payload: TorrentParsePayload): Promise<TorrentDraft>;
    deleteFile(payload: { path: string }): Promise<{ ok: boolean; error?: string }>;
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
}
