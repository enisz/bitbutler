import {
  ChangeDetectionStrategy,
  Component,
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
import { ToastService } from '../../services/toast.service';
import { SettingsShell } from '../settings-shell/settings-shell';
import { GeneralSettingsFormService } from './general-settings-form.service';
import { ServerSettingsFormService } from './server-settings-form.service';
import { SETTINGS_PAGE_BASE_PATH, SETTINGS_PAGE_CONFIG } from './settings-page.config';
import { SettingsStateService } from './settings-state.service';
import { SETTINGS_PANE_IDS, SettingsPaneId } from './settings.interface';

@Component({
  selector: 'app-settings-page',
  imports: [SettingsShell],
  providers: [SettingsStateService, GeneralSettingsFormService, ServerSettingsFormService],
  templateUrl: './settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements UnsavedChangesGuardable {
  public readonly basePath = SETTINGS_PAGE_BASE_PATH;
  public readonly config = SETTINGS_PAGE_CONFIG;
  public readonly stateService = inject(SettingsStateService);

  private readonly generalForm = inject(GeneralSettingsFormService);
  private readonly serverForm = inject(ServerSettingsFormService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public readonly paneVersion = signal(0);

  /** Panes that share a form are marked individually, by the sections they own. */
  public readonly paneDirtyMap = computed<Record<string, boolean>>(() => ({
    ...this.generalForm.paneDirty(),
    ...this.serverForm.paneDirty(),
  }));

  private readonly paneParam = toSignal(this.route.paramMap.pipe(map((p) => p.get('pane'))), {
    initialValue: null,
  });

  public readonly activePaneId = computed<SettingsPaneId>(() => {
    const id = this.paneParam();
    return SETTINGS_PANE_IDS.find((paneId) => paneId === id) ?? SETTINGS_PANE_IDS[0];
  });

  constructor() {
    // An unknown or missing :pane lands on the first pane, with the URL corrected to match.
    effect(() => {
      if (this.paneParam() !== this.activePaneId()) {
        void this.router.navigate([this.basePath, this.activePaneId()], { replaceUrl: true });
      }
    });
  }

  public async onSave(): Promise<void> {
    try {
      await this.stateService.saveAll();
      this.toastService.success(
        this.translateService.instant('pages.settings.success.saved'),
        this.translateService.instant('pages.settings.success.saved-title'),
      );
    } catch (err: unknown) {
      const message =
        (err instanceof Error ? err.message : undefined) ??
        this.translateService.instant('pages.settings.error.save-failed');
      this.toastService.danger(
        message,
        this.translateService.instant('pages.settings.error.save-failed-title'),
      );
    }
  }

  public async onDiscard(): Promise<void> {
    await Promise.all([this.generalForm.discard(), this.serverForm.load()]);
    this.stateService.resetDirty();
    // Panes that own their form (grid, status bar) re-read their persisted values on rebuild.
    this.paneVersion.update((version) => version + 1);
  }

  public onBack(): void {
    void this.router.navigate(['/pages/torrent-list']);
  }
}
