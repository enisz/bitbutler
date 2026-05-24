import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [TranslatePipe, AutofocusDirective],
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
}
