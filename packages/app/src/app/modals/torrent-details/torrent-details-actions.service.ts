import { Injectable, inject } from '@angular/core';
import { TorrentFileEntry } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { FileTreeSaveEvent } from '../../components/bb-file-tree/bb-file-tree';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { TorrentExportService } from '../../services/torrent-export.service';
import { TorrentDetailsDataService } from './torrent-details-data.service';

@Injectable()
export class TorrentDetailsActionsService {
  private readonly dataService = inject(TorrentDetailsDataService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly torrentExportService = inject(TorrentExportService);

  public rename(): void {
    this.commandBusService.emit({
      type: 'UI_RENAME_TORRENT',
      torrent: this.dataService.torrent()!.data,
    });
  }

  public setSavePath(): void {
    this.commandBusService.emit({
      type: 'UI_SET_SAVE_PATH',
      torrent: this.dataService.torrent()!.data,
      hashes: [this.dataService.hash()],
    });
  }

  public setDownloadPath(): void {
    this.commandBusService.emit({
      type: 'UI_SET_DOWNLOAD_PATH',
      torrent: this.dataService.torrent()!.data,
      hashes: [this.dataService.hash()],
    });
  }

  public openPath(): void {
    const remotePath = this.dataService.torrent()?.data.content_path;
    const hash = this.dataService.hash();

    if (!remotePath) {
      this.toastService.danger(
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.local-path-failed',
        ),
      );
      return;
    }

    this.commandBusService.emit({ type: 'UI_OPEN_DESTINATION', remotePath, hash });
  }

  public changeCategory(): void {
    this.commandBusService.emit({
      type: 'UI_SET_TORRENT_CATEGORY',
      torrent: this.dataService.torrent()!.data,
      hashes: [this.dataService.hash()],
    });
  }

  public async removeCategory(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.removing-category',
      ),
    );
    try {
      await this.qbService.torrents.clearCategory(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
      );
    } catch (error: unknown) {
      this.toastService.danger(
        error instanceof Error ? error.message : String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.remove-category-failed',
        ),
      );
    }
  }

  public changeTags(): void {
    this.commandBusService.emit({
      type: 'UI_SET_TORRENT_TAGS',
      torrent: this.dataService.torrent()!.data,
      hashes: [this.dataService.hash()],
    });
  }

  public async removeAllTags(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.removing-all-tags',
      ),
    );
    try {
      await this.qbService.torrents.removeTags(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
        this.dataService
          .torrent()!
          .data.tags.split(',')
          .map((t) => t.trim()),
      );
    } catch (error: unknown) {
      this.toastService.danger(
        error instanceof Error ? error.message : String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.remove-all-tags-failed',
        ),
      );
    }
  }

  public async resume(): Promise<void> {
    this.toastService.info(
      this.translateService.instant('components.modals.torrent-details.general.toast.resuming'),
    );
    try {
      await this.qbService.torrents.resume(this.serverStoreService.currentServerId() as string, [
        this.dataService.hash(),
      ]);
    } catch (error: unknown) {
      this.toastService.danger(
        error instanceof Error ? error.message : String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.resume-failed',
        ),
      );
    }
  }

  public async pause(): Promise<void> {
    this.toastService.info(
      this.translateService.instant('components.modals.torrent-details.general.toast.pausing'),
    );
    try {
      await this.qbService.torrents.pause(this.serverStoreService.currentServerId() as string, [
        this.dataService.hash(),
      ]);
    } catch (error: unknown) {
      this.toastService.danger(
        error instanceof Error ? error.message : String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.pause-failed',
        ),
      );
    }
  }

  public async forceResume(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.force-resuming',
      ),
    );
    try {
      await this.qbService.torrents.setForceStart(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
        true,
      );
    } catch (error: unknown) {
      this.toastService.danger(
        error instanceof Error ? error.message : String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.force-resume-failed',
        ),
      );
    }
  }

  public openTransferLimitsModal(): void {
    this.commandBusService.emit({
      type: 'UI_LIMIT_TRANSFER',
      target: 'torrent',
      hashes: [this.dataService.hash()],
    });
  }

  public openShareLimitsModal(): void {
    this.commandBusService.emit({
      type: 'UI_LIMIT_SHARE',
      target: 'torrent',
      hashes: [this.dataService.hash()],
    });
  }

  public async forceReannounce(): Promise<void> {
    this.toastService.info(
      this.translateService.instant('components.modals.torrent-details.general.toast.reannouncing'),
    );
    try {
      await this.qbService.torrents.reannounce(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
      );
    } catch (error: unknown) {
      this.toastService.danger(
        error instanceof Error ? error.message : String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.reannounce-failed',
        ),
      );
    }
  }

  public async exportTorrentFile(): Promise<void> {
    await this.torrentExportService.exportTorrentFiles([
      { hash: this.dataService.hash(), name: this.dataService.torrent()!.data.name },
    ]);
  }

  public async toggleSequentialDownload(): Promise<void> {
    try {
      await this.qbService.torrents.toggleSequentialDownload(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
      );
    } catch (error: unknown) {
      this.toastService.danger(
        error instanceof Error ? error.message : String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.toggle-sequential-download-failed',
        ),
      );
    }
  }

  public async toggleFirstLastPiecePrio(): Promise<void> {
    try {
      await this.qbService.torrents.toggleFirstLastPiecePrio(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
      );
    } catch (error: unknown) {
      this.toastService.danger(
        error instanceof Error ? error.message : String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.toggle-first-last-piece-prio-failed',
        ),
      );
    }
  }

  public async forceRecheck(): Promise<void> {
    this.toastService.info(
      this.translateService.instant('components.modals.torrent-details.general.toast.rechecking'),
    );
    try {
      await this.qbService.torrents.recheck(this.serverStoreService.currentServerId() as string, [
        this.dataService.hash(),
      ]);
    } catch (error: unknown) {
      this.toastService.danger(
        error instanceof Error ? error.message : String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.recheck-failed',
        ),
      );
    }
  }

  public async toggleAutoTmm(): Promise<void> {
    const current = this.dataService.torrent()!.data.auto_tmm;
    try {
      await this.qbService.torrents.setAutoManagement(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
        !current,
      );
    } catch (error: unknown) {
      this.toastService.danger(
        error instanceof Error ? error.message : String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.toggle-auto-tmm-failed',
        ),
      );
    }
  }

  public async toggleForceStart(): Promise<void> {
    const current = this.dataService.torrent()!.data.force_start;
    try {
      await this.qbService.torrents.setForceStart(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
        !current,
      );
    } catch (error: unknown) {
      this.toastService.danger(
        error instanceof Error ? error.message : String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.toggle-force-start-failed',
        ),
      );
    }
  }

  public async toggleSuperSeeding(): Promise<void> {
    const current = this.dataService.torrent()!.data.super_seeding;
    try {
      await this.qbService.torrents.setSuperSeeding(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
        !current,
      );
    } catch (error: unknown) {
      this.toastService.danger(
        error instanceof Error ? error.message : String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.toggle-super-seeding-failed',
        ),
      );
    }
  }

  public deleteTorrent(): void {
    this.commandBusService.emit({
      type: 'UI_TORRENT_DELETE_REQUEST',
      hashes: [this.dataService.hash()],
    });
  }

  public async saveFileChanges(
    event: FileTreeSaveEvent,
    originalContent: TorrentFileEntry[],
  ): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const hash = this.dataService.hash();

    try {
      for (const item of event.renames) {
        await this.qbService.torrents.renameFile(serverId, hash, item.oldPath, item.newPath);
      }

      for (const file of event.files) {
        if (file.index === undefined) continue;
        const original = originalContent.find((f) => f.index === file.index);
        if (original && original.priority !== file.priority) {
          await this.qbService.torrents.filePrio(serverId, hash, [file.index], file.priority ?? 0);
        }
      }
    } catch (e: unknown) {
      console.error(
        TorrentDetailsActionsService.name,
        'saveFileChanges',
        'Failed to save changes',
        e,
      );
      this.toastService.danger(
        e instanceof Error ? e.message : String(e),
        this.translateService.instant(
          'components.modals.torrent-details.content.error.failed-to-save-title',
        ),
      );
    }
  }
}
