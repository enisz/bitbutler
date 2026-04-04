import { Component, inject, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './confirm.html',
})
export class Confirm {
  public readonly activeModal = inject(NgbActiveModal);

  @Input() title = 'components.modals.confirm.title';
  @Input() titleParams: object = {};
  @Input() message = 'components.modals.confirm.message';
  @Input() messageParams: object = {};
  @Input() btnOkText = 'general.button.ok';
  @Input() btnCancelText = 'general.button.cancel';
}
