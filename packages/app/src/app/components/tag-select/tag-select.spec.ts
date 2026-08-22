import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TagSelect } from './tag-select';

describe('TagSelect', () => {
  let component: TagSelect;
  let fixture: ComponentFixture<TagSelect>;
  let mockQbService: any;

  beforeEach(async () => {
    mockQbService = {
      torrents: { tags: vi.fn().mockResolvedValue(['action', 'comedy']) },
    };

    await TestBed.configureTestingModule({
      imports: [TagSelect],
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
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

  describe('addTag', () => {
    it('should return the trimmed term', () => {
      expect(component.addTag('  new-tag  ')).toBe('new-tag');
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
});
