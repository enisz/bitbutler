import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BbTooltip } from '../../../directives/bb-tooltip';
import { BbRadioGroup } from './bb-radio-group';

/**
 * One choice of an `app-bb-radio-group`; drawn as a radio row, an inline radio or an option card
 * depending on the group's appearance. Content projected into it follows the label, e.g. a count;
 * `[bbRadioIcon]` content goes before the text (above it on a tile), e.g. a flag.
 * A label or sub-text cut off by a narrow card shows its full text in a tooltip.
 */
@Component({
  selector: 'app-bb-radio',
  templateUrl: './bb-radio.html',
  imports: [BbTooltip],
  styleUrl: './bb-radio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbRadio {
  public readonly value = input.required<unknown>();
  public readonly label = input<string>();
  public readonly sub = input<string>();
  public readonly disabled = input(false);

  protected readonly group = inject(BbRadioGroup);

  protected readonly checked = computed(() => this.group.value() === this.value());
  protected readonly isDisabled = computed(() => this.disabled() || this.group.isDisabled());
  protected readonly isCard = computed(() => this.group.appearance() === 'cards');
  protected readonly isTile = computed(() => this.group.appearance() === 'tiles');
  protected readonly showSub = computed(() => !!this.sub() && this.group.appearance() !== 'inline');

  protected onChange(): void {
    this.group.select(this.value());
  }
}
