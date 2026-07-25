import { Injectable } from '@angular/core';
import {
  AddTorrentGridSettings,
  DEFAULT_ADD_TORRENT_GRID_SETTINGS,
} from '../models/add-torrent-grid.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class AddTorrentGridSettingsService extends BaseSettingsService<AddTorrentGridSettings> {
  protected readonly SETTINGS_ID = 'AddTorrentGridSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_ADD_TORRENT_GRID_SETTINGS;
}
