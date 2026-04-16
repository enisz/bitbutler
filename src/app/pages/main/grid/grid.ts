import {
  AfterViewInit,
  Component,
  DestroyRef,
  effect,
  HostListener,
  inject,
  Input,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  type CellContextMenuEvent,
  type ColumnState,
  type GridApi,
  type GridOptions,
  type RowDoubleClickedEvent,
} from 'ag-grid-community';
import { filter, firstValueFrom, skip, Subject, throttleTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME } from '../../../app.const';
import { UiCommand } from '../../../models/command.model';
import { TorrentListGridSettings } from '../../../models/torrent-list-grid.model';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { ContextMenuService } from '../../../services/context-menu.service';
import { ElectronService } from '../../../services/electron.service';
import { FilterService } from '../../../services/filter.service';
import { GridStateService } from '../../../services/grid-state.service';
import { GridViewStoreService } from '../../../services/grid-view-store.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ThemeService } from '../../../services/theme.service';
import { TorrentListGridSettingsService } from '../../../services/torrent-list-grid.settings.service';
import { TorrentStoreService, TorrentTxnDelta } from '../../../services/torrent-store.service';
import { UiFormatService } from '../../../services/ui-format.service';
import { GridContextMenuService } from './context-menu/grid-context-menu.service';
import { getGridColDefs, getGridOptions } from './grid.lib';

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [AgGridAngular],
  providers: [GridStateService, GridContextMenuService],
  templateUrl: './grid.html',
  styleUrls: ['./grid.scss'],
})
export class Grid implements AfterViewInit {
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  @Input() delta: TorrentTxnDelta | null = null;

  private readonly selectionStore = inject(SelectionStoreService);
  private readonly filterService = inject(FilterService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridStateService = inject(GridStateService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly themeService = inject(ThemeService);
  private readonly uiFormatService = inject(UiFormatService);
  private readonly gridViewStoreService = inject(GridViewStoreService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly torrentListGridSettingsService = inject(TorrentListGridSettingsService);
  private readonly electronService = inject(ElectronService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly modalService = inject(NgbModal);

  private readonly saveGridState$ = new Subject<void>();

  private api: GridApi<Torrent> | null = null;
  private readonly pinnedTopHashes = signal<Set<string>>(new Set());
  private readonly pinnedBottomHashes = signal<Set<string>>(new Set());
  private selectionAnchorIndex: number | null = null;
  private selectionLeadIndex: number | null = null;

  private isProgrammaticSelection = false;
  private isApplyingFilterFromService = false;
  private hasLoadedInitialState = false;
  private isRestoringGridState = false;

  public readonly theme = this.themeService.effectiveMode;
  public gridOptions: GridOptions<Torrent>;
  public readonly bbDark = GRID_DARK_THEME;
  public readonly bbLight = GRID_LIGHT_THEME;

  @HostListener('window:keyup', ['$event'])
  public onKeyUp(event: KeyboardEvent): void {
    const { shiftKey, code, target } = event;
    if (code === 'Delete' && !this.isTypingTarget(target)) {
      this.commandBusService.emit({
        type: 'UI_TORRENT_DELETE_REQUEST',
        defaultRemoveFiles: shiftKey,
      });
    }
  }

  @HostListener('window:keydown', ['$event'])
  public onKeyDown(event: KeyboardEvent): void {
    if (this.modalService.hasOpenModals()) return;

    this.handleGridSelectAll(event);
    this.handleGridKeyboardSelection(event);
  }

  constructor() {
    this.gridOptions = getGridOptions(
      this.contextMenuService,
      this.selectionStore,
      this.filterService,
      this.gridStateService,
      this.gridContextMenuService,
      this.uiFormatService,
      this.translateService,
      {
        getHasLoadedInitialState: () => this.hasLoadedInitialState,
        getIsRestoringGridState: () => this.isRestoringGridState,
        setIsRestoringGridState: (v) => (this.isRestoringGridState = v),
        setHasLoadedInitialState: (v) => (this.hasLoadedInitialState = v),
        queueSave: this.queueSave,
        updateInViewCount: this.updateInViewCount,
        getSelectionAnchorIndex: () => this.selectionAnchorIndex,
        getSelectionLeadIndex: () => this.selectionLeadIndex,
        setSelectionAnchorIndex: (v) => (this.selectionAnchorIndex = v),
        setSelectionLeadIndex: (v) => (this.selectionLeadIndex = v),
        getLatestFilters: () => this.filterService.snapshot.external,
        getIsApplyingFilterFromService: () => this.isApplyingFilterFromService,
        setIsApplyingFilterFromService: (v) => (this.isApplyingFilterFromService = v),
        normalizeTracker: (raw) => this.normalizeTracker(raw),
        getTrackers: (t) => this.getTrackers(t),
        handleCellRightClick: this.handleCellRightClick,
        handleRowDoubleClick: this.handleRowDoubleClick,
        onApiReady: (api) => {
          this.api = api;

          api.setGridOption('onRowClicked', (event) => {
            const mouseEvent = event.event as MouseEvent;
            if (event.rowIndex !== null && !mouseEvent?.shiftKey) {
              this.selectionAnchorIndex = event.rowIndex;
              this.selectionLeadIndex = event.rowIndex;
            }
          });

          api.setGridOption('onCellClicked', (event) => {
            const mouseEvent = event.event as MouseEvent;
            if (
              mouseEvent?.shiftKey &&
              this.selectionAnchorIndex !== null &&
              event.rowIndex !== null
            ) {
              const start = Math.min(this.selectionAnchorIndex, event.rowIndex);
              const end = Math.max(this.selectionAnchorIndex, event.rowIndex);

              api.deselectAll();
              for (let i = start; i <= end; i++) {
                api.getDisplayedRowAtIndex(i)?.setSelected(true);
              }
            }
          });
        },
        getIsProgrammaticSelection: () => this.isProgrammaticSelection,
        applyDbSettings: async () => {
          const settings = await firstValueFrom(this.torrentListGridSettingsService.asObservable());
          if (settings) this.applyGridSettings(settings);
        },
      },
    );

    effect(() => {
      const torrents = this.torrentStore.torrentsArray();
      const topHashes = this.pinnedTopHashes();
      const bottomHashes = this.pinnedBottomHashes();
      if (!this.api) return;

      const pinnedTop = torrents.filter((t) => topHashes.has(t.hash));
      const pinnedBottom = torrents.filter((t) => bottomHashes.has(t.hash));
      const mainRows = torrents.filter((t) => !topHashes.has(t.hash) && !bottomHashes.has(t.hash));

      this.api.setGridOption('rowData', mainRows);
      this.api.setGridOption('pinnedTopRowData', pinnedTop);
      this.api.setGridOption('pinnedBottomRowData', pinnedBottom);
    });

    effect(() => {
      const selectedTorrents = this.selectionStore.selected();
      if (this.isProgrammaticSelection || !this.api) return;

      const gridSelection = this.api.getSelectedRows();

      if (this.areSelectionsEqual(gridSelection, selectedTorrents)) {
        return;
      }

      const selectedHashes = new Set(selectedTorrents.map((t) => t.hash));
      const syncNode = (node: {
        data?: Torrent;
        isSelected: () => boolean;
        setSelected: (v: boolean) => void;
      }) => {
        if (node.data) {
          const shouldBeSelected = selectedHashes.has(node.data.hash);
          if (node.isSelected() !== shouldBeSelected) {
            node.setSelected(shouldBeSelected);
          }
        }
      };
      this.api.forEachNode(syncNode);
      for (let i = 0; i < this.api.getPinnedTopRowCount(); i++) {
        const node = this.api.getPinnedTopRow(i);
        if (node) syncNode(node);
      }
      for (let i = 0; i < this.api.getPinnedBottomRowCount(); i++) {
        const node = this.api.getPinnedBottomRow(i);
        if (node) syncNode(node);
      }
    });

    this.commandBusService.commands$
      .pipe(
        filter(
          (cmd): cmd is UiCommand =>
            cmd.type === 'UI_TORRENT_PIN_TOP' ||
            cmd.type === 'UI_TORRENT_PIN_BOTTOM' ||
            cmd.type === 'UI_TORRENT_UNPIN',
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((cmd) => {
        const hashes = this.selectionStore.selected().map((t) => t.hash);
        const hashSet = new Set(hashes);

        if (cmd.type === 'UI_TORRENT_UNPIN') {
          this.pinnedTopHashes.set(
            new Set([...this.pinnedTopHashes()].filter((h) => !hashSet.has(h))),
          );
          this.pinnedBottomHashes.set(
            new Set([...this.pinnedBottomHashes()].filter((h) => !hashSet.has(h))),
          );
        } else if (cmd.type === 'UI_TORRENT_PIN_TOP') {
          // Move from bottom to top if already bottom-pinned
          this.pinnedBottomHashes.set(
            new Set([...this.pinnedBottomHashes()].filter((h) => !hashSet.has(h))),
          );
          this.pinnedTopHashes.set(new Set([...this.pinnedTopHashes(), ...hashes]));
        } else {
          // UI_TORRENT_PIN_BOTTOM — move from top to bottom if already top-pinned
          this.pinnedTopHashes.set(
            new Set([...this.pinnedTopHashes()].filter((h) => !hashSet.has(h))),
          );
          this.pinnedBottomHashes.set(new Set([...this.pinnedBottomHashes(), ...hashes]));
        }

        if (this.api) {
          void this.gridStateService.save(
            this.api,
            [...this.pinnedTopHashes()],
            [...this.pinnedBottomHashes()],
          );
        }
      });
  }

  private areSelectionsEqual(a: Torrent[], b: Torrent[]): boolean {
    if (a.length !== b.length) return false;
    const hashesA = new Set(a.map((t) => t.hash));
    return b.every((t) => hashesA.has(t.hash));
  }

  private applyGridSettings(settings: TorrentListGridSettings): void {
    if (!this.api || !settings) return;

    if (settings.columnState && Array.isArray(settings.columnState)) {
      this.api.applyColumnState({ state: settings.columnState as ColumnState[], applyOrder: true });
    }

    this.api.setGridOption('pagination', settings.pagination);
    this.api.setGridOption('animateRows', settings.animateRows);

    this.pinnedTopHashes.set(new Set(settings.pinnedTopHashes ?? []));
    this.pinnedBottomHashes.set(new Set(settings.pinnedBottomHashes ?? []));
  }

  ngAfterViewInit(): void {
    this.saveGridState$.pipe(throttleTime(500, undefined, { trailing: true })).subscribe(() => {
      if (!this.api) return;
      void this.gridStateService.save(
        this.api,
        [...this.pinnedTopHashes()],
        [...this.pinnedBottomHashes()],
      );
    });

    this.filterService.external$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(this.onExternalFilterChange);

    this.filterService.columnModel$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(this.onColumnFilterChange);

    (this.torrentListGridSettingsService
      .asObservable()
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((settings) => this.applyGridSettings(settings)),
      this.translateService.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.refreshColumnHeaders();
      }));
  }

  deselectRows() {
    this.api?.deselectAll();
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
      this.selectionLeadIndex ??
      (selectedNodes.length ? selectedNodes[selectedNodes.length - 1].rowIndex : null);
    if (leadIndex == null) return;

    const nextIndex = this.computeNextDisplayedIndex(api, code, leadIndex);
    if (nextIndex == null || nextIndex === leadIndex) return;

    const nextNode = api.getDisplayedRowAtIndex(nextIndex);
    if (!nextNode) return;

    event.preventDefault();
    const colId = api.getAllDisplayedColumns()?.[0]?.getColId();

    if (shiftKey) {
      if (this.selectionAnchorIndex == null) this.selectionAnchorIndex = leadIndex;
      this.selectionLeadIndex = nextIndex;
      const start = Math.min(this.selectionAnchorIndex, this.selectionLeadIndex);
      const end = Math.max(this.selectionAnchorIndex, this.selectionLeadIndex);
      if (!ctrlKey) api.deselectAll();
      for (let i = start; i <= end; i++) api.getDisplayedRowAtIndex(i)?.setSelected(true);
    } else if (!ctrlKey) {
      api.deselectAll();
      nextNode.setSelected(true, true);
      this.selectionAnchorIndex = nextIndex;
      this.selectionLeadIndex = nextIndex;
    }

    if (colId) api.setFocusedCell(nextIndex, colId);
    api.ensureIndexVisible(nextIndex);
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

  private getTrackers(t: Torrent): string[] {
    return (t.tracker ?? '').split('\n').filter(Boolean);
  }

  private normalizeTracker(raw?: string | null): string {
    const s = (raw ?? '').trim();
    if (!s) return '(none)';
    try {
      const u = new URL(s);
      return u.host || u.hostname || s;
    } catch {
      return s;
    }
  }

  private queueSave = () => this.saveGridState$.next();
  private updateInViewCount = () =>
    this.gridViewStoreService.filteredCount.set(this.api?.getDisplayedRowCount() ?? 0);

  private onExternalFilterChange = async () => {
    if (!this.api) return;
    this.isApplyingFilterFromService = true;
    await new Promise((r) => setTimeout(r, 0));
    this.api.onFilterChanged();
    this.isApplyingFilterFromService = false;
  };

  private onColumnFilterChange = (model: any) => {
    if (!this.api) return;
    this.isApplyingFilterFromService = true;
    this.api.setFilterModel(model);
    this.api.onFilterChanged();
    this.isApplyingFilterFromService = false;
  };

  private handleCellRightClick = async (event: CellContextMenuEvent<Torrent, any>) => {
    if (!event.data) return;

    if (this.selectionStore.selected().length <= 1) {
      this.selectionStore.setByHashes([event.data.hash]);
    }

    this.contextMenuService.open({
      items: await this.gridContextMenuService.buildTorrentMenu({
        row: event.data,
        cell: { value: event.value, colId: event.column.getColId(), rowId: event.data.hash },
        selected: this.selectionStore.selected(),
        rowPinned: event.node.rowPinned,
      }),
    });
  };

  private handleRowDoubleClick = async (event: RowDoubleClickedEvent<Torrent, any>) => {
    if (!event.data) return;
    const settings = await firstValueFrom(this.torrentListGridSettingsService.asObservable());
    const action = settings?.rowDoubleClickAction ?? 'DETAILS';
    if (action === 'DETAILS')
      this.commandBusService.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash: event.data.hash });
    else if (action === 'SAVE_PATH' && event.data.save_path)
      this.electronService.openPath(event.data.save_path);
  };

  private refreshColumnHeaders(): void {
    if (!this.api) return;

    this.api.setGridOption(
      'columnDefs',
      getGridColDefs(this.uiFormatService, this.translateService),
    );
  }
}
