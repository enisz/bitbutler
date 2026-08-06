import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subscriber } from 'rxjs';
import { HttpError } from '../models/http.model';
import {
  QbAppPreferences,
  QbLogEntry,
  QbLogPeerEntry,
  QbResponse,
  QbSetAppPreferences,
  QbTorrentProperties,
  QbTorrentTracker,
} from '../models/qbittorrent.model';
import {
  Maindata,
  QbCategory,
  QbTorrentContent,
  QbTorrentPeersResponse,
  Torrent,
} from '../models/torrent.model';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

type QbLoginResponse = { loggedIn: boolean };
type QbHasCookieResponse = { hasCookie: boolean };
type TorrentRunApi = 'START_STOP' | 'PAUSE_RESUME';

type QbRequestArgs = {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  form?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
};

export type StreamMaindataState = {
  maindata: Maindata | null;
  progress: number;
  total: number;
  done: boolean;
};

@Injectable({ providedIn: 'root' })
export class QbService {
  private readonly toastService = inject(ToastService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private readonly runApiCache = new Map<string, TorrentRunApi>();

  readonly auth = {
    login: (serverId: string, username?: string, password?: string): Promise<QbLoginResponse> => {
      this.clearRunApiCache(serverId);
      return window.bitbutler.qb.login({ id: serverId, username, password });
    },

    logout: (serverId: string): Promise<{ loggedOut: boolean }> => {
      this.clearRunApiCache(serverId);
      return window.bitbutler.qb.logout({ id: serverId });
    },

    hasCookie: async (serverId: string): Promise<boolean> => {
      const res: QbHasCookieResponse = await window.bitbutler.qb.hasCookie({ id: serverId });
      return res.hasCookie;
    },
  };

  readonly app = {
    preferences: async (serverId: string): Promise<QbAppPreferences> => {
      const res = await this.request<QbAppPreferences>(serverId, {
        path: '/api/v2/app/preferences',
        method: 'GET',
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get application preferences`);
    },

    setPreferences: async (serverId: string, prefs: QbSetAppPreferences): Promise<void> => {
      const res = await this.request<void>(serverId, {
        path: '/api/v2/app/setPreferences',
        method: 'POST',
        form: { json: JSON.stringify(prefs) },
      });
      if (!res.ok)
        throw new HttpError(res.status, res.statusText, `Failed to set application preferences`);
    },
  };

  readonly log = {
    main: async (
      serverId: string,
      options: {
        normal?: boolean;
        info?: boolean;
        warning?: boolean;
        critical?: boolean;
        last_known_id?: number;
      } = {},
    ): Promise<QbLogEntry[]> => {
      const res = await this.request<QbLogEntry[]>(serverId, {
        path: '/api/v2/log/main',
        method: 'GET',
        query: { ...options },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get main log`);
    },

    peers: async (
      serverId: string,
      options: { last_known_id?: number } = {},
    ): Promise<QbLogPeerEntry[]> => {
      const res = await this.request<QbLogPeerEntry[]>(serverId, {
        path: '/api/v2/log/peers',
        method: 'GET',
        query: { ...options },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get peer log`);
    },
  };

  readonly sync = {
    maindata: async (serverId: string, rid: number): Promise<Maindata> => {
      const res = await this.request<Maindata>(serverId, {
        path: '/api/v2/sync/maindata',
        method: 'GET',
        query: { rid },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get maindata`);
    },

    streamMaindata: (
      serverId: string,
      rid: number = 0,
      sortBy?: string,
      sortDesc?: boolean,
    ): Observable<StreamMaindataState> => {
      return new Observable((subscriber: Subscriber<StreamMaindataState>) => {
        let totalCount = 0;
        let progressCount = 0;

        const unsubscribe = window.bitbutler.qb.onSyncChunk((payload) => {
          if (payload.type === 'error') {
            subscriber.error(new Error(payload.error));
            return;
          }

          if (payload.type === 'metadata') {
            totalCount = payload.total;
            const metaChunk = { ...payload.data, _isStreamingChunk: true } as unknown as Maindata;
            subscriber.next({ maindata: metaChunk, progress: 0, total: totalCount, done: false });
          }

          if (payload.type === 'chunk') {
            progressCount = payload.progress;
            const deltaChunk = {
              torrents: payload.data,
              _isStreamingChunk: true,
            } as unknown as Maindata;
            subscriber.next({
              maindata: deltaChunk,
              progress: progressCount,
              total: totalCount,
              done: false,
            });
          }

          if (payload.type === 'done') {
            const finalChunk = { _isStreamingChunk: false } as unknown as Maindata;
            subscriber.next({
              maindata: finalChunk,
              progress: totalCount,
              total: totalCount,
              done: true,
            });
          }
        });

        window.bitbutler.qb.startSyncStream({ id: serverId, rid, sortBy, sortDesc });
        return () => unsubscribe();
      });
    },

    torrentPeers: async (
      serverId: string,
      hash: string,
      rid = 0,
    ): Promise<QbTorrentPeersResponse> => {
      const res = await this.request<QbTorrentPeersResponse>(serverId, {
        path: '/api/v2/sync/torrentPeers',
        method: 'GET',
        query: { hash, rid },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get torrent peers`);
    },
  };

  readonly torrents = {
    properties: async (serverId: string, hash: string): Promise<QbTorrentProperties> => {
      const cleanHash = (hash ?? '').trim();
      if (!cleanHash) return Promise.reject(new Error('hash is required'));
      const res = await this.request<QbTorrentProperties>(serverId, {
        path: '/api/v2/torrents/properties',
        method: 'GET',
        query: { hash: cleanHash },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get torrent properties`);
    },

    info: async (serverId: string, hash: string): Promise<Torrent | null> => {
      const cleanHash = (hash ?? '').trim();
      if (!cleanHash) return Promise.reject(new Error('hash is required'));
      const res = await this.request<Torrent[]>(serverId, {
        path: '/api/v2/torrents/info',
        method: 'GET',
        query: { hashes: cleanHash },
      });
      if (res.ok) return res.body[0] ?? null;
      throw new HttpError(res.status, res.statusText, `Failed to get torrent info`);
    },

    trackers: async (serverId: string, hash: string): Promise<QbTorrentTracker[]> => {
      const cleanHash = (hash ?? '').trim();
      if (!cleanHash) return Promise.reject(new Error('hash is required'));
      const res = await this.request<QbTorrentTracker[]>(serverId, {
        path: '/api/v2/torrents/trackers',
        method: 'GET',
        query: { hash: cleanHash },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get torrent trackers`);
    },

    files: async (
      serverId: string,
      hash: string,
      options?: { suppressErrors?: boolean },
    ): Promise<QbTorrentContent[]> => {
      const res = await this.request<QbTorrentContent[]>(
        serverId,
        { path: '/api/v2/torrents/files', method: 'GET', query: { hash } },
        options,
      );
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get torrent contents`);
    },

    setLocation: async (serverId: string, hashes: string[], location: string): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      const loc = (location ?? '').trim();
      if (clean.length === 0) return Promise.reject(new Error('No hashes provided'));
      if (!loc) return Promise.reject(new Error('location is required'));
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/setLocation',
        method: 'POST',
        form: { hashes: clean.join('|'), location: loc },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to set torrent location`);
    },

    rename: async (serverId: string, hash: string, name: string): Promise<void> => {
      const h = (hash ?? '').trim();
      const n = (name ?? '').trim();
      if (!h) return Promise.reject(new Error('hash is required'));
      if (!n) return Promise.reject(new Error('name is required'));
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/rename',
        method: 'POST',
        form: { hash: h, name: n },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to rename torrent`);
    },

    renameFile: async (
      serverId: string,
      hash: string,
      oldPath: string,
      newPath: string,
    ): Promise<void> => {
      const h = (hash ?? '').trim();
      const oldP = (oldPath ?? '').trim();
      const newP = (newPath ?? '').trim();
      if (!h || !oldP || !newP)
        return Promise.reject(new Error('hash, oldPath and newPath are required'));
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/renameFile',
        method: 'POST',
        form: { hash: h, oldPath: oldP, newPath: newP },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to rename torrent file`);
    },

    renameFolder: async (
      serverId: string,
      hash: string,
      oldPath: string,
      newPath: string,
    ): Promise<void> => {
      const h = (hash ?? '').trim();
      const oldP = (oldPath ?? '').trim();
      const newP = (newPath ?? '').trim();
      if (!h || !oldP || !newP)
        return Promise.reject(new Error('hash, oldPath and newPath are required'));
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/renameFolder',
        method: 'POST',
        form: { hash: h, oldPath: oldP, newPath: newP },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to rename torrent folder`);
    },

    filePrio: async (
      serverId: string,
      hash: string,
      ids: number[],
      priority: number,
    ): Promise<void> => {
      const h = (hash ?? '').trim();
      const clean = ids ?? [];
      if (!h) return Promise.reject(new Error('hash is required'));
      if (clean.length === 0) return Promise.reject(new Error('ids are required'));
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/filePrio',
        method: 'POST',
        form: { hash: h, id: clean.join('|'), priority: String(priority) },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to set file priority`);
    },

    increasePrio: async (serverId: string, hashes: string[]): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/increasePrio',
        method: 'POST',
        form: { hashes: clean.join('|') },
      });
      if (!res.ok)
        throw new HttpError(res.status, res.statusText, `Failed to increase torrent priority`);
    },

    decreasePrio: async (serverId: string, hashes: string[]): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/decreasePrio',
        method: 'POST',
        form: { hashes: clean.join('|') },
      });
      if (!res.ok)
        throw new HttpError(res.status, res.statusText, `Failed to decrease torrent priority`);
    },

    topPrio: async (serverId: string, hashes: string[]): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/topPrio',
        method: 'POST',
        form: { hashes: clean.join('|') },
      });
      if (!res.ok)
        throw new HttpError(res.status, res.statusText, `Failed to move torrent to top of queue`);
    },

    bottomPrio: async (serverId: string, hashes: string[]): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/bottomPrio',
        method: 'POST',
        form: { hashes: clean.join('|') },
      });
      if (!res.ok)
        throw new HttpError(
          res.status,
          res.statusText,
          `Failed to move torrent to bottom of queue`,
        );
    },

    delete: async (serverId: string, hashes: string[], deleteFiles: boolean): Promise<string> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return Promise.reject(new Error('No hashes to delete'));
      const res = await this.request<string>(serverId, {
        path: '/api/v2/torrents/delete',
        method: 'POST',
        form: { hashes: clean.join('|'), deleteFiles: deleteFiles ? 'true' : 'false' },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to delete torrents`);
    },

    recheck: async (serverId: string, hashes: string[]): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/recheck',
        method: 'POST',
        form: { hashes: clean.join('|') },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to recheck torrents`);
    },

    reannounce: async (serverId: string, hashes: string[]): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/reannounce',
        method: 'POST',
        form: { hashes: clean.join('|') },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to reannounce torrents`);
    },

    pause: (serverId: string, hashes: string[] | 'all'): Promise<void> => {
      return this.runTorrents(serverId, 'pause', hashes);
    },

    resume: (serverId: string, hashes: string[] | 'all'): Promise<void> => {
      return this.runTorrents(serverId, 'resume', hashes);
    },

    setForceStart: async (serverId: string, hashes: string[], value: boolean): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/setForceStart',
        method: 'POST',
        form: { hashes: clean.join('|'), value },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set force start`);
    },

    setSuperSeeding: async (serverId: string, hashes: string[], value: boolean): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/setSuperSeeding',
        method: 'POST',
        form: { hashes: clean.join('|'), value },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set super seeding`);
    },

    setAutoManagement: async (
      serverId: string,
      hashes: string[],
      enable: boolean,
    ): Promise<void> => {
      const cleanHashes = this.cleanHashList(hashes);
      if (cleanHashes.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/setAutoManagement',
        method: 'POST',
        form: { hashes: cleanHashes.join('|'), enable },
      });
      if (!res.ok)
        throw new HttpError(
          res.status,
          res.statusText,
          `Failed to set automatic torrent management`,
        );
    },

    addTags: async (serverId: string, hashes: string[], tags: string[]): Promise<void> => {
      const cleanHashes = this.cleanHashList(hashes);
      if (cleanHashes.length === 0) return;
      const cleanTags = (tags ?? []).map((t) => (t ?? '').trim()).filter(Boolean);
      if (cleanTags.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/addTags',
        method: 'POST',
        form: { hashes: cleanHashes.join('|'), tags: cleanTags.join(',') },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to add tags`);
    },

    removeTags: async (serverId: string, hashes: string[], tags: string[]): Promise<void> => {
      const cleanHashes = this.cleanHashList(hashes);
      if (cleanHashes.length === 0) return;
      const cleanTags = (tags ?? []).map((t) => (t ?? '').trim()).filter(Boolean);
      if (cleanTags.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/removeTags',
        method: 'POST',
        form: { hashes: cleanHashes.join('|'), tags: cleanTags.join(',') },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to remove tags`);
    },

    tags: async (serverId: string): Promise<string[]> => {
      const res = await this.request<string[]>(serverId, {
        path: '/api/v2/torrents/tags',
        method: 'GET',
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get all tags`);
    },

    createTags: async (serverId: string, tags: string[]): Promise<void> => {
      const cleanTags = (tags ?? []).map((t) => (t ?? '').trim()).filter(Boolean);
      if (cleanTags.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/createTags',
        method: 'POST',
        form: { tags: cleanTags.join(',') },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to create tags`);
    },

    deleteTags: async (serverId: string, tags: string[]): Promise<void> => {
      const cleanTags = (tags ?? []).map((t) => (t ?? '').trim()).filter(Boolean);
      if (cleanTags.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/deleteTags',
        method: 'POST',
        form: { tags: cleanTags.join(',') },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to delete tags`);
    },

    setCategory: async (serverId: string, hashes: string[], category: string): Promise<void> => {
      const cleanHashes = this.cleanHashList(hashes);
      if (cleanHashes.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/setCategory',
        method: 'POST',
        form: { hashes: cleanHashes.join('|'), category },
      });
      if (!res.ok)
        throw new HttpError(res.status, res.statusText, `Failed to set torrent category`);
    },

    clearCategory: async (serverId: string, hashes: string[]): Promise<void> => {
      const cleanHashes = this.cleanHashList(hashes);
      if (cleanHashes.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/setCategory',
        method: 'POST',
        form: { hashes: cleanHashes.join('|'), category: '' },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to clear category`);
    },

    categories: async (serverId: string): Promise<Record<string, QbCategory>> => {
      const res = await this.request<Record<string, QbCategory>>(serverId, {
        path: '/api/v2/torrents/categories',
        method: 'GET',
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get all categories`);
    },

    createCategory: async (serverId: string, category: string, savePath: string): Promise<void> => {
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/createCategory',
        method: 'POST',
        form: { category, savePath },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to add category`);
    },

    editCategory: async (serverId: string, category: string, savePath: string): Promise<void> => {
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/editCategory',
        method: 'POST',
        form: { category, savePath },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to edit category`);
    },

    removeCategories: async (serverId: string, categories: string[]): Promise<void> => {
      const cleanCategories = (categories ?? []).map((c) => (c ?? '').trim()).filter(Boolean);
      if (cleanCategories.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/removeCategories',
        method: 'POST',
        form: { categories: cleanCategories.join('|') },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to remove categories`);
    },

    setShareLimits: async (
      serverId: string,
      hashes: string[],
      ratioLimit: number,
      seedingTimeLimit: number,
      inactiveSeedingTimeLimit: number,
    ): Promise<void> => {
      const cleanHashes = this.cleanHashList(hashes);
      if (cleanHashes.length === 0) return Promise.reject(new Error('No hashes provided'));
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/setShareLimits',
        method: 'POST',
        form: {
          hashes: cleanHashes.join('|'),
          ratioLimit,
          seedingTimeLimit,
          inactiveSeedingTimeLimit,
        },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set share limits`);
    },

    downloadLimit: async (serverId: string, hashes: string[]): Promise<Record<string, number>> => {
      const cleanHashes = this.cleanHashList(hashes);
      const res = await this.request<Record<string, number>>(serverId, {
        path: '/api/v2/torrents/downloadLimit',
        method: 'GET',
        query: { hashes: cleanHashes.join('|') },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get download limit`);
    },

    setDownloadLimit: async (serverId: string, limit: number, hashes: string[]): Promise<void> => {
      const cleanHashes = this.cleanHashList(hashes);
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/setDownloadLimit',
        method: 'POST',
        form: { limit, hashes: cleanHashes.join('|') },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set download limit`);
    },

    uploadLimit: async (serverId: string, hashes: string[]): Promise<Record<string, number>> => {
      const cleanHashes = this.cleanHashList(hashes);
      const res = await this.request<Record<string, number>>(serverId, {
        path: '/api/v2/torrents/uploadLimit',
        method: 'GET',
        query: { hashes: cleanHashes.join('|') },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get upload limit`);
    },

    setUploadLimit: async (serverId: string, limit: number, hashes: string[]): Promise<void> => {
      const cleanHashes = this.cleanHashList(hashes);
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/setUploadLimit',
        method: 'POST',
        form: { limit, hashes: cleanHashes.join('|') },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set upload limit`);
    },

    setDownloadPath: async (serverId: string, hashes: string[], path: string): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      const p = (path ?? '').trim();
      if (clean.length === 0) return Promise.reject(new Error('No hashes provided'));
      if (!p) return Promise.reject(new Error('path is required'));
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/setDownloadPath',
        method: 'POST',
        form: { hashes: clean.join('|'), path: p },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set download path`);
    },

    toggleSequentialDownload: async (serverId: string, hashes: string[]): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/toggleSequentialDownload',
        method: 'POST',
        form: { hashes: clean.join('|') },
      });
      if (!res.ok)
        throw new HttpError(res.status, res.statusText, `Failed to toggle sequential download`);
    },

    toggleFirstLastPiecePrio: async (serverId: string, hashes: string[]): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/toggleFirstLastPiecePrio',
        method: 'POST',
        form: { hashes: clean.join('|') },
      });
      if (!res.ok)
        throw new HttpError(
          res.status,
          res.statusText,
          `Failed to toggle first/last piece priority`,
        );
    },

    removeAllTags: async (serverId: string, hashes: string[]): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/removeTags',
        method: 'POST',
        form: { hashes: clean.join('|') },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to remove all tags`);
    },
  };

  readonly transfer = {
    downloadLimit: async (serverId: string): Promise<number> => {
      const res = await this.request<number>(serverId, {
        path: '/api/v2/transfer/downloadLimit',
        method: 'GET',
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get download limit`);
    },

    setDownloadLimit: async (serverId: string, limit: number): Promise<void> => {
      const res = await this.request<void>(serverId, {
        path: '/api/v2/transfer/setDownloadLimit',
        method: 'POST',
        form: { limit },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set download limit`);
    },

    uploadLimit: async (serverId: string): Promise<number> => {
      const res = await this.request<number>(serverId, {
        path: '/api/v2/transfer/uploadLimit',
        method: 'GET',
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get upload limit`);
    },

    setUploadLimit: async (serverId: string, limit: number): Promise<void> => {
      const res = await this.request<void>(serverId, {
        path: '/api/v2/transfer/setUploadLimit',
        method: 'POST',
        form: { limit },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set upload limit`);
    },

    speedLimitsMode: async (serverId: string): Promise<boolean> => {
      const res = await this.request<number>(serverId, {
        path: '/api/v2/transfer/speedLimitsMode',
        method: 'GET',
      });
      if (res.ok) return Number(res.body) === 1;
      throw new HttpError(
        res.status,
        res.statusText,
        `Failed to get alternative speed limit state`,
      );
    },

    toggleSpeedLimitsMode: async (serverId: string): Promise<void> => {
      const res = await this.request<void>(serverId, {
        path: '/api/v2/transfer/toggleSpeedLimitsMode',
        method: 'POST',
      });
      if (!res.ok)
        throw new HttpError(res.status, res.statusText, `Failed to toggle alternative speed limit`);
    },
  };

  drainOpenFiles(): Promise<string[]> {
    return window.bitbutler.window.drainOpenFiles();
  }

  async request<T>(
    serverId: string,
    req: Omit<QbRequestArgs, 'id'>,
    options?: { suppressErrors?: boolean },
  ): Promise<QbResponse<T>> {
    const fullReq: QbRequestArgs = { id: serverId, ...req };
    const maxRetries = 3;
    let attempt = 0;

    while (true) {
      try {
        const body = await (window.bitbutler.qb.request(fullReq) as Promise<T>);
        return { ok: true, status: 200, statusText: 'OK', body };
      } catch (err: any) {
        const errJson = this.extractJson(err);
        const ipcStatus = this.extractIpcStatus(err);

        const isUnrecoverableClientError =
          ipcStatus &&
          ipcStatus >= 400 &&
          ipcStatus < 500 &&
          ipcStatus !== 401 &&
          ipcStatus !== 403 &&
          ipcStatus !== 408 &&
          ipcStatus !== 429;

        if (attempt < maxRetries && !isUnrecoverableClientError) {
          attempt++;

          if (ipcStatus === 403 || ipcStatus === 401) {
            console.error(
              QbService.name,
              'request',
              `Auth error (${ipcStatus}). Attempting to re-login... (${attempt}/${maxRetries})`,
            );
            try {
              await this.auth.login(serverId);
            } catch (loginErr) {
              console.error(QbService.name, 'request', 'Re-login attempt failed', loginErr);
            }
          } else {
            if (!options?.suppressErrors) {
              this.toastService.warning(
                this.translateService.instant('services.qb.warning.connection-retry-message'),
                this.translateService.instant('services.qb.warning.connection-retry-title'),
              );
            }
            console.error(
              QbService.name,
              'request',
              `Request failed, retrying (${attempt}/${maxRetries})...`,
              fullReq.method,
              fullReq.path,
            );
          }

          await new Promise((res) => setTimeout(res, 1000 * attempt));
          continue;
        }

        if (ipcStatus === 403 || ipcStatus === 401) {
          console.error(`[QbService] ${ipcStatus} error persists. Logging out...`);
          await this.forceLogout(serverId);
        }

        if (!options?.suppressErrors) {
          const message = errJson?.body ? String(errJson.body) : err?.message || String(err);
          this.toastService.danger(
            message,
            this.translateService.instant('services.qb.error.request-failed-title'),
          );
          console.error('[QbService] ERROR', fullReq.method, fullReq.path, {
            serverId,
            status: ipcStatus,
            error: err,
            json: errJson,
          });
        }

        if (ipcStatus) {
          if (errJson) {
            return {
              ok: false,
              status: errJson.status,
              statusText: errJson.statusText,
              body: errJson.body,
              path: errJson.path,
            };
          }
        }

        throw err;
      }
    }
  }

  private async forceLogout(serverId: string): Promise<void> {
    try {
      await window.bitbutler.window.setOpenFilesEnabled(false);
    } catch {}
    try {
      await this.auth.logout(serverId);
    } catch {}
    try {
      this.serverStoreService.suppressAutoLoginUntilManualConnect();
      this.serverStoreService.clearSelection();
    } catch {}

    this.router.navigate(['/login']);
  }

  private async runTorrents(
    serverId: string,
    action: 'pause' | 'resume',
    hashes: string[] | 'all',
  ): Promise<void> {
    const hashesParam = hashes === 'all' ? 'all' : this.cleanHashList(hashes).join('|');
    if (hashesParam.length === 0) return;

    const form = { hashes: hashesParam };
    const cached = this.runApiCache.get(serverId);

    if (cached) {
      await this.callRunEndpoint(serverId, cached, action, form);
      return;
    }

    const candidates: TorrentRunApi[] = ['PAUSE_RESUME', 'START_STOP'];
    let lastErr: any;

    for (const api of candidates) {
      try {
        await this.callRunEndpoint(serverId, api, action, form, { suppressErrors: true });
        this.runApiCache.set(serverId, api);
        return;
      } catch (e: any) {
        lastErr = e;
      }
    }

    throw lastErr ?? new Error('No compatible start/stop endpoints found');
  }

  private async callRunEndpoint(
    serverId: string,
    api: TorrentRunApi,
    action: 'pause' | 'resume',
    form: Record<string, string>,
    options?: { suppressErrors?: boolean },
  ): Promise<void> {
    const path =
      api === 'START_STOP'
        ? action === 'pause'
          ? '/api/v2/torrents/stop'
          : '/api/v2/torrents/start'
        : action === 'pause'
          ? '/api/v2/torrents/pause'
          : '/api/v2/torrents/resume';

    const res = await this.request<string>(serverId, { path, method: 'POST', form }, options);

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to ${action} torrents`);
  }

  private clearRunApiCache(serverId: string): void {
    this.runApiCache.delete(serverId);
  }

  private cleanHashList(hashes: string[] | undefined): string[] {
    return (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
  }

  private extractIpcStatus(err: any): number | null {
    const direct = Number(err?.status);
    if (Number.isFinite(direct)) return direct;

    const msg = String(err?.message ?? '');
    const idx = msg.indexOf('{');
    if (idx === -1) return null;

    try {
      const json = JSON.parse(msg.slice(idx));
      const status = Number(json?.status);
      return Number.isFinite(status) ? status : null;
    } catch {
      return null;
    }
  }

  private extractJson(err: any): any {
    const msg = String(err?.message ?? '');
    const idx = msg.indexOf('{');
    if (idx === -1) return null;

    try {
      return JSON.parse(msg.slice(idx));
    } catch {
      return null;
    }
  }
}
