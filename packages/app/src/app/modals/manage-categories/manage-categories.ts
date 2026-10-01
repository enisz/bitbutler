import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { faPenToSquare, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  CellContextMenuEvent,
  CellValueChangedEvent,
  ColDef,
  ColumnHeaderContextMenuEvent,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../app.const';
import { SavePathCellEditor } from '../../components/column-editors/save-path-cell-editor/save-path-cell-editor';
import { NumberColumnFilter } from '../../components/column-filters/number-column-filter/number-column-filter';
import { TextColumnFilter } from '../../components/column-filters/text-column-filter/text-column-filter';
import type { ManageCategoriesGridSettings } from '../../models/manage-categories-grid.model';
import type { ContextMenuEntry } from '../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../pages/main/grid/context-menu/grid-context-menu.service';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ContextMenuService } from '../../services/context-menu.service';
import { ManageCategoriesGridSettingsService } from '../../services/manage-categories-grid.settings.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { TorrentStoreService } from '../../services/torrent-store.service';

export interface CategoryEntry {
  name: string;
  savePath: string;
}

export interface CategoryRow extends CategoryEntry {
  usageCount: number;
}

@Component({
  selector: 'app-manage-categories',
  standalone: true,
  imports: [AgGridAngular, TranslatePipe],
  templateUrl: './manage-categories.html',
  styleUrl: './manage-categories.scss',
})
export class ManageCategories implements OnInit, OnDestroy {
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly confirmService = inject(ConfirmService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly settingsService = inject(ManageCategoriesGridSettingsService);
  private readonly themeService = inject(ThemeService);
  private readonly translateService = inject(TranslateService);
  private readonly toastService = inject(ToastService);
  private readonly modalService = inject(NgbModal);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  protected readonly activeModal = inject(NgbActiveModal);

  private gridApi?: GridApi<CategoryRow>;
  private saveTimer?: ReturnType<typeof setTimeout>;

  readonly bbDark = GRID_DARK_THEME;
  readonly bbLight = GRID_LIGHT_THEME;
  readonly theme = this.themeService.effectiveMode;

  readonly categories = signal<CategoryEntry[]>([]);
  readonly selectedCategories = signal<CategoryRow[]>([]);
  readonly canEdit = computed(() => this.selectedCategories().length === 1);
  readonly canDelete = computed(() => this.selectedCategories().length >= 1);

  readonly rows = computed<CategoryRow[]>(() => {
    const torrents = this.torrentStoreService.torrentsArray();
    return this.categories().map((c) => ({
      ...c,
      usageCount: torrents.filter((t) => t.category === c.name).length,
    }));
  });

  readonly colDefs: ColDef<CategoryRow>[] = [
    {
      colId: 'name',
      field: 'name',
      headerName: this.translateService.instant('components.modals.manage-categories.column.name'),
      filter: TextColumnFilter,
    },
    {
      colId: 'savePath',
      field: 'savePath',
      headerName: this.translateService.instant(
        'components.modals.manage-categories.column.save-path',
      ),
      filter: TextColumnFilter,
      editable: true,
      cellEditor: SavePathCellEditor,
      cellEditorPopup: true,
    },
    {
      colId: 'usageCount',
      field: 'usageCount',
      headerName: this.translateService.instant(
        'components.modals.manage-categories.column.usage-count',
      ),
      filter: NumberColumnFilter,
    },
  ];

  readonly getRowId = (params: GetRowIdParams<CategoryRow>) => params.data.name;

  readonly gridOptions: GridOptions<CategoryRow> = {
    ...GRID_SHARED_OPTIONS,
    rowSelection: {
      mode: 'multiRow',
      checkboxes: true,
      headerCheckbox: true,
    },
    getRowId: this.getRowId,
    onSelectionChanged: (event) => this.onSelectionChanged(event),
    onColumnResized: (event) => {
      if (event.finished) this.onColumnChanged();
    },
    onColumnMoved: () => this.onColumnChanged(),
    onColumnPinned: () => this.onColumnChanged(),
    onColumnVisible: () => this.onColumnChanged(),
    onSortChanged: () => this.onColumnChanged(),
    onFilterChanged: () => this.onFilterChanged(),
    onCellContextMenu: (event) => this.onCellContextMenu(event),
    onColumnHeaderContextMenu: (event) => this.onColumnHeaderContextMenu(event),
    onCellValueChanged: (event) => void this.onCellValueChanged(event),
    onRowDoubleClicked: (event) => {
      if (event.rowIndex === null || event.rowIndex === undefined || !event.data) return;
      event.api.startEditingCell({ rowIndex: event.rowIndex, colKey: 'savePath' });
    },
  };

  async ngOnInit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;
    await this.reloadCategories(serverId);
  }

  async onGridReady(event: GridReadyEvent<CategoryRow>): Promise<void> {
    this.gridApi = event.api;
    const settings = await this.settingsService.load();
    if (settings.columnState.length) {
      event.api.applyColumnState({ state: settings.columnState, applyOrder: true });
    }
    if (settings.filterModel) {
      event.api.setFilterModel(settings.filterModel);
    }
  }

  onColumnChanged(): void {
    this.queueSave();
  }

  onFilterChanged(): void {
    this.queueSave();
  }

  onSelectionChanged(event: SelectionChangedEvent<CategoryRow>): void {
    this.selectedCategories.set(event.api.getSelectedRows());
  }

  async onCellValueChanged(event: CellValueChangedEvent<CategoryRow>): Promise<void> {
    if (event.colDef.field !== 'savePath' || event.newValue === event.oldValue) return;

    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const { name } = event.data;
    const newSavePath = event.newValue;

    try {
      await this.qbService.torrents.editCategory(serverId, name, newSavePath);
      this.categories.set(
        this.categories().map((c) => (c.name === name ? { ...c, savePath: newSavePath } : c)),
      );
      this.commandBusService.emit({ type: 'CATEGORY_UPDATED', name, savePath: newSavePath });
    } catch {
      this.toastService.danger(
        this.translateService.instant('components.modals.manage-categories.toast.update-failed', {
          name,
        }),
        this.translateService.instant(
          'components.modals.manage-categories.toast.update-failed-title',
        ),
      );
      event.api.applyTransaction({
        update: [{ ...event.data, savePath: event.oldValue }],
      });
    }
  }

  async openNew(): Promise<void> {
    const { CategoryEditor } = await import('../category-editor/category-editor');
    const ref = this.modalService.open(CategoryEditor);
    try {
      await ref.result;
    } catch {
      return; // dismissed - no-op
    }
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;
    await this.reloadCategories(serverId);
  }

  startEditSelected(): void {
    const [category] = this.selectedCategories();
    if (!category) return;
    this.startEditCategory(category);
  }

  private startEditCategory(category: CategoryRow): void {
    if (!this.gridApi) return;
    const rowIndex = this.gridApi.getRowNode(category.name)?.rowIndex;
    if (rowIndex === null || rowIndex === undefined) return;
    this.gridApi.startEditingCell({ rowIndex, colKey: 'savePath' });
  }

  async deleteSelected(): Promise<void> {
    const categories = this.selectedCategories();
    if (!categories.length) return;
    await this.deleteCategories(categories);
  }

  private async deleteCategories(categories: CategoryRow[]): Promise<void> {
    // Finding 6: commit any pending inline save-path edit before the delete proceeds,
    // rather than silently discarding it (ag-grid does not commit on focus loss by default).
    this.gridApi?.stopEditing?.();

    const count = categories.reduce((sum, c) => sum + c.usageCount, 0);
    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-categories.delete-confirm.title',
      { text: 'components.modals.manage-categories.delete-confirm.message', data: { count } },
      'general.button.delete',
      undefined,
      undefined,
      faTrashCan,
    );
    if (!confirmed) return;

    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const names = categories.map((c) => c.name);
    try {
      await this.qbService.torrents.removeCategories(serverId, names);
      this.categories.set(this.categories().filter((c) => !names.includes(c.name)));
      this.commandBusService.emit({ type: 'CATEGORY_DELETED', names });
    } catch (err) {
      console.error(ManageCategories.name, 'deleteCategories', err);
      this.toastService.danger(
        this.translateService.instant('components.modals.manage-categories.toast.delete-failed'),
        this.translateService.instant(
          'components.modals.manage-categories.toast.delete-failed-title',
        ),
      );
    }
  }

  private async reloadCategories(serverId: string): Promise<void> {
    try {
      const raw = await this.qbService.torrents.categories(serverId);
      this.categories.set(
        Object.values(raw)
          .map((c) => ({ name: c.name, savePath: c.savePath ?? '' }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err) {
      console.error(ManageCategories.name, 'reloadCategories', err);
      this.toastService.danger(
        this.translateService.instant('components.modals.manage-categories.toast.load-failed'),
        this.translateService.instant(
          'components.modals.manage-categories.toast.load-failed-title',
        ),
      );
    }
  }

  close(): void {
    // Finding 6: ngOnDestroy may run too late relative to the modal's own close
    // animation, so commit any pending inline edit here too, before activeModal.close().
    this.gridApi?.stopEditing?.();
    this.activeModal.close();
  }

  dismiss(): void {
    this.gridApi?.stopEditing?.();
    this.activeModal.dismiss();
  }

  private onCellContextMenu(event: CellContextMenuEvent<CategoryRow>): void {
    if (!event.data) return;
    const category = event.data;

    const items: ContextMenuEntry[] = [
      {
        kind: 'item',
        id: 'edit',
        label: 'general.button.edit',
        icon: faPenToSquare,
        action: () => this.startEditCategory(category),
      },
      {
        kind: 'item',
        id: 'delete',
        label: 'general.button.delete',
        icon: faTrashCan,
        variant: 'danger',
        action: () => void this.deleteCategories([category]),
      },
    ];

    this.contextMenuService.open({ items });
  }

  private onColumnHeaderContextMenu(event: ColumnHeaderContextMenuEvent<CategoryRow>): void {
    if (!event.column) return;
    this.contextMenuService.open({ items: this.gridContextMenuService.buildHeaderMenu(event) });
  }

  private queueSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 500);
  }

  private persist(): void {
    if (!this.gridApi) return;
    const settings: ManageCategoriesGridSettings = {
      columnState: this.gridApi.getColumnState(),
      filterModel: this.gridApi.getFilterModel(),
    };
    void this.settingsService.save(settings);
  }

  ngOnDestroy(): void {
    // Finding 6: safety net for any dismissal path that doesn't go through close()/dismiss()
    // (e.g. Esc or a backdrop click) - commit rather than silently lose a pending edit.
    this.gridApi?.stopEditing?.();
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.persist();
    }
  }
}
