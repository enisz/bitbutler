import { Injectable, signal } from '@angular/core';
import type { WindowState } from '@bitbutler/shared';

export type { WindowState };

@Injectable({ providedIn: 'root' })
export class WindowService {
  private readonly _state = signal<WindowState>({
    height: 0,
    isFullScreen: false,
    isMaximized: false,
    isMinimized: false,
    width: 0,
  });

  readonly state = this._state.asReadonly();

  constructor() {
    window.bitbutler.window.onStateChange((state: WindowState) => {
      this._state.set(state);
    });
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
