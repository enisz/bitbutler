import {
  ConnectedPosition,
  FlexibleConnectedPositionStrategyOrigin,
  Overlay,
  OverlayRef,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Injectable, Injector, OnDestroy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { ContextMenu } from '../pages/main/grid/context-menu/context-menu';
import { CONTEXT_MENU_CONFIG } from '../pages/main/grid/context-menu/context-menu.tokens';
import type {
  ContextMenuConfig,
  ContextMenuPosition,
} from '../pages/main/grid/context-menu/context-menu.types';

const posBottomRight: ConnectedPosition = {
  originX: 'start',
  originY: 'top',
  overlayX: 'start',
  overlayY: 'top',
};
const posBottomLeft: ConnectedPosition = {
  originX: 'start',
  originY: 'top',
  overlayX: 'end',
  overlayY: 'top',
};
const posTopRight: ConnectedPosition = {
  originX: 'start',
  originY: 'top',
  overlayX: 'start',
  overlayY: 'bottom',
};
const posTopLeft: ConnectedPosition = {
  originX: 'start',
  originY: 'top',
  overlayX: 'end',
  overlayY: 'bottom',
};

const MENU_POSITIONS: Record<ContextMenuPosition, ConnectedPosition[]> = {
  bottomRight: [posBottomRight, posBottomLeft, posTopRight, posTopLeft],
  bottomLeft: [posBottomLeft, posBottomRight, posTopLeft, posTopRight],
  topRight: [posTopRight, posTopLeft, posBottomRight, posBottomLeft],
  topLeft: [posTopLeft, posTopRight, posBottomLeft, posBottomRight],
};

@Injectable({ providedIn: 'root' })
export class ContextMenuService implements OnDestroy {
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);

  private overlayRef?: OverlayRef;
  private lastMousePosition = { x: 0, y: 0 };

  constructor() {
    fromEvent<MouseEvent>(document, 'contextmenu', { capture: true })
      .pipe(takeUntilDestroyed())
      .subscribe((event: MouseEvent) => {
        if (this.overlayRef?.hasAttached()) {
          this.close();
          event.preventDefault();
          event.stopPropagation();
        } else {
          this.lastMousePosition = { x: event.clientX, y: event.clientY };
        }
      });
  }

  public ngOnDestroy(): void {
    this.close();
  }

  public close(): void {
    this.overlayRef?.dispose();
    this.overlayRef = undefined;
  }

  public openAt<TPayload>(
    x: number,
    y: number,
    config: ContextMenuConfig<TPayload>,
    position?: ContextMenuPosition,
  ): void {
    this.lastMousePosition = { x, y };
    this.open(config, position);
  }

  public open<TPayload>(
    config: ContextMenuConfig<TPayload>,
    position: ContextMenuPosition = 'bottomRight',
  ): void {
    this.close();

    const { x, y } = this.lastMousePosition;
    const origin: FlexibleConnectedPositionStrategyOrigin = { x, y };

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(origin)
      .withPositions(MENU_POSITIONS[position])
      .withPush(true)
      .withViewportMargin(8)
      .withFlexibleDimensions(false);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      panelClass: 'bb-context-menu-panel',
    });

    this.overlayRef.backdropClick().subscribe(() => this.close());
    this.overlayRef.keydownEvents().subscribe((e) => {
      if (e.key === 'Escape') this.close();
    });

    const inj = Injector.create({
      parent: this.injector,
      providers: [
        { provide: CONTEXT_MENU_CONFIG, useValue: config },
        { provide: OverlayRef, useValue: this.overlayRef },
      ],
    });

    this.overlayRef.attach(new ComponentPortal(ContextMenu, null, inj));
  }
}
