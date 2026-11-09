import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

export interface SelectListItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  disabled?: boolean;
}

/** Touch-friendly multi-select list; the phone replacement for small selection grids. */
@Component({
  selector: 'app-bb-select-list',
  standalone: true,
  templateUrl: './bb-select-list.html',
  styleUrl: './bb-select-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbSelectList {
  public readonly items = input<SelectListItem[]>([]);
  public readonly selectedIds = model<string[]>([]);
  public readonly emptyMessage = input('');

  protected readonly selectedSet = computed(() => new Set(this.selectedIds()));

  protected toggle(item: SelectListItem): void {
    if (item.disabled) return;
    const existing = new Set(this.items().map((i) => i.id));
    // Drop ids of rows that disappeared while the list was open.
    const current = this.selectedIds().filter((id) => existing.has(id));
    this.selectedIds.set(
      current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id],
    );
  }
}
