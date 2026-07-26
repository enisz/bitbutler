import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { SavePathSelect } from './save-path-select';

describe('SavePathSelect', () => {
  let component: SavePathSelect;
  let fixture: ComponentFixture<SavePathSelect>;
  let torrentsSignal: ReturnType<typeof signal<any[]>>;

  beforeEach(async () => {
    torrentsSignal = signal([]);

    await TestBed.configureTestingModule({
      imports: [SavePathSelect],
      providers: [{ provide: TorrentStoreService, useValue: { torrentsArray: torrentsSignal } }],
    }).compileComponents();

    fixture = TestBed.createComponent(SavePathSelect);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('paths', () => {
    it('should derive unique sorted paths from torrents', () => {
      torrentsSignal.set([
        { save_path: '/media/movies' },
        { save_path: '/downloads' },
        { save_path: '/media/movies' },
      ]);
      expect(component.paths()).toEqual(['/downloads', '/media/movies']);
    });

    it('should return empty array when no torrents', () => {
      expect(component.paths()).toEqual([]);
    });
  });

  describe('addTag', () => {
    it('should return the typed term as-is', () => {
      expect(component.addTag('/new/custom/path')).toBe('/new/custom/path');
    });
  });

  describe('writeValue', () => {
    it('should set the select control value', () => {
      component.writeValue('/downloads');
      expect(component.selectControl.value).toBe('/downloads');
    });

    it('should set null', () => {
      component.writeValue(null);
      expect(component.selectControl.value).toBeNull();
    });
  });

  describe('setDisabledState', () => {
    it('should disable the control', () => {
      component.setDisabledState(true);
      expect(component.selectControl.disabled).toBe(true);
    });

    it('should enable the control', () => {
      component.setDisabledState(true);
      component.setDisabledState(false);
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

  describe('initialization', () => {
    it('should call onChange when selectControl value changes', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.selectControl.setValue('/new/path');
      expect(onChange).toHaveBeenCalledWith('/new/path');
    });
  });

  describe('inputs', () => {
    it('should have clearable false by default', () => {
      expect(component.clearable()).toBe(false);
    });

    it('should have label null by default', () => {
      expect(component.label()).toBeNull();
    });

    it('should have appendTo empty string by default', () => {
      expect(component.appendTo()).toBe('');
    });
  });

  describe('position', () => {
    it('should be null by default', () => {
      expect(component.position()).toBeNull();
    });

    it('should resolve dropdownPosition to auto by default', () => {
      expect(component.resolvedDropdownPosition()).toBe('auto');
    });

    it('should resolve placement to the default flip array by default', () => {
      expect(component.resolvedPlacement()).toEqual([
        'bottom-start',
        'bottom-end',
        'top-start',
        'top-end',
      ]);
    });

    it('should pass a set position straight through to resolvedDropdownPosition', () => {
      fixture.componentRef.setInput('position', 'top');
      expect(component.resolvedDropdownPosition()).toBe('top');
    });

    it('should pass a set position straight through to resolvedPlacement', () => {
      fixture.componentRef.setInput('position', 'left');
      expect(component.resolvedPlacement()).toBe('left');
    });
  });
});
