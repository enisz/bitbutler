import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TypeaheadService } from '../../../services/typeahead.service';
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
          useValue: { setTorrentLocation: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: ToastService, useValue: { danger: vi.fn() } },
        {
          provide: TypeaheadService,
          useValue: { searchSavePaths: vi.fn().mockReturnValue(of([])) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetTorrentLocation);
    component = fixture.componentInstance;
    component.torrent = { save_path: '/downloads' } as Torrent;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should pre-fill the path field with the torrent save path', () => {
    expect(component.setLocationForm.get('path')?.value).toBe('/downloads');
  });

  describe('canSave', () => {
    it('should return true when the path field is non-empty', () => {
      expect(component.canSave()).toBe(true);
    });

    it('should return false when the path field is empty', () => {
      component.setLocationForm.get('path')?.setValue('');
      expect(component.canSave()).toBe(false);
    });
  });
});
