import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BbCheckbox } from '../bb-checkbox/bb-checkbox';
import { BbInlineGroup } from './bb-inline-group';

@Component({
  template: `
    <app-bb-inline-group aria-label="Options">
      <app-bb-checkbox label="Start" />
      <app-bb-checkbox label="Sequential" />
    </app-bb-inline-group>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BbInlineGroup, BbCheckbox],
})
class HostComponent {}

describe('BbInlineGroup', () => {
  it('is a labelled group laying out its checkboxes in a row', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const group = fixture.nativeElement.querySelector('app-bb-inline-group') as HTMLElement;

    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Options');
    expect(group.classList).toContain('bb-inline-group');
    expect(group.querySelectorAll('app-bb-checkbox')).toHaveLength(2);
  });
});
