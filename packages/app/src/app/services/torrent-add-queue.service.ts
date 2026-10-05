import { Injectable, inject, signal } from '@angular/core';
import type { TorrentAddJob, TorrentAddJobPayload } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { CommandBusService } from './command-bus.service';
import { ToastService } from './toast.service';

/**
 * Mirrors the main process's torrent-add job queue (see packages/electron/src/ipc/torrent-add-queue.ts).
 * Main owns the queue and does the actual work; this service just hydrates/subscribes so Angular
 * code never has to touch window.bitbutler.torrentQueue directly - same role TorrentStoreService
 * plays for maindata.
 */
@Injectable({ providedIn: 'root' })
export class TorrentAddQueueService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public readonly jobs = signal<TorrentAddJob[]>([]);

  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;

    window.bitbutler.torrentQueue.list().then((jobs) => this.jobs.set(jobs));

    window.bitbutler.torrentQueue.onUpdate((job) => {
      this.jobs.update((prev) => {
        const idx = prev.findIndex((j) => j.id === job.id);
        if (idx === -1) return [...prev, job];
        const next = [...prev];
        next[idx] = job;
        return next;
      });

      if (job.status === 'duplicate') {
        const { name, infoHash, originalPath } = job.payload;
        if (name) {
          this.toastService.danger(
            name,
            this.translateService.instant('services.torrent-add-queue.toast.duplicate.title'),
          );
        } else {
          this.commandBusService.emit({
            type: 'UI_TORRENT_EXISTS',
            hash: infoHash?.toLowerCase() ?? null,
            originalPath: originalPath ?? null,
          });
        }
      } else if (job.status === 'error') {
        this.toastService.danger(
          job.error ?? this.translateService.instant('general.toast.error'),
          this.translateService.instant('services.torrent-add-queue.toast.job-failed.title'),
        );
      }
    });
  }

  enqueue(payload: TorrentAddJobPayload): Promise<{ jobId: string }> {
    return window.bitbutler.torrentQueue.enqueue(payload);
  }
}
