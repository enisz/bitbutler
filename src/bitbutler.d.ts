export {};

import { NewServer, ServerRecord } from './app/models/server.model';
import { TorrentDraft } from './app/models/torrent-draft.model';
import { HostPlatform, UpdateCheckResponse } from './app/services/electron.service';
import { WindowState } from './app/services/window.service';

declare global {
  type BitButlerServerIdPayload = { id: string };

  type BitButlerHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  type BitButlerQbTorrentsAddPayload = {
    id: string;
    torrents: SelectedTorrentInput[];
    options?: Record<string, unknown>;
  };

  interface BitButlerQbRequest<TBody = unknown> {
    id: string;
    path: string;
    method?: BitButlerHttpMethod;
    query?: Record<string, string | number | boolean>;
    body?: TBody;
    headers?: Record<string, string>;
  }

  interface BitButlerSyncStreamPayload {
    id: string;
    rid?: number;
    chunkSize?: number;
    delayMs?: number;
    sortBy?: string;
    sortDesc?: boolean;
  }

  type BitButlerSyncStreamResponse =
    | { type: 'metadata'; data: any; total: number }
    | { type: 'chunk'; data: Record<string, any>; progress: number; total: number }
    | { type: 'done' }
    | { type: 'error'; error: string };

  interface BitButlerAPI {
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
      parse(payload: TorrentParsePayload): Promise<any>;
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
      get(payload: { id: string }): Promise<any | null>;
      upsert(payload: { id: string; value: any }): Promise<{ ok: true }>;
      delete(payload: { id: string }): Promise<{ ok: true }>;
    };
  }

  interface Window {
    bitbutler: BitButlerAPI;
  }
}
