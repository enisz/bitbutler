import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { CategorySelect } from './category-select';

describe('CategorySelect', () => {
  let component: CategorySelect;
  let fixture: ComponentFixture<CategorySelect>;
  let mockQbService: any;

  beforeEach(async () => {
    mockQbService = {
      getAllCategories: vi.fn().mockResolvedValue({ movies: {}, tv: {} }),
      addCategory: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [CategorySelect],
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
        {
          provide: NgbModal,
          useValue: {
            open: vi.fn().mockReturnValue({ componentInstance: {}, result: Promise.resolve() }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategorySelect);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('writeValue', () => {
    it('should set the select control value', () => {
      component.writeValue('movies');
      expect(component.selectControl.value).toBe('movies');
    });

    it('should set empty string for null', () => {
      component.writeValue(null);
      expect(component.selectControl.value).toBeNull();
    });
  });

  describe('setDisabledState', () => {
    it('should disable the control', () => {
      component.setDisabledState!(true);
      expect(component.selectControl.disabled).toBe(true);
    });

    it('should enable the control', () => {
      component.setDisabledState!(true);
      component.setDisabledState!(false);
      expect(component.selectControl.enabled).toBe(true);
    });
  });

  describe('keyDownFn', () => {
    it('should return false for Escape key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      expect(component.keyDownFn(event)).toBe(false);
    });

    it('should return true for other keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      expect(component.keyDownFn(event)).toBe(true);
    });
  });

  describe('addTag', () => {
    it('should return the trimmed term', () => {
      expect(component.addTag('  New Category  ')).toBe('New Category');
    });
  });

  describe('ensureCategoryExists', () => {
    beforeEach(async () => {
      await vi.waitUntil(() => component.categories().length > 0);
    });

    it('should return true and not call addCategory for an empty value', async () => {
      component.selectControl.setValue('');
      expect(await component.ensureCategoryExists()).toBe(true);
      expect(mockQbService.addCategory).not.toHaveBeenCalled();
    });

    it('should return true and not call addCategory for an existing category', async () => {
      component.selectControl.setValue('movies');
      expect(await component.ensureCategoryExists()).toBe(true);
      expect(mockQbService.addCategory).not.toHaveBeenCalled();
    });

    it('should create a new category and add it to the known list', async () => {
      component.selectControl.setValue('new-category');
      expect(await component.ensureCategoryExists()).toBe(true);
      expect(mockQbService.addCategory).toHaveBeenCalledWith('server-1', 'new-category', '');
      expect(component.categories()).toContain('new-category');
    });

    it('should return false when addCategory fails', async () => {
      mockQbService.addCategory.mockRejectedValueOnce(new Error('failed'));
      component.selectControl.setValue('bad-category');
      expect(await component.ensureCategoryExists()).toBe(false);
      expect(component.categories()).not.toContain('bad-category');
    });
  });

  describe('initialization', () => {
    it('should load categories on init', async () => {
      await vi.waitUntil(() => component.categories().length > 0);
      expect(mockQbService.getAllCategories).toHaveBeenCalled();
      expect(component.categories()).toContain('movies');
      expect(component.categories()).toContain('tv');
    });

    it('should call onChange when selectControl value changes', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.selectControl.setValue('movies');
      expect(onChange).toHaveBeenCalledWith('movies');
    });
  });

  describe('openManageCategories', () => {
    it('should open the ManageCategories modal', () => {
      const modalService = TestBed.inject(NgbModal);
      component.openManageCategories();
      expect(modalService.open).toHaveBeenCalled();
    });
  });

  describe('manage hint link', () => {
    it('should open the ManageCategories modal when clicked', () => {
      const modalService = TestBed.inject(NgbModal);
      const button = fixture.nativeElement.querySelector(
        '[data-testid="category-select-manage"]',
      ) as HTMLButtonElement;

      button.click();

      expect(modalService.open).toHaveBeenCalled();
    });
  });
});
