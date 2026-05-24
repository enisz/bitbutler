import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { SetTorrentLocation } from './set-torrent-location';

describe('SetTorrentLocation', () => {
  let component: SetTorrentLocation;
  let fixture: ComponentFixture<SetTorrentLocation>;
  let mockActiveModal: Partial<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SetTorrentLocation],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: SelectionStoreService,
          useValue: {
            selected: signal([{ save_path: '/downloads' }]),
            selectedHashes: vi.fn().mockReturnValue([]),
          },
        },
        {
          provide: QbService,
          useValue: {
            setTorrentLocation: vi.fn().mockResolvedValue(undefined),
            getAppPreferences: vi.fn().mockResolvedValue({}),
          },
        },
        { provide: ToastService, useValue: { danger: vi.fn() } },
        { provide: TorrentStoreService, useValue: { torrentsArray: signal([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetTorrentLocation);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('torrent', { save_path: '/downloads' } as Torrent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should pre-fill the path field with the torrent save path', () => {
    expect(component.setLocationForm.get('path')?.value).toBe('/downloads');
  });

  describe('canSave', () => {
    it('should always return true', () => {
      expect(component.canSave()).toBe(true);
    });

    it('should return true even when path is cleared', () => {
      component.setLocationForm.get('path')?.setValue(null);
      expect(component.canSave()).toBe(true);
    });
  });

  describe('handleSubmit fallback', () => {
    let mockQbService: {
      setTorrentLocation: ReturnType<typeof vi.fn>;
      getAppPreferences: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockQbService = TestBed.inject(QbService) as any;
    });

    it('should use the form path when it has a value', async () => {
      component.setLocationForm.get('path')?.setValue('/custom/path');
      await component.handleSubmit();
      expect(mockQbService.setTorrentLocation).toHaveBeenCalledWith(
        'server-1',
        expect.any(Array),
        '/custom/path',
      );
    });

    it('should fall back to torrent.save_path when form path is cleared and no default', async () => {
      component.setLocationForm.get('path')?.setValue(null);
      await component.handleSubmit();
      expect(mockQbService.setTorrentLocation).toHaveBeenCalledWith(
        'server-1',
        expect.any(Array),
        '/downloads',
      );
    });
  });
});
