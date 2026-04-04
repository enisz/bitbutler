import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscriber } from 'rxjs';
import { HttpError } from '../models/http.model';
import {
  QbAppPreferences,
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
} from '../models/torrent.model';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

type ServerIdPayload = { id: string };

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
  private readonly runApiCache = new Map<string, TorrentRunApi>();

  login(serverId: string): Promise<QbLoginResponse> {
    this.clearRunApiCache(serverId);
    return window.bitbutler.qb.login({ id: serverId } satisfies ServerIdPayload);
  }

  logout(serverId: string): Promise<{ loggedOut: boolean }> {
    this.clearRunApiCache(serverId);
    return window.bitbutler.qb.logout({ id: serverId } satisfies ServerIdPayload);
  }

  streamMaindata(
    serverId: string,
    rid: number = 0,
    sortBy?: string,
    sortDesc?: boolean,
  ): Observable<StreamMaindataState> {
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

          const metaChunk = { ...payload.data, _isStreamingChunk: true } as Maindata;
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
  }

  async getAppPreferences(serverId: string): Promise<QbAppPreferences> {
    const res = await this.request<QbAppPreferences>(serverId, {
      path: '/api/v2/app/preferences',
      method: 'GET',
    });

    if (res.ok) return res.body;
    throw new HttpError(res.status, res.statusText, `Failed to get application preferences`);
  }

  async setAppPreferences(serverId: string, prefs: QbSetAppPreferences): Promise<void> {
    const res = await this.request<void>(serverId, {
      path: '/api/v2/app/setPreferences',
      method: 'POST',
      form: { json: JSON.stringify(prefs) },
    });

    if (!res.ok)
      throw new HttpError(res.status, res.statusText, `Failed to set application preferences`);
  }

  async hasCookie(serverId: string): Promise<boolean> {
    const res: QbHasCookieResponse = await window.bitbutler.qb.hasCookie({
      id: serverId,
    } satisfies ServerIdPayload);
    return res.hasCookie;
  }

  async maindata(serverId: string, rid: number): Promise<Maindata> {
    const res = await this.request<Maindata>(serverId, {
      path: '/api/v2/sync/maindata',
      method: 'GET',
      query: { rid },
    });

    if (res.ok) return res.body;
    throw new HttpError(res.status, res.statusText, `Failed to get maindata`);
  }

  async torrentProperties(serverId: string, hash: string): Promise<QbTorrentProperties> {
    const cleanHash = (hash ?? '').trim();
    if (!cleanHash) return Promise.reject(new Error('hash is required'));

    const res = await this.request<QbTorrentProperties>(serverId, {
      path: '/api/v2/torrents/properties',
      method: 'GET',
      query: { hash: cleanHash },
    });

    if (res.ok) return res.body;
    throw new HttpError(res.status, res.statusText, `Failed to get torrent properties`);
  }

  async torrentTrackers(serverId: string, hash: string): Promise<QbTorrentTracker[]> {
    const cleanHash = (hash ?? '').trim();
    if (!cleanHash) return Promise.reject(new Error('hash is required'));

    const res = await this.request<QbTorrentTracker[]>(serverId, {
      path: '/api/v2/torrents/trackers',
      method: 'GET',
      query: { hash: cleanHash },
    });

    if (res.ok) return res.body;
    throw new HttpError(res.status, res.statusText, `Failed to get torrent trackers`);
  }

  async torrentPeers(serverId: string, hash: string, rid = 0): Promise<QbTorrentPeersResponse> {
    const res = await this.request<QbTorrentPeersResponse>(serverId, {
      path: '/api/v2/sync/torrentPeers',
      method: 'GET',
      query: { hash, rid },
    });

    if (res.ok) return res.body;
    throw new HttpError(res.status, res.statusText, `Failed to get torrent peers`);
  }

  async torrentContents(
    serverId: string,
    hash: string,
    options?: { suppressErrors?: boolean },
  ): Promise<QbTorrentContent[]> {
    const res = await this.request<QbTorrentContent[]>(
      serverId,
      {
        path: '/api/v2/torrents/files',
        method: 'GET',
        query: { hash },
      },
      options,
    );

    if (res.ok) return res.body;
    throw new HttpError(res.status, res.statusText, `Failed to get torrent contents`);
  }

  async setTorrentLocation(serverId: string, hashes: string[], location: string): Promise<void> {
    const clean = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
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
  }

  async renameTorrent(serverId: string, hash: string, name: string): Promise<void> {
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
        console.log('[QbService] ←', fullReq.method, fullReq.path, body);
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
            console.warn(
              `[QbService] Auth error (${ipcStatus}). Attempting to re-login... (${attempt}/${maxRetries})`,
            );
            try {
              await this.login(serverId);
            } catch (loginErr) {
              console.error('[QbService] Re-login attempt failed', loginErr);
            }
          } else {
            if (!options?.suppressErrors) {
              this.toastService.danger('Failed to connect. Retrying...', `[QbService] WARNING`);
            }
            console.warn(
              `[QbService] Request failed, retrying (${attempt}/${maxRetries})...`,
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
          console.log('[QbService] ERROR');
          const message = errJson?.body ? String(errJson.body) : err?.message || String(err);
          this.toastService.danger(message, `[QbService] ERROR`);
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
      await this.logout(serverId);
    } catch {}
    try {
      this.serverStoreService.suppressAutoLoginUntilManualConnect();
      this.serverStoreService.clearSelection();
    } catch {}

    this.router.navigate(['/login']);
  }

  drainOpenFiles(): Promise<string[]> {
    return window.bitbutler.window.drainOpenFiles();
  }

  async deleteTorrents(serverId: string, hashes: string[], deleteFiles: boolean): Promise<string> {
    const clean = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (clean.length === 0) return Promise.reject(new Error('No hashes to delete'));

    const res = await this.request<string>(serverId, {
      path: '/api/v2/torrents/delete',
      method: 'POST',
      form: { hashes: clean.join('|'), deleteFiles: deleteFiles ? 'true' : 'false' },
    });

    if (res.ok) return res.body;
    throw new HttpError(res.status, res.statusText, `Failed to delete torrents`);
  }

  async recheckTorrents(serverId: string, hashes: string[]): Promise<void> {
    const clean = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (clean.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/recheck',
      method: 'POST',
      form: { hashes: clean.join('|') },
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to recheck torrents`);
  }

  async reannounceTorrents(serverId: string, hashes: string[]): Promise<void> {
    const clean = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (clean.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/reannounce',
      method: 'POST',
      form: { hashes: clean.join('|') },
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to reannounce torrents`);
  }

  clearRunApiCache(serverId: string): void {
    this.runApiCache.delete(serverId);
  }

  pauseTorrents(serverId: string, hashes: string[]): Promise<void> {
    return this.runTorrents(serverId, 'pause', hashes);
  }

  resumeTorrents(serverId: string, hashes: string[]): Promise<void> {
    return this.runTorrents(serverId, 'resume', hashes);
  }

  async renameTorrentFile(
    serverId: string,
    hash: string,
    oldPath: string,
    newPath: string,
  ): Promise<void> {
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
  }

  async renameTorrentFolder(
    serverId: string,
    hash: string,
    oldPath: string,
    newPath: string,
  ): Promise<void> {
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
  }

  async increasePrio(serverId: string, hashes: string[]): Promise<void> {
    const clean = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (clean.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/increasePrio',
      method: 'POST',
      form: { hashes: clean.join('|') },
    });

    if (!res.ok)
      throw new HttpError(res.status, res.statusText, `Failed to increase torrent priority`);
  }

  async decreasePrio(serverId: string, hashes: string[]): Promise<void> {
    const clean = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (clean.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/decreasePrio',
      method: 'POST',
      form: { hashes: clean.join('|') },
    });

    if (!res.ok)
      throw new HttpError(res.status, res.statusText, `Failed to decrease torrent priority`);
  }

  async topPrio(serverId: string, hashes: string[]): Promise<void> {
    const clean = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (clean.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/topPrio',
      method: 'POST',
      form: { hashes: clean.join('|') },
    });

    if (!res.ok)
      throw new HttpError(res.status, res.statusText, `Failed to move torrent to top of queue`);
  }

  async bottomPrio(serverId: string, hashes: string[]): Promise<void> {
    const clean = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (clean.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/bottomPrio',
      method: 'POST',
      form: { hashes: clean.join('|') },
    });

    if (!res.ok)
      throw new HttpError(res.status, res.statusText, `Failed to move torrent to bottom of queue`);
  }

  async setForceStart(serverId: string, hashes: string[], value: boolean): Promise<void> {
    const clean = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (clean.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/setForceStart',
      method: 'POST',
      form: { hashes: clean.join('|'), value },
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set force start`);
  }

  async setSuperSeeding(serverId: string, hashes: string[], value: boolean): Promise<void> {
    const clean = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (clean.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/setSuperSeeding',
      method: 'POST',
      form: { hashes: clean.join('|'), value },
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set super seeding`);
  }

  async setAutoManagement(serverId: string, hashes: string[], enable: boolean): Promise<void> {
    const cleanHashes = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (cleanHashes.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/setAutoManagement',
      method: 'POST',
      form: { hashes: cleanHashes.join('|'), enable },
    });

    if (!res.ok)
      throw new HttpError(res.status, res.statusText, `Failed to set automatic torrent management`);
  }

  async getDownloadLimit(
    serverId: string,
    hashes?: string[],
  ): Promise<number | Record<string, number>> {
    const cleanHashes = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    const isPerTorrent = cleanHashes.length > 0;

    const path = isPerTorrent ? '/api/v2/torrents/downloadLimit' : '/api/v2/transfer/downloadLimit';
    const query: { hashes?: string } = {};
    if (isPerTorrent) query.hashes = cleanHashes.join('|');

    const res = await this.request<number | Record<string, number>>(serverId, {
      path,
      method: 'GET',
      query,
    });

    if (res.ok) return res.body;
    throw new HttpError(res.status, res.statusText, `Failed to get download limit`);
  }

  async setDownloadLimit(serverId: string, limit: number, hashes?: string[]): Promise<void> {
    const cleanHashes = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    const isPerTorrent = cleanHashes.length > 0;

    const path = isPerTorrent
      ? '/api/v2/torrents/setDownloadLimit'
      : '/api/v2/transfer/setDownloadLimit';
    const form: { limit: number; hashes?: string } = { limit };
    if (isPerTorrent) form.hashes = cleanHashes.join('|');

    const res = await this.request<void>(serverId, {
      path,
      method: 'POST',
      form,
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set download limit`);
  }

  async getUploadLimit(
    serverId: string,
    hashes?: string[],
  ): Promise<number | Record<string, number>> {
    const cleanHashes = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    const isPerTorrent = cleanHashes.length > 0;

    const path = isPerTorrent ? '/api/v2/torrents/uploadLimit' : '/api/v2/transfer/uploadLimit';
    const query: { hashes?: string } = {};
    if (isPerTorrent) query.hashes = cleanHashes.join('|');

    const res = await this.request<number | Record<string, number>>(serverId, {
      path,
      method: 'GET',
      query,
    });

    if (res.ok) return res.body;
    throw new HttpError(res.status, res.statusText, `Failed to get upload limit`);
  }

  async setUploadLimit(serverId: string, limit: number, hashes?: string[]): Promise<void> {
    const cleanHashes = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    const isPerTorrent = cleanHashes.length > 0;

    const path = isPerTorrent
      ? '/api/v2/torrents/setUploadLimit'
      : '/api/v2/transfer/setUploadLimit';
    const form: { limit: number; hashes?: string } = { limit };
    if (isPerTorrent) form.hashes = cleanHashes.join('|');

    const res = await this.request<void>(serverId, {
      path,
      method: 'POST',
      form,
    });

    console.log('setUploadLImit', res);
    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set upload limit`);
  }

  async addTorrentTags(serverId: string, hashes: string[], tags: string[]): Promise<void> {
    const cleanHashes = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (cleanHashes.length === 0) return;

    const cleanTags = (tags ?? []).map((t) => (t ?? '').trim()).filter(Boolean);
    if (cleanTags.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/addTags',
      method: 'POST',
      form: { hashes: cleanHashes.join('|'), tags: cleanTags.join(',') },
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to add tags`);
  }

  async removeTorrentTags(serverId: string, hashes: string[], tags: string[]): Promise<void> {
    const cleanHashes = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (cleanHashes.length === 0) return;

    const cleanTags = (tags ?? []).map((t) => (t ?? '').trim()).filter(Boolean);
    if (cleanTags.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/removeTags',
      method: 'POST',
      form: { hashes: cleanHashes.join('|'), tags: cleanTags.join(',') },
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to remove tags`);
  }

  async getAllTags(serverId: string): Promise<string[]> {
    const res = await this.request<string[]>(serverId, {
      path: '/api/v2/torrents/tags',
      method: 'GET',
    });

    if (res.ok) return res.body;
    throw new HttpError(res.status, res.statusText, `Failed to get all tags`);
  }

  async createTags(serverId: string, tags: string[]): Promise<void> {
    const cleanTags = (tags ?? []).map((t) => (t ?? '').trim()).filter(Boolean);
    if (cleanTags.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/createTags',
      method: 'POST',
      form: { tags: cleanTags.join(',') },
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to create tags`);
  }

  async deleteTags(serverId: string, tags: string[]): Promise<void> {
    const cleanTags = (tags ?? []).map((t) => (t ?? '').trim()).filter(Boolean);
    if (cleanTags.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/deleteTags',
      method: 'POST',
      form: { tags: cleanTags.join(',') },
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to delete tags`);
  }

  async setTorrentCategory(serverId: string, hashes: string[], category: string): Promise<void> {
    const cleanHashes = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (cleanHashes.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/setCategory',
      method: 'POST',
      form: { hashes: cleanHashes.join('|'), category },
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set torrent category`);
  }

  async clearTorrentsCategory(serverId: string, hashes: string[]): Promise<void> {
    const cleanHashes = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (cleanHashes.length === 0) return;

    await this.request<void>(serverId, {
      path: '/api/v2/torrents/setCategory',
      method: 'POST',
      form: { hashes: cleanHashes.join('|'), category: '' },
    });
  }

  async getAllCategories(serverId: string): Promise<Record<string, QbCategory>> {
    const res = await this.request<Record<string, QbCategory>>(serverId, {
      path: '/api/v2/torrents/categories',
      method: 'GET',
    });

    if (res.ok) return res.body;
    throw new HttpError(res.status, res.statusText, `Failed to get all categories`);
  }

  async addCategory(serverId: string, category: string, savePath: string): Promise<void> {
    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/createCategory',
      method: 'POST',
      form: { category, savePath },
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to add category`);
  }

  async editCategory(serverId: string, category: string, savePath: string): Promise<void> {
    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/editCategory',
      method: 'POST',
      form: { category, savePath },
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to edit category`);
  }

  async removeCategories(serverId: string, categories: string[]): Promise<void> {
    const cleanCategories = (categories ?? []).map((c) => (c ?? '').trim()).filter(Boolean);
    if (cleanCategories.length === 0) return;

    const res = await this.request<void>(serverId, {
      path: '/api/v2/torrents/removeCategories',
      method: 'POST',
      form: { categories: cleanCategories.join('|') },
    });

    if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to remove categories`);
  }

  public async getAlternativeSpeedLimitState(serverId: string): Promise<boolean> {
    const res = await this.request<number>(serverId, {
      path: '/api/v2/transfer/speedLimitsMode',
      method: 'GET',
    });

    if (res.ok) return Number(res.body) === 1;
    throw new HttpError(res.status, res.statusText, `Failed to get alternative speed limit state`);
  }

  public async toggleAlternativeSpeedLimit(serverId: string): Promise<void> {
    const res = await this.request<void>(serverId, {
      path: '/api/v2/transfer/toggleSpeedLimitsMode',
      method: 'POST',
    });

    if (!res.ok)
      throw new HttpError(res.status, res.statusText, `Failed to toggle alternative speed limit`);
  }

  private async runTorrents(
    serverId: string,
    action: 'pause' | 'resume',
    hashes: string[],
  ): Promise<void> {
    console.log('[QbService] cached run api =', this.runApiCache.get(serverId));

    const clean = (hashes ?? []).map((h) => (h ?? '').trim()).filter(Boolean);
    if (clean.length === 0) return;

    const form = { hashes: clean.join('|') };
    const cached = this.runApiCache.get(serverId);

    if (cached) {
      await this.callRunEndpoint(serverId, cached, action, form);
      return;
    }

    const candidates: TorrentRunApi[] = ['PAUSE_RESUME', 'START_STOP'];
    let lastErr: any;

    for (const api of candidates) {
      const pathPreview =
        api === 'START_STOP'
          ? action === 'pause'
            ? '/api/v2/torrents/stop'
            : '/api/v2/torrents/start'
          : action === 'pause'
            ? '/api/v2/torrents/pause'
            : '/api/v2/torrents/resume';

      console.log('[QbService] trying', api, pathPreview);
      try {
        await this.callRunEndpoint(serverId, api, action, form, { suppressErrors: true });
        this.runApiCache.set(serverId, api);
        console.log('[QbService] run api detected for', serverId, api);
        return;
      } catch (e: any) {
        lastErr = e;
        console.log('[QbService] caught', e, 'while trying', api);
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
