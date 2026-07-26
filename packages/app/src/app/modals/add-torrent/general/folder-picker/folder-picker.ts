import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  PendingTasks,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import type { TorrentDraft } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFolderOpen, faRotate } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  CellValueChangedEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  FirstDataRenderedEvent,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  ModuleRegistry,
  RowClassParams,
  RowDataUpdatedEvent,
  SelectionChangedEvent,
  ValueFormatterParams,
} from 'ag-grid-community';
import { Subject, debounceTime } from 'rxjs';
import {
  GRID_DARK_THEME,
  GRID_LIGHT_THEME,
  GRID_ROW_MUTED_CLASS,
  GRID_SHARED_OPTIONS,
} from '../../../../app.const';
import { BbBtnContent } from '../../../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../../../components/bb-popover/bb-popover';
import {
  SetColumnFilter,
  SetColumnFilterParams,
  buildValueCounts,
} from '../../../../components/column-filters/set-column-filter/set-column-filter';
import { SizeColumnFilter } from '../../../../components/column-filters/size-column-filter/size-column-filter';
import { TextColumnFilter } from '../../../../components/column-filters/text-column-filter/text-column-filter';
import {
  ScannedTorrentEntry,
  ScannedTorrentState,
} from '../../../../models/add-torrent-folder.model';
import {
  AddTorrentGridSettings,
  DEFAULT_ADD_TORRENT_GRID_SETTINGS,
} from '../../../../models/add-torrent-grid.model';
import { AddTorrentFormGroup } from '../../../../models/add-torrent.model';
import { GridContextMenuService } from '../../../../pages/main/grid/context-menu/grid-context-menu.service';
import { NoRowOverlay } from '../../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { AddTorrentGridSettingsService } from '../../../../services/add-torrent-grid.settings.service';
import { ContextMenuService } from '../../../../services/context-menu.service';
import { ThemeService } from '../../../../services/theme.service';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import { UiFormatService } from '../../../../services/ui-format.service';

// main.ts registers this once for the running app, but that entry point is never
// loaded by unit tests. Registering again here (idempotent) ensures the grid also
// initialises correctly under the test runner, where an unregistered grid silently
// creates with no `api`, and any later input change (e.g. `rowData` after `scan()`
// resolves) throws when ag-grid-angular tries to dispatch a change event on it.
ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-add-torrent-folder-picker',
  imports: [
    ReactiveFormsModule,
    FontAwesomeModule,
    TranslatePipe,
    BbBtnContent,
    BbPopover,
    AgGridAngular,
    FilesizePipe,
  ],
  templateUrl: './folder-picker.html',
  styleUrl: './folder-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentFolderPicker implements OnInit {
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly translateService = inject(TranslateService);
  private readonly themeService = inject(ThemeService);
  private readonly uiFormatService = inject(UiFormatService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly addTorrentGridSettingsService = inject(AddTorrentGridSettingsService);

  public readonly icons = { faFolderOpen, faRotate };
  public readonly theme = this.themeService.effectiveMode;
  public readonly bbDark = GRID_DARK_THEME;
  public readonly bbLight = GRID_LIGHT_THEME;

  public form = input.required<AddTorrentFormGroup>();

  public readonly rows = signal<ScannedTorrentEntry[]>([]);
  public readonly visibleRows = computed(() => this.rows().filter((r) => r.state !== 'added'));
  public readonly loading = signal(false);
  public readonly scanError = signal<string | null>(null);
  public readonly selectedPaths = signal<Set<string>>(new Set());

  public readonly selectedEntries = computed(() =>
    this.rows().filter((r) => this.selectedPaths().has(r.path)),
  );

  public readonly selectedTotalSize = computed(() =>
    this.selectedEntries().reduce((total, entry) => total + entry.size, 0),
  );

  private readonly cache = new Map<string, ScannedTorrentEntry>();
  private hasScannedOnce = false;

  private gridApi: GridApi<ScannedTorrentEntry> | null = null;
  private isRestoringState = false;
  private isSyncingErrorColumnVisibility = false;
  private isDefaultLayout = true;
  private readonly saveState$ = new Subject<void>();

  private get folderControl() {
    return this.form().controls.folderGroup.controls.folder;
  }

  private get recursiveControl() {
    return this.form().controls.folderGroup.controls.recursive;
  }

  public async ngOnInit(): Promise<void> {
    this.saveState$.pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.persistColumnState();
    });

    this.recursiveControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.hasScannedOnce) void this.scan();
    });

    let folder = this.folderControl.value?.trim();
    if (!folder) {
      folder = (await window.bitbutler.electron.getDownloadsPath()) ?? '';
      this.folderControl.setValue(folder, { emitEvent: false });
    }
    if (folder) await this.scan();
  }

  public async browse(): Promise<void> {
    const current = this.folderControl.value?.trim();
    const defaultPath = current || (await window.bitbutler.electron.getDownloadsPath());
    const selected = await window.bitbutler.electron.showOpenDialog(defaultPath);
    if (!selected) return;

    this.folderControl.setValue(selected);
    await this.scan();
  }

  public async refresh(): Promise<void> {
    await this.scan();
  }

  public onGridReady(e: GridReadyEvent<ScannedTorrentEntry>): void {
    this.gridApi = e.api;
    this.syncErrorColumnVisibility();
    void this.restoreColumnState();
  }

  private async restoreColumnState(): Promise<void> {
    if (!this.gridApi) return;
    this.isRestoringState = true;
    try {
      const settings: AddTorrentGridSettings = await this.addTorrentGridSettingsService.load();
      // Reference-equality is intentional: BaseSettingsService only replaces the columnState
      // array reference once something has actually been saved (see base-settings.service.ts).
      this.isDefaultLayout = settings.columnState === DEFAULT_ADD_TORRENT_GRID_SETTINGS.columnState;
      this.gridApi.applyColumnState({ state: settings.columnState, applyOrder: true });
    } finally {
      this.isRestoringState = false;
    }
  }

  private async persistColumnState(): Promise<void> {
    if (!this.gridApi) return;
    const columnState = this.gridApi.getColumnState();
    await this.addTorrentGridSettingsService.save({ columnState });
  }

  private queueSave(): void {
    if (this.isRestoringState || this.isSyncingErrorColumnVisibility) return;
    this.saveState$.next();
  }

  public renameEntry(path: string, newName: string): void {
    const cached = this.cache.get(path);
    if (cached) cached.name = newName;
    this.rows.update((rows) => rows.map((r) => (r.path === path ? { ...r, name: newName } : r)));
  }

  public markAdded(path: string): void {
    const cached = this.cache.get(path);
    if (cached) cached.state = 'added';
    this.rows.update((rows) => rows.map((r) => (r.path === path ? { ...r, state: 'added' } : r)));
    this.syncErrorColumnVisibility();
  }

  public markFailed(path: string, error: string): void {
    const cached = this.cache.get(path);
    if (cached) {
      cached.state = 'failed';
      cached.errorMessage = error;
    }
    this.rows.update((rows) =>
      rows.map((r) => (r.path === path ? { ...r, state: 'failed', errorMessage: error } : r)),
    );
    this.syncErrorColumnVisibility();
  }

  private syncErrorColumnVisibility(): void {
    if (!this.gridApi) return;
    const hasError = this.rows().some((r) => r.state === 'error' || r.state === 'failed');
    this.isSyncingErrorColumnVisibility = true;
    try {
      this.gridApi.setColumnsVisible(['errorMessage'], hasError);
    } finally {
      this.isSyncingErrorColumnVisibility = false;
    }
  }

  private async scan(): Promise<void> {
    const folder = this.folderControl.value?.trim();
    if (!folder) return;

    const done = this.pendingTasks.add();
    this.loading.set(true);
    this.scanError.set(null);
    try {
      const found = await window.bitbutler.torrent.scanFolder({
        path: folder,
        recursive: this.recursiveControl.value,
      });

      const entries: ScannedTorrentEntry[] = [];
      for (const { path, relativePath } of found) {
        const cached = this.cache.get(path);
        if (cached) {
          entries.push(cached);
          continue;
        }
        const entry = await this.parseEntry(path, relativePath);
        this.cache.set(path, entry);
        entries.push(entry);
      }

      this.rows.set(entries);
      this.selectedPaths.set(new Set(entries.filter((e) => e.state === 'new').map((e) => e.path)));
      this.hasScannedOnce = true;
      this.syncErrorColumnVisibility();
    } catch (e) {
      this.scanError.set(String((e as Error)?.message ?? e));
      this.rows.set([]);
    } finally {
      this.loading.set(false);
      done();
    }
  }

  private async parseEntry(path: string, relativePath: string): Promise<ScannedTorrentEntry> {
    const draft: TorrentDraft = await window.bitbutler.torrent.parse({ source: 'manual', path });

    if (draft.error) {
      return {
        path,
        relativePath,
        name: draft.originalName ?? path,
        size: 0,
        fileCount: 0,
        folderCount: 0,
        state: 'error',
        errorMessage: draft.error.message,
        hash: null,
      };
    }

    const files = draft.torrent?.files ?? [];
    const hash = draft.torrent?.infoHashV1?.toLowerCase() ?? null;
    const state: ScannedTorrentState =
      hash && this.torrentStoreService.torrentsMap().has(hash) ? 'exists' : 'new';

    return {
      path,
      relativePath,
      name: draft.torrent?.name ?? draft.originalName ?? path,
      size: draft.torrent?.totalSize ?? 0,
      fileCount: files.length || 1,
      folderCount: countUniqueFolders(files.map((f) => f.path)),
      state,
      hash,
    };
  }

  public readonly gridOptions: GridOptions<ScannedTorrentEntry> = {
    ...GRID_SHARED_OPTIONS,
    rowSelection: {
      mode: 'multiRow',
      checkboxes: true,
      headerCheckbox: true,
      enableClickSelection: false,
      isRowSelectable: (node) => node.data?.state === 'new' || node.data?.state === 'failed',
    },
    getRowId: (params: GetRowIdParams<ScannedTorrentEntry>) => params.data.path,
    rowClassRules: {
      [GRID_ROW_MUTED_CLASS]: (params: RowClassParams<ScannedTorrentEntry>): boolean =>
        params.data?.state === 'exists',
      'text-danger bg-danger-subtle': (params: RowClassParams<ScannedTorrentEntry>): boolean =>
        params.data?.state === 'error' || params.data?.state === 'failed',
    },
    overlayComponentSelector: (params: IOverlayParams<ScannedTorrentEntry>) => {
      if (params.overlayType === 'noRows' || params.overlayType === 'noMatchingRows') {
        return {
          component: NoRowOverlay,
          params: {
            message: this.translateService.instant(
              'components.add-torrent.folder-picker.grid.no-rows.message',
            ),
          },
        };
      }
      return undefined;
    },
    onSelectionChanged: (e: SelectionChangedEvent<ScannedTorrentEntry>) =>
      this.selectedPaths.set(new Set(e.api.getSelectedRows().map((r) => r.path))),
    onRowDataUpdated: (e: RowDataUpdatedEvent<ScannedTorrentEntry>) => {
      e.api.forEachNode((node) =>
        node.setSelected(node.data?.state === 'new' || node.data?.state === 'failed'),
      );
    },
    onCellValueChanged: (e: CellValueChangedEvent<ScannedTorrentEntry>) => {
      if (e.colDef.colId === 'name') this.renameEntry(e.data.path, e.newValue ?? e.data.name);
    },
    onColumnResized: (e) => {
      if (e.finished) this.queueSave();
    },
    onColumnMoved: () => this.queueSave(),
    onColumnPinned: () => this.queueSave(),
    onColumnVisible: () => this.queueSave(),
    onSortChanged: () => this.queueSave(),
    onFirstDataRendered: (e: FirstDataRenderedEvent<ScannedTorrentEntry>) => {
      // True only on the very first-ever load (before BaseSettingsService has persisted anything).
      // After that first load, defaults get written to storage, so this becomes permanently false -
      // autosize therefore effectively runs once ever; the resulting widths get saved via the
      // column-change handlers below and are what later opens restore.
      if (this.isDefaultLayout) e.api.autoSizeAllColumns();
    },
    onColumnHeaderContextMenu: (e: ColumnHeaderContextMenuEvent<ScannedTorrentEntry>) => {
      if (!e.column) return;
      this.contextMenuService.open({
        items: this.gridContextMenuService.buildHeaderMenu(e),
        payload: {
          colId: e.column.getId(),
          displayName: e.api.getDisplayNameForColumn(e.column as Column, 'header'),
        },
      });
    },
  };

  public readonly colDefs: ColDef<ScannedTorrentEntry>[] = this.getColDefs();

  private stateLabel(state: ScannedTorrentState | null | undefined): string {
    return state
      ? this.translateService.instant('components.add-torrent.folder-picker.state.' + state)
      : '';
  }

  private getColDefs(): ColDef<ScannedTorrentEntry>[] {
    const stateItems = computed(() =>
      buildValueCounts(this.visibleRows(), (r) => this.stateLabel(r.state)),
    );

    return [
      {
        colId: 'state',
        field: 'state',
        width: 120,
        headerName: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.state',
        ),
        headerTooltip: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.state',
        ),
        valueFormatter: (params: ValueFormatterParams<ScannedTorrentEntry, ScannedTorrentState>) =>
          this.stateLabel(params.value),
        tooltipValueGetter: (params) => this.stateLabel(params.data?.state),
        filter: SetColumnFilter,
        filterParams: { getItems: () => stateItems() } satisfies Partial<SetColumnFilterParams>,
      },
      {
        colId: 'name',
        field: 'name',
        headerName: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.name',
        ),
        headerTooltip: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.name',
        ),
        tooltipField: 'name',
        flex: 2,
        minWidth: 200,
        editable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'size',
        field: 'size',
        width: 130,
        headerName: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.size',
        ),
        headerTooltip: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.size',
        ),
        valueFormatter: this.uiFormatService.fileSize,
        cellClass: 'tabular-nums',
        filter: SizeColumnFilter,
      },
      {
        colId: 'relativePath',
        field: 'relativePath',
        flex: 1,
        minWidth: 160,
        headerName: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.path',
        ),
        headerTooltip: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.path',
        ),
        tooltipField: 'relativePath',
        filter: TextColumnFilter,
      },
      {
        colId: 'errorMessage',
        field: 'errorMessage',
        headerName: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.error',
        ),
        headerTooltip: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.error',
        ),
        tooltipField: 'errorMessage',
        flex: 1,
        minWidth: 160,
        hide: true,
        filter: TextColumnFilter,
      },
    ];
  }
}

function countUniqueFolders(filePaths: string[]): number {
  const folders = new Set<string>();
  for (const p of filePaths) {
    const segments = p.split('/');
    for (let i = 1; i < segments.length; i++) {
      folders.add(segments.slice(0, i).join('/'));
    }
  }
  return folders.size;
}
