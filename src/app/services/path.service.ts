import { inject, Injectable } from '@angular/core';
import { HostPlatform } from '../models/electron.model';
import { ElectronService } from './electron.service';
import { ServerSettingsService } from './server-settings.service';

@Injectable({ providedIn: 'root' })
export class PathService {
  private readonly serverSettingsService = inject(ServerSettingsService);
  private readonly electronService = inject(ElectronService);

  private platformPromise: Promise<HostPlatform>;

  constructor() {
    this.platformPromise = this.electronService.getPlatform();
  }

  public async resolveLocalPath(remotePath: string | null | undefined): Promise<string | null> {
    if (!remotePath) {
      return null;
    }

    const platform = await this.platformPromise;
    const settings = await this.serverSettingsService.load();
    const pathMappings = settings?.pathMappings ?? [];

    if (!pathMappings.length) {
      return null;
    }

    for (const mapping of pathMappings) {
      if (mapping.remote && mapping.local && remotePath.startsWith(mapping.remote)) {
        let localPath = remotePath.replace(mapping.remote, mapping.local);
        if (platform === 'win32') {
          localPath = localPath.replace(/\\/g, '/');
          if (localPath.startsWith('//')) {
            localPath = '//' + localPath.substring(2).replace(/\/\/+/g, '/');
          } else {
            localPath = localPath.replace(/\/\/+/g, '/');
          }
          localPath = localPath.replace(/\//g, '\\');
        } else {
          localPath = localPath.replace(/\\/g, '/').replace(/\/\/+/g, '/');
        }
        return localPath;
      }
    }

    return null;
  }
}
