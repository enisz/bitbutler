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
    getSelectedRows: ReturnType<typeof vi.fn>;
    forEachNodeAfterFilterAndSort: ReturnType<typeof vi.fn>;
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
      getSelectedRows: vi.fn().mockReturnValue([]),
      forEachNodeAfterFilterAndSort: vi.fn(),
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

  it('disables cell focus so only row selection is highlighted', () => {
    expect(component.gridOptions.suppressCellFocus).toBe(true);
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
    it('opens a context menu with a copy-row-as-json action that copies the row data when only one row is selected', () => {
      const row = makeLog({ id: 42 });
      const nodeMock = { setSelected: vi.fn() };
      const apiMock = { getSelectedRows: vi.fn().mockReturnValue([row]) };
      const event = { data: row, node: nodeMock, api: apiMock };
      component.gridOptions.onCellContextMenu!(event as any);

      expect(nodeMock.setSelected).not.toHaveBeenCalled();
      expect(contextMenuServiceMock.open).toHaveBeenCalledWith({
        items: [
          expect.objectContaining({
            id: 'copy.json',
            label: 'pages.main.grid.context-menu.item.copy-row-as-json',
          }),
        ],
      });

      const [{ items }] = contextMenuServiceMock.open.mock.calls[0];
      items[0].action();

      expect(gridContextMenuServiceMock.copyToClipboard).toHaveBeenCalledWith(
        JSON.stringify(row, null, 2),
        '',
      );
    });

    it('collapses the grid selection to the right-clicked row when it is outside the current selection', () => {
      const selectedRow = makeLog({ id: 1 });
      const clickedRow = makeLog({ id: 2 });
      const nodeMock = { setSelected: vi.fn() };
      const apiMock = {
        getSelectedRows: vi
          .fn()
          .mockReturnValueOnce([selectedRow])
          .mockReturnValueOnce([clickedRow]),
      };
      const event = { data: clickedRow, node: nodeMock, api: apiMock };
      component.gridOptions.onCellContextMenu!(event as any);

      expect(nodeMock.setSelected).toHaveBeenCalledWith(true, true);
    });

    it('copies every selected row as a JSON array, with a plural label, when multiple rows are selected', () => {
      const row1 = makeLog({ id: 1 });
      const row2 = makeLog({ id: 2 });
      const nodeMock = { setSelected: vi.fn() };
      const apiMock = { getSelectedRows: vi.fn().mockReturnValue([row1, row2]) };
      const event = { data: row1, node: nodeMock, api: apiMock };
      component.gridOptions.onCellContextMenu!(event as any);

      expect(nodeMock.setSelected).not.toHaveBeenCalled();
      expect(contextMenuServiceMock.open).toHaveBeenCalledWith({
        items: [
          expect.objectContaining({
            id: 'copy.json',
            label: 'pages.main.grid.context-menu.item.copy-rows-as-json',
          }),
        ],
      });

      const [{ items }] = contextMenuServiceMock.open.mock.calls[0];
      items[0].action();

      expect(gridContextMenuServiceMock.copyToClipboard).toHaveBeenCalledWith(
        JSON.stringify([row1, row2], null, 2),
        '',
      );
    });

    it('opens an empty menu when there is no row data', () => {
      component.gridOptions.onCellContextMenu!({ data: undefined } as any);
      expect(contextMenuServiceMock.open).toHaveBeenCalledWith({ items: [] });
    });
  });

  describe('getSelectedRows', () => {
    it('returns an empty array before the grid is ready', () => {
      expect(component.getSelectedRows()).toEqual([]);
    });

    it("returns the selected rows in the grid's current sort order", async () => {
      const row1 = makeLog({ id: 1 });
      const row2 = makeLog({ id: 2 });
      mockApi.getSelectedRows.mockReturnValue([row1, row2]);
      // Sorted (display) order is the reverse of selection order.
      mockApi.forEachNodeAfterFilterAndSort.mockImplementation(
        (cb: (node: { data: unknown }) => void) => {
          [row2, row1].forEach((data) => cb({ data }));
        },
      );
      await component.gridOptions.onGridReady!({ api: mockApi } as any);

      expect(component.getSelectedRows()).toEqual([row2, row1]);
    });

    it('appends selected rows that are currently filtered out, after the sorted/visible ones', async () => {
      const visible = makeLog({ id: 1 });
      const filteredOut = makeLog({ id: 2 });
      mockApi.getSelectedRows.mockReturnValue([filteredOut, visible]);
      mockApi.forEachNodeAfterFilterAndSort.mockImplementation(
        (cb: (node: { data: unknown }) => void) => {
          cb({ data: visible });
        },
      );
      await component.gridOptions.onGridReady!({ api: mockApi } as any);

      expect(component.getSelectedRows()).toEqual([visible, filteredOut]);
    });
  });

  describe('getFilteredRows', () => {
    it('returns an empty array before the grid is ready', () => {
      expect(component.getFilteredRows()).toEqual([]);
    });

    it('collects every row visible after filtering once the grid is ready', async () => {
      const rows = [makeLog({ id: 1 }), makeLog({ id: 2 })];
      mockApi.forEachNodeAfterFilterAndSort.mockImplementation(
        (cb: (node: { data: unknown }) => void) => {
          rows.forEach((data) => cb({ data }));
        },
      );
      await component.gridOptions.onGridReady!({ api: mockApi } as any);

      expect(component.getFilteredRows()).toEqual(rows);
    });
  });

  describe('getAllRows', () => {
    it('returns the logs input before the grid is ready', () => {
      const logs = [makeLog({ id: 1 })];
      fixture.componentRef.setInput('logs', logs);
      fixture.detectChanges();

      expect(component.getAllRows()).toEqual(logs);
    });

    it("returns every row in the grid's current sort order once the grid is ready", async () => {
      const row1 = makeLog({ id: 1 });
      const row2 = makeLog({ id: 2 });
      fixture.componentRef.setInput('logs', [row1, row2]);
      fixture.detectChanges();
      mockApi.forEachNodeAfterFilterAndSort.mockImplementation(
        (cb: (node: { data: unknown }) => void) => {
          [row2, row1].forEach((data) => cb({ data }));
        },
      );
      await component.gridOptions.onGridReady!({ api: mockApi } as any);

      expect(component.getAllRows()).toEqual([row2, row1]);
    });

    it('appends rows currently hidden by a filter, after the sorted/visible ones', async () => {
      const visible = makeLog({ id: 1 });
      const hidden = makeLog({ id: 2 });
      fixture.componentRef.setInput('logs', [hidden, visible]);
      fixture.detectChanges();
      mockApi.forEachNodeAfterFilterAndSort.mockImplementation(
        (cb: (node: { data: unknown }) => void) => {
          cb({ data: visible });
        },
      );
      await component.gridOptions.onGridReady!({ api: mockApi } as any);

      expect(component.getAllRows()).toEqual([visible, hidden]);
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
