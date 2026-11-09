import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { UnsavedChangesGuardable } from '../../guards/unsaved-changes.guard';
import { MenuBarCommandHandlerService } from '../../services/menu-bar-command-handler.service';
import { ToastService } from '../../services/toast.service';
import { SettingsShell } from '../settings-shell/settings-shell';
import { SettingsActionDef } from '../settings-shell/settings-shell.model';
import { GeneralSettingsFormService } from './general-settings-form.service';
import {
  MOBILE_SETTINGS_BASE_PATH,
  MOBILE_SETTINGS_PAGE_CONFIG,
} from './mobile-settings-page.config';
import { ServerSettingsFormService } from './server-settings-form.service';
import { SETTINGS_PAGE_BASE_PATH, SETTINGS_PAGE_CONFIG } from './settings-page.config';
import { SettingsStateService } from './settings-state.service';

@Component({
  selector: 'app-settings-page',
  imports: [SettingsShell],
  providers: [SettingsStateService, GeneralSettingsFormService, ServerSettingsFormService],
  templateUrl: './settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements UnsavedChangesGuardable {
  private readonly route = inject(ActivatedRoute);
  private readonly isMobilePage = this.route.snapshot.data['settings'] === 'mobile';

  public readonly basePath = this.isMobilePage
    ? MOBILE_SETTINGS_BASE_PATH
    : SETTINGS_PAGE_BASE_PATH;
  public readonly config = this.isMobilePage ? MOBILE_SETTINGS_PAGE_CONFIG : SETTINGS_PAGE_CONFIG;
  public readonly stateService = inject(SettingsStateService);

  private readonly generalForm = inject(GeneralSettingsFormService);
  private readonly serverForm = inject(ServerSettingsFormService);
  private readonly router = inject(Router);
  private readonly menuBarCommandHandler = inject(MenuBarCommandHandlerService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  /** Panes that share a form are marked individually, by the sections they own. */
  public readonly paneDirtyMap = computed<Record<string, boolean>>(() => ({
    ...this.generalForm.paneDirty(),
    ...this.serverForm.paneDirty(),
  }));

  private readonly paneParam = toSignal(this.route.paramMap.pipe(map((p) => p.get('pane'))), {
    initialValue: null,
  });

  private readonly paneIds = this.config.groups.flatMap((group) =>
    group.panes.map((pane) => pane.id),
  );

  public readonly activePaneId = computed<string>(() => {
    const id = this.paneParam();
    return this.paneIds.find((paneId) => paneId === id) ?? this.paneIds[0];
  });

  constructor() {
    // These panes keep their edits in the component, so discarding rebuilds them from what is saved.
    for (const paneId of ['status-bar', 'torrent-list-grid'] as const) {
      this.stateService.registerPaneActions(paneId, {
        discard: () => this.stateService.rebuildPane(paneId, paneId),
      });
    }

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

  public onActionRun(action: SettingsActionDef): void {
    this.menuBarCommandHandler.runAction(action.menuAction);
  }

  public onBack(): void {
    void this.router.navigate(['/pages/torrent-list']);
  }
}
