import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandBusService } from '../../services/command-bus.service';
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
        { provide: CommandBusService, useValue: { emit: vi.fn() } },
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
    it('should emit UI_MANAGE_CATEGORIES and prevent default', () => {
      const commandBus = TestBed.inject(CommandBusService);
      const event = new MouseEvent('click');
      vi.spyOn(event, 'preventDefault');
      component.openManageCategories(event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(commandBus.emit).toHaveBeenCalledWith({ type: 'UI_MANAGE_CATEGORIES' });
    });
  });
});
