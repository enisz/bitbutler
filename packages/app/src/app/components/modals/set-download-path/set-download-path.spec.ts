import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { SetDownloadPath } from './set-download-path';

describe('SetDownloadPath', () => {
  let component: SetDownloadPath;
  let fixture: ComponentFixture<SetDownloadPath>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockQbService: {
    torrents: { setDownloadPath: ReturnType<typeof vi.fn> };
    app: { preferences: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockQbService = {
      torrents: { setDownloadPath: vi.fn().mockResolvedValue(undefined) },
      app: { preferences: vi.fn().mockResolvedValue({}) },
    };

    await TestBed.configureTestingModule({
      imports: [SetDownloadPath],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
        { provide: ToastService, useValue: { danger: vi.fn() } },
        { provide: TorrentStoreService, useValue: { torrentsArray: signal([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetDownloadPath);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('torrent', { download_path: '/tmp/downloads' } as Torrent);
    fixture.componentRef.setInput('hashes', ['hash-1']);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('pre-fills the path field with torrent download_path', () => {
    expect(component.form.get('path')?.value).toBe('/tmp/downloads');
  });

  it('canSave always returns true', () => {
    expect(component.canSave()).toBe(true);
  });

  describe('handleSubmit', () => {
    it('calls setDownloadPath with server id, hashes, and form path', async () => {
      component.form.get('path')?.setValue('/new/download/path');
      await component.handleSubmit();
      expect(mockQbService.torrents.setDownloadPath).toHaveBeenCalledWith(
        'server-1',
        ['hash-1'],
        '/new/download/path',
      );
      expect(mockActiveModal.close).toHaveBeenCalled();
    });

    it('falls back to torrent.download_path when form path is null', async () => {
      component.form.get('path')?.setValue(null);
      await component.handleSubmit();
      expect(mockQbService.torrents.setDownloadPath).toHaveBeenCalledWith(
        'server-1',
        ['hash-1'],
        '/tmp/downloads',
      );
    });
  });
});
