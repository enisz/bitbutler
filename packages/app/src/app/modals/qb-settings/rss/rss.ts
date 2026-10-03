import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { QbSettingsTabComponent } from '../qb-settings.interface';

const toWholeAtLeastOne = (value: number): number => Math.max(1, Math.floor(value) || 1);

@Component({
  selector: 'app-qb-settings-rss',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './rss.html',
  styleUrl: './rss.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RssSettings implements QbSettingsTabComponent, OnInit {
  private readonly stateService = inject(QbSettingsStateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);

  public form = new FormGroup({
    rss_processing_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    rss_refresh_interval: new FormControl<number>(30, { nonNullable: true }),
    rss_max_articles_per_feed: new FormControl<number>(50, { nonNullable: true }),
  });

  public ngOnInit(): void {
    const prefs = this.stateService.preferences();
    if (prefs) {
      this.form.patchValue(
        {
          rss_processing_enabled: prefs.rss_processing_enabled,
          rss_refresh_interval: prefs.rss_refresh_interval,
          rss_max_articles_per_feed: prefs.rss_max_articles_per_feed,
        },
        { emitEvent: false },
      );
      this.updateFetchingState(prefs.rss_processing_enabled);
    }

    this.stateService.registerSave('rss', () => this.save());

    this.form.controls.rss_processing_enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.updateFetchingState(enabled));

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('rss', true));
  }

  private updateFetchingState(enabled: boolean): void {
    const dependent = [
      this.form.controls.rss_refresh_interval,
      this.form.controls.rss_max_articles_per_feed,
    ];
    dependent.forEach((control) =>
      enabled ? control.enable({ emitEvent: false }) : control.disable({ emitEvent: false }),
    );
  }

  private async save(): Promise<void> {
    const value = this.form.getRawValue();
    await this.qbService.app.setPreferences(this.serverStoreService.currentServerId()!, {
      rss_processing_enabled: value.rss_processing_enabled,
      rss_refresh_interval: toWholeAtLeastOne(value.rss_refresh_interval),
      rss_max_articles_per_feed: toWholeAtLeastOne(value.rss_max_articles_per_feed),
    });
  }
}
