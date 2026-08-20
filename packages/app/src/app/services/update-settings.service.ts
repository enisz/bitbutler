import { Injectable } from '@angular/core';
import { DEFAULT_UPDATE_SETTINGS, UpdateSettings } from '../models/update-settings.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class UpdateSettingsService extends BaseSettingsService<UpdateSettings> {
  protected readonly SETTINGS_ID = 'UpdateSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_UPDATE_SETTINGS;
}
