import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmService } from '../../services/confirm.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { mockTranslateService } from '../../test-utils/translate.mock';
import { ManageTags } from './manage-tags';

describe('ManageTags', () => {
  let component: ManageTags;
  let fixture: ComponentFixture<ManageTags>;
  let mockQbService: any;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockConfirmService: Partial<ConfirmService>;

  beforeEach(async () => {
    mockActiveModal = { dismiss: vi.fn() };
    mockQbService = {
      torrents: {
        tags: vi.fn().mockResolvedValue(['movies', 'linux']),
        createTags: vi.fn().mockResolvedValue(undefined),
        deleteTags: vi.fn().mockResolvedValue(undefined),
      },
    };
    mockConfirmService = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ManageTags],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
        { provide: ConfirmService, useValue: mockConfirmService },
        { provide: ToastService, useValue: { success: vi.fn(), danger: vi.fn() } },
        { provide: TranslateService, useFactory: mockTranslateService },
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
    expect(mockQbService.torrents.tags).toHaveBeenCalledWith('server-1');
    expect(component.tags()).toEqual(['linux', 'movies']);
  });

  describe('add', () => {
    it('should call createTags and append the new tag', async () => {
      component.nameControl.setValue('software');
      await component.add();
      expect(mockQbService.torrents.createTags).toHaveBeenCalledWith('server-1', ['software']);
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
      expect(mockQbService.torrents.createTags).not.toHaveBeenCalled();
    });

    it('should not add when name is whitespace only', async () => {
      component.nameControl.setValue('   ');
      await component.add();
      expect(mockQbService.torrents.createTags).not.toHaveBeenCalled();
    });

    it('should split comma-separated input and add each tag', async () => {
      component.nameControl.setValue('alpha, beta, gamma');
      await component.add();
      expect(mockQbService.torrents.createTags).toHaveBeenCalledWith('server-1', [
        'alpha',
        'beta',
        'gamma',
      ]);
      expect(component.tags()).toContain('alpha');
      expect(component.tags()).toContain('beta');
      expect(component.tags()).toContain('gamma');
    });

    it('should trim whitespace from each comma-separated segment', async () => {
      component.nameControl.setValue('  alpha  ,  beta  ');
      await component.add();
      expect(mockQbService.torrents.createTags).toHaveBeenCalledWith('server-1', ['alpha', 'beta']);
    });

    it('should skip empty segments in comma-separated input', async () => {
      component.nameControl.setValue('tag1,,tag2,  ,tag3');
      await component.add();
      expect(mockQbService.torrents.createTags).toHaveBeenCalledWith('server-1', [
        'tag1',
        'tag2',
        'tag3',
      ]);
    });

    it('should not add duplicate tags to local state when input contains existing tag', async () => {
      component.nameControl.setValue('linux, newone');
      await component.add();
      expect(component.tags().filter((t) => t === 'linux')).toHaveLength(1);
      expect(component.tags()).toContain('newone');
    });
  });

  describe('delete', () => {
    it('should show a confirm dialog before deleting', async () => {
      await component.delete('linux');
      expect(mockConfirmService.confirm).toHaveBeenCalled();
    });

    it('should pass the torrent count to the confirm dialog', async () => {
      await component.delete('linux');

      expect(mockConfirmService.confirm).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ data: { name: 'linux', count: 2 } }),
        expect.any(String),
        undefined,
        undefined,
        faTrashCan,
      );
    });

    it('should delete when the user confirms', async () => {
      (mockConfirmService.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      await component.delete('linux');
      expect(mockQbService.torrents.deleteTags).toHaveBeenCalledWith('server-1', ['linux']);
      expect(component.tags()).not.toContain('linux');
      expect(component.tags()).toContain('movies');
    });

    it('should not delete when the user cancels', async () => {
      (mockConfirmService.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      await component.delete('linux');
      expect(mockQbService.torrents.deleteTags).not.toHaveBeenCalled();
      expect(component.tags()).toContain('linux');
    });
  });

  describe('canDeactivate', () => {
    it('should return true when nameControl is not dirty', async () => {
      expect(await component.canDeactivate()).toBe(true);
    });

    it('should prompt when nameControl is dirty', async () => {
      component.nameControl.setValue('draft');
      component.nameControl.markAsDirty();
      await component.canDeactivate();
      expect(mockConfirmService.confirm).toHaveBeenCalled();
    });

    it('should return the confirm result when prompted', async () => {
      (mockConfirmService.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      component.nameControl.markAsDirty();
      expect(await component.canDeactivate()).toBe(false);
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

    it('should clear the filter control when clearFilter is called', () => {
      component.filterControl.setValue('linux');
      expect(component.filterControl.value).toBe('linux');
      component.clearFilter();
      expect(component.filterControl.value).toBeNull();
    });
  });
});
