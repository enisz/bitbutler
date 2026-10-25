import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BbSegmented, BbSegmentedOption } from './bb-segmented';

type Mode = 'file' | 'link' | 'folder';

@Component({
  template: `
    <app-bb-segmented class="form" aria-label="Input" [options]="options" [formControl]="control" />
    <app-bb-segmented class="free" size="sm" [options]="options" [(value)]="free" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BbSegmented, ReactiveFormsModule],
})
class HostComponent {
  public readonly options: BbSegmentedOption<Mode>[] = [
    { value: 'file', label: 'File' },
    { value: 'link', label: 'Link' },
    { value: 'folder', label: 'Folder', disabled: true },
  ];
  public readonly control = new FormControl<Mode>('file', { nonNullable: true });
  public readonly free = signal<Mode>('link');
}

describe('BbSegmented', () => {
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

  it('renders one segment per option in a radio group', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.form label')).map((label) =>
      (label as HTMLElement).textContent?.trim(),
    );

    expect(element('.form').getAttribute('role')).toBe('radiogroup');
    expect(labels).toEqual(['File', 'Link', 'Folder']);
    expect(new Set(inputs('.form').map((radio) => radio.name)).size).toBe(1);
  });

  it('reads and writes the form value', () => {
    expect(inputs('.form').map((radio) => radio.checked)).toEqual([true, false, false]);

    inputs('.form')[1].click();

    expect(host.control.value).toBe('link');
  });

  it('disables a single option, or all of them with the form control', () => {
    expect(inputs('.form').map((radio) => radio.disabled)).toEqual([false, false, true]);

    host.control.disable();
    fixture.detectChanges();

    expect(inputs('.form').every((radio) => radio.disabled)).toBe(true);
  });

  it('supports the small size and two-way binding without a form', () => {
    expect(element('.free').classList).toContain('bb-ctl-segments--sm');
    expect(inputs('.free')[1].checked).toBe(true);

    inputs('.free')[0].click();

    expect(host.free()).toBe('file');
  });
});
