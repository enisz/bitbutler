import { Injectable, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import type { GridApi } from 'ag-grid-community';
import { firstValueFrom } from 'rxjs';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentListGridSettingsService } from '../../../services/torrent-list-grid.settings.service';

const QUEUE_HOTKEYS: Record<
  string,
  'QUEUE_MOVE_TOP' | 'QUEUE_MOVE_UP' | 'QUEUE_MOVE_DOWN' | 'QUEUE_MOVE_BOTTOM'
> = {
  Home: 'QUEUE_MOVE_TOP',
  ArrowUp: 'QUEUE_MOVE_UP',
  ArrowDown: 'QUEUE_MOVE_DOWN',
  End: 'QUEUE_MOVE_BOTTOM',
};

@Injectable()
export class GridKeyboardNavService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly modalService = inject(NgbModal);
  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly torrentListGridSettingsService = inject(TorrentListGridSettingsService);

  private api: GridApi<Torrent> | null = null;
  init(api: GridApi<Torrent>): void {
    this.api = api;
  }

  onKeyUp(event: KeyboardEvent): void {
    if (this.modalService.hasOpenModals()) return;
    const { shiftKey, code, target } = event;
    if (code === 'Delete' && !this.isTypingTarget(target)) {
      this.commandBusService.emit({
        type: 'UI_TORRENT_DELETE_REQUEST',
        defaultRemoveFiles: shiftKey,
      });
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (this.modalService.hasOpenModals()) return;
    this.handleStartStopForceResume(event);
    this.handleRenameHotkey(event);
    this.handleQueueHotkeys(event);
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
  }

  private handleStartStopForceResume(event: KeyboardEvent): void {
    const { code, ctrlKey, altKey, shiftKey } = event;
    if (ctrlKey || altKey || this.isTypingTarget(event.target)) return;

    if (code === 'F3' && shiftKey) {
      event.preventDefault();
      this.commandBusService.emit({ type: 'TORRENT_FORCE_RESUME' });
    } else if (code === 'F3') {
      event.preventDefault();
      this.commandBusService.emit({ type: 'TORRENT_RESUME' });
    } else if (code === 'F4' && !shiftKey) {
      event.preventDefault();
      this.commandBusService.emit({ type: 'TORRENT_PAUSE' });
    }
  }

  private handleQueueHotkeys(event: KeyboardEvent): void {
    const { code, ctrlKey, metaKey, altKey, shiftKey } = event;
    if (!(ctrlKey || metaKey) || altKey || shiftKey || this.isTypingTarget(event.target)) return;

    const type = QUEUE_HOTKEYS[code];
    if (!type || this.selectionStoreService.selected().length === 0) return;

    event.preventDefault();
    this.commandBusService.emit({ type });
  }

  private handleRenameHotkey(event: KeyboardEvent): void {
    const { code, ctrlKey, altKey, shiftKey } = event;
    if (code !== 'F2' || ctrlKey || altKey || shiftKey || this.isTypingTarget(event.target)) {
      return;
    }

    const selected = this.selectionStoreService.selected();
    if (selected.length !== 1) return;

    event.preventDefault();
    void this.renameSelectedTorrent(selected[0]);
  }

  private async renameSelectedTorrent(torrent: Torrent): Promise<void> {
    const settings = await firstValueFrom(this.torrentListGridSettingsService.asObservable());
    const inlineEditEnabled = (settings?.rowDoubleClickAction ?? 'DETAILS') === 'INLINE_EDIT';

    if (inlineEditEnabled && this.api) {
      const nameHidden = this.api.getColumnState().find((c) => c.colId === 'name')?.hide === true;
      const rowIndex = this.api.getSelectedNodes()[0]?.rowIndex;

      if (!nameHidden && rowIndex != null) {
        this.api.ensureIndexVisible(rowIndex);
        this.api.setFocusedCell(rowIndex, 'name');
        this.api.startEditingCell({ rowIndex, colKey: 'name' });
        return;
      }
    }

    this.commandBusService.emit({ type: 'UI_RENAME_TORRENT', torrent });
  }
}
