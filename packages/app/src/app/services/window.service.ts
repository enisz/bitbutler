import { Injectable, NgZone, inject } from '@angular/core';
import type { WindowState } from '@bitbutler/shared';
import { BehaviorSubject, Observable } from 'rxjs';

export type { WindowState };

@Injectable({ providedIn: 'root' })
export class WindowService {
  private readonly zone = inject(NgZone);

  private windowState = new BehaviorSubject<WindowState>({
    height: 0,
    isFullScreen: false,
    isMaximized: false,
    isMinimized: false,
    width: 0,
  });

  constructor() {
    window.bitbutler.window.onStateChange((state: WindowState) => {
      this.zone.run(() => this.windowState.next(state));
    });
  }

  public get state(): WindowState {
    return this.windowState.value;
  }

  public windowStateAsObservable(): Observable<WindowState> {
    return this.windowState.asObservable();
  }

  public async maximize(): Promise<void> {
    await window.bitbutler.window.maximize();
  }

  public async unmaximize(): Promise<void> {
    await window.bitbutler.window.unmaximize();
  }

  public async toggleMaximize(): Promise<void> {
    await window.bitbutler.window.toggleMaximize();
  }

  public async setSize(width: number, height: number): Promise<void> {
    await window.bitbutler.window.setSize(width, height);
  }

  public async setOpenFilesEnabled(enabled: boolean): Promise<{ enabled: boolean }> {
    return await window.bitbutler.window.setOpenFilesEnabled(enabled);
  }
}
