import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TagSelect } from './tag-select';

describe('TagSelect', () => {
  let component: TagSelect;
  let fixture: ComponentFixture<TagSelect>;
  let mockQbService: any;
  let mockCommandBusService: Partial<CommandBusService>;

  beforeEach(async () => {
    mockQbService = {
      getAllTags: vi.fn().mockResolvedValue(['action', 'comedy']),
    };
    mockCommandBusService = { emit: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TagSelect],
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
        { provide: CommandBusService, useValue: mockCommandBusService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TagSelect);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('writeValue', () => {
    it('should set the select control value', () => {
      component.writeValue(['action', 'comedy']);
      expect(component.selectControl.value).toEqual(['action', 'comedy']);
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
      expect(component.keyDownFn(new KeyboardEvent('keydown', { key: 'Escape' }))).toBe(false);
    });

    it('should return true for other keys', () => {
      expect(component.keyDownFn(new KeyboardEvent('keydown', { key: 'Tab' }))).toBe(true);
    });
  });

  describe('ngOnInit', () => {
    it('should load all tags on init', async () => {
      await component.ngOnInit();
      expect(component.tags()).toEqual(['action', 'comedy']);
    });

    it('should call onChange when select control value changes', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.ngOnInit();
      component.selectControl.setValue(['action']);
      expect(onChange).toHaveBeenCalledWith(['action']);
    });
  });

  describe('openManageTags', () => {
    it('should emit UI_MANAGE_TAGS', () => {
      component.openManageTags();
      expect(mockCommandBusService.emit).toHaveBeenCalledWith({ type: 'UI_MANAGE_TAGS' });
    });
  });
});
