import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ManageCategories } from './manage-categories';

describe('ManageCategories', () => {
  let component: ManageCategories;
  let fixture: ComponentFixture<ManageCategories>;
  let mockQbService: Partial<QbService>;
  let mockActiveModal: Partial<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = { dismiss: vi.fn() };
    mockQbService = {
      getAllCategories: vi.fn().mockResolvedValue({
        movies: { name: 'movies', savePath: '' },
        linux: { name: 'linux', savePath: '/downloads/linux' },
      }),
      addCategory: vi.fn().mockResolvedValue(undefined),
      editCategory: vi.fn().mockResolvedValue(undefined),
      removeCategories: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ManageCategories],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
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
    expect(mockQbService.getAllCategories).toHaveBeenCalledWith('server-1');
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
      expect(mockQbService.addCategory).toHaveBeenCalledWith(
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
      expect(mockQbService.addCategory).not.toHaveBeenCalled();
    });

    it('should not add when name is whitespace only', async () => {
      component.addForm.get('name')?.setValue('   ');
      await component.add();
      expect(mockQbService.addCategory).not.toHaveBeenCalled();
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
      expect(mockQbService.editCategory).toHaveBeenCalledWith('server-1', 'linux', '/new/path');
      expect(component.categories()[0].savePath).toBe('/new/path');
      expect(component.categories()[0].editing).toBe(false);
    });
  });

  describe('delete', () => {
    it('should call removeCategories and remove the item from the list', async () => {
      const linux = component.categories()[0];
      await component.delete(linux);
      expect(mockQbService.removeCategories).toHaveBeenCalledWith('server-1', ['linux']);
      expect(component.categories().find((c) => c.name === 'linux')).toBeUndefined();
      expect(component.categories()).toHaveLength(1);
    });
  });
});
