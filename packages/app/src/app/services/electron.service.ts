import { Injectable, inject } from '@angular/core';
import { HostPlatform, UpdateCheckResponse } from '@bitbutler/shared';
import pkg from '../../../package.json';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private readonly toastService = inject(ToastService);

  public isDev(): Promise<boolean> {
    return window.bitbutler.electron.isDev();
  }

  public openExternalUrl(url: string): void {
    window.bitbutler.electron.openExternalUrl(url);
  }

  public showOpenDialog(): Promise<string> {
    return window.bitbutler.electron.showOpenDialog();
  }

  public openPath(path: string): Promise<string> {
    return window.bitbutler.electron.openPath(path);
  }

  public showItemInFolder(path: string): Promise<void> {
    return window.bitbutler.electron.showItemInFolder(path);
  }

  public getBitButlerVersion(): string | null {
    return pkg.version ?? null;
  }

  public getBitButlerCommit(short?: boolean): string | null {
    const commit = (pkg as any).release?.commit;
    if (!commit) return null;
    return short ? commit.slice(0, 7) : commit;
  }

  public getBitButlerReleaseDate(): number | null {
    return (pkg as any).release?.date ?? null;
  }

  public getPlatform(): Promise<HostPlatform> {
    return window.bitbutler.electron.getPlatform();
  }

  public goToRelease(): void {
    return this.openExternalUrl(
      `https://github.com/enisz/bitbutler/releases/tag/v${this.getBitButlerVersion()}`,
    );
  }

  public goToCommit(): void {
    return this.openExternalUrl(
      `https://github.com/enisz/bitbutler/commit/${this.getBitButlerCommit()}`,
    );
  }

  public checkForUpdate(): Promise<UpdateCheckResponse> {
    return window.bitbutler.electron.checkForUpdate();
  }
}
