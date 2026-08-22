import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCircle,
  faClock,
  faCloudDownloadAlt,
  faCloudUploadAlt,
  faDownload,
  faHdd,
  faNetworkWired,
  faPause,
  faPlay,
  faShareAlt,
  faTachometerAlt,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { animationFrameScheduler, interval, map, switchMap } from 'rxjs';
import { QbServerState } from '../../../models/torrent.model';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { CommandBusService } from '../../../services/command-bus.service';
import { GridViewStoreService } from '../../../services/grid-view-store.service';
import { QbPollingService } from '../../../services/qb-polling.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { StatusBarSettingsService } from '../../../services/status-bar-settings.service';

export enum MouseClickButton {
  LEFT = 0,
  RIGHT = 2,
}

@Component({
  selector: 'app-server-state',
  standalone: true,
  imports: [FontAwesomeModule, CommonModule, FilesizePipe, NgbTooltipModule, TranslatePipe],
  templateUrl: './server-state.html',
  styleUrl: './server-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerState {
  readonly state = input<QbServerState | null>(null);

  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly gridViewStoreService = inject(GridViewStoreService);
  private readonly statusbarSettingsService = inject(StatusBarSettingsService);
  private readonly pollingService = inject(QbPollingService);
  private readonly commandBusService = inject(CommandBusService);

  public settings = toSignal(this.statusbarSettingsService.asObservable());

  @ViewChild('tipRatioGlobal') tipRatioGlobal!: TemplateRef<unknown>;
  @ViewChild('tipGlobalDl') tipGlobalDl!: TemplateRef<unknown>;
  @ViewChild('tipGlobalUl') tipGlobalUl!: TemplateRef<unknown>;
  @ViewChild('tipLiveDl') tipLiveDl!: TemplateRef<unknown>;
  @ViewChild('tipLiveUl') tipLiveUl!: TemplateRef<unknown>;
  @ViewChild('tipAlltimeRatio') tipAlltimeRatio!: TemplateRef<unknown>;
  @ViewChild('tipAlltimeDl') tipAlltimeDl!: TemplateRef<unknown>;
  @ViewChild('tipAlltimeUl') tipAlltimeUl!: TemplateRef<unknown>;

  public diskSpace = signal<bigint>(0n);
  public dlSpeed = signal<bigint>(0n);
  public upSpeed = signal<bigint>(0n);
  public dlLimit = signal<bigint>(0n);
  public upLimit = signal<bigint>(0n);
  public allTimeDl = signal<bigint>(0n);
  public allTimeUl = signal<bigint>(0n);
  public dhtNodes = signal<number>(0);
  public connectionStatus = signal<string>('offline');
  public sessionRatio = signal<string>('0.00');
  public globalRatio = signal<string>('0.00');
  public useAltSpeedLimits = signal(false);
  public pollProgress = signal<number>(0);
  public selectedCount = computed(() => this.selectionStoreService.selected()?.length ?? 0);
  public filteredCount = this.gridViewStoreService.filteredCount;
  public pollingInterval = signal<string>(
    (this.pollingService.getPollingInterval() / 1000).toString(),
  );

  public isPaused = toSignal(this.pollingService.isPaused$, { initialValue: false });
  private _pauseToken: symbol | null = null;

  public icons = {
    faDownload,
    faHdd,
    faUpload,
    faCloudDownloadAlt,
    faCloudUploadAlt,
    faShareAlt,
    faNetworkWired,
    faCircle,
    faTachometerAlt,
    faClock,
    faPlay,
    faPause,
  };

  constructor() {
    effect(() => {
      const patch = this.state();
      if (!patch) {
        this.reset();
        return;
      }
      this.applyIfPresentBigInt(patch, 'free_space_on_disk', this.diskSpace);
      this.applyIfPresentBigInt(patch, 'dl_info_speed', this.dlSpeed);
      this.applyIfPresentBigInt(patch, 'up_info_speed', this.upSpeed);
      this.applyIfPresentBigInt(patch, 'dl_rate_limit', this.dlLimit);
      this.applyIfPresentBigInt(patch, 'up_rate_limit', this.upLimit);
      this.applyIfPresentBigInt(patch, 'alltime_dl', this.allTimeDl);
      this.applyIfPresentBigInt(patch, 'alltime_ul', this.allTimeUl);

      if ('connection_status' in patch)
        this.connectionStatus.set(String(patch['connection_status'] || 'offline'));
      if ('dht_nodes' in patch) this.dhtNodes.set(Number(patch['dht_nodes']) || 0);
      if ('global_ratio' in patch) this.globalRatio.set(String(patch['global_ratio'] || '0.00'));
      if ('use_alt_speed_limits' in patch)
        this.useAltSpeedLimits.set(Boolean(patch['use_alt_speed_limits']));

      const sDl = Number(patch['dl_info_data'] || 0);
      const sUl = Number(patch['up_info_data'] || 0);
      this.sessionRatio.set(sDl > 0 ? (sUl / sDl).toFixed(2) : '0.00');
    });

    effect(() => {
      if (this.isPaused()) this.pollProgress.set(0);
    });

    this.pollingService.onPoll$
      .pipe(
        takeUntilDestroyed(),
        switchMap(() => {
          const startTime = Date.now();
          const duration = this.pollingService.getPollingInterval();
          return interval(0, animationFrameScheduler).pipe(
            map(() => Math.min(((Date.now() - startTime) / duration) * 100, 100)),
          );
        }),
      )
      .subscribe((progress) => this.pollProgress.set(progress));
  }

  public togglePolling(): void {
    if (this.isPaused()) {
      if (this._pauseToken) this.pollingService.resume(this._pauseToken);
      this._pauseToken = null;
    } else {
      this._pauseToken = this.pollingService.pause();
    }
  }

  public toggleAlternativeSpeedLimit(): void {
    this.commandBusService.emit({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
  }

  public setGlobalTransferLimit(): void {
    this.commandBusService.emit({ type: 'UI_LIMIT_TRANSFER', target: 'global' });
  }

  public setGlobalShareLimit(): void {
    this.commandBusService.emit({ type: 'UI_LIMIT_SHARE', target: 'global' });
  }

  public onBottomBarWheel(event: WheelEvent): void {
    // Trackpad swipes already report deltaX and scroll natively; only redirect
    // a vertical mouse-wheel scroll into horizontal movement.
    if (event.deltaY === 0 || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

    const el = event.currentTarget as HTMLElement;
    if (el.scrollWidth <= el.clientWidth) return;

    event.preventDefault();
    el.scrollLeft += event.deltaY;
  }

  private reset(): void {
    this.diskSpace.set(0n);
    this.dlSpeed.set(0n);
    this.upSpeed.set(0n);
    this.allTimeDl.set(0n);
    this.allTimeUl.set(0n);
    this.dhtNodes.set(0);
    this.connectionStatus.set('offline');
    this.sessionRatio.set('0.00');
    this.globalRatio.set('0.00');
    this.useAltSpeedLimits.set(false);
  }

  private applyIfPresentBigInt(
    obj: QbServerState,
    key: string,
    target: { set(v: bigint): void },
  ): void {
    if (obj[key] != null) target.set(BigInt(Math.trunc(Number(obj[key]))));
  }
}
