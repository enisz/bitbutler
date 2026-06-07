import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { ExportService } from '../../../services/export.service';
import { ServerStoreService } from '../../../services/server-store.service';
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
      importState: signal({ phase: 'idle', current: 0, total: 0, name: '', skipped: 0 }),
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
      skipped: 0,
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
});
