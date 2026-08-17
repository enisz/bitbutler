import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberColumnFilter } from '../../../components/column-filters/number-column-filter/number-column-filter';
import { SetColumnFilter } from '../../../components/column-filters/set-column-filter/set-column-filter';
import { TextColumnFilter } from '../../../components/column-filters/text-column-filter/text-column-filter';
import { QbTorrentTracker } from '../../../models/qbittorrent.model';
import { ContextMenuEntry } from '../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../pages/main/grid/context-menu/grid-context-menu.service';
import { ContextMenuService } from '../../../services/context-menu.service';
import { ThemeService } from '../../../services/theme.service';
import { TrackersGridSettingsService } from '../../../services/trackers-grid.settings.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { Trackers } from './trackers';

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

describe('Trackers', () => {
  let component: Trackers;
  let fixture: ComponentFixture<Trackers>;
  let mockSettingsService: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let mockContextMenuService: { open: ReturnType<typeof vi.fn> };
  let mockGridContextMenuService: {
    buildHeaderMenu: ReturnType<typeof vi.fn>;
    copyToClipboard: ReturnType<typeof vi.fn>;
  };

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
    mockGridContextMenuService = {
      buildHeaderMenu: vi.fn().mockReturnValue([]),
      copyToClipboard: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Trackers],
      providers: [
        {
          provide: TorrentDetailsDataService,
          useValue: { trackers: signal<QbTorrentTracker[]>([]), trackersLoading: signal(true) },
        },
        { provide: ThemeService, useValue: { effectiveMode: signal('light') } },
        { provide: TrackersGridSettingsService, useValue: mockSettingsService },
        { provide: ContextMenuService, useValue: mockContextMenuService },
        { provide: GridContextMenuService, useValue: mockGridContextMenuService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Trackers);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with loading = true', () => {
    expect(component.loading).toBe(true);
  });

  it('should start with an empty trackers list', () => {
    expect(component.trackers).toHaveLength(0);
  });

  it('should have column definitions', () => {
    expect(component.colDefs.length).toBeGreaterThan(0);
  });

  it('should have gridOptions defined', () => {
    expect(component.gridOptions).toBeDefined();
  });

  describe('data service sync', () => {
    it('reflects updates to the data service trackers and loading signals', () => {
      const dataService = TestBed.inject(TorrentDetailsDataService) as unknown as {
        trackers: ReturnType<typeof signal<QbTorrentTracker[]>>;
        trackersLoading: ReturnType<typeof signal<boolean>>;
      };
      const tracker: QbTorrentTracker = {
        url: 'http://tracker.example.com',
        status: 0,
        tier: 0,
        num_peers: 0,
        num_seeds: 0,
        num_leeches: 0,
        num_downloaded: 0,
        msg: '',
      };

      dataService.trackers.set([tracker]);
      dataService.trackersLoading.set(false);
      fixture.detectChanges();

      expect(component.trackers).toEqual([tracker]);
      expect(component.loading).toBe(false);
    });
  });

  describe('column definitions', () => {
    it('every column has a colId', () => {
      expect(component.colDefs.every((c) => !!c.colId)).toBe(true);
    });

    it('every column has a headerTooltip', () => {
      expect(component.colDefs.every((c) => !!c.headerTooltip)).toBe(true);
    });

    it('every column has either a tooltipField or tooltipValueGetter', () => {
      expect(component.colDefs.every((c) => !!c.tooltipField || !!c.tooltipValueGetter)).toBe(true);
    });

    it('the status column uses a valueFormatter', () => {
      const statusCol = component.colDefs.find((c) => c.colId === 'status');
      expect(statusCol?.valueFormatter).toBeDefined();
    });

    it('the status column uses a tooltipValueGetter', () => {
      const statusCol = component.colDefs.find((c) => c.colId === 'status');
      expect(statusCol?.tooltipValueGetter).toBeDefined();
    });

    it('the status valueFormatter returns a translation key string for each known status', () => {
      const statusCol = component.colDefs.find((c) => c.colId === 'status')!;
      const fmt = statusCol.valueFormatter as (p: any) => string;
      expect(fmt({ value: 0 })).toContain('disabled');
      expect(fmt({ value: 1 })).toContain('not-contacted');
      expect(fmt({ value: 2 })).toContain('working');
      expect(fmt({ value: 3 })).toContain('updating');
      expect(fmt({ value: 4 })).toContain('not-working');
    });

    it('colIds cover all expected fields', () => {
      const colIds = component.colDefs.map((c) => c.colId);
      expect(colIds).toEqual(
        expect.arrayContaining([
          'tier',
          'url',
          'status',
          'num_peers',
          'num_seeds',
          'num_leeches',
          'num_downloaded',
          'msg',
        ]),
      );
    });

    it('assigns NumberColumnFilter to tier, num_peers, num_seeds, num_leeches, and num_downloaded', () => {
      const numberFilterCols = ['tier', 'num_peers', 'num_seeds', 'num_leeches', 'num_downloaded'];
      for (const colId of numberFilterCols) {
        expect(component.colDefs.find((c) => c.colId === colId)?.filter).toBe(NumberColumnFilter);
      }
    });

    it('assigns TextColumnFilter to url', () => {
      expect(component.colDefs.find((c) => c.colId === 'url')?.filter).toBe(TextColumnFilter);
    });

    it('assigns SetColumnFilter to status', () => {
      expect(component.colDefs.find((c) => c.colId === 'status')?.filter).toBe(SetColumnFilter);
    });

    it('has no filter on msg', () => {
      expect(component.colDefs.find((c) => c.colId === 'msg')?.filter).toBe(false);
    });
  });

  describe('column state management', () => {
    it('restoreColumnState loads settings and applies column state', async () => {
      const state = [{ colId: 'tier', hide: false, width: 70 }];
      mockSettingsService.load.mockResolvedValue({ columnState: state });
      const mockApi = {
        applyColumnState: vi.fn(),
        getColumnState: vi.fn().mockReturnValue([]),
      };
      (component as any).gridApi = mockApi;

      await (component as any).restoreColumnState();

      expect(mockSettingsService.load).toHaveBeenCalled();
      expect(mockApi.applyColumnState).toHaveBeenCalledWith({
        state,
        applyOrder: true,
      });
    });

    it('persistColumnState reads column state and saves it', async () => {
      const state = [{ colId: 'tier', hide: false, width: 70 }];
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
        data: { tier: 0, url: 'http://tracker.example.com', status: 'Working', ...overrides },
        value: overrides['url'] ?? 'http://tracker.example.com',
        colDef: { headerName: 'URL' },
      };
    }

    it('opens context menu via contextMenuService when a cell is right-clicked', () => {
      component.gridOptions.onCellContextMenu?.(makeEvent() as any);
      expect(mockContextMenuService.open).toHaveBeenCalled();
    });

    it('row menu contains copy.cellValue and copy.json', () => {
      const menu = (component as any).buildRowMenu(makeEvent());
      expect(findItem(menu, 'copy.cellValue')).toBeDefined();
      expect(findItem(menu, 'copy.json')).toBeDefined();
    });

    it('copy.cellValue action delegates to gridContextMenuService.copyToClipboard', () => {
      const event = { ...makeEvent(), value: 'cell-value' };
      const menu = (component as any).buildRowMenu(event);
      (findItem(menu, 'copy.cellValue')!.action as () => void)();
      expect(mockGridContextMenuService.copyToClipboard).toHaveBeenCalledWith('cell-value', 'URL');
    });

    it('copy.json action delegates to gridContextMenuService.copyToClipboard', () => {
      const event = makeEvent();
      const menu = (component as any).buildRowMenu(event);
      (findItem(menu, 'copy.json')!.action as () => void)();
      expect(mockGridContextMenuService.copyToClipboard).toHaveBeenCalledWith(
        JSON.stringify(event.data, null, 2),
        'pages.main.grid.context-menu.field.row-as-json',
      );
    });
  });

  describe('header context menu', () => {
    function makeHeaderEvent() {
      const column = {
        getId: vi.fn().mockReturnValue('tier'),
        getColDef: vi.fn().mockReturnValue({ colId: 'tier', headerName: 'Tier', filter: false }),
        getSort: vi.fn().mockReturnValue(null),
        isFilterActive: vi.fn().mockReturnValue(false),
        isPinnedLeft: vi.fn().mockReturnValue(false),
        isPinnedRight: vi.fn().mockReturnValue(false),
        getPinned: vi.fn().mockReturnValue(null),
        isVisible: vi.fn().mockReturnValue(true),
      };
      const api = {
        getDisplayNameForColumn: vi.fn().mockReturnValue('Tier'),
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
