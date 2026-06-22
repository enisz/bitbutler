import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { mockTranslateService } from '../../../test-utils/translate.mock';
import { ManageCategories } from './manage-categories';

describe('ManageCategories', () => {
  let component: ManageCategories;
  let fixture: ComponentFixture<ManageCategories>;
  let mockQbService: any;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockConfirmService: Partial<ConfirmService>;

  beforeEach(async () => {
    mockActiveModal = { dismiss: vi.fn() };
    mockQbService = {
      torrents: {
        categories: vi.fn().mockResolvedValue({
          movies: { name: 'movies', savePath: '' },
          linux: { name: 'linux', savePath: '/downloads/linux' },
        }),
        createCategory: vi.fn().mockResolvedValue(undefined),
        editCategory: vi.fn().mockResolvedValue(undefined),
        removeCategories: vi.fn().mockResolvedValue(undefined),
      },
      app: {
        preferences: vi.fn().mockResolvedValue({ save_path: '/downloads' }),
      },
    };
    mockConfirmService = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ManageCategories],
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
              { tags: '', category: 'linux' },
              { tags: '', category: 'linux' },
              { tags: '', category: 'movies' },
            ] as any),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageCategories);
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

  it('should load categories sorted alphabetically', () => {
    expect(mockQbService.torrents.categories).toHaveBeenCalledWith('server-1');
    expect(component.categories()).toHaveLength(2);
    expect(component.categories()[0]).toEqual({
      name: 'linux',
      savePath: '/downloads/linux',
      editing: false,
    });
    expect(component.categories()[1]).toEqual({ name: 'movies', savePath: '', editing: false });
  });

  describe('add', () => {
    it('should call addCategory and append to the list', async () => {
      component.addForm.get('name')?.setValue('software');
      component.addForm.get('savePath')?.setValue('/downloads/software');
      await component.add();
      expect(mockQbService.torrents.createCategory).toHaveBeenCalledWith(
        'server-1',
        'software',
        '/downloads/software',
      );
      expect(component.categories().find((c) => c.name === 'software')).toEqual({
        name: 'software',
        savePath: '/downloads/software',
        editing: false,
      });
      expect(component.addForm.get('name')?.value).toBeNull();
    });

    it('should maintain alphabetical order after adding a new category', async () => {
      component.addForm.get('name')?.setValue('alpha');
      await component.add();
      expect(component.categories()[0].name).toBe('alpha');
    });

    it('should not add when name is empty', async () => {
      component.addForm.get('name')?.setValue('');
      await component.add();
      expect(mockQbService.torrents.createCategory).not.toHaveBeenCalled();
    });

    it('should not add when name is whitespace only', async () => {
      component.addForm.get('name')?.setValue('   ');
      await component.add();
      expect(mockQbService.torrents.createCategory).not.toHaveBeenCalled();
    });
  });

  describe('startEdit', () => {
    it('should set editing true only for the selected item', () => {
      component.startEdit(component.categories()[0]);
      expect(component.categories()[0].editing).toBe(true);
      expect(component.categories()[1].editing).toBe(false);
    });

    it('should pre-fill editSavePathControl with the item save path', () => {
      component.startEdit(component.categories()[0]);
      expect(component.editSavePathControl.value).toBe('/downloads/linux');
    });

    it('should set editSavePathControl to null when item savePath is empty', () => {
      const movies = component.categories().find((c) => c.name === 'movies')!;
      component.startEdit(movies);
      expect(component.editSavePathControl.value).toBeNull();
    });
  });

  describe('cancelEdit', () => {
    it('should clear editing state for all items', () => {
      component.startEdit(component.categories()[0]);
      component.cancelEdit();
      expect(component.categories().every((c) => !c.editing)).toBe(true);
    });
  });

  describe('saveEdit', () => {
    it('should call editCategory and update the save path in the list', async () => {
      component.startEdit(component.categories()[0]);
      component.editSavePathControl.setValue('/new/path');
      await component.saveEdit(component.categories()[0]);
      expect(mockQbService.torrents.editCategory).toHaveBeenCalledWith(
        'server-1',
        'linux',
        '/new/path',
      );
      expect(component.categories()[0].savePath).toBe('/new/path');
      expect(component.categories()[0].editing).toBe(false);
    });
  });

  describe('delete', () => {
    it('should show a confirm dialog before deleting', async () => {
      await component.delete(component.categories()[0]);
      expect(mockConfirmService.confirm).toHaveBeenCalled();
    });

    it('should pass the torrent count to the confirm dialog', async () => {
      const linux = component.categories()[0];
      await component.delete(linux);
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
      const linux = component.categories()[0];
      await component.delete(linux);
      expect(mockQbService.torrents.removeCategories).toHaveBeenCalledWith('server-1', ['linux']);
      expect(component.categories().find((c) => c.name === 'linux')).toBeUndefined();
      expect(component.categories()).toHaveLength(1);
    });

    it('should not delete when the user cancels', async () => {
      (mockConfirmService.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const linux = component.categories()[0];
      await component.delete(linux);
      expect(mockQbService.torrents.removeCategories).not.toHaveBeenCalled();
      expect(component.categories().find((c) => c.name === 'linux')).toBeDefined();
    });
  });

  describe('canDeactivate', () => {
    it('should return true when not editing and add form is clean', async () => {
      expect(await component.canDeactivate()).toBe(true);
    });

    it('should prompt when the add form is dirty', async () => {
      component.addForm.get('name')?.setValue('draft');
      component.addForm.markAsDirty();
      await component.canDeactivate();
      expect(mockConfirmService.confirm).toHaveBeenCalled();
    });

    it('should prompt when a category is being edited', async () => {
      component.startEdit(component.categories()[0]);
      await component.canDeactivate();
      expect(mockConfirmService.confirm).toHaveBeenCalled();
    });

    it('should return the confirm result when prompted', async () => {
      (mockConfirmService.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      component.addForm.markAsDirty();
      expect(await component.canDeactivate()).toBe(false);
    });
  });

  describe('filteredCategories', () => {
    it('should return all categories when filter is empty', () => {
      expect(component.filteredCategories()).toHaveLength(2);
    });

    it('should filter by category name case-insensitively', () => {
      component.filterControl.setValue('lin');
      expect(component.filteredCategories()).toHaveLength(1);
      expect(component.filteredCategories()[0].name).toBe('linux');
    });

    it('should match case-insensitively', () => {
      component.filterControl.setValue('LIN');
      expect(component.filteredCategories()).toHaveLength(1);
      expect(component.filteredCategories()[0].name).toBe('linux');
    });

    it('should always show items currently being edited regardless of filter', () => {
      component.startEdit(component.categories()[0]);
      component.filterControl.setValue('movies');
      const names = component.filteredCategories().map((c) => c.name);
      expect(names).toContain('linux');
      expect(names).toContain('movies');
    });

    it('should return all categories when filter is cleared', () => {
      component.filterControl.setValue('lin');
      component.filterControl.setValue('');
      expect(component.filteredCategories()).toHaveLength(2);
    });

    it('should clear the filter control when clearFilter is called', () => {
      component.filterControl.setValue('linux');
      expect(component.filterControl.value).toBe('linux');
      component.clearFilter();
      expect(component.filterControl.value).toBeNull();
    });
  });
});
