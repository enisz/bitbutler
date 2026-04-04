import { Clipboard } from '@angular/cdk/clipboard';
import { OverlayRef } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslatePipe } from '@ngx-translate/core';
import { CommandBusService } from '../../../../services/command-bus.service';
import { CONTEXT_MENU_CONFIG } from './context-menu.tokens';
import type { ContextMenuConfig, ContextMenuEntry } from './context-menu.types';

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, TranslatePipe],
  templateUrl: './context-menu.html',
  styleUrl: './context-menu.scss',
})
export class ContextMenu {
  private readonly overlayRef = inject(OverlayRef);
  readonly config = inject<ContextMenuConfig<any>>(CONTEXT_MENU_CONFIG);
  private readonly clipboard = inject(Clipboard);
  private readonly commandBus = inject(CommandBusService);

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

    this.close();
  }

  trackBy(i: number, e: ContextMenuEntry): string {
    if (e.kind === 'item') return `item:${e.id}`;
    if (e.kind === 'header') return `header:${e.label}`;
    return `divider:${i}`;
  }

  copy(value: string): void {
    this.clipboard.copy(value);
  }

  emit(cmd: any): void {
    this.commandBus.emit(cmd);
  }
}
