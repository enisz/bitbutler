import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { HostPlatform, Release, ReleaseAsset, UpdateCheckResponse } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowUpRightFromSquare,
  faBan,
  faCloudArrowDown,
  faDownload,
  faForward,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbAccordionModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MarkdownComponent } from 'ngx-markdown';
import { TimeagoPipe } from 'ngx-timeago';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbCallout } from '../../components/bb-callout/bb-callout';
import { BbProgress } from '../../components/bb-progress/bb-progress';
import { normalizeVersionTag } from '../../models/update-settings.model';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { formatBytes } from '../../pipes/format-bytes';
import { LocalTimestampPipe } from '../../pipes/local-timestamp-pipe';
import { ElectronService } from '../../services/electron.service';
import { ToastService } from '../../services/toast.service';
import { UpdateSettingsService } from '../../services/update-settings.service';
import { UpdaterService } from '../../services/updater.service';

@Component({
  selector: 'app-update-available',
  standalone: true,
  imports: [
    CommonModule,
    FontAwesomeModule,
    NgbAccordionModule,
    MarkdownComponent,
    FilesizePipe,
    LocalTimestampPipe,
    TimeagoPipe,
    TranslatePipe,
    BbBtnContent,
    BbCallout,
    BbProgress,
  ],
  templateUrl: './update-available.html',
  styleUrl: './update-available.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateAvailable {
  public readonly icons = {
    faDownload,
    faForward,
    faXmark,
    faCloudArrowDown,
    faTriangleExclamation,
    faArrowUpRightFromSquare,
    faBan,
  };
  public readonly update = input.required<UpdateCheckResponse>();
  public readonly activeModal = inject(NgbActiveModal);
  private readonly electronService = inject(ElectronService);
  private readonly updateSettingsService = inject(UpdateSettingsService);
  public readonly updaterService = inject(UpdaterService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public activeReleaseId = signal<string | null>(null);
  public readonly platform = signal<HostPlatform | null>(null);

  private readonly platformExtensions: Partial<Record<HostPlatform, string[]>> = {
    win32: ['.exe', '.zip'],
    linux: ['.appimage', '.deb', '.rpm', '.snap', '.tar.gz'],
  };

  private readonly osLabels: Partial<Record<HostPlatform, string>> = {
    win32: 'Windows',
    darwin: 'macOS',
    linux: 'Linux',
  };

  public readonly osLabel = computed<string | null>(() => {
    const platform = this.platform();
    return platform ? (this.osLabels[platform] ?? null) : null;
  });

  public readonly currentVersion = computed<string | null>(() => {
    const version = this.update().currentVersion;
    return version ? normalizeVersionTag(version) : null;
  });

  public readonly behindCount = computed(() => this.update().releases?.length ?? 0);

  public readonly filteredAssets = computed<ReleaseAsset[]>(() => {
    const assets = this.latestRelease?.assets ?? [];
    const platform = this.platform();
    const extensions = platform ? this.platformExtensions[platform] : undefined;
    if (!extensions) {
      return assets;
    }

    const matched = assets.filter((asset) =>
      extensions.some((ext) => asset.name.toLowerCase().endsWith(ext)),
    );
    return matched.length > 0 ? matched : assets;
  });

  public readonly showUpdateNow = computed(
    () => this.updaterService.capability()?.supported === true,
  );

  public readonly isUpdating = computed(() => {
    const status = this.updaterService.status();
    return status === 'checking' || status === 'downloading';
  });

  public readonly footerLocked = computed(() => {
    const status = this.updaterService.status();
    return status === 'checking' || status === 'downloading' || status === 'downloaded';
  });

  // The full footer is replaced by the progress row + Cancel button while an
  // update the user started from this modal is checking or downloading -
  // isUpdating() alone isn't enough since it doesn't require showUpdateNow(),
  // and this row only makes sense for the self-update flow.
  public readonly showProgressFooter = computed(() => this.showUpdateNow() && this.isUpdating());

  public readonly downloadingAssetName = computed(() => this.filteredAssets()[0]?.name ?? '');

  public readonly progressLabel = computed(() => Math.round(this.updaterService.progress()));

  public readonly transferredLabel = computed(() => formatBytes(this.updaterService.transferred()));
  public readonly totalLabel = computed(() => formatBytes(this.updaterService.total()));

  constructor() {
    // Only reset when no update flow is already in flight - UpdaterService is
    // a root singleton, so resetting unconditionally would clobber a live
    // 'checking'/'downloading'/'downloaded' status back to 'idle' if this
    // modal is ever reconstructed while an update is still running.
    const currentStatus = this.updaterService.status();
    if (currentStatus === 'idle' || currentStatus === 'error') {
      this.updaterService.reset();
    }

    effect(() => {
      const first = this.update().releases?.[0]?.id;
      if (first !== undefined && this.activeReleaseId() === null) {
        this.activeReleaseId.set(this.itemId(first));
      }
    });

    effect(() => {
      if (this.updaterService.status() !== 'error') {
        return;
      }
      const message = this.updaterService.errorMessage();
      if (!message) {
        return;
      }
      this.toastService.danger(
        message,
        this.translateService.instant(
          'components.modals.update-available.toast.update-failed-title',
        ),
      );
    });

    this.electronService.getPlatform().then((platform) => this.platform.set(platform));
  }

  get latestRelease(): Release | undefined {
    return this.update().releases?.[0];
  }

  public itemId(id: number): string {
    return `release-${id}`;
  }

  public cleanedBody(release: Release): string {
    const body = release.body || '';
    return body.replace(/^#+\s*What's\s*Changed\s*\r?\n/i, '').trim();
  }

  public getVersion(version: string): string {
    return normalizeVersionTag(version);
  }

  public toMs(dateStr: string | null | undefined): number {
    const ms = dateStr ? new Date(dateStr).getTime() : 0;
    return isNaN(ms) ? 0 : ms;
  }

  public downloadAsset(url: string): void {
    this.electronService.openExternalUrl(url);
  }

  public viewAllReleases(): void {
    this.electronService.openExternalUrl('https://github.com/enisz/bitbutler/releases');
  }

  public updateNow(): void {
    this.updaterService.updateNow();
  }

  public cancelDownload(): void {
    this.updaterService.cancelDownload();
  }

  public async skipVersions(): Promise<void> {
    const release = this.latestRelease;
    if (release) {
      await this.updateSettingsService.save({
        skippedVersion: normalizeVersionTag(release.tag_name),
      });
    }
    this.activeModal.close('skip');
  }
}
