import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME } from '../../../app.const';
import { CommandBusService } from '../../../services/command-bus.service';
import { ContextMenuService } from '../../../services/context-menu.service';
import { ElectronService } from '../../../services/electron.service';
import { FilterService, GRID_FILTER_INITIAL } from '../../../services/filter.service';
import { GridStateService } from '../../../services/grid-state.service';
import { GridViewStoreService } from '../../../services/grid-view-store.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ThemeService } from '../../../services/theme.service';
import { TorrentListGridSettingsService } from '../../../services/torrent-list-grid.settings.service';
import { UiFormatService } from '../../../services/ui-format.service';
import { GridContextMenuService } from './context-menu/grid-context-menu.service';
import { Grid } from './grid';
import { GridKeyboardNavService } from './grid-keyboard-nav.service';
import { GridPinService } from './grid-pin.service';

describe('Grid', () => {
  let component: Grid;
  let fixture: ComponentFixture<Grid>;

  let keyboardNavServiceMock: {
    onKeyUp: ReturnType<typeof vi.fn>;
    onKeyDown: ReturnType<typeof vi.fn>;
    anchorIndex: number | null;
    leadIndex: number | null;
    init: ReturnType<typeof vi.fn>;
  };
  let themeServiceMock: { effectiveMode: ReturnType<typeof signal<'dark' | 'light'>> };
  let gridStateServiceMock: { restore: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let gridPinServiceMock: {
    init: ReturnType<typeof vi.fn>;
    applyPinnedState: ReturnType<typeof vi.fn>;
    getPinnedTopHashes: ReturnType<typeof vi.fn>;
    getPinnedBottomHashes: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    keyboardNavServiceMock = {
      onKeyUp: vi.fn(),
      onKeyDown: vi.fn(),
      anchorIndex: null,
      leadIndex: null,
      init: vi.fn(),
    };

    themeServiceMock = { effectiveMode: signal<'dark' | 'light'>('dark') };

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
          useValue: { emit: vi.fn(), commands$: new Subject().asObservable() },
        },
        {
          provide: TorrentListGridSettingsService,
          useValue: { asObservable: vi.fn().mockReturnValue(new Subject().asObservable()) },
        },
        { provide: ElectronService, useValue: { openPath: vi.fn() } },
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
    fixture.detectChanges();
    expect(component.currentTheme()).toBe(GRID_DARK_THEME);
  });

  it('currentTheme should return light theme when effectiveMode is light', () => {
    themeServiceMock.effectiveMode.set('light');
    fixture.detectChanges();
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
});
