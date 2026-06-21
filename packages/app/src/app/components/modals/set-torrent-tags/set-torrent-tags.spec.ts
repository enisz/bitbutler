import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
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
          provide: QbService,
          useValue: {
            torrents: {
              tags: vi.fn().mockResolvedValue([]),
              addTags: vi.fn().mockResolvedValue(undefined),
              removeTags: vi.fn().mockResolvedValue(undefined),
            },
          },
        },
        { provide: ToastService, useValue: { danger: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetTorrentTags);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('torrent', { tags: 'action,comedy' } as Torrent);
    fixture.componentRef.setInput('hashes', ['hash-1']);
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
      fixture.componentRef.setInput('torrent', { tags: '' } as Torrent);
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

  describe('handleSubmit', () => {
    it('should apply tag changes to the hashes provided via the input, not the selection store', async () => {
      const mockQbService = TestBed.inject(QbService) as unknown as {
        torrents: { addTags: ReturnType<typeof vi.fn>; removeTags: ReturnType<typeof vi.fn> };
      };
      await component.ngOnInit();
      component.setTorrentTagsForm.get('tags')?.setValue(['action', 'drama']);
      await component.handleSubmit();
      expect(mockQbService.torrents.addTags).toHaveBeenCalledWith(
        'server-1',
        ['hash-1'],
        ['drama'],
      );
      expect(mockQbService.torrents.removeTags).toHaveBeenCalledWith(
        'server-1',
        ['hash-1'],
        ['comedy'],
      );
    });

    it('should show a danger toast with the raw error when addTags fails', async () => {
      const mockQbService = TestBed.inject(QbService) as unknown as {
        torrents: { addTags: ReturnType<typeof vi.fn>; removeTags: ReturnType<typeof vi.fn> };
      };
      const mockToastService = TestBed.inject(ToastService) as unknown as {
        danger: ReturnType<typeof vi.fn>;
      };
      mockQbService.torrents.addTags.mockRejectedValueOnce(new Error('disk full'));
      await component.ngOnInit();
      component.setTorrentTagsForm.get('tags')?.setValue(['action', 'drama']);

      await component.handleSubmit();

      expect(mockToastService.danger).toHaveBeenCalledWith(
        'disk full',
        'components.modals.set-torrent-tags.toast.set-failed-title',
      );
    });
  });
});
