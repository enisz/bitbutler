import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import {
  faCalendarAlt,
  faCodeBranch,
  faExternalLinkAlt,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../directives/autofocus';
import { LocalTimestampPipe } from '../../pipes/local-timestamp-pipe';
import { ElectronService } from '../../services/electron.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-about',
  imports: [LocalTimestampPipe, AutofocusDirective, FontAwesomeModule, TranslatePipe],
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
    faExternalLinkAlt,
    faCalendarAlt,
    faCodeBranch,
  };

  public version = this.electronService.getBitButlerVersion();
  public commit = this.electronService.getBitButlerCommit();
  public releaseDate = this.electronService.getBitButlerReleaseDate();
  public readonly logoUrl = computed(
    () => `assets/images/bitbutler-logo-${this.themeService.family()}.png`,
  );

  public openExternalUrl(url: string): void {
    this.electronService.openExternalUrl(url);
  }

  public goToRelease(): void {
    this.electronService.goToRelease();
  }

  public goToCommit(): void {
    this.electronService.goToCommit();
  }
}
