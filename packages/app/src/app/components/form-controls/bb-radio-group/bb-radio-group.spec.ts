import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BbRadio } from './bb-radio';
import { BbRadioGroup, BbRadioGroupAppearance } from './bb-radio-group';

@Component({
  template: `
    <app-bb-radio-group
      class="form"
      aria-label="Priority"
      [formControl]="control"
      [appearance]="appearance()"
    >
      <app-bb-radio value="low" label="Low" sub="Slow" />
      <app-bb-radio value="normal" label="Normal" sub="Default" />
      <app-bb-radio value="high" label="High" sub="Fast" [disabled]="true" />
    </app-bb-radio-group>
    <app-bb-radio-group class="free" appearance="cards" [columns]="2" [(value)]="free">
      <app-bb-radio [value]="1" label="One"><span class="count">(3)</span></app-bb-radio>
      <app-bb-radio [value]="2" label="Two" />
      <app-bb-radio [value]="3" label="Three" />
      <app-bb-radio [value]="4" label="Four" />
    </app-bb-radio-group>
    <app-bb-radio-group class="tiles" appearance="tiles" [(value)]="tile">
      <app-bb-radio value="us" label="English"><span bbRadioIcon class="flag"></span></app-bb-radio>
      <app-bb-radio value="hu" label="Magyar" />
    </app-bb-radio-group>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BbRadioGroup, BbRadio, ReactiveFormsModule],
})
class HostComponent {
  public readonly control = new FormControl('normal', { nonNullable: true });
  public readonly appearance = signal<BbRadioGroupAppearance>('list');
  public readonly free = signal<number | null>(null);
  public readonly tile = signal('us');
}

describe('BbRadioGroup', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const element = (selector: string) =>
    fixture.nativeElement.querySelector(selector) as HTMLElement;
  const inputs = (selector: string) =>
    Array.from(fixture.nativeElement.querySelectorAll(`${selector} input`)) as HTMLInputElement[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('is a radio group whose radios share one name', () => {
    const names = new Set(inputs('.form').map((radio) => radio.name));

    expect(element('.form').getAttribute('role')).toBe('radiogroup');
    expect(names.size).toBe(1);
    expect(inputs('.free')[0].name).not.toBe(inputs('.form')[0].name);
  });

  it('checks the radio matching the form value', () => {
    expect(inputs('.form').map((radio) => radio.checked)).toEqual([false, true, false]);

    host.control.setValue('low');
    fixture.detectChanges();

    expect(inputs('.form').map((radio) => radio.checked)).toEqual([true, false, false]);
  });

  it('writes the chosen radio back to the form', () => {
    inputs('.form')[0].click();

    expect(host.control.value).toBe('low');
  });

  it('disables a single radio, or all of them with the form control', () => {
    expect(inputs('.form').map((radio) => radio.disabled)).toEqual([false, false, true]);

    host.control.disable();
    fixture.detectChanges();

    expect(inputs('.form').every((radio) => radio.disabled)).toBe(true);
  });

  it('shows the sub-text in the list, but not inline', () => {
    expect(element('.form .bb-radio__sub').textContent).toBe('Slow');

    host.appearance.set('inline');
    fixture.detectChanges();

    expect(element('.form').classList).toContain('bb-radio-group--inline');
    expect(element('.form .bb-radio__sub')).toBeNull();
  });

  it('draws option cards in the requested number of columns', () => {
    expect(element('.free').classList).toContain('bb-radio-group--cards');
    expect(element('.free').style.getPropertyValue('--bb-radio-columns')).toBe('2');
    expect(fixture.nativeElement.querySelectorAll('.free .bb-ctl-card')).toHaveLength(4);
  });

  it('defaults the card columns to the number of options', () => {
    host.appearance.set('cards');
    fixture.detectChanges();

    expect(element('.form').style.getPropertyValue('--bb-radio-columns')).toBe('3');
  });

  it('projects extra content after the label', () => {
    expect(element('.free .bb-radio__label .count').textContent).toBe('(3)');
  });

  it('supports two-way binding without a form', () => {
    inputs('.free')[1].click();

    expect(host.free()).toBe(2);
  });

  it('draws tiles without a radio circle, the icon before the label, still choosable', () => {
    const tiles = fixture.nativeElement.querySelectorAll('.tiles .bb-radio--tile');

    expect(tiles).toHaveLength(2);
    expect(element('.tiles .bb-ctl-circle')).toBeNull();
    expect(element('.tiles .bb-radio__icon .flag')).not.toBeNull();

    inputs('.tiles')[1].click();

    expect(host.tile()).toBe('hu');
  });
});
