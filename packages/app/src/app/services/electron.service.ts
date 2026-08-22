import { Injectable, inject } from '@angular/core';
import { HostPlatform, UpdateCheckResponse } from '@bitbutler/shared';
import pkg from '../../../package.json';
import { ToastService } from './toast.service';

// Stamped onto packages/app/package.json at release time by a build script (see
// .github/workflows/release.yml: `npm pkg set release.commit/release.date`), so it is not part of
// package.json's normal, statically-known shape.
type PackageRelease = {
  commit?: string;
  date?: number;
};

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
    const commit = this.getPackageRelease()?.commit;
    if (!commit) return null;
    return short ? commit.slice(0, 7) : commit;
  }

  public getBitButlerReleaseDate(): number | null {
    return this.getPackageRelease()?.date ?? null;
  }

  private getPackageRelease(): PackageRelease | undefined {
    // `npm pkg set` (used to stamp this field at release time) always writes string values, but
    // `date` is consumed as a unix-seconds number (see about.html: `releaseDate * 1000`), so the
    // declared shape intentionally diverges from the literal JSON's inferred string type.
    return (pkg as unknown as { release?: PackageRelease }).release;
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
