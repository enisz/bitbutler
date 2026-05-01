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
  });

  describe('setDisabledState', () => {
    it('should disable the form when true', () => {
      component.setDisabledState(true);
      expect(component.form.disabled).toBe(true);
    });

    it('should enable the form when false', () => {
      component.setDisabledState(true);
      component.setDisabledState(false);
      expect(component.form.enabled).toBe(true);
    });
  });

  describe('registerOnChange', () => {
    it('should call onChange when form value changes', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.ngOnInit();
      component.form.patchValue({ uploadLimit: 256 });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uploadLimit: 256 }));
    });
  });

  describe('registerOnTouched', () => {
    it('should call onTouched when form value changes', () => {
      const onTouched = vi.fn();
      component.registerOnTouched(onTouched);
      component.ngOnInit();
      component.form.patchValue({ downloadLimit: 512 });
      expect(onTouched).toHaveBeenCalled();
    });
  });
});
