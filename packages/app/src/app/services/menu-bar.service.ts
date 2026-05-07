import { Injectable, NgZone, inject } from '@angular/core';
import type { MenuClickPayload } from '@bitbutler/shared';
import { Subject } from 'rxjs';

export type MenuClick = MenuClickPayload;

@Injectable({ providedIn: 'root' })
export class MenuBarService {
  private zone = inject(NgZone);

  private readonly _clicks = new Subject<MenuClick>();
  readonly clicks$ = this._clicks.asObservable();

  constructor() {
    if (window?.bitbutler?.menu?.onClick) {
      window.bitbutler.menu.onClick((p: MenuClick) => {
        this.zone.run(() => this._clicks.next(p));
      });
    }
  }
}
