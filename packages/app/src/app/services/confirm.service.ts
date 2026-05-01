import { Injectable, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { Confirm } from '../components/modals/confirm/confirm';

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
    btnOkText: string = 'global.button.ok',
    btnCancelText: string = 'global.button.cancel',
    dialogSize: 'sm' | 'md' | 'lg' | 'xl' = 'md',
  ): Promise<boolean> {
    const modalRef = this.modalService.open(Confirm, { size: dialogSize });

    if (typeof title !== 'string') {
      modalRef.componentInstance.title = title.text;
      modalRef.componentInstance.titleParams = title.data;
    } else {
      modalRef.componentInstance.title = title;
    }

    if (typeof message !== 'string') {
      modalRef.componentInstance.message = message.text;
      modalRef.componentInstance.messageParams = message.data;
    } else {
      modalRef.componentInstance.message = message;
    }

    modalRef.componentInstance.btnOkText = btnOkText;
    modalRef.componentInstance.btnCancelText = btnCancelText;

    return modalRef.result.catch(() => false);
  }
}
