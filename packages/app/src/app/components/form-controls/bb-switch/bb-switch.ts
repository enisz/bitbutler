import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BbOptionText } from '../../../directives/bb-option-text';
import { BbBooleanControl } from '../bb-boolean-control';

/**
 * An on/off setting as an option row: label and sub-text on the left (single line, truncated),
 * the switch on the right. The host is a `.bb-option`, so it lines up with the other rows of a
 * `.bb-options` list or grid; row modifiers such as `bb-option--wide` go on the host.
 *
 * Content projection: `[bbLabelExtra]` next to the label text, e.g. a help popover.
 */
@Component({
  selector: 'app-bb-switch',
  templateUrl: './bb-switch.html',
  imports: [BbOptionText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'bb-option bb-ctl-hover',
    '[class.bb-ctl-disabled]': 'isDisabled()',
  },
})
export class BbSwitch extends BbBooleanControl {}
