import { Injectable, computed, signal } from '@angular/core';
import { SettingsTabId } from './settings.interface';

type DirtyMap = Record<SettingsTabId, boolean>;

const INITIAL_DIRTY: DirtyMap = {
  general: false,
  server: false,
  'torrent-list-grid': false,
  'status-bar': false,
};

@Injectable()
export class SettingsStateService {
  private readonly _dirtyTabs = signal<DirtyMap>({ ...INITIAL_DIRTY });
  private readonly saveFns = new Map<SettingsTabId, () => Promise<void>>();

  public readonly isDirty = computed(() => Object.values(this._dirtyTabs()).some(Boolean));
  public readonly isDirtyMap = this._dirtyTabs.asReadonly();

  public markDirty(id: SettingsTabId, dirty: boolean): void {
    this._dirtyTabs.update((tabs) => ({ ...tabs, [id]: dirty }));
  }

  public registerSave(id: SettingsTabId, fn: () => Promise<void>): void {
    this.saveFns.set(id, fn);
  }

  public resetDirty(): void {
    this._dirtyTabs.set({ ...INITIAL_DIRTY });
  }

  public async saveAll(): Promise<void> {
    const dirty = this._dirtyTabs();
    await Promise.all(
      (Object.keys(dirty) as SettingsTabId[])
        .filter((id) => dirty[id])
        .map((id) => this.saveFns.get(id)?.() ?? Promise.resolve()),
    );
    this.resetDirty();
  }
}
