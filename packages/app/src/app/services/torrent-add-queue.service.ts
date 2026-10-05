import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { TorrentAddJob, TorrentAddJobPayload } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { ToastAction } from '../models/toast.model';
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
  private readonly router = inject(Router);

  /** Jobs that are queued, running, or failed and still retryable. Finished jobs are dropped. */
  public readonly jobs = signal<TorrentAddJob[]>([]);

  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;

    window.bitbutler.torrentQueue.list().then((jobs) => this.jobs.set(jobs));

    window.bitbutler.torrentQueue.onUpdate((job) => {
      this.upsert(job);

      if (job.status === 'duplicate') {
        this.notifyDuplicate(job);
      } else if (job.status === 'error') {
        this.notifyFailure(job);
      } else if (job.status === 'done') {
        this.remove(job.id);
      }
    });
  }

  enqueue(payload: TorrentAddJobPayload): Promise<{ jobId: string }> {
    return window.bitbutler.torrentQueue.enqueue(payload);
  }

  retry(jobId: string): Promise<void> {
    return window.bitbutler.torrentQueue.retry(jobId);
  }

  private upsert(job: TorrentAddJob): void {
    this.jobs.update((prev) => {
      const idx = prev.findIndex((j) => j.id === job.id);
      if (idx === -1) return [...prev, job];
      const next = [...prev];
      next[idx] = job;
      return next;
    });
  }

  private remove(jobId: string): void {
    this.jobs.update((prev) => prev.filter((j) => j.id !== jobId));
  }

  private notifyDuplicate(job: TorrentAddJob): void {
    this.remove(job.id);
    const { displayName, duplicateAs, infoHash, originalPath } = job.payload;

    if (duplicateAs === 'toast') {
      this.toastService.danger(
        displayName ?? '',
        this.translateService.instant('services.torrent-add-queue.toast.duplicate.title'),
      );
      return;
    }

    this.commandBusService.emit({
      type: 'UI_TORRENT_EXISTS',
      hash: infoHash?.toLowerCase() ?? null,
      originalPath: originalPath ?? null,
    });
  }

  private notifyFailure(job: TorrentAddJob): void {
    const t = (key: string) => this.translateService.instant(`services.torrent-add-queue.${key}`);
    const reason = job.error ?? this.translateService.instant('general.toast.error');
    const { displayName } = job.payload;

    const title = job.authExpired
      ? t('toast.session-expired.title')
      : job.failedStage === 'setup'
        ? t('toast.setup-failed.title')
        : t('toast.add-failed.title');

    const retry: ToastAction = {
      label: t('action.retry'),
      kind: job.authExpired ? 'text' : 'primary',
      onClick: () => void this.retry(job.id),
    };
    const actions: ToastAction[] = job.authExpired
      ? [
          retry,
          {
            label: t('action.log-in'),
            kind: 'primary',
            onClick: () => this.router.navigate(['/login']),
          },
        ]
      : [retry];

    this.toastService.showText(displayName ? `"${displayName}": ${reason}` : reason, {
      type: 'danger',
      title,
      actions,
      // Closing the toast without acting abandons the job; main keeps failed jobs only for retry.
      onDismiss: () => {
        this.remove(job.id);
        void window.bitbutler.torrentQueue.dismiss(job.id);
      },
    });
  }
}
