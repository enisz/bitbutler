import { Injectable, inject } from '@angular/core';
import type { ExportTorrentFileItem } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class TorrentExportService {
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public async exportTorrentFiles(items: ExportTorrentFileItem[]): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const title = this.translateService.instant(
      'pages.main.grid.context-menu.toast.export-failed-title',
    );

    try {
      const result = await window.bitbutler.export.saveTorrentFiles({ serverId, items });
      if (result.failed.length > 0) {
        this.toastService.danger(
          this.translateService.instant('pages.main.grid.context-menu.toast.export-failed-count', {
            failed: result.failed.length,
            total: items.length,
          }),
          title,
        );
      }
    } catch (err: unknown) {
      this.toastService.danger(this.describeExportError(err), title);
    }
  }

  private describeExportError(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') {
      try {
        const parsed = JSON.parse(err) as { status?: number; statusText?: string };
        if (parsed?.statusText) {
          return parsed.status ? `${parsed.status} ${parsed.statusText}` : parsed.statusText;
        }
      } catch {
        // not JSON - fall through to returning the raw string
      }
      return err;
    }
    return String(err);
  }
}
