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
import { Release, UpdateCheckResponse } from '@bitbutler/shared';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbAccordionModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { MarkdownComponent } from 'ngx-markdown';
import { TimeagoPipe } from 'ngx-timeago';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { ElectronService } from '../../services/electron.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-update-available',
  standalone: true,
  imports: [
    CommonModule,
    NgbAccordionModule,
    MarkdownComponent,
    FilesizePipe,
    TimeagoPipe,
    TranslatePipe,
    BbBtnContent,
  ],
  templateUrl: './update-available.html',
  styleUrl: './update-available.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateAvailable {
  private readonly themeService = inject(ThemeService);

  public readonly icons = { faGithub, faXmark };
  public readonly update = input.required<UpdateCheckResponse>();
  public readonly activeModal = inject(NgbActiveModal);
  private readonly electronService = inject(ElectronService);
  public readonly logoUrl = computed(
    () => `assets/images/bitbutler-logo-${this.themeService.family()}.png`,
  );

  public activeReleaseId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const first = this.update().releases?.[0]?.id;
      if (first !== undefined && this.activeReleaseId() === null) {
        this.activeReleaseId.set(this.itemId(first));
      }
    });
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
    return version.replace(/^v/, '');
  }

  public toMs(dateStr: string | null | undefined): number {
    const ms = dateStr ? new Date(dateStr).getTime() : 0;
    return isNaN(ms) ? 0 : ms;
  }

  public downloadAsset(url: string): void {
    this.electronService.openExternalUrl(url);
  }
}
