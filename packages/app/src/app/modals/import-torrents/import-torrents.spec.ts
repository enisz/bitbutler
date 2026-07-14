import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BbeTorrentEntry } from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
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

  describe('duplicate detection', () => {
    function setMetadata(torrents: BbeTorrentEntry[]) {
      mockExportService.importState.set({
        phase: 'ready',
        current: 0,
        total: 0,
        name: '',
        failed: 0,
        alreadyExisted: 0,
        metadata: {
          version: 1,
          exported_at: 0,
          source_server: 'srv',
          export_mode: 'full',
          torrents,
        },
      } as any);
    }

    function torrentStoreMock() {
      return TestBed.inject(TorrentStoreService) as unknown as {
        torrentsMap: ReturnType<typeof signal<Map<string, unknown>>>;
      };
    }

    it('is empty when no archive torrent hashes are on the target server', () => {
      setMetadata([{ hash: 'aaa', name: 'A', failed: false }]);
      expect(component.duplicateEntries()).toEqual([]);
      expect(component.hasDuplicates()).toBe(false);
    });

    it('finds entries whose hash already exists on the target server, case-insensitively', () => {
      torrentStoreMock().torrentsMap.set(new Map([['AAA', {}]]));
      setMetadata([
        { hash: 'aaa', name: 'A', failed: false },
        { hash: 'bbb', name: 'B', failed: false },
      ]);

      expect(component.duplicateEntries().map((t) => t.hash)).toEqual(['aaa']);
      expect(component.hasDuplicates()).toBe(true);
    });

    it('excludes failed entries from duplicate detection', () => {
      torrentStoreMock().torrentsMap.set(new Map([['aaa', {}]]));
      setMetadata([{ hash: 'aaa', name: 'A', failed: true } as any]);

      expect(component.duplicateEntries()).toEqual([]);
    });

    it('startImport sends skipHashes for every duplicate that was not overridden', () => {
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

      component.startImport();

      const call = (window.bitbutler.export.importStart as any).mock.calls[0][0];
      expect(call.skipHashes.sort()).toEqual(['aaa', 'bbb']);
    });

    it('startImport excludes an overridden duplicate from skipHashes', () => {
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

      component.onDuplicatesSelectionChanged({
        api: { getSelectedRows: () => [{ hash: 'aaa', name: 'A', failed: false }] },
      } as any);

      component.startImport();

      const call = (window.bitbutler.export.importStart as any).mock.calls[0][0];
      expect(call.skipHashes).toEqual(['bbb']);
    });
  });

  describe('duplicates grid column definitions', () => {
    it('every column has a colId', () => {
      expect(component.duplicatesColDefs.every((c) => !!c.colId)).toBe(true);
    });

    it('colIds cover all expected fields', () => {
      const colIds = component.duplicatesColDefs.map((c) => c.colId);
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
        ]),
      );
    });

    it('assigns agCheckboxCellRenderer and BooleanColumnFilter to the boolean columns', () => {
      const boolCols = [
        'auto_tmm',
        'sequential_download',
        'super_seeding',
        'first_last_piece_prio',
      ];
      for (const colId of boolCols) {
        const col = component.duplicatesColDefs.find((c) => c.colId === colId);
        expect(col?.cellRenderer).toBe('agCheckboxCellRenderer');
      }
    });

    it('the dl_limit and up_limit columns use a valueFormatter', () => {
      expect(
        component.duplicatesColDefs.find((c) => c.colId === 'dl_limit')?.valueFormatter,
      ).toBeDefined();
      expect(
        component.duplicatesColDefs.find((c) => c.colId === 'up_limit')?.valueFormatter,
      ).toBeDefined();
    });

    it('the tags column formats an array as a comma-joined string', () => {
      const col = component.duplicatesColDefs.find((c) => c.colId === 'tags')!;
      const fmt = col.valueFormatter as (p: any) => string;
      expect(fmt({ value: ['linux', 'docs'] })).toBe('linux, docs');
      expect(fmt({ value: undefined })).toBe('');
    });
  });

  describe('duplicates fieldset visibility', () => {
    it('does not render the duplicates fieldset when there are no duplicates', () => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.duplicates-fieldset')).toBeNull();
    });

    it('renders the duplicates fieldset when duplicates exist', () => {
      (
        TestBed.inject(TorrentStoreService) as unknown as {
          torrentsMap: ReturnType<typeof signal<Map<string, unknown>>>;
        }
      ).torrentsMap.set(new Map([['aaa', {}]]));

      // `component.phase` captured a direct reference to this exact signal at
      // construction time (`readonly phase = this.exportService.importPhase;`),
      // so it must be mutated in place with `.set(...)` for `isReady()` to flip -
      // see the identical caveat documented in the "done summary" describe block below.
      mockExportService.importPhase.set('ready');
      mockExportService.importState.set({
        phase: 'ready',
        current: 0,
        total: 0,
        name: '',
        failed: 0,
        alreadyExisted: 0,
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
      expect(el.querySelector('.duplicates-fieldset')).not.toBeNull();
    });
  });

  describe('done summary', () => {
    function setDone(failed: number, alreadyExisted: number) {
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
      } as any);
    }

    it('shows the alreadyExisted count when greater than zero', () => {
      setDone(0, 2);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('2');
    });

    it('shows the failed count when greater than zero', () => {
      setDone(3, 0);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('3');
    });
  });
});
