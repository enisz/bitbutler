import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { ExportService } from '../../../services/export.service';
import { FilterService } from '../../../services/filter.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { ExportTorrents } from './export-torrents';

describe('ExportTorrents', () => {
  let component: ExportTorrents;
  let fixture: ComponentFixture<ExportTorrents>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportTorrents, TranslateModule.forRoot()],
      providers: [
        { provide: NgbActiveModal, useValue: { dismiss: vi.fn() } },
        {
          provide: ExportService,
          useValue: {
            exportPhase: signal('idle'),
            exportState: signal({ phase: 'idle', current: 0, total: 0, name: '', skipped: 0 }),
            startExport: vi.fn(),
            resetExport: vi.fn(),
          },
        },
        { provide: FilterService, useValue: { filtered: signal([]) } },
        { provide: SelectionStoreService, useValue: { selected: signal([]) } },
        { provide: TorrentStoreService, useValue: { torrents: signal([]) } },
        { provide: ServerStoreService, useValue: { currentServer: signal(null) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExportTorrents);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default scope to all', () => {
    expect(component.exportForm.get('scope')?.value).toBe('all');
  });

  it('should compute hasSelection as false when selected is empty', () => {
    expect(component.hasSelection()).toBe(false);
  });
});
