import { Injectable } from '@angular/core';
import {
  DEFAULT_MANAGE_TAGS_GRID_SETTINGS,
  ManageTagsGridSettings,
} from '../models/manage-tags-grid.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class ManageTagsGridSettingsService extends BaseSettingsService<ManageTagsGridSettings> {
  protected readonly SETTINGS_ID = 'ManageTagsGridSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_MANAGE_TAGS_GRID_SETTINGS;
}
