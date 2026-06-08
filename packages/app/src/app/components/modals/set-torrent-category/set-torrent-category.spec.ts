import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { SetTorrentCategory } from './set-torrent-category';

describe('SetTorrentCategory', () => {
  let component: SetTorrentCategory;
  let fixture: ComponentFixture<SetTorrentCategory>;
  let mockActiveModal: Partial<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SetTorrentCategory],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: QbService,
          useValue: {
            getAllCategories: vi.fn().mockResolvedValue({}),
            setTorrentCategory: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetTorrentCategory);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('torrent', { category: 'movies' } as Torrent);
    fixture.componentRef.setInput('hashes', ['hash-1']);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should pre-fill the category field with the torrent category', () => {
    expect(component.setTorrentCategoryForm.get('category')?.value).toBe('movies');
  });

  describe('canSave', () => {
    it('should return false when the form is not dirty', () => {
      expect(component.canSave()).toBe(false);
    });

    it('should return true when the form is dirty and valid', () => {
      component.setTorrentCategoryForm.get('category')?.setValue('tv');
      component.setTorrentCategoryForm.markAsDirty();
      expect(component.canSave()).toBe(true);
    });

    it('should return false while saving', () => {
      component.setTorrentCategoryForm.get('category')?.setValue('tv');
      component.setTorrentCategoryForm.markAsDirty();
      component.saving = true;
      expect(component.canSave()).toBe(false);
    });
  });

  describe('handleSubmit', () => {
    it('should apply the category to the hashes provided via the input, not the selection store', async () => {
      const mockQbService = TestBed.inject(QbService) as unknown as {
        setTorrentCategory: ReturnType<typeof vi.fn>;
      };
      component.setTorrentCategoryForm.get('category')?.setValue('tv');
      await component.handleSubmit();
      expect(mockQbService.setTorrentCategory).toHaveBeenCalledWith('server-1', ['hash-1'], 'tv');
    });
  });
});
