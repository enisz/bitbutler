import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BbSwitch } from './bb-switch';

@Component({
  template: `
    <app-bb-switch
      class="form bb-option--wide"
      [formControl]="control"
      label="Delete torrent files"
      sub="Removes the source file"
    >
      <span bbLabelExtra class="extra">?</span>
    </app-bb-switch>
    <app-bb-switch class="free" label="Free" [(checked)]="free" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BbSwitch, ReactiveFormsModule],
})
class HostComponent {
  public readonly control = new FormControl(false, { nonNullable: true });
  public readonly free = signal(true);
}

describe('BbSwitch', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const element = (selector: string) =>
    fixture.nativeElement.querySelector(selector) as HTMLElement;
  const input = (selector: string) => element(`${selector} input`) as HTMLInputElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('is an option row that keeps the modifier classes set on it', () => {
    expect(element('.form').classList).toContain('bb-option');
    expect(element('.form').classList).toContain('bb-option--wide');
  });

  it('renders the label, sub-text and projected extra, labelling the switch', () => {
    const id = input('.form').id;

    expect(element('.form .bb-option__label-text').textContent).toBe('Delete torrent files');
    expect(element('.form .bb-option__sub').textContent).toBe('Removes the source file');
    expect(element('.form .bb-option__label > .extra')).not.toBeNull();
    expect(element('.form .bb-option__label').getAttribute('for')).toBe(id);
    expect(input('.form').getAttribute('role')).toBe('switch');
  });

  it('omits the sub-text when none is given', () => {
    expect(element('.free .bb-option__sub')).toBeNull();
  });

  it('reads and writes the form value', () => {
    host.control.setValue(true);
    fixture.detectChanges();
    expect(input('.form').checked).toBe(true);

    input('.form').click();
    expect(host.control.value).toBe(false);
  });

  it('follows the form control disabled state', () => {
    host.control.disable();
    fixture.detectChanges();

    expect(input('.form').disabled).toBe(true);
  });

  it('supports two-way binding without a form', () => {
    expect(input('.free').checked).toBe(true);

    input('.free').click();

    expect(host.free()).toBe(false);
  });
});
