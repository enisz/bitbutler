import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BbTooltip } from '../../../directives/bb-tooltip';
import { BbBooleanControl } from '../bb-boolean-control';

/**
 * A checkbox with an optional label and sub-text to its right.
 *
 * - `mixed`: the indeterminate state (a dash); a click resolves it to on.
 * - `invalid`: the error state; also shown when the bound form control is invalid and touched.
 * - `tone="danger"`: draws the on state in the danger color, for destructive choices.
 *
 * Content projection: default slot inside the label, after `label`; `[bbLabelExtra]` next to the
 * label but outside it, e.g. a help popover.
 */
@Component({
  selector: 'app-bb-checkbox',
  templateUrl: './bb-checkbox.html',
  imports: [BbTooltip],
  styleUrl: './bb-checkbox.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'bb-ctl-hover',
    '[class.bb-ctl-disabled]': 'isDisabled()',
  },
})
export class BbCheckbox extends BbBooleanControl {
  public readonly mixed = input(false);
  public readonly invalid = input(false);
  public readonly tone = input<'default' | 'danger'>('default');

  protected readonly showError = computed(() => this.invalid() || this.controlInvalid());
}
