import { Injectable } from '@angular/core';
import type { LogEntry } from '@bitbutler/shared';

@Injectable({ providedIn: 'root' })
export class LogService {
  async list(): Promise<LogEntry[]> {
    return window.bitbutler.log.list();
  }

  async clear(): Promise<void> {
    await window.bitbutler.log.clear();
  }
}
