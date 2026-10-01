import {
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import type { ServerRecord } from '@bitbutler/shared';
import { faPenToSquare, faPlug, faStar, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  CellContextMenuEvent,
  ColDef,
  ColumnHeaderContextMenuEvent,
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
import type { ContextMenuEntry } from '../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../pages/main/grid/context-menu/grid-context-menu.service';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ContextMenuService } from '../../services/context-menu.service';
import { CredentialPromptService } from '../../services/credential-prompt.service';
import { ManageServersGridSettingsService } from '../../services/manage-servers-grid.settings.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerService } from '../../services/server.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { setModalInput } from '../../utils/modal-input';
import { ActiveOrbRenderer } from './active-orb-renderer';
import { DefaultToggleRenderer } from './default-toggle-renderer';

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
  private readonly modalService = inject(NgbModal);
  private readonly commandBusService = inject(CommandBusService);
  private readonly confirmService = inject(ConfirmService);
  private readonly serverService = inject(ServerService);
  private readonly qbService = inject(QbService);
  private readonly credentialPromptService = inject(CredentialPromptService);
  private readonly toastService = inject(ToastService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
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
      cellRenderer: ActiveOrbRenderer,
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
      cellRenderer: DefaultToggleRenderer,
      cellRendererParams: {
        onToggle: (server: ServerRecord) => this.toggleDefault(server),
      },
    },
    {
      colId: 'id',
      field: 'id',
      headerName: this.translateService.instant('components.modals.manage-servers.column.id'),
      filter: TextColumnFilter,
      hide: true,
    },
  ]);

  constructor() {
    // Finding 1: connecting to a server only updates `currentServerId`; ag-grid's
    // `valueGetter`/`rowClassRules`/`isRowSelectable` closures are only re-evaluated
    // when the grid is explicitly told to refresh/redraw. Without this, the orb stays
    // on the old server, the old row stays selectable, and the newly-active row (which
    // was selected to be connected to) stays checked - letting Delete target the server
    // you just connected to.
    effect(() => {
      const currentId = this.serverStoreService.currentServerId();
      this.hideConnect();
      const api = this.gridApi;
      if (!api) return;

      api.refreshCells({ columns: ['orb'], force: true });
      api.redrawRows();

      if (!currentId) return;
      const stillSelected = api.getSelectedRows().some((row) => row.id === currentId);
      if (!stillSelected) return;

      const node = api.getRowNode(currentId);
      if (node) {
        api.setNodesSelected({ nodes: [node], newValue: false });
      }
      // Read/write selectedServers untracked - selectedServers is not meant to be a
      // dependency of this effect, and tracking it here would make this effect
      // re-trigger itself every time it writes (infinite loop).
      untracked(() => {
        this.selectedServers.set(this.selectedServers().filter((s) => s.id !== currentId));
      });
    });
  }

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
    onCellContextMenu: (event) => this.onCellContextMenu(event),
    onColumnHeaderContextMenu: (event) => this.onColumnHeaderContextMenu(event),
    onRowDoubleClicked: (event) => {
      if (!event.data) return;
      void this.openEditFor(event.data);
    },
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

  async openNew(): Promise<void> {
    const { ServerEditor } = await import('../server-editor/server-editor');
    const ref = this.modalService.open(ServerEditor, { size: 'lg' });
    try {
      const id: string = await ref.result;
      this.commandBusService.emit({ type: 'SERVER_ADDED', id });
    } catch {
      // dismissed - no-op
    }
  }

  async openEdit(): Promise<void> {
    const [server] = this.selectedServers();
    if (!server) return;
    await this.openEditFor(server);
  }

  private async openEditFor(server: ServerRecord): Promise<void> {
    const { ServerEditor } = await import('../server-editor/server-editor');
    const ref = this.modalService.open(ServerEditor, { size: 'lg' });
    setModalInput(ref, 'id', server.id);
    await ref.result.catch(() => {});
  }

  async toggleDefault(server: ServerRecord): Promise<void> {
    await this.serverService.update(server.id, { auto_login: !server.auto_login });
    this.commandBusService.emit({ type: 'SERVER_UPDATED', id: server.id });
  }

  async connectSelected(): Promise<void> {
    const [server] = this.selectedServers();
    if (!server) return;
    await this.connectServer(server);
  }

  private async connectServer(server: ServerRecord): Promise<void> {
    try {
      const hasSession = await this.qbService.auth.hasCookie(server.id);

      if (!hasSession) {
        let runtimeUsername: string | undefined;
        let runtimePassword: string | undefined;

        if (this.credentialPromptService.needsPrompt(server)) {
          const resolved = await this.credentialPromptService.resolve(server);
          if (resolved === null) return;
          runtimeUsername = resolved.username;
          runtimePassword = resolved.password;
        }

        const loginRes = await this.qbService.auth.login(
          server.id,
          runtimeUsername,
          runtimePassword,
        );
        if (!loginRes.loggedIn) throw new Error('Login failed');
      }

      this.serverStoreService.select(server.id);
      // Deliberately no activeModal.dismiss() here - the manage servers grid
      // stays open after connecting, unlike the pre-redesign flow.
    } catch (err) {
      console.error(ManageServers.name, 'connectSelected', err);
      this.toastService.danger(
        `"${server.name || server.host}"`,
        this.translateService.instant(
          'services.menu-bar-command-handler.error.failed-to-connect-title',
        ),
      );
    }
  }

  async deleteSelected(): Promise<void> {
    // Defense in depth for Finding 1: the active server's row is non-selectable and row
    // actions no longer mutate `selectedServers` (Finding 2), but if the UI ever briefly
    // shows it selected, the active server must never be deletable through this path.
    const currentId = this.serverStoreService.currentServerId();
    const servers = this.selectedServers().filter((s) => s.id !== currentId);
    if (!servers.length) return;
    await this.deleteServers(servers);
  }

  private async deleteServers(servers: ServerRecord[]): Promise<void> {
    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-servers.delete-confirm.title',
      servers.length === 1
        ? {
            text: 'components.modals.manage-servers.delete-confirm.message',
            data: { name: servers[0].name || servers[0].host },
          }
        : {
            text: 'components.modals.manage-servers.delete-confirm.message-plural',
            data: { count: servers.length },
          },
      'general.button.delete',
      undefined,
      undefined,
      faTrashCan,
    );
    if (!confirmed) return;

    for (const server of servers) {
      this.commandBusService.emit({ type: 'SERVER_DELETED', id: server.id });
    }
  }

  private onCellContextMenu(event: CellContextMenuEvent<ServerRecord>): void {
    if (!event.data) return;
    const server = event.data;
    const isActiveServer = server.id === this.serverStoreService.currentServerId();

    const items: ContextMenuEntry[] = [
      ...(this.hideConnect()
        ? []
        : ([
            {
              kind: 'item',
              id: 'connect',
              label: 'general.button.connect',
              icon: faPlug,
              action: () => void this.connectServer(server),
            },
            {
              kind: 'item',
              id: 'toggle-default',
              label: server.auto_login
                ? 'components.modals.manage-servers.tooltip.unset-default'
                : 'components.modals.manage-servers.tooltip.set-as-default',
              icon: faStar,
              action: () => void this.toggleDefault(server),
            },
            { kind: 'divider' },
          ] satisfies ContextMenuEntry[])),
      {
        kind: 'item',
        id: 'edit',
        label: 'general.button.edit',
        icon: faPenToSquare,
        action: () => void this.openEditFor(server),
      },
      ...(isActiveServer
        ? []
        : ([
            {
              kind: 'item',
              id: 'delete',
              label: 'general.button.delete',
              icon: faTrashCan,
              variant: 'danger',
              action: () => void this.deleteServers([server]),
            },
          ] satisfies ContextMenuEntry[])),
    ];

    this.contextMenuService.open({ items });
  }

  private onColumnHeaderContextMenu(event: ColumnHeaderContextMenuEvent<ServerRecord>): void {
    if (!event.column) return;
    this.contextMenuService.open({ items: this.gridContextMenuService.buildHeaderMenu(event) });
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
