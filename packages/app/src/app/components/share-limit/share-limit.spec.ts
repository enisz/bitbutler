import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShareLimit } from './share-limit';

describe('ShareLimit', () => {
  let component: ShareLimit;
  let fixture: ComponentFixture<ShareLimit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShareLimit],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareLimit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('writeValue', () => {
    it('should patch form with provided values', () => {
      component.writeValue({ ratioLimit: 2.5, seedingTimeLimit: 60, inactiveSeedingTimeLimit: 30 });
      expect(component.form.value.ratioLimit).toBe(2.5);
      expect(component.form.value.seedingTimeLimit).toBe(60);
      expect(component.form.value.inactiveSeedingTimeLimit).toBe(30);
    });

    it('should reset all fields to null when null is passed', () => {
      component.writeValue({ ratioLimit: 1, seedingTimeLimit: 10, inactiveSeedingTimeLimit: 5 });
      component.writeValue(null);
      expect(component.form.value.ratioLimit).toBeNull();
      expect(component.form.value.seedingTimeLimit).toBeNull();
      expect(component.form.value.inactiveSeedingTimeLimit).toBeNull();
    });

    it('should set global mode for -2 values', () => {
      component.writeValue({ ratioLimit: -2, seedingTimeLimit: -2, inactiveSeedingTimeLimit: -2 });
      expect(component.ratioMode()).toBe('global');
      expect(component.seedingMode()).toBe('global');
      expect(component.inactiveMode()).toBe('global');
    });

    it('should set no-limit mode for -1 values', () => {
      component.writeValue({ ratioLimit: -1, seedingTimeLimit: -1, inactiveSeedingTimeLimit: -1 });
      expect(component.ratioMode()).toBe('no-limit');
      expect(component.seedingMode()).toBe('no-limit');
      expect(component.inactiveMode()).toBe('no-limit');
    });
  });

  describe('setDisabledState', () => {
    it('should disable the form when true', () => {
      component.setDisabledState(true);
      expect(component.form.disabled).toBe(true);
    });

    it('should re-enable custom-mode controls when false', () => {
      component.setRatioMode('custom');
      component.setDisabledState(true);
      component.setDisabledState(false);
      expect(component.form.controls.ratioLimit.enabled).toBe(true);
    });
  });

  describe('registerOnChange', () => {
    it('should emit change when form value changes', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.ngOnInit();
      component.setRatioMode('custom');
      component.form.patchValue({ ratioLimit: 1.5 });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ratioLimit: 1.5 }));
    });

    it('should emit -2 for global mode', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.ngOnInit();
      component.setRatioMode('global');
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ratioLimit: -2 }));
    });

    it('should emit null for no-limit mode', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.ngOnInit();
      component.setRatioMode('no-limit');
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ratioLimit: null }));
    });
  });

  describe('registerOnTouched', () => {
    it('should call onTouched when form value changes', () => {
      const onTouched = vi.fn();
      component.registerOnTouched(onTouched);
      component.ngOnInit();
      component.form.patchValue({ seedingTimeLimit: 120 });
      expect(onTouched).toHaveBeenCalled();
    });
  });
});
