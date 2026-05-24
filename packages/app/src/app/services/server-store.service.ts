import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { ServerRecord } from '@bitbutler/shared';
import { ServerService } from './server.service';

@Injectable({ providedIn: 'root' })
export class ServerStoreService {
  private readonly serverService = inject(ServerService);

  private readonly STORAGE_KEY = 'bb.currentServerId';
  private readonly SUPPRESS_AUTOLOGIN_KEY = 'bb.suppressAutoLogin';

  readonly servers = signal<ServerRecord[]>([]);
  readonly loading = signal(false);
  readonly currentServerId = signal<string | null>(this.loadSavedServerId());

  readonly currentServer = computed(() => {
    const id = this.currentServerId();
    if (!id) return null;
    return this.servers().find((s) => s.id === id) ?? null;
  });

  constructor() {
    effect(() => {
      const id = this.currentServerId();
      if (id) {
        localStorage.setItem(this.STORAGE_KEY, id);
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
      }
      window.bitbutler.server.setActive(id);
    });
  }

  suppressAutoLoginUntilManualConnect(): void {
    sessionStorage.setItem(this.SUPPRESS_AUTOLOGIN_KEY, '1');
  }

  clearAutoLoginSuppression(): void {
    sessionStorage.removeItem(this.SUPPRESS_AUTOLOGIN_KEY);
  }

  isAutoLoginSuppressed(): boolean {
    return sessionStorage.getItem(this.SUPPRESS_AUTOLOGIN_KEY) === '1';
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.serverService.list();
      this.servers.set(list);
      const curId = this.currentServerId();

      if (curId && !list.some((s) => s.id === curId)) {
        const autoLoginServer = list.find((s) => s.auto_login);
        const nextId = autoLoginServer?.id || (list.length > 0 ? list[0].id : null);

        this.select(nextId);
      } else if (!curId && list.length > 0) {
        this.select(list[0].id);
      }
    } finally {
      this.loading.set(false);
    }
  }

  select(id: string | null): void {
    this.currentServerId.set(id);
  }

  clearSelection(): void {
    this.select(null);
  }

  private loadSavedServerId(): string | null {
    return localStorage.getItem(this.STORAGE_KEY);
  }
}
