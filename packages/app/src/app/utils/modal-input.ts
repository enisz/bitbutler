import { ComponentRef } from '@angular/core';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

export function setModalInput(modalRef: NgbModalRef, name: string, value: unknown): void {
  const componentRef = (modalRef as any)._contentRef?.componentRef as
    | ComponentRef<unknown>
    | undefined;
  componentRef?.setInput(name, value);
}
