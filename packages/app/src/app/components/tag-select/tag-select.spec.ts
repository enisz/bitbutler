import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TagSelect } from './tag-select';

describe('TagSelect', () => {
  let component: TagSelect;
  let fixture: ComponentFixture<TagSelect>;
  let mockQbService: any;
  let mockModalService: Partial<NgbModal>;

  beforeEach(async () => {
    mockQbService = {
      getAllTags: vi.fn().mockResolvedValue(['action', 'comedy']),
    };
    mockModalService = {
      open: vi.fn().mockReturnValue({ componentInstance: {}, result: Promise.resolve() }),
    };

    await TestBed.configureTestingModule({
      imports: [TagSelect],
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
        { provide: NgbModal, useValue: mockModalService },
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

  describe('initialization', () => {
    it('should load all tags on init', async () => {
      await vi.waitUntil(() => component.tags().length > 0);
      expect(component.tags()).toEqual(['action', 'comedy']);
    });

    it('should call onChange when select control value changes', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.selectControl.setValue(['action']);
      expect(onChange).toHaveBeenCalledWith(['action']);
    });
  });

  describe('openManageTags', () => {
    it('should open the ManageTags modal', () => {
      component.openManageTags();
      expect(mockModalService.open).toHaveBeenCalled();
    });
  });

  describe('manage hint link', () => {
    it('should open the ManageTags modal when clicked', () => {
      const button = fixture.nativeElement.querySelector(
        '[data-testid="tag-select-manage"]',
      ) as HTMLButtonElement;

      button.click();

      expect(mockModalService.open).toHaveBeenCalled();
    });
  });
});
