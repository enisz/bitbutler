import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { IpcResult } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { FORCE_LEAVE_STATE_KEY } from '../guards/unsaved-changes.guard';
import { QbError } from '../models/qb-error.model';
import {
  QbAppPreferences,
  QbLogEntry,
  QbLogPeerEntry,
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

// noRetry: fail on the first UNREACHABLE instead of retrying with toasts - for callers (polling)
// that run their own reconnect policy.
type CallOptions = { suppressErrors?: boolean; noRetry?: boolean };

const MAX_RETRIES = 3;

const POLLING_CALL: CallOptions = { suppressErrors: true, noRetry: true };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A thin wrapper over the typed qBittorrent bridge (`window.bitbutler.qb`). Input cleaning and
 * request building happen in the main process; this unwraps each `IpcResult`, retries an
 * unreachable server, logs out on an expired session and turns failures into a `QbError`.
 */
@Injectable({ providedIn: 'root' })
export class QbService {
  private readonly toastService = inject(ToastService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);

  private get qb() {
    return window.bitbutler.qb;
  }

  // No toast, retry or logout here: the login page reports auth failures itself.
  readonly auth = {
    login: (
      serverId: string,
      username?: string,
      password?: string,
    ): Promise<{ loggedIn: boolean }> =>
      this.unwrap(() => this.qb.auth.login(serverId, username, password)),

    logout: (serverId: string): Promise<{ loggedOut: boolean }> =>
      this.unwrap(() => this.qb.auth.logout(serverId)),

    hasCookie: (serverId: string): Promise<boolean> =>
      this.unwrap(() => this.qb.auth.hasCookie(serverId)),
  };

  readonly app = {
    preferences: (serverId: string): Promise<QbAppPreferences> =>
      this.call(serverId, () => this.qb.app.preferences(serverId)),

    setPreferences: (serverId: string, prefs: QbSetAppPreferences): Promise<void> =>
      this.call(serverId, () => this.qb.app.setPreferences(serverId, prefs)),
  };

  readonly log = {
    main: (
      serverId: string,
      options?: {
        normal?: boolean;
        info?: boolean;
        warning?: boolean;
        critical?: boolean;
        last_known_id?: number;
      },
    ): Promise<QbLogEntry[]> => this.call(serverId, () => this.qb.log.main(serverId, options)),

    peers: (serverId: string, options?: { last_known_id?: number }): Promise<QbLogPeerEntry[]> =>
      this.call(serverId, () => this.qb.log.peers(serverId, options)),
  };

  readonly sync = {
    maindata: (serverId: string, rid: number): Promise<Maindata> =>
      this.call(serverId, () => this.qb.sync.maindata(serverId, rid), POLLING_CALL),

    torrentPeers: (serverId: string, hash: string, rid?: number): Promise<QbTorrentPeersResponse> =>
      this.call(serverId, () => this.qb.sync.torrentPeers(serverId, hash, rid), POLLING_CALL),
  };

  readonly torrents = {
    properties: (serverId: string, hash: string): Promise<QbTorrentProperties> =>
      this.call(serverId, () => this.qb.torrents.properties(serverId, hash)),

    info: (serverId: string, hash: string): Promise<Torrent | null> =>
      this.call(serverId, () => this.qb.torrents.info(serverId, hash)),

    trackers: (serverId: string, hash: string): Promise<QbTorrentTracker[]> =>
      this.call(serverId, () => this.qb.torrents.trackers(serverId, hash)),

    files: (serverId: string, hash: string, options?: CallOptions): Promise<QbTorrentContent[]> =>
      this.call(serverId, () => this.qb.torrents.files(serverId, hash), options),

    setLocation: (serverId: string, hashes: string[], location: string): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.setLocation(serverId, hashes, location)),

    rename: (serverId: string, hash: string, name: string): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.rename(serverId, hash, name)),

    renameFile: (serverId: string, hash: string, oldPath: string, newPath: string): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.renameFile(serverId, hash, oldPath, newPath)),

    renameFolder: (
      serverId: string,
      hash: string,
      oldPath: string,
      newPath: string,
    ): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.renameFolder(serverId, hash, oldPath, newPath)),

    filePrio: (serverId: string, hash: string, ids: number[], priority: number): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.filePrio(serverId, hash, ids, priority)),

    increasePrio: (serverId: string, hashes: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.increasePrio(serverId, hashes)),

    decreasePrio: (serverId: string, hashes: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.decreasePrio(serverId, hashes)),

    topPrio: (serverId: string, hashes: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.topPrio(serverId, hashes)),

    bottomPrio: (serverId: string, hashes: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.bottomPrio(serverId, hashes)),

    delete: (serverId: string, hashes: string[], deleteFiles: boolean): Promise<string> =>
      this.call(serverId, () => this.qb.torrents.delete(serverId, hashes, deleteFiles)),

    recheck: (serverId: string, hashes: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.recheck(serverId, hashes)),

    reannounce: (serverId: string, hashes: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.reannounce(serverId, hashes)),

    pause: (serverId: string, hashes: string[] | 'all'): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.stop(serverId, hashes)),

    resume: (serverId: string, hashes: string[] | 'all'): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.start(serverId, hashes)),

    setForceStart: (serverId: string, hashes: string[], value: boolean): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.setForceStart(serverId, hashes, value)),

    setSuperSeeding: (serverId: string, hashes: string[], value: boolean): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.setSuperSeeding(serverId, hashes, value)),

    setAutoManagement: (serverId: string, hashes: string[], enable: boolean): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.setAutoManagement(serverId, hashes, enable)),

    addTags: (serverId: string, hashes: string[], tags: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.addTags(serverId, hashes, tags)),

    removeTags: (serverId: string, hashes: string[], tags: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.removeTags(serverId, hashes, tags)),

    tags: (serverId: string): Promise<string[]> =>
      this.call(serverId, () => this.qb.torrents.tags(serverId)),

    createTags: (serverId: string, tags: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.createTags(serverId, tags)),

    deleteTags: (serverId: string, tags: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.deleteTags(serverId, tags)),

    setCategory: (serverId: string, hashes: string[], category: string): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.setCategory(serverId, hashes, category)),

    clearCategory: (serverId: string, hashes: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.clearCategory(serverId, hashes)),

    categories: (serverId: string): Promise<Record<string, QbCategory>> =>
      this.call(serverId, () => this.qb.torrents.categories(serverId)),

    createCategory: (serverId: string, category: string, savePath: string): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.createCategory(serverId, category, savePath)),

    editCategory: (serverId: string, category: string, savePath: string): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.editCategory(serverId, category, savePath)),

    removeCategories: (serverId: string, categories: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.removeCategories(serverId, categories)),

    setShareLimits: (
      serverId: string,
      hashes: string[],
      ratioLimit: number,
      seedingTimeLimit: number,
      inactiveSeedingTimeLimit: number,
    ): Promise<void> =>
      this.call(serverId, () =>
        this.qb.torrents.setShareLimits(
          serverId,
          hashes,
          ratioLimit,
          seedingTimeLimit,
          inactiveSeedingTimeLimit,
        ),
      ),

    downloadLimit: (serverId: string, hashes: string[]): Promise<Record<string, number>> =>
      this.call(serverId, () => this.qb.torrents.downloadLimit(serverId, hashes)),

    setDownloadLimit: (serverId: string, limit: number, hashes: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.setDownloadLimit(serverId, limit, hashes)),

    uploadLimit: (serverId: string, hashes: string[]): Promise<Record<string, number>> =>
      this.call(serverId, () => this.qb.torrents.uploadLimit(serverId, hashes)),

    setUploadLimit: (serverId: string, limit: number, hashes: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.setUploadLimit(serverId, limit, hashes)),

    setDownloadPath: (serverId: string, hashes: string[], path: string): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.setDownloadPath(serverId, hashes, path)),

    toggleSequentialDownload: (serverId: string, hashes: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.toggleSequentialDownload(serverId, hashes)),

    toggleFirstLastPiecePrio: (serverId: string, hashes: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.toggleFirstLastPiecePrio(serverId, hashes)),

    removeAllTags: (serverId: string, hashes: string[]): Promise<void> =>
      this.call(serverId, () => this.qb.torrents.removeAllTags(serverId, hashes)),
  };

  readonly transfer = {
    downloadLimit: (serverId: string): Promise<number> =>
      this.call(serverId, () => this.qb.transfer.downloadLimit(serverId)),

    setDownloadLimit: (serverId: string, limit: number): Promise<void> =>
      this.call(serverId, () => this.qb.transfer.setDownloadLimit(serverId, limit)),

    uploadLimit: (serverId: string): Promise<number> =>
      this.call(serverId, () => this.qb.transfer.uploadLimit(serverId)),

    setUploadLimit: (serverId: string, limit: number): Promise<void> =>
      this.call(serverId, () => this.qb.transfer.setUploadLimit(serverId, limit)),

    speedLimitsMode: (serverId: string): Promise<boolean> =>
      this.call(serverId, () => this.qb.transfer.speedLimitsMode(serverId)),

    toggleSpeedLimitsMode: (serverId: string): Promise<void> =>
      this.call(serverId, () => this.qb.transfer.toggleSpeedLimitsMode(serverId)),
  };

  drainOpenFiles(): Promise<string[]> {
    return window.bitbutler.window.drainOpenFiles();
  }

  public async forceLogout(serverId: string): Promise<void> {
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

    await this.router.navigate(['/login'], { state: { [FORCE_LEAVE_STATE_KEY]: true } });
  }

  private async call<T>(
    serverId: string,
    fn: () => Promise<IpcResult<T>>,
    options?: CallOptions,
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const result = await this.invoke(fn);
      if (result.ok) return result.data;

      if (result.code === 'UNREACHABLE' && !options?.noRetry && attempt <= MAX_RETRIES) {
        if (!options?.suppressErrors) {
          // A transient in-progress message: shown in the app, never as an OS notification.
          this.toastService.showText(
            this.translateService.instant('services.qb.warning.connection-retry-message'),
            {
              type: 'warning',
              title: this.translateService.instant('services.qb.warning.connection-retry-title'),
              notifyOs: false,
            },
          );
        }
        console.error(
          QbService.name,
          'call',
          `Request failed, retrying (${attempt}/${MAX_RETRIES})...`,
        );
        await sleep(1000 * attempt);
        continue;
      }

      if (result.code === 'UNAUTHENTICATED') {
        console.error(QbService.name, 'call', 'Session is no longer valid. Logging out...');
        await this.forceLogout(serverId);
      }

      if (!options?.suppressErrors) {
        this.toastService.danger(
          result.message,
          this.translateService.instant('services.qb.error.request-failed-title'),
        );
        console.error(QbService.name, 'call', {
          serverId,
          code: result.code,
          message: result.message,
        });
      }

      throw new QbError(result.code, result.message);
    }
  }

  private async unwrap<T>(fn: () => Promise<IpcResult<T>>): Promise<T> {
    const result = await this.invoke(fn);
    if (result.ok) return result.data;
    throw new QbError(result.code, result.message);
  }

  /** Runs a bridge call, turning an (unexpected) rejection into a `FAILED` result. */
  private async invoke<T>(fn: () => Promise<IpcResult<T>>): Promise<IpcResult<T>> {
    try {
      return await fn();
    } catch (err: unknown) {
      // Duck-typed rather than `instanceof Error`: IPC rejections are structured-clone'd across
      // the preload bridge and may not survive as real `Error` instances.
      const message = String((err as { message?: unknown } | undefined)?.message ?? err);
      return { ok: false, code: 'FAILED', message };
    }
  }
}
