import { Injectable, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { Confirm } from '../components/modals/confirm/confirm';
import { setModalInput } from '../utils/modal-input';

export interface ParamWithData {
  text: string;
  data: object;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly modalService = inject(NgbModal);
  private readonly translateService = inject(TranslateService);

  public confirm(
    title: string | ParamWithData,
    message: string | ParamWithData,
    btnOkText: string = 'general.button.ok',
    btnCancelText: string = 'general.button.cancel',
    dialogSize: 'sm' | 'md' | 'lg' | 'xl' = 'md',
  ): Promise<boolean> {
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

    return modalRef.result.catch(() => false);
  }
}
