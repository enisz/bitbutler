import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BbSelectList, SelectListItem } from './bb-select-list';

@Component({
  template: `<app-bb-select-list
    [items]="items()"
    [(selectedIds)]="selected"
    [emptyMessage]="'nothing here'"
  />`,
  imports: [BbSelectList],
})
class HostComponent {
  items = signal<SelectListItem[]>([
    { id: 'a', title: 'Alpha', subtitle: '/data/a', meta: '3' },
    { id: 'b', title: 'Beta' },
    { id: 'c', title: 'Gamma', disabled: true },
  ]);
  selected = signal<string[]>([]);
}

describe('BbSelectList', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  };

  const row = (fixture: ReturnType<typeof setup>, id: string): HTMLElement =>
    fixture.nativeElement.querySelector(`[data-testid="select-row-${id}"]`);

  it('renders a row per item with title, subtitle and meta', () => {
    const fixture = setup();
    expect(row(fixture, 'a').textContent).toContain('Alpha');
    expect(row(fixture, 'a').textContent).toContain('/data/a');
    expect(row(fixture, 'a').textContent).toContain('3');
    expect(row(fixture, 'b')).not.toBeNull();
  });

  it('toggles a row on tap and marks it selected', () => {
    const fixture = setup();
    row(fixture, 'a').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toEqual(['a']);
    expect(row(fixture, 'a').classList.contains('bb-select-row--selected')).toBe(true);

    row(fixture, 'a').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toEqual([]);
  });

  it('supports selecting several rows', () => {
    const fixture = setup();
    row(fixture, 'a').click();
    row(fixture, 'b').click();
    expect(fixture.componentInstance.selected().sort()).toEqual(['a', 'b']);
  });

  it('ignores taps on disabled rows', () => {
    const fixture = setup();
    row(fixture, 'c').click();
    expect(fixture.componentInstance.selected()).toEqual([]);
  });

  it('drops selected ids that no longer exist in the items', () => {
    const fixture = setup();
    row(fixture, 'a').click();
    fixture.componentInstance.items.set([{ id: 'b', title: 'Beta' }]);
    fixture.detectChanges();
    row(fixture, 'b').click();
    expect(fixture.componentInstance.selected()).toEqual(['b']);
  });

  it('shows the empty message when there are no items', () => {
    const fixture = setup();
    fixture.componentInstance.items.set([]);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="select-empty"]').textContent,
    ).toContain('nothing here');
  });
});
