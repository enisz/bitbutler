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

  describe('ngOnInit', () => {
    it('should load categories on init', async () => {
      await component.ngOnInit();
      expect(mockQbService.getAllCategories).toHaveBeenCalled();
      expect(component.categories()).toContain('movies');
      expect(component.categories()).toContain('tv');
    });

    it('should call onChange when selectControl value changes', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.ngOnInit();
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
});
