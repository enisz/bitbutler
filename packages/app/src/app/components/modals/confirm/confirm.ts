import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [TranslatePipe, AutofocusDirective, BbBtnContent],
  templateUrl: './confirm.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Confirm {
  public readonly activeModal = inject(NgbActiveModal);

  readonly title = input('components.modals.confirm.title');
  readonly titleParams = input<object>({});
  readonly message = input('components.modals.confirm.message');
  readonly messageParams = input<object>({});
  readonly btnOkText = input('general.button.ok');
  readonly btnCancelText = input('general.button.cancel');
  readonly okIcon = input<IconDefinition>(faCheck);
  readonly cancelIcon = input<IconDefinition>(faXmark);
}
