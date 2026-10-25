import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BbCheckTree, BbCheckTreeItem, BbCheckTreeItemTemplate } from './bb-check-tree';

@Component({
  template: `
    <app-bb-check-tree [items]="items()" allLabel="Select all" [formControl]="control">
      <ng-template bbCheckTreeItem let-item>
        <span class="count">{{ item.key.length }}</span>
      </ng-template>
      <p bbCheckTreeEmpty class="empty">Nothing here</p>
    </app-bb-check-tree>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BbCheckTree, BbCheckTreeItemTemplate, ReactiveFormsModule],
})
class HostComponent {
  public readonly items = signal<BbCheckTreeItem<string>[]>([
    { key: 'iso', label: 'ubuntu.iso' },
    { key: 'sums', label: 'SHA256SUMS' },
    { key: 'gpg', label: 'SHA256SUMS.gpg' },
  ]);
  public readonly control = new FormControl<readonly string[]>([], { nonNullable: true });
}

describe('BbCheckTree', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const inputs = () =>
    Array.from(fixture.nativeElement.querySelectorAll('input')) as HTMLInputElement[];
  const all = () => inputs()[0];
  const item = (index: number) => inputs()[index + 1];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the parent and one checkbox per item, with the item template', () => {
    expect(inputs()).toHaveLength(4);
    expect(fixture.nativeElement.querySelectorAll('.count')[1].textContent).toBe('4');
  });

  it('shows the parent unchecked, mixed and checked as the items get selected', () => {
    expect([all().checked, all().indeterminate]).toEqual([false, false]);

    host.control.setValue(['iso']);
    fixture.detectChanges();
    expect([all().checked, all().indeterminate]).toEqual([false, true]);

    host.control.setValue(['iso', 'sums', 'gpg']);
    fixture.detectChanges();
    expect([all().checked, all().indeterminate]).toEqual([true, false]);
  });

  it('toggles a single item', () => {
    item(1).click();
    expect(host.control.value).toEqual(['sums']);

    item(1).click();
    expect(host.control.value).toEqual([]);
  });

  it('selects every item from the parent, also from the mixed state', () => {
    host.control.setValue(['iso']);
    fixture.detectChanges();

    all().click();

    expect([...host.control.value].sort()).toEqual(['gpg', 'iso', 'sums']);
  });

  it('only selects or clears the items shown, keeping hidden selections', () => {
    host.control.setValue(['hidden']);
    host.items.set([{ key: 'iso', label: 'ubuntu.iso' }]);
    fixture.detectChanges();

    all().click();
    expect(host.control.value).toEqual(['hidden', 'iso']);

    fixture.detectChanges();
    all().click();
    expect(host.control.value).toEqual(['hidden']);
  });

  it('shows the empty content and disables the parent without items', () => {
    host.items.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.empty')).not.toBeNull();
    expect(all().disabled).toBe(true);
  });
});
