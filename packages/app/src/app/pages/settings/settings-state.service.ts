import { Injectable } from '@angular/core';
import { PaneStateService } from '../settings-shell/pane-state.service';
import { SETTINGS_FORM_IDS, SettingsFormId } from './settings.interface';

@Injectable()
export class SettingsStateService extends PaneStateService<SettingsFormId> {
  constructor() {
    super(SETTINGS_FORM_IDS);
  }
}
