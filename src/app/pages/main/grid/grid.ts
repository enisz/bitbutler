import {
  AfterViewInit,
  Component,
  DestroyRef,
  HostListener,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  type CellContextMenuEvent,
  type ColDef,
  type ColumnState,
  type GridApi,
  type GridOptions,
  type RowDoubleClickedEvent,
} from 'ag-grid-community';
import { Subject, firstValueFrom, skip, throttleTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME } from '../../../app.const';
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
import { UiFormatService } from '../../../services/ui-format.service';
import { getTrackers, normalizeTracker } from '../tracker.utils';
import { GridContextMenuService } from './context-menu/grid-context-menu.service';
import { GridKeyboardNavService } from './grid-keyboard-nav.service';
import { GridPinService } from './grid-pin.service';
import { getGridColDefs, getGridOptions } from './grid.lib';

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [AgGridAngular],
  providers: [GridStateService, GridContextMenuService, GridKeyboardNavService, GridPinService],
  templateUrl: './grid.html',
  styleUrls: ['./grid.scss'],
})
export class Grid implements AfterViewInit {
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;

  private readonly selectionStore = inject(SelectionStoreService);
  private readonly filterService = inject(FilterService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridStateService = inject(GridStateService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly themeService = inject(ThemeService);
  private readonly uiFormatService = inject(UiFormatService);
  private readonly gridViewStoreService = inject(GridViewStoreService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly torrentListGridSettingsService = inject(TorrentListGridSettingsService);
  private readonly electronService = inject(ElectronService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly keyboardNavService = inject(GridKeyboardNavService);
  private readonly gridPinService = inject(GridPinService);

  private readonly saveGridState$ = new Subject<void>();

  private api: GridApi<Torrent> | null = null;
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
    this.keyboardNavService.onKeyUp(event);
  }

  @HostListener('window:keydown', ['$event'])
  public onKeyDown(event: KeyboardEvent): void {
    this.keyboardNavService.onKeyDown(event);
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
        getSelectionAnchorIndex: () => this.keyboardNavService.anchorIndex,
        getSelectionLeadIndex: () => this.keyboardNavService.leadIndex,
        setSelectionAnchorIndex: (v) => (this.keyboardNavService.anchorIndex = v),
        setSelectionLeadIndex: (v) => (this.keyboardNavService.leadIndex = v),
        getLatestFilters: () => this.filterService.external(),
        getIsApplyingFilterFromService: () => this.isApplyingFilterFromService,
        setIsApplyingFilterFromService: (v) => (this.isApplyingFilterFromService = v),
        normalizeTracker: (raw) => normalizeTracker(raw),
        getTrackers: (t) => getTrackers(t),
        handleCellRightClick: this.handleCellRightClick,
        handleRowDoubleClick: this.handleRowDoubleClick,
        onApiReady: (api) => {
          this.keyboardNavService.init(api);
          this.gridPinService.init(api);
          this.api = api;

          api.setGridOption('onRowClicked', (event) => {
            const mouseEvent = event.event as MouseEvent;
            if (event.rowIndex !== null && !mouseEvent?.shiftKey) {
              this.keyboardNavService.anchorIndex = event.rowIndex;
              this.keyboardNavService.leadIndex = event.rowIndex;
            }
          });

          api.setGridOption('onCellClicked', (event) => {
            const mouseEvent = event.event as MouseEvent;
            if (
              mouseEvent?.shiftKey &&
              this.keyboardNavService.anchorIndex !== null &&
              event.rowIndex !== null
            ) {
              const start = Math.min(this.keyboardNavService.anchorIndex, event.rowIndex);
              const end = Math.max(this.keyboardNavService.anchorIndex, event.rowIndex);

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
      const selectedTorrents = this.selectionStore.selected();
      if (this.isProgrammaticSelection || !this.api) return;

      const gridSelection = this.api.getSelectedRows();

      if (this.areSelectionsEqual(gridSelection, selectedTorrents)) {
        return;
      }

      const selectedHashes = new Set(selectedTorrents.map((t) => t.hash));
      const syncNode = (node: {
        data?: Torrent;
        isSelected: () => boolean | undefined;
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

    toObservable(this.filterService.external)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(this.onExternalFilterChange);

    toObservable(this.filterService.columns)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(this.onColumnFilterChange);
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

    this.gridPinService.applyPinnedState(
      settings.pinnedTopHashes ?? [],
      settings.pinnedBottomHashes ?? [],
    );

    const floatingFilters = settings.floatingFilters ?? false;
    const currentDefs = this.api.getColumnDefs() ?? [];
    const newDefs = currentDefs.map((d) => {
      const colDef = { ...(d as ColDef<any>) };
      if (colDef.floatingFilter === false) return colDef;
      colDef.floatingFilter = floatingFilters ? true : undefined;
      return colDef;
    });
    this.api.updateGridOptions({ columnDefs: newDefs as ColDef<any>[] });
  }

  ngAfterViewInit(): void {
    this.saveGridState$.pipe(throttleTime(500, undefined, { trailing: true })).subscribe(() => {
      if (!this.api) return;
      void this.gridStateService.save(
        this.api,
        this.gridPinService.getPinnedTopHashes(),
        this.gridPinService.getPinnedBottomHashes(),
      );
    });

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
