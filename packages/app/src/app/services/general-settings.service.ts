import { Injectable } from '@angular/core';
import { DEFAULT_GENERAL_SETTINGS, GeneralSettings } from '../models/general-settings.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class GeneralSettingsService extends BaseSettingsService<GeneralSettings> {
  protected readonly SETTINGS_ID = GeneralSettingsService.name;
  protected readonly DEFAULT_SETTINGS = DEFAULT_GENERAL_SETTINGS;
}
