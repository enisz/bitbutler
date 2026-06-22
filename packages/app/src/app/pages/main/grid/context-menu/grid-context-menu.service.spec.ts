import { Clipboard } from '@angular/cdk/clipboard';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import type { Torrent } from '../../../../models/torrent.model';
import { CommandBusService } from '../../../../services/command-bus.service';
import { FilterService } from '../../../../services/filter.service';
import { PathService } from '../../../../services/path.service';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ToastService } from '../../../../services/toast.service';
import { TorrentListGridSettingsService } from '../../../../services/torrent-list-grid.settings.service';
import type { ContextMenuEntry, GridContextMenuData } from './context-menu.types';
import { GridContextMenuService } from './grid-context-menu.service';

function findItem(
  entries: ContextMenuEntry[],
  id: string,
): Extract<ContextMenuEntry, { kind: 'item' }> | undefined {
  for (const entry of entries) {
    if (entry.kind === 'item' && entry.id === id) return entry;
    if (entry.kind === 'submenu') {
      const found = findItem(entry.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function makeRow(overrides: Partial<Torrent> = {}): Torrent {
  return {
    hash: 'abc123',
    magnet_uri: 'magnet:?xt=abc123',
    super_seeding: false,
    auto_tmm: false,
    save_path: '/downloads',
    content_path: '/downloads/file.mkv',
    name: 'My Torrent',
    ...overrides,
  } as Torrent;
}

function makeData(overrides: Partial<GridContextMenuData> = {}): GridContextMenuData {
  const row = overrides.row ?? makeRow();

  return {
    row,
    selected: [row],
    rowPinned: null,
    ...overrides,
  };
}

function makeColumn(overrides: Record<string, any> = {}) {
  return {
    getId: vi.fn().mockReturnValue('name'),
    getColId: vi.fn().mockReturnValue('name'),
    getSort: vi.fn().mockReturnValue(null),
    getColDef: vi.fn().mockReturnValue({ filter: true, colId: 'name', headerName: 'Name' }),
    isFilterActive: vi.fn().mockReturnValue(false),
    isPinnedLeft: vi.fn().mockReturnValue(false),
    isPinnedRight: vi.fn().mockReturnValue(false),
    getPinned: vi.fn().mockReturnValue(null),
    isVisible: vi.fn().mockReturnValue(true),
    ...overrides,
  };
}

function makeApi(column: any, overrides: Record<string, any> = {}) {
  return {
    getColumnDefs: vi.fn().mockReturnValue([{ colId: 'name', floatingFilter: false }]),
    getColumns: vi.fn().mockReturnValue([column]),
    getDisplayNameForColumn: vi.fn().mockReturnValue('Name'),
    applyColumnState: vi.fn(),
    showColumnFilter: vi.fn(),
    setColumnsVisible: vi.fn(),
    setColumnsPinned: vi.fn(),
    autoSizeColumns: vi.fn(),
    autoSizeAllColumns: vi.fn(),
    updateGridOptions: vi.fn(),
    getColumn: vi.fn().mockReturnValue(column),
    ...overrides,
  };
}

describe('GridContextMenuService', () => {
  let service: GridContextMenuService;
  let commandBusService: { emit: ReturnType<typeof vi.fn> };
  let clipboard: { copy: ReturnType<typeof vi.fn> };
  let qbService: { torrents: { files: ReturnType<typeof vi.fn> } };
  let pathService: { resolveLocalPath: ReturnType<typeof vi.fn> };
  let filterService: { clearColumnFilter: ReturnType<typeof vi.fn> };
  let toastService: { danger: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let translateService: { instant: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    commandBusService = { emit: vi.fn() };
    clipboard = { copy: vi.fn() };
    qbService = { torrents: { files: vi.fn().mockResolvedValue([{}, {}]) } };
    pathService = { resolveLocalPath: vi.fn().mockResolvedValue('/local/path') };
    filterService = { clearColumnFilter: vi.fn() };
    toastService = { danger: vi.fn(), info: vi.fn() };
    translateService = { instant: vi.fn((key: string) => key) };

    (window as any).bitbutler = {
      export: {
        saveTorrentFiles: vi
          .fn()
          .mockResolvedValue({ cancelled: false, savedPaths: ['/tmp/x.torrent'], failed: [] }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        GridContextMenuService,
        { provide: CommandBusService, useValue: commandBusService },
        { provide: Clipboard, useValue: clipboard },
        { provide: QbService, useValue: qbService },
        { provide: PathService, useValue: pathService },
        { provide: FilterService, useValue: filterService },
        {
          provide: ServerStoreService,
          useValue: {
            currentServerId: signal('server-1'),
            currentServer: signal({ id: 'server-1', export_available: 1 } as any),
          },
        },
        { provide: ToastService, useValue: toastService },
        {
          provide: TorrentListGridSettingsService,
          useValue: { asObservable: vi.fn(), save: vi.fn() },
        },
        { provide: TranslateService, useValue: translateService },
      ],
    });

    service = TestBed.inject(GridContextMenuService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('buildTorrentMenu', () => {
    describe('menu structure', () => {
      it('should include top-level control items', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        expect(findItem(entries, 'control.start')).toBeDefined();
        expect(findItem(entries, 'control.stop')).toBeDefined();
        expect(findItem(entries, 'control.forceResume')).toBeDefined();
      });

      it('should include torrent details and remove items', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        expect(findItem(entries, 'torrent.details')).toBeDefined();
        expect(findItem(entries, 'files.remove')).toBeDefined();
      });

      it('should include the reworked copy submenu children', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        expect(findItem(entries, 'cell.copyValue')).toBeUndefined();
        expect(findItem(entries, 'torrent.copyName')).toBeDefined();
        expect(findItem(entries, 'torrent.copyMagnet')).toBeDefined();
        expect(findItem(entries, 'torrent.copyInfoHash')).toBeDefined();
        expect(findItem(entries, 'torrent.copySavePath')).toBeDefined();
        expect(findItem(entries, 'torrent.copyJson')).toBeDefined();
      });

      it('should include queue submenu with move items', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        expect(findItem(entries, 'queue.moveTop')).toBeDefined();
        expect(findItem(entries, 'queue.moveUp')).toBeDefined();
        expect(findItem(entries, 'queue.moveDown')).toBeDefined();
        expect(findItem(entries, 'queue.moveBottom')).toBeDefined();
      });
    });

    describe('pin disabled state', () => {
      it('pinToTop is disabled with a tooltip when row is already pinned to top', async () => {
        const entries = await service.buildTorrentMenu(makeData({ rowPinned: 'top' }));
        expect(findItem(entries, 'row.pinToTop')?.disabled).toBe(true);
        expect(findItem(entries, 'row.pinToTop')?.tooltip).toBe(
          'pages.main.grid.context-menu.tooltip.already-pinned-top',
        );
      });

      it('pinToTop is enabled with no tooltip when row is not pinned to top', async () => {
        const entries = await service.buildTorrentMenu(makeData({ rowPinned: null }));
        expect(findItem(entries, 'row.pinToTop')?.disabled).toBeFalsy();
        expect(findItem(entries, 'row.pinToTop')?.tooltip).toBeUndefined();
      });

      it('pinToBottom is disabled with a tooltip when row is already pinned to bottom', async () => {
        const entries = await service.buildTorrentMenu(makeData({ rowPinned: 'bottom' }));
        expect(findItem(entries, 'row.pinToBottom')?.disabled).toBe(true);
        expect(findItem(entries, 'row.pinToBottom')?.tooltip).toBe(
          'pages.main.grid.context-menu.tooltip.already-pinned-bottom',
        );
      });

      it('unpin is disabled with a tooltip when row is not pinned', async () => {
        const entries = await service.buildTorrentMenu(makeData({ rowPinned: null }));
        expect(findItem(entries, 'row.unpin')?.disabled).toBe(true);
        expect(findItem(entries, 'row.unpin')?.tooltip).toBe(
          'pages.main.grid.context-menu.tooltip.not-pinned',
        );
      });

      it('unpin is enabled with no tooltip when row is pinned', async () => {
        const entries = await service.buildTorrentMenu(makeData({ rowPinned: 'top' }));
        expect(findItem(entries, 'row.unpin')?.disabled).toBeFalsy();
        expect(findItem(entries, 'row.unpin')?.tooltip).toBeUndefined();
      });
    });

    describe('super seeding label', () => {
      it('shows "enable" label when super seeding is off', async () => {
        const entries = await service.buildTorrentMenu(
          makeData({ row: makeRow({ super_seeding: false }) }),
        );
        expect(findItem(entries, 'speed.superSeeding')?.label).toContain('enable-super-seeding');
      });

      it('shows "disable" label when super seeding is on', async () => {
        const entries = await service.buildTorrentMenu(
          makeData({ row: makeRow({ super_seeding: true }) }),
        );
        expect(findItem(entries, 'speed.superSeeding')?.label).toContain('disable-super-seeding');
      });
    });

    describe('auto TMM label', () => {
      it('shows "enable" label when auto TMM is off', async () => {
        const entries = await service.buildTorrentMenu(
          makeData({ row: makeRow({ auto_tmm: false }) }),
        );
        expect(findItem(entries, 'maintenance.autoTmm')?.label).toContain('enable-auto-tmm');
      });

      it('shows "disable" label when auto TMM is on', async () => {
        const entries = await service.buildTorrentMenu(
          makeData({ row: makeRow({ auto_tmm: true }) }),
        );
        expect(findItem(entries, 'maintenance.autoTmm')?.label).toContain('disable-auto-tmm');
      });
    });

    describe('files.openDestination', () => {
      it('uses "show-in-folder" label when torrent has exactly one content file', async () => {
        qbService.torrents.files.mockResolvedValue([{}]);
        const entries = await service.buildTorrentMenu(makeData());
        expect(findItem(entries, 'files.openDestination')?.label).toContain('show-in-folder');
      });

      it('uses "open-destination" label when torrent has multiple content files', async () => {
        qbService.torrents.files.mockResolvedValue([{}, {}]);
        const entries = await service.buildTorrentMenu(makeData());
        expect(findItem(entries, 'files.openDestination')?.label).toContain('open-destination');
      });

      it('is disabled with a tooltip when local path cannot be resolved', async () => {
        pathService.resolveLocalPath.mockResolvedValue(null);
        const entries = await service.buildTorrentMenu(makeData());
        expect(findItem(entries, 'files.openDestination')?.disabled).toBe(true);
        expect(findItem(entries, 'files.openDestination')?.tooltip).toBe(
          'pages.main.grid.context-menu.tooltip.open-destination-unresolved',
        );
      });

      it('is enabled when local path is resolved', async () => {
        pathService.resolveLocalPath.mockResolvedValue('/local/downloads');
        const entries = await service.buildTorrentMenu(makeData());
        expect(findItem(entries, 'files.openDestination')?.disabled).toBeFalsy();
      });
    });

    describe('torrent.exportFile', () => {
      it('is enabled when export_available is 1', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        expect(findItem(entries, 'torrent.exportFile')?.disabled).toBeFalsy();
      });

      it('is disabled with a tooltip when export_available is 0', async () => {
        (TestBed.inject(ServerStoreService) as any).currentServer.set({
          id: 'server-1',
          export_available: 0,
        });
        const entries = await service.buildTorrentMenu(makeData());
        expect(findItem(entries, 'torrent.exportFile')?.disabled).toBe(true);
        expect(findItem(entries, 'torrent.exportFile')?.tooltip).toBe(
          'pages.main.grid.context-menu.tooltip.export-unavailable',
        );
      });

      it('is disabled when export_available is null', async () => {
        (TestBed.inject(ServerStoreService) as any).currentServer.set({
          id: 'server-1',
          export_available: null,
        });
        const entries = await service.buildTorrentMenu(makeData());
        expect(findItem(entries, 'torrent.exportFile')?.disabled).toBe(true);
      });

      it('uses the singular label for a single selection', async () => {
        const row = makeRow();
        const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
        expect(findItem(entries, 'torrent.exportFile')?.label).toBe(
          'pages.main.grid.context-menu.item.export-torrent-file',
        );
      });

      it('uses the plural label for a multi-selection', async () => {
        const rowA = makeRow({ hash: 'a' });
        const rowB = makeRow({ hash: 'b' });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );
        expect(findItem(entries, 'torrent.exportFile')?.label).toBe(
          'pages.main.grid.context-menu.item.export-torrent-files',
        );
      });

      it('calls saveTorrentFiles with hash/name pairs for the selection', async () => {
        const rowA = makeRow({ hash: 'a', name: 'Film A' });
        const rowB = makeRow({ hash: 'b', name: 'Film B' });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );
        await (findItem(entries, 'torrent.exportFile')!.action as () => Promise<void>)();
        expect(window.bitbutler.export.saveTorrentFiles).toHaveBeenCalledWith({
          serverId: 'server-1',
          items: [
            { hash: 'a', name: 'Film A' },
            { hash: 'b', name: 'Film B' },
          ],
        });
      });

      it('shows a danger toast summarizing failures', async () => {
        (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
          cancelled: false,
          savedPaths: [],
          failed: [{ hash: 'a', name: 'Film A', error: 'boom' }],
        });
        const row = makeRow();
        const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
        await (findItem(entries, 'torrent.exportFile')!.action as () => Promise<void>)();
        expect(toastService.danger).toHaveBeenCalled();
      });

      it('does not toast when nothing failed', async () => {
        const row = makeRow();
        const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
        await (findItem(entries, 'torrent.exportFile')!.action as () => Promise<void>)();
        expect(toastService.danger).not.toHaveBeenCalled();
      });

      it('translates the failure count and title before toasting', async () => {
        (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
          cancelled: false,
          savedPaths: [],
          failed: [{ hash: 'a', name: 'Film A', error: 'boom' }],
        });
        const row = makeRow();
        const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
        await (findItem(entries, 'torrent.exportFile')!.action as () => Promise<void>)();
        expect(translateService.instant).toHaveBeenCalledWith(
          'pages.main.grid.context-menu.toast.export-failed-title',
        );
        expect(translateService.instant).toHaveBeenCalledWith(
          'pages.main.grid.context-menu.toast.export-failed-count',
          { failed: 1, total: 1 },
        );
      });

      it('shows a friendly error message when saveTorrentFiles rejects with a QbHttpError', async () => {
        (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
          JSON.stringify({
            name: 'QbHttpError',
            status: 404,
            statusText: 'Not Found',
            body: '...',
            path: '/api/v2/torrents/export',
          }),
        );
        const row = makeRow();
        const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
        await (findItem(entries, 'torrent.exportFile')!.action as () => Promise<void>)();
        expect(toastService.danger).toHaveBeenCalledWith(
          '404 Not Found',
          'pages.main.grid.context-menu.toast.export-failed-title',
        );
      });
    });

    describe('actions', () => {
      it('control.start action emits TORRENT_RESUME', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'control.start')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'TORRENT_RESUME' });
      });

      it('control.stop action emits TORRENT_PAUSE', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'control.stop')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'TORRENT_PAUSE' });
      });

      it('torrent.details action emits UI_OPEN_TORRENT_DETAILS with the torrent hash', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'torrent.details')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_OPEN_TORRENT_DETAILS',
          hash: 'abc123',
        });
      });

      it('files.remove action emits UI_TORRENT_DELETE_REQUEST', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'files.remove')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_TORRENT_DELETE_REQUEST',
          defaultRemoveFiles: false,
        });
      });

      it('torrent.copyName action copies the torrent name for a single selection', async () => {
        const row = makeRow({ name: 'My Film' });
        const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
        (findItem(entries, 'torrent.copyName')!.action as () => void)();
        expect(clipboard.copy).toHaveBeenCalledWith('My Film');
        expect(toastService.info).toHaveBeenCalledWith(
          'pages.main.grid.context-menu.toast.copied-to-clipboard',
        );
      });

      it('torrent.copyName action joins names with a newline for multi-selection', async () => {
        const rowA = makeRow({ hash: 'a', name: 'Film A' });
        const rowB = makeRow({ hash: 'b', name: 'Film B' });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );
        (findItem(entries, 'torrent.copyName')!.action as () => void)();
        expect(clipboard.copy).toHaveBeenCalledWith('Film A\nFilm B');
        expect(toastService.info).toHaveBeenCalledWith(
          'pages.main.grid.context-menu.toast.copied-to-clipboard',
        );
      });

      it('torrent.copySavePath action copies the save path for a single selection', async () => {
        const row = makeRow({ save_path: '/downloads/movies' });
        const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
        (findItem(entries, 'torrent.copySavePath')!.action as () => void)();
        expect(clipboard.copy).toHaveBeenCalledWith('/downloads/movies');
        expect(toastService.info).toHaveBeenCalledWith(
          'pages.main.grid.context-menu.toast.copied-to-clipboard',
        );
      });

      it('torrent.copySavePath action joins save paths with a newline for multi-selection', async () => {
        const rowA = makeRow({ hash: 'a', save_path: '/downloads/a' });
        const rowB = makeRow({ hash: 'b', save_path: '/downloads/b' });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );
        (findItem(entries, 'torrent.copySavePath')!.action as () => void)();
        expect(clipboard.copy).toHaveBeenCalledWith('/downloads/a\n/downloads/b');
        expect(toastService.info).toHaveBeenCalledWith(
          'pages.main.grid.context-menu.toast.copied-to-clipboard',
        );
      });

      it('torrent.copyJson action always copies an array, even for a single torrent', async () => {
        const row = makeRow();
        const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
        (findItem(entries, 'torrent.copyJson')!.action as () => void)();
        expect(clipboard.copy).toHaveBeenCalledWith(JSON.stringify([row], null, 2));
        expect(toastService.info).toHaveBeenCalledWith(
          'pages.main.grid.context-menu.toast.copied-to-clipboard',
        );
      });

      it('torrent.copyInfoHash action copies the torrent hash', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'torrent.copyInfoHash')!.action as () => void)();
        expect(clipboard.copy).toHaveBeenCalledWith('abc123');
        expect(toastService.info).toHaveBeenCalledWith(
          'pages.main.grid.context-menu.toast.copied-to-clipboard',
        );
      });

      it('torrent.copyMagnet action copies the magnet URI', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'torrent.copyMagnet')!.action as () => void)();
        expect(clipboard.copy).toHaveBeenCalledWith('magnet:?xt=abc123');
        expect(toastService.info).toHaveBeenCalledWith(
          'pages.main.grid.context-menu.toast.copied-to-clipboard',
        );
      });

      it('torrent.copyJson action copies the selection as formatted JSON', async () => {
        const row = makeRow();
        const entries = await service.buildTorrentMenu(makeData({ row }));
        (findItem(entries, 'torrent.copyJson')!.action as () => void)();
        expect(clipboard.copy).toHaveBeenCalledWith(JSON.stringify([row], null, 2));
        expect(toastService.info).toHaveBeenCalledWith(
          'pages.main.grid.context-menu.toast.copied-to-clipboard',
        );
      });

      it('torrent.copyName action requests the plural field label for multi-selection', async () => {
        const rowA = makeRow({ hash: 'a' });
        const rowB = makeRow({ hash: 'b' });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );
        (findItem(entries, 'torrent.copyName')!.action as () => void)();
        expect(translateService.instant).toHaveBeenCalledWith(
          'pages.main.grid.context-menu.field.names',
        );
      });

      it('row.pinToTop action emits UI_TORRENT_PIN_TOP', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'row.pinToTop')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'UI_TORRENT_PIN_TOP' });
      });

      it('row.pinToBottom action emits UI_TORRENT_PIN_BOTTOM', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'row.pinToBottom')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'UI_TORRENT_PIN_BOTTOM' });
      });

      it('row.unpin action emits UI_TORRENT_UNPIN', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'row.unpin')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'UI_TORRENT_UNPIN' });
      });

      it('queue.moveTop action emits QUEUE_MOVE_TOP', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'queue.moveTop')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'QUEUE_MOVE_TOP' });
      });

      it('maintenance.forceRecheck action emits TORRENT_RECHECK', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'maintenance.forceRecheck')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'TORRENT_RECHECK' });
      });

      it('control.forceResume action emits TORRENT_FORCE_RESUME', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'control.forceResume')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'TORRENT_FORCE_RESUME' });
      });

      it('files.setLocation action emits UI_SET_TORRENT_LOCATION with the torrent and selected hashes', async () => {
        const row = makeRow();
        const entries = await service.buildTorrentMenu(makeData({ row }));
        (findItem(entries, 'files.setLocation')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_SET_TORRENT_LOCATION',
          torrent: row,
          hashes: [row.hash],
        });
      });

      it('files.openDestination action emits UI_OPEN_DESTINATION with hash and content path', async () => {
        const row = makeRow();
        const entries = await service.buildTorrentMenu(makeData({ row }));
        (findItem(entries, 'files.openDestination')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_OPEN_DESTINATION',
          remotePath: row.content_path,
          hash: row.hash,
        });
      });

      it('files.renameTorrent action emits UI_RENAME_TORRENT with the torrent', async () => {
        const row = makeRow();
        const entries = await service.buildTorrentMenu(makeData({ row }));
        (findItem(entries, 'files.renameTorrent')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_RENAME_TORRENT',
          torrent: row,
        });
      });

      it('files.renameFiles action emits UI_RENAME_FILES with the torrent hash', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'files.renameFiles')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_RENAME_FILES',
          hash: 'abc123',
        });
      });

      it('files.category action emits UI_SET_TORRENT_CATEGORY with the torrent and selected hashes', async () => {
        const row = makeRow();
        const entries = await service.buildTorrentMenu(makeData({ row }));
        (findItem(entries, 'files.category')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_SET_TORRENT_CATEGORY',
          torrent: row,
          hashes: [row.hash],
        });
      });

      it('files.tags action emits UI_SET_TORRENT_TAGS with the torrent and selected hashes', async () => {
        const row = makeRow();
        const entries = await service.buildTorrentMenu(makeData({ row }));
        (findItem(entries, 'files.tags')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_SET_TORRENT_TAGS',
          torrent: row,
          hashes: [row.hash],
        });
      });

      it('UI_SET_TORRENT_LOCATION/CATEGORY/TAGS carry the full selection hashes for a multi-selection', async () => {
        const rowA = makeRow({ hash: 'hash-a' });
        const rowB = makeRow({ hash: 'hash-b' });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );

        (findItem(entries, 'files.setLocation')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_SET_TORRENT_LOCATION',
          torrent: rowA,
          hashes: ['hash-a', 'hash-b'],
        });

        (findItem(entries, 'files.category')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_SET_TORRENT_CATEGORY',
          torrent: rowA,
          hashes: ['hash-a', 'hash-b'],
        });

        (findItem(entries, 'files.tags')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_SET_TORRENT_TAGS',
          torrent: rowA,
          hashes: ['hash-a', 'hash-b'],
        });
      });

      it('speed.limitTransferRate action emits UI_LIMIT_TRANSFER targeting torrent', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'speed.limitTransferRate')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_LIMIT_TRANSFER',
          target: 'torrent',
        });
      });

      it('speed.limitTorrentShare action emits UI_LIMIT_SHARE', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'speed.limitTorrentShare')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'UI_LIMIT_SHARE' });
      });

      it('speed.superSeeding action emits TORRENT_SUPER_SEEDING with the current status', async () => {
        const entries = await service.buildTorrentMenu(
          makeData({ row: makeRow({ super_seeding: true }) }),
        );
        (findItem(entries, 'speed.superSeeding')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'TORRENT_SUPER_SEEDING',
          status: true,
        });
      });

      it('maintenance.forceReannounce action emits TORRENT_REANNOUNCE', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'maintenance.forceReannounce')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'TORRENT_REANNOUNCE' });
      });

      it('maintenance.autoTmm action emits TORRENT_AUTO_TMM with the current status', async () => {
        const entries = await service.buildTorrentMenu(
          makeData({ row: makeRow({ auto_tmm: false }) }),
        );
        (findItem(entries, 'maintenance.autoTmm')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'TORRENT_AUTO_TMM',
          status: false,
        });
      });

      it('queue.moveUp action emits QUEUE_MOVE_UP', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'queue.moveUp')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'QUEUE_MOVE_UP' });
      });

      it('queue.moveDown action emits QUEUE_MOVE_DOWN', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'queue.moveDown')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'QUEUE_MOVE_DOWN' });
      });

      it('queue.moveBottom action emits QUEUE_MOVE_BOTTOM', async () => {
        const entries = await service.buildTorrentMenu(makeData());
        (findItem(entries, 'queue.moveBottom')!.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'QUEUE_MOVE_BOTTOM' });
      });
    });

    describe('multi-selection behavior', () => {
      it('hides single-target-only items when multiple torrents are selected', async () => {
        const rowA = makeRow({ hash: 'hash-a' });
        const rowB = makeRow({ hash: 'hash-b' });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );

        expect(findItem(entries, 'torrent.details')).toBeUndefined();
        expect(findItem(entries, 'files.openDestination')).toBeUndefined();
        expect(findItem(entries, 'files.renameTorrent')).toBeUndefined();
        expect(findItem(entries, 'files.renameFiles')).toBeUndefined();
      });

      it('keeps single-target-only items when a single torrent is selected', async () => {
        const entries = await service.buildTorrentMenu(makeData());

        expect(findItem(entries, 'torrent.details')).toBeDefined();
        expect(findItem(entries, 'files.openDestination')).toBeDefined();
        expect(findItem(entries, 'files.renameTorrent')).toBeDefined();
        expect(findItem(entries, 'files.renameFiles')).toBeDefined();
      });

      it('pluralizes copy labels and joins clipboard content with newlines for multi-selection', async () => {
        const rowA = makeRow({ hash: 'hash-a', magnet_uri: 'magnet:?xt=hash-a' });
        const rowB = makeRow({ hash: 'hash-b', magnet_uri: 'magnet:?xt=hash-b' });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );

        expect(findItem(entries, 'torrent.copyInfoHash')?.label).toContain('copy-info-hashes');
        (findItem(entries, 'torrent.copyInfoHash')!.action as () => void)();
        expect(clipboard.copy).toHaveBeenCalledWith('hash-a\nhash-b');

        expect(findItem(entries, 'torrent.copyMagnet')?.label).toContain('copy-magnet-links');
        (findItem(entries, 'torrent.copyMagnet')!.action as () => void)();
        expect(clipboard.copy).toHaveBeenCalledWith('magnet:?xt=hash-a\nmagnet:?xt=hash-b');

        (findItem(entries, 'torrent.copyJson')!.action as () => void)();
        expect(clipboard.copy).toHaveBeenCalledWith(JSON.stringify([rowA, rowB], null, 2));
      });

      it('uses singular copy labels for a single selection', async () => {
        const entries = await service.buildTorrentMenu(makeData());

        expect(findItem(entries, 'torrent.copyInfoHash')?.label).toBe(
          'pages.main.grid.context-menu.item.copy-info-hash',
        );
        expect(findItem(entries, 'torrent.copyMagnet')?.label).toBe(
          'pages.main.grid.context-menu.item.copy-magnet-link',
        );
      });
    });

    describe('super seeding icon', () => {
      it('shows the check icon and "disable" label when every selected torrent has it on', async () => {
        const rowA = makeRow({ hash: 'hash-a', super_seeding: true });
        const rowB = makeRow({ hash: 'hash-b', super_seeding: true });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );
        const item = findItem(entries, 'speed.superSeeding')!;

        expect(item.label).toContain('disable-super-seeding');
        expect(item.icon).toBe(faCheck);
        (item.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'TORRENT_SUPER_SEEDING',
          status: true,
        });
      });

      it('shows no icon and "enable" label when every selected torrent has it off', async () => {
        const rowA = makeRow({ hash: 'hash-a', super_seeding: false });
        const rowB = makeRow({ hash: 'hash-b', super_seeding: false });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );
        const item = findItem(entries, 'speed.superSeeding')!;

        expect(item.label).toContain('enable-super-seeding');
        expect(item.icon).toBeUndefined();
        (item.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'TORRENT_SUPER_SEEDING',
          status: false,
        });
      });

      it('shows no icon and "enable" label when the selection is mixed', async () => {
        const rowA = makeRow({ hash: 'hash-a', super_seeding: true });
        const rowB = makeRow({ hash: 'hash-b', super_seeding: false });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );
        const item = findItem(entries, 'speed.superSeeding')!;

        expect(item.label).toContain('enable-super-seeding');
        expect(item.icon).toBeUndefined();
        (item.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'TORRENT_SUPER_SEEDING',
          status: false,
        });
      });
    });

    describe('auto TMM icon', () => {
      it('shows the check icon and "disable" label when every selected torrent has it on', async () => {
        const rowA = makeRow({ hash: 'hash-a', auto_tmm: true });
        const rowB = makeRow({ hash: 'hash-b', auto_tmm: true });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );
        const item = findItem(entries, 'maintenance.autoTmm')!;

        expect(item.label).toContain('disable-auto-tmm');
        expect(item.icon).toBe(faCheck);
        (item.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'TORRENT_AUTO_TMM',
          status: true,
        });
      });

      it('shows no icon and "enable" label when every selected torrent has it off', async () => {
        const rowA = makeRow({ hash: 'hash-a', auto_tmm: false });
        const rowB = makeRow({ hash: 'hash-b', auto_tmm: false });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );
        const item = findItem(entries, 'maintenance.autoTmm')!;

        expect(item.label).toContain('enable-auto-tmm');
        expect(item.icon).toBeUndefined();
        (item.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'TORRENT_AUTO_TMM',
          status: false,
        });
      });

      it('shows no icon and "enable" label when the selection is mixed', async () => {
        const rowA = makeRow({ hash: 'hash-a', auto_tmm: true });
        const rowB = makeRow({ hash: 'hash-b', auto_tmm: false });
        const entries = await service.buildTorrentMenu(
          makeData({ row: rowA, selected: [rowA, rowB] }),
        );
        const item = findItem(entries, 'maintenance.autoTmm')!;

        expect(item.label).toContain('enable-auto-tmm');
        expect(item.icon).toBeUndefined();
        (item.action as () => void)();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'TORRENT_AUTO_TMM',
          status: false,
        });
      });
    });
  });

  describe('buildHeaderMenu', () => {
    function build(
      columnOverrides: Record<string, any> = {},
      apiOverrides: Record<string, any> = {},
    ) {
      const column = makeColumn(columnOverrides);
      const api = makeApi(column, apiOverrides);
      return { entries: service.buildHeaderMenu({ api, column } as any), column, api };
    }

    it('should return a header entry with the column display name', () => {
      const { entries } = build();
      const header = entries.find((e) => e.kind === 'header');
      expect(header).toBeDefined();
      expect((header as any).label).toBe('Name');
    });

    describe('sort items', () => {
      it('sort ascending is disabled with a tooltip when already sorted ascending', () => {
        const { entries } = build({ getSort: vi.fn().mockReturnValue('asc') });
        expect(findItem(entries, 'sort.asc.name')?.disabled).toBe(true);
        expect(findItem(entries, 'sort.asc.name')?.tooltip).toBe(
          'pages.main.grid.context-menu.tooltip.already-sorted-ascending',
        );
      });

      it('sort ascending is enabled with no tooltip when not sorted asc', () => {
        const { entries } = build({ getSort: vi.fn().mockReturnValue(null) });
        expect(findItem(entries, 'sort.asc.name')?.disabled).toBeFalsy();
        expect(findItem(entries, 'sort.asc.name')?.tooltip).toBeUndefined();
      });

      it('sort descending is disabled with a tooltip when already sorted descending', () => {
        const { entries } = build({ getSort: vi.fn().mockReturnValue('desc') });
        expect(findItem(entries, 'sort.desc.name')?.disabled).toBe(true);
        expect(findItem(entries, 'sort.desc.name')?.tooltip).toBe(
          'pages.main.grid.context-menu.tooltip.already-sorted-descending',
        );
      });

      it('clear sort is disabled with a tooltip when no sort is applied', () => {
        const { entries } = build({ getSort: vi.fn().mockReturnValue(null) });
        expect(findItem(entries, 'sort.clear.name')?.disabled).toBeTruthy();
        expect(findItem(entries, 'sort.clear.name')?.tooltip).toBe(
          'pages.main.grid.context-menu.tooltip.no-sort-applied',
        );
      });

      it('clear sort is enabled with no tooltip when sort is active', () => {
        const { entries } = build({ getSort: vi.fn().mockReturnValue('asc') });
        expect(findItem(entries, 'sort.clear.name')?.disabled).toBeFalsy();
        expect(findItem(entries, 'sort.clear.name')?.tooltip).toBeUndefined();
      });
    });

    describe('filter items', () => {
      it('open filter is disabled with a tooltip when the column has no filter', () => {
        const { entries } = build({ getColDef: vi.fn().mockReturnValue({ colId: 'name' }) });
        expect(findItem(entries, 'filter.open.name')?.disabled).toBe(true);
        expect(findItem(entries, 'filter.open.name')?.tooltip).toBe(
          'pages.main.grid.context-menu.tooltip.filter-not-supported',
        );
      });

      it('open filter is enabled with no tooltip when column has a filter', () => {
        const { entries } = build({ getColDef: vi.fn().mockReturnValue({ filter: true }) });
        expect(findItem(entries, 'filter.open.name')?.disabled).toBeFalsy();
        expect(findItem(entries, 'filter.open.name')?.tooltip).toBeUndefined();
      });

      it('clear filter is disabled with a tooltip when no filter is active', () => {
        const { entries } = build({ isFilterActive: vi.fn().mockReturnValue(false) });
        expect(findItem(entries, 'filter.clear.name')?.disabled).toBe(true);
        expect(findItem(entries, 'filter.clear.name')?.tooltip).toBe(
          'pages.main.grid.context-menu.tooltip.no-filter-active',
        );
      });

      it('clear filter is enabled with no tooltip when column filter is active', () => {
        const { entries } = build({ isFilterActive: vi.fn().mockReturnValue(true) });
        expect(findItem(entries, 'filter.clear.name')?.disabled).toBeFalsy();
        expect(findItem(entries, 'filter.clear.name')?.tooltip).toBeUndefined();
      });

      it('toggle floating filter shows "show" label when floating filters are inactive', () => {
        const { entries } = build(
          {},
          { getColumnDefs: vi.fn().mockReturnValue([{ floatingFilter: false }]) },
        );
        expect(findItem(entries, 'filter.toggleFloating.name')?.label).toContain(
          'show-floating-filters',
        );
      });

      it('toggle floating filter shows "hide" label when floating filters are active', () => {
        const { entries } = build(
          {},
          { getColumnDefs: vi.fn().mockReturnValue([{ floatingFilter: true }]) },
        );
        expect(findItem(entries, 'filter.toggleFloating.name')?.label).toContain(
          'hide-floating-filters',
        );
      });
    });

    describe('pin column items', () => {
      it('pin left is disabled with a tooltip when already pinned left', () => {
        const { entries } = build({ isPinnedLeft: vi.fn().mockReturnValue(true) });
        expect(findItem(entries, 'pinLeft.name')?.disabled).toBe(true);
        expect(findItem(entries, 'pinLeft.name')?.tooltip).toBe(
          'pages.main.grid.context-menu.tooltip.already-pinned-left',
        );
      });

      it('pin left is enabled with no tooltip when not pinned left', () => {
        const { entries } = build({ isPinnedLeft: vi.fn().mockReturnValue(false) });
        expect(findItem(entries, 'pinLeft.name')?.disabled).toBeFalsy();
        expect(findItem(entries, 'pinLeft.name')?.tooltip).toBeUndefined();
      });

      it('pin right is disabled with a tooltip when already pinned right', () => {
        const { entries } = build({ isPinnedRight: vi.fn().mockReturnValue(true) });
        expect(findItem(entries, 'pinRight.name')?.disabled).toBe(true);
        expect(findItem(entries, 'pinRight.name')?.tooltip).toBe(
          'pages.main.grid.context-menu.tooltip.already-pinned-right',
        );
      });

      it('pin right is enabled with no tooltip when not pinned right', () => {
        const { entries } = build({ isPinnedRight: vi.fn().mockReturnValue(false) });
        expect(findItem(entries, 'pinRight.name')?.disabled).toBeFalsy();
        expect(findItem(entries, 'pinRight.name')?.tooltip).toBeUndefined();
      });

      it('unpin column is disabled with a tooltip when not pinned', () => {
        const { entries } = build({ getPinned: vi.fn().mockReturnValue(null) });
        expect(findItem(entries, 'unpinColumn.name')?.disabled).toBeTruthy();
        expect(findItem(entries, 'unpinColumn.name')?.tooltip).toBe(
          'pages.main.grid.context-menu.tooltip.column-not-pinned',
        );
      });

      it('unpin column is enabled with no tooltip when column is pinned', () => {
        const { entries } = build({ getPinned: vi.fn().mockReturnValue('left') });
        expect(findItem(entries, 'unpinColumn.name')?.disabled).toBeFalsy();
        expect(findItem(entries, 'unpinColumn.name')?.tooltip).toBeUndefined();
      });
    });

    describe('floating filters toggle visibility', () => {
      function buildWithOpts(opts: { enableFloatingFiltersToggle?: boolean }) {
        const column = makeColumn();
        const api = makeApi(column);
        return service.buildHeaderMenu({ api, column } as any, opts);
      }

      it('is included when no opts are passed (default)', () => {
        const { entries } = build();
        expect(findItem(entries, 'filter.toggleFloating.name')).toBeDefined();
      });

      it('is included when enableFloatingFiltersToggle is true', () => {
        const entries = buildWithOpts({ enableFloatingFiltersToggle: true });
        expect(findItem(entries, 'filter.toggleFloating.name')).toBeDefined();
      });

      it('is excluded when enableFloatingFiltersToggle is false', () => {
        const entries = buildWithOpts({ enableFloatingFiltersToggle: false });
        expect(findItem(entries, 'filter.toggleFloating.name')).toBeUndefined();
      });

      it('other filter items remain present when toggle is disabled', () => {
        const entries = buildWithOpts({ enableFloatingFiltersToggle: false });
        expect(findItem(entries, 'filter.open.name')).toBeDefined();
        expect(findItem(entries, 'filter.clear.name')).toBeDefined();
      });
    });

    describe('column toggle items', () => {
      it('visible columns have a checkmark icon', () => {
        const { entries } = build({ isVisible: vi.fn().mockReturnValue(true) });
        const toggle = findItem(entries, 'toggle.name');
        expect(toggle?.icon).toBeDefined();
      });

      it('hidden columns have no icon', () => {
        const { entries } = build({ isVisible: vi.fn().mockReturnValue(false) });
        const toggle = findItem(entries, 'toggle.name');
        expect(toggle?.icon).toBeUndefined();
      });
    });

    describe('actions', () => {
      it('sort ascending action calls applyColumnState with asc', () => {
        const { entries, api } = build();
        (findItem(entries, 'sort.asc.name')!.action as () => void)();
        expect(api.applyColumnState).toHaveBeenCalledWith({
          state: [{ colId: 'name', sort: 'asc' }],
        });
      });

      it('sort descending action calls applyColumnState with desc', () => {
        const { entries, api } = build();
        (findItem(entries, 'sort.desc.name')!.action as () => void)();
        expect(api.applyColumnState).toHaveBeenCalledWith({
          state: [{ colId: 'name', sort: 'desc' }],
        });
      });

      it('clear sort action calls applyColumnState with null', () => {
        const { entries, api } = build();
        (findItem(entries, 'sort.clear.name')!.action as () => void)();
        expect(api.applyColumnState).toHaveBeenCalledWith({
          state: [{ colId: 'name', sort: null }],
        });
      });

      it('open filter action calls showColumnFilter', () => {
        const { entries, api } = build();
        (findItem(entries, 'filter.open.name')!.action as () => void)();
        expect(api.showColumnFilter).toHaveBeenCalledWith('name');
      });

      it('clear filter action calls filterService.clearColumnFilter', () => {
        const { entries } = build();
        (findItem(entries, 'filter.clear.name')!.action as () => void)();
        expect(filterService.clearColumnFilter).toHaveBeenCalledWith('name');
      });

      it('pin left action calls setColumnsPinned with left', () => {
        const { entries, api } = build();
        (findItem(entries, 'pinLeft.name')!.action as () => void)();
        expect(api.setColumnsPinned).toHaveBeenCalledWith(['name'], 'left');
      });

      it('pin right action calls setColumnsPinned with right', () => {
        const { entries, api } = build();
        (findItem(entries, 'pinRight.name')!.action as () => void)();
        expect(api.setColumnsPinned).toHaveBeenCalledWith(['name'], 'right');
      });

      it('unpin column action calls setColumnsPinned with null', () => {
        const { entries, api } = build();
        (findItem(entries, 'unpinColumn.name')!.action as () => void)();
        expect(api.setColumnsPinned).toHaveBeenCalledWith(['name'], null);
      });

      it('autosize column action calls autoSizeColumns', () => {
        const { entries, api } = build();
        (findItem(entries, 'resize.column.name')!.action as () => void)();
        expect(api.autoSizeColumns).toHaveBeenCalledWith(['name']);
      });

      it('autosize all columns action calls autoSizeAllColumns', () => {
        const { entries, api } = build();
        (findItem(entries, 'resize.all.name')!.action as () => void)();
        expect(api.autoSizeAllColumns).toHaveBeenCalled();
      });

      it('hide column action toggles column visibility off when column is visible', () => {
        const { entries, api } = build({ isVisible: vi.fn().mockReturnValue(true) });
        (findItem(entries, 'hide.name')!.action as () => void)();
        expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], false);
      });

      it('toggle column action toggles column visibility off when column is visible', () => {
        const { entries, api } = build({ isVisible: vi.fn().mockReturnValue(true) });
        (findItem(entries, 'toggle.name')!.action as () => void)();
        expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], false);
      });

      it('show all columns action calls setColumnsVisible with true for every column', () => {
        const { entries, api } = build();
        (findItem(entries, 'all.show')!.action as () => void)();
        expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], true);
      });

      it('hide all columns action calls setColumnsVisible with false for every column', () => {
        const { entries, api } = build();
        (findItem(entries, 'all.hide')!.action as () => void)();
        expect(api.setColumnsVisible).toHaveBeenCalledWith(['name'], false);
      });

      it('toggle floating filter action calls updateGridOptions and saves floatingFilters state', async () => {
        const gridSettings = TestBed.inject(TorrentListGridSettingsService) as any;
        gridSettings.asObservable.mockReturnValue(of({ floatingFilters: false }));
        const { entries, api } = build(
          {},
          { getColumnDefs: vi.fn().mockReturnValue([{ floatingFilter: false }]) },
        );
        await (findItem(entries, 'filter.toggleFloating.name')!.action as () => Promise<void>)();
        expect(api.updateGridOptions).toHaveBeenCalled();
        expect(gridSettings.save).toHaveBeenCalledWith(
          expect.objectContaining({ floatingFilters: true }),
        );
      });
    });
  });
});
