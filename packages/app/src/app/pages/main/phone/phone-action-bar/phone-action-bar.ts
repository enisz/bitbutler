import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEllipsis, faPause, faPlay, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBottomSheet } from '../../../../components/bb-bottom-sheet/bb-bottom-sheet';
import { CommandBusService } from '../../../../services/command-bus.service';
import { SelectionStoreService } from '../../../../services/selection-store.service';
import { ContextMenuEntry } from '../../grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../grid/context-menu/grid-context-menu.service';
import { buildPhoneMoreEntries } from '../phone-more.utils';

type ItemEntry = Extract<ContextMenuEntry, { kind: 'item' }>;

@Component({
  selector: 'app-phone-action-bar',
  imports: [FontAwesomeModule, TranslatePipe, BbBottomSheet, NgTemplateOutlet],
  providers: [GridContextMenuService],
  templateUrl: './phone-action-bar.html',
  styleUrl: './phone-action-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhoneActionBar {
  private readonly selectionStore = inject(SelectionStoreService);
  private readonly commandBus = inject(CommandBusService);
  private readonly contextMenu = inject(GridContextMenuService);

  public readonly icons = { faPlay, faPause, faTrashCan, faEllipsis };

  public readonly selectionMode = computed(() => this.selectionStore.selected().length > 0);
  public readonly sheetOpen = signal(false);
  public readonly moreEntries = signal<ContextMenuEntry[]>([]);

  public start(): void {
    this.commandBus.emit({ type: 'TORRENT_RESUME' });
  }

  public stop(): void {
    this.commandBus.emit({ type: 'TORRENT_PAUSE' });
  }

  public remove(): void {
    this.commandBus.emit({ type: 'UI_TORRENT_DELETE_REQUEST' });
  }

  public async openMore(): Promise<void> {
    const selected = this.selectionStore.selected();
    if (selected.length === 0) return;
    const entries = await this.contextMenu.buildTorrentMenu({
      row: selected[0],
      selected,
      rowPinned: null,
    });
    this.moreEntries.set(buildPhoneMoreEntries(entries));
    this.sheetOpen.set(true);
  }

  public run(entry: ItemEntry): void {
    if (entry.disabled) return;
    this.sheetOpen.set(false);
    const action = entry.action;
    if (!action) return;
    if (typeof action === 'function') {
      action();
    } else {
      this.commandBus.emit(action);
    }
  }
}
