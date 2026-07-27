import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
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
      fixture.componentRef.setInput('position', 'bottom');
      expect(component.resolvedPlacement()).toBe('bottom');
    });
  });

  describe('position wiring', () => {
    it('should pass resolvedDropdownPosition to the ng-select in select mode', () => {
      fixture.componentRef.setInput('inputType', 'select');
      fixture.componentRef.setInput('position', 'top');
      fixture.detectChanges();

      const ngSelect = fixture.debugElement.query(By.directive(NgSelectComponent))
        .componentInstance as NgSelectComponent;
      expect(ngSelect.dropdownPosition()).toBe('top');
    });

    it('should pass resolvedPlacement to the typeahead input in typeahead mode', () => {
      fixture.componentRef.setInput('inputType', 'typeahead');
      fixture.componentRef.setInput('position', 'bottom');
      fixture.detectChanges();

      const typeahead = fixture.debugElement
        .query(By.directive(NgbTypeahead))
        .injector.get(NgbTypeahead);
      expect(typeahead.placement).toBe('bottom');
    });

    it('should leave the ng-select at auto when position is unset', () => {
      fixture.componentRef.setInput('inputType', 'select');
      fixture.detectChanges();
      const ngSelect = fixture.debugElement.query(By.directive(NgSelectComponent))
        .componentInstance as NgSelectComponent;
      expect(ngSelect.dropdownPosition()).toBe('auto');
    });

    it('should leave the typeahead at its default placement when position is unset', () => {
      fixture.componentRef.setInput('inputType', 'typeahead');
      fixture.detectChanges();
      const typeahead = fixture.debugElement
        .query(By.directive(NgbTypeahead))
        .injector.get(NgbTypeahead);
      expect(typeahead.placement).toEqual(['bottom-start', 'bottom-end', 'top-start', 'top-end']);
    });
  });
});
