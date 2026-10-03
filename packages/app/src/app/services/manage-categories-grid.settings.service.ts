import { Injectable } from '@angular/core';
import {
  DEFAULT_MANAGE_CATEGORIES_GRID_SETTINGS,
  ManageCategoriesGridSettings,
} from '../models/manage-categories-grid.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class ManageCategoriesGridSettingsService extends BaseSettingsService<ManageCategoriesGridSettings> {
  protected readonly SETTINGS_ID = 'ManageCategoriesGridSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_MANAGE_CATEGORIES_GRID_SETTINGS;
}
