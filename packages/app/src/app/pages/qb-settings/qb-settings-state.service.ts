import { Injectable, signal } from '@angular/core';
import { QbAppPreferences } from '../../models/qbittorrent.model';
import { PaneStateService } from '../settings-shell/pane-state.service';
import { QB_SETTINGS_TAB_IDS, QbSettingsTabId } from './qb-settings.interface';

@Injectable()
export class QbSettingsStateService extends PaneStateService<QbSettingsTabId> {
  private readonly _preferences = signal<QbAppPreferences | null>(null);

  public readonly preferences = this._preferences.asReadonly();

  constructor() {
    super(QB_SETTINGS_TAB_IDS);
  }

  public setPreferences(prefs: QbAppPreferences): void {
    this._preferences.set(prefs);
  }
}
