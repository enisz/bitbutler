import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  async get<T>(id: string): Promise<T | null> {
    return window.bitbutler.settings.get({ id });
  }

  async set(id: string, value: unknown): Promise<void> {
    await window.bitbutler.settings.upsert({ id, value });
  }

  async delete(id: string): Promise<void> {
    await window.bitbutler.settings.delete({ id });
  }
}
