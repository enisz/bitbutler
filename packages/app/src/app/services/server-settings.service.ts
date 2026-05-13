import { Injectable, effect, inject } from '@angular/core';
import { DEFAULT_SERVER_SETTINGS, ServerSettings } from '../models/server-settings.model';
import { BaseSettingsService } from './base-settings.service';
import { ServerStoreService } from './server-store.service';

@Injectable({ providedIn: 'root' })
export class ServerSettingsService extends BaseSettingsService<ServerSettings> {
  private readonly serverStoreService = inject(ServerStoreService);
  protected get SETTINGS_ID(): string {
    return ['ServerSettingsService', this.serverStoreService.currentServerId()].join('.');
  }
  protected readonly DEFAULT_SETTINGS = DEFAULT_SERVER_SETTINGS;

  constructor() {
    super();
    effect(() => {
      this.serverStoreService.currentServerId();
      () => void this.reload();
    });
  }

  protected override normalize(s: ServerSettings): ServerSettings {
    const trim = (v: string | null) => (v ?? '').trim();

    const normalizedMappings = (s.pathMappings ?? [])
      .map((m) => ({
        remote: trim(m.remote),
        local: trim(m.local),
      }))
      .filter((m) => m.remote && m.local);

    return {
      ...s,
      pathMappings: normalizedMappings,
    };
  }
}
