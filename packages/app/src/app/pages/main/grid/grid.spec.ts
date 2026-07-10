import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME } from '../../../app.const';
import { CommandBusService } from '../../../services/command-bus.service';
import { ContextMenuService } from '../../../services/context-menu.service';
import { DateFormatService } from '../../../services/date-format.service';
import { ElectronService } from '../../../services/electron.service';
import { FilterService, GRID_FILTER_INITIAL } from '../../../services/filter.service';
import { GridStateService } from '../../../services/grid-state.service';
import { GridViewStoreService } from '../../../services/grid-view-store.service';
import { QbPollingService } from '../../../services/qb-polling.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ThemeService } from '../../../services/theme.service';
import { TorrentListGridSettingsService } from '../../../services/torrent-list-grid.settings.service';
import { UiFormatService } from '../../../services/ui-format.service';
import { GridContextMenuService } from './context-menu/grid-context-menu.service';
import { Grid } from './grid';
import { GridInlineEditService } from './grid-inline-edit.service';
import { GridKeyboardNavService } from './grid-keyboard-nav.service';
import { GridPinService } from './grid-pin.service';

describe('Grid', () => {
  let component: Grid;
  let fixture: ComponentFixture<Grid>;
  let commandsSubject: Subject<any>;

  let keyboardNavServiceMock: {
    onKeyUp: ReturnType<typeof vi.fn>;
    onKeyDown: ReturnType<typeof vi.fn>;
    anchorIndex: number | null;
    leadIndex: number | null;
    init: ReturnType<typeof vi.fn>;
  };
  let themeServiceMock: { effectiveMode: ReturnType<typeof signal<'dark' | 'light'>> };
  let dateFormatServiceMock: {
    resolved: ReturnType<typeof signal<{ pattern: string; locale: string }>>;
  };
  let gridStateServiceMock: { restore: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let gridPinServiceMock: {
    init: ReturnType<typeof vi.fn>;
    applyPinnedState: ReturnType<typeof vi.fn>;
    getPinnedTopHashes: ReturnType<typeof vi.fn>;
    getPinnedBottomHashes: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    commandsSubject = new Subject<any>();

    keyboardNavServiceMock = {
      onKeyUp: vi.fn(),
      onKeyDown: vi.fn(),
      anchorIndex: null,
      leadIndex: null,
      init: vi.fn(),
    };

    themeServiceMock = { effectiveMode: signal<'dark' | 'light'>('dark') };

    dateFormatServiceMock = { resolved: signal({ pattern: 'yyyy-MM-dd HH:mm', locale: 'en-US' }) };

    gridStateServiceMock = {
      restore: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };

    gridPinServiceMock = {
      init: vi.fn(),
      applyPinnedState: vi.fn(),
      getPinnedTopHashes: vi.fn().mockReturnValue([]),
      getPinnedBottomHashes: vi.fn().mockReturnValue([]),
    };

    await TestBed.configureTestingModule({
      imports: [Grid],
      providers: [
        {
          provide: SelectionStoreService,
          useValue: { selected: signal([]), set: vi.fn(), setByHashes: vi.fn() },
        },
        {
          provide: FilterService,
          useValue: {
            external: signal(GRID_FILTER_INITIAL.external),
            columns: signal(GRID_FILTER_INITIAL.columns),
            setColumnModel: vi.fn(),
          },
        },
        { provide: ContextMenuService, useValue: { open: vi.fn() } },
        { provide: ThemeService, useValue: themeServiceMock },
        { provide: DateFormatService, useValue: dateFormatServiceMock },
        {
          provide: UiFormatService,
          useValue: {
            fileSize: vi.fn(),
            fileSizePerSecond: vi.fn(),
            ratio: vi.fn(),
            duration: vi.fn(),
            durationSeconds: vi.fn(),
            localTimestamp: vi.fn(),
            ratioLimit: vi.fn(),
            timeLimit: vi.fn(),
          },
        },
        { provide: GridViewStoreService, useValue: { filteredCount: signal(0) } },
        {
          provide: CommandBusService,
          useValue: { emit: vi.fn(), commands$: commandsSubject.asObservable() },
        },
        {
          provide: TorrentListGridSettingsService,
          useValue: { asObservable: vi.fn().mockReturnValue(new Subject().asObservable()) },
        },
        { provide: ElectronService, useValue: { openPath: vi.fn() } },
        {
          provide: QbPollingService,
          useValue: { pause: vi.fn().mockReturnValue(Symbol()), resume: vi.fn() },
        },
        {
          provide: TranslateService,
          useValue: {
            instant: vi.fn().mockReturnValue(''),
            currentLang: 'en',
            onLangChange: new Subject(),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(Grid, {
        set: {
          providers: [
            { provide: GridStateService, useValue: gridStateServiceMock },
            {
              provide: GridContextMenuService,
              useValue: {
                buildTorrentMenu: vi.fn().mockResolvedValue([]),
                buildHeaderMenu: vi.fn().mockReturnValue([]),
              },
            },
            { provide: GridKeyboardNavService, useValue: keyboardNavServiceMock },
            { provide: GridPinService, useValue: gridPinServiceMock },
            {
              provide: GridInlineEditService,
              useValue: { applyEditableState: vi.fn(), handleCellValueChanged: vi.fn() },
            },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(Grid);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('currentTheme should return dark theme when effectiveMode is dark', () => {
    themeServiceMock.effectiveMode.set('dark');
    expect(component.currentTheme()).toBe(GRID_DARK_THEME);
  });

  it('currentTheme should return light theme when effectiveMode is light', () => {
    themeServiceMock.effectiveMode.set('light');
    expect(component.currentTheme()).toBe(GRID_LIGHT_THEME);
  });

  it('theme should be the signal from ThemeService.effectiveMode', () => {
    expect(component.theme).toBe(themeServiceMock.effectiveMode);
  });

  it('gridOptions should be defined', () => {
    expect(component.gridOptions).toBeDefined();
  });

  describe('onKeyUp', () => {
    it('should delegate to keyboardNavService.onKeyUp', () => {
      const event = new KeyboardEvent('keyup', { code: 'Delete' });
      component.onKeyUp(event);
      expect(keyboardNavServiceMock.onKeyUp).toHaveBeenCalledWith(event);
    });

    it('should pass the event unchanged', () => {
      const event = new KeyboardEvent('keyup', { code: 'ArrowUp', shiftKey: true });
      component.onKeyUp(event);
      expect(keyboardNavServiceMock.onKeyUp).toHaveBeenCalledWith(event);
    });
  });

  describe('onKeyDown', () => {
    it('should delegate to keyboardNavService.onKeyDown', () => {
      const event = new KeyboardEvent('keydown', { code: 'ArrowDown' });
      component.onKeyDown(event);
      expect(keyboardNavServiceMock.onKeyDown).toHaveBeenCalledWith(event);
    });

    it('should pass the event unchanged', () => {
      const event = new KeyboardEvent('keydown', { code: 'KeyA', ctrlKey: true });
      component.onKeyDown(event);
      expect(keyboardNavServiceMock.onKeyDown).toHaveBeenCalledWith(event);
    });
  });

  describe('deselectRows', () => {
    it('should not throw when api is not yet initialized', () => {
      expect(() => component.deselectRows()).not.toThrow();
    });
  });

  describe('onCellEditingStarted / onCellEditingStopped', () => {
    it('should call qbPollingService.pause() when onCellEditingStarted fires', () => {
      const qbPollingService = TestBed.inject(QbPollingService);
      (component.gridOptions.onCellEditingStarted as () => void)();
      expect(qbPollingService.pause).toHaveBeenCalled();
    });

    it('should call qbPollingService.resume() with the token from pause() when onCellEditingStopped fires', () => {
      const qbPollingService = TestBed.inject(QbPollingService);
      const token = Symbol('test-token');
      (qbPollingService.pause as ReturnType<typeof vi.fn>).mockReturnValue(token);

      (component.gridOptions.onCellEditingStarted as () => void)();
      (component.gridOptions.onCellEditingStopped as () => void)();

      expect(qbPollingService.resume).toHaveBeenCalledWith(token);
    });
  });

  describe('applyGridSettings', () => {
    let mockApi: {
      applyColumnState: ReturnType<typeof vi.fn>;
      setGridOption: ReturnType<typeof vi.fn>;
      getColumnDefs: ReturnType<typeof vi.fn>;
      updateGridOptions: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockApi = {
        applyColumnState: vi.fn(),
        setGridOption: vi.fn(),
        getColumnDefs: vi.fn().mockReturnValue([]),
        updateGridOptions: vi.fn(),
      };
      (component as any).api = mockApi;
    });

    it('should call gridInlineEditService.applyEditableState(api, true) when rowDoubleClickAction is INLINE_EDIT', () => {
      const gridInlineEditService = fixture.debugElement.injector.get(GridInlineEditService);
      (component as any).applyGridSettings({ rowDoubleClickAction: 'INLINE_EDIT' });
      expect(gridInlineEditService.applyEditableState).toHaveBeenCalledWith(mockApi, true);
    });

    it('should call gridInlineEditService.applyEditableState(api, false) when rowDoubleClickAction is DETAILS', () => {
      const gridInlineEditService = fixture.debugElement.injector.get(GridInlineEditService);
      (component as any).applyGridSettings({ rowDoubleClickAction: 'DETAILS' });
      expect(gridInlineEditService.applyEditableState).toHaveBeenCalledWith(mockApi, false);
    });

    it('should call gridInlineEditService.applyEditableState(api, false) when rowDoubleClickAction is SAVE_PATH', () => {
      const gridInlineEditService = fixture.debugElement.injector.get(GridInlineEditService);
      (component as any).applyGridSettings({ rowDoubleClickAction: 'SAVE_PATH' });
      expect(gridInlineEditService.applyEditableState).toHaveBeenCalledWith(mockApi, false);
    });
  });

  describe('handleRowDoubleClick', () => {
    it('emits UI_OPEN_DESTINATION with content_path and hash when rowDoubleClickAction is SAVE_PATH', async () => {
      const settingsService = TestBed.inject(TorrentListGridSettingsService);
      (settingsService.asObservable as ReturnType<typeof vi.fn>).mockReturnValue(
        of({ rowDoubleClickAction: 'SAVE_PATH' }),
      );
      const commandBusService = TestBed.inject(CommandBusService);

      await (component as any).handleRowDoubleClick({
        data: { hash: 'abc123', content_path: '/remote/content/path', save_path: '/remote/save' },
      });

      expect(commandBusService.emit).toHaveBeenCalledWith({
        type: 'UI_OPEN_DESTINATION',
        remotePath: '/remote/content/path',
        hash: 'abc123',
      });
    });

    it('does not emit anything when content_path is missing', async () => {
      const settingsService = TestBed.inject(TorrentListGridSettingsService);
      (settingsService.asObservable as ReturnType<typeof vi.fn>).mockReturnValue(
        of({ rowDoubleClickAction: 'SAVE_PATH' }),
      );
      const commandBusService = TestBed.inject(CommandBusService);

      await (component as any).handleRowDoubleClick({
        data: { hash: 'abc123', content_path: '', save_path: '/remote/save' },
      });

      expect(commandBusService.emit).not.toHaveBeenCalled();
    });
  });

  describe('UI_SCROLL_TO_TORRENT command', () => {
    it('should call ensureIndexVisible with middle alignment when a known hash is emitted', () => {
      const mockApi = {
        getRowNode: vi.fn().mockReturnValue({ rowIndex: 5 }),
        ensureIndexVisible: vi.fn(),
      };
      (component as any).api = mockApi;

      commandsSubject.next({ type: 'UI_SCROLL_TO_TORRENT', hash: 'abc123' });

      expect(mockApi.getRowNode).toHaveBeenCalledWith('abc123');
      expect(mockApi.ensureIndexVisible).toHaveBeenCalledWith(5, 'middle');
    });

    it('should not call ensureIndexVisible when the row node is not found', () => {
      const mockApi = {
        getRowNode: vi.fn().mockReturnValue(null),
        ensureIndexVisible: vi.fn(),
      };
      (component as any).api = mockApi;

      commandsSubject.next({ type: 'UI_SCROLL_TO_TORRENT', hash: 'unknown' });

      expect(mockApi.ensureIndexVisible).not.toHaveBeenCalled();
    });

    it('should not react to unrelated commands', () => {
      const mockApi = {
        getRowNode: vi.fn(),
        ensureIndexVisible: vi.fn(),
      };
      (component as any).api = mockApi;

      commandsSubject.next({ type: 'UI_OPEN_TORRENT_DETAILS', hash: 'abc123' });

      expect(mockApi.getRowNode).not.toHaveBeenCalled();
    });

    it('should call ensureIndexVisible with index 0 when the torrent is the first row', () => {
      const mockApi = {
        getRowNode: vi.fn().mockReturnValue({ rowIndex: 0 }),
        ensureIndexVisible: vi.fn(),
      };
      (component as any).api = mockApi;

      commandsSubject.next({ type: 'UI_SCROLL_TO_TORRENT', hash: 'first' });

      expect(mockApi.ensureIndexVisible).toHaveBeenCalledWith(0, 'middle');
    });

    it('should not call ensureIndexVisible when the grid api is not yet initialised', () => {
      // component.api is null by default (grid not yet ready)
      const mockApi = {
        getRowNode: vi.fn(),
        ensureIndexVisible: vi.fn(),
      };

      commandsSubject.next({ type: 'UI_SCROLL_TO_TORRENT', hash: 'abc123' });

      expect(mockApi.ensureIndexVisible).not.toHaveBeenCalled();
    });
  });

  describe('date format changes', () => {
    it('force-refreshes grid cells when the resolved date format changes', () => {
      // The shared beforeEach above already called fixture.detectChanges(), which runs
      // ngAfterViewInit() once and wires up the subscription under test - reuse that
      // component/fixture rather than creating a second one.
      const refreshCellsSpy = vi.fn();
      (component as any).api = { refreshCells: refreshCellsSpy };

      dateFormatServiceMock.resolved.set({ pattern: 'dd.MM.yyyy HH:mm', locale: 'en-US' });
      fixture.detectChanges();

      expect(refreshCellsSpy).toHaveBeenCalledWith({ force: true });
    });
  });
});
