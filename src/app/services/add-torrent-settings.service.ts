import { Injectable, effect, inject } from '@angular/core';
import { AddTorrentSettings, DEFAULT_ADD_TORRENT_SETTINGS } from '../models/add-torrent.model';
import { BaseSettingsService } from './base-settings.service';
import { ServerStoreService } from './server-store.service';

@Injectable({ providedIn: 'root' })
export class AddTorrentSettingsService extends BaseSettingsService<AddTorrentSettings> {
  private readonly serverStoreService = inject(ServerStoreService);
  protected get SETTINGS_ID(): string {
    return [AddTorrentSettingsService.name, this.serverStoreService.currentServerId()].join('.');
  }
  protected readonly DEFAULT_SETTINGS = DEFAULT_ADD_TORRENT_SETTINGS;

  constructor() {
    super();
    effect(() => {
      this.serverStoreService.currentServerId();
      void this.reload();
    });
  }

  protected override normalize(s: AddTorrentSettings): AddTorrentSettings {
    const trimOrNull = (v: string | null) => {
      const t = (v ?? '').trim();
      return t ? t : null;
    };

    return {
      ...s,
      savepath: trimOrNull(s.savepath),
      category: trimOrNull(s.category),
      tags: trimOrNull(s.tags),
    };
  }
}
