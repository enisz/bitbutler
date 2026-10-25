import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { BbCheckbox } from './bb-checkbox';

@Component({
  template: `
    <app-bb-checkbox class="form" [formControl]="control" label="Start" sub="Begin at once" />
    <app-bb-checkbox class="free" [(checked)]="free" [mixed]="mixed()" tone="danger" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BbCheckbox, ReactiveFormsModule],
})
class HostComponent {
  public readonly control = new FormControl(false, { nonNullable: true });
  public readonly free = signal(false);
  public readonly mixed = signal(false);
}

describe('BbCheckbox', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const input = (selector: string) =>
    fixture.nativeElement.querySelector(`${selector} input`) as HTMLInputElement;
  const box = (selector: string) =>
    fixture.nativeElement.querySelector(`${selector} .bb-ctl-box`) as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the label and sub-text, both labelling the input', () => {
    const labels = fixture.nativeElement.querySelectorAll('.form label');

    expect(labels[0].textContent.trim()).toBe('Start');
    expect(labels[1].textContent.trim()).toBe('Begin at once');
    expect(labels[0].getAttribute('for')).toBe(input('.form').id);
    expect(labels[1].getAttribute('for')).toBe(input('.form').id);
  });

  it('writes the form value to the input', () => {
    host.control.setValue(true);
    fixture.detectChanges();

    expect(input('.form').checked).toBe(true);
  });

  it('writes a click back to the form', () => {
    input('.form').click();

    expect(host.control.value).toBe(true);
  });

  it('follows the form control disabled state', () => {
    host.control.disable();
    fixture.detectChanges();

    expect(input('.form').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.form').classList).toContain('bb-ctl-disabled');
  });

  it('shows the error state once the invalid control is touched', () => {
    host.control.addValidators(Validators.requiredTrue);
    host.control.updateValueAndValidity();
    fixture.detectChanges();
    expect(box('.form').classList).not.toContain('bb-ctl-box--error');

    input('.form').dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(box('.form').classList).toContain('bb-ctl-box--error');
    expect(input('.form').getAttribute('aria-invalid')).toBe('true');
  });

  it('supports two-way binding without a form', () => {
    input('.free').click();

    expect(host.free()).toBe(true);
  });

  it('sets the mixed state on the input', () => {
    host.mixed.set(true);
    fixture.detectChanges();

    expect(input('.free').indeterminate).toBe(true);
  });

  it('applies the danger tone to the box', () => {
    expect(box('.free').classList).toContain('bb-ctl-box--danger');
  });
});
