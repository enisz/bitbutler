import { Injectable, computed, signal } from '@angular/core';
import { QbAppPreferences } from '../../models/qbittorrent.model';
import { QbSettingsTabId } from './qb-settings.interface';

type DirtyMap = Record<QbSettingsTabId, boolean>;

const INITIAL_DIRTY: DirtyMap = {
  bandwidth: false,
  storage: false,
  'queue-limits': false,
  'seeding-ratios': false,
};

@Injectable()
export class QbSettingsStateService {
  private readonly _preferences = signal<QbAppPreferences | null>(null);
  private readonly _dirtyTabs = signal<DirtyMap>({ ...INITIAL_DIRTY });
  private readonly saveFns = new Map<QbSettingsTabId, () => Promise<void>>();

  public readonly preferences = this._preferences.asReadonly();
  public readonly isDirty = computed(() => Object.values(this._dirtyTabs()).some(Boolean));
  public readonly isDirtyMap = this._dirtyTabs.asReadonly();

  public setPreferences(prefs: QbAppPreferences): void {
    this._preferences.set(prefs);
  }

  public markDirty(id: QbSettingsTabId, dirty: boolean): void {
    this._dirtyTabs.update((tabs) => ({ ...tabs, [id]: dirty }));
  }

  public registerSave(id: QbSettingsTabId, fn: () => Promise<void>): void {
    this.saveFns.set(id, fn);
  }

  public resetDirty(): void {
    this._dirtyTabs.set({ ...INITIAL_DIRTY });
  }

  public async saveAll(): Promise<void> {
    const dirty = this._dirtyTabs();
    await Promise.all(
      (Object.keys(dirty) as QbSettingsTabId[])
        .filter((id) => dirty[id])
        .map((id) => this.saveFns.get(id)?.() ?? Promise.resolve()),
    );
    this.resetDirty();
  }
}
