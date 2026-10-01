import { Injectable } from '@angular/core';
import {
  DEFAULT_MANAGE_SERVERS_GRID_SETTINGS,
  ManageServersGridSettings,
} from '../models/manage-servers-grid.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class ManageServersGridSettingsService extends BaseSettingsService<ManageServersGridSettings> {
  protected readonly SETTINGS_ID = 'ManageServersGridSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_MANAGE_SERVERS_GRID_SETTINGS;
}
