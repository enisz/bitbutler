import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Torrent } from '../../models/torrent.model';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { RenameTorrent } from './rename-torrent';

describe('RenameTorrent', () => {
  let component: RenameTorrent;
  let fixture: ComponentFixture<RenameTorrent>;
  let mockActiveModal: Partial<NgbActiveModal>;

  const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent =>
    ({ name: 'My Torrent', hash: 'abc123', ...overrides }) as Torrent;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RenameTorrent],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: QbService,
          useValue: { torrents: { rename: vi.fn(), files: vi.fn().mockResolvedValue([]) } },
        },
        { provide: ToastService, useValue: { danger: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RenameTorrent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('torrent', makeTorrent());
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should pre-fill the name field with the torrent name', () => {
    expect(component.renameTorrentForm.get('name')?.value).toBe('My Torrent');
  });

  describe('canSave', () => {
    it('should return false when name is empty', () => {
      component.renameTorrentForm.get('name')?.setValue('');
      expect(component.canSave()).toBe(false);
    });

    it('should return false when name is unchanged', () => {
      component.renameTorrentForm.get('name')?.setValue('My Torrent');
      expect(component.canSave()).toBe(false);
    });

    it('should return true when name is changed to a different value', () => {
      component.renameTorrentForm.get('name')?.setValue('New Name');
      expect(component.canSave()).toBe(true);
    });

    it('should return false when processing is true', () => {
      component.renameTorrentForm.get('name')?.setValue('New Name');
      component.processing.set(true);
      expect(component.canSave()).toBe(false);
    });
  });
});
