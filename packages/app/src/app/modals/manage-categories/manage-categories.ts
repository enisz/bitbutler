import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { faPenToSquare, faPlus, faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  CellContextMenuEvent,
  ColDef,
  ColumnHeaderContextMenuEvent,
  FirstDataRenderedEvent,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../app.const';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
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
import { setModalInput } from '../../utils/modal-input';

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
  imports: [AgGridAngular, TranslatePipe, BbBtnContent],
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
  private isDefaultLayout = true;

  readonly bbDark = GRID_DARK_THEME;
  readonly bbLight = GRID_LIGHT_THEME;
  readonly theme = this.themeService.effectiveMode;

  readonly icon = { faPlus, faPenToSquare, faTrashCan, faXmark };

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
      headerTooltip: this.translateService.instant(
        'components.modals.manage-categories.column.name',
      ),
      tooltipField: 'name',
      filter: TextColumnFilter,
    },
    {
      colId: 'savePath',
      field: 'savePath',
      headerName: this.translateService.instant(
        'components.modals.manage-categories.column.save-path',
      ),
      headerTooltip: this.translateService.instant(
        'components.modals.manage-categories.column.save-path',
      ),
      tooltipField: 'savePath',
      filter: TextColumnFilter,
    },
    {
      colId: 'usageCount',
      field: 'usageCount',
      headerName: this.translateService.instant(
        'components.modals.manage-categories.column.usage-count',
      ),
      headerTooltip: this.translateService.instant(
        'components.modals.manage-categories.column.usage-count',
      ),
      tooltipField: 'usageCount',
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
    onFirstDataRendered: (event: FirstDataRenderedEvent<CategoryRow>) => {
      if (!this.isDefaultLayout) return;
      // Fit columns to their content first, then stretch to fill the remaining grid
      // width - content-fit alone leaves a large empty gap for a grid this narrow.
      event.api.autoSizeAllColumns();
      event.api.sizeColumnsToFit();
    },
    onRowDoubleClicked: (event) => {
      if (!event.data) return;
      void this.startEditCategory(event.data);
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
    this.isDefaultLayout = settings.columnState.length === 0;
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

  async openNew(): Promise<void> {
    const { CategoryEditor } = await import('../category-editor/category-editor');
    const ref = this.modalService.open(CategoryEditor);
    setModalInput(
      ref,
      'existingNames',
      this.categories().map((c) => c.name),
    );
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
    void this.startEditCategory(category);
  }

  private async startEditCategory(category: CategoryEntry): Promise<void> {
    const { CategoryEditor } = await import('../category-editor/category-editor');
    const ref = this.modalService.open(CategoryEditor);
    setModalInput(ref, 'category', { name: category.name, savePath: category.savePath });
    try {
      await ref.result;
    } catch {
      return; // dismissed - no-op
    }
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;
    await this.reloadCategories(serverId);
  }

  async deleteSelected(): Promise<void> {
    const categories = this.selectedCategories();
    if (!categories.length) return;
    await this.deleteCategories(categories);
  }

  private async deleteCategories(categories: CategoryRow[]): Promise<void> {
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

  private onCellContextMenu(event: CellContextMenuEvent<CategoryRow>): void {
    if (!event.data) return;
    const category = event.data;

    const items: ContextMenuEntry[] = [
      {
        kind: 'item',
        id: 'edit',
        label: 'general.button.edit',
        icon: faPenToSquare,
        action: () => void this.startEditCategory(category),
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
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.persist();
    }
  }
}
