import { Component, OnDestroy, computed, inject, input, signal } from '@angular/core';
import type { ServerRecord } from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IsRowSelectable,
  RowClassParams,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../app.const';
import { BooleanColumnFilter } from '../../components/column-filters/boolean-column-filter/boolean-column-filter';
import { NumberColumnFilter } from '../../components/column-filters/number-column-filter/number-column-filter';
import {
  SetColumnFilter,
  buildValueCounts,
} from '../../components/column-filters/set-column-filter/set-column-filter';
import { TextColumnFilter } from '../../components/column-filters/text-column-filter/text-column-filter';
import type { ManageServersGridSettings } from '../../models/manage-servers-grid.model';
import { ManageServersGridSettingsService } from '../../services/manage-servers-grid.settings.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-manage-servers',
  standalone: true,
  imports: [AgGridAngular, TranslatePipe],
  templateUrl: './manage-servers.html',
  styleUrl: './manage-servers.scss',
})
export class ManageServers implements OnDestroy {
  readonly hideConnect = input(false);

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly settingsService = inject(ManageServersGridSettingsService);
  private readonly themeService = inject(ThemeService);
  private readonly translateService = inject(TranslateService);
  protected readonly activeModal = inject(NgbActiveModal);

  private gridApi?: GridApi<ServerRecord>;
  private saveTimer?: ReturnType<typeof setTimeout>;

  readonly bbDark = GRID_DARK_THEME;
  readonly bbLight = GRID_LIGHT_THEME;
  readonly theme = this.themeService.effectiveMode;

  readonly servers = this.serverStoreService.servers;
  readonly loading = this.serverStoreService.loading;
  readonly selectedServers = signal<ServerRecord[]>([]);

  readonly canEdit = computed(() => this.selectedServers().length === 1);
  readonly canConnect = computed(() => !this.hideConnect() && this.selectedServers().length === 1);
  readonly canDelete = computed(() => this.selectedServers().length >= 1);

  readonly isRowSelectable: IsRowSelectable<ServerRecord> = (row) =>
    row.data?.id !== this.serverStoreService.currentServerId();

  readonly getRowId = (params: GetRowIdParams<ServerRecord>) => params.data.id;

  readonly rowClassRules = {
    'bb-row-active': (params: RowClassParams<ServerRecord>) =>
      !this.hideConnect() && params.data?.id === this.serverStoreService.currentServerId(),
  };

  readonly colDefs = computed<ColDef<ServerRecord>[]>(() => [
    {
      colId: 'orb',
      headerName: '',
      width: 44,
      sortable: false,
      resizable: false,
      filter: BooleanColumnFilter,
      valueGetter: (p) =>
        !this.hideConnect() && p.data?.id === this.serverStoreService.currentServerId(),
      // Placeholder renderer - replaced by a dedicated active-server orb renderer in Task 6.
      cellRenderer: 'agCheckboxCellRenderer',
    },
    {
      colId: 'name',
      field: 'name',
      headerName: this.translateService.instant('components.modals.manage-servers.column.name'),
      filter: TextColumnFilter,
    },
    {
      colId: 'host',
      field: 'host',
      headerName: this.translateService.instant('components.modals.manage-servers.column.host'),
      filter: TextColumnFilter,
    },
    {
      colId: 'port',
      field: 'port',
      headerName: this.translateService.instant('components.modals.manage-servers.column.port'),
      filter: NumberColumnFilter,
    },
    {
      colId: 'protocol',
      field: 'protocol',
      headerName: this.translateService.instant('components.modals.manage-servers.column.protocol'),
      filter: SetColumnFilter,
      filterParams: { getItems: () => buildValueCounts(this.servers(), (s) => s.protocol) },
    },
    {
      colId: 'username',
      field: 'username',
      headerName: this.translateService.instant('components.modals.manage-servers.column.username'),
      filter: TextColumnFilter,
    },
    {
      colId: 'auto_login',
      field: 'auto_login',
      headerName: this.translateService.instant('components.modals.manage-servers.column.default'),
      filter: BooleanColumnFilter,
      // Placeholder renderer - replaced by the click-to-toggle default renderer in Task 6.
      cellRenderer: 'agCheckboxCellRenderer',
    },
    {
      colId: 'id',
      field: 'id',
      headerName: this.translateService.instant('components.modals.manage-servers.column.id'),
      filter: TextColumnFilter,
      hide: true,
    },
  ]);

  readonly gridOptions: GridOptions<ServerRecord> = {
    ...GRID_SHARED_OPTIONS,
    rowSelection: {
      mode: 'multiRow',
      checkboxes: true,
      headerCheckbox: true,
      isRowSelectable: this.isRowSelectable,
    },
    getRowId: this.getRowId,
    rowClassRules: this.rowClassRules,
    onSelectionChanged: (event) => this.onSelectionChanged(event),
    onColumnResized: (event) => {
      if (event.finished) this.onColumnChanged();
    },
    onColumnMoved: () => this.onColumnChanged(),
    onColumnPinned: () => this.onColumnChanged(),
    onColumnVisible: () => this.onColumnChanged(),
    onSortChanged: () => this.onColumnChanged(),
    onFilterChanged: () => this.onFilterChanged(),
  };

  async onGridReady(event: GridReadyEvent<ServerRecord>): Promise<void> {
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

  onSelectionChanged(event: SelectionChangedEvent<ServerRecord>): void {
    this.selectedServers.set(event.api.getSelectedRows());
  }

  private queueSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 500);
  }

  private persist(): void {
    if (!this.gridApi) return;
    const settings: ManageServersGridSettings = {
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
