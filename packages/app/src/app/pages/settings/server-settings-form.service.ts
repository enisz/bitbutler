import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { from, switchMap } from 'rxjs';
import { ServerSettings } from '../../models/server-settings.model';
import { QbService } from '../../services/qb.service';
import { ServerSettingsService } from '../../services/server-settings.service';
import { ServerStoreService } from '../../services/server-store.service';
import { hasChangedSections } from '../settings-shell/section-changed';
import { SettingsStateService } from './settings-state.service';

/**
 * Owns the per-server form shared by the Polling and Path Mappings panes. It reloads (and
 * clears its dirty flag) whenever the current server changes.
 */
@Injectable()
export class ServerSettingsFormService {
  private readonly serverSettingsService = inject(ServerSettingsService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly stateService = inject(SettingsStateService);
  private readonly qbService = inject(QbService);
  private readonly destroyRef = inject(DestroyRef);

  private loadToken = 0;

  public readonly defaultRemotePath = signal('');
  public readonly loaded = signal(false);

  public readonly form = new FormGroup({
    polling: new FormGroup({
      foreground: new FormControl(2000, { nonNullable: true }),
      background: new FormControl(5000, { nonNullable: true }),
    }),
    pathMappings: new FormArray([
      new FormGroup({
        remote: new FormControl<string | null>(null),
        local: new FormControl('', { nonNullable: true }),
      }),
    ]),
  });

  private readonly formSnapshot = signal(this.form.getRawValue());
  /** The last loaded or saved values; panes count as changed when their sections differ. */
  private readonly baseline = signal(this.form.getRawValue());

  public readonly paneDirty = computed(() => {
    const current = this.formSnapshot();
    const baseline = this.baseline();
    return {
      polling: hasChangedSections(current, baseline, ['polling']),
      'path-mappings': hasChangedSections(current, baseline, ['pathMappings']),
    };
  });

  constructor() {
    this.stateService.registerSave('server', () => this.save());

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formSnapshot.set(this.form.getRawValue());
      this.stateService.markDirty('server', Object.values(this.paneDirty()).some(Boolean));
    });

    toObservable(this.serverStoreService.currentServerId)
      .pipe(
        switchMap(() => from(this.load())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public async load(): Promise<void> {
    const token = ++this.loadToken;
    const settings: ServerSettings = await this.serverSettingsService.reload();
    if (token !== this.loadToken) return;

    const { pathMappings, ...rest } = settings;
    this.form.patchValue(rest, { emitEvent: false });

    const mappingsArray = this.form.controls.pathMappings;
    mappingsArray.clear({ emitEvent: false });
    const mappings = pathMappings?.length ? pathMappings : [{ remote: '', local: '' }];
    mappings.forEach((mapping) => {
      mappingsArray.push(
        new FormGroup({
          remote: new FormControl<string | null>(mapping.remote || null),
          local: new FormControl(mapping.local, { nonNullable: true }),
        }),
        { emitEvent: false },
      );
    });

    this.formSnapshot.set(this.form.getRawValue());
    this.baseline.set(this.formSnapshot());
    this.loaded.set(true);
    this.stateService.markDirty('server', false);
    this.loadDefaultRemotePath();
  }

  public async save(): Promise<void> {
    const raw = this.form.getRawValue() as ServerSettings;
    const settings: ServerSettings = {
      ...raw,
      pathMappings: raw.pathMappings.map((m) => ({
        remote: m.remote || this.defaultRemotePath(),
        local: m.local,
      })),
    };
    await this.serverSettingsService.save(settings);
    this.baseline.set(this.form.getRawValue());
  }

  private loadDefaultRemotePath(): void {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    this.qbService.app
      .preferences(serverId)
      .then((prefs) => {
        if (prefs.save_path) this.defaultRemotePath.set(prefs.save_path);
      })
      .catch(() => {});
  }
}
