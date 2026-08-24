import { Injectable, signal } from '@angular/core';
import type { UpdateCapability, UpdaterEvent } from '@bitbutler/shared';

export type UpdaterStatus = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error';

@Injectable({ providedIn: 'root' })
export class UpdaterService {
  private readonly _capability = signal<UpdateCapability | null>(null);
  private readonly _status = signal<UpdaterStatus>('idle');
  private readonly _progress = signal<number>(0);
  private readonly _transferred = signal<number>(0);
  private readonly _total = signal<number>(0);
  private readonly _errorMessage = signal<string | null>(null);

  readonly capability = this._capability.asReadonly();
  readonly status = this._status.asReadonly();
  readonly progress = this._progress.asReadonly();
  readonly transferred = this._transferred.asReadonly();
  readonly total = this._total.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();

  constructor() {
    window.bitbutler.updater.onEvent((event: UpdaterEvent) => this.applyEvent(event));
    window.bitbutler.updater.getCapability().then((capability) => this._capability.set(capability));
  }

  public updateNow(): void {
    this.reset();
    this._status.set('checking');
    void window.bitbutler.updater.updateNow();
  }

  public reset(): void {
    this._status.set('idle');
    this._progress.set(0);
    this._transferred.set(0);
    this._total.set(0);
    this._errorMessage.set(null);
  }

  private applyEvent(event: UpdaterEvent): void {
    switch (event.status) {
      case 'checking':
        this._status.set('checking');
        break;
      case 'downloading':
        this._status.set('downloading');
        this._progress.set(event.percent);
        this._transferred.set(event.transferred);
        this._total.set(event.total);
        break;
      case 'downloaded':
        this._status.set('downloaded');
        break;
      case 'error':
        this._status.set('error');
        this._errorMessage.set(event.message);
        break;
    }
  }
}
