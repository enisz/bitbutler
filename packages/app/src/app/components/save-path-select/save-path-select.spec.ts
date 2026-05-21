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

  describe('ngOnInit', () => {
    it('should call onChange when selectControl value changes', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.ngOnInit();
      component.selectControl.setValue('/new/path');
      expect(onChange).toHaveBeenCalledWith('/new/path');
    });
  });

  describe('inputs', () => {
    it('should have clearable false by default', () => {
      expect(component.clearable).toBe(false);
    });

    it('should have showPopover true by default', () => {
      expect(component.showPopover).toBe(true);
    });

    it('should have label null by default', () => {
      expect(component.label).toBeNull();
    });

    it('should have appendTo empty string by default', () => {
      expect(component.appendTo).toBe('');
    });

    it('should render bb-popover when showPopover is true (default)', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('bb-popover')).not.toBeNull();
    });

    it('should not render bb-popover when showPopover is false', () => {
      fixture.componentRef.setInput('showPopover', false);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('bb-popover')).toBeNull();
    });

    it('should render container-fluid wrapper when showPopover is true (default)', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.container-fluid')).not.toBeNull();
    });

    it('should not render container-fluid wrapper when showPopover is false', () => {
      fixture.componentRef.setInput('showPopover', false);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.container-fluid')).toBeNull();
    });
  });
});
