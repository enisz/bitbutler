import { Clipboard } from '@angular/cdk/clipboard';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { CommonModule } from '@angular/common';
import { Component, Injector, OnDestroy, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { fromEvent } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommandBusService } from '../../../../services/command-bus.service';
import { CANCEL_ANCESTOR_CLOSE, CLOSE_ROOT, CONTEXT_MENU_CONFIG } from './context-menu.tokens';
import type { ContextMenuConfig, ContextMenuEntry } from './context-menu.types';

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, TranslatePipe],
  templateUrl: './context-menu.html',
  styleUrl: './context-menu.scss',
})
export class ContextMenu implements OnDestroy {
  private readonly overlayRef = inject(OverlayRef);
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  readonly config = inject<ContextMenuConfig<any>>(CONTEXT_MENU_CONFIG);
  private readonly clipboard = inject(Clipboard);
  private readonly commandBus = inject(CommandBusService);

  private readonly cancelAncestorClose = inject(CANCEL_ANCESTOR_CLOSE, { optional: true });

  private readonly closeRoot = inject(CLOSE_ROOT, { optional: true });

  readonly faChevronRight = faChevronRight;
  readonly activeSubmenuId = signal<string | null>(null);

  private childOverlayRef?: OverlayRef;
  private openTimer?: ReturnType<typeof setTimeout>;
  private closeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.overlayRef
      .detachments()
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.disposeChild());
  }

  get items(): ContextMenuEntry[] {
    return this.config.items;
  }

  close(): void {
    this.overlayRef.dispose();
  }

  onEntryClick(entry: ContextMenuEntry): void {
    if (entry.kind !== 'item' || entry.disabled) {
      return;
    }

    if (typeof entry.action === 'function') {
      entry.action();
    } else if (entry.action) {
      this.commandBus.emit(entry.action);
    }

    (this.closeRoot ?? (() => this.close()))();
  }

  onSubmenuEnter(
    entry: Extract<ContextMenuEntry, { kind: 'submenu' }>,
    triggerEl: HTMLElement,
  ): void {
    clearTimeout(this.openTimer);
    clearTimeout(this.closeTimer);
    if (entry.disabled) return;
    this.openTimer = setTimeout(() => {
      this.disposeChild();

      const positionStrategy = this.overlay
        .position()
        .flexibleConnectedTo(triggerEl)
        .withPositions([
          { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top' },
          { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top' },
        ])
        .withPush(true)
        .withViewportMargin(8)
        .withFlexibleDimensions(false);

      this.childOverlayRef = this.overlay.create({
        positionStrategy,
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
        panelClass: 'bb-context-menu-panel',
      });

      fromEvent(this.childOverlayRef.overlayElement, 'mouseenter')
        .pipe(takeUntil(this.childOverlayRef.detachments()))
        .subscribe(() => {
          clearTimeout(this.closeTimer);

          this.cancelAncestorClose?.();
        });
      fromEvent(this.childOverlayRef.overlayElement, 'mouseleave')
        .pipe(takeUntil(this.childOverlayRef.detachments()))
        .subscribe(() => {
          this.closeTimer = setTimeout(() => this.disposeChild(), 150);
        });

      const cancelThisAndAncestors = () => {
        clearTimeout(this.closeTimer);
        this.cancelAncestorClose?.();
      };

      const inj = Injector.create({
        parent: this.injector,
        providers: [
          { provide: CONTEXT_MENU_CONFIG, useValue: { items: entry.children } },
          { provide: OverlayRef, useValue: this.childOverlayRef },
          { provide: CANCEL_ANCESTOR_CLOSE, useValue: cancelThisAndAncestors },
          { provide: CLOSE_ROOT, useValue: this.closeRoot ?? (() => this.close()) },
        ],
      });

      this.childOverlayRef.attach(new ComponentPortal(ContextMenu, null, inj));
      this.activeSubmenuId.set(entry.id);
    }, 150);
  }

  onSubmenuLeave(): void {
    clearTimeout(this.openTimer);
    this.closeTimer = setTimeout(() => this.disposeChild(), 150);
  }

  private disposeChild(): void {
    clearTimeout(this.openTimer);
    clearTimeout(this.closeTimer);
    this.childOverlayRef?.dispose();
    this.childOverlayRef = undefined;
    this.activeSubmenuId.set(null);
  }

  trackBy(i: number, e: ContextMenuEntry): string {
    if (e.kind === 'item') return `item:${e.id}`;
    if (e.kind === 'submenu') return `submenu:${e.id}`;
    if (e.kind === 'header') return `header:${e.label}`;
    return `divider:${i}`;
  }

  ngOnDestroy(): void {
    this.disposeChild();
  }

  copy(value: string): void {
    this.clipboard.copy(value);
  }

  emit(cmd: any): void {
    this.commandBus.emit(cmd);
  }

  protected readonly asHtmlElement = (el: EventTarget | null): HTMLElement => el as HTMLElement;
}
