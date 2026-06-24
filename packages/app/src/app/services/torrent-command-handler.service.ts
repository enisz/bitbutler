import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { AppCommand, TorrentCommand } from '../models/command.model';
import { CommandBusService } from './command-bus.service';
import { QbService } from './qb.service';
import { SelectionStoreService } from './selection-store.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';
import { TorrentStoreService } from './torrent-store.service';

@Injectable({ providedIn: 'root' })
export class TorrentCommandHandlerService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly qbService = inject(QbService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly selectionStore = inject(SelectionStoreService);
  private readonly serverStore = inject(ServerStoreService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public start(): void {
    this.commandBusService.commands$
      .pipe(filter(this.torrentCommandGuard), takeUntilDestroyed(this.destroyRef))
      .subscribe((cmd) => {
        switch (cmd.type) {
          case 'TORRENT_DELETE_CONFIRM':
            void this.handleDelete(cmd.removeFiles, cmd.hashes);
            break;
          case 'TORRENT_PAUSE':
            void this.handlePause();
            break;
          case 'TORRENT_RESUME':
            void this.handleResume();
            break;
          case 'TORRENT_PAUSE_ALL':
            void this.handlePauseAll();
            break;
          case 'TORRENT_RESUME_ALL':
            void this.handleResumeAll();
            break;
          case 'QUEUE_MOVE_TOP':
            void this.handleQueueMoveTop();
            break;
          case 'QUEUE_MOVE_UP':
            void this.handleQueueMoveUp();
            break;
          case 'QUEUE_MOVE_DOWN':
            void this.handleQueueMoveDown();
            break;
          case 'QUEUE_MOVE_BOTTOM':
            void this.handleQueueMoveBottom();
            break;
          case 'TORRENT_REANNOUNCE':
            void this.handleReannounce();
            break;
          case 'TORRENT_RECHECK':
            void this.handleRecheck();
            break;
          case 'TORRENT_SUPER_SEEDING':
            void this.handleSuperSeeding(cmd.status);
            break;
          case 'TORRENT_FORCE_RESUME':
            void this.handleForceResume();
            break;
          case 'TORRENT_AUTO_TMM':
            void this.handleAutoTmm(cmd.status);
            break;
          default:
            console.error(TorrentCommandHandlerService.name, 'start', 'Unhandled command', cmd);
        }
      });
  }

  private async handleAutoTmm(status: boolean): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    const enabling = !status;

    try {
      await this.qbService.torrents.setAutoManagement(ctx.serverId, ctx.hashes, enabling);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleAutoTmm',
        'Auto TMM toggle failed!',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          enabling
            ? 'services.torrent-command-handler.toast.enable-auto-tmm-failed-title'
            : 'services.torrent-command-handler.toast.disable-auto-tmm-failed-title',
        ),
      );
    }
  }

  private async handleForceResume(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.force-resuming', {
        count: ctx.hashes.length,
      }),
    );

    try {
      await this.qbService.torrents.setForceStart(ctx.serverId, ctx.hashes, true);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleForceResume',
        'Force resume failed!',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.force-resume-failed-title',
        ),
      );
    }
  }

  private async handleSuperSeeding(status: boolean): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    const enabling = !status;

    try {
      await this.qbService.torrents.setSuperSeeding(ctx.serverId, ctx.hashes, enabling);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleSuperSeeding',
        'Super seeding toggle failed!',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          enabling
            ? 'services.torrent-command-handler.toast.enable-super-seeding-failed-title'
            : 'services.torrent-command-handler.toast.disable-super-seeding-failed-title',
        ),
      );
    }
  }

  private async handleReannounce(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.reannouncing', {
        count: ctx.hashes.length,
      }),
    );

    try {
      await this.qbService.torrents.reannounce(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handleReannounce', 'Reannounce failed!', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.reannounce-failed-title',
        ),
      );
    }
  }

  private async handleRecheck(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.rechecking', {
        count: ctx.hashes.length,
      }),
    );

    try {
      await this.qbService.torrents.recheck(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handleRecheck', 'Recheck failed!', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.recheck-failed-title',
        ),
      );
    }
  }

  private torrentCommandGuard(command: AppCommand): command is TorrentCommand {
    return command.type.startsWith('TORRENT_') || command.type.startsWith('QUEUE_');
  }

  private async handleDelete(removeFiles: boolean, hashesOverride?: string[]): Promise<void> {
    const serverId = this.serverStore.currentServerId();
    const hashes = hashesOverride ?? this.selectionStore.selectedHashes();

    if (!serverId) return;
    if (hashes.length === 0) return;

    try {
      await this.qbService.torrents.delete(serverId, hashes, removeFiles);
      for (const hash of hashes) {
        this.commandBusService.emit({ type: 'TORRENT_DELETED', hash });
      }
      if (!hashesOverride) this.selectionStore.clear();
    } catch (error: any) {
      console.error('Delete failed', error);
      this.toastService.danger(
        error.message,
        this.translateService.instant('services.torrent-command-handler.error.delete-failed-title'),
      );
    }
  }

  private getContext(): { serverId: string; hashes: string[] } | null {
    const serverId = this.serverStore.currentServerId();
    const hashes = this.selectionStore.selectedHashes();

    if (!serverId) return null;
    if (hashes.length === 0) return null;

    return { serverId, hashes };
  }

  private async handlePause(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.pausing', {
        count: ctx.hashes.length,
      }),
    );

    try {
      await this.qbService.torrents.pause(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handlePause', 'Pause failed!', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant('services.torrent-command-handler.toast.pause-failed-title'),
      );
    }
  }

  private async handleResume(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.resuming', {
        count: ctx.hashes.length,
      }),
    );

    try {
      await this.qbService.torrents.resume(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handleResume', 'Resume failed!', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant('services.torrent-command-handler.toast.resume-failed-title'),
      );
    }
  }

  private async handleResumeAll(): Promise<void> {
    const serverId = this.serverStore.currentServerId();
    const hashes = this.torrentStore.torrentsArray().map((t) => t.hash);

    if (!serverId) return;
    if (hashes.length === 0) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.resuming-all'),
    );

    try {
      await this.qbService.torrents.resume(serverId, hashes);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handleResumeAll', 'Resume all failed!', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.resume-all-failed-title',
        ),
      );
    }
  }

  private async handlePauseAll(): Promise<void> {
    const serverId = this.serverStore.currentServerId();
    const hashes = this.torrentStore.torrentsArray().map((t) => t.hash);

    if (!serverId) return;
    if (hashes.length === 0) return;

    this.toastService.info(
      this.translateService.instant('services.torrent-command-handler.toast.pausing-all'),
    );

    try {
      await this.qbService.torrents.pause(serverId, hashes);
    } catch (e: any) {
      console.error(TorrentCommandHandlerService.name, 'handlePauseAll', 'Pause all failed', e);
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.pause-all-failed-title',
        ),
      );
    }
  }

  private async handleQueueMoveTop(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      await this.qbService.torrents.topPrio(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleQueueMoveTop',
        'Failed to move torrent(s) to top of queue',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.move-top-failed-title',
        ),
      );
    }
  }

  private async handleQueueMoveUp(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      await this.qbService.torrents.increasePrio(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleQueueMoveUp',
        'Failed to move torrent(s) up in queue',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.move-up-failed-title',
        ),
      );
    }
  }

  private async handleQueueMoveDown(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      await this.qbService.torrents.decreasePrio(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleQueueMoveDown',
        'Failed to move torrent(s) down in queue',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.move-down-failed-title',
        ),
      );
    }
  }

  private async handleQueueMoveBottom(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      await this.qbService.torrents.bottomPrio(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleQueueMoveBottom',
        'Failed to move torrent(s) to bottom of queue',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.move-bottom-failed-title',
        ),
      );
    }
  }
}
