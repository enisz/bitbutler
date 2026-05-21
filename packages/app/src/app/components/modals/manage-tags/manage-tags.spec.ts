import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { ManageTags } from './manage-tags';

describe('ManageTags', () => {
  let component: ManageTags;
  let fixture: ComponentFixture<ManageTags>;
  let mockQbService: Partial<QbService>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockConfirmService: Partial<ConfirmService>;

  beforeEach(async () => {
    mockActiveModal = { dismiss: vi.fn() };
    mockQbService = {
      getAllTags: vi.fn().mockResolvedValue(['movies', 'linux']),
      createTags: vi.fn().mockResolvedValue(undefined),
      deleteTags: vi.fn().mockResolvedValue(undefined),
    };
    mockConfirmService = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ManageTags],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
        { provide: ConfirmService, useValue: mockConfirmService },
        {
          provide: TorrentStoreService,
          useValue: {
            torrentsArray: signal([
              { tags: 'linux,movies', category: '' },
              { tags: 'linux', category: 'software' },
              { tags: 'movies', category: '' },
            ] as any),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageTags);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set loading to false after init completes', () => {
    expect(component.loading()).toBe(false);
  });

  it('should load tags sorted alphabetically', () => {
    expect(mockQbService.getAllTags).toHaveBeenCalledWith('server-1');
    expect(component.tags()).toEqual(['linux', 'movies']);
  });

  describe('add', () => {
    it('should call createTags and append the new tag', async () => {
      component.nameControl.setValue('software');
      await component.add();
      expect(mockQbService.createTags).toHaveBeenCalledWith('server-1', ['software']);
      expect(component.tags()).toContain('software');
      expect(component.nameControl.value).toBeNull();
    });

    it('should maintain alphabetical order after adding a new tag', async () => {
      component.nameControl.setValue('alpha');
      await component.add();
      expect(component.tags()[0]).toBe('alpha');
    });

    it('should not add when name is empty', async () => {
      component.nameControl.setValue('');
      await component.add();
      expect(mockQbService.createTags).not.toHaveBeenCalled();
    });

    it('should not add when name is whitespace only', async () => {
      component.nameControl.setValue('   ');
      await component.add();
      expect(mockQbService.createTags).not.toHaveBeenCalled();
    });

    it('should split comma-separated input and add each tag', async () => {
      component.nameControl.setValue('alpha, beta, gamma');
      await component.add();
      expect(mockQbService.createTags).toHaveBeenCalledWith('server-1', ['alpha', 'beta', 'gamma']);
      expect(component.tags()).toContain('alpha');
      expect(component.tags()).toContain('beta');
      expect(component.tags()).toContain('gamma');
    });

    it('should trim whitespace from each comma-separated segment', async () => {
      component.nameControl.setValue('  alpha  ,  beta  ');
      await component.add();
      expect(mockQbService.createTags).toHaveBeenCalledWith('server-1', ['alpha', 'beta']);
    });

    it('should skip empty segments in comma-separated input', async () => {
      component.nameControl.setValue('tag1,,tag2,  ,tag3');
      await component.add();
      expect(mockQbService.createTags).toHaveBeenCalledWith('server-1', ['tag1', 'tag2', 'tag3']);
    });
  });

  describe('delete', () => {
    it('should show a confirm dialog before deleting', async () => {
      await component.delete('linux');
      expect(mockConfirmService.confirm).toHaveBeenCalled();
    });

    it('should pass the torrent count to the confirm dialog', async () => {
      await component.delete('linux');
      // The mock has 2 torrents with 'linux' tag
      expect(mockConfirmService.confirm).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ data: { name: 'linux', count: 2 } }),
        expect.any(String),
      );
    });

    it('should delete when the user confirms', async () => {
      (mockConfirmService.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      await component.delete('linux');
      expect(mockQbService.deleteTags).toHaveBeenCalledWith('server-1', ['linux']);
      expect(component.tags()).not.toContain('linux');
      expect(component.tags()).toContain('movies');
    });

    it('should not delete when the user cancels', async () => {
      (mockConfirmService.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      await component.delete('linux');
      expect(mockQbService.deleteTags).not.toHaveBeenCalled();
      expect(component.tags()).toContain('linux');
    });
  });

  describe('filteredTags', () => {
    it('should return all tags when filter is empty', () => {
      expect(component.filteredTags()).toEqual(['linux', 'movies']);
    });

    it('should filter tags case-insensitively by substring', () => {
      component.filterControl.setValue('lin');
      expect(component.filteredTags()).toEqual(['linux']);
      expect(component.filteredTags()).not.toContain('movies');
    });

    it('should match case-insensitively', () => {
      component.filterControl.setValue('LIN');
      expect(component.filteredTags()).toContain('linux');
    });

    it('should return all tags when filter is cleared', () => {
      component.filterControl.setValue('lin');
      component.filterControl.setValue('');
      expect(component.filteredTags()).toEqual(['linux', 'movies']);
    });
  });
});
