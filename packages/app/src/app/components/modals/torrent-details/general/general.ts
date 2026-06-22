import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  Signal,
  WritableSignal,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { faClipboard } from '@fortawesome/free-regular-svg-icons';
import {
  faBullhorn,
  faFolderOpen,
  faForwardFast,
  faPause,
  faPenToSquare,
  faPlay,
  faTrashCan,
  faX,
} from '@fortawesome/free-solid-svg-icons';
import { NgbCollapse, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { take, timer } from 'rxjs';
import { TooltipOverflow } from '../../../../directives/tooltip-overflow';
import { GeneralSettings } from '../../../../models/general-settings.model';
import {
  QbLogEntry,
  QbLogMessageType,
  QbTorrentProperties,
} from '../../../../models/qbittorrent.model';
import { QbTorrentContent, Torrent } from '../../../../models/torrent.model';
import { FileSizePerSecPipe } from '../../../../pipes/filesize-per-sec-pipe';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../../../../pipes/humanize-duration-pipe';
import { RatioLimitPipe } from '../../../../pipes/ratio-limit-pipe';
import { RatioPipe } from '../../../../pipes/ratio-pipe';
import { SpeedLimitPipe } from '../../../../pipes/speed-limit-pipe';
import { TimeLimitPipe } from '../../../../pipes/time-limit-pipe';
import { CommandBusService } from '../../../../services/command-bus.service';
import { GeneralSettingsService } from '../../../../services/general-settings.service';
import { PathService } from '../../../../services/path.service';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ToastService } from '../../../../services/toast.service';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import { BbPopover } from '../../../bb-popover/bb-popover';
import { BbProgress } from '../../../bb-progress/bb-progress';
import { BbSpinner } from '../../../bb-spinner/bb-spinner';
import { TorrentDetailTabComponent } from '../torrent-details.interface';

interface MergedData {
  data: Torrent;
  properties: QbTorrentProperties;
}

@Component({
  selector: 'app-general',
  imports: [
    BbSpinner,
    DatePipe,
    TimeagoPipe,
    FilesizePipe,
    FileSizePerSecPipe,
    HumanizeDurationPipe,
    SpeedLimitPipe,
    BbProgress,
    FontAwesomeModule,
    NgbCollapse,
    NgbTooltip,
    RatioLimitPipe,
    RatioPipe,
    TimeLimitPipe,
    BbPopover,
    TranslatePipe,
    TooltipOverflow,
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class General implements TorrentDetailTabComponent, OnInit {
  readonly hash = input<string>('');
  readonly context = input<Record<string, any>>({});

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly qbService = inject(QbService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly pathService = inject(PathService);
  private readonly clipboard = inject(Clipboard);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private settings: WritableSignal<GeneralSettings | null> = signal(null);

  public icons: Record<string, IconDefinition> = {
    faPenToSquare,
    faBullhorn,
    faFolderOpen,
    faX,
    faTrashCan,
    faPlay,
    faPause,
    faForwardFast,
    faClipboard,
  };

  public torrent: Signal<MergedData | null> = computed(() => {
    const data = this.torrentStoreService.torrentsMap().get(this.hash());
    const properties = this.properties();

    return !data || !properties ? null : { data, properties };
  });

  public properties: WritableSignal<QbTorrentProperties | null> = signal(null);
  public localPath: WritableSignal<string | null> = signal(null);
  public errorLog: WritableSignal<QbLogEntry | null> = signal(null);
  public errorLogExpanded = signal(false);

  constructor() {
    let isResolving = false;
    let isResolved = false;

    const effectRef = effect(async () => {
      const remotePath = this.torrent()?.data?.content_path;

      if (isResolved) {
        effectRef.destroy();
        return;
      }

      if (!remotePath || isResolving) return;

      isResolving = true;
      this.localPath.set(await this.pathService.resolveLocalPath(remotePath));
      isResolved = true;
      effectRef.destroy();
    });

    let hasAttemptedErrorLogFetch = false;

    effect(async () => {
      const entry = this.torrentStoreService.torrentsMap().get(this.hash());
      const state = entry?.state;
      const name = entry?.name;
      const serverId = this.serverStoreService.currentServerId();

      if (state !== 'error') {
        hasAttemptedErrorLogFetch = false;
        this.errorLog.set(null);
        return;
      }

      if (hasAttemptedErrorLogFetch || !serverId || !name) return;
      hasAttemptedErrorLogFetch = true;

      try {
        const entries = await this.qbService.log.main(serverId, {
          normal: false,
          info: false,
          warning: true,
          critical: true,
        });

        const matches = entries.filter(
          (e) =>
            (e.type === QbLogMessageType.Warning || e.type === QbLogMessageType.Critical) &&
            e.message.includes(name),
        );

        if (matches.length > 0) {
          this.errorLog.set(matches.reduce((a, b) => (b.id > a.id ? b : a)));
        }
      } catch (error: any) {
        console.error(General.name, 'errorLog effect', 'Failed to fetch log entries', error);
      }
    });
  }

  public singleFile = signal(false);

  public ngOnInit(): void {
    this.generalSettingsService
      .asObservable()
      .pipe(take(1))
      .subscribe((settings) => {
        this.settings.set(settings);
      });

    timer(0, 2000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());

    this.qbService.torrents
      .files(this.serverStoreService.currentServerId() as string, this.hash())
      .then((content: QbTorrentContent[]) => this.singleFile.set(content.length === 1))
      .catch((error: any) => this.toastService.danger(error));
  }

  private async load(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    const hash = this.hash();

    if (!serverId) {
      console.error(General.name, 'load', 'ServerId is missing!');
      throw new Error('ServerId is missing!');
    }

    if (!hash) {
      console.error(General.name, 'load', 'Torrent hash is missing!');
      throw new Error('Torrent hash is missing!');
    }

    try {
      this.properties.set(await this.qbService.torrents.properties(serverId, hash));
    } catch (e: any) {
      const error = e?.message ?? String(e);
      console.error(General.name, 'load', 'Failed to fetch torrent properties!', error);
      throw new Error(error);
    }
  }

  public changeDownloadLimit(): void {
    this.commandBusService.emit({
      type: 'UI_LIMIT_TRANSFER',
      target: 'torrent',
      hashes: [this.hash()],
    });
  }

  public changeUploadLimit(): void {
    this.commandBusService.emit({
      type: 'UI_LIMIT_TRANSFER',
      target: 'torrent',
      hashes: [this.hash()],
    });
  }

  public rename(): void {
    this.commandBusService.emit({ type: 'UI_RENAME_TORRENT', torrent: this.torrent()!.data });
  }

  public async resume(): Promise<void> {
    this.toastService.info(
      this.translateService.instant('components.modals.torrent-details.general.toast.resuming'),
    );
    try {
      await this.qbService.torrents.resume(this.serverStoreService.currentServerId() as string, [
        this.hash(),
      ]);
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
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
        this.hash(),
      ]);
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
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
        [this.hash()],
        true,
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.force-resume-failed',
        ),
      );
    }
  }

  public async clearDownloadLimit(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.clearing-download-limit',
      ),
    );
    try {
      await this.qbService.torrents.setDownloadLimit(
        this.serverStoreService.currentServerId() as string,
        0,
        [this.hash()],
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.clear-download-limit-failed',
        ),
      );
    }
  }

  public async clearUploadLimit(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.clearing-upload-limit',
      ),
    );
    try {
      await this.qbService.torrents.setUploadLimit(
        this.serverStoreService.currentServerId() as string,
        0,
        [this.hash()],
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.clear-upload-limit-failed',
        ),
      );
    }
  }

  public openShareLimitsModal(): void {
    this.commandBusService.emit({
      type: 'UI_LIMIT_SHARE',
      target: 'torrent',
      hashes: [this.hash()],
    });
  }

  public async clearRatioLimit(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.clearing-ratio-limit',
      ),
    );
    const t = this.torrent()!.data;
    try {
      await this.qbService.torrents.setShareLimits(
        this.serverStoreService.currentServerId() as string,
        [this.hash()],
        -1,
        t.seeding_time_limit,
        t.inactive_seeding_time_limit,
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.clear-ratio-limit-failed',
        ),
      );
    }
  }

  public async clearSeedingTimeLimit(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.clearing-seeding-time-limit',
      ),
    );
    const t = this.torrent()!.data;
    try {
      await this.qbService.torrents.setShareLimits(
        this.serverStoreService.currentServerId() as string,
        [this.hash()],
        t.ratio_limit,
        -1,
        t.inactive_seeding_time_limit,
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.clear-seeding-time-limit-failed',
        ),
      );
    }
  }

  public async clearInactiveSeedingTimeLimit(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.clearing-inactive-seeding-time-limit',
      ),
    );
    const t = this.torrent()!.data;
    try {
      await this.qbService.torrents.setShareLimits(
        this.serverStoreService.currentServerId() as string,
        [this.hash()],
        t.ratio_limit,
        t.seeding_time_limit,
        -1,
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.clear-inactive-seeding-time-limit-failed',
        ),
      );
    }
  }

  public async forceReannounce(): Promise<void> {
    this.toastService.info(
      this.translateService.instant('components.modals.torrent-details.general.toast.reannouncing'),
    );
    try {
      await this.qbService.torrents.reannounce(
        this.serverStoreService.currentServerId() as string,
        [this.hash()],
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.reannounce-failed',
        ),
      );
    }
  }

  public changeCategory(): void {
    this.commandBusService.emit({
      type: 'UI_SET_TORRENT_CATEGORY',
      torrent: this.torrent()!.data,
      hashes: [this.hash()],
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
        [this.hash()],
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.remove-category-failed',
        ),
      );
    }
  }

  public changeTags(): void {
    this.commandBusService.emit({
      type: 'UI_SET_TORRENT_TAGS',
      torrent: this.torrent()!.data,
      hashes: [this.hash()],
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
        [this.hash()],
        this.torrent()!
          .data.tags.split(',')
          .map((t) => t.trim()),
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.remove-all-tags-failed',
        ),
      );
    }
  }

  public setLocation(): void {
    this.commandBusService.emit({
      type: 'UI_SET_TORRENT_LOCATION',
      torrent: this.torrent()!.data,
      hashes: [this.hash()],
    });
  }

  public openPath(): void {
    const remotePath = this.torrent()?.data.content_path;
    const hash = this.hash();

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

  public deleteTorrent(): void {
    this.commandBusService.emit({ type: 'UI_TORRENT_DELETE_REQUEST' });
  }

  public toClipboard(fieldKey: string, value: string): void {
    const field = this.translateService.instant(
      `components.modals.torrent-details.general.${fieldKey}`,
    );
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.copied-to-clipboard',
        { field },
      ),
    );
    this.clipboard.copy(value);
  }

  public isDownloading(): boolean {
    return (
      this.torrent()?.data.state === 'downloading' ||
      this.torrent()?.data.state === 'pausedDL' ||
      this.torrent()?.data.state === 'stoppedDL' ||
      this.torrent()?.data.state === 'queuedDL' ||
      this.torrent()?.data.state === 'stalledDL' ||
      this.torrent()?.data.state === 'checkingDL' ||
      this.torrent()?.data.state === 'forcedDL'
    );
  }

  public parseFileErrorReason(message: string): { reason: string; short: string } {
    const match = message.match(/Reason:\s*"(.*)"\s*$/);
    const reason = match ? match[1] : message;
    const errorMatch = reason.match(/error:\s*(.+)$/i);
    const short = errorMatch ? errorMatch[1] : reason;
    return { reason, short };
  }

  public rawLogJson(entry: QbLogEntry): string {
    return JSON.stringify(entry, null, 4);
  }

  public toggleErrorLog(): void {
    this.errorLogExpanded.update((v) => !v);
  }
}
