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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportTorrents, TranslateModule.forRoot()],
      providers: [
        { provide: NgbActiveModal, useValue: { dismiss: vi.fn() } },
        {
          provide: ExportService,
          useValue: {
            importPhase: signal('idle'),
            importState: signal({ phase: 'idle', current: 0, total: 0, name: '', skipped: 0 }),
            setImportLoading: vi.fn(),
            setImportReady: vi.fn(),
            setImportError: vi.fn(),
            startImport: vi.fn(),
            resetImport: vi.fn(),
          },
        },
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
});
