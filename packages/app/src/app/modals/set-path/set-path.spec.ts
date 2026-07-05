import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Torrent } from '../../models/torrent.model';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { SetPath } from './set-path';

describe('SetPath', () => {
  let component: SetPath;
  let fixture: ComponentFixture<SetPath>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockQbService: {
    torrents: {
      setLocation: ReturnType<typeof vi.fn>;
      setDownloadPath: ReturnType<typeof vi.fn>;
    };
    app: { preferences: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockQbService = {
      torrents: {
        setLocation: vi.fn().mockResolvedValue(undefined),
        setDownloadPath: vi.fn().mockResolvedValue(undefined),
      },
      app: { preferences: vi.fn().mockResolvedValue({}) },
    };

    await TestBed.configureTestingModule({
      imports: [SetPath],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
        { provide: ToastService, useValue: { danger: vi.fn() } },
        { provide: TorrentStoreService, useValue: { torrentsArray: signal([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetPath);
    component = fixture.componentInstance;
  });

  function setup(pathType: 'save' | 'download', torrent: Partial<Torrent>, hashes = ['hash-1']) {
    fixture.componentRef.setInput('torrent', torrent as Torrent);
    fixture.componentRef.setInput('hashes', hashes);
    fixture.componentRef.setInput('pathType', pathType);
    fixture.detectChanges();
  }

  it('should create', () => {
    setup('save', { save_path: '/downloads' });
    expect(component).toBeTruthy();
  });

  describe('pathType: save', () => {
    beforeEach(() => {
      setup('save', { save_path: '/downloads' });
    });

    it('should pre-fill the path field with the torrent save path', () => {
      expect(component.form.get('path')?.value).toBe('/downloads');
    });

    it('should use the form path when it has a value', async () => {
      component.form.get('path')?.setValue('/custom/path');
      await component.handleSubmit();
      expect(mockQbService.torrents.setLocation).toHaveBeenCalledWith(
        'server-1',
        ['hash-1'],
        '/custom/path',
      );
      expect(mockActiveModal.close).toHaveBeenCalled();
    });

    it('should fall back to torrent.save_path when form path is cleared and no default', async () => {
      component.form.get('path')?.setValue(null);
      await component.handleSubmit();
      expect(mockQbService.torrents.setLocation).toHaveBeenCalledWith(
        'server-1',
        ['hash-1'],
        '/downloads',
      );
    });
  });

  describe('pathType: download', () => {
    beforeEach(() => {
      setup('download', { download_path: '/tmp/downloads' });
    });

    it('should pre-fill the path field with the torrent download path', () => {
      expect(component.form.get('path')?.value).toBe('/tmp/downloads');
    });

    it('should not fetch a global default save path', () => {
      expect(mockQbService.app.preferences).not.toHaveBeenCalled();
    });

    it('calls setDownloadPath with the form path and closes the modal', async () => {
      component.form.get('path')?.setValue('/new/download/path');
      await component.handleSubmit();
      expect(mockQbService.torrents.setDownloadPath).toHaveBeenCalledWith(
        'server-1',
        ['hash-1'],
        '/new/download/path',
      );
      expect(mockActiveModal.close).toHaveBeenCalled();
    });

    it('closes the modal without calling the API when the path is cleared', async () => {
      component.form.get('path')?.setValue(null);
      await component.handleSubmit();
      expect(mockQbService.torrents.setDownloadPath).not.toHaveBeenCalled();
      expect(mockActiveModal.close).toHaveBeenCalled();
    });
  });

  describe('canSave', () => {
    it('should always return true', () => {
      setup('save', { save_path: '/downloads' });
      expect(component.canSave()).toBe(true);
    });
  });
});
