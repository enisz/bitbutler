import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { QbSettingsTabComponent } from '../qb-settings.interface';

interface ContentLayoutOption {
  value: string;
  label: string;
}

interface TmmOption {
  value: boolean;
  label: string;
}

@Component({
  selector: 'app-qb-settings-storage',
  imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe],
  templateUrl: './storage.html',
  styleUrl: './storage.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Storage implements QbSettingsTabComponent, OnInit {
  private readonly stateService = inject(QbSettingsStateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);

  public readonly hasTempPath = computed(
    () => 'temp_path_enabled' in (this.stateService.preferences() ?? {}),
  );

  public readonly hasContentLayout = computed(
    () => 'torrent_content_layout' in (this.stateService.preferences() ?? {}),
  );

  public readonly contentLayouts: ContentLayoutOption[] = [
    {
      value: 'Original',
      label: this.translateService.instant('pages.qb-settings.tab.storage.content-layout.original'),
    },
    {
      value: 'Subfolder',
      label: this.translateService.instant(
        'pages.qb-settings.tab.storage.content-layout.subfolder',
      ),
    },
    {
      value: 'NoSubfolder',
      label: this.translateService.instant(
        'pages.qb-settings.tab.storage.content-layout.no-subfolder',
      ),
    },
  ];

  public readonly autoTmmModes: TmmOption[] = [
    {
      value: true,
      label: this.translateService.instant('pages.qb-settings.tab.storage.tmm-mode.automatic'),
    },
    {
      value: false,
      label: this.translateService.instant('pages.qb-settings.tab.storage.tmm-mode.manual'),
    },
  ];

  // qBittorrent's *_changed_tmm_enabled prefs: false = relocate the torrent, true = switch it to Manual mode
  public readonly tmmChangeBehaviors: TmmOption[] = [
    {
      value: false,
      label: this.translateService.instant('pages.qb-settings.tab.storage.tmm-behavior.relocate'),
    },
    {
      value: true,
      label: this.translateService.instant('pages.qb-settings.tab.storage.tmm-behavior.manual'),
    },
  ];

  public form = new FormGroup({
    save_path: new FormControl<string>('', { nonNullable: true }),
    temp_path_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    temp_path: new FormControl<string>('', { nonNullable: true }),
    incomplete_files_ext: new FormControl<boolean>(false, { nonNullable: true }),
    torrent_content_layout: new FormControl<string>('Original', { nonNullable: true }),
    auto_tmm_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    torrent_changed_tmm_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    category_changed_tmm_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    save_path_changed_tmm_enabled: new FormControl<boolean>(false, { nonNullable: true }),
  });

  public ngOnInit(): void {
    const prefs = this.stateService.preferences();
    if (prefs) {
      this.form.patchValue(
        {
          save_path: prefs.save_path,
          temp_path_enabled: prefs.temp_path_enabled,
          temp_path: prefs.temp_path,
          incomplete_files_ext: prefs.incomplete_files_ext,
          torrent_content_layout: prefs.torrent_content_layout,
          auto_tmm_enabled: prefs.auto_tmm_enabled,
          torrent_changed_tmm_enabled: prefs.torrent_changed_tmm_enabled,
          category_changed_tmm_enabled: prefs.category_changed_tmm_enabled,
          save_path_changed_tmm_enabled: prefs.save_path_changed_tmm_enabled,
        },
        { emitEvent: false },
      );
      this.updateTempPathState(prefs.temp_path_enabled);
    }

    this.stateService.registerSave('storage', () => this.save());

    this.form.controls.temp_path_enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.updateTempPathState(enabled));

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('storage', true));
  }

  private updateTempPathState(enabled: boolean): void {
    enabled
      ? this.form.controls.temp_path.enable({ emitEvent: false })
      : this.form.controls.temp_path.disable({ emitEvent: false });
  }

  private async save(): Promise<void> {
    const v = this.form.getRawValue();
    await this.qbService.setAppPreferences(this.serverStoreService.currentServerId()!, {
      save_path: v.save_path,
      temp_path_enabled: v.temp_path_enabled,
      temp_path: v.temp_path,
      incomplete_files_ext: v.incomplete_files_ext,
      torrent_content_layout: v.torrent_content_layout,
      auto_tmm_enabled: v.auto_tmm_enabled,
      torrent_changed_tmm_enabled: v.torrent_changed_tmm_enabled,
      category_changed_tmm_enabled: v.category_changed_tmm_enabled,
      save_path_changed_tmm_enabled: v.save_path_changed_tmm_enabled,
    });
  }
}
