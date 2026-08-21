import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faUser, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { AutofocusDirective } from '../../directives/autofocus';
import { LocalTimestampPipe } from '../../pipes/local-timestamp-pipe';
import { ElectronService } from '../../services/electron.service';
import { ThemeService } from '../../services/theme.service';
import { BbBtnContent } from '../bb-btn-content/bb-btn-content';

interface TechStackItem {
  name: string;
  purposeKey: string;
  version: string;
}

@Component({
  selector: 'app-about',
  imports: [LocalTimestampPipe, TimeagoPipe, AutofocusDirective, BbBtnContent, TranslatePipe],
  templateUrl: './about.html',
  styleUrl: './about.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class About {
  public readonly activeModal = inject(NgbActiveModal);
  private readonly themeService = inject(ThemeService);
  private readonly electronService = inject(ElectronService);
  public readonly tagline = 'The Digital Butler for your Torrents';

  public icons = {
    faGithub,
    faUser,
    faXmark,
  };

  public version = this.electronService.getBitButlerVersion();
  public releaseDate = this.electronService.getBitButlerReleaseDate();
  public readonly logoUrl = computed(
    () => `assets/images/bitbutler-logo-${this.themeService.family()}.png`,
  );

  public readonly techStack: TechStackItem[] = [
    { name: 'Angular', purposeKey: 'angular', version: 'v22.1.3' },
    { name: 'Electron', purposeKey: 'electron', version: 'v39.2.5' },
    { name: 'SQLite', purposeKey: 'sqlite', version: 'v12.5.0' },
    { name: 'ag-Grid', purposeKey: 'ag-grid', version: 'v35.0.0' },
    { name: 'TypeScript', purposeKey: 'typescript', version: 'v6.0.0' },
  ];

  public openExternalUrl(url: string): void {
    this.electronService.openExternalUrl(url);
  }

  public goToRelease(): void {
    this.electronService.goToRelease();
  }
}
