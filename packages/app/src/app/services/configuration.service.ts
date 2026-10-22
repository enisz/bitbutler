import { Injectable, inject } from '@angular/core';
import { BbcImportResult } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { ToastService } from './toast.service';

const PENDING_IMPORT_KEY = 'bb.configImported';

@Injectable({ providedIn: 'root' })
export class ConfigurationService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public async pickAndImport(): Promise<void> {
    const bbcPath = await window.bitbutler.config.openPicker();
    if (bbcPath) this.commandBusService.emit({ type: 'UI_IMPORT_CONFIGURATION', bbcPath });
  }

  // The renderer reloads after an import so every settings service and the server store re-read
  // the database. The counts survive the reload in sessionStorage for the confirmation toast.
  public finishImport(result: BbcImportResult): void {
    try {
      sessionStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(result));
    } catch {
      // storage unavailable - the reload still happens, only the toast is lost
    }
    this.reloadWindow();
  }

  public consumeImportToast(): BbcImportResult | null {
    try {
      const raw = sessionStorage.getItem(PENDING_IMPORT_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(PENDING_IMPORT_KEY);
      const parsed = JSON.parse(raw) as BbcImportResult;
      return typeof parsed.settings === 'boolean' && typeof parsed.servers === 'number'
        ? parsed
        : null;
    } catch {
      return null;
    }
  }

  // After the reload the language may not be loaded yet: get() waits for it, instant() would
  // return the bare keys.
  public showImportedToastIfPending(): void {
    const result = this.consumeImportToast();
    if (!result) return;

    const base = 'services.configuration.success';
    this.translateService
      .get([`${base}.imported-title`, `${base}.settings`, `${base}.servers`], {
        count: result.servers,
      })
      .pipe(take(1))
      .subscribe((texts: Record<string, string>) => {
        const parts: string[] = [];
        if (result.settings) parts.push(texts[`${base}.settings`]);
        if (result.servers > 0) parts.push(texts[`${base}.servers`]);
        this.toastService.success(parts.join(', '), texts[`${base}.imported-title`]);
      });
  }

  protected reloadWindow(): void {
    window.location.reload();
  }
}
