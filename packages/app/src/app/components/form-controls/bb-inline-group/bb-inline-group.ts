import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * A compact wrapping row of `app-bb-checkbox`es without sub-text (Start / Skip hash check /
 * Sequential). Label it with `aria-label` or `aria-labelledby` on the host. For a compact row of
 * radios use `app-bb-radio-group appearance="inline"`.
 */
@Component({
  selector: 'app-bb-inline-group',
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bb-inline-group', role: 'group' },
})
export class BbInlineGroup {}
