import { Injectable, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import type { GridApi } from 'ag-grid-community';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';

@Injectable()
export class GridKeyboardNavService {
  private readonly commandBusService = inject(CommandBusService);
  private readonly modalService = inject(NgbModal);

  private api: GridApi<Torrent> | null = null;
  private _anchorIndex: number | null = null;
  private _leadIndex: number | null = null;

  get anchorIndex(): number | null {
    return this._anchorIndex;
  }
  set anchorIndex(v: number | null) {
    this._anchorIndex = v;
  }

  get leadIndex(): number | null {
    return this._leadIndex;
  }
  set leadIndex(v: number | null) {
    this._leadIndex = v;
  }

  init(api: GridApi<Torrent>): void {
    this.api = api;
  }

  onKeyUp(event: KeyboardEvent): void {
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
    this.handleGridSelectAll(event);
    this.handleGridKeyboardSelection(event);
    this.handleStartStopForceResume(event);
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
  }

  private handleGridSelectAll(event: KeyboardEvent): void {
    const { ctrlKey, code } = event;
    if (!(ctrlKey && code === 'KeyA') || this.isTypingTarget(event.target)) return;
    event.preventDefault();
    this.api?.forEachNodeAfterFilter((node) => {
      if (node.displayed) node.setSelected(true, false);
    });
  }

  private handleGridKeyboardSelection(event: KeyboardEvent): void {
    const { code, shiftKey, ctrlKey } = event;
    const isNavKey = [
      'ArrowDown',
      'ArrowUp',
      'Home',
      'End',
      'PageDown',
      'PageUp',
      'Enter',
    ].includes(code);
    if (!isNavKey || this.isTypingTarget(event.target)) return;

    const api = this.api;
    if (!api) return;

    const selectedNodes = api.getSelectedNodes();
    let leadIndex =
      this._leadIndex ??
      (selectedNodes.length ? selectedNodes[selectedNodes.length - 1].rowIndex : null);
    if (leadIndex == null) return;

    const nextIndex = this.computeNextDisplayedIndex(api, code, leadIndex);
    if (nextIndex == null || nextIndex === leadIndex) return;

    const nextNode = api.getDisplayedRowAtIndex(nextIndex);
    if (!nextNode) return;

    event.preventDefault();
    const colId = api.getAllDisplayedColumns()?.[0]?.getColId();

    if (shiftKey) {
      if (this._anchorIndex == null) this._anchorIndex = leadIndex;
      this._leadIndex = nextIndex;
      const start = Math.min(this._anchorIndex, this._leadIndex);
      const end = Math.max(this._anchorIndex, this._leadIndex);
      if (!ctrlKey) api.deselectAll();
      for (let i = start; i <= end; i++) api.getDisplayedRowAtIndex(i)?.setSelected(true);
    } else if (!ctrlKey) {
      api.deselectAll();
      nextNode.setSelected(true, true);
      this._anchorIndex = nextIndex;
      this._leadIndex = nextIndex;
    }

    if (colId) api.setFocusedCell(nextIndex, colId);
    api.ensureIndexVisible(nextIndex);
  }

  private handleStartStopForceResume(event: KeyboardEvent): void {
    const { code, ctrlKey, shiftKey } = event;
    if (ctrlKey || this.isTypingTarget(event.target)) return;

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

  private computeNextDisplayedIndex(api: GridApi, code: string, leadIndex: number): number | null {
    const rowCount = api.getDisplayedRowCount();
    if (rowCount <= 0) return null;
    const clamp = (i: number) => Math.max(0, Math.min(i, rowCount - 1));
    switch (code) {
      case 'ArrowDown':
        return clamp(leadIndex + 1);
      case 'ArrowUp':
        return clamp(leadIndex - 1);
      case 'Home':
        return 0;
      case 'End':
        return rowCount - 1;
      case 'PageDown':
        return clamp(leadIndex + this.getApproxPageSize(api));
      case 'PageUp':
        return clamp(leadIndex - this.getApproxPageSize(api));
      default:
        return null;
    }
  }

  private getApproxPageSize(api: any): number {
    const rowHeight = 32;
    const viewportHeight = api.gridBodyCtrl?.eBodyViewport?.clientHeight ?? 400;
    return Math.max(1, Math.floor(viewportHeight / rowHeight) - 1);
  }
}
