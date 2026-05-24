import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Release, UpdateCheckResponse } from '@bitbutler/shared';
import { NgbAccordionModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { MarkdownComponent } from 'ngx-markdown';
import { TimeagoPipe } from 'ngx-timeago';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { ElectronService } from '../../../services/electron.service';
import { ThemeService } from '../../../services/theme.service';

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
  ],
  templateUrl: './update-available.html',
  styleUrl: './update-available.scss',
})
export class UpdateAvailable {
  private readonly themeService = inject(ThemeService);

  public update = signal<UpdateCheckResponse | null>(null);
  public readonly activeModal = inject(NgbActiveModal);
  private readonly electronService = inject(ElectronService);
  public readonly logoUrl = computed(
    () => `assets/images/bitbutler-logo-${this.themeService.family()}.png`,
  );

  public readonly isSingleRelease = computed(() => (this.update()?.releases?.length ?? 0) === 1);

  get latestRelease(): Release | undefined {
    return this.update()?.releases?.[0];
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
