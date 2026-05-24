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
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { take, timer } from 'rxjs';
import { TooltipOverflow } from '../../../../directives/tooltip-overflow';
import { GeneralSettings } from '../../../../models/general-settings.model';
import { QbTorrentProperties } from '../../../../models/qbittorrent.model';
import { QbTorrentContent, Torrent } from '../../../../models/torrent.model';
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
    HumanizeDurationPipe,
    SpeedLimitPipe,
    BbProgress,
    FontAwesomeModule,
    NgbTooltip,
    RatioLimitPipe,
    RatioPipe,
    TimeLimitPipe,
    BbPopover,
    TranslatePipe,
    TooltipOverflow,
  ],
  providers: [],
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
  }

  public singleFile = signal(false);

  public ngOnInit(): void {
    this.generalSettingsService
      .asObservable()
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((settings) => {
        this.settings.set(settings);
      });

    timer(0, 2000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());

    this.qbService
      .torrentContents(this.serverStoreService.currentServerId() as string, this.hash())
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
      this.properties.set(await this.qbService.torrentProperties(serverId, hash));
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

  public resume(): void {
    this.toastService.info('Resuming.');
    this.qbService.resumeTorrents(this.serverStoreService.currentServerId() as string, [
      this.hash(),
    ]);
  }

  public pause(): void {
    this.toastService.info('Pausing.');
    this.qbService.pauseTorrents(this.serverStoreService.currentServerId() as string, [
      this.hash(),
    ]);
  }

  public forceResume(): void {
    this.toastService.info('Forcing resume.');
    this.qbService.setForceStart(
      this.serverStoreService.currentServerId() as string,
      [this.hash()],
      true,
    );
  }

  public clearDownloadLimit(): void {
    this.toastService.info('Clearing download limit.');
    this.qbService.setDownloadLimit(this.serverStoreService.currentServerId() as string, 0, [
      this.hash(),
    ]);
  }
  public clearUploadLimit(): void {
    this.toastService.info('Clearing upload limit.');
    this.qbService.setUploadLimit(this.serverStoreService.currentServerId() as string, 0, [
      this.hash(),
    ]);
  }

  public openShareLimitsModal(): void {
    this.commandBusService.emit({
      type: 'UI_LIMIT_SHARE',
      target: 'torrent',
      hashes: [this.hash()],
    });
  }

  public clearRatioLimit(): void {
    const t = this.torrent()!.data;
    this.qbService.setShareLimits(
      this.serverStoreService.currentServerId() as string,
      [this.hash()],
      -1,
      t.seeding_time_limit,
      t.inactive_seeding_time_limit,
    );
  }

  public clearSeedingTimeLimit(): void {
    const t = this.torrent()!.data;
    this.qbService.setShareLimits(
      this.serverStoreService.currentServerId() as string,
      [this.hash()],
      t.ratio_limit,
      -1,
      t.inactive_seeding_time_limit,
    );
  }

  public clearInactiveSeedingTimeLimit(): void {
    const t = this.torrent()!.data;
    this.qbService.setShareLimits(
      this.serverStoreService.currentServerId() as string,
      [this.hash()],
      t.ratio_limit,
      t.seeding_time_limit,
      -1,
    );
  }

  public forceReannounce(): void {
    this.toastService.info('Reannouncing.');
    this.qbService.reannounceTorrents(this.serverStoreService.currentServerId() as string, [
      this.hash(),
    ]);
  }

  public changeCategory(): void {
    this.commandBusService.emit({
      type: 'UI_SET_TORRENT_CATEGORY',
      torrent: this.torrent()!.data,
    });
  }

  public removeCategory(): void {
    this.toastService.info('Removing category.');
    this.qbService.clearTorrentsCategory(this.serverStoreService.currentServerId() as string, [
      this.hash(),
    ]);
  }

  public changeTags(): void {
    this.commandBusService.emit({ type: 'UI_SET_TORRENT_TAGS', torrent: this.torrent()!.data });
  }

  public removeAllTags(): void {
    this.toastService.info('Removing all tags.');
    this.qbService.removeTorrentTags(
      this.serverStoreService.currentServerId() as string,
      [this.hash()],
      this.torrent()!
        .data.tags.split(',')
        .map((t) => t.trim()),
    );
  }

  public setLocation(): void {
    this.commandBusService.emit({
      type: 'UI_SET_TORRENT_LOCATION',
      torrent: this.torrent()!.data,
    });
  }

  public openPath(): void {
    const remotePath = this.torrent()?.data.content_path;
    const hash = this.hash();

    if (!remotePath) {
      this.toastService.danger('Failed to resolve local path!');
      return;
    }

    this.commandBusService.emit({ type: 'UI_OPEN_DESTINATION', remotePath, hash });
  }

  public deleteTorrent(): void {
    this.commandBusService.emit({ type: 'UI_TORRENT_DELETE_REQUEST' });
  }

  public toClipboard(field: string, value: string): void {
    this.toastService.info(`Copied ${field} to clipboard.`);
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
}
