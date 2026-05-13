import { Injectable } from '@angular/core';
import { DEFAULT_PEERS_GRID_SETTINGS, PeersGridSettings } from '../models/peers-grid.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class PeersGridSettingsService extends BaseSettingsService<PeersGridSettings> {
  protected readonly SETTINGS_ID = 'PeersGridSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_PEERS_GRID_SETTINGS;
}
