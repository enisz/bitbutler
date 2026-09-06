import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import type { LogEntry } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSquare, faSquareCheck } from '@fortawesome/free-regular-svg-icons';
import {
  faArrowsRotate,
  faChevronLeft,
  faFileExport,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { ConfirmService } from '../../services/confirm.service';
import { LogGridSettingsService } from '../../services/log-grid.settings.service';
import { LogService } from '../../services/log.service';
import { ToastService } from '../../services/toast.service';
import { LogsGrid } from './logs-grid/logs-grid';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [FontAwesomeModule, NgbTooltipModule, TranslateModule, LogsGrid],
  templateUrl: './logs.html',
  styleUrl: './logs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logs implements OnInit {
  private readonly router = inject(Router);
  private readonly logService = inject(LogService);
  private readonly logGridSettingsService = inject(LogGridSettingsService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public readonly icons = {
    faChevronLeft,
    faArrowsRotate,
    faTrashCan,
    faSquare,
    faSquareCheck,
    faFileExport,
  };
  public readonly logs = signal<LogEntry[]>([]);
  public readonly colorCodingEnabled = toSignal(
    this.logGridSettingsService.asObservable().pipe(
      map((s) => s.colorCodingEnabled),
      distinctUntilChanged(),
    ),
    { initialValue: false },
  );

  public compact = false;

  @HostListener('window:resize')
  onResize(): void {
    this.updateCompact();
  }

  async ngOnInit(): Promise<void> {
    this.updateCompact();
    await this.refresh();
  }

  private updateCompact(): void {
    this.compact = window.matchMedia('(max-width: 1920px)').matches;
  }

  goBack(): void {
    void this.router.navigate(['/pages/torrent-list']);
  }

  async refresh(): Promise<void> {
    try {
      this.logs.set(await this.logService.list());
    } catch (error) {
      this.toastService.danger(
        String(error),
        this.translateService.instant('pages.logs.toast.refresh-failed.title'),
      );
    }
  }

  async clear(): Promise<void> {
    const confirmed = await this.confirmService.confirm(
      'pages.logs.clear-confirm.title',
      'pages.logs.clear-confirm.message',
      'general.button.clear',
      undefined,
      undefined,
      faTrashCan,
    );
    if (!confirmed) return;

    try {
      await this.logService.clear();
      await this.refresh();
    } catch (error) {
      this.toastService.danger(
        String(error),
        this.translateService.instant('pages.logs.toast.clear-failed.title'),
      );
    }
  }

  async toggleColorCoding(): Promise<void> {
    const settings = await firstValueFrom(this.logGridSettingsService.asObservable());
    await this.logGridSettingsService.save({
      ...settings,
      colorCodingEnabled: !settings.colorCodingEnabled,
    });
  }
}
