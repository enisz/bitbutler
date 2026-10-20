import { DestroyRef, Directive, ElementRef, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import type { GridApi, IRowNode } from 'ag-grid-community';
import { fromEvent } from 'rxjs';

const FALLBACK_ROW_HEIGHT = 32;
const FALLBACK_VIEWPORT_HEIGHT = 400;
/** The scrollable rows area of an ag-grid (without the header and the pager). */
const ROWS_VIEWPORT_SELECTOR = '.ag-body-vertical-scroll-viewport';

/**
 * Operating system like row navigation for every ag-grid with multi-row selection: Arrow,
 * Shift+Arrow, Home/End, PageUp/PageDown and Ctrl+A. Cell focus is suppressed app-wide so
 * ag-grid's own keyboard navigation is not available - this keeps the selection and the
 * anchor/lead rows in sync instead.
 *
 * The directive only reacts while its grid is the active one: the grid the user last clicked,
 * or, until a grid was clicked, the grid of a modal. Clicking anything that is not a grid keeps
 * the active grid. When a modal is open, only a grid in the topmost modal reacts.
 */
@Directive({
  selector: 'ag-grid-angular',
  standalone: true,
})
export class GridRowNavigationDirective {
  private readonly grid = inject(AgGridAngular);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  private api: GridApi | null = null;
  /** `null` until the user clicked a grid or something else took the focus from it. */
  private active: boolean | null = null;

  anchorIndex: number | null = null;
  leadIndex: number | null = null;

  /** The Delete key was pressed while rows are selected in the active grid. */
  readonly gridDelete = output<void>();

  constructor() {
    this.grid.gridReady.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      this.api = event.api;
      this.trackClicks(event.api);
    });

    fromEvent<MouseEvent>(document, 'mousedown', { capture: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const target = event.target;
        if (!(target instanceof Node)) return;

        if (this.elementRef.nativeElement.contains(target)) {
          this.active = true;
        } else if (target instanceof Element && target.closest('ag-grid-angular')) {
          this.active = false;
        }
      });

    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onKeyDown(event));

    // Key up, so holding the key down does not repeat the request.
    fromEvent<KeyboardEvent>(document, 'keyup')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onKeyUp(event));
  }

  private trackClicks(api: GridApi): void {
    api.addEventListener('rowClicked', (event) => {
      const mouseEvent = event.event as MouseEvent | null | undefined;
      if (event.rowIndex !== null && !mouseEvent?.shiftKey) {
        this.anchorIndex = event.rowIndex;
        this.leadIndex = event.rowIndex;
      }
    });

    api.addEventListener('cellClicked', (event) => {
      const mouseEvent = event.event as MouseEvent | null | undefined;
      if (!mouseEvent?.shiftKey || this.anchorIndex === null || event.rowIndex === null) return;
      if (!this.hasClickSelection(api)) return;

      api.deselectAll();
      this.selectRange(api, this.anchorIndex, event.rowIndex);
    });

    // Checkboxes change the selection without a row click - keep the lead row on the last
    // toggled row so the next key press continues from there.
    api.addEventListener('selectionChanged', (event) => {
      if (event.source !== 'checkboxSelected') return;
      const selected = api.getSelectedNodes();
      const last = selected[selected.length - 1]?.rowIndex ?? null;
      this.anchorIndex = last;
      this.leadIndex = last;
    });
  }

  private hasClickSelection(api: GridApi): boolean {
    const selection = api.getGridOption('rowSelection');
    return typeof selection === 'object' && selection.mode === 'multiRow'
      ? selection.enableClickSelection === true ||
          selection.enableClickSelection === 'enableSelection'
      : false;
  }

  private isMultiRow(api: GridApi): boolean {
    const selection = api.getGridOption('rowSelection');
    return typeof selection === 'object' && selection.mode === 'multiRow';
  }

  /** Typing in a field, or using a menu, a popup, a list or tabs - those own the arrow keys. */
  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
      target.isContentEditable ||
      target.closest('.ag-popup, [role="menu"], [role="listbox"], [role="tablist"]') !== null
    );
  }

  /** Whether this grid is allowed to react to the keyboard right now. */
  private isActive(): boolean {
    const element = this.elementRef.nativeElement;
    const active = this.active ?? element.closest('ngb-modal-window') !== null;
    if (!active || !element.isConnected) return false;

    const modals = document.querySelectorAll('ngb-modal-window');
    if (modals.length === 0) return true;
    return modals[modals.length - 1].contains(element);
  }

  private onKeyUp(event: KeyboardEvent): void {
    const { code, shiftKey, ctrlKey, altKey, metaKey } = event;
    if (code !== 'Delete' || shiftKey || ctrlKey || altKey || metaKey) return;

    const api = this.api;
    if (!api || !this.isActive() || !this.isMultiRow(api) || this.isTypingTarget(event.target)) {
      return;
    }
    if (api.getSelectedNodes().length === 0) return;

    this.gridDelete.emit();
  }

  private onKeyDown(event: KeyboardEvent): void {
    const api = this.api;
    if (!api || !this.isActive() || !this.isMultiRow(api) || this.isTypingTarget(event.target)) {
      return;
    }

    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && !event.shiftKey && !event.altKey && event.code === 'KeyA') {
      event.preventDefault();
      this.selectPage(api);
      return;
    }

    if (event.altKey) return;
    this.navigate(api, event);
  }

  private navigate(api: GridApi, event: KeyboardEvent): void {
    const { code, shiftKey } = event;
    const ctrlKey = event.ctrlKey || event.metaKey;
    // Ctrl without Shift is left to the page, e.g. the torrent list queue hotkeys.
    if (ctrlKey && !shiftKey) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(code)) return;

    const selectedNodes = api.getSelectedNodes();
    // Nothing selected: like in a file list, the first key press selects the first row (or the
    // last one when moving backwards) instead of doing nothing.
    const startFromEdge = selectedNodes.length === 0;
    const leadIndex = startFromEdge
      ? null
      : (this.leadIndex ?? selectedNodes[selectedNodes.length - 1].rowIndex);
    if (!startFromEdge && leadIndex == null) return;

    const nextIndex =
      leadIndex == null ? this.edgeIndex(api, code) : this.nextIndex(api, code, leadIndex);
    if (nextIndex == null || nextIndex === leadIndex) return;

    event.preventDefault();
    const colId = api.getAllDisplayedColumns()?.[0]?.getColId();

    if (shiftKey && leadIndex != null) {
      if (this.anchorIndex == null) this.anchorIndex = leadIndex;
      this.leadIndex = nextIndex;
      if (!ctrlKey) api.deselectAll();
      this.selectRange(api, this.anchorIndex, nextIndex);
    } else {
      api.deselectAll();
      api.getDisplayedRowAtIndex(nextIndex)?.setSelected(true, true);
      this.anchorIndex = nextIndex;
      this.leadIndex = nextIndex;
    }

    if (colId) api.setFocusedCell(nextIndex, colId);
    api.ensureIndexVisible(nextIndex);
  }

  private selectRange(api: GridApi, from: number, to: number): void {
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    for (let i = start; i <= end; i++) {
      const node = api.getDisplayedRowAtIndex(i);
      if (node?.selectable) node.setSelected(true);
    }
  }

  /** Ctrl+A: only the rows that pass the filter, and only those on the current page. */
  private selectPage(api: GridApi): void {
    const rowCount = api.getDisplayedRowCount();
    let start = 0;
    let end = rowCount;

    if (api.getGridOption('pagination')) {
      const pageSize = api.paginationGetPageSize();
      start = api.paginationGetCurrentPage() * pageSize;
      end = Math.min(start + pageSize, rowCount);
    }

    api.deselectAll();
    for (let i = start; i < end; i++) {
      const node = api.getDisplayedRowAtIndex(i);
      if (node?.selectable) node.setSelected(true);
    }
  }

  /** The row to start from when nothing is selected. */
  private edgeIndex(api: GridApi, code: string): number | null {
    const rowCount = api.getDisplayedRowCount();
    if (rowCount <= 0) return null;

    const backwards = code === 'ArrowUp' || code === 'PageUp' || code === 'End';
    return backwards ? this.findSelectable(api, rowCount - 1, -1) : this.findSelectable(api, 0, 1);
  }

  private nextIndex(api: GridApi, code: string, leadIndex: number): number | null {
    const rowCount = api.getDisplayedRowCount();
    if (rowCount <= 0) return null;
    const clamp = (i: number) => Math.max(0, Math.min(i, rowCount - 1));

    switch (code) {
      case 'ArrowDown':
        return this.findSelectable(api, clamp(leadIndex + 1), 1);
      case 'ArrowUp':
        return this.findSelectable(api, clamp(leadIndex - 1), -1);
      case 'Home':
        return this.findSelectable(api, 0, 1);
      case 'End':
        return this.findSelectable(api, rowCount - 1, -1);
      case 'PageDown':
        return this.findSelectable(api, clamp(leadIndex + this.pageSize(api, leadIndex)), 1, -1);
      case 'PageUp':
        return this.findSelectable(api, clamp(leadIndex - this.pageSize(api, leadIndex)), -1, 1);
      default:
        return null;
    }
  }

  /**
   * First selectable row from `start` in the direction of `step`. When none is left that way,
   * `fallbackStep` looks back the other way, so a page jump still lands on the nearest row.
   */
  private findSelectable(
    api: GridApi,
    start: number,
    step: 1 | -1,
    fallbackStep?: 1 | -1,
  ): number | null {
    const rowCount = api.getDisplayedRowCount();
    const scan = (direction: 1 | -1): number | null => {
      for (let i = start; i >= 0 && i < rowCount; i += direction) {
        if ((api.getDisplayedRowAtIndex(i) as IRowNode | undefined)?.selectable) return i;
      }
      return null;
    };
    return scan(step) ?? (fallbackStep ? scan(fallbackStep) : null);
  }

  private pageSize(api: GridApi, leadIndex: number): number {
    const rowHeight = api.getDisplayedRowAtIndex(leadIndex)?.rowHeight ?? FALLBACK_ROW_HEIGHT;
    const viewport =
      this.elementRef.nativeElement.querySelector<HTMLElement>(ROWS_VIEWPORT_SELECTOR);
    const viewportHeight = viewport?.clientHeight || FALLBACK_VIEWPORT_HEIGHT;
    return Math.max(1, Math.floor(viewportHeight / (rowHeight || FALLBACK_ROW_HEIGHT)) - 1);
  }
}
