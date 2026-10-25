import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChild,
  forwardRef,
  input,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { BbCheckbox } from '../bb-checkbox/bb-checkbox';

export interface BbCheckTreeItem<K = unknown> {
  key: K;
  label: string;
  sub?: string;
}

/**
 * Extra content shown at the end of each item row, e.g. a count badge:
 * `<ng-template bbCheckTreeItem let-item>…</ng-template>`.
 */
@Directive({ selector: 'ng-template[bbCheckTreeItem]' })
export class BbCheckTreeItemTemplate {}

/**
 * A "select all" checkbox over an indented list of item checkboxes; the parent shows the mixed
 * state while only some items are selected. The value is the array of selected keys, bound to a
 * form or used with `[(value)]`.
 *
 * "Select all" acts on the items passed in, so a filtered list selects or clears only what it
 * shows and keeps the selection of the hidden items.
 *
 * Content projection: `[bbCheckTreeEmpty]` is shown in place of the items when there are none.
 */
@Component({
  selector: 'app-bb-check-tree',
  templateUrl: './bb-check-tree.html',
  styleUrl: './bb-check-tree.scss',
  imports: [BbCheckbox, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => BbCheckTree), multi: true },
  ],
})
export class BbCheckTree<K = unknown> implements ControlValueAccessor {
  public readonly items = input.required<readonly BbCheckTreeItem<K>[]>();
  public readonly allLabel = input.required<string>();
  public readonly value = model<readonly K[]>([]);
  public readonly disabled = input(false);

  protected readonly itemTemplate = contentChild(BbCheckTreeItemTemplate, { read: TemplateRef });

  private readonly disabledByForm = signal(false);
  private onChange: (value: readonly K[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly isDisabled = computed(() => this.disabled() || this.disabledByForm());
  protected readonly selected = computed(() => new Set(this.value()));
  private readonly selectedCount = computed(
    () => this.items().filter((item) => this.selected().has(item.key)).length,
  );
  protected readonly allSelected = computed(
    () => this.items().length > 0 && this.selectedCount() === this.items().length,
  );
  protected readonly someSelected = computed(
    () => this.selectedCount() > 0 && this.selectedCount() < this.items().length,
  );

  protected toggleAll(checked: boolean): void {
    const shown = new Set(this.items().map((item) => item.key));
    const hidden = this.value().filter((key) => !shown.has(key));
    this.update(checked ? [...hidden, ...shown] : hidden);
  }

  protected toggle(key: K, checked: boolean): void {
    const rest = this.value().filter((selectedKey) => selectedKey !== key);
    this.update(checked ? [...rest, key] : rest);
  }

  protected touch(): void {
    this.onTouched();
  }

  private update(value: readonly K[]): void {
    this.value.set(value);
    this.onChange(value);
  }

  public writeValue(value: readonly K[] | null): void {
    this.value.set(value ?? []);
  }

  public registerOnChange(fn: (value: readonly K[]) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabledByForm.set(isDisabled);
  }
}
