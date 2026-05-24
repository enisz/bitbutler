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
import { TranslatePipe } from '@ngx-translate/core';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { QbSettingsTabComponent } from '../qb-settings.interface';

@Component({
  selector: 'app-qb-settings-queue-limits',
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './queue-limits.html',
  styleUrl: './queue-limits.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueueLimits implements QbSettingsTabComponent, OnInit {
  private readonly stateService = inject(QbSettingsStateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly hasAddToTop = computed(
    () => 'add_to_top_of_queue' in (this.stateService.preferences() ?? {}),
  );

  public form = new FormGroup({
    queueing_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    max_active_downloads: new FormControl<number>(5, { nonNullable: true }),
    max_active_uploads: new FormControl<number>(5, { nonNullable: true }),
    max_active_torrents: new FormControl<number>(10, { nonNullable: true }),
    add_to_top_of_queue: new FormControl<boolean>(false, { nonNullable: true }),
  });

  public ngOnInit(): void {
    const prefs = this.stateService.preferences();
    if (prefs) {
      this.form.patchValue(
        {
          queueing_enabled: prefs.queueing_enabled,
          max_active_downloads: prefs.max_active_downloads,
          max_active_uploads: prefs.max_active_uploads,
          max_active_torrents: prefs.max_active_torrents,
          add_to_top_of_queue: prefs.add_to_top_of_queue,
        },
        { emitEvent: false },
      );
      this.updateQueueingState(prefs.queueing_enabled);
    }

    this.stateService.registerSave('queue-limits', () => this.save());

    this.form.controls.queueing_enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.updateQueueingState(enabled));

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('queue-limits', true));
  }

  private updateQueueingState(enabled: boolean): void {
    const subControls = [
      this.form.controls.max_active_downloads,
      this.form.controls.max_active_uploads,
      this.form.controls.max_active_torrents,
    ];
    subControls.forEach((c) =>
      enabled ? c.enable({ emitEvent: false }) : c.disable({ emitEvent: false }),
    );
  }

  private async save(): Promise<void> {
    const v = this.form.getRawValue();
    await this.qbService.setAppPreferences(this.serverStoreService.currentServerId()!, {
      queueing_enabled: v.queueing_enabled,
      max_active_downloads: v.max_active_downloads,
      max_active_uploads: v.max_active_uploads,
      max_active_torrents: v.max_active_torrents,
      add_to_top_of_queue: v.add_to_top_of_queue,
    });
  }
}
