import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { LogEntry } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import { BehaviorSubject } from 'rxjs';
import { GRID_DARK_THEME } from '../../../app.const';
import { LogGridSettings } from '../../../models/log-grid.model';
import { ContextMenuService } from '../../../services/context-menu.service';
import { LogGridSettingsService } from '../../../services/log-grid.settings.service';
import { ThemeService } from '../../../services/theme.service';
import { UiFormatService } from '../../../services/ui-format.service';
import { GridContextMenuService } from '../../main/grid/context-menu/grid-context-menu.service';
import { LogsGrid } from './logs-grid';

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 1,
    timestamp: 1700000000,
    process: 'main',
    level: 'info',
    message: 'hello',
    context: null,
    filename: null,
    line: null,
    ...overrides,
  };
}

describe('LogsGrid', () => {
  let component: LogsGrid;
  let fixture: ComponentFixture<LogsGrid>;
  let settings$: BehaviorSubject<LogGridSettings>;
  let logGridSettingsServiceMock: {
    asObservable: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let contextMenuServiceMock: { open: ReturnType<typeof vi.fn> };
  let gridContextMenuServiceMock: {
    buildHeaderMenu: ReturnType<typeof vi.fn>;
    copyToClipboard: ReturnType<typeof vi.fn>;
  };
  let mockApi: {
    getColumnState: ReturnType<typeof vi.fn>;
    applyColumnState: ReturnType<typeof vi.fn>;
    redrawRows: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    settings$ = new BehaviorSubject<LogGridSettings>({
      columnState: null,
      colorCodingEnabled: false,
      compactRows: false,
    });
    logGridSettingsServiceMock = {
      asObservable: vi.fn().mockReturnValue(settings$.asObservable()),
      save: vi.fn().mockResolvedValue(undefined),
    };
    contextMenuServiceMock = { open: vi.fn() };
    gridContextMenuServiceMock = {
      buildHeaderMenu: vi.fn().mockReturnValue(['item']),
      copyToClipboard: vi.fn(),
    };
    mockApi = {
      getColumnState: vi.fn().mockReturnValue([{ colId: 'message' }]),
      applyColumnState: vi.fn(),
      redrawRows: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LogsGrid],
      providers: [
        { provide: LogGridSettingsService, useValue: logGridSettingsServiceMock },
        { provide: ContextMenuService, useValue: contextMenuServiceMock },
        { provide: GridContextMenuService, useValue: gridContextMenuServiceMock },
        { provide: ThemeService, useValue: { effectiveMode: signal<'dark' | 'light'>('dark') } },
        { provide: UiFormatService, useValue: { localTimestamp: vi.fn() } },
        {
          provide: TranslateService,
          useValue: { instant: vi.fn().mockReturnValue(''), onLangChange: { subscribe: vi.fn() } },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(LogsGrid);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('currentTheme reflects the dark/light theme', () => {
    expect(component.currentTheme()).toBe(GRID_DARK_THEME);
  });

  it('passes the logs input through to the grid as rowData', () => {
    const logs = [makeLog({ id: 1 }), makeLog({ id: 2 })];
    fixture.componentRef.setInput('logs', logs);
    fixture.detectChanges();

    const agGrid = fixture.debugElement.query(By.directive(AgGridAngular))
      .componentInstance as AgGridAngular;
    expect(agGrid.rowData).toEqual(logs);
  });

  describe('onColumnHeaderContextMenu', () => {
    it('opens the context menu built from GridContextMenuService.buildHeaderMenu', () => {
      const event = { api: {}, column: {} };
      component.gridOptions.onColumnHeaderContextMenu!(event as any);

      expect(gridContextMenuServiceMock.buildHeaderMenu).toHaveBeenCalledWith(event);
      expect(contextMenuServiceMock.open).toHaveBeenCalledWith({ items: ['item'] });
    });
  });

  describe('onCellContextMenu', () => {
    it('opens a context menu with a copy-row-as-json action that copies the row data', () => {
      const row = makeLog({ id: 42 });
      const event = { data: row };
      component.gridOptions.onCellContextMenu!(event as any);

      expect(contextMenuServiceMock.open).toHaveBeenCalledWith({
        items: [expect.objectContaining({ id: 'copy.json' })],
      });

      const [{ items }] = contextMenuServiceMock.open.mock.calls[0];
      items[0].action();

      expect(gridContextMenuServiceMock.copyToClipboard).toHaveBeenCalledWith(
        JSON.stringify(row, null, 2),
        '',
      );
    });

    it('opens an empty menu when there is no row data', () => {
      component.gridOptions.onCellContextMenu!({ data: undefined } as any);
      expect(contextMenuServiceMock.open).toHaveBeenCalledWith({ items: [] });
    });
  });

  describe('restoring column state on grid ready', () => {
    it('applies the persisted column state once the grid becomes ready', async () => {
      settings$.next({
        columnState: [{ colId: 'message' }] as any,
        colorCodingEnabled: false,
        compactRows: false,
      });

      await component.gridOptions.onGridReady!({ api: mockApi } as any);

      expect(mockApi.applyColumnState).toHaveBeenCalledWith({
        state: [{ colId: 'message' }],
        applyOrder: true,
      });
    });

    it('does not call applyColumnState when nothing is persisted', async () => {
      await component.gridOptions.onGridReady!({ api: mockApi } as any);
      expect(mockApi.applyColumnState).not.toHaveBeenCalled();
    });
  });

  describe('saving column state on change', () => {
    beforeEach(async () => {
      await component.gridOptions.onGridReady!({ api: mockApi } as any);
      fixture.detectChanges();
    });

    it('saves the current column state (merged with existing settings) after a column is moved', async () => {
      vi.useFakeTimers();
      component.gridOptions.onColumnMoved!({} as any);
      await vi.advanceTimersByTimeAsync(600);
      vi.useRealTimers();

      expect(logGridSettingsServiceMock.save).toHaveBeenCalledWith({
        columnState: [{ colId: 'message' }],
        colorCodingEnabled: false,
        compactRows: false,
      });
    });

    it('only saves a resize once it has finished', async () => {
      vi.useFakeTimers();
      component.gridOptions.onColumnResized!({ finished: false } as any);
      await vi.advanceTimersByTimeAsync(600);
      expect(logGridSettingsServiceMock.save).not.toHaveBeenCalled();

      component.gridOptions.onColumnResized!({ finished: true } as any);
      await vi.advanceTimersByTimeAsync(600);
      vi.useRealTimers();

      expect(logGridSettingsServiceMock.save).toHaveBeenCalled();
    });
  });

  describe('colorCodingEnabled reactivity', () => {
    it('reflects the value from LogGridSettingsService', () => {
      settings$.next({ columnState: null, colorCodingEnabled: true, compactRows: false });
      expect(component.colorCodingEnabled()).toBe(true);
    });

    it('redraws the grid rows when the setting changes', async () => {
      await component.gridOptions.onGridReady!({ api: mockApi } as any);
      settings$.next({ columnState: null, colorCodingEnabled: true, compactRows: false });
      fixture.detectChanges();

      expect(mockApi.redrawRows).toHaveBeenCalled();
    });
  });

  describe('compactRowsEnabled reactivity', () => {
    it('reflects the value from LogGridSettingsService', () => {
      settings$.next({ columnState: null, colorCodingEnabled: false, compactRows: true });
      expect(component.compactRowsEnabled()).toBe(true);
    });

    it('applies compact spacing/rowHeight params to the grid theme when enabled', () => {
      settings$.next({ columnState: null, colorCodingEnabled: false, compactRows: true });
      const params = (component.currentTheme() as any)._getModeParams()['$default'];
      expect(params.spacing).toBe(4);
      expect(params.rowHeight).toBe(32);
    });

    it('returns the base theme when compactRows is disabled', () => {
      settings$.next({ columnState: null, colorCodingEnabled: false, compactRows: false });
      expect(component.currentTheme()).toBe(GRID_DARK_THEME);
    });
  });
});
