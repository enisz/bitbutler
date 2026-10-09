import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { UnsavedChangesGuardable } from '../../guards/unsaved-changes.guard';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { SettingsShell } from '../settings-shell/settings-shell';
import { SettingsPageStatus } from '../settings-shell/settings-shell.model';
import { QB_SETTINGS_PAGE_BASE_PATH, QB_SETTINGS_PAGE_CONFIG } from './qb-settings-page.config';
import { QbSettingsStateService } from './qb-settings-state.service';
import { QB_SETTINGS_TAB_IDS, QbSettingsPaneId } from './qb-settings.interface';

@Component({
  selector: 'app-qb-settings-page',
  imports: [SettingsShell],
  providers: [QbSettingsStateService],
  templateUrl: './qb-settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QbSettingsPage implements OnInit, UnsavedChangesGuardable {
  public readonly basePath = QB_SETTINGS_PAGE_BASE_PATH;
  public readonly config = QB_SETTINGS_PAGE_CONFIG;
  public readonly stateService = inject(QbSettingsStateService);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);

  public readonly currentServer = this.serverStoreService.currentServer;
  public readonly status = signal<SettingsPageStatus>('loading');
  public readonly paneVersion = signal(0);

  private readonly paneParam = toSignal(this.route.paramMap.pipe(map((p) => p.get('pane'))), {
    initialValue: null,
  });

  public readonly activePaneId = computed<QbSettingsPaneId>(() => {
    const id = this.paneParam();
    return QB_SETTINGS_TAB_IDS.find((paneId) => paneId === id) ?? QB_SETTINGS_TAB_IDS[0];
  });

  constructor() {
    // An unknown or missing :pane lands on the first pane, with the URL corrected to match.
    effect(() => {
      if (this.paneParam() !== this.activePaneId()) {
        void this.router.navigate([this.basePath, this.activePaneId()], { replaceUrl: true });
      }
    });
  }

  public async ngOnInit(): Promise<void> {
    await this.loadPreferences();
  }

  public async onRetry(): Promise<void> {
    this.status.set('loading');
    await this.loadPreferences();
  }

  public async onSave(): Promise<void> {
    try {
      await this.stateService.saveAll();
    } catch (err: unknown) {
      const message =
        (err instanceof Error ? err.message : undefined) ??
        this.translateService.instant('pages.qb-settings.error.save-failed');
      this.toastService.danger(
        message,
        this.translateService.instant('pages.qb-settings.error.save-failed-title'),
      );
      return;
    }

    this.toastService.success(
      this.translateService.instant('pages.qb-settings.success.saved'),
      this.translateService.instant('pages.qb-settings.success.saved-title'),
    );
    // Panes read preferences once when built, so rebuild them from the saved values.
    await this.loadPreferences();
  }

  public async onDiscard(): Promise<void> {
    this.stateService.resetDirty();
    await this.loadPreferences();
  }

  public onBack(): void {
    void this.router.navigate(['/pages/torrent-list']);
  }

  private async loadPreferences(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) {
      this.status.set('error');
      return;
    }

    try {
      this.stateService.setPreferences(await this.qbService.app.preferences(serverId));
      this.paneVersion.update((version) => version + 1);
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }
}
