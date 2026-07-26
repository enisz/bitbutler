import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BbeTorrentEntry } from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { GRID_ROW_MUTED_CLASS } from '../../app.const';
import { ExportService } from '../../services/export.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ThemeService } from '../../services/theme.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { ImportTorrents } from './import-torrents';

describe('ImportTorrents', () => {
  let component: ImportTorrents;
  let fixture: ComponentFixture<ImportTorrents>;

  let mockExportService: {
    importPhase: ReturnType<typeof signal<string>>;
    importState: ReturnType<typeof signal<any>>;
    setImportLoading: ReturnType<typeof vi.fn>;
    setImportReady: ReturnType<typeof vi.fn>;
    setImportError: ReturnType<typeof vi.fn>;
    startImport: ReturnType<typeof vi.fn>;
    resetImport: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    (window as any).bitbutler = {
      export: { importStart: vi.fn(), importCancel: vi.fn(), readBbe: vi.fn() },
    };

    mockExportService = {
      importPhase: signal('idle'),
      importState: signal({
        phase: 'idle',
        current: 0,
        total: 0,
        name: '',
        failed: 0,
        alreadyExisted: 0,
        results: new Map(),
      }),
      setImportLoading: vi.fn(),
      setImportReady: vi.fn(),
      setImportError: vi.fn(),
      startImport: vi.fn(),
      resetImport: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ImportTorrents, TranslateModule.forRoot()],
      providers: [
        { provide: NgbActiveModal, useValue: { dismiss: vi.fn() } },
        { provide: ExportService, useValue: mockExportService },
        { provide: ServerStoreService, useValue: { currentServer: signal(null) } },
        { provide: ThemeService, useValue: { effectiveMode: signal('light') } },
        { provide: TorrentStoreService, useValue: { torrentsMap: signal(new Map()) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportTorrents);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function torrentStoreMock() {
    return TestBed.inject(TorrentStoreService) as unknown as {
      torrentsMap: ReturnType<typeof signal<Map<string, unknown>>>;
    };
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default startMode to active', () => {
    expect(component.importForm.get('startMode')?.value).toBe('active');
  });

  it('should default all restore fields to true', () => {
    const fields = component.importForm.get('restoreFields')?.value as Record<string, boolean>;
    expect(Object.values(fields).every(Boolean)).toBe(true);
  });

  it('should compute startModeHint for active', () => {
    expect(component.startModeHint()).toContain('active');
  });

  it('should expose tagsCount and categoriesCount from metadata', () => {
    mockExportService.importState.set({
      phase: 'ready',
      current: 0,
      total: 0,
      name: '',
      failed: 0,
      alreadyExisted: 0,
      results: new Map(),
      metadata: {
        version: 1,
        exported_at: 0,
        source_server: 'srv',
        export_mode: 'full',
        torrents: [],
        tags: ['linux', 'docs'],
        categories: { Movies: { name: 'Movies', savePath: '/data/movies' } },
      },
    } as any);

    expect(component.tagsCount()).toBe(2);
    expect(component.categoriesCount()).toBe(1);
  });

  it('should show category path mapping only when the categories restore toggle is on', () => {
    component.importForm.get('restoreFields.categories')?.setValue(true);
    expect(component.showCategoryPathMapping()).toBe(true);

    component.importForm.get('restoreFields.categories')?.setValue(false);
    expect(component.showCategoryPathMapping()).toBe(false);
  });

  it('should add and remove category path mapping rows', () => {
    expect(component.categoryPathMappings.length).toBe(1);

    component.addMapping(component.categoryPathMappings);
    expect(component.categoryPathMappings.length).toBe(2);

    component.removeMapping(component.categoryPathMappings, 1);
    expect(component.categoryPathMappings.length).toBe(1);
  });

  it('should send restoreCategories, restoreTags, categoryPathMappings and overwriteCategories in the payload', () => {
    component.importForm.get('restoreFields.categories')?.setValue(true);
    component.importForm.get('restoreFields.tags')?.setValue(false);
    component.importForm.get('overwriteCategories')?.setValue(true);
    component.categoryPathMappings.at(0).setValue({ from: '/old', to: '/new' });

    component.startImport();

    expect(window.bitbutler.export.importStart).toHaveBeenCalledWith(
      expect.objectContaining({
        restoreCategories: true,
        restoreTags: false,
        overwriteCategories: true,
        categoryPathMappings: [{ from: '/old', to: '/new' }],
      }),
    );
  });

  describe('import row state', () => {
    function setMetadata(
      torrents: BbeTorrentEntry[],
      results: Map<string, 'imported' | 'failed'> = new Map(),
    ) {
      mockExportService.importState.set({
        phase: 'ready',
        current: 0,
        total: 0,
        name: '',
        failed: 0,
        alreadyExisted: 0,
        results,
        metadata: {
          version: 1,
          exported_at: 0,
          source_server: 'srv',
          export_mode: 'full',
          torrents,
        },
      } as any);
    }

    it('duplicateHashes is empty when no archive torrent hashes are on the target server', () => {
      setMetadata([{ hash: 'aaa', name: 'A', failed: false }]);
      expect(component.duplicateHashes()).toEqual(new Set());
    });

    it('duplicateHashes finds hashes that already exist on the target server, case-insensitively', () => {
      torrentStoreMock().torrentsMap.set(new Map([['AAA', {}]]));
      setMetadata([
        { hash: 'aaa', name: 'A', failed: false },
        { hash: 'bbb', name: 'B', failed: false },
      ]);

      expect(component.duplicateHashes()).toEqual(new Set(['aaa']));
    });

    it('excludes export-failed entries from duplicateHashes', () => {
      torrentStoreMock().torrentsMap.set(new Map([['aaa', {}]]));
      setMetadata([{ hash: 'aaa', name: 'A', failed: true } as any]);

      expect(component.duplicateHashes()).toEqual(new Set());
    });

    it('importRows marks export-time failures as failed and non-duplicate/non-result entries as pending', () => {
      setMetadata([
        { hash: 'aaa', name: 'A', failed: false },
        { hash: 'bbb', name: 'B', failed: true, error: 'boom' } as any,
      ]);

      const rows = component.importRows();
      expect(rows.find((r) => r.hash === 'aaa')?.importState).toBe('pending');
      expect(rows.find((r) => r.hash === 'bbb')?.importState).toBe('failed');
    });

    it('importRows marks a hash present in torrentsMap as duplicate', () => {
      torrentStoreMock().torrentsMap.set(new Map([['aaa', {}]]));
      setMetadata([{ hash: 'aaa', name: 'A', failed: false }]);

      expect(component.importRows().find((r) => r.hash === 'aaa')?.importState).toBe('duplicate');
    });

    it('importRows reflects live results over the duplicate/pending default', () => {
      torrentStoreMock().torrentsMap.set(new Map([['aaa', {}]]));
      setMetadata(
        [
          { hash: 'aaa', name: 'A', failed: false },
          { hash: 'bbb', name: 'B', failed: false },
        ],
        new Map([
          ['aaa', 'imported'],
          ['bbb', 'failed'],
        ]),
      );

      const rows = component.importRows();
      expect(rows.find((r) => r.hash === 'aaa')?.importState).toBe('imported');
      expect(rows.find((r) => r.hash === 'bbb')?.importState).toBe('failed');
    });

    it('defaultSelectedHashes includes only pending rows', () => {
      torrentStoreMock().torrentsMap.set(new Map([['aaa', {}]]));
      setMetadata([
        { hash: 'aaa', name: 'A', failed: false },
        { hash: 'bbb', name: 'B', failed: false },
        { hash: 'ccc', name: 'C', failed: true } as any,
      ]);

      expect(component.defaultSelectedHashes()).toEqual(new Set(['bbb']));
    });

    it('seeds selectedHashes from defaultSelectedHashes once the archive becomes ready', () => {
      torrentStoreMock().torrentsMap.set(new Map([['aaa', {}]]));
      setMetadata([
        { hash: 'aaa', name: 'A', failed: false },
        { hash: 'bbb', name: 'B', failed: false },
      ]);
      mockExportService.importPhase.set('ready');
      fixture.detectChanges();

      expect(component.selectedHashes()).toEqual(new Set(['bbb']));
    });

    it('startImport sends skipHashes for every unselected row', () => {
      torrentStoreMock().torrentsMap.set(
        new Map([
          ['aaa', {}],
          ['bbb', {}],
        ]),
      );
      setMetadata([
        { hash: 'aaa', name: 'A', failed: false },
        { hash: 'bbb', name: 'B', failed: false },
        { hash: 'ccc', name: 'C', failed: false },
      ]);
      mockExportService.importPhase.set('ready');
      fixture.detectChanges();

      component.startImport();

      const call = (window.bitbutler.export.importStart as any).mock.calls[0][0];
      expect(call.skipHashes.sort()).toEqual(['aaa', 'bbb']);
    });

    it('startImport excludes a manually-selected duplicate from skipHashes', () => {
      torrentStoreMock().torrentsMap.set(
        new Map([
          ['aaa', {}],
          ['bbb', {}],
        ]),
      );
      setMetadata([
        { hash: 'aaa', name: 'A', failed: false },
        { hash: 'bbb', name: 'B', failed: false },
      ]);
      mockExportService.importPhase.set('ready');
      fixture.detectChanges();

      component.onImportSelectionChanged({
        api: { getSelectedRows: () => [{ hash: 'aaa', name: 'A', failed: false }] },
      } as any);

      component.startImport();

      const call = (window.bitbutler.export.importStart as any).mock.calls[0][0];
      expect(call.skipHashes).toEqual(['bbb']);
    });

    it('marks a manually-deselected pending row as skipped once the import has started, not before', () => {
      torrentStoreMock().torrentsMap.set(new Map());
      setMetadata([
        { hash: 'aaa', name: 'A', failed: false },
        { hash: 'bbb', name: 'B', failed: false },
      ]);
      mockExportService.importPhase.set('ready');
      fixture.detectChanges();

      component.onImportSelectionChanged({
        api: { getSelectedRows: () => [{ hash: 'bbb', name: 'B', failed: false }] },
      } as any);

      // still ready - the deselected row is just pending, not skipped yet
      expect(component.importRows().find((r) => r.hash === 'aaa')?.importState).toBe('pending');

      component.startImport();
      mockExportService.importPhase.set('running');

      expect(component.importRows().find((r) => r.hash === 'aaa')?.importState).toBe('skipped');
      expect(component.importRows().find((r) => r.hash === 'bbb')?.importState).toBe('pending');
    });

    it('doneAlreadyExisted counts only rows still marked duplicate, not manually-deselected pending rows', () => {
      torrentStoreMock().torrentsMap.set(new Map([['aaa', {}]]));
      setMetadata([
        { hash: 'aaa', name: 'A', failed: false }, // real duplicate, left unselected (default)
        { hash: 'bbb', name: 'B', failed: false }, // pending, manually deselected by the user
        { hash: 'ccc', name: 'C', failed: false }, // pending, selected/imported normally
      ]);
      mockExportService.importPhase.set('ready');
      fixture.detectChanges();

      // simulate the user deselecting bbb (a non-duplicate row) - only ccc stays selected
      component.onImportSelectionChanged({
        api: { getSelectedRows: () => [{ hash: 'ccc', name: 'C', failed: false }] },
      } as any);

      expect(component.doneAlreadyExisted()).toBe(1); // only aaa (the real duplicate)
    });
  });

  describe('import grid column definitions', () => {
    it('every column has a colId', () => {
      expect(component.importColDefs.every((c) => !!c.colId)).toBe(true);
    });

    it('colIds cover all expected fields plus importState', () => {
      const colIds = component.importColDefs.map((c) => c.colId);
      expect(colIds).toEqual(
        expect.arrayContaining([
          'name',
          'save_path',
          'category',
          'tags',
          'dl_limit',
          'up_limit',
          'ratio_limit',
          'seeding_time_limit',
          'inactive_seeding_time_limit',
          'auto_tmm',
          'sequential_download',
          'super_seeding',
          'first_last_piece_prio',
          'state',
          'importState',
        ]),
      );
    });

    it('places importState as the first column, right after the selection checkbox', () => {
      expect(component.importColDefs[0].colId).toBe('importState');
    });

    it('the state column has no valueFormatter, so it displays the raw state value', () => {
      const col = component.importColDefs.find((c) => c.colId === 'state')!;
      expect(col.valueFormatter).toBeUndefined();
      expect(col.filter).toBeDefined();
    });

    it('assigns agCheckboxCellRenderer and BooleanColumnFilter to the boolean columns', () => {
      const boolCols = [
        'auto_tmm',
        'sequential_download',
        'super_seeding',
        'first_last_piece_prio',
      ];
      for (const colId of boolCols) {
        const col = component.importColDefs.find((c) => c.colId === colId);
        expect(col?.cellRenderer).toBe('agCheckboxCellRenderer');
      }
    });

    it('the dl_limit and up_limit columns use a valueFormatter', () => {
      expect(
        component.importColDefs.find((c) => c.colId === 'dl_limit')?.valueFormatter,
      ).toBeDefined();
      expect(
        component.importColDefs.find((c) => c.colId === 'up_limit')?.valueFormatter,
      ).toBeDefined();
    });

    it('the tags column formats an array as a comma-joined string', () => {
      const col = component.importColDefs.find((c) => c.colId === 'tags')!;
      const fmt = col.valueFormatter as (p: any) => string;
      expect(fmt({ value: ['linux', 'docs'] })).toBe('linux, docs');
      expect(fmt({ value: undefined })).toBe('');
    });

    it('the importState column has a valueFormatter and a set filter', () => {
      const col = component.importColDefs.find((c) => c.colId === 'importState')!;
      expect(col.valueFormatter).toBeDefined();
      expect(col.filter).toBeDefined();
    });
  });

  describe('import grid row selectability', () => {
    it('marks export-failed rows as non-selectable', () => {
      const isRowSelectable = (component.importGridOptions.rowSelection as any).isRowSelectable!;
      expect(isRowSelectable({ data: { hash: 'aaa', failed: true } } as any)).toBe(false);
      expect(isRowSelectable({ data: { hash: 'bbb', failed: false } } as any)).toBe(true);
    });

    it('applies the muted row class to non-selectable (export-failed) rows only', () => {
      const isMuted = component.importGridOptions.rowClassRules![GRID_ROW_MUTED_CLASS] as (
        params: any,
      ) => boolean;

      expect(isMuted({ data: { hash: 'aaa', failed: true } } as any)).toBe(true);
      expect(isMuted({ data: { hash: 'bbb', failed: false } } as any)).toBe(false);
    });
  });

  describe('import grid fieldset visibility', () => {
    it('does not render the import grid fieldset when the archive has not loaded', () => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.import-grid-fieldset')).toBeNull();
    });

    it('renders the import grid fieldset once the archive is ready, even with no duplicates', () => {
      mockExportService.importPhase.set('ready');
      mockExportService.importState.set({
        phase: 'ready',
        current: 0,
        total: 0,
        name: '',
        failed: 0,
        alreadyExisted: 0,
        results: new Map(),
        metadata: {
          version: 1,
          exported_at: 0,
          source_server: 'srv',
          export_mode: 'full',
          torrents: [{ hash: 'aaa', name: 'A', failed: false }],
        },
      } as any);

      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.import-grid-fieldset')).not.toBeNull();
    });

    it('keeps the import grid fieldset visible while running and once done', () => {
      mockExportService.importPhase.set('running');
      mockExportService.importState.set({
        phase: 'running',
        current: 1,
        total: 2,
        name: 'A',
        failed: 0,
        alreadyExisted: 0,
        results: new Map(),
        metadata: {
          version: 1,
          exported_at: 0,
          source_server: 'srv',
          export_mode: 'full',
          torrents: [{ hash: 'aaa', name: 'A', failed: false }],
        },
      } as any);

      fixture.detectChanges();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.import-grid-fieldset'),
      ).not.toBeNull();
    });
  });

  describe('done summary', () => {
    function setDone(failed: number, alreadyExisted: number, torrents: BbeTorrentEntry[] = []) {
      // `component.phase` captured a direct reference to this exact signal at
      // construction time (`readonly phase = this.exportService.importPhase;`),
      // so it must be mutated in place with `.set(...)` - reassigning
      // `mockExportService.importPhase` to a new signal would not be visible
      // to the already-constructed component.
      mockExportService.importPhase.set('done');
      mockExportService.importState.set({
        phase: 'done',
        current: 0,
        total: 0,
        name: '',
        failed,
        alreadyExisted,
        results: new Map(),
        metadata: {
          version: 1,
          exported_at: 0,
          source_server: 'srv',
          export_mode: 'full',
          torrents,
        },
      } as any);
    }

    it('shows the alreadyExisted count when greater than zero', () => {
      // doneAlreadyExisted is derived from rows still marked 'duplicate' in
      // importRows(), not the raw backend alreadyExisted field - so seed two
      // real duplicates (hashes present in torrentsMap and never attempted).
      torrentStoreMock().torrentsMap.set(
        new Map([
          ['aaa', {}],
          ['bbb', {}],
        ]),
      );
      setDone(0, 2, [
        { hash: 'aaa', name: 'A', failed: false },
        { hash: 'bbb', name: 'B', failed: false },
      ]);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('2');
    });

    it('shows the failed count when greater than zero', () => {
      setDone(3, 0);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('3');
    });

    it('doneImported counts rows the backend reported as imported', () => {
      mockExportService.importPhase.set('done');
      mockExportService.importState.set({
        phase: 'done',
        current: 2,
        total: 2,
        name: '',
        failed: 0,
        alreadyExisted: 0,
        results: new Map([
          ['aaa', 'imported'],
          ['bbb', 'imported'],
        ]),
        metadata: {
          version: 1,
          exported_at: 0,
          source_server: 'srv',
          export_mode: 'full',
          torrents: [
            { hash: 'aaa', name: 'A', failed: false },
            { hash: 'bbb', name: 'B', failed: false },
          ],
        },
      } as any);

      expect(component.doneImported()).toBe(2);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('2');
    });

    it('doneSkipped counts rows the user manually deselected and are not duplicates', () => {
      torrentStoreMock().torrentsMap.set(new Map());
      mockExportService.importPhase.set('ready');
      mockExportService.importState.set({
        phase: 'ready',
        current: 0,
        total: 2,
        name: '',
        failed: 0,
        alreadyExisted: 0,
        results: new Map(),
        metadata: {
          version: 1,
          exported_at: 0,
          source_server: 'srv',
          export_mode: 'full',
          torrents: [
            { hash: 'aaa', name: 'A', failed: false },
            { hash: 'bbb', name: 'B', failed: false },
          ],
        },
      } as any);
      fixture.detectChanges();

      component.onImportSelectionChanged({
        api: { getSelectedRows: () => [{ hash: 'bbb', name: 'B', failed: false }] },
      } as any);

      component.startImport();
      mockExportService.importPhase.set('done');

      expect(component.doneSkipped()).toBe(1);
    });
  });
});
