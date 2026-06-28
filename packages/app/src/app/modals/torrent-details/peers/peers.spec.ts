import { Clipboard } from '@angular/cdk/clipboard';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbTorrentPeer } from '../../../models/torrent.model';
import { ContextMenuEntry } from '../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../pages/main/grid/context-menu/grid-context-menu.service';
import { ContextMenuService } from '../../../services/context-menu.service';
import { PeersGridSettingsService } from '../../../services/peers-grid.settings.service';
import { ThemeService } from '../../../services/theme.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { Peers } from './peers';

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

describe('Peers', () => {
  let component: Peers;
  let fixture: ComponentFixture<Peers>;
  let mockSettingsService: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let mockContextMenuService: { open: ReturnType<typeof vi.fn> };
  let mockClipboard: { copy: ReturnType<typeof vi.fn> };

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(async () => {
    mockSettingsService = {
      load: vi.fn().mockResolvedValue({ columnState: [] }),
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockContextMenuService = { open: vi.fn() };
    mockClipboard = { copy: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Peers],
      providers: [
        {
          provide: TorrentDetailsDataService,
          useValue: { peers: signal<QbTorrentPeer[]>([]), peersLoading: signal(true) },
        },
        { provide: ThemeService, useValue: { effectiveMode: signal('light') } },
        { provide: PeersGridSettingsService, useValue: mockSettingsService },
        { provide: ContextMenuService, useValue: mockContextMenuService },
        {
          provide: GridContextMenuService,
          useValue: { buildHeaderMenu: vi.fn().mockReturnValue([]) },
        },
        { provide: Clipboard, useValue: mockClipboard },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Peers);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with loading = true', () => {
    expect(component.loading).toBe(true);
  });

  it('should start with an empty peers list', () => {
    expect(component.peers).toHaveLength(0);
  });

  it('should have column definitions', () => {
    expect(component.colDefs.length).toBeGreaterThan(0);
  });

  it('should have grid options defined', () => {
    expect(component.gridOptions).toBeDefined();
  });

  describe('data service sync', () => {
    it('reflects updates to the data service peers and loading signals', () => {
      const dataService = TestBed.inject(TorrentDetailsDataService) as unknown as {
        peers: ReturnType<typeof signal<QbTorrentPeer[]>>;
        peersLoading: ReturnType<typeof signal<boolean>>;
      };
      const peer: QbTorrentPeer = {
        ip: '10.0.0.1',
        port: 51413,
        client: 'qBittorrent',
        dl_speed: 0,
        up_speed: 0,
        progress: 0,
        downloaded: 0,
        uploaded: 0,
        relevance: 0,
        flags: '',
        flags_desc: '',
        connection: 'BT',
        files: '',
      };

      dataService.peers.set([peer]);
      dataService.peersLoading.set(false);
      fixture.detectChanges();

      expect(component.peers).toEqual([peer]);
      expect(component.loading).toBe(false);
    });
  });

  describe('column definitions', () => {
    it('every column has a colId', () => {
      expect(component.colDefs.every((c) => !!c.colId)).toBe(true);
    });

    it('all columns except the flag column have a headerTooltip', () => {
      const withTooltip = component.colDefs.filter((c) => c.colId !== 'country_code');
      expect(withTooltip.every((c) => !!c.headerTooltip)).toBe(true);
    });

    it('text-based columns have a tooltipField', () => {
      const textCols = component.colDefs.filter(
        (c) => c.colId !== 'country_code' && c.colId !== 'progress' && c.colId !== 'flags',
      );
      expect(textCols.every((c) => !!c.tooltipField)).toBe(true);
    });

    it('colIds cover all expected fields', () => {
      const colIds = component.colDefs.map((c) => c.colId);
      expect(colIds).toEqual(
        expect.arrayContaining([
          'country_code',
          'country',
          'ip',
          'port',
          'connection',
          'flags',
          'client',
          'progress',
          'dl_speed',
          'up_speed',
          'downloaded',
          'uploaded',
          'relevance',
          'files',
        ]),
      );
    });
  });

  describe('column state management', () => {
    it('restoreColumnState loads settings and applies column state', async () => {
      const state = [{ colId: 'ip', hide: false }];
      mockSettingsService.load.mockResolvedValue({ columnState: state, floatingFilters: false });
      const mockApi = {
        applyColumnState: vi.fn(),
        getColumnState: vi.fn().mockReturnValue([]),
        getColumnDefs: vi.fn().mockReturnValue([]),
        updateGridOptions: vi.fn(),
      };
      (component as any).gridApi = mockApi;

      await (component as any).restoreColumnState();

      expect(mockSettingsService.load).toHaveBeenCalled();
      expect(mockApi.applyColumnState).toHaveBeenCalledWith({ state, applyOrder: true });
    });

    it('persistColumnState reads column state and saves it', async () => {
      const state = [{ colId: 'ip', hide: false }];
      const mockApi = { applyColumnState: vi.fn(), getColumnState: vi.fn().mockReturnValue(state) };
      (component as any).gridApi = mockApi;

      await (component as any).persistColumnState();

      expect(mockApi.getColumnState).toHaveBeenCalled();
      expect(mockSettingsService.save).toHaveBeenCalledWith({ columnState: state });
    });

    it('restoreColumnState does nothing when gridApi is null', async () => {
      (component as any).gridApi = null;
      await (component as any).restoreColumnState();
      expect(mockSettingsService.load).not.toHaveBeenCalled();
    });

    it('persistColumnState does nothing when gridApi is null', async () => {
      (component as any).gridApi = null;
      await (component as any).persistColumnState();
      expect(mockSettingsService.save).not.toHaveBeenCalled();
    });

    it('queueSave does not emit when isRestoringState is true', () => {
      (component as any).isRestoringState = true;
      const next = vi.spyOn((component as any).saveState$, 'next');
      (component as any).queueSave();
      expect(next).not.toHaveBeenCalled();
    });

    it('queueSave emits when isRestoringState is false', () => {
      (component as any).isRestoringState = false;
      const next = vi.spyOn((component as any).saveState$, 'next');
      (component as any).queueSave();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('row context menu', () => {
    function makeEvent(overrides: Record<string, any> = {}) {
      return {
        data: { ip: '192.168.1.1', port: 6881, client: 'qBittorrent', ...overrides },
        value: overrides['ip'] ?? '192.168.1.1',
      };
    }

    it('opens context menu via contextMenuService when a cell is right-clicked', () => {
      component.gridOptions.onCellContextMenu?.(makeEvent() as any);
      expect(mockContextMenuService.open).toHaveBeenCalled();
    });

    it('row menu contains copy.cellValue, copy.ipPort, and copy.json', () => {
      const menu = (component as any).buildRowMenu(makeEvent());
      expect(findItem(menu, 'copy.cellValue')).toBeDefined();
      expect(findItem(menu, 'copy.ipPort')).toBeDefined();
      expect(findItem(menu, 'copy.json')).toBeDefined();
    });

    it('copy.ipPort is enabled when the row has an ip', () => {
      const menu = (component as any).buildRowMenu(makeEvent({ ip: '192.168.1.1' }));
      expect(findItem(menu, 'copy.ipPort')?.disabled).toBeFalsy();
    });

    it('copy.ipPort is disabled when the row has no ip', () => {
      const menu = (component as any).buildRowMenu(makeEvent({ ip: '' }));
      expect(findItem(menu, 'copy.ipPort')?.disabled).toBe(true);
    });

    it('copy.cellValue action copies the cell value', () => {
      const event = { ...makeEvent(), value: 'cell-value' };
      const menu = (component as any).buildRowMenu(event);
      (findItem(menu, 'copy.cellValue')!.action as () => void)();
      expect(mockClipboard.copy).toHaveBeenCalledWith('cell-value');
    });

    it('copy.ipPort action copies ip:port', () => {
      const menu = (component as any).buildRowMenu(makeEvent({ ip: '10.0.0.1', port: 51413 }));
      (findItem(menu, 'copy.ipPort')!.action as () => void)();
      expect(mockClipboard.copy).toHaveBeenCalledWith('10.0.0.1:51413');
    });

    it('copy.json action copies the row as formatted JSON', () => {
      const event = makeEvent();
      const menu = (component as any).buildRowMenu(event);
      (findItem(menu, 'copy.json')!.action as () => void)();
      expect(mockClipboard.copy).toHaveBeenCalledWith(JSON.stringify(event.data, null, 2));
    });
  });

  describe('header context menu', () => {
    function makeHeaderEvent() {
      const column = {
        getId: vi.fn().mockReturnValue('ip'),
        getColDef: vi.fn().mockReturnValue({ colId: 'ip', headerName: 'IP', filter: false }),
        getSort: vi.fn().mockReturnValue(null),
        isFilterActive: vi.fn().mockReturnValue(false),
        isPinnedLeft: vi.fn().mockReturnValue(false),
        isPinnedRight: vi.fn().mockReturnValue(false),
        getPinned: vi.fn().mockReturnValue(null),
        isVisible: vi.fn().mockReturnValue(true),
      };
      const api = {
        getDisplayNameForColumn: vi.fn().mockReturnValue('IP'),
        getColumnDefs: vi.fn().mockReturnValue([]),
        getColumns: vi.fn().mockReturnValue([column]),
        getColumn: vi.fn().mockReturnValue(column),
      };
      return { column, api };
    }

    it('opens context menu when column header is right-clicked', () => {
      const { column, api } = makeHeaderEvent();
      component.gridOptions.onColumnHeaderContextMenu?.({ column, api } as any);
      expect(mockContextMenuService.open).toHaveBeenCalled();
    });

    it('does not open context menu when the event has no column', () => {
      component.gridOptions.onColumnHeaderContextMenu?.({ column: null, api: {} } as any);
      expect(mockContextMenuService.open).not.toHaveBeenCalled();
    });
  });
});
