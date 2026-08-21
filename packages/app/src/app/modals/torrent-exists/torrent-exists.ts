import { PercentPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowDown, faArrowUp, faCircleInfo, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbProgress } from '../../components/bb-progress/bb-progress';
import { AutofocusDirective } from '../../directives/autofocus';
import { TooltipOverflow } from '../../directives/tooltip-overflow';
import { TorrentState } from '../../models/torrent.model';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { LocalTimestampPipe } from '../../pipes/local-timestamp-pipe';
import { RatioPipe } from '../../pipes/ratio-pipe';
import { CommandBusService } from '../../services/command-bus.service';
import { FilterService } from '../../services/filter.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { PathService } from '../../services/path.service';
import { SelectionStoreService } from '../../services/selection-store.service';
import { ToastService } from '../../services/toast.service';
import { TorrentStoreService } from '../../services/torrent-store.service';

@Component({
  selector: 'app-torrent-exists',
  standalone: true,
  imports: [
    FilesizePipe,
    PercentPipe,
    RatioPipe,
    LocalTimestampPipe,
    TimeagoPipe,
    AutofocusDirective,
    TooltipOverflow,
    NgbTooltip,
    TranslatePipe,
    BbProgress,
    BbBtnContent,
    FontAwesomeModule,
  ],
  styleUrls: ['./torrent-exists.scss'],
  templateUrl: './torrent-exists.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentExists {
  readonly hash = input<string | null>(null);
  readonly originalPath = input<string | null>(null);

  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly activeModal = inject(NgbActiveModal);
  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly filterService = inject(FilterService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly pathService = inject(PathService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly generalSettings = toSignal(this.generalSettingsService.asObservable(), {
    initialValue: null,
  });

  public icons = { faCircleInfo, faXmark, faArrowDown, faArrowUp };

  public readonly fileDeleted = signal(false);
  public readonly localPath = signal<string | null>(null);

  private hasAttemptedDelete = false;

  public readonly torrent = computed(() => {
    const h = this.hash();
    return h ? this.torrentStoreService.torrentsMap().get(h) : undefined;
  });

  constructor() {
    effect(() => {
      const h = this.hash();
      if (!h) return;

      const isVisible = this.filterService.filtered().some((t) => t.hash === h);
      if (!isVisible) return;

      this.selectionStoreService.setByHashes([h]);
      this.commandBusService.emit({ type: 'UI_SCROLL_TO_TORRENT', hash: h });
    });

    effect(() => {
      const settings = this.generalSettings();
      const path = this.originalPath();
      if (!settings || !path || this.hasAttemptedDelete) return;
      if (!settings.behavior.deleteTorrentFileOnDuplicate) return;

      this.hasAttemptedDelete = true;
      void this.deleteTorrentFile(path);
    });

    effect(() => {
      const remotePath = this.torrent()?.content_path;
      void this.pathService
        .resolveLocalPath(remotePath)
        .then((resolved) => this.localPath.set(resolved));
    });
  }

  private async deleteTorrentFile(path: string): Promise<void> {
    try {
      const result = await window.bitbutler.torrent.deleteFile({ path });
      if (!result?.ok) {
        console.error(
          TorrentExists.name,
          'deleteTorrentFile',
          'Failed to delete torrent file',
          path,
          result?.error,
        );
        this.toastService.danger(
          result?.error ?? '',
          this.translateService.instant(
            'components.modals.torrent-exists.toast.delete-failed-title',
          ),
        );
        return;
      }

      this.fileDeleted.set(true);
    } catch (err: any) {
      console.error(TorrentExists.name, 'deleteTorrentFile', 'Failed to delete torrent file', err);
      this.toastService.danger(
        err?.message ?? String(err),
        this.translateService.instant('components.modals.torrent-exists.toast.delete-failed-title'),
      );
    }
  }

  public isDownloading(state: TorrentState): boolean {
    return (
      state === 'downloading' ||
      state === 'pausedDL' ||
      state === 'stoppedDL' ||
      state === 'queuedDL' ||
      state === 'stalledDL' ||
      state === 'checkingDL' ||
      state === 'forcedDL'
    );
  }

  public openDetails(): void {
    const h = this.hash();
    if (h) {
      this.commandBusService.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash: h });
    }
    this.closeModal();
  }

  public closeModal(): void {
    this.activeModal.close();
  }
}
