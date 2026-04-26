import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { SetTorrentTags } from './set-torrent-tags';

describe('SetTorrentTags', () => {
  let component: SetTorrentTags;
  let fixture: ComponentFixture<SetTorrentTags>;
  let mockActiveModal: Partial<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SetTorrentTags],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: SelectionStoreService,
          useValue: { selected: signal([]), selectedHashes: vi.fn().mockReturnValue([]) },
        },
        {
          provide: QbService,
          useValue: {
            getAllTags: vi.fn().mockResolvedValue([]),
            addTorrentTags: vi.fn().mockResolvedValue(undefined),
            removeTorrentTags: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetTorrentTags);
    component = fixture.componentInstance;
    component.torrent = { tags: 'action,comedy' } as Torrent;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should pre-fill the tags field with existing torrent tags', async () => {
      await component.ngOnInit();
      expect(component.setTorrentTagsForm.get('tags')?.value).toEqual(['action', 'comedy']);
    });

    it('should handle empty tags string', async () => {
      component.torrent = { tags: '' } as Torrent;
      await component.ngOnInit();
      expect(component.setTorrentTagsForm.get('tags')?.value).toEqual([]);
    });
  });

  describe('canSave computed', () => {
    it('should be false when the form is not dirty', () => {
      expect(component.canSave()).toBe(false);
    });

    it('should be true when the form is dirty and valid', async () => {
      await component.ngOnInit();
      component.setTorrentTagsForm.markAsDirty();
      component.setTorrentTagsForm.updateValueAndValidity();
      component.setTorrentTagsForm.get('tags')?.setValue(['action']);
      expect(component.canSave()).toBe(true);
    });
  });
});
