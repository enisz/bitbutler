import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { faPlus, faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import type {
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
import type { ManageTagsGridSettings } from '../../models/manage-tags-grid.model';
import { GridContextMenuService } from '../../pages/main/grid/context-menu/grid-context-menu.service';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ContextMenuService } from '../../services/context-menu.service';
import { ManageTagsGridSettingsService } from '../../services/manage-tags-grid.settings.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { setModalInput } from '../../utils/modal-input';

export interface TagRow {
  name: string;
  usageCount: number;
}

@Component({
  selector: 'app-manage-tags',
  standalone: true,
  imports: [AgGridAngular, TranslatePipe, BbBtnContent],
  templateUrl: './manage-tags.html',
  styleUrl: './manage-tags.scss',
})
export class ManageTags implements OnInit, OnDestroy {
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly confirmService = inject(ConfirmService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly settingsService = inject(ManageTagsGridSettingsService);
  private readonly themeService = inject(ThemeService);
  private readonly translateService = inject(TranslateService);
  private readonly modalService = inject(NgbModal);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly toastService = inject(ToastService);
  protected readonly activeModal = inject(NgbActiveModal);

  private gridApi?: GridApi<TagRow>;
  private saveTimer?: ReturnType<typeof setTimeout>;
  private isDefaultLayout = true;

  readonly bbDark = GRID_DARK_THEME;
  readonly bbLight = GRID_LIGHT_THEME;
  readonly theme = this.themeService.effectiveMode;

  readonly icon = { faPlus, faTrashCan, faXmark };

  readonly tagNames = signal<string[]>([]);
  readonly selectedTags = signal<TagRow[]>([]);
  readonly canDelete = computed(() => this.selectedTags().length >= 1);

  readonly rows = computed<TagRow[]>(() => {
    const torrents = this.torrentStoreService.torrentsArray();
    return this.tagNames().map((name) => ({
      name,
      usageCount: torrents.filter((t) =>
        (t.tags ?? '')
          .split(',')
          .map((s) => s.trim())
          .includes(name),
      ).length,
    }));
  });

  readonly colDefs: ColDef<TagRow>[] = [
    {
      colId: 'name',
      field: 'name',
      headerName: this.translateService.instant('components.modals.manage-tags.column.name'),
      headerTooltip: this.translateService.instant('components.modals.manage-tags.column.name'),
      tooltipField: 'name',
      filter: TextColumnFilter,
    },
    {
      colId: 'usageCount',
      field: 'usageCount',
      headerName: this.translateService.instant('components.modals.manage-tags.column.usage-count'),
      headerTooltip: this.translateService.instant(
        'components.modals.manage-tags.column.usage-count',
      ),
      tooltipField: 'usageCount',
      filter: NumberColumnFilter,
    },
  ];

  readonly getRowId = (params: GetRowIdParams<TagRow>) => params.data.name;

  readonly gridOptions: GridOptions<TagRow> = {
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
    onColumnHeaderContextMenu: (event) => this.onColumnHeaderContextMenu(event),
    onFirstDataRendered: (event: FirstDataRenderedEvent<TagRow>) => {
      if (!this.isDefaultLayout) return;
      // Fit columns to their content first, then stretch to fill the remaining grid
      // width - content-fit alone leaves a large empty gap for a grid this narrow.
      event.api.autoSizeAllColumns();
      event.api.sizeColumnsToFit();
    },
  };

  async ngOnInit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;
    await this.loadTags(serverId);
  }

  private async loadTags(serverId: string): Promise<void> {
    try {
      const tags = await this.qbService.torrents.tags(serverId);
      this.tagNames.set([...tags].sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      console.error(ManageTags.name, 'loadTags', err);
      this.toastService.danger(
        this.translateService.instant('components.modals.manage-tags.toast.load-failed'),
        this.translateService.instant('components.modals.manage-tags.toast.load-failed-title'),
      );
    }
  }

  async onGridReady(event: GridReadyEvent<TagRow>): Promise<void> {
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

  onSelectionChanged(event: SelectionChangedEvent<TagRow>): void {
    this.selectedTags.set(event.api.getSelectedRows());
  }

  async openNew(): Promise<void> {
    const { TagEditor } = await import('../tag-editor/tag-editor');
    const ref = this.modalService.open(TagEditor);
    setModalInput(ref, 'existingNames', this.tagNames());
    try {
      await ref.result;
    } catch {
      return; // dismissed - no-op
    }
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;
    await this.loadTags(serverId);
  }

  async deleteSelected(): Promise<void> {
    const tags = this.selectedTags();
    if (!tags.length) return;
    await this.deleteTags(tags);
  }

  private async deleteTags(tags: TagRow[]): Promise<void> {
    const count = tags.reduce((sum, t) => sum + t.usageCount, 0);
    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-tags.delete-confirm.title',
      { text: 'components.modals.manage-tags.delete-confirm.message', data: { count } },
      'general.button.delete',
      undefined,
      undefined,
      faTrashCan,
    );
    if (!confirmed) return;

    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const names = tags.map((t) => t.name);
    try {
      await this.qbService.torrents.deleteTags(serverId, names);
      this.tagNames.set(this.tagNames().filter((n) => !names.includes(n)));
      this.commandBusService.emit({ type: 'TAG_DELETED', names });
    } catch (err) {
      console.error(ManageTags.name, 'deleteTags', err);
      this.toastService.danger(
        this.translateService.instant('components.modals.manage-tags.toast.delete-failed'),
        this.translateService.instant('components.modals.manage-tags.toast.delete-failed-title'),
      );
    }
  }

  private onColumnHeaderContextMenu(event: ColumnHeaderContextMenuEvent<TagRow>): void {
    if (!event.column) return;
    this.contextMenuService.open({ items: this.gridContextMenuService.buildHeaderMenu(event) });
  }

  private queueSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 500);
  }

  private persist(): void {
    if (!this.gridApi) return;
    const settings: ManageTagsGridSettings = {
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
