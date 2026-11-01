import { Injectable, inject } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import type { BbCalloutVariant } from '../components/bb-callout/bb-callout';
import { setModalInput } from '../utils/modal-input';

export interface ParamWithData {
  text: string;
  data: object;
}

/** An extra note shown under the message; `title` and `message` are already translated. */
export interface ConfirmCallout {
  variant: BbCalloutVariant;
  icon?: IconDefinition;
  title: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly modalService = inject(NgbModal);
  private readonly translateService = inject(TranslateService);

  public async confirm(
    title: string | ParamWithData,
    message: string | ParamWithData,
    btnOkText: string = 'general.button.ok',
    btnCancelText: string = 'general.button.cancel',
    dialogSize: 'sm' | 'md' | 'lg' | 'xl' = 'md',
    okIcon: IconDefinition = faCheck,
    callout?: ConfirmCallout,
  ): Promise<boolean> {
    const { Confirm } = await import('../modals/confirm/confirm');
    const modalRef = this.modalService.open(Confirm, { size: dialogSize });

    if (typeof title !== 'string') {
      setModalInput(modalRef, 'title', title.text);
      setModalInput(modalRef, 'titleParams', title.data);
    } else {
      setModalInput(modalRef, 'title', title);
    }

    if (typeof message !== 'string') {
      setModalInput(modalRef, 'message', message.text);
      setModalInput(modalRef, 'messageParams', message.data);
    } else {
      setModalInput(modalRef, 'message', message);
    }

    setModalInput(modalRef, 'btnOkText', btnOkText);
    setModalInput(modalRef, 'btnCancelText', btnCancelText);
    setModalInput(modalRef, 'okIcon', okIcon);
    if (callout) setModalInput(modalRef, 'callout', callout);

    return modalRef.result.catch(() => false);
  }
}
