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
import { faDownload, faForward, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbAccordionModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { MarkdownComponent } from 'ngx-markdown';
import { TimeagoPipe } from 'ngx-timeago';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { normalizeVersionTag } from '../../models/update-settings.model';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { LocalTimestampPipe } from '../../pipes/local-timestamp-pipe';
import { ElectronService } from '../../services/electron.service';
import { UpdateSettingsService } from '../../services/update-settings.service';

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
  ],
  templateUrl: './update-available.html',
  styleUrl: './update-available.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateAvailable {
  public readonly icons = { faDownload, faForward, faXmark };
  public readonly update = input.required<UpdateCheckResponse>();
  public readonly activeModal = inject(NgbActiveModal);
  private readonly electronService = inject(ElectronService);
  private readonly updateSettingsService = inject(UpdateSettingsService);

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

  constructor() {
    effect(() => {
      const first = this.update().releases?.[0]?.id;
      if (first !== undefined && this.activeReleaseId() === null) {
        this.activeReleaseId.set(this.itemId(first));
      }
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
