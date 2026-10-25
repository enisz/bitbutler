import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransferLimit } from './transfer-limit';

describe('TransferLimit', () => {
  let component: TransferLimit;
  let fixture: ComponentFixture<TransferLimit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransferLimit],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferLimit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the generic card sub-texts unless the context gives its own', () => {
    const subs = () =>
      Array.from(fixture.nativeElement.querySelectorAll('.bb-radio__sub')).map((sub) =>
        (sub as HTMLElement).textContent?.trim(),
      );

    expect(subs()).toEqual([
      'general.limit.sub.no-limit',
      'general.limit.sub.custom',
      'general.limit.sub.no-limit',
      'general.limit.sub.custom',
    ]);

    fixture.componentRef.setInput('noLimitSub', 'Never slows');
    fixture.componentRef.setInput('customSub', 'Slows to this');
    fixture.detectChanges();

    expect(subs()).toEqual(['Never slows', 'Slows to this', 'Never slows', 'Slows to this']);
  });

  describe('writeValue', () => {
    it('should patch form with provided values', () => {
      component.writeValue({ uploadLimit: 500, downloadLimit: 1000 });
      expect(component.form.value.uploadLimit).toBe(500);
      expect(component.form.value.downloadLimit).toBe(1000);
    });

    it('should reset all fields to null when null is passed', () => {
      component.writeValue({ uploadLimit: 100, downloadLimit: 200 });
      component.writeValue(null);
      expect(component.form.value.uploadLimit).toBeNull();
      expect(component.form.value.downloadLimit).toBeNull();
    });

    it('should set custom mode for positive values', () => {
      component.writeValue({ uploadLimit: 512, downloadLimit: 1024 });
      expect(component.uploadMode()).toBe('custom');
      expect(component.downloadMode()).toBe('custom');
    });

    it('should set no-limit mode for null values', () => {
      component.writeValue({ uploadLimit: null, downloadLimit: null });
      expect(component.uploadMode()).toBe('no-limit');
      expect(component.downloadMode()).toBe('no-limit');
    });
  });

  describe('setDisabledState', () => {
    it('should disable the form when true', () => {
      component.setDisabledState(true);
      expect(component.form.disabled).toBe(true);
    });

    it('should lock the mode cards too, and unlock them again', () => {
      const cards = () =>
        Array.from(
          fixture.nativeElement.querySelectorAll('app-bb-radio-group input'),
        ) as HTMLInputElement[];

      component.setDisabledState(true);
      fixture.detectChanges();
      expect(cards().every((card) => card.disabled)).toBe(true);

      component.setDisabledState(false);
      fixture.detectChanges();
      expect(cards().some((card) => card.disabled)).toBe(false);
    });

    it('should re-enable custom-mode controls when false', () => {
      component.setUploadMode('custom');
      component.setDisabledState(true);
      component.setDisabledState(false);
      expect(component.form.controls.uploadLimit.enabled).toBe(true);
    });
  });

  describe('registerOnChange', () => {
    it('should call onChange when form value changes', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.setUploadMode('custom');
      component.form.patchValue({ uploadLimit: 256 });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uploadLimit: 256 }));
    });

    it('should emit null for no-limit mode', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.setUploadMode('no-limit');
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uploadLimit: null }));
    });
  });

  describe('registerOnTouched', () => {
    it('should call onTouched when form value changes', () => {
      const onTouched = vi.fn();
      component.registerOnTouched(onTouched);
      component.form.patchValue({ downloadLimit: 512 });
      expect(onTouched).toHaveBeenCalled();
    });
  });
});
