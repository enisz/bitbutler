import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import type { TorrentDraft } from '@bitbutler/shared';
import {
  CellValueChangedEvent,
  RowDataUpdatedEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { GRID_ROW_MUTED_CLASS } from '../../../../app.const';
import { DEFAULT_ADD_TORRENT_GRID_SETTINGS } from '../../../../models/add-torrent-grid.model';
import { AddTorrentFormGroup } from '../../../../models/add-torrent.model';
import { GridContextMenuService } from '../../../../pages/main/grid/context-menu/grid-context-menu.service';
import { AddTorrentGridSettingsService } from '../../../../services/add-torrent-grid.settings.service';
import { ContextMenuService } from '../../../../services/context-menu.service';
import { ThemeService } from '../../../../services/theme.service';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import { AddTorrentFolderPicker } from './folder-picker';

function createForm(folder = '', recursive = false): AddTorrentFormGroup {
  return new FormGroup({
    fileGroup: new FormGroup({
      file: new FormControl<string>('', { nonNullable: true }),
      rename: new FormControl<string | null>(null),
    }),
    linkGroup: new FormGroup({
      magnetLinks: new FormControl<string>('', { nonNullable: true }),
      rename: new FormControl<string | null>(null),
    }),
    folderGroup: new FormGroup({
      folder: new FormControl<string>(folder, { nonNullable: true }),
      recursive: new FormControl<boolean>(recursive, { nonNullable: true }),
    }),
    savepath: new FormControl<string | null>(null),
    paused: new FormControl<boolean>(false, { nonNullable: true }),
    category: new FormControl<string | null>(null),
    root_folder: new FormControl<'unset' | 'true' | 'false'>('unset', { nonNullable: true }),
    tags: new FormControl<string[] | null>(null),
    skip_checking: new FormControl<boolean>(false, { nonNullable: true }),
    sequentialDownload: new FormControl<boolean>(false, { nonNullable: true }),
    firstLastPiecePrio: new FormControl<boolean>(false, { nonNullable: true }),
    transferRateLimits: new FormControl(null),
    shareLimits: new FormControl(null),
    autoTMM: new FormControl<boolean>(false, { nonNullable: true }),
  }) as unknown as AddTorrentFormGroup;
}

function draft(overrides: Partial<NonNullable<TorrentDraft['torrent']>> = {}): TorrentDraft {
  return {
    source: 'manual',
    receivedAt: Date.now(),
    torrent: {
      name: 'Movie',
      totalSize: 100,
      files: [{ path: 'movie.mkv', length: 100 }],
      infoHashV1: 'abc123',
      ...overrides,
    },
  };
}

describe('AddTorrentFolderPicker', () => {
  let component: AddTorrentFolderPicker;
  let fixture: ComponentFixture<AddTorrentFolderPicker>;
  let torrentsMap: ReturnType<typeof signal<Map<string, unknown>>>;
  let mockSettingsService: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let mockContextMenuService: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    torrentsMap = signal(new Map());
    mockSettingsService = {
      load: vi.fn().mockResolvedValue({ columnState: [] }),
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockContextMenuService = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AddTorrentFolderPicker],
      providers: [
        { provide: TorrentStoreService, useValue: { torrentsMap } },
        { provide: ThemeService, useValue: { effectiveMode: signal('light') } },
        { provide: AddTorrentGridSettingsService, useValue: mockSettingsService },
        { provide: ContextMenuService, useValue: mockContextMenuService },
        {
          provide: GridContextMenuService,
          useValue: { buildHeaderMenu: vi.fn().mockReturnValue([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrentFolderPicker);
    component = fixture.componentInstance;
  });

  function init(folder = '/downloads', recursive = false) {
    fixture.componentRef.setInput('form', createForm(folder, recursive));
    fixture.detectChanges();
  }

  it('should default the folder control to the Downloads path when empty on init', async () => {
    vi.spyOn(window.bitbutler.electron, 'getDownloadsPath').mockResolvedValue(
      '/home/user/Downloads',
    );
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);

    init('');
    await fixture.whenStable();

    expect(component.form().controls.folderGroup.controls.folder.value).toBe(
      '/home/user/Downloads',
    );
  });

  it('should not overwrite a persisted folder value on init', async () => {
    const scanSpy = vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);
    const downloadsSpy = vi.spyOn(window.bitbutler.electron, 'getDownloadsPath');

    init('/saved/folder');
    await fixture.whenStable();

    expect(downloadsSpy).not.toHaveBeenCalled();
    expect(scanSpy).toHaveBeenCalledWith({ path: '/saved/folder', recursive: false });
  });

  it('should populate rows from scanFolder + parse, marking a known hash as exists', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
      { path: '/downloads/b.torrent', relativePath: 'b.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse')
      .mockResolvedValueOnce(draft({ infoHashV1: 'known-hash' }))
      .mockResolvedValueOnce(draft({ infoHashV1: 'new-hash' }));
    torrentsMap.set(new Map([['known-hash', {}]]));

    init('/downloads');
    await fixture.whenStable();

    expect(component.rows()).toEqual([
      expect.objectContaining({
        path: '/downloads/a.torrent',
        state: 'exists',
        hash: 'known-hash',
      }),
      expect.objectContaining({ path: '/downloads/b.torrent', state: 'new', hash: 'new-hash' }),
    ]);
  });

  it('should mark a parse failure as state error with the error message', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/bad.torrent', relativePath: 'bad.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue({
      source: 'manual',
      receivedAt: Date.now(),
      error: { message: 'Invalid torrent file', code: 'PARSE_FAILED' },
    });

    init('/downloads');
    await fixture.whenStable();

    expect(component.rows()).toEqual([
      expect.objectContaining({
        path: '/downloads/bad.torrent',
        state: 'error',
        errorMessage: 'Invalid torrent file',
        hash: null,
      }),
    ]);
  });

  it('should reuse a cached entry on a second scan without re-parsing the same path', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
    ]);
    const parseSpy = vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

    init('/downloads');
    await fixture.whenStable();
    expect(parseSpy).toHaveBeenCalledTimes(1);

    await component.refresh();
    expect(parseSpy).toHaveBeenCalledTimes(1);
  });

  it('should pre-select only new-state rows after a scan', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
      { path: '/downloads/b.torrent', relativePath: 'b.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse')
      .mockResolvedValueOnce(draft({ infoHashV1: 'known-hash' }))
      .mockResolvedValueOnce(draft({ infoHashV1: 'new-hash' }));
    torrentsMap.set(new Map([['known-hash', {}]]));

    init('/downloads');
    await fixture.whenStable();

    expect(component.selectedPaths()).toEqual(new Set(['/downloads/b.torrent']));
    expect(component.selectedEntries()).toEqual([
      expect.objectContaining({ path: '/downloads/b.torrent' }),
    ]);
  });

  it('should rescan when the recursive control changes after the first scan, not before', async () => {
    const scanSpy = vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);

    init('/downloads');
    await fixture.whenStable();
    expect(scanSpy).toHaveBeenCalledTimes(1);

    component.form().controls.folderGroup.controls.recursive.setValue(true);
    await fixture.whenStable();

    expect(scanSpy).toHaveBeenCalledTimes(2);
    expect(scanSpy).toHaveBeenLastCalledWith({ path: '/downloads', recursive: true });
  });

  it('browse() should open the dialog with the current folder as defaultPath and rescan on selection', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);
    const dialogSpy = vi
      .spyOn(window.bitbutler.electron, 'showOpenDialog')
      .mockResolvedValue('/new/folder');

    init('/downloads');
    await fixture.whenStable();

    await component.browse();

    expect(dialogSpy).toHaveBeenCalledWith('/downloads');
    expect(component.form().controls.folderGroup.controls.folder.value).toBe('/new/folder');
  });

  it('browse() should do nothing when the dialog is dismissed', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);
    vi.spyOn(window.bitbutler.electron, 'showOpenDialog').mockResolvedValue(undefined as any);

    init('/downloads');
    await fixture.whenStable();

    await component.browse();

    expect(component.form().controls.folderGroup.controls.folder.value).toBe('/downloads');
  });

  it('renameEntry should update the row and keep the change on a cached refresh', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

    init('/downloads');
    await fixture.whenStable();

    component.renameEntry('/downloads/a.torrent', 'Custom Name');
    expect(component.rows()[0].name).toBe('Custom Name');

    await component.refresh();
    expect(component.rows()[0].name).toBe('Custom Name');
  });

  it('markAdded moves the entry out of visibleRows but keeps it cached as added', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

    init('/downloads');
    await fixture.whenStable();

    component.markAdded('/downloads/a.torrent');

    expect(component.visibleRows()).toEqual([]);
    expect(component.rows()).toEqual([
      expect.objectContaining({ path: '/downloads/a.torrent', state: 'added' }),
    ]);
  });

  it('markFailed sets state failed with the error message and keeps the row visible', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

    init('/downloads');
    await fixture.whenStable();

    component.markFailed('/downloads/a.torrent', 'HTTP 500');

    expect(component.visibleRows()).toEqual([
      expect.objectContaining({
        path: '/downloads/a.torrent',
        state: 'failed',
        errorMessage: 'HTTP 500',
      }),
    ]);
  });

  it('a second scan reuses the cached added/failed state for an unchanged path', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

    init('/downloads');
    await fixture.whenStable();

    component.markFailed('/downloads/a.torrent', 'HTTP 500');
    await component.refresh();

    expect(component.rows()[0]).toEqual(
      expect.objectContaining({ state: 'failed', errorMessage: 'HTTP 500' }),
    );
  });

  it('should set scanError and clear rows when scanFolder rejects', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockRejectedValue(new Error('ENOENT'));

    init('/missing');
    await fixture.whenStable();

    expect(component.scanError()).toContain('ENOENT');
    expect(component.rows()).toEqual([]);
  });

  it('should render the inline folder description text under the recursive switch', () => {
    init('/downloads');

    const description: HTMLElement = fixture.nativeElement.querySelector('.folder-description');

    expect(description).toBeTruthy();
    expect(description.textContent).toContain('components.add-torrent.folder-picker.description');
  });

  it('renders the state column before the name column', () => {
    init('/downloads');

    expect(component.colDefs[0].colId).toBe('state');
    expect(component.colDefs[1].colId).toBe('name');
  });

  it('does not render fileCount or folderCount columns', () => {
    init('/downloads');

    const colIds = component.colDefs.map((c) => c.colId);
    expect(colIds).not.toContain('fileCount');
    expect(colIds).not.toContain('folderCount');
  });

  it('defines a hidden errorMessage column', () => {
    init('/downloads');

    const errorColumn = component.colDefs.find((c) => c.colId === 'errorMessage');

    expect(errorColumn).toBeTruthy();
    expect(errorColumn!.field).toBe('errorMessage');
    expect(errorColumn!.hide).toBe(true);
  });

  it('state column tooltip only shows the state label, not the error message', () => {
    init('/downloads');

    const stateColumn = component.colDefs.find((c) => c.colId === 'state')!;
    const tooltip = stateColumn.tooltipValueGetter!({
      data: { state: 'error', errorMessage: 'boom' },
    } as any);

    expect(tooltip).toBe('components.add-torrent.folder-picker.state.error');
  });

  describe('selection summary', () => {
    it('selectedTotalSize sums the size of selected entries only', async () => {
      vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
        { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
        { path: '/downloads/b.torrent', relativePath: 'b.torrent' },
      ]);
      vi.spyOn(window.bitbutler.torrent, 'parse')
        .mockResolvedValueOnce(draft({ infoHashV1: 'known-hash', totalSize: 500 }))
        .mockResolvedValueOnce(draft({ infoHashV1: 'new-hash', totalSize: 300 }));
      torrentsMap.set(new Map([['known-hash', {}]]));

      init('/downloads');
      await fixture.whenStable();

      // 'a.torrent' is state 'exists' and unselected by default; only 'b.torrent' (state 'new') counts.
      expect(component.selectedTotalSize()).toBe(300);
    });

    it('shows "no torrents selected" text when nothing is selected', () => {
      init('/downloads');
      fixture.detectChanges();

      const summary: HTMLElement = fixture.nativeElement.querySelector('.folder-selection-summary');
      expect(summary.textContent).toContain('components.add-torrent.folder-picker.selection.none');
    });

    it('shows the count and total size once rows are selected', async () => {
      vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
        { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
      ]);
      vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(
        draft({ infoHashV1: 'new-hash', totalSize: 300 }),
      );

      init('/downloads');
      await fixture.whenStable();
      fixture.detectChanges();

      const summary: HTMLElement = fixture.nativeElement.querySelector('.folder-selection-summary');
      expect(summary.textContent).toContain(
        'components.add-torrent.folder-picker.selection.summary',
      );
    });
  });

  describe('grid wiring', () => {
    function makeApiWithRows(rows: any[]) {
      const selected = new Set<any>();
      return {
        getSelectedRows: () => rows.filter((r) => selected.has(r)),
        forEachNode: (cb: (node: any) => void) => {
          rows.forEach((data) =>
            cb({
              data,
              setSelected: (v: boolean) => (v ? selected.add(data) : selected.delete(data)),
            }),
          );
        },
      };
    }

    it('marks new-state and failed-state rows as selectable via rowSelection.isRowSelectable', () => {
      init('/downloads');
      const isRowSelectable = (component.gridOptions.rowSelection as any).isRowSelectable!;

      expect(isRowSelectable({ data: { state: 'new' } } as any)).toBe(true);
      expect(isRowSelectable({ data: { state: 'failed' } } as any)).toBe(true);
      expect(isRowSelectable({ data: { state: 'exists' } } as any)).toBe(false);
      expect(isRowSelectable({ data: { state: 'error' } } as any)).toBe(false);
      expect(isRowSelectable({ data: { state: 'added' } } as any)).toBe(false);
    });

    it('applies the muted row class to exists-state rows only', () => {
      init('/downloads');
      const isMuted = component.gridOptions.rowClassRules![GRID_ROW_MUTED_CLASS] as (
        params: any,
      ) => boolean;

      expect(isMuted({ data: { state: 'new' } } as any)).toBe(false);
      expect(isMuted({ data: { state: 'exists' } } as any)).toBe(true);
      expect(isMuted({ data: { state: 'error' } } as any)).toBe(false);
      expect(isMuted({ data: { state: 'failed' } } as any)).toBe(false);
    });

    it('applies the danger row class to error-state and failed-state rows', () => {
      init('/downloads');
      const isDanger = component.gridOptions.rowClassRules!['text-danger bg-danger-subtle'] as (
        params: any,
      ) => boolean;

      expect(isDanger({ data: { state: 'new' } } as any)).toBe(false);
      expect(isDanger({ data: { state: 'exists' } } as any)).toBe(false);
      expect(isDanger({ data: { state: 'error' } } as any)).toBe(true);
      expect(isDanger({ data: { state: 'failed' } } as any)).toBe(true);
    });

    it('onSelectionChanged updates selectedPaths from the grid API', () => {
      init('/downloads');
      const rows = [{ path: '/downloads/a.torrent' }, { path: '/downloads/b.torrent' }];
      const api = { getSelectedRows: () => [rows[0]] } as any;

      component.gridOptions.onSelectionChanged!({ api } as SelectionChangedEvent<any>);

      expect(component.selectedPaths()).toEqual(new Set(['/downloads/a.torrent']));
    });

    it('onRowDataUpdated selects new-state and failed-state rows via the grid API', () => {
      init('/downloads');
      const rows = [
        { path: '/downloads/a.torrent', state: 'new' },
        { path: '/downloads/b.torrent', state: 'exists' },
        { path: '/downloads/c.torrent', state: 'failed' },
      ];
      const api = makeApiWithRows(rows);

      component.gridOptions.onRowDataUpdated!({ api } as unknown as RowDataUpdatedEvent<any>);

      expect(api.getSelectedRows()).toEqual([rows[0], rows[2]]);
    });

    it('onCellValueChanged renames the row when the name column changes', () => {
      init('/downloads');
      component.rows.set([
        {
          path: '/downloads/a.torrent',
          relativePath: 'a.torrent',
          name: 'Old Name',
          size: 0,
          fileCount: 1,
          folderCount: 0,
          state: 'new',
          hash: null,
        },
      ]);

      const event = {
        colDef: { colId: 'name' },
        data: component.rows()[0],
        newValue: 'New Name',
      } as unknown as CellValueChangedEvent<any>;

      component.gridOptions.onCellValueChanged!(event);

      expect(component.rows()[0].name).toBe('New Name');
    });

    it('onCellValueChanged ignores changes to columns other than name', () => {
      init('/downloads');
      component.rows.set([
        {
          path: '/downloads/a.torrent',
          relativePath: 'a.torrent',
          name: 'Old Name',
          size: 0,
          fileCount: 1,
          folderCount: 0,
          state: 'new',
          hash: null,
        },
      ]);

      const event = {
        colDef: { colId: 'relativePath' },
        data: component.rows()[0],
        newValue: 'ignored',
      } as unknown as CellValueChangedEvent<any>;

      component.gridOptions.onCellValueChanged!(event);

      expect(component.rows()[0].name).toBe('Old Name');
    });

    it('excludes added-state rows from the state column filter items', async () => {
      vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
        { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
      ]);
      vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

      init('/downloads');
      await fixture.whenStable();

      component.markAdded('/downloads/a.torrent');

      const stateColumn = component.colDefs.find((c) => c.colId === 'state')!;
      const items = (stateColumn.filterParams as any).getItems();

      expect(items).toEqual([]);
    });
  });

  describe('error column visibility', () => {
    it('markFailed reveals the errorMessage column', async () => {
      vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
        { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
      ]);
      vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

      init('/downloads');
      await fixture.whenStable();

      const mockApi = { setColumnsVisible: vi.fn() };
      (component as any).gridApi = mockApi;

      component.markFailed('/downloads/a.torrent', 'HTTP 500');

      expect(mockApi.setColumnsVisible).toHaveBeenCalledWith(['errorMessage'], true);
    });

    it('markAdded hides the errorMessage column again once no row has an error', async () => {
      vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
        { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
      ]);
      vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

      init('/downloads');
      await fixture.whenStable();

      const mockApi = { setColumnsVisible: vi.fn() };
      (component as any).gridApi = mockApi;

      component.markFailed('/downloads/a.torrent', 'HTTP 500');
      component.markAdded('/downloads/a.torrent');

      expect(mockApi.setColumnsVisible).toHaveBeenLastCalledWith(['errorMessage'], false);
    });

    it('a rescan that finds a parse error reveals the errorMessage column', async () => {
      vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
        { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
      ]);
      vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

      init('/downloads');
      await fixture.whenStable();

      const mockApi = { setColumnsVisible: vi.fn() };
      (component as any).gridApi = mockApi;

      vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
        { path: '/downloads/bad.torrent', relativePath: 'bad.torrent' },
      ]);
      vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue({
        source: 'manual',
        receivedAt: Date.now(),
        error: { message: 'Invalid torrent file', code: 'PARSE_FAILED' },
      });

      await component.refresh();

      expect(mockApi.setColumnsVisible).toHaveBeenCalledWith(['errorMessage'], true);
    });

    it('onGridReady syncs visibility from whatever rows already exist', async () => {
      vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);
      init('/downloads');
      await fixture.whenStable();

      component.rows.set([
        {
          path: '/downloads/a.torrent',
          relativePath: 'a.torrent',
          name: 'a',
          size: 0,
          fileCount: 1,
          folderCount: 0,
          state: 'error',
          errorMessage: 'boom',
          hash: null,
        },
      ]);

      const mockApi = {
        setColumnsVisible: vi.fn(),
        applyColumnState: vi.fn(),
        getColumnState: vi.fn().mockReturnValue([]),
      };
      component.onGridReady({ api: mockApi } as any);
      await fixture.whenStable();

      expect(mockApi.setColumnsVisible).toHaveBeenCalledWith(['errorMessage'], true);
    });

    it('does not persist the auto-revealed column as a saved layout change', async () => {
      vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
        { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
      ]);
      vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

      init('/downloads');
      await fixture.whenStable();

      const mockApi = { setColumnsVisible: vi.fn() };
      (component as any).gridApi = mockApi;
      const next = vi.spyOn((component as any).saveState$, 'next');

      component.markFailed('/downloads/a.torrent', 'HTTP 500');

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('column state management', () => {
    it('restoreColumnState loads settings and applies column state', async () => {
      const state = [{ colId: 'name', hide: false, flex: 2 }];
      mockSettingsService.load.mockResolvedValue({ columnState: state });
      const mockApi = { applyColumnState: vi.fn(), getColumnState: vi.fn().mockReturnValue([]) };
      (component as any).gridApi = mockApi;

      await (component as any).restoreColumnState();

      expect(mockSettingsService.load).toHaveBeenCalled();
      expect(mockApi.applyColumnState).toHaveBeenCalledWith({ state, applyOrder: true });
    });

    it('persistColumnState reads column state and saves it', async () => {
      const state = [{ colId: 'name', hide: false, flex: 2 }];
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

    it('restoreColumnState marks the layout as default when settings.columnState is the default reference', async () => {
      const mockApi = { applyColumnState: vi.fn(), getColumnState: vi.fn() };
      mockSettingsService.load.mockResolvedValue(DEFAULT_ADD_TORRENT_GRID_SETTINGS);
      (component as any).gridApi = mockApi;

      await (component as any).restoreColumnState();

      expect((component as any).isDefaultLayout).toBe(true);
    });

    it('restoreColumnState marks the layout as customized when settings.columnState came from storage', async () => {
      mockSettingsService.load.mockResolvedValue({ columnState: [{ colId: 'name', width: 500 }] });
      const mockApi = { applyColumnState: vi.fn(), getColumnState: vi.fn() };
      (component as any).gridApi = mockApi;

      await (component as any).restoreColumnState();

      expect((component as any).isDefaultLayout).toBe(false);
    });
  });

  describe('autosize on first render', () => {
    it('autosizes all columns on first data render when the layout is still default', () => {
      init('/downloads');
      (component as any).isDefaultLayout = true;
      const api = { autoSizeAllColumns: vi.fn() };

      component.gridOptions.onFirstDataRendered!({ api } as any);

      expect(api.autoSizeAllColumns).toHaveBeenCalled();
    });

    it('does not autosize when the layout was customized', () => {
      init('/downloads');
      (component as any).isDefaultLayout = false;
      const api = { autoSizeAllColumns: vi.fn() };

      component.gridOptions.onFirstDataRendered!({ api } as any);

      expect(api.autoSizeAllColumns).not.toHaveBeenCalled();
    });
  });

  describe('header context menu', () => {
    function makeHeaderEvent() {
      const column = {
        getId: vi.fn().mockReturnValue('name'),
        getColDef: vi.fn().mockReturnValue({ colId: 'name', headerName: 'Name', filter: false }),
        getSort: vi.fn().mockReturnValue(null),
        isFilterActive: vi.fn().mockReturnValue(false),
        isPinnedLeft: vi.fn().mockReturnValue(false),
        isPinnedRight: vi.fn().mockReturnValue(false),
        getPinned: vi.fn().mockReturnValue(null),
        isVisible: vi.fn().mockReturnValue(true),
      };
      const api = {
        getDisplayNameForColumn: vi.fn().mockReturnValue('Name'),
        getColumnDefs: vi.fn().mockReturnValue([]),
        getColumns: vi.fn().mockReturnValue([column]),
        getColumn: vi.fn().mockReturnValue(column),
      };
      return { column, api };
    }

    it('opens context menu when column header is right-clicked', () => {
      init('/downloads');
      const { column, api } = makeHeaderEvent();
      component.gridOptions.onColumnHeaderContextMenu?.({ column, api } as any);
      expect(mockContextMenuService.open).toHaveBeenCalled();
    });

    it('does not open context menu when the event has no column', () => {
      init('/downloads');
      component.gridOptions.onColumnHeaderContextMenu?.({ column: null, api: {} } as any);
      expect(mockContextMenuService.open).not.toHaveBeenCalled();
    });
  });
});
